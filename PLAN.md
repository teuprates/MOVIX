# MOVIX — Plano de implementação revisado

Revisão do `PLANO.md` após inventário (13/11/2026). Ambiente: Windows 11, Node 24, npm 11, Git. **Sem** Docker,
Supabase CLI global, GitHub CLI ou Vercel CLI; **sem** credenciais Supabase/GitHub/Vercel/IA. Logo de referência em
`assets/movix-referencia.png` (M em fita azul-elétrico, wordmark MOVI branco + X azul, fundo preto/azul-noite).

## Síntese de arquitetura
```
Browser (Next.js RSC + client islands, PWA)
   │  cookies de sessão Supabase (@supabase/ssr)
   ▼
Next.js 16 (Vercel) ── proxy.ts: renova sessão + redireciona rotas protegidas (checagem otimista)
   │  Server Components: leitura com sessão do usuário → RLS
   │  Server Actions / Route Handlers: Zod + autorização + RPC
   ▼
Supabase: Auth (e-mail/senha + verificação) · Postgres (RLS em todas as tabelas, RPCs definer, triggers de
          auditoria/notificação, EXCLUDE gist) · Storage (buckets privados + signed URLs curtas)
```
Demo pública: 100% estática com dados sintéticos em `src/lib/demo/` — nunca consulta o banco.

## Modelo de dados (resumo — detalhes em `docs/arquitetura.md`)
- `profiles` 1:1 `auth.users` · `platform_admins`
- `organizations` 1:N `organization_memberships` N:1 `profiles` (papel owner|renter, status pending|approved|rejected|revoked)
- `invitations` (código compartilhável, expiração, limite de usos)
- `vehicles` 1:1 `vehicle_private_data` · 1:N `vehicle_media` · 1:N `vehicle_availability_blocks` (EXCLUDE gist)
- `rentals` 1:N `contract_versions` 1:0..1 `contract_acceptances` · 1:N `installments` 1:N `simulated_payments`
- `inspections` 1:N `inspection_media` · `maintenance_records` · `incidents` 1:N `incident_media` · `fines` · `expenses`
- `notifications` · `tracking_simulations` · `audit_events`

## Dependências
next, react, @supabase/ssr, @supabase/supabase-js, zod, lucide-react, recharts, motion, leaflet/react-leaflet, pdf-lib,
exceljs, qrcode, sonner, clsx/tailwind-merge · dev: vitest, @electric-sql/pglite, @playwright/test, tsx, dotenv.

## Riscos e mitigação
| Risco | Mitigação |
|---|---|
| Sem Supabase para testar ponta a ponta | Migrations + RLS testadas em PGlite; E2E autenticado pronto, executa quando `.env.local` existir |
| Vazamento entre tenants | RLS por `organization_id` + triggers derivando org + testes negativos |
| Reserva concorrente | `EXCLUDE USING gist` + teste |
| Escopo grande | Implementação vertical por módulo; nada declarado pronto sem teste |
| Internet na banca | Demo pública offline-friendly (dados locais); plano B no roteiro |

## Fases (ordem de execução)
1. **Fundação** — scaffold, docs, design tokens, marca SVG, tema, PWA, lint/typecheck/build.
2. **Banco** — migrations (schema, segurança, funções, storage) + testes PGlite de RLS/exclusão/RPC.
3. **Auth e vínculos** — cadastro proprietário + verificação de e-mail, onboarding da locadora, convite, cadastro do
   locatário com documentos, aprovação, múltiplos vínculos e troca de locadora, suspensão.
4. **Frota e calendário** — CRUD, fotos, dados restritos, bloqueios, calendário.
5. **Contratos e pagamentos** — emissão com total/parcelas, aceite, versões, PDF, Pix/cartão simulados.
6. **Operação** — vistorias, manutenção + Health Score, ocorrências, multas, finanças, relatórios PDF/XLSX, notificações.
7. **Simulações e IA** — rastreamento, insights, chatbot, WhatsApp share.
8. **Experiência premium** — landing cinematográfica, demo pública, `/demo`, admin.
9. **Qualidade** — seed idempotente, Playwright, acessibilidade, revisão de segurança, documentação TCC.

Reordenação: banco vem antes de auth (as RPCs de convite/aprovação dependem dele); landing vem depois dos módulos
para reaproveitar componentes reais do dashboard na demo pública.

## Pendências externas (exigem o usuário)
1. Criar projeto Supabase (gratuito) e preencher `.env.local` (URL, anon key, service role, DB URL).
2. Configurar Auth → URL Configuration (Site URL e Redirect URLs `…/auth/callback`).
3. Repositório GitHub público e projeto Vercel (variáveis de ambiente).
4. Opcional: `ANTHROPIC_API_KEY` para o assistente com IA real.
