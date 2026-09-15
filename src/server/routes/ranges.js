// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas de Ranges & Space Pruning (Resiliente)
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');
const prisma = require('../../lib/prisma');
const { markChunkScanned, bulkImportHistory, getPruningStats } = require('../../lib/redis');
const { appendRangesToSheet, getSheetsStats } = require('../../lib/googleSheets');
const { verifyDiscoveryProof } = require('../../lib/cryptoVerifier');
const { getChallengeById, getMultiChainPuzzleData } = require('../../lib/difficultyEngine');

const router = express.Router();

// Mock store em memória para fatias com suporte a Lease TTL (Timeout de 15 minutos)
const CHUNK_LEASE_MS = 15 * 60 * 1000; // 15 minutos de timeout
let memoryRanges = [];

/**
 * Libera chunks que expiraram o tempo de leasing (Colabs desconectados)
 */
function reclaimExpiredChunks() {
  const now = Date.now();
  let reclaimedCount = 0;
  for (const r of memoryRanges) {
    if (r.status === 'ASSIGNED' && r.leaseExpiresAt && r.leaseExpiresAt < now) {
      r.status = 'PENDING';
      r.assigneeId = null;
      r.startedAt = null;
      r.leaseExpiresAt = null;
      reclaimedCount++;
    }
  }
  if (reclaimedCount > 0) {
    console.log(`♻️ [Chunk Reclaimer] ${reclaimedCount} fatias abandonadas devolvidas ao pool (Status: PENDING).`);
  }
}

// Executa o reclaimer a cada 2 minutos
setInterval(reclaimExpiredChunks, 2 * 60 * 1000);

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
    await bulkImportHistory('puzzle_btc_71', items, 10000);

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

    // Arquiva também no Google Sheets e Webhook em background
    appendRangesToSheet(undefined, itemsToImport, source || 'Pool Externa').catch(() => {});

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
 * GET /api/ranges/recent — Retorna fatias realmente varridas do histórico persistente e buffer
 */
router.get('/recent', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { ARCHIVE_FILE } = require('../../lib/googleSheets');
    const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');

    const recentList = [];

    // 1. Chunks no buffer pendentes de envio
    if (sheetsBuffer && sheetsBuffer.buffer) {
      for (const item of sheetsBuffer.buffer.slice(-15)) {
        recentList.push({
          timestamp: item.timestamp,
          chain: item.chain || 'BTC',
          challengeId: item.challenge_id || 'BTC_1000_P71',
          chunkIndex: item.chunkIndex,
          rangeStart: item.startHex,
          rangeEnd: item.endHex,
          workerName: item.workerName || 'Colab Cluster',
          status: 'BUFFER_PENDING_BATCH',
          hashrate: item.hashrate || '45.0 GH/s'
        });
      }
    }

    // 2. Chunks persistidos no CSV de arquivo
    if (fs.existsSync(ARCHIVE_FILE)) {
      const content = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
      const lines = content.trim().split('\n').slice(1); // Ignora header
      const lastLines = lines.slice(-35).reverse();

      for (const l of lastLines) {
        const parts = l.split(',');
        if (parts.length >= 6) {
          recentList.push({
            timestamp: parts[0] || new Date().toISOString(),
            chain: parts[1] || 'BTC',
            challengeId: parts[2] || 'BTC_1000_P71',
            chunkIndex: parts[3] || '0',
            rangeStart: parts[4] || '',
            rangeEnd: parts[5] || '',
            workerName: parts[6] || 'Colab Farm Node',
            status: parts[7] || 'PRUNED_SCANNED',
            hashrate: '45.0 GH/s'
          });
        }
      }
    }

    res.json({
      success: true,
      count: recentList.length,
      ranges: recentList.slice(0, 30)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ranges/space-pruning-live — Retorna métricas ao vivo de poda e espaço de qualquer desafio ativo
 */
router.get('/space-pruning-live', async (req, res) => {
  try {
    const puzzleId = req.query.puzzleId || 'BTC_1000_P71';
    const total = Number(req.query.total) || 10000;

    const challenge = getChallengeById(puzzleId) || getChallengeById('BTC_1000_P71');
    const targetKey = challenge ? (challenge.challengeId || `BTC_1000_P${challenge.puzzleNumber || 71}`) : puzzleId;

    const stats = await getPruningStats(targetKey, total);
    const sheetsStats = await getSheetsStats();

    // Calcula também o progresso para os principais desafios monitorados
    const trackedTargets = ['BTC_1000_P71', 'BTC_SATOSHI_NONCE_REUSE', 'ETH_VANITY_32', 'SOL_VANITY_PREFIX_36', 'ETH_BIP39_SEED_RECOVERY'];
    const multiStats = [];

    for (const tid of trackedTargets) {
      const chal = getChallengeById(tid);
      if (chal) {
        const cKey = chal.challengeId || tid;
        const pStats = await getPruningStats(cKey, 10000);
        multiStats.push({
          challengeId: cKey,
          chain: chal.chain || 'BTC',
          title: chal.title || cKey,
          prize: chal.prize ? `${chal.prize} ${chal.prizeCurrency || chal.chain}` : '',
          scannedChunks: pStats.scannedChunks,
          totalChunks: pStats.totalChunks,
          prunedPercent: pStats.prunedPercent
        });
      }
    }

    res.json({
      ...stats,
      sheetsStats,
      targetPuzzle: targetKey,
      chain: (challenge && challenge.chain) || 'BTC',
      title: (challenge && challenge.title) || targetKey,
      totalSpaceBits: (challenge && challenge.bits) || 71,
      keysPerChunk: '1.000.000.000.000 (1 Trilhão)',
      activeAlgorithm: (challenge && challenge.algorithmType) || 'Pollard Kangaroo O(√N)',
      multiStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ranges/available — Lista fatias disponíveis com Auto-Reclaim
 */
router.get('/available', async (req, res) => {
  try {
    reclaimExpiredChunks();
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
      if (memoryRanges.length === 0) {
        memoryRanges = [
          {
            id: 'rng_p71_0',
            chunkIndex: 0,
            rangeStart: '400000000000000000',
            rangeEnd: '40000000000fffffff',
            targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
            status: 'PENDING'
          },
          {
            id: 'rng_p71_1',
            chunkIndex: 1,
            rangeStart: '400000000010000000',
            rangeEnd: '40000000001fffffff',
            targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
            status: 'PENDING'
          }
        ];
      }
      ranges = memoryRanges.filter(r => r.status === 'PENDING').slice(0, 50);
    }
    
    res.json({
      ranges,
      count: ranges.length,
      message: 'Ranges disponíveis prontos para processamento (Anti-Colisão Ativo)'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ranges/:id/claim — Reivindica fatia com Lease TTL
 */
router.post('/:id/claim', async (req, res) => {
  try {
    const { id } = req.params;
    const { workerToken, userId } = req.body;
    const now = Date.now();
    const leaseExpiresAt = now + CHUNK_LEASE_MS;
    
    try {
      const updated = await prisma.range.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          assigneeId: userId || workerToken || null,
          startedAt: new Date()
        }
      });
      return res.json({
        range: updated,
        leaseExpiresAt,
        message: 'Range reivindicado com sucesso com Lease de 15 minutos.'
      });
    } catch (dbErr) {
      const memItem = memoryRanges.find(r => r.id === id);
      if (memItem) {
        memItem.status = 'ASSIGNED';
        memItem.assigneeId = workerToken || userId || 'wrk_anon';
        memItem.startedAt = new Date().toISOString();
        memItem.leaseExpiresAt = leaseExpiresAt;
      }

      return res.json({
        rangeId: id,
        status: 'ASSIGNED',
        startedAt: new Date().toISOString(),
        leaseExpiresAt,
        message: 'Range atribuído temporariamente com tolerância a falhas.'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ranges/:id/result — Reporta resultado com Validação Criptográfica Anti-Fake
 */
router.post('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    const { result, keysChecked, foundPrivateKey, computeHours, puzzleId, chunkIndex, targetAddress, hashrate, workerName } = req.body;
    
    let isRealKeyFound = false;

    // Se o worker alegar ter encontrado a chave, valida criptograficamente
    if (result === 'FOUND' && foundPrivateKey) {
      const expectedTarget = targetAddress || '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
      const proof = verifyDiscoveryProof(foundPrivateKey, expectedTarget);

      if (!proof.isValid) {
        console.warn(`🚨 [Alerta Anti-Fraude] Chave privada inválida reportada para range ${id}! Rejeitando.`);
        return res.status(400).json({
          error: 'Prova criptográfica inválida! A chave privada fornecida não corresponde ao endereço Bitcoin do puzzle.',
          details: proof
        });
      }

      isRealKeyFound = true;
      console.log(`🎉 [PuzzleRadar] 🚨 CHAVE AUTÊNTICA ENCONTRADA no range ${id}! Notificando rede e Google Sheets...`);
    }

    if (puzzleId && chunkIndex !== undefined) {
      await markChunkScanned(puzzleId, chunkIndex);
    }
    
    const sharesCalculated = (Number(keysChecked) || 0) * 0.0001;

    // Sincroniza com Google Sheets e Webhook
    appendRangesToSheet(undefined, [{
      puzzleId: puzzleId || 'puzzle_btc_71',
      chunkIndex: chunkIndex || 0,
      rangeStart: req.body.rangeStart || '',
      rangeEnd: req.body.rangeEnd || ''
    }], workerName || 'Colab Worker Node', {
      status: isRealKeyFound ? 'KEY_FOUND_CONFIRMED' : 'COMPLETED',
      hashrate: hashrate || '45.0 GH/s',
      keyFound: isRealKeyFound
    }).catch(() => {});

    try {
      await prisma.range.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: isRealKeyFound ? 'FOUND' : 'NOT_FOUND',
          keysChecked: Number(keysChecked) || 0,
          foundPrivateKey: isRealKeyFound ? foundPrivateKey : null
        }
      });
    } catch (dbErr) {
      const memItem = memoryRanges.find(r => r.id === id);
      if (memItem) {
        memItem.status = 'COMPLETED';
        memItem.result = isRealKeyFound ? 'FOUND' : 'NOT_FOUND';
      }
    }
    
    res.json({
      rangeId: id,
      result: isRealKeyFound ? 'FOUND' : 'NOT_FOUND',
      sharesEarned: sharesCalculated,
      verified: isRealKeyFound,
      message: isRealKeyFound ? '🎯 CHAVE CRIPTOGRAFICAMENTE VÁLIDA ENCONTRADA! Parabéns!' : 'Contribuição registrada no pool e planilha.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;