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
 * Retorna estatísticas do Space Pruning para um puzzle com limites matemáticos estritos
 */
async function getPruningStats(puzzleId, totalChunksInSpace = 100000) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  let rawScannedCount = 0;

  if (redisClient && redisClient.status === 'ready') {
    rawScannedCount = await redisClient.bitcount(key);
  } else {
    const set = memoryBitmapStore.get(key);
    rawScannedCount = set ? set.size : 0;
  }

  const total = Number(totalChunksInSpace) || 100000;
  // Limita estritamente ao total soberano do espaço de busca
  const validScanned = Math.min(total, rawScannedCount);
  const remaining = Math.max(0, total - validScanned);
  const prunedPercent = total > 0 ? (validScanned / total) * 100 : 0;

  return {
    puzzleId,
    totalChunks: total,
    scannedChunks: validScanned,
    rawBitcount: rawScannedCount,
    remainingChunks: remaining,
    prunedPercent: parseFloat(prunedPercent.toFixed(4)),
    status: prunedPercent >= 100 ? 'FULLY_SCANNED' : 'PRUNED_ACTIVE'
  };
}

/**
 * Sanitiza o bitmap de um desafio removendo registros de teste que excederam o espaço
 */
async function sanitizeBitmap(puzzleId, maxChunks = 100000) {
  const key = `puzzleradar:bitmap:${puzzleId}`;
  if (memoryBitmapStore.has(key)) {
    const set = memoryBitmapStore.get(key);
    for (const idx of Array.from(set)) {
      if (idx >= maxChunks) {
        set.delete(idx);
      }
    }
  }
}

const memoryDpStore = new Map(); // Fallback in-memory para Distinguished Points (dp:<puzzleId> -> Map(xHex -> payload))

/**
 * Script Lua Nativo para inserção atômica e detecção instantânea de colisão no Redis
 */
const PROCESS_DP_LUA = `
local hash_key = KEYS[1]
local point_key = ARGV[1]
local incoming_type = ARGV[2]
local incoming_dist = ARGV[3]
local incoming_worker = ARGV[4]
local incoming_y = ARGV[5]

local existing = redis.call("HGET", hash_key, point_key)

if existing then
    local p_user, p_tame, p_y, p_dist = string.match(existing, "([^|]+)|([^|]+)|([^|]*)|([^|]+)")
    local stored_is_tame = (p_tame == "1")
    local incoming_is_tame = (incoming_type == "1")

    if stored_is_tame ~= incoming_is_tame then
        return {
            "COLLISION_FOUND",
            p_user, tostring(p_tame), p_y or "", p_dist,
            incoming_worker, tostring(incoming_type), incoming_y or "", incoming_dist
        }
    else
        return {"DUPLICATE_SAME_HERD", redis.call("HLEN", hash_key)}
    end
else
    local val_str = incoming_worker .. "|" .. incoming_type .. "|" .. (incoming_y or "") .. "|" .. incoming_dist
    redis.call("HSET", hash_key, point_key, val_str)
    return {"STORED", tostring(redis.call("HLEN", hash_key))}
end
`;

/**
 * Armazena um Distinguished Point no Redis Hash O(1) indexando ponto completo ou coordenada X com paridade
 * Formato do valor: "<USER_ID>|<IS_TAME>|<Y_COORD_HEX>|<DISTANCE_HEX>"
 */
async function storeDistinguishedPoint(challengeId, pointHexOrX, { userId, isTame, yCoordHex, stepDistanceHex }) {
  const hashKey = `puzzleradar:dp:${challengeId}`;
  
  let cleanKey = (pointHexOrX || '').trim().toLowerCase().replace(/^0x/i, '');
  const cleanY = (yCoordHex || '').trim().toLowerCase().replace(/^0x/i, '');
  const cleanDist = (stepDistanceHex || '0').trim().toLowerCase().replace(/^0x/i, '');
  const isTameInt = isTame ? 1 : 0;
  
  // Se recebemos apenas a coordenada X de 64 chars e temos Y, prefixa com 02 (par) ou 03 (ímpar)
  if (cleanKey.length === 64 && cleanY.length > 0) {
    const lastByte = parseInt(cleanY.slice(-1), 16);
    const prefix = (lastByte % 2 === 0) ? '02' : '03';
    cleanKey = prefix + cleanKey;
  }

  const valString = `${userId || 'anon'}|${isTameInt}|${cleanY}|${cleanDist}`;
  let collisionDetected = false;
  let collisionData = null;

  if (redisClient && redisClient.status === 'ready') {
    try {
      const res = await redisClient.eval(
        PROCESS_DP_LUA,
        1,
        hashKey,
        cleanKey,
        String(isTameInt),
        cleanDist,
        String(userId || 'anon'),
        cleanY
      );

      if (Array.isArray(res) && res[0] === 'COLLISION_FOUND') {
        collisionDetected = true;
        const storedIsTame = res[2] === '1';
        collisionData = {
          challengeId,
          pointKey: cleanKey,
          tamePoint: storedIsTame
            ? { userId: res[1], yCoordHex: res[3], stepDistanceHex: res[4] }
            : { userId: res[5], yCoordHex: res[7], stepDistanceHex: res[8] },
          wildPoint: !storedIsTame
            ? { userId: res[1], yCoordHex: res[3], stepDistanceHex: res[4] }
            : { userId: res[5], yCoordHex: res[7], stepDistanceHex: res[8] }
        };
      }
    } catch (luaErr) {
      // Fallback para HGET/HSET tradicional se o Redis server não suportar eval
      const prev = await redisClient.hget(hashKey, cleanKey);
      if (prev) {
        const [pUser, pTame, pY, pDist] = prev.split('|');
        if (Number(pTame) !== isTameInt) {
          collisionDetected = true;
          collisionData = {
            challengeId,
            pointKey: cleanKey,
            tamePoint: Number(pTame) === 1
              ? { userId: pUser, yCoordHex: pY, stepDistanceHex: pDist }
              : { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist },
            wildPoint: Number(pTame) === 0
              ? { userId: pUser, yCoordHex: pY, stepDistanceHex: pDist }
              : { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist }
          };
        }
      } else {
        await redisClient.hset(hashKey, cleanKey, valString);
      }
    }
  } else {
    // In-memory atomic store fallback
    if (!memoryDpStore.has(hashKey)) {
      memoryDpStore.set(hashKey, new Map());
    }
    const map = memoryDpStore.get(hashKey);
    const prev = map.get(cleanKey);
    if (prev) {
      const [pUser, pTame, pY, pDist] = prev.split('|');
      if (Number(pTame) !== isTameInt) {
        collisionDetected = true;
        collisionData = {
          challengeId,
          pointKey: cleanKey,
          tamePoint: Number(pTame) === 1
            ? { userId: pUser, yCoordHex: pY, stepDistanceHex: pDist }
            : { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist },
          wildPoint: Number(pTame) === 0
            ? { userId: pUser, yCoordHex: pY, stepDistanceHex: pDist }
            : { userId, yCoordHex: cleanY, stepDistanceHex: cleanDist }
        };
      }
    } else {
      map.set(cleanKey, valString);
    }
  }

  return {
    stored: true,
    collisionDetected,
    collisionData,
    point: {
      challengeId,
      pointKey: cleanKey,
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
 * Retorna contagem de DPs registrados para um desafio e distribuição Tame vs Wild
 */
async function getDpStats(challengeId) {
  const hashKey = `puzzleradar:dp:${challengeId}`;
  let totalDps = 0;
  let tameDps = 0;
  let wildDps = 0;

  if (redisClient && redisClient.status === 'ready') {
    const all = await redisClient.hgetall(hashKey);
    totalDps = Object.keys(all).length;
    for (const val of Object.values(all)) {
      const parts = val.split('|');
      if (parts[1] === '1') tameDps++;
      else wildDps++;
    }
  } else {
    const map = memoryDpStore.get(hashKey);
    if (map) {
      totalDps = map.size;
      for (const val of map.values()) {
        const parts = val.split('|');
        if (parts[1] === '1') tameDps++;
        else wildDps++;
      }
    }
  }

  return { challengeId, totalDps, tameDps, wildDps };
}

module.exports = {
  redisClient,
  markChunkScanned,
  isChunkScanned,
  bulkImportHistory,
  getPruningStats,
  sanitizeBitmap,
  storeDistinguishedPoint,
  publishRevocation,
  getDpStats
};

