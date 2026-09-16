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
let currentActiveChain = 'BTC';
let currentActiveChallenge = 'BTC_1000_P71';
let currentActiveTitle = 'Puzzle #71 (7.1 BTC)';
let allMultiChainChallenges = [];
let currentSecondaryTarget = {
  id: 'BTC_SATOSHI_NONCE_REUSE',
  chain: 'BTC',
  title: 'Bitcoin ECDSA Nonce Reuse',
  prize: '1.20 BTC',
  prizeUSD: 78000,
  complexity: 'O(1) Instantâneo',
  filter: 'Cálculo Algébrico O(1)',
  time: 'Instantâneo',
  scanned: 100
};

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
      <tr class="${rowClass} transition whitespace-nowrap">
        <td class="py-3 px-3 font-bold ${isTarget ? 'text-amber-400 font-extrabold' : 'text-white'} whitespace-nowrap">#${p.num}</td>
        <td class="py-3 px-3 text-slate-400 text-[10px] font-mono whitespace-nowrap">
          <div title="${p.rangeStart} ➔ ${p.rangeEnd}">${p.rangeStart} ➔ ${p.rangeEnd.substring(0, 8)}...</div>
        </td>
        <td class="py-3 px-3 whitespace-nowrap">
          <a href="${p.mempoolUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-mono whitespace-nowrap">
            <span>${p.address.substring(0, 10)}...${p.address.slice(-5)}</span>
            <i data-lucide="external-link" class="w-3 h-3 shrink-0"></i>
          </a>
        </td>
        <td class="py-3 px-3 whitespace-nowrap">${pubKeyDisplay}</td>
        <td class="py-3 px-3 whitespace-nowrap">${privKeyDisplay}</td>
        <td class="py-3 px-3 font-bold text-amber-400 whitespace-nowrap">${p.btcPrize} BTC</td>
        <td class="py-3 px-3 whitespace-nowrap">${roiBadge}</td>
        <td class="py-3 px-3 whitespace-nowrap">${statusBadge}</td>
        <td class="py-3 px-3 text-right whitespace-nowrap">
          ${!isSolved
            ? `<button onclick="setTargetPuzzle(${p.num})" class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] transition whitespace-nowrap">
                🎯 Atacar
              </button>`
            : `<span class="text-[10px] text-slate-500 whitespace-nowrap">Concluído</span>`
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

function updateAllTargetCodeBoxes(chain, challengeId, titleDisplay) {
  currentActiveChain = chain || 'BTC';
  currentActiveChallenge = challengeId || 'BTC_1000_P71';
  currentActiveTitle = titleDisplay || `[${currentActiveChain}] ${currentActiveChallenge}`;

  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = (currentUser && currentUser.workerToken) ? ` --token="${currentUser.workerToken}"` : '';

  const colabCmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const localCmd = `py -3.12 solver/colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const kaggleCmd = `!pip install --no-cache-dir -q requests ecdsa base58 pycryptodome\n!curl -sSL --retry 3 ${origin}/solver/colab_worker.py -o colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const linuxCmd = `curl -sSL ${origin}/install-worker.sh | bash -s --${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;

  const colabOneLiner = document.getElementById('colabOneLinerCode');
  if (colabOneLiner) colabOneLiner.innerText = colabCmd;

  const kaggleOneLiner = document.getElementById('kaggleOneLinerCode');
  if (kaggleOneLiner) kaggleOneLiner.innerText = kaggleCmd;

  const colabBox = document.getElementById('colabDirectCodeBox');
  if (colabBox) colabBox.value = colabCmd;

  const localBox = document.getElementById('localDirectCodeBox');
  if (localBox) localBox.value = localCmd;

  const colabCli = document.getElementById('colabCliCode');
  if (colabCli) colabCli.innerText = localCmd;

  const linuxCli = document.getElementById('linuxCliCode');
  if (linuxCli) linuxCli.innerText = linuxCmd;

  setInner('headerTarget', currentActiveTitle);
  setInner('currentSelectedTargetDisplay', currentActiveTitle);
}

function setTargetPuzzle(num) {
  const puzzle = all1000Puzzles.find(p => p.num === num);
  const prize = puzzle ? `${puzzle.btcPrize} BTC` : '';
  const challengeId = `BTC_1000_P${num}`;
  
  updateAllTargetCodeBoxes('BTC', challengeId, `Puzzle #${num} (${prize})`);
  switchTab('tab-fleet');
  copyColabOneLiner();
  showToast(`🎯 Alvo Puzzle #${num} (${prize}) selecionado! Comando Colab copiado.`);
}

function generateColabTargetCommand(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = (currentUser && currentUser.workerToken) ? ` --token="${currentUser.workerToken}"` : '';
  const cmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="BTC" --challenge="BTC_1000_P${num}"`;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast(`📋 Comando GPU Colab para Puzzle #${num} copiado!`);
  });
}

// ─── MULTI-CHAIN DATA COM ROI DINÂMICO ───
function getExplorerUrl(chain, address) {
  if (!address || address === 'N/A') return '#';
  if (chain === 'BTC') return `https://mempool.space/address/${address}`;
  if (chain === 'ETH') return `https://etherscan.io/address/${address}`;
  if (chain === 'SOL') return `https://solscan.io/account/${address}`;
  return `https://mempool.space/address/${address}`;
}

async function fetchMultiChainData() {
  try {
    const res = await fetch('/api/advisor/recommendations?fleetHashrate=42000000000');
    const data = await res.json();
    const recommendations = data.recommendations || [];
    const others = recommendations.filter(p => p.chain !== 'BTC' || p.puzzleNumber > 160 || p.challengeId === 'BTC_SATOSHI_NONCE_REUSE');

    // Ordenação estrita por melhor ROI de resolução (do mais rentável/rápido em diante)
    others.sort((a, b) => {
      const roiA = a.roi ? (a.roi.roi_per_day_usd || 0) : 0;
      const roiB = b.roi ? (b.roi.roi_per_day_usd || 0) : 0;
      return roiB - roiA;
    });

    allMultiChainChallenges = others;

    const container = document.getElementById('multiChainCardsGrid');
    if (!container) return;

    container.innerHTML = others.map(c => {
      const roi = c.roi || {};
      const isTopRoi = roi.badge === 'TOP_ROI' || (roi.roi_per_day_usd >= 10000);
      const isQuickWin = roi.badge === 'QUICK_WIN' || (roi.expectedDays && roi.expectedDays <= 3);

      const roiBadge = isTopRoi
        ? '<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-md flex items-center gap-1">⭐ TOP ROI</span>'
        : (isQuickWin 
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">⚡ GANHO RÁPIDO</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">VIÁVEL</span>');

      const targetId = c.challengeId || c.title;
      const explorerUrl = getExplorerUrl(c.chain, c.targetAddress);

      return `
        <div class="glass-panel p-5 rounded-2xl space-y-4 hover:border-purple-500/40 transition flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.chain === 'ETH' ? 'bg-blue-500/10 text-blue-400' : c.chain === 'SOL' ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400'}">${c.chain}</span>
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

            <!-- On-Chain Sentinel & Blockchain Verification Link -->
            <div class="p-2.5 rounded-xl bg-cypher-950 border border-emerald-500/20 space-y-1 font-mono text-xs">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-400 flex items-center gap-1"><i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i> Sentinela On-Chain:</span>
                <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  <span>INTACTO / DISPONÍVEL</span>
                  <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-400">
                <span>Alvo na Rede:</span>
                <span class="text-cyan-400 font-mono text-[10px] truncate max-w-[170px]" title="${c.targetAddress || 'N/A'}">${c.targetAddress ? c.targetAddress.substring(0, 10) + '...' + c.targetAddress.slice(-6) : 'N/A'}</span>
              </div>
            </div>

            <!-- Space Pruning Live Progress -->
            <div class="space-y-1 font-mono">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>Espaço de Busca Varrido:</span>
                <span class="text-purple-300 font-bold" id="multiProgress_${targetId}">0.0%</span>
              </div>
              <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                <div id="multiProgressBar_${targetId}" class="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all duration-500" style="width: 5%"></div>
              </div>
            </div>

            <div class="text-xs text-slate-300 font-mono bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-1">
              <div><span class="text-slate-500">Algoritmo:</span> <strong class="text-slate-300">${roi.algorithmType || 'O(N)'}</strong></div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/5">
            <span class="text-emerald-400 font-semibold text-xs">${c.difficultyLabel || 'Instantâneo'}</span>
            <button onclick="setMultiChainTarget('${c.chain}', '${targetId}', '${c.title.replace(/'/g, "\\'")}', '${c.prize} ${c.prizeCurrency || c.chain}')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-extrabold text-xs transition shadow-lg shadow-purple-500/20 flex items-center gap-1.5">
              <i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Atacar Desafio
            </button>
          </div>
        </div>
      `;
    }).join('');
    // Sincroniza todos os desafios nos dropdowns dinâmicos
    updateDynamicChallengeDropdowns(others);

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Erro ao carregar multi-chain com ROI:', err);
  }
}

function setMultiChainTarget(chain, challengeId, title, prize) {
  const displayTitle = title ? `${title} (${prize || ''})` : `[${chain}] ${challengeId}`;
  updateAllTargetCodeBoxes(chain, challengeId, displayTitle);
  switchTab('tab-fleet');
  copyColabOneLiner();
  showToast(`🎯 Alvo [${chain}] ${challengeId} selecionado! Comando Colab específico copiado.`);
}

// ─── FLEET MANAGEMENT ───
async function fetchFleetData() {
  try {
    const res = await fetch('/api/workers/active');
    const data = await res.json();

    const count = data.activeCount || 0;
    const hashrate = data.totalHashrateFormatted || '0 H/s';
    setInner('headerHashrate', hashrate);
    setInner('dashGlobalHashrate', hashrate);
    setInner('dashActiveNodes', `${count} Ativos`);

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
      container.innerHTML = workers.map(w => {
        const chain = w.chain || 'BTC';
        const challenge = w.challengeId || 'BTC_1000_P71';
        const chainColor = chain === 'ETH'
          ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
          : chain === 'SOL'
            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
            : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

        const progressPercent = Math.min(100, Math.max(0, w.progress || 0));

        return `
          <div class="glass-panel p-4 rounded-xl space-y-3 border border-emerald-500/20 hover:border-emerald-500/40 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="font-bold text-white text-sm font-mono">${w.name}</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">ONLINE</span>
            </div>

            <!-- Active Target Challenge Info -->
            <div class="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
              <div class="text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>Alvo em Mineração:</span>
                <span class="px-2 py-0.5 rounded text-[9px] font-extrabold border ${chainColor}">${chain}</span>
              </div>
              <div class="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5 truncate">
                <i data-lucide="crosshair" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
                <span class="truncate" title="${challenge}">${challenge}</span>
              </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400 text-[10px]">Hashrate</div>
                <div class="font-bold text-emerald-400">${w.hashrateFormatted}</div>
              </div>
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400 text-[10px]">Hardware</div>
                <div class="font-bold text-slate-200 truncate" title="${w.hardware}">${w.hardware}</div>
              </div>
            </div>

            <!-- Progress Bar of current chunk -->
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Fatia Atual</span>
                <span>${progressPercent > 0 ? progressPercent + '%' : 'Varrendo...'}</span>
              </div>
              <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-300" style="width: ${Math.max(5, progressPercent)}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
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

// ─── DYNAMIC CHALLENGE DROPDOWNS SYNCHRONIZATION ───
function updateDynamicChallengeDropdowns(challenges = []) {
  if (!Array.isArray(challenges) || challenges.length === 0) return;

  // 1. Dropdown do Space Pruning
  const pruningSelect = document.getElementById('pruningChallengeSelect');
  if (pruningSelect) {
    const prevSelected = pruningSelect.value || currentSelectedPruningChallenge;
    const existingOptions = Array.from(pruningSelect.options).map(o => o.value);
    
    // Atualiza opções preservando seleção
    challenges.forEach(c => {
      const id = c.challengeId || `BTC_1000_P${c.puzzleNumber || c.num || 71}`;
      if (!existingOptions.includes(id)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = `${c.chain || 'BTC'} - ${c.title || id} (${c.prize || ''} ${c.prizeCurrency || c.chain || ''})`.trim();
        pruningSelect.appendChild(opt);
      }
    });

    if (prevSelected) pruningSelect.value = prevSelected;
  }

  // 2. Dropdown do Calculador de Rendimento (PoS Yield)
  const calcSelect = document.getElementById('calcChallengeSelect');
  if (calcSelect) {
    const prevCalc = calcSelect.value;
    challenges.forEach(c => {
      const id = c.challengeId || `BTC_1000_P${c.puzzleNumber || c.num || 71}`;
      const existing = Array.from(calcSelect.options).some(o => o.value === id || o.dataset.id === id);
      if (!existing && (c.prizeUSD || (c.roi && c.roi.prizeUSD))) {
        const prizeUsd = c.roi?.prizeUSD || c.prizeUSD || 0;
        const opt = document.createElement('option');
        opt.value = id;
        opt.dataset.usd = prizeUsd;
        opt.innerText = `${c.title || id} (${c.prize || ''} ${c.prizeCurrency || c.chain} ~ $${Number(prizeUsd).toLocaleString()} USD)`;
        calcSelect.appendChild(opt);
      }
    });
    if (prevCalc) calcSelect.value = prevCalc;
  }

  // 3. Dropdown do Alvo Secundário na Central de Comando
  const secSelect = document.getElementById('dashSecChallengeDropdown');
  if (secSelect) {
    const prevSec = secSelect.value || currentSecondaryTarget.id;
    const existingSec = Array.from(secSelect.options).map(o => o.value);
    challenges.forEach(c => {
      const id = c.challengeId || `BTC_1000_P${c.puzzleNumber || c.num || 71}`;
      if (!existingSec.includes(id)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = `[${c.chain || 'BTC'}] ${c.title || id} (${c.prize || ''} ${c.prizeCurrency || c.chain || ''})`.trim();
        secSelect.appendChild(opt);
      }
    });
    if (prevSec) secSelect.value = prevSec;
  }
}

// ─── ALVO SECUNDÁRIO DINÂMICO & ATACAR ───
function changeSecondaryTarget(challengeId) {
  const challenge = allMultiChainChallenges.find(c => (c.challengeId === challengeId || c.id === challengeId)) || {
    challengeId: challengeId,
    title: challengeId,
    chain: challengeId.startsWith('ETH') ? 'ETH' : challengeId.startsWith('SOL') ? 'SOL' : 'BTC',
    prize: '1.20 BTC',
    prizeCurrency: 'BTC',
    targetAddress: '15dTwY2K7XjY83j3eTcxL5LwA7hX5N3DqX',
    difficultyLabel: 'O(1) Instantâneo',
    scannedPercent: 0
  };

  const prizeStr = `${challenge.prize || '1.0'} ${challenge.prizeCurrency || challenge.chain || ''}`.trim();
  const prizeUsd = challenge.roi?.prizeUSD || challenge.prizeUSD || 78000;
  const complexity = challenge.roi?.algorithmType || challenge.difficultyLabel || 'O(1) Instantâneo';
  const filter = challenge.roi?.bip39ChecksumFilter || challenge.algorithmType || 'Cálculo Algébrico O(1)';
  const timeEst = challenge.roi?.formattedFleetTime || challenge.difficultyLabel || 'Instantâneo';
  const scanned = challenge.scannedPercent !== undefined ? challenge.scannedPercent : 0;
  const targetAddress = challenge.targetAddress || '15dTwY2K7XjY83j3eTcxL5LwA7hX5N3DqX';
  const explorerUrl = getExplorerUrl(challenge.chain, targetAddress);

  currentSecondaryTarget = {
    id: challenge.challengeId || challengeId,
    chain: challenge.chain || 'BTC',
    title: challenge.title || challengeId,
    targetAddress: targetAddress,
    explorerUrl: explorerUrl,
    prize: prizeStr,
    prizeUSD: prizeUsd,
    complexity: complexity,
    filter: filter,
    time: timeEst,
    scanned: scanned
  };

  setInner('dashSecTitle', currentSecondaryTarget.title);
  setInner('dashSecPrize', `Prêmio: ${currentSecondaryTarget.prize} (~$${Number(prizeUsd).toLocaleString()} USD)`);
  setInner('dashSecBadgePrize', currentSecondaryTarget.prize);
  setInner('dashSecComplexity', currentSecondaryTarget.complexity);
  setInner('dashSecFilter', currentSecondaryTarget.filter);
  setInner('dashSecTime', currentSecondaryTarget.time);
  setInner('dashSecScanned', `${Number(currentSecondaryTarget.scanned).toFixed(1)}%`);

  const explorerLink = document.getElementById('dashSecExplorerLink');
  if (explorerLink) {
    explorerLink.href = explorerUrl;
  }

  const bar = document.getElementById('dashSecProgressBar');
  if (bar) bar.style.width = `${Math.min(100, Math.max(3, currentSecondaryTarget.scanned))}%`;

  const dropdown = document.getElementById('dashSecChallengeDropdown');
  if (dropdown && dropdown.value !== challengeId) {
    dropdown.value = challengeId;
  }
}

function attackSecondaryTarget() {
  const id = currentSecondaryTarget.id || 'BTC_SATOSHI_NONCE_REUSE';
  const chain = currentSecondaryTarget.chain || 'BTC';
  const title = currentSecondaryTarget.title || id;
  const prize = currentSecondaryTarget.prize || '';
  setMultiChainTarget(chain, id, title, prize);
}

let currentSelectedPruningChallenge = 'BTC_1000_P71';

function changePruningChallenge(challengeId) {
  currentSelectedPruningChallenge = challengeId;
  const select = document.getElementById('pruningChallengeSelect');
  if (select) select.value = challengeId;
  fetchLiveRangesData();
}

// ─── LIVE RANGES & SPACE PRUNING DATA ───
async function fetchLiveRangesData() {
  try {
    const targetChallenge = currentSelectedPruningChallenge || currentActiveChallenge || 'BTC_1000_P71';
    const [recentRes, pruningRes] = await Promise.all([
      fetch('/api/ranges/recent'),
      fetch(`/api/ranges/space-pruning-live?puzzleId=${encodeURIComponent(targetChallenge)}&total=1000`)
    ]);

    const recentData = await recentRes.json();
    const pruningData = await pruningRes.json();

    // Sincroniza dinamicamente o dropdown com todos os desafios retornados pela API
    if (pruningData && pruningData.multiStats) {
      updateDynamicChallengeDropdowns(pruningData.multiStats);

      // Sincroniza progresso de cada card Multi-Chain e do Alvo Secundário
      pruningData.multiStats.forEach(s => {
        const pEl = document.getElementById(`multiProgress_${s.challengeId}`);
        const pBar = document.getElementById(`multiProgressBar_${s.challengeId}`);
        if (pEl) pEl.innerText = `${s.prunedPercent.toFixed(2)}% (${s.scannedChunks}/${s.totalChunks || 1000})`;
        if (pBar) pBar.style.width = `${Math.max(2, Math.min(100, s.prunedPercent))}%`;

        // Se for o alvo secundário selecionado no momento
        if (currentSecondaryTarget && currentSecondaryTarget.id === s.challengeId) {
          currentSecondaryTarget.scanned = s.prunedPercent;
          setInner('dashSecScanned', `${s.prunedPercent.toFixed(2)}%`);
          const secBar = document.getElementById('dashSecProgressBar');
          if (secBar) secBar.style.width = `${Math.max(2, Math.min(100, s.prunedPercent))}%`;
        }
      });
    }

    // 1. Atualiza métricas de Space Pruning
    if (pruningData) {
      const percent = pruningData.prunedPercent || 0;
      const scanned = pruningData.scannedChunks || 0;
      const effectiveScanned = pruningData.effectiveScannedChunks || scanned;
      const total = pruningData.totalChunks || 1000;
      const chalTitle = pruningData.title || targetChallenge;

      setInner('pruningChallengeTitleDisplay', `Space Pruning [${pruningData.chain || 'BTC'}] ${chalTitle}:`);
      setInner('pruningPercentDisplay', `${percent.toFixed(2)}% do espaço podado (${effectiveScanned} de ${total} fatias)`);
      setInner('pruningScannedCount', Number(scanned).toLocaleString());
      setInner('pruningTotalCount', Number(total).toLocaleString() + ' fatias');

      const bar = document.getElementById('pruningProgressBar');
      if (bar) bar.style.width = `${Math.max(2, Math.min(100, percent))}%`;

      if (pruningData.mathStats) {
        const ms = pruningData.mathStats;
        setInner('pruningProbDisplay', `${Number(ms.cumulativeDiscoveryProbability || 0).toFixed(2)}%`);
        setInner('pruningMidpointDisplay', `${Number(ms.midpointTargetChunks || 500).toLocaleString()} fatias`);
        setInner('pruningEta50Display', ms.realisticEta50Formatted || 'Calculando...');
        setInner('pruningEta100Display', ms.maxEta100Formatted || 'Calculando...');
      }

      // 1.1 Renderiza sub-cards de Space Pruning para cada desafio ativo
      const multiGrid = document.getElementById('multiChallengePruningGrid');
      if (multiGrid && pruningData.multiStats) {
        multiGrid.innerHTML = pruningData.multiStats.map(s => {
          const isSelected = s.challengeId === targetChallenge;
          const chainColor = s.chain === 'ETH' ? 'text-blue-400' : s.chain === 'SOL' ? 'text-purple-400' : 'text-amber-400';
          return `
            <div onclick="changePruningChallenge('${s.challengeId}')" class="cursor-pointer p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition border ${isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/5'} space-y-1.5 font-mono text-xs">
              <div class="flex items-center justify-between">
                <span class="font-bold ${chainColor}">[${s.chain}]</span>
                <span class="text-emerald-400 font-bold text-[11px]">${s.prunedPercent.toFixed(1)}%</span>
              </div>
              <div class="text-[10px] text-white font-semibold truncate" title="${s.title}">${s.title}</div>
              <div class="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                <div class="bg-cyan-400 h-full rounded-full" style="width: ${Math.max(4, s.prunedPercent)}%"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 2. Atualiza tabela de ranges recentes varridos (limitado a 10 fatias auditadas)
    const allRanges = recentData.ranges || [];
    const ranges = allRanges.slice(0, 10);
    const tbody = document.getElementById('rangesTableBody');
    setInner('rangesCountDisplay', `${ranges.length} fatias mais recentes auditadas no histórico`);

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
              <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${timeFormatted}</td>
              <td class="py-2.5 px-3 text-amber-400 font-bold whitespace-nowrap">${r.chain || 'BTC'}</td>
              <td class="py-2.5 px-3 text-white font-semibold whitespace-nowrap">${r.challengeId || 'BTC_1000_P71'}</td>
              <td class="py-2.5 px-3 text-cyan-300 font-bold whitespace-nowrap">#${r.chunkIndex !== undefined ? r.chunkIndex : 0}</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px] whitespace-nowrap" title="${r.rangeStart}">0x${(r.rangeStart || '').substring(0, 12)}...</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px] whitespace-nowrap" title="${r.rangeEnd}">0x${(r.rangeEnd || '').substring(0, 12)}...</td>
              <td class="py-2.5 px-3 text-slate-300 max-w-[130px] truncate" title="${r.workerName || 'Colab Node'}">${r.workerName || 'Colab Node'}</td>
              <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
              <td class="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">${r.hashrate || '45.0 GH/s'}</td>
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

    // Painel Financeiro da Casa (15%) e Rateio dos Assinantes (85%)
    if (data.financialSummary) {
      setInner('poolPrizeTotalDisplay', `$${Number(data.financialSummary.poolTotalPrizeUsd || 461500).toLocaleString()} USD`);
      setInner('poolHouseBaseDisplay', `$${Number(data.financialSummary.houseBaseUsd || 69225).toLocaleString()} USD`);
      setInner('poolDistributableDisplay', `$${Number(data.financialSummary.distributableSubscribersPoolUsd || 392275).toLocaleString()} USD`);
      setInner('poolRevertedDisplay', `$${Number(data.financialSummary.revertedSharesAmountUsd || 0).toLocaleString()} USD`);
    }

    if (data.bufferStats) {
      setInner('bufferStatsDisplay', `${data.bufferStats.currentBufferSize} no buffer (${data.bufferStats.totalRowsSent} sincronizados)`);
    }

    // 1. Renderiza Stream de Distinguished Points (DPs) em Tempo Real
    const dpsTbody = document.getElementById('poolLiveDpsBody');
    if (dpsTbody) {
      const dps = data.recentDps || [];
      if (dps.length === 0) {
        dpsTbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500 text-xs">Nenhum Distinguished Point recebido ainda. Nós de mineração ativos enviarão DPs automaticamente.</td></tr>`;
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

    // 2. Renderiza Quadro de Dividendos dos Assinantes (Consolidado por Login)
    const tbody = document.getElementById('poolLeaderboardBody');
    if (tbody) {
      const operators = data.operators || [];
      if (operators.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-500 text-xs">Nenhum operador com shares registradas no momento. Inicie um nó para pontuar na pool.</td></tr>`;
      } else {
        tbody.innerHTML = operators.map(op => {
          const isSub = op.isSubscriberActive && op.subscriptionStatus === 'ACTIVE';
          const subBadge = isSub
            ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">🟢 ASSINATURA ATIVA</span>'
            : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">🔴 INATIVO (Revertido à Casa)</span>';

          const anonId = op.operatorToken && op.operatorToken.length > 12
            ? `${op.operatorToken.substring(0, 8)}...${op.operatorToken.slice(-4)}`
            : op.operatorToken || 'wrk_anon';

          return `
            <tr class="hover:bg-white/5 transition font-mono text-[11px]">
              <td class="py-3 px-3">
                <div class="text-white font-bold">${op.operatorName}</div>
                <div class="text-[10px] text-cyan-400 font-mono">${anonId}</div>
              </td>
              <td class="py-3 px-3">${subBadge}</td>
              <td class="py-3 px-3 font-bold text-cyan-300">${op.activeNodesCount} ${op.activeNodesCount === 1 ? 'nó ativo' : 'nós ativos'}</td>
              <td class="py-3 px-3 text-slate-300">${Number(op.completedChunks || 0).toLocaleString()} fatias</td>
              <td class="py-3 px-3 text-emerald-400 font-bold">${op.totalHashrateFormatted || '45.0 GH/s'}</td>
              <td class="py-3 px-3 font-bold text-amber-300">${Number(op.shares || 0).toLocaleString()} Shares</td>
              <td class="py-3 px-3 font-bold ${isSub ? 'text-emerald-400' : 'text-slate-500'}">${isSub ? op.sharePercent : '0.00%'}</td>
              <td class="py-3 px-3 font-bold ${isSub ? 'text-emerald-300' : 'text-slate-500'} font-mono">
                ${isSub ? `~$${Number(op.projectedPayoutUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD` : '<span class="text-purple-400 text-[10px]">Revertido ao Tesouro</span>'}
              </td>
              <td class="py-3 px-3 text-right text-slate-400">${op.lastSeen ? new Date(op.lastSeen).toLocaleTimeString() : '-'}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (_) {}
}

async function fetchRescueHistory() {
  try {
    const res = await fetch('/api/secure-rescue/history');
    const data = await res.json();
    if (!data.success) return;

    if (data.vaults) {
      if (data.vaults.BTC) setInner('displayVaultBtc', data.vaults.BTC);
      if (data.vaults.ETH) setInner('displayVaultEth', data.vaults.ETH);
      if (data.vaults.SOL) setInner('displayVaultSol', data.vaults.SOL);
    }

    const container = document.getElementById('confirmedRescuesContainer');
    if (!container) return;

    const rescues = data.rescues || [];
    if (rescues.length === 0) {
      container.innerHTML = `
        <div class="flex items-center gap-3 text-slate-400">
          <i data-lucide="shield" class="w-4 h-4 text-emerald-400 shrink-0"></i>
          <span>Nenhum resgate pendente. O túnel privado de resgate automático está armado e pronto para disparar a transferência imediata assim que qualquer nó da frota encontrar uma chave autêntica.</span>
        </div>`;
    } else {
      container.innerHTML = rescues.map(r => `
        <div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 font-mono text-[11px] mb-2">
          <div class="flex items-center justify-between">
            <span class="text-emerald-300 font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>✅ RESGATE PRIVADO EXECUTADO COM SUCESSO</span>
            </span>
            <span class="text-slate-400">${new Date(r.timestamp).toLocaleString()}</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
            <div><span class="text-slate-500">Desafio:</span> <strong class="text-white">${r.challengeId} (${r.chain})</strong></div>
            <div><span class="text-slate-500">Protocolo:</span> <span class="text-cyan-300">${r.protectionProtocol}</span></div>
            <div class="truncate"><span class="text-slate-500">Origem:</span> ${r.targetAddress}</div>
            <div class="truncate"><span class="text-slate-500">Destino (Vault):</span> <span class="text-emerald-400 font-bold">${r.destinationAddress}</span></div>
            <div class="col-span-full truncate"><span class="text-slate-500">Tx Hash / Bundle:</span> <span class="text-amber-400">${r.txHash}</span></div>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (_) {}
}

function calculateSubscriberYield() {
  const ghRate = parseFloat(document.getElementById('calcHardwareSelect')?.value || '18');
  const selectEl = document.getElementById('calcChallengeSelect');
  const selectedOption = selectEl?.options[selectEl.selectedIndex];
  const challengeVal = selectEl?.value || '7.1_BTC';

  let totalPrizeUSD = 461500;
  if (selectedOption && selectedOption.dataset && selectedOption.dataset.usd) {
    totalPrizeUSD = parseFloat(selectedOption.dataset.usd) || 461500;
  } else if (challengeVal === '1.2_BTC' || challengeVal.includes('NONCE')) {
    totalPrizeUSD = 78000;
  } else if (challengeVal === '5.0_ETH' || challengeVal.includes('BIP39')) {
    totalPrizeUSD = 16000;
  } else if (challengeVal === '15.0_SOL' || challengeVal.includes('SOL_VANITY')) {
    totalPrizeUSD = 2700;
  }

  // Dedução da Taxa da Casa (15%) ➔ Pool Líquida dos Assinantes (85%)
  const distributablePoolUSD = totalPrizeUSD * 0.85;

  // Participação estimada assumindo pool de 200 GH/s de nós ativos
  const assumedPoolPower = 200;
  const shareRatio = Math.min(1, ghRate / assumedPoolPower);
  const estimatedLiquidReward = distributablePoolUSD * shareRatio;

  setInner('calcEstimatedReward', `~$${Math.round(estimatedLiquidReward).toLocaleString()} USD (85% Pool • ${(shareRatio * 100).toFixed(1)}%)`);
}

// ─── ANALYST FEED ───
let advisorRecommendations = [];

async function fetchAnalystFeed() {
  try {
    const [feedRes, recRes] = await Promise.all([
      fetch('/api/analyst/feed'),
      fetch('/api/advisor/recommendations?fleetHashrate=42000000000')
    ]);

    const feedData = await feedRes.json();
    const recData = await recRes.json();
    advisorRecommendations = recData.recommendations || [];

    const grid = document.getElementById('analystFeedGrid');
    if (!grid) return;

    const opportunities = [
      ...(feedData.feed || []),
      ...(feedData.pending || [])
    ];

    // Merge with advisor recommendations e ordena do mais fácil/lucrativo ao mais difícil
    const allItems = [
      ...advisorRecommendations.filter(r => r.chain !== 'BTC' || r.puzzleNumber > 160 || r.challengeId === 'BTC_SATOSHI_NONCE_REUSE'),
      ...opportunities
    ];

    allItems.sort((a, b) => {
      const roiA = a.roi ? (a.roi.roi_per_day_usd || 0) : 0;
      const roiB = b.roi ? (b.roi.roi_per_day_usd || 0) : 0;
      return roiB - roiA;
    });

    if (allItems.length === 0) {
      grid.innerHTML = `
        <div class="col-span-2 text-center py-12 text-slate-500">
          <div class="text-4xl mb-3">🔍</div>
          <p class="text-sm">O Radar IA está a varrer oportunidades...</p>
          <p class="text-xs mt-1">Próxima análise automática em breve.</p>
        </div>`;
      return;
    }

    grid.innerHTML = allItems.map(item => {
      const roi = item.roi || {};
      const chain = item.chain || 'BTC';
      const chainColor = chain === 'ETH' ? 'blue' : chain === 'SOL' ? 'emerald' : 'amber';
      const badge = roi.badge === 'TOP_ROI'
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 text-black">⭐ TOP ROI</span>'
        : roi.badge === 'QUICK_WIN'
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">⚡ GANHO RÁPIDO</span>'
          : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-white/10">ATIVO</span>';

      return `
        <div class="glass-panel p-5 rounded-2xl space-y-3 hover:border-amber-500/30 transition border border-white/10">
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-${chainColor}-500/10 text-${chainColor}-400 uppercase">${chain}</span>
                ${badge}
              </div>
              <h4 class="font-bold text-white text-sm leading-snug">${item.title || item.nomeOficial || 'Oportunidade Detectada'}</h4>
            </div>
            <div class="text-right shrink-0">
              <div class="text-xl font-extrabold text-amber-400 font-mono">${item.prize || item.btcPrize || '?'} ${item.prizeCurrency || chain}</div>
              <div class="text-[10px] text-slate-400">~$${Number(roi.prizeUSD || 0).toLocaleString()} USD</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-cypher-950 border border-white/5 font-mono text-xs">
            <div class="p-2 rounded bg-white/5">
              <div class="text-[10px] text-slate-400">Lucro/Dia</div>
              <div class="font-bold text-emerald-400">${roi.roiPerDayFormatted || 'Calculando...'}</div>
            </div>
            <div class="p-2 rounded bg-white/5">
              <div class="text-[10px] text-slate-400">Tempo Frota</div>
              <div class="font-bold text-cyan-300">${roi.formattedFleetTime || 'Estimando...'}</div>
            </div>
          </div>
          <button onclick="setMultiChainTarget('${chain}', '${item.challengeId || item.id || chain}')" class="w-full py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-bold text-xs border border-amber-500/30 transition flex items-center justify-center gap-2">
            <i data-lucide="crosshair" class="w-3.5 h-3.5"></i> Atacar Este Alvo
          </button>
        </div>`;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Erro ao carregar Analyst Feed:', err);
    const grid = document.getElementById('analystFeedGrid');
    if (grid) grid.innerHTML = '<div class="col-span-2 text-center py-8 text-slate-500 text-xs">⚠️ Radar IA temporariamente indisponível. Tentando reconectar...</div>';
  }
}

async function evaluateCustomChallenge() {
  const rawText = prompt('📋 Cole o texto do desafio ou URL do CTF para o Radar IA avaliar:');
  if (!rawText || !rawText.trim()) return;

  showToast('🔍 Enviando para análise do Radar IA...');

  try {
    const res = await fetch('/api/analyst/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: rawText.trim(), fleetHashrate: 42000000000 })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Enigma avaliado e adicionado ao Radar IA!');
      setTimeout(fetchAnalystFeed, 1000);
    } else {
      showToast('⚠️ ' + (data.error || 'Falha na avaliação.'));
    }
  } catch (err) {
    showToast('⚠️ Erro ao conectar com o Radar IA: ' + err.message);
  }
}

// ─── COLAB 1-CLICK LAUNCH (URL pré-preenchida) ───
function openColabWithCode() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const encoded = encodeURIComponent(code);
  window.open(`https://colab.research.google.com/#create=true&code=${encoded}`, '_blank');
  showToast(`🚀 Abrindo Colab para [${currentActiveChain}] ${currentActiveChallenge}!`);
}

// ─── ALIAS COPY HELPER ───
function copyText(text) {
  copyTextToClipboard(text, 'Texto copiado!');
}

// Inicializações periódicas a cada 4 segundos
setInterval(fetchAnalystFeed, 10000);
setInterval(fetchRescueHistory, 10000);
setInterval(fetchPoolStats, 4000);
setInterval(fetchLiveRangesData, 4000);

// Polling inicial de carga
setTimeout(() => {
  fetchAnalystFeed();
  fetchRescueHistory();
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

function updateAdvisorProviderBadge() {
  const select = document.getElementById('advisorProviderSelect');
  const badge = document.getElementById('advisorProviderBadge');
  if (select && badge) {
    badge.innerText = select.value === 'nexus' ? 'Nexus Cérebro 2.0' : 'Google Gemini 2.0';
  }
}

async function sendAdvisorMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('advisorInput');
  const msg = input.value.trim();
  if (!msg) return;

  const provider = document.getElementById('advisorProviderSelect')?.value || 'gemini';

  appendChatMessage('user', msg);
  input.value = '';

  const providerLabel = provider === 'nexus' ? 'Nexus Cérebro' : 'Gemini AI';
  const loadingId = appendChatMessage('ai', `⏳ Consultando ${providerLabel}...`);

  try {
    const res = await fetch('/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, provider })
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

    const tokenDisp = document.getElementById('authUserTokenDisplay');
    const tokenContainer = document.getElementById('authUserTokenContainer');
    if (tokenDisp && currentUser.workerToken) {
      tokenDisp.innerText = currentUser.workerToken;
      tokenDisp.title = currentUser.workerToken;
      if (tokenContainer) tokenContainer.classList.remove('hidden');
    }

    // Atualiza todas as caixas mantendo o alvo ativo
    updateAllTargetCodeBoxes(currentActiveChain, currentActiveChallenge, currentActiveTitle);
  } else {
    if (unauthBox) unauthBox.classList.remove('hidden');
    if (authPill) authPill.classList.add('hidden');
    if (authPill) authPill.classList.remove('flex');
    const tokenContainer = document.getElementById('authUserTokenContainer');
    if (tokenContainer) tokenContainer.classList.add('hidden');
    updateAllTargetCodeBoxes(currentActiveChain, currentActiveChallenge, currentActiveTitle);
  }
  if (window.lucide) window.lucide.createIcons();
}

function copyCurrentUserToken() {
  if (currentUser && currentUser.workerToken) {
    navigator.clipboard.writeText(currentUser.workerToken).then(() => {
      showToast('📋 Token de mineração copiado com sucesso!');
    });
  }
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
    
    const pVal = Number(pulse.activeTarget.scannedPercent || 0).toFixed(2);
    const scannedCh = pulse.activeTarget.scannedChunks || 0;
    const totCh = pulse.activeTarget.totalChunks || 1000;
    setInner('dashTargetScanned', `${pVal}% (${scannedCh}/${totCh} fatias)`);

    const bar = document.getElementById('dashTargetProgressBar');
    if (bar) bar.style.width = `${Math.max(2, Math.min(100, parseFloat(pVal)))}%`;

    if (pulse.activeTarget.mathStats) {
      const ms = pulse.activeTarget.mathStats;
      setInner('dashTargetProb', `${Number(ms.cumulativeDiscoveryProbability || 0).toFixed(2)}%`);
      setInner('dashTargetDpsMeta', `${Number(ms.kangarooDps || 0).toLocaleString()} / ${Number(ms.kangarooTargetDps || 4096).toLocaleString()} DPs`);
      setInner('dashTargetEta50', ms.realisticEta50Formatted || 'Calculando...');
      setInner('dashTargetEta100', ms.maxEta100Formatted || 'Calculando...');
    }
  }

  // Alvo Secundário (Sincronizado 100% com Multi-Chain)
  if (pulse.secondaryTarget) {
    setInner('dashSecTitle', pulse.secondaryTarget.title);
    setInner('dashSecPrize', `Prêmio: ${pulse.secondaryTarget.prize}`);
    if (pulse.secondaryTarget.prize) {
      const pz = pulse.secondaryTarget.prize.split(' ')[0];
      setInner('dashSecBadgePrize', `${pz} ${pulse.secondaryTarget.chain || 'BTC'}`);
    }
    setInner('dashSecComplexity', pulse.secondaryTarget.complexity || 'O(1) Instantâneo');
    setInner('dashSecFilter', pulse.secondaryTarget.bip39ChecksumFilter || 'Cálculo Algébrico O(1)');
    setInner('dashSecTime', pulse.secondaryTarget.estimatedFleetTime || 'Instantâneo');
    
    const secVal = Number(pulse.secondaryTarget.scannedPercent || 0).toFixed(2);
    setInner('dashSecScanned', `${secVal}%`);
    const secBar = document.getElementById('dashSecProgressBar');
    if (secBar) secBar.style.width = `${Math.max(2, Math.min(100, parseFloat(secVal)))}%`;

    const secBtn = document.getElementById('dashSecActionButton');
    if (secBtn) {
      const secChain = pulse.secondaryTarget.chain || 'BTC';
      const secId = pulse.secondaryTarget.id || 'BTC_SATOSHI_NONCE_REUSE';
      const secTitle = (pulse.secondaryTarget.title || '').replace(/'/g, "\\'");
      const secPrize = pulse.secondaryTarget.prize || '';
      secBtn.onclick = () => setMultiChainTarget(secChain, secId, secTitle, secPrize);
    }
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

  // Se for alerta crítico de chave encontrada ou colisão, fixa no topo do terminal
  if (message.includes('CHAVE AUTÊNTICA') || message.includes('COLISÃO KANGAROO') || message.includes('Resgate acionado') || type === 'COLLISION_ALERT') {
    const detailsHtml = `
      <div class="font-bold text-white text-xs mb-1">🎯 Evento Criptográfico em Execução:</div>
      <div class="text-amber-200">${message}</div>
      <div class="text-[10px] text-slate-300 mt-1">Status: <span class="text-emerald-400 font-bold">Roteamento Confidencial para Cold Vault Imutável Ativo</span></div>
    `;
    showDiscoveryBanner('ALERTA CRÍTICO', detailsHtml);
  }

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
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  copyTextToClipboard(code, `📋 Código Colab para [${currentActiveChain}] ${currentActiveChallenge} copiado!`);
}

function copyKaggleOneLiner() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --threads=4 --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  copyTextToClipboard(code, `📋 Código Kaggle para [${currentActiveChain}] ${currentActiveChallenge} copiado!`);
}

function copyLinuxCli() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token=${currentUser.workerToken}` : '';
  const code = `curl -sSL ${origin}/install-worker.sh | bash -s --${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  copyTextToClipboard(code, `Comando Linux para [${currentActiveChain}] ${currentActiveChallenge} copiado!`);
}

function copyCudaKeyhunt() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `./keyhunt -m kangaroo -c 1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU --pool-url="${origin}/api/pool"${token}`;
  copyTextToClipboard(code, 'Parâmetros KeyHunt CUDA copiados!');
}

function copyLocalWorkerCommand() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const cmd = `py -3.12 solver/colab_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  copyTextToClipboard(cmd, `Comando Terminal para [${currentActiveChain}] ${currentActiveChallenge} copiado!`);
}

function downloadWindowsWorkerBat() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken || 'pzk_admin_master_gpu_token';
  const username = currentUser?.username || 'miner-local';
  const workerName = `pc-${username}-${Math.floor(1000 + Math.random() * 9000)}`;
  const url = `${origin}/api/workers/download-bat?token=${encodeURIComponent(token)}&chain=${encodeURIComponent(currentActiveChain)}&challenge=${encodeURIComponent(currentActiveChallenge)}&name=${encodeURIComponent(workerName)}&api=${encodeURIComponent(origin)}`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `start-worker-${currentActiveChain}-${currentActiveChallenge}.bat`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`📥 Minerador Windows (.bat) baixado com Token e ID [${workerName}]!`);
}

function generateColabTargetCommand(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const cmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/colab_worker.py\n!python colab_worker.py --api="${origin}"${token} --chain="BTC" --challenge="BTC_1000_P${num}"`;
  copyTextToClipboard(cmd, `Comando Colab para o Puzzle #${num} copiado!`);
}

// ─── SIMULAÇÃO DE PULSO / DP / CHUNK (PROVA DE CONCEITO AO VIVO) ───
async function triggerSimulatedWorkerStep() {
  showToast('⚡ Disparando simulação de passo e DP ao vivo...');
  try {
    const res = await fetch('/api/pool/simulate-worker-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerToken: currentUser?.workerToken || 'wrk_web_simulator',
        workerName: currentUser?.username || 'Simulador Web GPU',
        challengeId: currentActiveChallenge || 'BTC_1000_P71',
        chain: currentActiveChain || 'BTC'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`💎 DP Simulado: ${data.dpHex.substring(0, 10)}... (+1 Share)`);
      appendTerminalLog('DP_SUBMITTED', `💎 [SIMULAÇÃO DP] Ponto distinguido gerado com sucesso: ${data.dpHex} (Chunk #${data.chunkIndex})`);
      
      // Atualiza painéis imediatamente
      fetchPoolStats();
      fetchLiveRangesData();
    } else {
      appendTerminalLog('COLLISION_ALERT', `⚠️ Falha ao simular pulso: ${data.error || 'Erro desconhecido'}`);
    }
  } catch (err) {
    appendTerminalLog('COLLISION_ALERT', `⚠️ Erro de conexão no simulador: ${err.message}`);
  }
}

// ─── LEARNING LAB SANDBOX BENCHMARK & ANÁLISE IA ───
async function runSandboxBenchmark() {
  const select = document.getElementById('sandboxPuzzleSelect');
  const scenarioId = select ? select.value : '30';
  const btn = document.getElementById('runBenchmarkBtn');
  const statusEl = document.getElementById('sandboxStatus');
  const offsetEl = document.getElementById('sandboxOffset');
  const logsContainer = document.getElementById('sandboxLogs');

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.innerText = 'Executando...';
    statusEl.className = 'text-amber-400 animate-pulse font-bold';
  }

  if (logsContainer) {
    logsContainer.innerHTML = `<div class="text-cyan-400">> [INICIANDO] Calibrando hardware contra o cenário ${scenarioId}...</div>`;
  }

  try {
    const res = await fetch('/api/sandbox/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleNumber: scenarioId, hardware: 'GPU NVIDIA (Benchmark Local)' })
    });
    const data = await res.json();

    if (data.success && data.logs) {
      if (logsContainer) {
        logsContainer.innerHTML = '';
        data.logs.forEach((log, idx) => {
          setTimeout(() => {
            const row = document.createElement('div');
            row.className = log.includes('KEY_INTERSECTION') || log.includes('KEY_RECOVERED') || log.includes('APROVADO') || log.includes('ENTROPY_REDUCTION')
              ? 'text-emerald-400 font-bold'
              : log.includes('RESULT') || log.includes('ADDRESS MATCH')
                ? 'text-amber-300 font-extrabold'
                : 'text-slate-300';
            row.innerText = `> ${log}`;
            logsContainer.appendChild(row);
            const terminal = document.getElementById('sandboxTerminal');
            if (terminal) terminal.scrollTop = terminal.scrollHeight;
          }, idx * 180);
        });
      }

      setTimeout(() => {
        if (statusEl) {
          statusEl.innerText = '✅ 100% Calibrado';
          statusEl.className = 'text-emerald-400 font-bold';
        }
        if (offsetEl) offsetEl.innerText = `${data.targetAddress ? data.targetAddress.substring(0, 10) + '...' : 'Concluído'} (${data.executionTimeMs} ms)`;
        if (btn) btn.disabled = false;
        showToast(`🎯 Calibração do cenário "${data.scenarioName || scenarioId}" concluída com sucesso!`);
        appendTerminalLog('SYSTEM', `🎯 [SANDBOX CALIBRADO] ${data.scenarioName || scenarioId} validado (${data.hashrate || '18.00 GH/s'})`);
      }, (data.logs.length + 1) * 180);
    } else {
      if (statusEl) {
        statusEl.innerText = '⚠️ Erro';
        statusEl.className = 'text-red-400';
      }
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    if (statusEl) {
      statusEl.innerText = '⚠️ Erro de Conexão';
      statusEl.className = 'text-red-400';
    }
    if (btn) btn.disabled = false;
    appendTerminalLog('COLLISION_ALERT', `⚠️ Erro no Sandbox Benchmark: ${err.message}`);
  }
}

async function consultAiOnSandboxScenario() {
  const select = document.getElementById('sandboxPuzzleSelect');
  const scenarioId = select ? select.value : '30';
  const provider = document.getElementById('advisorProviderSelect')?.value || 'gemini';
  const box = document.getElementById('sandboxAiAnalysisBox');
  const titleEl = document.getElementById('sandboxAiTitle');
  const modelTagEl = document.getElementById('sandboxAiModelTag');
  const contentEl = document.getElementById('sandboxAiContent');
  const btn = document.getElementById('consultSandboxAiBtn');

  if (box) box.classList.remove('hidden');
  if (btn) btn.disabled = true;
  if (contentEl) contentEl.innerHTML = '<div class="text-amber-400 animate-pulse">⏳ Consultando a IA sobre a formulação matemática e calibragem do cenário selecionado...</div>';

  try {
    const res = await fetch('/api/sandbox/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId, provider })
    });
    const data = await res.json();

    if (data.success) {
      if (titleEl) titleEl.innerText = `Parecer Criptográfico: ${data.scenario}`;
      if (modelTagEl) modelTagEl.innerText = data.model || (provider === 'nexus' ? 'Nexus Cérebro 2.0' : 'Google Gemini 2.0');
      if (contentEl) {
        // Formata quebras de linha e markdown simples
        contentEl.innerHTML = data.analysis.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      }
      showToast('🧠 Parecer do Consultor IA gerado com sucesso!');
    } else {
      if (contentEl) contentEl.innerText = '⚠️ Não foi possível obter o parecer: ' + (data.error || 'Erro desconhecido');
    }
  } catch (err) {
    if (contentEl) contentEl.innerText = '⚠️ Erro de conexão com o Consultor IA: ' + err.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── PINNED DISCOVERY BANNER (FIXO ATÉ O ADMIN DESCARTAR) ───
function showDiscoveryBanner(title, detailsHtml) {
  const banner = document.getElementById('pinnedDiscoveryBanner');
  const detailsEl = document.getElementById('pinnedDiscoveryDetails');
  if (banner && detailsEl) {
    detailsEl.innerHTML = detailsHtml;
    banner.classList.remove('hidden');
  }
}

function dismissDiscoveryBanner() {
  const banner = document.getElementById('pinnedDiscoveryBanner');
  if (banner) {
    banner.classList.add('hidden');
    showToast('Alerta de descoberta arquivado.');
  }
}
function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

// Inicializa checagem de sessão
checkAuthSession();
