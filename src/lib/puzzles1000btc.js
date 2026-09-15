// ============================================
// 🧩 PuzzleRadar — Dataset Completo: 160 Bitcoin Puzzles (1000 BTC)
// ============================================
// Sincronizado com bitcoinpuzzles.io e Planilha Google Master
// Status real: 83 resolvidas, 77 em disputa, ~903.0 BTC restantes
// ============================================

const fs = require('fs');
const path = require('path');

const masterJsonPath = path.join(__dirname, '../../persistent_data/puzzles_1000btc_master.json');
let masterCache = [];

try {
  if (fs.existsSync(masterJsonPath)) {
    masterCache = JSON.parse(fs.readFileSync(masterJsonPath, 'utf8'));
  }
} catch (e) {
  console.warn('[Puzzles1000BTC] Aviso ao ler master json:', e.message);
}

function getAll160Puzzles(filter = {}) {
  let list = masterCache.map(p => {
    const isSolved = p.status === 'SOLVED';
    return {
      num: p.puzzleNumber,
      puzzleNumber: p.puzzleNumber,
      bits: p.bits,
      title: `Bitcoin Puzzle #${p.puzzleNumber}`,
      chain: 'BTC',
      address: p.btcAddress,
      publicKey: p.pubKey,
      privateKey: p.privKey,
      btcPrize: p.prizeBtc,
      prize: p.prizeBtc,
      prizeUSD: Math.round(p.prizeBtc * 65000),
      solved: isSolved,
      status: p.status,
      rangeStart: p.minHex,
      rangeEnd: p.maxHex,
      rangeStartHex: p.minHex.replace(/^0x/i, ''),
      rangeEndHex: p.maxHex.replace(/^0x/i, ''),
      mempoolUrl: `https://mempool.space/address/${p.btcAddress}`,
      difficulty: p.bits <= 30 ? 'EASY' : p.bits <= 65 ? 'MEDIUM' : p.bits <= 74 ? 'HARD' : 'EXTREME',
      difficultyLabel: isSolved ? 'Resolvido' : (p.bits <= 74 ? '🎯 ALVO IMEDIATO' : (p.bits <= 80 ? '🟡 Viável em Pool' : '⚫ Desafio Extremo')),
      emoji: isSolved ? '✅' : (p.puzzleNumber === 71 ? '🎯' : (p.bits <= 74 ? '🔥' : '🔓')),
      publicKeyExposed: Boolean(p.pubKey && !isSolved)
    };
  });

  if (filter.status === 'solved') list = list.filter(p => p.solved);
  if (filter.status === 'unsolved' || filter.status === 'active') list = list.filter(p => !p.solved);
  if (filter.difficulty && filter.difficulty !== 'all') {
    list = list.filter(p => p.difficulty.toUpperCase() === filter.difficulty.toUpperCase());
  }
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(p =>
      String(p.num).includes(q) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.title && p.title.toLowerCase().includes(q))
    );
  }

  return list;
}

function getPuzzleByNumber(num) {
  const all = getAll160Puzzles();
  return all.find(p => p.num === Number(num)) || null;
}

function getStats() {
  const all = getAll160Puzzles();
  const solved = all.filter(p => p.solved).length;
  const unsolved = all.filter(p => !p.solved).length;
  const btcInDispute = all.filter(p => !p.solved).reduce((s, p) => s + p.btcPrize, 0);

  return {
    total: 160,
    solved,
    unsolved,
    btcInDispute: btcInDispute.toFixed(1),
    btcInDisputeUSD: Math.round(btcInDispute * 65000),
    primaryTarget: {
      puzzleNumber: 71,
      bits: 71,
      prizeBtc: 7.1,
      address: '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU',
      rangeStart: '0x400000000000000000',
      rangeEnd: '0x7fffffffffffffffff'
    },
    source: 'https://bitcoinpuzzles.io/pt/puzzles/1000btc',
    spreadsheetId: '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg',
    lastSync: new Date().toISOString()
  };
}

module.exports = {
  getAll160Puzzles,
  getPuzzleByNumber,
  getStats
};
