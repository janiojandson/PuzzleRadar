// ============================================
// 🧩 PuzzleRadar — Rotas de Workers (Solver API)
// ============================================
// Estas rotas são usadas pelos workers (KeyHunt-Cuda, keyhunt, etc.)
// para se conectar ao pool e receber trabalho
// ============================================

const express = require('express');
const { requireAuth } = require('../../lib/auth');

const router = express.Router();

// POST /api/workers/register — Registrar um worker
router.post('/register', requireAuth, async (req, res) => {
  try {
    const { name, hardware, gpuModel, cpuModel, keysPerSecond, poolId } = req.body;
    
    // TODO: Registrar worker no DB
    // TODO: Atribuir range automaticamente
    
    res.status(201).json({
      workerId: 'wrk_' + Date.now(),
      name,
      hardware,
      status: 'IDLE',
      message: 'Worker registrado. Use GET /api/workers/:id/task para receber trabalho.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workers/:id/task — Receber tarefa
router.get('/:id/task', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Buscar próximo range disponível
    // TODO: Retornar dados para o solver
    
    res.json({
      workerId: id,
      task: null,
      message: 'Nenhuma tarefa disponível no momento. Aguarde...'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workers/:id/heartbeat — Worker está vivo
router.post('/:id/heartbeat', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { keysPerSecond, progress, status } = req.body;
    
    // TODO: Atualizar status do worker no DB
    
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workers/:id/result — Worker reportou resultado
router.post('/:id/result', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rangeId, result, keysChecked, foundPrivateKey, computeHours } = req.body;
    
    if (result === 'FOUND') {
      console.log(`[PuzzleRadar] 🎯 WORKER ${id} ENCONTROU A CHAVE!`);
      // TODO: Notificar admin, pausar pool, verificar chave
    }
    
    // TODO: Atualizar range e contribuição no DB
    
    res.json({
      workerId: id,
      result,
      nextTask: null, // TODO: Atribuir próximo range
      message: result === 'FOUND' ? '🎯 CHAVE ENCONTRADA!' : 'Resultado registrado. Próximo range disponível.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;