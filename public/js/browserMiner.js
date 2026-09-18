// =========================================================================
// 🧩 PuzzleRadar v5.1 — 1-Click Browser Mining Controller
// =========================================================================

class BrowserMinerController {
  constructor() {
    this.worker = null;
    this.isMining = false;
    this.workerName = localStorage.getItem('puzzleradar_worker_nickname') || 'Miner_Web_' + Math.floor(1000 + Math.random() * 9000);
    this.totalKeysChecked = parseInt(localStorage.getItem('puzzleradar_keys_checked') || '0', 10);
    this.totalLotesCompleted = parseInt(localStorage.getItem('puzzleradar_lotes_completed') || '0', 10);
    this.currentHashrate = 0;
    this.currentLote = null;
  }

  setNickname(name) {
    if (name && name.trim().length > 0) {
      this.workerName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      localStorage.setItem('puzzleradar_worker_nickname', this.workerName);
    }
  }

  async start() {
    if (this.isMining) return;
    this.isMining = true;

    if (!window.Worker) {
      alert('Seu navegador não suporta Web Workers.');
      return;
    }

    this.worker = new Worker('/js/worker-thread.js');
    this.worker.onmessage = (e) => this._handleWorkerMessage(e.data);

    await this._fetchNextMicroLoteAndStart();
  }

  pause() {
    this.isMining = false;
    if (this.worker) {
      this.worker.postMessage({ type: 'PAUSE' });
      this.worker.terminate();
      this.worker = null;
    }
    this.currentHashrate = 0;
    this._updateUi();
  }

  async _fetchNextMicroLoteAndStart() {
    if (!this.isMining) return;

    try {
      const res = await fetch(`/api/range/next/${this.workerName}?client=browser&hashrate=${this.currentHashrate || 50000}`);
      const lote = await res.json();

      if (lote && lote.custom_range) {
        this.currentLote = lote;
        this.worker.postMessage({
          type: 'START',
          data: {
            lote,
            workerName: this.workerName,
            apiBaseUrl: window.location.origin
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao obter micro-lote:', e.message);
      setTimeout(() => this._fetchNextMicroLoteAndStart(), 5000);
    }
  }

  _handleWorkerMessage(data) {
    if (data.type === 'STARTED') {
      this._updateUi();
    } else if (data.type === 'PROGRESS') {
      this.totalKeysChecked += data.keysBatch;
      this.currentHashrate = data.speedHps;
      localStorage.setItem('puzzleradar_keys_checked', this.totalKeysChecked);
      
      const token = localStorage.getItem('pzk_jwt_token') || 'wrk_anon_browser';
      fetch('/api/webhook/btcpuzzle', {
        method: 'POST',
        headers: {
          'Status': 'workerPing',
          'Workername': this.workerName,
          'Authorization': `Bearer ${token}`,
          'Targetpuzzle': '71',
          'Hashrate': `${(this.currentHashrate / 1000).toFixed(1)} kH/s`
        }
      }).catch(() => {});

      this._updateUi(data);
    } else if (data.type === 'COMPLETED') {
      this.totalLotesCompleted += 1;
      localStorage.setItem('puzzleradar_lotes_completed', this.totalLotesCompleted);

      const loteRange = data.custom_range || this.currentLote?.custom_range || '';
      const startHex = loteRange.split(':')[0] || '';
      const endHex = loteRange.split(':')[1] || '';
      const hexPayload = startHex && endHex ? `${startHex}${endHex}` : startHex;

      // Notifica o backend via webhook para pontuar no leaderboard e gravar na planilha
      const token = localStorage.getItem('pzk_jwt_token') || 'wrk_anon_browser';
      fetch('/api/webhook/btcpuzzle', {
        method: 'POST',
        headers: {
          'Status': 'rangeScanned',
          'Workername': this.workerName,
          'Authorization': `Bearer ${token}`,
          'Hex': hexPayload,
          'Targetpuzzle': '71',
          'Hashrate': `${(this.currentHashrate / 1000).toFixed(1)} kH/s`
        }
      }).catch(() => {});

      this._updateUi();
      // Solicita imediatamente a próxima fatia para manter a mineração contínua 24/7 até o usuário pausar
      if (this.isMining) {
        this._fetchNextMicroLoteAndStart();
      }
    }
  }

  _updateUi(progressData = {}) {
    const btnToggle = document.getElementById('btnToggleWebMining');
    const txtNickname = document.getElementById('webMinerNickname');
    const valHashrate = document.getElementById('webMinerHashrate');
    const valTotalKeys = document.getElementById('webMinerTotalKeys');
    const valLotes = document.getElementById('webMinerLotes');
    const valCurrentRange = document.getElementById('webMinerCurrentRange');
    const progressBar = document.getElementById('webMinerProgressBar');
    const statusBadge = document.getElementById('webMinerStatusBadge');

    if (statusBadge) {
      if (this.isMining) {
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block mr-1"></span> Conectado ao Hub / Minerando';
        statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
      } else {
        statusBadge.innerText = '⏹ Pausado / Aguardando Início';
        statusBadge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-white/10';
      }
    }

    if (btnToggle) {
      if (this.isMining) {
        btnToggle.innerHTML = '<i data-lucide="square" class="w-4 h-4"></i> ⏹ Pausar Mineração';
        btnToggle.className = 'w-full py-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition flex items-center justify-center gap-2';
      } else {
        btnToggle.innerHTML = '<i data-lucide="play" class="w-4 h-4"></i> ▶ Iniciar Mineração no Navegador';
        btnToggle.className = 'w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-extrabold shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 text-sm';
      }
    }

    if (txtNickname && !txtNickname.value) txtNickname.value = this.workerName;
    if (valHashrate) valHashrate.innerText = `${(this.currentHashrate / 1000).toFixed(1)} kH/s`;
    if (valTotalKeys) valTotalKeys.innerText = (this.totalKeysChecked).toLocaleString('pt-BR');
    if (valLotes) valLotes.innerText = this.totalLotesCompleted;
    if (valCurrentRange && this.currentLote) valCurrentRange.innerText = this.currentLote.custom_range;
    if (progressBar && progressData.progressPercent !== undefined) {
      progressBar.style.width = `${Math.min(100, progressData.progressPercent)}%`;
    }

    if (window.lucide) window.lucide.createIcons();
  }
}

window.browserMiner = new BrowserMinerController();
