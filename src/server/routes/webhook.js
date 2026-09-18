// =========================================================================
// 🧩 PuzzleRadar v5.0 — btcpuzzle Webhook Endpoint
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

const router = express.Router();

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
  const hashrate = headers['hashrate'] || req.body?.hashrate || '0 H/s';

  // 3. Processamento Assíncrono Desacoplado
  setImmediate(async () => {
    try {
      console.log(`📡 [btcpuzzle Webhook] Evento recebido: status="${status}" | worker="${workerName}" | hex="${hex}" | puzzle="${targetPuzzle}"`);

      // Registra contribuição no Leaderboard
      const isCompleted = (status === 'rangeScanned' || status === 'reachedOfKeySpace' || status === 'keyFound');
      const keysEst = isCompleted ? 4294967296 : 50000;
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
      } else if (status === 'rangeScanned' || status === 'reachedOfKeySpace') {
        // Marca fatia no bitmap do Redis e enfileira no Google Sheets
        if (hex) {
          const cleanHex = hex.replace(/^0x/i, '');
          const startHex = cleanHex.slice(0, 18);
          const endHex = cleanHex.length > 18 ? cleanHex.slice(18, 36) : '';

          await markRangeScanned(targetPuzzle, startHex, endHex).catch(() => {});

          appendRangesToSheet(undefined, [{
            chain: 'BTC',
            challengeId: `BTC_1000_P${targetPuzzle}`,
            puzzleId: `BTC_1000_P${targetPuzzle}`,
            rangeStart: startHex,
            rangeEnd: endHex,
            workerName
          }], workerName, {
            status: 'COMPLETED_BTCPUZZLE_CLIENT',
            hashrate: headers['hashrate'] || '0 H/s'
          }).catch(() => {});
        }
      }
    } catch (asyncErr) {
      console.error('❌ [btcpuzzle Webhook] Erro no processamento em background:', asyncErr.message);
    }
  });
});

module.exports = router;
