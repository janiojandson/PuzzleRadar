// =========================================================================
// 🧩 PuzzleRadar v5.0 — Adaptive Lote Manager (BigInt Coordinator Engine)
// =========================================================================
// Gerencia a partição do keyspace do Puzzle 71 (71 bits) em lotes adaptativos,
// reserva atômica de fatias, tolerância a falhas e auto-reclaim de 30 minutos.
// =========================================================================

const crypto = require('crypto');
const { filterEngine } = require('./filterEngine');
const { isRangeScanned, markRangeScanned } = require('../lib/redis');

// Constantes Soberanas do Puzzle 71 (71 bits)
const P71_START = 0x400000000000000000n;
const P71_END = 0x7fffffffffffffffffn;
const P71_TOTAL_SPAN = P71_END - P71_START;

// Passos adaptativos de fatiamento
const STEP_DEFAULT = 1n << 48n; // ~281 Trilhões de chaves (RTX 4090 / Rig High-End)
const STEP_MEDIUM = 1n << 44n;  // ~17.5 Trilhões de chaves (GPU Intermediária)
const STEP_SMALL = 1n << 40n;   // ~1.1 Trilhão de chaves (GPU Colab Free / Worker Leve)
const STEP_MICRO = 1n << 32n;   // ~4.29 Bilhões de chaves (Web Browser / CPU / 1-Click Mining)

const RECLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sem ping devolve para pending

class LoteManager {
  constructor() {
    this.lotes = new Map(); // loteId -> loteObject
    this.workerAssignments = new Map(); // workerId -> loteId
    this.isInitialized = false;
    this._initSeedLotes();
  }

  /**
   * Inicializa o pool inicial de fatias indexadas do Puzzle 71
   */
  _initSeedLotes() {
    if (this.isInitialized) return;

    // Gera semente inicial com 256 lotes iniciais ponderados
    let currStart = P71_START;
    const initialBatchCount = 256;
    const step = STEP_DEFAULT;

    for (let i = 0; i < initialBatchCount && currStart < P71_END; i++) {
      const currEnd = currStart + step;
      const startHex = currStart.toString(16).padStart(18, '0');
      const endHex = currEnd.toString(16).padStart(18, '0');
      const id = `lote_p71_${startHex.slice(0, 8)}_${i}`;

      const scoreData = filterEngine.computePriorityScore({
        startHex,
        endHex,
        isScanned: false,
        puzzleNumber: 71
      });

      this.lotes.set(id, {
        id,
        puzzle: 71,
        startBigInt: currStart,
        endBigInt: currEnd,
        startHex,
        endHex,
        step,
        status: 'pending', // pending | assigned | running | completed | found
        assignedWorker: null,
        assignedAt: null,
        lastHeartbeat: null,
        priority_score: scoreData.score,
        reason: scoreData.reason,
        keysChecked: 0
      });

      currStart = currEnd;
    }

    this.isInitialized = true;
    console.log(`🧩 [LoteManager v5.1] Inicializado com ${this.lotes.size} fatias semente para o Puzzle 71.`);
  }

  /**
   * Determina o tamanho de passo adequado ao hashrate reportado e tipo de cliente
   * @param {number|string} hashrateStr - Ex: "1200 MH/s", "5 GH/s", "120 GH/s"
   * @param {boolean} isBrowserClient
   */
  _resolveStepByHashrate(hashrateStr, isBrowserClient = false) {
    if (isBrowserClient) return STEP_MICRO; // 2^32 para navegador web
    if (!hashrateStr) return STEP_DEFAULT;
    const str = String(hashrateStr).toUpperCase();
    if (str.includes('GH/S') || str.includes('GKEYS/S') || str.includes('TH/S')) {
      return STEP_DEFAULT; // 2^48
    }
    if (str.includes('MH/S')) {
      const val = parseFloat(str);
      if (val > 500) return STEP_MEDIUM; // 2^44
      if (val >= 50) return STEP_SMALL;  // 2^40
      return STEP_MICRO; // 2^32
    }
    if (str.includes('KH/S') || str.includes('H/S')) {
      return STEP_MICRO; // 2^32
    }
    return STEP_SMALL; // 2^40
  }

  /**
   * Executa o Auto-Reclaim de fatias abandonadas (>30min sem ping)
   */
  reclaimExpiredLotes() {
    const now = Date.now();
    let reclaimedCount = 0;

    for (const [id, lote] of this.lotes.entries()) {
      if ((lote.status === 'assigned' || lote.status === 'running') && lote.lastHeartbeat) {
        if (now - lote.lastHeartbeat > RECLAIM_TIMEOUT_MS) {
          console.warn(`♻️ [LoteManager] Auto-Reclaim: Lote ${id} expirou (Worker ${lote.assignedWorker} inativo). Retornando para 'pending'.`);
          lote.status = 'pending';
          lote.assignedWorker = null;
          lote.assignedAt = null;
          lote.lastHeartbeat = null;
          reclaimedCount++;
        }
      }
    }
    return reclaimedCount;
  }

  /**
   * Requisita o próximo lote de maior prioridade para um worker
   * @param {string} workerId 
   * @param {string} [reportedHashrate] 
   * @param {boolean} [isBrowserClient]
   */
  async getNextOptimalRange(workerId = 'anon_worker', reportedHashrate = null, isBrowserClient = false) {
    this.reclaimExpiredLotes();

    // 1. Verifica se o worker já possui um lote ativo
    if (this.workerAssignments.has(workerId)) {
      const activeId = this.workerAssignments.get(workerId);
      const activeLote = this.lotes.get(activeId);
      if (activeLote && (activeLote.status === 'assigned' || activeLote.status === 'running')) {
        activeLote.lastHeartbeat = Date.now();
        return this._formatRangeResponse(activeLote);
      }
    }

    // 2. Se for cliente browser, aloca dinamicamente um micro-lote (STEP_MICRO)
    if (isBrowserClient) {
      const microLote = this._generateNextDynamicLote(reportedHashrate, true);
      microLote.status = 'assigned';
      microLote.assignedWorker = workerId;
      microLote.assignedAt = Date.now();
      microLote.lastHeartbeat = Date.now();
      this.lotes.set(microLote.id, microLote);
      this.workerAssignments.set(workerId, microLote.id);
      return this._formatRangeResponse(microLote);
    }

    // 3. Procura fatias pendentes ordenadas por maior priority_score
    const candidates = Array.from(this.lotes.values())
      .filter(l => l.status === 'pending')
      .sort((a, b) => b.priority_score - a.priority_score);

    for (const lote of candidates) {
      // Confere se não foi escaneada publicamente no Redis
      const isScanned = await isRangeScanned(71, lote.startHex, lote.endHex);
      if (isScanned) {
        lote.status = 'completed';
        continue;
      }

      // Atribuição atômica
      lote.status = 'assigned';
      lote.assignedWorker = workerId;
      lote.assignedAt = Date.now();
      lote.lastHeartbeat = Date.now();
      this.workerAssignments.set(workerId, lote.id);

      return this._formatRangeResponse(lote);
    }

    // 4. Se todas as sementes foram alocadas, gera dinamicamente uma nova fatia
    const dynamicLote = this._generateNextDynamicLote(reportedHashrate, isBrowserClient);
    dynamicLote.status = 'assigned';
    dynamicLote.assignedWorker = workerId;
    dynamicLote.assignedAt = Date.now();
    dynamicLote.lastHeartbeat = Date.now();
    this.lotes.set(dynamicLote.id, dynamicLote);
    this.workerAssignments.set(workerId, dynamicLote.id);

    return this._formatRangeResponse(dynamicLote);
  }

  /**
   * Gera uma nova fatia além das sementes
   */
  _generateNextDynamicLote(reportedHashrate, isBrowserClient = false) {
    const step = this._resolveStepByHashrate(reportedHashrate, isBrowserClient);
    const count = this.lotes.size;
    const currStart = P71_START + (BigInt(count) * step);
    const currEnd = currStart + step <= P71_END ? currStart + step : P71_END;

    const startHex = currStart.toString(16).padStart(18, '0');
    const endHex = currEnd.toString(16).padStart(18, '0');
    const id = `lote_p71_${isBrowserClient ? 'micro' : 'dyn'}_${startHex.slice(0, 8)}_${count}`;

    const scoreData = filterEngine.computePriorityScore({
      startHex,
      endHex,
      isScanned: false,
      puzzleNumber: 71
    });

    return {
      id,
      puzzle: 71,
      startBigInt: currStart,
      endBigInt: currEnd,
      startHex,
      endHex,
      step,
      status: 'pending',
      assignedWorker: null,
      assignedAt: null,
      lastHeartbeat: null,
      priority_score: scoreData.score,
      reason: scoreData.reason,
      keysChecked: 0
    };
  }

  /**
   * Atualiza o estado de um lote
   */
  updateLoteEvent(loteIdOrStartHex, eventType, metadata = {}) {
    let lote = this.lotes.get(loteIdOrStartHex);
    if (!lote) {
      // Busca por startHex
      for (const item of this.lotes.values()) {
        if (item.startHex === loteIdOrStartHex || item.startHex === String(loteIdOrStartHex).replace(/^0x/i, '')) {
          lote = item;
          break;
        }
      }
    }

    if (!lote) return false;

    lote.lastHeartbeat = Date.now();

    if (eventType === 'workerStarted') {
      lote.status = 'running';
      if (metadata.workerName) lote.assignedWorker = metadata.workerName;
    } else if (eventType === 'rangeScanned' || eventType === 'reachedOfKeySpace') {
      lote.status = 'completed';
      markRangeScanned(71, lote.startHex, lote.endHex).catch(() => {});
    } else if (eventType === 'keyFound') {
      lote.status = 'found';
      lote.foundKey = metadata.privateKeyHex;
    } else if (eventType === 'workerExited') {
      if (lote.status !== 'completed' && lote.status !== 'found') {
        lote.status = 'pending';
        lote.assignedWorker = null;
      }
    }

    return true;
  }

  /**
   * Formata a resposta padrão do endpoint /api/range/next/:worker_id
   */
  _formatRangeResponse(lote) {
    const cleanStart = lote.startHex.replace(/^0x/i, '').padStart(18, '0');
    const cleanEnd = lote.endHex.replace(/^0x/i, '').padStart(18, '0');
    const customRange = `${cleanStart}:${cleanEnd}`;

    return {
      custom_range: customRange,
      pool_conf_line: `custom_range=${customRange}`,
      lote_id: lote.id,
      puzzle: lote.puzzle || 71,
      priority_score: lote.priority_score,
      reason: lote.reason,
      allocated_at: new Date().toISOString()
    };
  }

  /**
   * Retorna telemetria consolidada
   */
  getStats(puzzleNumber = 71) {
    let pending = 0, assigned = 0, running = 0, completed = 0, found = 0;
    const activeWorkers = new Set();

    for (const l of this.lotes.values()) {
      if (l.status === 'pending') pending++;
      else if (l.status === 'assigned') assigned++;
      else if (l.status === 'running') {
        running++;
        if (l.assignedWorker) activeWorkers.add(l.assignedWorker);
      }
      else if (l.status === 'completed') completed++;
      else if (l.status === 'found') found++;
    }

    const total = this.lotes.size;
    const progressPercent = total > 0 ? parseFloat(((completed / total) * 100).toFixed(4)) : 0;

    return {
      puzzle: Number(puzzleNumber),
      totalLotes: total,
      pending,
      assigned,
      running,
      completed,
      found,
      activeWorkersCount: activeWorkers.size,
      activeWorkers: Array.from(activeWorkers),
      progressPercent,
      keyspaceStart: P71_START.toString(16).padStart(18, '0'),
      keyspaceEnd: P71_END.toString(16).padStart(18, '0'),
      timestamp: new Date().toISOString()
    };
  }
}

const loteManager = new LoteManager();

module.exports = {
  LoteManager,
  loteManager,
  P71_START,
  P71_END,
  STEP_DEFAULT,
  STEP_MEDIUM,
  STEP_SMALL,
  STEP_MICRO
};
