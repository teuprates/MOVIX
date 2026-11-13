# Tecnologias, limitações e evolução

## Tecnologias e justificativas
| Tecnologia | Uso | Justificativa |
|---|---|---|
| Next.js 16 (App Router, Server Actions, proxy) | Frontend + BFF | SSR com sessão em cookies, mutations no servidor, deploy nativo na Vercel |
| TypeScript estrito | Todo o código | Segurança de tipos de ponta a ponta |
| Tailwind CSS 4 | Design system por tokens | Tema claro/escuro por variáveis CSS |
| Supabase (Auth, Postgres, Storage) | Backend | RLS nativa, autenticação com verificação de e-mail, buckets privados |
| PostgreSQL `btree_gist` | EXCLUDE constraint | Garantia transacional contra reservas sobrepostas |
| Zod | Validação | Mesmo schema para mensagens de erro de formulário e servidor |
| Motion | Animações da landing | Scroll/parallax/ponteiro com suporte a reduced motion (D-004) |
| Recharts | Gráficos | Componentes React acessíveis com tooltip |
| Leaflet + CARTO/OSM | Mapa simulado | Sem chave de API |
| pdf-lib / ExcelJS | PDF e XLSX | Geração no servidor com a sessão do usuário |
| Anthropic SDK (opcional) | Assistente | Só no servidor, com fallback roteirizado e rate limit |
| Vitest + PGlite | Testes de domínio e de RLS | Postgres real em WASM, sem Docker (D-005) |
| Playwright | E2E | Desktop e mobile, casos de negação |

## Limitações conhecidas
- Pagamentos, GPS, verificação documental e WhatsApp são **simulados** por definição do escopo.
- Aceite eletrônico não é assinatura digital ICP-Brasil.
- Rate limit do assistente é em memória (por instância serverless).
- Testes de RLS usam um *shim* de `auth`/`storage`; o comportamento de GoTrue/PostgREST/Storage reais é coberto pela suíte E2E autenticada, que depende de um projeto Supabase.
- Alterar preço/período de um contrato exige cancelar e emitir novo (aditivos alteram cláusulas).
- Arquivos enviados durante demonstrações não são apagados pelo "Restaurar dados".
- Sem modo offline completo (PWA mostra página offline).

## Evolução futura
Gateway de pagamento real (Pix/cartão com webhooks), telemetria/GPS real, assinatura ICP-Brasil, verificação documental (OCR/bases oficiais), WhatsApp Business API, notificações push, multiusuário por locadora (atendentes), testes de carga e observabilidade.

## Referências utilizadas
- Documentação do Next.js 16 (incluída em `node_modules/next/dist/docs`).
- Documentação do Supabase (Auth com SSR, RLS, Storage).
- Documentação do PostgreSQL (Row Security Policies, Exclusion Constraints, `btree_gist`).
- Lei nº 13.709/2018 (LGPD).
