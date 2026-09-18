// =========================================================================
// 🧩 PuzzleRadar v5.3 — CPU Elliptic Curve Point Addition Engine (secp256k1)
// =========================================================================
// Executa a busca sequencial real de chaves na curva elíptica secp256k1 utilizando
// Adição Sequencial de Pontos (P_{i+1} = P_i + G) com BigInt nativo.
// Transforma multiplicações pesadas (k*G) em simples somas algébricas na curva.
// =========================================================================

const http = require('http');
const https = require('https');
const crypto = require('crypto');

// Constantes Soberanas da Curva secp256k1
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

/** Exponenciação Modular Inversa (P - 2) via Fermat's Little Theorem */
function modInverse(k, p = P) {
  if (k === 0n) return 0n;
  let result = 1n;
  let base = k % p;
  let exp = p - 2n;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % p;
    base = (base * base) % p;
    exp /= 2n;
  }
  return result;
}

/** Adição de dois Pontos na curva secp256k1: P1 + P2 */
function pointAdd(p1, p2) {
  if (!p1) return p2;
  if (!p2) return p1;
  if (p1.x === p2.x && p1.y !== p2.y) return null;

  let slope;
  if (p1.x === p2.x && p1.y === p2.y) {
    // Duplicação de Ponto
    const num = (3n * p1.x * p1.x) % P;
    const den = modInverse(2n * p1.y, P);
    slope = (num * den) % P;
  } else {
    // Adição de Pontos Distintos
    const num = (p2.y - p1.y + P) % P;
    const den = modInverse((p2.x - p1.x + P) % P, P);
    slope = (num * den) % P;
  }

  const x3 = (slope * slope - p1.x - p2.x) % P;
  const x3Pos = (x3 + P) % P;
  const y3 = (slope * (p1.x - x3Pos) - p1.y) % P;
  const y3Pos = (y3 + P) % P;

  return { x: x3Pos, y: y3Pos };
}

/** Multiplicação Escalar k * G (utilizado apenas para encontrar o Ponto Inicial da fatia P0) */
function scalarMultiply(k) {
  let current = { x: Gx, y: Gy };
  let result = null;
  let exp = k;

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = pointAdd(result, current);
    }
    current = pointAdd(current, current);
    exp /= 2n;
  }
  return result;
}

/** Converte Ponto (x, y) em chave pública comprimida (33 bytes Hex) */
function pointToCompressedPubkeyHex(point) {
  const prefix = (point.y % 2n === 0n) ? '02' : '03';
  const xHex = point.x.toString(16).padStart(64, '0');
  return prefix + xHex;
}

/** Converte Chave Pública Comprimida Hex em HASH160 Hex */
function pubkeyHexToHash160(pubkeyHex) {
  const pubkeyBuffer = Buffer.from(pubkeyHex, 'hex');
  const sha256 = crypto.createHash('sha256').update(pubkeyBuffer).digest();
  const ripemd160 = crypto.createHash('ripemd160').update(sha256).digest();
  return ripemd160.toString('hex');
}

// -------------------------------------------------------------------------
// Engine de Mineração Terminal
// -------------------------------------------------------------------------
async function startCpuMiner() {
  const args = process.argv.slice(2);
  const workerName = process.env.WORKER_NAME || args[0] || `Node_CPU_${Math.floor(Math.random() * 9000 + 1000)}`;
  const hubUrl = process.env.HUB_URL || 'https://puzzleradar-production.up.railway.app';

  console.log(`======================================================================`);
  console.log(` 🧩 PuzzleRadar v5.3 — Motor Criptográfico CPU secp256k1 (Adição P + G)`);
  console.log(` [+] Worker: ${workerName}`);
  console.log(` [+] Hub Server: ${hubUrl}`);
  console.log(` [+] Algoritmo: Adição de Pontos Elípticos secp256k1 com BigInt Nativo`);
  console.log(`======================================================================\n`);

  const G = { x: Gx, y: Gy };

  while (true) {
    try {
      console.log(`[*] Requisitando próxima fatia otimizada do Hub...`);
      const rangeData = await fetchJson(`${hubUrl}/api/range/next/${workerName}?client=browser`);

      if (rangeData && rangeData.custom_range) {
        const [startStr, endStr] = rangeData.custom_range.split(':');
        const startBig = BigInt('0x' + startStr);
        const endBig = BigInt('0x' + endStr);
        const totalKeys = endBig - startBig;

        console.log(`[+] Fatia alocada: 0x${startStr} ➔ 0x${endStr} (~${(Number(totalKeys) / 1e6).toFixed(2)}M chaves)`);

        // 1. Calcula o Ponto Inicial P0 = startBig * G (Apenas uma multiplicação escalar!)
        console.log(`[*] Calculando Ponto Inicial P0 na curva elíptica...`);
        let P_curr = scalarMultiply(startBig);

        const startTime = Date.now();
        let lastReportTime = startTime;
        let keysChecked = 0n;

        // Metas de busca (P71 + 6 PoW Addrs HASH160)
        const targetMap = new Map();
        if (Array.isArray(rangeData.targets)) {
          rangeData.targets.forEach(t => targetMap.set(t.hash160, t));
        }

        // Loop principal de Adição de Pontos: P_{i+1} = P_i + G
        for (let k = startBig; k < endBig; k++) {
          const pubkeyHex = pointToCompressedPubkeyHex(P_curr);
          const h160 = pubkeyHexToHash160(pubkeyHex);

          // Verifica colisão contra os 7 alvos HASH160
          if (targetMap.has(h160)) {
            const matched = targetMap.get(h160);
            const keyHex = k.toString(16).padStart(64, '0');

            console.log(`\n🎉🎉🎉 [DESCOBERTA] CHAVE ENCONTRADA! Type: ${matched.type} | Key: ${keyHex} | Addr: ${matched.address} 🎉🎉🎉\n`);

            if (matched.type === 'P71') {
              // Resgate Anti-MEV do Puzzle 71
              await postJson(`${hubUrl}/api/webhook/btcpuzzle`, {
                status: 'keyFound',
                privatekey: keyHex,
                workername: workerName,
                targetpuzzle: '71'
              });
            } else {
              // Submissão PoW
              await postJson(`${hubUrl}/api/worker/submit-pow`, {
                workerName,
                keyHex,
                targetAddress: matched.address
              });
            }
          }

          // Avança para o próximo ponto P_{i+1} = P_i + G
          P_curr = pointAdd(P_curr, G);
          keysChecked++;

          // Telemetria a cada 100.000 chaves
          if (keysChecked % 100000n === 0n) {
            const now = Date.now();
            const elapsedSec = (now - lastReportTime) / 1000;
            const speed = Math.round(100000 / elapsedSec);
            lastReportTime = now;

            const progress = ((Number(keysChecked) / Number(totalKeys)) * 100).toFixed(2);
            process.stdout.write(`\r[*] Progresso: ${progress}% | Vel: ${(speed / 1000).toFixed(2)} kH/s | Chave Atual: 0x${k.toString(16)}`);
          }
        }

        const totalElapsed = (Date.now() - startTime) / 1000;
        const avgSpeed = Math.round(Number(keysChecked) / totalElapsed);
        console.log(`\n[+] Fatia Concluída! Média: ${(avgSpeed / 1000).toFixed(2)} kH/s em ${totalElapsed.toFixed(1)}s.\n`);

        // Notifica conclusão do lote ao Hub
        await postJson(`${hubUrl}/api/webhook/btcpuzzle`, {
          status: 'rangeScanned',
          hex: startStr,
          workername: workerName,
          targetpuzzle: '71',
          hashrate: `${(avgSpeed / 1000).toFixed(2)} kH/s`
        });
      }
    } catch (err) {
      console.error(`[-] Erro no loop de mineração:`, err.message);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const body = JSON.stringify(payload);
    const parsed = new URL(url);

    const req = client.request({
      hostname: parsed.hostname,
      port: parsed.port || (url.startsWith('https') ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

if (require.main === module) {
  startCpuMiner();
}

module.exports = {
  startCpuMiner,
  modInverse,
  pointAdd,
  scalarMultiply,
  pointToCompressedPubkeyHex,
  pubkeyHexToHash160
};
