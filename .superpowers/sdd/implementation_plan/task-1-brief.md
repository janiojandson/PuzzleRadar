# Task Brief 1: Schema Buffer & Chunk Ordinal BigInt

**Files:**
- Modify: [src/services/loteManager.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/services/loteManager.js)
- Modify: [src/lib/googleSheetsBuffer.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/lib/googleSheetsBuffer.js)
- Modify: [src/server/routes/webhook.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/src/server/routes/webhook.js)

**Requirements:**
1. Compute ordinal `chunkIndex` using BigInt:
   `const BASE_START = 0x400000000000000000n;`
   `const chunkIndex = Number((BigInt("0x" + startHex.replace(/^0x/i, '')) - BASE_START) / stepSize) + 1;`
   `const chunkLabel = "Chunk #" + chunkIndex;`
2. Enforce strict 10-column formatting in Google Sheets buffer:
   `[Timestamp, Chain, Challenge ID, Chunk #, Range Início, Range Fim, Worker, Status, Hashrate, Descoberta]`
3. Auto-deduce missing `endHex` by calculating `(startBig + stepSize).toString(16).padStart(18, '0')`.
