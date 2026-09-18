// =========================================================================
// 🧪 TESTES: DIAGNÓSTICO DE CONEXÃO DO POOL (poolConnectionDiag.test.js)
// =========================================================================

const assert = require('assert');
const express = require('express');
const http = require('http');
const apiRoutes = require('../src/server/routes/api');
const config = require('../src/server/config');

console.log('\n================================================================================');
console.log('🧪 TESTES: DIAGNÓSTICO DA API BTCPUZZLE.INFO (poolConnectionDiag.test.js)');
console.log('================================================================================\n');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

const server = http.createServer(app);

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    console.log(`📡 Servidor de teste escutando na porta ${port}...`);

    // 1. Testa se as credenciais estão carregadas
    assert(config.BTCPUZZLE_USER_TOKEN, 'BTCPUZZLE_USER_TOKEN deve estar definido no config');
    assert(config.COLD_VAULT_BTC, 'COLD_VAULT_BTC deve estar definido no config');
    console.log('  ✅ [PASS] Credenciais e endereços de cofre lidos com sucesso do config');

    // 2. Faz requisição para /api/diag/pool-connection
    const res = await fetch(`${baseUrl}/api/diag/pool-connection`);
    const data = await res.json();

    console.log('  📡 Resposta recebida do diagnóstico:', JSON.stringify(data, null, 2));

    // Valida estrutura de retorno
    assert(typeof data === 'object', 'Resposta deve ser um objeto JSON');
    assert('connected' in data || 'success' in data, 'Resposta deve conter flags connected ou success');

    if (data.connected || data.success) {
      assert(data.targetAddress, 'Deve retornar targetAddress oficial');
      console.log('  ✅ [PASS] Diagnóstico de conexão com pool bem-sucedido:', data.targetAddress);
    } else {
      console.log('  ℹ️ [INFO] Pool externo retornou erro ou rate limit controlado:', data.error || data.status);
      assert(data.status !== undefined || data.error !== undefined, 'Deve detalhar erro do pool caso offline');
      console.log('  ✅ [PASS] Tratamento gracioso de erro e status reportado');
    }

    console.log('\n🎉 TODOS OS TESTES DE poolConnectionDiag.test.js PASSARAM COM SUCESSO!\n');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [FAIL] Erro nos testes de poolConnectionDiag:', err.message);
    server.close();
    process.exit(1);
  }
});
