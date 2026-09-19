# Walkthrough — Arquitetura Mini-Pool Real, Motor Criptográfico CPU ($P+G$) & Schema v5.3

## Resumo das Conquistas

Nesta iteração, implementamos a **Arquitetura de Mini-Pool Real** no PuzzleRadar v5.3, integrando a coordenação autônoma de fatias pai de $2^{45}$ chaves da API oficial `btcpuzzle.info`, o fatiamento em micro-lotes de $2^{24}$ chaves (~16.7M) para navegadores e CPUs, o motor criptográfico de adição sequencial de pontos em curva secp256k1 ($P_{i+1} = P_i + G$), o cálculo BigInt ordinal de `Chunk #N`, e o alinhamento estrito de 10 colunas no buffer/webhook do Google Sheets.

---

## Frentes de Trabalho Executadas

### 1. Gestor de Fatia Pai & Agregador de PoW (`src/services/parentLoteManager.js`)
# Walkthrough: Nova Coluna Dedicada, Leaderboard Dinâmico Online, Fix NaN% e Mineração Contínua 24/7

Nesta iteração, implementamos todas as melhorias visuais, de controle e estabilidade solicitadas para o Bitcoin Puzzle #71 e a integração com a API oficial da pool (`btcpuzzle.info`).

---

## 1. Informação das 6 Chaves PoW e Envio ao Servidor Oficial: Como Funciona?

> [!IMPORTANT]
> **A informação das 6 chaves PoW NÃO foi retirada!**
> Ela está ativa no `parentLoteManager.js`, que faz a ponte com a API oficial `https://api.btcpuzzle.info/puzzle/71/range`.

### Como Funciona Visualmente no Painel (Dashboard):
1. **Card "Fatia Pai Oficial & PoW (btcpuzzle.info)"**:
   - **Range Pai Ativo**: Exibe a fatia oficial em execução (ex: `0x4000000...` cobrindo $2^{45}$ chaves).
   - **Marcos Comunitários (60x)**: Exibe `X / 60 Marcos (Y%)` com barra dinâmica de progresso acelerada em 10x.
   - **Contador PoW Oficial**: Exibe `Z / 6 PoW Oficiais`.
   - **Grid dos 6 Desafios PoW**: 6 caixas dedicadas (`PoW #1` a `PoW #6`), com os endereços de desafio oficiais (`1PWo...`).
   - Cada badge exibe `⏳ Varrendo...` e, no momento em que a chave privada for computada pelos mineradores, transforma-se em um badge verde brilhante `✅ ACHADA: 0x...`.
   - Assim que a 6ª chave é encontrada, o card aciona o banner de celebração: `🎉 6/6 CHAVES PoW ENCONTRADAS & 60/60 MARCOS! Lote Pai submetido com sucesso à API Oficial!` com status `SUBMETIDO AO OFICIAL (HTTP 200)`.

### Como Funciona na Planilha Google (Aba `Ranges_Varredura`):
- **Nova Coluna Dedicada (Coluna 9)**: Em vez de misturar com o status da varredura, criamos a coluna:
  - **`Fatia Pai & PoW Oficial`**:
    - Enquanto varre: `Pai: 0x4000000 [Marcos: 0/60 | PoW: 0/6]`
    - Quando enviada ao oficial: `🚀 6/6 PoW ENVIADO AO OFICIAL! (Pai: 0x4000000 | 60/60 Marcos)`
- **`Status da Varredura` (Coluna 8)** agora fica limpa e legível:
  - `COMPLETED (Terminal)` para nós GPU/CPU locais.
  - `COMPLETED (Navegador)` para o minerador Web 1-Click.

---

## 2. Correção do Progresso da Pool ("NaN% Concluído")

- **Diagnóstico**: No frontend (`public/app.js`), o cálculo tentava ler `data.puzzle71.scannedRanges`, campo que não existia na resposta de `/api/status`, dividindo `undefined / 1000`, o que gerava `NaN`.
- **Correção**: Implementamos verificação com fallback em `data.puzzle71.progressPercent`, `data.puzzle71.completed / totalLotes` e `powProgressPercent`, garantindo valor numérico sempre formatado (ex: `0.0000% Concluído`).

---

## 3. Registro Anti-Colisão de Ranges Varridos

- **Alinhamento com a API Oficial**:
  - O cabeçalho e os indicadores da aba `Ranges & Space Pruning` foram ajustados para refletir a decomposição das fatias oficiais de $2^{45}$ chaves em micro-lotes atômicos de $2^{24}$ chaves.
  - O card exibe a fatia pai oficial ativa e o buffer de quarentena.
  - A tabela de fatias recentes agora conta com a coluna **`Fatia Pai & PoW Oficial`**, permitindo auditar exatamente qual fatia oficial cada worker está processando.

---

## 4. Leaderboard da Comunidade: Nós Reais Aparecendo ONLINE

- **Diagnóstico**: O `leaderboardService` dependia de mock seeds estáticos que expiravam após 5 minutos. Os workers de terminal (`terminal_worker.py`) e web reportavam via rotas de API que não chamavam `recordContribution`.
- **Correção**:
  - `leaderboardService.getTopContributors()` agora mescla dinamicamente os nós registrados no `fleetState.nodes`.
  - As rotas `/api/workers/:id/heartbeat`, `/api/workers/:id/result` e `/api/range/next/:worker_id` registram contribuição ativa.
  - O minerador ativo (ex: `Teste-02` ou seu minerador web) aparece imediatamente com a badge verde pulsante **ONLINE**, velocidade real medida (ex: `3.15 MH/s`) e total de chaves doadas.
  - Nomes que continham referências obsoletas ("Colab") foram eliminados.

---

## 5. Web Mining no Navegador: Funcionamento Contínuo e Perpétuo

- O `BrowserMinerController` (`public/js/browserMiner.js`) foi blindado:
  - **Auto-Resume**: Ao fechar ou recarregar a aba, se o usuário deixou ativado, ele retoma automaticamente (`localStorage.puzzleradar_web_mining_active = 'true'`).
  - **Loop Infinito Confiável**: Ao completar cada micro-lote, requisita imediatamente o próximo da fila da pool sem interrupção.
  - **Heartbeat Ativo**: Envia pulso a cada 4 segundos ao backend para manter o status **ONLINE** no Leaderboard comunitário.
  - O minerador só para se o usuário clicar explicitamente em **⏹ Pausar Mineração**.

---

## 6. Ajuste dos Botões do Cabeçalho e Abas

- Aplicadas classes utilitárias CSS `shrink-0`, `whitespace-nowrap`, `min-w-fit` e `flex-nowrap` no `<header>` e na barra `<nav>`:
  - Nenhum botão é esmagado ou sobrepõe o botão vizinho.
  - A barra de navegação desliza com rolagem horizontal suave em telas menores, mantendo todos os retângulos preservados.
  - ✅ 12/12 capítulos de testes integrados aprovados (Puzzles 1000 BTC, Anti-MEV, Sheets Buffer, Criptografia).

| Commit Hash | Descrição do Commit |
|---|---|
| `8d71628` | `feat(sheets): calculate BigInt ordinal Chunk label and enforce 10-column buffer` |
| `00911e2` | `feat(minipool): implement parent lote manager and PoW aggregator with micro-lots` |
| `8dd94ce` | `feat(crypto): implement real secp256k1 point addition engine for CPU and browser worker` |
| `4a96484` | `feat(script): update Google Apps Script to v5.3 and refine frontend copy helpers` |
