#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# 🧩 PuzzleRadar v4.0 — Worker Kangaroo (Linux / macOS / WSL)
# Puzzle #71 — 7.1 BTC
# ═══════════════════════════════════════════════════════════════════

API_BASE="${API_BASE:-https://puzzleradar-production.up.railway.app}"
WORKER_ID="${WORKER_ID:-LINUX-$(hostname)-$(whoami)}"
WALK_TYPE="${WALK_TYPE:-tame}"
MAX_STEPS="${MAX_STEPS:-0}"

# Auto-detecta walk type pelo horário (Tame = par, Wild = ímpar)
HOUR=$(date +%H)
if (( 10#$HOUR % 2 == 0 )); then
    WALK_TYPE="tame"
else
    WALK_TYPE="wild"
fi

echo ""
echo "  ╔══════════════════════════════════════════════════════════╗"
echo "  ║   🧩 PuzzleRadar v4.0 — Kangaroo Worker (Linux/Mac)      ║"
echo "  ╚══════════════════════════════════════════════════════════╝"
echo "  Worker : $WORKER_ID"
echo "  Servidor: $API_BASE"
echo "  Walk    : $WALK_TYPE"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "  [!] ERRO: Node.js não encontrado!"
    echo "  [!] Instale: https://nodejs.org"
    exit 1
fi

echo "  [✓] Node.js: $(node --version)"

# Localizar o script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_SCRIPT="$SCRIPT_DIR/src/workers/kangarooWorker.js"

if [ ! -f "$WORKER_SCRIPT" ]; then
    echo "  [!] ERRO: kangarooWorker.js não encontrado em $WORKER_SCRIPT"
    echo "  [!] Execute dentro da pasta PuzzleRadar/"
    exit 1
fi

echo "  [✓] Worker: $WORKER_SCRIPT"
echo "  ══════════════════════════════════════════════════════════"
echo "   Iniciando walk tipo: $WALK_TYPE (Ctrl+C para parar)"
echo "  ══════════════════════════════════════════════════════════"
echo ""

export API_BASE WORKER_ID WALK_TYPE MAX_STEPS
node "$WORKER_SCRIPT"
