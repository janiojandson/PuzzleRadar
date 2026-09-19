// =========================================================================
// 🧩 PuzzleRadar v5.0 — Range Distribution & Real-time Progress Routes
// =========================================================================
// Distribui o próximo custom_range otimizado para o btcpuzzle client (GPU/VanitySearch)
// e fornece telemetria em tempo real do keyspace de 71 bits.
// =========================================================================

const express = require('express');
const { loteManager } = require('../../services/loteManager');
const { dataAggregator } = require('../../services/dataAggregator');

const router = express.Router();

/**
 * GET /api/range/next/:worker_id
 * Retorna o lote com maior priority_score no formato exato requerido pelo btcpuzzle client
 */
router.get('/next/:worker_id', async (req, res) => {
  try {
    const { worker_id } = req.params;
    const hashrate = req.query.hashrate || req.headers['x-hashrate'] || null;
    const isBrowser = req.query.client === 'browser' || req.headers['x-client'] === 'browser';

    const { parentLoteManager } = require('../../services/parentLoteManager');
    const puzzle = parseInt(req.query.puzzle || '71', 10);

    // Para o Puzzle 71 (fatia ativa da API oficial btcpuzzle.info),
    // distribui SEMPRE as micro-fatias contíguas da Fatia Pai Oficial ativa
    // para TODOS os nós (Browser, Colab, Terminal, PowerShell), concentrando
    // o cluster na descoberta das 6 chaves PoW!
    if (puzzle === 71 && req.query.mode !== 'legacy_grid') {
      const microLote = await parentLoteManager.getNextMicroLote(worker_id);

      // Registra worker ativo no Google Sheets Buffer de forma assíncrona
      try {
        const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');
        sheetsBuffer.enqueueChunkLog({
          timestamp: new Date().toISOString(),
          chain: 'BTC',
          challenge_id: 'BTC_1000_P71',
          startHex: microLote.startHex,
          endHex: microLote.endHex,
          workerName: worker_id,
          status: isBrowser ? 'ONLINE_BROWSER' : 'ONLINE_TERMINAL',
          hashrate: hashrate || (isBrowser ? '50 kH/s' : '1.0 GH/s')
        });
      } catch (_) {}

      // Atualiza o mapa de nós ativos (activeWorkersMap) para telemetria em tempo real e soma de velocidade
      try {
        const workersRouter = require('./workers');
        if (workersRouter.activeWorkersMap) {
          const nodeId = req.query.node_id || req.query.nodeId || worker_id;
          const operatorName = req.query.operator || req.query.user || worker_id.split('_node_')[0];
          
          let kps = 0;
          if (hashrate) {
            const num = parseFloat(hashrate);
            if (!isNaN(num)) {
              if (String(hashrate).toLowerCase().includes('gh/s')) kps = num * 1e9;
              else if (String(hashrate).toLowerCase().includes('mh/s')) kps = num * 1e6;
              else if (String(hashrate).toLowerCase().includes('kh/s')) kps = num * 1e3;
              else kps = num;
            }
          }
          if (kps === 0) {
            kps = isBrowser ? 45000 : 1000000;
          }

          const existing = workersRouter.activeWorkersMap.get(nodeId) || {};
          const displayName = nodeId.includes('_') ? `${operatorName} (${nodeId.split('_').slice(-1)[0]})` : operatorName;

          workersRouter.activeWorkersMap.set(nodeId, {
            ...existing,
            id: nodeId,
            name: displayName,
            workerName: operatorName,
            operator: operatorName,
            nodeId,
            hardware: isBrowser ? 'Navegador Web (WebAssembly)' : 'Terminal Worker (Colab/CPU)',
            gpuModel: isBrowser ? 'CPU WebWorker' : 'Multi-Core / CUDA',
            chain: 'BTC',
            challengeId: 'BTC_1000_P71',
            keysPerSecond: kps,
            status: 'ONLINE',
            progress: 100,
            totalKeysChecked: (existing.totalKeysChecked || 0) + 16777216,
            lastSeen: Date.now()
          });
        }
      } catch (_) {}

      return res.json({
        custom_range: `${microLote.startHex}:${microLote.endHex}`,
        pool_conf_line: `custom_range=${microLote.startHex}:${microLote.endHex}`,
        lote_id: `lote_p71_micro_${microLote.startHex.slice(0, 8)}`,
        puzzle: 71,
        parentHex: microLote.parentHex,
        targets: microLote.targets,
        powAddresses: microLote.powAddresses,
        allocated_at: new Date().toISOString()
      });
    }

    const rangeAssignment = await loteManager.getNextOptimalRange(worker_id, hashrate, isBrowser);
    
    // Registra worker ativo no Google Sheets Buffer de forma assíncrona
    try {
      const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');
      const startHex = (rangeAssignment.custom_range || '').split(':')[0] || '';
      const endHex = (rangeAssignment.custom_range || '').split(':')[1] || '';
      sheetsBuffer.enqueueChunkLog({
        timestamp: new Date().toISOString(),
        chain: 'BTC',
        challenge_id: 'BTC_1000_P71',
        startHex,
        endHex,
        workerName: worker_id,
        status: isBrowser ? 'ONLINE_BROWSER' : 'ONLINE_TERMINAL',
        hashrate: hashrate || (isBrowser ? '50 kH/s' : '1.0 GH/s')
      });
    } catch (_) {}

    res.json(rangeAssignment);
  } catch (err) {
    console.error('❌ [Range Route Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/status
 * Telemetria geral de coordenação, fatias ativas e conformidade de rate limit
 */
const getCoordinatorStatus = (req, res) => {
  try {
    const stats71 = loteManager.getStats(71);
    const rateLimits = dataAggregator.getRateLimitStats();
    const { parentLoteManager } = require('../../services/parentLoteManager');

    res.json({
      service: 'PuzzleRadar Coordinator v5.0',
      status: 'ONLINE',
      mode: 'AUTONOMOUS_COORDINATOR_SCENARIO_B',
      puzzle71: stats71,
      parentLote: parentLoteManager.getStatus(),
      rateLimits,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.get('/', getCoordinatorStatus);
router.get('/status', getCoordinatorStatus);

/**
 * GET /api/progress/:puzzle_number
 * Retorna estatísticas detalhadas de progresso e fatias para o puzzle solicitado
 */
router.get('/progress/:puzzle_number', (req, res) => {
  try {
    const { puzzle_number } = req.params;
    const stats = loteManager.getStats(puzzle_number);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
