# PROTOCOLO DE DESENVOLVIMENTO SEGURO (ANTIGRAVITY IDE)

1. ESCOPO CIRÚRGICO: É proibido reescrever arquivos funcionais inteiros com mais de 40 linhas. Entregue apenas o diff ou a função modificada.
2. PRESERVAÇÃO DE CONTRATOS: Não renomeie rotas de API, schemas de banco ou tipos exportados sem criar camada de compatibilidade.
3. FLUXO EM 2 ETAPAS: Sempre apresente causa raiz e lista de arquivos afetados antes de aplicar código.
4. DEPENDÊNCIAS: Não adicione nem remova pacotes do package.json ou Dockerfile sem permissão explícita.
