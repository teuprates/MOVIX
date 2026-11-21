# Troca de senhas demonstrativas

Configure `SEED_USER_PASSWORD` no ambiente privado com a senha desejada e mantenha esse mesmo valor para execuções futuras do seed. Nunca registre o valor em arquivos versionados, logs ou páginas públicas.

Com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) disponíveis apenas no ambiente administrativo, execute:

```sh
npm run seed:passwords
```

O comando valida previamente as sete contas exatas de `SEED_USERS`, interrompe se alguma estiver ausente ou ambígua, atualiza apenas a senha por Supabase Auth Admin e verifica o login e o ID de cada usuário. Encerra somente as sessões abertas pelos testes. Não cria usuários, não executa `demo_populate` e não altera perfis, permissões, vínculos ou dados operacionais. Falhas de atualização ou autenticação causam saída diferente de zero; pode haver sucesso parcial se o serviço falhar durante a operação, então revise os resultados por e-mail antes de repetir.

Não use `npm run seed` para uma simples troca de senhas: o seed completo recria os dados operacionais demo. A demo pública `/demonstracao` não exige senha; `/demo` requer autenticação. Nenhuma senha precisa ser publicada nessas páginas.
