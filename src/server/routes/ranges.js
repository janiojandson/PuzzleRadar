// ============================================
// 🧩 PuzzleRadar — Rotas de Ranges
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');

const router = express.Router();

// GET /api/ranges/available — Ranges disponíveis para trabalho
router.get('/available', requireAuth, async (req, res) => {
  try {
    const { poolId } = req.query;
    
    // TODO: Buscar ranges PENDING do DB
    res.json({
      ranges: [],
      message: 'Ranges disponíveis serão listados após migração'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ranges/:id/claim — Reivindicar um range
router.post('/:id/claim', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    
    // TODO: Marcar range como ASSIGNED no DB
    // TODO: Retornar rangeStart e rangeEnd para o worker
    
    res.json({
      rangeId: id,
      status: 'ASSIGNED',
      assigneeId: userId,
      message: 'Range reivindicado. Inicie o solver com os dados abaixo.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ranges/:id/result — Reportar resultado do range
router.post('/:id/result', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { result, keysChecked, foundPrivateKey, computeHours, gpuHours, cpuHours } = req.body;
    
    // ⚠️ SEGURANÇA: Se encontrou a chave, NÃO logar a chave privada
    // Apenas marcar como FOUND e notificar o admin do pool
    
    if (result === 'FOUND' && foundPrivateKey) {
      // TODO: Notificar admin do pool via canal seguro
      // TODO: Marcar puzzle como SOLVED
      console.log(`[PuzzleRadar] 🎯 CHAVE ENCONTRADA no range ${id}! Notificando admin...`);
    }
    
    // TODO: Atualizar range no DB
    // TODO: Calcular shares do usuário
    // TODO: Atualizar progresso do pool
    
    res.json({
      rangeId: id,
      result,
      shares: (keysChecked || 0) * 0.001, // Simplificado
      message: result === 'FOUND' ? '🎯 CHAVE ENCONTRADA! Admin notificado.' : 'Range verificado. Contribuição registrada.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;