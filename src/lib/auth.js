// ============================================
// 🧩 PuzzleRadar — Middleware de Autenticação
// ============================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'puzzleradar-dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Gera JWT token com tenant_id
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Verifica e decodifica JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware: exige autenticação
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido', code: 'UNAUTHORIZED' });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido ou expirado', code: 'INVALID_TOKEN' });
  }
  
  req.user = decoded;
  next();
}

/**
 * Middleware: exige role específica
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado', code: 'UNAUTHORIZED' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente', code: 'FORBIDDEN' });
    }
    next();
  };
}

/**
 * Middleware: exige que o tenant_id do token corresponda ao da requisição
 */
function requireTenantMatch(req, res, next) {
  const requestTenant = req.params.orgId || req.body.organizationId || req.query.orgId;
  if (requestTenant && req.user.organizationId && requestTenant !== req.user.organizationId) {
    return res.status(403).json({ error: 'Acesso negado a este tenant', code: 'TENANT_MISMATCH' });
  }
  next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireRole, requireTenantMatch };