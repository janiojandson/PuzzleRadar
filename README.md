# 🧩 PuzzleRadar — SaaS Colaborativo de Desafios Criptográficos

> **Resolva puzzles. Ganhe cripto. Juntos.**

PuzzleRadar é uma plataforma SaaS que permite a colaboração distribuída para resolver desafios criptográficos (Bitcoin Puzzle, Ethereum, Solana e mais) com pontuação matemática de dificuldade, pools colaborativos e divisão justa de prêmios.

## 🎯 Missão
Democratizar o acesso a desafios criptográficos com poder computacional colaborativo, sem necessidade de investimento inicial.

## ✨ Funcionalidades Principais

| Módulo | Descrição |
|---|---|
| 🎯 **Puzzle Dashboard** | Lista desafios ativos com pontuação de dificuldade (Fácil → Extremo) |
| 🏊 **Pool Manager** | Cria e gerencia pools colaborativos com divisão de ranges |
| 📊 **Range Distributor** | Distribui ranges de busca entre membros do pool |
| 📈 **Progress Tracker** | Acompanha ranges verificados em tempo real |
| 💰 **Prize Splitter** | Calcula divisão de prêmios proporcional à contribuição |
| 🎓 **Learning Lab** | Desafios já resolvidos para praticar e aprender |
| 🔗 **Multi-Chain** | Suporte a BTC, ETH, SOL e outras redes |

## 🧮 Sistema de Pontuação

```
Score = log2(range) × 10 + (prize_BTC × 1000) - (estimated_time_hours × 5)
```

| Classificação | Bits | Viabilidade |
|---|---|---|
| 🟢 FÁCIL | 1-40 | CPU resolve em minutos/horas |
| 🟡 MÉDIO | 41-55 | GPU resolve em horas/dias |
| 🔴 DIFÍCIL | 56-70 | Pool colaborativo necessário |
| ⚫ EXTREMO | 71+ | Breakthrough matemático necessário |

## 🏗️ Stack Técnica

- **Frontend**: Next.js 14 + TailwindCSS + Shadcn/UI
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL (Multi-tenant nativo)
- **Queue**: BullMQ + Redis (distribuição de ranges)
- **Solver Engine**: KeyHunt-Cuda (GPU) / keyhunt (CPU)
- **Auth**: JWT + RBAC (admin, manager, member, viewer)
- **Deploy**: Railway

## 🔐 Segurança

- Chaves privadas NUNCA trafegam pela rede
- Cada worker gera e verifica localmente
- Apenas confirmação "range verificado" ou "ENCONTRADO" vai ao servidor
- JWT com `tenant_id` validado em cada request

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env

# Rodar migrações
npx prisma migrate dev

# Iniciar desenvolvimento
npm run dev
```

## 📁 Estrutura do Projeto

```
PuzzleRadar/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React Components (Shadcn)
│   ├── lib/              # Utilitários e helpers
│   ├── server/           # Backend API (Express)
│   ├── workers/          # BullMQ Workers
│   └── prisma/           # Schema & Migrações
├── solver/               # Solver engines (KeyHunt wrappers)
├── public/               # Assets estáticos
└── docker-compose.yml    # PostgreSQL + Redis local
```

## 📜 Licença

MIT — Livre para usar, modificar e contribuir.