// ========================================================
// 🧩 PuzzleRadar — 1000 BTC Complete Scraper & Data Extractor
// ========================================================
const fs = require('fs');
const path = require('path');

const htmlPath = 'C:\\Users\\Janio\\.gemini\\antigravity-ide\\brain\\0645e6d9-f638-414d-a053-e37f1826f340\\.system_generated\\steps\\9\\content.md';
const content = fs.readFileSync(htmlPath, 'utf8');

// We want to extract all 160 rows from the table <table class="tbtc-table" ...>
// Each row has:
// - # number (e.g. #1, #66)
// - Key Range (e.g. 2^0 - 2^1 or 2^65 - 2^66, or hex range)
// - BTC Address (e.g. 1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH)
// - Public Key (compressed / uncompressed hex)
// - Private Key (hex / wif if solved, or empty)
// - Prize (e.g. 0.1 BTC, 6.6 BTC, 16.0 BTC)
// - Status (solved / unsolved / em disputa)

const rows = [];
const rowRegex = /<tr class="tbtc-row([^"]*)">([\s\S]*?)<\/tr>/gi;
let match;

while ((match = rowRegex.exec(content)) !== null) {
  const rowClass = match[1];
  const rowHtml = match[2];

  // Extract Puzzle Number
  const numMatch = rowHtml.match(/<span class="mono">#(\d+)<\/span>/i);
  const puzzleNumber = numMatch ? parseInt(numMatch[1], 10) : null;

  // Extract Range (power of 2)
  const rangeMatch = rowHtml.match(/2<sup>(\d+)<\/sup>&thinsp;&ndash;&thinsp;2<sup>(\d+)<\/sup>/i);
  const minBit = rangeMatch ? parseInt(rangeMatch[1], 10) : (puzzleNumber ? puzzleNumber - 1 : null);
  const maxBit = rangeMatch ? parseInt(rangeMatch[2], 10) : puzzleNumber;

  // Calculate Hex Range
  let minHex = '0';
  let maxHex = '1';
  if (minBit !== null && maxBit !== null) {
    if (minBit === 0) {
      minHex = '0x1';
    } else {
      minHex = '0x' + (1n << BigInt(minBit)).toString(16);
    }
    maxHex = '0x' + ((1n << BigInt(maxBit)) - 1n).toString(16);
  }

  // Extract BTC Address
  const addrMatch = rowHtml.match(/data-clipboard-text-value="([13bc1][a-zA-Z0-9]{25,62})"/i) ||
                     rowHtml.match(/mempool\.space\/address\/([13bc1][a-zA-Z0-9]{25,62})/i) ||
                     rowHtml.match(/title="([13bc1][a-zA-Z0-9]{25,62})"/i);
  const btcAddress = addrMatch ? addrMatch[1] : '';

  // Extract Public Key
  const pubMatch = rowHtml.match(/data-clipboard-text-value="(0[2-4][a-fA-F0-9]{64,128})"/i) ||
                   rowHtml.match(/title="(0[2-4][a-fA-F0-9]{64,128})"/i);
  const pubKey = pubMatch ? pubMatch[1] : '';

  // Extract Private Key if solved
  const privMatch = rowHtml.match(/data-clipboard-text-value="(0x[0-9a-fA-F]+|[0-9a-fA-F]{64}|5[HJK][a-zA-Z0-9]{49}|K[a-zA-Z0-9]{51}|L[a-zA-Z0-9]{51})"/i);
  let privKey = privMatch ? privMatch[1] : '';
  // Avoid taking address/pubKey as privKey
  if (privKey === btcAddress || privKey === pubKey) {
    privKey = '';
  }

  // Extract Prize
  const prizeMatch = rowHtml.match(/<td[^>]*class="[^"]*tbtc-col--prize[^"]*"[^>]*>([\s\S]*?)<\/td>/i) ||
                     rowHtml.match(/(\d+([.,]\d+)?)\s*BTC/i);
  let prizeBtc = (puzzleNumber ? puzzleNumber / 10 : 0).toFixed(1);
  if (prizeMatch) {
    const pText = prizeMatch[1].replace(/<[^>]+>/g, '').trim();
    const pNum = parseFloat(pText.replace(',', '.'));
    if (!isNaN(pNum)) {
      prizeBtc = pNum.toFixed(1);
    }
  }

  // Determine Status
  const isSolved = rowClass.includes('solved') || rowHtml.includes('is-solved') || rowHtml.includes('tbtc-row--solved') || privKey !== '';
  const status = isSolved ? 'SOLVED' : 'UNSOLVED';

  if (puzzleNumber) {
    rows.push({
      puzzleNumber,
      bits: maxBit,
      minBit,
      maxBit,
      minHex,
      maxHex,
      btcAddress,
      pubKey,
      privKey,
      prizeBtc: parseFloat(prizeBtc),
      status,
      keyspaceSize: `2^${maxBit - minBit} keys (~${(1n << BigInt(maxBit - minBit)).toLocaleString()} combinations)`
    });
  }
}

rows.sort((a, b) => a.puzzleNumber - b.puzzleNumber);

console.log(`Total Puzzles Parsed: ${rows.length}`);
const solvedCount = rows.filter(r => r.status === 'SOLVED').length;
const unsolvedCount = rows.filter(r => r.status === 'UNSOLVED').length;
console.log(`Solved: ${solvedCount}, Unsolved: ${unsolvedCount}`);

// Save structured JSON and CSV
const outputDir = path.join(__dirname, '../../persistent_data');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(path.join(outputDir, 'puzzles_1000btc_master.json'), JSON.stringify(rows, null, 2), 'utf8');

// Generate CSV for Google Sheets
const csvHeaders = ['Puzzle #', 'Bits (Dificuldade)', 'Intervalo Min Hex', 'Intervalo Max Hex', 'Endereço Bitcoin', 'Chave Pública', 'Chave Privada (Hex)', 'Prêmio (BTC)', 'Status', 'Tamanho do Range', 'Viabilidade Atual'];

const csvRows = rows.map(r => {
  let viabilidade = '';
  if (r.status === 'SOLVED') {
    viabilidade = 'Resolvido';
  } else if (r.bits <= 40) {
    viabilidade = '🟢 Imediato (CPU - Segundos)';
  } else if (r.bits <= 55) {
    viabilidade = '🟡 Fácil/Médio (GPU - Horas)';
  } else if (r.bits <= 65) {
    viabilidade = '🔴 Médio (GPU Cluster - Dias/Semanas)';
  } else if (r.bits <= 68) {
    viabilidade = '🎯 ALVO ATUAL DO MERCADO (#66, #67, #68 - Pool/Kangaroo)';
  } else if (r.bits <= 75) {
    viabilidade = '🟣 Desafio Extremo (Pool Global Massivo)';
  } else {
    viabilidade = '⚫ Impraticável Força Bruta (Requer Falha Criptográfica)';
  }

  return [
    r.puzzleNumber,
    r.bits,
    `"${r.minHex}"`,
    `"${r.maxHex}"`,
    `"${r.btcAddress}"`,
    `"${r.pubKey}"`,
    `"${r.privKey}"`,
    r.prizeBtc,
    r.status,
    `"2^${r.bits - r.minBit}"`,
    `"${viabilidade}"`
  ].join(',');
});

fs.writeFileSync(path.join(outputDir, 'puzzles_1000btc_sheets_import.csv'), [csvHeaders.join(','), ...csvRows].join('\n'), 'utf8');

console.log('✅ Exported JSON and CSV successfully!');
console.log('\n--- Status dos Puzzles Chave (60 a 75) ---');
rows.filter(r => r.puzzleNumber >= 60 && r.puzzleNumber <= 75).forEach(r => {
  console.log(`Puzzle #${r.puzzleNumber} (${r.bits} bits) | Prêmio: ${r.prizeBtc} BTC | Status: ${r.status} | Endereço: ${r.btcAddress}`);
});
