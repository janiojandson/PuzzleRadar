# Task Brief 3: Real secp256k1 Point Addition Engine ($P_{i+1} = P_i + G$) for CPU & Terminal

**Files:**
- Modify: [public/js/worker-thread.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/public/js/worker-thread.js)
- Create: [src/workers/cpuMiner.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/workers/cpuMiner.js)
- Modify: [src/server/routes/scripts.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/server/routes/scripts.js)

**Requirements:**
1. Browser Worker (`worker-thread.js`):
   - Implement secp256k1 point addition ($P_{i+1} = P_i + G$) using BigInt.
   - Scan micro-lotes of 16.7M keys, comparing pubkey HASH160 against the 7 target HASH160s.
   - Emit `progress` every 25,000 keys and trigger Anti-MEV / submit-pow upon match.
2. Terminal Miner (`src/workers/cpuMiner.js`):
   - Standalone Node.js worker implementing real secp256k1 point addition.
   - Display real velocity in kH/s and progress bar in console.
3. Terminal Scripts (`src/server/routes/scripts.js`):
   - Update `/start.ps1` and `/start.sh` to run `cpuMiner.js` (or inline C# via PowerShell `Add-Type` fallback).
   - Document GPU option `btcpuzzle.exe -c pool.conf`.
