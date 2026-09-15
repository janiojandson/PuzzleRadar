// ============================================
// 🧩 PuzzleRadar v3.0 — Motor de Dificuldade, Entropia & Multi-Moedas
// ============================================

const { getAll160Puzzles } = require('./puzzles1000btc');

const DIFFICULTY_THRESHOLDS = {
  EASY:   { min: 0,   max: 400, label: 'FÁCIL',   emoji: '🟢', color: '#22c55e' },
  MEDIUM: { min: 400, max: 600, label: 'MÉDIO',   emoji: '🟡', color: '#eab308' },
  HARD:   { min: 600, max: 800, label: 'DIFÍCIL', emoji: '🔴', color: '#ef4444' },
  EXTREME:{ min: 800, max: Infinity, label: 'EXTREMO', emoji: '⚫', color: '#6b7280' }
};

const HARDWARE_SPEEDS = {
  'CPU_i7':           500000,        // ~500K keys/s
  'CPU_Ryzen9':       1000000,       // ~1M keys/s
  'GPU_GTX1660':      2000000000,    // ~2B keys/s
  'GPU_RTX3060':      5000000000,    // ~5B keys/s
  'GPU_RTX3080':      15000000000,   // ~15B keys/s
  'GPU_RTX4090':      42000000000,   // ~42B keys/s
  'COLAB_TESLA_T4':   18000000000,   // ~18B keys/s
  'COLAB_FARM_5x':    90000000000,   // ~90B keys/s
  'POOL_10x_RTX4090': 420000000000,  // ~420B keys/s
};

function hexToBigInt(hex) {
  if (!hex) return 0n;
  const cleanHex = String(hex).replace(/^0x/i, '').trim();
  if (!cleanHex) return 0n;
  return BigInt('0x' + cleanHex);
}

function bigIntToHex(bigIntVal, padLength = 0) {
  let hex = bigIntVal.toString(16);
  if (padLength > hex.length) {
    hex = hex.padStart(padLength, '0');
  }
  return hex;
}

function calculateRangeSize(rangeStart, rangeEnd) {
  const start = hexToBigInt(rangeStart);
  const end = hexToBigInt(rangeEnd);
  if (end < start) return 0n;
  return end - start + 1n;
}

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

function estimateTimeHours(effectiveBits, keysPerSecond = HARDWARE_SPEEDS.GPU_RTX4090) {
  if (effectiveBits <= 0) return 0;
  const log2KPS = Math.log2(keysPerSecond);
  const log2Seconds = effectiveBits - log2KPS;
  if (log2Seconds <= 0) return 0;
  const seconds = Math.pow(2, log2Seconds);
  return seconds / 3600;
}

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
          appliedHints.push({ type: 'fixedPrefix', description: `Prefixo fixo "0x${hexVal}" (${bits} bits)`, bitsEliminated: bits });
          break;
        }
        case 'bip39ChecksumFilter': {
          bitsEliminated += 4;
          appliedHints.push({ type: 'bip39ChecksumFilter', description: `Filtro Checksum BIP39 (Descarte de 93,75% - 4 bits)`, bitsEliminated: 4, discardRatePercent: 93.75 });
          break;
        }
        case 'knownBits': {
          const count = Math.min(Number(hint.count) || 0, totalBits);
          bitsEliminated += count;
          appliedHints.push({ type: 'knownBits', description: `${count} bits conhecidos`, bitsEliminated: count });
          break;
        }
      }
    }
  }

  let effectiveBits = Math.max(0, totalBits - bitsEliminated);

  if (publicKeyExposed) {
    const bsgsSavings = Math.floor(effectiveBits / 2);
    effectiveBits = Math.ceil(effectiveBits / 2);
    bitsEliminated += bsgsSavings;
    appliedHints.push({
      type: 'publicKeyExposed_BSGS',
      description: `Aceleração ECDSA BSGS/Kangaroo (Complexidade O(√N) por Chave Pública Exposta)`,
      bitsEliminated: bsgsSavings,
      algorithm: 'Pollard Kangaroo CUDA'
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

function isBIP39ChecksumValid(entropy128BitBigInt, checksum4Bit) {
  const { createHash } = require('crypto');
  let hex128 = entropy128BitBigInt.toString(16).padStart(32, '0');
  const buffer = Buffer.from(hex128, 'hex');
  const sha = createHash('sha256').update(buffer).digest();
  const calculatedChecksum = (sha[0] >> 4) & 0x0F;
  return calculatedChecksum === (checksum4Bit & 0x0F);
}

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
  
  const entropy = calculateEntropyReduction(hints, originalLog2Range, isKeyExposed);
  const effectiveBits = entropy.effectiveBits;

  let prizeBTC = Number(prizeAmount) || 0;
  if (prizeCurrency === 'ETH') prizeBTC = prizeAmount * 0.05;
  if (prizeCurrency === 'SOL') prizeBTC = prizeAmount * 0.002;
  
  const estimatedHours = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.GPU_RTX4090);
  const estimatedHoursColabT4 = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.COLAB_TESLA_T4);
  const estimatedHoursColabFarm5x = estimateTimeHours(effectiveBits, HARDWARE_SPEEDS.COLAB_FARM_5x);
  
  const difficultyComponent = effectiveBits * 10;
  const prizeComponent = Math.min(prizeBTC * 10, 100);
  const timePenalty = Math.min(Math.log10(estimatedHours + 1) * 50, 500);
  const score = Math.max(0, difficultyComponent + prizeComponent - timePenalty);
  
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
                          effectiveBits <= 70 ? 'POOL_RANGE_SPLIT' : 'KANGAROO_CUDA'
  };
}

function getMultiChainPuzzleData() {
  const btc160 = getAll160Puzzles().map(p => {
    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      rangeStart: p.rangeStart,
      rangeEnd: p.rangeEnd,
      prizeAmount: p.btcPrize,
      prizeCurrency: 'BTC',
      publicKey: p.publicKey,
      publicKeyExposed: p.publicKeyExposed
    });
    return {
      ...p,
      puzzleNumber: p.num,
      title: `Bitcoin Puzzle #${p.num}`,
      chain: 'BTC',
      prizeCurrency: 'BTC',
      prize: p.btcPrize,
      ...diff
    };
  });

  const otherChains = [
    {
      puzzleNumber: 201,
      challengeId: 'ETH_VANITY_32',
      title: 'Ethereum Vanity Challenge (Prefix 0x00000000)',
      chain: 'ETH',
      bits: 32,
      prize: 0.5,
      prizeCurrency: 'ETH',
      prizeUSD: Math.round(0.5 * 3200),
      solved: false,
      status: 'UNSOLVED',
      targetAddress: '0x0000000000000000000000000000000000000000',
      rangeStart: '0x00000001',
      rangeEnd: '0xffffffff',
      difficulty: 'EASY',
      difficultyLabel: '🟢 Imediato (GPU - Minutos)',
      emoji: '⚡',
      publicKeyExposed: true
    },
    {
      puzzleNumber: 202,
      challengeId: 'ETH_SMART_BOUNTY_48',
      title: 'Ethereum Smart Contract Challenge #48',
      chain: 'ETH',
      bits: 48,
      prize: 2.0,
      prizeCurrency: 'ETH',
      prizeUSD: Math.round(2.0 * 3200),
      solved: false,
      status: 'UNSOLVED',
      targetAddress: '0x71C8418013f890510850b4dC91C5B56064f7b2C1',
      rangeStart: '0x100000000000',
      rangeEnd: '0xffffffffffff',
      difficulty: 'MEDIUM',
      difficultyLabel: '🟡 Médio (GPU Cluster)',
      emoji: '🔥',
      publicKeyExposed: false
    },
    {
      puzzleNumber: 203,
      challengeId: 'ETH_BIP39_SEED_RECOVERY',
      title: 'Ethereum 12-Word Seed (8 Palavras Conhecidas)',
      chain: 'ETH',
      bits: 44,
      prize: 5.0,
      prizeCurrency: 'ETH',
      prizeUSD: Math.round(5.0 * 3200),
      solved: false,
      status: 'UNSOLVED',
      targetAddress: '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5',
      rangeStart: 'abandon ability able about above absent absorb abstract [4 restantes]',
      rangeEnd: '2^44 combinações',
      difficulty: 'EASY',
      difficultyLabel: '🟢 Altamente Viável (BIP39 Filter)',
      emoji: '🔑',
      publicKeyExposed: false
    },
    {
      puzzleNumber: 301,
      challengeId: 'SOL_VANITY_PREFIX_36',
      title: 'Solana Vanity Address (Prefix SOL999...)',
      chain: 'SOL',
      bits: 36,
      prize: 15.0,
      prizeCurrency: 'SOL',
      prizeUSD: Math.round(15.0 * 180),
      solved: false,
      status: 'UNSOLVED',
      targetAddress: 'SOL999xxxx111111111111111111111111111111111',
      rangeStart: '0x100000000',
      rangeEnd: '0xfffffffff',
      difficulty: 'EASY',
      difficultyLabel: '🟢 Imediato (Horas)',
      emoji: '⚡',
      publicKeyExposed: false
    },
    {
      puzzleNumber: 401,
      challengeId: 'BTC_SATOSHI_NONCE_REUSE',
      title: 'Bitcoin ECDSA Nonce Reuse Challenge (Weak K)',
      chain: 'BTC',
      bits: 1,
      prize: 1.2,
      prizeCurrency: 'BTC',
      prizeUSD: Math.round(1.2 * 65000),
      solved: false,
      status: 'UNSOLVED',
      targetAddress: '15dTwY2K7XjY83j3eTcxL5LwA7hX5N3DqX',
      rangeStart: 'Assinatura com Nonce Repetido',
      rangeEnd: 'Cálculo Algébrico Instantâneo',
      difficulty: 'EASY',
      difficultyLabel: '🟢 Instantâneo (Script Algébrico)',
      emoji: '🎯',
      publicKeyExposed: true
    }
  ].map(p => {
    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      prizeAmount: p.prize,
      prizeCurrency: p.prizeCurrency,
      publicKeyExposed: p.publicKeyExposed
    });
    return { ...p, ...diff };
  });

  return [...btc160, ...otherChains];
}

function getBitcoinPuzzleData() {
  return getMultiChainPuzzleData();
}

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