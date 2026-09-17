// ============================================
// 🧩 PuzzleRadar Chrome Extension — Popup Logic
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const tokenInput = document.getElementById('tokenInput');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const toggleBtn = document.getElementById('toggleBtn');
  const statusBadge = document.getElementById('statusBadge');
  const stepsCount = document.getElementById('stepsCount');
  const dpsCount = document.getElementById('dpsCount');

  // Carrega estado salvo
  chrome.storage.local.get(['workerToken', 'apiUrl', 'isMining', 'steps', 'dps'], (res) => {
    if (res.workerToken) tokenInput.value = res.workerToken;
    if (res.apiUrl) apiUrlInput.value = res.apiUrl;
    else apiUrlInput.value = 'https://puzzleradar-production.up.railway.app';
    updateUI(Boolean(res.isMining), res.steps || 0, res.dps || 0);
  });

  // Atualiza contadores dinâmicos
  setInterval(() => {
    chrome.storage.local.get(['isMining', 'steps', 'dps'], (res) => {
      updateUI(Boolean(res.isMining), res.steps || 0, res.dps || 0);
    });
  }, 1000);

  toggleBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isMining'], (res) => {
      const newState = !res.isMining;
      const workerToken = tokenInput.value.trim();
      const apiUrl = apiUrlInput.value.trim() || 'https://puzzleradar-production.up.railway.app';

      chrome.storage.local.set({ isMining: newState, workerToken, apiUrl }, () => {
        chrome.runtime.sendMessage({ action: newState ? 'START_MINING' : 'STOP_MINING', workerToken, apiUrl });
        updateUI(newState);
      });
    });
  });

  function updateUI(isMining, steps = 0, dps = 0) {
    if (isMining) {
      statusBadge.innerText = 'MINERANDO';
      statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      statusBadge.style.color = '#10b981';
      toggleBtn.innerText = '⏹ Parar Mineração';
      toggleBtn.className = 'btn btn-stop';
    } else {
      statusBadge.innerText = 'STANDBY';
      statusBadge.style.background = 'rgba(148, 163, 184, 0.2)';
      statusBadge.style.color = '#94a3b8';
      toggleBtn.innerText = '▶ Iniciar Mineração Kangaroo';
      toggleBtn.className = 'btn btn-start';
    }
    stepsCount.innerText = Number(steps).toLocaleString();
    dpsCount.innerText = Number(dps).toLocaleString();
  }
});
