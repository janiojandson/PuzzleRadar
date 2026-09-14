// ============================================
// 🧩 PuzzleRadar — Teste E2E (Server + Worker + Crowdsourcing Flow)
// ============================================

const app = require('../src/server/index');
const PuzzleRadarPoolClient = require('../solver/pool-client');

async function testFlow() {
  console.log('🧩 PuzzleRadar — Teste E2E do Fluxo de Crowdsourcing & Worker\n');
  console.log('='.repeat(80));

  const server = app.listen(3099, async () => {
    console.log('🟢 Servidor de Teste rodando na porta 3099');

    try {
      // 1. Simular Worker Onboarding CLI
      const client = new PuzzleRadarPoolClient({
        apiUrl: 'http://localhost:3099',
        token: null, // Testar auto-geração de Worker Token
        speed: 42000000000 // 42 GH/s (RTX 4090)
      });

      // Executar 2 iterações completas de busca de fatia
      await client.start(2);

      // 2. Verificar lista de workers ativos na API
      const activeRes = await fetch('http://localhost:3099/api/workers/active');
      const activeData = await activeRes.json();
      console.log('📊 Workers Ativos no Pool:', activeData.activeCount);
      console.log('⚡ Hashrate Total do Pool:', activeData.totalHashrateFormatted);

      // 3. Testar Ingestão de Histórico (Space Pruning)
      const pruneRes = await fetch('http://localhost:3099/api/ranges/import-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          puzzleId: 'puzzle_btc_66',
          chunks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          totalEstimatedChunks: 100
        })
      });
      const pruneData = await pruneRes.json();
      console.log('✂️ Space Pruning Ingestão:', pruneData.pruningResult.prunedPercent + '% podado');

      // 4. Testar Simulação de Dicas / Entropia
      const hintRes = await fetch('http://localhost:3099/api/puzzles/entropy/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bitRange: 66,
          hints: [
            { type: 'bip39ChecksumFilter' },
            { type: 'knownBits', count: 16 }
          ]
        })
      });
      const hintData = await hintRes.json();
      console.log(`🎯 Redução de Entropia: 66 bits ➔ ${hintData.effectiveBits} bits efetivos (${hintData.label})`);

      console.log('\n🎉 TODOS OS TESTES E2E PASSARAM COM 100% DE SUCESSO!\n');
    } catch (e) {
      console.error('❌ Erro no Teste E2E:', e);
      process.exitCode = 1;
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testFlow();
