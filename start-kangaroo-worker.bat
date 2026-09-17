@echo off
chcp 65001 >nul 2>&1
title 🧩 PuzzleRadar v4.0 — Worker Kangaroo Local (BTC Puzzle #71)
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════════╗
echo  ║   🧩 PuzzleRadar v4.0 — Kangaroo Worker (Windows / CPU)         ║
echo  ║   Conectando ao Pool de Colisões Distribuídas                    ║
echo  ║   Alvo: Puzzle #71 — 7.1 BTC                                    ║
echo  ╚══════════════════════════════════════════════════════════════════╝
echo.

:: ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
if "%API_BASE%"=="" set API_BASE=http://localhost:3010
if "%PUZZLE_ID%"=="" set PUZZLE_ID=BTC_1000_P71
set WORKER_ID=WIN-%COMPUTERNAME%-%USERNAME%
set WALK_TYPE=

:: Detectar walk_type pelo horário (Tame de manhã, Wild à tarde)
for /F "tokens=1 delims=:" %%a in ("%time%") do (
    set HOUR=%%a
)
if %HOUR% LSS 12 (
    set WALK_TYPE=tame
) else (
    set WALK_TYPE=wild
)

echo  [*] Worker ID : %WORKER_ID%
echo  [*] Servidor  : %API_BASE%
echo  [*] Walk Type : %WALK_TYPE% (Tame = manhã, Wild = tarde)
echo  [*] Diretório : %~dp0
echo.

:: ─── VERIFICAR NODE.JS ───────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [!] ERRO: Node.js não encontrado!
    echo  [!] Baixe em: https://nodejs.org
    pause
    exit /b 1
)
echo  [✓] Node.js encontrado: 
node --version

:: ─── LOCALIZAR kangarooWorker.js ─────────────────────────────────────────────
set WORKER_SCRIPT=%~dp0src\workers\kangarooWorker.js
if not exist "%WORKER_SCRIPT%" (
    set WORKER_SCRIPT=%~dp0PuzzleRadar\src\workers\kangarooWorker.js
)
if not exist "%WORKER_SCRIPT%" (
    echo  [!] ERRO: kangarooWorker.js não encontrado.
    echo  [!] Execute este .bat dentro da pasta PuzzleRadar\
    pause
    exit /b 1
)
echo  [✓] Worker script: %WORKER_SCRIPT%

:: ─── BUSCAR PUZZLE_ID PELO NÚMERO ────────────────────────────────────────────
echo.
echo  [*] Buscando Puzzle #71 no servidor...
set PUZZLE_ID_CMD=curl -s "%API_BASE%/api/puzzles" 2>nul
echo  [!] Usando ID padrão do Puzzle #71 (caso o curl falhe)
:: PUZZLE_ID será preenchido via env ou default; o worker busca via /api/kangaroo/seed/
echo.

:: ─── INICIAR WORKER ──────────────────────────────────────────────────────────
echo  ═══════════════════════════════════════════════════════════════════
echo   Iniciando walk tipo: %WALK_TYPE% (Ctrl+C para parar)
echo  ═══════════════════════════════════════════════════════════════════
echo.

set API_BASE=%API_BASE%
set WORKER_ID=%WORKER_ID%
set WALK_TYPE=%WALK_TYPE%
set MAX_STEPS=0

node "%WORKER_SCRIPT%"

echo.
echo  [!] Worker encerrado.
pause
