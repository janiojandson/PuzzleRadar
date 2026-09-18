# Task Brief 2: Mini-Pool Parent Lote Manager & PoW Aggregator

**Files:**
- Create: [src/services/parentLoteManager.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/services/parentLoteManager.js)
- Modify: [src/server/routes/range.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/server/routes/range.js)
- Modify: [src/server/routes/workers.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/server/routes/workers.js)

**Requirements:**
1. Connect to official API `GET https://api.btcpuzzle.info/puzzle/71/range` using `process.env.BTCPUZZLE_USER_TOKEN`.
2. Cache parent slice data: `hex` (prefix), `targetAddress` (`1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU`), and 6 `proofOfWorkAddresses`.
3. Convert all target addresses (Puzzle 71 target + 6 PoW targets) into HASH160.
4. Subdivide parent slice into micro-lotes: `STEP_CPU = 1n << 24n` (~16,777,216 keys).
5. Expose micro-lote + 7 HASH160 targets on `GET /api/range/next/:worker_id`.
6. Add `POST /api/worker/submit-pow` to receive individual PoW proof keys.
7. Upon acquiring all 6 PoW keys:
   - Calculate `hashedProofKey = SHA256(k1 + k2 + k3 + k4 + k5 + k6)`.
   - Dispatch `PUT https://api.btcpuzzle.info/puzzle/71/range` with headers `{ UserToken, HEX: parentHex, HashedProofKey: hashedProofKey, WorkerName: 'PuzzleRadar_Fleet' }`.
   - Log completion to Google Sheets buffer: "🎯 FATIA PAI CONCLUÍDA E SUBMETIDA OFICIALMENTE À POOL!".
