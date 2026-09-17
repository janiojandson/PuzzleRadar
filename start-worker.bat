@echo off
chcp 65001 >nul 2>&1
title 🧩 PuzzleRadar - Minerador Local Híbrido (AMD / NVIDIA / CPU)
echo ========================================================
echo   [+] PuzzleRadar - Minerador Híbrido (AMD / NVIDIA / CPU)
echo   [+] Alvo: BTC_1000_P71 (7.1 BTC)
echo ========================================================
echo.

py -3.12 solver/colab_worker.py --api="https://puzzleradar-production.up.railway.app" --token="pzk_admin_master_gpu_token" --chain="BTC" --challenge="BTC_1000_P71"

if errorlevel 1 (
    echo.
    echo [!] Tentando com python padrao...
    python solver/colab_worker.py --api="https://puzzleradar-production.up.railway.app" --token="pzk_admin_master_gpu_token" --chain="BTC" --challenge="BTC_1000_P71"
)

pause
