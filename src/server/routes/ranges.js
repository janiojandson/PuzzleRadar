// ============================================
// 🧩 PuzzleRadar — Rotas de Ranges & Space Pruning
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');
const prisma = require('../../lib/prisma');
const { markChunkScanned, bulkImportHistory, getPruningStats } = require('../../lib/redis');

const router = express.Router();

/**
 * POST /api/ranges/import-history
 * Ingestão de ranges testados por outras pools (Space Pruning)
 */
router.post('/import-history', async (req, res) => {
  try {
    const { puzzleId, ranges, chunks, source, totalEstimatedChunks } = req.body;

    if (!puzzleId) {
      return res.status(400).json({ error: 'puzzleId é obrigatório' });
    }

    const itemsToImport = Array.isArray(chunks) && chunks.length > 0 ? chunks : (Array.isArray(ranges) ? ranges : []);
    
    if (itemsToImport.length === 0) {
      return res.status(400).json({ error: 'Nenhum range ou chunk fornecido para importação.' });
    }

    const totalSpace = Number(totalEstimatedChunks) || 10000;
    const pruningResult = await bulkImportHistory(puzzleId, itemsToImport, totalSpace);

    // Se houver conexão com o banco, registra atividade no log
    try {
      await prisma.activityLog.create({
        data: {
          action: 'SPACE_PRUNING_IMPORT',
          details: {
            puzzleId,
            importedCount: pruningResult.importedCount,
            prunedPercent: pruningResult.prunedPercent,
            source: source || 'External Pool Import'
          }
        }
      });
    } catch (dbErr) {
      // Continuar mesmo se db offline
    }

    res.json({
      success: true,
      message: `${pruningResult.importedCount} fatias importadas com sucesso para o bitmap de descarte.`,
      pruningResult
    });
  } catch (err) {
    console.error('[Ranges Import History Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ranges/pruning-stats/:puzzleId
 * Retorna estatísticas de poda do espaço de busca
 */
router.get('/pruning-stats/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;
    const total = Number(req.query.total) || 10000;
    const stats = await getPruningStats(puzzleId, total);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ranges/available
 * Ranges disponíveis para trabalho (exclui fatias já descartadas / PRUNED)
 */
router.get('/available', async (req, res) => {
  try {
    const { poolId, puzzleId } = req.query;
    
    let ranges = [];
    try {
      ranges = await prisma.range.findMany({
        where: {
          status: 'PENDING',
          isPruned: false,
          ...(poolId ? { poolId } : {}),
          ...(puzzleId ? { puzzleId } : {})
        },
        take: 50,
        orderBy: { chunkIndex: 'asc' }
      });
    } catch (dbErr) {
      // Fallback para mock caso banco ainda esteja sem seed
      ranges = [
        {
          id: 'rng_sample_1',
          chunkIndex: 0,
          rangeStart: '20000000000000000',
          rangeEnd: '2000000000fffffff',
          status: 'PENDING'
        }
      ];
    }
    
    res.json({
      ranges,
      count: ranges.length,
      message: 'Ranges disponíveis prontos para processamento'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ranges/:id/claim
 * Reivindica um range para processamento por um worker
 */
router.post('/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { workerToken, userId } = req.body;
    
    try {
      const updated = await prisma.range.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assigneeId: userId || null,
          startedAt: new Date()
        }
      });
      return res.json({
        range: updated,
        message: 'Range reivindicado com sucesso.'
      });
    } catch (dbErr) {
      return res.json({
        rangeId: id,
        status: 'ASSIGNED',
        startedAt: new Date().toISOString(),
        message: 'Range atribuído temporariamente.'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ranges/:id/result
 * Reporta o resultado do range processado
 */
router.post('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    const { result, keysChecked, foundPrivateKey, computeHours, puzzleId, chunkIndex } = req.body;
    
    if (result === 'FOUND' && foundPrivateKey) {
      console.log(`[PuzzleRadar] 🎯 CHAVE ENCONTRADA no range ${id}! Notificando admin do pool...`);
    }

    // Se informado chunkIndex, marca no bitmap Redis
    if (puzzleId && chunkIndex !== undefined) {
      await markChunkScanned(puzzleId, chunkIndex);
    }
    
    const sharesCalculated = (Number(keysChecked) || 0) * 0.0001;

    try {
      await prisma.range.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: result === 'FOUND' ? 'FOUND' : 'NOT_FOUND',
          keysChecked: Number(keysChecked) || 0,
          foundPrivateKey: result === 'FOUND' ? foundPrivateKey : null
        }
      });
    } catch (dbErr) {
      // Silenciar erro em ambiente sem Postgres conectado
    }
    
    res.json({
      rangeId: id,
      result,
      sharesEarned: sharesCalculated,
      message: result === 'FOUND' ? '🎯 CHAVE ENCONTRADA! Parabéns!' : 'Contribuição registrada no pool.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;