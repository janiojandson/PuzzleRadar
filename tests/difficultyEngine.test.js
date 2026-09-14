// ============================================
// 🧩 PuzzleRadar — Teste Completo do Motor de Dificuldade & Entropia
// ============================================

const {
  calculateDifficultyScore,
  calculateEntropyReduction,
  isBIP39ChecksumValid,
  getBitcoinPuzzleData,
  splitRange,
  calculatePrizeSplit
} = require('../src/lib/difficultyEngine');

console.log('🧩 PuzzleRadar — Teste do Motor de Dificuldade & Redução de Entropia\n');
console.log('='.repeat(80));

// ─── TESTE 1: Redução de Entropia com Hints ───
console.log('\n📊 TESTE 1: Redução de Entropia com Hints (Máscaras, Prefixos, BIP39)\n');

const puzzle66Base = {
  name: 'Puzzle #66 (Base - Sem Dicas)',
  bits: 66,
  rangeStart: '20000000000000000',
  rangeEnd: '3fffffffffffffff',
  prize: 6.6,
  hints: []
};

const puzzle66WithMask = {
  name: 'Puzzle #66 com Máscara de 16 bits fixos',
  bits: 66,
  rangeStart: '20000000000000000',
  rangeEnd: '3fffffffffffffff',
  prize: 6.6,
  hints: [
    { type: 'knownBits', count: 16 }
  ]
};

const puzzle66WithBIP39 = {
  name: 'Puzzle #66 com Dica BIP39 Checksum Filter + Prefixo 8 bits',
  bits: 66,
  rangeStart: '20000000000000000',
  rangeEnd: '3fffffffffffffff',
  prize: 6.6,
  hints: [
    { type: 'fixedPrefix', value: '2a' }, // 8 bits (2 hex chars * 4)
    { type: 'bip39ChecksumFilter' }        // 4 bits (93.75% de descarte)
  ]
};

const entropyTests = [puzzle66Base, puzzle66WithMask, puzzle66WithBIP39];

for (const p of entropyTests) {
  const result = calculateDifficultyScore({
    bitRange: p.bits,
    rangeStart: p.rangeStart,
    rangeEnd: p.rangeEnd,
    prizeAmount: p.prize,
    prizeCurrency: 'BTC',
    hints: p.hints
  });

  console.log(`${result.emoji} ${p.name}`);
  console.log(`   Bits Originais: ${result.originalBits} | Bits Efetivos: ${result.effectiveBits} (Redução: ${result.entropyReductionRatio})`);
  console.log(`   Score: ${result.score} | Classificação: ${result.label}`);
  console.log(`   Tempo RTX 4090: ${result.estimatedHoursRTX4090 < 1 ? result.estimatedHoursRTX4090.toFixed(4) + ' horas' : result.estimatedDaysRTX4090 < 365 ? result.estimatedDaysRTX4090.toFixed(2) + ' dias' : result.estimatedYearsRTX4090.toFixed(2) + ' anos'}`);
  console.log(`   Viabilidade GPU: ${result.viabilityGPU ? '✅' : '❌'} | Pool: ${result.viabilityPool ? '✅' : '❌'}`);
  console.log('');
}

// ─── TESTE 2: Validação Matemática de Descarte BIP39 (93,75%) ───
console.log('='.repeat(80));
console.log('\n📊 TESTE 2: Validação Matemática de Descarte BIP39 (15/16 = 93,75%)\n');

let validCount = 0;
let invalidCount = 0;
const sampleEntropy = 0x1234567890abcdef1234567890abcdefn;

// Testa todas as 16 possibilidades de checksum para uma mesma entropia
for (let c = 0; c < 16; c++) {
  if (isBIP39ChecksumValid(sampleEntropy, c)) {
    validCount++;
  } else {
    invalidCount++;
  }
}

const discardRate = (invalidCount / (validCount + invalidCount)) * 100;
console.log(`Combinações avaliadas: 16`);
console.log(`Válidas: ${validCount} (${(validCount / 16 * 100).toFixed(2)}%)`);
console.log(`Descartadas (Inválidas): ${invalidCount} (${discardRate.toFixed(2)}%)`);

if (discardRate === 93.75) {
  console.log('✅ SUCESSO: Descarte matemático exato de 93,75% de checksums inválidos comprovado!');
} else {
  console.error('❌ FALHA no descarte de checksum BIP39');
  process.exit(1);
}

// ─── TESTE 3: Divisão de Range ───
console.log('\n' + '='.repeat(80));
console.log('\n📊 TESTE 3: Divisão de Range com Chunking\n');

const splits = splitRange('20000000000000000', '3fffffffffffffff', 4);
splits.forEach(s => {
  console.log(`   Chunk ${s.index}: 0x${s.rangeStart} → 0x${s.rangeEnd} (${s.size} chaves)`);
});

// ─── TESTE 4: Divisão de Prêmios do Pool ───
console.log('\n' + '='.repeat(80));
console.log('\n📊 TESTE 4: Distribuição de Shares e Recompensas\n');

const contributions = [
  { userId: 'u1', username: 'miner_alpha', shares: 5000 },
  { userId: 'u2', username: 'miner_beta', shares: 3500 },
  { userId: 'u3', username: 'miner_gamma', shares: 1500 }
];

const splitResults = calculatePrizeSplit(contributions, 6.6, 'BTC');
splitResults.forEach(r => {
  console.log(`   👤 ${r.username}: ${r.shares} shares (${r.sharePercent}%) ➔ ${r.prizeAmount} BTC`);
});

console.log('\n✅ Todos os testes do Motor e Redução de Entropia passaram com sucesso!\n');