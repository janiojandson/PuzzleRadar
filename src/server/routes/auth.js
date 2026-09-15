// ============================================
// 🧩 PuzzleRadar — Rotas de Autenticação & Gestão de Usuários
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken, requireAuth } = require('../../lib/auth');

const router = express.Router();

// Repositório persistente de usuários em memória (fallback / sync com Prisma)
const usersStore = new Map();

// Criação do Admin Master padrão
(async () => {
  const adminHash = await bcrypt.hash('admin123456', 10);
  usersStore.set('admin@puzzleradar.io', {
    id: 'usr_admin_master',
    name: 'Admin Master',
    email: 'admin@puzzleradar.io',
    username: 'admin',
    passwordHash: adminHash,
    role: 'ADMIN',
    workerToken: 'pzk_admin_master_gpu_token',
    activePlan: 'ENTERPRISE_ADMIN',
    totalShares: 0,
    createdAt: new Date().toISOString()
  });
})();

/**
 * POST /api/auth/register — Cadastro de novo minerador/assinante
 * Gera automaticamente um workerToken exclusivo para ele conectar no Google Colab
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, username, password, gpuModel, hasGpu } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.', code: 'MISSING_FIELDS' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (usersStore.has(cleanEmail)) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.', code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'usr_' + Date.now();
    const workerToken = 'pzk_' + crypto.randomBytes(12).toString('hex');

    const newUser = {
      id: userId,
      name: name || username || cleanEmail.split('@')[0],
      email: cleanEmail,
      username: username || cleanEmail.split('@')[0],
      passwordHash,
      role: 'USER',
      workerToken,
      activePlan: 'FREE_COMMUNITY',
      gpuModel: gpuModel || 'Google Colab Tesla T4',
      hasGpu: Boolean(hasGpu),
      totalShares: 0,
      createdAt: new Date().toISOString()
    };

    usersStore.set(cleanEmail, newUser);

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      username: newUser.username,
      name: newUser.name,
      role: newUser.role,
      workerToken: newUser.workerToken,
      activePlan: newUser.activePlan
    });

    res.status(201).json({
      success: true,
      message: 'Conta criada com sucesso! Seu workerToken exclusivo foi gerado.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        workerToken: newUser.workerToken,
        activePlan: newUser.activePlan
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login — Autenticação de Usuário e Admin
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.', code: 'MISSING_FIELDS' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = usersStore.get(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.', code: 'INVALID_CREDENTIALS' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.', code: 'INVALID_CREDENTIALS' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      workerToken: user.workerToken,
      activePlan: user.activePlan
    });

    res.json({
      success: true,
      message: 'Login realizado com sucesso.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        workerToken: user.workerToken,
        activePlan: user.activePlan
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me — Perfil do Usuário Logado
 */
router.get('/me', requireAuth, (req, res) => {
  const cleanEmail = req.user.email?.toLowerCase();
  const user = usersStore.get(cleanEmail) || req.user;

  res.json({
    success: true,
    user: {
      id: user.id || user.userId,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role || 'USER',
      workerToken: user.workerToken,
      activePlan: user.activePlan || 'FREE_COMMUNITY',
      totalShares: user.totalShares || 0
    }
  });
});

module.exports = router;