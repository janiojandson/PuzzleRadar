// ============================================
// 🧩 PuzzleRadar v3.0 — Server Principal (Express & API)
// ============================================

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

// Routes
const authRoutes = require('./routes/auth');
const puzzleRoutes = require('./routes/puzzles');
const puzzle1000btcRoutes = require('./routes/puzzle1000btc');
const poolRoutes = require('./routes/pools');
const rangeRoutes = require('./routes/ranges');
const contributionRoutes = require('./routes/contributions');
const workerRoutes = require('./routes/workers');
const dashboardRoutes = require('./routes/dashboard');
const advisorRoutes = require('./routes/advisor');
const nexusRoutes = require('./routes/nexus');
const discoveriesRoutes = require('./routes/discoveries');
const fleetRoutes = require('./routes/fleet');
const sandboxRoutes = require('./routes/sandbox');

const app = express();
const PORT = process.env.PORT || 3010;

// ─── MIDDLEWARES ───
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-nexus-key']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos do frontend
const frontendPublicPath = path.join(__dirname, '../../public');
const solverPath = path.join(__dirname, '../../solver');
app.use(express.static(frontendPublicPath));
app.use('/solver', express.static(solverPath));

// ─── HEALTH CHECK ───
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'PuzzleRadar',
    version: '3.0.0',
    features: [
      'crowdsourcing_workers',
      'google_colab_farm',
      'fleet_management_multi_account',
      'space_pruning',
      'google_sheets_archive',
      'intelligence_hub_discoveries',
      'solvers_cpp_repository',
      'learning_lab_sandbox',
      'puzzles_1000btc_master_160',
      'paginated_multi_chain_puzzles',
      'ai_math_advisor',
      'nexus_cerebro_integrated'
    ],
    timestamp: new Date().toISOString()
  });
});

// ─── ROTAS DA API ───
app.use('/api/auth', authRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/puzzle1000btc', puzzle1000btcRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/ranges', rangeRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/nexus', nexusRoutes);
app.use('/api/discoveries', discoveriesRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/sandbox', sandboxRoutes);

// ─── FALLBACK SPA ROUTE ───
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const indexPath = path.join(frontendPublicPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).json({
        service: 'PuzzleRadar v3.0 API Gateway',
        status: 'online',
        endpoints: [
          '/health',
          '/api/puzzles',
          '/api/puzzle1000btc',
          '/api/fleet',
          '/api/discoveries',
          '/api/sandbox/puzzles',
          '/api/workers/active',
          '/api/ranges/available',
          '/api/advisor/chat',
          '/api/nexus/status'
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
    console.log(`🧩 PuzzleRadar v3.0 Server rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;