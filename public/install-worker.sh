#!/usr/bin/env bash
# ==============================================================================
# 🧩 PuzzleRadar — Universal 1-Click Worker Installer (Linux / macOS / WSL)
# ==============================================================================
# Uso:
#   curl -sSL https://puzzleradar-production.up.railway.app/install-worker.sh | bash -s -- --token=SEU_WORKER_TOKEN
# ==============================================================================

set -e

WORKER_TOKEN=""
POOL_URL="https://puzzleradar-production.up.railway.app"
CHALLENGE_ID="BTC_1000_P71"
CHAIN="BTC"
THREADS=2

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --token=*) WORKER_TOKEN="${1#*=}" ;;
        --token) WORKER_TOKEN="$2"; shift ;;
        --pool=*) POOL_URL="${1#*=}" ;;
        --challenge=*) CHALLENGE_ID="${1#*=}" ;;
        --chain=*) CHAIN="${1#*=}" ;;
        --threads=*) THREADS="${1#*=}" ;;
        *) echo "⚠️ Parâmetro desconhecido: $1" ;;
    esac
    shift
done

echo "=========================================================================="
echo "🧩 PuzzleRadar — Conexão Institucional de Mineração Criptográfica"
echo "=========================================================================="

if [ -z "$WORKER_TOKEN" ]; then
    WORKER_TOKEN="wrk_anon_$(date +%s)"
    echo "ℹ️ Nenhum --token especificado. Gerado token temporário: $WORKER_TOKEN"
else
    echo "🔑 Worker Token autenticado: $WORKER_TOKEN"
fi

echo "🌐 Servidor Pool: $POOL_URL"
echo "🎯 Desafio Ativo: $CHALLENGE_ID ($CHAIN)"
echo "⚡ Threads: $THREADS"

# Cria diretório de trabalho
WORK_DIR="$HOME/.puzzleradar_worker"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# Verifica Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado. Por favor, instale o Python 3 para prosseguir."
    exit 1
fi

# Instala dependências
echo "📦 Verificando dependências Python..."
pip3 install -q requests ecdsa pycryptodome base58 2>/dev/null || pip install -q requests ecdsa pycryptodome base58 2>/dev/null

# Baixa worker validado
echo "⬇️ Baixando worker validado de produção..."
curl -s -L -o colab_worker.py "$POOL_URL/solver/colab_worker.py"

echo "🚀 Iniciando worker conectado ao sindicato..."
python3 colab_worker.py --api="$POOL_URL" --token="$WORKER_TOKEN" --chain="$CHAIN" --challenge="$CHALLENGE_ID" --threads="$THREADS" || \
python colab_worker.py --api="$POOL_URL" --token="$WORKER_TOKEN" --chain="$CHAIN" --challenge="$CHALLENGE_ID" --threads="$THREADS"
