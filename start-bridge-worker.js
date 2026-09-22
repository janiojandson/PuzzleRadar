// start-bridge-worker.js — Iniciar Bridge + Worker
const SentinelBridge = require('./src/services/sentinelBridge');
const SolverWorker = require('./src/workers/sentinelWorker');

const bridge = new SentinelBridge();
const worker = new SolverWorker();

bridge.start();
console.log('[Bridge] Started - listening for sentinel events');

process.on('SIGINT', function() {
  bridge.stop();
  worker.stop();
  process.exit(0);
});
