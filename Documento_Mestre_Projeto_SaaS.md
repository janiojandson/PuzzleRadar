# 🧠 DOCUMENTO MESTRE DO PROJETO - ARQUITETURA SAAS & PRODUTO DIGITAL

Este documento serve como o **Blueprint Padrão** para a criação de novos projetos e refatoração de sistemas em andamento ou já concluídos (como automações via WhatsApp, plataformas de vendas corporativas e sistemas de gestão). Ele deve ser lido por qualquer Analista de IA Sênior ou Desenvolvedor antes da escrita da primeira linha de código, garantindo que todo software nasça preparado para escalar, monetizar e, se necessário, ser licenciado ou vendido.

---

## 1. 🎯 VISÃO DO PRODUTO E NEGÓCIO
Nenhum projeto começa pelo código. A definição estratégica dita a arquitetura.

### 1.1. Definição Base
- **Nome do Projeto:** [Definir]
- **Problema que resolve:** [Definir a dor real]
- **Público-alvo & Persona:** [Quem usa, quem paga]
- **Proposta de Valor & Diferencial:** [Por que usar este e não outro?]
- **Forma de Utilização:** ( ) Web ( ) Mobile ( ) API/SaaS ( ) Automação/Bot

### 1.2. Estratégia de Monetização e Evolução
O sistema deve nascer prevendo transições de modelo de negócio:
1. **MVP Interno / Uso Próprio** → 2. **Validação** → 3. **Produto B2B/B2C** → 4. **SaaS Multi-tenant** → 5. **Licenciamento (White Label) / Venda**.

**Modelos de Cobrança Suportados pela Arquitetura:**
- Freemium (Limitação por features)
- Assinatura Mensal/Anual (Tiers: Basic, Pro, Enterprise)
- Pay-per-use (Cobrança por consumo: ex. disparos de mensagens, chamadas de IA, emissões de certificados)

---

## 2. 🏗️ ARQUITETURA DE ENGENHARIA (API-FIRST)
A separação lógica é inegociável. Frontend, Backend, Banco de Dados e Serviços Externos não devem se misturar. 

### 2.1. Topologia Padrão
```text
┌──────────────────────────────┐
│       FRONTEND / CLIENTS     │
│ Web / PWA / Painel Admin     │
└──────────────┬───────────────┘
               │ (REST / GraphQL / WebSockets)
               ▼
┌──────────────────────────────┐
│          CORE API            │ (Node.js / Express / NestJS)
│ Autenticação / Regras / ACL  │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│  DATABASE   │  │   STORAGE   │ (PostgreSQL / Redis)
└─────────────┘  └─────────────┘
       │
       ▼
┌──────────────────────────────┐
│  WORKERS & SERVIÇOS EXTERNOS │
│ (WhatsApp/Baileys, LLMs,     │
│ Emails, Gateways de Pagamento)│
└──────────────────────────────┘
```

### 2.2. Modularidade (Domain-Driven)
Evitar monólitos desorganizados. A estrutura deve ser dividida por domínio no backend:
`/auth`, `/users`, `/organizations` (Tenants), `/billing` (Assinaturas), `/webhooks` (Eventos externos), `/ai` (Modelos e Prompts), `/integrations` (WhatsApp, APIs de governo, etc).

---

## 3. 👤 SISTEMA DE USUÁRIOS E MULTI-TENANCY
Todo projeto com potencial de SaaS deve suportar múltiplos locatários (empresas/organizações) desde o dia 1.

### 3.1. Estrutura de Entidades
- **Tenant (Organização/Empresa):** A entidade pagante ou contêiner principal. Cada organização enxerga apenas os seus dados.
- **User:** O indivíduo. Um usuário pode pertencer a múltiplas organizações (ex: consultor financeiro acessando contas de clientes diferentes).
- **Role & Permissions (RBAC):** `admin`, `manager`, `user`, `viewer`. Autorização baseada em cargos.
- **Plan & Subscription:** O nível de acesso amarrado à organização. 

### 3.2. Controle de Features e Consumo
A liberação de recursos não deve ser feita por `if (user.email === X)`. 
O banco deve gerenciar uma entidade `PLAN`:
- `feature_whatsapp_automation`: true/false
- `limit_monthly_ai_tokens`: 50000
- `limit_active_users`: 5

---

## 4. 🗄️ MODELAGEM DO BANCO DE DADOS
Planejar o schema com o mindset de 100.000 usuários. Preferência por bancos relacionais (PostgreSQL) com suporte a JSONB para configurações flexíveis.

**Tabelas Core Iniciais:**
- `users` (dados de autenticação)
- `organizations` (multi-tenancy)
- `members` (relacionamento users <-> organizations com roles)
- `plans` & `subscriptions` (financeiro)
- `usage_logs` (registro de consumo para billing)
- `audit_logs` (quem fez, o que, quando e onde - crucial para sistemas financeiros e empresariais)

**Controle de Estado:** Utilizar máquinas de estado (Status: `pending`, `processing`, `completed`, `failed`, `canceled`) para fluxos de documentos, aprovações e pagamentos, com transições mapeadas no banco.

---

## 5. 🤖 MÓDULO DE INTELIGÊNCIA ARTIFICIAL E AUTOMAÇÃO
A IA não deve estar acoplada às regras de negócio gerais. Ela é um módulo independente.

- **Agnosticismo de Provedor:** A arquitetura deve permitir trocar OpenAI, Gemini, Claude ou modelos locais (via Open WebUI/Docker) mudando apenas variáveis de ambiente.
- **Camadas do AI Service:**
  - `Provider` (Adaptador da API externa)
  - `Context & Memory` (Histórico da sessão injetado no RAG)
  - `Prompts` (Versionamento de instruções do sistema)
  - `Usage & Cost` (Medição de tokens por Tenant para repasse de custo).

---

## 6. 🔐 SEGURANÇA E LGPD (PRIVACY BY DESIGN)
A segurança é a camada 0 do projeto.

- **Autenticação:** Senhas com hash forte (Bcrypt/Argon2), sessões com JWT de curta duração + Refresh Tokens ou sessões server-side (Redis).
- **Autorização:** Validar permissão + pertencimento ao Tenant em CADA endpoint protegido.
- **Proteções Essenciais:** Rate limiting, CORS restrito, sanitização de inputs (prevenção a XSS e SQL Injection).
- **Secrets:** NUNCA hardcoded. Uso estrito de variáveis de ambiente gerenciadas pela plataforma de deploy (ex: Railway, Vercel).
- **LGPD:** Tabelas devem ter controle claro de exclusão lógica (`deleted_at`), logs de acesso a dados sensíveis e facilidade de exportação de dados do cliente.

---

## 7. 🎨 UX/UI E DESIGN SYSTEM
O front-end deve consumir um Design System padronizado para acelerar desenvolvimento e manter coerência.
- **Mobile-first** para ferramentas de uso em campo/vendas. Desktop avançado (Dashboards, tabelas densas) para painéis operacionais.
- **Componentização:** `Button`, `Modal`, `Table`, `Badge`, `Sidebar` reutilizáveis.
- **Onboarding:** Foco no "Aha Moment". O usuário deve perceber o valor na primeira sessão.

---

## 8. 🚀 OPERAÇÃO, PERFORMANCE E CI/CD
A transição de "script" para "produto" exige operação profissional.

- **Processamento Assíncrono:** Tarefas demoradas (geração de PDFs, processamento de planilhas complexas, disparos em massa via WhatsApp) devem rodar em Workers (Filas/Jobs) e não bloquear o request do usuário.
- **Observabilidade:** Logs centralizados com níveis (INFO, WARN, ERROR, FATAL) e métricas de uso da API.
- **CI/CD:** Código no GitHub -> Pull Request -> Testes -> Deploy automático (Staging/Produção). Ninguém edita código diretamente no servidor.
- **Backup e DR (Disaster Recovery):** Rotinas automatizadas de dump do banco com retenção definida. Testes periódicos de restauração.

---

## 9. 🏆 CHECKLIST SÊNIOR DE VALIDAÇÃO (GO-LIVE)
Antes de declarar o sistema pronto para produção, o Analista IA / Desenvolvedor deve validar:

| Pilar | Pergunta | Status |
| :--- | :--- | :---: |
| 🎯 **Produto** | Resolve o problema real mapeado na visão? | [ ] |
| 🏢 **Multi-tenant** | Dados de empresas diferentes estão perfeitamente isolados? | [ ] |
| 🔐 **Segurança** | Rotas protegidas? Secrets isolados? Anti-brute force ativo? | [ ] |
| 💳 **Monetização** | As travas de plano (features/uso) estão funcionando? | [ ] |
| 🧩 **Modularidade** | É fácil adicionar um módulo novo sem refatorar o core? | [ ] |
| 🔌 **API** | O front-end consome a API da mesma forma que um terceiro consumiria? | [ ] |
| 🤖 **IA** | Podemos trocar o LLM amanhã sem reescrever o sistema inteiro? | [ ] |
| 🚀 **Deploy** | O pipeline CI/CD está funcional e o banco de dados tem backup? | [ ] |
| 🛠️ **Admin** | Existe um painel administrativo para não depender de inserts no banco? | [ ] |

---

## 10. 🔥 MODELO OPERACIONAL DE EXECUÇÃO (O CICLO)
Para qualquer nova feature ou projeto adaptado a partir deste Blueprint, a execução seguirá estritamente a ordem:

1. **Visão** -> 2. **Problema** -> 3. **Público** -> 4. **Modelo de Negócio** -> 5. **Requisitos** -> 6. **Arquitetura** -> 7. **Banco de Dados** -> 8. **Segurança** -> 9. **UX/UI** -> 10. **Responsividade** -> 11. **API** -> 12. **Autenticação** -> 13. **Planos / Acessos** -> 14. **MVP** -> 15. **Testes** -> 16. **Deploy** -> 17. **Monitoramento** -> 18. **Analytics** -> 19. **Monetização** -> 20. **Escala** -> 21. **White Label / Licenciamento**.

> **Regra de Ouro:** Não construímos "sites" ou "scripts soltos". Construímos produtos digitais com arquitetura corporativa, capazes de começar pequenos e escalar sem precisar de reconstrução do zero.
