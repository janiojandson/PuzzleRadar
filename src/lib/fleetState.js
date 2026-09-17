// =========================================================================
// 🧩 PuzzleRadar — Unified Fleet & Worker State Manager (Single Source of Truth)
// =========================================================================
// Centraliza o estado em tempo real de TODOS os nós de mineração:
//   - Workers do Colab / Terminais Python
//   - Pools colaborativos Proof-of-Share
//   - Kangaroo ECDSA Solvers (GPU / CPU / WebAssembly)
// =========================================================================

class FleetStateManager {
  constructor() {
    /** @type {Map<string, Object>} */
    this.nodes = new Map();
    this.cleanupIntervalMs = 60_000;
    this.nodeTtlMs = 180_000; // 3 minutos de timeout para inatividade

    // Cron periódico para expirar nós inativos
    this.timer = setInterval(() => this.pruneInactiveNodes(), this.cleanupIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Registra ou atualiza a atividade de um nó
   * @param {string} nodeId - Token ou ID do nó
   * @param {Object} metadata - Metadados atualizados do nó
   */
  touch(nodeId, metadata = {}) {
    if (!nodeId) return null;

    const existing = this.nodes.get(nodeId) || {
      id: nodeId,
      name: metadata.name || `node-${String(nodeId).substring(0, 6)}`,
      hardware: 'GPU Cluster Node',
      gpuModel: 'CUDA / OpenCL',
      chain: 'BTC',
      challengeId: 'BTC_1000_P71',
      keysPerSecond: 0,
      totalKeysChecked: 0,
      shares: 0,
      completedChunks: 0,
      status: 'IDLE',
      progress: 0,
      firstSeen: Date.now()
    };

    const updated = {
      ...existing,
      ...metadata,
      id: nodeId,
      lastSeen: Date.now()
    };

    if (metadata.keysChecked) {
      updated.totalKeysChecked = (existing.totalKeysChecked || 0) + Number(metadata.keysChecked);
    }
    if (metadata.sharesEarned) {
      updated.shares = (existing.shares || 0) + Number(metadata.sharesEarned);
    }
    if (metadata.chunkCompleted) {
      updated.completedChunks = (existing.completedChunks || 0) + 1;
    }

    this.nodes.set(nodeId, updated);
    return updated;
  }

  /**
   * Retorna os dados de um nó específico
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Define a tarefa atual de um nó
   */
  setTask(nodeId, task) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.currentTask = task;
      node.status = 'COMPUTING';
      node.lastSeen = Date.now();
    }
  }

  /**
   * Limpa a tarefa atual de um nó
   */
  clearTask(nodeId) {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.currentTask = null;
      node.status = 'IDLE';
      node.lastSeen = Date.now();
    }
  }

  /**
   * Retorna a lista de nós ativos formatada para o Painel/Dashboard
   */
  getActiveNodes(maxAgeMs = this.nodeTtlMs) {
    const now = Date.now();
    const activeList = [];

    for (const [id, node] of this.nodes.entries()) {
      const age = now - (node.lastSeen || 0);
      if (age <= maxAgeMs) {
        activeList.push({
          id,
          name: node.name || `worker-${id.substring(0, 8)}`,
          hardware: node.hardware || 'GPU Cluster Node',
          gpuModel: node.gpuModel || 'CUDA / OpenCL',
          chain: node.chain || (node.currentTask ? node.currentTask.chain : 'BTC'),
          challengeId: node.challengeId || (node.currentTask ? node.currentTask.challengeId : 'BTC_1000_P71'),
          keysPerSecond: node.keysPerSecond || 0,
          hashrateFormatted: this.formatHashrate(node.keysPerSecond || 0),
          status: node.status || 'ONLINE',
          progress: node.progress || 0,
          shares: Number((node.shares || 0).toFixed(2)),
          completedChunks: node.completedChunks || 0,
          totalKeysChecked: node.totalKeysChecked || 0,
          currentTask: node.currentTask || null,
          lastSeenAgoSeconds: Math.floor(age / 1000)
        });
      }
    }

    return activeList;
  }

  /**
   * Retorna os índices de chunks que estão atualmente sendo processados por outros nós ativos
   */
  getCurrentlyProcessingChunks(puzzleId, excludeNodeId = null) {
    const now = Date.now();
    const busyChunks = new Set();

    for (const [wId, w] of this.nodes.entries()) {
      if (wId !== excludeNodeId && w.currentTask && (now - w.lastSeen <= 90_000)) {
        if (w.currentTask.puzzleId === puzzleId && w.currentTask.chunkIndex !== undefined) {
          busyChunks.add(w.currentTask.chunkIndex);
        }
      }
    }

    return busyChunks;
  }

  /**
   * Remove nós que não enviam heartbeat há mais de `nodeTtlMs`
   */
  pruneInactiveNodes() {
    const now = Date.now();
    for (const [id, node] of this.nodes.entries()) {
      if (now - (node.lastSeen || 0) > this.nodeTtlMs) {
        this.nodes.delete(id);
      }
    }
  }

  /**
   * Helper para formatar hashrate de forma padronizada
   */
  formatHashrate(kps) {
    const n = Number(kps) || 0;
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TH/s`;
    if (n >= 1e9)  return `${(n / 1e9).toFixed(2)} GH/s`;
    if (n >= 1e6)  return `${(n / 1e6).toFixed(2)} MH/s`;
    if (n >= 1e3)  return `${(n / 1e3).toFixed(2)} KH/s`;
    return `${n.toFixed(0)} H/s`;
  }
}

const fleetState = new FleetStateManager();

module.exports = {
  FleetStateManager,
  fleetState
};
