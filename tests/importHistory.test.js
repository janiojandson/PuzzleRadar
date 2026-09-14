// ============================================
// 🧩 PuzzleRadar — Teste de Space Pruning & Importação de Histórico
// ============================================

const { markChunkScanned, isChunkScanned, bulkImportHistory, getPruningStats } = require('../src/lib/redis');

async function runTest() {
  console.log('🧩 PuzzleRadar — Teste de Ingestão de Histórico (Space Pruning)\n');
  console.log('='.repeat(80));

  const testPuzzleId = 'puzzle_btc_66';

  // 1. Marcação individual
  await markChunkScanned(testPuzzleId, 42);
  const is42Scanned = await isChunkScanned(testPuzzleId, 42);
  const is99Scanned = await isChunkScanned(testPuzzleId, 99);

  console.log(`Chunk #42 escaneado? ${is42Scanned ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`Chunk #99 escaneado? ${is99Scanned ? '✅ SIM' : '❌ NÃO (Disponível)'}`);

  // 2. Ingestão em lote de pools públicas (ex: ranges 100 a 250 testados no passado)
  const pastRangesFromOtherPools = [];
  for (let i = 100; i <= 250; i++) {
    pastRangesFromOtherPools.push(i);
  }

  const importResult = await bulkImportHistory(testPuzzleId, pastRangesFromOtherPools, 1000);

  console.log('\n📊 Resultado da Ingestão de Histórico em Lote:');
  console.log(`   Ranges importados: ${importResult.importedCount}`);
  console.log(`   Total no espaço: ${importResult.totalChunks}`);
  console.log(`   Fatias descartadas (Pruned): ${importResult.scannedChunks}`);
  console.log(`   Fatias restantes a minerar: ${importResult.remainingChunks}`);
  console.log(`   Espaço podado: ${importResult.prunedPercent}%`);

  const stats = await getPruningStats(testPuzzleId, 1000);
  console.log(`\n✅ Status do Bitmap: ${stats.status} (${stats.prunedPercent}% descartado)`);

  if (importResult.scannedChunks >= 151 && is42Scanned && !is99Scanned) {
    console.log('\n🎉 Teste de Space Pruning CONCLUÍDO COM SUCESSO!');
  } else {
    console.error('\n❌ Erro no teste de Space Pruning');
    process.exit(1);
  }
}

runTest().catch(console.error);
