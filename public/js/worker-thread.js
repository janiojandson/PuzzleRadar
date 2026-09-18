// =========================================================================
// 🧩 PuzzleRadar v5.3 — Web Worker Dedicated Background Mining Thread (P + G)
// =========================================================================
// Executa a busca sequencial de chaves no micro-lote atribuído pela API,
// utilizando adição de pontos secp256k1 P_{i+1} = P_i + G com BigInt.
// =========================================================================

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function modInverse(k, p = P) {
  if (k === 0n) return 0n;
  let result = 1n;
  let base = k % p;
  let exp = p - 2n;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % p;
    base = (base * base) % p;
    exp /= 2n;
  }
  return result;
}

function pointAdd(p1, p2) {
  if (!p1) return p2;
  if (!p2) return p1;
  if (p1.x === p2.x && p1.y !== p2.y) return null;

  let slope;
  if (p1.x === p2.x && p1.y === p2.y) {
    const num = (3n * p1.x * p1.x) % P;
    const den = modInverse(2n * p1.y, P);
    slope = (num * den) % P;
  } else {
    const num = (p2.y - p1.y + P) % P;
    const den = modInverse((p2.x - p1.x + P) % P, P);
    slope = (num * den) % P;
  }

  const x3 = (slope * slope - p1.x - p2.x) % P;
  const x3Pos = (x3 + P) % P;
  const y3 = (slope * (p1.x - x3Pos) - p1.y) % P;
  const y3Pos = (y3 + P) % P;

  return { x: x3Pos, y: y3Pos };
}

function scalarMultiply(k) {
  let current = { x: Gx, y: Gy };
  let result = null;
  let exp = k;

  while (exp > 0n) {
    if (exp % 2n === 1n) result = pointAdd(result, current);
    current = pointAdd(current, current);
    exp /= 2n;
  }
  return result;
}

let isMining = false;
let currentLote = null;

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
  const batchReportInterval = 25000;
  let lastTime = Date.now();

  const G = { x: Gx, y: Gy };
  let P_curr = scalarMultiply(startBig);

  self.postMessage({
    type: 'STARTED',
    custom_range: lote.custom_range,
    priority_score: lote.priority_score
  });

  while (isMining && currentBig < endBig) {
    currentBig += 1n;
    keysInBatch++;
    totalProcessed += 1n;

    // Adição de Ponto P_{i+1} = P_i + G
    P_curr = pointAdd(P_curr, G);

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
