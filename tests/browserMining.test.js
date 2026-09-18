// =========================================================================
// 🧩 PuzzleRadar v5.1 — Browser Web Mining Unit Tests
// =========================================================================

const assert = require('assert');
const { loteManager, STEP_MICRO } = require('../src/services/loteManager');

console.log('\n================================================================================');
console.log('🧪 TESTES: MICRO-LOTES & WEB BROWSER MINING (browserMining.test.js)');
console.log('================================================================================\n');

async function runBrowserMiningTests() {
  const browserWorker = 'web_miner_chrome_test';

  // 1. Solicita lote com flag client=browser
  const lote = await loteManager.getNextOptimalRange(browserWorker, '150 kH/s', true);

  assert.ok(lote.custom_range, 'Deve conter custom_range');
  const [startStr, endStr] = lote.custom_range.split(':');
  const startBig = BigInt('0x' + startStr);
  const endBig = BigInt('0x' + endStr);
  const span = endBig - startBig;

  assert.strictEqual(span, STEP_MICRO, `Span do lote web deve ser exatamente STEP_MICRO (2^32 = 4294967296), obtido: ${span}`);
  assert.strictEqual(startStr.length, 18);
  assert.strictEqual(endStr.length, 18);
  console.log(`  ✅ [PASS] Micro-lote atribuído para browser: ${lote.custom_range} (Span: ${span} chaves)`);

  // 2. Testa resolução de step para hashrates leves
  const stepLowHashrate = loteManager._resolveStepByHashrate('200 kH/s');
  assert.strictEqual(stepLowHashrate, STEP_MICRO, 'Hashrate em kH/s deve mapear para STEP_MICRO');
  console.log('  ✅ [PASS] Hashrate baixo (< 50 MH/s) mapeado automaticamente para STEP_MICRO');

  console.log('\n🎉 TODOS OS TESTES DE browserMining.test.js PASSARAM COM SUCESSO!\n');
}

runBrowserMiningTests().catch(err => {
  console.error('❌ Erro no teste de browser mining:', err);
  process.exit(1);
});
