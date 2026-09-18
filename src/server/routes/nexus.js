// ============================================
// 🧩 PuzzleRadar v3.0 — Rotas de Integração com Nexus Cérebro (Membro PuzzleRadar)
// Porta 3010 — Compatível com OpenAI Tool Calling do Cérebro
// ============================================

const express = require('express');
const { getSheetsStats } = require('../../lib/googleSheets');
const { getPruningStats } = require('../../lib/redis');
const { onChainWatcher } = require('../../services/onChainWatcher');
const { cryptoAnalystAgent } = require('../../services/cryptoAnalystAgent');

const router = express.Router();

const NEXUS_CEREBRO_URL = process.env.NEXUS_CEREBRO_URL || 'https://nexus-cerebro-production-a7c0.up.railway.app';
const NEXUS_API_KEY = process.env.NEXUS_API_KEY || 'nexus-key';

const { loteManager } = require('../../services/loteManager');
const { dataAggregator } = require('../../services/dataAggregator');

// ─── ARSENAL DE FERRAMENTAS EXPOSTAS AO CÉREBRO ───
const ARSENAL = [
  {
    name: 'consultar_status_puzzleradar',
    description: 'Consulta status completo da infraestrutura do PuzzleRadar (Pools, Entropia, Sheets, Redução de Busca).',
    parameters: { type: 'object', properties: {}, required: [] },
    funcao: async () => {
      const sheets = await getSheetsStats().catch(() => ({ status: 'indisponível' }));
      const pruning = await getPruningStats('puzzle_btc_66', 10000).catch(() => ({ status: 'indisponível' }));
      const watcher = onChainWatcher.getStatusSummary();
      const coordStats = loteManager.getStats(71);
      return {
        status: 'ONLINE',
        versao: '5.0.0',
        coordinator: coordStats,
        sheetsStorage: sheets,
        pruningStats: pruning,
        onChainWatcher: watcher,
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: 'obter_proximo_range_priorizado',
    description: 'Obtém o próximo lote custom_range com maior priority_score para minerador GPU do Bitcoin Puzzle 71.',
    parameters: {
      type: 'object',
      properties: {
        workerId: { type: 'string', description: 'Identificador do worker GPU (ex: rig_rtx4090_01).' },
        hashrate: { type: 'string', description: 'Hashrate estimado para dimensionamento adaptativo do lote (ex: 5 GH/s).' }
      },
      required: ['workerId']
    },
    funcao: async (workerId, hashrate) => {
      return await loteManager.getNextOptimalRange(workerId || 'cerebro_auto_worker', hashrate);
    }
  },
  {
    name: 'consultar_estatisticas_pool_externo',
    description: 'Consulta estatísticas de fatias e rate limits de sincronização com btcpuzzle.info e theCollider.',
    parameters: {
      type: 'object',
      properties: {
        puzzleNumber: { type: 'number', description: 'Número do puzzle (default 71).' }
      },
      required: []
    },
    funcao: async (puzzleNumber) => {
      const pNum = puzzleNumber || 71;
      const btcInfo = await dataAggregator.fetchBtcpuzzleRanges(pNum);
      const rates = dataAggregator.getRateLimitStats();
      const loteStats = loteManager.getStats(pNum);
      return {
        puzzle: pNum,
        coordinator: loteStats,
        btcpuzzleExternal: btcInfo,
        rateLimits: rates
      };
    }
  },
  {
    name: 'sincronizar_fatias_thecollider',
    description: 'Aciona a sincronização das fatias já verificadas pela comunidade global no theCollider.',
    parameters: { type: 'object', properties: {}, required: [] },
    funcao: async () => {
      return await dataAggregator.syncTheColliderRanges();
    }
  },
  {
    name: 'avaliar_desafio_criptografico',
    description: 'Avalia um novo desafio de chave privada Bitcoin/Ethereum ou CTF usando a engine de IA matemática do PuzzleRadar.',
    parameters: {
      type: 'object',
      properties: {
        rawText: { type: 'string', description: 'Texto ou dados do desafio criptográfico a ser avaliado.' },
        fleetHashrate: { type: 'string', description: 'Hashrate estimado disponível (opcional, ex: 100MKeys/s).' }
      },
      required: ['rawText']
    },
    funcao: async (rawText, fleetHashrate) => {
      return await cryptoAnalystAgent.ingestAndEvaluate(rawText, fleetHashrate);
    }
  },
  {
    name: 'consultar_pool_chaves',
    description: 'Obtém estatísticas de Distinguished Points (DPs) e progresso de colisão Kangaroo para o Puzzle ativo.',
    parameters: {
      type: 'object',
      properties: {
        puzzleId: { type: 'string', description: 'Identificador do puzzle (ex: puzzle_btc_66 ou puzzle_btc_71).' }
      },
      required: ['puzzleId']
    },
    funcao: async (puzzleId) => {
      const pruning = await getPruningStats(puzzleId || 'puzzle_btc_66', 10000).catch(err => ({ error: err.message }));
      return {
        puzzle: puzzleId || 'puzzle_btc_66',
        dados: pruning,
        consultadoEm: new Date().toISOString()
      };
    }
  }
];

// ─── 1. ENDPOINT PARA CONSULTA DE FERRAMENTAS DO MEMBRO ───
router.get('/ferramentas', (req, res) => {
  res.json({
    membro: 'Membro PuzzleRadar',
    id: 'membro-puzzleradar',
    total: ARSENAL.length,
    ferramentas: ARSENAL.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))
  });
});

// ─── 2. ENDPOINT PARA EXECUÇÃO DE FERRAMENTAS VIA CÉREBRO ───
router.post('/executar', async (req, res) => {
  const { ferramenta, argumentos } = req.body;

  try {
    const tool = ARSENAL.find(t => t.name === ferramenta);
    if (!tool) {
      return res.status(404).json({
        sucesso: false,
        erro: `Ferramenta "${ferramenta}" não encontrada no Membro PuzzleRadar.`
      });
    }

    console.log(`🔧 [Membro PuzzleRadar] Executando: ${ferramenta}`);
    const argsObj = typeof argumentos === 'string' ? JSON.parse(argumentos) : (argumentos || {});
    const argsArray = Object.values(argsObj);

    const resultado = await tool.funcao(...argsArray);

    res.json({
      sucesso: true,
      ferramenta,
      resultado: typeof resultado === 'string' ? resultado : JSON.stringify(resultado),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ [Membro PuzzleRadar] Erro em ${ferramenta}:`, error.message);
    res.status(500).json({
      sucesso: false,
      ferramenta,
      erro: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ─── 3. STATUS & TELEMETRIA ───
router.get('/status', async (req, res) => {
  try {
    const sheetsStats = await getSheetsStats();
    const pruningStats = await getPruningStats('puzzle_btc_66', 10000);

    res.json({
      service: 'PuzzleRadar v3.0',
      status: 'ONLINE',
      memberId: 'membro-puzzleradar',
      role: 'Cryptographic Search Engine & Saco Completo Pool',
      port: 3010,
      ferramentas: ARSENAL.length,
      sheetsStorage: sheetsStats,
      pruning: pruningStats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. REGISTRO & HEARTBEAT AUTOMÁTICO COM O CÉREBRO ───
async function registrarNoCerebro() {
  const payload = {
    id: 'membro-puzzleradar',
    nome: 'Membro PuzzleRadar',
    url: process.env.MEMBRO_URL || `http://localhost:${process.env.PORT || 3010}`,
    porta: parseInt(process.env.PORT || 3010),
    tipo: 'servico_especializado',
    descricao: 'Motor de busca criptográfica em curva elíptica secp256k1, redução de entropia e pools.',
    ferramentas: ARSENAL.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    })),
    versao: '3.0.0'
  };

  const url = `${NEXUS_CEREBRO_URL.replace(/\/+$/, '')}/api/cerebro/registrar`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': NEXUS_API_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      console.log('✅ [PuzzleRadar] Registrado no Nexus Cérebro com sucesso!');
    } else {
      console.warn(`⚠️ [PuzzleRadar] Resposta do registro no Cérebro: HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn(`⚠️ [PuzzleRadar] Cérebro inacessível (${e.message}). Reconectará no heartbeat.`);
  }
}

function iniciarHeartbeat() {
  const url = `${NEXUS_CEREBRO_URL.replace(/\/+$/, '')}/api/cerebro/heartbeat`;
  setInterval(async () => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': NEXUS_API_KEY },
        body: JSON.stringify({
          membroId: 'membro-puzzleradar',
          ferramentas: ARSENAL.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
          versao: '3.0.0'
        }),
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json().catch(() => null);
      if (data?.sucesso === false && data.erro?.includes('não registrado')) {
        console.log('⚠️ [PuzzleRadar] Cérebro reiniciou. Re-registrando...');
        registrarNoCerebro();
      }
    } catch (_) {}
  }, 15000);
}

// Inicializa registro ao carregar módulo
setTimeout(() => {
  registrarNoCerebro();
  iniciarHeartbeat();
}, 2000);

module.exports = router;

