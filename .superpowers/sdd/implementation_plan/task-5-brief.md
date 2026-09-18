# Task Brief 5: Automated Test Suite & Walkthrough

**Files:**
- Create: [tests/miniPoolArchitecture.test.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/tests/miniPoolArchitecture.test.js)
- Modify: [tests/masterValidation.test.js](file:///d:/Programas/Desenvolvendo/PuzzleRadar/tests/masterValidation.test.js)
- Modify: [walkthrough.md](file:///d:/Programas/Desenvolvendo/PuzzleRadar/walkthrough.md)

**Requirements:**
1. Create `tests/miniPoolArchitecture.test.js` to test:
   - Parent slice fetching & micro-lote splitting ($2^{24}$).
   - PoW 6-key collection & `SHA256(k1+k2+k3+k4+k5+k6)` combined hash generation.
   - 10-column strict alignment in Google Sheets buffer with BigInt `Chunk #N` ordinal calculation.
2. Run `node tests/miniPoolArchitecture.test.js` and `node tests/masterValidation.test.js` ensuring exit code 0.
3. Generate detailed `walkthrough.md`.
