// ==============================================================================
// 🧩 PuzzleRadar v4.0 — Worker Kangaroo (Node.js / Mobile-Friendly)
// ==============================================================================
// Executa caminhadas aleatórias Pollard's Kangaroo e envia DPs ao servidor.
//
// COMPATÍVEL COM:
//   - Servidores Node.js (CPUs dedicadas)
//   - Desktops (walks longas, muitos DPs)
//   - Mobile/Browser (walks curtas de 1.000-10.000 passos, envia e desconecta)
//
// COMO USAR:
//   node kangarooWorker.js --puzzle-id <ID> --walk-type tame --steps 100000
//   API_BASE=https://... WORKER_ID=meu-token node kangarooWorker.js
//
// VARIÁVEIS DE AMBIENTE:
//   API_BASE     — URL do servidor (ex: https://puzzleradar.railway.app)
//   WORKER_ID    — Token do worker
//   WALK_TYPE    — 'tame' ou 'wild' (padrão: aleatório)
//   MAX_STEPS    — Passos por sessão (padrão: ilimitado, 0 = ilimitado)
//   PUZZLE_ID    — ID do puzzle alvo
// ==============================================================================

const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const SECP256K1_N = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// Tabela de 32 saltos calibrados (média ~2^34) — idêntica ao kangarooTable.js
const JUMP_TABLE = [
  0x2n, 0x8n, 0x20n, 0x80n, 0x200n, 0x800n, 0x2000n, 0x8000n,
  0x20000n, 0x80000n, 0x200000n, 0x800000n, 0x2000000n, 0x8000000n,
  0x20000000n, 0x80000000n, 0x200000000n, 0x800000000n, 0x2000000000n,
  0x8000000000n, 0x20000000000n, 0x80000000000n, 0x200000000000n,
  0x800000000000n, 0x2000000000000n, 0x8000000000000n, 0x20000000000000n,
  0x80000000000000n, 0x200000000000000n, 0x800000000000000n,
  0x2000000000000000n, 0x4000000000000000n,
];

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
const CONFIG = {
  apiBase:   process.env.API_BASE   || 'https://puzzleradar-production.up.railway.app',
  workerId:  process.env.WORKER_ID  || `KANG-NODE-${Date.now()}`,
  walkType:  process.env.WALK_TYPE  || (Math.random() < 0.5 ? 'tame' : 'wild'),
  maxSteps:  parseInt(process.env.MAX_STEPS  || '0'),  // 0 = ilimitado
  puzzleId:  process.env.PUZZLE_ID  || null,
  dpBits:    parseInt(process.env.DP_BITS    || '26'), // ~1 DP a cada 67M passos
  heartbeatIntervalMs: 60_000,       // heartbeat a cada 60s
  reconnectDelayMs:    5_000,        // aguardar 5s em caso de erro
};

// ─── ESTADO ───────────────────────────────────────────────────────────────────
let state = {
  running:      true,
  currentKey:   0n,
  distance:     0n,
  stepsTaken:   0,
  dpsFound:     0,
  startTime:    Date.now(),
  startKey:     '0',
  seed:         null,
};

// ─── UTILIDADES HTTP ──────────────────────────────────────────────────────────
function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url     = new URL(CONFIG.apiBase + path);
    const isHttps = url.protocol === 'https:';
    const lib     = isHttps ? https : http;

    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers:  {
        'Content-Type': 'application/json',
        'User-Agent':   `PuzzleRadar-KangarooWorker/4.0`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
      timeout:  15_000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── CRIPTOGRAFIA ─────────────────────────────────────────────────────────────
/**
 * Deriva a chave pública comprimida a partir de uma chave privada (BigInt)
 * usando o módulo nativo crypto do Node.js (secp256k1).
 */
function getPublicKeyX(privateKeyBigInt) {
  const privHex = privateKeyBigInt.toString(16).padStart(64, '0');
  const ecdh    = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(privHex, 'hex'));
  const pubKey  = ecdh.getPublicKey(null, 'compressed');
  // x-coordinate = bytes 1..32 da chave pública comprimida (33 bytes total)
  return BigInt('0x' + pubKey.slice(1, 33).toString('hex'));
}

/**
 * Calcula o índice do salto baseado nos 5 bits menos significativos do x
 * (idêntico ao getJumpIndex do kangarooTable.js)
 */
function getJumpIndex(xCoordBigInt) {
  return Number(xCoordBigInt & 31n);
}

/**
 * Verifica se um x-coordinate é Distinguished Point
 */
function isDP(xCoordBigInt) {
  const mask = (1n << BigInt(CONFIG.dpBits)) - 1n;
  return (xCoordBigInt & mask) === 0n;
}

// ─── LOOP PRINCIPAL ────────────────────────────────────────────────────────────
async function fetchSeed() {
  if (!CONFIG.puzzleId) {
    console.error('[Worker] PUZZLE_ID não definido. Defina via variável de ambiente.');
    process.exit(1);
  }

  console.log(`[Worker] Buscando seed para puzzle ${CONFIG.puzzleId}, walk type: ${CONFIG.walkType}`);
  const seed = await apiRequest('GET', `/api/kangaroo/seed/${CONFIG.puzzleId}/${CONFIG.walkType}`);

  if (seed.error) {
    console.error('[Worker] Erro ao buscar seed:', seed.error);
    throw new Error(seed.error);
  }

  return seed;
}

async function submitDP(xHex, stepDistanceHex) {
  state.dpsFound++;
  console.log(`[Worker] 📍 DP #${state.dpsFound} encontrado! Passos: ${state.stepsTaken.toLocaleString()} | Dist: 0x${stepDistanceHex.slice(0, 16)}...`);

  try {
    const result = await apiRequest('POST', '/api/kangaroo/submit-dp', {
      puzzle_id:         CONFIG.puzzleId,
      worker_id:         CONFIG.workerId,
      point_x:           xHex,
      walk_type:         CONFIG.walkType,
      start_key:         state.startKey,
      step_distance_hex: stepDistanceHex,
      steps_taken:       state.stepsTaken,
    });

    if (result.status === 'found') {
      console.log('\n🎉🎉🎉 CHAVE ENCONTRADA! 🎉🎉🎉');
      console.log(`Chave privada: ${result.private_key}`);
      console.log(`Puzzle #${result.puzzle_number} — ${result.btc_value} BTC`);
      state.running = false;
      return true;
    }

    if (result.status === 'collision_false_positive') {
      console.log('[Worker] Colisão espúria — continuando walks...');
    }

    return false;
  } catch (err) {
    console.warn('[Worker] Erro ao submeter DP:', err.message);
    return false;
  }
}

function printStats() {
  const elapsed = (Date.now() - state.startTime) / 1000;
  const rate    = elapsed > 0 ? (state.stepsTaken / elapsed) : 0;
  const rateStr = rate > 1_000_000
    ? `${(rate / 1_000_000).toFixed(2)} MH/s`
    : `${(rate / 1_000).toFixed(1)} KH/s`;

  console.log(
    `[Worker] Steps: ${state.stepsTaken.toLocaleString()} | ` +
    `DPs: ${state.dpsFound} | ` +
    `Taxa: ${rateStr} | ` +
    `Tipo: ${CONFIG.walkType.toUpperCase()}`
  );
}

async function run() {
  console.log('🦘 PuzzleRadar — Kangaroo Worker v4.0');
  console.log(`   Worker ID: ${CONFIG.workerId}`);
  console.log(`   Walk Type: ${CONFIG.walkType.toUpperCase()}`);
  console.log(`   DP Bits:   ${CONFIG.dpBits} (1 DP a cada ~${Math.pow(2, CONFIG.dpBits).toLocaleString()} passos)`);
  console.log(`   Max Steps: ${CONFIG.maxSteps === 0 ? 'Ilimitado' : CONFIG.maxSteps.toLocaleString()}`);
  console.log('');

  // Heartbeat periódico (imprime stats a cada 60s)
  const heartbeatTimer = setInterval(printStats, CONFIG.heartbeatIntervalMs);

  while (state.running) {
    try {
      // 1. Obter seed do servidor
      state.seed = await fetchSeed();
      state.currentKey = BigInt(state.seed.start_key);
      state.startKey   = state.seed.start_key;
      state.distance   = 0n;
      state.stepsTaken = 0;
      state.startTime  = Date.now();

      console.log(`[Worker] Iniciando walk a partir de: ${state.currentKey.toString(16)}`);

      // 2. Walk loop
      while (state.running) {
        // Verificar limite de steps (mobile: sessões curtas)
        if (CONFIG.maxSteps > 0 && state.stepsTaken >= CONFIG.maxSteps) {
          console.log(`[Worker] Limite de ${CONFIG.maxSteps} passos atingido. Reconectando...`);
          break;
        }

        // Calcular ponto público atual
        const xCoord   = getPublicKeyX(state.currentKey % SECP256K1_N);
        const jumpIdx  = getJumpIndex(xCoord);
        const stepSize = JUMP_TABLE[jumpIdx];

        // Avançar
        state.currentKey = (state.currentKey + stepSize) % SECP256K1_N;
        state.distance  += stepSize;
        state.stepsTaken++;

        // Verificar se é DP
        if (isDP(xCoord)) {
          const xHex           = xCoord.toString(16).padStart(64, '0');
          const stepDistHex    = state.distance.toString(16);
          const found = await submitDP(xHex, stepDistHex);
          if (found) break;
        }
      }

    } catch (err) {
      console.error('[Worker] Erro:', err.message);
      console.log(`[Worker] Reconectando em ${CONFIG.reconnectDelayMs / 1000}s...`);
      await new Promise(r => setTimeout(r, CONFIG.reconnectDelayMs));
    }
  }

  clearInterval(heartbeatTimer);
  printStats();
  console.log('[Worker] Encerrando.');
}

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────────
process.on('SIGINT',  () => { console.log('\n[Worker] SIGINT recebido. Encerrando...'); state.running = false; });
process.on('SIGTERM', () => { console.log('\n[Worker] SIGTERM recebido. Encerrando...'); state.running = false; });

// ─── START ────────────────────────────────────────────────────────────────────
run().catch(err => {
  console.error('[Worker] Erro fatal:', err.message);
  process.exit(1);
});
