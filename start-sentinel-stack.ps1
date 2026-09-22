# start-sentinel-stack.ps1 — Start Sentinel + Bridge + Worker (Windows)
# Usage: .\start-sentinel-stack.ps1

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " ECDSA Sentinel Stack (Windows)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check Redis
Write-Host "`n[1/3] Checking Redis..." -ForegroundColor Yellow
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("localhost", 6379)
    $tcp.Close()
    Write-Host "  Redis already running on port 6379" -ForegroundColor Green
} catch {
    Write-Host "  Redis not running. Starting Redis in WSL..." -ForegroundColor Yellow
    Start-Process -FilePath "wsl" -ArgumentList "-d Ubuntu -- bash -c '/tmp/redis-build/redis-7.0.15/src/redis-server --daemonize yes --port 6379'" -WindowStyle Minimized
    Start-Sleep -Seconds 2
    Write-Host "  Redis started in WSL" -ForegroundColor Green
}

# Start Sentinel (Python)
Write-Host "`n[2/3] Starting ECDSA Sentinel..." -ForegroundColor Yellow
$sentinelPath = "D:\Programas\Desenvolvendo\ecdsa-sentinel"
Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command", "cd '$sentinelPath'; python sentinel.py"
) -WindowStyle Normal
Write-Host "  Sentinel started in new terminal" -ForegroundColor Green

# Start Bridge + Worker (Node.js)
Write-Host "`n[3/3] Starting PuzzleRadar Bridge + Worker..." -ForegroundColor Yellow
$puzzleRadarPath = "D:\Programas\Desenvolvendo\PuzzleRadar"

Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoExit",
    "-Command", "cd '$puzzleRadarPath'; node start-bridge-worker.js"
) -WindowStyle Normal
Write-Host "  Bridge + Worker started in new terminal" -ForegroundColor Green

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host " Stack Running!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Sentinel: Python process (new terminal)"
Write-Host " Bridge:   Node.js process (new terminal)"
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop" -ForegroundColor DarkGray
