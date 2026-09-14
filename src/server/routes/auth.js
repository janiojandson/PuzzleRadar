// ============================================
// 🧩 PuzzleRadar — Rotas de Autenticação
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { generateToken, requireAuth } = require('../../lib/auth');

const router = express.Router();

// Schema de validação
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
  displayName: z.string().optional(),
  gpuModel: z.string().optional(),
  cpuModel: z.string().optional(),
  hasGpu: z.boolean().optional().default(false)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // TODO: Verificar se email/username já existem no DB
    // TODO: Criar usuário no DB via Prisma
    
    const passwordHash = await bcrypt.hash(data.password, 12);
    
    // Simulação (substituir por Prisma)
    const user = {
      id: 'usr_' + Date.now(),
      email: data.email,
      username: data.username,
      displayName: data.displayName || data.username,
      hasGpu: data.hasGpu || false,
      gpuModel: data.gpuModel || null
    };
    
    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    });
    
    res.status(201).json({
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName },
      token
    });
  } catch (err) {
    res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // TODO: Buscar usuário no DB via Prisma
    // TODO: Verificar senha com bcrypt.compare
    
    const token = generateToken({
      userId: 'usr_demo',
      email,
      username: 'demo_user'
    });
    
    res.json({ token });
  } catch (err) {
    res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;