// ==============================================================================
// 🧩 PuzzleRadar v4.0 — Rotas do Kangaroo (Pollard's Kangaroo Pool)
// ==============================================================================
// Endpoints para workers Kangaroo (GPU, CPU, mobile):
//   POST /api/kangaroo/submit-dp     — Submeter Distinguished Point
//   GET  /api/kangaroo/seed/:id/:type — Obter starting point
//   GET  /api/kangaroo/stats/:id      — Estatísticas do pool
//   POST /api/kangaroo/cleanup        — Limpar DPs órfãos (admin)
// ==============================================================================

const express = require('express');
const router  = express.Router();

const kangarooManager = require('../../lib/kangarooManager');
const prisma          = require('../../lib/prisma');

// ─── POST /api/kangaroo/submit-dp ────────────────────────────────────────────
// Worker submete um Distinguished Point.
// Mobile: walks curtas (1.000 passos) também são válidas.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/submit-dp', async (req, res) => {
  try {
    const {
      puzzle_id,
      worker_id,
      point_x,
      point_y,
      walk_type,
      start_key,
      step_distance_hex,
      steps_taken,
      walk_seed,
    } = req.body;

    if (!puzzle_id || !worker_id || !point_x || !walk_type || !start_key || !step_distance_hex) {
      return res.status(400).json({
        error:   'missing_fields',
        message: 'puzzle_id, worker_id, point_x, walk_type, start_key e step_distance_hex são obrigatórios',
      });
    }

    // Atualizar last_seen do worker (tolerante — pode não existir)
    await prisma.workerToken.updateMany({
      where: { token: worker_id },
      data:  { lastSeenAt: new Date() },
    }).catch(() => {});

    const result = await kangarooManager.submitDP(puzzle_id, worker_id, {
      pointX:          point_x,
      pointY:          point_y || '',
      walkType:        walk_type,
      startKey:        start_key,
      stepDistanceHex: step_distance_hex,
      stepsTaken:      steps_taken || 0,
      walkSeed:        walk_seed,
    });

    if (result.status === 'found') {
      // Broadcast via console (em produção: notificar via Telegram/Webhook)
      console.log('🎉🎉🎉 [KANGAROO] PUZZLE RESOLVIDO VIA COLISÃO!', result);
    }

    res.json(result);
  } catch (err) {
    console.error('[/kangaroo/submit-dp]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/kangaroo/seed/:puzzle_id/:walk_type ────────────────────────────
// Fornece starting point para worker.
// walk_type: 'tame' ou 'wild'
// worker_index (query): 0-9 para seeds específicos (balanceamento de frota)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/seed/:puzzle_id/:walk_type', async (req, res) => {
  try {
    const { puzzle_id, walk_type } = req.params;
    const workerIndex = req.query.index !== undefined ? parseInt(req.query.index) : null;

    if (!['tame', 'wild'].includes(walk_type)) {
      return res.status(400).json({ error: 'walk_type deve ser "tame" ou "wild"' });
    }

    const seed = await kangarooManager.getSeed(puzzle_id, walk_type, workerIndex);

    if (seed.error) {
      return res.status(404).json(seed);
    }

    res.json(seed);
  } catch (err) {
    console.error('[/kangaroo/seed]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/kangaroo/stats/:puzzle_id ──────────────────────────────────────
// Estatísticas do pool para dashboard / Google Sheets
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats/:puzzle_id', async (req, res) => {
  try {
    const stats = await kangarooManager.getPoolStats(req.params.puzzle_id);
    res.json(stats);
  } catch (err) {
    console.error('[/kangaroo/stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/kangaroo/stats-all ─────────────────────────────────────────────
// Stats de todos os puzzles ativos
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats-all', async (req, res) => {
  try {
    const puzzles = await prisma.puzzle.findMany({
      where:  { status: { in: ['ACTIVE', 'IN_PROGRESS'] } },
      select: { id: true, puzzleNumber: true, prizeAmount: true, bitRange: true },
      take:   20,
    });

    const stats = await Promise.all(
      puzzles.map(p => kangarooManager.getPoolStats(p.id).then(s => ({ ...s, ...p })))
    );

    res.json({ puzzles: stats, total: stats.length });
  } catch (err) {
    console.error('[/kangaroo/stats-all]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/kangaroo/cleanup ──────────────────────────────────────────────
// Limpar DPs órfãos (requer x-nexus-key)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cleanup', async (req, res) => {
  const nexusKey = req.headers['x-nexus-key'] || req.body.nexus_key;
  if (nexusKey !== process.env.NEXUS_SECRET && nexusKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Chave de admin inválida' });
  }

  try {
    const result = await kangarooManager.cleanupOrphanDPs();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/kangaroo/verify-collision ──────────────────────────────────────
// Verificar manualmente se dois DPs colidem (debug)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify-collision', async (req, res) => {
  try {
    const { tame_dp_id, wild_dp_id, puzzle_id } = req.body;

    const [tameDP, wildDP] = await Promise.all([
      prisma.distinguishedPoint.findUnique({ where: { id: tame_dp_id } }),
      prisma.distinguishedPoint.findUnique({ where: { id: wild_dp_id } }),
    ]);

    if (!tameDP || !wildDP) {
      return res.status(404).json({ error: 'DPs não encontrados' });
    }

    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzle_id } });
    if (!puzzle) return res.status(404).json({ error: 'Puzzle não encontrado' });

    const { resolveCollisionPrivateKey } = require('../../lib/kangarooTable');
    const result = resolveCollisionPrivateKey(
      tameDP,
      wildDP,
      (puzzle.rangeStart || '').replace(/^'/,''),
      puzzle.targetAddress || puzzle.targetPublicKey
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
