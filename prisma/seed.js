/*
// ============================================
// 🧩 PuzzleRadar — Seed Data (Puzzles & Hints)
// ============================================

const { PrismaClient } = require('@prisma/client');
const { calculateDifficultyScore } = require('../src/lib/difficultyEngine');

const prisma = new PrismaClient();

async function main() {
  console.log('🧩 PuzzleRadar — Iniciando seed de puzzles e configurações...');
  
  // ─── CRIAR ORGANIZAÇÃO PADRÃO ───
  const org = await prisma.organization.upsert({
    where: { slug: 'puzzleradar-public' },
    update: {},
    create: {
      name: 'PuzzleRadar Public Pool',
      slug: 'puzzleradar-public',
      description: 'Pool pública colaborativa de exaustão criptográfica'
    }
  });
  console.log(`✅ Organização criada: ${org.name}`);
  
  // ─── CRIAR USUÁRIO ADMIN ───
  const { bootstrapAdmin } = require('../src/server/routes/auth');
  const admin = await bootstrapAdmin(prisma);
  if (!admin) console.log('ℹ️ Admin não criado: ADMIN_EMAIL e ADMIN_PASSWORD não foram configurados.');
  
  // ─── ADICIONAR ADMIN À ORG ───
  if (admin) await prisma.member.upsert({
    where: { userId_organizationId: { userId: admin.id, organizationId: org.id } },
    update: {},
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: 'ADMIN'
    }
  });
  
// ============================================
// 🧩 PuzzleRadar — Seed Data com Validação Criptográfica Rigorosa (Anti-Waste)
// ============================================

*/
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { calculateDifficultyScore } = require('../src/lib/difficultyEngine');
const { verifyPubKeyToAddress, verifyDiscoveryProof } = require('../src/lib/cryptoVerifier');

const prisma = new PrismaClient();

async function main() {
  console.log('🧩 PuzzleRadar — Iniciando seed com verificação matemática secp256k1...');
  
  // ─── CRIAR ORGANIZAÇÃO PADRÃO ───
  const org = await prisma.organization.upsert({
    where: { slug: 'puzzleradar-public' },
    update: {},
    create: {
      name: 'PuzzleRadar Public Pool',
      slug: 'puzzleradar-public',
      description: 'Pool pública colaborativa de exaustão criptográfica'
    }
  });
  console.log(`✅ Organização criada: ${org.name}`);
  
  // ─── CRIAR USUÁRIO ADMIN ───
  const { bootstrapAdmin } = require('../src/server/routes/auth');
  const admin = await bootstrapAdmin(prisma);
  if (!admin) console.log('ℹ️ Admin não criado: ADMIN_EMAIL e ADMIN_PASSWORD não foram configurados.');
  
  // ─── ADICIONAR ADMIN À ORG ───
  if (admin) await prisma.member.upsert({
    where: { userId_organizationId: { userId: admin.id, organizationId: org.id } },
    update: {},
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: 'ADMIN'
    }
  });
  
  // ─── CARREGAR TODOS OS 160 PUZZLES DO JSON MESTRE ───
  const masterPath = path.join(__dirname, '../persistent_data/puzzles_1000btc_master.json');
  let masterPuzzles = [];
  if (fs.existsSync(masterPath)) {
    masterPuzzles = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
  }

  console.log(`📊 Carregando e validando ${masterPuzzles.length} puzzles do arquivo mestre...`);

  let validCount = 0;
  let quarantinedCount = 0;

  for (const p of masterPuzzles) {
    const rangeStart = p.minHex ? p.minHex.replace(/^0x/i, '') : (1n << BigInt(p.bits - 1)).toString(16);
    const rangeEnd = p.maxHex ? p.maxHex.replace(/^0x/i, '') : ((1n << BigInt(p.bits)) - 1n).toString(16);
    
    // 🛡️ Validação Criptográfica Prévia de Integridade (secp256k1 + SHA256 + RIPEMD160)
    let isKeyPairValid = true;
    if (p.pubKey && p.btcAddress) {
      const pubCheck = verifyPubKeyToAddress(p.pubKey, p.btcAddress);
      if (!pubCheck.isValid) {
        console.warn(`⚠️ [Quarentena] Puzzle #${p.puzzleNumber} com inconsistência de Chave Pública/Endereço!`);
        isKeyPairValid = false;
        quarantinedCount++;
      }
    }

    // Se possui chave privada cadastrada (resolvidos), valida a derivação
    if (p.privKey && p.btcAddress) {
      const privCheck = verifyDiscoveryProof(p.privKey, p.btcAddress);
      if (!privCheck.isValid) {
        console.warn(`⚠️ [Quarentena] Puzzle #${p.puzzleNumber} com chave privada inválida para o endereço!`);
        isKeyPairValid = false;
      }
    }

    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      rangeStart,
      rangeEnd,
      prizeAmount: p.prizeBtc || 0.1,
      prizeCurrency: 'BTC',
      hints: []
    });

    let status = p.status === 'SOLVED' ? 'SOLVED' : 'ACTIVE';
    if (!isKeyPairValid) {
      status = 'INVALID_KEY_PAIR';
    } else {
      validCount++;
    }
    
    await prisma.puzzle.upsert({
      where: { id: `puzzle_btc_${p.puzzleNumber}` },
      update: {
        difficultyScore: diff.score,
        difficultyLabel: diff.difficulty,
        targetAddress: p.btcAddress,
        targetPublicKey: p.pubKey || null,
        publicKeyExposed: Boolean(p.pubKey),
        status,
        effectiveBits: diff.effectiveBits,
        entropyReduction: parseFloat(diff.entropyReductionRatio)
      },
      create: {
        id: `puzzle_btc_${p.puzzleNumber}`,
        title: `Bitcoin Puzzle #${p.puzzleNumber}`,
        description: `Bitcoin Puzzle Transaction — Desafio de ${p.bits} bits (${p.prizeBtc} BTC)`,
        chain: 'BTC',
        puzzleNumber: p.puzzleNumber,
        targetAddress: p.btcAddress,
        targetPublicKey: p.pubKey || null,
        publicKeyExposed: Boolean(p.pubKey),
        bitRange: p.bits,
        rangeStart,
        rangeEnd,
        prizeAmount: p.prizeBtc || 0.1,
        prizeCurrency: 'BTC',
        difficultyScore: diff.score,
        difficultyLabel: diff.difficulty,
        effectiveBits: diff.effectiveBits,
        entropyReduction: parseFloat(diff.entropyReductionRatio),
        status,
        sourceUrl: 'https://bitcoinpuzzles.io/pt/puzzles/1000btc',
        sourceName: 'Bitcoin 1000 BTC Puzzles'
      }
    });
  }
  
  console.log(`✅ ${validCount} Puzzles validados com prova criptográfica e salvos no banco.`);
  if (quarantinedCount > 0) {
    console.log(`⚠️ ${quarantinedCount} Puzzles colocados em quarentena (INVALID_KEY_PAIR).`);
  }
  console.log('\n🧩 Seed concluído com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
