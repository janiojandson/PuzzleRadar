// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas do Consultor Matemático IA
// ============================================

const express = require('express');
const { generateAdvisorResponse } = require('../../lib/aiAdvisor');

const { getMultiChainPuzzleData, calculateTargetROI, fetchCryptoPrices } = require('../../lib/difficultyEngine');

const router = express.Router();

/**
 * GET /api/advisor/recommendations — Retorna o ranking de alvos ordenados por ROI Dinâmico (roi_per_day_usd)
 */
router.get('/recommendations', async (req, res) => {
  try {
    const fleetHashrate = parseFloat(req.query.fleetHashrate) || 42000000000; // 42 GH/s padrão
    const gpuPowerWatts = parseFloat(req.query.gpuPowerWatts) || 250;
    const electricityPriceKwh = parseFloat(req.query.electricityPriceKwh) || 0.12;

    // Atualiza cotações do CoinGecko (se expirado cache de 60m)
    await fetchCryptoPrices();

    const allPuzzles = getMultiChainPuzzleData();
    // Filtra puzzles ativos/não resolvidos
    const activePuzzles = allPuzzles.filter(p => !p.solved && p.status !== 'SOLVED');

    // Calcula ROI para cada desafio
    const rankedRecommendations = activePuzzles.map(p => {
      const roi = calculateTargetROI(p, fleetHashrate, gpuPowerWatts, electricityPriceKwh);
      return {
        ...p,
        roi
      };
    });

    // Ordena de forma decrescente pelo índice de lucratividade diária: roi_per_day_usd
    rankedRecommendations.sort((a, b) => b.roi.roi_per_day_usd - a.roi.roi_per_day_usd);

    res.json({
      success: true,
      fleetConfig: {
        fleetHashrate,
        fleetHashrateFormatted: `${(fleetHashrate / 1e9).toFixed(1)} GH/s`,
        gpuPowerWatts,
        electricityPriceKwh: `$${electricityPriceKwh}/kWh`
      },
      totalRecommendations: rankedRecommendations.length,
      topPick: rankedRecommendations[0] || null,
      recommendations: rankedRecommendations
    });
  } catch (err) {
    console.error('[Advisor Recommendations Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/advisor/chat — Conversar com o Consultor Matemático (Protegido para o Operador Master)
 */
router.post('/chat', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey || (req.body && req.body.adminKey);
    const configuredAdminKey = process.env.ADMIN_KEY;

    // Se o cliente for anônimo/público, protege os custos de API da LLM com resposta educativa e segura
    if (!adminKey || (configuredAdminKey && adminKey !== configuredAdminKey)) {
      return res.json({
        success: true,
        isAutonomousMode: true,
        response: '🧠 O Consultor IA do PuzzleRadar está operando em Modo Autônomo 24/7 no servidor, calculando probabilidades heurísticas do keyspace e distribuindo os lotes mais quentes para as GPUs da frota. O modo de chat aberto foi restrito para preservar a cota e custos de API do ecossistema.'
      });
    }

    const { message, prompt, context, history, provider } = req.body;
    const userPrompt = message || prompt;

    if (!userPrompt) {
      return res.status(400).json({ error: 'Mensagem/prompt é obrigatório.' });
    }

    const response = await generateAdvisorResponse({
      prompt: userPrompt,
      context: context || {},
      history: history || [],
      provider: provider || 'gemini'
    });

    res.json(response);
  } catch (err) {
    console.error('[Advisor Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
