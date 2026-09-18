// =========================================================================
// 🧩 PuzzleRadar v5.1 — pool.conf Generation Tests
// =========================================================================

const assert = require('assert');
const http = require('http');
const express = require('express');
const apiRoutes = require('../src/server/routes/api');

console.log('\n================================================================================');
console.log('🧪 TESTES: GERAÇÃO DINÂMICA DE POOL.CONF (poolConfGeneration.test.js)');
console.log('================================================================================\n');

async function runPoolConfGenerationTests() {
  const app = express();
  app.use('/api', apiRoutes);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  function httpGetText(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, text: body });
        });
      }).on('error', reject);
    });
  }

  try {
    const workerName = 'Rig_CUDA_NVIDIA_4090';
    const res = await httpGetText(`/api/config/pool.conf?worker=${workerName}`);

    assert.strictEqual(res.status, 200, 'Status deve ser 200 OK');
    assert.ok(res.headers['content-type'].includes('text/plain'), 'Content-Type deve ser text/plain');
    assert.ok(res.text.includes(`worker_name=${workerName}`), 'Deve conter o worker_name correto');
    assert.ok(res.text.includes('user_token='), 'Deve conter o user_token');
    assert.ok(res.text.includes('target_puzzle=71'), 'Deve apontar para o puzzle 71');
    assert.ok(res.text.includes('custom_range='), 'Deve conter custom_range');
    assert.ok(res.text.includes('api_share=true'), 'Deve conter api_share=true');
    assert.ok(res.text.includes('/api/webhook/btcpuzzle'), 'Deve conter a URL do webhook');

    console.log('  ✅ [PASS] Conteúdo do pool.conf gerado com sucesso:');
    console.log('--------------------------------------------------');
    console.log(res.text);
    console.log('--------------------------------------------------');

    console.log('\n🎉 TODOS OS TESTES DE poolConfGeneration.test.js PASSARAM COM SUCESSO!\n');
  } finally {
    server.close();
  }
}

runPoolConfGenerationTests().catch(err => {
  console.error('❌ Falha nos testes de geração do pool.conf:', err);
  process.exit(1);
});
