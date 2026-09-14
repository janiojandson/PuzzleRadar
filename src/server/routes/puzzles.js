// ============================================
// 🧩 PuzzleRadar — Rotas de Puzzles
// ============================================

const express = require('express');
const { calculateDifficultyScore, getBitcoinPuzzleData } = require('../../lib/difficultyEngine');
const { requireAuth } = require('../../lib/auth');

const router = express.Router();

// GET /api/puzzles — Lista todos os puzzles com pontuação
router.get('/', async (req, res) => {
  try {
    const { chain, difficulty, status, minBits, maxBits } = req.query;
    
    // TODO: Buscar do DB via Prisma com filtros
    // Por enquanto, usar dados do Bitcoin Puzzle Transaction
    let puzzles = getBitcoinPuzzleData();
    
    // Filtros
    if (chain) puzzles = puzzles.filter(p => p.chain === chain);
    if (difficulty) puzzles = puzzles.filter(p => p.difficulty === difficulty.toUpperCase());
    if (status === 'active') puzzles = puzzles.filter(p => !p.solved);
    if (status === 'solved') puzzles = puzzles.filter(p => p.solved);
    if (minBits) puzzles = puzzles.filter(p => p.bits >= parseInt(minBits));
    if (maxBits) puzzles = puzzles.filter(p => p.bits <= parseInt(maxBits));
    
    res.json({
      total: puzzles.length,
      puzzles: puzzles.map(p => ({
        puzzleNumber: p.puzzleNumber,
        bits: p.bits,
        prize: p.prize,
        solved: p.solved,
        difficultyScore: p.score,
        difficultyLabel: p.label,
        difficultyEmoji: p.emoji,
        estimatedHoursRTX4090: p.estimatedHoursRTX4090,
        viabilityCPU: p.viabilityCPU,
        viabilityGPU: p.viabilityGPU,
        viabilityPool: p.viabilityPool,
        recommendedStrategy: p.recommendedStrategy
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/puzzles/:id — Detalhes de um puzzle
router.get('/:id', async (req, res) => {
  try {
    const puzzles = getBitcoinPuzzleData();
    const puzzle = puzzles.find(p => p.puzzleNumber === parseInt(req.params.id));
    
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle não encontrado', code: 'NOT_FOUND' });
    }
    
    res.json(puzzle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/puzzles — Criar novo puzzle (admin)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, chain, targetAddress, targetPublicKey, bitRange, rangeStart, rangeEnd, prizeAmount, prizeCurrency, sourceUrl, sourceName } = req.body;
    
    // Calcular dificuldade
    const difficulty = calculateDifficultyScore({
      bitRange,
      rangeStart,
      rangeEnd,
      prizeAmount: prizeAmount || 0,
      prizeCurrency: prizeCurrency || 'BTC'
    });
    
    // TODO: Salvar no DB via Prisma
    
    res.status(201).json({
      title,
      chain,
      targetAddress,
      bitRange,
      difficultyScore: difficulty.score,
      difficultyLabel: difficulty.label,
      difficultyEmoji: difficulty.emoji,
      estimatedHoursRTX4090: difficulty.estimatedHoursRTX4090,
      viabilityCPU: difficulty.viabilityCPU,
      viabilityGPU: difficulty.viabilityGPU,
      viabilityPool: difficulty.viabilityPool,
      recommendedStrategy: difficulty.recommendedStrategy
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/puzzles/difficulty/calculate — Calcula dificuldade de um range
router.post('/difficulty/calculate', (req, res) => {
  try {
    const { bitRange, rangeStart, rangeEnd, prizeAmount, prizeCurrency } = req.body;
    
    const result = calculateDifficultyScore({
      bitRange,
      rangeStart,
      rangeEnd,
      prizeAmount: prizeAmount || 0,
      prizeCurrency: prizeCurrency || 'BTC'
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;