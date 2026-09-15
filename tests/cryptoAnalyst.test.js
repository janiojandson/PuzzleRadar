// =========================================================================
// 🧩 PuzzleRadar — Testes Automatizados do Analista IA, Cold Vault e Pool
// =========================================================================

const assert = require('assert');
const { cryptoAnalystAgent } = require('../src/services/cryptoAnalystAgent');
const { antiMevRescue } = require('../src/services/antiMevRescue');
const { calculateTargetROI } = require('../src/lib/difficultyEngine');

async function runAnalystTests() {
  console.log('🤖 PuzzleRadar — Iniciando Bateria de Testes do Analista IA & Segurança...\n');

  // ─── TESTE 1: Ingestão e Extração Estruturada do Analista IA ───
  console.log('🧪 Teste 1: Extração estruturada de oportunidade a partir de texto bruto');
  const sampleText = `
    ATENÇÃO CTF: Novo desafio de puzzle na rede Bitcoin.
    Endereço alvo: 1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU
    Prêmio anunciado: 7.1 BTC
    Chave de 71 bits com chave pública secp256k1 exposta (03a2edd49e819e4d0473cf694931a5eb8db846ee74f4842188ab642784cf072895).
  `;

  const opp = await cryptoAnalystAgent.ingestAndEvaluate(sampleText, 42000000000);
  assert.strictEqual(opp.chain, 'BTC');
  assert.strictEqual(opp.prizeAmount, 7.1);
  assert.ok(opp.roi, 'Deve calcular o ROI da oportunidade');
  console.log(`   ✅ Extração com sucesso: ${opp.title}`);
  console.log(`   📊 ROI Diário Projetado: ${opp.roi.roiPerDayFormatted} (${opp.roi.algorithmType})`);

  // ─── TESTE 2: Receptor de Comandos /aprovar <TARGET_ID> ───
  console.log('\n🧪 Teste 2: Receptor de Comando /aprovar <TARGET_ID>');
  const approveRes = await cryptoAnalystAgent.approveTargetCommand(opp.targetId, 'Operador Nexus Telegram');
  assert.strictEqual(approveRes.success, true);
  assert.strictEqual(approveRes.opportunity.status, 'APPROVED_IN_PRODUCTION');
  console.log(`   ✅ Comando executado: Alvo ${opp.targetId} aprovado e integrado à frota.`);

  // ─── TESTE 3: Blindagem de Cofre Frio & Bloqueio de Injeção de Destino no Anti-MEV ───
  console.log('\n🧪 Teste 3: Rejeição de Injeção de Endereço Dinâmico no Anti-MEV Rescue');
  const hijackAttempt = await antiMevRescue.executeRescue({
    chain: 'BTC',
    challengeId: 'BTC_1000_P1',
    privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
    targetAddress: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
    customDestination: '1AttackerHackerWalletAddress111111111'
  });

  assert.strictEqual(hijackAttempt.success, false);
  assert.strictEqual(hijackAttempt.code, 'DYNAMIC_DESTINATION_FORBIDDEN_IMMUTABLE_VAULT_ONLY');
  console.log('   ✅ Tentativa de injeção externa bloqueada com sucesso! Código:', hijackAttempt.code);

  console.log('\n🧪 Teste 4: Resgate Válido Direto para o Cofre Frio Imutável');
  const validRescue = await antiMevRescue.executeRescue({
    chain: 'BTC',
    challengeId: 'BTC_1000_P1',
    privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
    targetAddress: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'
  });

  assert.strictEqual(validRescue.success, true);
  const coldVaultAddr = antiMevRescue.getVaultDestination('BTC');
  assert.strictEqual(validRescue.rescue.destinationAddress, coldVaultAddr);
  console.log(`   ✅ Resgate roteado estritamente para o Cold Vault: ${validRescue.rescue.destinationAddress}`);

  console.log('\n🎉 TODOS OS TESTES DO ANALISTA IA, COLD VAULT E POOL PASSARAM COM SUCESSO!\n');
}

runAnalystTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});
