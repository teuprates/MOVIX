# Modelo de segurança e RLS

## Princípios
1. **RLS em todas as tabelas** do schema `public` e em `storage.objects`. Políticas separadas por comando (SELECT/INSERT/UPDATE/DELETE) com `USING` e `WITH CHECK`.
2. **`anon` não acessa nenhuma tabela** (`revoke all`). Única função pública: `get_invitation_preview(code)` (nome/logo/cores da locadora).
3. **Grants mínimos para `authenticated`**: tabelas de fluxos sensíveis (locações, versões, aceites, parcelas, pagamentos, vínculos, notificações) não têm `INSERT/UPDATE` direto — só via RPC. Colunas privilegiadas (`suspended_at`, `is_demo`, `owner_id`, `organization_id` de veículos) não são graváveis (grants por coluna).
4. **Escopo derivado no banco**: triggers `set_org_from_vehicle`, `set_scope_from_rental`, `set_org_from_inspection/incident` sobrescrevem `organization_id`/`vehicle_id` — IDs forjados pelo cliente são corrigidos e depois barrados pela RLS.
5. **Autorização no servidor**: toda Server Action obtém a sessão (JWT verificado via `getClaims`) e o contexto da locadora validado contra vínculos aprovados. O `proxy.ts` faz apenas checagem otimista.
6. **Papéis não vêm de metadados**: proprietário/locatário vêm de `organization_memberships`; admin de `platform_admins` (só por SQL/seed). `intended_role` do cadastro é apenas sugestão de onboarding.

## Funções auxiliares (SECURITY DEFINER, `search_path = ''`)
| Função | Regra |
|---|---|
| `has_org_role(org, role)` | vínculo **aprovado**, usuário e locadora **não suspensos** |
| `is_org_owner(org)` / `is_org_member(org)` | atalhos de `has_org_role` |
| `is_rental_renter(rental)` | locatário da locação com vínculo aprovado |
| `has_active_rental(vehicle)` | locação `active` **e** `end_date >= hoje` → dados restritos |
| `can_view_profile(user)` | o próprio usuário, ou dono de locadora com vínculo pendente/aprovado (ou histórico de locação) |
| `is_platform_admin()` | linha em `platform_admins` e conta ativa |

## Matriz de acesso (resumo)
| Recurso | Proprietário | Locatário aprovado | Locatário pendente / sem vínculo | Admin |
|---|---|---|---|---|
| Veículos da locadora | CRUD | leitura | — | — (só contagem) |
| Chassi/RENAVAM/vencimentos | CRUD | só com locação ativa vigente | — | — |
| Locações, versões, aceites, parcelas | leitura; mutação via RPC | as próprias; aceite/pagamento via RPC | — | — |
| Vistorias | leitura; revisão via RPC | inserir nas próprias locações ativas | — | — |
| Despesas, manutenção, rastreamento, auditoria | CRUD/leitura | — | — | — |
| Perfil e documentos do locatário | leitura (vínculo pendente/aprovado) | o próprio | o próprio | — |
| Métricas agregadas, suspensões | — | — | — | RPCs `admin_*` |

## Storage
Buckets privados: `documents/{user}/…`, `vehicle-media/{org}/{veículo}/…`, `inspection-media/{org}/{vistoria}/…`, `incident-media/{org}/{ocorrência}/…`. Público apenas `branding` (logos). Limites de tamanho e MIME no bucket **e** no servidor (`validateFile`). Leitura sempre por **URL assinada curta** (2–10 min) gerada com a sessão do usuário.

## Integridade
- **Sobreposição de reservas**: `EXCLUDE USING gist (vehicle_id WITH =, period WITH &&)` em `vehicle_availability_blocks` (locações e bloqueios na mesma tabela). Requisições concorrentes: a segunda transação falha com `23P01`.
- **Contratos imutáveis**: trigger impede alterar cláusulas/termos/hash de qualquer versão e apagar versões aceitas; `contract_acceptances` não aceita UPDATE/DELETE. Única exceção: reset de locadora `is_demo` dentro de `demo_populate`.
- **Auditoria**: trigger `audit_row` registra criação/transições de status (sem dados pessoais).

## Pagamentos e simulações
Pix gera código/QR **não pagável**; cartão não tem nenhum campo. `simulated_payments` guarda só método, valor e referência fictícia. GPS, IA de fallback e demo pública são rotulados na interface.

## LGPD (orientações, sem certificação)
Consentimento registrado (`lgpd_consent_at`), minimização no admin (e-mail mascarado, sem documentos), compartilhamento restrito às locadoras escolhidas pelo locatário, revogação automática de dados restritos, auditoria sem PII. Seeds e testes usam apenas dados sintéticos.

## Evidências
`tests/db/security.test.ts` e `tests/db/demo.test.ts` executam as migrations reais em Postgres (PGlite) e verificam cada regra acima, incluindo casos de negação.
