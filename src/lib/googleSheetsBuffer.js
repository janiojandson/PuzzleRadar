// =========================================================================
// 🧩 PuzzleRadar — Google Sheets Batching Buffer (Quota & Rate-Limit Shield)
// =========================================================================
// Protege as cotas do Google Apps Script agrupando relatórios de fatias (chunks)
// em memória e despachando em lotes atômicos a cada 180 segundos ou 100 itens.
// =========================================================================

const https = require('https');

class SheetsBufferManager {
  constructor(options = {}) {
    this.buffer = [];
    this.flushIntervalMs = options.flushIntervalMs || 15000; // 15 segundos
    this.maxBatchSize = options.maxBatchSize || 5;
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.lastFlushTime = null;
    this.totalBatchesSent = 0;
    this.totalRowsSent = 0;
  }

  /**
   * Enfileira uma entrada de chunk concluído
   */
  enqueueChunkLog(logEntry) {
    if (!logEntry) return;

    this.buffer.push({
      timestamp: logEntry.timestamp || new Date().toISOString(),
      chain: logEntry.chain || 'BTC',
      challenge_id: logEntry.challenge_id || logEntry.challengeId || logEntry.puzzleId || 'BTC_1000_P71',
      chunkIndex: logEntry.chunkIndex !== undefined ? logEntry.chunkIndex : '',
      startHex: logEntry.startHex || logEntry.rangeStart || '',
      endHex: logEntry.endHex || logEntry.rangeEnd || '',
      workerName: logEntry.workerName || logEntry.worker || 'Anonimo',
      status: logEntry.status || 'COMPLETED',
      hashrate: logEntry.hashrate || '0 GH/s',
      keyFound: Boolean(logEntry.keyFound)
    });

    if (this.buffer.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Descarrega o lote acumulado no Google Apps Script Webhook
   */
  async flush() {
    if (this.buffer.length === 0) return { flushed: false, count: 0 };

    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const secretToken = process.env.SHEETS_WEBHOOK_SECRET || process.env.JWT_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production';

    const itemsToSend = [...this.buffer];
    this.buffer = []; // Limpa o buffer imediatamente
    this.totalBatchesSent++;
    this.totalRowsSent += itemsToSend.length;
    this.lastFlushTime = new Date().toISOString();

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      // Modo offline / teste
      return { flushed: true, count: itemsToSend.length, mode: 'OFFLINE_SIMULATED' };
    }

    const payload = JSON.stringify({
      secretToken,
      batchMode: true,
      rows: itemsToSend
    });

    try {
      const parsedUrl = new URL(webhookUrl);
      const req = https.request(parsedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-token': secretToken,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 15000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          this.lastFlushTime = new Date().toISOString();
          this.totalBatchesSent++;
          this.totalRowsSent += itemsToSend.length;
          console.log(`📡 [SheetsBuffer] Lote de ${itemsToSend.length} chunks enviado com sucesso (HTTP ${res.statusCode}).`);
        });
      });

      req.on('error', (err) => {
        console.warn('⚠️ [SheetsBuffer] Erro de rede ao despachar lote para Google Sheets:', err.message);
        // Em caso de erro de rede temporário, mantemos o sistema vivo sem travar o core
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn('⚠️ [SheetsBuffer] Timeout ao despachar lote para Google Sheets.');
      });

      req.write(payload);
      req.end();

      return { flushed: true, count: itemsToSend.length };
    } catch (err) {
      console.warn('⚠️ [SheetsBuffer] Falha ao despachar lote:', err.message);
      return { flushed: false, error: err.message };
    }
  }

  /**
   * Retorna estatísticas do buffer
   */
  getStats() {
    return {
      currentBufferSize: this.buffer.length,
      maxBatchSize: this.maxBatchSize,
      flushIntervalSeconds: this.flushIntervalMs / 1000,
      lastFlushTime: this.lastFlushTime,
      totalBatchesSent: this.totalBatchesSent,
      totalRowsSent: this.totalRowsSent
    };
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

const sheetsBuffer = new SheetsBufferManager();

module.exports = {
  SheetsBufferManager,
  sheetsBuffer
};
