// =========================================================================
// 🧩 PuzzleRadar v5.1 — Worker Validation Tests
// =========================================================================

const assert = require('assert');
const http = require('http');
const express = require('express');
const apiRoutes = require('../src/server/routes/api');
const { loteManager } = require('../src/services/loteManager');
const { leaderboardService } = require('../src/services/leaderboardService');

console.log('\n================================================================================');
console.log('🧪 TESTES: VALIDAÇÃO DE WORKERS & CONECTIVIDADE (workerValidation.test.js)');
console.log('================================================================================\n');

async function runWorkerValidationTests() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  function httpGet(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      }).on('error', reject);
    });
  }

  try {
    // 1. Aloca um range real para um worker de teste
    const workerName = 'TestValidator_Rig_77';
    await loteManager.getNextOptimalRange(workerName, '2.5 GH/s', false);
    await leaderboardService.recordContribution(workerName, { keysChecked: 4500000, isLoteCompleted: false, hashrate: '2.5 GH/s' });

    // 2. Consulta o status do worker
    const checkRes = await httpGet(`/api/workers/check/${workerName}`);
    assert.strictEqual(checkRes.status, 200, 'Status deve ser 200 OK');
    assert.strictEqual(checkRes.data.found, true, 'Worker deve ser encontrado');
    assert.strictEqual(checkRes.data.workerName, workerName, 'Nome do worker deve bater');
    assert.ok(checkRes.data.currentRange.includes(':'), 'Deve conter range formatado com :');
    assert.strictEqual(checkRes.data.sheetsSynced, true, 'Deve indicar sheetsSynced true');
    assert.strictEqual(checkRes.data.targetSheet, 'Ranges_Varredura', 'Aba deve ser Ranges_Varredura');
    assert.ok(checkRes.data.totalKeys >= 4500000, 'Total de chaves deve ser registrado');
    console.log(`  ✅ [PASS] Worker ativo encontrado com range ${checkRes.data.currentRange} e status ${checkRes.data.status}`);

    // 3. Consulta worker inexistente
    const unkRes = await httpGet('/api/workers/check/Unknown_Ghost_999');
    assert.strictEqual(unkRes.status, 200, 'Deve retornar 200 mesmo se desconhecido');
    assert.strictEqual(unkRes.data.found, false, 'found deve ser false');
    assert.strictEqual(unkRes.data.status, 'offline', 'Status deve ser offline');
    console.log('  ✅ [PASS] Worker desconhecido tratado graciosamente como offline');

    console.log('\n🎉 TODOS OS TESTES DE workerValidation.test.js PASSARAM COM SUCESSO!\n');
  } finally {
    server.close();
  }
}

runWorkerValidationTests().catch(err => {
  console.error('❌ Falha nos testes de validação de workers:', err);
  process.exit(1);
});
