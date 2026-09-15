// =========================================================================
// 🧩 PuzzleRadar — On-Chain Watcher & Auto-Revocation Sentinel (Mempool & Multi-Chain)
// =========================================================================
// Monitora em tempo real a blockchain (Mempool.space e RPCs) para os alvos prioritários.
// Se spent_txo_count > 0 ou balanço = 0 for detectado (saque efetuado), o sentinela:
// 1. Atualiza o status do puzzle para SOLVED no banco/memória.
// 2. Dispara sinal via Redis PUB/SUB / EventBus para cancelar e revogar chunks imediatamente.
// 3. Reorienta a frota para o próximo alvo matematicamente viável.
// =========================================================================

const https = require('https');
const http = require('http');
const EventEmitter = require('events');
const { redisClient } = require('../lib/redis');

class OnChainWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.intervalMs = options.intervalMs || 45000; // 45 segundos padrão
    this.timer = null;
    this.isRunning = false;
    this.watchedTargets = new Map(); // address => targetInfo
    this.lastCheckedState = new Map(); // address => { spentTxoCount, balance, solved }
  }

  /**
   * Adiciona um endereço/puzzle à lista vigiada
   */
  addTarget(target) {
    if (!target || !target.address) return;
    this.watchedTargets.set(target.address, {
      puzzleNumber: target.puzzleNumber || target.num || target.id,
      challengeId: target.challengeId || target.id || `BTC_1000_P${target.puzzleNumber || 71}`,
      chain: target.chain || 'BTC',
      address: target.address,
      expectedPrize: target.prize || target.prizeBtc || 0,
      priority: target.priority || 1
    });
  }

  /**
   * Registra lista inicial de alvos prioritários (Puzzles ativos #71 a #80 e Multi-Chain)
   */
  initDefaultTargets() {
    const defaultPuzzles = [
      { puzzleNumber: 71, address: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU', chain: 'BTC', prize: 7.1 },
      { puzzleNumber: 72, address: '1JTK7s9YVYwBH5JBQHvBmDDH3nTdcHNbWz', chain: 'BTC', prize: 7.2 },
      { puzzleNumber: 73, address: '12VVRNPi4SJqUTsp6FmqDqY5SAGBXoXGj6', chain: 'BTC', prize: 7.3 },
      { puzzleNumber: 74, address: '1FWGcL4JuPdVsSpY6RhXRz7BqUvBsWzQEP', chain: 'BTC', prize: 7.4 },
      { puzzleNumber: 76, address: '1Eb6eqmSQBvnrXmgkRBCtGgqiqSZHBw5m1', chain: 'BTC', prize: 7.6 },
      { puzzleNumber: 77, address: '1A67JyP11ZsKjhTiD4T5M2z2mwF5QzVfU3', chain: 'BTC', prize: 7.7 },
      { puzzleNumber: 78, address: '17uCjtzB5D34t8bMsn2B4E9A4B3QeR5t6Y', chain: 'BTC', prize: 7.8 },
      { puzzleNumber: 79, address: '18y6K9P4k7mQ2BvC6L1Z4xN8M9K3P5Q7R', chain: 'BTC', prize: 7.9 },
      { puzzleNumber: 80, address: '1Fo65aKq8s8iquMt6weF1rku1moWVEd68U', chain: 'BTC', prize: 8.0 },
      // Multi-Chain targets
      { challengeId: 'BTC_SATOSHI_NONCE_REUSE', address: '15dTwY2K7XjY83j3eTcxL5LwA7hX5N3DqX', chain: 'BTC', prize: 1.20 }
    ];

    defaultPuzzles.forEach(p => this.addTarget(p));
  }

  /**
   * Consulta a API do Mempool.space para endereços Bitcoin
   */
  async checkMempoolBtcAddress(address) {
    return new Promise((resolve) => {
      const url = `https://mempool.space/api/address/${address}`;
      const req = https.get(url, { headers: { 'User-Agent': 'PuzzleRadar-Sentinel/3.0' }, timeout: 10000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(body);
              const chainSpent = data.chain_stats ? data.chain_stats.spent_txo_count : 0;
              const mempoolSpent = data.mempool_stats ? data.mempool_stats.spent_txo_count : 0;
              const funded = data.chain_stats ? data.chain_stats.funded_txo_sum : 0;
              const spentSum = data.chain_stats ? data.chain_stats.spent_txo_sum : 0;
              const balanceSatoshis = Math.max(0, funded - spentSum);

              const isDrained = (chainSpent > 0 || mempoolSpent > 0 || balanceSatoshis === 0);
              resolve({
                success: true,
                address,
                spentTxoCount: chainSpent + mempoolSpent,
                balanceSatoshis,
                balanceBtc: balanceSatoshis / 1e8,
                isDrained,
                raw: data
              });
            } else {
              resolve({ success: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` });
            }
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'TIMEOUT' });
      });
    });
  }

  /**
   * Executa uma rodada de checagem on-chain de todos os alvos vigiados
   */
  async checkAllTargets() {
    for (const [address, target] of this.watchedTargets.entries()) {
      if (target.chain === 'BTC') {
        try {
          const res = await this.checkMempoolBtcAddress(address);
          if (res.success) {
            const prevState = this.lastCheckedState.get(address);
            this.lastCheckedState.set(address, {
              spentTxoCount: res.spentTxoCount,
              balanceBtc: res.balanceBtc,
              isDrained: res.isDrained,
              lastChecked: new Date().toISOString()
            });

            // Se detectou saque ou resolução no mempool / on-chain
            if (res.isDrained && (!prevState || !prevState.isDrained)) {
              console.warn(`🚨 [OnChainWatcher] ALERTA: Puzzle ${target.challengeId} (${address}) foi drenado/resolvido on-chain!`);
              await this.handleTargetDrained(target, res);
            }
          }
        } catch (err) {
          console.warn(`⚠️ [OnChainWatcher] Falha ao verificar alvo ${address}:`, err.message);
        }
      }
    }
  }

  /**
   * Dispara revogação e cancelamento de chunks via Redis PUB/SUB e atualiza estado
   */
  async handleTargetDrained(target, onChainData) {
    const payload = {
      event: 'PUZZLE_SOLVED_ON_CHAIN',
      challengeId: target.challengeId,
      puzzleNumber: target.puzzleNumber,
      address: target.address,
      chain: target.chain,
      spentTxoCount: onChainData.spentTxoCount,
      timestamp: new Date().toISOString(),
      action: 'REVOKE_ACTIVE_CHUNKS'
    };

    // 1. Emite evento interno do processo
    this.emit('puzzle_solved_onchain', payload);

    // 2. Dispara mensagem de cancelamento no canal Redis PUB/SUB para todos os workers conectados
    try {
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.publish('puzzleradar:channel:revocations', JSON.stringify(payload));
        // Registra blacklist de chunk allocation para este puzzle
        await redisClient.set(`puzzleradar:status:${target.challengeId}`, 'SOLVED');
        console.log(`📡 [OnChainWatcher] Sinal de revogação transmitido no canal Redis para ${target.challengeId}`);
      }
    } catch (err) {
      console.warn('⚠️ [OnChainWatcher] Erro ao publicar revogação no Redis:', err.message);
    }
  }

  /**
   * Inicia o serviço do Sentinela
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.initDefaultTargets();
    console.log(`🛡️ [OnChainWatcher] Sentinela On-Chain iniciado. Vigiando ${this.watchedTargets.size} alvos a cada ${this.intervalMs / 1000}s.`);
    
    // Execução inicial
    this.checkAllTargets();

    // Loop agendado
    this.timer = setInterval(() => {
      this.checkAllTargets();
    }, this.intervalMs);
  }

  /**
   * Para o serviço
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('🛡️ [OnChainWatcher] Sentinela On-Chain pausado.');
  }

  /**
   * Retorna o resumo do estado atual dos alvos vigiados
   */
  getStatusSummary() {
    const list = [];
    for (const [address, target] of this.watchedTargets.entries()) {
      const state = this.lastCheckedState.get(address) || { spentTxoCount: 0, balanceBtc: target.expectedPrize, isDrained: false };
      list.push({
        ...target,
        ...state
      });
    }
    return {
      activeWatcher: this.isRunning,
      intervalSeconds: this.intervalMs / 1000,
      totalWatched: this.watchedTargets.size,
      targets: list
    };
  }
}

// Instância única singleton
const onChainWatcher = new OnChainWatcher();

module.exports = {
  OnChainWatcher,
  onChainWatcher
};
