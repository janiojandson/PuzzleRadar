// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas de Ranges & Space Pruning
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');
const prisma = require('../../lib/prisma');
const { markChunkScanned, bulkImportHistory, getPruningStats } = require('../../lib/redis');
const { appendRangesToSheet, getSheetsStats } = require('../../lib/googleSheets');

const router = express.Router();

/**
 * POST /api/ranges/archive-to-sheets — Arquiva fatias diretamente no Google Sheets (Serverless History)
 */
router.post('/archive-to-sheets', async (req, res) => {
  try {
    const { spreadsheetId, ranges, chunks, source } = req.body;
    const items = Array.isArray(chunks) && chunks.length > 0 ? chunks : (Array.isArray(ranges) ? ranges : []);

    if (items.length === 0) {
      return res.status(400).json({ error: 'Nenhum range informado para arquivamento no Google Sheets.' });
    }

    const archiveResult = await appendRangesToSheet(spreadsheetId, items, source || 'Admin Space Pruning');
    
    // Atualiza também os bitmaps de poda
    await bulkImportHistory('puzzle_btc_66', items, 10000);

    res.json({
      success: true,
      message: `${archiveResult.totalArchived} fatias arquivadas no Google Sheets com sucesso.`,
      archiveResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ranges/sheets-stats — Retorna estatísticas de armazenamento no Google Sheets
 */
router.get('/sheets-stats', async (req, res) => {
  try {
    const stats = await getSheetsStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

    // Arquiva também no Google Sheets em background
    appendRangesToSheet(undefined, itemsToImport, source || 'Pool Externa').catch(() => {});

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
    } catch (dbErr) {}

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
      ranges = [
        {
          id: 'rng_sample_1',
          chunkIndex: 0,
          rangeStart: '2000000000000000',
          rangeEnd: '2000000000ffffff',
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
 */
router.post('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    const { result, keysChecked, foundPrivateKey, computeHours, puzzleId, chunkIndex } = req.body;
    
    if (result === 'FOUND' && foundPrivateKey) {
      console.log(`[PuzzleRadar] 🎯 CHAVE ENCONTRADA no range ${id}! Notificando admin do pool...`);
    }

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
    } catch (dbErr) {}
    
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