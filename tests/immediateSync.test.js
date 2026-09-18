// =========================================================================
// 🧪 TESTES: SEEDER IMEDIATO & DISTRIBUIÇÃO SEM ATRASO (immediateSync.test.js)
// =========================================================================

const assert = require('assert');
const { loteManager, P71_START, P71_END, STEP_MICRO } = require('../src/services/loteManager');

console.log('\n================================================================================');
console.log('🧪 TESTES: SEEDER IMEDIATO & DISTRIBUIÇÃO INSTANTÂNEA DE LOTES (immediateSync.test.js)');
console.log('================================================================================\n');

async function runTests() {
  try {
    // 1. Validação de Lotes Semente no Boot
    const stats = loteManager.getStats(71);
    assert(stats.totalLotes >= 256, 'Deve inicializar no boot com ao menos 256 fatias semente');
    assert.strictEqual(stats.keyspaceStart, P71_START.toString(16).padStart(18, '0'), 'Keyspace start deve ser 71 bits exato');
    assert.strictEqual(stats.keyspaceEnd, P71_END.toString(16).padStart(18, '0'), 'Keyspace end deve ser 71 bits exato');
    console.log(`  ✅ [PASS] Boot Seeder ativo com ${stats.totalLotes} fatias prontas (Start: 0x${stats.keyspaceStart})`);

    // 2. Entrega Imediata de Micro-Lote para Browser
    const startReqTime = Date.now();
    const browserLote = await loteManager.getNextOptimalRange('web_fast_miner_01', '120 kH/s', true);
    const elapsedMs = Date.now() - startReqTime;

    assert(browserLote, 'Resposta do lote não pode ser nula');
    assert(browserLote.custom_range, 'Deve conter a propriedade custom_range');
    assert(elapsedMs < 100, `Entrega deve ser instantânea (< 100ms), levou ${elapsedMs}ms`);

    const [startHex, endHex] = browserLote.custom_range.split(':');
    assert.strictEqual(startHex.length, 18, 'Start hex deve ter exatamente 18 dígitos');
    assert.strictEqual(endHex.length, 18, 'End hex deve ter exatamente 18 dígitos');

    const span = BigInt('0x' + endHex) - BigInt('0x' + startHex);
    assert.strictEqual(span, STEP_MICRO, `O passo para browser deve ser exatamente STEP_MICRO (2^32), obtido: ${span}`);
    console.log(`  ✅ [PASS] Micro-Lote entregue em ${elapsedMs}ms: ${browserLote.custom_range} (Span: 2^32)`);

    // 3. Persistência de Atribuição e Idempotência de Chamadas Seguidas
    const repeatLote = await loteManager.getNextOptimalRange('web_fast_miner_01', '120 kH/s', true);
    assert.strictEqual(repeatLote.custom_range, browserLote.custom_range, 'Worker ativo deve manter o mesmo lote até conclusão');
    console.log('  ✅ [PASS] Atribuição idempotente mantida para worker ativo');

    console.log('\n🎉 TODOS OS TESTES DE immediateSync.test.js PASSARAM COM SUCESSO!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [FAIL] Erro no teste immediateSync:', err.message);
    process.exit(1);
  }
}

runTests();
