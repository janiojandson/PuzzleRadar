// ============================================
// 🧩 PuzzleRadar v3.0 — Consultor Matemático IA (Nexus Advisor)
// ============================================
// Orientado pelo documento "The Digital Treasure Hunter: Bitcoin Puzzle Mastery"
// Especialista em Criptografia, Curva Elíptica secp256k1, BSGS, Entropia e Colab Farm.
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const NEXUS_CEREBRO_URL = process.env.NEXUS_CEREBRO_URL || 'https://nexus-cerebro-production-a7c0.up.railway.app';
const NEXUS_API_KEY = process.env.NEXUS_API_KEY || 'nexus-key';

/**
 * Gera resposta inteligente do Consultor Matemático com injeção de contexto em tempo real
 * e suporte a alternância entre Google Gemini e Nexus Cérebro.
 */
async function generateAdvisorResponse({ prompt, context = {}, history = [], provider = 'gemini' }) {
  const dynamicContext = `
================ ESTADO EM TEMPO REAL DO PUZZLERADAR ================
- Provedor de IA Selecionado: ${provider === 'nexus' ? 'Nexus Cérebro 2.0 (Rede Distribuída Mestre)' : 'Google Gemini 2.0 Flash'}
- Hashrate Global da Frota: ${context.totalHashrate || '42 GH/s'}
- Nós Ativos (Google Colab / GPUs): ${context.activeWorkers || '1 ativo'}
- Planilha Mestre Google Sheets: ID ${process.env.GOOGLE_SPREADSHEET_ID || '1-rmjfxommqVZ-MNLMozU5EevdMErWQdKIM594lltIpg'} (Sincronismo Serverless Ativo)
- Divisão de Recompensa & Regras do Pool:
  * Taxa da Casa (Autor do Projeto): 15% (Infraestrutura, Cold Vaults, Buffer de Lotes)
  * Pool de Mineradores: 85% distribuído proporcionalmente por Proof-of-Share auditado aos assinantes ativos.
  * Regra de Assinatura: Apenas usuários com assinatura ativa participam do rateio; contas inativas/anônimas revertem 100% à Casa.
- Destinos de Resgate Seguro (Cold Vaults Imutáveis):
  * Bitcoin: ${process.env.COLD_VAULT_BTC || 'bc1q4ea075c0ypxuw7w28j5cl8k7l6ga7qzsaxda56'} (Sparrow Wallet)
  * Ethereum: ${process.env.COLD_VAULT_ETH || '0xf5f3e4750c1bFa26677daD29FcdeaD6f71A742e0'} (Flashbots Protect RPC)
  * Solana: ${process.env.COLD_VAULT_SOL || 'FBx2SKLDLsdeLM8owxU8MNVPKAfJpLpmpHHRgiZDqBoi'} (Direct ed25519)
- Ranking de Desafios por Lucratividade e Viabilidade:
  1. [BTC] Bitcoin Puzzle #71 (7.10 BTC ~ $461k USD) — Alvo Ativo Oficial (1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU)
  2. [BTC] Puzzles Pós-71 (Puzzles 72 a 160 na Fila Mestre)
=====================================================================
`;

  const systemPrompt = `Você é o Consultor Matemático e Arquiteto Criptográfico do PuzzleRadar (integrado ao ecossistema Nexus Cérebro).
Sua base teórica é a análise matemática de estatística e bias dos Puzzles 1 a 70 do Bitcoin e a matemática de curvas elípticas secp256k1 (Bitcoin).

Suas diretrizes:
1. "Alvo Ativo Oficial": O alvo ativo do sistema é o Bitcoin Puzzle #71 (1PWo3JeB9jrGwfHDNpdGK54CRas7fsVzXU), prêmio de 7.10 BTC.
2. "Planilha Mestre Google Sheets": Todos os ranges escaneados e estatísticas do btcpuzzle.info são sincronizados via webhook na Planilha Google (Ranges_Varredura).
3. "Resgate Confidencial e Cold Vault": Ao encontrar qualquer chave, a transferência é feita por túnel privado (Anti-MEV) diretamente para os Cold Vaults pré-configurados.
4. "Análise Heurística de Keyspace": Explique com clareza a análise de Hamming Weight e Bias de Quartil Inferior demonstrada nos 70 puzzles já resolvidos.
5. "Execução Soberana Local": Recomende o 1-Click Web Mining no navegador ou os scripts locais de terminal (PowerShell / Bash) sem dependência de plataformas de nuvem sujeitas a banimento.
6. Responda em Português com clareza matemática rigorosa, fórmulas Markdown e orientações práticas de execução.

${dynamicContext}`;

  // Se o provedor escolhido for Nexus Cérebro
  if (provider === 'nexus' && NEXUS_CEREBRO_URL) {
    try {
      const resp = await fetch(`${NEXUS_CEREBRO_URL}/api/cerebro/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nexus-key': NEXUS_API_KEY
        },
        body: JSON.stringify({
          prompt: `${systemPrompt}\n\nConsulta Criptográfica do Pesquisador:\n${prompt}`,
          systemPrompt: 'Você é o Nexus Cérebro atuando como Consultor Criptográfico e Matemático do PuzzleRadar.'
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.resultado || data.resposta || data.reply;
        if (text) {
          return {
            reply: typeof text === 'string' ? text : JSON.stringify(text),
            model: 'Nexus Cérebro 2.0 (Rede Distribuída Mestre)',
            provider: 'nexus',
            status: 'success'
          };
        }
      }
    } catch (nexusErr) {
      console.warn('[AI Advisor] Falha na rota Nexus Cérebro, tentando Gemini como fallback:', nexusErr.message);
    }
  }

  // Tenta chamada via Google Gemini API REST
  if (GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\nPergunta do Minerador/Pesquisador:\n${prompt}` }] }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return {
            reply: text,
            model: 'Google Gemini 2.0 Flash (Consultor Criptográfico)',
            provider: 'gemini',
            status: 'success'
          };
        }
      }
    } catch (err) {
      console.warn('[AI Advisor] Aviso na chamada Gemini, ativando fallback matemático:', err.message);
    }
  }

  // Fallback heurístico matemático inteligente
  return {
    reply: `🧩 **Análise Matemática do Consultor PuzzleRadar (${provider === 'nexus' ? 'Nexus Cérebro' : 'Gemini AI'}):**

1. **Aceleração Pollard Kangaroo O(√N):** Para intervalos limitados como o Bitcoin Puzzle #71 ($2^{70} \\le k < 2^{71}$), o algoritmo dos Cangurus reduz a complexidade de $2^{70}$ para aproximadamente $2^{35}$ passos secp256k1.
2. **Distinguished Points (DPs com Máscara m=24):** Ao registrar pontos onde $X \\equiv 0 \\pmod{2^{24}}$, as GPUs dos assinantes enviam apenas pegadas compactas ao servidor central sem expor a chave privada antes da detecção da colisão $k = (b + d_{tame} - d_{wild}) \\pmod n$.
3. **Poda de Entropia BIP39 (93,75% de Descarte):** O checksum SHA-256 de 4 bits descarta 15 em cada 16 candidatos no primeiro ciclo de computação.
4. **Regras de Rateio Institucional:** 15% de taxa da casa para sustentação do ecossistema e 85% rateado proporcionalmente entre os assinantes com status de conta ativo!`,
    model: `${provider === 'nexus' ? 'Nexus Cérebro Base' : 'Gemini Core'} (Heurística Criptográfica)`,
    provider,
    status: 'fallback'
  };
}

module.exports = {
  generateAdvisorResponse
};
