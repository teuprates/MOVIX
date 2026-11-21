# MOVIX — Sua frota sempre conectada

SaaS multi-tenant para gestão e operação de pequenas frotas de veículos de locação, conectando **proprietário**, **veículo** e **locatário**, com motor de alertas e análises. Projeto de TCC.

> Pagamentos (Pix/cartão), rastreamento GPS, dados da demo pública e o assistente de fallback são **simulações** identificadas na interface.

## Funcionalidades
- **Proprietário**: cadastro com verificação de e-mail, locadora com logo/cores, frota com fotos e dados restritos, calendário sem sobreposição, convites por WhatsApp, aprovação de locatários, contratos com total/parcelas, aceite eletrônico, versões imutáveis e PDF, financeiro (receitas, despesas, lucro por veículo), relatórios PDF/XLSX, vistorias, manutenção com Health Score, ocorrências, multas, rastreamento simulado, insights e notificações.
- **Locatário**: cadastro exclusivo por convite com documentos privados, várias locadoras na mesma conta, aceite de contrato, parcelas com Pix/cartão simulados, vistorias com fotos, ocorrências, assistente e app mobile (PWA).
- **Admin**: métricas agregadas e suspensão/reativação de contas e locadoras.
- **Público**: landing cinematográfica, demo interativa sem login (dados fictícios) e modo apresentação protegido (`/demo`).

## Stack
Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Auth/Postgres/Storage) · Zod · Motion · Recharts · Leaflet · pdf-lib · ExcelJS · Vitest + PGlite · Playwright. Detalhes em [`docs/arquitetura.md`](docs/arquitetura.md).

## Começando
```bash
npm install
cp .env.example .env.local   # preencha as variáveis do Supabase
npm run db:push              # aplica supabase/migrations
npm run seed                 # dados sintéticos de demonstração
npm run dev
```
Sem Supabase configurado, a landing e a demo pública funcionam normalmente. Passo a passo completo (Supabase, Auth redirects, GitHub, Vercel): [`docs/deploy.md`](docs/deploy.md).

## Scripts
| Script | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | Desenvolvimento, build e servidor de produção |
| `npm run lint` · `npm run typecheck` | ESLint e TypeScript |
| `npm test` | Vitest: domínio + migrations/RLS em Postgres (PGlite) |
| `npm run test:e2e` | Playwright (desktop e mobile). Autenticados: `E2E_SUPABASE=1` |
| `npm run db:push` | Aplica as migrations (`SUPABASE_DB_URL`) |
| `npm run seed` | Seed idempotente de demonstração |
| `npm run check` | lint + typecheck + testes + build |

## Contas de demonstração (após o seed)
`dono@movix.demo` (locadora demo A), `dono.b@movix.demo` (locadora demo B), `locatario@movix.demo` (vinculado às duas), `locataria@movix.demo`, `pendente@movix.demo` (aguardando aprovação), `semvinculo@movix.demo`, `admin@movix.demo`. Senha: valor de `SEED_USER_PASSWORD` no seu `.env.local`.

## Documentação
- [Arquitetura e modelo de dados](docs/arquitetura.md)
- [Segurança e RLS](docs/seguranca.md)
- [Requisitos, casos de uso e matriz de testes](docs/requisitos-e-testes.md)
- [Tecnologias, limitações e evolução](docs/limitacoes-e-tecnologias.md)
- [Deploy](docs/deploy.md) · [Roteiro da banca](docs/roteiro-banca.md)
- Planejamento: [`PLAN.md`](docs/planejamento/PLAN.md), [`PROGRESS.md`](docs/planejamento/PROGRESS.md), [`DECISIONS.md`](docs/planejamento/DECISIONS.md)
- Especificação original do TCC: [`docs/especificacao/`](docs/especificacao/) · Índice completo: [`docs/README.md`](docs/README.md)
