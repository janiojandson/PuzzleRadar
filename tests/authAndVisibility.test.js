// =========================================================================
// 🧩 PuzzleRadar — Testes de Autenticação, Proteção de Rotas e Expurgamento
// =========================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { generateToken, verifyToken } = require('../src/lib/auth');
const { antiMevRescue } = require('../src/services/antiMevRescue');

async function runAuthAndVisibilityTests() {
  console.log('🔒 PuzzleRadar — Iniciando Bateria de Testes de Autenticação & Blindagem...\n');

  // ─── TESTE 1: Auditoria de Expurgamento de Links da Planilha no Frontend ───
  console.log('🧪 Teste 1: Auditoria estrita contra vazamento de URLs do Google Sheets no frontend');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf-8');

  assert.strictEqual(
    indexHtml.includes('https://docs.google.com/spreadsheets/d/1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg'),
    false,
    'ERRO DE SEGURANÇA: URL pública da planilha encontrada no index.html!'
  );
  assert.strictEqual(
    appJs.includes('https://docs.google.com/spreadsheets/d/1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg'),
    false,
    'ERRO DE SEGURANÇA: URL pública da planilha encontrada no app.js!'
  );
  console.log('   ✅ Blindagem validada: 0 referências públicas ao link direto do Google Sheets no frontend.');

  // ─── TESTE 2: Geração e Verificação de JWT e Roles (USER vs ADMIN) ───
  console.log('\n🧪 Teste 2: Geração e validação de JWT Token com controle de perfis');
  const userToken = generateToken({
    userId: 'usr_miner_123',
    email: 'miner@puzzleradar.io',
    username: 'miner_pro',
    role: 'USER',
    workerToken: 'pzk_user_exclusive_token_999'
  });
  const decodedUser = verifyToken(userToken);
  assert.strictEqual(decodedUser.role, 'USER');
  assert.strictEqual(decodedUser.workerToken, 'pzk_user_exclusive_token_999');
  console.log(`   ✅ Token de Usuário verificado com sucesso: Role ${decodedUser.role} / Worker ${decodedUser.workerToken}`);

  const adminToken = generateToken({
    userId: 'usr_admin_master',
    email: 'admin@puzzleradar.io',
    role: 'ADMIN'
  });
  const decodedAdmin = verifyToken(adminToken);
  assert.strictEqual(decodedAdmin.role, 'ADMIN');
  console.log(`   ✅ Token de Admin Master verificado com sucesso: Role ${decodedAdmin.role}`);

  // ─── TESTE 3: Blindagem de Cofre Frio Imutável (Anti-Hijack) ───
  console.log('\n🧪 Teste 3: Rejeição de Injeção de Endereços Externos no Resgate');
  const injectionAttempt = await antiMevRescue.executeRescue({
    chain: 'BTC',
    challengeId: 'BTC_1000_P1',
    privateKeyHex: '0000000000000000000000000000000000000000000000000000000000000001',
    targetAddress: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH',
    customDestination: '1MaliciousAttackerWalletAddress'
  });

  assert.strictEqual(injectionAttempt.success, false);
  assert.strictEqual(injectionAttempt.code, 'DYNAMIC_DESTINATION_FORBIDDEN_IMMUTABLE_VAULT_ONLY');
  console.log('   ✅ Bloqueio ativo confirmado! Código de rejeição:', injectionAttempt.code);

  console.log('\n🎉 TODOS OS TESTES DE AUTENTICAÇÃO E BLINDAGEM PASSARAM COM 100% DE SUCESSO!\n');
}

runAuthAndVisibilityTests().catch(err => {
  console.error('❌ Falha nos testes de autenticação:', err);
  process.exit(1);
});
