# Roteiro de demonstração para a banca (~27 min)

> O mesmo roteiro está navegável em `/demo` (setas ← →, cronômetro e atalhos). Só apresente como testado o que estiver marcado ✅ em `docs/planejamento/PROGRESS.md`.

| # | Tempo | Etapa | Ação na tela | Fala sugerida |
|---|---|---|---|---|
| 1 | 2 min | Problema | Slide/fala | "Pequenas frotas vivem de planilhas e WhatsApp: reservas conflitantes, contratos sem prova e manutenção esquecida." |
| 2 | 2 min | Solução | `/` (topo) | "O MOVIX conecta proprietário, veículo e locatário num SaaS multi-tenant com isolamento no banco." |
| 3 | 2 min | Landing e demo pública | rolar a landing; `/demonstracao` → simular pagamento, mapa, assistente | "A demo pública não acessa o banco: tudo é fictício e rotulado." |
| 4 | 3 min | Cadastro, convite, aprovação | `/painel/locatarios` (convite + WhatsApp), aba anônima em `/convite/...`, aprovar | "O locatário só entra por convite; a locadora analisa documentos privados e aprova." |
| 5 | 4 min | Frota, calendário, contrato, PDF | frota → calendário → novo contrato (resumo antes de emitir) → PDF | "O banco impede reservas sobrepostas mesmo em requisições simultâneas. O aceite registra hash e versão — não é assinatura certificada." |
| 6 | 3 min | Pagamento simulado | entrar como locatário → Parcelas → Pagar (Pix/cartão) → voltar ao financeiro | "Nenhum dado de cartão existe na tela; a confirmação altera parcela, indicadores e notificações." |
| 7 | 3 min | Vistoria e manutenção | vistoria com fotos → aprovar/solicitar correção → manutenção e Health Score | "O Health Score é uma estimativa por regras visíveis, não diagnóstico." |
| 8 | 3 min | Mapa, insights, notificações | `/painel/rastreamento` iniciar/pausar; dashboard; notificações | "Rastreamento claramente demonstrativo, sem GPS físico. Insights são regras determinísticas." |
| 9 | 1 min | Modo apresentação | botão na demo → `/demo` | "Protegido por login; atalhos só afetam locadoras demo." |
| 10 | 4 min | Arquitetura e testes | `docs/arquitetura.md`, `docs/seguranca.md`, saída de `npm test` | "50 testes de domínio e de RLS rodam no Postgres real (PGlite) e a suíte E2E cobre jornadas e negações." |

## Checklist pré-banca
- [ ] `npm run seed` executado no dia (datas relativas a hoje) ou "Restaurar dados" no `/demo`.
- [ ] Logins testados: `dono@movix.demo`, `locatario@movix.demo`, `admin@movix.demo` (senha do `.env.local`).
- [ ] Duas janelas: normal (proprietário) e anônima (locatário).
- [ ] `npm run build && npm start` local como contingência ao deploy.
- [ ] Testes rodados no dia e saída salva.

## Plano B (sem internet)
- Rodar local (`npm start`): landing e demo pública funcionam sem rede (exceto tiles do mapa e fontes, que caem para fundo neutro e fonte do sistema).
- Áreas autenticadas exigem o Supabase na nuvem: se a rede falhar, conduzir pela demo pública e pelos testes automatizados (`npm test` roda offline).
- Capturas: `docs/capturas/depois` (desktop e celular, claro e escuro; gere de novo com `scripts/capturas.mjs`). Vídeo: ainda não gravado.
