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
router.get('/status', (req, res) => {
  try {
    const stats71 = loteManager.getStats(71);
    const rateLimits = dataAggregator.getRateLimitStats();

    res.json({
      service: 'PuzzleRadar Coordinator v5.0',
      status: 'ONLINE',
      mode: 'AUTONOMOUS_COORDINATOR_SCENARIO_B',
      puzzle71: stats71,
      rateLimits,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
