// ============================================
// 🧩 PuzzleRadar — Server Principal (Express)
// ============================================

require('dotenv').config();
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
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── HEALTH CHECK ───
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'PuzzleRadar',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ─── ROTAS ───
app.use('/api/auth', authRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/ranges', rangeRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('[PuzzleRadar Error]', err.message);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Erro interno do servidor',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// ─── START ───
app.listen(PORT, () => {
  console.log(`🧩 PuzzleRadar rodando na porta ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;