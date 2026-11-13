# Progresso MOVIX

Atualizado em: 13/11/2026

## Concluído e testado (evidência)
| Área | Evidência |
|---|---|
| Migrations (schema, segurança, RPCs, storage, demo) aplicam sem erro | `npm test` → `tests/db/*` (PGlite) |
| RLS e regras de negócio: isolamento entre locadoras, convite/aprovação, múltiplos vínculos, dados restritos e revogação, sobreposição, contrato imutável/aditivo, pagamento simulado, vistoria, storage, notificações, admin, suspensão, auditoria, alertas, seed demo | **33 testes de banco passando** |
| Domínio: preço/parcelas, Health Score, insights, rastreamento, validações BR, erros, PDF | **17 testes unitários passando** (total Vitest: 50/50) |
| Lint (ESLint) e typecheck (tsc estrito) | sem erros |
| Build de produção (Next 16) | `npm run build` OK; rotas autenticadas dinâmicas |
| E2E públicos: landing, demo pública sem banco, pagamento local, mapa rotulado, assistente, rotas/APIs protegidas, validação de formulários, tema, skip link, reduced motion, 320px sem overflow, PWA | **36/36 Playwright** (desktop + Pixel 7) |
| Inspeção visual | capturas de landing, narrativa, demo, login e mobile revisadas |

## Implementado, aguardando validação com Supabase real
Todas as telas e fluxos autenticados (proprietário, locatário, admin, `/demo`), uploads de storage, e-mails de verificação, PDF/XLSX com dados reais, assistente com IA. Suíte `tests/e2e/authenticated.spec.ts` (8 jornadas, incluindo concorrência real de reservas) pronta e **pulada** por falta de credenciais.

## Bloqueios (dependem do usuário)
1. Projeto Supabase + `.env.local` (URL, chave pública, service role, DB URL, `SEED_USER_PASSWORD`).
2. Auth → Redirect URLs.
3. Repositório GitHub público e projeto Vercel.
4. Opcional: `ANTHROPIC_API_KEY`.

## Próximos passos
1. Com credenciais: `npm run db:push` → `npm run seed` → `E2E_SUPABASE=1 npm run test:e2e`; corrigir o que aparecer.
2. Gravar capturas/vídeo para o plano B da banca.
3. Publicar no GitHub e Vercel.
