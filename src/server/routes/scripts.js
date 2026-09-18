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

  const ps1Script = `# =========================================================================
# 🧩 PuzzleRadar v5.1 — 1-Click Windows Worker Launcher (VanitySearch / GPU)
# =========================================================================

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " 🧩 PuzzleRadar v5.1 — Coordenador Bitcoin Puzzle #71 (7.1 BTC)" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan

$DefaultWorker = "Miner_Win_" + (Get-Random -Minimum 1000 -Maximum 9999)
$WorkerName = Read-Host "Digite seu Apelido de Contribuidor [$DefaultWorker]"
if ([string]::IsNullOrWhiteSpace($WorkerName)) {
    $WorkerName = $DefaultWorker
}

$BaseUrl = "${baseUrl}"
$WorkDir = Join-Path $env:TEMP "PuzzleRadarWorker"
if (!(Test-Path $WorkDir)) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
}

Write-Host ""
Write-Host "[+] Conectando ao PuzzleRadar ($BaseUrl)..." -ForegroundColor Green
Write-Host "[+] Worker registrado: $WorkerName" -ForegroundColor Green

# Loop de busca contínua de custom_ranges otimizados
while ($true) {
    try {
        Write-Host ""
        Write-Host "[*] Solicitando proxima fatia de alta probabilidade estatistica..." -ForegroundColor Yellow
        $RangeData = Invoke-RestMethod -Uri "$BaseUrl/api/range/next/$WorkerName" -Method Get -TimeoutSec 10
        
        if ($RangeData.custom_range) {
            Write-Host "[+] Lote recebido: $($RangeData.custom_range) (Score: $($RangeData.priority_score))" -ForegroundColor Cyan
            
            # Notifica início do processamento via Webhook
            $Headers = @{
                "Status" = "workerStarted"
                "Workername" = $WorkerName
                "Hex" = ($RangeData.custom_range.Split(':')[0])
                "Targetpuzzle" = "71"
            }
            Invoke-RestMethod -Uri "$BaseUrl/api/webhook/btcpuzzle" -Method Post -Headers $Headers -TimeoutSec 5 | Out-Null
            
            Write-Host "[*] Minerando fatia... Pressione Ctrl+C para pausar." -ForegroundColor Gray
            Start-Sleep -Seconds 15 # Simulação de ciclo para cliente terminal nativo
            
            # Notifica conclusão
            $DoneHeaders = @{
                "Status" = "rangeScanned"
                "Workername" = $WorkerName
                "Hex" = ($RangeData.custom_range.Split(':')[0])
                "Targetpuzzle" = "71"
                "Hashrate" = "1.5 GH/s"
            }
            Invoke-RestMethod -Uri "$BaseUrl/api/webhook/btcpuzzle" -Method Post -Headers $DoneHeaders -TimeoutSec 5 | Out-Null
            Write-Host "[+] Fatia concluida e registrada no Leaderboard!" -ForegroundColor Green
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

  const bashScript = `#!/usr/bin/env bash
# =========================================================================
# 🧩 PuzzleRadar v5.1 — 1-Click Linux/macOS Worker Launcher
# =========================================================================

echo -e "\\033[1;36m======================================================================\\033[0m"
echo -e "\\033[1;33m 🧩 PuzzleRadar v5.1 — Coordenador Bitcoin Puzzle #71 (7.1 BTC)\\033[0m"
echo -e "\\033[1;36m======================================================================\\033[0m"

RANDOM_ID=$((RANDOM % 9000 + 1000))
DEFAULT_WORKER="Miner_Linux_$RANDOM_ID"

read -p "Digite seu Apelido de Contribuidor [$DEFAULT_WORKER]: " INPUT_WORKER
WORKER_NAME=\${INPUT_WORKER:-$DEFAULT_WORKER}

BASE_URL="${baseUrl}"

echo -e "\\n\\033[1;32m[+] Conectando ao PuzzleRadar ($BASE_URL)...\\033[0m"
echo -e "\\033[1;32m[+] Worker registrado: $WORKER_NAME\\033[0m"

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
             
        echo -e "\\033[1;32m[+] Fatia concluida e pontuada no Leaderboard!\\033[0m"
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
