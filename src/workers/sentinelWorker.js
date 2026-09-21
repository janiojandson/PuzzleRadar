// sentinelWorker.js — Async Solver Launcher (BullMQ)
const { Worker } = require('bullmq');
const { execFile } = require('child_process');
const Redis = require('ioredis');

const QUEUE_NAME = 'solver-queue';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const SOLVER_PATHS = {
  lambda: process.env.LAMBDA_PATH || '/mnt/d/Cripto/pollardslambda-main/lambda',
  bsgs: process.env.BSGS_PATH || '/mnt/d/Cripto/cacachave-main/cacachave',
};

// Use WSL to execute Linux binaries on Windows
const WSL_PREFIX = process.platform === 'win32' ? ['wsl', '-d', 'Ubuntu', '--', 'bash', '-c'] : [];

class SolverWorker {
  constructor() {
    this.worker = new Worker(QUEUE_NAME, this.processJob.bind(this), {
      connection: REDIS_CONFIG,
      concurrency: 2,
    });

    this.worker.on('completed', (job) => {
      console.log(`[Solver] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Solver] Job ${job.id} failed:`, err.message);
    });
  }

  async processJob(job) {
    const { type, public_key, range_end, threads } = job.data;
    
    console.log(`[Solver] Processing ${type} for ${public_key.slice(0, 20)}...`);
    
    return new Promise((resolve, reject) => {
      let command, args;
      
      if (type === 'lambda') {
        const lambdaCmd = `${SOLVER_PATHS.lambda} --pubkey ${public_key} --keyrange ${range_end || '140'} --walkers 1000000 --t ${threads || 24} --snaptime 60`;
        command = WSL_PREFIX[0] || SOLVER_PATHS.lambda;
        args = WSL_PREFIX.length > 0 
          ? [...WSL_PREFIX.slice(1), lambdaCmd]
          : ['--pubkey', public_key, '--keyrange', range_end || '140', '--walkers', '1000000', '--t', String(threads || 24), '--snaptime', '60'];
      } else if (type === 'bsgs') {
        const bsgsCmd = `${SOLVER_PATHS.bsgs} -m bsgs -f - -b ${range_end || '140'} -R -t ${threads || 24} -q -s 30`;
        command = WSL_PREFIX[0] || SOLVER_PATHS.bsgs;
        args = WSL_PREFIX.length > 0
          ? [...WSL_PREFIX.slice(1), bsgsCmd]
          : ['-m', 'bsgs', '-f', '-', '-b', range_end || '140', '-R', '-t', String(threads || 24), '-q', '-s', '30'];
      } else {
        reject(new Error(`Unknown solver type: ${type}`));
        return;
      }
      
      const proc = execFile(command, args, { 
        timeout: 3600000,
        maxBuffer: 1024 * 1024 
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Solver] Error:`, error.message);
          reject(error);
          return;
        }
        
        if (stdout.includes('privkey') || stdout.includes('MATCH')) {
          resolve({ status: 'found', output: stdout, public_key });
        } else {
          resolve({ status: 'completed', output: stdout, public_key });
        }
      });
      
      proc.stdout.on('data', (data) => {
        process.stdout.write(`[Solver: ${type}] ${data}`);
      });
    });
  }

  async stop() {
    await this.worker.close();
  }
}

module.exports = SolverWorker;
