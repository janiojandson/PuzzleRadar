// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas de Integração com Nexus Cérebro
// ============================================

const express = require('express');
const { getSheetsStats } = require('../../lib/googleSheets');
const { getPruningStats } = require('../../lib/redis');

const router = express.Router();

const NEXUS_CEREBRO_URL = process.env.NEXUS_CEREBRO_URL || 'https://nexus-cerebro-production-a7c0.up.railway.app';
const NEXUS_API_KEY = process.env.NEXUS_API_KEY || 'nexus-key';

/**
 * GET /api/nexus/status — Telemetria para o Nexus Cérebro e Painel
 */
router.get('/status', async (req, res) => {
  try {
    const sheetsStats = await getSheetsStats();
    const pruningStats = await getPruningStats('puzzle_btc_66', 10000);

    res.json({
      service: 'PuzzleRadar v3.0',
      status: 'ONLINE',
      memberId: 'puzzleradar',
      role: 'Cryptographic Search Engine & Saco Completo Pool',
      port: 3010,
      railwayDomain: 'puzzleradar-production.up.railway.app',
      capabilities: [
        'distribuir_ranges_puzzle',
        'calcular_reducao_entropia',
        'armazenar_historico_sheets',
        'consultor_matematico_ia',
        'gerenciar_fazenda_colab_gpu'
      ],
      sheetsStorage: sheetsStats,
      pruning: pruningStats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nexus/sync — Webhook de sincronismo com o Cérebro
 */
router.post('/sync', async (req, res) => {
  try {
    const { action, payload } = req.body;
    console.log(`🧠 [Nexus Sync] Ação recebida do Cérebro: ${action || 'PING'}`);

    res.json({
      synced: true,
      service: 'PuzzleRadar',
      version: '3.0.0',
      actionExecuted: action || 'HEARTBEAT_ACK',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nexus/notify-telegram — Envia notificação operacional/executiva para o Telegram do Nexus
 */
router.post('/notify-telegram', async (req, res) => {
  try {
    const { tipo, mensagem, detalhes } = req.body;

    // Encaminha requisição para a rota de alerta do Nexus Cérebro
    if (NEXUS_CEREBRO_URL) {
      try {
        await fetch(`${NEXUS_CEREBRO_URL}/api/v1/alerts/dupla`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-nexus-key': NEXUS_API_KEY
          },
          body: JSON.stringify({
            origem: 'PuzzleRadar v3.0',
            tipo: tipo || 'OPERACIONAL',
            titulo: '🧩 [PuzzleRadar] Alerta de Pool / Chave Criptográfica',
            mensagem: mensagem || 'Atualização de status do ecossistema PuzzleRadar.',
            detalhes: detalhes || {}
          })
        });
      } catch (cerebroErr) {
        console.warn('⚠️ [Nexus Telegram] Falha momentânea ao contactar Nexus Cérebro:', cerebroErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Notificação enviada ao canal de comunicação do Nexus.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
