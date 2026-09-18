// =========================================================================
// 🧩 PuzzleRadar v5.1 — Leaderboard Public API Endpoint
// =========================================================================

const express = require('express');
const { leaderboardService } = require('../../services/leaderboardService');

const router = express.Router();

/**
 * GET /api/leaderboard
 * Retorna os Top 20 contribuidores da rede e métricas da comunidade
 */
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const stats = await leaderboardService.getTopContributors(limit);
    res.json(stats);
  } catch (err) {
    console.error('❌ [Leaderboard Route Error]', err.message);
    res.status(200).json({
      success: true,
      totalContributors: 0,
      totalCommunityKeys: 0,
      leaderboard: [],
      error: err.message
    });
  }
});

module.exports = router;
