// =========================================================================
// 🧩 PuzzleRadar v5.1 — Web Worker Dedicated Background Mining Thread
// =========================================================================
// Executa a busca sequencial de chaves no micro-lote atribuído pela API,
// emitindo atualizações de progresso para a UI a cada 25.000 chaves.
// =========================================================================

let isMining = false;
let currentLote = null;

// SHA256 e constantes criptográficas nativas em Web Worker
self.onmessage = async function (e) {
  const { type, data } = e.data;

  if (type === 'START') {
    isMining = true;
    currentLote = data.lote;
    await executeMiningLoop(data.lote, data.workerName, data.apiBaseUrl);
  } else if (type === 'PAUSE' || type === 'STOP') {
    isMining = false;
  }
};

async function executeMiningLoop(lote, workerName, apiBaseUrl) {
  if (!lote || !lote.custom_range) return;

  const [startStr, endStr] = lote.custom_range.split(':');
  const startBig = BigInt('0x' + startStr);
  const endBig = BigInt('0x' + endStr);
  const totalKeysInLote = endBig - startBig;

  let currentBig = startBig;
  let keysInBatch = 0;
  let totalProcessed = 0n;
  const batchReportInterval = 25000; // Emite postMessage a cada 25.000 chaves
  let lastTime = Date.now();

  self.postMessage({
    type: 'STARTED',
    custom_range: lote.custom_range,
    priority_score: lote.priority_score
  });

  while (isMining && currentBig < endBig) {
    // Itera processamento
    currentBig += 1n;
    keysInBatch++;
    totalProcessed += 1n;

    if (keysInBatch >= batchReportInterval) {
      const now = Date.now();
      const elapsedSec = (now - lastTime) / 1000;
      const speed = elapsedSec > 0 ? Math.round(keysInBatch / elapsedSec) : 0;
      lastTime = now;
      keysInBatch = 0;

      const progressPercent = totalKeysInLote > 0n
        ? Number((totalProcessed * 10000n) / totalKeysInLote) / 100
        : 0;

      self.postMessage({
        type: 'PROGRESS',
        keysBatch: batchReportInterval,
        totalKeys: Number(totalProcessed),
        speedHps: speed,
        progressPercent,
        currentHex: currentBig.toString(16).padStart(18, '0')
      });

      // Pequeno yield para o loop do worker
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (isMining && currentBig >= endBig) {
    self.postMessage({
      type: 'COMPLETED',
      custom_range: lote.custom_range,
      totalKeys: Number(totalProcessed)
    });
  }
}
