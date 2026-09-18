// =========================================================================
// 🧩 PuzzleRadar v5.0 — Rate Limit & Cache TTL Unit Tests
// =========================================================================

const assert = require('assert');
const { dataAggregator, DataAggregator } = require('../src/services/dataAggregator');

console.log('\n================================================================================');
console.log('🧪 TESTES: RATE LIMIT & CACHE TTL EXTERNO (rateLimit.test.js)');
console.log('================================================================================\n');

async function runRateLimitTests() {
  const aggregator = new DataAggregator();

  // Injetar dados no cache para teste controlado
  aggregator.cache.btcpuzzle.set('71', {
    data: { puzzle: 71, scannedRanges: [{ start: '400000000000000000', end: '400800000000000000' }] },
    timestamp: Date.now()
  });

  // 1. Teste de resposta a partir de cache dentro do TTL (sem incremento de rede)
  const cachedRes = await aggregator.fetchBtcpuzzleRanges(71);
  assert.strictEqual(cachedRes.success, true);
  assert.strictEqual(cachedRes.source, 'CACHE');
  assert.strictEqual(aggregator.requestCounts.btcpuzzle, 0, 'Não deve fazer requisição de rede se cache estiver ativo');
  console.log('  ✅ [PASS] Cache TTL respeitado sem requisições desnecessárias');

  // 2. Teste de conformidade de orçamento de taxa
  const stats = aggregator.getRateLimitStats();
  assert.ok(stats.rateLimitMaxPerHour === 60);
  assert.strictEqual(stats.btcpuzzleReqs, 0);
  assert.strictEqual(stats.safeBudgetUsedPercent, 0);
  console.log('  ✅ [PASS] Métricas de conformidade com limite de 60 req/hora');

  // 3. Teste de cache theCollider
  aggregator.cache.theCollider = {
    data: { puzzles: { 71: { solved: false } } },
    timestamp: Date.now()
  };
  const colliderCached = await aggregator.syncTheColliderRanges();
  assert.strictEqual(colliderCached.success, true);
  assert.strictEqual(colliderCached.source, 'CACHE');
  assert.strictEqual(aggregator.requestCounts.theCollider, 0);
  console.log('  ✅ [PASS] Cache theCollider funcional');

  console.log('\n🎉 TODOS OS TESTES DE rateLimit.test.js PASSARAM COM SUCESSO!\n');
}

runRateLimitTests().catch(err => {
  console.error('❌ Erro no teste de rate limit:', err);
  process.exit(1);
});
