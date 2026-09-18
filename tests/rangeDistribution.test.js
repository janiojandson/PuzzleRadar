// =========================================================================
// 🧩 PuzzleRadar v5.0 — Range Distribution & Adaptive Lotes Tests
// =========================================================================

const assert = require('assert');
const { loteManager, P71_START, P71_END } = require('../src/services/loteManager');

console.log('\n================================================================================');
console.log('🧪 TESTES: DISTRIBUIÇÃO ADAPTATIVA DE LOTES & BIGINT (rangeDistribution.test.js)');
console.log('================================================================================\n');

async function runRangeDistributionTests() {
  // 1. Teste de alocação de custom_range formatado (18 dígitos hex sem 0x)
  const worker1 = 'rig_4090_01';
  const alloc1 = await loteManager.getNextOptimalRange(worker1, '5 GH/s');

  assert.ok(alloc1.custom_range, 'Deve conter custom_range');
  assert.ok(alloc1.custom_range.includes(':'), 'Formato deve ser START:END');

  const [startHex, endHex] = alloc1.custom_range.split(':');
  assert.strictEqual(startHex.length, 18, `Start hex deve ter exatamente 18 chars, obtido: ${startHex.length}`);
  assert.strictEqual(endHex.length, 18, `End hex deve ter exatamente 18 chars, obtido: ${endHex.length}`);
  assert.ok(!startHex.startsWith('0x'), 'Não deve conter prefixo 0x');
  assert.ok(!endHex.startsWith('0x'), 'Não deve conter prefixo 0x');
  assert.strictEqual(alloc1.pool_conf_line, `custom_range=${alloc1.custom_range}`);
  assert.ok(alloc1.priority_score >= 0 && alloc1.priority_score <= 100);
  console.log(`  ✅ [PASS] Alocação custom_range: ${alloc1.custom_range} (Score: ${alloc1.priority_score})`);

  // 2. Teste de Atribuição Atômica (Workers diferentes recebem fatias distintas)
  const worker2 = 'rig_4090_02';
  const alloc2 = await loteManager.getNextOptimalRange(worker2, '5 GH/s');
  assert.notStrictEqual(alloc1.custom_range, alloc2.custom_range, 'Workers diferentes não podem receber a mesma fatia');
  console.log(`  ✅ [PASS] Atribuição atômica anti-colisão: Worker 1 (${alloc1.lote_id}) != Worker 2 (${alloc2.lote_id})`);

  // 3. Teste de Idempotência para o mesmo worker
  const alloc1Repeat = await loteManager.getNextOptimalRange(worker1, '5 GH/s');
  assert.strictEqual(alloc1.custom_range, alloc1Repeat.custom_range, 'Mesmo worker deve receber o mesmo lote ativo');
  console.log('  ✅ [PASS] Idempotência de worker ativo');

  // 4. Teste de Aritmética BigInt dentro dos limites do Puzzle 71
  const startBig = BigInt('0x' + startHex);
  const endBig = BigInt('0x' + endHex);
  assert.ok(startBig >= P71_START, 'Início deve ser >= P71_START');
  assert.ok(endBig <= P71_END, 'Fim deve ser <= P71_END');
  assert.ok(endBig > startBig, 'Fim deve ser maior que início');
  console.log('  ✅ [PASS] Limites matemáticos BigInt estritos respeitados');

  // 5. Teste de Auto-Reclaim
  const testLote = loteManager.lotes.get(alloc2.lote_id);
  assert.ok(testLote);
  testLote.lastHeartbeat = Date.now() - (35 * 60 * 1000); // 35 minutos atrás
  const reclaimed = loteManager.reclaimExpiredLotes();
  assert.ok(reclaimed >= 1, 'Lote abandonado deve ser devolvido');
  assert.strictEqual(testLote.status, 'pending');
  assert.strictEqual(testLote.assignedWorker, null);
  console.log(`  ✅ [PASS] Auto-reclaim devolveu ${reclaimed} lote(s) expirado(s) para status 'pending'`);

  console.log('\n🎉 TODOS OS TESTES DE rangeDistribution.test.js PASSARAM COM SUCESSO!\n');
}

runRangeDistributionTests().catch(err => {
  console.error('❌ Erro no teste de distribuição:', err);
  process.exit(1);
});
