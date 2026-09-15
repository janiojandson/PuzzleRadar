// ============================================
// 🧩 PuzzleRadar v3.0 — Google Sheets & Webhook Integration (Live 200 OK)
// ============================================
// Armazenamento Serverless de Histórico Massivo de Ranges (Space Pruning)
// Descarrega bilhões de ranges no Google Sheets via Webhook e CSV local sem inchar PostgreSQL / Redis.
// ============================================

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg';
const GOOGLE_APPS_SCRIPT_WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxx1VUWthDRiWJuLTFoD30dxK7-BeDDHhoqJ9hDWdCbjEurDf19-nttaQGvZIL4g0Q/exec';

// Arquivo de persistência local para fallback
const ARCHIVE_DIR = path.join(__dirname, '../../persistent_data');
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, 'google_sheets_archive.csv');

if (!fs.existsSync(ARCHIVE_DIR)) {
  try {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  } catch (e) {}
}

if (!fs.existsSync(ARCHIVE_FILE)) {
  try {
    fs.writeFileSync(ARCHIVE_FILE, 'timestamp,puzzleId,chunkIndex,rangeStart,rangeEnd,source,status\n', 'utf-8');
  } catch (e) {}
}

/**
 * Envia uma requisição HTTP POST para o webhook do Google Apps Script tratando redirecionamentos 302 com GET
 */
function postToGoogleWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    try {
      const dataString = JSON.stringify(payload);
      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString)
        }
      };

      const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
        // Trata redirecionamento 302 padrão do Google Apps Script com GET
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location;
          const redirectClient = redirectUrl.startsWith('https') ? https : http;

          redirectClient.get(redirectUrl, (redirRes) => {
            let body = '';
            redirRes.on('data', chunk => body += chunk);
            redirRes.on('end', () => {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                resolve({ raw: body, statusCode: redirRes.statusCode });
              }
            });
          }).on('error', (err) => {
            console.warn('⚠️ [GoogleAppsScript Webhook Redirect Error]:', err.message);
            resolve({ error: err.message });
          });
        } else {
          let responseBody = '';
          res.on('data', chunk => responseBody += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(responseBody));
            } catch (e) {
              resolve({ raw: responseBody, statusCode: res.statusCode });
            }
          });
        }
      });

      req.on('error', (err) => {
        console.warn('⚠️ [GoogleAppsScript Webhook Network Error]:', err.message);
        resolve({ error: err.message });
      });

      req.write(dataString);
      req.end();
    } catch (err) {
      console.warn('⚠️ [GoogleAppsScript Webhook Error]:', err.message);
      resolve({ error: err.message });
    }
  });
}

/**
 * Anexa fatias/ranges varridos diretamente à planilha no Google Sheets via Webhook e CSV local
 */
async function appendRangesToSheet(spreadsheetId = DEFAULT_SPREADSHEET_ID, ranges = [], source = 'Google Colab Farm', extraMeta = {}) {
  const timestamp = new Date().toISOString();
  const formattedRows = [];

  for (const item of ranges) {
    const chunkIndex = typeof item === 'object' ? item.chunkIndex || item.chunkId || item.index || 0 : parseInt(item, 10) || 0;
    const rangeStart = typeof item === 'object' ? item.rangeStart || item.startHex || '' : '';
    const rangeEnd = typeof item === 'object' ? item.rangeEnd || item.endHex || '' : '';
    const puzzleId = typeof item === 'object' ? item.puzzleId || 'puzzle_btc_71' : 'puzzle_btc_71';

    formattedRows.push([timestamp, puzzleId, chunkIndex, rangeStart, rangeEnd, source, 'PRUNED_SCANNED']);

    // Dispara para o Webhook do Google Apps Script
    if (GOOGLE_APPS_SCRIPT_WEBHOOK_URL) {
      postToGoogleWebhook(GOOGLE_APPS_SCRIPT_WEBHOOK_URL, {
        puzzleId,
        chunkId: chunkIndex,
        startHex: rangeStart,
        endHex: rangeEnd,
        workerName: source,
        status: extraMeta.status || 'COMPLETED',
        hashrate: extraMeta.hashrate || '45.0 GH/s',
        keyFound: extraMeta.keyFound || false
      }).then(res => {
        if (res && res.status === 'success') {
          console.log(`📡 [GoogleSheets Sync] ✅ Fatia #${chunkIndex} gravada na Planilha!`);
        }
      }).catch(() => {});
    }
  }

  // Grava no arquivo CSV local de persistência
  try {
    const csvLines = formattedRows.map(r => r.join(',')).join('\n') + '\n';
    fs.appendFileSync(ARCHIVE_FILE, csvLines, 'utf-8');
  } catch (err) {
    console.warn('[GoogleSheets Sync] Aviso ao gravar buffer local:', err.message);
  }

  return {
    success: true,
    totalArchived: formattedRows.length,
    spreadsheetId,
    webhookSent: Boolean(GOOGLE_APPS_SCRIPT_WEBHOOK_URL),
    localArchiveFile: ARCHIVE_FILE,
    timestamp
  };
}

/**
 * Lê estatísticas de fatias arquivadas no Google Sheets / CSV
 */
async function getSheetsStats() {
  let lineCount = 0;
  try {
    if (fs.existsSync(ARCHIVE_FILE)) {
      const content = fs.readFileSync(ARCHIVE_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      lineCount = Math.max(0, lines.length - 1);
    }
  } catch (e) {}

  return {
    totalArchivedRanges: lineCount,
    storageType: GOOGLE_APPS_SCRIPT_WEBHOOK_URL ? 'Google Apps Script Live Webhook + CSV Sync' : 'Serverless Local + Sheets Ready',
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    webhookConfigured: Boolean(GOOGLE_APPS_SCRIPT_WEBHOOK_URL)
  };
}

module.exports = {
  appendRangesToSheet,
  getSheetsStats,
  postToGoogleWebhook,
  ARCHIVE_FILE
};
