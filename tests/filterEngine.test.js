// =========================================================================
// 🧩 PuzzleRadar v5.0 — Filter Engine Unit Tests
// =========================================================================

const assert = require('assert');
const { filterEngine, FilterEngine } = require('../src/services/filterEngine');

console.log('\n================================================================================');
console.log('🧪 TESTES UNITÁRIOS: MOTOR DE FILTROS ESTATÍSTICOS (filterEngine.test.js)');
console.log('================================================================================\n');

// 1. Teste de contagem de bits (BigInt)
const engine = new FilterEngine();
assert.strictEqual(engine.countSetBitsBigInt(0n), 0);
assert.strictEqual(engine.countSetBitsBigInt(1n), 1);
assert.strictEqual(engine.countSetBitsBigInt(3n), 2);
assert.strictEqual(engine.countSetBitsBigInt(0x400000000000000000n), 1);
assert.strictEqual(engine.countSetBitsBigInt(0x7fffffffffffffffffn), 71);
console.log('  ✅ [PASS] Contagem de bits BigInt (71 bits)');

// 2. Teste de pontuação de Hamming Weight
const optimalMid = 0x4000000ffffffff000n; // Peso moderado
const optimalScore = engine.calculateHammingWeightScore('400000000000000000', '4000000ffffffff000', 71);
assert.ok(optimalScore >= 25, `Score de Hamming esperado >= 25, obtido: ${optimalScore}`);
console.log(`  ✅ [PASS] Hamming Weight para fatia centrada: ${optimalScore}/40`);

// 3. Teste de viés Low-Range
const lowRangeScore = engine.calculateLowRangeScore('400000000000000000', '400800000000000000');
const highRangeScore = engine.calculateLowRangeScore('780000000000000000', '7fffffffffffffffff');
assert.strictEqual(lowRangeScore, 40, 'Primeiro quartil deve receber pontuação máxima (40)');
assert.strictEqual(highRangeScore, 10, 'Quarto quartil deve receber pontuação mínima (10)');
assert.ok(lowRangeScore > highRangeScore, 'Fatia inferior deve pontuar mais que superior');
console.log('  ✅ [PASS] Viés Low-Range: Fatias inferiores pontuam superiormente (40 vs 10)');

// 4. Teste de Priority Score Consolidado
const priorityOptimal = engine.computePriorityScore({
  startHex: '400000000000000000',
  endHex: '400800000000000000',
  isScanned: false,
  puzzleNumber: 71
});
assert.ok(priorityOptimal.score >= 80, `Score consolidado esperado >= 80, obtido: ${priorityOptimal.score}`);
assert.strictEqual(priorityOptimal.unscannedBonus, 20);
assert.ok(priorityOptimal.reason.length > 0);

// 5. Teste de descarte se já escaneado no bitmap
const priorityScanned = engine.computePriorityScore({
  startHex: '400000000000000000',
  endHex: '400800000000000000',
  isScanned: true,
  puzzleNumber: 71
});
assert.strictEqual(priorityScanned.score, 0, 'Fatias já escaneadas devem receber score 0');
assert.strictEqual(priorityScanned.reason, 'PRUNED_ALREADY_SCANNED_PUBLICLY');
console.log('  ✅ [PASS] Priorização e descarte de fatias escaneadas');

console.log('\n🎉 TODOS OS TESTES DE filterEngine.test.js PASSARAM COM SUCESSO!\n');
