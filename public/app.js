// ============================================
// 🧩 PuzzleRadar v3.0 — Frontend Application Logic (1000 BTC & Multi-Chain)
// ============================================

let currentTab = 'tab-dashboard';
let all1000Puzzles = [];
let filtered1000Puzzles = [];
let currentStatusFilter = 'all';
let isChatOpen = false;
let p1000DebounceTimer = null;
let telemetryEventSource = null;

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  switchTab('tab-dashboard');
  initTelemetryStream();
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

// ─── LIVE RANGES & SPACE PRUNING DATA ───
async function fetchLiveRangesData() {
  try {
    const [recentRes, pruningRes] = await Promise.all([
      fetch('/api/ranges/recent'),
      fetch('/api/ranges/space-pruning-live?puzzleId=puzzle_btc_71&total=10000')
    ]);

    const recentData = await recentRes.json();
    const pruningData = await pruningRes.json();

    // 1. Atualiza métricas de Space Pruning
    if (pruningData) {
      const percent = pruningData.prunedPercent || 0;
      const scanned = pruningData.scannedChunks || 0;
      const total = pruningData.totalChunks || 10000;

      setInner('pruningPercentDisplay', `${percent.toFixed(2)}% do espaço podado`);
      setInner('pruningScannedCount', Number(scanned).toLocaleString());
      setInner('pruningTotalCount', Number(total).toLocaleString() + ' fatias');

      const bar = document.getElementById('pruningProgressBar');
      if (bar) bar.style.width = `${Math.max(2, Math.min(100, percent))}%`;
    }

    // 2. Atualiza tabela de ranges recentes varridos
    const ranges = recentData.ranges || [];
    const tbody = document.getElementById('rangesTableBody');
    setInner('rangesCountDisplay', `${ranges.length} fatias auditadas no histórico`);

    if (tbody) {
      if (ranges.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500 text-xs">Aguardando novos blocos de varredura do cluster...</td></tr>`;
      } else {
        tbody.innerHTML = ranges.map(r => {
          const isPendingBuffer = r.status === 'BUFFER_PENDING_BATCH';
          const statusBadge = isPendingBuffer
            ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">⏳ BUFFER (BATCH)</span>'
            : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">✅ PRUNED_SCANNED</span>';

          const timeFormatted = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

          return `
            <tr class="hover:bg-white/5 transition font-mono text-[11px]">
              <td class="py-2.5 px-3 text-slate-400">${timeFormatted}</td>
              <td class="py-2.5 px-3 text-amber-400 font-bold">${r.chain || 'BTC'}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${r.challengeId || 'BTC_1000_P71'}</td>
              <td class="py-2.5 px-3 text-cyan-300 font-bold">#${r.chunkIndex !== undefined ? r.chunkIndex : 0}</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px]" title="${r.rangeStart}">0x${(r.rangeStart || '').substring(0, 14)}...</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px]" title="${r.rangeEnd}">0x${(r.rangeEnd || '').substring(0, 14)}...</td>
              <td class="py-2.5 px-3 text-slate-300">${r.workerName || 'Colab Farm Node'}</td>
              <td class="py-2.5 px-3">${statusBadge}</td>
              <td class="py-2.5 px-3 text-right font-bold text-emerald-400">${r.hashrate || '45.0 GH/s'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (_) {}
}

// ─── POOL PROOF-OF-SHARE, DPS STREAM & TRANSPARÊNCIA ───
async function fetchPoolStats() {
  try {
    const res = await fetch('/api/pool/transparency');
    const data = await res.json();

    setInner('poolTotalSharesDisplay', Number(data.totalPoolShares || 0).toLocaleString());
    setInner('poolTotalDpsDisplay', Number(data.totalDistinguishedPoints || 0).toLocaleString());

    if (data.bufferStats) {
      setInner('bufferStatsDisplay', `${data.bufferStats.currentBufferSize} no buffer (${data.bufferStats.totalRowsSent} sincronizados)`);
    }

    // 1. Renderiza Stream de Distinguished Points (DPs)
    const dpsTbody = document.getElementById('poolLiveDpsBody');
    if (dpsTbody) {
      const dps = data.recentDps || [];
      if (dps.length === 0) {
        dpsTbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500 text-xs">Nenhum Distinguished Point recebido ainda. Clique em "Simular DP ao Vivo" para testar o fluxo!</td></tr>`;
      } else {
        dpsTbody.innerHTML = dps.map(dp => {
          const tameBadge = dp.isTame
            ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">🐴 TAME (Domesticado)</span>'
            : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">🦘 WILD (Selvagem)</span>';

          const timeFormatted = dp.timestamp ? new Date(dp.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

          return `
            <tr class="hover:bg-white/5 transition font-mono text-[11px]">
              <td class="py-2.5 px-3 text-slate-400">${timeFormatted}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${dp.challengeId || 'BTC_1000_P71'}</td>
              <td class="py-2.5 px-3 text-cyan-300 font-bold" title="${dp.xCoordHex}">0x${(dp.xCoordHex || '').substring(0, 16)}...</td>
              <td class="py-2.5 px-3 text-slate-300">${dp.stepDistanceHex || '0x0'}</td>
              <td class="py-2.5 px-3">${tameBadge}</td>
              <td class="py-2.5 px-3 text-slate-200">${dp.workerName || 'Worker Node'}</td>
              <td class="py-2.5 px-3 text-right"><span class="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ REGISTRADO O(1)</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Renderiza Quadro de Dividendos dos Assinantes
    const tbody = document.getElementById('poolLeaderboardBody');
    if (tbody) {
      const workers = data.workers || [];
      if (workers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-500 text-xs">Nenhum worker com shares registradas no momento.</td></tr>`;
      } else {
        tbody.innerHTML = workers.map(w => {
          const anonId = w.workerToken ? (w.workerToken.substring(0, 8) + '...' + w.workerToken.slice(-4)) : 'wrk_anon';
          return `
            <tr class="hover:bg-white/5 transition font-mono text-[11px]">
              <td class="py-2.5 px-3 text-cyan-300 font-bold">${anonId}</td>
              <td class="py-2.5 px-3 text-white font-semibold">${w.workerName}</td>
              <td class="py-2.5 px-3 font-bold text-emerald-400">${Number(w.shares).toLocaleString()} DPs</td>
              <td class="py-2.5 px-3 text-amber-300 font-bold">${w.sharePercent}</td>
              <td class="py-2.5 px-3 text-emerald-300 font-bold font-mono">~$${Number(w.projectedPayoutUsd || 0).toLocaleString()} USD</td>
              <td class="py-2.5 px-3 text-right text-slate-400">${w.lastSeen ? new Date(w.lastSeen).toLocaleTimeString() : '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (_) {}
}

async function triggerSimulatedWorkerStep() {
  const btn = document.getElementById('btnSimulatePoS');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/pool/simulate-worker-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerToken: currentUser?.workerToken || 'wrk_web_simulator',
        workerName: currentUser?.name ? `${currentUser.name} (Web GPU)` : 'Simulador Web GPU',
        challengeId: 'BTC_1000_P71'
      })
    });
    const data = await res.json();
    if (data.success) {
      await fetchPoolStats();
      await fetchLiveRangesData();
    }
  } catch (err) {
    alert('Erro ao simular: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
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

// Inicializações periódicas a cada 4 segundos
setInterval(fetchAnalystFeed, 10000);
setInterval(fetchPoolStats, 4000);
setInterval(fetchLiveRangesData, 4000);

// Polling inicial de carga
setTimeout(() => {
  fetchAnalystFeed();
  fetchPoolStats();
  fetchLiveRangesData();
  calculateSubscriberYield();
}, 600);

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

// ─── AUTHENTICATION & USER SESSION ───
let currentAuthTab = 'login';
let currentUser = null;

function openAuthModal(mode = 'login') {
  switchAuthTab(mode);
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('hidden');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(tab) {
  currentAuthTab = tab;
  const loginBtn = document.getElementById('authTabLogin');
  const regBtn = document.getElementById('authTabRegister');
  const nameField = document.getElementById('authNameField');
  const title = document.getElementById('authModalTitle');
  const submitBtn = document.getElementById('authSubmitBtn');

  if (tab === 'login') {
    if (loginBtn) loginBtn.className = 'flex-1 py-1.5 rounded-lg font-bold transition bg-emerald-500 text-black';
    if (regBtn) regBtn.className = 'flex-1 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    if (nameField) nameField.classList.add('hidden');
    if (title) title.innerText = 'Entrar no PuzzleRadar';
    if (submitBtn) submitBtn.innerText = 'Entrar na Conta';
  } else {
    if (regBtn) regBtn.className = 'flex-1 py-1.5 rounded-lg font-bold transition bg-emerald-500 text-black';
    if (loginBtn) loginBtn.className = 'flex-1 py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white';
    if (nameField) nameField.classList.remove('hidden');
    if (title) title.innerText = 'Criar Conta de Minerador';
    if (submitBtn) submitBtn.innerText = 'Gerar Token & Cadastrar';
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmailInput')?.value.trim();
  const password = document.getElementById('authPasswordInput')?.value.trim();
  const name = document.getElementById('authNameInput')?.value.trim();

  const endpoint = currentAuthTab === 'register' ? '/api/auth/register' : '/api/auth/login';
  const payload = currentAuthTab === 'register' ? { email, password, name } : { email, password };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      alert(`⚠️ ${data.error || 'Falha na autenticação'}`);
      return;
    }

    localStorage.setItem('pzk_jwt_token', data.token);
    currentUser = data.user;
    updateAuthUI();
    closeAuthModal();

    alert(`🎉 Bem-vindo, ${currentUser.name || currentUser.username}!\nSeu Token de Mineração Exclusivo: ${currentUser.workerToken}`);
  } catch (err) {
    alert(`Erro de conexão: ${err.message}`);
  }
}

function updateAuthUI() {
  const unauthBox = document.getElementById('unauthHeaderActions');
  const authPill = document.getElementById('authUserPill');
  const nameDisp = document.getElementById('authUserNameDisplay');
  const roleDisp = document.getElementById('authUserRoleDisplay');

  if (currentUser) {
    if (unauthBox) unauthBox.classList.add('hidden');
    if (authPill) authPill.classList.remove('hidden');
    if (authPill) authPill.classList.add('flex');
    if (nameDisp) nameDisp.innerText = currentUser.name || currentUser.username;
    if (roleDisp) {
      roleDisp.innerText = currentUser.role || 'USER';
      roleDisp.className = currentUser.role === 'ADMIN'
        ? 'px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30'
        : 'px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }

    // Injeta o workerToken exclusivo do usuário no comando e botões
    if (currentUser.workerToken) {
      const cli = document.getElementById('colabCliCode');
      if (cli) {
        cli.innerText = `python solver/colab_worker.py --api=${window.location.origin} --token=${currentUser.workerToken} --chain=BTC --challenge=BTC_1000_P71`;
      }
    }
  } else {
    if (unauthBox) unauthBox.classList.remove('hidden');
    if (authPill) authPill.classList.add('hidden');
    if (authPill) authPill.classList.remove('flex');
  }
  if (window.lucide) window.lucide.createIcons();
}

function logoutUser() {
  localStorage.removeItem('pzk_jwt_token');
  currentUser = null;
  updateAuthUI();
  alert('Você saiu da sua conta.');
}

async function checkAuthSession() {
  const token = localStorage.getItem('pzk_jwt_token');
  if (!token) return;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateAuthUI();
    } else {
      localStorage.removeItem('pzk_jwt_token');
    }
  } catch (_) {}
}

// ─── SERVER-SENT EVENTS (SSE) TELEMETRY STREAM ───
function initTelemetryStream() {
  if (telemetryEventSource) {
    telemetryEventSource.close();
  }

  const streamStatus = document.getElementById('sseStreamStatus');

  try {
    telemetryEventSource = new EventSource('/api/telemetry/stream');

    telemetryEventSource.addEventListener('open', () => {
      if (streamStatus) {
        streamStatus.innerText = '🟢 SSE CONECTADO';
        streamStatus.className = 'text-[10px] font-mono text-emerald-400';
      }
      appendTerminalLog('SYSTEM', '⚡ Canal de telemetria em tempo real conectado com sucesso (SSE).');
    });

    telemetryEventSource.addEventListener('pulse', (e) => {
      try {
        const pulse = JSON.parse(e.data);
        handleTelemetryPulse(pulse);
      } catch (err) {
        console.error('Erro ao processar pulso SSE:', err);
      }
    });

    telemetryEventSource.addEventListener('telemetry_event', (e) => {
      try {
        const event = JSON.parse(e.data);
        appendTerminalLog(event.type, event.message);
      } catch (err) {
        console.error('Erro ao processar evento SSE:', err);
      }
    });

    telemetryEventSource.addEventListener('error', () => {
      if (streamStatus) {
        streamStatus.innerText = '🟡 RECONECTANDO...';
        streamStatus.className = 'text-[10px] font-mono text-amber-400 animate-pulse';
      }
    });
  } catch (err) {
    console.error('Falha ao inicializar EventSource:', err);
  }
}

function handleTelemetryPulse(pulse) {
  if (!pulse) return;

  // Header & Global Stats
  if (pulse.globalHashrate) {
    setInner('headerHashrate', pulse.globalHashrate);
    setInner('dashGlobalHashrate', pulse.globalHashrate);
  }
  if (pulse.totalActiveNodes !== undefined) {
    setInner('dashActiveNodes', `${pulse.totalActiveNodes} Ativos`);
  }

  // Alvo Primário
  if (pulse.activeTarget) {
    setInner('dashTargetTitle', pulse.activeTarget.title);
    setInner('dashTargetPrize', `Prêmio: ${pulse.activeTarget.prize}`);
    setInner('dashSentinelStatus', pulse.activeTarget.sentinelStatus || 'INTACTO / LIMPO');
    setInner('dashTargetAlgo', pulse.activeTarget.complexity || 'Kangaroo O(√N)');
    setInner('dashTargetTime', pulse.activeTarget.estimatedFleetTime || '4.8 dias');
    setInner('dashTargetScanned', `${pulse.activeTarget.scannedPercent || 18.4}%`);
    const bar = document.getElementById('dashTargetProgressBar');
    if (bar) bar.style.width = `${pulse.activeTarget.scannedPercent || 18.4}%`;
  }

  // Alvo Secundário
  if (pulse.secondaryTarget) {
    setInner('dashSecTitle', pulse.secondaryTarget.title);
    setInner('dashSecPrize', `Prêmio: ${pulse.secondaryTarget.prize}`);
    setInner('dashSecComplexity', pulse.secondaryTarget.complexity || 'O(N) 2^44');
    setInner('dashSecTime', pulse.secondaryTarget.estimatedFleetTime || '14 horas');
  }

  // Proof-of-Share
  if (pulse.proofOfShare) {
    setInner('dashTotalDps', Number(pulse.proofOfShare.totalDistinguishedPoints || 0).toLocaleString());
    setInner('poolTotalDpsDisplay', Number(pulse.proofOfShare.totalDistinguishedPoints || 0).toLocaleString());
    setInner('dashPoolUsd', `$${Number(pulse.proofOfShare.estimatedRewardPoolUsd || 461500).toLocaleString()}`);

    const workersListEl = document.getElementById('dashTopWorkersList');
    if (workersListEl && pulse.proofOfShare.topWorkers) {
      workersListEl.innerHTML = pulse.proofOfShare.topWorkers.map((w, idx) => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
          <div class="flex items-center gap-2">
            <span class="text-amber-400 font-bold">#${idx + 1}</span>
            <span class="text-white text-xs truncate max-w-[140px]">${w.name}</span>
          </div>
          <div class="text-right">
            <span class="text-emerald-400 font-bold">${w.sharePercent}</span>
            <span class="text-slate-500 text-[10px] ml-1.5">(~$${Number(w.projectedPayoutUsd || 0).toLocaleString()})</span>
          </div>
        </div>
      `).join('');
    }
  }
}

function appendTerminalLog(type, message) {
  const terminal = document.getElementById('telemetryTerminalStream');
  if (!terminal) return;

  const row = document.createElement('div');
  const time = new Date().toLocaleTimeString();

  let colorClass = 'text-slate-300';
  if (type === 'DP_SUBMITTED') colorClass = 'text-cyan-300 font-bold';
  if (type === 'COLLISION_ALERT') colorClass = 'text-red-400 font-extrabold animate-pulse';
  if (type === 'SENTINEL') colorClass = 'text-emerald-400';
  if (type === 'SYSTEM') colorClass = 'text-amber-300';

  row.className = `${colorClass} leading-relaxed`;
  row.innerText = `> [${time}] [${type}] ${message}`;

  terminal.appendChild(row);

  // Auto-scroll
  terminal.scrollTop = terminal.scrollHeight;

  // Limita a 100 linhas no terminal
  while (terminal.children.length > 100) {
    terminal.removeChild(terminal.firstChild);
  }
}

function clearTerminalLogs() {
  const terminal = document.getElementById('telemetryTerminalStream');
  if (terminal) {
    terminal.innerHTML = '<div class="text-slate-500">> Console limpo pelo usuário.</div>';
  }
}

// ─── ROBUST CLIPBOARD HELPER (HTTPS + HTTP / IFRAME FALLBACK) ───
function copyTextToClipboard(text, successMessage = 'Copiado com sucesso!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage);
    }).catch(() => {
      fallbackCopyText(text, successMessage);
    });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      showToast(successMessage);
    } else {
      prompt('Copie o código manualmente abaixo (Ctrl + C):', text);
    }
  } catch (err) {
    prompt('Copie o código manualmente abaixo (Ctrl + C):', text);
  }
}

function showToast(message) {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl bg-emerald-500 text-black font-extrabold text-xs shadow-2xl z-50 transition-all duration-300 transform opacity-0 pointer-events-none flex items-center gap-2 border border-emerald-300';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>📋</span> <span>${message}</span>`;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');

  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 3500);
}

// ─── MULTI-CLOUD ONBOARDING COPY HELPERS ───
function copyColabOneLiner() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="BTC" --challenge="BTC_1000_P71"`;
  copyTextToClipboard(code, 'Código do Google Colab copiado! Cole na célula do Colab e execute.');
}

function copyKaggleOneLiner() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --threads=4 --chain="BTC" --challenge="BTC_1000_P71"`;
  copyTextToClipboard(code, 'Código Kaggle Dual GPU copiado! Cole no seu notebook Kaggle.');
}

function copyLinuxCli() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token=${currentUser.workerToken}` : '';
  const code = `curl -sSL ${origin}/install-worker.sh | bash -s --${token} --challenge=BTC_1000_P71`;
  copyTextToClipboard(code, 'Comando Linux / WSL copiado!');
}

function copyCudaKeyhunt() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `./keyhunt -m kangaroo -c 1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU --pool-url="${origin}/api/pool"${token}`;
  copyTextToClipboard(code, 'Parâmetros KeyHunt CUDA copiados!');
}

function generateColabTargetCommand(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const cmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="BTC" --challenge="BTC_1000_P${num}"`;
  copyTextToClipboard(cmd, `Comando Colab para o Puzzle #${num} copiado!`);
}

// ─── HELPERS ───
function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

// Inicializa checagem de sessão
checkAuthSession();
