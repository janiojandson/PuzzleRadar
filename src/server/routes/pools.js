// ============================================
// 🧩 PuzzleRadar — Rotas de Pools Colaborativos
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');
const { splitRange, calculatePrizeSplit } = require('../../lib/difficultyEngine');

const router = express.Router();

// GET /api/pools — Lista pools
router.get('/', requireAuth, async (req, res) => {
  try {
    const { orgId, puzzleId, active } = req.query;
    
    // TODO: Buscar do DB via Prisma
    res.json({
      pools: [],
      message: 'Pools serão carregados do PostgreSQL após migração'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pools — Criar pool
router.post('/', requireAuth, async (req, res) => {
  try {
    const { organizationId, puzzleId, name, description, strategy, numRanges } = req.body;
    
    // TODO: Buscar puzzle do DB para obter rangeStart e rangeEnd
    // TODO: Dividir range em sub-ranges
    // TODO: Salvar pool e ranges no DB
    
    res.status(201).json({
      id: 'pool_' + Date.now(),
      organizationId,
      puzzleId,
      name,
      strategy: strategy || 'RANGE_SPLIT',
      totalRanges: numRanges || 10,
      completedRanges: 0,
      progressPercent: 0,
      message: 'Pool criado. Ranges serão distribuídos aos workers.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pools/:id/join — Entrar no pool
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // TODO: Adicionar membro ao pool
    // TODO: Atribuir range disponível
    
    res.json({
      poolId: id,
      userId,
      message: 'Você entrou no pool. Um range será atribuído ao seu worker.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pools/:id/progress — Progresso do pool
router.get('/:id/progress', requireAuth, async (req, res) => {
  try {
    // TODO: Buscar do DB
    res.json({
      poolId: req.params.id,
      totalRanges: 100,
      completedRanges: 0,
      progressPercent: 0,
      activeWorkers: 0,
      totalKeysChecked: 0,
      estimatedTimeRemaining: null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pools/:id/prize-split — Divisão do prêmio
router.get('/:id/prize-split', requireAuth, async (req, res) => {
  try {
    // TODO: Buscar contribuições do DB e calcular divisão
    res.json({
      poolId: req.params.id,
      totalPrize: 0,
      splits: [],
      message: 'Divisão calculada proporcionalmente às shares de cada membro'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;