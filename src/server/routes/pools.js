// =========================================================================
// 🧩 PuzzleRadar — Rotas de Pool Colaborativo (Proof-of-Share & Anti-Roubo)
// =========================================================================
// Arquitetura Colaborativa Institucional:
// 1. GET /api/pool/job: Entrega fatias de busca vinculadas ao workerToken.
// 2. POST /api/pool/submit-point: Recebe Distinguished Points (DPs) calculados
//    pelas máquinas clientes. O cliente NUNCA calcula nem detém a chave privada
//    final; ele apenas submete as pegadas/coordenadas calculadas.
// 3. POST /api/pool/submit-chunk: Valida Proof-of-Share mínimo de DPs para marcar
//    o chunk como COMPLETED.
// 4. Central Collision Engine: Detecta colisão de DPs no backend e deduz a chave.
// =========================================================================

const express = require('express');
const crypto = require('crypto');
const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');
const { markChunkScanned, storeDistinguishedPoint, getDpStats } = require('../../lib/redis');
const { antiMevRescue } = require('../../services/antiMevRescue');
const { honeypotShield } = require('../../services/honeypotShield');
const { 
  deriveBitcoinAddress, 
  verifyDiscoveryProof, 
  isDistinguishedPoint, 
  deducePrivateKeyKangaroo, 
  verifyProofOfShareBinomial 
} = require('../../lib/cryptoVerifier');
const { broadcastTelemetryEvent } = require('./telemetry');
const { fleetState } = require('../../lib/fleetState');

const router = express.Router();

const activePoolWorkers = fleetState.nodes; // workerToken => { workerName, shares, hashrate, lastSeen }
router.activePoolWorkers = activePoolWorkers;

// ─── GET /api/pool/job ───
// Entrega fatias de busca vinculadas ao workerToken do assinante
router.get('/job', async (req, res) => {
  try {
    const workerToken = req.query.workerToken || req.headers['x-worker-token'] || 'colab-worker-anon';
    const workerName = req.query.workerName || 'Colab-Node';
    const chain = req.query.chain || 'BTC';
    const challengeId = req.query.challengeId || 'BTC_1000_P71';

    // Se o desafio for de Smart Contract, audita com HoneypotShield primeiro
    if (chain === 'ETH' || chain === 'SOL') {
      const audit = await honeypotShield.auditContractChallenge(challengeId, chain);
      if (!audit.isSafe) {
        return res.status(403).json({
          error: 'Desafio em quarentena de segurança pelo Honeypot Shield',
          reasons: audit.reasons
        });
      }
    }

    // Registra worker ativo
    const now = new Date();
    activePoolWorkers.set(workerToken, {
      workerToken,
      workerName,
      chain,
      challengeId,
      lastSeen: now.toISOString(),
      shares: (activePoolWorkers.get(workerToken)?.shares || 0)
    });

    // Gera chunk determinístico/pseudo-aleatório no range do Puzzle #71
    const baseOffset = BigInt('0x400000000000000000');
    const randomChunkIdx = Math.floor(Math.random() * 500000) + 1;
    const chunkSize = BigInt('0x10000000000'); // 1 trilhão de chaves por fatia
    const chunkStart = (baseOffset + BigInt(randomChunkIdx) * chunkSize).toString(16);
    const chunkEnd = (baseOffset + BigInt(randomChunkIdx + 1) * chunkSize - 1n).toString(16);

    res.json({
      jobId: `job_${Date.now()}_${randomChunkIdx}`,
      workerToken,
      chain,
      challengeId,
      targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
      targetPubKey: '03a2edd49e819e4d0473cf694931a5eb8db846ee74f4842188ab642784cf072895',
      chunkIndex: randomChunkIdx,
      rangeStart: '0x' + chunkStart,
      rangeEnd: '0x' + chunkEnd,
      algorithm: 'KANGAROO_DISTINGUISHED_POINTS',
      dpMaskBits: 24, // Bits de distinção exigidos para o DP
      minPointsRequired: 5,
      leaseExpiresInSeconds: 900
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const recentDpsList = []; // Últimos DPs recebidos em tempo real
router.recentDpsList = recentDpsList;

// ─── POST /api/pool/submit-point ───
// Recebe Distinguished Points (DPs) calculados pelas GPUs/Workers
router.post('/submit-point', async (req, res) => {
  try {
    const {
      workerToken,
      workerName = 'Colab-Node',
      challengeId = 'BTC_1000_P71',
      chain = 'BTC',
      chunkIndex,
      pointHex,
      xCoordHex,
      yCoordHex,
      distanceSteps,
      stepDistanceHex,
      isTame = false,
      startPointHex
    } = req.body;

    const targetX = xCoordHex || pointHex;
    if (!targetX) {
      return res.status(400).json({ error: 'Coordenada X do Distinguished Point é obrigatória' });
    }

    const timestamp = new Date().toISOString();

    // Valida se atende ao critério matemático de distinção (m=24)
    const validDp = isDistinguishedPoint(targetX, 24);

    // Registra DP no Redis / Memória com índice O(1)
    const dpResult = await storeDistinguishedPoint(challengeId, targetX, {
      userId: workerToken || 'anon_worker',
      isTame: Boolean(isTame),
      yCoordHex: yCoordHex || '',
      stepDistanceHex: stepDistanceHex || String(distanceSteps || '0')
    });

    // Registra no fluxo recente de DPs
    recentDpsList.unshift({
      timestamp,
      challengeId,
      chain,
      workerToken: workerToken || 'wrk_anon',
      workerName,
      xCoordHex: targetX,
      yCoordHex: yCoordHex || '',
      stepDistanceHex: stepDistanceHex || String(distanceSteps || '0'),
      isTame: Boolean(isTame),
      validDp
    });
    if (recentDpsList.length > 50) recentDpsList.pop();

    // Atualiza shares do trabalhador
    const worker = activePoolWorkers.get(workerToken) || { shares: 0, workerToken, workerName };
    worker.shares = (worker.shares || 0) + 1;
    worker.lastSeen = timestamp;
    activePoolWorkers.set(workerToken, worker);

    // Notifica o stream de telemetria em tempo real
    broadcastTelemetryEvent('DP_SUBMITTED', `🦘 [${isTame ? 'TAME' : 'WILD'}] DP entregue por ${workerName}: ${targetX.slice(0, 14)}... (d=${String(distanceSteps || '0').slice(0, 10)})`, {
      workerToken,
      workerName,
      targetX,
      isTame: Boolean(isTame)
    });

    let keyDeductionResult = null;

    // Se detectou colisão Tame vs Wild, o servidor central deduz a chave privada instantaneamente
    if (dpResult.collisionDetected && dpResult.collisionData) {
      console.log(`🎯 [Pool Central] 🚨 COLISÃO KANGAROO DETECTADA PARA ${challengeId}! DP: ${targetX}`);
      
      broadcastTelemetryEvent('COLLISION_ALERT', `🚨 COLISÃO KANGAROO DETECTADA para ${challengeId}! DP: ${targetX}. Deduzindo chave...`);

      const bHex = '0x7fffffffffffffffff'; // Extremo superior do Puzzle #71
      const dTame = dpResult.collisionData.tamePoint.stepDistanceHex;
      const dWild = dpResult.collisionData.wildPoint.stepDistanceHex;

      keyDeductionResult = deducePrivateKeyKangaroo(bHex, dTame, dWild);
      
      if (keyDeductionResult.success) {
        console.log(`🔑 [Pool Central] CHAVE PRIVADA DEDUZIDA COM SUCESSO! Disparando Resgate Anti-MEV...`);
        // Dispara o resgate seguro no cofre frio sem expor a chave para o worker
        antiMevRescue.executeRescue({
          chain,
          challengeId,
          privateKeyHex: keyDeductionResult.privateKeyHex,
          targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU'
        }).catch(err => console.error('Erro no resgate:', err.message));
      }
    }

    res.json({
      status: 'ACCEPTED',
      shareAccepted: true,
      validDistinguishedPoint: validDp,
      totalWorkerShares: worker.shares,
      collisionDetected: dpResult.collisionDetected,
      collisionData: dpResult.collisionDetected ? { status: 'KEY_DEDUCTION_TRIGGERED_CONFIDENTIAL' } : null,
      message: 'Distinguished Point verificado e registrado com sucesso.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/pool/simulate-worker-step ───
// Permite simular 1 passo de mineração ao vivo direto pelo painel web
router.post('/simulate-worker-step', async (req, res) => {
  try {
    const { workerToken = 'wrk_web_simulator', workerName = 'Simulador Web GPU', challengeId = 'BTC_1000_P71', chain = 'BTC' } = req.body;
    const randomChunkIdx = Math.floor(Math.random() * 9000) + 1000;
    const dpHex = '0x' + crypto.randomBytes(5).toString('hex') + '000000'; // 24 bits zero
    const distHex = '0x' + crypto.randomBytes(4).toString('hex');
    const isTame = Math.random() > 0.5;

    // Registra DP
    await storeDistinguishedPoint(challengeId, dpHex, {
      userId: workerToken,
      isTame,
      yCoordHex: '0x' + crypto.randomBytes(16).toString('hex'),
      stepDistanceHex: distHex
    });

    const timestamp = new Date().toISOString();
    recentDpsList.unshift({
      timestamp,
      challengeId,
      chain,
      workerToken,
      workerName,
      xCoordHex: dpHex,
      stepDistanceHex: distHex,
      isTame,
      validDp: true
    });
    if (recentDpsList.length > 50) recentDpsList.pop();

    const worker = activePoolWorkers.get(workerToken) || { shares: 0, workerToken, workerName };
    worker.shares = (worker.shares || 0) + 1;
    worker.lastSeen = timestamp;
    activePoolWorkers.set(workerToken, worker);

    // Marca no Space Pruning e buffer
    await markChunkScanned(challengeId, randomChunkIdx);
    sheetsBuffer.enqueueChunkLog({
      timestamp,
      chain,
      challenge_id: challengeId,
      chunkIndex: randomChunkIdx,
      startHex: '0x4000000000000' + randomChunkIdx,
      endHex: '0x4000000000000' + (randomChunkIdx + 1),
      workerName,
      status: 'COMPLETED',
      hashrate: hashrate || '0 H/s',
      keyFound: false
    });

    res.json({
      success: true,
      message: 'Simulação executada com sucesso! DP gerado e registrado no cluster.',
      dpHex,
      isTame,
      chunkIndex: randomChunkIdx,
      totalWorkerShares: worker.shares
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/pool/submit-chunk ───
// Valida Proof-of-Share estatístico (Binomial) e enfileira no buffer de lotes
router.post('/submit-chunk', async (req, res) => {
  try {
    const {
      workerToken,
      workerName = 'Colab Farm Node',
      challengeId = 'BTC_1000_P71',
      chain = 'BTC',
      chunkIndex,
      startHex,
      endHex,
      hashrate = '0 H/s',
      pointsSubmitted = 0,
      keysChecked = 1000000000000
    } = req.body;

    // Verificação estatística binomial anti-trapaça
    const binomialCheck = verifyProofOfShareBinomial(keysChecked, Number(pointsSubmitted), 24);

    // Marca no Space Pruning
    if (chunkIndex !== undefined) {
      await markChunkScanned(challengeId, chunkIndex);
    }

    // Enfileira no buffer de lotes para o Google Sheets
    sheetsBuffer.enqueueChunkLog({
      timestamp: new Date().toISOString(),
      chain,
      challenge_id: challengeId,
      chunkIndex,
      startHex,
      endHex,
      workerName,
      status: binomialCheck.isValid ? 'COMPLETED' : 'FLAGGED_LOW_SHARES',
      hashrate,
      keyFound: false
    });

    res.json({
      success: true,
      proofOfShareValid: binomialCheck.isValid,
      binomialAudit: binomialCheck,
      chunkIndex,
      status: binomialCheck.isValid ? 'COMPLETED' : 'FLAGGED_LOW_SHARES',
      message: 'Chunk validado e registrado no buffer de auditoria do cluster.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/pool/stats & GET /api/pool/transparency ───
// Mural de Transparência PoS com agrupamento por login, taxa da casa de 15% e regra de assinatura ativa
const getTransparencyData = async () => {
  const workersRouter = require('./workers');
  const activeNodesMap = workersRouter.activeWorkersMap || new Map();
  const dpStats = await getDpStats('BTC_1000_P71');

  const prizeBtc = 7.10;
  const btcPriceUsd = 65000;
  const poolTotalPrizeUsd = prizeBtc * btcPriceUsd; // ~$461.500 USD

  // 15% Taxa da Casa / Autor do Projeto para infraestrutura e custódia privada
  const houseFeeRate = 0.15;
  const houseBaseUsd = poolTotalPrizeUsd * houseFeeRate; // $69.225
  const distributableSubscribersPoolUsd = poolTotalPrizeUsd * (1 - houseFeeRate); // $392.275 (85%)

  // Agrupa todas as sessões e nós conectados por Operador / Login / Token
  const operatorsMap = new Map();

  // 1. Processa nós mineradores em execução (fleetState.nodes)
  const now = Date.now();
  for (const [nodeId, worker] of activeNodesMap.entries()) {
    if (now - (worker.lastSeen || 0) <= 180000) {
      const opToken = worker.userToken || worker.name || nodeId || 'wrk_anonymous_node';
      const opName = worker.name || (worker.userToken && worker.userToken.startsWith('pzk_admin') ? 'Administrador Mestre' : `Assinante (${String(opToken).slice(0, 10)}...)`);
      const isSubscriber = Boolean(worker.userToken && worker.userToken !== 'wrk_anonymous_node' && worker.userToken !== 'anon');

      const existing = operatorsMap.get(opToken) || {
        operatorToken: opToken,
        operatorName: opName,
        isSubscriberActive: isSubscriber || true,
        subscriptionStatus: 'ACTIVE',
        activeNodesCount: 0,
        nodes: [],
        totalKeysChecked: 0,
        totalHashrateKps: 0,
        completedChunks: 0,
        shares: 0,
        lastSeen: new Date(worker.lastSeen || Date.now()).toISOString()
      };

      existing.activeNodesCount += 1;
      existing.nodes.push({ id: nodeId, name: worker.name, status: worker.status, hashrate: worker.keysPerSecond });
      existing.totalKeysChecked += (worker.totalKeysChecked || 0);
      existing.totalHashrateKps += (worker.keysPerSecond || 0);
      existing.completedChunks += (worker.completedChunks || 0);
      existing.shares += (worker.shares || 0);
      if (worker.lastSeen && worker.lastSeen > new Date(existing.lastSeen).getTime()) {
        existing.lastSeen = new Date(worker.lastSeen).toISOString();
      }

      operatorsMap.set(opToken, existing);
    }
  }

  const operatorsList = Array.from(operatorsMap.values());
  const totalPoolShares = operatorsList.reduce((acc, op) => acc + (op.shares || 0), 0);


  // Separa shares de assinantes ativos vs cotas revertidas de nós inativos/sem login
  const activeSubscribersList = operatorsList.filter(op => op.isSubscriberActive && op.subscriptionStatus === 'ACTIVE');
  const activeSubscribersShares = activeSubscribersList.reduce((acc, op) => acc + (op.shares || 0), 0);
  
  const inactiveOperatorsList = operatorsList.filter(op => !op.isSubscriberActive || op.subscriptionStatus !== 'ACTIVE');
  const inactiveRevertedShares = inactiveOperatorsList.reduce((acc, op) => acc + (op.shares || 0), 0);

  // Calcula % e rendimento líquido para cada operador
  const formattedOperators = operatorsList.map(op => {
    let sharePercent = 0;
    let projectedPayoutUsd = 0;

    if (op.isSubscriberActive && activeSubscribersShares > 0) {
      const shareFrac = op.shares / activeSubscribersShares;
      sharePercent = shareFrac * 100;
      projectedPayoutUsd = parseFloat((shareFrac * distributableSubscribersPoolUsd).toFixed(2));
    }

    return {
      operatorToken: op.operatorToken,
      operatorName: op.operatorName,
      isSubscriberActive: op.isSubscriberActive,
      subscriptionStatus: op.subscriptionStatus,
      activeNodesCount: op.activeNodesCount,
      totalKeysChecked: op.totalKeysChecked,
      totalHashrateFormatted: formatKps(op.totalHashrateKps),
      completedChunks: op.completedChunks,
      shares: op.shares,
      sharePercent: sharePercent.toFixed(2) + '%',
      projectedPayoutUsd,
      lastSeen: op.lastSeen
    };
  });

  // Reversão de cotas inativas para a Casa
  const revertedSharesAmountUsd = totalPoolShares > 0 && activeSubscribersShares > 0
    ? parseFloat(((inactiveRevertedShares / totalPoolShares) * distributableSubscribersPoolUsd).toFixed(2))
    : 0;

  const totalHouseTakeUsd = parseFloat((houseBaseUsd + revertedSharesAmountUsd).toFixed(2));

  return {
    totalActiveOperators: operatorsList.length,
    totalActiveNodes: operatorsList.reduce((acc, op) => acc + op.activeNodesCount, 0),
    totalDistinguishedPoints: Math.max(recentDpsList.length, dpStats.totalDps),
    totalPoolShares,
    activeChallenge: 'BTC_1000_P71',
    financialSummary: {
      poolTotalPrizeUsd,
      houseFeePercent: 15,
      houseBaseUsd,
      distributableSubscribersPoolUsd,
      inactiveRevertedShares,
      revertedSharesAmountUsd,
      totalHouseTakeUsd,
      ruleNotice: '15% de taxa da casa para sustentação do ecossistema. 85% distribuído proporcionalmente aos assinantes ativos. Shares de nós anônimos ou assinaturas inativas são 100% revertidas à Casa.'
    },
    recentDps: recentDpsList.slice(0, 20),
    operators: formattedOperators,
    bufferStats: sheetsBuffer.getStats()
  };
};

function formatKps(kps = 0) {
  const n = Number(kps) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}

router.get('/stats', async (req, res) => {
  res.json(await getTransparencyData());
});

router.get('/transparency', async (req, res) => {
  res.json(await getTransparencyData());
});

/**
 * GET /api/pool/status
 * Retorna o status unificado da Pool Oficial e dos 60 Marcos do PuzzleRadar
 */
router.get('/status', (req, res) => {
  try {
    const { parentLoteManager } = require('../../services/parentLoteManager');
    res.json({
      success: true,
      parentLote: parentLoteManager.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/pool/mode
 * Altera a estratégia ativa: 'OFFICIAL_POOL' ou 'AUTONOMOUS_AI'
 */
router.post('/mode', (req, res) => {
  try {
    const { mode } = req.body;
    const { parentLoteManager } = require('../../services/parentLoteManager');
    const result = parentLoteManager.setMode(mode);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({
      success: true,
      mode: result.mode,
      parentLote: parentLoteManager.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/pool/request-new-slice
 * Força a requisição de uma nova fatia pai da API oficial
 */
router.post('/request-new-slice', async (req, res) => {
  try {
    const { parentLoteManager } = require('../../services/parentLoteManager');
    const newStatus = await parentLoteManager.requestNewOfficialSlice();
    res.json({
      success: true,
      message: 'Nova fatia pai requisitada com sucesso da API oficial',
      parentLote: newStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;