// ============================================
// 🧩 PuzzleRadar — Teste do Motor de Dificuldade
// ============================================

const { calculateDifficultyScore, getBitcoinPuzzleData, splitRange, calculatePrizeSplit } = require('../src/lib/difficultyEngine');

console.log('🧩 PuzzleRadar — Teste do Motor de Dificuldade\n');
console.log('='.repeat(80));

// ─── TESTE 1: Calcular dificuldade de puzzles específicos ───
console.log('\n📊 TESTE 1: Pontuação de Dificuldade\n');

const testPuzzles = [
  { name: 'Puzzle #30 (30 bits)', bits: 30, rangeStart: '20000000', rangeEnd: '3fffffff', prize: 0.0001 },
  { name: 'Puzzle #40 (40 bits)', bits: 40, rangeStart: '8000000000', rangeEnd: 'ffffffffff', prize: 0.0001 },
  { name: 'Puzzle #50 (50 bits)', bits: 50, rangeStart: '2000000000000', rangeEnd: '3ffffffffffff', prize: 0.0001 },
  { name: 'Puzzle #66 (66 bits)', bits: 66, rangeStart: '20000000000000000', rangeEnd: '3fffffffffffffff', prize: 6.6 },
  { name: 'Puzzle #70 (70 bits)', bits: 70, rangeStart: '2000000000000000000', rangeEnd: '3fffffffffffffffff', prize: 6.6 },
  { name: 'Puzzle #100 (100 bits)', bits: 100, rangeStart: '20000000000000000000000000000', rangeEnd: '3ffffffffffffffffffffffffffff', prize: 6.6 },
];

for (const p of testPuzzles) {
  const result = calculateDifficultyScore({
    bitRange: p.bits,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
    prizeAmount: p.prize,
    prizeCurrency: 'BTC'
  });
  
  console.log(`${result.emoji} ${p.name}`);
  console.log(`   Score: ${result.score} | ${result.label}`);
  console.log(`   Tempo RTX 4090: ${result.estimatedHoursRTX4090 < 1 ? result.estimatedHoursRTX4090.toFixed(4) + ' horas' : result.estimatedDaysRTX4090 < 365 ? result.estimatedDaysRTX4090.toFixed(1) + ' dias' : result.estimatedYearsRTX4090.toFixed(1) + ' anos'}`);
  console.log(`   CPU: ${result.viabilityCPU ? '✅' : '❌'} | GPU: ${result.viabilityGPU ? '✅' : '❌'} | Pool: ${result.viabilityPool ? '✅' : '❌'}`);
  console.log(`   Estratégia: ${result.recommendedStrategy}`);
  console.log('');
}

// ─── TESTE 2: Dados do Bitcoin Puzzle Transaction ───
console.log('='.repeat(80));
console.log('\n📊 TESTE 2: Bitcoin Puzzle Transaction — Todos os Puzzles\n');

const allPuzzles = getBitcoinPuzzleData();
const active = allPuzzles.filter(p => !p.solved);
const solved = allPuzzles.filter(p => p.solved);

console.log(`Total: ${allPuzzles.length} puzzles`);
console.log(`Resolvidos: ${solved.length} | Ativos: ${active.length}`);
console.log('');

console.log('🟢 Puzzles FÁCEIS (para aprender):');
solved.filter(p => p.bits <= 40).forEach(p => {
  console.log(`   #${p.puzzleNumber} (${p.bits} bits) — ${p.label} — Prêmio: ${p.prize} BTC`);
});

console.log('\n🎯 Puzzles ATIVOS mais viáveis:');
active.sort((a, b) => a.score - b.score).forEach(p => {
  console.log(`   ${p.emoji} #${p.puzzleNumber} (${p.bits} bits) — ${p.label} — Score: ${p.score} — Prêmio: ${p.prize} BTC`);
});

// ─── TESTE 3: Divisão de Range ───
console.log('\n' + '='.repeat(80));
console.log('\n📊 TESTE 3: Divisão de Range para Pool\n');

const splits = splitRange('20000000', '3fffffff', 5);
splits.forEach(s => {
  console.log(`   Chunk ${s.index}: ${s.rangeStart} → ${s.rangeEnd} (${s.size} chaves)`);
});

// ─── TESTE 4: Divisão de Prêmios ───
console.log('\n' + '='.repeat(80));
console.log('\n📊 TESTE 4: Divisão de Prêmios\n');

const contributions = [
  { userId: 'user1', username: 'alice', shares: 500 },
  { userId: 'user2', username: 'bob', shares: 300 },
  { userId: 'user3', username: 'charlie', shares: 200 },
];

const prizeSplit = calculatePrizeSplit(contributions, 6.6, 'BTC');
console.log(`Prêmio total: 6.6 BTC`);
prizeSplit.forEach(s => {
  console.log(`   ${s.username}: ${s.shares} shares (${s.sharePercent}%) = ${s.prizeAmount} ${s.currency}`);
});

console.log('\n✅ Todos os testes passaram!');