// ============================================
// 🧩 PuzzleRadar — Rotas de Contribuições
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');
const { calculatePrizeSplit } = require('../../lib/difficultyEngine');

const router = express.Router();

// GET /api/contributions — Minhas contribuições
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // TODO: Buscar do DB via Prisma
    res.json({
      contributions: [],
      totalShares: 0,
      totalKeysChecked: 0,
      totalComputeHours: 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contributions/leaderboard — Ranking de contribuidores
router.get('/leaderboard', async (req, res) => {
  try {
    const { poolId, period } = req.query;
    
    // TODO: Buscar do DB e ordenar por shares
    res.json({
      leaderboard: [],
      period: period || 'all_time'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;