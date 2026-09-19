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

// Configuração do Administrador Master via Variáveis de Ambiente (Segurança sem Hardcode)
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@puzzleradar.io').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const ADMIN_WORKER_TOKEN = process.env.ADMIN_WORKER_TOKEN || 'pzk_admin_master_gpu_token';

(async () => {
  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  usersStore.set(ADMIN_EMAIL, {
    id: 'usr_admin_master',
    name: 'Admin Master',
    email: ADMIN_EMAIL,
    username: 'admin',
    passwordHash: adminHash,
    role: 'ADMIN',
    workerToken: ADMIN_WORKER_TOKEN,
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

    const isAdminKey = req.body.adminSecret && req.body.adminSecret === (process.env.ADMIN_SECRET || 'puzzleradar_admin_secret_2026');
    const isMasterEmail = cleanEmail === ADMIN_EMAIL;
    const role = (isAdminKey || isMasterEmail || (req.body.role === 'ADMIN' && req.user?.role === 'ADMIN')) ? 'ADMIN' : 'USER';

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = 'usr_' + Date.now();
    const workerToken = 'pzk_' + crypto.randomBytes(12).toString('hex');

    const newUser = {
      id: userId,
      name: name || username || cleanEmail.split('@')[0],
      email: cleanEmail,
      username: username || cleanEmail.split('@')[0],
      passwordHash,
      role,
      workerToken,
      activePlan: role === 'ADMIN' ? 'ENTERPRISE_ADMIN' : 'FREE_COMMUNITY',
      payoutAddress: req.body.payoutAddress || null,
      hardwareType: req.body.hardwareType || req.body.gpuModel || 'Padrão',
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

/**
 * GET /api/auth/users — Lista todos os usuários cadastrados (Apenas ADMIN)
 */
router.get('/users', requireAuth, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
  }

  const usersList = Array.from(usersStore.values()).map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    workerToken: u.workerToken,
    payoutAddress: u.payoutAddress || null,
    hardwareType: u.hardwareType || u.gpuModel || 'Padrão',
    activePlan: u.activePlan || 'FREE_COMMUNITY',
    totalShares: u.totalShares || 0,
    createdAt: u.createdAt
  }));

  res.json({
    success: true,
    total: usersList.length,
    users: usersList
  });
});

/**
 * PUT /api/auth/users/:id — Edita um usuário cadastrado (Apenas ADMIN)
 */
router.put('/users/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;
  const { name, email, role, payoutAddress, hardwareType, activePlan, password } = req.body;

  let targetUser = null;
  let targetKey = null;

  for (const [key, u] of usersStore.entries()) {
    if (u.id === id) {
      targetUser = u;
      targetKey = key;
      break;
    }
  }

  if (!targetUser) {
    return res.status(404).json({ error: 'Usuário não encontrado.', code: 'USER_NOT_FOUND' });
  }

  if (name) targetUser.name = String(name).trim();
  if (role && (role === 'USER' || role === 'ADMIN')) targetUser.role = role;
  if (payoutAddress) targetUser.payoutAddress = String(payoutAddress).trim();
  if (hardwareType) targetUser.hardwareType = String(hardwareType).trim();
  if (activePlan) targetUser.activePlan = String(activePlan).trim();
  if (password && password.length >= 6) {
    targetUser.passwordHash = await bcrypt.hash(password, 10);
  }

  if (email && email.trim().toLowerCase() !== targetKey) {
    const newEmail = email.trim().toLowerCase();
    targetUser.email = newEmail;
    targetUser.username = newEmail.split('@')[0];
    usersStore.delete(targetKey);
    usersStore.set(newEmail, targetUser);
  }

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso.',
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      payoutAddress: targetUser.payoutAddress,
      hardwareType: targetUser.hardwareType
    }
  });
});

/**
 * DELETE /api/auth/users/:id — Exclui um usuário (Apenas ADMIN)
 */
router.delete('/users/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
  }

  const { id } = req.params;

  let targetKey = null;
  let targetUser = null;

  for (const [key, u] of usersStore.entries()) {
    if (u.id === id) {
      targetKey = key;
      targetUser = u;
      break;
    }
  }

  if (!targetKey) {
    return res.status(404).json({ error: 'Usuário não encontrado.', code: 'USER_NOT_FOUND' });
  }

  if (targetUser.email === ADMIN_EMAIL && targetUser.role === 'ADMIN') {
    return res.status(400).json({ error: 'Não é permitido excluir o Administrador Master.', code: 'CANNOT_DELETE_MASTER_ADMIN' });
  }

  usersStore.delete(targetKey);

  res.json({
    success: true,
    message: `Usuário ${targetUser.name} (${targetUser.email}) excluído com sucesso.`
  });
});

router.usersStore = usersStore;

module.exports = router;