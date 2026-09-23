const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const { generateToken, requireAuth } = require('../../lib/auth');
const { sendEmailVerificationPin } = require('../../services/resendService');

const E164_WHATSAPP = /^\+[1-9]\d{7,14}$/;
const PIN_TTL_MS = 10 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 5;

// Kept only for legacy worker/pool consumers. Authentication always reads Prisma.
const usersStore = new Map();

function defaultConfig() {
  return {
    adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD,
    adminWhatsapp: process.env.ADMIN_WHATSAPP || '+10000000000'
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name || user.displayName || user.username,
    email: user.email,
    username: user.username,
    role: user.role,
    workerToken: user.workerToken,
    activePlan: user.activePlan || 'FREE_COMMUNITY',
    payoutAddress: user.payoutAddress || null,
    hardwareType: user.hardwareType || user.gpuModel || 'Padrão',
    whatsapp: user.whatsapp,
    totalShares: user.totalShares || 0,
    createdAt: user.createdAt
  };
}

function cacheUser(user) {
  if (user?.email) usersStore.set(user.email.toLowerCase(), user);
  return user;
}

async function ensureUserSchema(prismaClient = prisma) {
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "displayName" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workerToken" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payoutAddress" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hardwareType" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activePlan" TEXT NOT NULL DEFAULT \'FREE_COMMUNITY\'');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gpuModel" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpuModel" TEXT');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasGpu" BOOLEAN NOT NULL DEFAULT FALSE');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totalShares" DOUBLE PRECISION NOT NULL DEFAULT 0');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await prismaClient.$executeRawUnsafe('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await prismaClient.$executeRawUnsafe(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
      EXECUTE 'UPDATE "users" SET "passwordHash" = password_hash WHERE "passwordHash" IS NULL';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') THEN
      EXECUTE 'UPDATE "users" SET "passwordHash" = password WHERE "passwordHash" IS NULL';
    END IF;
  END $$`);
  await prismaClient.$executeRawUnsafe("UPDATE \"users\" SET \"username\" = CONCAT(REGEXP_REPLACE(SPLIT_PART(\"email\", '@', 1), '[^a-zA-Z0-9_]', '_', 'g'), '_', SUBSTRING(\"id\" FROM 1 FOR 6)) WHERE \"username\" IS NULL");
  await prismaClient.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username")');
}

async function bootstrapAdmin(prismaClient = prisma, config = defaultConfig()) {
  const adminEmail = config.adminEmail?.trim().toLowerCase();
  const adminPassword = config.adminPassword;
  if (!adminEmail || !adminPassword) return null;

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const username = adminEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) || 'admin';
  const admin = await prismaClient.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'ADMIN',
      emailVerified: true,
      name: 'Admin Master',
      displayName: 'Admin PuzzleRadar'
    },
    create: {
      email: adminEmail,
      username,
      passwordHash,
      name: 'Admin Master',
      displayName: 'Admin PuzzleRadar',
      role: 'ADMIN',
      emailVerified: true,
      whatsapp: config.adminWhatsapp || '+10000000000',
      activePlan: 'ENTERPRISE_ADMIN',
      hasGpu: true,
      gpuModel: 'NVIDIA RTX 4090'
    }
  });
  return cacheUser(admin);
}

function issueSession(user) {
  return generateToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    name: user.name || user.displayName,
    role: user.role,
    workerToken: user.workerToken,
    activePlan: user.activePlan
  });
}

function createAuthRouter({ prisma: prismaClient = prisma, sendVerificationPin = sendEmailVerificationPin, config = defaultConfig() } = {}) {
  const router = express.Router();

  async function createAndDeliverPin(user) {
    const pin = String(crypto.randomInt(100000, 1000000));
    await prismaClient.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }
    });
    await prismaClient.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(pin, 10),
        expiresAt: new Date(Date.now() + PIN_TTL_MS),
        attempts: 0
      }
    });
    return sendVerificationPin({ to: user.email, pin });
  }

  router.post('/register', async (req, res) => {
    try {
      const { name, email, username, password, confirmPassword, whatsapp, gpuModel, hasGpu } = req.body;
      if (!email || !password || !confirmPassword || !whatsapp) {
        return res.status(400).json({ error: 'E-mail, senha, confirmação de senha e WhatsApp são obrigatórios.', code: 'MISSING_FIELDS' });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'As senhas não coincidem.', code: 'PASSWORD_MISMATCH' });
      }
      if (!E164_WHATSAPP.test(String(whatsapp).trim())) {
        return res.status(400).json({ error: 'Informe o WhatsApp no formato internacional E.164.', code: 'INVALID_WHATSAPP' });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      if (await prismaClient.user.findUnique({ where: { email: cleanEmail } })) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado.', code: 'EMAIL_EXISTS' });
      }

      const cleanUsername = String(username || cleanEmail.split('@')[0]).trim() || cleanEmail.split('@')[0];
      const user = await prismaClient.user.create({
        data: {
          name: String(name || cleanUsername).trim(),
          email: cleanEmail,
          username: cleanUsername,
          passwordHash: await bcrypt.hash(password, 12),
          whatsapp: String(whatsapp).trim(),
          emailVerified: false,
          role: 'USER',
          workerToken: `pzk_${crypto.randomBytes(12).toString('hex')}`,
          activePlan: 'FREE_COMMUNITY',
          gpuModel: gpuModel || 'Google Colab Tesla T4',
          hasGpu: Boolean(hasGpu),
          payoutAddress: req.body.payoutAddress || null,
          hardwareType: req.body.hardwareType || req.body.gpuModel || 'Padrão'
        }
      });
      const delivery = await createAndDeliverPin(user);
      if (!delivery?.success) {
        await prismaClient.emailVerificationToken.deleteMany?.({ where: { userId: user.id } });
        await prismaClient.user.delete({ where: { id: user.id } });
        return res.status(502).json({ error: 'Não foi possível enviar o código de confirmação. Tente novamente.', code: 'EMAIL_DELIVERY_FAILED' });
      }
      cacheUser(user);
      return res.status(201).json({
        success: true,
        message: 'Conta criada. Confirme o código enviado ao seu e-mail para entrar.',
        user: toPublicUser(user)
      });
    } catch (err) {
      return res.status(500).json({ error: 'Não foi possível criar a conta.', code: 'REGISTRATION_FAILED' });
    }
  });

  router.post('/verify-email/request-pin', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const user = email && await prismaClient.user.findUnique({ where: { email } });
      if (!user) return res.status(200).json({ success: true, message: 'Se existir uma conta pendente, um novo código será enviado.' });
      if (user.emailVerified) return res.status(400).json({ error: 'Este e-mail já foi confirmado.', code: 'EMAIL_ALREADY_VERIFIED' });
      const delivery = await createAndDeliverPin(user);
      if (!delivery?.success) return res.status(502).json({ error: 'Não foi possível enviar o código de confirmação.', code: 'EMAIL_DELIVERY_FAILED' });
      return res.json({ success: true, message: 'Código de confirmação enviado.' });
    } catch (err) {
      return res.status(500).json({ error: 'Não foi possível solicitar o código.', code: 'PIN_REQUEST_FAILED' });
    }
  });

  router.post('/verify-email/confirm-pin', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const pin = String(req.body.pin || '').trim();
      const user = email && await prismaClient.user.findUnique({ where: { email } });
      if (!user || !pin) return res.status(400).json({ error: 'Código inválido ou expirado.', code: 'INVALID_PIN' });
      const verification = await prismaClient.emailVerificationToken.findFirst({
        where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' }
      });
      if (!verification || verification.attempts >= MAX_PIN_ATTEMPTS) {
        return res.status(400).json({ error: 'Código inválido ou expirado.', code: 'INVALID_PIN' });
      }
      if (!await bcrypt.compare(pin, verification.tokenHash)) {
        await prismaClient.emailVerificationToken.update({
          where: { id: verification.id },
          data: { attempts: verification.attempts + 1, ...(verification.attempts + 1 >= MAX_PIN_ATTEMPTS ? { usedAt: new Date() } : {}) }
        });
        return res.status(400).json({ error: 'Código inválido ou expirado.', code: 'INVALID_PIN' });
      }
      const verifiedUser = await prismaClient.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      await prismaClient.emailVerificationToken.update({ where: { id: verification.id }, data: { usedAt: new Date() } });
      cacheUser(verifiedUser);
      return res.json({ success: true, message: 'E-mail confirmado com sucesso.' });
    } catch (err) {
      return res.status(500).json({ error: 'Não foi possível confirmar o código.', code: 'PIN_CONFIRMATION_FAILED' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.', code: 'MISSING_FIELDS' });
      const user = await prismaClient.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Credenciais inválidas.', code: 'INVALID_CREDENTIALS' });
      }
      if (user.role !== 'ADMIN' && !user.emailVerified) {
        return res.status(403).json({ error: 'Confirme seu e-mail antes de entrar.', code: 'EMAIL_NOT_VERIFIED' });
      }
      cacheUser(user);
      return res.json({ success: true, message: 'Login realizado com sucesso.', token: issueSession(user), user: toPublicUser(user) });
    } catch (err) {
      return res.status(500).json({ error: 'Não foi possível realizar o login.', code: 'LOGIN_FAILED' });
    }
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await prismaClient.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.', code: 'USER_NOT_FOUND' });
    cacheUser(user);
    return res.json({ success: true, user: toPublicUser(user) });
  });

  router.get('/users', requireAuth, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
    const users = await prismaClient.user.findMany({ orderBy: { createdAt: 'desc' } });
    users.forEach(cacheUser);
    return res.json({ success: true, total: users.length, users: users.map(toPublicUser) });
  });

  router.put('/users/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
    const target = await prismaClient.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.', code: 'USER_NOT_FOUND' });
    const update = {};
    for (const key of ['name', 'payoutAddress', 'hardwareType', 'activePlan']) if (req.body[key] !== undefined) update[key] = String(req.body[key]).trim();
    if (req.body.role === 'USER' || req.body.role === 'ADMIN') update.role = req.body.role;
    if (req.body.password?.length >= 6) update.passwordHash = await bcrypt.hash(req.body.password, 12);
    if (req.body.email && String(req.body.email).trim().toLowerCase() !== target.email) {
      update.email = String(req.body.email).trim().toLowerCase();
      update.username = update.email.split('@')[0];
    }
    const updated = await prismaClient.user.update({ where: { id: target.id }, data: update });
    usersStore.delete(target.email);
    cacheUser(updated);
    return res.json({ success: true, message: 'Usuário atualizado com sucesso.', user: toPublicUser(updated) });
  });

  router.delete('/users/:id', requireAuth, async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Acesso restrito ao administrador.', code: 'FORBIDDEN' });
    const target = await prismaClient.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.', code: 'USER_NOT_FOUND' });
    if (target.email === config.adminEmail) return res.status(400).json({ error: 'Não é permitido excluir o Administrador Master.', code: 'CANNOT_DELETE_MASTER_ADMIN' });
    await prismaClient.user.delete({ where: { id: target.id } });
    usersStore.delete(target.email);
    return res.json({ success: true, message: `Usuário ${target.name || target.username} excluído com sucesso.` });
  });

  return router;
}

const router = createAuthRouter();
router.usersStore = usersStore;
router.createAuthRouter = createAuthRouter;
router.bootstrapAdmin = bootstrapAdmin;
router.ensureUserSchema = ensureUserSchema;
router.E164_WHATSAPP = E164_WHATSAPP;

module.exports = router;
