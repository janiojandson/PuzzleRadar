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

// Configuração de Range Customizado (via env vars)
const RANGE_MODE = process.env.RANGE_MODE || 'half'; // 'full' | 'half' | 'custom' — padrão P71: segunda metade
const RANGE_EXCLUDE_START_PCT = parseInt(process.env.RANGE_EXCLUDE_START_PCT || '0', 10); // 0-100

function computeEffectiveRange() {
  let start = P71_START;
  let end = P71_END;

  if (RANGE_MODE === 'half') {
    const mid = P71_START + (P71_TOTAL_SPAN / 2n);
    start = mid; // apenas a segunda metade
  } else if (RANGE_MODE === 'custom') {
    // Custom: usa P71_START + offset configurado
    const offsetPct = parseInt(process.env.RANGE_CUSTOM_OFFSET_PCT || '0', 10);
    if (offsetPct > 0 && offsetPct < 100) {
      start = P71_START + (P71_TOTAL_SPAN * BigInt(offsetPct)) / 100n;
    }
  }

  if (RANGE_EXCLUDE_START_PCT > 0 && RANGE_EXCLUDE_START_PCT < 100) {
    const rangeSize = end - start;
    const exclude = (rangeSize * BigInt(RANGE_EXCLUDE_START_PCT)) / 100n;
    start = start + exclude;
  }

  return { start, end };
}

// Aplica configuração efetiva
const { start: EFFECTIVE_START, end: EFFECTIVE_END } = computeEffectiveRange();
const EFFECTIVE_SPAN = EFFECTIVE_END - EFFECTIVE_START;

console.log(`🎯 [LoteManager] Range efetivo P71: 0x${EFFECTIVE_START.toString(16).padStart(18,'0')} ➔ 0x${EFFECTIVE_END.toString(16).padStart(18,'0')} (${(Number(EFFECTIVE_SPAN)/1e12).toFixed(2)}T chaves) | Mode: ${RANGE_MODE}, Exclude: ${RANGE_EXCLUDE_START_PCT}%`);

// Passos adaptativos de fatiamento
const STEP_DEFAULT = 1n << 48n; // ~281 Trilhões de chaves (RTX 4090 / Rig High-End)
const STEP_MEDIUM = 1n << 44n;  // ~17.5 Trilhões de chaves (GPU Intermediária)
const STEP_SMALL = 1n << 40n;   // ~1.1 Trilhão de chaves (GPU Colab Free / Worker Leve)
const STEP_MICRO = 1n << 32n;   // ~4.29 Bilhões de chaves (Web Browser / CPU / 1-Click Mining)
const STEP_GO = 1n << 38n;      // ~274 Bilhões de chaves (Go Worker CPU Montgomery ~45 min @ 100M k/s)

const RECLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sem ping devolve para pending

class LoteManager {
  constructor() {
    this.lotes = new Map(); // loteId -> loteObject
    this.workerAssignments = new Map(); // workerId -> loteId
    this.isInitialized = false;
    this._initSeedLotes();
  }

  /**
   * Calcule o número ordinal real do Chunk com BigInt
   */
  calculateChunkIndex(startHex, stepSize = STEP_DEFAULT) {
    if (!startHex) return 1;
    const cleanHex = String(startHex).replace(/^0x/i, '');
    const startBig = BigInt("0x" + cleanHex);
    const stepBig = typeof stepSize === 'bigint' ? stepSize : BigInt(stepSize || STEP_DEFAULT);
    if (stepBig <= 0n) return 1;
    return Number((startBig - EFFECTIVE_START) / stepBig) + 1;
  }

/**
   * Inicializa o pool inicial de fatias indexadas do Puzzle 71
   */
  _initSeedLotes() {
    if (this.isInitialized) return;

    // Gera semente inicial com 256 lotes iniciais ponderados
    let currStart = EFFECTIVE_START;
    const initialBatchCount = 256;
    const step = STEP_DEFAULT;

    for (let i = 0; i < initialBatchCount && currStart < EFFECTIVE_END; i++) {
      const currEnd = currStart + step <= EFFECTIVE_END ? currStart + step : EFFECTIVE_END;
      const startHex = currStart.toString(16).padStart(18, '0');
      const endHex = currEnd.toString(16).padStart(18, '0');
      const id = `lote_p71_${startHex.slice(0, 8)}_${i}`;

      const scoreData = filterEngine.computePriorityScore({
        startHex,
        endHex,
        isScanned: false,
        puzzleNumber: 71
      });

      const chunkIndex = this.calculateChunkIndex(startHex, step);
      const chunkLabel = `Chunk #${chunkIndex}`;

      this.lotes.set(id, {
        id,
        puzzle: 71,
        startBigInt: currStart,
        endBigInt: currEnd,
        startHex,
        endHex,
        step,
        chunkIndex,
        chunkLabel,
        status: 'pending',
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
   * @param {boolean} isGoWorker
   */
  _resolveStepByHashrate(hashrateStr, isBrowserClient = false, isGoWorker = false) {
    if (isGoWorker) return STEP_GO; // 2^38 para Go Worker CPU Montgomery (~45 min)
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
   * @param {boolean} [isGoWorker]
   */
  async getNextOptimalRange(workerId = 'anon_worker', reportedHashrate = null, isBrowserClient = false, isGoWorker = false) {
    this.reclaimExpiredLotes();

    // Detecta se é Go worker pelo prefixo ou flag
    const detectedGoWorker = isGoWorker || workerId.startsWith('go_') || workerId.includes('go-worker');

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

    // 2b. Se for Go Worker, aloca lote maior (STEP_GO ~45 min @ 100M k/s)
    if (detectedGoWorker) {
      // Tenta recuperar checkpoint para retomar onde parou
      const checkpoint = await this._loadCheckpoint(workerId);
      let goLote;

      if (checkpoint) {
        // Reusa o range do checkpoint
        const startBig = BigInt('0x' + checkpoint.startHex);
        const endBig = BigInt('0x' + checkpoint.endHex);
        const step = endBig - startBig;
        
        goLote = {
          id: `lote_p71_go_resume_${checkpoint.startHex.slice(0, 8)}_${Date.now()}`,
          puzzle: 71,
          startBigInt: startBig,
          endBigInt: endBig,
          startHex: checkpoint.startHex,
          endHex: checkpoint.endHex,
          step,
          status: 'assigned',
          assignedWorker: workerId,
          assignedAt: Date.now(),
          lastHeartbeat: Date.now(),
          priority_score: 100,
          reason: 'resume_from_checkpoint',
          keysChecked: 0
        };
        this.lotes.set(goLote.id, goLote);
        this.workerAssignments.set(workerId, goLote.id);
        console.log(`🔄 [LoteManager] Go Worker ${workerId} RETOMADO do checkpoint: ${goLote.startHex} ➔ ${goLote.endHex}`);
      } else {
        // Novo lote normal
        goLote = this._generateNextDynamicLote(reportedHashrate, false, true);
        goLote.status = 'assigned';
        goLote.assignedWorker = workerId;
        goLote.assignedAt = Date.now();
        goLote.lastHeartbeat = Date.now();
        this.lotes.set(goLote.id, goLote);
        this.workerAssignments.set(workerId, goLote.id);
        console.log(`🚀 [LoteManager] Go Worker ${workerId} alocado lote NOVO ${goLote.id} (step: ${goLote.step})`);
      }

      // Salva checkpoint para próxima retomada
      await this._saveCheckpoint(workerId, goLote.startHex, goLote.endHex);
      return this._formatRangeResponse(goLote);
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
  _generateNextDynamicLote(reportedHashrate, isBrowserClient = false, isGoWorker = false) {
    const step = this._resolveStepByHashrate(reportedHashrate, isBrowserClient, isGoWorker);
    const count = this.lotes.size;
    const currStart = EFFECTIVE_START + (BigInt(count) * step);
    const currEnd = currStart + step <= EFFECTIVE_END ? currStart + step : EFFECTIVE_END;

    const startHex = currStart.toString(16).padStart(18, '0');
    const endHex = currEnd.toString(16).padStart(18, '0');
    const workerType = isGoWorker ? 'go' : (isBrowserClient ? 'micro' : 'dyn');
    const id = `lote_p71_${workerType}_${startHex.slice(0, 8)}_${count}`;

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
   * Salva checkpoint do cursor para Go Workers (Redis)
   * Persiste o último range entregue para retomada após restart
   */
  async _saveCheckpoint(workerId, startHex, endHex) {
    if (!workerId || (!workerId.startsWith('go_') && !workerId.includes('go-worker'))) return;
    if (RANGE_MODE === 'full' && RANGE_EXCLUDE_START_PCT === 0) return; // só persiste quando há config custom

    try {
      const { redisSet } = require('../lib/redis');
      const checkpoint = {
        workerId,
        startHex,
        endHex,
        rangeMode: RANGE_MODE,
        excludeStartPct: RANGE_EXCLUDE_START_PCT,
        timestamp: Date.now()
      };
      await redisSet(`worker:checkpoint:${workerId}`, JSON.stringify(checkpoint), 86400); // TTL 24h
      console.log(`💾 [LoteManager] Checkpoint salvo para ${workerId}: ${startHex} ➔ ${endHex}`);
    } catch (e) {
      console.warn(`⚠️ [LoteManager] Falha ao salvar checkpoint: ${e.message}`);
    }
  }

  /**
   * Recupera checkpoint do cursor para Go Workers (Redis)
   * Retorna { startHex, endHex } se existir checkpoint válido
   */
  async _loadCheckpoint(workerId) {
    if (!workerId || (!workerId.startsWith('go_') && !workerId.includes('go-worker'))) return null;
    if (RANGE_MODE === 'full' && RANGE_EXCLUDE_START_PCT === 0) return null;

    try {
      const { redisGet } = require('../lib/redis');
      const data = await redisGet(`worker:checkpoint:${workerId}`);
      if (!data) return null;

      const checkpoint = JSON.parse(data);
      // Valida se config de range não mudou
      if (checkpoint.rangeMode !== RANGE_MODE || checkpoint.excludeStartPct !== RANGE_EXCLUDE_START_PCT) {
        console.log(`🔄 [LoteManager] Config de range mudou, ignorando checkpoint antigo para ${workerId}`);
        return null;
      }

      console.log(`📂 [LoteManager] Checkpoint recuperado para ${workerId}: ${checkpoint.startHex} ➔ ${checkpoint.endHex}`);
      return { startHex: checkpoint.startHex, endHex: checkpoint.endHex };
    } catch (e) {
      console.warn(`⚠️ [LoteManager] Falha ao carregar checkpoint: ${e.message}`);
      return null;
    }
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

    const chunkIndex = lote.chunkIndex || this.calculateChunkIndex(cleanStart, lote.step);
    const chunkLabel = lote.chunkLabel || `Chunk #${chunkIndex}`;

    return {
      custom_range: customRange,
      pool_conf_line: `custom_range=${customRange}`,
      lote_id: lote.id,
      puzzle: lote.puzzle || 71,
      chunk_index: chunkIndex,
      chunk_label: chunkLabel,
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
  STEP_MICRO,
  STEP_GO
};
