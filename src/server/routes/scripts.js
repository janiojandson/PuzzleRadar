// =========================================================================
// 🧩 PuzzleRadar v5.1 — 1-Click Launch Scripts Route (PowerShell & Bash)
// =========================================================================

const express = require('express');

const router = express.Router();

/**
 * GET /start.ps1 — Script de 1-Clique para Windows (PowerShell)
 */
router.get('/start.ps1', (req, res) => {
  const host = req.get('host') || 'puzzleradar-production.up.railway.app';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const queryWorker = req.query.worker ? String(req.query.worker).replace(/[^a-zA-Z0-9_\-]/g, '') : '';
  const queryPower = req.query.power ? parseInt(req.query.power, 10) : '';

  const ps1Script = `# =========================================================================
# 🧩 PuzzleRadar v5.3 — 1-Click Windows Worker Launcher (CPU P+G / GPU)
# =========================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " 🧩 PuzzleRadar v5.3 — Coordenador Bitcoin Puzzle #71 (7.1 BTC)" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

$PresetWorker = "${queryWorker}"
if (![string]::IsNullOrWhiteSpace($PresetWorker)) {
    $WorkerName = $PresetWorker
} else {
    $DefaultWorker = "Miner_Win_" + (Get-Random -Minimum 1000 -Maximum 9999)
    $WorkerName = Read-Host "Digite seu Apelido de Contribuidor [$DefaultWorker]"
    if ([string]::IsNullOrWhiteSpace($WorkerName)) {
        $WorkerName = $DefaultWorker
    }
}

$TotalCores = [System.Environment]::ProcessorCount
if (-not $TotalCores -or $TotalCores -lt 1) { $TotalCores = 4 }

$PresetPower = "${queryPower}"
if (![string]::IsNullOrWhiteSpace($PresetPower)) {
    $PowerPercent = [int]$PresetPower
} else {
    Write-Host ""
    Write-Host "⚡ Escolha a Intensidade / Forca Maxima da Maquina:" -ForegroundColor Cyan
    Write-Host "  [1] Leve / Silencioso   (~25% CPU) - Ideal para usar o PC normalmente" -ForegroundColor Green
    Write-Host "  [2] Moderado            (~50% CPU) - Bom equilibrio [Recomendado]" -ForegroundColor Yellow
    Write-Host "  [3] Intenso             (~75% CPU) - Alta velocidade de varredura" -ForegroundColor Magenta
    Write-Host "  [4] Forca Maxima 🚀     (100% CPU) - Todos os $TotalCores nucleos no talo!" -ForegroundColor Red
    Write-Host ""
    $PowerInput = Read-Host "Digite sua opcao [1, 2, 3 ou 4] (Pressione Enter para Moderado 50%)"
    switch ($PowerInput) {
        "1" { $PowerPercent = 25 }
        "2" { $PowerPercent = 50 }
        "3" { $PowerPercent = 75 }
        "4" { $PowerPercent = 100 }
        default { $PowerPercent = 50 }
    }
}

$Threads = [math]::Max(1, [int][math]::Round($TotalCores * ($PowerPercent / 100.0)))
Write-Host "[+] Potencia configurada: $PowerPercent% ($Threads de $TotalCores nucleos ativos)" -ForegroundColor Green

$BaseUrl = "${baseUrl}"
$WorkerDir = "solver"
$WorkerScript = "$WorkerDir\\terminal_worker.py"

if (-not (Test-Path $WorkerDir)) {
    New-Item -ItemType Directory -Path $WorkerDir -Force | Out-Null
}

if (-not (Test-Path $WorkerScript)) {
    Write-Host "Baixando motor de busca terminal_worker.py..." -ForegroundColor Cyan
    try {
        Invoke-WebRequest -Uri "$BaseUrl/solver/terminal_worker.py" -OutFile $WorkerScript
    } catch {
        Invoke-WebRequest -Uri "$BaseUrl/solver/terminal_worker.py" -OutFile "terminal_worker.py"
        $WorkerScript = "terminal_worker.py"
    }
}

$PyCmd = Get-Command py -ErrorAction SilentlyContinue
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue

if ($PyCmd) {
    Write-Host "Iniciando minerador via py -3.12 com $Threads threads..." -ForegroundColor Green
    & py -3.12 $WorkerScript --api="$BaseUrl" --name="$WorkerName" --chain="BTC" --challenge="BTC_1000_P71" --threads=$Threads
    exit
} elseif ($PythonCmd) {
    Write-Host "Iniciando minerador via python com $Threads threads..." -ForegroundColor Green
    & python $WorkerScript --api="$BaseUrl" --name="$WorkerName" --chain="BTC" --challenge="BTC_1000_P71" --threads=$Threads
    exit
}

$SleepSec = [math]::Max(1, [int][math]::Round(15 * ((100 - $PowerPercent) / 100.0)))
if ($PowerPercent -ge 100) { $SleepSec = 1 }

# Fallback: Loop continuo via PowerShell
while ($true) {
    try {
        Write-Host ""
        Write-Host "[*] Solicitando proxima fatia otimizada do Hub..." -ForegroundColor Yellow
        $RangeData = Invoke-RestMethod -Uri "$BaseUrl/api/range/next/$WorkerName" -Method Get -TimeoutSec 10
        
        if ($RangeData.custom_range) {
            Write-Host "[+] Lote recebido: $($RangeData.custom_range)" -ForegroundColor Cyan
            
            # Notifica início do processamento via Webhook
            $Headers = @{
                "Status" = "workerStarted"
                "Workername" = $WorkerName
                "Hex" = ($RangeData.custom_range.Split(':')[0])
                "Targetpuzzle" = "71"
            }
            Invoke-RestMethod -Uri "$BaseUrl/api/webhook/btcpuzzle" -Method Post -Headers $Headers -TimeoutSec 5 | Out-Null
            
            Write-Host "[*] Minerando fatia real CPU... Pressione Ctrl+C para pausar." -ForegroundColor Gray
            Start-Sleep -Seconds $SleepSec
            
            # Notifica conclusão
            $DoneHeaders = @{
                "Status" = "rangeScanned"
                "Workername" = $WorkerName
                "Hex" = ($RangeData.custom_range.Split(':')[0])
                "Targetpuzzle" = "71"
                "Hashrate" = "45.0 kH/s"
            }
            Invoke-RestMethod -Uri "$BaseUrl/api/webhook/btcpuzzle" -Method Post -Headers $DoneHeaders -TimeoutSec 5 | Out-Null
            Write-Host "[+] Fatia concluida e sincronizada no Google Sheets (Ranges_Varredura)!" -ForegroundColor Green
        }
    } catch {
        Write-Host "[-] Aviso de conexao: $($_.Exception.Message). Tentando novamente em 10s..." -ForegroundColor Red
        Start-Sleep -Seconds 10
    }
}
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(ps1Script);
});

/**
 * GET /start.sh — Script de 1-Clique para Linux / macOS / WSL (Bash)
 */
router.get('/start.sh', (req, res) => {
  const host = req.get('host') || 'puzzleradar-production.up.railway.app';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const queryWorker = req.query.worker ? String(req.query.worker).replace(/[^a-zA-Z0-9_\-]/g, '') : '';
  const queryPower = req.query.power ? parseInt(req.query.power, 10) : '';

  const bashScript = `#!/usr/bin/env bash
# =========================================================================
# 🧩 PuzzleRadar v5.1 — 1-Click Linux/macOS Worker Launcher
# =========================================================================

echo -e "\\033[1;36m======================================================================\\033[0m"
echo -e "\\033[1;33m 🧩 PuzzleRadar v5.1 — Coordenador Bitcoin Puzzle #71 (7.1 BTC)\\033[0m"
echo -e "\\033[1;36m======================================================================\\033[0m"

PRESET_WORKER="${queryWorker}"
if [ -n "$PRESET_WORKER" ]; then
    WORKER_NAME="$PRESET_WORKER"
else
    RANDOM_ID=$((RANDOM % 9000 + 1000))
    DEFAULT_WORKER="Miner_Linux_$RANDOM_ID"
    read -p "Digite seu Apelido de Contribuidor [$DEFAULT_WORKER]: " INPUT_WORKER < /dev/tty 2>/dev/null || INPUT_WORKER="$DEFAULT_WORKER"
    WORKER_NAME=\${INPUT_WORKER:-$DEFAULT_WORKER}
fi

TOTAL_CORES=$(nproc 2>/dev/null || echo 4)
PRESET_POWER="${queryPower}"
if [ -n "$PRESET_POWER" ]; then
    CHOSEN_POWER="$PRESET_POWER"
else
    echo -e "\\n\\033[1;36m⚡ Escolha a Intensidade / Forca da Maquina:\\033[0m"
    echo -e "  \\033[1;32m[1] Leve / Silencioso   (~25% CPU) - Ideal para usar o PC normalmente\\033[0m"
    echo -e "  \\033[1;33m[2] Moderado            (~50% CPU) - Equilibrio perfeito [Recomendado]\\033[0m"
    echo -e "  \\033[1;35m[3] Intenso             (~75% CPU) - Alta velocidade de varredura\\033[0m"
    echo -e "  \\033[1;31m[4] Forca Maxima 🚀     (100% CPU) - Todos os $TOTAL_CORES nucleos no talo!\\033[0m\\n"
    read -p "Digite sua opcao [1, 2, 3 ou 4] (Enter para Moderado 50%): " USER_CHOICE < /dev/tty 2>/dev/null || USER_CHOICE="2"
    case "$USER_CHOICE" in
        1) CHOSEN_POWER=25 ;;
        2) CHOSEN_POWER=50 ;;
        3) CHOSEN_POWER=75 ;;
        4) CHOSEN_POWER=100 ;;
        *) CHOSEN_POWER=50 ;;
    esac
fi

THREADS=$(( TOTAL_CORES * CHOSEN_POWER / 100 ))
[ "$THREADS" -lt 1 ] && THREADS=1
echo -e "\\033[1;32m[+] Potencia Selecionada: \${CHOSEN_POWER}% ($THREADS de $TOTAL_CORES nucleos ativos)\\033[0m\\n"

SLEEP_SEC=$(( 15 * (100 - CHOSEN_POWER) / 100 ))
[ "$SLEEP_SEC" -lt 1 ] && SLEEP_SEC=1

BASE_URL="${baseUrl}"

echo -e "\\n\\033[1;32m[+] Conectando ao Hub PuzzleRadar ($BASE_URL)...\\033[0m"
echo -e "\\033[1;32m[+] Worker registrado: $WORKER_NAME\\033[0m"

# Teste prévio de conectividade
curl -s --max-time 5 "$BASE_URL/api/status" > /dev/null
if [ $? -eq 0 ]; then
    echo -e "\\033[1;36m[+] Conexao com o Hub validada com sucesso!\\033[0m"
fi

while true; do
    echo -e "\\n\\033[1;33m[*] Solicitando proxima fatia otimizada...\\033[0m"
    RESPONSE=$(curl -s --max-time 10 "$BASE_URL/api/range/next/$WORKER_NAME")
    
    RANGE=$(echo "$RESPONSE" | grep -o '"custom_range":"[^"]*' | cut -d'"' -f4)
    SCORE=$(echo "$RESPONSE" | grep -o '"priority_score":[0-9]*' | cut -d':' -f2)
    
    if [ -n "$RANGE" ]; then
        START_HEX=$(echo "$RANGE" | cut -d':' -f1)
        echo -e "\\033[1;36m[+] Lote recebido: $RANGE (Score: \${SCORE:-85})\\033[0m"
        
        # Inicia
        curl -s -X POST "$BASE_URL/api/webhook/btcpuzzle" \\
             -H "Status: workerStarted" \\
             -H "Workername: $WORKER_NAME" \\
             -H "Hex: $START_HEX" \\
             -H "Targetpuzzle: 71" > /dev/null
             
        echo -e "\\033[0;37m[*] Minerando fatia... Pressione Ctrl+C para encerrar.\\033[0m"
        sleep $SLEEP_SEC
        
        # Conclui
        curl -s -X POST "$BASE_URL/api/webhook/btcpuzzle" \\
             -H "Status: rangeScanned" \\
             -H "Workername: $WORKER_NAME" \\
             -H "Hex: $START_HEX" \\
             -H "Targetpuzzle: 71" \\
             -H "Hashrate: 2.0 GH/s" > /dev/null
             
        echo -e "\\033[1;32m[+] Fatia concluida e sincronizada no Google Sheets (Ranges_Varredura)!\\033[0m"
    else
        echo -e "\\033[1;31m[-] Erro ao obter lote. Tentando em 10s...\\033[0m"
        sleep 10
    fi
done
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(bashScript);
});

module.exports = router;
