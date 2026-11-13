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
- Migrations 0001–0006 aplicadas pelo SQL Editor; `npm run seed` OK (2 locadoras demo, 10 veículos, 15 locações).
- `E2E_SUPABASE=1` → jornadas autenticadas: **15/15 passando** (1 pulado por ser só mobile): dashboard/frota/financeiro/
  relatórios, isolamento entre locadoras, locatário com duas locadoras + aceite + pagamento simulado, chassi restrito,
  pendente com acesso restrito, concorrência real de reservas, admin/negações/`/demo`, navegação mobile.
- E2E públicos seguem **36/36**.
- Bug real encontrado pelo E2E e corrigido: policy `organizations_select` com `id` ambíguo (resolvia para
  `organization_memberships.id`); locatário pendente não via o nome da locadora. Teste de regressão em `tests/db/security.test.ts`.
- Ajustes de teste: 404 em streaming retorna HTTP 200 (verifica a tela "Página não encontrada" e ausência de dados);
  seletores por papel (o route announcer do Next duplica títulos); sidebar oculta no mobile; 1 worker com banco real.

## Produção (Vercel) — 13/11/2026
- GitHub: https://github.com/teuprates/MOVIX (branch `main`). Deploy: https://movix-three-inky.vercel.app
- A Vercel usa `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`SITE_URL` sem prefixo; `next.config.ts` mapeia apenas esses
  valores públicos para `NEXT_PUBLIC_*` (a chave secreta nunca é mapeada; o app não a usa).
- `E2E_SUPABASE=1 E2E_BASE_URL=https://movix-three-inky.vercel.app npx playwright test` → **51/51 passando**
  (36 públicos + 15 autenticados; 1 pulado por ser só mobile). Seed reaplicado depois.

## Advisors do Supabase — 13/11/2026
- Migration `0007_hardening.sql` aplicada via MCP: `search_path` fixo em 4 funções, `(select auth.uid())` em 12 policies,
  índices em 35 chaves estrangeiras. Advisor de desempenho limpo (resta só "índice ainda não usado", esperado).
  Vitest 50/50 e E2E em produção 51/51 depois da mudança.
- Avisos de segurança restantes são **intencionais**: RPCs `SECURITY DEFINER` executáveis por `authenticated` (D-009: cada uma
  checa permissão internamente; helpers são usados pelas policies) e `get_invitation_preview` pública para `anon`
  (pré-visualização mínima do convite).
- "Leaked password protection" do Auth está desligado (configuração do painel; disponível no plano Pro).

## Redesign dos painéis (13/11/2026)
- Diretrizes do Impeccable lidas do repositório oficial (SKILL, modo Operate, craft floor, layout, tipografia, cor, movimento);
  o plugin em si depende de `/plugin marketplace add pbakaus/impeccable` no Claude Code (ver resposta da sessão).
- Novos componentes: trilho agrupado, busca Ctrl K, menu "Novo", `FleetPulse`, `VehicleArt`, `RentalHero`, `DataTable`,
  `MetricStrip`/`Metric`, skeleton do locatário. Painel do proprietário e app do locatário reescritos; contratos com busca e
  ordenação; financeiro/multas com faixa de indicadores; frota com ilustração quando não há foto.
- Verificação: lint/typecheck OK, Vitest 50/50, build OK, Playwright **51/51** (36 públicos + 15 autenticados, Supabase real),
  `scripts/verificar-responsivo.mjs` sem rolagem horizontal em 13 páginas × 320/390/768/1024/1280px, Ctrl K/Esc/Tab com foco
  visível. Capturas antes/depois em `docs/capturas/antes` e `docs/capturas/depois` (`scripts/capturas.mjs`).

## Implementado, ainda sem validação automatizada
Uploads de storage, e-mails de verificação, assistente com IA (sem `ANTHROPIC_API_KEY`, usa o roteiro).

## Pendências (dependem do usuário)
1. Aprovar o acesso do conector Vercel ao time (link gerado na sessão) para conferir logs e variáveis.
2. Opcional: `ANTHROPIC_API_KEY`.

## Próximos passos
1. Validar manualmente uploads de fotos/documentos e e-mail de verificação.
2. Gravar vídeo para o plano B da banca (capturas já em docs/capturas/depois).
