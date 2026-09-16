// ==============================================================================
// 🧩 PuzzleRadar v4.0 — Calculadora de Score de Prioridade (Bug #3 Corrigido)
// ==============================================================================
// Equação corrigida:
//   SCORE = (Recompensa_BTC × 1000)
//         × F_LowRange × F_HammingWeight × F_MSB × F_NaoCoberto
//         / log2(Espaco_Filtrado)
//
// NOTA: Score é para PRIORIZAÇÃO de lotes de Brute Force.
//       O Kangaroo opera com starting points independentes do score.
// ==============================================================================

const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// ─── TABELA DE MULTIPLICADORES ────────────────────────────────────────────────
const MULTIPLIERS = {
  // Low-Range Bias
  LOW_RANGE_STRONG:   3.0,  // posicao < 20% do range
  LOW_RANGE_NEUTRAL:  1.0,

  // Hamming Weight
  HAMMING_STRONG:     5.0,  // HW entre 40-45% dos bits
  HAMMING_MEDIUM:     2.0,  // HW entre 35-50%
  HAMMING_NEUTRAL:    1.0,

  // MSB
  MSB_ZERO:           1.5,  // chave na metade inferior do range
  MSB_NEUTRAL:        1.0,

  // Cobertura por pools externos
  NOT_COVERED:        3.0,
  PARTIAL_COVERED:    1.0,
  FULLY_COVERED:      0.1,
};

/**
 * Calcula o score de prioridade de um puzzle/range baseado nos filtros aplicados.
 *
 * @param {Object} params
 * @param {number}  params.rewardBtc         - Recompensa em BTC (ex: 7.1)
 * @param {number}  params.positionPct       - Posição no range em % (0-100)
 * @param {number}  params.hammingWeightPct  - Peso de Hamming em % dos bits totais
 * @param {number}  params.totalBits         - Bits totais do puzzle
 * @param {boolean} params.msbZero           - Chave na metade inferior?
 * @param {string}  params.coverageStatus    - 'not_covered' | 'partial' | 'full'
 * @param {BigInt}  params.filteredSpaceSize - Tamanho do espaço filtrado (BigInt)
 * @returns {{ score: number, breakdown: Object }}
 */
function calculateScore(params) {
  const {
    rewardBtc        = 1,
    positionPct      = 50,
    hammingWeightPct = 50,
    totalBits        = 71,
    msbZero          = false,
    coverageStatus   = 'not_covered',
    filteredSpaceSize = null,
  } = params;

  // ─── Multiplicador Low-Range ─────────────────────────────────────────────
  const fLowRange = positionPct < 20
    ? MULTIPLIERS.LOW_RANGE_STRONG
    : MULTIPLIERS.LOW_RANGE_NEUTRAL;

  // ─── Multiplicador Hamming Weight ────────────────────────────────────────
  let fHamming = MULTIPLIERS.HAMMING_NEUTRAL;
  if (hammingWeightPct >= 40 && hammingWeightPct <= 45) {
    fHamming = MULTIPLIERS.HAMMING_STRONG;
  } else if (hammingWeightPct >= 35 && hammingWeightPct <= 50) {
    fHamming = MULTIPLIERS.HAMMING_MEDIUM;
  }

  // ─── Multiplicador MSB ───────────────────────────────────────────────────
  const fMsb = msbZero ? MULTIPLIERS.MSB_ZERO : MULTIPLIERS.MSB_NEUTRAL;

  // ─── Multiplicador Cobertura ─────────────────────────────────────────────
  let fCoverage = MULTIPLIERS.NOT_COVERED;
  if (coverageStatus === 'partial') fCoverage = MULTIPLIERS.PARTIAL_COVERED;
  if (coverageStatus === 'full')    fCoverage = MULTIPLIERS.FULLY_COVERED;

  // ─── log2(espaço filtrado) ───────────────────────────────────────────────
  let log2Space;
  if (filteredSpaceSize && filteredSpaceSize > 0n) {
    // Aproximação: log2(n) ≈ número de bits necessários
    log2Space = filteredSpaceSize.toString(2).length;
  } else {
    // Fallback: usar bits do puzzle como proxy
    log2Space = totalBits;
  }
  if (log2Space < 1) log2Space = 1;

  // ─── EQUAÇÃO FINAL ───────────────────────────────────────────────────────
  const score = (rewardBtc * 1000)
    * fLowRange
    * fHamming
    * fMsb
    * fCoverage
    / log2Space;

  return {
    score:  Math.round(score * 100) / 100,
    breakdown: {
      base:            rewardBtc * 1000,
      f_low_range:     fLowRange,
      f_hamming:       fHamming,
      f_msb:           fMsb,
      f_coverage:      fCoverage,
      log2_space:      log2Space,
      formula:         `(${rewardBtc * 1000}) × ${fLowRange} × ${fHamming} × ${fMsb} × ${fCoverage} / ${log2Space}`,
    },
  };
}

/**
 * Calcula o score de prioridade para um lote de Brute Force.
 * Lotes nas primeiras fases recebem score maior.
 *
 * @param {Object} params
 * @param {number}  params.rewardBtc     - Recompensa em BTC
 * @param {number}  params.rangeStartPct - Início do lote como % do range total (0-100)
 * @param {number}  params.totalBits     - Bits do puzzle
 * @param {string}  params.filterApplied - Nome do filtro aplicado
 * @returns {number} score inteiro (0-1000)
 */
function calculateLoteScore(params) {
  const { rewardBtc = 1, rangeStartPct = 50, totalBits = 71, filterApplied = '' } = params;

  // Fase determina multiplicador de posição
  let positionMultiplier = 1.0;
  if (rangeStartPct < 20)  positionMultiplier = 3.0;  // Fase 1
  else if (rangeStartPct < 50) positionMultiplier = 1.5; // Fase 2
  // Fase 3: 1.0 (padrão)

  // Bônus por filtro aplicado
  let filterBonus = 0;
  if (filterApplied.includes('hamming')) filterBonus += 20;
  if (filterApplied.includes('msb'))     filterBonus += 10;
  if (filterApplied.includes('low_range')) filterBonus += 30;

  const baseScore = (rewardBtc * 100) * positionMultiplier / totalBits;
  return Math.min(1000, Math.round(baseScore * 10 + filterBonus));
}

/**
 * Gera os starting points distribuídos para o Kangaroo.
 * REGRA: Kangaroo NUNCA é restrito a uma sub-região.
 * 10 Tame + 10 Wild = cobertura distribuída do range completo.
 *
 * @param {string} rangeStartHex - Início do range em hex
 * @param {string} rangeEndHex   - Fim do range em hex
 * @param {number} numPoints     - Número de starting points por tipo (padrão 10)
 * @returns {{ tame: string[], wild: string[] }} Arrays de starting points em decimal
 */
function generateKangarooStartingPoints(rangeStartHex, rangeEndHex, numPoints = 10) {
  const rangeMin  = BigInt(rangeStartHex.startsWith('0x') ? rangeStartHex : '0x' + rangeStartHex);
  const rangeMax  = BigInt(rangeEndHex.startsWith('0x') ? rangeEndHex : '0x' + rangeEndHex);
  const rangeSize = rangeMax - rangeMin;

  const tame = [];
  const wild = [];

  for (let i = 0; i < numPoints; i++) {
    // Tame: distribuídos do início para o meio do range
    const tameOffset = (rangeSize * BigInt(i)) / BigInt(numPoints * 2);
    tame.push((rangeMin + tameOffset).toString());

    // Wild: distribuídos do fim para o meio do range
    const wildOffset = (rangeSize * BigInt(i)) / BigInt(numPoints * 2);
    wild.push((rangeMax - wildOffset).toString());
  }

  return { tame, wild };
}

/**
 * Compara dois puzzles para ordenação por score (maior primeiro)
 */
function comparePuzzlesByScore(a, b) {
  return b.score - a.score;
}

module.exports = {
  calculateScore,
  calculateLoteScore,
  generateKangarooStartingPoints,
  comparePuzzlesByScore,
  MULTIPLIERS,
};
