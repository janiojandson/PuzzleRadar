// ============================================
// 🧩 PuzzleRadar — BullMQ Worker (Range Distributor)
// ============================================
// Processa filas de distribuição de ranges
// e coordena workers distribuídos
// ============================================

require('dotenv').config();
const { Queue, Worker } = require('bullmq');

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined
};

// ─── FILAS ───
const rangeDistributionQueue = new Queue('range-distribution', { connection: REDIS_CONFIG });
const resultProcessingQueue = new Queue('result-processing', { connection: REDIS_CONFIG });
const notificationQueue = new Queue('notifications', { connection: REDIS_CONFIG });

// ─── WORKER: DISTRIBUIÇÃO DE RANGES ───
const rangeWorker = new Worker('range-distribution', async (job) => {
  const { poolId, puzzleId, rangeStart, rangeEnd, numSplits, strategy } = job.data;
  
  console.log(`[Worker] Distribuindo ranges para pool ${poolId}`);
  console.log(`[Worker] Range: ${rangeStart} → ${rangeEnd}`);
  console.log(`[Worker] Splits: ${numSplits}, Estratégia: ${strategy}`);
  
  // TODO: Implementar lógica real com Prisma
  // 1. Buscar puzzle do DB
  // 2. Dividir range em sub-ranges
  // 3. Criar registros de Range no DB
  // 4. Notificar workers disponíveis
  
  const ranges = [];
  const start = BigInt('0x' + rangeStart);
  const end = BigInt('0x' + rangeEnd);
  const totalRange = end - start + 1n;
  const chunkSize = totalRange / BigInt(numSplits);
  
  for (let i = 0; i < numSplits; i++) {
    const chunkStart = start + chunkSize * BigInt(i);
    const chunkEnd = i === numSplits - 1 ? end : chunkStart + chunkSize - 1n;
    
    ranges.push({
      index: i,
      rangeStart: chunkStart.toString(16),
      rangeEnd: chunkEnd.toString(16),
      status: 'PENDING'
    });
  }
  
  console.log(`[Worker] ${ranges.length} ranges criados`);
  
  return { poolId, rangesCreated: ranges.length, strategy };
}, { connection: REDIS_CONFIG });

// ─── WORKER: PROCESSAMENTO DE RESULTADOS ───
const resultWorker = new Worker('result-processing', async (job) => {
  const { rangeId, workerId, result, keysChecked, foundPrivateKey, computeHours } = job.data;
  
  console.log(`[Worker] Processando resultado do range ${rangeId}`);
  
  if (result === 'FOUND') {
    console.log(`[Worker] 🎯 CHAVE ENCONTRADA pelo worker ${workerId}!`);
    
    // Notificar admin
    await notificationQueue.add('key-found', {
      type: 'KEY_FOUND',
      rangeId,
      workerId,
      timestamp: new Date().toISOString()
    }, { priority: 1 }); // Prioridade máxima
  }
  
  // TODO: Atualizar range no DB
  // TODO: Calcular shares
  // TODO: Atualizar progresso do pool
  // TODO: Atribuir próximo range ao worker
  
  return { rangeId, processed: true };
}, { connection: REDIS_CONFIG });

// ─── WORKER: NOTIFICAÇÕES ───
const notificationWorker = new Worker('notifications', async (job) => {
  const { type, rangeId, workerId } = job.data;
  
  if (type === 'KEY_FOUND') {
    console.log(`[NOTIFICAÇÃO] 🎯🎯🎯 CHAVE ENCONTRADA! Range: ${rangeId}, Worker: ${workerId}`);
    // TODO: Enviar email, webhook, push notification
  }
  
  return { notified: true };
}, { connection: REDIS_CONFIG });

// ─── EVENT LISTENERS ───
rangeWorker.on('completed', (job) => {
  console.log(`[Worker] Range distribution completed: ${job.id}`);
});

rangeWorker.on('failed', (job, err) => {
  console.error(`[Worker] Range distribution failed:`, err.message);
});

resultWorker.on('completed', (job) => {
  console.log(`[Worker] Result processing completed: ${job.id}`);
});

notificationWorker.on('completed', (job) => {
  console.log(`[Worker] Notification sent: ${job.id}`);
});

console.log('🧩 PuzzleRadar Worker iniciado');
console.log(`📊 Redis: ${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`);

// Manter processo vivo
process.on('SIGTERM', async () => {
  await rangeWorker.close();
  await resultWorker.close();
  await notificationWorker.close();
  process.exit(0);
});