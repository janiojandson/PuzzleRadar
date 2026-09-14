// ============================================
// 🧩 PuzzleRadar — Rotas do Mural de Inteligência (Discoveries)
// ============================================
// Gerencia pistas comunitárias, sementes parciais (12 palavras de ETH) e máscaras
// ============================================

const express = require('express');
const prisma = require('../../lib/prisma');
const { calculateEntropyReduction } = require('../../lib/difficultyEngine');
const { syncPublicAllianceRanges } = require('../../services/publicScraper');

const router = express.Router();

// Mock store em memória para pistas
const memoryDiscoveries = [
  {
    id: 'disc_eth_01',
    puzzleId: 'puzzle_eth_101',
    title: 'Descoberta de 8 palavras da semente ETH Challenge #101',
    hintType: 'SEED_WORDS',
    fragment: 'abandon ability able about above absent absorb abstract',
    seedWords: 'abandon ability able about above absent absorb abstract',
    knownBitsCount: 88,
    confidence: 100.0,
    authorName: 'SatoshiSeeker_0x',
    isVerified: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'disc_btc_66',
    puzzleId: 'puzzle_btc_66',
    title: 'Padrão de prefixo confirmado para o Puzzle #66',
    hintType: 'MASK_PREFIX',
    fragment: '0x20...',
    seedWords: null,
    knownBitsCount: 8,
    confidence: 95.0,
    authorName: 'CryptoTreasureHunter',
    isVerified: true,
    createdAt: new Date().toISOString()
  }
];

/**
 * GET /api/discoveries — Lista todas as pistas do Mural de Inteligência
 */
router.get('/', async (req, res) => {
  try {
    const { puzzleId, hintType } = req.query;
    
    let list = memoryDiscoveries;
    try {
      const dbList = await prisma.discoveryHint.findMany({
        where: {
          ...(puzzleId ? { puzzleId } : {}),
          ...(hintType ? { hintType } : {})
        },
        orderBy: { createdAt: 'desc' }
      });
      if (dbList && dbList.length > 0) {
        list = dbList;
      }
    } catch (dbErr) {}

    res.json({
      total: list.length,
      discoveries: list
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/discoveries — Registra uma nova pista no mural
 */
router.post('/', async (req, res) => {
  try {
    const { puzzleId, title, hintType, fragment, seedWords, knownBitsCount, authorName, confidence } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título da pista é obrigatório.' });
    }

    const newHint = {
      id: `disc_${Date.now()}`,
      puzzleId: puzzleId || 'puzzle_btc_66',
      title,
      hintType: hintType || 'SEED_WORDS',
      fragment: fragment || null,
      seedWords: seedWords || null,
      knownBitsCount: Number(knownBitsCount) || 0,
      confidence: Number(confidence) || 100.0,
      authorName: authorName || 'Cypherpunk Contributor',
      isVerified: true,
      createdAt: new Date().toISOString()
    };

    memoryDiscoveries.unshift(newHint);

    try {
      await prisma.discoveryHint.create({
        data: {
          id: newHint.id,
          puzzleId: newHint.puzzleId,
          title: newHint.title,
          hintType: newHint.hintType,
          fragment: newHint.fragment,
          seedWords: newHint.seedWords,
          knownBitsCount: newHint.knownBitsCount,
          confidence: newHint.confidence,
          authorName: newHint.authorName,
          isVerified: true
        }
      });
    } catch (dbErr) {}

    res.status(201).json({
      success: true,
      message: 'Pista registrada com sucesso no Mural de Inteligência.',
      discovery: newHint
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/discoveries/sync-alliance — Dispara sincronismo com alianças externas
 */
router.post('/sync-alliance', async (req, res) => {
  try {
    const { sourceName, puzzleId } = req.body;
    const result = await syncPublicAllianceRanges(sourceName || 'bitcoinpuzzles.io', puzzleId || 'puzzle_btc_66');
    res.json({
      success: true,
      message: 'Sincronismo de aliança pública executado com sucesso.',
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/discoveries/solvers — Catálogo de Solvers C++ de Alta Performance para Download
 */
router.get('/solvers', (req, res) => {
  res.json({
    solvers: [
      {
        id: 'cacatoid-multithread-cpp',
        name: 'Cacatoid Multi-Thread C++ Solver',
        architecture: 'x86_64 / ARM64 / Android Termux',
        description: 'Solver ultra-otimizado em C++ com suporte a threads nativas de CPU/Android e baixa latência.',
        speedEstimated: '~5M - 25M keys/s (por CPU Core)',
        downloadUrl: '/solver/pool-client.js',
        githubRepo: 'https://github.com/cacatoid/KeyHunt-Android'
      },
      {
        id: 'keyhunt-cuda-gpu',
        name: 'KeyHunt-CUDA GPU Turbo Solver',
        architecture: 'NVIDIA CUDA (Tesla T4 / RTX 30/40)',
        description: 'Motor Cuda com suporte a secp256k1 Point Addition paralelo e algoritmos BSGS / Kangaroo.',
        speedEstimated: '~15B - 45B keys/s (por GPU)',
        downloadUrl: '/solver/colab_worker.py',
        githubRepo: 'https://github.com/albertobsd/keyhunt'
      },
      {
        id: 'bitcrack-opencl',
        name: 'BitCrack OpenCL / CUDA',
        architecture: 'NVIDIA / AMD / Intel Arc',
        description: 'Varredor rápido de chaves privadas com descarregamento direto na VRAM.',
        speedEstimated: '~10B - 35B keys/s',
        downloadUrl: '/solver/colab_worker.ipynb',
        githubRepo: 'https://github.com/brichard19/BitCrack'
      }
    ]
  });
});

module.exports = router;
