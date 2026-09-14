// ============================================
// 🧩 PuzzleRadar v3.0 — Motor de Dificuldade, Entropia & Multi-Moedas
// ============================================
// Suporta:
// 1. Redução de Entropia (Máscaras, Prefixos, Sufixos, BIP39 Checksum 93,75%)
// 2. Exploração de Chave Pública Exposta (ECDSA / BSGS / Kangaroo O(sqrt(N)) )
// 3. Multi-Moedas (Bitcoin BTC, Ethereum ETH, Solana SOL)
// ============================================

const DIFFICULTY_THRESHOLDS = {
  EASY:   { min: 0,   max: 400, label: 'FÁCIL',   emoji: '🟢', color: '#22c55e' },
  MEDIUM: { min: 400, max: 600, label: 'MÉDIO',   emoji: '🟡', color: '#eab308' },
  HARD:   { min: 600, max: 800, label: 'DIFÍCIL', emoji: '🔴', color: '#ef4444' },
  EXTREME:{ min: 800, max: Infinity, label: 'EXTREMO', emoji: '⚫', color: '#6b7280' }
};

// Velocidade estimada por hardware (chaves/segundo)
const HARDWARE_SPEEDS = {
  'CPU_i7':           500000,        // ~500K keys/s
  'CPU_Ryzen9':       1000000,       // ~1M keys/s
  'GPU_GTX1660':      2000000000,    // ~2B keys/s
  'GPU_RTX3060':      5000000000,    // ~5B keys/s
  'GPU_RTX3080':      15000000000,   // ~15B keys/s
  'GPU_RTX4090':      42000000000,   // ~42B keys/s
  'COLAB_TESLA_T4':   18000000000,   // ~18B keys/s (Google Colab Free GPU)
  'COLAB_FARM_5x':    90000000000,   // ~90B keys/s (5 contas Colab agregadas)
  'POOL_10x_RTX4090': 420000000000,  // ~420B keys/s
};

/**
 * Converte hex string para BigInt com segurança
 */
function hexToBigInt(hex) {
  if (!hex) return 0n;
  const cleanHex = String(hex).replace(/^0x/i, '').trim();
  if (!cleanHex) return 0n;
  return BigInt('0x' + cleanHex);
}

/**
 * Converte BigInt para hex string
 */
function bigIntToHex(bigIntVal, padLength = 0) {
  let hex = bigIntVal.toString(16);
  if (padLength > hex.length) {
    hex = hex.padStart(padLength, '0');
  }
  return hex;
}

/**
 * Calcula o tamanho do range (número de chaves possíveis)
 */
function calculateRangeSize(rangeStart, rangeEnd) {
  const start = hexToBigInt(rangeStart);
  const end = hexToBigInt(rangeEnd);
  if (end < start) return 0n;
  return end - start + 1n;
}

/**
 * Calcula o log2 aproximado de um BigInt
 */
function log2BigInt(n) {
  if (n <= 0n) return 0;
  let bits = 0n;
  let temp = n;
  while (temp > 0n) {
    temp >>= 1n;
    bits++;
  }
  return Number(bits - 1n);
}

/**
 * Estima o tempo para resolver (em horas) dado um hardware
 */
function estimateTimeHours(effectiveBits, keysPerSecond = HARDWARE_SPEEDS.GPU_RTX4090) {
  if (effectiveBits <= 0) return 0;
  const log2KPS = Math.log2(keysPerSecond);
  const log2Seconds = effectiveBits - log2KPS;
  
  if (log2Seconds <= 0) return 0;
  
  const seconds = Math.pow(2, log2Seconds);
  return seconds / 3600;
}

/**
 * Analisa e calcula a Redução de Entropia com Hints e Vulnerabilidade de Chave Pública Exposta
 * 
 * Se publicKeyExposed === true:
 * A complexidade de busca é reduzida de O(2^N) para O(2^(N/2)) através do algoritmo
 * Baby-Step Giant-Step (BSGS) ou Pollard's Kangaroo.
 * Portanto, effectiveBits = effectiveBits / 2!
 */
function calculateEntropyReduction(hints = [], totalBits = 66, publicKeyExposed = false) {
  let bitsEliminated = 0;
  const appliedHints = [];

  if (Array.isArray(hints)) {
    for (const hint of hints) {
      if (!hint || !hint.type) continue;

      switch (hint.type) {
        case 'fixedPrefix': {
          const hexVal = String(hint.value || '').replace(/^0x/i, '');
          const bits = hexVal.length * 4;
          bitsEliminated += bits;
          appliedHints.push({
            type: 'fixedPrefix',
            description: `Prefixo fixo "0x${hexVal}" (${bits} bits)`,
            bitsEliminated: bits
          });
          break;
        }
        case 'fixedSuffix': {
          const hexVal = String(hint.value || '').replace(/^0x/i, '');
          const bits = hexVal.length * 4;
          bitsEliminated += bits;
          appliedHints.push({
            type: 'fixedSuffix',
            description: `Sufixo fixo "0x${hexVal}" (${bits} bits)`,
            bitsEliminated: bits
          });
          break;
        }
        case 'mask': {
          const mask = String(hint.pattern || '');
          let fixedBits = 0;
          for (const char of mask) {
            if (char !== '?' && char !== 'X' && char !== 'x' && char !== '*') {
              fixedBits += hint.isBinary ? 1 : 4;
            }
          }
          bitsEliminated += fixedBits;
          appliedHints.push({
            type: 'mask',
            description: `Máscara ${mask} (${fixedBits} bits)`,
            bitsEliminated: fixedBits
          });
          break;
        }
        case 'bip39ChecksumFilter': {
          const reductionBits = 4; // Descarte de 15/16 = 93.75% dos estados
          bitsEliminated += reductionBits;
          appliedHints.push({
            type: 'bip39ChecksumFilter',
            description: `Filtro de Checksum BIP39 (Descarte de 93,75% dos estados inválidos - 4 bits)`,
            bitsEliminated: reductionBits,
            discardRatePercent: 93.75
          });
          break;
        }
        case 'knownBits': {
          const count = Math.min(Number(hint.count) || 0, totalBits);
          bitsEliminated += count;
          appliedHints.push({
            type: 'knownBits',
            description: `${count} bits conhecidos`,
            bitsEliminated: count
          });
          break;
        }
      }
    }
  }

  let effectiveBits = Math.max(0, totalBits - bitsEliminated);

  // Aceleração de Chave Pública Exposta (BSGS / Pollard's Kangaroo)
  if (publicKeyExposed) {
    const bsgsSavings = Math.floor(effectiveBits / 2);
    effectiveBits = Math.ceil(effectiveBits / 2); // Redução para O(sqrt(N))
    bitsEliminated += bsgsSavings;
    appliedHints.push({
      type: 'publicKeyExposed_BSGS',
      description: `Aceleração ECDSA BSGS/Kangaroo (Complexidade O(√N) ativada por Chave Pública Exposta)`,
      bitsEliminated: bsgsSavings,
      algorithm: 'Baby-Step Giant-Step (BSGS) / Pollard Kangaroo'
    });
  }

  const entropyReductionRatio = totalBits > 0 ? (bitsEliminated / totalBits) : 0;

  return {
    originalBits: totalBits,
    effectiveBits,
    bitsReduced: bitsEliminated,
    entropyReductionRatio: Math.min(1, Math.max(0, entropyReductionRatio)),
    appliedHints,
    publicKeyExposed: Boolean(publicKeyExposed)
  };
}

/**
 * Validador e gerador do filtro de Checksum BIP39
 */
function isBIP39ChecksumValid(entropy128BitBigInt, checksum4Bit) {
  const { createHash } = require('crypto');
  let hex128 = entropy128BitBigInt.toString(16).padStart(32, '0');
  const buffer = Buffer.from(hex128, 'hex');
  const sha = createHash('sha256').update(buffer).digest();
  const calculatedChecksum = (sha[0] >> 4) & 0x0F;
  return calculatedChecksum === (checksum4Bit & 0x0F);
}

/**
 * Calcula o score de dificuldade completo (com suporte a Hints, ECDSA BSGS e Multi-Moedas)
 */
function calculateDifficultyScore({
  bitRange,
  rangeStart,
  rangeEnd,
  prizeAmount = 0,
  prizeCurrency = 'BTC',
  hints = [],
  publicKey = null,
  publicKeyExposed = false
}) {
  const isKeyExposed = Boolean(publicKeyExposed || (publicKey && String(publicKey).length >= 64));
  const originalLog2Range = bitRange || (rangeStart && rangeEnd ? log2BigInt(calculateRangeSize(rangeStart, rangeEnd)) : 0);
  
  // Calcular redução de entropia
  const entropy = calculateEntropyReduction(hints, originalLog2Range, isKeyExposed);
  const effectiveBits = entropy.effectiveBits;

  // Converter prêmio para BTC equivalente
  let prizeBTC = Number(prizeAmount) || 0;
  if (prizeCurrency === 'ETH') prizeBTC = prizeAmount * 0.05;
  if (prizeCurrency === 'SOL') prizeBTC = prizeAmount * 0.002;
  
  // Tempo estimado com 1x RTX 4090 e com Google Colab Tesla T4
  const estimatedHours = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.GPU_RTX4090);
  const estimatedHoursColabT4 = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.COLAB_TESLA_T4);
  const estimatedHoursColabFarm5x = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.COLAB_FARM_5x);
  
  // Score balanceado
  const difficultyComponent = effectiveBits * 10;
  const prizeComponent = Math.min(prizeBTC * 10, 100);
  const timePenalty = Math.min(Math.log10(estimatedHours + 1) * 50, 500);
  const score = Math.max(0, difficultyComponent + prizeComponent - timePenalty);
  
  // Classificação
  let difficulty;
  if (score < 400) difficulty = 'EASY';
  else if (score < 600) difficulty = 'MEDIUM';
  else if (score < 800) difficulty = 'HARD';
  else difficulty = 'EXTREME';
  
  return {
    score: Math.round(score * 100) / 100,
    difficulty,
    label: DIFFICULTY_THRESHOLDS[difficulty].label,
    emoji: DIFFICULTY_THRESHOLDS[difficulty].emoji,
    color: DIFFICULTY_THRESHOLDS[difficulty].color,
    originalBits: originalLog2Range,
    effectiveBits,
    bitsReduced: entropy.bitsReduced,
    entropyReductionRatio: (entropy.entropyReductionRatio * 100).toFixed(2) + '%',
    appliedHints: entropy.appliedHints,
    publicKeyExposed: isKeyExposed,
    estimatedHoursRTX4090: estimatedHours,
    estimatedDaysRTX4090: estimatedHours / 24,
    estimatedYearsRTX4090: estimatedHours / 8760,
    estimatedHoursColabT4,
    estimatedHoursColabFarm5x,
    viabilityCPU: effectiveBits <= 40,
    viabilityGPU: effectiveBits <= 55,
    viabilityColabFarm: effectiveBits <= 60,
    viabilityPool: effectiveBits <= 70,
    recommendedStrategy: effectiveBits <= 40 ? 'CPU_BRUTE' : 
                          effectiveBits <= 55 ? 'GPU_COLAB_FREE' :
                          effectiveBits <= 60 ? 'COLAB_FARM_AGGREGATOR' :
                          effectiveBits <= 70 ? 'POOL_RANGE_SPLIT' : 'KANGAROO_BSGS'
  };
}

/**
 * Puzzles Multi-Moedas e Bitcoin Puzzle Transaction
 */
function getMultiChainPuzzleData() {
  const btcPuzzles = [
    { chain: 'BTC', num: 1, bits: 1, prize: 0.0001, solved: true, targetAddress: '1BgGsCmBsjCgV3R4c9wK2cZzG4LwL4jz2r' },
    { chain: 'BTC', num: 30, bits: 30, prize: 0.0001, solved: true, targetAddress: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { chain: 'BTC', num: 40, bits: 40, prize: 0.0001, solved: true, targetAddress: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { chain: 'BTC', num: 65, bits: 65, prize: 6.6, solved: true, targetAddress: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { chain: 'BTC', num: 66, bits: 66, prize: 6.6, solved: false, targetAddress: '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so', publicKeyExposed: false },
    { chain: 'BTC', num: 67, bits: 67, prize: 6.6, solved: false, targetAddress: '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9' },
    { chain: 'BTC', num: 68, bits: 68, prize: 6.6, solved: false, targetAddress: '1MVDYgVaSN6iKKEsbzRUAYFhNJT1eLf2E3' },
    { chain: 'BTC', num: 70, bits: 70, prize: 6.6, solved: false, targetAddress: '19YZECXj3SxEZMoUeJ1yiPsw8xANe7M7QR' },
  ];

  const ethPuzzles = [
    {
      chain: 'ETH',
      num: 101,
      title: 'Ethereum Vanity #32',
      bits: 32,
      prize: 0.5,
      prizeCurrency: 'ETH',
      solved: true,
      targetAddress: '0x000000000000000000000000000000000000dead',
      publicKey: '0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
      publicKeyExposed: true
    },
    {
      chain: 'ETH',
      num: 102,
      title: 'Ethereum Smart Contract Challenge #48',
      bits: 48,
      prize: 2.0,
      prizeCurrency: 'ETH',
      solved: false,
      targetAddress: '0x3535353535353535353535353535353535353535',
      publicKeyExposed: false
    }
  ];

  const solPuzzles = [
    {
      chain: 'SOL',
      num: 201,
      title: 'Solana Vanity Key Challenge #36',
      bits: 36,
      prize: 15.0,
      prizeCurrency: 'SOL',
      solved: false,
      targetAddress: 'SoL1111111111111111111111111111111111111111',
      publicKeyExposed: false
    }
  ];

  const all = [...btcPuzzles, ...ethPuzzles, ...solPuzzles];
  return all.map(p => {
    const rangeStart = (1n << BigInt(p.bits - 1)).toString(16);
    const rangeEnd = ((1n << BigInt(p.bits)) - 1n).toString(16);
    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      rangeStart,
      rangeEnd,
      prizeAmount: p.prize,
      prizeCurrency: p.prizeCurrency || p.chain,
      publicKey: p.publicKey,
      publicKeyExposed: p.publicKeyExposed
    });
    return {
      puzzleNumber: p.num,
      title: p.title || `${p.chain} Puzzle #${p.num}`,
      chain: p.chain,
      bits: p.bits,
      prize: p.prize,
      prizeCurrency: p.prizeCurrency || p.chain,
      solved: p.solved,
      targetAddress: p.targetAddress,
      rangeStart,
      rangeEnd,
      ...diff
    };
  });
}

function getBitcoinPuzzleData() {
  return getMultiChainPuzzleData();
}

/**
 * Divide um range em N sub-ranges
 */
function splitRange(rangeStart, rangeEnd, numSplits = 10, hints = []) {
  const start = hexToBigInt(rangeStart);
  const end = hexToBigInt(rangeEnd);
  const totalRange = end - start + 1n;
  if (totalRange <= 0n) return [];

  const splitsCount = BigInt(Math.max(1, numSplits));
  const chunkSize = totalRange / splitsCount;
  
  const splits = [];
  for (let i = 0n; i < splitsCount; i++) {
    const chunkStart = start + chunkSize * i;
    const chunkEnd = (i === splitsCount - 1n) ? end : (chunkStart + chunkSize - 1n);
    
    splits.push({
      index: Number(i),
      rangeStart: bigIntToHex(chunkStart),
      rangeEnd: bigIntToHex(chunkEnd),
      size: (chunkEnd - chunkStart + 1n).toString()
    });
  }
  
  return splits;
}

/**
 * Calcula divisão de prêmios
 */
function calculatePrizeSplit(contributions = [], totalPrize = 0, currency = 'BTC') {
  const totalShares = contributions.reduce((sum, c) => sum + (Number(c.shares) || 0), 0);
  if (totalShares === 0) return [];
  
  return contributions.map(c => ({
    userId: c.userId,
    username: c.username,
    shares: c.shares,
    sharePercent: ((c.shares / totalShares) * 100).toFixed(2),
    prizeAmount: ((c.shares / totalShares) * totalPrize).toFixed(8),
    currency
  }));
}

module.exports = {
  calculateDifficultyScore,
  calculateEntropyReduction,
  isBIP39ChecksumValid,
  calculatePrizeSplit,
  splitRange,
  getBitcoinPuzzleData,
  getMultiChainPuzzleData,
  DIFFICULTY_THRESHOLDS,
  HARDWARE_SPEEDS,
  hexToBigInt,
  bigIntToHex,
  log2BigInt,
  estimateTimeHours
};