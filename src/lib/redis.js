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

const memoryDpStore = new Map(); // Fallback in-memory para Distinguished Points (dp:<puzzleId> -> Map(xHex -> payload))

/**
 * Armazena um Distinguished Point no Redis Hash O(1) e verifica colisão Tame vs Wild
 * Formato do valor: "<USER_ID>|<IS_TAME>|<Y_COORD_HEX>|<DISTANCE_HEX>"
 */
async function storeDistinguishedPoint(challengeId, xCoordHex, { userId, isTame, yCoordHex, stepDistanceHex }) {
  const hashKey = `puzzleradar:dp:${challengeId}`;
  const cleanX = (xCoordHex || '').trim().toLowerCase().replace(/^0x/i, '');
  const cleanY = (yCoordHex || '').trim().toLowerCase().replace(/^0x/i, '');
  const cleanDist = (stepDistanceHex || '0').trim().toLowerCase().replace(/^0x/i, '');
  const isTameInt = isTame ? 1 : 0;
  const valString = `${userId}|${isTameInt}|${cleanY}|${cleanDist}`;

  let existingPoint = null;

  if (redisClient && redisClient.status === 'ready') {
    const prev = await redisClient.hget(hashKey, cleanX);
    if (prev) {
      const [pUser, pTame, pY, pDist] = prev.split('|');
      existingPoint = {
        userId: pUser,
        isTame: Number(pTame) === 1,
        yCoordHex: pY,
        stepDistanceHex: pDist
      };
    }
    await redisClient.hset(hashKey, cleanX, valString);
  } else {
    if (!memoryDpStore.has(hashKey)) {
      memoryDpStore.set(hashKey, new Map());
    }
    const map = memoryDpStore.get(hashKey);
    const prev = map.get(cleanX);
    if (prev) {
      const [pUser, pTame, pY, pDist] = prev.split('|');
      existingPoint = {
        userId: pUser,
        isTame: Number(pTame) === 1,
        yCoordHex: pY,
        stepDistanceHex: pDist
      };
    }
    map.set(cleanX, valString);
  }

  // Verifica colisão: mesmo ponto X registrado por rebanhos opostos (Tame vs Wild)
  let collisionDetected = false;
  let collisionData = null;

  if (existingPoint && existingPoint.isTame !== Boolean(isTame)) {
    collisionDetected = true;
    collisionData = {
      challengeId,
      xCoordHex: cleanX,
      tamePoint: isTame ? { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist } : existingPoint,
      wildPoint: !isTame ? { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist } : existingPoint
    };
  }

  return {
    stored: true,
    collisionDetected,
    collisionData,
    point: {
      challengeId,
      xCoordHex: cleanX,
      userId,
      isTame: Boolean(isTame),
      stepDistanceHex: cleanDist
    }
  };
}

/**
 * Publica mensagem de revogação imediata via Redis PubSub
 */
async function publishRevocation(challengeId, reason = 'TARGET_DRAINED_ON_CHAIN') {
  const channel = 'puzzleradar:channel:revocations';
  const payload = JSON.stringify({ challengeId, reason, timestamp: new Date().toISOString() });
  
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.publish(channel, payload);
  } else {
    console.log(`📡 [Redis In-Memory PubSub] Revogação emitida para ${challengeId}: ${reason}`);
  }
}

/**
 * Retorna contagem de DPs registrados para um desafio
 */
async function getDpStats(challengeId) {
  const hashKey = `puzzleradar:dp:${challengeId}`;
  if (redisClient && redisClient.status === 'ready') {
    const count = await redisClient.hlen(hashKey);
    return { challengeId, totalDps: count };
  } else {
    const map = memoryDpStore.get(hashKey);
    return { challengeId, totalDps: map ? map.size : 0 };
  }
}

module.exports = {
  redisClient,
  markChunkScanned,
  isChunkScanned,
  bulkImportHistory,
  getPruningStats,
  storeDistinguishedPoint,
  publishRevocation,
  getDpStats
};

