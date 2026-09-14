// ============================================
// 🧩 PuzzleRadar — Motor de Pontuação de Dificuldade
// ============================================
// Calcula a dificuldade matemática de cada puzzle
// e classifica em FÁCIL / MÉDIO / DIFÍCIL / EXTREMO
// ============================================

const DIFFICULTY_THRESHOLDS = {
  EASY:   { min: 0,   max: 400, label: 'FÁCIL',   emoji: '🟢', color: '#22c55e' },
  MEDIUM: { min: 400, max: 600, label: 'MÉDIO',   emoji: '🟡', color: '#eab308' },
  HARD:   { min: 600, max: 800, label: 'DIFÍCIL', emoji: '🔴', color: '#ef4444' },
  EXTREME:{ min: 800, max: Infinity, label: 'EXTREMO', emoji: '⚫', color: '#6b7280' }
};

// Velocidade estimada por hardware (chaves/segundo)
const HARDWARE_SPEEDS = {
  'CPU_i7':           500000,       // ~500K keys/s
  'CPU_Ryzen9':       1000000,      // ~1M keys/s
  'GPU_GTX1660':      2000000000,   // ~2B keys/s
  'GPU_RTX3060':      5000000000,   // ~5B keys/s
  'GPU_RTX3080':      15000000000,  // ~15B keys/s
  'GPU_RTX4090':      42000000000,  // ~42B keys/s (CrackBit benchmark)
  'POOL_10x_RTX4090': 420000000000, // ~420B keys/s
};

/**
 * Converte hex string para BigInt
 */
function hexToBigInt(hex) {
  return BigInt('0x' + hex.replace(/^0x/i, ''));
}

/**
 * Calcula o tamanho do range (número de chaves possíveis)
 */
function calculateRangeSize(rangeStart, rangeEnd) {
  const start = hexToBigInt(rangeStart);
  const end = hexToBigInt(rangeEnd);
  return end - start + 1n;
}

/**
 * Calcula o log2 de um BigInt
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
 * Usa log2 diretamente para evitar overflow numérico
 */
function estimateTimeHours(bitRange, keysPerSecond = 42000000000) {
  // log2(seconds) = bitRange - log2(keysPerSecond)
  const log2KPS = Math.log2(keysPerSecond); // ~35.3 para RTX 4090
  const log2Seconds = bitRange - log2KPS;
  
  if (log2Seconds <= 0) return 0; // Instantâneo
  
  const seconds = Math.pow(2, log2Seconds);
  return seconds / 3600;
}

/**
 * Calcula o score de dificuldade completo
 */
function calculateDifficultyScore({ bitRange, rangeStart, rangeEnd, prizeAmount = 0, prizeCurrency = 'BTC' }) {
  // Usar bitRange como fonte primária (mais confiável)
  const log2Range = bitRange || (rangeStart && rangeEnd ? log2BigInt(calculateRangeSize(rangeStart, rangeEnd)) : 0);
  
  // Converter prêmio para BTC equivalente (simplificado)
  let prizeBTC = prizeAmount;
  if (prizeCurrency === 'ETH') prizeBTC = prizeAmount * 0.05;
  if (prizeCurrency === 'SOL') prizeBTC = prizeAmount * 0.002;
  
  // Tempo estimado com 1x RTX 4090
  const estimatedHours = estimateTimeHours(log2Range, HARDWARE_SPEEDS.GPU_RTX4090);
  
  // Score — balanceado: dificuldade computacional é o peso principal
  const difficultyComponent = log2Range * 10;
  const prizeComponent = Math.min(prizeBTC * 10, 100); // Capped
  const timePenalty = Math.min(Math.log10(estimatedHours + 1) * 50, 500);
  const score = difficultyComponent + prizeComponent - timePenalty;
  
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
    log2Range,
    estimatedHoursRTX4090: estimatedHours,
    estimatedDaysRTX4090: estimatedHours / 24,
    estimatedYearsRTX4090: estimatedHours / 8760,
    viabilityCPU: log2Range <= 40,
    viabilityGPU: log2Range <= 55,
    viabilityPool: log2Range <= 70,
    recommendedStrategy: log2Range <= 40 ? 'CPU_BRUTE' : 
                          log2Range <= 55 ? 'GPU_BRUTE' :
                          log2Range <= 70 ? 'POOL_RANGE_SPLIT' : 'KANGAROO_OR_WAIT'
  };
}

/**
 * Gera dados dos puzzles Bitcoin Puzzle Transaction (1-160)
 */
function getBitcoinPuzzleData() {
  const puzzles = [];
  
  const solvedPuzzles = [
    { num: 1, bits: 1, prize: 0.0001, solved: true },
    { num: 10, bits: 10, prize: 0.0001, solved: true },
    { num: 20, bits: 20, prize: 0.0001, solved: true },
    { num: 30, bits: 30, prize: 0.0001, solved: true },
    { num: 40, bits: 40, prize: 0.0001, solved: true },
    { num: 50, bits: 50, prize: 0.0001, solved: true },
    { num: 55, bits: 55, prize: 0.0001, solved: true },
    { num: 60, bits: 60, prize: 0.0001, solved: true },
    { num: 64, bits: 64, prize: 0.0001, solved: true },
    { num: 65, bits: 65, prize: 6.6, solved: true },
  ];
  
  const activePuzzles = [
    { num: 66, bits: 66, prize: 6.6, solved: false },
    { num: 67, bits: 67, prize: 6.6, solved: false },
    { num: 68, bits: 68, prize: 6.6, solved: false },
    { num: 70, bits: 70, prize: 6.6, solved: false },
    { num: 75, bits: 75, prize: 6.6, solved: false },
    { num: 80, bits: 80, prize: 6.6, solved: false },
    { num: 90, bits: 90, prize: 6.6, solved: false },
    { num: 100, bits: 100, prize: 6.6, solved: false },
    { num: 110, bits: 110, prize: 6.6, solved: false },
    { num: 120, bits: 120, prize: 6.6, solved: false },
    { num: 130, bits: 130, prize: 6.6, solved: false },
    { num: 140, bits: 140, prize: 6.6, solved: false },
    { num: 150, bits: 150, prize: 6.6, solved: false },
    { num: 160, bits: 160, prize: 6.6, solved: false },
  ];
  
  const allPuzzles = [...solvedPuzzles, ...activePuzzles];
  
  for (const p of allPuzzles) {
    const rangeStart = (1n << BigInt(p.bits - 1)).toString(16);
    const rangeEnd = ((1n << BigInt(p.bits)) - 1n).toString(16);
    
    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      rangeStart,
      rangeEnd,
      prizeAmount: p.prize,
      prizeCurrency: 'BTC'
    });
    
    puzzles.push({
      puzzleNumber: p.num,
      bits: p.bits,
      prize: p.prize,
      solved: p.solved,
      ...diff
    });
  }
  
  return puzzles;
}

/**
 * Calcula a divisão de prêmios entre membros do pool
 */
function calculatePrizeSplit(contributions, totalPrize, currency = 'BTC') {
  const totalShares = contributions.reduce((sum, c) => sum + c.shares, 0);
  if (totalShares === 0) return [];
  
  return contributions.map(c => ({
    userId: c.userId,
    username: c.username,
    shares: c.shares,
    sharePercent: (c.shares / totalShares * 100).toFixed(2),
    prizeAmount: (c.shares / totalShares * totalPrize).toFixed(8),
    currency
  }));
}

/**
 * Divide um range em N sub-ranges para distribuição entre workers
 */
function splitRange(rangeStart, rangeEnd, numSplits) {
  const start = hexToBigInt(rangeStart);
  const end = hexToBigInt(rangeEnd);
  const totalRange = end - start + 1n;
  const chunkSize = totalRange / BigInt(numSplits);
  
  const splits = [];
  for (let i = 0; i < numSplits; i++) {
    const chunkStart = start + chunkSize * BigInt(i);
    const chunkEnd = i === numSplits - 1 ? end : chunkStart + chunkSize - 1n;
    
    splits.push({
      index: i,
      rangeStart: chunkStart.toString(16),
      rangeEnd: chunkEnd.toString(16),
      size: chunkEnd - chunkStart + 1n
    });
  }
  
  return splits;
}

module.exports = {
  calculateDifficultyScore,
  calculatePrizeSplit,
  splitRange,
  getBitcoinPuzzleData,
  DIFFICULTY_THRESHOLDS,
  HARDWARE_SPEEDS,
  hexToBigInt,
  log2BigInt,
  estimateTimeHours
};