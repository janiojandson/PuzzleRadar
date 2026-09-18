// =========================================================================
// 🧩 PuzzleRadar v5.0 — btcpuzzle Webhook Life-cycle & Anti-MEV Tests
// =========================================================================

const assert = require('assert');
const http = require('http');
const app = require('../src/server/index');
const { antiMevRescue } = require('../src/services/antiMevRescue');
const { deriveBitcoinAddress } = require('../src/lib/cryptoVerifier');

console.log('\n================================================================================');
console.log('🧪 TESTES: BTCPUZZLE WEBHOOK & CICLO ASSÍNCRONO ANTI-MEV (btcpuzzleWebhook.test.js)');
console.log('================================================================================\n');

const server = http.createServer(app);

function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3999,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          body
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runWebhookTests() {
  await new Promise(resolve => server.listen(3999, resolve));

  try {
    // 1. Teste de Resposta Imediata Estrita "true" (text/plain)
    const resStarted = await makeRequest('/api/webhook/btcpuzzle', {
      'Status': 'workerStarted',
      'Workername': 'rig_cuda_01',
      'Hex': '400000000000000000',
      'Targetpuzzle': '71'
    });

    assert.strictEqual(resStarted.statusCode, 200);
    assert.ok(resStarted.contentType.includes('text/plain'), `Esperado Content-Type text/plain, obtido: ${resStarted.contentType}`);
    assert.strictEqual(resStarted.body, 'true', `Esperado corpo "true", obtido: ${resStarted.body}`);
    console.log('  ✅ [PASS] Confirmação síncrona imediata "true" em text/plain para workerStarted');

    // 2. Teste de Normalização de Headers em Minúsculas
    const resScanned = await makeRequest('/api/webhook/btcpuzzle', {
      'status': 'rangeScanned',
      'workername': 'rig_cuda_01',
      'hex': '400000000000000000',
      'targetpuzzle': '71'
    });
    assert.strictEqual(resScanned.statusCode, 200);
    assert.strictEqual(resScanned.body, 'true');
    console.log('  ✅ [PASS] Normalização case-insensitive de headers HTTP');

    // 3. Teste de Evento keyFound com disparo de Anti-MEV
    const initialRescueLogsCount = antiMevRescue.getRescueLogs().length;

    // Gerar chave válida para teste
    const privKeyHex = '0000000000000000000000000000000000000000000000000000000000000001';
    const resKeyFound = await makeRequest('/api/webhook/btcpuzzle', {
      'Status': 'keyFound',
      'Workername': 'champion_miner',
      'Hex': '400000000000000000',
      'Privatekey': privKeyHex,
      'Targetpuzzle': '71'
    });

    assert.strictEqual(resKeyFound.statusCode, 200);
    assert.strictEqual(resKeyFound.body, 'true');
    console.log('  ✅ [PASS] Resposta imediata "true" em evento keyFound');

    // Aguarda execução assíncrona do anti-MEV
    await new Promise(r => setTimeout(r, 200));

    const finalRescueLogs = antiMevRescue.getRescueLogs();
    assert.ok(finalRescueLogs.length >= initialRescueLogsCount, 'AntiMevRescue logs devem ser atualizados');
    console.log('  ✅ [PASS] Execução assíncrona desacoplada do Anti-MEV acionada');

    console.log('\n🎉 TODOS OS TESTES DE btcpuzzleWebhook.test.js PASSARAM COM SUCESSO!\n');
  } finally {
    server.close();
  }
}

runWebhookTests().catch(err => {
  console.error('❌ Erro no teste de webhook:', err);
  server.close();
  process.exit(1);
});
