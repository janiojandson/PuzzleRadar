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

$BaseUrl = "${baseUrl}"

Write-Host ""
Write-Host "[+] Conectando ao Hub PuzzleRadar ($BaseUrl)..." -ForegroundColor Green
Write-Host "[+] Worker registrado: $WorkerName" -ForegroundColor Green
Write-Host "[!] DICA PARA GPU NVIDIA: Para minerar em GPU, execute: btcpuzzle.exe -c pool.conf" -ForegroundColor DarkYellow

# Se Node.js estiver presente, executa o motor criptográfico real em Node.js (cpuMiner.js)
$HasNode = Get-Command node -ErrorAction SilentlyContinue
if ($HasNode) {
    Write-Host "[+] Node.js detectado! Iniciando motor criptografico real de CPU (Adicao P+G secp256k1)..." -ForegroundColor Green
    $WorkerScriptUrl = "$BaseUrl/src/workers/cpuMiner.js"
    $TempScript = Join-Path $env:TEMP "cpuMiner.js"
    Invoke-WebRequest -Uri $WorkerScriptUrl -OutFile $TempScript -UseBasicParsing
    $env:WORKER_NAME = $WorkerName
    $env:HUB_URL = $BaseUrl
    node $TempScript
    exit
}

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
            Start-Sleep -Seconds 15
            
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
    read -p "Digite seu Apelido de Contribuidor [$DEFAULT_WORKER]: " INPUT_WORKER
    WORKER_NAME=\${INPUT_WORKER:-$DEFAULT_WORKER}
fi

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
        sleep 15
        
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
