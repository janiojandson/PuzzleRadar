// =========================================================================
// 🧪 PuzzleRadar — Telemetry Stream & Multi-Cloud Onboarding Test Suite
// =========================================================================

const assert = require('assert');
const http = require('http');
const app = require('../src/server/index');
const { broadcastTelemetryEvent } = require('../src/server/routes/telemetry');

async function runTests() {
  console.log('\n================================================================================');
  console.log('📡 TESTES DA CENTRAL DE TELEMETRIA EM TEMPO REAL & MULTI-CLOUD ONBOARDING');
  console.log('================================================================================\n');

  let server;
  let port;

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  try {
    // Teste 1: GET /api/telemetry/pulse
    console.log('📌 Teste 1: Pulso Estruturado via GET /api/telemetry/pulse');
    await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/api/telemetry/pulse`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const data = JSON.parse(raw);
          assert.ok(data.globalHashrate, 'Deve conter hashrate global');
          assert.strictEqual(data.activeTarget.id, 'BTC_1000_P71');
          assert.strictEqual(data.secondaryTarget.id, 'ETH_BIP39_8W');
          assert.ok(data.proofOfShare, 'Deve conter proofOfShare');
          assert.ok(Array.isArray(data.proofOfShare.topWorkers), 'Top workers deve ser array');
          console.log('  ✅ [PASS] Pulso de telemetria recebido com estrutura validada.');
          resolve();
        });
      }).on('error', reject);
    });

    // Teste 2: Stream SSE GET /api/telemetry/stream
    console.log('📌 Teste 2: Conexão e Pulso Server-Sent Events (SSE)');
    await new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/api/telemetry/stream`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        assert.ok(res.headers['content-type'].includes('text/event-stream'));

        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('event: pulse')) {
            assert.ok(buffer.includes('BTC_1000_P71'), 'Stream deve emitir dados do Puzzle #71');
            req.destroy();
            console.log('  ✅ [PASS] Stream SSE conectado e emitindo pulso inicial de 2000ms.');
            resolve();
          }
        });
      });
      req.on('error', (err) => {
        if (err.code === 'ECONNRESET' || req.destroyed) return;
        reject(err);
      });
    });

    // Teste 3: Broadcast Telemetry Event
    console.log('📌 Teste 3: Broadcast de Evento em Tempo Real');
    const event = broadcastTelemetryEvent('DP_SUBMITTED', 'Teste de DP unitário', { workerName: 'TestNode' });
    assert.ok(event.id);
    assert.strictEqual(event.type, 'DP_SUBMITTED');
    assert.strictEqual(event.message, 'Teste de DP unitário');
    console.log('  ✅ [PASS] Evento de broadcast emitido e registrado no buffer.');

    // Teste 4: POST /api/telemetry/event
    console.log('📌 Teste 4: Registro de Evento via POST /api/telemetry/event');
    await new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        type: 'CUSTOM_TEST',
        message: 'Mensagem de teste de evento'
      });

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/telemetry/event',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        assert.strictEqual(res.statusCode, 200);
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          const data = JSON.parse(raw);
          assert.strictEqual(data.success, true);
          assert.strictEqual(data.event.type, 'CUSTOM_TEST');
          console.log('  ✅ [PASS] Endpoint de evento validado com sucesso.');
          resolve();
        });
      });
      req.write(payload);
      req.end();
    });

    console.log('\n================================================================================');
    console.log('🎉 TODOS OS TESTES DE TELEMETRIA SSE PASSARAM COM 100% DE SUCESSO!');
    console.log('================================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});
