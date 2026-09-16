# 🧩 PUZZLERADAR v3.0 — MANUAL ARQUITETURAL, TÉCNICO E ESTRATÉGICO
> **Documento Mestre para Ingestão e Grounding no Google NotebookLM**  
> *Versão:* 3.0.0 | *Data de Emissão:* Setembro/2026 | *Classificação:* Confidencial / Ecossistema Nexus

---

## 1. 🎯 VISÃO GERAL, PROVOCAÇÃO E MODELO DE NEGÓCIO

### 1.1. O que é o PuzzleRadar?
O **PuzzleRadar** é uma plataforma SaaS e infraestrutura computacional distribuída para localização, mapeamento e resolução colaborativa de **desafios criptográficos e quebra de chaves privadas** em curvas elípticas (Bitcoin Puzzle Transactions, Ethereum, Solana e CTFs Web3).

### 1.2. A Dor Real de Mercado
* **Bitcoin Puzzles Históricos:** Desde 2015, existem carteiras Bitcoin criadas com recompensas milionárias que aumentam de complexidade bit a bit (ex: Puzzle #66 com recompensa de 6.6 BTC, Puzzle #71 com 7.1 BTC, etc.).
* **Ineficiência Individual:** Um minerador/pesquisador isolado não possui hashrate suficiente para cobrir os espaços de busca $2^{66}$ ou $2^{70}$ em tempo hábil.
* **Falta de Coordenação:** Sem coordenação matemática, múltiplos agentes testam os mesmos ranges de chaves repetidamente, desperdiçando eletricidade e computação.

### 1.3. A Proposta de Valor do PuzzleRadar
1. **Pool Colaborativo Distribuído (Kangaroo / Pollard's Rho):** Divide os espaços de busca em sub-ranges de chaves e pontos distintos (*Distinguished Points - DPs*).
2. **Redução Matemática de Entropia (Pruning):** Algoritmos proprietários que descartam padrões improváveis na curva `secp256k1`.
3. **Divisão Justa de Recompensas (Prize Splitter):** Cálculo transparente da recompensa proporcional aos *Distinguished Points* válidos submetidos por cada membro da frota.
4. **Agente Especialista (CryptoAnalyst):** IA que ingere novos desafios criptográficos, calcula a entropia, tempo estimado de quebra e viabilidade econômica.

### 1.4. Modelos de Monetização
* **Taxa de Sucesso do Pool (Fee de 5% a 10%):** Retenção automática sobre qualquer recompensa on-chain recuperada pelo pool.
* **SaaS Tier B2B (API de Análise Criptográfica):** Assinatura para entusiastas, auditorias de segurança e equipes de computação de alta performance.
* **Freemium Educacional (Learning Lab):** Acesso a puzzles históricos resolvidos para benchmarking de hardware.

---

## 2. 🏛️ ARQUITETURA DE SISTEMA E TOPOLOGIA

O PuzzleRadar opera em duas frentes: **SaaS Web Independente** e **Membro Integrado ao Nexus Cérebro**.

```text
┌─────────────────────────────────────────────────────────────┐
│                    NEXUS CÉREBRO (Porta 3000)               │
│               Command Center & Orquestrador Geral           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / OpenAI Tool Calling
                               │ (Heartbeat a cada 15s)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               PUZZLERADAR ENGINE (Porta 3010)               │
│  ├─ /nexus/ferramentas  (Exposição de Tools)                │
│  ├─ /nexus/executar     (Execução de Análise/Pool)          │
│  └─ /nexus/status       (Telemetria e Saúde)                │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│  ┌────────────────────────┐  │  ┌────────────────────────┐  │
│  │   CryptoAnalyst Agent  │  │  │   OnChain Watcher      │  │
│  │   (IA Matemática)      │  │  │   (Monitor Mempool)    │  │
│  └────────────────────────┘  │  └────────────────────────┘  │
│                              │                              │
│  ┌────────────────────────┐  │  ┌────────────────────────┐  │
│  │  Pruning & Redis DPs   │  │  │  Solver Engine         │  │
│  │  (Kangaroo Colisão)    │  │  │  (KeyHunt CPU/GPU)     │  │
│  └────────────────────────┘  │  └────────────────────────┘  │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 3. 🛠️ ARSENAL DE FERRAMENTAS EXPOSTAS AO CÉREBRO (MEMBER TOOLS)

O PuzzleRadar atua como um "braço armado" do Cérebro Nexus através de chamadas de função compatíveis com o padrão OpenAI Tool Calling:

### 1. `consultar_status_puzzleradar`
* **Objetivo:** Retorna o estado operacional do motor de busca, estatísticas de pruning em memória, integridade do storage e status dos monitores de blockchain.
* **Payload de Resposta:** Status da porta 3010, versão, saúde do Redis e estatísticas de blocos.

### 2. `avaliar_desafio_criptografico`
* **Objetivo:** Recebe o texto de um novo desafio (chave pública, endereço Bitcoin, range em bits ou riddle) e o hashrate disponível.
* **Processamento:** O `CryptoAnalystAgent` avalia a entropia, classifica a dificuldade (FÁCIL, MÉDIO, DIFÍCIL, EXTREMO), estima o tempo de colisão e gera o plano de ataque ótimo.

### 3. `consultar_pool_chaves`
* **Objetivo:** Retorna as métricas de *Distinguished Points* acumulados no puzzle ativo (ex: `puzzle_btc_66` ou `puzzle_btc_71`), percentual de cobertura do espaço de busca e probabilidade estatística de colisão iminente.

---

## 4. 🧮 MATEMÁTICA E CLASSIFICAÇÃO DE DIFICULDADE

### 4.1. Equação de Viabilidade do Puzzle
$$\text{Score} = \log_2(\text{range}) \times 10 + (\text{Recompensa}_{\text{BTC}} \times 1000) - (\text{TempoEstimado}_{\text{horas}} \times 5)$$

### 4.2. Tabela de Complexidade e Estratégia de Ataque

| Classificação | Faixa de Bits | Espaço de Busca | Viabilidade / Hardware |
|---|---|---|---|
| 🟢 **FÁCIL** | 1 a 40 bits | Até $10^{12}$ chaves | CPU local resolve em minutos |
| 🟡 **MÉDIO** | 41 a 55 bits | Até $3.6 \times 10^{16}$ chaves | GPU (RTX / KeyHunt CUDA) em horas/dias |
| 🔴 **DIFÍCIL** | 56 a 70 bits | Até $1.1 \times 10^{21}$ chaves | Pool colaborativo obrigatório (Algoritmo Kangaroo) |
| ⚫ **EXTREMO** | 71+ bits | $> 10^{22}$ chaves | Exige redução matemática de subespaço ou falha de PRNG |

---

## 5. 📂 ESTRUTURA DE DIRETÓRIOS E COMPONENTES

```text
PuzzleRadar/
├── src/
│   ├── server/
│   │   ├── index.js                  # Ponto de entrada Express (Porta 3010)
│   │   └── routes/
│   │       ├── nexus.js              # Integração bidirecional e tools do Cérebro
│   │       ├── puzzles.js            # Endpoints CRUD de desafios e rankings
│   │       └── pool.js               # Distribuição de ranges e submissão de DPs
│   ├── services/
│   │   ├── cryptoAnalystAgent.js     # Engine de inteligência matemática e parsing
│   │   └── onChainWatcher.js         # Monitor de transações e saldo das carteiras
│   ├── lib/
│   │   ├── redis.js                  # Gerenciador de cache, filas e DPs Kangaroo
│   │   └── googleSheets.js           # Ponte de sincronização com planilhas de log
│   └── workers/
│       └── rangeWorker.js            # Worker BullMQ para processamento em segundo plano
├── solver/
│   └── keyhunt_wrapper.js            # Interface de execução dos binários KeyHunt Cuda
├── prisma/
│   └── schema.prisma                 # Modelagem relacional (Usuários, Puzzles, Pools)
├── .env.example                      # Template de variáveis de ambiente
└── package.json                      # Dependências do ecossistema
```

---

## 6. 🔐 SEGURANÇA E PROTOCOLO ZERO-KNOWLEDGE

1. **Isolamento de Chaves Privadas:**
   * Nenhuma chave privada gerada durante a varredura trafega pela rede.
   * Os workers locais efetuam a multiplicação de curva elíptica $k \cdot G$ localmente.
2. **Tráfego Seguro de DPs:**
   * Apenas os *Distinguished Points* (pontos públicos que terminam com $N$ zeros) e o hash comprovando o range verificado são enviados ao servidor.
3. **Validação Multi-Tenant:**
   * Todas as rotas de API validam o `tenant_id` e permissões de cargo (*admin, manager, member, viewer*).

---

## 7. 🚀 GUIA DE OPERAÇÃO E COMANDOS

### 7.1. Execução Local
* **Iniciar o serviço:** `npm run dev` ou pelo launcher geral `start-local.bat`
* **Porta Padrão:** `3010`
* **Verificação de Saúde:** `GET http://localhost:3010/nexus/status`
* **Lista de Ferramentas:** `GET http://localhost:3010/nexus/ferramentas`

### 7.2. Interação via Telegram / Nexus Cérebro
Quando o Nexus Cérebro estiver rodando, você pode disparar ordens em linguagem natural pelo Telegram:
* `!agir Analisar viabilidade criptográfica do Bitcoin Puzzle 66`
* `!agir Consultar o status da pool de chaves no PuzzleRadar`
* O Cérebro invocará o Membro PuzzleRadar automaticamente via Tool Calling e devolverá a resposta estruturada no chat privado do Sócio.

---

## 8. 🎯 PERGUNTAS ESTRATÉGICAS SUGERIDAS PARA O NOTEBOOKLM

Ao carregar este manual no Google NotebookLM, experimente fazer as seguintes perguntas:
1. *"Qual é a lógica matemática que o PuzzleRadar usa para dividir o prêmio entre os participantes de um pool?"*
2. *"Como o PuzzleRadar se comunica com o Nexus Cérebro e quais ferramentas ele fornece?"*
3. *"Quais são os limites de hardware para resolver puzzles de 40, 60 e 70 bits?"*
4. *"Gere um roteiro de podcast (Audio Overview) explicando como o PuzzleRadar pode ser monetizado como SaaS B2B."*
