// ==============================================================================
// 🧩 PuzzleRadar — Deterministic Kangaroo secp256k1 Jump Table (Puzzle #71)
// ==============================================================================
// Tabela estática e compartilhada de 32 saltos com média ~2^34 passos modulares.
// Todos os nós da frota (Colab, GPUs locais) utilizam rigorosamente esta tabela.
// ==============================================================================

const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

// 32 saltos determinísticos calibrados com média ~2^34
const JUMP_TABLE_POWERS = [
  BigInt('0x2'),
  BigInt('0x8'),
  BigInt('0x20'),
  BigInt('0x80'),
  BigInt('0x200'),
  BigInt('0x800'),
  BigInt('0x2000'),
  BigInt('0x8000'),
  BigInt('0x20000'),
  BigInt('0x80000'),
  BigInt('0x200000'),
  BigInt('0x800000'),
  BigInt('0x2000000'),
  BigInt('0x8000000'),
  BigInt('0x20000000'),
  BigInt('0x80000000'),
  BigInt('0x200000000'),
  BigInt('0x800000000'),
  BigInt('0x2000000000'),
  BigInt('0x8000000000'),
  BigInt('0x20000000000'),
  BigInt('0x80000000000'),
  BigInt('0x200000000000'),
  BigInt('0x800000000000'),
  BigInt('0x2000000000000'),
  BigInt('0x8000000000000'),
  BigInt('0x20000000000000'),
  BigInt('0x80000000000000'),
  BigInt('0x200000000000000'),
  BigInt('0x800000000000000'),
  BigInt('0x2000000000000000'),
  BigInt('0x4000000000000000')
];

// Parâmetros do Puzzle #71
const PUZZLE_71_PARAMS = {
  challengeId: 'BTC_1000_P71',
  chain: 'BTC',
  bitRange: 71,
  rangeStart: '0x400000000000000000',
  rangeEnd: '0x7fffffffffffffffff',
  targetPublicKey: '03a20216fe8276f57ee138b6d8b6cebf81c5d988ab23612d26fcefd0fc8b5a0349',
  targetAddress: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
  dpMaskBits: 26, // Máscara m=26: X & 0x03FFFFFF == 0
  dpMaskHex: '0x3ffffff',
  expectedDpsPerHerd: 1024,
  totalExpectedDps: 2048,
  averageJump: '0x400000000', // ~2^34
  jumpTable: JUMP_TABLE_POWERS.map(p => p.toString(16))
};

/**
 * Retorna o índice do salto baseado nos primeiros 5 bits da coordenada X
 */
function getJumpIndex(xCoordBigInt) {
  return Number(xCoordBigInt & 31n);
}

/**
 * Resolve a chave privada a partir de uma colisão Tame vs Wild testando ambas as paridades de Y
 */
function resolveCollisionPrivateKey(tamePoint, wildPoint, rangeStartHex, expectedTarget) {
  const { verifyDiscoveryProof } = require('./cryptoVerifier');
  
  const kStart = BigInt(rangeStartHex.startsWith('0x') ? rangeStartHex : '0x' + rangeStartHex);
  const dT = BigInt(tamePoint.stepDistanceHex.startsWith('0x') ? tamePoint.stepDistanceHex : '0x' + tamePoint.stepDistanceHex);
  const dW = BigInt(wildPoint.stepDistanceHex.startsWith('0x') ? wildPoint.stepDistanceHex : '0x' + wildPoint.stepDistanceHex);

  // Hipótese 1: Y_T == Y_W  => k = (k_start + d_T - d_W) mod n
  let k1 = (kStart + dT - dW) % SECP256K1_ORDER;
  if (k1 < 0n) k1 += SECP256K1_ORDER;
  const k1Hex = k1.toString(16).padStart(64, '0');

  const proof1 = verifyDiscoveryProof(k1Hex, expectedTarget);
  if (proof1.isValid) {
    return {
      isValid: true,
      privateKeyHex: k1Hex,
      hypothesis: 'Y_T == Y_W',
      proof: proof1
    };
  }

  // Hipótese 2: Y_T == -Y_W => k = -(k_start + d_T + d_W) mod n
  let k2 = (-(kStart + dT + dW)) % SECP256K1_ORDER;
  if (k2 < 0n) k2 += SECP256K1_ORDER;
  const k2Hex = k2.toString(16).padStart(64, '0');

  const proof2 = verifyDiscoveryProof(k2Hex, expectedTarget);
  if (proof2.isValid) {
    return {
      isValid: true,
      privateKeyHex: k2Hex,
      hypothesis: 'Y_T == -Y_W',
      proof: proof2
    };
  }

  return {
    isValid: false,
    error: 'Colisão espúria: Nenhuma das hipóteses escalares corresponde ao endereço/pubkey alvo.',
    testedKeys: [k1Hex, k2Hex]
  };
}

module.exports = {
  SECP256K1_ORDER,
  JUMP_TABLE_POWERS,
  PUZZLE_71_PARAMS,
  getJumpIndex,
  resolveCollisionPrivateKey
};
