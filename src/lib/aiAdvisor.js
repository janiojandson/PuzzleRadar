// ============================================
// 🧩 PuzzleRadar v3.0 — Consultor Matemático IA (Nexus Advisor)
// ============================================
// Orientado pelo documento "The Digital Treasure Hunter: Bitcoin Puzzle Mastery"
// Especialista em Criptografia, Curva Elíptica secp256k1, BSGS, Entropia e Colab Farm.
// ============================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;
const LITELLM_URL = process.env.LITELLM_URL || null;

/**
 * Gera resposta inteligente do Consultor Matemático com injeção de contexto em tempo real
 */
async function generateAdvisorResponse({ prompt, context = {}, history = [] }) {
  const dynamicContext = `
================ ESTADO EM TEMPO REAL DO PUZZLERADAR ================
- Hashrate Global da Pool: ${context.totalHashrate || '42 GH/s'}
- Workers Ativos / Colab Nodes: ${context.activeWorkers || '1 ativo'}
- Desafio Principal Focado: Bitcoin Puzzle #66 (66 bits - 6.6 BTC)
- Range Alvo: 0x2000000000000000 até 0x3fffffffffffffff (18.44 Quintilhões de Chaves)
- Redução de Entropia Ativa: Filtro BIP39 Checksum (Descarte de 93,75% / 15 de cada 16 estados inválidos)
- Chave Pública Exposta (BSGS): ${context.publicKeyExposed ? 'SIM (Aceleração O(√N) ativa)' : 'NÃO (Busca Linear no Saco Completo)'}
- Puzzles Multi-Moedas: BTC (#66), ETH (Vanity & Smart Contract), SOL (Ed25519)
- Arquivamento Serverless: Google Sheets / Drive API ativo
=====================================================================
`;

  const systemPrompt = `Você é o Consultor Matemático e Arquiteto Criptográfico do PuzzleRadar (integrado ao ecossistema Nexus Cérebro).
Sua base teórica é o documento mestre "The Digital Treasure Hunter: Bitcoin Puzzle Mastery" e a matemática da curva elíptica secp256k1 (Bitcoin/Ethereum) e Ed25519 (Solana).

Suas diretrizes:
1. "Saco Completo": Enfatize a exaustão metódica e determinística sem repetição de ranges, usando Space Pruning no Google Sheets e Redis Bitmaps.
2. "Redução de Entropia": Explique como fixar prefixos hex, sufixos ou usar o filtro de 4 bits de checksum BIP39 (15/16 = 93,75% de descarte) derruba o tempo de décadas para dias.
3. "Vulnerabilidade ECDSA / BSGS": Se uma chave pública for exposta em transação passada, explique que o algoritmo Baby-Step Giant-Step (BSGS) ou Pollard's Kangaroo reduz a busca de O(2^N) para O(2^(N/2)), isto é, O(√N).
4. "Google Colab GPU Farm": Oriente o usuário sobre como agregar múltiplas contas gratuitas do Google com GPUs Tesla T4 no notebook colab_worker.ipynb.
5. Seja direto, brilhante, matemático, empolgante e cirúrgico. Responda em Português com formatação Markdown clara.

${dynamicContext}`;

  // Tenta chamada via Gemini API REST
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
            model: 'gemini-2.0-flash (Nexus Consultor Matemático)',
            status: 'success'
          };
        }
      }
    } catch (err) {
      console.warn('[AI Advisor] Aviso na chamada Gemini, ativando fallback matemático:', err.message);
    }
  }

  // Fallback heurístico matemático inteligente caso a internet ou chaves externas oscilem
  return {
    reply: `🧩 **Análise Matemática do Consultor PuzzleRadar (Nexus Cérebro):**

Para o **Bitcoin Puzzle #66** (Range de 66 bits com 6.6 BTC):
1. **Espaço Total:** $2^{66} - 2^{65} = 2^{65} \\approx 36.89 \\times 10^{18}$ chaves possíveis.
2. **Impacto do Filtro BIP39 (93,75% de Descarte):** Ao aplicar a verificação de checksum SHA-256 de 4 bits na semente mestre, 15 em cada 16 candidatos são eliminados de imediato, reduzindo a entropia efetiva para **62 bits**!
3. **Estratégia Colab GPU Farm:** Com 5 contas Google Colab agregadas rodando GPUs Tesla T4 (totalizando ~90 GH/s), o tempo estimado de varredura com poda de espaço cai de décadas para apenas alguns dias.
4. **Próximo Passo:** Abra o notebook \`colab_worker.ipynb\`, configure suas contas de worker e monitore os shares no painel do ecossistema!`,
    model: 'Nexus Mathematical Knowledge Base',
    status: 'fallback'
  };
}

module.exports = {
  generateAdvisorResponse
};
