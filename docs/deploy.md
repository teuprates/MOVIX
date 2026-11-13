# Configuração e deploy

## 1. Supabase (plano gratuito)
1. Crie um projeto em supabase.com e anote: Project URL, chave **publishable/anon**, chave **service role/secret** e a connection string do banco.
2. Copie `.env.example` → `.env.local` e preencha (nunca comite).
3. Aplique as migrations (escolha uma opção):
   - **CLI** (sem Docker): `npx supabase db push --db-url "$SUPABASE_DB_URL"` (ou `npm run db:push`).
   - **SQL Editor**: execute os arquivos de `supabase/migrations/` em ordem numérica.
4. **Auth → URL Configuration**: Site URL = `http://localhost:3000` (dev) ou o domínio da Vercel; Redirect URLs = `http://localhost:3000/auth/callback` e `https://SEU-DOMINIO/auth/callback`.
5. **Auth → Providers → Email**: mantenha "Confirm email" ativo (critério de aceitação). Para muitos cadastros, configure SMTP próprio (o SMTP padrão do Supabase tem limite baixo).
6. Seed sintético: defina `SEED_USER_PASSWORD` e rode `npm run seed`. Cria contas `*@movix.demo`, duas locadoras demo, vínculos (aprovado/pendente/sem vínculo), convite e dados operacionais.

## 2. Executar localmente
```bash
npm install
npm run dev
```
Sem `.env.local`, landing, demo pública, termos e privacidade funcionam; áreas autenticadas redirecionam para `/configuracao`.

## 3. Qualidade
```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```
E2E autenticado: `E2E_SUPABASE=1 npm run test:e2e` (após `npm run build` e seed).

## 4. GitHub (público)
Crie o repositório, `git init`, commit e push. O workflow `.github/workflows/ci.yml` roda lint, typecheck, testes, build e E2E públicos. Confirme que `.env.local` não foi versionado.

## 5. Vercel
1. Importe o repositório (framework Next.js detectado).
2. Variáveis de ambiente (Production/Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (domínio final) e, opcionalmente, `ANTHROPIC_API_KEY`. **Não** cadastre a service role na Vercel — o app não precisa dela.
3. Após o primeiro deploy, adicione o domínio em Supabase → Auth → Redirect URLs.

## Checklist de variáveis
| Variável | Onde | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `_ANON_KEY`) | Vercel + local | sim |
| `NEXT_PUBLIC_SITE_URL` | Vercel + local | recomendado |
| `SUPABASE_SERVICE_ROLE_KEY` | **apenas local** (seed/E2E) | para seed |
| `SUPABASE_DB_URL` | apenas local | para `db:push` |
| `SEED_USER_PASSWORD` | apenas local | para seed/E2E |
| `ANTHROPIC_API_KEY` | Vercel (servidor) | opcional |
