// ============================================
// 🧩 PuzzleRadar — Server Principal (Express & API)
// ============================================

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

// Routes
const authRoutes = require('./routes/auth');
const puzzleRoutes = require('./routes/puzzles');
const poolRoutes = require('./routes/pools');
const rangeRoutes = require('./routes/ranges');
const contributionRoutes = require('./routes/contributions');
const workerRoutes = require('./routes/workers');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3010;

// ─── MIDDLEWARES ───
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos do frontend (se compilado)
const frontendPublicPath = path.join(__dirname, '../../public');
const frontendDistPath = path.join(__dirname, '../../dist');
app.use(express.static(frontendPublicPath));
app.use(express.static(frontendDistPath));

// ─── HEALTH CHECK ───
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'PuzzleRadar',
    version: '2.0.0',
    features: ['crowdsourcing_workers', 'space_pruning', 'entropy_engine', 'bip39_checksum_filter'],
    timestamp: new Date().toISOString()
  });
});

// ─── ROTAS DA API ───
app.use('/api/auth', authRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/ranges', rangeRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── FALLBACK SPA ROUTE (para o frontend Next/React se buildado) ───
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Se ainda não houver dist/index.html, retorna mensagem JSON elegante
      res.status(200).json({
        service: 'PuzzleRadar API Gateway',
        status: 'online',
        endpoints: [
          '/health',
          '/api/puzzles',
          '/api/workers/active',
          '/api/ranges/available',
          '/api/dashboard'
        ],
        documentation: 'https://github.com/janiojandson/PuzzleRadar'
      });
    }
  });
});

// ─── ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('[PuzzleRadar Error]', err.message);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// ─── START SE EXECUTADO DIRETAMENTE ───
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧩 PuzzleRadar Server rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;