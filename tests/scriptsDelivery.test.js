// =========================================================================
// 🧩 PuzzleRadar v5.1 — 1-Click Launch Scripts Delivery Tests
// =========================================================================

const assert = require('assert');
const http = require('http');
const app = require('../src/server/index');

console.log('\n================================================================================');
console.log('🧪 TESTES: ENTREGA DE SCRIPTS 1-CLIQUE (scriptsDelivery.test.js)');
console.log('================================================================================\n');

const server = http.createServer(app);

function fetchPath(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3998,
      path,
      method: 'GET'
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

async function runScriptsDeliveryTests() {
  await new Promise(resolve => server.listen(3998, resolve));

  try {
    // 1. Teste de GET /start.ps1 (PowerShell)
    const ps1Res = await fetchPath('/start.ps1');
    assert.strictEqual(ps1Res.statusCode, 200);
    assert.ok(ps1Res.contentType.includes('text/plain'), `Esperado text/plain, obtido: ${ps1Res.contentType}`);
    assert.ok(ps1Res.body.includes('Invoke-RestMethod'), 'Script PS1 deve conter comandos PowerShell');
    assert.ok(ps1Res.body.includes('/api/webhook/btcpuzzle'), 'Script PS1 deve apontar para o webhook');
    console.log('  ✅ [PASS] GET /start.ps1 entrega script PowerShell válido (text/plain)');

    // 2. Teste de GET /start.sh (Bash)
    const shRes = await fetchPath('/start.sh');
    assert.strictEqual(shRes.statusCode, 200);
    assert.ok(shRes.contentType.includes('text/plain'), `Esperado text/plain, obtido: ${shRes.contentType}`);
    assert.ok(shRes.body.includes('#!/usr/bin/env bash'), 'Script SH deve conter shebang bash');
    assert.ok(shRes.body.includes('/api/range/next/'), 'Script SH deve solicitar fatias à API');
    console.log('  ✅ [PASS] GET /start.sh entrega shell script válido (text/plain)');

    console.log('\n🎉 TODOS OS TESTES DE scriptsDelivery.test.js PASSARAM COM SUCESSO!\n');
  } finally {
    server.close();
  }
}

runScriptsDeliveryTests().catch(err => {
  console.error('❌ Erro no teste de scripts delivery:', err);
  server.close();
  process.exit(1);
});
