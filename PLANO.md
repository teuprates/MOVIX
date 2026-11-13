# Plano inicial de implementação

**Regra:** Claude Code deve revisar este plano após inspecionar o repositório e executar automaticamente, sem parar no planejamento. Cada fase termina com testes e registro de evidências.

1. **Discovery e fundação:** inventário de arquivos, decisões, dependências, `.env.example`, lint/typecheck/build, design tokens, layout, documentação inicial.
2. **Banco, auth e RLS:** migrations, políticas, buckets, cadastro proprietário, convite, cadastro locatário, aprovação, múltiplos vínculos, admin.
3. **Frota e disponibilidade:** veículos, fotos, campos restritos, calendário, bloqueio concorrente, CRUD e testes de isolamento.
4. **Contratos e pagamentos simulados:** geração/aceite/versionamento/PDF, locações, parcelas, Pix/cartão fake, notificações.
5. **Operação:** inspeções, aprovações, manutenção, Health Score, ocorrências, multas, finanças, relatórios PDF/XLSX.
6. **Simulações e IA:** mapa/rotas/geofence fictícios, insights determinísticos, chatbot fallback, compartilhamento WhatsApp.
7. **Experiência premium:** landing cinematográfica, demo pública isolada, dashboards refinados, modo apresentação protegido, tema e PWA.
8. **Qualidade e entrega:** seed idempotente, E2E multi-role e testes negativos, responsividade, acessibilidade, performance, revisão de segurança, documentação TCC, GitHub/Vercel autorizados.

**Implementação equilibrada:** não deixar UI para o fim; refinar experiência em cada fase. Reordenar fases conforme dependências, documentando por quê. Se bloqueado por credenciais, avançar no que for possível e registrar instruções claras.
