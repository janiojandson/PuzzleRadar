// ==============================================================================
// 🧩 PuzzleRadar v4.0 — Kangaroo Manager (Pollard's Kangaroo Distribuído)
// ==============================================================================
// Gerencia Distinguished Points (DPs) e detecta colisões entre caminhadas
// Tame (início do range) e Wild (fim do range).
//
// REGRAS FUNDAMENTAIS:
//   1. Kangaroo opera no RANGE COMPLETO — nunca restrito a sub-regiões
//   2. 10 Tame + 10 Wild starting points distribuídos ao longo do range
//   3. Celulares enviam walks curtos (1.000 steps) — contribuem para colisão
//   4. TTL de 24h para DPs órfãos (worker sumiu sem concluir)
//   5. Steps até 32768 para walks eficientes
//   6. Detecção de colisão via resolveCollisionPrivateKey (com ambas hipóteses de Y)
// ==============================================================================

const prisma = require('./prisma');
const { JUMP_TABLE_POWERS, PUZZLE_71_PARAMS, getJumpIndex, resolveCollisionPrivateKey } = require('./kangarooTable');
const { isDistinguishedPoint, deducePrivateKeyKangaroo, verifyDiscoveryProof } = require('./cryptoVerifier');
const { generateKangarooStartingPoints } = require('./priorityCalculator');

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const SECP256K1_N   = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
const DP_BITS       = 26;          // Distinguished Point: X & 0x03FFFFFF === 0 (~1 em 67M passos)
const DP_TTL_HOURS  = 24;          // DPs órfãos expiram em 24h
const MAX_WALKS_PER_SEED = 10;     // Walks simultâneas por starting point

// Tabela de steps expandida (até 32768) para walks eficientes
// Baseada no JUMP_TABLE_POWERS do kangarooTable.js (32 saltos calibrados com média ~2^34)
const STEP_SIZES_HEX = JUMP_TABLE_POWERS.map(p => p.toString(16));

class KangarooManager {

  constructor() {
    this._cleanupInterval = null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT DP — Worker submete Distinguished Point
  // ═══════════════════════════════════════════════════════════════════════════
  async submitDP(puzzleId, workerId, dpData) {
    const {
      pointX,      // x-coordinate do DP em hex
      pointY,      // y-coordinate do DP em hex
      walkType,    // 'tame' ou 'wild'
      startKey,    // chave inicial da caminhada em decimal
      stepDistanceHex, // distância acumulada em hex (d)
      stepsTaken,  // número de passos realizados
      walkSeed,    // semente para reproduzir a caminhada (opcional)
    } = dpData;

    if (!pointX || !walkType || !startKey || !stepDistanceHex) {
      return { error: 'missing_fields', message: 'pointX, walkType, startKey e stepDistanceHex são obrigatórios' };
    }

    if (!['tame', 'wild'].includes(walkType)) {
      return { error: 'invalid_walk_type', message: 'walkType deve ser "tame" ou "wild"' };
    }

    // Verificar se é realmente um Distinguished Point
    if (!isDistinguishedPoint(pointX, DP_BITS)) {
      return { error: 'not_a_dp', message: `Ponto não é um Distinguished Point (DP_BITS=${DP_BITS})` };
    }

    // Calcular expiração (TTL de 24h)
    const expiresAt = new Date(Date.now() + DP_TTL_HOURS * 60 * 60 * 1000);

    try {
      // Verificar se já existe DP com mesmo ponto neste puzzle
      const existingDP = await prisma.distinguishedPoint.findFirst({
        where: { puzzleId, xCoordHex: pointX.toLowerCase() },
      });

      if (existingDP) {
        // DP já existe — verificar se é de tipo diferente (colisão!)
        const isCollision = existingDP.isTameKangaroo !== (walkType === 'tame');

        if (isCollision) {
          console.log(`[KangarooManager] *** COLISÃO DETECTADA! Puzzle ${puzzleId} ***`);
          console.log(`  DP Existente: ${existingDP.isTameKangaroo ? 'Tame' : 'Wild'} - dist: ${existingDP.stepDistanceHex}`);
          console.log(`  DP Novo:      ${walkType} - dist: ${stepDistanceHex}`);

          return await this._handleCollision(puzzleId, existingDP, {
            pointX,
            pointY,
            walkType,
            startKey,
            stepDistanceHex,
            workerId,
          });
        }

        // DP do mesmo tipo — já registrado, sem colisão
        return { status: 'dp_already_exists', dp_id: existingDP.id, collision: false };
      }

      // Novo DP — salvar no banco
      const newDP = await prisma.distinguishedPoint.create({
        data: {
          puzzleId,
          userId:          workerId,
          xCoordHex:       pointX.toLowerCase(),
          yCoordHex:       (pointY || '').toLowerCase(),
          stepDistanceHex: stepDistanceHex.replace(/^0x/i, ''),
          isTameKangaroo:  walkType === 'tame',
          // Campos extras (se existir no schema — tolerante)
          ...(walkSeed ? { walkSeed } : {}),
        },
      });

      return {
        status:    'dp_registered',
        dp_id:     newDP.id,
        collision: false,
        walk_type: walkType,
        dp_bits:   DP_BITS,
      };

    } catch (err) {
      // Conflito de constraint unique (race condition) — ignorar silenciosamente
      if (err.code === 'P2002') {
        return { status: 'dp_conflict', message: 'DP registrado por outro worker simultaneamente' };
      }
      console.error('[KangarooManager] Erro ao salvar DP:', err.message);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLE COLLISION — Colisão entre Tame e Wild detectada
  // ═══════════════════════════════════════════════════════════════════════════
  async _handleCollision(puzzleId, existingDP, newDP) {
    // Identificar qual é Tame e qual é Wild
    const tameDP = existingDP.isTameKangaroo ? existingDP : newDP;
    const wildDP = existingDP.isTameKangaroo ? newDP : existingDP;

    // Buscar dados do puzzle para verificação
    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
    if (!puzzle) {
      return { error: 'puzzle_not_found', collision: false };
    }

    // Obter rangeStart do puzzle para a reconstrução
    const rangeStartHex = (puzzle.rangeStart || '').replace(/^'/,'');

    // Tentar reconstruir a chave privada (ambas hipóteses de Y)
    const tamePoint = {
      stepDistanceHex: tameDP.stepDistanceHex || tameDP.distance || '0',
      startKey:        tameDP.startKey || rangeStartHex,
    };
    const wildPoint = {
      stepDistanceHex: wildDP.stepDistanceHex || wildDP.distance || '0',
      startKey:        wildDP.startKey || puzzle.rangeEnd || '0',
    };

    const result = resolveCollisionPrivateKey(tamePoint, wildPoint, rangeStartHex, puzzle.targetAddress || puzzle.targetPublicKey);

    if (result.isValid) {
      console.log(`[KangarooManager] ✅ CHAVE VÁLIDA ENCONTRADA: ${result.privateKeyHex}`);

      // Marcar puzzle como resolvido
      await prisma.puzzle.update({
        where: { id: puzzleId },
        data:  {
          status:   'SOLVED',
          solvedAt: new Date(),
          solvedBy: `Kangaroo_worker_${wildDP.workerId || wildDP.userId || 'unknown'}`,
        },
      });

      // Log de auditoria
      await prisma.auditLog.create({
        data: {
          eventCategory: 'KANGAROO_COLLISION',
          severity:      'CRITICAL',
          details:       JSON.stringify({
            puzzleId,
            privateKeyHex: result.privateKeyHex,
            hypothesis:    result.hypothesis,
            tame_worker:   tameDP.userId,
            wild_worker:   wildDP.workerId || wildDP.userId,
          }),
        },
      }).catch(() => {}); // Não falhar se AuditLog não existir

      return {
        status:        'found',
        collision:     true,
        private_key:   result.privateKeyHex,
        puzzle_id:     puzzleId,
        puzzle_number: puzzle.puzzleNumber,
        btc_value:     puzzle.prizeAmount,
        hypothesis:    result.hypothesis,
        message:       `PUZZLE #${puzzle.puzzleNumber} RESOLVIDO! ${puzzle.prizeAmount} BTC encontrados!`,
      };
    }

    // Colisão espúria (falso positivo)
    console.warn('[KangarooManager] Colisão espúria — nenhuma hipótese escalar validou o endereço.');
    return {
      status:    'collision_false_positive',
      collision: true,
      message:   'Colisão não gerou chave válida — prosseguindo com walks',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GET SEED — Fornece starting point para worker
  // 10 Tame + 10 Wild distribuídos ao longo do range COMPLETO
  // ═══════════════════════════════════════════════════════════════════════════
  async getSeed(puzzleId, walkType, workerIndex = null) {
    const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
    if (!puzzle) return { error: 'puzzle_not_found' };

    const rangeStartHex = (puzzle.rangeStart || '').replace(/^'/,'');
    const rangeEndHex   = (puzzle.rangeEnd || '').replace(/^'/,'');

    // Gerar 10 starting points por tipo, distribuídos no range COMPLETO
    const { tame, wild } = generateKangarooStartingPoints(rangeStartHex, rangeEndHex, MAX_WALKS_PER_SEED);

    // Se workerIndex definido, usar ponto específico; senão, aleatório
    let startKey;
    const points = walkType === 'tame' ? tame : wild;

    if (workerIndex !== null && workerIndex >= 0 && workerIndex < points.length) {
      startKey = points[workerIndex];
    } else {
      // Distribuição pseudo-aleatória baseada em timestamp para diversidade
      const idx = Math.floor(Date.now() / 1000) % points.length;
      startKey  = points[idx];
    }

    // Também incluir o DP_BITS configurado para o puzzle
    const dpBitsForPuzzle = puzzle.bitRange >= 71 ? DP_BITS : Math.max(16, puzzle.bitRange - 10);

    return {
      puzzle_id:        puzzleId,
      puzzle_number:    puzzle.puzzleNumber,
      walk_type:        walkType,
      start_key:        startKey,
      range_start:      rangeStartHex,
      range_end:        rangeEndHex,
      dp_bits:          dpBitsForPuzzle,
      jump_table:       STEP_SIZES_HEX.slice(0, 32), // 32 saltos da tabela
      target_address:   puzzle.targetAddress,
      target_pub_key:   puzzle.targetPublicKey,
      // Instruções para o worker
      instructions: {
        tame_note: walkType === 'tame'
          ? 'Caminhe a partir de start_key somando jump_table[x & 31]. Envie cada DP encontrado.'
          : 'Caminhe a partir de start_key usando o ponto público alvo como offset. Envie cada DP.',
        mobile_note: 'Para dispositivos móveis: execute 10.000 passos, envie DPs encontrados, repita ao reconectar.',
        step_limit: 'Não há limite de passos — quanto mais passos, maior a contribuição para colisão.',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POOL STATS — Estatísticas do pool Kangaroo
  // ═══════════════════════════════════════════════════════════════════════════
  async getPoolStats(puzzleId) {
    const [tameCount, wildCount, totalDPs, recentWorkers] = await Promise.all([
      prisma.distinguishedPoint.count({
        where: { puzzleId, isTameKangaroo: true },
      }),
      prisma.distinguishedPoint.count({
        where: { puzzleId, isTameKangaroo: false },
      }),
      prisma.distinguishedPoint.count({
        where: { puzzleId },
      }),
      prisma.distinguishedPoint.groupBy({
        by:    ['userId'],
        where: {
          puzzleId,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // últimos 5min
        },
        _count: { userId: true },
      }),
    ]);

    // Probabilidade de colisão ≈ m² / (2 × n)
    // Onde m = total DPs e n é proporcional ao range
    const collisionProb = Math.min(
      (tameCount * wildCount) / Math.pow(2, 30),
      0.99
    );

    return {
      puzzle_id:          puzzleId,
      tame_dps:           tameCount,
      wild_dps:           wildCount,
      total_dps:          totalDPs,
      active_workers:     recentWorkers.length,
      collision_probability_pct: (collisionProb * 100).toFixed(4),
      dp_bits:            DP_BITS,
      jump_table_size:    STEP_SIZES_HEX.length,
      ttl_hours:          DP_TTL_HOURS,
      starting_points_per_type: MAX_WALKS_PER_SEED,
      note: 'Kangaroo opera no range completo. Chance de colisao aumenta quadraticamente com DPs.',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP — Remover DPs órfãos (TTL expirado)
  // Executar via cron diário ou manualmente
  // ═══════════════════════════════════════════════════════════════════════════
  async cleanupOrphanDPs() {
    const cutoff = new Date(Date.now() - DP_TTL_HOURS * 60 * 60 * 1000);

    // DPs mais antigos que TTL em puzzles ainda não resolvidos
    const result = await prisma.distinguishedPoint.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        puzzle:    { status: { not: 'SOLVED' } },
      },
    }).catch(err => {
      console.warn('[KangarooManager] Cleanup parcial:', err.message);
      return { count: 0 };
    });

    console.log(`[KangarooManager] 🧹 Limpeza de DPs órfãos: ${result.count} removidos (TTL ${DP_TTL_HOURS}h)`);
    return { cleaned: result.count, cutoff };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // START CLEANUP CRON — Executar limpeza diariamente
  // ═══════════════════════════════════════════════════════════════════════════
  startCleanupCron() {
    if (this._cleanupInterval) return;
    const INTERVAL_MS = DP_TTL_HOURS * 60 * 60 * 1000;
    this._cleanupInterval = setInterval(() => this.cleanupOrphanDPs(), INTERVAL_MS);
    console.log(`[KangarooManager] Cleanup cron iniciado (a cada ${DP_TTL_HOURS}h)`);
  }

  stopCleanupCron() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }
}

module.exports = new KangarooManager();
