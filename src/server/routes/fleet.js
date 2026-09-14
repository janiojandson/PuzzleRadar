// ============================================
// 🧩 PuzzleRadar — Rotas de Fleet Management (Gerenciamento de Frotas)
// ============================================
// Permite que um único cadastro de usuário (Pessoa) gerencie, autentique
// e monitore dezenas de instâncias de máquinas e Google Colabs simultaneamente.
// ============================================

const express = require('express');
const crypto = require('crypto');
const prisma = require('../../lib/prisma');

const router = express.Router();

// Memória rápida para nós da frota
const fleetNodesMemory = new Map();

/**
 * GET /api/fleet — Lista todos os nós da frota do usuário
 */
router.get('/', async (req, res) => {
  try {
    const { userId, accountTag } = req.query;
    const now = Date.now();
    const nodes = [];

    for (const [token, node] of fleetNodesMemory.entries()) {
      const isOnline = (now - node.lastPing) <= 120000;
      nodes.push({
        ...node,
        status: isOnline ? (node.status || 'MINING') : 'OFFLINE',
        lastPingAgoSeconds: Math.floor((now - node.lastPing) / 1000)
      });
    }

    const activeNodes = nodes.filter(n => n.status !== 'OFFLINE');
    const totalHashrate = activeNodes.reduce((sum, n) => sum + (n.currentHashrate || 0), 0);

    res.json({
      totalNodes: nodes.length,
      activeNodesCount: activeNodes.length,
      totalHashrate,
      totalHashrateFormatted: formatHashrate(totalHashrate),
      nodes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/register-node — Registra um novo nó na frota (ex: conta do Google Colab)
 */
router.post('/register-node', async (req, res) => {
  try {
    const { name, accountTag, hardwareType, gpuModel, vramGB, userId } = req.body;
    
    const nodeToken = `fleet_${crypto.randomBytes(12).toString('hex')}`;
    const nodeName = name || `colab-node-${Math.floor(Math.random() * 10000)}`;

    const nodeRecord = {
      id: `fnode_${Date.now()}`,
      nodeToken,
      name: nodeName,
      accountTag: accountTag || 'Google Colab Conta',
      hardwareType: hardwareType || 'GPU_TESLA_T4',
      gpuModel: gpuModel || 'NVIDIA Tesla T4 (16GB VRAM)',
      vramGB: vramGB || 16,
      currentHashrate: 18000000000, // ~18 GH/s default
      totalKeysChecked: 0,
      totalShares: 0,
      status: 'IDLE',
      lastPing: Date.now(),
      createdAt: new Date().toISOString()
    };

    fleetNodesMemory.set(nodeToken, nodeRecord);

    try {
      await prisma.fleetNode.create({
        data: {
          nodeToken,
          name: nodeRecord.name,
          accountTag: nodeRecord.accountTag,
          hardwareType: nodeRecord.hardwareType,
          gpuModel: nodeRecord.gpuModel,
          vramGB: nodeRecord.vramGB,
          userId: userId || null
        }
      });
    } catch (dbErr) {}

    res.status(201).json({
      success: true,
      nodeToken,
      node: nodeRecord,
      message: `Nó ${nodeName} registrado na frota com sucesso!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/batch-generate — Gera tokens para N contas Google Colab de uma vez
 */
router.post('/batch-generate', async (req, res) => {
  try {
    const { count = 5, baseName = 'colab-conta', userId } = req.body;
    const generatedNodes = [];

    for (let i = 1; i <= Math.min(Number(count), 20); i++) {
      const nodeToken = `fleet_batch_${i}_${crypto.randomBytes(8).toString('hex')}`;
      const nodeName = `${baseName}-${String(i).padStart(2, '0')}`;

      const nodeRecord = {
        id: `fnode_batch_${Date.now()}_${i}`,
        nodeToken,
        name: nodeName,
        accountTag: `Conta Google ${i}`,
        hardwareType: 'GPU_TESLA_T4',
        gpuModel: 'NVIDIA Tesla T4',
        vramGB: 16,
        currentHashrate: 18000000000,
        totalKeysChecked: 0,
        totalShares: 0,
        status: 'IDLE',
        lastPing: Date.now(),
        createdAt: new Date().toISOString()
      };

      fleetNodesMemory.set(nodeToken, nodeRecord);
      generatedNodes.push(nodeRecord);
    }

    res.status(201).json({
      success: true,
      count: generatedNodes.length,
      nodes: generatedNodes,
      message: `${generatedNodes.length} nós de Colab gerados em lote para a Fazenda!`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fleet/heartbeat — Heartbeat persistente e keepalive de um nó
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { nodeToken, hashrate, keysChecked, status, currentTaskId } = req.body;

    if (!nodeToken) {
      return res.status(400).json({ error: 'nodeToken é obrigatório.' });
    }

    let node = fleetNodesMemory.get(nodeToken);
    if (!node) {
      node = {
        id: `fnode_${Date.now()}`,
        nodeToken,
        name: `colab-auto-${nodeToken.substring(0, 6)}`,
        accountTag: 'Colab Farm Account',
        hardwareType: 'GPU_TESLA_T4',
        gpuModel: 'Tesla T4',
        vramGB: 16,
        totalKeysChecked: 0,
        totalShares: 0,
        status: 'MINING'
      };
      fleetNodesMemory.set(nodeToken, node);
    }

    node.lastPing = Date.now();
    node.currentHashrate = Number(hashrate) || node.currentHashrate || 18000000000;
    node.status = status || 'MINING';
    node.currentTaskId = currentTaskId || node.currentTaskId;
    if (keysChecked) {
      node.totalKeysChecked += Number(keysChecked);
      node.totalShares += (Number(keysChecked) * 0.0001);
    }

    res.json({
      ok: true,
      nodeStatus: node.status,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatHashrate(kps = 0) {
  const n = Number(kps) || 0;
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TH/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MH/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KH/s';
  return n.toFixed(0) + ' H/s';
}

module.exports = router;
