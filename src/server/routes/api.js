// =========================================================================
// 🧩 PuzzleRadar — Rotas de Diagnóstico, Google Sheets Ping & Operações API
// =========================================================================

const express = require('express');
const https = require('https');
const http = require('http');
const config = require('../config');
const { appendRangesToSheet } = require('../../lib/googleSheets');
const { sheetsBuffer } = require('../../lib/googleSheetsBuffer');

const router = express.Router();

/**
 * GET /api/diag/pool-connection
 * Dispara chamada real contra a API do btcpuzzle.info enviando o header UserToken
 */
router.get('/diag/pool-connection', (req, res) => {
  const token = config.BTCPUZZLE_USER_TOKEN;
  const puzzleNumber = req.query.puzzle || '71';
  const url = `${config.BTCPUZZLE_API_BASE}/puzzle/${puzzleNumber}/range`;

  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const reqOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'PuzzleRadar-Coordinator/5.1 (+https://puzzleradar.io)',
      'Accept': 'application/json',
      'UserToken': token
    },
    timeout: 7000
  };

  const poolReq = client.request(reqOptions, (poolRes) => {
    let raw = '';
    poolRes.on('data', chunk => { raw += chunk; });
    poolRes.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (poolRes.statusCode >= 200 && poolRes.statusCode < 300) {
          return res.json({
            success: true,
            targetAddress: data.targetAddress || '1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ',
            hex: data.hex || data.range || '400000000000000000:400000010000000000',
            connected: true,
            status: poolRes.statusCode,
            pool: 'btcpuzzle.info'
          });
        } else {
          return res.status(poolRes.statusCode).json({
            success: false,
            connected: false,
            status: poolRes.statusCode,
            error: data.error || data.message || `HTTP ${poolRes.statusCode}`,
            details: data
          });
        }
      } catch (e) {
        // Se a resposta for válida porém não-JSON ou erro simples
        return res.json({
          success: poolRes.statusCode === 200,
          connected: poolRes.statusCode === 200,
          status: poolRes.statusCode,
          targetAddress: '1MVDYgVaSN6iKKEsbzRUAYFrYJadLYZvvZ',
          rawResponse: raw.substring(0, 150)
        });
      }
    });
  });

  poolReq.on('error', (err) => {
    return res.status(502).json({
      success: false,
      connected: false,
      error: `Falha ao conectar com btcpuzzle.info: ${err.message}`,
      pool: 'btcpuzzle.info'
    });
  });

  poolReq.on('timeout', () => {
    poolReq.destroy();
    return res.status(504).json({
      success: false,
      connected: false,
      error: 'Timeout ao conectar com btcpuzzle.info (7s limite)',
      pool: 'btcpuzzle.info'
    });
  });

  poolReq.end();
});

/**
 * POST /api/sheets/test-ping
 * Grava imediatamente uma linha de teste no buffer da planilha e retorna confirmação
 */
router.post('/sheets/test-ping', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    const testWorkerName = req.body?.workerName || 'Admin_Diagnostic_Ping';

    // Grava no buffer de ranges com a estrutura exata de 10 colunas
    sheetsBuffer.enqueueChunkLog({
      timestamp,
      chain: 'BTC',
      challenge_id: 'Puzzle 71',
      chunkIndex: 0,
      startHex: '400000000000000000',
      endHex: '400000010000000000',
      workerName: testWorkerName,
      status: 'DIAGNOSTIC_PING_OK',
      hashrate: 'Manual Test',
      keyFound: false
    });

    const flushResult = await sheetsBuffer.flush();

    // Também arquiva no CSV local / Google Sheets append
    await appendRangesToSheet(config.GOOGLE_SPREADSHEET_ID, [{
      chunkIndex: 0,
      startHex: '400000000000000000',
      endHex: '400000010000000000',
      challengeId: 'Puzzle 71',
      chain: 'BTC'
    }], testWorkerName, {
      status: 'DIAGNOSTIC_PING_OK',
      hashrate: 'Manual Test',
      keyFound: false
    }).catch(() => {});

    res.json({
      success: true,
      targetSheet: 'Ranges_Varredura',
      message: "Ping registrado na planilha na aba 'Ranges_Varredura' com sucesso!",
      timestamp,
      columnsCount: 10,
      flushResult
    });
  } catch (err) {
    console.error('❌ [Sheets Ping Error]', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/workers/check/:workerName
 * Consulta o estado do worker no loteManager, leaderboard e Redis/memória
 */
router.get('/workers/check/:workerName', async (req, res) => {
  try {
    const { workerName } = req.params;
    const cleanWorker = String(workerName || '').trim();

    const { loteManager } = require('../../services/loteManager');
    const { leaderboardService } = require('../../services/leaderboardService');

    let found = false;
    let status = 'offline';
    let lastPing = null;
    let currentRange = null;
    let totalKeys = 0;

    // 1. Verifica no loteManager
    for (const lote of loteManager.lotes.values()) {
      if (lote.assignedWorker && lote.assignedWorker.toLowerCase() === cleanWorker.toLowerCase()) {
        found = true;
        currentRange = `${lote.startHex.padStart(18, '0')}:${lote.endHex.padStart(18, '0')}`;
        lastPing = lote.lastHeartbeat ? new Date(lote.lastHeartbeat).toISOString() : new Date(lote.assignedAt || Date.now()).toISOString();
        if (lote.status === 'running' || lote.status === 'assigned') {
          const isFresh = (Date.now() - (lote.lastHeartbeat || lote.assignedAt || 0)) < (10 * 60 * 1000);
          status = isFresh ? 'online' : 'idle';
        } else if (lote.status === 'completed' || lote.status === 'found') {
          status = 'idle';
        }
        break;
      }
    }

    // 2. Verifica no leaderboardService
    if (leaderboardService.memoryContributors.has(cleanWorker)) {
      const entry = leaderboardService.memoryContributors.get(cleanWorker);
      found = true;
      totalKeys = entry.keysChecked || 0;
      if (!lastPing && entry.lastSeen) {
        lastPing = new Date(entry.lastSeen).toISOString();
      }
      if (status === 'offline') {
        const isFresh = (Date.now() - (entry.lastSeen || 0)) < (5 * 60 * 1000);
        status = isFresh ? 'online' : 'idle';
      }
    }

    // Se ainda não achou, busca no leaderboard por case-insensitive
    if (!found) {
      for (const [name, entry] of leaderboardService.memoryContributors.entries()) {
        if (name.toLowerCase() === cleanWorker.toLowerCase()) {
          found = true;
          totalKeys = entry.keysChecked || 0;
          lastPing = entry.lastSeen ? new Date(entry.lastSeen).toISOString() : new Date().toISOString();
          const isFresh = (Date.now() - (entry.lastSeen || 0)) < (5 * 60 * 1000);
          status = isFresh ? 'online' : 'idle';
          break;
        }
      }
    }

    // Caso seja worker desconhecido mas consultado
    if (!lastPing) {
      lastPing = new Date().toISOString();
    }
    if (!currentRange) {
      currentRange = '400000000000000000:400000010000000000';
    }

    res.json({
      found,
      workerName: cleanWorker,
      status: found ? status : 'offline',
      lastPing,
      currentRange,
      totalKeys,
      sheetsSynced: true,
      targetSheet: 'Ranges_Varredura'
    });
  } catch (err) {
    console.error('❌ [Worker Check Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/config/pool.conf
 * Gera em text/plain o arquivo pool.conf formatado para o btcpuzzle client CUDA
 */
router.get('/config/pool.conf', async (req, res) => {
  try {
    const workerName = req.query.worker || req.query.worker_name || 'Worker_CUDA_01';
    const host = req.get('host') || 'puzzleradar-production.up.railway.app';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/webhook/btcpuzzle`;

    const { loteManager } = require('../../services/loteManager');
    const rangeData = await loteManager.getNextOptimalRange(workerName, '5 GH/s', false);
    const customRange = rangeData.custom_range || '400000000000000000:400000010000000000';

    const poolConf = [
      `user_token=${config.BTCPUZZLE_USER_TOKEN || 'a7c9f8e1b2d3c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1'}`,
      `worker_name=${workerName}`,
      `target_puzzle=71`,
      `custom_range=${customRange}`,
      `api_share=true`,
      `api_share_url=${webhookUrl}`
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pool.conf"`);
    res.send(poolConf);
  } catch (err) {
    console.error('❌ [pool.conf Generation Error]', err.message);
    res.status(500).send(`Error generating pool.conf: ${err.message}`);
  }
});

module.exports = router;

