// ============================================
// 🧩 PuzzleRadar — Rotas de Puzzles (com Paginação Server-Side)
// ============================================

const express = require('express');
const { calculateDifficultyScore, getMultiChainPuzzleData } = require('../../lib/difficultyEngine');
const prisma = require('../../lib/prisma');

const router = express.Router();

const puzzleHintsStore = new Map();
puzzleHintsStore.set('66', [
  { type: 'bip39ChecksumFilter', discardRate: '93.75%' }
]);

/**
 * GET /api/puzzles — Lista puzzles com Paginação Server-Side, Filtros e Busca
 */
router.get('/', async (req, res) => {
  try {
    const { chain, difficulty, status, search, page = 1, limit = 9 } = req.query;
    
    let puzzles = getMultiChainPuzzleData();
    
    // Aplicar hints personalizados se existirem
    puzzles = puzzles.map(p => {
      const hints = puzzleHintsStore.get(String(p.puzzleNumber)) || [];
      if (hints.length > 0) {
        const recalculation = calculateDifficultyScore({
          bitRange: p.bits,
          rangeStart: p.rangeStart,
          rangeEnd: p.rangeEnd,
          prizeAmount: p.prize,
          hints,
          publicKeyExposed: p.publicKeyExposed
        });
        return {
          ...p,
          ...recalculation,
          hints
        };
      }
      return {
        ...p,
        hints: []
      };
    });

    // Filtros
    if (chain && chain !== 'all') {
      puzzles = puzzles.filter(p => p.chain.toUpperCase() === chain.toUpperCase());
    }
    if (difficulty && difficulty !== 'all') {
      puzzles = puzzles.filter(p => p.difficulty.toUpperCase() === difficulty.toUpperCase());
    }
    if (status === 'active') puzzles = puzzles.filter(p => !p.solved);
    if (status === 'solved') puzzles = puzzles.filter(p => p.solved);
    if (search) {
      const q = search.toLowerCase();
      puzzles = puzzles.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.targetAddress && p.targetAddress.toLowerCase().includes(q)) ||
        (String(p.puzzleNumber).includes(q))
      );
    }

    const total = puzzles.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 9);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedPuzzles = puzzles.slice(startIndex, endIndex);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      puzzles: paginatedPuzzles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/puzzles/:id — Detalhes de um puzzle
 */
router.get('/:id', async (req, res) => {
  try {
    const puzzles = getMultiChainPuzzleData();
    const puzzleIdParam = req.params.id;
    const puzzleNum = parseInt(puzzleIdParam.replace(/\D/g, ''), 10) || parseInt(puzzleIdParam, 10);
    
    let puzzle = puzzles.find(p => p.puzzleNumber === puzzleNum);
    
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle não encontrado', code: 'NOT_FOUND' });
    }

    const hints = puzzleHintsStore.get(String(puzzleNum)) || [];
    if (hints.length > 0) {
      const recalculation = calculateDifficultyScore({
        bitRange: puzzle.bits,
        rangeStart: puzzle.rangeStart,
        rangeEnd: puzzle.rangeEnd,
        prizeAmount: puzzle.prize,
        hints,
        publicKeyExposed: puzzle.publicKeyExposed
      });
      puzzle = { ...puzzle, ...recalculation, hints };
    } else {
      puzzle.hints = [];
    }
    
    res.json(puzzle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/puzzles/:id/hints
 */
router.post('/:id/hints', async (req, res) => {
  try {
    const puzzleIdParam = req.params.id;
    const puzzleNum = parseInt(puzzleIdParam.replace(/\D/g, ''), 10) || parseInt(puzzleIdParam, 10);
    const { hints } = req.body;

    if (!Array.isArray(hints)) {
      return res.status(400).json({ error: 'hints deve ser um array de dicas válidas' });
    }

    puzzleHintsStore.set(String(puzzleNum), hints);

    const puzzles = getMultiChainPuzzleData();
    const basePuzzle = puzzles.find(p => p.puzzleNumber === puzzleNum) || { bits: 66, prize: 6.6 };

    const recalculation = calculateDifficultyScore({
      bitRange: basePuzzle.bits,
      prizeAmount: basePuzzle.prize,
      hints
    });

    res.json({
      success: true,
      puzzleNumber: puzzleNum,
      hints,
      recalculation,
      message: `Dicas aplicadas! Entropia reduzida para ${recalculation.effectiveBits} bits efetivos.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/puzzles/entropy/simulate
 */
router.post('/entropy/simulate', (req, res) => {
  try {
    const { bitRange = 66, prizeAmount = 6.6, hints = [], publicKeyExposed = false } = req.body;
    
    const result = calculateDifficultyScore({
      bitRange: Number(bitRange),
      prizeAmount: Number(prizeAmount),
      hints,
      publicKeyExposed: Boolean(publicKeyExposed)
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;