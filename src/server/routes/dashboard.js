// ============================================
// 🧩 PuzzleRadar — Dashboard & Estatísticas
// ============================================

const express = require('express');
const { getBitcoinPuzzleData } = require('../../lib/difficultyEngine');

const router = express.Router();

// GET /api/dashboard — Visão geral do sistema
router.get('/', async (req, res) => {
  try {
    const puzzles = getBitcoinPuzzleData();
    const activePuzzles = puzzles.filter(p => !p.solved);
    const solvedPuzzles = puzzles.filter(p => p.solved);
    
    // Puzzles mais viáveis (menor dificuldade entre os ativos)
    const viablePuzzles = activePuzzles
      .filter(p => p.viabilityPool || p.viabilityGPU)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
    
    res.json({
      overview: {
        totalPuzzles: puzzles.length,
        activePuzzles: activePuzzles.length,
        solvedPuzzles: solvedPuzzles.length,
        totalPrizeBTC: activePuzzles.reduce((sum, p) => sum + p.prize, 0).toFixed(2)
      },
      topViable: viablePuzzles.map(p => ({
        puzzleNumber: p.puzzleNumber,
        bits: p.bits,
        prize: p.prize,
        difficultyLabel: p.label,
        difficultyEmoji: p.emoji,
        score: p.score,
        recommendedStrategy: p.recommendedStrategy,
        estimatedDaysRTX4090: p.estimatedDaysRTX4090
      })),
      difficultyDistribution: {
        easy: puzzles.filter(p => p.difficulty === 'EASY').length,
        medium: puzzles.filter(p => p.difficulty === 'MEDIUM').length,
        hard: puzzles.filter(p => p.difficulty === 'HARD').length,
        extreme: puzzles.filter(p => p.difficulty === 'EXTREME').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/learning — Puzzles resolvidos para aprender
router.get('/learning', async (req, res) => {
  try {
    const puzzles = getBitcoinPuzzleData();
    const solvedPuzzles = puzzles
      .filter(p => p.solved)
      .sort((a, b) => a.bits - b.bits);
    
    res.json({
      learningPuzzles: solvedPuzzles.map(p => ({
        puzzleNumber: p.puzzleNumber,
        bits: p.bits,
        prize: p.prize,
        difficultyLabel: p.label,
        difficultyEmoji: p.emoji,
        recommendedFor: p.bits <= 20 ? 'Iniciante absoluto' :
                        p.bits <= 30 ? 'Iniciante' :
                        p.bits <= 40 ? 'Intermediário' : 'Avançado'
      })),
      tip: 'Comece pelos puzzles de menor bits para entender o processo. Use keyhunt ou KeyHunt-Cuda para praticar.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;