// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas do Consultor Matemático IA
// ============================================

const express = require('express');
const { generateAdvisorResponse } = require('../../lib/aiAdvisor');

const router = express.Router();

/**
 * POST /api/advisor/chat — Conversar com o Consultor Matemático
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, prompt, context, history } = req.body;
    const userPrompt = message || prompt;

    if (!userPrompt) {
      return res.status(400).json({ error: 'Mensagem/prompt é obrigatório.' });
    }

    const response = await generateAdvisorResponse({
      prompt: userPrompt,
      context: context || {},
      history: history || []
    });

    res.json(response);
  } catch (err) {
    console.error('[Advisor Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
