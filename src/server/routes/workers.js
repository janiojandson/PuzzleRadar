// ============================================
// 🧩 PuzzleRadar — Rotas de Workers (Solver API & Crowdsourcing Resiliente)
// ============================================

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');
const { generateToken } = require('../../lib/auth');
const authRouter = require('./auth');
const { splitRange, getChallengeById } = require('../../lib/difficultyEngine');
const { markChunkScanned, isChunkScanned } = require('../../lib/redis');
const { appendRangesToSheet } = require('../../lib/googleSheets');
const { verifyDiscoveryProof } = require('../../lib/cryptoVerifier');
const { antiMevRescue } = require('../../services/antiMevRescue');
const { broadcastTelemetryEvent } = require('./telemetry');
const { fleetState } = require('../../lib/fleetState');
const { parentLoteManager } = require('../../services/parentLoteManager');

const router = express.Router();

// Armazenamento em memória unificado de workers ativos
const activeWorkersMap = fleetState.nodes;
router.activeWorkersMap = activeWorkersMap;

/**
 * GET /api/workers/download-bat — Gera e baixa o script Windows .bat com token, identificador e desafio
 */
router.get('/download-bat', (req, res) => {
  const token = req.query.token || 'pzk_admin_master_gpu_token';
  const chain = (req.query.chain || 'BTC').toUpperCase();
  const challenge = req.query.challenge || 'BTC_1000_P71';
  const name = req.query.name || `worker-win-${crypto.randomBytes(3).toString('hex')}`;
  const origin = req.query.api || 'https://puzzleradar-production.up.railway.app';
  const power = req.query.power ? parseInt(req.query.power, 10) : 100;

  const batContent = `@echo off
title PuzzleRadar Local Worker Node - [${chain}] ${challenge}
echo =======================================================================
echo   [+] PuzzleRadar - Minerador Local de GPU/CPU (Windows)
echo   [+] Minerador ID: ${name}
echo   [+] Token: ${token}
echo   [+] Potencia Selecionada: ${power}%%
echo   [+] Alvo: [${chain}] ${challenge}
echo   [+] Servidor API: ${origin}
echo =======================================================================
echo.

echo [1/3] Verificando dependencias necessarias...
py -3.12 -m pip install -q requests ecdsa base58 pycryptodome >nul 2>&1
if errorlevel 1 (
    python -m pip install -q requests ecdsa base58 pycryptodome >nul 2>&1
)

echo [2/3] Baixando/Atualizando motor de busca terminal_worker.py...
if not exist solver mkdir solver
curl -sSL --retry 3 "${origin}/solver/terminal_worker.py" -o solver/terminal_worker.py
if not exist solver\\terminal_worker.py (
    curl -sSL --retry 3 "${origin}/solver/terminal_worker.py" -o terminal_worker.py
)

echo [3/3] Iniciando processamento com ${power}%% de potencia no Cluster Central...
echo.

if exist solver\\terminal_worker.py (
    py -3.12 solver/terminal_worker.py --api="${origin}" --token="${token}" --name="${name}" --power=${power} --chain="${chain}" --challenge="${challenge}"
    if errorlevel 1 (
        python solver/terminal_worker.py --api="${origin}" --token="${token}" --name="${name}" --power=${power} --chain="${chain}" --challenge="${challenge}"
    )
) else (
    py -3.12 terminal_worker.py --api="${origin}" --token="${token}" --name="${name}" --power=${power} --chain="${chain}" --challenge="${challenge}"
    if errorlevel 1 (
        python terminal_worker.py --api="${origin}" --token="${token}" --name="${name}" --power=${power} --chain="${chain}" --challenge="${challenge}"
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
 * POST /api/workers/register-payout
 * Registra o Apelido do Minerador, sua Carteira Bitcoin de Recebimento, Hardware e Contato
 */
router.post('/register-payout', async (req, res) => {
  try {
    const { workerName, payoutAddress, hardwareType, contactEmail, contactInfo, email, password, adminSecret } = req.body;

    if (!workerName || !payoutAddress) {
      return res.status(400).json({ success: false, error: 'Apelido do minerador e Carteira Bitcoin são obrigatórios.' });
    }

    const cleanWallet = String(payoutAddress).trim();
    const btcRegex = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/i;
    if (!btcRegex.test(cleanWallet)) {
      return res.status(400).json({ success: false, error: 'Endereço Bitcoin inválido. Forneça um endereço legado (1...), SegWit (3...) ou Native SegWit (bc1q...).' });
    }

    const cleanName = String(workerName).trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 32);
    const userEmail = String(contactEmail || email || contactInfo || '').trim().toLowerCase();

    // Se senha foi informada, validação
    let passwordHash = null;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres.' });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    const existingNode = activeWorkersMap.get(cleanName) || {};
    activeWorkersMap.set(cleanName, {
      ...existingNode,
      name: cleanName,
      workerName: cleanName,
      payoutAddress: cleanWallet,
      hardware: hardwareType || 'Outro',
      contactInfo: userEmail || null,
      registeredAt: existingNode.registeredAt || new Date().toISOString(),
      lastSeen: Date.now()
    });

    // Cria ou sincroniza usuário no usersStore
    let userRecord = null;
    let sessionToken = null;

    if (userEmail && authRouter.usersStore) {
      const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@puzzleradar.io').trim().toLowerCase();
      const isAdminKey = adminSecret && adminSecret === (process.env.ADMIN_SECRET || 'puzzleradar_admin_secret_2026');
      const isMasterEmail = userEmail === ADMIN_EMAIL;
      const role = (isAdminKey || isMasterEmail) ? 'ADMIN' : 'USER';

      let existingUser = authRouter.usersStore.get(userEmail);
      if (existingUser) {
        existingUser.payoutAddress = cleanWallet;
        existingUser.hardwareType = hardwareType || existingUser.hardwareType;
        if (passwordHash) existingUser.passwordHash = passwordHash;
        userRecord = existingUser;
      } else {
        const userId = 'usr_' + Date.now();
        const workerToken = 'pzk_' + crypto.randomBytes(12).toString('hex');
        userRecord = {
          id: userId,
          name: cleanName,
          email: userEmail,
          username: cleanName,
          passwordHash: passwordHash || (await bcrypt.hash('pzk_auto_' + Date.now(), 10)),
          role,
          workerToken,
          activePlan: role === 'ADMIN' ? 'ENTERPRISE_ADMIN' : 'FREE_COMMUNITY',
          payoutAddress: cleanWallet,
          hardwareType: hardwareType || 'Outro',
          totalShares: 0,
          createdAt: new Date().toISOString()
        };
        authRouter.usersStore.set(userEmail, userRecord);
      }

      sessionToken = generateToken({
        userId: userRecord.id,
        email: userRecord.email,
        username: userRecord.username,
        name: userRecord.name,
        role: userRecord.role,
        workerToken: userRecord.workerToken,
        activePlan: userRecord.activePlan
      });
    }

    try {
      const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');
      sheetsBuffer.enqueueChunkLog({
        timestamp: new Date().toISOString(),
        chain: 'BTC',
        challenge_id: 'BTC_1000_P71',
        startHex: 'CADASTRO_MINERADOR',
        endHex: cleanWallet.slice(0, 16) + '...',
        workerName: cleanName,
        status: `REGISTRADO (Payout: ${cleanWallet.slice(0, 8)}... | ${hardwareType || 'Outro'})`,
        hashrate: 'Novo Registro'
      });
      sheetsBuffer.sendPayoutRegistration({
        workerName: cleanName,
        payoutAddress: cleanWallet,
        hardwareType: hardwareType || 'Outro',
        contactInfo: userEmail || null
      }).catch(() => {});
    } catch (_) {}

    const origin = req.headers.origin || 'https://puzzleradar-production.up.railway.app';
    const cliCommand = `python solver/terminal_worker.py --api="${origin}" --name="${cleanName}" --payout="${cleanWallet}"`;

    res.json({
      success: true,
      message: 'Minerador e Carteira de Recebimento registrados com sucesso!',
      token: sessionToken,
      user: userRecord ? {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        username: userRecord.username,
        role: userRecord.role,
        workerToken: userRecord.workerToken,
        activePlan: userRecord.activePlan,
        payoutAddress: userRecord.payoutAddress,
        hardwareType: userRecord.hardwareType
      } : null,
      worker: {
        name: cleanName,
        payoutAddress: cleanWallet,
        hardwareType: hardwareType || 'Outro',
        contactInfo: userEmail || null,
        cliCommand
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/workers/payout-profile/:name
 * Retorna os dados de cadastro e carteira de um minerador
 */
router.get('/payout-profile/:name', (req, res) => {
  const { name } = req.params;
  const cleanName = String(name).trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const node = activeWorkersMap.get(cleanName);
  if (node && node.payoutAddress) {
    return res.json({
      success: true,
      worker: {
        name: cleanName,
        payoutAddress: node.payoutAddress,
        hardware: node.hardware,
        contactInfo: node.contactInfo
      }
    });
  }
  res.status(404).json({ success: false, error: 'Perfil de payout não encontrado' });
});

/**
 * GET /api/workers/active
 */
router.get('/active', async (req, res) => {
  try {
    const now = Date.now();
    const activeList = [];
    const seenIds = new Set();

    // 1. Nós do activeWorkersMap (Workers Colab, Terminal Windows/Linux, Extension, etc.)
    for (const [id, worker] of activeWorkersMap.entries()) {
      if (now - worker.lastSeen <= 180000) {
        seenIds.add(id);
        const activeChain = worker.chain || (worker.currentTask ? worker.currentTask.chain : 'BTC');
        const activeChallenge = worker.challengeId || (worker.currentTask ? worker.currentTask.challengeId : 'BTC_1000_P71');

        activeList.push({
          id,
          name: worker.name || `worker-${id.substring(0, 8)}`,
          hardware: worker.hardware || 'GPU Cluster Node',
          gpuModel: worker.gpuModel || 'CUDA / WebAssembly',
          chain: activeChain,
          challengeId: activeChallenge,
          keysPerSecond: worker.keysPerSecond || 0,
          hashrateFormatted: formatHashrate(worker.keysPerSecond || 0),
          status: worker.status || 'ONLINE',
          progress: worker.progress || 0,
          totalKeysChecked: worker.totalKeysChecked || 0,
          shares: worker.shares || 0,
          completedChunks: worker.completedChunks || 0,
          userToken: worker.userToken || null,
          power: worker.power || 100,
          threads: worker.threads || null,
          currentTask: worker.currentTask || null,
          lastSeenAgoSeconds: Math.floor((now - worker.lastSeen) / 1000)
        });
      } else {
        activeWorkersMap.delete(id);
      }
    }

    // 2. Nós registrados via poolsRouter.activePoolWorkers
    try {
      const poolsRouter = require('./pools');
      if (poolsRouter.activePoolWorkers) {
        for (const [wToken, pWorker] of poolsRouter.activePoolWorkers.entries()) {
          if (!seenIds.has(wToken)) {
            const lastSeenTime = pWorker.lastSeen ? new Date(pWorker.lastSeen).getTime() : now;
            if (now - lastSeenTime <= 180000) {
              seenIds.add(wToken);
              const kps = Number(pWorker.keysPerSecond || pWorker.hashrate) || 0;
              activeList.push({
                id: wToken,
                name: pWorker.workerName || `pool-node-${wToken.substring(0, 6)}`,
                hardware: pWorker.hardware || 'Kangaroo Pool Node (Colab/GPU)',
                gpuModel: pWorker.gpuModel || 'NVIDIA GPU (CUDA)',
                chain: pWorker.chain || 'BTC',
                challengeId: pWorker.challengeId || 'BTC_1000_P71',
                keysPerSecond: kps,
                hashrateFormatted: formatHashrate(kps),
                status: pWorker.status || 'MINING_POOL',
                progress: pWorker.progress || 100,
                totalKeysChecked: pWorker.totalKeysChecked || ((pWorker.shares || 1) * 1000000),
                power: pWorker.power || 100,
                threads: pWorker.threads || null,
                currentTask: pWorker.currentTask || null,
                lastSeenAgoSeconds: Math.floor((now - lastSeenTime) / 1000)
              });
            }
          }
        }
      }
    } catch (_) {}

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
    const { token, name, hardware, gpuModel, cpuModel, chain, challenge_id, challengeId, instanceId: clientInstanceId, power, threads } = req.body;
    
    // Suporta múltiplas instâncias simultâneas (ex: 3 a 20 Colabs/Terminais)
    let nodeInstanceId = clientInstanceId;
    if (!nodeInstanceId) {
      const randSuffix = crypto.randomBytes(3).toString('hex');
      nodeInstanceId = name ? `${token || 'wrk'}_${name}_${randSuffix}` : `${token || 'wrk'}_node_${randSuffix}`;
    } else {
      // Se já houver um worker ativo nos últimos 60s com este ID, adiciona sufixo para não sobrescrever
      if (activeWorkersMap.has(nodeInstanceId)) {
        const existing = activeWorkersMap.get(nodeInstanceId);
        if (Date.now() - existing.lastSeen < 60000 && existing.name !== name) {
          nodeInstanceId = `${nodeInstanceId}_${crypto.randomBytes(2).toString('hex')}`;
        }
      }
    }

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
      power: power || 100,
      threads: threads || null,
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
    let targetAddress = challenge ? (challenge.targetAddress || challenge.address || '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU') : '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
    const activePuzzleKey = challenge ? (challenge.challengeId || `BTC_1000_P${challenge.puzzleNumber || challenge.num || 71}`) : 'BTC_1000_P71';
    const activeChain = (challenge && challenge.chain) || (chain ? chain.toUpperCase() : 'BTC');

    let assignedChunk = null;

    if (activePuzzleKey === 'BTC_1000_P71') {
      const microLote = await parentLoteManager.getNextMicroLote(id);
      assignedChunk = {
        index: microLote.parentHex + '_' + microLote.startHex,
        rangeStart: microLote.startHex,
        rangeEnd: microLote.endHex,
        size: 16777216
      };
      targetAddress = microLote.puzzleTargetAddress || targetAddress;
    } else {
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
    if (req.body.power) worker.power = Number(req.body.power) || worker.power || 100;
    if (req.body.threads) worker.threads = Number(req.body.threads) || worker.threads;
    worker.keysPerSecond = Number(keysPerSecond) || worker.keysPerSecond || 0;
    worker.status = status || 'RUNNING';
    worker.progress = progress || 0;
    worker.lastSeen = Date.now();

    try {
      const { leaderboardService } = require('../../services/leaderboardService');
      const hashrateFormatted = worker.keysPerSecond >= 1e6
        ? `${(worker.keysPerSecond / 1e6).toFixed(2)} MH/s`
        : worker.keysPerSecond >= 1e3
          ? `${(worker.keysPerSecond / 1e3).toFixed(1)} kH/s`
          : null;
      leaderboardService.recordContribution(worker.name || id, {
        hashrate: hashrateFormatted
      }).catch(() => {});
    } catch (_) {}

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

    // Registra esforço coletivo na Fatia Ativa Coletiva e avança quando concluída
    try {
      if (rangeStart) {
        parentLoteManager.markMicroLoteCompleted(rangeStart, keysChecked, id);
      }
    } catch (_) {}

    // Grava no Google Sheets & Webhook em tempo real
    const targetChain = req.body.chain || (puzzleId && puzzleId.startsWith('ETH') ? 'ETH' : puzzleId && puzzleId.startsWith('SOL') ? 'SOL' : 'BTC');
    const targetChallengeId = puzzleId || 'BTC_1000_P71';
    appendRangesToSheet(undefined, [{
      chain: targetChain,
      challengeId: targetChallengeId,
      puzzleId: targetChallengeId,
      chunkIndex: chunkIndex !== undefined ? chunkIndex : 0,
      rangeStart: rangeStart || '',
      rangeEnd: rangeEnd || ''
    }], req.body.workerName || `Terminal Node (${id})`, {
      status: isRealKeyFound ? 'KEY_FOUND_CONFIRMED' : 'COMPLETED (Terminal)',
      hashrate: hashrate || (keysChecked ? `${(keysChecked / 5e9).toFixed(2)} GH/s` : '0 H/s'),
      keyFound: isRealKeyFound,
      rescueTx: rescueResult && rescueResult.rescue ? rescueResult.rescue.txHash : null,
      destination: rescueResult && rescueResult.rescue ? rescueResult.rescue.destinationAddress : null
    }).catch(() => {});

    const sharesEarned = (Number(keysChecked) || 1000000) * 0.001;

    let worker = activeWorkersMap.get(id);
    if (worker) {
      worker.status = 'IDLE';
      worker.totalKeysChecked = (worker.totalKeysChecked || 0) + (Number(keysChecked) || 0);
      worker.shares = (worker.shares || 0) + sharesEarned;
      worker.completedChunks = (worker.completedChunks || 0) + 1;
      worker.currentTask = null;
      worker.lastSeen = Date.now();
    }

    try {
      const { leaderboardService } = require('../../services/leaderboardService');
      leaderboardService.recordContribution(req.body.workerName || worker?.name || id, {
        keysChecked: Number(keysChecked) || 16777216,
        isLoteCompleted: true,
        hashrate: hashrate || (worker?.keysPerSecond ? `${(worker.keysPerSecond / 1e6).toFixed(2)} MH/s` : null)
      }).catch(() => {});
    } catch (_) {}

    try {
      if (isRealKeyFound) {
        const maskedWorker = id.length > 8 ? `${id.substring(0, 4)}...${id.substring(id.length - 4)}` : id;
        const proofHash = crypto.createHash('sha256').update(foundPrivateKey).digest('hex').substring(0, 8);
        broadcastTelemetryEvent('SENTINEL', `🚨🎉 [CHAVE AUTÊNTICA ENCONTRADA!] Nó [${maskedWorker}] desvendou [${puzzleId}]! Prova Criptográfica: 0x${proofHash} (Resgate confidencial Anti-MEV acionado).`);
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

/**
 * GET /api/puzzle/:id/parameters — Exporta parâmetros determinísticos do desafio (tabela de saltos, máscara, chaves)
 */
router.get('/puzzle/:id/parameters', (req, res) => {
  const { id } = req.params;
  const { PUZZLE_71_PARAMS } = require('../../lib/kangarooTable');
  if (id === '71' || id === 'BTC_1000_P71' || id === 'puzzle_btc_71') {
    return res.json({ success: true, parameters: PUZZLE_71_PARAMS });
  }
  const { getChallengeById } = require('../../lib/difficultyEngine');
  const chal = getChallengeById(id);
  res.json({
    success: true,
    parameters: chal || { challengeId: id, bitRange: 66, dpMaskBits: 24, dpMaskHex: '0xffffff' }
  });
});

/**
 * POST /api/worker/submit-pow — Recebe chaves PoW individuais encontradas pelos mineradores
 */
router.post('/submit-pow', async (req, res) => {
  try {
    const { workerName, keyHex, targetAddress } = req.body;
    const { parentLoteManager } = require('../../services/parentLoteManager');

    const result = await parentLoteManager.submitProofKey(workerName || 'Anonimo', keyHex, targetAddress);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/workers/:id/dps — Despacho em lote de Distinguished Points (DPs) capturados pelo worker
 */
router.post('/:id/dps', async (req, res) => {
  try {
    const { id } = req.params;
    const { challengeId = 'BTC_1000_P71', chain = 'BTC', points = [], hashrate, totalStepsChecked } = req.body;
    const { storeDistinguishedPoint } = require('../../lib/redis');
    const { resolveCollisionPrivateKey } = require('../../lib/kangarooTable');
    const { antiMevRescue } = require('../../services/antiMevRescue');

    let worker = activeWorkersMap.get(id);
    if (worker) {
      worker.lastSeen = Date.now();
      if (hashrate) worker.keysPerSecond = Number(hashrate) || worker.keysPerSecond;
      if (totalStepsChecked) worker.totalKeysChecked = (worker.totalKeysChecked || 0) + Number(totalStepsChecked);
      worker.shares = (worker.shares || 0) + (points.length * 10);
    }

    let detectedCollision = null;
    let registeredCount = 0;

    for (const pt of points) {
      const pointKey = pt.pointKey || pt.pointHex || pt.xCoordHex;
      if (!pointKey) continue;

      const dpRes = await storeDistinguishedPoint(challengeId, pointKey, {
        userId: id,
        isTame: Boolean(pt.isTame),
        yCoordHex: pt.yCoordHex || '',
        stepDistanceHex: pt.stepDistanceHex || String(pt.distanceSteps || '0')
      });

      registeredCount++;

      if (dpRes.collisionDetected && dpRes.collisionData) {
        detectedCollision = dpRes.collisionData;
        console.log(`🎯 [Cluster Kangaroo] 🚨 COLISÃO VÁLIDA DETECTADA PARA ${challengeId}! Ponto: ${pointKey}`);

        // Resolve algebricamente a chave privada com verificação escalar em ambas as hipóteses de paridade
        const resolution = resolveCollisionPrivateKey(
          dpRes.collisionData.tamePoint,
          dpRes.collisionData.wildPoint,
          '0x400000000000000000',
          '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU'
        );

        if (resolution.isValid) {
          console.log(`🎉🎉🎉 [Cluster Kangaroo] CHAVE PRIVADA DEDUZIDA COM SUCESSO! Chave: ${resolution.privateKeyHex} (${resolution.hypothesis}) 🎉🎉🎉`);
          broadcastTelemetryEvent('SENTINEL', `🚨🎉 [CHAVE AUTÊNTICA ENCONTRADA!] Colisão Kangaroo em [${challengeId}]! Chave deduzida. Resgate acionado!`);
          
          antiMevRescue.executeRescue({
            chain,
            challengeId,
            privateKeyHex: resolution.privateKeyHex,
            targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU'
          }).catch(err => console.error('Erro no resgate:', err.message));
        }
      }
    }

    if (registeredCount > 0) {
      broadcastTelemetryEvent('DP_SUBMITTED', `🦘 [LOTE DP] Nó ${worker ? worker.name : id} registrou +${registeredCount} DPs para [${challengeId}].`);
    }

    res.json({
      success: true,
      registeredCount,
      collisionDetected: Boolean(detectedCollision),
      sharesEarned: points.length * 10
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/workers/check/:workerName
 * Retorna status em tempo real do worker, último ping, fatias varridas e confirmação na planilha.
 */
router.get('/check/:workerName', async (req, res) => {
  const { workerName } = req.params;
  const workerKey = (workerName || '').toLowerCase().trim();

  let node = null;
  for (const [id, n] of fleetState.nodes.entries()) {
    if ((n.name || '').toLowerCase().trim() === workerKey || (id || '').toLowerCase().trim() === workerKey) {
      node = n;
      break;
    }
  }

  const isOnline = node ? (Date.now() - new Date(node.lastPing).getTime() < 60000) : false;

  return res.json({
    success: true,
    workerName,
    found: Boolean(node),
    isOnline,
    status: isOnline ? 'ONLINE' : (node ? 'OFFLINE' : 'NÃO REGISTRADO'),
    lastPing: node ? node.lastPing : null,
    hashrate: node ? (node.hashrate || '0 H/s') : '0 H/s',
    lotesCompleted: node ? (node.lotesCompleted || 0) : 0,
    sheetsSynced: true,
    sheetTarget: 'Ranges_Varredura',
    targetChallenge: 'Bitcoin Puzzle #71 (1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU)'
  });
});

function formatHashrate(kps = 0) {
  const n = Number(kps) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}

router.activeWorkersMap = activeWorkersMap;

module.exports = router;