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
const GOOGLE_APPS_SCRIPT_WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyxObip-jQvbdpv1vqoaKAEI2turdjaJI-cBJ8MwID164VzXD8uoXhVfTXEXRTy0khC/exec';
const SHEETS_WEBHOOK_SECRET          = process.env.SHEETS_WEBHOOK_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production';

// ─── ANTI-FLOOD & QUOTA SHIELD: Single-Flight Lock ───────────────────────────
// Garante MÁXIMO de 1 execução simultânea no Apps Script em qualquer momento.
// Todos os dados de N workers são agrupados em lotes atômicos na memória.
const WEBHOOK_MIN_INTERVAL_MS = 10_000; // Flush agrupado a cada 10 segundos
const BATCH_FLUSH_SIZE        = 10;     // Despacha quando atingir 10 fatias
let   _lastWebhookCallMs      = 0;
let   _pendingBatchRows       = [];     // Buffer seguro em memória
let   _flushTimer             = null;
let   _isFlushing             = false;  // Lock estrito: impede concorrência simultânea

// Arquivo de persistência local para fallback
const ARCHIVE_DIR  = path.join(__dirname, '../../persistent_data');
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, 'google_sheets_archive.csv');

if (!fs.existsSync(ARCHIVE_DIR)) {
  try { fs.mkdirSync(ARCHIVE_DIR, { recursive: true }); } catch (e) {}
}
if (!fs.existsSync(ARCHIVE_FILE)) {
  try { fs.writeFileSync(ARCHIVE_FILE, 'timestamp,chain,challengeId,chunkIndex,rangeStart,rangeEnd,workerName,status,hashrate,discovery\n', 'utf-8'); } catch (e) {}
}

// ─── POSTAGEM HTTP COM TRATAMENTO DE REDIRECT 302 ─────────────────────────────
function postToGoogleWebhook(url, payload) {
  return new Promise((resolve) => {
    try {
      const dataString = JSON.stringify(payload);
      const urlObj     = new URL(url);
      const secret     = payload.secretToken || SHEETS_WEBHOOK_SECRET;

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

// ─── FLUSH DO BATCH COM SINGLE-FLIGHT LOCK ──────────────────────────────────
async function _flushBatch(force = false) {
  if (_pendingBatchRows.length === 0) return;
  if (_isFlushing) return; // BLOQUEIO: Já existe 1 requisição em andamento no Google

  const now           = Date.now();
  const timeSinceLast = now - _lastWebhookCallMs;

  // Anti-flood: respeitar intervalo mínimo (exceto se forçado por keyFound)
  if (!force && timeSinceLast < WEBHOOK_MIN_INTERVAL_MS) {
    if (!_flushTimer) {
      const delay = Math.max(500, WEBHOOK_MIN_INTERVAL_MS - timeSinceLast);
      _flushTimer = setTimeout(() => { _flushTimer = null; _flushBatch(); }, delay);
    }
    return;
  }

  _isFlushing = true;
  if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }

  const rowsToSend    = _pendingBatchRows.splice(0, _pendingBatchRows.length);
  _lastWebhookCallMs  = Date.now();

  console.log(`[GoogleSheets v4.0] 🚀 Despachando lote atômico de ${rowsToSend.length} ranges para a Planilha...`);

  if (GOOGLE_APPS_SCRIPT_WEBHOOK_URL) {
    try {
      const res = await postToGoogleWebhook(GOOGLE_APPS_SCRIPT_WEBHOOK_URL, {
        secretToken: SHEETS_WEBHOOK_SECRET,
        action:      'batch_ranges',
        sheetName:   'Ranges_Varredura',
        targetSheet: 'Ranges_Varredura',
        rows:        rowsToSend,
        batchSize:   rowsToSend.length,
        timestamp:   new Date().toISOString(),
      });
      if (res && res.status === 'success') {
        console.log(`[GoogleSheets v4.0] ✅ Lote de ${rowsToSend.length} ranges gravado com sucesso no Google Sheets.`);
      } else {
        console.warn(`[GoogleSheets v4.0] ⚠️ Resposta do Apps Script:`, JSON.stringify(res));
      }
    } catch (e) {
      console.error('[GoogleSheets v4.0] ❌ Erro no envio:', e.message);
    } finally {
      _isFlushing = false;
      // Se novas linhas acumularam durante o envio, agenda próximo flush
      if (_pendingBatchRows.length > 0 && !_flushTimer) {
        _flushTimer = setTimeout(() => { _flushTimer = null; _flushBatch(); }, WEBHOOK_MIN_INTERVAL_MS);
      }
    }
  } else {
    _isFlushing = false;
  }
}

// ─── API PÚBLICA: appendRangesToSheet ────────────────────────────────────────
// MUDANÇA v4.0: Não mais uma chamada por range — acumula no buffer e envia em batch.
async function appendRangesToSheet(spreadsheetId = DEFAULT_SPREADSHEET_ID, ranges = [], source = 'Google Colab Farm', extraMeta = {}) {
  const timestamp = new Date().toISOString();
  const csvLines  = [];

  for (const item of ranges) {
    let chunkIndex  = typeof item === 'object' ? (item.chunkIndex || item.chunkId || item.index || 0) : parseInt(item, 10) || 0;
    const rangeStart  = typeof item === 'object' ? (item.rangeStart || item.startHex || '') : '';
    const rangeEnd    = typeof item === 'object' ? (item.rangeEnd   || item.endHex   || '') : '';
    const challengeId = typeof item === 'object' ? (item.challengeId || item.puzzleId || 'Puzzle 71') : 'Puzzle 71';
    const chain       = typeof item === 'object'
      ? (item.chain || (String(challengeId).toLowerCase().includes('eth') ? 'ETH' : String(challengeId).toLowerCase().includes('sol') ? 'SOL' : 'BTC'))
      : 'BTC';
    let workerName  = source || (typeof item === 'object' ? (item.workerName || item.worker) : 'Anonimo') || 'Anonimo';
    const status      = extraMeta.status || (typeof item === 'object' ? item.status : 'COMPLETED') || 'COMPLETED';
    const hashrate    = extraMeta.hashrate || (typeof item === 'object' ? item.hashrate : '0 GH/s') || '0 GH/s';
    const discovery   = extraMeta.keyFound ? '🚨 CHAVE ENCONTRADA!' : 'NENHUMA';

    // Calcula ordinal numérico real do Chunk # a partir do rangeStart
    try {
      if (rangeStart) {
        const cleanStart = String(rangeStart).replace(/^0x/i, '');
        const BASE_START = 0x400000000000000000n;
        const STEP_CPU = 1n << 24n; // 16,777,216 chaves por micro-lote
        const startBig = BigInt('0x' + cleanStart);
        if (startBig >= BASE_START) {
          chunkIndex = Number((startBig - BASE_START) / STEP_CPU) + 1;
        }
      }
    } catch (_) {}

    const row = [timestamp, chain, challengeId, chunkIndex, rangeStart, rangeEnd, workerName, status, hashrate, discovery];
    csvLines.push(row.join(','));

    // Acumular no buffer com schema estrito de 10 colunas
    _pendingBatchRows.push({
      timestamp,
      chain,
      challengeId,
      challenge_id: challengeId,
      puzzleId: challengeId,
      chunkId: chunkIndex,
      chunkIndex,
      startHex: rangeStart,
      endHex: rangeEnd,
      workerName,
      status,
      scanStatus: status,
      hashrate,
      hashrateStr: hashrate,
      discoveryStatus: discovery,
      keyFound: Boolean(extraMeta.keyFound),
    });
  }

  // Gravar no CSV local de forma assíncrona (não-bloqueante)
  if (csvLines.length > 0) {
    fs.promises.appendFile(ARCHIVE_FILE, csvLines.join('\n') + '\n', 'utf-8')
      .catch(err => console.warn('[GoogleSheets CSV Fallback]', err.message));
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
