// ============================================
// 🧩 PuzzleRadar — Rotas de Workers (Solver API & Crowdsourcing Resiliente)
// ============================================

const express = require('express');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { generateToken } = require('../../lib/auth');
const { splitRange } = require('../../lib/difficultyEngine');
const { markChunkScanned, isChunkScanned } = require('../../lib/redis');
const { appendRangesToSheet } = require('../../lib/googleSheets');
const { verifyDiscoveryProof } = require('../../lib/cryptoVerifier');

const router = express.Router();

// Armazenamento em memória de workers ativos (para dashboard em tempo real)
const activeWorkersMap = new Map();

/**
 * POST /api/workers/token
 */
router.post('/token', async (req, res) => {
  try {
    const { name, hardware, gpuModel, cpuModel, userId } = req.body;
    
    const randomHex = crypto.randomBytes(16).toString('hex');
    const token = `wrk_${randomHex}`;
    const workerName = name || `worker-${randomHex.substring(0, 6)}`;

    try {
      await prisma.workerToken.create({
        data: {
          token,
          name: workerName,
          hardware: hardware || 'GPU',
          gpuModel: gpuModel || null,
          cpuModel: cpuModel || null,
          userId: userId || null
        }
      });
    } catch (dbErr) {}

    res.status(201).json({
      success: true,
      token,
      name: workerName,
      cliCommand: `python solver/colab_worker.py --token=${token} --api=http://localhost:3010`,
      message: 'Worker Token gerado com sucesso. Execute o script CLI/Python fornecido para iniciar.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workers/active
 */
router.get('/active', async (req, res) => {
  try {
    const now = Date.now();
    const activeList = [];

    for (const [id, worker] of activeWorkersMap.entries()) {
      if (now - worker.lastSeen <= 120000) {
        activeList.push({
          id,
          name: worker.name,
          hardware: worker.hardware,
          gpuModel: worker.gpuModel,
          keysPerSecond: worker.keysPerSecond,
          hashrateFormatted: formatHashrate(worker.keysPerSecond),
          status: worker.status,
          totalKeysChecked: worker.totalKeysChecked || 0,
          currentTask: worker.currentTask || null,
          lastSeenAgoSeconds: Math.floor((now - worker.lastSeen) / 1000)
        });
      } else {
        activeWorkersMap.delete(id);
      }
    }

    res.json({
      activeCount: activeList.length,
      workers: activeList,
      totalHashrate: activeList.reduce((sum, w) => sum + (w.keysPerSecond || 0), 0),
      totalHashrateFormatted: formatHashrate(activeList.reduce((sum, w) => sum + (w.keysPerSecond || 0), 0))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workers/register
 */
router.post('/register', async (req, res) => {
  try {
    const { token, name, hardware, gpuModel, cpuModel } = req.body;
    const workerId = token || `wrk_${crypto.randomBytes(8).toString('hex')}`;

    const workerRecord = {
      id: workerId,
      name: name || `miner-${workerId.substring(0, 8)}`,
      hardware: hardware || 'GPU',
      gpuModel: gpuModel || 'Generic GPU',
      cpuModel: cpuModel || 'Generic CPU',
      keysPerSecond: 0,
      totalKeysChecked: 0,
      status: 'IDLE',
      lastSeen: Date.now()
    };

    activeWorkersMap.set(workerId, workerRecord);

    res.status(201).json({
      workerId,
      name: workerRecord.name,
      hardware: workerRecord.hardware,
      status: 'IDLE',
      message: 'Worker registrado no pool. Solicite uma tarefa usando GET /api/workers/:id/task'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workers/:id/task
 */
router.get('/:id/task', async (req, res) => {
  try {
    const { id } = req.params;
    const { puzzleId = 'puzzle_btc_71' } = req.query;

    // Range do Puzzle #71: 0x400000000000000000 a 0x7fffffffffffffffff (71 bits)
    const defaultStart = '400000000000000000';
    const defaultEnd = '7fffffffffffffffff';
    const targetAddress = '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
    
    // Procura fatia não escaneada
    const splits = splitRange(defaultStart, defaultEnd, 1000);
    let assignedChunk = null;

    for (const chunk of splits) {
      const alreadyScanned = await isChunkScanned(puzzleId, chunk.index);
      if (!alreadyScanned) {
        assignedChunk = chunk;
        break;
      }
    }

    if (!assignedChunk) {
      assignedChunk = splits[0];
    }

    const task = {
      taskId: `task_${Date.now()}_${assignedChunk.index}`,
      puzzleId,
      targetAddress,
      chunkIndex: assignedChunk.index,
      rangeStart: assignedChunk.rangeStart,
      rangeEnd: assignedChunk.rangeEnd,
      keysCount: assignedChunk.size,
      hints: [
        { type: 'kangarooEcdsa', algorithm: 'PollardKangaroo_CUDA', pubKey: '02...' }
      ]
    };

    const worker = activeWorkersMap.get(id);
    if (worker) {
      worker.status = 'COMPUTING';
      worker.currentTask = task;
      worker.lastSeen = Date.now();
    }

    res.json({
      workerId: id,
      task,
      message: `Tarefa atribuída para Puzzle #71: Range 0x${task.rangeStart} ➔ 0x${task.rangeEnd}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workers/:id/heartbeat
 */
router.post('/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const { keysPerSecond, progress, status } = req.body;

    let worker = activeWorkersMap.get(id);
    if (!worker) {
      worker = {
        id,
        name: `worker-${id.substring(0, 6)}`,
        hardware: 'GPU',
        status: status || 'RUNNING',
        totalKeysChecked: 0
      };
      activeWorkersMap.set(id, worker);
    }

    worker.keysPerSecond = Number(keysPerSecond) || worker.keysPerSecond || 0;
    worker.status = status || 'RUNNING';
    worker.progress = progress || 0;
    worker.lastSeen = Date.now();

    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workers/:id/result
 */
router.post('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    const { taskId, puzzleId, chunkIndex, result, keysChecked, foundPrivateKey, computeHours, targetAddress, hashrate, rangeStart, rangeEnd } = req.body;

    let isRealKeyFound = false;

    // Validação criptográfica rigorosa
    if (result === 'FOUND' && foundPrivateKey) {
      const expectedTarget = targetAddress || '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
      const proof = verifyDiscoveryProof(foundPrivateKey, expectedTarget);

      if (!proof.isValid) {
        console.warn(`🚨 [Alerta Anti-Fraude] Chave falsa reportada pelo worker ${id}!`);
        return res.status(400).json({
          error: 'Chave privada submetida não confere com a chave pública/endereço do puzzle!',
          details: proof
        });
      }

      isRealKeyFound = true;
      console.log(`\n🎉🎉🎉 [PuzzleRadar] CHAVE AUTÊNTICA ENCONTRADA PELO WORKER ${id}! Chave: ${foundPrivateKey} 🎉🎉🎉\n`);
    }

    // Marca fatia como escaneada no Redis Bitmap
    if (puzzleId && chunkIndex !== undefined) {
      await markChunkScanned(puzzleId, chunkIndex);
    }

    // Grava no Google Sheets & Webhook em tempo real
    appendRangesToSheet(undefined, [{
      puzzleId: puzzleId || 'puzzle_btc_71',
      chunkIndex: chunkIndex || 0,
      rangeStart: rangeStart || '',
      rangeEnd: rangeEnd || ''
    }], `Colab Node (${id})`, {
      status: isRealKeyFound ? 'KEY_FOUND_CONFIRMED' : 'COMPLETED',
      hashrate: hashrate || formatHashrate(keysChecked ? keysChecked / 5 : 45000000000),
      keyFound: isRealKeyFound
    }).catch(() => {});

    const sharesEarned = (Number(keysChecked) || 1000000) * 0.001;

    let worker = activeWorkersMap.get(id);
    if (worker) {
      worker.status = 'IDLE';
      worker.totalKeysChecked = (worker.totalKeysChecked || 0) + (Number(keysChecked) || 0);
      worker.currentTask = null;
      worker.lastSeen = Date.now();
    }

    res.json({
      workerId: id,
      result: isRealKeyFound ? 'FOUND' : 'NOT_FOUND',
      sharesEarned,
      verified: isRealKeyFound,
      message: isRealKeyFound ? '🎯 CHAVE CRIPTOGRAFICAMENTE VÁLIDA ENCONTRADA! Parabéns!' : 'Range concluído. Shares creditadas e gravadas na Planilha.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatHashrate(kps = 0) {
  const n = Number(kps) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}

module.exports = router;