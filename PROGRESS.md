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

## Supabase real (13/11/2026)
- Migrations 0001–0005 aplicadas pelo SQL Editor; `npm run seed` OK (2 locadoras demo, 10 veículos, 15 locações).
- `E2E_SUPABASE=1` → jornadas autenticadas: **13 passando**, 1 pulado (só mobile), **2 falhando** ("convidado pendente", desktop e mobile)
  até aplicar a migration `0006_fix_org_select.sql` no projeto.
- Bug real encontrado pelo E2E e corrigido: policy `organizations_select` com `id` ambíguo (resolvia para
  `organization_memberships.id`); locatário pendente não via o nome da locadora. Teste de regressão em `tests/db/security.test.ts`.
- Ajustes de teste: 404 em streaming retorna HTTP 200 (verifica a tela "Página não encontrada" e ausência de dados);
  seletores por papel (o route announcer do Next duplica títulos); sidebar oculta no mobile; 1 worker com banco real.

## Implementado, ainda sem validação automatizada
Uploads de storage, e-mails de verificação, assistente com IA (sem `ANTHROPIC_API_KEY`, usa o roteiro).

## Bloqueios (dependem do usuário)
1. Executar `supabase/migrations/20261113000006_fix_org_select.sql` no SQL Editor.
2. Auth → Redirect URLs (`http://localhost:3000/auth/callback`).
3. `git push -u origin main` com autenticação do GitHub; projeto Vercel.
4. Opcional: `ANTHROPIC_API_KEY`.

## Próximos passos
1. Após a 0006: rodar de novo `E2E_SUPABASE=1 npx playwright test tests/e2e/authenticated.spec.ts`.
2. Gravar capturas/vídeo para o plano B da banca.
3. Publicar no GitHub e Vercel.
