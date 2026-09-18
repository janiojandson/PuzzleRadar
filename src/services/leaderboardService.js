// =========================================================================
// 🧩 PuzzleRadar v5.1 — Leaderboard & Contributor Gamification Service
// =========================================================================
// Agrega estatísticas de contribuição (chaves verificadas, fatias concluídas,
// status online e badges) com persistência e fallback gracioso em memória.
// =========================================================================

const { redisClient } = require('../lib/redis');
const { fleetState } = require('../lib/fleetState');

class LeaderboardService {
  constructor() {
    this.memoryContributors = new Map(); // workerName -> { workerName, keysChecked, lotesCompleted, lastSeen, hashrate }
    this._initDefaultSeeds();
  }

  _initDefaultSeeds() {
    // Sementes comunitárias padrão
    const defaultSeeds = [
      { workerName: 'SatoshiGhost_Rig1', keysChecked: 1420000000000, lotesCompleted: 5, lastSeen: Date.now() - 300000, hashrate: '12.4 GH/s' },
      { workerName: 'NakamotoHunter_GPU', keysChecked: 980000000000, lotesCompleted: 3, lastSeen: Date.now() - 300000, hashrate: '8.2 GH/s' },
      { workerName: 'NexusCluster_RTX4090', keysChecked: 650000000000, lotesCompleted: 2, lastSeen: Date.now() - 300000, hashrate: '5.1 GH/s' },
      { workerName: 'Cypherpunk_Browser_BR', keysChecked: 8589934592, lotesCompleted: 2, lastSeen: Date.now() - 300000, hashrate: '120 kH/s' }
    ];

    for (const item of defaultSeeds) {
      this.memoryContributors.set(item.workerName, item);
    }
  }

  /**
   * Registra progresso ou conclusão de lote por um worker
   */
  async recordContribution(workerName, { keysChecked = 0, isLoteCompleted = false, hashrate = null } = {}) {
    const name = String(workerName || 'anon_miner').trim();
    const now = Date.now();

    if (!this.memoryContributors.has(name)) {
      this.memoryContributors.set(name, {
        workerName: name,
        keysChecked: 0,
        lotesCompleted: 0,
        lastSeen: now,
        hashrate: hashrate || '1.0 MH/s'
      });
    }

    const entry = this.memoryContributors.get(name);
    entry.keysChecked += Number(keysChecked) || 0;
    if (isLoteCompleted) entry.lotesCompleted += 1;
    entry.lastSeen = now;
    if (hashrate) entry.hashrate = hashrate;

    // Atualiza no Redis se disponível
    if (redisClient && redisClient.status === 'ready') {
      try {
        const key = 'puzzleradar:leaderboard';
        await redisClient.zincrby(key, Number(keysChecked) || 1, name);
      } catch (_) {}
    }

    return entry;
  }

  /**
   * Retorna os Top N maiores contribuidores mesclando os nós ativos do cluster
   */
  async getTopContributors(limit = 20) {
    const now = Date.now();
    const combinedMap = new Map();

    // 1. Carrega dados acumulados da memória
    for (const [key, item] of this.memoryContributors.entries()) {
      combinedMap.set(key, { ...item });
    }

    // 2. Mescla nós em tempo real do fleetState (Workers Terminal / Python / Browser)
    if (fleetState && fleetState.nodes) {
      for (const node of fleetState.nodes.values()) {
        const name = node.name || node.id;
        if (!name) continue;

        const isLive = (now - (node.lastSeen || 0)) < (3 * 60 * 1000);
        let kpsFormatted = null;
        if (node.keysPerSecond) {
          kpsFormatted = node.keysPerSecond >= 1e9
            ? `${(node.keysPerSecond / 1e9).toFixed(2)} GH/s`
            : node.keysPerSecond >= 1e6
              ? `${(node.keysPerSecond / 1e6).toFixed(2)} MH/s`
              : `${(node.keysPerSecond / 1e3).toFixed(1)} kH/s`;
        }

        const existing = combinedMap.get(name);
        if (existing) {
          existing.lastSeen = Math.max(existing.lastSeen || 0, node.lastSeen || now);
          existing.lotesCompleted = Math.max(existing.lotesCompleted || 0, node.completedChunks || 0);
          existing.keysChecked = Math.max(existing.keysChecked || 0, node.totalKeysChecked || (node.completedChunks ? node.completedChunks * 16777216 : 0));
          if (kpsFormatted) existing.hashrate = kpsFormatted;
        } else {
          combinedMap.set(name, {
            workerName: name,
            keysChecked: node.totalKeysChecked || (node.completedChunks ? node.completedChunks * 16777216 : 50000),
            lotesCompleted: node.completedChunks || 0,
            lastSeen: node.lastSeen || now,
            hashrate: kpsFormatted || node.hardware || '3.0 MH/s'
          });
        }
      }
    }

    const list = Array.from(combinedMap.values()).map(item => {
      const isOnline = (now - (item.lastSeen || 0)) < (3 * 60 * 1000); // 3 minutos
      return {
        ...item,
        isOnline,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        scoreFormatted: (item.keysChecked / 1e9).toFixed(2) + ' B'
      };
    });

    // Ordena: nós ONLINE primeiro, depois por chaves verificadas decrescente
    list.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return b.keysChecked - a.keysChecked;
    });

    const top = list.slice(0, limit).map((c, index) => ({
      rank: index + 1,
      ...c
    }));

    const totalCommunityKeys = list.reduce((acc, c) => acc + c.keysChecked, 0);

    return {
      success: true,
      totalContributors: list.length,
      totalCommunityKeys,
      totalCommunityKeysFormatted: (totalCommunityKeys / 1e12).toFixed(3) + ' TKeys',
      leaderboard: top,
      timestamp: new Date().toISOString()
    };
  }
}

const leaderboardService = new LeaderboardService();

module.exports = {
  LeaderboardService,
  leaderboardService
};
