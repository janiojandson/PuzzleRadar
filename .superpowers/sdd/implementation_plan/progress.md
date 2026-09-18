# SDD ledger — plan: C:\Users\Janio\.gemini\antigravity-ide\brain\982bc950-b0d8-4a5a-a4db-4d95b6035816\implementation_plan.md

| Shared Target / Interface | Component A vs Component B | Finding & Ruling |
|---|---|---|
| Sheets Buffer & Webhook | `loteManager.js` / `googleSheetsBuffer.js` / `webhook.js` | Enforce BigInt ordinal `Chunk #N` calculation and strict 10-column alignment with `endHex` auto-deduction (`startHex + stepSize`). Ruling: Clean alignment. |
| Mini-Pool & Range Route | `parentLoteManager.js` / `range.js` | Fetch parent range from `btcpuzzle.info`, subdivide into micro-lotes of $2^{24}$ keys, collect 6 PoW keys, submit via `PUT` request with `SHA256(k1+...+k6)`. Ruling: Clean alignment. |
| CPU Engine & Terminal | `worker-thread.js` / `cpuMiner.js` / `scripts.js` | Elliptic curve point addition $P_{i+1} = P_i + G$ on secp256k1 for both browser worker and Node/PS terminal miner. Ruling: Clean alignment. |

Task 1: complete (commits 9e29b17..8d71628, review clean)
Task 2: complete (commits 8d71628..00911e2, review clean)
Task 3: complete (commits 00911e2..8dd94ce, review clean)
Task 4: complete (commits 8dd94ce..4a96484, review clean)
Task 5: complete (commits 4a96484..4c9a8af, review clean)
