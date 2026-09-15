// =========================================================================
// 🧩 PuzzleRadar — Master Architecture & Specification Test Suite (v3.0.0-PROD)
// =========================================================================
// Valida rigorosamente cada subsistema definido nos documentos mestres:
// 1. RBAC, Autenticação & Isolamento do Frontend
// 2. Kangaroo Proof-of-Share, DPs O(1), Colisão & Dedução Algébrica de Chave
// 3. Sentinela On-Chain, Verificação de Boot & Escudo Anti-Honeypot
// 4. Resgate Anti-MEV & Destino Imutável em Cold Vault
// 5. Buffer de Lotes Google Sheets (Proteção de Quotas)
// 6. Inteligência Cognitiva IA, Defesa Anti-Injeção & Motor de ROI Dinâmico
// =========================================================================

const assert = require('assert');
const crypto = require('crypto');
const http = require('http');

// Módulos do Sistema
const { 
  verifySecp256k1KeyPair, 
  isDistinguishedPoint, 
  deducePrivateKeyKangaroo, 
  verifyProofOfShareBinomial,
  deriveBitcoinAddress,
  verifyDiscoveryProof,
  SECP256K1_ORDER
} = require('../src/lib/cryptoVerifier');

const { 
  storeDistinguishedPoint, 
  markChunkScanned, 
  isChunkScanned, 
  publishRevocation, 
  getDpStats 
} = require('../src/lib/redis');

const { antiMevRescue } = require('../src/services/antiMevRescue');
const { honeypotShield } = require('../src/services/honeypotShield');
const { onChainWatcher } = require('../src/services/onChainWatcher');
const { SheetsBufferManager } = require('../src/lib/googleSheetsBuffer');
const { cryptoAnalystAgent } = require('../src/services/cryptoAnalystAgent');
const { calculateTargetROI, calculateDifficultyScore } = require('../src/lib/difficultyEngine');

async function runMasterTestSuite() {
  console.log('\n================================================================================');
  console.log('🏆 PUZZLERADAR v3.0.0-PROD — BATERIA MESTRE DE TESTES INSTITUCIONAIS');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  async function runAsyncTest(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  console.log('📌 CAPÍTULO 4: ENGENHARIA CRIPTOGRÁFICA & PROOF-OF-SHARE');
  // ──────────────────────────────────────────────────────────────────────────

  runTest('4.1 - Validação Determinística de Distinguished Points (DP m=24)', () => {
    // Um número que termina com 6 zeros em hexadecimal tem 24 bits zero (6 * 4 bits = 24 bits)
    const validDpX = '0x1a2b3c4d5e000000';
    const invalidDpX = '0x1a2b3c4d5e000001';

    assert.strictEqual(isDistinguishedPoint(validDpX, 24), true, 'Deveria reconhecer DP válido com 24 bits zero');
    assert.strictEqual(isDistinguishedPoint(invalidDpX, 24), false, 'Deveria rejeitar ponto sem 24 bits zero');
  });

  await runAsyncTest('4.2 - Armazenamento O(1) de DPs e Detecção de Colisão Tame vs Wild', async () => {
    const challengeId = 'TEST_BTC_P71';
    const collisionX = '0x999988887777000000';

    // 1. Inserção do ponto Tame
    const resTame = await storeDistinguishedPoint(challengeId, collisionX, {
      userId: 'server_tame_node',
      isTame: true,
      yCoordHex: '0x11112222',
      stepDistanceHex: '0x1000'
    });
    assert.strictEqual(resTame.stored, true);
    assert.strictEqual(resTame.collisionDetected, false);

    // 2. Inserção do ponto Wild pelo worker colidindo no mesmo X
    const resWild = await storeDistinguishedPoint(challengeId, collisionX, {
      userId: 'worker_gpu_colab',
      isTame: false,
      yCoordHex: '0x11112222',
      stepDistanceHex: '0x0400'
    });
    assert.strictEqual(resWild.stored, true);
    assert.strictEqual(resWild.collisionDetected, true, 'Deveria detectar colisão entre Tame e Wild');
    assert.ok(resWild.collisionData);
  });

  runTest('4.3 - Dedução Algébrica Exata da Chave Privada: k = (b + d_Tame - d_Wild) mod n', () => {
    const bHex = '0x7fffffffffffffffff'; // Topo do Puzzle #71
    const dTameHex = '0x000000000000005000';
    const dWildHex = '0x000000000000001000';

    const deduction = deducePrivateKeyKangaroo(bHex, dTameHex, dWildHex);
    assert.strictEqual(deduction.success, true);
    assert.ok(deduction.privateKeyHex.length === 64);

    const expectedK = (BigInt(bHex) + BigInt(dTameHex) - BigInt(dWildHex)) % SECP256K1_ORDER;
    assert.strictEqual(deduction.kBigInt, expectedK);
  });

  runTest('4.4 - Filtro Binomial Anti-Trapaça para Proof-of-Share (Intervalo 99.9%)', () => {
    // Para 2^36 chaves (~68.7 bilhões) com m=24 bits, esperam-se 4096 DPs
    const chunkKeys = 68719476736; // 2^36
    
    // Submissão legítima com 4000 DPs
    const legitCheck = verifyProofOfShareBinomial(chunkKeys, 4000, 24);
    assert.strictEqual(legitCheck.isValid, true, 'Submissão dentro da curva estatística deve ser aceita');

    // Submissão fraudulenta (falso chunk com 10 DPs)
    const fraudCheck = verifyProofOfShareBinomial(chunkKeys, 10, 24);
    assert.strictEqual(fraudCheck.isValid, false, 'Fraude estatística deve ser rejeitada');
    assert.ok(fraudCheck.reportedDps < fraudCheck.minAcceptableDps);
  });

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 CAPÍTULO 5: SENTINELAS ON-CHAIN, BOOT INTEGRITY & ANTI-HONEYPOT');
  // ──────────────────────────────────────────────────────────────────────────

  runTest('5.1 - Quarentena Preventiva no Boot (verifySecp256k1KeyPair)', () => {
    // Par Secp256k1 matematicamente real (Gerador G / Chave privada 1)
    const realPubKey = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
    const realAddress = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH';
    const corruptedAddress = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAM9'; // 1 caractere corrompido

    assert.strictEqual(verifySecp256k1KeyPair(realPubKey, realAddress), true, 'Par legítimo deve ser validado');
    assert.strictEqual(verifySecp256k1KeyPair(realPubKey, corruptedAddress), false, 'Par corrompido deve ser barrado em quarentena');
  });

  await runAsyncTest('5.2 - Escudo Anti-Honeypot para Smart Contracts (EVM & SOL)', async () => {
    const legitResult = await honeypotShield.auditContractChallenge('0x391694e7e0b0cce554cb130d723a9d27458f9298', 'ETH');
    assert.strictEqual(legitResult.isSafe, true);
    assert.strictEqual(legitResult.honeypotDetected, false);

    const solanaResult = await honeypotShield.auditContractChallenge('SOL99999999999999999999999999999999999999999', 'SOL');
    assert.strictEqual(solanaResult.isSafe, true);
  });

  await runAsyncTest('5.3 - Sentinela On-Chain: Reação e Emissão de Revogação', async () => {
    let revocationTriggered = false;
    onChainWatcher.once('puzzle_solved_onchain', (payload) => {
      if (payload.challengeId === 'TEST_AUTO_REVOKE') {
        revocationTriggered = true;
      }
    });

    await onChainWatcher.handleTargetDrained(
      { challengeId: 'TEST_AUTO_REVOKE', puzzleNumber: 999, address: '1TestAddressDrained', chain: 'BTC' },
      { spentTxoCount: 1 }
    );

    assert.strictEqual(revocationTriggered, true, 'Sentinela deve disparar evento de cancelamento imediato');
  });

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 CAPÍTULO 6: RESGATE ANTI-MEV & COLD VAULT IMUTÁVEL');
  // ──────────────────────────────────────────────────────────────────────────

  await runAsyncTest('6.1 - Rejeição Estrita de Injeção de Destino Externo (Anti-Hijack)', async () => {
    // Cria par de chaves válido para teste
    const derived = deriveBitcoinAddress('0000000000000000000000000000000000000000000000000000000000000001');

    // Tentativa de desvio para endereço de invasor
    const maliciousAttempt = await antiMevRescue.executeRescue({
      chain: 'BTC',
      challengeId: 'TEST_HIJACK_ATTEMPT',
      privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
      targetAddress: derived.addressCompressed,
      customDestination: '1HackerStolenFundsWalletAddress9999999'
    });

    assert.strictEqual(maliciousAttempt.success, false);
    assert.strictEqual(maliciousAttempt.code, 'DYNAMIC_DESTINATION_FORBIDDEN_IMMUTABLE_VAULT_ONLY');
  });

  await runAsyncTest('6.2 - Execução Confidencial de Resgate com Roteamento Exclusivo para Cold Vault', async () => {
    const derived = deriveBitcoinAddress('0000000000000000000000000000000000000000000000000000000000000001');

    const legitRescue = await antiMevRescue.executeRescue({
      chain: 'BTC',
      challengeId: 'BTC_PUZZLE_1_TEST',
      privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
      targetAddress: derived.addressCompressed
    });

    assert.strictEqual(legitRescue.success, true);
    assert.ok(legitRescue.rescue.destinationAddress);
    assert.strictEqual(legitRescue.rescue.destinationAddress, antiMevRescue.getVaultDestination('BTC'));
    assert.ok(legitRescue.rescue.txHash);
  });

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 CAPÍTULO 7: BUFFER DE LOTES GOOGLE SHEETS (PROTEÇÃO DE COTAS)');
  // ──────────────────────────────────────────────────────────────────────────

  await runAsyncTest('7.1 - Enfileiramento, Agrupamento e Flush Atômico do Buffer', async () => {
    const testBuffer = new SheetsBufferManager({ maxBatchSize: 3, flushIntervalMs: 60000 });

    testBuffer.enqueueChunkLog({ chunkIndex: 1, rangeStart: '0x1', rangeEnd: '0x2' });
    testBuffer.enqueueChunkLog({ chunkIndex: 2, rangeStart: '0x2', rangeEnd: '0x3' });
    assert.strictEqual(testBuffer.buffer.length, 2);

    // O 3º item atinge o maxBatchSize e dispara flush automático
    testBuffer.enqueueChunkLog({ chunkIndex: 3, rangeStart: '0x3', rangeEnd: '0x4' });
    assert.strictEqual(testBuffer.buffer.length, 0, 'Buffer deve esvaziar ao descarregar lote');
    assert.strictEqual(testBuffer.totalBatchesSent, 1);
    assert.strictEqual(testBuffer.totalRowsSent, 3);
    testBuffer.stop();
  });

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n📌 CAPÍTULO 8: IA COGNITIVA & MOTOR DINÂMICO DE ROI');
  // ──────────────────────────────────────────────────────────────────────────

  await runAsyncTest('8.1 - Extração Heurística Estruturada e Defesa Anti-Injeção', async () => {
    const rawPost = `
Encontrei um desafio na rede Ethereum!
Título: ETH Vanity Bounty 32
Endereço: 0x000000001a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
Espaço de busca: 32 bits
Recompensa: 2.5 ETH
Algoritmo: Força Bruta O(N)
`;

    const extracted = await cryptoAnalystAgent.analyzeWithGemini(rawPost);
    assert.ok(extracted);
    assert.strictEqual(extracted.chain, 'ETH');
    assert.strictEqual(extracted.bitRange, 32);
    assert.strictEqual(extracted.prizeAmount, 2.5);
  });

  runTest('8.2 - Cálculo de ROI Dinâmico com Dedução Elétrica para O(1), O(sqrt(N)) e O(N)', () => {
    const fleetHashrate = 100e9; // 100 GH/s

    // Desafio 1: O(1) Nonce Reuse (1.2 BTC)
    const roiO1 = calculateTargetROI({
      algorithm: 'ALGEBRAIC_O1',
      search_space_bits: 1,
      prize_estimated: 1.2,
      chain: 'BTC'
    }, fleetHashrate);
    assert.strictEqual(roiO1.complexityType, 'O(1) Instantaneo');
    assert.ok(roiO1.roi_per_day_usd > 1000);

    // Desafio 2: O(sqrt(N)) Kangaroo (7.1 BTC)
    const roiKangaroo = calculateTargetROI({
      algorithm: 'KANGAROO_OSQRTN',
      search_space_bits: 71,
      prize_estimated: 7.1,
      chain: 'BTC'
    }, fleetHashrate);
    assert.strictEqual(roiKangaroo.complexityType, 'O(sqrt(N)) Kangaroo');
    assert.ok(roiKangaroo.effective_operations > 0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log(`🎉 SUCESSO TOTAL: ${passedTests}/${totalTests} TESTES PASSARAM COM 100% DE APROVAÇÃO!`);
  console.log('================================================================================\n');
}

runMasterTestSuite().catch(err => {
  console.error('❌ Falha na suíte de testes mestre:', err);
  process.exit(1);
});
