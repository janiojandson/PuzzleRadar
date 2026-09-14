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
  const bcrypt = require('bcryptjs');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@puzzleradar.io' },
    update: {},
    create: {
      email: 'admin@puzzleradar.io',
      username: 'admin',
      passwordHash: await bcrypt.hash('changeme123', 12),
      displayName: 'Admin PuzzleRadar',
      hasGpu: true,
      gpuModel: 'NVIDIA RTX 4090'
    }
  });
  console.log(`✅ Admin criado: ${admin.username}`);
  
  // ─── ADICIONAR ADMIN À ORG ───
  await prisma.member.upsert({
    where: { userId_organizationId: { userId: admin.id, organizationId: org.id } },
    update: {},
    create: {
      userId: admin.id,
      organizationId: org.id,
      role: 'ADMIN'
    }
  });
  
  // ─── PUZZLES BITCOIN PUZZLE TRANSACTION ───
  const bitcoinPuzzles = [
    // Puzzles já resolvidos (Learning Lab)
    { num: 1, bits: 1, prize: 0.0001, solved: true, address: '1BgGsCmBsjCgV3R4c9wK2cZzG4LwL4jz2r' },
    { num: 5, bits: 5, prize: 0.0001, solved: true, address: '1Cnrx6rxiGvVNw1UoYUGYHXRYTuqG7xMBT' },
    { num: 10, bits: 10, prize: 0.0001, solved: true, address: '1LHtnpd8nU5VHEMkG2Rj5e2v6wb1t5qK3o' },
    { num: 15, bits: 15, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 20, bits: 20, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 25, bits: 25, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 30, bits: 30, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 35, bits: 35, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 40, bits: 40, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 45, bits: 45, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 50, bits: 50, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 55, bits: 55, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 60, bits: 60, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 64, bits: 64, prize: 0.0001, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    { num: 65, bits: 65, prize: 6.6, solved: true, address: '1KCgMv8fo2TPBpddVi9jqmMmcne9uSNJ5F' },
    
    // Puzzles ATIVOS
    { num: 66, bits: 66, prize: 6.6, solved: false, address: '13zb1hQbWVsc2S7ZTZnP2G4undNNpdh5so', hints: [{ type: 'bip39ChecksumFilter', discardRate: '93.75%' }] },
    { num: 67, bits: 67, prize: 6.6, solved: false, address: '1BY8GQbnueYofwSuFAT3USAhGjPrkxDdW9' },
    { num: 68, bits: 68, prize: 6.6, solved: false, address: '1MVDYgVaSN6iKKEsbzRUAYFhNJT1eLf2E3' },
    { num: 69, bits: 69, prize: 6.6, solved: false, address: '19vkiEajfhuZ8bs8Zu2jgmC6oqZbWqhxhG' },
    { num: 70, bits: 70, prize: 6.6, solved: false, address: '19YZECXj3SxEZMoUeJ1yiPsw8xANe7M7QR' },
    { num: 75, bits: 75, prize: 6.6, solved: false, address: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU' },
    { num: 80, bits: 80, prize: 6.6, solved: false, address: '1Fo65aKq8s8iquMt6weF1rku1moWVEd68U' },
    { num: 85, bits: 85, prize: 6.6, solved: false, address: '1QKBaU6WAeycb3DbKbLBkX7vJiaS8r42Xo' },
    { num: 90, bits: 90, prize: 6.6, solved: false, address: '16RGFo6hjq9ym6Pj7N5H7L1NR1rVPJyw2v' },
    { num: 100, bits: 100, prize: 6.6, solved: false, address: '1AhN6rPdrMuKBGFDKR1k9A8SCLYaNgXhty' },
    { num: 110, bits: 110, prize: 6.6, solved: false, address: '1PfNh5MYiCECPpg9VGQrCmDrzCTsTKGBDv' },
    { num: 120, bits: 120, prize: 6.6, solved: false, address: '1NLbHuJebVwUZ1XqDjsAyfTRUPwDQbEo5E' },
    { num: 130, bits: 130, prize: 6.6, solved: false, address: '1KM75HRh2nMS3xGQmUnYFRnP3oXtFZVfV1' },
    { num: 140, bits: 140, prize: 6.6, solved: false, address: '1E7Fexj7gD7S6nLhfZpJv5YdM1U2LQhJ3K' },
    { num: 150, bits: 150, prize: 6.6, solved: false, address: '1LH1gY8vz5tBQHa4r3FjT7W5Q5Y5Y5Y5Y5' },
    { num: 160, bits: 160, prize: 6.6, solved: false, address: '1F3sDhZzM1PqLgQVhB2r4M2bRm1o5Y5Y5Y' },
  ];
  
  for (const p of bitcoinPuzzles) {
    const rangeStart = (1n << BigInt(p.bits - 1)).toString(16);
    const rangeEnd = ((1n << BigInt(p.bits)) - 1n).toString(16);
    
    const diff = calculateDifficultyScore({
      bitRange: p.bits,
      rangeStart,
      rangeEnd,
      prizeAmount: p.prize,
      prizeCurrency: 'BTC',
      hints: p.hints || []
    });
    
    await prisma.puzzle.upsert({
      where: { id: `puzzle_btc_${p.num}` },
      update: {
        difficultyScore: diff.score,
        difficultyLabel: diff.difficulty,
        hints: p.hints || null,
        effectiveBits: diff.effectiveBits,
        entropyReduction: parseFloat(diff.entropyReductionRatio)
      },
      create: {
        id: `puzzle_btc_${p.num}`,
        title: `Bitcoin Puzzle #${p.num}`,
        description: `Bitcoin Puzzle Transaction — Desafio de ${p.bits} bits`,
        chain: 'BTC',
        puzzleNumber: p.num,
        targetAddress: p.address,
        bitRange: p.bits,
        rangeStart,
        rangeEnd,
        prizeAmount: p.prize,
        prizeCurrency: 'BTC',
        difficultyScore: diff.score,
        difficultyLabel: diff.difficulty,
        hints: p.hints || null,
        effectiveBits: diff.effectiveBits,
        entropyReduction: parseFloat(diff.entropyReductionRatio),
        status: p.solved ? 'SOLVED' : 'ACTIVE',
        sourceUrl: 'https://bitcoinpuzzles.io/pt/puzzles',
        sourceName: 'Bitcoin Puzzle Transaction'
      }
    });
  }
  
  console.log(`✅ ${bitcoinPuzzles.length} puzzles Bitcoin populados com scores e hints.`);
  console.log('\n🧩 Seed concluído com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());