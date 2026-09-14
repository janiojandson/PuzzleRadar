// ============================================
// 🧩 PuzzleRadar — Redis Client & Space Pruning (Bitmaps)
// ============================================

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_PRIVATE_URL || null;

let redisClient = null;
const memoryBitmapStore = new Map(); // Fallback in-memory para desenvolvimento/testes locais

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ [PuzzleRadar Redis] Conectado com sucesso');
    });

    redisClient.on('error', (err) => {
      console.warn('⚠️ [PuzzleRadar Redis] Aviso/Erro de conexão:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ [PuzzleRadar Redis] Falha ao instanciar ioredis. Usando fallback in-memory.');
    redisClient = null;
  }
} else {
  console.log('ℹ️ [PuzzleRadar Redis] REDIS_URL não configurada. Utilizando Bitmap Memory Store.');
}

/**
 * Marca uma fatia/chunk como testado/já escaneado (Space Pruning)
 */
async function markChunkScanned(puzzleId, chunkIndex) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  if (redisClient && redisClient.status === 'ready') {
    return await redisClient.setbit(key, chunkIndex, 1);
  } else {
    if (!memoryBitmapStore.has(key)) {
      memoryBitmapStore.set(key, new Set());
    }
    memoryBitmapStore.get(key).add(Number(chunkIndex));
    return 1;
  }
}

/**
 * Verifica se um chunk já foi escaneado anteriormente
 */
async function isChunkScanned(puzzleId, chunkIndex) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  if (redisClient && redisClient.status === 'ready') {
    const bit = await redisClient.getbit(key, chunkIndex);
    return bit === 1;
  } else {
    const set = memoryBitmapStore.get(key);
    return set ? set.has(Number(chunkIndex)) : false;
  }
}

/**
 * Importa histórico de ranges escaneados em lote (Space Pruning Ingestion)
 * @param {string} puzzleId - ID do puzzle
 * @param {Array<number|string>} chunksOrRanges - Lista de índices ou ranges a descartar
 * @param {number} totalChunksInSpace - Espaço total estimado
 */
async function bulkImportHistory(puzzleId, chunksOrRanges = [], totalChunksInSpace = 10000) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  let importedCount = 0;

  if (redisClient && redisClient.status === 'ready') {
    const pipeline = redisClient.pipeline();
    for (const item of chunksOrRanges) {
      const idx = typeof item === 'number' ? item : parseInt(item, 10);
      if (!isNaN(idx) && idx >= 0) {
        pipeline.setbit(key, idx, 1);
        importedCount++;
      }
    }
    await pipeline.exec();
  } else {
    if (!memoryBitmapStore.has(key)) {
      memoryBitmapStore.set(key, new Set());
    }
    const set = memoryBitmapStore.get(key);
    for (const item of chunksOrRanges) {
      const idx = typeof item === 'number' ? item : parseInt(item, 10);
      if (!isNaN(idx) && idx >= 0) {
        set.add(idx);
        importedCount++;
      }
    }
  }

  const stats = await getPruningStats(puzzleId, totalChunksInSpace);
  return {
    importedCount,
    ...stats
  };
}

/**
 * Retorna estatísticas do Space Pruning para um puzzle
 */
async function getPruningStats(puzzleId, totalChunksInSpace = 10000) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  let scannedCount = 0;

  if (redisClient && redisClient.status === 'ready') {
    scannedCount = await redisClient.bitcount(key);
  } else {
    const set = memoryBitmapStore.get(key);
    scannedCount = set ? set.size : 0;
  }

  const total = Math.max(scannedCount, totalChunksInSpace);
  const prunedPercent = total > 0 ? (scannedCount / total) * 100 : 0;

  return {
    puzzleId,
    totalChunks: total,
    scannedChunks: scannedCount,
    remainingChunks: total - scannedCount,
    prunedPercent: parseFloat(prunedPercent.toFixed(4)),
    status: prunedPercent >= 100 ? 'FULLY_SCANNED' : 'PRUNED_ACTIVE'
  };
}

module.exports = {
  redisClient,
  markChunkScanned,
  isChunkScanned,
  bulkImportHistory,
  getPruningStats
};
