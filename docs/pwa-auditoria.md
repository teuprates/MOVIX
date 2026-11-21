# Auditoria da experiência PWA (13/11/2026)

Método: leitura do código (manifest, service worker, layouts, páginas, componentes) e inspeção da aplicação em execução
com Playwright a 360×740 (toque, `isMobile`), além de 390/768/1024/1280 px nos temas claro e escuro, com dados reais do
Supabase (seed sintético).

## Problemas encontrados (por impacto)

| # | Prioridade | Problema | Evidência |
|---|---|---|---|
| 1 | P0 | Tabelas viram rolagem horizontal no celular (contratos, vistorias, manutenção, locatários, multas, ocorrências, financeiro) | capturas 360 px: colunas espremidas e cortadas |
| 2 | P0 | Proprietário sem navegação inferior no celular; tudo depende do menu hambúrguer | `painel/layout.tsx` |
| 3 | P0 | Filtros ausentes ou rasos: só status por link (contratos, vistorias) e busca simples (frota); nada em manutenção, locatários, ocorrências, multas, parcelas | código das páginas |
| 4 | P0 | Campos com fonte 14 px: o iOS dá zoom ao focar e desloca a tela com o teclado virtual | `fieldBase` em `primitives.tsx` |
| 5 | P1 | Modais centralizados no celular (confirmações, pagamento, formulários): difíceis de alcançar com o polegar | `ui/dialog.tsx` |
| 6 | P1 | Chips de filtro quebram em duas linhas e ocupam a dobra; alvos de toque < 32 px (contratos 11, financeiro 15, parcelas 8) | medição automática |
| 7 | P1 | Dashboard do proprietário no celular é a versão desktop empilhada (≈10.000 px de altura) | captura `proprietario-painel-celular` |
| 8 | P1 | Locatário com vários veículos ativos: cartões empilhados, sem alternância | `app/page.tsx` |
| 9 | P1 | Página offline em cache sem CSS/JS (abre sem estilo); navegação sem tempo limite em rede instável; sem aviso de conexão perdida | `public/sw.js` |
| 10 | P1 | Sem aviso de nova versão: o SW ativa com `skipWaiting` e a aba continua com o bundle antigo | `public/sw.js` |
| 11 | P2 | Manifest sem `id`, atalhos sem ícone, orientação travada em retrato (ruim em tablet), cor do tema fixa escura | `manifest.ts` |
| 12 | P2 | Formulário de veículo longo (19 campos) em uma única rolagem no celular | `vehicle-form.tsx` |
| 13 | P2 | Cache de assets estáticos cresce sem limite | `public/sw.js` |
| 14 | P2 | Erro de rede em Server Actions mostra mensagem genérica | `ActionButton`/`ActionForm` |

Limitações conhecidas não tratadas: splash screens específicas do iOS (exigem uma imagem por resolução; o iOS usa a cor de
fundo + ícone `apple-touch-icon`), notificações push e sincronização em segundo plano (fora do escopo; nenhuma ação remota é
simulada offline). A tabela de manutenção não tem campo de prioridade; a "prioridade" é derivada do prazo (vencida, próxima).

## O que foi feito
Ver `docs/planejamento/PROGRESS.md` → "Experiência PWA" e `docs/planejamento/DECISIONS.md` D-023 a D-026. Testes: `tests/e2e/pwa.spec.ts` e jornadas mobile em `tests/e2e/authenticated.spec.ts`.
