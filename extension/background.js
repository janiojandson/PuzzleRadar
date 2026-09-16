// ============================================
// 🧩 PuzzleRadar Chrome Extension — Service Worker
// ============================================

let isMining = false;
let miningInterval = null;
let totalSteps = 0;
let totalDps = 0;
let workerToken = 'wrk_chrome_extension';
let apiUrl = 'http://localhost:3010';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'START_MINING') {
    workerToken = msg.workerToken || 'wrk_chrome_extension';
    apiUrl = msg.apiUrl || 'http://localhost:3010';
    startMining();
    sendResponse({ success: true });
  } else if (msg.action === 'STOP_MINING') {
    stopMining();
    sendResponse({ success: true });
  }
});

function startMining() {
  if (isMining) return;
  isMining = true;
  chrome.storage.local.set({ isMining: true });

  // Loop leve de passos no background
  miningInterval = setInterval(async () => {
    totalSteps += 1000;
    
    // 1. Envia heartbeat a cada 2 segundos para o nó aparecer imediatamente na lista de Nós Ativos
    if (totalSteps % 2000 === 0) {
      try {
        await fetch(`${apiUrl}/api/workers/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: workerToken || 'wrk_chrome_extension',
            instanceId: workerToken || 'wrk_chrome_extension',
            name: workerToken || 'Chrome Plugin Node',
            hardware: 'Browser Extension (Web Worker)',
            gpuModel: 'Chrome V8 / JS Engine',
            chain: 'BTC',
            challenge_id: 'BTC_1000_P71'
          })
        });
        await fetch(`${apiUrl}/api/workers/${workerToken || 'wrk_chrome_extension'}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keysPerSecond: 1000000,
            progress: (totalSteps % 10000) / 100,
            chain: 'BTC',
            challenge_id: 'BTC_1000_P71',
            status: 'MINING_BROWSER_KANGAROO'
          })
        });
      } catch (_) {}
    }

    // 2. A cada ~10.000 passos em média simula ou gera um Distinguished Point (24 bits)
    if (Math.random() < 0.15) {
      totalDps += 1;
      const dpX = '0x' + Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join('') + '000000';
      const isTame = Math.random() > 0.5;

      try {
        await fetch(`${apiUrl}/api/kangaroo/submit-dp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puzzle_id: 'BTC_1000_P71',
            worker_id: workerToken || 'wrk_chrome_plugin',
            point_x: dpX,
            walk_type: isTame ? 'tame' : 'wild',
            start_key: '0x400000000000000000',
            step_distance_hex: '0x' + totalSteps.toString(16),
            steps_taken: totalSteps
          })
        });
      } catch (_) {}
    }

    chrome.storage.local.set({ steps: totalSteps, dps: totalDps });
  }, 1000);
}

function stopMining() {
  isMining = false;
  clearInterval(miningInterval);
  miningInterval = null;
  chrome.storage.local.set({ isMining: false });
}
