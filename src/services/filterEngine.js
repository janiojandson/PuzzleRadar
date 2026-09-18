// =========================================================================
// 🧩 PuzzleRadar v5.0 — Statistical Filter Engine
// =========================================================================
// Aplica filtros heurísticos e modelos estatísticos para ranquear fatias
// do keyspace do Puzzle 71 (Hamming Weight, Low-Range Bias e Space Pruning).
// =========================================================================

class FilterEngine {
  /**
   * Conta bits ativos (1s) em um BigInt
   */
  countSetBitsBigInt(n) {
    let count = 0;
    let temp = n;
    while (temp > 0n) {
      if ((temp & 1n) === 1n) count++;
      temp >>= 1n;
    }
    return count;
  }

  /**
   * Calcula o Hamming Weight score (0 a 40)
   * Para chaves de 71 bits, o peso médio esperado na natureza é ~35.5 bits.
   * Chaves históricas dos puzzles 1-66 mostram distribuição centrada com leve
   * desvio binomial padrão (28 a 42 bits). Penaliza extremos improváveis.
   */
  calculateHammingWeightScore(startHex, endHex, totalBits = 71) {
    try {
      const s = BigInt(startHex.startsWith('0x') ? startHex : '0x' + startHex);
      const e = BigInt(endHex.startsWith('0x') ? endHex : '0x' + endHex);
      const span = e - s;
      const mid = (s + e) / 2n;

      // Estima a densidade média esperada de bits para as chaves contidas na fatia [s, e]
      // Uma fatia de tamanho 2^k adiciona em média k/2 bits ativos à base 's'
      const baseBits = this.countSetBitsBigInt(s);
      const spanBits = span > 0n ? Math.round(Math.log2(Number(span > 1000000000n ? 1000000000 : span))) : 0;
      const estimatedAvgBits = baseBits + (spanBits / 2);

      const expectedBits = totalBits / 2; // 35.5 para 71 bits
      const diff = Math.abs(estimatedAvgBits - expectedBits);

      if (diff <= 10) return 40;
      if (diff <= 20) return 30;
      if (diff <= 28) return 25;
      return 20;
    } catch (_) {
      return 25;
    }
  }

  /**
   * Calcula o viés Low-Range (0 a 40)
   * Baseado na distribuição empírica dos Puzzles 1 a 66 onde >62% das chaves
   * foram encontradas na metade inferior do keyspace disponível.
   */
  calculateLowRangeScore(startHex, endHex, minHex = '400000000000000000', maxHex = '7fffffffffffffffff') {
    try {
      const s = BigInt(startHex.startsWith('0x') ? startHex : '0x' + startHex);
      const min = BigInt(minHex.startsWith('0x') ? minHex : '0x' + minHex);
      const max = BigInt(maxHex.startsWith('0x') ? maxHex : '0x' + maxHex);

      const totalSpan = max - min;
      if (totalSpan <= 0n) return 20;

      const position = s - min;
      const fraction = Number((position * 1000n) / totalSpan) / 1000; // 0.0 a 1.0

      if (fraction < 0.25) return 40; // Primeiro quartil: pontuação máxima
      if (fraction < 0.50) return 32; // Segundo quartil
      if (fraction < 0.75) return 20; // Terceiro quartil
      return 10;                     // Quarto quartil
    } catch (_) {
      return 20;
    }
  }

  /**
   * Calcula o Priority Score Consolidado (0 a 100)
   * @param {Object} params
   * @param {string} params.startHex - Início da fatia (18 chars hex)
   * @param {string} params.endHex - Fim da fatia (18 chars hex)
   * @param {boolean} [params.isScanned] - Se já consta como escaneada no bitmap público
   * @param {number} [params.puzzleNumber] - Número do puzzle (default 71)
   */
  computePriorityScore({ startHex, endHex, isScanned = false, puzzleNumber = 71 }) {
    if (isScanned) {
      return {
        score: 0,
        hammingScore: 0,
        lowRangeScore: 0,
        unscannedBonus: 0,
        reason: 'PRUNED_ALREADY_SCANNED_PUBLICLY'
      };
    }

    const totalBits = puzzleNumber === 71 ? 71 : 66;
    const hammingScore = this.calculateHammingWeightScore(startHex, endHex, totalBits);
    const lowRangeScore = this.calculateLowRangeScore(startHex, endHex);
    const unscannedBonus = 20; // Bônus fixo por ser território virgem

    const totalScore = Math.min(100, Math.max(0, hammingScore + lowRangeScore + unscannedBonus));

    let reason = 'standard_distribution';
    if (totalScore >= 80) reason = 'optimal_hamming_and_low_range_bias';
    else if (totalScore >= 60) reason = 'favorable_statistical_window';

    return {
      score: totalScore,
      hammingScore,
      lowRangeScore,
      unscannedBonus,
      reason
    };
  }
}

const filterEngine = new FilterEngine();

module.exports = {
  FilterEngine,
  filterEngine
};
