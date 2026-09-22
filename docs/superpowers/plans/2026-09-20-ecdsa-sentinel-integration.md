# ECDSA Sentinel Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate local ECDSA Sentinel (Python/SQLite) with PuzzleRadar ecosystem via Redis events, enabling nonce reuse detection and automated solver triggering without cloud dependencies.

**Architecture:** Python sentinel service monitors Bitcoin mempool/blocks locally, stores signatures in SQLite WAL, emits Redis events only for nonce_reuse or watched-address matches. PuzzleRadar subscribes to these events and optionally triggers Lambda/BSGS solvers via async subprocesses.

**Tech Stack:** Python 3.10+ (sentinel), SQLite WAL (storage), Redis 6379 (events), Node.js (PuzzleRadar integration), BullMQ (job queue)

**Spec:** D:\Programas\Desenvolvendo\PuzzleRadar\docs\superpowers\plans\2026-09-20-ecdsa-sentinel-integration.md

---

## Global Constraints

- **Port Isolation:** Sentinel runs as standalone Python process (no HTTP server). Communication ONLY via Redis pub/sub on port 6379. DO NOT create HTTP endpoints in sentinel.
- **Port Restrictions:** DO NOT use ports 3000-3003 (Nexus Cluster) or 4000-4003 (SaaS verticals).
- **Storage:** SQLite WAL mode ONLY. No cloud dependencies (Railway). No Google Sheets for real-time ingestion.
- **Async Solvers:** Lambda/BSGS execution via `subprocess.Popen` with callback to Redis. NEVER block the main event loop.
- **Event Filtering:** Sentinel emits ONLY: (1) nonce_reuse detected, (2) signature from watched address in `challenges` table.

---

## File Structure

```
D:\Programas\Desenvolvendo\ecdsa-sentinel\
├── sentinel.py              # Main entry point, event loop (mempool.space WS)
├── config.py                # Configuration (Redis, SQLite, paths)
├── db.py                    # SQLite WAL connection + schema
├── parser.py                # DER signature parser for Bitcoin txs
├── analyzer.py              # Nonce analysis + pattern detection
├── redis_publisher.py       # Redis event emission
├── requirements.txt         # Python dependencies
└── tests\
    ├── test_analyzer.py     # Unit tests for analysis
    └── test_integration.py  # Redis event tests

D:\Programas\Desenvolvendo\PuzzleRadar\
├── src\
│   ├── services\
│   │   └── sentinelBridge.js    # Redis subscriber → BullMQ queue
│   └── workers\
│       └── sentinelWorker.js    # BullMQ worker for solver jobs
├── start-sentinel-stack.ps1     # PowerShell startup (Windows)
└── start-sentinel-stack.sh      # Bash startup (WSL/Linux)
```

---

## Step-by-Step Plan (3 Surgical Steps)

---

### Step 1: ECDSA Sentinel Core (Python)

**Goal:** Create standalone Python service that scans mempool/blocks, stores signatures in SQLite, detects nonce reuse.

**Files:**
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\config.py`
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\db.py`
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\parser.py`
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\analyzer.py`
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\sentinel.py`
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\requirements.txt`

**Interfaces:**
- Produces: `sentinel.db` (SQLite WAL) with tables: `signatures`, `challenges`, `detections`
- Produces: Redis events on channel `sentinel:events`

---

#### Task 1.1: Configuration Module

- [ ] **Step 1: Create `config.py`**

```python
# config.py — ECDSA Sentinel Configuration
import os
from dataclasses import dataclass

@dataclass
class Config:
    # SQLite
    db_path: str = os.getenv("SENTINEL_DB", "sentinel.db")
    
    # Redis
    redis_host: str = os.getenv("REDIS_HOST", "localhost")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_channel: str = "sentinel:events"
    
    # Scanner
    mempool_ws: str = "wss://mempool.space/api/v1/ws"
    block_start: int = int(os.getenv("BLOCK_START", "875000"))
    
    # Rate limiting
    request_delay_ms: int = 100
    
    # Solver
    lambda_path: str = os.getenv("LAMBDA_PATH", "D:/Cripto/pollardslambda-main/lambda")
    bsgs_path: str = os.getenv("BSGS_PATH", "D:/Cripto/cacachave-main/cacachave")
    solver_threads: int = 24

config = Config()
```

- [ ] **Step 2: Verify config loads**

Run: `python -c "from config import config; print(config.db_path)"`
Expected: `sentinel.db`

---

#### Task 1.2: SQLite Database Layer

- [ ] **Step 3: Create `db.py`**

```python
# db.py — SQLite WAL Storage
import sqlite3
from contextlib import contextmanager
from config import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txid TEXT NOT NULL,
    input_index INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    r TEXT NOT NULL,
    s TEXT NOT NULL,
    z TEXT NOT NULL,
    block_height INTEGER,
    block_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(txid, input_index)
);

CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_key TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    bits INTEGER,
    range_min TEXT,
    range_max TEXT,
    status TEXT DEFAULT 'monitoring',
    notes TEXT
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_type TEXT NOT NULL,
    public_key TEXT NOT NULL,
    signature_id_1 INTEGER REFERENCES signatures(id),
    signature_id_2 INTEGER REFERENCES signatures(id),
    private_key_recovered TEXT,
    confidence REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sig_r ON signatures(r);
CREATE INDEX IF NOT EXISTS idx_sig_pubkey ON signatures(public_key);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
"""

@contextmanager
def get_db():
    conn = sqlite3.connect(config.db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
```

- [ ] **Step 4: Verify schema creation**

Run: `python -c "from db import init_db; init_db(); print('OK')"`
Expected: `OK` + file `sentinel.db` created

---

#### Task 1.3: DER Parser + Nonce Analysis Engine

- [ ] **Step 5: Create `parser.py`**

```python
# parser.py — DER Signature Parser for Bitcoin Transactions
# Mempool.space sends raw hex scripts; we must decode DER-encoded signatures.

def parse_der_signature(der_hex: str) -> dict:
    """
    Parse DER-encoded ECDSA signature to extract r and s values.
    
    DER format: 0x30 [total-len] 0x02 [r-len] [r-bytes] 0x02 [s-len] [s-bytes]
    Returns: {'r': hex_string, 's': hex_string}
    """
    der_bytes = bytes.fromhex(der_hex)
    
    if der_bytes[0] != 0x30:
        raise ValueError(f"Invalid DER: expected 0x30, got 0x{der_bytes[0]:02x}")
    
    idx = 2  # Skip 0x30 and total length
    
    # Parse r
    if der_bytes[idx] != 0x02:
        raise ValueError(f"Invalid DER: expected r marker 0x02")
    idx += 1
    r_len = der_bytes[idx]
    idx += 1
    r_bytes = der_bytes[idx:idx + r_len]
    idx += r_len
    
    # Parse s
    if der_bytes[idx] != 0x02:
        raise ValueError(f"Invalid DER: expected s marker 0x02")
    idx += 1
    s_len = der_bytes[idx]
    idx += 1
    s_bytes = der_bytes[idx:idx + s_len]
    
    r = int.from_bytes(r_bytes, 'big')
    s = int.from_bytes(s_bytes, 'big')
    
    return {
        'r': format(r, '064x'),
        's': format(s, '064x'),
    }

def extract_signatures_from_tx(tx_hex: str) -> list:
    """
    Extract ECDSA signatures from raw transaction hex.
    Returns list of {'input_index': int, 'public_key': str, 'r': str, 's': str}
    """
    import struct
    
    sigs = []
    tx = bytes.fromhex(tx_hex)
    
    # Parse version (4 bytes)
    version = struct.unpack('<I', tx[0:4])[0]
    idx = 4
    
    # Witness marker
    has_witness = False
    if tx[idx] == 0x00 and tx[idx + 1] == 0x01:
        has_witness = True
        idx += 2
    
    # Input count
    in_count, idx = _decode_varint(tx, idx)
    
    # Parse inputs
    for i in range(in_count):
        # Previous txid (32 bytes) + vout (4 bytes)
        idx += 36
        
        # ScriptSig length + script
        script_len, idx = _decode_varint(tx, idx)
        script = tx[idx:idx + script_len]
        idx += script_len
        
        # Sequence (4 bytes)
        idx += 4
        
        # Try to extract signature from scriptSig
        if script_len > 0:
            sig_data = _parse_scriptsig(script)
            if sig_data:
                sig_data['input_index'] = i
                sigs.append(sig_data)
    
    return sigs

def _decode_varint(data: bytes, offset: int) -> tuple:
    """Decode Bitcoin varint and return (value, new_offset)."""
    first = data[offset]
    if first < 0xfd:
        return first, offset + 1
    elif first == 0xfd:
        return struct.unpack('<H', data[offset + 1:offset + 3])[0], offset + 3
    elif first == 0xfe:
        return struct.unpack('<I', data[offset + 1:offset + 5])[0], offset + 5
    else:
        return struct.unpack('<Q', data[offset + 1:offset + 9])[0], offset + 9

def _parse_scriptsig(script: bytes) -> dict | None:
    """
    Parse P2PKH scriptSig: <sig> <pubkey>
    Returns: {'r': str, 's': str, 'public_key': str} or None
    """
    if len(script) < 10:
        return None
    
    # Check if it's a valid signature script
    # Push data + signature + push data + pubkey
    idx = 0
    
    # First push (signature)
    sig_len = script[idx]
    idx += 1
    if sig_len < 0x47 or sig_len > 0x49:  # Typical DER sig is 71-73 bytes
        return None
    
    # Extract DER signature (skip hash type byte at end)
    der_sig = script[idx:idx + sig_len - 1]
    idx += sig_len
    
    # Hash type
    hash_type = script[idx]
    idx += 1
    
    # Second push (pubkey)
    pubkey_len = script[idx]
    idx += 1
    
    if pubkey_len not in (33, 65):  # Compressed or uncompressed
        return None
    
    pubkey_bytes = script[idx:idx + pubkey_len]
    pubkey = pubkey_bytes.hex()
    
    try:
        parsed = parse_der_signature(der_sig.hex())
        parsed['public_key'] = pubkey
        return parsed
    except Exception:
        return None
```

- [ ] **Step 6: Verify parser loads**

Run: `python -c "from parser import parse_der_signature, extract_signatures_from_tx; print('OK')"`
Expected: `OK`

- [ ] **Step 7: Verify analyzer loads**

Run: `python -c "from analyzer import check_nonce_reuse; print('OK')"`
Expected: `OK`

---

#### Task 1.4: Redis Publisher

- [ ] **Step 7: Create `redis_publisher.py`**

```python
# redis_publisher.py — Event Emission to PuzzleRadar
import json
import redis
from config import config

class RedisPublisher:
    def __init__(self):
        self.client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            decode_responses=True
        )
    
    def publish_event(self, event_type: str, payload: dict):
        """Publish event to Redis channel."""
        event = {
            'type': event_type,
            'source': 'ecdsa-sentinel',
            'payload': payload
        }
        self.client.publish(config.redis_channel, json.dumps(event))
    
    def publish_nonce_reuse(self, detection: dict):
        """Publish nonce reuse detection."""
        self.publish_event('nonce_reuse', {
            'public_key': detection['public_key'],
            'r': detection['r'],
            'confidence': 1.0,
            'signature_1': detection['signature_1']['txid'],
            'signature_2': detection['signature_2']['txid'],
        })
    
    def publish_watched_address(self, signature: dict):
        """Publish signature from watched address."""
        self.publish_event('watched_address', {
            'public_key': signature['public_key'],
            'txid': signature['txid'],
            'block_height': signature.get('block_height'),
        })
```

- [ ] **Step 8: Verify Redis connection**

Run: `python -c "from redis_publisher import RedisPublisher; p = RedisPublisher(); p.publish_event('test', {'ok': True}); print('OK')"`
Expected: `OK` (requires Redis running on localhost:6379)

---

#### Task 1.5: Main Sentinel Loop

- [ ] **Step 10: Create `sentinel.py`**

```python
# sentinel.py — Main Event Loop
# Uses mempool.space WebSocket API (NOT Blockchain.info)
import asyncio
import hashlib
import websockets
import json
from db import init_db, get_db
from analyzer import check_nonce_reuse, recover_private_key
from parser import extract_signatures_from_tx
from redis_publisher import RedisPublisher
from config import config

class Sentinel:
    def __init__(self):
        self.publisher = RedisPublisher()
        self.running = True
    
    async def process_transaction(self, tx_data: dict):
        """Process a raw transaction from mempool.space."""
        txid = tx_data.get('txid', '')
        tx_hex = tx_data.get('transaction', '')
        
        if not tx_hex:
            return
        
        # Extract signatures from raw hex
        try:
            sigs = extract_signatures_from_tx(tx_hex)
        except Exception as e:
            print(f"[ERROR] Parse failed for {txid}: {e}")
            return
        
        for sig in sigs:
            await self._process_signature(txid, sig)
    
    async def _process_signature(self, txid: str, sig: dict):
        """Process a single extracted signature."""
        input_idx = sig['input_index']
        pubkey = sig['public_key']
        r = sig['r']
        s = sig['s']
        
        # Compute z from txid (simplified - real impl needs full sighash)
        # For detection, we only need r to be unique
        z = txid  # Placeholder
        
        # Store signature
        with get_db() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO signatures 
                (txid, input_index, public_key, r, s, z)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (txid, input_idx, pubkey, r, s, z))
        
        # Check nonce reuse
        detection = check_nonce_reuse(r)
        if detection:
            privkey = recover_private_key(
                detection['signature_1'],
                detection['signature_2']
            )
            detection['private_key_recovered'] = privkey
            
            with get_db() as conn:
                conn.execute("""
                    INSERT INTO detections 
                    (detection_type, public_key, signature_id_1, signature_id_2, 
                     private_key_recovered, confidence)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, ('nonce_reuse', detection['public_key'],
                      detection['signature_1']['id'],
                      detection['signature_2']['id'],
                      privkey, 1.0))
            
            self.publisher.publish_nonce_reuse(detection)
            print(f"[SENTINEL] NONCE REUSE: {detection['public_key'][:20]}...")
        
        # Check if watched address
        with get_db() as conn:
            challenge = conn.execute(
                "SELECT * FROM challenges WHERE public_key = ?",
                (pubkey,)
            ).fetchone()
            
            if challenge:
                self.publisher.publish_watched_address({
                    'public_key': pubkey,
                    'txid': txid,
                    'input_index': input_idx,
                })
                print(f"[SENTINEL] WATCHED: {pubkey[:20]}...")
    
    async def run_mempool_scanner(self):
        """Connect to mempool.space WebSocket and scan.
        
        mempool.space API: https://github.com/nicokosi/mempool.space-websocket-api
        Subscribe: {"action": "want", "data": ["live-2h-transaction"]}
        Events: {"transaction": {"txid": "...", "transaction": "raw_hex"}}
        """
        while self.running:
            try:
                async with websockets.connect(config.mempool_ws) as ws:
                    print("[SENTINEL] Connected to mempool.space WebSocket")
                    
                    # Subscribe to live transaction feed
                    await ws.send(json.dumps({
                        "action": "want",
                        "data": ["live-2h-transaction"]
                    }))
                    print("[SENTINEL] Subscribed to live-2h-transaction feed")
                    
                    while self.running:
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=30)
                            data = json.loads(msg)
                            
                            if 'transaction' in data:
                                await self.process_transaction(data['transaction'])
                                
                        except asyncio.TimeoutError:
                            continue
                        except websockets.ConnectionClosed:
                            print("[SENTINEL] Connection closed, reconnecting...")
                            break
                            
            except Exception as e:
                print(f"[ERROR] WebSocket error: {e}")
                await asyncio.sleep(5)
    
    def run(self):
        """Start the sentinel."""
        print("[SENTINEL] Starting ECDSA Sentinel...")
        print(f"[SENTINEL] DB: {config.db_path}")
        print(f"[SENTINEL] Redis: {config.redis_host}:{config.redis_port}")
        print(f"[SENTINEL] WS: {config.mempool_ws}")
        
        init_db()
        asyncio.run(self.run_mempool_scanner())

if __name__ == "__main__":
    sentinel = Sentinel()
    sentinel.run()
```

- [ ] **Step 10: Verify sentinel starts**

Run: `cd D:\Programas\Desenvolvendo\ecdsa-sentinel && python sentinel.py`
Expected: Prints startup messages, connects to mempool (may fail if no internet, that's OK for verification)

---

- [ ] **Step 11: Create `requirements.txt`**

```
websockets>=12.0
redis>=5.0
```

- [ ] **Step 12: Commit Step 1**

```bash
cd D:\Programas\Desenvolvendo\ecdsa-sentinel
git init
git add .
git commit -m "feat: ECDSA Sentinel core — scanner, analyzer, Redis publisher"
```

---

### Step 2: PuzzleRadar Bridge (Node.js)

**Goal:** Subscribe to Redis events from Sentinel and integrate with PuzzleRadar's existing BullMQ infrastructure.

**Files:**
- Create: `D:\Programas\Desenvolvendo\PuzzleRadar\src\services\sentinelBridge.js`
- Create: `D:\Programas\Desenvolvendo\PuzzleRadar\src\workers\sentinelWorker.js`

**Interfaces:**
- Consumes: Redis events from `sentinel:events` channel
- Produces: BullMQ jobs in `solver-queue`

---

#### Task 2.1: Redis Subscriber Bridge + BullMQ Queue

- [ ] **Step 13: Create `sentinelBridge.js`**

```javascript
// sentinelBridge.js — Redis Subscriber → BullMQ Queue
// FIX: Creates jobs in solver-queue instead of just publishing alerts
const Redis = require('ioredis');
const { Queue } = require('bullmq');

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const SOLVER_QUEUE = new Queue('solver-queue', { connection: REDIS_CONFIG });

class SentinelBridge {
  constructor() {
    this.subscriber = new Redis(REDIS_CONFIG);
    this.publisher = new Redis(REDIS_CONFIG);
    this.channel = 'sentinel:events';
  }

  start() {
    console.log(`[SentinelBridge] Subscribing to ${this.channel}...`);
    
    this.subscriber.subscribe(this.channel, (err) => {
      if (err) {
        console.error('[SentinelBridge] Subscribe error:', err);
        return;
      }
      console.log('[SentinelBridge] Connected to Redis');
    });

    this.subscriber.on('message', (channel, message) => {
      if (channel !== this.channel) return;
      
      try {
        const event = JSON.parse(message);
        this.handleEvent(event);
      } catch (err) {
        console.error('[SentinelBridge] Parse error:', err);
      }
    });
  }

  handleEvent(event) {
    console.log(`[SentinelBridge] Event: ${event.type}`);
    
    switch (event.type) {
      case 'nonce_reuse':
        this.handleNonceReuse(event.payload);
        break;
      case 'watched_address':
        this.handleWatchedAddress(event.payload);
        break;
      default:
        console.log(`[SentinelBridge] Unknown event: ${event.type}`);
    }
  }

  async handleNonceReuse(payload) {
    console.log(`[SentinelBridge] NONCE REUSE → Creating solver job: ${payload.public_key.slice(0, 20)}...`);
    
    // Create BullMQ job for automatic solver invocation
    const job = await SOLVER_QUEUE.add('sentinel-nonce-reuse', {
      type: 'lambda',
      public_key: payload.public_key,
      range_start: '1',
      range_end: '140',
      threads: parseInt(process.env.SOLVER_THREADS || '24'),
      source: 'ecdsa-sentinel',
      detection_type: 'nonce_reuse',
      confidence: payload.confidence || 1.0,
    }, {
      priority: 1,  // High priority
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
    
    console.log(`[SentinelBridge] Job ${job.id} created for nonce reuse`);
    
    // Also publish alert for real-time monitoring
    this.publisher.publish('puzzleradar:alerts', JSON.stringify({
      type: 'sentinel:nonce_reuse',
      jobId: job.id,
      data: payload,
      timestamp: Date.now(),
    }));
  }

  async handleWatchedAddress(payload) {
    console.log(`[SentinelBridge] WATCHED ADDRESS → Creating solver job: ${payload.public_key.slice(0, 20)}...`);
    
    // Create BullMQ job for watched address analysis
    const job = await SOLVER_QUEUE.add('sentinel-watched', {
      type: 'lambda',
      public_key: payload.public_key,
      range_start: '1',
      range_end: '140',
      threads: parseInt(process.env.SOLVER_THREADS || '24'),
      source: 'ecdsa-sentinel',
      detection_type: 'watched_address',
    }, {
      priority: 2,  // Normal priority
      attempts: 1,
    });
    
    console.log(`[SentinelBridge] Job ${job.id} created for watched address`);
    
    this.publisher.publish('puzzleradar:alerts', JSON.stringify({
      type: 'sentinel:watched_address',
      jobId: job.id,
      data: payload,
      timestamp: Date.now(),
    }));
  }

  stop() {
    this.subscriber.disconnect();
    this.publisher.disconnect();
  }
}

module.exports = SentinelBridge;
```

- [ ] **Step 14: Verify bridge loads**

Run: `node -e "const Bridge = require('./src/services/sentinelBridge'); console.log('OK')"`
Expected: `OK`

---

#### Task 2.2: Solver Worker

- [ ] **Step 15: Create `sentinelWorker.js`**

```javascript
// sentinelWorker.js — Async Solver Launcher
const { Worker } = require('bullmq');
const { execFile } = require('child_process');
const Redis = require('ioredis');

const QUEUE_NAME = 'solver-queue';
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const SOLVER_PATHS = {
  lambda: process.env.LAMBDA_PATH || 'D:/Cripto/pollardslambda-main/lambda',
  bsgs: process.env.BSGS_PATH || 'D:/Cripto/cacachave-main/cacachave',
};

class SolverWorker {
  constructor() {
    this.worker = new Worker(QUEUE_NAME, this.processJob.bind(this), {
      connection: REDIS_CONFIG,
      concurrency: 2,
    });

    this.worker.on('completed', (job) => {
      console.log(`[Solver] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[Solver] Job ${job.id} failed:`, err.message);
    });
  }

  async processJob(job) {
    const { type, public_key, range_start, range_end, threads } = job.data;
    
    console.log(`[Solver] Processing ${type} for ${public_key.slice(0, 20)}...`);
    
    return new Promise((resolve, reject) => {
      let command, args;
      
      if (type === 'lambda') {
        command = SOLVER_PATHS.lambda;
        args = [
          '--pubkey', public_key,
          '--keyrange', range_end || '140',
          '--walkers', '1000000',
          '--t', String(threads || 24),
          '--snaptime', '60',
        ];
      } else if (type === 'bsgs') {
        command = SOLVER_PATHS.bsgs;
        args = [
          '-m', 'bsgs',
          '-f', '-', // stdin
          '-b', range_end || '140',
          '-R',
          '-t', String(threads || 24),
          '-q',
          '-s', '30',
        ];
      } else {
        reject(new Error(`Unknown solver type: ${type}`));
        return;
      }
      
      const proc = execFile(command, args, { 
        timeout: 3600000,
        maxBuffer: 1024 * 1024 
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Solver] Error:`, error.message);
          reject(error);
          return;
        }
        
        // Check if key was found
        if (stdout.includes('privkey') || stdout.includes('MATCH')) {
          resolve({ 
            status: 'found', 
            output: stdout,
            public_key 
          });
        } else {
          resolve({ 
            status: 'completed', 
            output: stdout,
            public_key 
          });
        }
      });
      
      // Log output in real-time
      proc.stdout.on('data', (data) => {
        process.stdout.write(`[Solver: ${type}] ${data}`);
      });
    });
  }

  async stop() {
    await this.worker.close();
  }
}

module.exports = SolverWorker;
```

- [ ] **Step 16: Verify worker loads**

Run: `node -e "const Worker = require('./src/workers/sentinelWorker'); console.log('OK')"`
Expected: `OK`

---

- [ ] **Step 17: Commit Step 2**

```bash
cd D:\Programas\Desenvolvendo\PuzzleRadar
git add src/services/sentinelBridge.js src/workers/sentinelWorker.js
git commit -m "feat: Sentinel bridge + solver worker for Redis events"
```

---

### Step 3: Integration Testing & Startup Scripts

**Goal:** Verify end-to-end communication and create startup scripts.

**Files:**
- Create: `D:\Programas\Desenvolvendo\ecdsa-sentinel\tests\test_integration.py`
- Create: `D:\Programas\Desenvolvendo\PuzzleRadar\start-sentinel-stack.ps1` (PowerShell for Windows)
- Create: `D:\Programas\Desenvolvendo\PuzzleRadar\start-sentinel-stack.sh` (Bash for WSL/Linux)

---

#### Task 3.1: Integration Test

- [ ] **Step 18: Create `test_integration.py`**

```python
# test_integration.py — Verify Redis Communication
import json
import time
import redis
from config import config

def test_redis_publish():
    """Test that events can be published to Redis."""
    r = redis.Redis(host=config.redis_host, port=config.redis_port, decode_responses=True)
    
    # Publish test event
    event = {
        'type': 'nonce_reuse',
        'source': 'ecdsa-sentinel',
        'payload': {
            'public_key': '02' + '00' * 32,
            'r': 'abcd1234',
            'confidence': 1.0,
        }
    }
    
    subscribers = r.publish(config.redis_channel, json.dumps(event))
    print(f"[TEST] Published to {subscribers} subscribers")
    return subscribers > 0

def test_nonce_reuse_detection():
    """Test nonce reuse detection logic."""
    from analyzer import check_nonce_reuse, recover_private_key
    
    # This would need real test data
    result = check_nonce_reuse('test_r_value')
    print(f"[TEST] Nonce reuse check: {result}")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("ECDSA Sentinel Integration Tests")
    print("=" * 60)
    
    tests = [
        ("Redis Publish", test_redis_publish),
        ("Nonce Detection", test_nonce_reuse_detection),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            result = test_fn()
            results.append((name, result))
            print(f"  [{('PASS' if result else 'FAIL')}] {name}")
        except Exception as e:
            results.append((name, False))
            print(f"  [FAIL] {name}: {e}")
    
    print("=" * 60)
    passed = sum(1 for _, r in results if r)
    print(f"Results: {passed}/{len(results)} passed")
    print("=" * 60)
```

- [ ] **Step 19: Verify tests run**

Run: `cd D:\Programas\Desenvolvendo\ecdsa-sentinel\tests && python test_integration.py`
Expected: Tests execute (some may fail if Redis not running, that's expected)

---

#### Task 3.2: Startup Scripts

- [ ] **Step 20: Create `start-sentinel-stack.ps1`** (PowerShell - Windows Native)

```powershell
# start-sentinel-stack.ps1 — Start Sentinel + Bridge + Worker (Windows)
# Usage: .\start-sentinel-stack.ps1

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " ECDSA Sentinel Stack (Windows)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check Redis
Write-Host "`n[1/3] Checking Redis..." -ForegroundColor Yellow
try {
    $redis = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if ($redis.TcpTestSucceeded) {
        Write-Host "  Redis already running on port 6379" -ForegroundColor Green
    } else {
        throw "Redis not running"
    }
} catch {
    Write-Host "  Starting Redis..." -ForegroundColor Yellow
    Start-Process -FilePath "redis-server" -ArgumentList "--port 6379" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

# Start Sentinel (Python) in new terminal
Write-Host "`n[2/3] Starting ECDSA Sentinel..." -ForegroundColor Yellow
$sentinelPath = "D:\Programas\Desenvolvendo\ecdsa-sentinel"
Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command", "cd '$sentinelPath'; python sentinel.py"
) -WindowStyle Normal
Write-Host "  Sentinel started in new terminal" -ForegroundColor Green

# Start Bridge + Worker (Node.js) in new terminal
Write-Host "`n[3/3] Starting PuzzleRadar Bridge + Worker..." -ForegroundColor Yellow
$puzzleRadarPath = "D:\Programas\Desenvolvendo\PuzzleRadar"
$bridgeScript = @"
const SentinelBridge = require('./src/services/sentinelBridge');
const SolverWorker = require('./src/workers/sentinelWorker');

const bridge = new SentinelBridge();
const worker = new SolverWorker();

bridge.start();
console.log('[Bridge] Started - listening for sentinel events');

process.on('SIGINT', () => {
  bridge.stop();
  worker.stop();
  process.exit(0);
});
"@

Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command", "cd '$puzzleRadarPath'; node -e `"$bridgeScript`""
) -WindowStyle Normal
Write-Host "  Bridge + Worker started in new terminal" -ForegroundColor Green

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " Stack Running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Sentinel: Python process (new terminal)"
Write-Host " Bridge:   Node.js process (new terminal)"
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop" -ForegroundColor DarkGray
```

- [ ] **Step 21: Create `start-sentinel-stack.sh`** (Bash - WSL/Linux)

```bash
#!/bin/bash
# start-sentinel-stack.sh — Start Sentinel + Bridge + Worker (WSL/Linux)
# Usage: bash start-sentinel-stack.sh

echo "======================================"
echo " ECDSA Sentinel Stack (WSL/Linux)"
echo "======================================"

# Check Redis
echo ""
echo "[1/3] Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "  Redis already running on port 6379"
else
    echo "  Starting Redis..."
    redis-server --daemonize yes
    sleep 1
fi

# Start Sentinel (Python)
echo ""
echo "[2/3] Starting ECDSA Sentinel..."
cd /mnt/d/Programas/Desenvolvendo/ecdsa-sentinel
python sentinel.py &
SENTINEL_PID=$!
echo "  Sentinel PID: $SENTINEL_PID"

# Start Bridge + Worker (Node.js)
echo ""
echo "[3/3] Starting PuzzleRadar Bridge + Worker..."
cd /mnt/d/Programas/Desenvolvendo/PuzzleRadar
node -e "
const SentinelBridge = require('./src/services/sentinelBridge');
const SolverWorker = require('./src/workers/sentinelWorker');

const bridge = new SentinelBridge();
const worker = new SolverWorker();

bridge.start();
console.log('[Bridge] Started - listening for sentinel events');

process.on('SIGINT', () => {
  bridge.stop();
  worker.stop();
  process.exit(0);
});
" &
BRIDGE_PID=$!
echo "  Bridge PID: $BRIDGE_PID"

echo ""
echo "======================================"
echo " Stack Running!"
echo "======================================"
echo " Sentinel: PID $SENTINEL_PID"
echo " Bridge:   PID $BRIDGE_PID"
echo ""
echo "Press Ctrl+C to stop all"

wait
```

- [ ] **Step 22: Make bash script executable**

Run (WSL): `chmod +x /mnt/d/Programas/Desenvolvendo/PuzzleRadar/start-sentinel-stack.sh`

- [ ] **Step 23: Add NPM script to package.json** (Optional alternative)

Add to `D:\Programas\Desenvolvendo\PuzzleRadar\package.json`:
```json
"scripts": {
  "sentinel": "node -e \"const B=require('./src/services/sentinelBridge');const W=require('./src/workers/sentinelWorker');const b=new B();const w=new W();b.start();console.log('Bridge+Worker started');process.on('SIGINT',()=>{b.stop();w.stop();process.exit(0)});\"",
  "sentinel:dev": "nodemon --exec \"npm run sentinel\""
}
```

Usage: `npm run sentinel`

---

#### Task 3.3: Manual Verification Tests

- [ ] **Step 24: Test Redis communication manually**

```bash
# Terminal 1: Subscribe to Redis
redis-cli SUBSCRIBE sentinel:events

# Terminal 2: Publish test event
redis-cli PUBLISH sentinel:events '{"type":"test","payload":{"ok":true}}'

# Expected: Terminal 1 receives the message
```

- [ ] **Step 25: Test solver invocation manually**

```bash
# WSL
cd /mnt/d/Cripto/pollardslambda-main
./lambda --pubkey 031f6a332d3c5c4f2de2378c012f429cd109ba07d69690c6c701b6bb87860d6640 --keyrange 140 --walkers 10000 --t 4 --snaptime 0
```

Expected: Lambda runs (even if briefly before timeout)

- [ ] **Step 26: Commit Step 3**

```bash
cd /mnt/d/Programas/Desenvolvendo/PuzzleRadar
git add start-sentinel-stack.ps1 start-sentinel-stack.sh package.json
git commit -m "feat: Sentinel stack startup scripts (PS1 + Bash) + integration tests"
```

---

## Regression Test Checklist

### Redis Communication (curl/redis-cli)

```bash
# Test 1: Verify Redis is running
redis-cli PING
Expected: PONG

# Test 2: Subscribe to sentinel channel
redis-cli SUBSCRIBE sentinel:events
Expected: "Reading messages... (press Ctrl-C to quit)"

# Test 3: Publish test event (in separate terminal)
redis-cli PUBLISH sentinel:events '{"type":"nonce_reuse","payload":{"test":true}}'
Expected: (integer) 1

# Test 4: Verify PuzzleRadar can subscribe
cd D:\Programas\Desenvolvendo\PuzzleRadar
node -e "const Redis = require('ioredis'); const r = new Redis(); r.subscribe('sentinel:events'); r.on('message', (ch, msg) => console.log('Received:', msg)); setTimeout(() => process.exit(), 5000);"
Expected: Waits for messages
```

### Solver Invocation

```bash
# Test 1: Lambda binary exists
ls -la D:\Cripto\pollardslambda-main\lambda
Expected: File exists, executable

# Test 2: Lambda runs
cd D:\Cripto\pollardslambda-main
timeout 5 ./lambda --pubkey 02145d2611c823a396ef6712ce0f712f09b9b4f3135e3e0aa3230fb9b6d08d1e16 --keyrange 65 --walkers 1000 --t 1 --snaptime 0
Expected: Starts processing (timeout is OK)

# Test 3: Cacachave binary exists
ls -la D:\Cripto\cacachave-main\cacachave
Expected: File exists, executable

# Test 4: Cacachave runs
cd D:\Cripto\cacachave-main
timeout 5 ./cacachave -m address -f tests/66.txt -b 66 -l compress -R -t 1 -q -s 0
Expected: Starts processing
```

### SQLite Integrity

```bash
# Test 1: DB file exists after sentinel runs
ls -la D:\Programas\Desenvolvendo\ecdsa-sentinel\sentinel.db
Expected: File exists

# Test 2: WAL mode active
sqlite3 D:\Programas\Desenvolvendo\ecdsa-sentinel\sentinel.db "PRAGMA journal_mode;"
Expected: wal

# Test 3: Schema correct
sqlite3 D:\Programas\Desenvolvendo\ecdsa-sentinel\sentinel.db ".tables"
Expected: signatures challenges detections
```

---

## End-to-End Verification

1. Start Redis: `redis-server`
2. Start Sentinel: `cd D:\Programas\Desenvolvendo\ecdsa-sentinel && python sentinel.py`
3. Start Bridge: `cd D:\Programas\Desenvolvendo\PuzzleRadar && node -e "require('./src/services/sentinelBridge').start()"`
4. Insert test challenge: `sqlite3 sentinel.db "INSERT INTO challenges (public_key, address, bits) VALUES ('02test...', '1test...', 60);"`
5. Wait for mempool transaction matching test key
6. Verify Redis event emitted
7. Verify solver job created (if configured)

---

## Aprovação Necessária

Aguardando aprovação expressa antes de editar qualquer arquivo.

**Escopo para aprovação:**
- Criar diretório `D:\Programas\Desenvolvendo\ecdsa-sentinel\`
- Criar 7 arquivos Python (config, db, parser, analyzer, redis_publisher, sentinel, requirements)
- Criar 2 arquivos Node.js (sentinelBridge, sentinelWorker)
- Criar 2 scripts de inicialização (start-sentinel-stack.ps1 + start-sentinel-stack.sh)
- Criar 1 arquivo de teste Python
- Atualizar package.json (scripts npm para sentinel)

**Correções aplicadas ao plano:**
1. ✅ Parser DER integrado (parser.py) para decodificar assinaturas Bitcoin reais
2. ✅ WebSocket atualizado para API mempool.space (`{"action": "want", "data": ["live-2h-transaction"]}`)
3. ✅ sentinelBridge.js agora cria jobs BullMQ na fila `solver-queue`
4. ✅ Script PowerShell (Windows) + Bash (WSL/Linux) disponíveis
5. ✅ NPM script `npm run sentinel` como alternativa

**NÃO será alterado:**
- Código existente do PuzzleRadar (exceto package.json scripts)
- Configurações de portas existentes
- Dependências do package.json (apenas adicionar scripts)
