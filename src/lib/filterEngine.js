// ==============================================================================
// 🧩 PuzzleRadar v4.0 — Motor de Filtros Matemáticos (Priorização, não Restrição)
// ==============================================================================
// IMPORTANTE: Filtros são PRIORIZAÇÃO de busca, NÃO restrições.
// O Kangaroo NUNCA é limitado por esses filtros — ele opera no range completo.
// O Brute Force usa os filtros para ORDENAR a busca: 20% → 50% → 100%.
// ==============================================================================

const prisma = require('./prisma');

// ─── FASES DE BUSCA ──────────────────────────────────────────────────────────
const SEARCH_PHASES = {
  PHASE_1: { name: 'Fase1_20%',  maxRangePct: 0.20, label: 'Alta Probabilidade' },
  PHASE_2: { name: 'Fase2_50%',  maxRangePct: 0.50, label: 'Probabilidade Média' },
  PHASE_3: { name: 'Fase3_100%', maxRangePct: 1.00, label: 'Cobertura Total' },
};

// ─── PESOS DOS FILTROS ────────────────────────────────────────────────────────
const FILTER_WEIGHTS = {
  LOW_RANGE_STRONG:  3.0,
  LOW_RANGE_NEUTRAL: 1.0,
  HAMMING_STRONG:    5.0,
  HAMMING_MEDIUM:    2.0,
  HAMMING_NEUTRAL:   1.0,
  MSB_ZERO:          1.5,
  MSB_NEUTRAL:       1.0,
  NOT_COVERED:       3.0,
  PARTIAL_COVERED:   1.0,
  FULLY_COVERED:     0.1,
};

class FilterEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRO 1: LOW-RANGE BIAS — priorização dos primeiros N% do range
  // Resultado: faseamento para Brute Force (20% → 50% → 100%)
  // ═══════════════════════════════════════════════════════════════════════════
  analyzeLowRangeBias(solvedPuzzles) {
    if (!solvedPuzzles || solvedPuzzles.length === 0) {
      return { filter_type: 'low_range_bias', space_reduction: 1.0, confidence: 0 };
    }

    const positions = solvedPuzzles
      .filter(p => p.privateKey && p.rangeStart && p.rangeEnd)
      .map(p => {
        try {
          const key      = BigInt('0x' + p.privateKey.replace(/^0x/i, ''));
          const rangeMin = BigInt('0x' + p.rangeStart.replace(/^0x/i, ''));
          const rangeMax = BigInt('0x' + p.rangeEnd.replace(/^0x/i, ''));
          const rangeSize = rangeMax - rangeMin;
          if (rangeSize === 0n) return null;
          const position = Number(((key - rangeMin) * 100000n) / rangeSize) / 1000;
          return { puzzle: p.puzzleNumber, position };
        } catch { return null; }
      })
      .filter(Boolean);

    if (positions.length === 0) {
      return { filter_type: 'low_range_bias', space_reduction: 1.0, confidence: 0 };
    }

    const avgPosition = positions.reduce((s, p) => s + p.position, 0) / positions.length;
    const pctIn20     = (positions.filter(p => p.position < 20).length / positions.length) * 100;
    const pctIn50     = (positions.filter(p => p.position < 50).length / positions.length) * 100;

    const priorityMultiplier = pctIn20 > 70 ? FILTER_WEIGHTS.LOW_RANGE_STRONG : FILTER_WEIGHTS.LOW_RANGE_NEUTRAL;

    return {
      filter_type:          'low_range_bias',
      average_position_pct: avgPosition.toFixed(2),
      pct_in_20:            pctIn20.toFixed(1),
      pct_in_50:            pctIn50.toFixed(1),
      priority_multiplier:  priorityMultiplier,
      space_reduction:      priorityMultiplier,
      confidence:           Math.min(pctIn20 / 100, 0.95),
      // IMPORTANTE: Brute Force usa faseamento — NUNCA para nos 20%
      bf_phases: [
        { phase: 'PHASE_1', range_pct: 20, priority: 'ALTA',  weight: 1.0 },
        { phase: 'PHASE_2', range_pct: 50, priority: 'MEDIA', weight: 0.5 },
        { phase: 'PHASE_3', range_pct: 100, priority: 'BAIXA', weight: 0.25 },
      ],
      kangaroo_note: 'Kangaroo NAO e restrito por este filtro — opera no range completo',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRO 2: HAMMING WEIGHT
  // ═══════════════════════════════════════════════════════════════════════════
  analyzeHammingWeight(solvedPuzzles) {
    if (!solvedPuzzles || solvedPuzzles.length === 0) {
      return { filter_type: 'hamming_weight', space_reduction: 1.0, confidence: 0 };
    }

    const weights = solvedPuzzles
      .filter(p => p.privateKey && p.bitRange)
      .map(p => {
        try {
          const key   = BigInt('0x' + p.privateKey.replace(/^0x/i, ''));
          const bits  = p.bitRange;
          const hw    = this._countBits(key);
          const hwPct = (hw / bits) * 100;
          return { puzzle: p.puzzleNumber, bits, hw, hwPct };
        } catch { return null; }
      })
      .filter(Boolean);

    if (weights.length === 0) {
      return { filter_type: 'hamming_weight', space_reduction: 1.0, confidence: 0 };
    }

    const avgHwPct   = weights.reduce((s, w) => s + w.hwPct, 0) / weights.length;
    const lowerBound = Math.floor(avgHwPct - 5);
    const upperBound = Math.ceil(avgHwPct + 5);

    let priorityMultiplier = FILTER_WEIGHTS.HAMMING_NEUTRAL;
    if (avgHwPct >= 40 && avgHwPct <= 45) {
      priorityMultiplier = FILTER_WEIGHTS.HAMMING_STRONG;
    } else if (avgHwPct >= 35 && avgHwPct <= 50) {
      priorityMultiplier = FILTER_WEIGHTS.HAMMING_MEDIUM;
    }

    const n              = weights[0].bits;
    const configsInBand  = this._combinationsInBand(n,
      Math.floor(n * lowerBound / 100),
      Math.ceil(n * upperBound / 100));
    const totalConfigs   = Math.pow(2, Math.min(n, 53));
    const reduction      = configsInBand > 0 ? Math.min(totalConfigs / configsInBand, 20) : 1;

    return {
      filter_type:         'hamming_weight',
      average_hw_pct:      avgHwPct.toFixed(2),
      optimal_range:       `${lowerBound}% - ${upperBound}%`,
      priority_multiplier: priorityMultiplier,
      space_reduction:     reduction,
      confidence:          0.85,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRO 3: MSB ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════
  analyzeMSB(solvedPuzzles) {
    if (!solvedPuzzles || solvedPuzzles.length === 0) {
      return { filter_type: 'msb_analysis', space_reduction: 1.0, confidence: 0 };
    }

    const msbs = solvedPuzzles
      .filter(p => p.privateKey && p.rangeStart && p.rangeEnd)
      .map(p => {
        try {
          const key      = BigInt('0x' + p.privateKey.replace(/^0x/i, ''));
          const rangeMin = BigInt('0x' + p.rangeStart.replace(/^0x/i, ''));
          const rangeMax = BigInt('0x' + p.rangeEnd.replace(/^0x/i, ''));
          const rangeSize = rangeMax - rangeMin;
          if (rangeSize === 0n) return null;
          const ratio = Number((key - rangeMin) * 10000n / rangeSize) / 10000;
          return { puzzle: p.puzzleNumber, msb: ratio < 0.5 ? 0 : 1, ratio };
        } catch { return null; }
      })
      .filter(Boolean);

    if (msbs.length === 0) {
      return { filter_type: 'msb_analysis', space_reduction: 1.0, confidence: 0 };
    }

    const msb0Pct    = (msbs.filter(m => m.msb === 0).length / msbs.length) * 100;
    const multiplier = msb0Pct > 65 ? FILTER_WEIGHTS.MSB_ZERO : FILTER_WEIGHTS.MSB_NEUTRAL;

    return {
      filter_type:         'msb_analysis',
      msb_zero_pct:        msb0Pct.toFixed(1),
      recommendation:      msb0Pct > 65 ? 'Priorizar metade inferior do range' : 'Sem preferencia de MSB',
      space_reduction:     multiplier,
      priority_multiplier: multiplier,
      confidence:          Math.abs(msb0Pct - 50) / 50,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTRO 4: ANÁLISE MODULAR
  // ═══════════════════════════════════════════════════════════════════════════
  analyzeModular(solvedPuzzles, modulus) {
    if (!solvedPuzzles || solvedPuzzles.length === 0) {
      return { filter_type: `modular_${modulus}`, space_reduction: 1.0, confidence: 0 };
    }

    const residues = solvedPuzzles
      .filter(p => p.privateKey)
      .map(p => {
        try { return Number(BigInt('0x' + p.privateKey.replace(/^0x/i, '')) % BigInt(modulus)); }
        catch { return null; }
      })
      .filter(r => r !== null);

    const distribution = {};
    for (let i = 0; i < modulus; i++) distribution[i] = 0;
    residues.forEach(r => distribution[r]++);

    const excluded  = Object.keys(distribution).filter(k => distribution[k] === 0).map(Number);
    const reduction = excluded.length > 0 ? modulus / (modulus - excluded.length) : 1.0;

    return {
      filter_type:       `modular_${modulus}`,
      distribution,
      excluded_residues: excluded,
      space_reduction:   reduction,
      confidence:        excluded.length > 0 ? 0.6 : 0.1,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GERAR FILTROS COMBINADOS
  // ═══════════════════════════════════════════════════════════════════════════
  async generateFiltersForPuzzle(puzzleId, solvedPuzzlesOverride = null) {
    const solved = solvedPuzzlesOverride || await prisma.puzzle.findMany({
      where:   { status: 'SOLVED' },
      select:  { puzzleNumber: true, bitRange: true, rangeStart: true, rangeEnd: true },
      orderBy: { puzzleNumber: 'asc' },
    });

    if (solved.length < 3) {
      return {
        puzzle_id: puzzleId,
        warning:   'Dados insuficientes (< 3 puzzles resolvidos)',
        filters:   [],
        combined_space_reduction: 1.0,
        kangaroo_note: 'Kangaroo opera no range completo independente dos filtros',
      };
    }

    const filters = [
      this.analyzeLowRangeBias(solved),
      this.analyzeHammingWeight(solved),
      this.analyzeMSB(solved),
    ];

    for (const mod of [2, 3, 5, 7, 11]) {
      const modResult = this.analyzeModular(solved, mod);
      if (modResult.space_reduction > 1.2) filters.push(modResult);
    }

    const combinedReduction = filters.reduce((acc, f) => acc * (f.space_reduction || 1), 1);

    return {
      puzzle_id: puzzleId,
      filters,
      combined_space_reduction:   combinedReduction.toFixed(1) + 'x',
      effective_space_multiplier: (1 / combinedReduction).toFixed(8),
      recommendation: combinedReduction > 3
        ? 'Filtros fortes — Brute Force altamente eficiente na Fase 1'
        : combinedReduction > 1.5
          ? 'Filtros moderados — considerar'
          : 'Filtros fracos — confiar no Kangaroo como frente principal',
      kangaroo_note: 'Kangaroo NAO e limitado por estes filtros — cobre o range COMPLETO',
      search_phases: Object.values(SEARCH_PHASES),
    };
  }

  // ─── AUXILIARES ────────────────────────────────────────────────────────────
  _countBits(n) {
    let c = 0; while (n > 0n) { if (n & 1n) c++; n >>= 1n; } return c;
  }
  _combinationsInBand(n, lower, upper) {
    const mu = n / 2, sigma = Math.sqrt(n) / 2;
    return Math.pow(2, Math.min(n, 53)) *
      (this._normalCDF((upper - mu) / sigma) - this._normalCDF((lower - mu) / sigma));
  }
  _normalCDF(x) { return 0.5 * (1 + this._erf(x / Math.sqrt(2))); }
  _erf(x) {
    const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429], p = 0.3275911;
    const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
    const t = 1 / (1 + p * x);
    return sign * (1 - (((((a[4]*t+a[3])*t)+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x));
  }
}

module.exports = new FilterEngine();
