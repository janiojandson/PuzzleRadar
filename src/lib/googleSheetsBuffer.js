// =========================================================================
// 🧩 PuzzleRadar — Google Sheets Batching Buffer (Quota & Rate-Limit Shield)
// =========================================================================
// Protege as cotas do Google Apps Script agrupando relatórios de fatias (chunks)
// em memória e despachando em lotes atômicos com mapeamento estrito de 10 colunas
// para a aba 'Ranges_Varredura'.
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
    this.targetSheetName = 'Ranges_Varredura';
  }

  /**
   * Enfileira uma entrada de chunk formatada exatamente em 10 colunas:
   * [Timestamp, Chain, Challenge ID, Chunk #, Range Início, Range Fim, Worker, Status, Hashrate, Descoberta]
   */
  enqueueChunkLog(logEntry) {
    if (!logEntry) return;

    const BASE_START = 0x400000000000000000n;
    const STEP_DEFAULT = 1n << 48n; // ~281T keys default step

    const timestamp = logEntry.timestamp || new Date().toISOString();
    const chain = (logEntry.chain || 'BTC').toUpperCase();
    const challengeId = logEntry.challenge_id || logEntry.challengeId || logEntry.puzzleId || 'Puzzle 71';
    
    let startHex = (logEntry.startHex || logEntry.rangeStart || '').replace(/^0x/i, '');
    if (!startHex) startHex = '400000000000000000';
    startHex = startHex.padStart(18, '0');

    let endHex = (logEntry.endHex || logEntry.rangeEnd || '').replace(/^0x/i, '');
    const stepBig = logEntry.stepSize ? BigInt(logEntry.stepSize) : STEP_DEFAULT;

    // Dedução automática de endHex se ausente
    if (!endHex) {
      const startBig = BigInt("0x" + startHex);
      endHex = (startBig + stepBig).toString(16).padStart(18, '0');
    } else {
      endHex = endHex.padStart(18, '0');
    }

    // Cálculo BigInt do número ordinal real do Chunk #
    let chunkIndex = 1;
    try {
      const startBig = BigInt("0x" + startHex);
      chunkIndex = Number((startBig - BASE_START) / stepBig) + 1;
      if (isNaN(chunkIndex) || chunkIndex < 1) chunkIndex = 1;
    } catch (_) {
      chunkIndex = 1;
    }
    const chunkLabel = `Chunk #${chunkIndex}`;

    const workerName = logEntry.workerName || logEntry.worker || 'Anonimo';
    const scanStatus = logEntry.status || logEntry.scanStatus || 'COMPLETED';
    const hashrateStr = logEntry.hashrate || logEntry.hashrateStr || '0 GH/s';
    const discoveryStatus = logEntry.keyFound ? '🚨 CHAVE ENCONTRADA!' : (logEntry.discoveryStatus || 'NENHUMA');

    this.buffer.push({
      timestamp,
      chain,
      challenge_id: challengeId,
      challengeId,
      chunkIndex,
      chunkNumber: chunkIndex,
      chunkLabel,
      startHex,
      endHex,
      workerName,
      status: scanStatus,
      scanStatus,
      hashrate: hashrateStr,
      hashrateStr,
      discoveryStatus,
      keyFound: Boolean(logEntry.keyFound || logEntry.foundKey)
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

    const webhookUrl = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbyxObip-jQvbdpv1vqoaKAEI2turdjaJI-cBJ8MwID164VzXD8uoXhVfTXEXRTy0khC/exec';
    const secretToken = process.env.SHEETS_WEBHOOK_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production';

    const itemsToSend = [...this.buffer];
    this.buffer = []; // Limpa o buffer imediatamente
    this.totalBatchesSent++;
    this.totalRowsSent += itemsToSend.length;
    this.lastFlushTime = new Date().toISOString();

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      // Modo offline / teste
      return { flushed: true, count: itemsToSend.length, mode: 'OFFLINE_SIMULATED', targetSheet: this.targetSheetName };
    }

    try {
      const { postToGoogleWebhook } = require('./googleSheets');
      const result = await postToGoogleWebhook(webhookUrl, {
        secretToken,
        action: 'batch_ranges',
        sheetName: this.targetSheetName,
        targetSheet: this.targetSheetName,
        batchMode: true,
        rows: itemsToSend
      });
      this.lastFlushTime = new Date().toISOString();
      console.log(`📡 [SheetsBuffer] Lote de ${itemsToSend.length} chunks enviado para '${this.targetSheetName}':`, result?.status || 'OK');
      return { flushed: true, count: itemsToSend.length, result, targetSheet: this.targetSheetName };
    } catch (err) {
      console.warn(`⚠️ [SheetsBuffer] Falha ao despachar lote para '${this.targetSheetName}':`, err.message);
      return { flushed: false, error: err.message, targetSheet: this.targetSheetName };
    }
  }

  /**
   * Encerra o timer do buffer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
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
      totalRowsSent: this.totalRowsSent,
      targetSheet: this.targetSheetName
    };
  }
}

const sheetsBuffer = new SheetsBufferManager();

module.exports = {
  SheetsBufferManager,
  sheetsBuffer
};
