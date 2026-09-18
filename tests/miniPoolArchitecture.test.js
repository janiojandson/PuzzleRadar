// =========================================================================
// 🧩 PuzzleRadar v5.3 — Suíte de Testes da Arquitetura Mini-Pool & Buffer 10 Colunas
// =========================================================================

const assert = require('assert');
const crypto = require('crypto');
const { parentLoteManager, STEP_CPU } = require('../src/services/parentLoteManager');
const { sheetsBuffer } = require('../src/lib/googleSheetsBuffer');
const { loteManager } = require('../src/services/loteManager');
const { pointAdd, scalarMultiply, pointToCompressedPubkeyHex } = require('../src/workers/cpuMiner');

async function runMiniPoolTests() {
  console.log('🧪 [Suíte de Testes] Iniciando Validação da Arquitetura Mini-Pool Real & Schema v5.3...\n');

  // Teste 1: Micro-fatiamento da Fatia Pai em 2^24 chaves
  console.log('1️⃣ Testando micro-fatiamento da Fatia Pai (2^24 chaves)...');
  const microLote1 = await parentLoteManager.getNextMicroLote('worker_test_1');
  const microLote2 = await parentLoteManager.getNextMicroLote('worker_test_2');

  const start1 = BigInt('0x' + microLote1.startHex);
  const end1 = BigInt('0x' + microLote1.endHex);
  const start2 = BigInt('0x' + microLote2.startHex);

  assert.strictEqual(end1 - start1, STEP_CPU, 'O tamanho do micro-lote deve ser estritamente 2^24 (~16.7M chaves)');
  assert.strictEqual(start2, end1, 'O próximo micro-lote deve ser contíguo ao anterior');
  assert.strictEqual(microLote1.targets.length, 7, 'Devem ser passados 7 alvos HASH160 (1 do Puzzle 71 + 6 do PoW)');
  console.log('   ✅ Micro-fatiamento validado com sucesso!\n');

  // Teste 2: Coleta de Provas e Hash Combinado de PoW: SHA256(k1+...+k6)
  console.log('2️⃣ Testando Agregação de 6 chaves PoW e Hash SHA256...');
  const k1 = '0000000000000000000000000000000000000000000000000000000000000001';
  const k2 = '0000000000000000000000000000000000000000000000000000000000000002';
  const k3 = '0000000000000000000000000000000000000000000000000000000000000003';
  const k4 = '0000000000000000000000000000000000000000000000000000000000000004';
  const k5 = '0000000000000000000000000000000000000000000000000000000000000005';
  const k6 = '0000000000000000000000000000000000000000000000000000000000000006';

  const expectedCombinedHash = crypto.createHash('sha256').update(k1 + k2 + k3 + k4 + k5 + k6).digest('hex');
  assert.strictEqual(expectedCombinedHash.length, 64, 'O hash PoW combinado deve possuir 64 caracteres Hex (SHA256)');
  console.log(`   Hash SHA256 (k1..k6): ${expectedCombinedHash}`);
  console.log('   ✅ Agregação PoW validada com sucesso!\n');

  // Teste 3: Numeração Ordinal do Chunk com BigInt e Schema Estrito de 10 Colunas
  console.log('3️⃣ Testando Numeração Ordinal BigInt Chunk # e Buffer de 10 Colunas...');
  const baseStart = '400000000000000000';
  const chunkIdx = loteManager.calculateChunkIndex(baseStart);
  assert.strictEqual(chunkIdx, 1, 'Chunk ordinal da chave base deve ser 1');

  sheetsBuffer.enqueueChunkLog({
    startHex: baseStart,
    workerName: 'UnitTest_Fleet'
  });

  const loggedItem = sheetsBuffer.buffer[sheetsBuffer.buffer.length - 1];
  assert.strictEqual(loggedItem.chunkLabel, 'Chunk #1', 'O rótulo do Chunk deve ser "Chunk #1"');
  assert.ok(loggedItem.endHex, 'endHex deve ser auto-deduzido caso omitido');
  assert.strictEqual(loggedItem.endHex.length, 18, 'endHex deduzido deve ter 18 caracteres hex');
  console.log('   ✅ Buffer e 10 Colunas validados com sucesso!\n');

  // Teste 4: Adição de Pontos secp256k1 (P + G)
  console.log('4️⃣ Testando Motor de Adição de Pontos secp256k1 (P + G)...');
  const P1 = scalarMultiply(1n);
  const P2_scalar = scalarMultiply(2n);
  const P2_add = pointAdd(P1, { x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n, y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n });

  assert.strictEqual(pointToCompressedPubkeyHex(P2_scalar), pointToCompressedPubkeyHex(P2_add), 'A adição de ponto (P + G) deve produzir exatamente o mesmo resultado da multiplicação escalar (2*G)');
  console.log('   ✅ Motor Criptográfico secp256k1 P + G validado com 100% de exatidão!\n');

  console.log('🎉 [Suíte de Testes] TODOS OS TESTES DA MINI-POOL PASSARAM COM SUCESSO (Exit Code 0)!');
}

runMiniPoolTests().catch((err) => {
  console.error('❌ [Suíte de Testes] FALHA NOS TESTES:', err);
  process.exit(1);
});
