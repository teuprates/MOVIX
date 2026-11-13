# Decisões de projeto (ADR resumido)

Formato: **ID — decisão** · motivo · consequência.

- **D-001 — Next.js 16.4 + React 19 + Tailwind 4 + Supabase.** Stack definida em `ARQUITETURA.md`; versões estáveis
  mais recentes em 13/11/2026. Em Next 16 o middleware chama-se `proxy` (`src/proxy.ts`).
- **D-002 — Componentes próprios em vez de shadcn/ui.** Menos dependências e controle total dos tokens MOVIX;
  ícones Lucide, gráficos Recharts, toasts Sonner.
- **D-003 — `cacheComponents` desligado.** Praticamente todas as rotas autenticadas leem cookies de sessão; o modelo
  dinâmico tradicional evita exigências de `<Suspense>` em todo acesso dinâmico e o estado preservado por `<Activity>`
  em formulários sensíveis. Landing e demo pública continuam estáticas.
- **D-004 — Motion (sem GSAP).** `ARQUITETURA.md` cita GSAP/ScrollTrigger **e** Motion como opcionais. Motion cobre
  scroll-linked parallax (`useScroll/useTransform`), ponteiro e `useReducedMotion` com um único pacote React, reduzindo bundle.
- **D-005 — Testes de banco com PGlite.** Não há Docker/Supabase CLI local. As migrations reais rodam em PGlite
  (Postgres WASM) com um *shim* mínimo dos esquemas `auth`/`storage` e papéis `anon`/`authenticated`, permitindo testar
  RLS, constraints de exclusão e RPCs de verdade. Limitação: não testa GoTrue/PostgREST/Storage reais — coberto pelo E2E
  quando houver projeto Supabase.
- **D-006 — "Contrato" = `rentals` + `contract_versions` + `contract_acceptances`.** A locação é o contrato comercial;
  cláusulas e termos ficam em versões imutáveis com hash SHA-256; cada versão exige aceite próprio. Não existe tabela
  `contracts` separada (evita duplicação). Mudanças de preço/período exigem cancelar e emitir nova locação; aditivos
  alteram apenas cláusulas (nova versão + novo aceite).
- **D-007 — Bloqueio de sobreposição por `EXCLUDE USING gist`.** Locações e indisponibilidades vivem em
  `vehicle_availability_blocks` com uma única constraint de exclusão `(vehicle_id =, period &&)`. Isso protege contra
  concorrência no nível do banco (a segunda transação falha com `23P01`), não só na interface.
- **D-008 — Dados restritos do veículo em tabela separada.** Chassi, RENAVAM e vencimentos ficam em
  `vehicle_private_data`, com RLS própria (proprietário ou locatário com locação `active` e `end_date >= hoje`).
  RLS é por linha; separar a tabela é a forma correta de restringir colunas. Revogação ao término é automática.
- **D-009 — Mutations sensíveis só via RPC `SECURITY DEFINER` com checagens explícitas.** Ex.: criar locação, aceitar,
  pagar (simulado), aprovar vistoria/vínculo, admin. Tabelas desses fluxos não recebem `INSERT/UPDATE` para
  `authenticated`. Colunas como `suspended_at`, `is_demo`, `owner_id` não são graváveis pelo usuário (grants por coluna).
- **D-010 — Notificações e auditoria por triggers.** Garante que todo fluxo relevante notifica e audita, mesmo se a UI
  mudar. Usuário só lê e marca como lida (grant apenas na coluna `read_at`).
- **D-011 — Rastreamento simulado sem tabela de pontos.** Rotas pré-definidas em código; a posição é função
  determinística do tempo decorrido salvo em `tracking_simulations`. O histórico é o trecho já percorrido.
  Evita fingir coleta de telemetria. Interface sempre exibe "DEMONSTRAÇÃO — sem GPS físico".
- **D-012 — Receita = parcelas pagas (simuladas).** Despesas categorizadas em `expenses`; custos de manutenção e
  multas pagas pela locadora geram despesa vinculada. Lucro estimado por veículo = receitas − despesas do veículo.
- **D-013 — PDF com `pdf-lib` e XLSX com `exceljs` em route handlers.** Gerados no servidor com a sessão do usuário,
  portanto apenas dados autorizados pela RLS.
- **D-014 — Mapa com Leaflet + tiles CARTO (dark/light).** Leve, sem chave de API. Se não houver internet, a rota e os
  marcadores continuam desenhados sobre fundo neutro.
- **D-015 — Modo apresentação `/demo` (ver D-018).** Exige login e ser proprietário de uma locadora marcada `is_demo` ou admin da
  plataforma. Ações do modo apresentação só afetam a locadora demo (checado no servidor e no banco). O reset usa a
  service role exclusivamente no servidor, após verificar `is_demo`.
- **D-016 — Assistente.** Locatário: chatbot roteirizado por intenções (sempre disponível). Se `ANTHROPIC_API_KEY`
  existir, a rota `/api/assistente` usa a API Claude no servidor com rate limit em memória e contexto mínimo;
  qualquer falha cai no roteiro. Insights do proprietário: regras determinísticas e transparentes.
- **D-017 — Admin da plataforma em `platform_admins`.** Concedido apenas por SQL/seed; nunca por metadados do usuário.
  Admin acessa somente RPCs agregadas (sem documentos pessoais ou finanças detalhadas); e-mails aparecem mascarados.
- **D-018 — Dados demo via função SQL `demo_populate`.** Seed e "Restaurar dados" do `/demo` usam a mesma função
  idempotente, que só atua em locadoras `is_demo` (proprietário dela ou chamada sem usuário no JWT/service role).
  Substitui a ideia inicial de reset via service role no app (D-015 atualizado: o app não usa service role).
  Exclusões de contratos aceitos só são liberadas dentro desse reset (GUC `movix.demo_reset` + checagem `is_demo`).
- **D-019 — Minimização no acesso a perfis.** Proprietário vê perfil/documentos do locatário somente com vínculo
  pendente/aprovado ou histórico de locação na sua locadora; recusados deixam de ser visíveis.
- **D-020 — Assistente com Claude Opus 5.5 (`claude-opus-5-5`), esforço `low`, fallback server-side de recusa
  (`fallbacks: "default"`).** Contexto mínimo (sem CPF/CNH), rate limit 12/min e retorno ao roteiro em qualquer falha.
- **D-021 — Redesign dos painéis (DESIGN.md v2) guiado pelo Impeccable (modo Operate).** Trilho azul-noite nos dois temas,
  Inter na interface e Sora só em títulos/números de destaque, sem eyebrows, "pulso da frota" como assinatura do proprietário
  e cartão do veículo (foto real ou ilustração vetorial tingida pela cor cadastrada) no app do locatário. `PageHeader.eyebrow`
  virou `meta` (identificador ao lado do título). Regras de negócio, consultas com RLS e rotas inalteradas.
- **D-022 — Busca Ctrl K e tabela ordenável no cliente.** `CommandMenu` (dialog nativo) indexa páginas, ações, veículos e
  contratos já autorizados pela RLS no layout; `DataTable` ordena e filtra localmente linhas renderizadas no servidor
  (volumes de pequena frota). Filtros de status por URL continuam no servidor.
