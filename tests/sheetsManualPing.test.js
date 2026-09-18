// =========================================================================
// 🧪 TESTES: PING MANUAL DO GOOGLE SHEETS COM 10 COLUNAS (sheetsManualPing.test.js)
// =========================================================================

const assert = require('assert');
const express = require('express');
const http = require('http');
const apiRoutes = require('../src/server/routes/api');
const { sheetsBuffer } = require('../src/lib/googleSheetsBuffer');

console.log('\n================================================================================');
console.log('🧪 TESTES: PING MANUAL & SINCRONIZAÇÃO GOOGLE SHEETS (sheetsManualPing.test.js)');
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

    // 1. Dispara POST /api/sheets/test-ping
    const res = await fetch(`${baseUrl}/api/sheets/test-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerName: 'Test_Miner_Rig_01' })
    });

    assert.strictEqual(res.status, 200, 'POST /api/sheets/test-ping deve retornar HTTP 200 OK');
    const data = await res.json();

    console.log('  📡 Resposta recebida do ping:', JSON.stringify(data, null, 2));

    assert(data.success === true, 'Deve retornar success: true');
    assert.strictEqual(data.targetSheet, 'Ranges_Varredura', 'Deve apontar para a aba Ranges_Varredura');
    assert.strictEqual(data.columnsCount, 10, 'Deve mapear 10 colunas estritas');
    assert(data.message.includes('Ranges_Varredura'), 'Mensagem deve referenciar a aba Ranges_Varredura');
    assert(data.timestamp, 'Deve retornar timestamp do ping');
    console.log('  ✅ [PASS] Endpoint POST /api/sheets/test-ping gravou 10 colunas na aba Ranges_Varredura com 200 OK');

    // 2. Confere estatísticas do buffer
    const stats = sheetsBuffer.getStats();
    assert(stats.totalRowsSent >= 1, 'Total de rows enviadas no buffer deve ser >= 1');
    assert.strictEqual(stats.targetSheet, 'Ranges_Varredura', 'Buffer deve ter targetSheet Ranges_Varredura');
    console.log('  ✅ [PASS] Buffer estatístico do Google Sheets validado');

    console.log('\n🎉 TODOS OS TESTES DE sheetsManualPing.test.js PASSARAM COM SUCESSO!\n');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ [FAIL] Erro no teste sheetsManualPing:', err.message);
    server.close();
    process.exit(1);
  }
});
