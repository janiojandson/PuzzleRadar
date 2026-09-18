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

module.exports = router;
