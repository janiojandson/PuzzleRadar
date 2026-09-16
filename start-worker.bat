@echo off
title PuzzleRadar Local Worker Node - BTC_1000_P71
echo ========================================================
echo   [+] PuzzleRadar - Minerador Local de GPU/CUDA (Windows)
echo ========================================================
echo.

py -3.12 solver/colab_worker.py --api="https://puzzleradar-production.up.railway.app" --token="pzk_admin_master_gpu_token" --chain="BTC" --challenge="BTC_1000_P71"

if errorlevel 1 (
    echo.
    echo [!] Tentando com python padrao...
    python solver/colab_worker.py --api="https://puzzleradar-production.up.railway.app" --token="pzk_admin_master_gpu_token" --chain="BTC" --challenge="BTC_1000_P71"
)

pause
