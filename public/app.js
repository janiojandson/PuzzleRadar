// ============================================
// 🧩 PuzzleRadar v3.0 — Frontend Application Logic (1000 BTC & Multi-Chain)
// ============================================

let currentTab = 'tab-1000btc';
let all1000Puzzles = [];
let filtered1000Puzzles = [];
let currentStatusFilter = 'all';
let isChatOpen = false;
let p1000DebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  switchTab('tab-1000btc');
  fetch1000BtcData();
  fetchMultiChainData();
  fetchFleetData();
  fetchLiveRangesData();

  // Poll intervals
  setInterval(fetchFleetData, 6000);
  setInterval(fetchLiveRangesData, 8000);
});

// ─── TAB SWITCHER ───
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(tabId);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn px-4 py-2 rounded-lg text-xs lg:text-sm font-medium flex items-center gap-2 transition text-slate-400 hover:text-white hover:bg-white/5';
  });

  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn px-4 py-2 rounded-lg text-xs lg:text-sm font-semibold flex items-center gap-2 transition bg-amber-500/15 text-amber-300 border border-amber-500/30';
  }

  if (window.lucide) window.lucide.createIcons();
}

// ─── 1000 BTC PUZZLE DATA & TABLE ───
async function fetch1000BtcData() {
  try {
    // Busca recomendações de ROI e puzzles simultaneamente
    const [puzzlesRes, recRes] = await Promise.all([
      fetch('/api/puzzle1000btc?limit=160'),
      fetch('/api/advisor/recommendations?fleetHashrate=42000000000')
    ]);

    const data = await puzzlesRes.json();
    const recData = await recRes.json();
    advisorRecommendations = recData.recommendations || [];

    // Mapeia dados de ROI nos puzzles
    const roiMap = new Map();
    advisorRecommendations.forEach(r => {
      roiMap.set(r.puzzleNumber, r.roi);
      if (r.challengeId) roiMap.set(r.challengeId, r.roi);
    });

    all1000Puzzles = (data.puzzles || []).map(p => ({
      ...p,
      roi: roiMap.get(p.num) || null
    }));
    filtered1000Puzzles = [...all1000Puzzles];

    if (data.stats) {
      setInner('statTotalWallets', data.stats.total || 160);
      setInner('statSolvedWallets', `${data.stats.solved} (51.9%)`);
      setInner('statUnsolvedWallets', `${data.stats.unsolved} Carteiras`);
      setInner('statBtcDispute', `${data.stats.btcInDispute} BTC (~$${(Number(data.stats.btcInDispute) * (recData.fleetConfig ? 65000 : 65000) / 1e6).toFixed(1)}M)`);
      setInner('headerDispute', `${data.stats.btcInDispute} BTC`);
    }

    render1000Ticks(all1000Puzzles);
    applyP1000Filters();
  } catch (err) {
    console.error('Erro ao carregar dados do 1000 BTC:', err);
  }
}

function render1000Ticks(puzzles) {
  const container = document.getElementById('progressMapTicks');
  if (!container) return;

  container.innerHTML = puzzles.map(p => {
    const isSolved = p.solved;
    const isTarget = p.num === 71;
    const color = isSolved
      ? 'bg-emerald-400 hover:bg-emerald-300'
      : (isTarget ? 'bg-amber-400 animate-pulse ring-2 ring-amber-300' : 'bg-slate-700 hover:bg-slate-600');

    return `<div onclick="filterBySinglePuzzle(${p.num})" title="Puzzle #${p.num} (${p.bits} bits) — ${p.btcPrize} BTC [${isSolved ? 'RESOLVIDO' : 'EM DISPUTA'}]" class="w-1.5 h-6 rounded-sm ${color} transition cursor-pointer shrink-0"></div>`;
  }).join('');
}

function renderProgressTicks(puzzles) {
  return render1000Ticks(puzzles);
}

function filterBySinglePuzzle(num) {
  const input = document.getElementById('p1000SearchInput');
  if (input) input.value = `#${num}`;
  debounceP1000Search();
}

function render1000Table(puzzles) {
  const tbody = document.getElementById('p1000TableBody');
  if (!tbody) return;

  setInner('p1000FilteredCount', puzzles.length);

  if (puzzles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-500 text-xs">Nenhum puzzle encontrado com o filtro aplicado.</td></tr>`;
    return;
  }

  tbody.innerHTML = puzzles.map(p => {
    const isSolved = p.solved;
    const isTarget = p.num === 71;
    const rowClass = isTarget ? 'bg-amber-500/10 border-amber-500/20' : (isSolved ? 'hover:bg-emerald-500/5' : 'hover:bg-white/5');

    const statusBadge = isSolved
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">✅ RESOLVIDO</span>'
      : (isTarget
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">🎯 ALVO ATUAL</span>'
        : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/20">🔥 EM DISPUTA</span>');

    // ROI Badge e métricas
    let roiBadge = '';
    if (!isSolved && p.roi) {
      const topBadge = p.roi.badge === 'TOP_ROI' 
        ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-extrabold text-[9px] border border-emerald-500/40">⭐ TOP ROI</span>' 
        : '';
      roiBadge = `
        <div class="space-y-0.5">
          <div class="flex items-center gap-1">
            <span class="text-emerald-400 font-bold text-[11px]">${p.roi.roiPerDayFormatted}</span>
            ${topBadge}
          </div>
          <div class="text-slate-400 text-[9px]">Frota: <strong class="text-slate-200">${p.roi.formattedFleetTime}</strong></div>
        </div>`;
    } else if (isSolved) {
      roiBadge = '<span class="text-slate-500 text-[10px]">-</span>';
    } else {
      roiBadge = '<span class="text-slate-500 text-[10px]">Calculando...</span>';
    }

    const privKeyDisplay = p.privateKey
      ? `<div class="flex items-center gap-1">
          <span class="text-emerald-300 font-mono text-[10px] truncate max-w-[120px]" title="${p.privateKey}">0x${p.privateKey}</span>
          <button onclick="copyText('${p.privateKey}')" class="p-1 hover:text-white text-slate-400"><i data-lucide="copy" class="w-3 h-3"></i></button>
        </div>`
      : '<span class="text-slate-600 italic text-[10px]">Oculta</span>';

    const pubKeyDisplay = p.publicKey
      ? `<span class="text-slate-300 font-mono text-[10px] truncate max-w-[120px] block" title="${p.publicKey}">${p.publicKey.substring(0, 14)}...</span>`
      : '<span class="text-slate-600 italic text-[10px]">Oculta</span>';

    return `
      <tr class="${rowClass} transition">
        <td class="py-3 px-3 font-bold ${isTarget ? 'text-amber-400 font-extrabold' : 'text-white'}">#${p.num}</td>
        <td class="py-3 px-3 text-slate-400 text-[10px] font-mono">
          <div title="${p.rangeStart} ➔ ${p.rangeEnd}">${p.rangeStart} ➔ ${p.rangeEnd.substring(0, 8)}...</div>
        </td>
        <td class="py-3 px-3">
          <a href="${p.mempoolUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-mono">
            <span>${p.address.substring(0, 10)}...${p.address.slice(-5)}</span>
            <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i>
          </a>
        </td>
        <td class="py-3 px-3">${pubKeyDisplay}</td>
        <td class="py-3 px-3">${privKeyDisplay}</td>
        <td class="py-3 px-3 font-bold text-amber-400">${p.btcPrize} BTC</td>
        <td class="py-3 px-3">${roiBadge}</td>
        <td class="py-3 px-3">${statusBadge}</td>
        <td class="py-3 px-3 text-right">
          ${!isSolved
            ? `<button onclick="setTargetPuzzle(${p.num})" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] transition">
                🎯 Atacar
              </button>`
            : `<span class="text-[10px] text-slate-500">Concluído</span>`
          }
        </td>
      </tr>`;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function filterP1000Status(status) {
  currentStatusFilter = status;

  ['all', 'unsolved', 'solved'].forEach(s => {
    const btn = document.getElementById(`btn-filter-${s}`);
    if (btn) {
      if (s === status) {
        btn.className = 'px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30';
      } else {
        btn.className = 'px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-400 hover:text-white';
      }
    }
  });

  applyP1000Filters();
}

function debounceP1000Search() {
  clearTimeout(p1000DebounceTimer);
  p1000DebounceTimer = setTimeout(applyP1000Filters, 200);
}

function applyP1000Filters() {
  const query = document.getElementById('p1000SearchInput')?.value.trim().toLowerCase() || '';

  filtered1000Puzzles = all1000Puzzles.filter(p => {
    if (currentStatusFilter === 'solved' && !p.solved) return false;
    if (currentStatusFilter === 'unsolved' && p.solved) return false;

    if (query) {
      const matchNum = String(p.num).includes(query.replace(/\D/g, ''));
      const matchAddr = p.address && p.address.toLowerCase().includes(query);
      const matchPub = p.publicKey && p.publicKey.toLowerCase().includes(query);
      return matchNum || matchAddr || matchPub;
    }
    return true;
  });

  render1000Table(filtered1000Puzzles);
}

function setTargetPuzzle(num) {
  const puzzle = all1000Puzzles.find(p => p.num === num);
  if (!puzzle) return;

  const cmd = `python solver/colab_worker.py --api=${window.location.origin} --chain=BTC --challenge=BTC_1000_P${num}`;
  const el = document.getElementById('colabCliCode');
  if (el) el.innerText = cmd;

  setInner('headerTarget', `Puzzle #${num} (${puzzle.btcPrize} BTC)`);
  switchTab('tab-fleet');
  alert(`🎯 Alvo Definido: Puzzle #${num} (${puzzle.btcPrize} BTC)!\n\nComando atualizado na aba Fleet Manager.`);
}

function generateColabTargetCommand(num) {
  const cmd = `python solver/colab_worker.py --api=${window.location.origin} --chain=BTC --challenge=BTC_1000_P${num}`;
  navigator.clipboard.writeText(cmd).then(() => {
    alert(`📋 Comando copiado para a área de transferência!\n\n${cmd}`);
  });
}

// ─── MULTI-CHAIN DATA COM ROI DINÂMICO ───
async function fetchMultiChainData() {
  try {
    const res = await fetch('/api/advisor/recommendations?fleetHashrate=42000000000');
    const data = await res.json();
    const recommendations = data.recommendations || [];
    const others = recommendations.filter(p => p.chain !== 'BTC' || p.puzzleNumber > 160);

    const container = document.getElementById('multiChainCardsGrid');
    if (!container) return;

    container.innerHTML = others.map(c => {
      const roi = c.roi || {};
      const isTopRoi = roi.badge === 'TOP_ROI';
      const isQuickWin = roi.badge === 'QUICK_WIN';

      const roiBadge = isTopRoi
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-md flex items-center gap-1">⭐ TOP ROI</span>'
        : (isQuickWin 
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">⚡ GANHO RÁPIDO</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">VIÁVEL</span>');

      return `
        <div class="glass-panel p-5 rounded-2xl space-y-4 hover:border-purple-500/40 transition flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.chain === 'ETH' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}">${c.chain}</span>
                  ${roiBadge}
                </div>
                <h4 class="font-bold text-white text-base mt-1.5 leading-snug">${c.title}</h4>
              </div>
              <div class="text-right shrink-0">
                <span class="text-xl font-extrabold text-amber-400 font-mono block">${c.prize} ${c.prizeCurrency || c.chain}</span>
                <span class="text-[11px] text-slate-400 font-mono">~$${(roi.prizeUSD || 0).toLocaleString()} USD</span>
              </div>
            </div>

            <!-- Financial Metrics Grid -->
            <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-cypher-950 border border-white/5 font-mono text-xs">
              <div class="p-2 rounded bg-white/5 space-y-0.5">
                <div class="text-[10px] text-slate-400">Lucro/Dia Estimado</div>
                <div class="font-bold text-emerald-400 text-sm">${roi.roiPerDayFormatted || '$0/dia'}</div>
              </div>
              <div class="p-2 rounded bg-white/5 space-y-0.5">
                <div class="text-[10px] text-slate-400">Tempo Médio da Frota</div>
                <div class="font-bold text-cyan-300 text-sm">${roi.formattedFleetTime || 'Minutos'}</div>
              </div>
            </div>

            <div class="text-xs text-slate-300 font-mono bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-1">
              <div><span class="text-slate-500">Algoritmo:</span> <strong class="text-slate-300">${roi.algorithmType || 'O(N)'}</strong></div>
              <div><span class="text-slate-500">Endereço/Alvo:</span> <span class="text-cyan-400">${c.targetAddress}</span></div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/5">
            <span class="text-emerald-400 font-semibold text-xs">${c.difficultyLabel || 'Instantâneo'}</span>
            <button onclick="setMultiChainTarget('${c.chain}', '${c.challengeId || c.title}')" class="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-black font-extrabold text-xs transition shadow-lg shadow-purple-500/20">
              Atacar Desafio
            </button>
          </div>
        </div>
      `;
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Erro ao carregar multi-chain com ROI:', err);
  }
}

function setMultiChainTarget(chain, challengeId) {
  const cmd = `python solver/colab_worker.py --api=${window.location.origin} --chain=${chain} --challenge=${challengeId}`;
  const el = document.getElementById('colabCliCode');
  if (el) el.innerText = cmd;
  switchTab('tab-fleet');
  alert(`🎯 Desafio Multi-Chain Selecionado: [${chain}] ${challengeId}!\nComando Colab atualizado.`);
}

// ─── FLEET MANAGEMENT ───
async function fetchFleetData() {
  try {
    const res = await fetch('/api/workers/active');
    const data = await res.json();

    const count = data.activeCount || 0;
    const hashrate = data.totalHashrateFormatted || '0 H/s';
    setInner('headerHashrate', hashrate);

    const container = document.getElementById('fleetNodesList');
    if (!container) return;

    const workers = data.workers || [];
    if (workers.length === 0) {
      container.innerHTML = `
        <div class="glass-panel rounded-xl p-8 border border-dashed border-white/10 text-center col-span-full">
          <i data-lucide="server" class="w-8 h-8 text-slate-500 mx-auto mb-3"></i>
          <p class="text-sm text-slate-400">Nenhum nó Colab minerando no momento.</p>
          <p class="text-xs text-slate-500 mt-1">Copie o comando acima e execute no Google Colab para conectar nós GPU!</p>
        </div>`;
    } else {
      container.innerHTML = workers.map(w => `
        <div class="glass-panel p-4 rounded-xl space-y-2 border border-emerald-500/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-bold text-white text-sm font-mono">${w.name}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">ONLINE</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
            <div class="p-2 rounded bg-white/5">
              <div class="text-slate-400 text-[10px]">Hashrate</div>
              <div class="font-bold text-cyan-300">${w.hashrateFormatted}</div>
            </div>
            <div class="p-2 rounded bg-white/5">
              <div class="text-slate-400 text-[10px]">Hardware</div>
              <div class="font-bold text-slate-200 truncate">${w.hardware}</div>
            </div>
          </div>
        </div>
      `).join('');
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (_) {}
}

async function generateColabToken() {
  try {
    const res = await fetch('/api/workers/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `colab-t4-${Math.floor(Math.random() * 10000)}`, hardware: 'Tesla T4' })
    });
    const data = await res.json();
    if (data.token) {
      const cmd = `python solver/colab_worker.py --api=${window.location.origin} --token=${data.token} --chain=BTC --challenge=BTC_1000_P71`;
      const el = document.getElementById('colabCliCode');
      if (el) el.innerText = cmd;
      alert(`🔑 Novo Token Gerado!\n${data.token}\n\nComando pronto atualizado na tela.`);
    }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// ─── LIVE RANGES SYNC DATA ───
async function fetchLiveRangesData() {
  try {
    const res = await fetch('/api/ranges/available');
    const data = await res.json();
    const ranges = data.ranges || [];

    const tbody = document.getElementById('rangesTableBody');
    if (!tbody) return;

    if (ranges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500 text-xs">Aguardando novos blocos de varredura...</td></tr>`;
      return;
    }

    tbody.innerHTML = ranges.slice(0, 15).map(r => `
      <tr class="hover:bg-white/5 transition font-mono text-[11px]">
        <td class="py-2.5 px-3 text-slate-400">${new Date().toLocaleTimeString()}</td>
        <td class="py-2.5 px-3 text-amber-400 font-bold">BTC</td>
        <td class="py-2.5 px-3 text-white">BTC_1000_P71</td>
        <td class="py-2.5 px-3 text-cyan-300">#${r.chunkIndex || 0}</td>
        <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px]">0x${r.rangeStart}</td>
        <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px]">0x${r.rangeEnd}</td>
        <td class="py-2.5 px-3 text-slate-400">Colab Cluster</td>
        <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">PRUNED_SCANNED</span></td>
        <td class="py-2.5 px-3 text-right font-bold text-emerald-400">45.0 GH/s</td>
      </tr>
    `).join('');
  } catch (_) {}
}

// ─── LEARNING LAB BENCHMARK ───
async function runSandboxBenchmark() {
  const puzzleNum = document.getElementById('sandboxPuzzleSelect')?.value || '30';
  const logsEl = document.getElementById('sandboxLogs');
  const statusEl = document.getElementById('sandboxStatus');
  const offsetEl = document.getElementById('sandboxOffset');
  const btn = document.getElementById('runBenchmarkBtn');

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerText = 'Executando benchmark...';
  if (logsEl) logsEl.innerHTML = '<div class="text-yellow-400">> Iniciando benchmark contra Puzzle #' + puzzleNum + '...</div>';

  try {
    const res = await fetch('/api/sandbox/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleNumber: Number(puzzleNum), hardware: 'Google Colab Tesla T4' })
    });
    const data = await res.json();

    if (data.logs && logsEl) {
      logsEl.innerHTML = '';
      for (const log of data.logs) {
        await new Promise(r => setTimeout(r, 200));
        const isKey = log.includes('KEY_INTERSECTION') || log.includes('RESULT');
        const line = document.createElement('div');
        line.className = (isKey ? 'text-emerald-400 font-bold' : 'text-cyan-300') + ' text-[11px]';
        line.textContent = '> ' + log;
        logsEl.appendChild(line);
        document.getElementById('sandboxTerminal')?.scrollTo(0, 99999);
      }
    }

    if (statusEl) statusEl.innerText = '✅ Calibração Concluída!';
    if (offsetEl) offsetEl.innerText = '5,000,000 chaves/s';
  } catch (err) {
    if (logsEl) logsEl.innerHTML += `<div class="text-red-400">> ERRO: ${err.message}</div>`;
    if (statusEl) statusEl.innerText = '❌ Erro';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── RADAR DE INTELIGÊNCIA IA (GEMINI FEED) ───
async function fetchAnalystFeed() {
  try {
    const res = await fetch('/api/analyst/feed');
    const data = await res.json();
    const feed = data.feed || [];
    const container = document.getElementById('analystFeedGrid');
    if (!container) return;

    if (feed.length === 0) {
      container.innerHTML = `
        <div class="glass-panel p-8 text-center rounded-2xl col-span-full border border-dashed border-white/10">
          <i data-lucide="sparkles" class="w-8 h-8 text-amber-400 mx-auto mb-2 animate-pulse"></i>
          <p class="text-sm text-slate-300 font-semibold">Sentinela IA em Monitoramento Contínuo</p>
          <p class="text-xs text-slate-500 mt-1">O Gemini e o Mempool Watcher avaliam o mercado a cada 45 segundos.</p>
        </div>
      `;
    } else {
      container.innerHTML = feed.map(opp => `
        <div class="glass-panel p-5 rounded-2xl space-y-3 border border-amber-500/20">
          <div class="flex items-start justify-between">
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 uppercase">${opp.chain} • ${opp.bitRange || 66} BITS</span>
              <h4 class="font-bold text-white text-base mt-1">${opp.title}</h4>
            </div>
            <div class="text-right">
              <span class="text-lg font-extrabold text-amber-400 font-mono">${opp.prizeAmount} ${opp.prizeCurrency}</span>
              <div class="text-[10px] text-emerald-400 font-bold">${opp.roi?.roiPerDayFormatted || '$0/dia'}</div>
            </div>
          </div>
          <div class="text-xs text-slate-300 font-mono bg-cypher-950 p-3 rounded-xl border border-white/5 space-y-1">
            <div><span class="text-slate-500">Alvo:</span> ${opp.targetAddress}</div>
            <div><span class="text-slate-500">Algoritmo:</span> <strong class="text-cyan-300">${opp.roi?.algorithmType || opp.algorithm}</strong></div>
            <div><span class="text-slate-500">Segurança:</span> <span class="text-emerald-400">${opp.isSafe ? '✅ Aprovado (Zero Honeypot)' : '⚠️ Risco'}</span></div>
          </div>
          <div class="flex items-center justify-between pt-2">
            <span class="text-xs text-slate-400">Tempo Frota: <strong class="text-slate-200">${opp.roi?.formattedFleetTime || 'Rápido'}</strong></span>
            <button onclick="approveAnalystTarget('${opp.targetId}')" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-black font-extrabold text-xs transition">
              Aprovar Alocação
            </button>
          </div>
        </div>
      `).join('');
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (_) {}
}

async function approveAnalystTarget(targetId) {
  try {
    const res = await fetch('/api/analyst/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId, operator: 'Operador Web' })
    });
    const data = await res.json();
    alert(`🎯 ${data.message || 'Alvo aprovado e alocado para a frota!'}`);
    fetchAnalystFeed();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function evaluateCustomChallenge() {
  const text = prompt('Cole o texto bruto ou endereço do enigma criptográfico para a IA analisar:');
  if (!text) return;
  try {
    const res = await fetch('/api/analyst/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: text })
    });
    const data = await res.json();
    alert(`✨ Análise IA Concluída!\n\nDesafio: ${data.opportunity?.title}\nROI Diário: ${data.opportunity?.roi?.roiPerDayFormatted}\nSegurança: ${data.opportunity?.isSafe ? 'APROVADO' : 'RISCO'}`);
    fetchAnalystFeed();
  } catch (e) {
    alert('Erro na análise: ' + e.message);
  }
}

// ─── POOL PROOF-OF-SHARE & TRANSPARÊNCIA ───
async function fetchPoolStats() {
  try {
    const res = await fetch('/api/pool/stats');
    const data = await res.json();
    setInner('poolTotalSharesDisplay', Number(data.totalPoolShares || 0).toLocaleString());

    const tbody = document.getElementById('poolLeaderboardBody');
    if (!tbody) return;

    const workers = data.workers || [];
    if (workers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500 text-xs">Nenhum worker submeteu DPs recentemente.</td></tr>`;
      return;
    }

    tbody.innerHTML = workers.map(w => {
      const anonId = w.workerToken.substring(0, 8) + '...' + w.workerToken.slice(-4);
      return `
        <tr class="hover:bg-white/5 transition font-mono text-[11px]">
          <td class="py-2.5 px-3 text-cyan-300 font-bold">${anonId}</td>
          <td class="py-2.5 px-3 text-white">${w.workerName}</td>
          <td class="py-2.5 px-3 font-bold text-emerald-400">${Number(w.shares).toLocaleString()} DPs</td>
          <td class="py-2.5 px-3 text-amber-300 font-bold">${w.sharePercent}</td>
          <td class="py-2.5 px-3 text-emerald-300">Prêmio Proporcional</td>
          <td class="py-2.5 px-3 text-right text-slate-400">${new Date(w.lastSeen).toLocaleTimeString()}</td>
        </tr>
      `;
    }).join('');
  } catch (_) {}
}

function calculateSubscriberYield() {
  const ghRate = parseFloat(document.getElementById('calcHardwareSelect')?.value || '18');
  const challengeVal = document.getElementById('calcChallengeSelect')?.value || '7.1_BTC';

  let totalPrizeUSD = 461500;
  if (challengeVal === '1.2_BTC') totalPrizeUSD = 78000;
  if (challengeVal === '5.0_ETH') totalPrizeUSD = 16000;
  if (challengeVal === '15.0_SOL') totalPrizeUSD = 2700;

  // Participação estimada assumindo pool de 200 GH/s
  const assumedPoolPower = 200;
  const shareRatio = Math.min(1, ghRate / assumedPoolPower);
  const estimatedReward = totalPrizeUSD * shareRatio;

  setInner('calcEstimatedReward', `~$${Math.round(estimatedReward).toLocaleString()} USD (${(shareRatio * 100).toFixed(1)}%)`);
}

// Inicializações periódicas
setInterval(fetchAnalystFeed, 15000);
setInterval(fetchPoolStats, 10000);

// Polling inicial de carga
setTimeout(() => {
  fetchAnalystFeed();
  fetchPoolStats();
  calculateSubscriberYield();
}, 1000);

// ─── ADVISOR CHAT ───
function toggleAdvisorChat() {
  isChatOpen = !isChatOpen;
  const modal = document.getElementById('advisorChatModal');
  if (modal) {
    modal.classList.toggle('hidden', !isChatOpen);
    if (isChatOpen) document.getElementById('advisorInput')?.focus();
  }
  if (window.lucide) window.lucide.createIcons();
}

async function sendAdvisorMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('advisorInput');
  const msg = input.value.trim();
  if (!msg) return;

  appendChatMessage('user', msg);
  input.value = '';

  const loadingId = appendChatMessage('ai', '⏳ Analisando matemática...');

  try {
    const res = await fetch('/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    updateChatMessage(loadingId, data.reply || 'Resposta concluída.');
  } catch (err) {
    updateChatMessage(loadingId, `⚠️ Erro: ${err.message}`);
  }
}

function askQuickPrompt(text) {
  document.getElementById('advisorInput').value = text;
  sendAdvisorMessage();
}

function appendChatMessage(sender, text) {
  const container = document.getElementById('advisorMessages');
  if (!container) return;
  const msgId = 'msg_' + Date.now();
  const div = document.createElement('div');
  div.id = msgId;
  div.className = sender === 'user'
    ? 'p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 ml-6 text-xs'
    : 'p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 mr-6 text-xs';
  div.innerHTML = text.replace(/\n/g, '<br/>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return msgId;
}

function updateChatMessage(msgId, text) {
  const el = document.getElementById(msgId);
  if (el) el.innerHTML = text.replace(/\n/g, '<br/>');
}

// ─── HELPERS ───
function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => alert('Copiado! ✓'));
}

function copyCommand(id) {
  const text = document.getElementById(id)?.innerText;
  if (text) copyText(text);
}
