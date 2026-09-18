# Walkthrough — Arquitetura Mini-Pool Real, Motor Criptográfico CPU ($P+G$) & Schema v5.3

## Resumo das Conquistas

Nesta iteração, implementamos a **Arquitetura de Mini-Pool Real** no PuzzleRadar v5.3, integrando a coordenação autônoma de fatias pai de $2^{45}$ chaves da API oficial `btcpuzzle.info`, o fatiamento em micro-lotes de $2^{24}$ chaves (~16.7M) para navegadores e CPUs, o motor criptográfico de adição sequencial de pontos em curva secp256k1 ($P_{i+1} = P_i + G$), o cálculo BigInt ordinal de `Chunk #N`, e o alinhamento estrito de 10 colunas no buffer/webhook do Google Sheets.

---

## Frentes de Trabalho Executadas

### 1. Gestor de Fatia Pai & Agregador de PoW (`src/services/parentLoteManager.js`)
- **Integração Oficial:** Conecta-se via HTTP `GET` em `https://api.btcpuzzle.info/puzzle/71/range` utilizando `process.env.BTCPUZZLE_USER_TOKEN`.
- **Mapeamento HASH160:** Converte o endereço alvo do Puzzle 71 (`1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU`) e os 6 endereços de Prova de Trabalho (PoW) em seus 20-byte HASH160 em memória.
- **Micro-Lotes CPU/Navegador:** Subdivide a fatia pai em fatias contíguas de $2^{24}$ chaves (~16.777.216 chaves) fornecidas via `GET /api/range/next/:worker_id`.
- **Agregação PoW & Submissão Oficial:** Ao receber as 6 chaves PoW dos mineradores locais (`POST /api/worker/submit-pow`), calcula `SHA256(k1 + k2 + k3 + k4 + k5 + k6)` e dispara a submissão via `PUT https://api.btcpuzzle.info/puzzle/71/range` com headers oficiais (`UserToken`, `HEX`, `HashedProofKey`, `WorkerName`).

### 2. Motor Criptográfico Real para CPU ($P_{i+1} = P_i + G$)
- **Navegador Web Worker (`public/js/worker-thread.js`):** Implementa adição sequencial de pontos em curva elíptica secp256k1 com BigInt nativo. Varre os micro-lotes de $2^{24}$ chaves sem engasgos na interface gráfica, reportando progresso a cada 25.000 chaves.
- **Terminal Node.js (`src/workers/cpuMiner.js`):** Motor autônomo em Node.js com adição de pontos elípticos, exibindo velocidade real ($kH/s$) e barra de progresso no terminal.
- **Scripts de 1-Clique (`/start.ps1` e `/start.sh`):** Atualizados em `src/server/routes/scripts.js` para detectar Node.js e executar o `cpuMiner.js`, mantendo instruções documentadas para mineradores GPU NVIDIA via `btcpuzzle.exe -c pool.conf`.

### 3. Buffer do Google Sheets & Chunk # BigInt
- **Numeração Ordinal BigInt:** Em `src/services/loteManager.js` e `src/lib/googleSheetsBuffer.js`:
  ```js
  const BASE_START = 0x400000000000000000n;
  const chunkIndex = Number((BigInt("0x" + startHex.replace(/^0x/i, '')) - BASE_START) / stepSize) + 1;
  const chunkLabel = `Chunk #${chunkIndex}`;
  ```
- **Alinhamento Estrito de 10 Colunas:** `googleSheetsBuffer.js` e `src/server/routes/webhook.js` garantem que o array de colunas contenha exatamente 10 elementos `[Timestamp, Chain, Challenge ID, Chunk #, Range Início, Range Fim, Worker, Status, Hashrate, Descoberta]`. Se `endHex` estiver ausente no payload, é deduzido automaticamente via `(startBig + stepSize)`.

### 4. Google Apps Script v5.3 & Reatividade Frontend
- **Apps Script v5.3 (`src/services/googleAppsScript.js`):** Código mestre v5.3 atualizado com suporte a `batch_ranges` e sincronização ao vivo com `btcpuzzle.info`.
- **Reatividade e Apelido de Usuário (`public/app.js`):** Funções de cópia de script injetam dinamicamente o apelido do usuário. Tacômetro e badges reagem em tempo real aos pings dos workers.

---

## Verificação e Resultados de Testes

### 1. Suíte da Arquitetura Mini-Pool (`tests/miniPoolArchitecture.test.js`)
- Executado `node tests/miniPoolArchitecture.test.js`:
  - ✅ Micro-fatiamento de $2^{24}$ chaves validado.
  - ✅ Agregação de 6 chaves PoW e hash `SHA256(k1+...k6)` validado.
  - ✅ Cálculo ordinal BigInt `Chunk #1` e 10 colunas no buffer validados.
  - ✅ Motor matemático de adição de pontos $P+G$ em secp256k1 validado com 100% de precisão.
  - **Resultado:** Exit Code 0.

### 2. Validação Mestre Integrada (`tests/masterValidation.test.js`)
- Executado `node tests/masterValidation.test.js`:
  - ✅ 12/12 capítulos de testes integrados aprovados (Puzzles 1000 BTC, Anti-MEV, Sheets Buffer, Criptografia).
  - **Resultado:** 100% de aprovação (Exit Code 0).

---

## Tabela de Commits no Repositório

| Commit Hash | Descrição do Commit |
|---|---|
| `8d71628` | `feat(sheets): calculate BigInt ordinal Chunk label and enforce 10-column buffer` |
| `00911e2` | `feat(minipool): implement parent lote manager and PoW aggregator with micro-lots` |
| `8dd94ce` | `feat(crypto): implement real secp256k1 point addition engine for CPU and browser worker` |
| `4a96484` | `feat(script): update Google Apps Script to v5.3 and refine frontend copy helpers` |
