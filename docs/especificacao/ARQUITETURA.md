# Arquitetura de referência (refinar no planejamento)

## Stack
Next.js (App Router), TypeScript estrito, Tailwind CSS, Supabase (Auth/Postgres/Storage), Vercel. Sugestões opcionais: shadcn/ui ou componentes próprios, Lucide React, Recharts, React Hook Form + Zod, Playwright, biblioteca de mapa compatível e GSAP/ScrollTrigger + Motion com carregamento seletivo. Use a skill Impeccable se estiver efetivamente disponível; não assuma instalação.

## Organização
`src/app/(marketing)`, `(auth)`, `(owner)`, `(renter)`, `(admin)`, `demo`; `src/components`, `src/features`, `src/lib/supabase`, `src/lib/auth`, `src/lib/domain`, `src/lib/validation`, `src/lib/reports`; `supabase/migrations`, `supabase/seed`, `tests/e2e`, `docs`. Adapte conforme justificativa.

## Entidades candidatas
`profiles`, `organizations`, `organization_memberships`, `invitations`, `vehicles`, `vehicle_media`, `vehicle_availability_blocks`, `rentals`, `contracts`, `contract_versions`, `contract_acceptances`, `installments`, `simulated_payments`, `expenses`, `inspections`, `inspection_media`, `maintenance_records`, `incidents`, `fines`, `notifications`, `tracking_simulations`, `tracking_points`, `audit_events`, `platform_admins`. Definir cardinalidades, constraints, índices e migrations antes do CRUD. Não criar tabelas desnecessárias.

## Segurança obrigatória
- RLS em todas as tabelas expostas, com isolamento por `organization_id`, associação aprovada e ownership apropriado. Políticas de SELECT/INSERT/UPDATE/DELETE separadas, checando `USING` e `WITH CHECK`.
- Autorização no servidor para cada mutation; papéis e admin não confiados a metadados editáveis pelo usuário. Não confiar em IDs de organização vindos do browser.
- Buckets privados para CNH, comprovantes, fotos de inspeção e anexos sensíveis; signed URLs curtas e verificações por vínculo/contrato. Upload com tamanho/tipo permitidos.
- Nunca expor service-role ou tokens de terceiros no cliente; segredos só no ambiente servidor. Sem dados reais em logs, seeds ou repositório.
- Contratos aceitos e evidências imutáveis; auditoria das transições relevantes. Impedir sobreposição de locações em nível de banco/transação (inclusive concorrência).
- Aplicar minimização de dados pessoais, retenção e orientações LGPD; não afirmar conformidade jurídica certificada.

## Integrações e simulações
Não conectar gateway de pagamento, WhatsApp API, rastreador GPS ou verificação documental. Pix, cartão, GPS, IA fallback e dados de demo são simulados, identificados em toda interface pertinente. Integração opcional de IA deve ter fallback e rate limiting. Public demo não acessa tabelas privadas.

## Ambientes
`.env.example` sem segredos; scripts de migração/seed reproduzíveis; dev local e Vercel; checklist de variáveis e callback URLs do Supabase. CI para lint/typecheck/build/testes. Separar demonstração e produção por ambiente ou por isolamento rigoroso de dados.
