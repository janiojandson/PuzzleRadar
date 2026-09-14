// ============================================
// 🧩 PuzzleRadar — Rotas de Puzzles & Redução de Entropia
// ============================================

const express = require('express');
const { calculateDifficultyScore, getBitcoinPuzzleData, calculateEntropyReduction } = require('../../lib/difficultyEngine');
const prisma = require('../../lib/prisma');

const router = express.Router();

// Mock store em memória para hints dinâmicos de puzzles
const puzzleHintsStore = new Map();

// Inicializa hints padrões se desejado (ex: Puzzle #66)
puzzleHintsStore.set('66', [
  { type: 'bip39ChecksumFilter', discardRate: '93.75%' }
]);

/**
 * GET /api/puzzles — Lista todos os puzzles com pontuação e suporte a hints
 */
router.get('/', async (req, res) => {
  try {
    const { chain, difficulty, status, minBits, maxBits } = req.query;
    
    let puzzles = getBitcoinPuzzleData();
    
    // Aplicar hints personalizados se existirem
    puzzles = puzzles.map(p => {
      const hints = puzzleHintsStore.get(String(p.puzzleNumber)) || [];
      if (hints.length > 0) {
        const recalculation = calculateDifficultyScore({
          bitRange: p.bits,
          rangeStart: p.rangeStart,
          rangeEnd: p.rangeEnd,
          prizeAmount: p.prize,
          hints
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
    if (chain) puzzles = puzzles.filter(p => p.chain === chain);
    if (difficulty) puzzles = puzzles.filter(p => p.difficulty === difficulty.toUpperCase());
    if (status === 'active') puzzles = puzzles.filter(p => !p.solved);
    if (status === 'solved') puzzles = puzzles.filter(p => p.solved);
    if (minBits) puzzles = puzzles.filter(p => p.bits >= parseInt(minBits, 10));
    if (maxBits) puzzles = puzzles.filter(p => p.bits <= parseInt(maxBits, 10));
    
    res.json({
      total: puzzles.length,
      puzzles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/puzzles/:id — Detalhes de um puzzle específico
 */
router.get('/:id', async (req, res) => {
  try {
    const puzzles = getBitcoinPuzzleData();
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
        hints
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
 * POST /api/puzzles/:id/hints — Adicionar ou atualizar Dicas (Hints) para Redução de Entropia
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

    const puzzles = getBitcoinPuzzleData();
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
      message: `Dicas aplicadas com sucesso! Entropia reduzida para ${recalculation.effectiveBits} bits efetivos.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/puzzles/entropy/simulate — Simulador Interativo de Redução de Entropia
 */
router.post('/entropy/simulate', (req, res) => {
  try {
    const { bitRange = 66, prizeAmount = 6.6, hints = [] } = req.body;
    
    const result = calculateDifficultyScore({
      bitRange: Number(bitRange),
      prizeAmount: Number(prizeAmount),
      hints
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;