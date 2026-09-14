// ============================================
// 🧩 PuzzleRadar — Pool Client (Solver Wrapper)
// ============================================
// Conecta o solver local (KeyHunt-Cuda / keyhunt / BitCrack)
// ao pool do PuzzleRadar para receber ranges e reportar resultados
// ============================================

require('dotenv').config();

const PUZZLERADAR_API = process.env.PUZZLERADAR_API || 'http://localhost:3010';
const API_TOKEN = process.env.API_TOKEN || '';

class PuzzleRadarPoolClient {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || PUZZLERADAR_API;
    this.token = options.token || API_TOKEN;
    this.workerId = null;
    this.solverCommand = options.solverCommand || null; // ex: 'KeyHunt-Cuda'
    this.hardware = options.hardware || 'CPU';
    this.running = false;
    this.currentTask = null;
    this.stats = {
      rangesCompleted: 0,
      totalKeysChecked: 0,
      totalComputeHours: 0,
      keysFound: 0
    };
  }

  /**
   * Registra o worker no pool
   */
  async register() {
    console.log('[PoolClient] Registrando worker...');
    
    const response = await fetch(`${this.apiUrl}/api/workers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        name: `worker-${Date.now()}`,
        hardware: this.hardware,
        gpuModel: process.env.GPU_MODEL || null,
        cpuModel: process.env.CPU_MODEL || null,
        keysPerSecond: 0 // Será atualizado após primeiro benchmark
      })
    });

    const data = await response.json();
    this.workerId = data.workerId;
    console.log(`[PoolClient] Worker registrado: ${this.workerId}`);
    return data;
  }

  /**
   * Solicita uma tarefa ao pool
   */
  async getTask() {
    if (!this.workerId) throw new Error('Worker não registrado. Chame register() primeiro.');
    
    const response = await fetch(`${this.apiUrl}/api/workers/${this.workerId}/task`, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });

    const data = await response.json();
    
    if (data.task) {
      this.currentTask = data.task;
      console.log(`[PoolClient] Tarefa recebida: Range ${data.task.rangeStart} → ${data.task.rangeEnd}`);
    } else {
      console.log('[PoolClient] Nenhuma tarefa disponível');
    }
    
    return data;
  }

  /**
   * Envia heartbeat ao pool
   */
  async heartbeat(keysPerSecond, progress) {
    if (!this.workerId) return;
    
    await fetch(`${this.apiUrl}/api/workers/${this.workerId}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ keysPerSecond, progress, status: 'RUNNING' })
    });
  }

  /**
   * Reporta resultado ao pool
   */
  async reportResult(result) {
    if (!this.workerId) return;
    
    const response = await fetch(`${this.apiUrl}/api/workers/${this.workerId}/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        rangeId: this.currentTask?.rangeId,
        result: result.found ? 'FOUND' : 'NOT_FOUND',
        keysChecked: result.keysChecked || 0,
        foundPrivateKey: result.found ? result.privateKey : null,
        computeHours: result.computeHours || 0
      })
    });

    const data = await response.json();
    
    if (result.found) {
      this.stats.keysFound++;
      console.log(`[PoolClient] 🎯 CHAVE ENCONTRADA! Notificando pool...`);
    } else {
      this.stats.rangesCompleted++;
      this.stats.totalKeysChecked += result.keysChecked || 0;
      this.stats.totalComputeHours += result.computeHours || 0;
      console.log(`[PoolClient] Range concluído. Ranges totais: ${this.stats.rangesCompleted}`);
    }
    
    // Solicitar próxima tarefa
    if (data.nextTask) {
      this.currentTask = data.nextTask;
    }
    
    return data;
  }

  /**
   * Loop principal — registra, pega tarefa, resolve, reporta, repete
   */
  async start() {
    console.log('[PoolClient] 🧩 Iniciando PuzzleRadar Pool Client...');
    this.running = true;
    
    // Registrar
    await this.register();
    
    // Loop
    while (this.running) {
      try {
        // Pegar tarefa
        const taskData = await this.getTask();
        
        if (!taskData.task) {
          console.log('[PoolClient] Sem tarefas. Aguardando 30s...');
          await new Promise(r => setTimeout(r, 30000));
          continue;
        }
        
        // Resolver (usando solver externo ou CPU)
        const result = await this.solve(taskData.task);
        
        // Reportar
        await this.reportResult(result);
        
      } catch (err) {
        console.error('[PoolClient] Erro:', err.message);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }

  /**
   * Resolve um range usando o solver configurado
   * Se não houver solver externo, usa busca sequencial em CPU (lento, para testes)
   */
  async solve(task) {
    const startTime = Date.now();
    
    if (this.solverCommand) {
      // TODO: Executar solver externo (KeyHunt-Cuda, keyhunt, BitCrack)
      // Exemplo: spawn(this.solverCommand, ['--range', `${task.rangeStart}:${task.rangeEnd}`, ...])
      throw new Error('Solver externo não implementado ainda. Use modo CPU para testes.');
    }
    
    // ─── MODO CPU (APENAS PARA TESTES COM PUZZLES DE BAIXOS BITS) ───
    console.log(`[PoolClient] Resolvendo em modo CPU (apenas para puzzles ≤ 40 bits)`);
    
    const { createHash } = require('crypto');
    const secp256k1 = require('secp256k1'); // Opcional, para verificação real
    
    const rangeStart = BigInt('0x' + task.rangeStart);
    const rangeEnd = BigInt('0x' + task.rangeEnd);
    const targetAddress = task.targetAddress;
    
    let keysChecked = 0;
    let found = false;
    let privateKey = null;
    
    // ⚠️ ATENÇÃO: Busca sequencial em CPU é EXTREMAMENTE lenta
    // Use apenas para puzzles de até ~40 bits para testes
    const MAX_KEYS = 10_000_000; // Limite de segurança para CPU
    
    for (let k = 0n; k <= rangeEnd - rangeStart && k < MAX_KEYS; k++) {
      const key = rangeStart + k;
      keysChecked++;
      
      // TODO: Gerar endereço Bitcoin da chave e comparar com targetAddress
      // Isso requer implementação real de secp256k1 + SHA256 + RIPEMD160
      
      // Heartbeat a cada 1M chaves
      if (keysChecked % 1_000_000 === 0) {
        await this.heartbeat(keysChecked / ((Date.now() - startTime) / 1000), keysChecked / Number(rangeEnd - rangeStart));
      }
    }
    
    const computeHours = (Date.now() - startTime) / 3600000;
    
    return {
      found,
      privateKey,
      keysChecked,
      computeHours
    };
  }

  /**
   * Para o worker
   */
  stop() {
    this.running = false;
    console.log('[PoolClient] Worker parado');
  }
}

// ─── CLI ───
if (require.main === module) {
  const client = new PuzzleRadarPoolClient({
    apiUrl: process.argv[2] || PUZZLERADAR_API,
    token: process.argv[3] || API_TOKEN,
    hardware: process.env.HARDWARE || 'CPU',
    solverCommand: process.env.SOLVER_COMMAND || null
  });
  
  client.start().catch(console.error);
  
  process.on('SIGINT', () => {
    client.stop();
    process.exit(0);
  });
}

module.exports = PuzzleRadarPoolClient;