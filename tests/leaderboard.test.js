// =========================================================================
// 🧩 PuzzleRadar v5.1 — Leaderboard & Gamification Tests
// =========================================================================

const assert = require('assert');
const { leaderboardService, LeaderboardService } = require('../src/services/leaderboardService');

console.log('\n================================================================================');
console.log('🧪 TESTES: LEADERBOARD & SERVIÇO DE GAMIFICAÇÃO (leaderboard.test.js)');
console.log('================================================================================\n');

async function runLeaderboardTests() {
  const service = new LeaderboardService();

  // 1. Registra contribuição inicial de um minerador
  const w1 = 'TestMiner_Alpha';
  await service.recordContribution(w1, {
    keysChecked: 5000000000,
    isLoteCompleted: true,
    hashrate: '2.5 GH/s'
  });

  const w2 = 'TestMiner_Beta';
  await service.recordContribution(w2, {
    keysChecked: 12000000000,
    isLoteCompleted: true,
    hashrate: '6.0 GH/s'
  });

  // 2. Consulta Top Contributors
  const ranking = await service.getTopContributors(10);
  assert.strictEqual(ranking.success, true);
  assert.ok(ranking.totalContributors >= 2);
  assert.ok(ranking.leaderboard.length >= 2);

  // O minerador Beta com 12B chaves deve estar ranqueado antes do Alpha
  const betaIndex = ranking.leaderboard.findIndex(c => c.workerName === w2);
  const alphaIndex = ranking.leaderboard.findIndex(c => c.workerName === w1);

  assert.ok(betaIndex !== -1 && alphaIndex !== -1);
  assert.ok(betaIndex < alphaIndex, `Beta (${betaIndex}) deve ter posição superior a Alpha (${alphaIndex})`);
  console.log('  ✅ [PASS] Ranking ordenado corretamente por chaves verificadas');

  // 3. Incremento acumulativo de chaves
  await service.recordContribution(w1, {
    keysChecked: 10000000000,
    isLoteCompleted: true
  });
  const updatedRanking = await service.getTopContributors(10);
  const newAlpha = updatedRanking.leaderboard.find(c => c.workerName === w1);
  assert.strictEqual(newAlpha.keysChecked, 15000000000);
  assert.strictEqual(newAlpha.lotesCompleted, 2);
  console.log('  ✅ [PASS] Acúmulo atômico de chaves e fatias concluídas');

  console.log('\n🎉 TODOS OS TESTES DE leaderboard.test.js PASSARAM COM SUCESSO!\n');
}

runLeaderboardTests().catch(err => {
  console.error('❌ Erro no teste de leaderboard:', err);
  process.exit(1);
});
