// ============================================
// 🧩 PuzzleRadar v3.0 — Frontend Application Logic
// ============================================

let currentTab = 'tab-colab';
let currentToken = 'wrk_crowdsource_demo';
let allPuzzlesData = [];
let isChatOpen = false;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  fetchActiveWorkers();
  fetchPuzzles();
  simulateEntropy();
  fetchSheetsStats();

  setInterval(() => {
    fetchActiveWorkers();
  }, 3000);
});

/**
 * Troca de abas
 */
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

/**
 * Abre/Fecha o Modal do Consultor Matemático IA
 */
function toggleAdvisorChat() {
  isChatOpen = !isChatOpen;
  const modal = document.getElementById('advisorChatModal');
  if (modal) {
    if (isChatOpen) {
      modal.classList.remove('hidden');
      document.getElementById('advisorInput')?.focus();
    } else {
      modal.classList.add('hidden');
    }
  }
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Envia mensagem para o Consultor Matemático IA
 */
async function sendAdvisorMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('advisorInput');
  const msg = input.value.trim();
  if (!msg) return;

  appendChatMessage('user', msg);
  input.value = '';

  const loadingId = appendChatMessage('ai', '⏳ Analisando cálculo matemático...');

  try {
    const res = await fetch('/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        context: {
          totalHashrate: document.getElementById('headerHashrate')?.innerText || '42 GH/s',
          activeWorkers: document.getElementById('headerWorkers')?.innerText || '1 online',
          publicKeyExposed: document.getElementById('hintBSGS')?.checked || false
        }
      })
    });

    const data = await res.json();
    updateChatMessage(loadingId, data.reply || 'Erro ao processar resposta.');
  } catch (err) {
    updateChatMessage(loadingId, `⚠️ Erro ao consultar IA: ${err.message}`);
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
    ? 'p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 ml-6'
    : 'p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 mr-6';
  
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

/**
 * Gera Worker Token via API
 */
async function generateWorkerToken() {
  try {
    const res = await fetch('/api/workers/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `miner-node-${Math.floor(Math.random() * 10000)}`,
        hardware: 'GPU',
        gpuModel: 'NVIDIA RTX GPU'
      })
    });
    const data = await res.json();
    if (data.token) {
      currentToken = data.token;
      const origin = window.location.origin;
      const cmd = `node solver/pool-client.js --token=${data.token} --apiUrl=${origin}`;
      document.getElementById('cliCommandText').innerText = cmd;
      alert(`🎉 Worker Token gerado com sucesso!\n\nToken: ${data.token}\n\nO comando de terminal foi atualizado.`);
    }
  } catch (err) {
    console.error('Erro ao gerar token:', err);
  }
}

function copyCliCommand() {
  const cmd = document.getElementById('cliCommandText').innerText;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copyBtnText');
    btn.innerText = 'Copiado! ✓';
    setTimeout(() => { btn.innerText = 'Copiar'; }, 2000);
  });
}

/**
 * Busca workers e nós Colab ativos em tempo real
 */
async function fetchActiveWorkers() {
  try {
    const res = await fetch('/api/workers/active');
    const data = await res.json();

    const count = data.activeCount || 0;
    const hashrate = data.totalHashrateFormatted || '0 H/s';

    const headerH = document.getElementById('headerHashrate');
    if (headerH) headerH.innerHTML = `<span class="w-2 h-2 rounded-full ${count > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span><span>${hashrate}</span>`;

    const headerW = document.getElementById('headerWorkers');
    if (headerW) headerW.innerText = `${count} ${count === 1 ? 'online' : 'online'}`;

    const colabBadge = document.getElementById('colabFarmBadge');
    if (colabBadge) colabBadge.innerText = `${count} ${count === 1 ? 'Conta Conectada' : 'Contas Conectadas'}`;

    // Renderiza grid de nós Colab
    const colabContainer = document.getElementById('colabNodesList');
    if (colabContainer) {
      if (count === 0) {
        colabContainer.innerHTML = `
          <div class="glass-panel rounded-xl p-5 border border-dashed border-white/10 text-center py-8 col-span-full">
            <i data-lucide="server" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
            <p class="text-sm text-slate-400">Nenhuma conta Google Colab conectada no momento. Abra o notebook para começar a minerar!</p>
          </div>
        `;
      } else {
        colabContainer.innerHTML = data.workers.map(w => `
          <div class="glass-panel rounded-xl p-4 space-y-3 border border-emerald-500/20">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span class="font-bold text-white text-sm font-mono">${w.name}</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">GPU T4</span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400">Hashrate</div>
                <div class="font-bold text-cyan-300">${w.hashrateFormatted}</div>
              </div>
              <div class="p-2 rounded bg-white/5">
                <div class="text-slate-400">VRAM / GPU</div>
                <div class="font-bold text-slate-200">16GB T4</div>
              </div>
            </div>

            ${w.currentTask ? `
              <div class="text-[11px] font-mono text-slate-400 bg-cypher-900 p-2 rounded truncate border border-white/5">
                ↳ Fatia: 0x${w.currentTask.rangeStart} ➔ 0x${w.currentTask.rangeEnd}
              </div>
            ` : ''}
          </div>
        `).join('');
      }
    }

    // Renderiza grid de workers normais
    const workerContainer = document.getElementById('workersList');
    if (workerContainer && colabContainer) {
      workerContainer.innerHTML = colabContainer.innerHTML;
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {}
}

/**
 * Simula redução de entropia
 */
async function simulateEntropy() {
  try {
    const bip39Checked = document.getElementById('hintBip39')?.checked;
    const bsgsChecked = document.getElementById('hintBSGS')?.checked;
    const prefix = document.getElementById('hintPrefix')?.value?.trim();
    const knownBits = Number(document.getElementById('hintBits')?.value) || 0;

    const hints = [];
    if (bip39Checked) hints.push({ type: 'bip39ChecksumFilter' });
    if (prefix) hints.push({ type: 'fixedPrefix', value: prefix });
    if (knownBits > 0) hints.push({ type: 'knownBits', count: knownBits });

    const res = await fetch('/api/puzzles/entropy/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bitRange: 66,
        prizeAmount: 6.6,
        hints,
        publicKeyExposed: bsgsChecked
      })
    });

    const data = await res.json();
    
    document.getElementById('simEffectiveBits').innerText = data.effectiveBits;
    document.getElementById('simReductionPercent').innerText = `-${data.entropyReductionRatio}`;
    
    let timeStr = '';
    if (data.estimatedHoursColabFarm5x < 1) {
      timeStr = `${(data.estimatedHoursColabFarm5x * 60).toFixed(1)} minutos`;
    } else if (data.estimatedHoursColabFarm5x / 24 < 365) {
      timeStr = `~${(data.estimatedHoursColabFarm5x / 24).toFixed(2)} dias`;
    } else {
      timeStr = `~${(data.estimatedHoursColabFarm5x / 8760).toFixed(1)} anos`;
    }
    document.getElementById('simTimeEst').innerText = timeStr;
    document.getElementById('simScore').innerText = `${data.score} (${data.label} ${data.emoji})`;

  } catch (err) {
    console.error('Erro na simulação de entropia:', err);
  }
}

/**
 * Busca estatísticas de Google Sheets
 */
async function fetchSheetsStats() {
  try {
    const res = await fetch('/api/ranges/sheets-stats');
    const data = await res.json();
    const countEl = document.getElementById('sheetsTotalArchived');
    if (countEl) countEl.innerText = data.totalArchivedRanges || 152;
  } catch (e) {}
}

/**
 * Envia histórico de fatias para o Google Sheets
 */
async function submitSheetsArchive() {
  try {
    const rawInput = document.getElementById('pruneInput').value.trim();
    const spreadsheetId = document.getElementById('sheetsIdInput')?.value.trim() || undefined;

    if (!rawInput) {
      alert('Por favor, informe ao menos uma fatia ou lista de ranges.');
      return;
    }

    const items = rawInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

    const res = await fetch('/api/ranges/archive-to-sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spreadsheetId,
        chunks: items,
        source: 'Google Colab Farm Ingestion'
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      document.getElementById('pruneInput').value = '';
      fetchSheetsStats();
    }
  } catch (err) {
    alert('Erro ao arquivar no Google Sheets: ' + err.message);
  }
}

/**
 * Busca e renderiza puzzles multi-moedas
 */
async function fetchPuzzles() {
  try {
    const res = await fetch('/api/puzzles');
    const data = await res.json();
    allPuzzlesData = data.puzzles || [];
    renderPuzzles(allPuzzlesData);
  } catch (err) {
    console.error('Erro ao buscar puzzles:', err);
  }
}

function filterPuzzles(chainFilter) {
  if (chainFilter === 'all') {
    renderPuzzles(allPuzzlesData);
  } else {
    renderPuzzles(allPuzzlesData.filter(p => p.chain === chainFilter));
  }
}

function renderPuzzles(puzzles) {
  const container = document.getElementById('puzzlesGrid');
  if (!container) return;

  container.innerHTML = puzzles.map(p => `
    <div class="glass-panel rounded-xl p-5 space-y-3 border ${p.solved ? 'border-emerald-500/20' : 'border-amber-500/30'}">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-lg">${p.emoji}</span>
          <span class="font-extrabold text-white text-base">${p.title || p.chain + ' Puzzle #' + p.puzzleNumber}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.solved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'} uppercase">
          ${p.solved ? 'RESOLVIDO' : 'ATIVO 🔥'}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div class="p-2 rounded bg-white/5">
          <div class="text-slate-400">Moeda / Bits</div>
          <div class="font-bold text-cyan-300">${p.chain} (${p.bits} bits)</div>
        </div>
        <div class="p-2 rounded bg-white/5">
          <div class="text-slate-400">Prêmio</div>
          <div class="font-bold text-amber-400">${p.prize} ${p.prizeCurrency || p.chain}</div>
        </div>
      </div>

      ${p.publicKeyExposed ? `
        <div class="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
          <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
          <span>Chave Pública Exposta ➔ Aceleração BSGS O(√N)</span>
        </div>
      ` : ''}

      <div class="text-xs text-slate-400 font-mono space-y-1">
        <div>Score: <strong class="text-white">${p.score}</strong> (${p.label})</div>
        <div>Estratégia: <span class="text-emerald-400 font-semibold">${p.recommendedStrategy}</span></div>
      </div>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
}
