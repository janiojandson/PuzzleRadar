// ============================================
// 🧩 PuzzleRadar v3.0 — Frontend Application Logic (Completo)
// ============================================

let currentTab = 'tab-fleet';
let currentToken = 'wrk_crowdsource_demo';
let allPuzzlesData = [];
let isChatOpen = false;
let puzzleDebounceTimer = null;
let currentPuzzlePage = 1;

// ─── INICIALIZAÇÃO ───
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) window.lucide.createIcons();

  switchTab('tab-fleet');
  fetchActiveWorkers();
  fetchFleetNodes();
  fetchDiscoveries();
  fetchSolvers();
  fetchPaginatedPuzzles(1);
  fetchSheetsStats();

  setInterval(fetchActiveWorkers, 5000);
  setInterval(fetchFleetNodes, 8000);
});

// ─── TAB SWITCHER ───
function switchTab(tabId) {
  currentTab = tabId;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const activeEl = document.getElementById(tabId);
  if (activeEl) activeEl.classList.remove('hidden');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.className = 'tab-btn px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition text-slate-400 hover:text-white hover:bg-white/5';
  });

  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) {
    activeBtn.className = 'tab-btn px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition bg-white/10 text-white border border-white/10';
  }

  if (window.lucide) window.lucide.createIcons();
}

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

  const loadingId = appendChatMessage('ai', '⏳ Analisando...');

  try {
    const res = await fetch('/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: {
          totalHashrate: document.getElementById('headerHashrate')?.innerText || '0 GH/s',
          activeWorkers: document.getElementById('headerWorkers')?.innerText || '0 online',
          publicKeyExposed: false
        }
      })
    });
    const data = await res.json();
    updateChatMessage(loadingId, data.reply || 'Erro ao processar resposta.');
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
  const msgId = 'msg_' + Date.now() + Math.random();
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
  if (el) {
    el.innerHTML = text.replace(/\n/g, '<br/>');
    const container = document.getElementById('advisorMessages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

// ─── WORKER TOKEN ───
async function generateWorkerToken() {
  try {
    const res = await fetch('/api/workers/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `miner-${Math.floor(Math.random() * 10000)}`, hardware: 'GPU', gpuModel: 'NVIDIA RTX GPU' })
    });
    const data = await res.json();
    if (data.token) {
      currentToken = data.token;
      const cmd = `node solver/pool-client.js --token=${data.token} --apiUrl=${window.location.origin}`;
      const el = document.getElementById('cliCommandText');
      if (el) el.innerText = cmd;
      alert(`🎉 Token gerado!\n\nToken: ${data.token}`);
    }
  } catch (err) {
    console.error('Erro ao gerar token:', err);
  }
}

function copyCliCommand() {
  const cmd = document.getElementById('cliCommandText')?.innerText;
  if (!cmd) return;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copyBtnText');
    if (btn) { btn.innerText = 'Copiado! ✓'; setTimeout(() => btn.innerText = 'Copiar', 2000); }
  });
}

// ─── WORKERS ATIVOS ───
async function fetchActiveWorkers() {
  try {
    const res = await fetch('/api/workers/active');
    const data = await res.json();
    const count = data.activeCount || 0;
    const hashrate = data.totalHashrateFormatted || '0 H/s';

    const hh = document.getElementById('headerHashrate');
    if (hh) hh.innerHTML = `<span class="w-2 h-2 rounded-full ${count > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span><span>${hashrate}</span>`;

    const hw = document.getElementById('headerWorkers');
    if (hw) hw.innerText = `${count} online`;
  } catch (_) {}
}

// ─── FLEET MANAGEMENT ───
async function generateBatchFleetNodes(count = 5) {
  try {
    const res = await fetch('/api/fleet/batch-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, baseName: 'colab-conta' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      fetchFleetNodes();
    }
  } catch (err) {
    alert('Erro ao gerar nós: ' + err.message);
  }
}

async function fetchFleetNodes() {
  try {
    const res = await fetch('/api/fleet');
    const data = await res.json();

    const activeCount = data.activeNodesCount || 0;
    const totalHash = data.totalHashrateFormatted || '0 H/s';
    const nodes = data.nodes || [];
    const totalKeys = nodes.reduce((s, n) => s + (n.totalKeysChecked || 0), 0);
    const totalShares = nodes.reduce((s, n) => s + (n.totalShares || 0), 0);

    // Atualiza métricas
    setInner('fleetActiveCount', activeCount + ' Nós');
    setInner('fleetTotalHashrate', totalHash);
    setInner('fleetKeysChecked', formatBig(totalKeys));
    setInner('fleetTotalShares', totalShares.toFixed(2));

    // Renderiza grid
    const container = document.getElementById('fleetNodesList');
    if (!container) return;

    if (nodes.length === 0) {
      container.innerHTML = `
        <div class="glass-panel rounded-xl p-8 border border-dashed border-white/10 text-center col-span-full">
          <i data-lucide="server" class="w-8 h-8 text-slate-500 mx-auto mb-3"></i>
          <p class="text-sm text-slate-400">Nenhum nó Colab registrado ainda.</p>
          <p class="text-xs text-slate-500 mt-1">Clique em <strong>+ Gerar 5 Nós Colab</strong> para criar sua fazenda!</p>
        </div>`;
    } else {
      container.innerHTML = nodes.map(n => {
        const isOnline = n.status !== 'OFFLINE';
        const dotColor = isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500';
        const statusBadge = isOnline
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">MINING</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 uppercase">OFFLINE</span>';

        return `
          <div class="glass-panel rounded-xl p-4 space-y-3 border ${isOnline ? 'border-emerald-500/20' : 'border-red-500/10'}">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full ${dotColor}"></span>
                <span class="font-bold text-white text-sm font-mono">${n.name}</span>
              </div>
              ${statusBadge}
            </div>
            <div class="text-[11px] text-slate-400 font-mono">${n.accountTag || 'Google Colab Farm'}</div>
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400">Hashrate</div>
                <div class="font-bold text-cyan-300">${formatHashrate(n.currentHashrate)}</div>
              </div>
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400">GPU</div>
                <div class="font-bold text-slate-200 truncate">${n.gpuModel || 'Tesla T4'}</div>
              </div>
            </div>
            <div class="text-[10px] font-mono text-slate-500 bg-cypher-900 p-1.5 rounded border border-white/5 truncate">
              Token: ${n.nodeToken.substring(0, 28)}...
            </div>
          </div>`;
      }).join('');
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Erro ao buscar fleet:', err);
  }
}

// ─── INTELLIGENCE HUB (DISCOVERIES) ───
async function fetchDiscoveries() {
  try {
    const res = await fetch('/api/discoveries');
    const data = await res.json();
    renderDiscoveries(data.discoveries || []);
  } catch (_) {}
}

function renderDiscoveries(list) {
  const container = document.getElementById('discoveriesFeed');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">Nenhuma pista registrada ainda. Seja o primeiro a contribuir!</div>`;
    return;
  }

  container.innerHTML = list.slice(0, 8).map(d => {
    const typeColors = {
      SEED_WORDS: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      MASK_PREFIX: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      MASK_SUFFIX: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      PUBLIC_KEY: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      BIT_PATTERN: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    };
    const style = typeColors[d.hintType] || typeColors.SEED_WORDS;

    return `
      <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="font-semibold text-white text-sm">${d.title}</div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${style} shrink-0">${d.hintType}</span>
        </div>
        ${d.fragment ? `<div class="font-mono text-xs text-cyan-200 bg-cypher-900 p-2 rounded border border-white/5 truncate">${d.fragment}</div>` : ''}
        <div class="flex items-center justify-between text-[10px] text-slate-500">
          <span>👤 ${d.authorName || 'Cypherpunk'}</span>
          <span>Confiança: <strong class="text-white">${d.confidence || 100}%</strong></span>
        </div>
      </div>`;
  }).join('');
}

async function submitDiscovery() {
  const title = document.getElementById('discTitle')?.value.trim();
  const hintType = document.getElementById('discType')?.value || 'SEED_WORDS';
  const fragment = document.getElementById('discFragment')?.value.trim();

  if (!title) { alert('Informe o título da pista.'); return; }

  try {
    const res = await fetch('/api/discoveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, hintType, fragment })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ Pista publicada no Mural!');
      document.getElementById('discTitle').value = '';
      document.getElementById('discFragment').value = '';
      fetchDiscoveries();
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

async function syncAllianceScraper() {
  try {
    const res = await fetch('/api/discoveries/sync-alliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceName: 'bitcoinpuzzles.io' })
    });
    const data = await res.json();
    alert(`🔄 ${data.message || 'Sincronismo executado.'}`);
    fetchDiscoveries();
  } catch (err) {
    alert('Erro no sincronismo: ' + err.message);
  }
}

// ─── SOLVERS C++ ───
async function fetchSolvers() {
  try {
    const res = await fetch('/api/discoveries/solvers');
    const data = await res.json();
    renderSolvers(data.solvers || []);
  } catch (_) {}
}

function renderSolvers(solvers) {
  const container = document.getElementById('solversList');
  if (!container) return;

  const archIcons = { x86: '🖥️', ARM: '📱', CUDA: '⚡', NVIDIA: '🎮' };

  container.innerHTML = solvers.map(s => `
    <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 hover:border-emerald-500/30 transition">
      <div class="font-bold text-white text-sm">${s.name}</div>
      <div class="text-[11px] text-slate-400">${s.description}</div>
      <div class="text-[11px] font-mono text-cyan-300">⚡ ${s.speedEstimated}</div>
      <div class="text-[10px] text-slate-500 font-mono">${s.architecture}</div>
      <div class="flex gap-2 pt-1">
        <a href="${s.downloadUrl}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold transition flex items-center gap-1">
          <i data-lucide="download" class="w-3 h-3"></i> Download
        </a>
        <a href="${s.githubRepo}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition flex items-center gap-1">
          <i data-lucide="github" class="w-3 h-3"></i> GitHub
        </a>
      </div>
    </div>`
  ).join('');
  if (window.lucide) window.lucide.createIcons();
}

// ─── PUZZLES PAGINADOS ───
function debouncePuzzleFetch() {
  clearTimeout(puzzleDebounceTimer);
  puzzleDebounceTimer = setTimeout(() => fetchPaginatedPuzzles(1), 350);
}

async function fetchPaginatedPuzzles(page = 1) {
  currentPuzzlePage = page;
  try {
    const search = document.getElementById('puzzleSearchInput')?.value.trim() || '';
    const chain = document.getElementById('filterChain')?.value || 'all';
    const difficulty = document.getElementById('filterDifficulty')?.value || 'all';
    const status = document.getElementById('filterStatus')?.value || 'all';

    const params = new URLSearchParams({ page, limit: 9 });
    if (search) params.append('search', search);
    if (chain !== 'all') params.append('chain', chain);
    if (difficulty !== 'all') params.append('difficulty', difficulty);
    if (status !== 'all') params.append('status', status);

    const res = await fetch(`/api/puzzles?${params}`);
    const data = await res.json();
    allPuzzlesData = data.puzzles || [];

    renderPuzzlesTable(allPuzzlesData);
    renderPagination(data.page, data.totalPages, data.total);
  } catch (err) {
    console.error('Erro ao buscar puzzles:', err);
  }
}

function renderPuzzlesTable(puzzles) {
  const tbody = document.getElementById('puzzlesTableBody');
  if (!tbody) return;

  if (puzzles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-500 text-xs">Nenhum puzzle encontrado com os filtros aplicados.</td></tr>`;
    return;
  }

  const chainColors = { BTC: 'text-amber-400', ETH: 'text-blue-400', SOL: 'text-emerald-400' };
  const diffColors = { EASY: 'bg-emerald-500/10 text-emerald-400', MEDIUM: 'bg-yellow-500/10 text-yellow-400', HARD: 'bg-red-500/10 text-red-400', EXTREME: 'bg-purple-500/10 text-purple-400' };

  tbody.innerHTML = puzzles.map(p => {
    const chainColor = chainColors[p.chain] || 'text-slate-400';
    const diffStyle = diffColors[p.difficulty?.toUpperCase()] || diffColors.MEDIUM;
    const solved = p.solved;

    return `
      <tr class="hover:bg-white/5 transition group">
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            <span class="text-base">${p.emoji || '🔒'}</span>
            <div>
              <div class="font-semibold text-white text-[11px] group-hover:text-cyan-300 transition">${p.title || `Puzzle #${p.puzzleNumber}`}</div>
              ${p.targetAddress ? `<div class="font-mono text-[9px] text-slate-500 truncate max-w-[120px]">${p.targetAddress}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="py-3 px-3 ${chainColor} font-bold text-xs">${p.chain}</td>
        <td class="py-3 px-3 font-mono text-slate-300 text-xs">${p.bits} bits</td>
        <td class="py-3 px-3 font-mono text-amber-400 font-bold text-xs">${p.prize} ${p.prizeCurrency || p.chain}</td>
        <td class="py-3 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${diffStyle}">${p.label || p.difficulty} ${p.emoji || ''}</span>
          <div class="font-mono text-[10px] text-slate-500 mt-0.5">Score: ${p.score}</div>
        </td>
        <td class="py-3 px-3 text-[11px] text-emerald-400 font-semibold">${p.recommendedStrategy || 'Saco Completo'}</td>
        <td class="py-3 px-3 text-right">
          ${solved
            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">✅ RESOLVIDO</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/30">🔥 ATIVO</span>'
          }
        </td>
      </tr>`;
  }).join('');
}

function renderPagination(page, totalPages, total) {
  setInner('currentPageNum', page);
  setInner('totalPagesNum', totalPages);
  setInner('totalPuzzlesCount', total);

  const controls = document.getElementById('paginationControls');
  if (!controls) return;

  let html = '';
  if (page > 1) {
    html += `<button onclick="fetchPaginatedPuzzles(${page - 1})" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition">← Anterior</button>`;
  }

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) {
    html += `<button onclick="fetchPaginatedPuzzles(${i})" class="px-3 py-1.5 rounded-lg ${i === page ? 'bg-cyan-500 text-black font-bold' : 'bg-white/5 hover:bg-white/10 text-slate-300'} text-xs transition">${i}</button>`;
  }

  if (page < totalPages) {
    html += `<button onclick="fetchPaginatedPuzzles(${page + 1})" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition">Próxima →</button>`;
  }

  controls.innerHTML = html;
}

// ─── LEARNING LAB SANDBOX ───
async function runSandboxBenchmark() {
  const puzzleNum = document.getElementById('sandboxPuzzleSelect')?.value || '30';
  const hardware = document.getElementById('sandboxHardwareSelect')?.value || 'Google Colab Tesla T4';
  const logsEl = document.getElementById('sandboxLogs');
  const statusEl = document.getElementById('sandboxStatus');
  const offsetEl = document.getElementById('sandboxOffset');
  const btn = document.getElementById('runBenchmarkBtn');

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.innerText = 'Executando...';
  if (logsEl) logsEl.innerHTML = '<div class="text-yellow-400">> Iniciando benchmark seguro...</div>';

  try {
    const res = await fetch('/api/sandbox/benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleNumber: Number(puzzleNum), hardware })
    });
    const data = await res.json();

    if (data.logs && logsEl) {
      logsEl.innerHTML = '';
      let delay = 0;

      for (const log of data.logs) {
        const isKey = log.includes('KEY_INTERSECTION') || log.includes('RESULT') || log.includes('BENCHMARK');
        const color = isKey ? 'text-emerald-400 font-bold' : log.includes('ERROR') ? 'text-red-400' : 'text-cyan-300';

        await new Promise(resolve => setTimeout(resolve, delay));
        const line = document.createElement('div');
        line.className = color + ' text-[11px]';
        line.textContent = '> ' + log;
        logsEl.appendChild(line);
        document.getElementById('sandboxTerminal')?.scrollTo(0, 99999);
        delay = isKey ? 800 : 300;
      }
    }

    if (statusEl) statusEl.innerText = '✅ Concluído';
    if (offsetEl) offsetEl.innerText = '5,000,000 chaves';
  } catch (err) {
    if (logsEl) logsEl.innerHTML += `<div class="text-red-400">> ERRO: ${err.message}</div>`;
    if (statusEl) statusEl.innerText = '❌ Erro';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── GOOGLE SHEETS ───
async function fetchSheetsStats() {
  try {
    const res = await fetch('/api/ranges/sheets-stats');
    const data = await res.json();
    setInner('sheetsTotalArchived', data.totalArchivedRanges || 152);
  } catch (_) {}
}

async function submitSheetsArchive() {
  const rawInput = document.getElementById('sheetsInputText')?.value.trim();
  if (!rawInput) { alert('Informe as fatias para arquivar.'); return; }

  const items = rawInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  try {
    const res = await fetch('/api/ranges/archive-to-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunks: items, source: 'UI Manual Ingestion' })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      document.getElementById('sheetsInputText').value = '';
      fetchSheetsStats();
    }
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// ─── UTILITÁRIOS ───
function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

function formatHashrate(kps = 0) {
  const n = Number(kps) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}

function formatBig(n = 0) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' K';
  return String(n);
}

// ─── ENTROPY SIMULATOR ───
async function simulateEntropy() {
  try {
    const bip39 = document.getElementById('hintBip39')?.checked;
    const bsgs = document.getElementById('hintBSGS')?.checked;
    const prefix = document.getElementById('hintPrefix')?.value?.trim();
    const knownBits = Number(document.getElementById('hintBits')?.value) || 0;

    const hints = [];
    if (bip39) hints.push({ type: 'bip39ChecksumFilter' });
    if (prefix) hints.push({ type: 'fixedPrefix', value: prefix });
    if (knownBits > 0) hints.push({ type: 'knownBits', count: knownBits });

    const res = await fetch('/api/puzzles/entropy/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bitRange: 66, prizeAmount: 6.6, hints, publicKeyExposed: bsgs })
    });
    const data = await res.json();

    setInner('simEffectiveBits', data.effectiveBits);
    setInner('simReductionPercent', `-${data.entropyReductionRatio}`);

    let timeStr = '';
    const h = data.estimatedHoursColabFarm5x || 0;
    if (h < 1) timeStr = `${(h * 60).toFixed(1)} min`;
    else if (h / 24 < 365) timeStr = `~${(h / 24).toFixed(2)} dias`;
    else timeStr = `~${(h / 8760).toFixed(1)} anos`;

    setInner('simTimeEst', timeStr);
    setInner('simScore', `${data.score} (${data.label} ${data.emoji})`);
  } catch (_) {}
}
