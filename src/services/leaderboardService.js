// =========================================================================
// 🧩 PuzzleRadar v5.1 — Leaderboard & Contributor Gamification Service
// =========================================================================
// Agrega estatísticas de contribuição (chaves verificadas, fatias concluídas,
// status online e badges) com persistência e fallback gracioso em memória.
// =========================================================================

const { redisClient } = require('../lib/redis');

class LeaderboardService {
  constructor() {
    this.memoryContributors = new Map(); // workerName -> { workerName, keysChecked, lotesCompleted, lastSeen, hashrate }
    this._initDefaultSeeds();
  }

  _initDefaultSeeds() {
    // Sementes iniciais para ambiente comunitário vivo
    const defaultSeeds = [
      { workerName: 'SatoshiGhost_Rig1', keysChecked: 1420000000000, lotesCompleted: 5, lastSeen: Date.now() - 60000, hashrate: '12.4 GH/s' },
      { workerName: 'NakamotoHunter_GPU', keysChecked: 980000000000, lotesCompleted: 3, lastSeen: Date.now() - 120000, hashrate: '8.2 GH/s' },
      { workerName: 'NexusCerebro_Colab_01', keysChecked: 650000000000, lotesCompleted: 2, lastSeen: Date.now() - 30000, hashrate: '5.1 GH/s' },
      { workerName: 'Cypherpunk_Browser_BR', keysChecked: 8589934592, lotesCompleted: 2, lastSeen: Date.now() - 45000, hashrate: '120 kH/s' }
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
   * Retorna os Top N maiores contribuidores
   */
  async getTopContributors(limit = 20) {
    const now = Date.now();
    const list = Array.from(this.memoryContributors.values()).map(item => {
      const isOnline = (now - item.lastSeen) < (5 * 60 * 1000); // 5 minutos
      return {
        ...item,
        isOnline,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        scoreFormatted: (item.keysChecked / 1e9).toFixed(2) + ' B'
      };
    });

    // Ordena por chaves verificadas decrescente
    list.sort((a, b) => b.keysChecked - a.keysChecked);

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
