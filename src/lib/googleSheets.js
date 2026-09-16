// ============================================
// 🧩 PuzzleRadar v4.0 — Google Sheets Integration (Dashboard-Only Mode)
// ============================================
// CORREÇÃO CRÍTICA v4.0 — PROBLEMA DAS 800 EXECUÇÕES SIMULTÂNEAS:
//
//   ANTES (v3.0): worker heartbeat → appendRangesToSheet() → 1 chamada Apps Script por range
//   DEPOIS (v4.0): ranges são escritos no CSV local; webhook Apps Script chamado
//                  apenas EM BATCH ao final, com anti-flood de 1 chamada por 60s.
//
// FLUXO CORRETO:
//   Workers → Railway API (PostgreSQL) → Resposta imediata
//   Conclusão de lote → googleSheets.notifyBatch() → Apps Script (1 chamada por batch)
//   Dashboard periódico → Trigger 15min no Apps Script (independente dos workers)
//
// ANTI-FLOOD: No máximo 1 chamada ao Apps Script a cada 60 segundos.
//             Lotes intermediários são acumulados localmente.
// ============================================

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const DEFAULT_SPREADSHEET_ID        = process.env.GOOGLE_SPREADSHEET_ID || '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg';
const GOOGLE_APPS_SCRIPT_WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxx1VUWthDRiWJuLTFoD30dxK7-BeDDHhoqJ9hDWdCbjEurDf19-nttaQGvZIL4g0Q/exec';

// ─── ANTI-FLOOD: controle de chamadas ao Apps Script ─────────────────────────
const WEBHOOK_MIN_INTERVAL_MS = 60_000; // no máximo 1 chamada por 60 segundos
const BATCH_FLUSH_SIZE        = 100;    // flush quando acumular 100+ ranges
let   _lastWebhookCallMs      = 0;
let   _pendingBatchRows       = [];     // buffer de rows aguardando envio
let   _flushTimer             = null;

// Arquivo de persistência local para fallback
const ARCHIVE_DIR  = path.join(__dirname, '../../persistent_data');
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, 'google_sheets_archive.csv');

if (!fs.existsSync(ARCHIVE_DIR)) {
  try { fs.mkdirSync(ARCHIVE_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(ARCHIVE_FILE)) {
  try { fs.writeFileSync(ARCHIVE_FILE, 'timestamp,chain,challengeId,chunkIndex,rangeStart,rangeEnd,source,status\n', 'utf-8'); } catch (e) {}
}

// ─── POSTAGEM HTTP COM TRATAMENTO DE REDIRECT 302 ─────────────────────────────
function postToGoogleWebhook(url, payload) {
  return new Promise((resolve) => {
    try {
      const dataString = JSON.stringify(payload);
      const urlObj     = new URL(url);
      const secret     = process.env.SHEETS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production';

      const options = {
        hostname: urlObj.hostname,
        port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path:     urlObj.pathname + urlObj.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(dataString),
          'x-webhook-token': secret,
        },
        timeout: 30_000,
      };

      const lib = urlObj.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Trata redirect 302 padrão do Apps Script com GET
          const redirLib = res.headers.location.startsWith('https') ? https : http;
          redirLib.get(res.headers.location, (r2) => {
            let body = '';
            r2.on('data', c => body += c);
            r2.on('end', () => {
              try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
            });
          }).on('error', e => resolve({ error: e.message }));
        } else {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
          });
        }
      });

      req.on('error', e => { console.warn('[GoogleSheets Webhook]', e.message); resolve({ error: e.message }); });
      req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
      req.write(dataString);
      req.end();
    } catch (err) {
      console.warn('[GoogleSheets Webhook Error]:', err.message);
      resolve({ error: err.message });
    }
  });
}

// ─── FLUSH DO BATCH (1 chamada ao Apps Script por batch acumulado) ────────────
async function _flushBatch(force = false) {
  if (_pendingBatchRows.length === 0) return;

  const now          = Date.now();
  const timeSinceLast = now - _lastWebhookCallMs;

  // Anti-flood: respeitar intervalo mínimo (exceto se forçado por keyFound)
  if (!force && timeSinceLast < WEBHOOK_MIN_INTERVAL_MS) {
    // Agendar próximo flush para quando o intervalo expirar
    if (!_flushTimer) {
      const delay = WEBHOOK_MIN_INTERVAL_MS - timeSinceLast + 100;
      _flushTimer = setTimeout(() => { _flushTimer = null; _flushBatch(); }, delay);
    }
    return;
  }

  const rowsToSend    = _pendingBatchRows.splice(0, _pendingBatchRows.length);
  _lastWebhookCallMs  = now;

  console.log(`[GoogleSheets v4.0] Enviando batch de ${rowsToSend.length} ranges ao Apps Script (1 chamada)`);

  if (GOOGLE_APPS_SCRIPT_WEBHOOK_URL) {
    await postToGoogleWebhook(GOOGLE_APPS_SCRIPT_WEBHOOK_URL, {
      secretToken: process.env.SHEETS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production',
      action:      'batch_ranges',
      rows:        rowsToSend,
      batchSize:   rowsToSend.length,
      timestamp:   new Date().toISOString(),
    }).then(res => {
      if (res && res.status === 'success') {
        console.log(`[GoogleSheets v4.0] ✅ Batch de ${rowsToSend.length} ranges sincronizados.`);
      }
    }).catch(() => {});
  }
}

// ─── API PÚBLICA: appendRangesToSheet ────────────────────────────────────────
// MUDANÇA v4.0: Não mais uma chamada por range — acumula no buffer e envia em batch.
async function appendRangesToSheet(spreadsheetId = DEFAULT_SPREADSHEET_ID, ranges = [], source = 'Google Colab Farm', extraMeta = {}) {
  const timestamp = new Date().toISOString();
  const csvLines  = [];

  for (const item of ranges) {
    const chunkIndex  = typeof item === 'object' ? (item.chunkIndex || item.chunkId || item.index || 0) : parseInt(item, 10) || 0;
    const rangeStart  = typeof item === 'object' ? (item.rangeStart || item.startHex || '') : '';
    const rangeEnd    = typeof item === 'object' ? (item.rangeEnd   || item.endHex   || '') : '';
    const challengeId = typeof item === 'object' ? (item.challengeId || item.puzzleId || 'puzzle_btc_71') : 'puzzle_btc_71';
    const chain       = typeof item === 'object'
      ? (item.chain || (challengeId.toLowerCase().includes('eth') ? 'ETH' : challengeId.toLowerCase().includes('sol') ? 'SOL' : 'BTC'))
      : 'BTC';

    const row = [timestamp, chain, challengeId, chunkIndex, rangeStart, rangeEnd, source, 'PRUNED_SCANNED'];
    csvLines.push(row.join(','));

    // Acumular no buffer — NÃO chamar webhook aqui (causa das 800 execuções)
    _pendingBatchRows.push({
      chain, challengeId, puzzleId: challengeId,
      chunkId: chunkIndex, startHex: rangeStart, endHex: rangeEnd,
      workerName: source, status: extraMeta.status || 'COMPLETED',
      hashrate: extraMeta.hashrate || '45.0 GH/s', keyFound: extraMeta.keyFound || false,
    });
  }

  // Gravar no CSV local (sempre — sem limite de frequência)
  if (csvLines.length > 0) {
    try {
      fs.appendFileSync(ARCHIVE_FILE, csvLines.join('\n') + '\n', 'utf-8');
    } catch (err) {
      console.warn('[GoogleSheets] Aviso CSV:', err.message);
    }
  }

  // Flush somente quando acumular muitos rows (anti-flood)
  if (_pendingBatchRows.length >= BATCH_FLUSH_SIZE) {
    await _flushBatch();
  } else if (!_flushTimer) {
    // Agendar flush para 60s se não houver timer ativo
    _flushTimer = setTimeout(() => { _flushTimer = null; _flushBatch(); }, WEBHOOK_MIN_INTERVAL_MS);
  }

  return {
    success:          true,
    totalArchived:    csvLines.length,
    spreadsheetId,
    webhookMode:      'batch_anti_flood',  // v4.0: não é mais síncrono por range
    pendingInBuffer:  _pendingBatchRows.length,
    localArchiveFile: ARCHIVE_FILE,
    timestamp,
  };
}

// ─── NOTIFICAÇÃO ESPECIAL: Chave Encontrada (flush imediato) ──────────────────
// Quando uma chave é encontrada, notificar IMEDIATAMENTE sem aguardar o batch.
async function notifyKeyFound(puzzleData) {
  console.log('[GoogleSheets] 🚨 NOTIFICANDO Apps Script: Chave Encontrada!');
  if (!GOOGLE_APPS_SCRIPT_WEBHOOK_URL) return;

  // Forçar flush do buffer pendente também
  await _flushBatch(true);

  return postToGoogleWebhook(GOOGLE_APPS_SCRIPT_WEBHOOK_URL, {
    secretToken: process.env.SHEETS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production',
    action:      'key_found_alert',
    keyFound:    true,
    ...puzzleData,
    timestamp:   new Date().toISOString(),
  });
}

// ─── STATS ────────────────────────────────────────────────────────────────────
async function getSheetsStats() {
  let lineCount = 0;
  try {
    if (fs.existsSync(ARCHIVE_FILE)) {
      const content = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
      lineCount     = Math.max(0, content.trim().split('\n').length - 1);
    }
  } catch (e) {}

  const nowMs         = Date.now();
  const nextFlushMs   = _lastWebhookCallMs + WEBHOOK_MIN_INTERVAL_MS - nowMs;

  return {
    totalArchivedRanges: lineCount,
    storageType:         'Dashboard-Only (v4.0) — Workers usam PostgreSQL, nao Sheets',
    spreadsheetId:       DEFAULT_SPREADSHEET_ID,
    webhookConfigured:   Boolean(GOOGLE_APPS_SCRIPT_WEBHOOK_URL),
    pendingInBuffer:     _pendingBatchRows.length,
    antiFloodMode:       `Max 1 chamada a cada ${WEBHOOK_MIN_INTERVAL_MS / 1000}s`,
    nextFlushInMs:       Math.max(0, nextFlushMs),
  };
}

module.exports = {
  appendRangesToSheet,
  getSheetsStats,
  notifyKeyFound,
  postToGoogleWebhook,
  ARCHIVE_FILE,
};
