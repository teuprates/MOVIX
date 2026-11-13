# Requisitos, casos de uso e matriz de testes

## Requisitos funcionais
| ID | Requisito | Implementação |
|---|---|---|
| RF01 | Cadastro público do proprietário com verificação de e-mail | `/cadastro`, `/auth/callback`, `/verificar-email` |
| RF02 | Criar e personalizar locadora (CPF/CNPJ, endereço, telefone, logo, cores) | `/onboarding`, `/painel/configuracoes`, RPC `create_organization` |
| RF03 | Convite compartilhável (WhatsApp) e cadastro do locatário com documentos | `/painel/locatarios`, `/convite/[code]`, RPC `join_with_invitation` |
| RF04 | Aprovação explícita por locadora; múltiplos vínculos | RPC `review_membership`, troca de locadora (cookie validado) |
| RF05 | CRUD de frota com fotos, tarifas, status, notas e histórico | `/painel/frota/*` |
| RF06 | Dados restritos só para dono e locatário com contrato ativo | tabela `vehicle_private_data` + `has_active_rental` |
| RF07 | Calendário e bloqueios sem sobreposição (transacional) | `/painel/calendario`, EXCLUDE gist |
| RF08 | Contrato com total/parcelas antes da confirmação, aceite eletrônico, versões, PDF | `/painel/contratos/novo`, RPCs `create_rental`/`accept_contract`/`amend_contract`, `/api/contratos/[id]/pdf` |
| RF09 | Pix/cartão simulados atualizando parcelas, métricas e notificações | RPC `simulate_payment`, modal de pagamento |
| RF10 | Receitas/despesas, lucro por veículo, gráficos, relatórios PDF/XLSX | `/painel/financeiro`, `/painel/relatorios`, `/api/relatorios/*` |
| RF11 | Vistorias com fotos, aprovação/correção, histórico, comparação | `/app/vistorias/*`, `/painel/vistorias/*` |
| RF12 | Manutenção, alertas por data/km e Health Score explicável | `/painel/manutencao`, `computeHealthScore`, RPC `refresh_alerts` |
| RF13 | Ocorrências com anexos e estados; multas associadas | `/painel/ocorrencias`, `/app/ocorrencias`, `/painel/multas` |
| RF14 | Rastreamento simulado com rotas, geofence, iniciar/pausar/reiniciar | `/painel/rastreamento` |
| RF15 | Insights por regras e chatbot do locatário (IA opcional) | dashboard, `/app/assistente`, `/api/assistente` |
| RF16 | Central de notificações lidas/não lidas; WhatsApp por link | `/painel/notificacoes`, `/app/notificacoes` |
| RF17 | Admin com agregados e suspensão/reativação | `/admin`, RPCs `admin_*` |
| RF18 | Landing cinematográfica e demo pública sem login | `/`, `/demonstracao` |
| RF19 | Modo apresentação protegido (`/demo`) e botão na demo | `/demo` |

## Requisitos não funcionais
Segurança (RLS, buckets privados, sem service role no browser), PT-BR/BRL/datas/máscaras, responsividade 320px+, acessibilidade (foco visível, skip link, labels, `aria-invalid`, tabelas alternativas aos gráficos), tema automático + manual, `prefers-reduced-motion`, PWA instalável com caching responsável, desempenho (Server Components, mapa carregado sob demanda).

## Casos de uso (jornadas)
1. **Proprietário** cadastra-se → confirma e-mail → cria locadora → cadastra veículos → convida locatário → aprova → emite contrato → acompanha pagamentos, vistorias e alertas → exporta relatório.
2. **Locatário** abre o convite → cria conta → envia dados e documentos → aguarda aprovação → aceita contrato → faz vistoria de retirada → paga parcelas (simulado) → registra ocorrência → devolve com vistoria.
3. **Admin** acompanha crescimento e suspende/reativa contas ou locadoras.
4. **Visitante** explora a demo pública sem login.

## Matriz de testes
| Critério de aceitação | Teste automatizado | Status |
|---|---|---|
| Perfil criado no cadastro; usuário não se promove a admin/reativa | `tests/db/security.test.ts` › cadastro e perfis | ✅ PGlite |
| Convite → pendente sem acesso → aprovação só na locadora correta | › convite, aprovação e isolamento | ✅ PGlite |
| Mesmo locatário em duas locadoras sem vazamento; dois contratos ativos | › isolamento / dois contratos ativos | ✅ PGlite · E2E pronto |
| Não vinculado não vê veículos/documentos; vinculado sem contrato não vê chassi; revogação ao término/expiração | › dados restritos | ✅ PGlite · E2E pronto |
| Sobreposição recusada (inclusive contra manutenção); concorrência | › bloqueia reserva sobreposta · E2E `reservas concorrentes` | ✅ PGlite · E2E pronto |
| Contrato: só o locatário aceita; evidência com hash; imutável; aditivo exige novo aceite | › contratos | ✅ PGlite |
| Pagamento simulado altera parcela e notifica; sem dados de cartão | › pagamento simulado · E2E (sem inputs no modal) | ✅ PGlite · E2E pronto |
| Vistoria: envio, revisão, correção com histórico; terceiros negados | › vistoria | ✅ PGlite |
| Alertas de manutenção deduplicados; Health Score explicável | › alertas · `tests/unit/domain.test.ts` | ✅ |
| Notificações próprias, só `read_at` editável | › notificações | ✅ PGlite |
| Admin só agregados; não-admin negado; suspensão bloqueia | › admin e suspensão | ✅ PGlite · E2E pronto |
| Storage: documentos privados, fotos só para membros | › storage | ✅ PGlite |
| Seed demo idempotente e restrito a `is_demo` | `tests/db/demo.test.ts` | ✅ PGlite |
| Preço/parcelas, CPF/CNPJ/placa, máscaras, rastreamento, insights, PDF | `tests/unit/*.test.ts` | ✅ |
| Landing, demo pública sem banco, pagamento local, mapa rotulado, assistente | `tests/e2e/public.spec.ts` | ✅ desktop + mobile |
| Rotas e APIs protegidas negam anônimos | `tests/e2e/public.spec.ts` | ✅ |
| Validação de formulários acessível, tema manual, skip link, reduced motion, sem overflow em 320px | `tests/e2e/public.spec.ts` | ✅ |
| PWA: manifest, ícones, service worker | `tests/e2e/public.spec.ts` | ✅ |
| Jornadas autenticadas reais (proprietário, locatário, pendente, admin, /demo, mobile) | `tests/e2e/authenticated.spec.ts` | ⏸ requer Supabase (`E2E_SUPABASE=1`) |
