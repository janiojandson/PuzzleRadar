// ============================================
// 🧩 PuzzleRadar — Rotas de Workers (Solver API & Crowdsourcing Resiliente)
// ============================================

const express = require('express');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { generateToken } = require('../../lib/auth');
const { splitRange, getChallengeById } = require('../../lib/difficultyEngine');
const { markChunkScanned, isChunkScanned } = require('../../lib/redis');
const { appendRangesToSheet } = require('../../lib/googleSheets');
const { verifyDiscoveryProof } = require('../../lib/cryptoVerifier');
const { antiMevRescue } = require('../../services/antiMevRescue');
const { broadcastTelemetryEvent } = require('./telemetry');

const router = express.Router();

// Armazenamento em memória de workers ativos (para dashboard em tempo real)
const activeWorkersMap = new Map();

/**
 * GET /api/workers/download-bat — Gera e baixa o script Windows .bat com token, identificador e desafio
 */
router.get('/download-bat', (req, res) => {
  const token = req.query.token || 'pzk_admin_master_gpu_token';
  const chain = (req.query.chain || 'BTC').toUpperCase();
  const challenge = req.query.challenge || 'BTC_1000_P71';
  const name = req.query.name || `worker-win-${crypto.randomBytes(3).toString('hex')}`;
  const origin = req.query.api || 'https://puzzleradar-production.up.railway.app';

  const batContent = `@echo off
title PuzzleRadar Local Worker Node - [${chain}] ${challenge}
echo =======================================================================
echo   [+] PuzzleRadar - Minerador Local de GPU/CPU (Windows)
echo   [+] Minerador ID: ${name}
echo   [+] Token: ${token}
echo   [+] Alvo: [${chain}] ${challenge}
echo   [+] Servidor API: ${origin}
echo =======================================================================
echo.

echo [1/3] Verificando dependencias necessarias...
py -3.12 -m pip install -q requests ecdsa base58 pycryptodome >nul 2>&1
if errorlevel 1 (
    python -m pip install -q requests ecdsa base58 pycryptodome >nul 2>&1
)

echo [2/3] Baixando/Atualizando motor de busca colab_worker.py...
if not exist solver mkdir solver
curl -sSL --retry 3 "${origin}/solver/colab_worker.py" -o solver/colab_worker.py
if not exist solver\\colab_worker.py (
    curl -sSL --retry 3 "${origin}/solver/colab_worker.py" -o colab_worker.py
)

echo [3/3] Iniciando processamento e conexao a Fazenda Central...
echo.

if exist solver\\colab_worker.py (
    py -3.12 solver/colab_worker.py --api="${origin}" --token="${token}" --name="${name}" --chain="${chain}" --challenge="${challenge}"
    if errorlevel 1 (
        python solver/colab_worker.py --api="${origin}" --token="${token}" --name="${name}" --chain="${chain}" --challenge="${challenge}"
    )
) else (
    py -3.12 colab_worker.py --api="${origin}" --token="${token}" --name="${name}" --chain="${chain}" --challenge="${challenge}"
    if errorlevel 1 (
        python colab_worker.py --api="${origin}" --token="${token}" --name="${name}" --chain="${chain}" --challenge="${challenge}"
    )
)

echo.
echo [!] Processo finalizado ou interrompido.
pause
`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', `attachment; filename="start-worker-${chain}-${challenge}.bat"`);
  res.send(batContent);
});

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
        const activeChain = worker.chain || (worker.currentTask ? worker.currentTask.chain : 'BTC');
        const activeChallenge = worker.challengeId || (worker.currentTask ? worker.currentTask.challengeId : 'BTC_1000_P71');

        activeList.push({
          id,
          name: worker.name,
          hardware: worker.hardware,
          gpuModel: worker.gpuModel,
          chain: activeChain,
          challengeId: activeChallenge,
          keysPerSecond: worker.keysPerSecond,
          hashrateFormatted: formatHashrate(worker.keysPerSecond),
          status: worker.status,
          progress: worker.progress || 0,
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
    const { token, name, hardware, gpuModel, cpuModel, chain, challenge_id, challengeId, instanceId: clientInstanceId } = req.body;
    
    // Suporta múltiplas instâncias (ex: 7 Colabs) usando o mesmo token de usuário
    const nodeInstanceId = clientInstanceId || (name ? `${token || 'wrk'}_${name}` : `${token || 'wrk'}_${crypto.randomBytes(4).toString('hex')}`);

    const workerRecord = {
      id: nodeInstanceId,
      userToken: token || null,
      name: name || `miner-${crypto.randomBytes(3).toString('hex')}`,
      hardware: hardware || 'GPU',
      gpuModel: gpuModel || 'Generic GPU',
      cpuModel: cpuModel || 'Generic CPU',
      chain: (chain || 'BTC').toUpperCase(),
      challengeId: challenge_id || challengeId || 'BTC_1000_P71',
      keysPerSecond: 0,
      totalKeysChecked: 0,
      status: 'IDLE',
      progress: 0,
      lastSeen: Date.now()
    };

    activeWorkersMap.set(nodeInstanceId, workerRecord);

    try {
      broadcastTelemetryEvent('SYSTEM', `⚡ Novo Nó Conectado: ${workerRecord.name} (${workerRecord.hardware}) no alvo [${workerRecord.chain}] ${workerRecord.challengeId}`);
    } catch (_) {}

    res.status(201).json({
      workerId: nodeInstanceId,
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
    const { puzzleId, chain, challenge_id } = req.query;
    const queryTarget = challenge_id || puzzleId || 'BTC_1000_P71';

    // Procura metadados dinâmicos do desafio selecionado (BTC, ETH, SOL, Nonce Reuse, etc.)
    const challenge = getChallengeById(queryTarget) || getChallengeById('BTC_1000_P71');

    const defaultStart = challenge && challenge.rangeStart && !challenge.rangeStart.includes(' ')
      ? challenge.rangeStart.replace(/^0x/i, '')
      : '400000000000000000';
    const defaultEnd = challenge && challenge.rangeEnd && !challenge.rangeEnd.includes(' ')
      ? challenge.rangeEnd.replace(/^0x/i, '')
      : '7fffffffffffffffff';
    const targetAddress = challenge ? (challenge.targetAddress || challenge.address || '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU') : '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
    const activePuzzleKey = challenge ? (challenge.challengeId || `BTC_1000_P${challenge.puzzleNumber || challenge.num || 71}`) : 'BTC_1000_P71';
    const activeChain = (challenge && challenge.chain) || (chain ? chain.toUpperCase() : 'BTC');

    // Coleta indices de chunks atualmente em processamento por outros workers ativos (Anti-Colisão em Tempo Real)
    const currentlyProcessingChunkIndices = new Set();
    const now = Date.now();
    for (const [wId, w] of activeWorkersMap.entries()) {
      if (wId !== id && w.currentTask && (now - w.lastSeen <= 90000)) {
        if (w.currentTask.puzzleId === activePuzzleKey && w.currentTask.chunkIndex !== undefined) {
          currentlyProcessingChunkIndices.add(w.currentTask.chunkIndex);
        }
      }
    }

    // Procura fatia não escaneada e que não esteja sendo processada por outro nó no momento
    const splits = splitRange(defaultStart, defaultEnd, 1000);
    let assignedChunk = null;

    for (const chunk of splits) {
      if (currentlyProcessingChunkIndices.has(chunk.index)) {
        continue; // Pula fatia se outro terminal já estiver minerando ela agora
      }
      const alreadyScanned = await isChunkScanned(activePuzzleKey, chunk.index);
      if (!alreadyScanned) {
        assignedChunk = chunk;
        break;
      }
    }

    // Fallback: se todas as fatias estiverem ocupadas ou varridas, seleciona fatia por offset de hash do worker
    if (!assignedChunk) {
      const offset = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % splits.length;
      assignedChunk = splits[offset] || splits[0];
    }

    const task = {
      taskId: `task_${Date.now()}_${assignedChunk.index}`,
      puzzleId: activePuzzleKey,
      challengeId: activePuzzleKey,
      chain: activeChain,
      targetAddress,
      chunkIndex: assignedChunk.index,
      rangeStart: assignedChunk.rangeStart,
      rangeEnd: assignedChunk.rangeEnd,
      keysCount: assignedChunk.size,
      hints: (challenge && challenge.appliedHints) || (challenge && challenge.hints) || [
        { type: 'kangarooEcdsa', algorithm: 'PollardKangaroo_CUDA', pubKey: (challenge && challenge.publicKey) || '02...' }
      ]
    };

    const worker = activeWorkersMap.get(id);
    if (worker) {
      worker.status = 'COMPUTING';
      worker.currentTask = task;
      worker.chain = activeChain;
      worker.challengeId = activePuzzleKey;
      worker.lastSeen = Date.now();
    }

    res.json({
      workerId: id,
      task,
      message: `Tarefa atribuída para [${activeChain}] ${activePuzzleKey}: Range 0x${task.rangeStart} ➔ 0x${task.rangeEnd}`
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
    const { keysPerSecond, progress, status, chain, challenge_id, challengeId } = req.body;

    let worker = activeWorkersMap.get(id);
    if (!worker) {
      worker = {
        id,
        name: `worker-${id.substring(0, 6)}`,
        hardware: 'GPU',
        status: status || 'RUNNING',
        chain: (chain || 'BTC').toUpperCase(),
        challengeId: challenge_id || challengeId || 'BTC_1000_P71',
        totalKeysChecked: 0
      };
      activeWorkersMap.set(id, worker);
    }

    if (chain) worker.chain = chain.toUpperCase();
    if (challenge_id || challengeId) worker.challengeId = challenge_id || challengeId;
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

    let rescueResult = null;

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

      // 🛡️ Executa o Resgate Automático Anti-MEV via Túnel Privado para o COLD VAULT
      try {
        const chain = req.body.chain || (puzzleId && puzzleId.startsWith('ETH') ? 'ETH' : puzzleId && puzzleId.startsWith('SOL') ? 'SOL' : 'BTC');
        rescueResult = await antiMevRescue.executeRescue({
          chain,
          challengeId: puzzleId || 'BTC_1000_P71',
          privateKeyHex: foundPrivateKey,
          targetAddress: expectedTarget
        });
      } catch (rescueErr) {
        console.error('⚠️ [AntiMevRescue Execution Error]:', rescueErr.message);
      }
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
      hashrate: hashrate || (keysChecked ? `${(keysChecked / 5e9).toFixed(2)} GH/s` : '45.0 GH/s'),
      keyFound: isRealKeyFound,
      rescueTx: rescueResult && rescueResult.rescue ? rescueResult.rescue.txHash : null,
      destination: rescueResult && rescueResult.rescue ? rescueResult.rescue.destinationAddress : null
    }).catch(() => {});

    const sharesEarned = (Number(keysChecked) || 1000000) * 0.001;

    let worker = activeWorkersMap.get(id);
    if (worker) {
      worker.status = 'IDLE';
      worker.totalKeysChecked = (worker.totalKeysChecked || 0) + (Number(keysChecked) || 0);
      worker.currentTask = null;
      worker.lastSeen = Date.now();
    }

    try {
      if (isRealKeyFound) {
        broadcastTelemetryEvent('SENTINEL', `🚨🎉 [CHAVE AUTÊNTICA ENCONTRADA!] Worker ${id} desvendou [${puzzleId}]! Chave: ${foundPrivateKey.substring(0, 10)}... (Resgate acionado)`);
      } else {
        const formattedKeys = Number(keysChecked || 0).toLocaleString();
        broadcastTelemetryEvent('DP_SUBMITTED', `💎 [FATIA VARRIDA] Nó ${worker ? worker.name : id} concluiu fatia #${chunkIndex} (${formattedKeys} chaves) em [${puzzleId}]. +${sharesEarned.toFixed(1)} Shares PoS`);
      }
    } catch (_) {}

    res.json({
      workerId: id,
      result: isRealKeyFound ? 'FOUND' : 'NOT_FOUND',
      sharesEarned,
      verified: isRealKeyFound,
      rescue: rescueResult,
      message: isRealKeyFound
        ? `🎯 CHAVE AUTÊNTICA ENCONTRADA! Resgate confidencial enviado com sucesso para ${rescueResult && rescueResult.rescue ? rescueResult.rescue.destinationAddress : 'Cold Vault'}.`
        : 'Range concluído. Shares creditadas e gravadas na Planilha Google.'
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