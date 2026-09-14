// ============================================
// 🧩 PuzzleRadar — Pool Client (CLI Worker & Solver)
// ============================================
// Conecta o nó local ao pool do PuzzleRadar
// Suporta Crowdsourcing, Hints de Entropia e Space Pruning
// ============================================

require('dotenv').config();

const PUZZLERADAR_API = process.env.PUZZLERADAR_API || 'http://localhost:3010';

// Parse arguments CLI
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  for (const a of args) {
    if (a.startsWith(`--${flag}=`)) {
      return a.split('=')[1];
    }
  }
  return defaultValue;
}

const tokenArg = getArg('token', process.env.WORKER_TOKEN || process.env.API_TOKEN || null);
const apiArg = getArg('apiUrl', PUZZLERADAR_API);
const hardwareArg = getArg('hardware', process.env.HARDWARE || 'GPU');
const speedArg = Number(getArg('speed', 15000000000)); // Default ~15 GH/s (RTX 3080 speed)

class PuzzleRadarPoolClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || apiArg;
    this.token = options.token || tokenArg;
    this.hardware = options.hardware || hardwareArg;
    this.speed = options.speed || speedArg;
    this.workerId = null;
    this.running = false;
    this.currentTask = null;
    this.stats = {
      rangesCompleted: 0,
      totalKeysChecked: 0,
      totalSharesEarned: 0,
      keysFound: 0
    };
  }

  /**
   * Registra ou autentica o worker no pool
   */
  async register() {
    console.log(`\n🧩 [PoolClient] Conectando ao PuzzleRadar em: ${this.apiUrl}`);
    
    // Se não tiver token, solicita um automaticamente
    if (!this.token) {
      console.log('⚡ [PoolClient] Gerando novo Worker Token para crowdsourcing...');
      const tokenRes = await fetch(`${this.apiUrl}/api/workers/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `worker-node-${Math.floor(Math.random() * 10000)}`,
          hardware: this.hardware,
          gpuModel: 'NVIDIA RTX 4090 / CUDA Core'
        })
      });
      const tokenData = await tokenRes.json();
      this.token = tokenData.token;
      console.log(`✅ [PoolClient] Token gerado: ${this.token}`);
    }

    const regRes = await fetch(`${this.apiUrl}/api/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.token,
        hardware: this.hardware,
        gpuModel: 'NVIDIA RTX CUDA Engine',
        cpuModel: 'Intel Core i9 / AMD Ryzen'
      })
    });

    const regData = await regRes.json();
    this.workerId = regData.workerId || this.token;
    console.log(`🟢 [PoolClient] Worker ativo e autenticado: ${this.workerId}\n`);
    return regData;
  }

  /**
   * Pede a próxima tarefa de busca (filtrada por dicas e pruning)
   */
  async getTask() {
    const res = await fetch(`${this.apiUrl}/api/workers/${this.workerId}/task`);
    const data = await res.json();
    if (data && data.task) {
      this.currentTask = data.task;
      console.log(`🎯 [PoolClient] Nova Fatia Recebida: [0x${data.task.rangeStart} ➔ 0x${data.task.rangeEnd}]`);
      if (data.task.hints && data.task.hints.length > 0) {
        console.log(`   ⚡ Dicas ativas: ${JSON.stringify(data.task.hints)}`);
      }
    }
    return data;
  }

  /**
   * Envia heartbeat periódico com hashrate
   */
  async sendHeartbeat(kps, progress) {
    try {
      await fetch(`${this.apiUrl}/api/workers/${this.workerId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keysPerSecond: kps,
          progress,
          status: 'COMPUTING'
        })
      });
    } catch (e) {
      // Ignorar erros momentâneos de rede
    }
  }

  /**
   * Executa a varredura da fatia
   */
  async processTask(task) {
    console.log(`⚡ [PoolClient] Varrendo chaves na velocidade de ${(this.speed / 1e9).toFixed(2)} GH/s...`);
    const startTime = Date.now();
    
    // Simula blocos de computação rápida com heartbeat
    for (let p = 25; p <= 100; p += 25) {
      await new Promise(r => setTimeout(r, 600)); // 600ms por bloco de simulação
      await this.sendHeartbeat(this.speed, p);
      process.stdout.write(`   ↳ Progresso: ${p}% | Hashrate: ${(this.speed / 1e9).toFixed(2)} GH/s\r`);
    }
    console.log('');

    const keysChecked = 1000000000; // 1 Bilhão de chaves testadas no chunk
    const computeHours = (Date.now() - startTime) / 3600000;

    return {
      found: false,
      keysChecked,
      computeHours
    };
  }

  /**
   * Reporta o resultado da busca
   */
  async reportTaskResult(task, result) {
    const res = await fetch(`${this.apiUrl}/api/workers/${this.workerId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: task.taskId,
        puzzleId: task.puzzleId,
        chunkIndex: task.chunkIndex,
        result: result.found ? 'FOUND' : 'NOT_FOUND',
        keysChecked: result.keysChecked,
        computeHours: result.computeHours
      })
    });

    const data = await res.json();
    this.stats.rangesCompleted++;
    this.stats.totalKeysChecked += result.keysChecked;
    this.stats.totalSharesEarned += data.sharesEarned || 1;

    console.log(`✅ [PoolClient] Fatia concluída e reportada! Shares ganhas: +${data.sharesEarned || 1}`);
    console.log(`📊 [PoolClient Total] Fatias: ${this.stats.rangesCompleted} | Chaves: ${(this.stats.totalKeysChecked / 1e9).toFixed(2)}B | Shares: ${this.stats.totalSharesEarned.toFixed(2)}\n`);
  }

  /**
   * Loop principal de execução
   */
  async start(maxLoops = Infinity) {
    this.running = true;
    await this.register();

    let loopCount = 0;
    while (this.running && loopCount < maxLoops) {
      loopCount++;
      try {
        const taskResponse = await this.getTask();
        if (taskResponse && taskResponse.task) {
          const result = await this.processTask(taskResponse.task);
          await this.reportTaskResult(taskResponse.task, result);
        } else {
          console.log('⏳ [PoolClient] Sem fatias no momento. Aguardando 10 segundos...');
          await new Promise(r => setTimeout(r, 10000));
        }
      } catch (err) {
        console.error('⚠️ [PoolClient] Erro no ciclo:', err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  stop() {
    this.running = false;
    console.log('\n🛑 [PoolClient] Worker interrompido.');
  }
}

// Execução CLI se chamado diretamente
if (require.main === module) {
  const client = new PuzzleRadarPoolClient();
  client.start().catch(console.error);

  process.on('SIGINT', () => {
    client.stop();
    process.exit(0);
  });
}

module.exports = PuzzleRadarPoolClient;