// ============================================
// 🧩 PuzzleRadar — Frontend Application Logic
// ============================================

let currentTab = 'tab-workers';
let currentToken = 'wrk_crowdsource_demo';
let allPuzzlesData = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Carrega dados iniciais
  fetchActiveWorkers();
  fetchPuzzles();
  simulateEntropy();
  fetchPruningStats();

  // Polling em tempo real a cada 3 segundos
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
      
      alert(`🎉 Worker Token gerado com sucesso!\n\nToken: ${data.token}\n\nO comando de terminal foi atualizado abaixo.`);
    }
  } catch (err) {
    console.error('Erro ao gerar token:', err);
  }
}

/**
 * Copia comando para a área de transferência
 */
function copyCliCommand() {
  const cmd = document.getElementById('cliCommandText').innerText;
  navigator.clipboard.writeText(cmd).then(() => {
    const btn = document.getElementById('copyBtnText');
    btn.innerText = 'Copiado! ✓';
    setTimeout(() => { btn.innerText = 'Copiar'; }, 2000);
  });
}

/**
 * Busca workers ativos em tempo real
 */
async function fetchActiveWorkers() {
  try {
    const res = await fetch('/api/workers/active');
    const data = await res.json();

    const count = data.activeCount || 0;
    const hashrate = data.totalHashrateFormatted || '0 H/s';

    // Atualiza headers
    const headerH = document.getElementById('headerHashrate');
    if (headerH) headerH.innerHTML = `<span class="w-2 h-2 rounded-full ${count > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span><span>${hashrate}</span>`;

    const headerW = document.getElementById('headerWorkers');
    if (headerW) headerW.innerText = `${count} ${count === 1 ? 'online' : 'online'}`;

    const countBadge = document.getElementById('workerCountBadge');
    if (countBadge) countBadge.innerText = `${count} ${count === 1 ? 'Nó Minerando' : 'Nós Minerando'}`;

    // Renderiza grid de workers
    const container = document.getElementById('workersList');
    if (!container) return;

    if (count === 0) {
      container.innerHTML = `
        <div class="glass-panel rounded-xl p-5 border border-dashed border-white/10 text-center py-10 col-span-full">
          <i data-lucide="cpu" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
          <p class="text-sm text-slate-400">Nenhum worker externo conectado no momento. Inicie seu script para minerar!</p>
        </div>
      `;
    } else {
      container.innerHTML = data.workers.map(w => `
        <div class="glass-panel rounded-xl p-4 space-y-3 border border-emerald-500/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="font-bold text-white text-sm font-mono">${w.name}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 uppercase">${w.status}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div class="p-2 rounded bg-white/5">
              <div class="text-slate-400">Hashrate</div>
              <div class="font-bold text-cyan-300">${w.hashrateFormatted}</div>
            </div>
            <div class="p-2 rounded bg-white/5">
              <div class="text-slate-400">Hardware</div>
              <div class="font-bold text-slate-200">${w.hardware}</div>
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

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    // Silencia erros transitórios
  }
}

/**
 * Simula redução de entropia em tempo real
 */
async function simulateEntropy() {
  try {
    const bip39Checked = document.getElementById('hintBip39')?.checked;
    const prefix = document.getElementById('hintPrefix')?.value?.trim();
    const knownBits = Number(document.getElementById('hintBits')?.value) || 0;

    const hints = [];
    if (bip39Checked) {
      hints.push({ type: 'bip39ChecksumFilter' });
    }
    if (prefix) {
      hints.push({ type: 'fixedPrefix', value: prefix });
    }
    if (knownBits > 0) {
      hints.push({ type: 'knownBits', count: knownBits });
    }

    const res = await fetch('/api/puzzles/entropy/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bitRange: 66,
        prizeAmount: 6.6,
        hints
      })
    });

    const data = await res.json();
    
    document.getElementById('simEffectiveBits').innerText = data.effectiveBits;
    document.getElementById('simReductionPercent').innerText = `-${data.entropyReductionRatio}`;
    
    let timeStr = '';
    if (data.estimatedHoursRTX4090 < 1) {
      timeStr = `${(data.estimatedHoursRTX4090 * 60).toFixed(1)} minutos`;
    } else if (data.estimatedDaysRTX4090 < 365) {
      timeStr = `~${data.estimatedDaysRTX4090.toFixed(2)} dias`;
    } else {
      timeStr = `~${data.estimatedYearsRTX4090.toFixed(1)} anos`;
    }
    document.getElementById('simTimeEst').innerText = timeStr;
    document.getElementById('simScore').innerText = `${data.score} (${data.label} ${data.emoji})`;

  } catch (err) {
    console.error('Erro na simulação de entropia:', err);
  }
}

/**
 * Busca estatísticas de space pruning
 */
async function fetchPruningStats() {
  try {
    const res = await fetch('/api/ranges/pruning-stats/puzzle_btc_66?total=1000');
    const data = await res.json();

    document.getElementById('prunePercent').innerText = `${data.prunedPercent}%`;
    document.getElementById('pruneProgressBar').style.width = `${data.prunedPercent}%`;
    document.getElementById('pruneCount').innerText = data.scannedChunks;
    document.getElementById('pruneRemaining').innerText = data.remainingChunks;
  } catch (err) {
    // Ignorar
  }
}

/**
 * Envia histórico de fatias para o Space Pruning
 */
async function submitPruningHistory() {
  try {
    const puzzleId = document.getElementById('prunePuzzleSelect').value;
    const rawInput = document.getElementById('pruneInput').value.trim();

    if (!rawInput) {
      alert('Por favor, informe ao menos uma fatia ou lista de índices de chunks.');
      return;
    }

    // Processa linhas ou vírgulas
    const items = rawInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

    const res = await fetch('/api/ranges/import-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puzzleId,
        chunks: items,
        totalEstimatedChunks: 1000
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ ${data.message}`);
      document.getElementById('pruneInput').value = '';
      fetchPruningStats();
    }
  } catch (err) {
    alert('Erro ao importar histórico: ' + err.message);
  }
}

/**
 * Busca lista de puzzles
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

/**
 * Filtra e renderiza lista de puzzles
 */
function filterPuzzles(filterType) {
  if (filterType === 'active') {
    renderPuzzles(allPuzzlesData.filter(p => !p.solved));
  } else if (filterType === 'solved') {
    renderPuzzles(allPuzzlesData.filter(p => p.solved));
  } else {
    renderPuzzles(allPuzzlesData);
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
          <span class="font-extrabold text-white text-base">Bitcoin Puzzle #${p.puzzleNumber}</span>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.solved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'} uppercase">
          ${p.solved ? 'RESOLVIDO (Lab)' : 'ATIVO 🔥'}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div class="p-2 rounded bg-white/5">
          <div class="text-slate-400">Entropia</div>
          <div class="font-bold text-cyan-300">${p.bits} bits</div>
        </div>
        <div class="p-2 rounded bg-white/5">
          <div class="text-slate-400">Prêmio</div>
          <div class="font-bold text-amber-400">${p.prize} BTC</div>
        </div>
      </div>

      <div class="text-xs text-slate-400 font-mono space-y-1">
        <div>Score: <strong class="text-white">${p.score}</strong> (${p.label})</div>
        <div>Estratégia: <span class="text-emerald-400 font-semibold">${p.recommendedStrategy}</span></div>
      </div>
    </div>
  `).join('');
}
