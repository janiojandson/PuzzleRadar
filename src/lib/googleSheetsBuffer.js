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
    this.flushIntervalMs = options.flushIntervalMs || 60000; // 60 segundos
    this.maxBatchSize = options.maxBatchSize || 10;
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.lastFlushTime = null;
    this.totalBatchesSent = 0;
    this.totalRowsSent = 0;
    this.targetSheetName = 'Ranges_Varredura';
    
    // Validar variáveis de ambiente obrigatórias na inicialização
    this._validateEnvVars();
  }

  _validateEnvVars() {
    const missing = [];
    if (!process.env.GOOGLE_SHEET_ID && !process.env.GOOGLE_SPREADSHEET_ID) {
      missing.push('GOOGLE_SHEET_ID (ou GOOGLE_SPREADSHEET_ID)');
    }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    }
    if (!process.env.GOOGLE_PRIVATE_KEY) {
      missing.push('GOOGLE_PRIVATE_KEY');
    }
    if (!process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL && !process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
      missing.push('GOOGLE_APPS_SCRIPT_WEBHOOK_URL (ou GOOGLE_SHEETS_WEBHOOK_URL)');
    }
    
    if (missing.length > 0) {
      console.warn('⚠️ [SheetsBuffer] Variáveis de ambiente ausentes para Google Sheets:', missing.join(', '));
      console.warn('   → Configure no Railway/Environment:');
      missing.forEach(m => console.warn(`      - ${m}`));
      if (missing.includes('GOOGLE_SERVICE_ACCOUNT_EMAIL') || missing.includes('GOOGLE_PRIVATE_KEY')) {
        console.warn('   → Para Service Account: compartilhe a planilha com o email da service account com permissão de EDITOR');
      }
    } else {
      console.log('✅ [SheetsBuffer] Variáveis de ambiente do Google Sheets validadas com sucesso');
    }
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
    let scanStatus = logEntry.status || logEntry.scanStatus || 'COMPLETED';
    if (scanStatus.includes(' | Pai:')) {
      scanStatus = scanStatus.split(' | Pai:')[0].trim();
    }
    const hashrateStr = logEntry.hashrate || logEntry.hashrateStr || '0 GH/s';
    const discoveryStatus = logEntry.keyFound ? '🚨 CHAVE ENCONTRADA!' : (logEntry.discoveryStatus || 'NENHUMA');

    let officialParentPoW = logEntry.officialParentPoW || logEntry.parentPoW || 'Pai: 0x4000000 [Marcos: 0/60 | PoW: 0/6]';
    try {
      const { parentLoteManager } = require('../services/parentLoteManager');
      const pStatus = parentLoteManager.getStatus();
      if (pStatus && pStatus.parentHex) {
        if (pStatus.powKeysFound >= pStatus.totalPowKeysRequired) {
          officialParentPoW = `🚀 6/6 PoW ENVIADO AO OFICIAL! (Pai: 0x${pStatus.parentHex} | 60/60 Marcos)`;
        } else {
          officialParentPoW = `Pai: 0x${pStatus.parentHex} [Marcos: ${pStatus.milestonesFound || 0}/60 | PoW: ${pStatus.powKeysFound}/${pStatus.totalPowKeysRequired}]`;
        }
      }
    } catch (_) {}

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
      officialParentPoW,
      parentPoW: officialParentPoW,
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
      
      // Tratamento explícito de erros 401/403
      if (result && (result.statusCode === 401 || result.statusCode === 403 || (result.error && (result.error.includes('401') || result.error.includes('403'))))) {
        console.error('❌ [SheetsBuffer] Erro de permissão (401/403) ao escrever no Google Sheets');
        console.error('   → AÇÃO NECESSÁRIA: Compartilhe a planilha com o email da Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL) com permissão de EDITOR');
        console.error('   → No Google Sheets: Botão "Compartilhar" → Cole o email → Selecione "Editor" → Enviar');
        return { flushed: false, error: 'PERMISSION_DENIED_401_403', targetSheet: this.targetSheetName, instruction: 'Compartilhe a planilha com a Service Account como EDITOR' };
      }
      
      this.lastFlushTime = new Date().toISOString();
      console.log(`📡 [SheetsBuffer] Lote de ${itemsToSend.length} chunks enviado para '${this.targetSheetName}':`, result?.status || 'OK');
      return { flushed: true, count: itemsToSend.length, result, targetSheet: this.targetSheetName };
    } catch (err) {
      const errMsg = err.message || String(err);
      console.warn(`⚠️ [SheetsBuffer] Falha ao despachar lote para '${this.targetSheetName}':`, errMsg);
      
      // Verificar se é erro de permissão
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('unauthorized') || errMsg.includes('forbidden')) {
        console.error('❌ [SheetsBuffer] Erro de permissão detectado:', errMsg);
        console.error('   → AÇÃO NECESSÁRIA: Compartilhe a planilha com o email da Service Account (GOOGLE_SERVICE_ACCOUNT_EMAIL) com permissão de EDITOR');
        console.error('   → No Google Sheets: Botão "Compartilhar" → Cole o email → Selecione "Editor" → Enviar');
      }
      
      return { flushed: false, error: errMsg, targetSheet: this.targetSheetName };
    }
  }

  /**
   * Flush forçado - chamado quando um lote Go é concluído
   */
  async flushOnBatchComplete(logEntry) {
    if (logEntry) {
      this.enqueueChunkLog(logEntry);
    }
    return this.flush();
  }

  /**
   * Envia o registro de um minerador e sua carteira de recebimento diretamente para a aba Cadastros_Mineradores
   */
  async sendPayoutRegistration(payoutData) {
    const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const secretToken = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET || 'puzzleradar_super_secret_jwt_key_2026_production';
    if (!webhookUrl || !webhookUrl.startsWith('http')) return { skipped: true };

    try {
      const { postToGoogleWebhook } = require('./googleSheets');
      const result = await postToGoogleWebhook(webhookUrl, {
        secretToken,
        action: 'register_payout',
        targetSheet: 'Cadastros_Mineradores',
        sheetName: 'Cadastros_Mineradores',
        workerName: payoutData.workerName,
        payoutAddress: payoutData.payoutAddress,
        hardwareType: payoutData.hardwareType || 'GPU / Cluster',
        contactInfo: payoutData.contactInfo || null,
        timestamp: new Date().toISOString()
      });
      console.log(`💳 [SheetsBuffer] Cadastro de Payout de '${payoutData.workerName}' enviado ao Google Sheets.`);
      return { success: true, result };
    } catch (err) {
      const errMsg = err.message || String(err);
      console.warn(`⚠️ [SheetsBuffer] Falha ao enviar cadastro de payout:`, errMsg);
      if (errMsg.includes('401') || errMsg.includes('403')) {
        console.error('   → Compartilhe a planilha com a Service Account como EDITOR');
      }
      return { success: false, error: errMsg };
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
