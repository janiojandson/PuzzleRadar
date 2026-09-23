const assert = require('node:assert/strict');
const test = require('node:test');

const {
  formatFromAddress,
  sendEmailVerificationPin
} = require('../src/services/resendService');
const { bootstrapAdmin, createAuthRouter, ensureUserSchema } = require('../src/server/routes/auth');
const express = require('express');
const http = require('node:http');

function createPrismaMemory() {
  const users = new Map();
  const tokens = [];
  let nextTokenId = 1;

  return {
    users,
    user: {
      async findUnique({ where }) {
        return users.get(where.email) || [...users.values()].find((user) => user.id === where.id) || null;
      },
      async create({ data }) {
        const user = { id: `user-${users.size + 1}`, totalShares: 0, ...data, createdAt: new Date() };
        users.set(user.email, user);
        return user;
      },
      async update({ where, data }) {
        const user = await this.findUnique({ where });
        Object.assign(user, data);
        if (data.email && data.email !== user.email) users.delete(user.email);
        users.set(user.email, user);
        return user;
      },
      async upsert({ where, create, update }) {
        const existing = await this.findUnique({ where });
        if (existing) return this.update({ where, data: update });
        return this.create({ data: create });
      },
      async findMany() {
        return [...users.values()];
      },
      async delete({ where }) {
        const user = await this.findUnique({ where });
        users.delete(user.email);
        return user;
      }
    },
    emailVerificationToken: {
      async create({ data }) {
        const token = { id: String(nextTokenId++), usedAt: null, attempts: 0, ...data };
        tokens.push(token);
        return token;
      },
      async findFirst({ where }) {
        return tokens.find((token) => token.userId === where.userId && token.usedAt === null && token.expiresAt >= where.expiresAt.gte) || null;
      },
      async update({ where, data }) {
        const token = tokens.find((candidate) => candidate.id === where.id);
        Object.assign(token, data);
        return token;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const token of tokens) {
          if (token.userId === where.userId && token.usedAt === null) {
            Object.assign(token, data);
            count++;
          }
        }
        return { count };
      }
    }
  };
}

async function request(app, path, body) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('formats the verified bare Resend address with the configured sender name', () => {
  assert.equal(
    formatFromAddress('PuzzleRadar', 'seguranca@uebamix.com.br'),
    'PuzzleRadar <seguranca@uebamix.com.br>'
  );
});

test('rejects a Resend sender address that already contains display markup', () => {
  assert.throws(
    () => formatFromAddress('PuzzleRadar', 'PuzzleRadar <seguranca@uebamix.com.br>'),
    /bare verified address/i
  );
});

test('reports a Resend API error as an undelivered verification email', async () => {
  const result = await sendEmailVerificationPin({
    to: 'miner@example.com',
    pin: '123456',
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ message: 'sender is not verified' })
    }),
    apiKey: 're_test',
    from: 'PuzzleRadar <seguranca@uebamix.com.br>'
  });

  assert.deepEqual(result, {
    success: false,
    error: 'sender is not verified'
  });
});

test('bootstraps the configured master administrator as a verified Prisma user', async () => {
  const prisma = createPrismaMemory();
  const admin = await bootstrapAdmin(prisma, {
    adminEmail: 'master@puzzleradar.test',
    adminPassword: 'environment-only-password'
  });

  assert.equal(admin.email, 'master@puzzleradar.test');
  assert.equal(admin.role, 'ADMIN');
  assert.equal(admin.emailVerified, true);
  assert.match(admin.passwordHash, /^\$2[aby]\$/);
});

test('adds legacy authentication columns before administrator bootstrap on an older database', async () => {
  const statements = [];
  await ensureUserSchema({ $executeRawUnsafe: async statement => { statements.push(statement); } });
  assert.ok(statements.some(statement => statement.includes('ADD COLUMN IF NOT EXISTS "username"')));
  assert.ok(statements.some(statement => statement.includes('ADD COLUMN IF NOT EXISTS "passwordHash"')));
  assert.ok(statements.some(statement => statement.includes('ADD COLUMN IF NOT EXISTS "displayName"')));
  assert.ok(statements.some(statement => statement.includes('ADD COLUMN IF NOT EXISTS "role"')));
  assert.ok(statements.some(statement => statement.includes('ALTER COLUMN password DROP NOT NULL')));
});

test('requires a valid international WhatsApp number, email PIN, and matching password before customer login', async () => {
  const prisma = createPrismaMemory();
  let deliveredPin;
  const app = express();
  app.use(express.json());
  app.use(createAuthRouter({
    prisma,
    sendVerificationPin: async ({ pin }) => {
      deliveredPin = pin;
      return { success: true };
    },
    config: { jwtSecret: 'test-secret' }
  }));

  const rejected = await request(app, '/register', {
    name: 'Miner', email: 'miner@example.com', username: 'miner',
    whatsapp: '21999999999', password: 'safe-password', confirmPassword: 'safe-password'
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.code, 'INVALID_WHATSAPP');

  const registration = await request(app, '/register', {
    name: 'Miner', email: 'miner@example.com', username: 'miner',
    whatsapp: '+351912345678', password: 'safe-password', confirmPassword: 'safe-password'
  });
  assert.equal(registration.status, 201);
  assert.equal(prisma.users.get('miner@example.com').whatsapp, '+351912345678');
  assert.equal(prisma.users.get('miner@example.com').emailVerified, false);

  const pendingLogin = await request(app, '/login', { email: 'miner@example.com', password: 'safe-password' });
  assert.equal(pendingLogin.status, 403);
  assert.equal(pendingLogin.body.code, 'EMAIL_NOT_VERIFIED');

  const verification = await request(app, '/verify-email/confirm-pin', { email: 'miner@example.com', pin: deliveredPin });
  assert.equal(verification.status, 200);

  const login = await request(app, '/login', { email: 'miner@example.com', password: 'safe-password' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, 'miner@example.com');
});
