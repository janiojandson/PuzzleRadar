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
const kangarooRoutes = require('./routes/kangaroo');
const rangeRoutesV5 = require('./routes/range');
const webhookRoutes = require('./routes/webhook');
const leaderboardRoutes = require('./routes/leaderboard');
const scriptsRoutes = require('./routes/scripts');
const apiRoutes = require('./routes/api');
const { router: telemetryRoutes } = require('./routes/telemetry');

const app = express();
const PORT = process.env.PORT || 3010;

// ─── MIDDLEWARES ───
app.use(compression());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-nexus-key', 'x-puzzleradar-token', 'status', 'hex', 'privatekey', 'targetpuzzle', 'workername']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir scripts de 1-clique /start.ps1 e /start.sh na raiz
app.use('/', scriptsRoutes);

// Servir arquivos estáticos do frontend
const frontendPublicPath = path.join(__dirname, '../../public');
const solverPath = path.join(__dirname, '../../solver');
const rootPath = path.join(__dirname, '../../');
app.use(express.static(frontendPublicPath));
app.use('/solver', express.static(solverPath));
app.use(express.static(rootPath, { index: false }));

// ─── HEALTH CHECK ───
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'PuzzleRadar',
    version: '5.1.0',
    mode: 'AUTONOMOUS_COORDINATOR_V5_1_WHITE_LABEL',
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
      'nexus_cerebro_integrated',
      'kangaroo_distributed_v4',
      'btcpuzzle_coordinator_v5',
      'hamming_weight_engine_v5',
      'low_range_bias_filter_v5',
      'external_data_aggregator_v5',
      'web_browser_mining_v5_1',
      'one_click_scripts_v5_1',
      'community_leaderboard_v5_1'
    ],
    timestamp: new Date().toISOString()
  });
});

// Services
const { onChainWatcher } = require('../services/onChainWatcher');
const { antiMevRescue } = require('../services/antiMevRescue');
const { honeypotShield } = require('../services/honeypotShield');
const { cryptoAnalystAgent } = require('../services/cryptoAnalystAgent');

// ─── ROTAS DA API ───
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes); // Diagnóstico de Pool (/api/diag/pool-connection) e Sheets Ping (/api/sheets/test-ping)
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/puzzle1000btc', puzzle1000btcRoutes);
app.use('/api/pools', poolRoutes);
app.use('/api/pool', poolRoutes); // Alias para /api/pool/job, /api/pool/submit-point
app.use('/api/ranges', rangeRoutes);
app.use('/api/range', rangeRoutesV5); // Coordenador v5.0 (/api/range/next/:worker_id)
app.use('/api/webhook', webhookRoutes); // Webhook btcpuzzle (/api/webhook/btcpuzzle)
app.use('/api/admin', webhookRoutes); // Admin routes (/api/admin/test-whatsapp, /api/admin/whatsapp-status)
app.use('/api/leaderboard', leaderboardRoutes); // Leaderboard Comunitário (/api/leaderboard)
app.use('/api/status', rangeRoutesV5); // Alias direto para status do coordenador
app.use('/api/progress', rangeRoutesV5); // Alias direto para progresso do coordenador
app.use('/api/contributions', contributionRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/nexus', nexusRoutes);
app.use('/api/membro', nexusRoutes); // Alias para padrão de membros do Cérebro
app.use('/api/discoveries', discoveriesRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/kangaroo', kangarooRoutes);

// ─── ENDPOINTS DO AGENTE ANALISTA IA (GEMINI & NEXUS) ───
app.get('/api/analyst/feed', (req, res) => {
  res.json({
    success: true,
    feed: cryptoAnalystAgent.getFeed(),
    pending: cryptoAnalystAgent.getPendingOpportunities()
  });
});

app.post('/api/analyst/evaluate', async (req, res) => {
  try {
    const { rawText, fleetHashrate } = req.body;
    const result = await cryptoAnalystAgent.ingestAndEvaluate(rawText || '', fleetHashrate);
    res.json({ success: true, opportunity: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyst/approve', async (req, res) => {
  try {
    const { targetId, operator } = req.body;
    const result = await cryptoAnalystAgent.approveTargetCommand(targetId, operator);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ENDPOINT DE RESGATE SEGURO (ANTI-MEV) ───
app.post('/api/secure-rescue', async (req, res) => {
  try {
    const result = await antiMevRescue.executeRescue(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/secure-rescue/history', (req, res) => {
  res.json({
    success: true,
    rescues: antiMevRescue.getRescueLogs(),
    vaults: {
      BTC: antiMevRescue.getVaultDestination('BTC'),
      ETH: antiMevRescue.getVaultDestination('ETH'),
      SOL: antiMevRescue.getVaultDestination('SOL')
    }
  });
});

// ─── ENDPOINT DO SENTINELA ON-CHAIN & AUDITORIA ───
app.get('/api/sentinel/status', (req, res) => {
  res.json(onChainWatcher.getStatusSummary());
});

app.get('/api/honeypot/audit', async (req, res) => {
  const { address, chain } = req.query;
  const audit = await honeypotShield.auditContractChallenge(address, chain);
  res.json(audit);
});

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
          '/api/pool/job',
          '/api/pool/stats',
          '/api/secure-rescue',
          '/api/sentinel/status',
          '/api/fleet',
          '/api/discoveries',
          '/api/sandbox/puzzles'
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
  authRoutes.bootstrapAdmin().then(() => {
  // 1. Verificação Criptográfica de Boot (Quarentena preventiva)
  const { verifySecp256k1KeyPair } = require('../lib/cryptoVerifier');
  const samplePubKey = '03a2edd49e819e4d0473cf694931a5eb8db846ee74f4842188ab642784cf072895';
  const sampleAddr = '1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU';
  const bootAudit = verifySecp256k1KeyPair(samplePubKey, sampleAddr);
  console.log(`🔐 [Boot Integrity] Validação criptográfica do par de chaves ativo (Puzzle #71): ${bootAudit ? '✅ ÍNTEGRO' : '🚨 FALHA'}`);

  // 2. Inicia o sentinela on-chain em segundo plano
  onChainWatcher.start();

  // 3. Inicia o cron de limpeza de DPs órfãos do Kangaroo (TTL 24h)
  const kangarooManager = require('../lib/kangarooManager');
  kangarooManager.startCleanupCron();
  console.log('🦘 [Kangaroo v4.0] Cleanup cron iniciado (DPs órfãos expiram em 24h)');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🧩 PuzzleRadar v4.0 Server rodando na porta ${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🛡️ Sentinela On-Chain & Anti-MEV Engine Ativos`);
    console.log(`🦘 Kangaroo Pool: /api/kangaroo/submit-dp | /api/kangaroo/seed | /api/kangaroo/stats`);
  });
  }).catch((error) => {
    console.error('[PuzzleRadar] Falha ao inicializar o administrador configurado:', error.message);
    process.exit(1);
  });
}

module.exports = app;
