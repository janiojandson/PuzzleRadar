// ============================================
// 🧩 PuzzleRadar — Rota: Puzzle 1000 BTC (160 Carteiras)
// ============================================

const express = require('express');
const {
  getAll160Puzzles,
  getPuzzleByNumber,
  getStats
} = require('../../lib/puzzles1000btc');
const { calculateDifficultyScore } = require('../../lib/difficultyEngine');

const router = express.Router();

/**
 * GET /api/puzzle1000btc/stats — Estatísticas gerais
 */
router.get('/stats', (req, res) => {
  res.json(getStats());
});

/**
 * GET /api/puzzle1000btc — Lista todos os 160 puzzles com filtros e paginação
 * Query: status (solved|unsolved|all), difficulty (EASY|MEDIUM|HARD|EXTREME|all),
 *        search (busca por número ou endereço), page, limit
 */
router.get('/', (req, res) => {
  try {
    const { status, difficulty, search, page = 1, limit = 20 } = req.query;

    let puzzles = getAll160Puzzles({ status, difficulty, search });

    const total = puzzles.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(160, Math.max(1, parseInt(limit, 10) || 20));
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedPuzzles = puzzles.slice(startIndex, startIndex + limitNum);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      stats: getStats(),
      puzzles: paginatedPuzzles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/puzzle1000btc/:num — Detalhes de um puzzle específico
 */
router.get('/:num', (req, res) => {
  try {
    const num = parseInt(req.params.num, 10);
    if (isNaN(num) || num < 1 || num > 160) {
      return res.status(400).json({ error: 'Número de puzzle inválido. Use 1-160.' });
    }

    const puzzle = getPuzzleByNumber(num);
    if (!puzzle) {
      return res.status(404).json({ error: `Puzzle #${num} não encontrado.` });
    }

    // Calcula dificuldade com motor de entropia
    const diffCalc = calculateDifficultyScore({
      bitRange: puzzle.bits,
      prizeAmount: puzzle.btcPrize,
      publicKeyExposed: puzzle.publicKeyExposed,
      hints: []
    });

    res.json({
      ...puzzle,
      ...diffCalc,
      estimatedSearchTime: {
        singleColabT4_18GH: formatTime(puzzle.totalKeys / 18000000000n),
        farm5xColabs_90GH: formatTime(puzzle.totalKeys / 90000000000n),
        rtx4090_42GH: formatTime(puzzle.totalKeys / 42000000000n)
      },
      links: {
        mempool: puzzle.mempoolUrl,
        bitcoinpuzzles: `https://bitcoinpuzzles.io/pt/puzzles/1000btc#carteiras`,
        rangeSearch: `/api/ranges/available?puzzleNum=${num}`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/puzzle1000btc/:num/set-target — Define um puzzle como alvo ativo para busca
 */
router.post('/:num/set-target', (req, res) => {
  try {
    const num = parseInt(req.params.num, 10);
    if (isNaN(num) || num < 1 || num > 160) {
      return res.status(400).json({ error: 'Número inválido. Use 1-160.' });
    }

    const puzzle = getPuzzleByNumber(num);
    if (!puzzle) {
      return res.status(404).json({ error: `Puzzle #${num} não encontrado.` });
    }

    if (puzzle.solved) {
      return res.status(400).json({
        error: `Puzzle #${num} já foi resolvido. Escolha um puzzle ativo (não resolvido).`,
        solved: true,
        privateKey: puzzle.privateKey
      });
    }

    // Retorna configuração pronta para uso no pool-client e colab worker
    const config = {
      success: true,
      target: {
        puzzleNumber: num,
        address: puzzle.address,
        publicKey: puzzle.publicKey,
        rangeStart: puzzle.rangeStart,
        rangeEnd: puzzle.rangeEnd,
        btcPrize: puzzle.btcPrize,
        bits: puzzle.bits,
        publicKeyExposed: puzzle.publicKeyExposed,
        difficulty: puzzle.difficulty
      },
      workerCommand: `node solver/pool-client.js --puzzle=${num} --apiUrl=${process.env.API_URL || 'http://localhost:3010'}`,
      colabCommand: `TARGET_PUZZLE=${num} TARGET_ADDRESS="${puzzle.address}" RANGE_START="${puzzle.rangeStartHex}" RANGE_END="${puzzle.rangeEndHex}"`,
      message: `🎯 Puzzle #${num} definido como alvo! Range: ${puzzle.rangeStart} → ${puzzle.rangeEnd} (${puzzle.bits} bits, prêmio: ${puzzle.btcPrize} BTC)`
    };

    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatTime(seconds) {
  if (typeof seconds === 'bigint') seconds = Number(seconds);
  if (seconds < 60) return `${seconds.toFixed(1)} segundos`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutos`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(2)} horas`;
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(2)} dias`;
  return `${(seconds / 31536000).toFixed(2)} anos`;
}

module.exports = router;
