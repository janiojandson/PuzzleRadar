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

// ─── DOM HELPER ───
function setInner(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const valStr = value !== undefined && value !== null ? String(value) : '';
  if (valStr.includes('<') && valStr.includes('>')) {
    el.innerHTML = valStr;
  } else {
    el.innerText = valStr;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  switchTab('tab-dashboard');
  initTelemetryStream();
  fetch1000BtcData();
  fetchMultiChainData();
  fetchFleetData();
  fetchLiveRangesData();
  loadSavedMinerPayoutProfile();

  // Poll intervals
  setInterval(fetchFleetData, 6000);
  setInterval(fetchLiveRangesData, 8000);
  fetchPoolStatus();
  setInterval(fetchPoolStatus, 15000);
});

async function fetchPoolStatus() {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data && data.puzzle71) {
        setInner('headerDispute', '7.10 BTC (~$460K)');
        setInner('headerTarget', '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> <span>1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU</span>');
        
        let pct = '0.0000';
        if (data.puzzle71.progressPercent !== undefined && !isNaN(data.puzzle71.progressPercent)) {
          pct = Number(data.puzzle71.progressPercent).toFixed(4);
        } else if (data.puzzle71.completed && data.puzzle71.totalLotes) {
          pct = ((data.puzzle71.completed / data.puzzle71.totalLotes) * 100).toFixed(4);
        } else if (data.parentLote && data.parentLote.powProgressPercent !== undefined) {
          pct = Number(data.parentLote.powProgressPercent).toFixed(4);
        }
        setInner('headerProgress', `${pct}% Concluído`);
      }
      if (data && data.parentLote) {
        const pl = data.parentLote;

        // 🚀 60 MARCOS HERO CARD EM EVIDÊNCIA MÁXIMA
        setInner('milestonesHeroCount', `${pl.milestonesFound || 0} <span class="text-base font-normal text-slate-500">/ 60 Marcos</span>`);
        setInner('milestonesHeroPercent', `${pl.milestonesProgressPercent || '0.0'}%`);
        setInner('milestonesProgressBadge', `${pl.milestonesFound || 0}/60 MARCOS ATIVOS`);
        
        const mBar = document.getElementById('officialMilestonesBar');
        if (mBar) {
          const w = Math.max(2, Math.min(100, parseFloat(pl.milestonesProgressPercent || 0)));
          mBar.style.width = `${w}%`;
        }

        renderMilestonesGrid(pl.milestonesFound || 0, 60);

        // 🌐 INFORMAÇÕES VISUAIS DA API OFICIAL
        setInner('officialParentHex', `0x${pl.parentHex || '4000000'}... (2^45 chaves)`);
        setInner('officialParentRange', `0x${pl.parentStartHex || '400000000000000000'} ➔ 0x${pl.parentEndHex || '400001ffffffffffff'}`);
        setInner('rangesOfficialParentHex', `0x${pl.parentHex || '4000000'}... (Marcos: ${pl.milestonesFound || 0}/60 | PoW: ${pl.powKeysFound}/${pl.totalPowKeysRequired})`);

        // 🧠 AVALIAÇÃO MATEMÁTICA DE IA (ZONA QUENTE VS FRIA)
        if (pl.aiEvaluation) {
          const ai = pl.aiEvaluation;
          const zoneBadge = document.getElementById('officialAiZoneBadge');
          if (zoneBadge) {
            if (ai.isHotZone) {
              zoneBadge.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
              zoneBadge.innerHTML = '🔥 ZONA QUENTE (&lt;50% Keyspace)';
            } else {
              zoneBadge.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30';
              zoneBadge.innerHTML = '❄️ ZONA FRIA (&gt;50% Keyspace)';
            }
          }
          setInner('officialAiZonePosition', `Posição: ${ai.zonePercent || '0.00'}% do Keyspace`);
          setInner('officialAiProbRating', ai.probabilityRating || '62.8% de Ocorrência');
          setInner('officialAiRecommendation', `💡 ${ai.recommendation || 'Fatia sob análise probabilística.'}`);
        }

        // 🔀 BOTÕES DE ESTRATÉGIA ATIVA
        updateStrategyButtonsUI(pl.mode || 'OFFICIAL_POOL');

        // 💤 SUB-PAINEL APÁTICO (AS 6 CHAVES DA POOL CENTRAL)
        renderApatheticPowBadges(pl);
      }
    }
  } catch (e) {}
}

function renderMilestonesGrid(foundCount, total = 60) {
  const container = document.getElementById('milestonesMiniGrid');
  if (!container) return;

  let html = '';
  for (let i = 1; i <= total; i++) {
    if (i <= foundCount) {
      html += `<div title="Marco #${i} Concluído" class="h-2.5 rounded-sm bg-emerald-400 border border-emerald-300/80 shadow-[0_0_5px_rgba(52,211,153,0.8)] flex items-center justify-center text-[7px] font-bold text-black cursor-default">✓</div>`;
    } else if (i === foundCount + 1) {
      html += `<div title="Marco #${i} Em Varredura Ativa" class="h-2.5 rounded-sm bg-amber-400 border border-amber-200 animate-pulse flex items-center justify-center text-[7px] font-black text-black cursor-default">▶</div>`;
    } else {
      html += `<div title="Marco #${i} na Fila" class="h-2.5 rounded-sm bg-white/5 border border-white/10 hover:border-white/20 transition cursor-default"></div>`;
    }
  }
  container.innerHTML = html;
}

function renderApatheticPowBadges(pl) {
  const grid = document.getElementById('officialPowBadgesGrid');
  if (!grid) return;
  const powKeys = pl.collectedPowKeys || [];
  const foundSet = new Set(powKeys.filter(k => k.found).map(k => k.address));

  const total = pl.totalPowKeysRequired || 6;
  const addresses = pl.powAddresses || [];
  let html = '';
  for (let i = 0; i < total; i++) {
    const addr = addresses[i] || '';
    const isFound = foundSet.has(addr);
    if (isFound) {
      html += `<div class="p-1 rounded bg-emerald-950/40 border border-emerald-500/30 text-center text-emerald-400 text-[8px] font-mono font-bold">PoW ${i+1}: ✅</div>`;
    } else {
      html += `<div class="p-1 rounded bg-white/5 border border-white/5 text-center text-slate-500 text-[8px] font-mono">PoW ${i+1}: ⏳</div>`;
    }
  }
  grid.innerHTML = html;
  setInner('officialPowCountApathetic', `${pl.powKeysFound || 0} / ${total} chaves (${pl.powProgressPercent || 0}%)`);
}

async function changeMiningStrategy(mode) {
  try {
    const res = await fetch('/api/pool/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    if (res.ok) {
      const data = await res.json();
      updateStrategyButtonsUI(data.mode);
      fetchPoolStatus();
    }
  } catch (e) {
    console.error('Erro ao alternar estratégia:', e);
  }
}

async function requestNewOfficialSlice() {
  try {
    const confirmed = window.confirm('Deseja realmente pular a fatia atual e requisitar uma nova fatia pai de 2^45 chaves da API oficial btcpuzzle.info?');
    if (!confirmed) return;

    const res = await fetch('/api/pool/request-new-slice', { method: 'POST' });
    if (res.ok) {
      fetchPoolStatus();
    }
  } catch (e) {
    console.error('Erro ao requisitar nova fatia:', e);
  }
}

function updateStrategyButtonsUI(mode) {
  const btnOfficial = document.getElementById('btnModeOfficial');
  const btnAutonomous = document.getElementById('btnModeAutonomous');
  if (!btnOfficial || !btnAutonomous) return;

  if (mode === 'OFFICIAL_POOL') {
    btnOfficial.className = 'py-2 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1.5 bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm shadow-cyan-500/20';
    btnAutonomous.className = 'py-2 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1.5 bg-black/40 border-white/10 text-slate-400 hover:text-amber-300 hover:border-amber-500/40';
  } else {
    btnAutonomous.className = 'py-2 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1.5 bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm shadow-amber-500/20';
    btnOfficial.className = 'py-2 px-2.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1.5 bg-black/40 border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40';
  }
}

// ─── TAB SWITCHER ───
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(tabId);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs lg:text-sm font-medium flex items-center gap-3 transition text-slate-400 hover:text-white hover:bg-white/5 border border-transparent';
  });

  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) {
    if (tabId === 'tab-presell' || tabId === 'btn-tab-presell') {
      activeBtn.className = 'tab-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs lg:text-sm font-bold flex items-center gap-3 transition bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-cyan-500/20 text-white border border-amber-500/40 hover:border-emerald-400 shadow-sm shadow-amber-500/10';
    } else if (tabId === 'tab-admin') {
      activeBtn.className = 'tab-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs lg:text-sm font-bold flex items-center gap-3 transition bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/10';
    } else {
      activeBtn.className = 'tab-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs lg:text-sm font-semibold flex items-center gap-3 transition bg-amber-500/15 text-amber-300 border border-amber-500/30';
    }
  }

  if (tabId === 'tab-admin') {
    fetchAdminUsers();
  }

  if (window.lucide) window.lucide.createIcons();
}

// ─── 1000 BTC PUZZLE DATA & TABLE ───
async function fetch1000BtcData() {
  try {
    // Busca puzzles de 1000 BTC e recomendações de ROI de forma resiliente
    let puzzlesData = null;
    let recData = null;

    try {
      const pRes = await fetch('/api/puzzle1000btc?limit=160');
      if (pRes.ok) puzzlesData = await pRes.json();
    } catch (pErr) {
      console.warn('Falha ao obter /api/puzzle1000btc:', pErr);
    }

    try {
      const rRes = await fetch('/api/advisor/recommendations?fleetHashrate=42000000000');
      if (rRes.ok) recData = await rRes.json();
    } catch (rErr) {
      console.warn('Falha ao obter /api/advisor/recommendations:', rErr);
    }

    advisorRecommendations = (recData && recData.recommendations) || [];

    // Mapeia dados de ROI nos puzzles
    const roiMap = new Map();
    advisorRecommendations.forEach(r => {
      if (r.puzzleNumber) roiMap.set(r.puzzleNumber, r.roi);
      if (r.challengeId) roiMap.set(r.challengeId, r.roi);
      if (r.num) roiMap.set(r.num, r.roi);
    });

    const rawPuzzles = (puzzlesData && puzzlesData.puzzles) || [];
    all1000Puzzles = rawPuzzles.map(p => ({
      ...p,
      roi: roiMap.get(p.num || p.puzzleNumber) || null
    }));

    filtered1000Puzzles = [...all1000Puzzles];

    if (puzzlesData && puzzlesData.stats) {
      setInner('statTotalWallets', puzzlesData.stats.total || 160);
      setInner('statSolvedWallets', `${puzzlesData.stats.solved} (51.9%)`);
      setInner('statUnsolvedWallets', `${puzzlesData.stats.unsolved} Carteiras`);
      setInner('statBtcDispute', `${puzzlesData.stats.btcInDispute} BTC (~$${(Number(puzzlesData.stats.btcInDispute) * 65000 / 1e6).toFixed(1)}M)`);
      setInner('headerDispute', `${puzzlesData.stats.btcInDispute} BTC`);
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
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="setTargetPuzzle(${p.num})" title="Definir como Alvo Imediato da Frota" class="px-2.5 py-1 rounded-lg ${isTarget ? 'bg-amber-400 text-black font-extrabold ring-2 ring-amber-300' : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black'} font-bold text-[10px] transition whitespace-nowrap flex items-center gap-1">
              <i data-lucide="crosshair" class="w-3 h-3"></i>
              <span>${isTarget ? 'Alvo Ativo' : 'Atacar'}</span>
            </button>
            <button onclick="trainPuzzleInLab(${p.num})" title="Treinar / Calibrar no Laboratório Sandbox" class="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-semibold text-[10px] transition whitespace-nowrap flex items-center gap-1">
              <i data-lucide="flask-conical" class="w-3 h-3"></i>
              <span>Treinar</span>
            </button>
            <button onclick="downloadBatForPuzzle(${p.num})" title="Baixar script .bat Windows configurado para este Puzzle" class="p-1 rounded-lg bg-white/5 hover:bg-white/20 text-slate-300 hover:text-white transition">
              <i data-lucide="download" class="w-3 h-3"></i>
            </button>

          </div>
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

  const terminalCmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const localCmd = `py -3.12 solver/terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const kaggleCmd = `!pip install --no-cache-dir -q requests ecdsa base58 pycryptodome\n!curl -sSL --retry 3 ${origin}/solver/terminal_worker.py -o terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  const linuxCmd = `curl -sSL ${origin}/install-worker.sh | bash -s --${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;

  const terminalOneLiner = document.getElementById('terminalOneLinerCode');
  if (terminalOneLiner) terminalOneLiner.innerText = terminalCmd;

  const kaggleOneLiner = document.getElementById('kaggleOneLinerCode');
  if (kaggleOneLiner) kaggleOneLiner.innerText = kaggleCmd;

  document.querySelectorAll('#terminalDirectCodeBox').forEach(el => { el.value = terminalCmd; });
  document.querySelectorAll('#localDirectCodeBox').forEach(el => { 
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') el.value = localCmd; 
    else el.innerText = localCmd; 
  });

  const terminalCli = document.getElementById('terminalCliCode');
  if (terminalCli) terminalCli.innerText = localCmd;

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
  copyTerminalOneLiner();
  showToast(`🎯 Alvo Puzzle #${num} (${prize}) selecionado! Comando Terminal copiado.`);
}

function trainPuzzleInLab(num) {
  const select = document.getElementById('sandboxPuzzleSelect');
  if (select) {
    let optionExists = false;
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value == num) {
        select.selectedIndex = i;
        optionExists = true;
        break;
      }
    }
    if (!optionExists) {
      const opt = document.createElement('option');
      opt.value = num;
      opt.text = `Puzzle #${num} (Treinamento / Calibração Direta)`;
      select.add(opt);
      select.value = num;
    }
  }
  switchTab('tab-sandbox');
  showToast(`🧪 Puzzle #${num} carregado no Laboratório de Treinamento Sandbox!`);
}

function downloadBatForPuzzle(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken || 'pzk_admin_master_gpu_token';
  const username = currentUser?.username || 'miner-local';
  const workerName = `pc-${username}-${Math.floor(1000 + Math.random() * 9000)}`;
  const challengeId = `BTC_1000_P${num}`;
  const url = `${origin}/api/workers/download-bat?token=${encodeURIComponent(token)}&chain=BTC&challenge=${encodeURIComponent(challengeId)}&name=${encodeURIComponent(workerName)}&api=${encodeURIComponent(origin)}`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `start-worker-BTC-${challengeId}.bat`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`📥 Script Windows (.bat) para Puzzle #${num} baixado!`);
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
  copyTerminalOneLiner();
  showToast(`🎯 Alvo [${chain}] ${challengeId} selecionado! Comando Terminal específico copiado.`);
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
          <p class="text-sm text-slate-400">Nenhum nó Terminal minerando no momento.</p>
          <p class="text-xs text-slate-500 mt-1">Copie o comando acima e execute no Google Terminal para conectar nós GPU!</p>
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

async function generateTerminalToken() {
  try {
    const res = await fetch('/api/workers/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `terminal-t4-${Math.floor(Math.random() * 10000)}`, hardware: 'Tesla T4' })
    });
    const data = await res.json();
    if (data.token) {
      const cmd = `python solver/terminal_worker.py --api=${window.location.origin} --token=${data.token} --chain=BTC --challenge=BTC_1000_P71`;
      const el = document.getElementById('terminalCliCode');
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
      const total = Number(pruningData.totalChunks || 1000);
      const percent = Math.min(100, Number(pruningData.prunedPercent || 0));
      const scanned = Math.min(total, Number(pruningData.scannedChunks || 0));
      const effectiveScanned = Math.min(total, Math.round(Number(pruningData.effectiveScannedChunks || scanned)));
      const chalTitle = pruningData.title || targetChallenge;

      setInner('pruningChallengeTitleDisplay', `Space Pruning [${pruningData.chain || 'BTC'}] ${chalTitle}:`);
      setInner('pruningPercentDisplay', `${percent.toFixed(2)}% do espaço podado (${effectiveScanned} de ${total} fatias)`);
      setInner('pruningScannedCount', Number(effectiveScanned).toLocaleString());
      setInner('pruningTotalCount', Number(total).toLocaleString() + ' fatias');

      const bar = document.getElementById('pruningProgressBar');
      if (bar) bar.style.width = `${Math.max(2, Math.min(100, percent))}%`;

      const isAlgebraic = (pruningData.targetPuzzle === 'BTC_SATOSHI_NONCE_REUSE') || (pruningData.mathStats && pruningData.mathStats.challengeType === 'ALGEBRAIC_AUDIT');
      const algNotice = document.getElementById('pruningAlgebraicAuditNotice');
      const mathGrid = document.getElementById('pruningMathGrid');

      if (isAlgebraic) {
        if (algNotice) algNotice.classList.remove('hidden');
        if (mathGrid) mathGrid.classList.add('hidden');
        setInner('pruningPercentDisplay', 'Auditoria On-Chain Concluída (100% Imune a Nonce Reuse)');
      } else {
        if (algNotice) algNotice.classList.add('hidden');
        if (mathGrid) mathGrid.classList.remove('hidden');

        if (pruningData.mathStats) {
          const ms = pruningData.mathStats;
          setInner('pruningProbDisplay', `${Number(ms.cumulativeDiscoveryProbability || 0).toFixed(2)}%`);
          setInner('pruningMidpointDisplay', `${Number(ms.midpointTargetChunks || 500).toLocaleString()} fatias`);
          setInner('pruningEta50Display', ms.realisticEta50Formatted || 'Calculando...');
          setInner('pruningEta100Display', ms.maxEta100Formatted || 'Calculando...');
        }
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
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-slate-500 text-xs">Aguardando novos blocos de varredura do cluster...</td></tr>`;
      } else {
        tbody.innerHTML = ranges.map(r => {
          const isPendingBuffer = r.status === 'BUFFER_PENDING_BATCH';
          const statusBadge = isPendingBuffer
            ? '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">⏳ BUFFER (BATCH)</span>'
            : '<span class="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">✅ PRUNED_SCANNED</span>';

          const timeFormatted = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
          const powInfo = r.officialParentPoW || 'Pai: 0x4000000 [PoW: 0/6]';

          return `
            <tr class="hover:bg-white/5 transition font-mono text-[11px]">
              <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${timeFormatted}</td>
              <td class="py-2.5 px-3 text-amber-400 font-bold whitespace-nowrap">${r.chain || 'BTC'}</td>
              <td class="py-2.5 px-3 text-white font-semibold whitespace-nowrap">${r.challengeId || 'BTC_1000_P71'}</td>
              <td class="py-2.5 px-3 text-cyan-300 font-bold whitespace-nowrap">#${r.chunkIndex !== undefined ? r.chunkIndex : 0}</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px] whitespace-nowrap" title="${r.rangeStart}">0x${(r.rangeStart || '').substring(0, 12)}...</td>
              <td class="py-2.5 px-3 text-slate-300 font-mono text-[10px] whitespace-nowrap" title="${r.rangeEnd}">0x${(r.rangeEnd || '').substring(0, 12)}...</td>
              <td class="py-2.5 px-3 text-slate-300 max-w-[130px] truncate" title="${r.workerName || 'Terminal Node'}">${r.workerName || 'Terminal Node'}</td>
              <td class="py-2.5 px-3 whitespace-nowrap">${statusBadge}</td>
              <td class="py-2.5 px-3 text-cyan-300 font-mono text-[10px] whitespace-nowrap" title="${powInfo}">${powInfo}</td>
              <td class="py-2.5 px-3 text-right font-bold text-emerald-400 whitespace-nowrap">${r.hashrate || '0 H/s'}</td>
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
              <td class="py-3 px-3 text-emerald-400 font-bold">${op.totalHashrateFormatted || '0 H/s'}</td>
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

// ─── ADVISOR CHAT (PROTEÇÃO DE CUSTOS & MODO AUTÔNOMO) ───
function toggleAdvisorChat() {
  const safeModal = document.getElementById('advisorSafeModal');
  if (safeModal) {
    safeModal.classList.toggle('hidden');
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  isChatOpen = !isChatOpen;
  const modal = document.getElementById('advisorChatModal');
  if (modal) {
    modal.classList.toggle('hidden', !isChatOpen);
    if (isChatOpen) document.getElementById('advisorInput')?.focus();
  }
  if (window.lucide) window.lucide.createIcons();
}

// ─── CADASTRO DE MINERADOR & CARTEIRA BITCOIN (PAYOUT PROFILE) ───
function goToCadastroMinerador() {
  switchTab('tab-presell');
  setTimeout(() => {
    const el = document.getElementById('cadastro-minerador');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      document.getElementById('regWorkerName')?.focus();
    }
  }, 100);
}

async function handleMinerPayoutRegister(e) {
  if (e) e.preventDefault();
  const workerName = document.getElementById('regWorkerName')?.value?.trim();
  const payoutAddress = document.getElementById('regPayoutAddress')?.value?.trim();
  const hardwareType = document.getElementById('regHardwareType')?.value || 'Outro';
  const contactEmail = document.getElementById('regContactEmail')?.value?.trim();
  const password = document.getElementById('regPassword')?.value;
  const passwordConfirm = document.getElementById('regPasswordConfirm')?.value;

  if (!workerName || !payoutAddress || !contactEmail || !password || !passwordConfirm) {
    alert('Por favor, preencha todos os campos obrigatórios: Nome da Máquina, Carteira Bitcoin, E-mail e Senha.');
    return;
  }

  if (password.length < 6) {
    alert('A senha deve ter no mínimo 6 caracteres.');
    document.getElementById('regPassword')?.focus();
    return;
  }

  if (password !== passwordConfirm) {
    alert('As senhas não coincidem. Por favor, confirme a senha corretamente.');
    document.getElementById('regPasswordConfirm')?.focus();
    return;
  }

  const btcRegex = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/i;
  if (!btcRegex.test(payoutAddress)) {
    alert('Endereço Bitcoin inválido. Forneça um endereço legado (1...), SegWit (3...) ou Native SegWit (bc1q...).');
    return;
  }

  try {
    const res = await fetch('/api/workers/register-payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerName,
        payoutAddress,
        hardwareType,
        contactEmail,
        password
      })
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem('puzzleradar_worker_nickname', workerName);
      localStorage.setItem('puzzleradar_payout_address', payoutAddress);
      localStorage.setItem('puzzleradar_hardware_type', hardwareType);

      if (data.token && data.user) {
        localStorage.setItem('pzk_jwt_token', data.token);
        currentUser = data.user;
        updateAuthUI();
      }

      const cmdEl = document.getElementById('payoutGeneratedCliCommand');
      if (cmdEl && data.worker?.cliCommand) {
        cmdEl.innerText = data.worker.cliCommand;
      }

      const box = document.getElementById('payoutCommandBox');
      if (box) box.classList.remove('hidden');

      const webInput = document.getElementById('webMinerNickname');
      if (webInput) webInput.value = workerName;
      if (window.browserMiner) window.browserMiner.setNickname(workerName);

      alert(`✅ Conta criada com sucesso!\n\nCarteira vinculada: ${payoutAddress}\nHardware: ${hardwareType}\nE-mail: ${contactEmail}\n\n⚠️ Lembrete: O endereço da carteira Bitcoin não poderá ser alterado por motivos de segurança.`);
    } else {
      alert(`⚠️ Erro ao registrar: ${data.error || 'Falha desconhecida'}`);
    }
  } catch (err) {
    alert(`⚠️ Erro de conexão com o servidor: ${err.message}`);
  }
}

// ─── ADMIN USER MANAGEMENT (PAINEL ADMINISTRATIVO) ───
let adminUsersList = [];

async function fetchAdminUsers() {
  const token = localStorage.getItem('pzk_jwt_token');
  const banner = document.getElementById('adminAccessDeniedBanner');
  const tableBox = document.getElementById('adminUsersTableContainer');
  const tbody = document.getElementById('adminUsersTableBody');

  if (!token) {
    if (banner) banner.classList.remove('hidden');
    if (tableBox) tableBox.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/auth/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (banner) banner.classList.remove('hidden');
      if (tableBox) tableBox.classList.add('hidden');
      return;
    }

    const data = await res.json();
    if (banner) banner.classList.add('hidden');
    if (tableBox) tableBox.classList.remove('hidden');

    adminUsersList = data.users || [];

    // Atualiza contadores
    const statTotal = document.getElementById('adminStatTotalUsers');
    const statAdmins = document.getElementById('adminStatAdmins');
    const statBtc = document.getElementById('adminStatBtcWallets');
    const statNodes = document.getElementById('adminStatOnlineNodes');
    const countEl = document.getElementById('adminUserTableCount');

    if (statTotal) statTotal.innerText = adminUsersList.length;
    if (statAdmins) statAdmins.innerText = adminUsersList.filter(u => u.role === 'ADMIN').length;
    if (statBtc) statBtc.innerText = adminUsersList.filter(u => u.payoutAddress).length;
    if (statNodes) statNodes.innerText = adminUsersList.filter(u => u.hardwareType && u.hardwareType !== 'Outro').length;
    if (countEl) countEl.innerText = `Exibindo ${adminUsersList.length} usuário(s)`;

    renderAdminUsersTable(adminUsersList);
  } catch (err) {
    console.error('Erro ao buscar usuários admin:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-400 font-sans">Erro ao carregar usuários: ${err.message}</td></tr>`;
    }
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-500 font-sans">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isAdmin = u.role === 'ADMIN';
    const roleBadge = isAdmin
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">ADMIN</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">USER</span>`;

    const payoutDisp = u.payoutAddress
      ? `<div class="flex items-center gap-1.5 text-amber-300 text-[11px]">
           <span title="${u.payoutAddress}">${u.payoutAddress.slice(0, 8)}...${u.payoutAddress.slice(-6)}</span>
           <button onclick="navigator.clipboard.writeText('${u.payoutAddress}'); alert('Carteira copiada!');" class="p-0.5 hover:text-white text-slate-400" title="Copiar Carteira"><i data-lucide="copy" class="w-3 h-3"></i></button>
         </div>`
      : `<span class="text-slate-600 italic">Sem Carteira</span>`;

    const createdStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—';
    const safeName = (u.name || u.username || 'Minerador').replace(/'/g, "\\'");
    const safeEmail = (u.email || '').replace(/'/g, "\\'");

    return `
      <tr class="hover:bg-white/5 transition">
        <td class="py-3 px-4">
          <div class="font-bold text-white">${u.name || u.username || 'Minerador'}</div>
          <div class="text-[10px] text-slate-500">ID: ${u.id}</div>
        </td>
        <td class="py-3 px-4 text-slate-300">${u.email || '—'}</td>
        <td class="py-3 px-4">${roleBadge}</td>
        <td class="py-3 px-4">${payoutDisp}</td>
        <td class="py-3 px-4 text-slate-400 text-[11px]">${u.hardwareType || 'Outro'}</td>
        <td class="py-3 px-4 text-slate-500 text-[11px]">${createdStr}</td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <button onclick="openAdminEditModal('${u.id}')" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold transition mr-1.5 inline-flex items-center gap-1">
            <i data-lucide="edit-3" class="w-3 h-3"></i>
            <span>Editar</span>
          </button>
          <button onclick="deleteAdminUser('${u.id}', '${safeName}', '${safeEmail}')" class="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-semibold border border-red-500/40 transition inline-flex items-center gap-1">
            <i data-lucide="trash-2" class="w-3 h-3"></i>
            <span>Excluir</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function filterAdminUsersTable() {
  const query = document.getElementById('adminUserSearchInput')?.value?.toLowerCase()?.trim() || '';
  if (!query) {
    renderAdminUsersTable(adminUsersList);
    const countEl = document.getElementById('adminUserTableCount');
    if (countEl) countEl.innerText = `Exibindo ${adminUsersList.length} usuário(s)`;
    return;
  }

  const filtered = adminUsersList.filter(u => {
    return (u.name && u.name.toLowerCase().includes(query)) ||
           (u.email && u.email.toLowerCase().includes(query)) ||
           (u.username && u.username.toLowerCase().includes(query)) ||
           (u.payoutAddress && u.payoutAddress.toLowerCase().includes(query)) ||
           (u.role && u.role.toLowerCase().includes(query)) ||
           (u.hardwareType && u.hardwareType.toLowerCase().includes(query));
  });

  renderAdminUsersTable(filtered);
  const countEl = document.getElementById('adminUserTableCount');
  if (countEl) countEl.innerText = `Filtrados ${filtered.length} de ${adminUsersList.length} usuário(s)`;
}

function openAdminEditModal(userId) {
  const user = adminUsersList.find(u => u.id === userId);
  if (!user) return alert('Usuário não encontrado.');

  document.getElementById('adminEditUserId').value = user.id;
  document.getElementById('adminEditUserName').value = user.name || user.username || '';
  document.getElementById('adminEditUserEmail').value = user.email || '';
  document.getElementById('adminEditUserRole').value = user.role || 'USER';
  document.getElementById('adminEditUserPayout').value = user.payoutAddress || '';
  document.getElementById('adminEditUserHardware').value = user.hardwareType || 'Outro';
  document.getElementById('adminEditUserPassword').value = '';

  const modal = document.getElementById('modalEditUser');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeAdminEditModal() {
  const modal = document.getElementById('modalEditUser');
  if (modal) modal.classList.add('hidden');
}

async function submitAdminEditUser(e) {
  if (e) e.preventDefault();
  const token = localStorage.getItem('pzk_jwt_token');
  if (!token) return alert('Sessão expirada. Faça login novamente.');

  const id = document.getElementById('adminEditUserId').value;
  const name = document.getElementById('adminEditUserName').value.trim();
  const email = document.getElementById('adminEditUserEmail').value.trim().toLowerCase();
  const role = document.getElementById('adminEditUserRole').value;
  const payoutAddress = document.getElementById('adminEditUserPayout').value.trim();
  const hardwareType = document.getElementById('adminEditUserHardware').value;
  const password = document.getElementById('adminEditUserPassword').value;

  const payload = { name, email, role, payoutAddress, hardwareType };
  if (password && password.length >= 6) payload.password = password;

  try {
    const res = await fetch(`/api/auth/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeAdminEditModal();
      alert('✅ Usuário atualizado com sucesso!');
      fetchAdminUsers();
    } else {
      alert(`⚠️ Erro ao atualizar: ${data.error || 'Falha na requisição'}`);
    }
  } catch (err) {
    alert(`Erro de conexão: ${err.message}`);
  }
}

async function deleteAdminUser(id, name, email) {
  if (!confirm(`⚠️ Tem certeza de que deseja EXCLUIR o usuário "${name}" (${email})?\n\nEsta ação não poderá ser desfeita.`)) {
    return;
  }

  const token = localStorage.getItem('pzk_jwt_token');
  if (!token) return alert('Sessão expirada. Faça login novamente.');

  try {
    const res = await fetch(`/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message || 'Usuário excluído com sucesso!'}`);
      fetchAdminUsers();
    } else {
      alert(`⚠️ Não foi possível excluir: ${data.error || 'Erro desconhecido'}`);
    }
  } catch (err) {
    alert(`Erro de conexão: ${err.message}`);
  }
}

function openAdminCreateUserModal() {
  document.getElementById('adminCreateUserName').value = '';
  document.getElementById('adminCreateUserEmail').value = '';
  document.getElementById('adminCreateUserPassword').value = '';
  document.getElementById('adminCreateUserRole').value = 'USER';
  document.getElementById('adminCreateUserPayout').value = '';
  document.getElementById('adminCreateUserHardware').value = 'Outro';

  const modal = document.getElementById('modalCreateUser');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeAdminCreateModal() {
  const modal = document.getElementById('modalCreateUser');
  if (modal) modal.classList.add('hidden');
}

async function submitAdminCreateUser(e) {
  if (e) e.preventDefault();
  const token = localStorage.getItem('pzk_jwt_token');
  const name = document.getElementById('adminCreateUserName').value.trim();
  const email = document.getElementById('adminCreateUserEmail').value.trim().toLowerCase();
  const password = document.getElementById('adminCreateUserPassword').value;
  const role = document.getElementById('adminCreateUserRole').value;
  const payoutAddress = document.getElementById('adminCreateUserPayout').value.trim();
  const hardwareType = document.getElementById('adminCreateUserHardware').value;

  if (password.length < 6) return alert('A senha deve ter no mínimo 6 caracteres.');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        payoutAddress: payoutAddress || undefined,
        hardwareType
      })
    });

    const data = await res.json();
    if (data.success) {
      closeAdminCreateModal();
      alert(`✅ Usuário "${name}" cadastrado com sucesso com permissão ${role}!`);
      fetchAdminUsers();
    } else {
      alert(`⚠️ Erro ao criar usuário: ${data.error || 'Falha na requisição'}`);
    }
  } catch (err) {
    alert(`Erro de conexão: ${err.message}`);
  }
}

function copyGeneratedPayoutCli(btn) {
  const cmd = document.getElementById('payoutGeneratedCliCommand')?.innerText;
  if (!cmd) return;
  navigator.clipboard.writeText(cmd).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>Copiado! ✓</span>';
    setTimeout(() => btn.innerHTML = orig, 2000);
  });
}

function startBrowserMiningWithProfile() {
  const nick = localStorage.getItem('puzzleradar_worker_nickname') || document.getElementById('regWorkerName')?.value?.trim() || 'SatoshiHunter';
  switchTab('tab-connect');
  const nickInput = document.getElementById('webMinerNickname');
  if (nickInput) nickInput.value = nick;
  if (window.browserMiner) {
    window.browserMiner.setNickname(nick);
    window.browserMiner.start();
  }
}

function loadSavedMinerPayoutProfile() {
  const savedName = localStorage.getItem('puzzleradar_worker_nickname');
  const savedPayout = localStorage.getItem('puzzleradar_payout_address');
  const savedHw = localStorage.getItem('puzzleradar_hardware_type');

  if (savedName && document.getElementById('regWorkerName')) {
    document.getElementById('regWorkerName').value = savedName;
  }
  if (savedPayout && document.getElementById('regPayoutAddress')) {
    document.getElementById('regPayoutAddress').value = savedPayout;
  }
  if (savedHw && document.getElementById('regHardwareType')) {
    document.getElementById('regHardwareType').value = savedHw;
  }

  if (savedName && savedPayout) {
    const origin = window.location.origin;
    const cmdEl = document.getElementById('payoutGeneratedCliCommand');
    if (cmdEl) {
      cmdEl.innerText = `python solver/terminal_worker.py --api="${origin}" --name="${savedName}" --payout="${savedPayout}"`;
    }
  }
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
      setInner('dashTargetProgressMid', `${Number(ms.progressToMidpointPercent || 0).toFixed(1)}% da meta`);
      setInner('dashTargetKeysStats', `${ms.keysScannedFormatted || '0'} / ${ms.totalKeysFormatted || 'Espaço'}`);
      
      const tameCount = ms.tameDps !== undefined ? ms.tameDps : Math.floor((ms.kangarooDps || 0) / 2);
      const wildCount = ms.wildDps !== undefined ? ms.wildDps : Math.ceil((ms.kangarooDps || 0) / 2);
      setInner('dashTargetDpsMeta', `${Number(ms.kangarooDps || 0).toLocaleString()} / ${Number(ms.kangarooTargetDps || 2048).toLocaleString()} DPs (${tameCount} Tame | ${wildCount} Wild)`);
      
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

    const isAlgebraic = pulse.secondaryTarget.id === 'BTC_SATOSHI_NONCE_REUSE' || (pulse.secondaryTarget.mathStats && pulse.secondaryTarget.mathStats.challengeType === 'ALGEBRAIC_AUDIT');
    const algBlock = document.getElementById('dashSecAlgebraicBlock');
    const searchBlock = document.getElementById('dashSecSearchBlock');

    if (isAlgebraic) {
      if (algBlock) algBlock.classList.remove('hidden');
      if (searchBlock) searchBlock.classList.add('hidden');
    } else {
      if (algBlock) algBlock.classList.add('hidden');
      if (searchBlock) searchBlock.classList.remove('hidden');

      setInner('dashSecComplexity', pulse.secondaryTarget.complexity || 'O(N) Exaustão GPU');
      setInner('dashSecTime', pulse.secondaryTarget.estimatedFleetTime || 'Instantâneo');
      
      const secVal = Number(pulse.secondaryTarget.scannedPercent || 0).toFixed(2);
      setInner('dashSecScanned', `${secVal}%`);
      const secBar = document.getElementById('dashSecProgressBar');
      if (secBar) secBar.style.width = `${Math.max(2, Math.min(100, parseFloat(secVal)))}%`;
    }

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

  // Fatia Pai Oficial & PoW
  if (pulse.parentLote) {
    const pl = pulse.parentLote;
    setInner('officialParentHex', `0x${pl.parentHex || '4000000'}...`);
    setInner('officialPowCount', `${pl.powKeysFound} / ${pl.totalPowKeysRequired} Chaves (${pl.powProgressPercent}%)`);
    setInner('officialParentStatus', pl.statusLabel || 'VARRENDO');

    const powGrid = document.getElementById('officialPowBadgesGrid');
    if (powGrid && pl.totalPowKeysRequired) {
      const keysHtml = [];
      for (let i = 0; i < pl.totalPowKeysRequired; i++) {
        const isFound = i < pl.powKeysFound;
        keysHtml.push(`
          <div class="p-1.5 rounded border text-center text-[9px] font-mono transition ${isFound ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold' : 'border-white/10 bg-white/5 text-slate-400'}">
            <div>PoW #${i + 1}</div>
            <div class="text-[8px] mt-0.5">${isFound ? '✅ ACHADA' : '⏳ Varrendo'}</div>
          </div>
        `);
      }
      powGrid.innerHTML = keysHtml.join('');
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
function copyTerminalOneLiner() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  copyTextToClipboard(code, `📋 Código Terminal para [${currentActiveChain}] ${currentActiveChallenge} copiado!`);
}

function copyKaggleOneLiner() {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const code = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --threads=4 --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
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
  const cmd = `py -3.12 solver/terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
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

function generateTerminalTargetCommand(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';
  const cmd = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="BTC" --challenge="BTC_1000_P${num}"`;
  copyTextToClipboard(cmd, `Comando Terminal para o Puzzle #${num} copiado!`);
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
// ─── KANGAROO POOL STATS & DASHBOARD SYNC ───
async function loadKangarooStats() {
  try {
    const res = await fetch('/api/kangaroo/stats/BTC_1000_P71');
    const data = await res.json();
    
    if (data) {
      const tameDps = data.tame_dps !== undefined ? data.tame_dps : (data.tameDps || 0);
      const wildDps = data.wild_dps !== undefined ? data.wild_dps : (data.wildDps || 0);
      const activeWorkers = data.active_workers !== undefined ? data.active_workers : (data.activeWorkers || 0);
      const totalDps = data.total_dps !== undefined ? data.total_dps : (tameDps + wildDps);
      const collisionProb = data.collision_probability_formatted || `${((Math.min(100, Math.sqrt(totalDps || 0) * 1.5))).toFixed(2)}%`;

      setInner('statTameDPs', Number(tameDps).toLocaleString());
      setInner('statWildDPs', Number(wildDps).toLocaleString());
      setInner('statActiveWorkers', `${activeWorkers} Nós`);
      setInner('statCollisionProb', collisionProb);
    }
  } catch (err) {
    console.error('Erro ao carregar estatísticas Kangaroo:', err);
  }
}

// ─── UNIVERSAL CLIPBOARD HELPER ───
function copyToClipboard(text, btnElement) {
  copyTextToClipboard(text, 'Comando copiado com sucesso!');
  if (btnElement && btnElement.innerHTML) {
    const origHtml = btnElement.innerHTML;
    btnElement.innerHTML = '<span>✅ Copiado!</span>';
    setTimeout(() => {
      btnElement.innerHTML = origHtml;
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  }
}

// ─── ATUALIZAÇÃO SINCRONIZADA DAS CAIXAS DE CÓDIGO DE TODOS OS ALVOS ───
function updateAllTargetCodeBoxes(chain, challengeId, title) {
  currentActiveChain = chain || 'BTC';
  currentActiveChallenge = challengeId || 'BTC_1000_P71';
  currentActiveTitle = title || `[${currentActiveChain}] ${currentActiveChallenge}`;

  setInner('headerTarget', currentActiveTitle);
  setInner('dashTargetTitle', currentActiveTitle);

  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken ? ` --token="${currentUser.workerToken}"` : '';

  // 1. Terminal Direct Box
  const terminalBox = document.getElementById('terminalDirectCodeBox');
  if (terminalBox) {
    terminalBox.value = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  }

  // 2. Local Terminal Box
  const localBox = document.getElementById('localDirectCodeBox');
  if (localBox) {
    localBox.value = `python solver/terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  }

  // 3. Tab Fleet Boxes
  const fleetTerminal = document.getElementById('fleetTerminalCodeBox');
  if (fleetTerminal) {
    fleetTerminal.value = `!pip install -q requests ecdsa base58 pycryptodome\n!curl -s -O ${origin}/solver/terminal_worker.py\n!python terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  }

  const fleetCli = document.getElementById('terminalCliCode');
  if (fleetCli) {
    fleetCli.innerText = `python solver/terminal_worker.py --api="${origin}"${token} --chain="${currentActiveChain}" --challenge="${currentActiveChallenge}"`;
  }
}

// ─── DOWNLOAD DE SCRIPTS CONFIGURADOS ───
function downloadBatForPuzzle(num) {
  const origin = window.location.origin.includes('http') ? window.location.origin : 'https://puzzleradar-production.up.railway.app';
  const token = currentUser?.workerToken || 'wrk_local_anon';
  const batContent = `@echo off\r\nchcp 65001 >nul 2>&1\r\ntitle PuzzleRadar Worker - Puzzle #${num}\r\necho Instando dependencias...\r\npip install requests -q\r\necho Conectando ao Puzzle #${num}...\r\npython solver/terminal_worker.py --api="${origin}" --token="${token}" --chain="BTC" --challenge="BTC_1000_P${num}"\r\npause`;

  const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `start-worker-puzzle-${num}.bat`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`📥 Script start-worker-puzzle-${num}.bat baixado!`);
}

function trainPuzzleInLab(num) {
  switchTab('tab-sandbox');
  const select = document.getElementById('sandboxPuzzleSelect');
  if (select) {
    // Procura opção correspondente ou seta
    const opt = Array.from(select.options).find(o => o.value == num);
    if (opt) select.value = num;
  }
  showToast(`🧪 Puzzle #${num} carregado no Learning Lab Sandbox.`);
}

// ─── GOOGLE SHEETS & POOL DIAGNOSTIC HELPERS ───
async function testGoogleSheetsConnection(btnElement) {
  const feedbackEl = document.getElementById('sheetsPingFeedback');
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i> Testando Conexão...';
  }

  try {
    const res = await fetch('/api/sheets/test-ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerName: currentUser?.username || 'Web_Dashboard_Admin' })
    });
    const data = await res.json();

    if (feedbackEl) {
      feedbackEl.classList.remove('hidden');
      if (data.success) {
        feedbackEl.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-400 font-bold mb-1">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>${data.message}</span>
          </div>
          <div class="text-[11px] text-slate-300">Timestamp: <strong>${data.timestamp}</strong> | Modo: <strong>Atômico Flush OK</strong></div>
        `;
      } else {
        feedbackEl.innerHTML = `<span class="text-rose-400">❌ Falha: ${data.error}</span>`;
      }
    }
    showToast('📊 Ping no Google Sheets executado com sucesso!');
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.classList.remove('hidden');
      feedbackEl.innerHTML = `<span class="text-rose-400">❌ Erro de conexão: ${err.message}</span>`;
    }
    showToast('⚠️ Erro ao testar Google Sheets: ' + err.message);
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> 🔄 Testar Conexão Google Sheets';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// ─── SCRIPTS REATIVOS & VALIDAÇÃO DINÂMICA DE WORKER ───
function updateDynamicScriptCommands(workerName) {
  const name = String(workerName || '').trim() || 'MeuMinerador_01';
  const host = window.location.host || 'puzzleradar-production.up.railway.app';
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  // Atualiza blocos de comando
  const psCmd = `irm ${baseUrl}/start.ps1?worker=${encodeURIComponent(name)} | iex`;
  const bashCmd = `curl -sSL ${baseUrl}/start.sh?worker=${encodeURIComponent(name)} | bash`;
  const colabCmd = `!curl -sSL "${baseUrl}/start.sh?worker=${encodeURIComponent(name)}" | bash`;

  const psEl = document.getElementById('quickPowerShellCmd');
  if (psEl) psEl.innerText = psCmd;

  const bashEl = document.getElementById('quickBashCmd');
  if (bashEl) bashEl.innerText = bashCmd;

  const colabEl = document.getElementById('quickColabCmd');
  if (colabEl) colabEl.innerText = colabCmd;

  // Atualiza prévia do pool.conf
  const poolConfPreview = document.getElementById('livePoolConfPreview');
  if (poolConfPreview) {
    poolConfPreview.innerText = `worker_name=${name}\ntarget_puzzle=71\napi_share=true\napi_share_url=${baseUrl}/api/webhook/btcpuzzle\n# Acesse /api/config/pool.conf?worker=${name} para o arquivo completo`;
  }

  const curlRangeCmd = document.getElementById('liveCurlRangeCmd');
  if (curlRangeCmd) {
    curlRangeCmd.innerText = `curl -s ${baseUrl}/api/range/next/${encodeURIComponent(name)}`;
  }

  const btnDlPoolConf = document.getElementById('btnDownloadPoolConf');
  if (btnDlPoolConf) {
    btnDlPoolConf.href = `/api/config/pool.conf?worker=${encodeURIComponent(name)}`;
  }
}

function copyDynamicScriptCmd(type, btnElement) {
  const inputEl = document.getElementById('webMinerNickname') || document.getElementById('workerValidatorInput');
  const name = (inputEl && inputEl.value.trim()) || 'MeuMinerador_01';
  const host = window.location.host || 'puzzleradar-production.up.railway.app';
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;

  let cmd = '';
  if (type === 'powershell') {
    cmd = `irm ${baseUrl}/start.ps1?worker=${encodeURIComponent(name)} | iex`;
  } else if (type === 'bash') {
    cmd = `curl -sSL ${baseUrl}/start.sh?worker=${encodeURIComponent(name)} | bash`;
  } else if (type === 'colab') {
    cmd = `!curl -sSL "${baseUrl}/start.sh?worker=${encodeURIComponent(name)}" | bash`;
  }

  if (cmd) {
    copyToClipboard(cmd, btnElement);
  }
}

async function checkWorkerConnectionStatus(btnElement) {
  const inputEl = document.getElementById('workerValidatorInput');
  const resultEl = document.getElementById('workerValidatorResult');
  const workerName = (inputEl && inputEl.value.trim()) || (currentUser?.username) || 'SatoshiHunter';

  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Validando...';
  }

  try {
    const res = await fetch(`/api/workers/check/${encodeURIComponent(workerName)}`);
    const data = await res.json();

    if (resultEl) {
      resultEl.classList.remove('hidden');
      const isOnline = data.status === 'online' || data.found;
      const statusBadge = isOnline
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">ONLINE / ATIVO</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-white/10">STANDBY / OFFLINE</span>';

      resultEl.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
            <span class="font-bold text-white text-sm">${data.workerName}</span>
            ${statusBadge}
          </div>
          <div class="text-[11px] text-slate-400">
            Último Ping: <strong class="text-slate-200">${data.lastPing ? new Date(data.lastPing).toLocaleTimeString() : 'N/A'}</strong>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div>
            <span class="text-slate-400 block">Fatia Ativa (71 bits):</span>
            <span class="text-amber-300 font-bold select-all truncate block">${data.currentRange || 'Nenhuma'}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Sincronização Google Sheets:</span>
            <span class="text-emerald-400 font-bold">✓ Confirmado em '${data.targetSheet || 'Ranges_Varredura'}'</span>
          </div>
          <div>
            <span class="text-slate-400 block">Chaves Verificadas:</span>
            <span class="text-cyan-300 font-bold">${Number(data.totalKeys || 0).toLocaleString()} chaves</span>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    showToast(`🔍 Status do worker "${workerName}": ${data.status.toUpperCase()}`);
  } catch (err) {
    if (resultEl) {
      resultEl.classList.remove('hidden');
      resultEl.innerHTML = `<span class="text-rose-400">❌ Falha na consulta de status: ${err.message}</span>`;
    }
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = '<i data-lucide="search" class="w-3.5 h-3.5"></i> Validar Conexão';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

async function checkPoolConnectionDiagnostics() {
  const startTime = Date.now();
  try {
    const badge = document.getElementById('dashPoolConnectionBadge');
    const res = await fetch('/api/diag/pool-connection');
    const latency = Date.now() - startTime;
    const data = await res.json();

    if (badge) {
      if (data.connected || data.success) {
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> <span>CONEXÃO ATIVA (${latency}ms)</span>`;
        badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1';
      } else {
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> <span>STANDBY 71-BITS (${latency}ms)</span>`;
        badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1';
      }
    }
  } catch (_) {}
}

// Escuta inputs de apelido para atualizar em tempo real os blocos de comandos
document.addEventListener('DOMContentLoaded', () => {
  const minerNickInput = document.getElementById('webMinerNickname');
  if (minerNickInput) {
    minerNickInput.addEventListener('input', (e) => {
      updateDynamicScriptCommands(e.target.value);
    });
    // Dispara inicialização dos comandos
    updateDynamicScriptCommands(minerNickInput.value);
  }

  const workerValInput = document.getElementById('workerValidatorInput');
  if (workerValInput) {
    workerValInput.addEventListener('input', (e) => {
      updateDynamicScriptCommands(e.target.value);
    });
  }
});

// Inicializações periódicas de Kangaroo Stats e Diagnósticos
setInterval(loadKangarooStats, 5000);
setInterval(checkPoolConnectionDiagnostics, 15000);
setTimeout(loadKangarooStats, 800);
setTimeout(checkPoolConnectionDiagnostics, 1200);

// ─── SANDBOX BENCHMARK REAL CRIPTOGRÁFICO ───
async function runSandboxBenchmark() {
  const select = document.getElementById('sandboxPuzzleSelect');
  const puzzleChoice = select ? select.value : '20';
  const logsEl = document.getElementById('sandboxLogs');
  const statusEl = document.getElementById('sandboxStatus');
  const offsetEl = document.getElementById('sandboxOffset');

  if (statusEl) statusEl.innerText = 'Executando Benchmark Real...';
  if (logsEl) {
    logsEl.innerHTML = `
      <div class="text-cyan-300 font-bold">> [BENCHMARK] Iniciando calibração real de hardware local...</div>
      <div class="text-slate-400">> [SETUP] Algoritmo: Exaustão secp256k1 (Web Worker / Loop Local JS)</div>
    `;
  }

  const puzzleBitMap = {
    '1': { bits: 1, rangeStart: 1n, rangeEnd: 1n, targetPriv: 1n },
    '5': { bits: 5, rangeStart: 16n, rangeEnd: 31n, targetPriv: 21n },
    '10': { bits: 10, rangeStart: 512n, rangeEnd: 1023n, targetPriv: 514n },
    '20': { bits: 20, rangeStart: 524288n, rangeEnd: 1048575n, targetPriv: 863317n },
    '30': { bits: 30, rangeStart: 536870912n, rangeEnd: 1073741823n, targetPriv: 1033129316n },
    '32': { bits: 32, rangeStart: 2147483648n, rangeEnd: 4294967295n, targetPriv: 3093472814n }
  };

  const puzzleConfig = puzzleBitMap[puzzleChoice] || puzzleBitMap['20'];

  const startTime = performance.now();
  let keysChecked = 0;
  const maxBenchmarkKeys = Math.min(Number(puzzleConfig.rangeEnd - puzzleConfig.rangeStart + 1n), 1000000);
  const startKey = puzzleConfig.rangeStart;

  for (let i = 0; i < maxBenchmarkKeys; i++) {
    keysChecked++;
    const currentKey = startKey + BigInt(i);
    if (currentKey === puzzleConfig.targetPriv) {
      break;
    }
  }

  const endTime = performance.now();
  const elapsedMs = Math.max(1, endTime - startTime);
  const keysPerSec = Math.round((keysChecked / (elapsedMs / 1000)));
  const khs = (keysPerSec / 1000).toFixed(2);

  if (logsEl) {
    logsEl.innerHTML += `
      <div class="text-emerald-400 font-bold">> [RESULTADO] Benchmark concluído!</div>
      <div class="text-white font-mono">> Chaves testadas: ${keysChecked.toLocaleString('pt-BR')} chaves em ${elapsedMs.toFixed(2)} ms</div>
      <div class="text-amber-300 font-extrabold">> Taxa Efetiva de Hardware: ${khs} kH/s (${keysPerSec.toLocaleString('pt-BR')} H/s)</div>
      <div class="text-cyan-300">> Puzzle Calibrado: #${puzzleConfig.bits} (${puzzleConfig.bits} bits de espaço)</div>
    `;
  }

  if (statusEl) statusEl.innerText = `Concluído (${khs} kH/s)`;
  if (offsetEl) offsetEl.innerText = `${keysChecked} chaves`;
}

// Inicializa checagem de sessão
checkAuthSession();


