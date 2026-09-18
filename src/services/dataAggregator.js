// =========================================================================
// 🧩 PuzzleRadar v5.0 — External Data Aggregator & Space Pruning Ingestion
// =========================================================================
// Sincroniza fatias públicas do btcpuzzle.info e theCollider com controle
// rígido de rate limit e cache TTL em memória para alimentar o Space Pruning.
// =========================================================================

const https = require('https');
const http = require('http');
const { bulkImportHistory, markRangeScanned } = require('../lib/redis');

class DataAggregator {
  constructor() {
    this.cache = {
      btcpuzzle: new Map(), // puzzleCode -> { data, timestamp }
      theCollider: { data: null, timestamp: 0 }
    };
    this.TTL_BTCPUZZLE_MS = 30 * 60 * 1000; // 30 minutos (2 req/hora max)
    this.TTL_THECOLLIDER_MS = 15 * 60 * 1000; // 15 minutos
    this.requestCounts = {
      btcpuzzle: 0,
      theCollider: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Utilitário para requisições HTTP/HTTPS resilientes
   */
  _fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = client.get(url, {
        headers: {
          'User-Agent': 'PuzzleRadar-Coordinator/5.0 (+https://puzzleradar.io)',
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        timeout: options.timeout || 10000
      }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(new Error(`HTTP error ${res.statusCode} para ${url}`));
        }

        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Falha no parse JSON de ${url}: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout ao conectar com ${url}`));
      });
    });
  }

  /**
   * Consome a API pública do btcpuzzle.info com cache e rate-limit
   * @param {number|string} puzzleCode - Ex: 71
   */
  async fetchBtcpuzzleRanges(puzzleCode = 71) {
    const code = String(puzzleCode);
    const now = Date.now();
    const cached = this.cache.btcpuzzle.get(code);

    if (cached && (now - cached.timestamp < this.TTL_BTCPUZZLE_MS)) {
      return {
        success: true,
        source: 'CACHE',
        data: cached.data,
        cachedAt: new Date(cached.timestamp).toISOString()
      };
    }

    try {
      this.requestCounts.btcpuzzle++;
      const url = `https://btcpuzzle.info/puzzle/${code}/range`;
      const data = await this._fetchJson(url, { timeout: 8000 }).catch(err => {
        console.warn(`⚠️ [DataAggregator] btcpuzzle.info offline ou rate-limited: ${err.message}. Usando dados sintéticos/anteriores.`);
        return cached ? cached.data : { ranges: [], scannedRanges: [], totalScanned: 0 };
      });

      this.cache.btcpuzzle.set(code, { data, timestamp: now });

      // Se houver fatias marcadas como escaneadas na resposta, sincroniza com o Bitmap
      if (data && Array.isArray(data.scannedRanges)) {
        for (const r of data.scannedRanges) {
          if (r.start && r.end) {
            await markRangeScanned(`puzzle_btc_${code}`, r.start, r.end);
          }
        }
      }

      return {
        success: true,
        source: 'LIVE_FETCH',
        data,
        cachedAt: new Date(now).toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        data: cached ? cached.data : null
      };
    }
  }

  /**
   * Consome o repositório público do theCollider
   */
  async syncTheColliderRanges() {
    const now = Date.now();
    if (this.cache.theCollider.data && (now - this.cache.theCollider.timestamp < this.TTL_THECOLLIDER_MS)) {
      return {
        success: true,
        source: 'CACHE',
        data: this.cache.theCollider.data,
        cachedAt: new Date(this.cache.theCollider.timestamp).toISOString()
      };
    }

    try {
      this.requestCounts.theCollider++;
      const url = 'https://thecollider.info/res/puzzles_data.json';
      const data = await this._fetchJson(url, { timeout: 8000 }).catch(err => {
        console.warn(`⚠️ [DataAggregator] theCollider offline: ${err.message}. Usando fallback em memória.`);
        return this.cache.theCollider.data || { puzzles: {}, ranges: [] };
      });

      this.cache.theCollider = { data, timestamp: now };
      return {
        success: true,
        source: 'LIVE_FETCH',
        data,
        cachedAt: new Date(now).toISOString()
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        data: this.cache.theCollider.data
      };
    }
  }

  /**
   * Retorna estatísticas de chamadas e conformidade de taxa
   */
  getRateLimitStats() {
    const now = Date.now();
    const elapsedMinutes = (now - this.requestCounts.lastReset) / 60000;
    return {
      btcpuzzleReqs: this.requestCounts.btcpuzzle,
      theColliderReqs: this.requestCounts.theCollider,
      elapsedMinutes: parseFloat(elapsedMinutes.toFixed(2)),
      rateLimitMaxPerHour: 60,
      safeBudgetUsedPercent: parseFloat(((this.requestCounts.btcpuzzle / 60) * 100).toFixed(2))
    };
  }
}

const dataAggregator = new DataAggregator();

module.exports = {
  DataAggregator,
  dataAggregator
};
