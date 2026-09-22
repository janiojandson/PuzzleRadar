# PLANO DE INTEGRAÇÃO: Go Worker (btcgoai-main) → PuzzleRadar

## Visão Geral
Integrar o worker Go de alta performance (`btcgoai-main`) como um **worker nativo gerenciado pelo PuzzleRadar**, capaz de:
- Receber ranges via API `/api/range/next/:worker_id`
- Executar busca sequencial otimizada (batch inversion, 1024 lanes)
- Reportar progresso/hashrate em tempo real
- Deploy no Railway (container Docker)

---

## Arquitetura

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐
│  PuzzleRadar    │ ◄─────────────────► │  Go Worker       │
│  (Coordinator)  │  /api/range/next   │  (btcgoai-main)  │
│                 │  /api/worker/beat  │                  │
│  - loteManager  │  /api/webhook/     │  - 1024 lanes    │
│  - filterEngine │    btcpuzzle       │  - Montgomery    │
│  - Redis/Postgres                    │  - ~100M keys/s  │
└─────────────────┘                    └──────────────────┘
        ▲                                       │
        │           Railway                     │
        │    (container auto-scale)             │
        └───────────────────────────────────────┘
```

---

## Componentes a Criar/Modificar

### 1. Go Worker Wrapper (`cmd/worker/main.go`)
Novo entry point que:
- Registra-se no PuzzleRadar (`/api/worker/register`)
- Loop: `GET /api/range/next/{worker_id}?hashrate=X`
- Executa `searchForPrivateKey(minKey, maxKey, targetHash160)` 
- Reporta heartbeat a cada 10s (`POST /api/worker/beat`)
- Em caso de chave encontrada: `POST /api/webhook/btcpuzzle`

### 2. API Endpoints no PuzzleRadar (`src/server/routes/workers.js`)
Novas rotas:
```
GET    /api/worker/next/:worker_id     → compatível com /api/range/next
POST   /api/worker/beat                → heartbeat + hashrate + progress
POST   /api/worker/register            → registro inicial (hardware, caps)
GET    /api/worker/stats/:worker_id    → telemetria individual
GET    /api/workers/fleet              → visão agregada (já existe em /api/fleet)
```

### 3. Telemetria de Hashrate (Visualização)
- Endpoint `/api/telemetry/hashrate` → WebSocket ou SSE para dashboard tempo real
- Métricas: keys/sec, progresso %, ETA, workers ativos
- Armazenar no Redis (TTL 5min) + PostgreSQL (histórico)

### 4. Railway Deploy
- `Dockerfile` multi-stage (build Go → runtime minimal)
- `railway.json` / `nixpacks.toml` config
- Env vars: `HUB_URL`, `WORKER_NAME`, `LOG_LEVEL`

### 5. loteManager - Suporte a "go_worker"
- Detectar `client=go` no request
- Atribuir `STEP_DEFAULT` (2^48) ou maior para GPU
- Priority score ajustado para workers Go

---

## Fluxo de Dados

### Inicialização
```bash
# Go Worker inicia
WORKER_NAME="railway-gpu-01" HUB_URL="https://puzzleradar.up.railway.app" ./worker
```

1. `POST /api/worker/register` → `{name, hardware: "GPU_RTX_4090", gpuModel: "RTX 4090", lanes: 1024}`
2. PuzzleRadar cria/atualiza `FleetNode` + `WorkerToken`

### Loop Principal
```go
for {
    range := GET /api/range/next/railway-gpu-01?hashrate=120000000
    // range.custom_range = "0x4000...:0x7fff..."
    // range.targets = [{hash160, address, type}]
    
    foundKey := searchForPrivateKey(range.min, range.max, range.targets)
    
    if foundKey != nil {
        POST /api/webhook/btcpuzzle {status: "keyFound", privatekey, workername, targetpuzzle: 71}
    }
    
    POST /api/worker/beat {worker_id, keysChecked, hashrate, progressPct, currentKey}
}
```

---

## Configuração de Range Customizado (Sua Requisição)

No `loteManager.js` ou via `filterEngine`, adicionar:

```js
// Variáveis de ambiente
const RANGE_MODE = process.env.RANGE_MODE || 'full';        // 'full' | 'half' | 'custom'
const RANGE_EXCLUDE_START_PCT = process.env.RANGE_EXCLUDE_START_PCT || 0;  // 0-100

function computeEffectiveRange(puzzleStart, puzzleEnd) {
    let start = puzzleStart;
    let end = puzzleEnd;
    
    if (RANGE_MODE === 'half') {
        const mid = puzzleStart + (puzzleEnd - puzzleStart) / 2n;
        start = mid;  // só a segunda metade
    }
    
    if (RANGE_EXCLUDE_START_PCT > 0) {
        const rangeSize = end - start;
        const exclude = (rangeSize * BigInt(RANGE_EXCLUDE_START_PCT)) / 100n;
        start = start + exclude;
    }
    
    return { start, end };
}
```

---

## Dockerfile (Railway)

```dockerfile
# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o worker ./cmd/worker

# Runtime stage
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/worker .
ENV HUB_URL=https://puzzleradar-production.up.railway.app
ENTRYPOINT ["./worker"]
```

---

## Estimativa de Performance

| Worker Type | Hashrate Estimado | Keys/Range (STEP_DEFAULT) | Tempo/Range |
|-------------|-------------------|---------------------------|-------------|
| CPU (4 cores) | ~500 kH/s | 281T | ~6.5 dias |
| GPU RTX 4090 | ~1.2 GH/s | 281T | ~67 horas |
| Railway (T4) | ~200 MH/s | 281T | ~16 dias |
| **Go Worker (otimizado)** | **~100M keys/s (batch)** | **281T** | **~32 horas** |

> O batch inversion (1024 lanes) dá ~10x speedup vs CPU scalar mult.

---

## Próximos Passos (Ordem de Execução)

1. ✅ **Criar PLAN.md** (este arquivo)
2. 🔧 **Implementar `cmd/worker/main.go`** - wrapper HTTP + loop
3. 🔧 **Adicionar rotas `/api/worker/*`** no PuzzleRadar
4. 🔧 **Criar `Dockerfile` + `railway.json`**
5. 🔧 **Adicionar telemetria WebSocket/SSE** para dashboard
6. 🔧 **Testar localmente** (docker-compose)
7. 🚀 **Deploy no Railway** + validar

---

## Variáveis de Ambiente (Go Worker)

| Variável | Obrigatório | Default | Descrição |
|----------|-------------|---------|-----------|
| `HUB_URL` | Sim | - | URL do PuzzleRadar API |
| `WORKER_NAME` | Não | `go-worker-{random}` | Identificador único |
| `WORKER_LABEL` | Não | `railway-gpu` | Label para fleet |
| `LANES` | Não | `1024` | Lanes por worker (batch size) |
| `LOG_LEVEL` | Não | `info` | debug/info/warn/error |
| `RANGE_MODE` | Não | `full` | full/half/custom (lado do servidor) |

---

## Critérios de Sucesso

- [ ] Go worker registra e recebe range do PuzzleRadar
- [ ] Executa busca completa do range atribuído
- [ ] Reporta hashrate real a cada 10s (dashboard atualiza)
- [ ] Em caso de chave: posta no webhook + salva arquivo local
- [ ] Deploy no Railway sobe e conecta no hub automaticamente
- [ ] Range customizado (50% + exclusão X%) funciona via env vars