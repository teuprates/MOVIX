# Relatório de QA — MOVIX

Data: 15/11/2026

## Baseline

| Verificação | Resultado antes das alterações |
|---|---|
| `npm run check` | ✅ lint, typecheck, Vitest 50/50 e build passaram |
| `E2E_SUPABASE=1 npm run test:e2e` | ⚠️ Ambiente sem sessão Supabase utilizável: 42 testes públicos/PWA passaram; 24 autenticados foram pulados e 2 tentativas de login expiraram. O login permaneceu em `/entrar` (`tests/e2e/authenticated.spec.ts:28`). |

O primeiro E2E foi bloqueado pela ausência do Chromium local; após `npx playwright install chromium`, a suíte pública executou. As duas falhas de login não confirmam defeito do produto: `.env.local`/credenciais Supabase de seed não estavam disponíveis neste ambiente.

## Achados e alterações

| ID | Severidade | Rota/arquivo | Evidência | Correção | Teste de regressão |
|---|---|---|---|---|---|
| QA-01 | P2 (qualidade de teste) | `tests/e2e/authenticated.spec.ts`, fluxo de aceite e pagamento | Os blocos `if (await pending.isVisible())` e `if (await pay.isVisible())` ignoravam silenciosamente o fluxo quando os elementos esperados não apareciam. | Removidas as condições opcionais; agora os asserts Playwright falham se o estado esperado não existir. | O próprio teste autenticado foi endurecido; execução real requer Supabase e seed. |

Nenhum bug funcional P0/P1 foi confirmado nesta rodada: os fluxos autenticados e exploratórios que dependem de Supabase não puderam ser exercitados.

## Itens não concluídos / dependências

- **Supabase real + seed:** necessário para executar os 15 fluxos autenticados, verificar uploads/URLs assinadas, cadastro e confirmação de e-mail, contrato/PDF, API do assistente e isolamento entre tenants. Configure `.env.local`, `SEED_USER_PASSWORD`, execute `npm run seed` e rode `E2E_SUPABASE=1 npm run test:e2e`.
- **Acessibilidade axe e Lighthouse:** não executados; exigem a instalação de `@axe-core/playwright` e Lighthouse CI/CLI, além de cobertura de páginas/temas/viewport que ainda precisa ser implementada.
- **Cobertura Vitest:** relatório/threshold e script `test:coverage` não adicionados.
- **Exploração de validações, concorrência de pagamento, timezones, estados vazios/loading e falha offline de Server Actions:** não executada nesta sessão.
- **PWA:** o código de `src/app/sw.js/route.ts` já contém limite de 160 entradas para assets estáticos e remoção das entradas mais antigas (`trim`), correspondente ao P2 nº 13. Não foi alterado.
- **Dispositivos reais:** instalação/splash do iOS e teclado virtual não são emulados; verificar manualmente em iOS e Android, conforme `docs/pwa-auditoria.md`. Leaked password protection depende da configuração do Supabase Auth e do plano, não do código local.

## Estado

Esta é uma rodada parcial, não uma aprovação para banca. A suíte E2E completa, Lighthouse/axe e a exploração com backend real permanecem pendentes por falta de configuração/ambiente. Nenhum commit foi criado.
