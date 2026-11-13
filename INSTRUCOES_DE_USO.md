# Como usar este pacote no Claude Code

1. Crie uma pasta para o repositório MOVIX e copie os arquivos `.md` deste pacote para a raiz (ou uma pasta `docs/`, ajustando referências no prompt).
2. Coloque a imagem original de referência visual em `assets/movix-referencia.png` (já incluída neste pacote quando disponível).
3. Abra a pasta no VS Code com Claude Code instalado e autorizado.
4. Cole integralmente o conteúdo de `PROMPT_MESTRE.md` no Claude Code. O agente deve ler os demais arquivos, planejar e executar.
5. Quando solicitado, configure seu próprio projeto Supabase, GitHub e Vercel; não compartilhe segredos em chat ou commit. Configure as variáveis em `.env.local` e no provedor de deploy.
6. Acompanhe `PROGRESS.md` e `DECISIONS.md`; execute o projeto localmente e valide cada etapa.

**Observação:** este pacote especifica o trabalho; não é código implementado nem deploy realizado. A integração com serviços externos depende de credenciais e permissões do ambiente Claude Code.
