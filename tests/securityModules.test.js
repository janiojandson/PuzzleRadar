// =========================================================================
// 🧩 PuzzleRadar — Testes dos Módulos de Segurança e Pool Colaborativo
// =========================================================================

const assert = require('assert');
const { verifyPubKeyToAddress, verifyDiscoveryProof, deriveBitcoinAddress } = require('../src/lib/cryptoVerifier');
const { honeypotShield } = require('../src/services/honeypotShield');
const { antiMevRescue } = require('../src/services/antiMevRescue');
const { onChainWatcher } = require('../src/services/onChainWatcher');

async function runSecurityTests() {
  console.log('🔒 PuzzleRadar — Iniciando Bateria de Testes dos 4 Módulos de Segurança...\n');

  // ─── TESTE 1: Validação Matemática de Par Chave Pública / Endereço (secp256k1 + SHA256 + RIPEMD160) ───
  console.log('🧪 Teste 1: Prova Criptográfica de Endereço a partir de Chave Pública (Puzzle #1)');
  const pubKey1 = '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
  const expectedAddr1 = '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH';
  const proof1 = verifyPubKeyToAddress(pubKey1, expectedAddr1);
  assert.strictEqual(proof1.isValid, true, 'Deveria validar o endereço do Puzzle #1');
  console.log('   ✅ Endereço gerado bate com o alvo exato:', proof1.derivedAddress);

  console.log('\n🧪 Teste 2: Rejeição de Chave Pública Divergente (Anti-Waste Quarantine)');
  const fakePubKey = '020000000000000000000000000000000000000000000000000000000000000001';
  const proofFake = verifyPubKeyToAddress(fakePubKey, expectedAddr1);
  assert.strictEqual(proofFake.isValid, false, 'Deveria rejeitar chave divergente');
  console.log('   ✅ Quarentena ativada com sucesso:', proofFake.reason);

  // ─── TESTE 2: Anti-Honeypot Shield para Desafios EVM / Solana ───
  console.log('\n🧪 Teste 3: Auditoria do Honeypot Shield para Smart Contracts');
  const auditResult = await honeypotShield.auditContractChallenge('0x391694e7e0b0cce554cb130d723a9d27458f9298', 'ETH');
  assert.strictEqual(auditResult.isSafe, true);
  assert.strictEqual(auditResult.prizeWithdrawable, true);
  console.log('   ✅ Desafio EVM auditado com segurança. Status:', auditResult.status);

  // ─── TESTE 3: Anti-MEV Secure Rescue Engine ───
  console.log('\n🧪 Teste 4: Submissão de Resgate Confidencial (Anti-MEV / Flashbots / Private Relay)');
  // Simula resgate do Puzzle #1 (chave 0x1)
  const rescueRes = await antiMevRescue.executeRescue({
    chain: 'BTC',
    challengeId: 'BTC_1000_P1',
    privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
    targetAddress: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'
  });
  assert.strictEqual(rescueRes.success, true);
  assert.strictEqual(rescueRes.rescue.status, 'SECURE_RESCUE_INITIATED');
  console.log('   ✅ Resgate confidencial roteado por canal privado:', rescueRes.rescue.protectionProtocol);

  // ─── TESTE 4: On-Chain Watcher Sentinel ───
  console.log('\n🧪 Teste 5: Sentinela On-Chain & Mempool API');
  onChainWatcher.initDefaultTargets();
  const summary = onChainWatcher.getStatusSummary();
  assert.ok(summary.targets.length >= 10, 'Deve vigiar os alvos prioritários');
  console.log(`   ✅ Sentinela ativo vigiando ${summary.targets.length} carteiras prioritárias no Mempool.space.`);

  console.log('\n🎉 TODOS OS 5 TESTES DE SEGURANÇA E POOL PASSARAM COM SUCESSO!\n');
}

runSecurityTests().catch(err => {
  console.error('❌ Falha nos testes de segurança:', err);
  process.exit(1);
});
