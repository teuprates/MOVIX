# Arquitetura do MOVIX

## Visão de componentes

```mermaid
flowchart LR
  subgraph Cliente["Navegador / PWA"]
    L[Landing + demo pública<br/>dados fictícios locais]
    O[Painel do proprietário]
    R[App do locatário]
    A[Admin]
    D[/demo · modo apresentação/]
  end
  subgraph Next["Next.js 16 (Vercel)"]
    P[proxy.ts<br/>renova sessão · checagem otimista]
    SC[Server Components<br/>leitura com sessão do usuário]
    SA[Server Actions<br/>Zod + autorização]
    RH[Route Handlers<br/>PDF · XLSX · assistente]
  end
  subgraph Supabase
    AU[Auth<br/>e-mail/senha + verificação]
    PG[(Postgres<br/>RLS · RPCs · triggers · EXCLUDE gist)]
    ST[(Storage<br/>buckets privados + URLs assinadas)]
  end
  AI[API Claude<br/>opcional, só servidor]
  O & R & A & D --> P --> SC & SA & RH
  SC & SA & RH --> AU & PG & ST
  RH -.-> AI
  L -. sem acesso ao banco .- L
```

- **Leitura**: Server Components usam o cliente Supabase com os cookies do usuário (`src/lib/supabase/server.ts`). A RLS decide o que retorna.
- **Escrita**: Server Actions (`src/features/*/actions.ts`) validam com Zod e chamam tabelas (CRUD simples protegido por RLS) ou RPCs `SECURITY DEFINER` para fluxos atômicos (criar locação, aceitar, pagar, revisar vistoria, aprovar vínculo, admin).
- **Contexto de locadora**: cookie `movix_org`, sempre validado contra os vínculos aprovados do usuário (`src/lib/auth/context.ts`). Triggers derivam `organization_id` de `vehicle_id`/`rental_id` — o browser nunca define o escopo.
- **Service role**: usada apenas no script de seed (`supabase/seed/seed.ts`) e nos testes E2E. O app não depende dela.

## Modelo de dados (ER)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "1:1"
  PROFILES ||--o| PLATFORM_ADMINS : ""
  PROFILES ||--o{ ORGANIZATIONS : "owner_id"
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : ""
  PROFILES ||--o{ ORGANIZATION_MEMBERSHIPS : "user_id"
  ORGANIZATIONS ||--o{ INVITATIONS : ""
  INVITATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : "invitation_id"
  ORGANIZATIONS ||--o{ VEHICLES : ""
  VEHICLES ||--|| VEHICLE_PRIVATE_DATA : "chassi/RENAVAM"
  VEHICLES ||--o{ VEHICLE_MEDIA : ""
  VEHICLES ||--o{ VEHICLE_AVAILABILITY_BLOCKS : "EXCLUDE gist"
  VEHICLES ||--o{ RENTALS : ""
  PROFILES ||--o{ RENTALS : "renter_id"
  RENTALS ||--o| VEHICLE_AVAILABILITY_BLOCKS : "kind=rental"
  RENTALS ||--o{ CONTRACT_VERSIONS : "imutáveis"
  CONTRACT_VERSIONS ||--o| CONTRACT_ACCEPTANCES : "evidência"
  RENTALS ||--o{ INSTALLMENTS : ""
  INSTALLMENTS ||--o{ SIMULATED_PAYMENTS : ""
  RENTALS ||--o{ INSPECTIONS : ""
  INSPECTIONS ||--o{ INSPECTION_MEDIA : ""
  INSPECTIONS |o--o| INSPECTIONS : "supersedes_id"
  VEHICLES ||--o{ MAINTENANCE_RECORDS : ""
  VEHICLES ||--o{ INCIDENTS : ""
  INCIDENTS ||--o{ INCIDENT_MEDIA : ""
  VEHICLES ||--o{ FINES : ""
  RENTALS |o--o{ FINES : ""
  ORGANIZATIONS ||--o{ EXPENSES : ""
  MAINTENANCE_RECORDS |o--o| EXPENSES : "maintenance_id"
  FINES |o--o| EXPENSES : "fine_id"
  PROFILES ||--o{ NOTIFICATIONS : ""
  VEHICLES ||--o| TRACKING_SIMULATIONS : ""
  ORGANIZATIONS ||--o{ AUDIT_EVENTS : ""
```

Migrations: `supabase/migrations/` — `0001_schema` (tabelas, constraints, índices, triggers de escopo), `0002_security` (helpers, grants por coluna, RLS), `0003_functions` (RPCs, notificações, auditoria), `0004_storage` (buckets e políticas), `0005_demo` (povoamento sintético idempotente).

## Fluxos principais

```mermaid
sequenceDiagram
  participant P as Proprietário
  participant DB as Postgres (RPC)
  participant L as Locatário
  P->>DB: create_rental(veículo, locatário, período, preço, parcelas, cláusulas)
  DB->>DB: valida dono + locatário aprovado · calcula total/parcelas
  DB->>DB: insere bloqueio (EXCLUDE gist impede sobreposição)
  DB->>DB: contract_version v1 + hash SHA-256 · notifica locatário
  L->>DB: accept_contract(versão, user-agent, IP)
  DB->>DB: contract_acceptances (imutável) · locação ativa · notifica dono
  L->>DB: simulate_payment(parcela, pix|cartão)
  DB->>DB: parcela paga · simulated_payments · notificações
  P->>DB: complete_rental → acesso a chassi/RENAVAM revogado
```

## Organização de pastas

| Caminho | Conteúdo |
|---|---|
| `src/app/(marketing)` | Landing, demo pública, termos, privacidade (tema escuro fixo) |
| `src/app/(auth)` | Login, cadastro, convite, recuperação de senha |
| `src/app/(owner)/painel` | Área do proprietário |
| `src/app/(renter)/app` | App do locatário (bottom nav) |
| `src/app/(admin)/admin` | Administração (agregados) |
| `src/app/demo` | Modo apresentação protegido |
| `src/app/api` | PDF de contrato, relatórios PDF/XLSX, assistente |
| `src/features/*` | Actions e componentes por módulo |
| `src/lib/domain` | Regras puras: preço, Health Score, insights, rastreamento, assistente |
| `src/lib/validation` | Zod + validações brasileiras |
| `src/lib/reports` | Motor de PDF |
| `tests/unit`, `tests/db`, `tests/e2e` | Vitest, PGlite (RLS), Playwright |
