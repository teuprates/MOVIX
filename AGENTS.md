# MOVIX — instruções para agentes

SaaS multi-tenant de gestão de pequenas frotas de locação. Especificação oficial em `docs/especificacao/` (`PROMPT_MESTRE.md`, `REQUISITOS.md`,
`ARQUITETURA.md`, `DESIGN.md`, `PLANO.md`, `CRITERIOS_ACEITACAO.md`, `TCC.md`). Planejamento vivo em `docs/planejamento/`
(`PLAN.md`, `PROGRESS.md`, `DECISIONS.md`).

## Regras do projeto
- Toda a interface em **português brasileiro**; moeda BRL, datas `dd/mm/aaaa`, máscaras CPF/CNPJ/telefone/CEP/placa.
- Next.js 16 (App Router, `src/proxy.ts` no lugar de middleware). Leia `node_modules/next/dist/docs/` antes de usar APIs novas.
- `cacheComponents` está **desligado** de propósito (ver `docs/planejamento/DECISIONS.md` D-003).
- Toda mutation passa por server action/route handler com sessão do usuário (chave anon + cookies) → RLS sempre aplica.
  Operações atômicas ficam em funções RPC do Postgres (`supabase/migrations/*_functions.sql`).
- `SUPABASE_SERVICE_ROLE_KEY` só em scripts de seed/E2E e no reset do modo apresentação (servidor). Nunca em `NEXT_PUBLIC_*`.
- Nunca confiar em `organization_id` vindo do browser: o contexto vem do cookie `movix_org`, validado contra
  `organization_memberships` a cada request (`src/lib/auth/context.ts`), e as triggers do banco derivam `organization_id`
  a partir de `vehicle_id`/`rental_id`.
- Simulações (Pix, cartão, GPS, IA fallback, demo) devem estar **visivelmente rotuladas** com `<SimulatedBadge />`.
- Nunca coletar dados de cartão; nunca chamar o aceite de "assinatura digital certificada".

## Comandos
- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm run build`
- `npm test` — Vitest: domínio + banco (migrations e RLS em PGlite, sem Docker)
- `npm run test:e2e` — Playwright (jornadas autenticadas exigem Supabase configurado em `.env.local`)
- `npm run db:push` / `npm run seed` — aplicar migrations e semear dados sintéticos (requer credenciais)

## Estrutura
`src/app/(marketing|auth|owner|renter|admin)`, `src/app/demo`, `src/components/ui` (design system),
`src/features/<módulo>` (actions + componentes), `src/lib/{supabase,auth,domain,validation,reports,demo}`,
`supabase/migrations`, `supabase/seed`, `tests/{unit,db,e2e}`, `docs/` (`especificacao/`, `planejamento/` e guias).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
