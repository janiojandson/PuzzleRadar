// =========================================================================
// 🧩 PuzzleRadar v5.0 — btcpuzzle Webhook Endpoint + WhatsApp Integration
// =========================================================================
// Recebe notificações de status do btcpuzzle client via headers HTTP.
// REQUISITO ESTRITO: Envia resposta 200 OK com corpo "true" (text/plain)
// imediatamente e processa telemetria e resgate anti-MEV assincronamente.
// =========================================================================

const express = require('express');
const { loteManager } = require('../../services/loteManager');
const { antiMevRescue } = require('../../services/antiMevRescue');
const { leaderboardService } = require('../../services/leaderboardService');
const { appendRangesToSheet } = require('../../lib/googleSheets');
const { markRangeScanned } = require('../../lib/redis');
const workersRouter = require('./workers');

const router = express.Router();

// WhatsApp Webhook URL from environment
const WHATSAPP_WEBHOOK_URL = process.env.WHATSAPP_WEBHOOK_URL;

async function sendWhatsAppAlert(eventData) {
  if (!WHATSAPP_WEBHOOK_URL || !WHATSAPP_WEBHOOK_URL.startsWith('http')) {
    console.log('[WhatsApp] Webhook URL não configurada (WHATSAPP_WEBHOOK_URL)');
    return { skipped: true, reason: 'URL not configured' };
  }

  const payload = {
    event: eventData.event || 'puzzle_key_found',
    puzzle: eventData.puzzle || 71,
    worker: eventData.worker || 'unknown',
    private_key_hex: eventData.privateKey || eventData.private_key_hex || '',
    message: eventData.message || `🚨 *PUZZLE BITCOIN RESOLVIDO!*\n\n• *Alvo:* Puzzle #${eventData.puzzle || 71}\n• *Worker:* ${eventData.worker || 'unknown'}\n• *Chave Privada:* ${eventData.privateKey || eventData.private_key_hex || 'N/A'}\n• *Horário:* ${eventData.timestamp || new Date().toISOString()}\n\n_Verifique imediatamente o painel do PuzzleRadar._`
  };

  try {
    const nexusSecret = process.env.NEXUS_WEBHOOK_SECRET || 'SenhaMuitoForteFamilia123';
    const response = await fetch(WHATSAPP_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nexus-secret': nexusSecret
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.text();
    console.log(`[WhatsApp] Disparado com status ${response.status}:`, result);
    return { success: true, status: response.status, response: result };
  } catch (err) {
    console.error('[WhatsApp] Erro ao disparar webhook:', err.message);
    return { success: false, error: err.message };
  }
}

router.post('/btcpuzzle', (req, res) => {
  // 1. Confirmação Imediata Estrita (text/plain "true")
  res.status(200).type('text/plain').send('true');

  // 2. Normalização dos Headers HTTP (case-insensitive)
  const headers = req.headers || {};
  const status = (headers['status'] || req.body?.status || '').toString().trim();
  const hex = (headers['hex'] || req.body?.hex || '').toString().trim();
  const privateKeyHex = (headers['privatekey'] || req.body?.privatekey || '').toString().trim();
  const targetPuzzle = (headers['targetpuzzle'] || req.body?.targetpuzzle || '71').toString().trim();
  const workerName = (headers['workername'] || req.body?.workername || 'btcpuzzle_worker').toString().trim();
  const nodeId = (headers['nodeid'] || headers['node_id'] || req.body?.nodeId || workerName).toString().trim();
  const operatorName = (headers['operator'] || req.body?.operator || workerName.split('_node_')[0]).toString().trim();
  const hashrate = headers['hashrate'] || req.body?.hashrate || '0 H/s';
  const authHeader = headers['authorization'] || '';
  const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : 'wrk_anonymous_node';

  // 3. Processamento Assíncrono Desacoplado
  setImmediate(async () => {
    try {
      console.log(`📡 [btcpuzzle Webhook] Evento recebido: status="${status}" | worker="${operatorName}" | node="${nodeId}" | hex="${hex}" | puzzle="${targetPuzzle}"`);

      // Update active workers map for telemetry hashrate
      const activeWorkersMap = workersRouter.activeWorkersMap;
      if (activeWorkersMap) {
        let worker = activeWorkersMap.get(nodeId);
        const displayName = nodeId.includes('_') ? `${operatorName} (${nodeId.split('_').slice(-1)[0]})` : operatorName;
        if (!worker) {
          worker = {
            id: nodeId,
            name: displayName,
            workerName: operatorName,
            operator: operatorName,
            nodeId,
            hardware: 'GPU Cluster Node',
            status: 'RUNNING',
            chain: 'BTC',
            challengeId: `BTC_1000_P${targetPuzzle}`,
            totalKeysChecked: 0,
            keysPerSecond: 0,
            shares: 0,
            userToken
          };
          activeWorkersMap.set(nodeId, worker);
        }
        
        let kps = 0;
        if (hashrate) {
           // Parse "45.0 kH/s" -> 45000
           const num = parseFloat(hashrate);
           if (!isNaN(num)) {
             if (hashrate.toLowerCase().includes('kh/s')) kps = num * 1000;
             else if (hashrate.toLowerCase().includes('mh/s')) kps = num * 1000000;
             else if (hashrate.toLowerCase().includes('gh/s')) kps = num * 1000000000;
             else kps = num;
           }
        }
        worker.keysPerSecond = kps;
        worker.lastSeen = Date.now();
      }

      // Registra contribuição no Leaderboard
      const isCompleted = (status === 'rangeScanned' || status === 'reachedOfKeySpace' || status === 'keyFound');
      const keysEst = isCompleted ? 4294967296 : 50000;
      
      if (activeWorkersMap) {
        let worker = activeWorkersMap.get(workerName);
        if (worker && isCompleted) {
          worker.shares = (worker.shares || 0) + 10; // 10 shares per chunk
        }
      }

      leaderboardService.recordContribution(workerName, {
        keysChecked: keysEst,
        isLoteCompleted: isCompleted,
        hashrate
      }).catch(() => {});

      // Atualiza estado do lote no loteManager
      loteManager.updateLoteEvent(hex, status, {
        workerName,
        privateKeyHex,
        targetPuzzle
      });

      if (status === 'keyFound') {
        console.log(`🚨 [btcpuzzle Webhook] 🎯 CHAVE ENCONTRADA PELO WORKER "${workerName}" para o Puzzle #${targetPuzzle}!`);
        console.log(`🛡️ [btcpuzzle Webhook] Disparando Auto-Resgate Anti-MEV para Cold Vault Imutável...`);

        // Dispara resgate confidencial imediato
        if (privateKeyHex) {
          const targetAddress = '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU'; // Endereço oficial do Puzzle 71
          await antiMevRescue.executeRescue({
            chain: 'BTC',
            challengeId: `BTC_1000_P${targetPuzzle}`,
            privateKeyHex,
            targetAddress
          }).catch(err => {
            console.error('❌ [btcpuzzle Webhook] Erro no resgate anti-MEV:', err.message);
          });
        }

        // Dispara alerta WhatsApp (Família Financeira)
        await sendWhatsAppAlert({
          event: 'puzzle_key_found',
          puzzle: parseInt(targetPuzzle) || 71,
          worker: workerName,
          privateKeyHex: privateKeyHex,
          timestamp: new Date().toISOString()
        });
      } else if (status === 'rangeScanned' || status === 'reachedOfKeySpace') {
        // Marca fatia no bitmap do Redis e enfileira no Google Sheets
        if (hex) {
          const cleanHex = hex.replace(/^0x/i, '');
          let startHex = cleanHex.slice(0, 18);
          let endHex = cleanHex.length >= 36 ? cleanHex.slice(18, 36) : '';

          if (!startHex) startHex = '400000000000000000';
          startHex = startHex.padStart(18, '0');

          // Dedução automática de endHex somando STEP_DEFAULT (1n << 48n)
          if (!endHex) {
            const startBig = BigInt("0x" + startHex);
            const stepBig = 1n << 48n;
            endHex = (startBig + stepBig).toString(16).padStart(18, '0');
          } else {
            endHex = endHex.padStart(18, '0');
          }

          const chunkIndex = loteManager.calculateChunkIndex(startHex);
          const chunkLabel = `Chunk #${chunkIndex}`;

          await markRangeScanned(targetPuzzle, startHex, endHex).catch(() => {});

          try {
            const { parentLoteManager } = require('../../services/parentLoteManager');
            parentLoteManager.markMicroLoteCompleted(startHex, 16777216, workerName);
          } catch (_) {}

          const isWebClient = (headers['hashrate'] && String(headers['hashrate']).includes('kH/s')) || String(workerName).toLowerCase().includes('web');
          const clientStatus = isWebClient ? 'COMPLETED (Navegador)' : 'COMPLETED_BTCPUZZLE_CLIENT';

          appendRangesToSheet(undefined, [{
            chain: 'BTC',
            challengeId: `BTC_1000_P${targetPuzzle}`,
            puzzleId: `BTC_1000_P${targetPuzzle}`,
            chunkIndex,
            chunkLabel,
            rangeStart: startHex,
            rangeEnd: endHex,
            workerName
          }], workerName, {
            status: clientStatus,
            hashrate: headers['hashrate'] || '0 H/s'
          }).catch(() => {});
        }
      }
    } catch (asyncErr) {
      console.error('❌ [btcpuzzle Webhook] Erro no processamento em background:', asyncErr.message);
    }
  });
});

/**
 * POST /api/admin/test-whatsapp & POST /api/webhook/admin/test-whatsapp
 * Endpoint de teste para disparar mensagem WhatsApp simulada (somente Admin)
 */
router.post(['/admin/test-whatsapp', '/test-whatsapp'], async (req, res) => {
  try {
    // Verifica se é admin (pode ser expandido com JWT)
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de admin obrigatório' });
    }

    const result = await sendWhatsAppAlert({
      event: 'test_alert',
      puzzle: 71,
      worker: 'admin_test_worker',
      privateKeyHex: '0xTEST_KEY_FOR_VALIDATION',
      message: `🧪 *TESTE DE WHATSAPP - PUZZLERADAR*\n\nEsta é uma mensagem de teste disparada pelo painel de Administração.\n\n✅ Webhook configurado corretamente\n📅 ${new Date().toISOString()}\n\n_Sistema operacional._`
    });

    res.json({
      success: result.success || result.skipped,
      message: result.skipped ? 'WhatsApp webhook não configurado (defina WHATSAPP_WEBHOOK_URL)' : 'Mensagem de teste enviada',
      details: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/whatsapp-status & GET /api/webhook/admin/whatsapp-status
 * Verifica status da configuração do WhatsApp
 */
router.get(['/admin/whatsapp-status', '/whatsapp-status'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de admin obrigatório' });
    }

    const configured = WHATSAPP_WEBHOOK_URL && WHATSAPP_WEBHOOK_URL.startsWith('http');
    
    res.json({
      success: true,
      configured,
      webhookUrl: configured ? WHATSAPP_WEBHOOK_URL.substring(0, 50) + '...' : null,
      message: configured ? 'WhatsApp webhook configurado e pronto' : 'WHATSAPP_WEBHOOK_URL não definida nas variáveis de ambiente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
