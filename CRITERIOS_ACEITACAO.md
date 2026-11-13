# Critérios de aceitação e testes

## Fluxos obrigatórios
- Proprietário registra conta, verifica e-mail, cria locadora e personaliza logo/cores.
- Gera convite; locatário cadastra dados/documentos; vê pendência; proprietário aprova; vínculo liberado somente na locadora correta.
- Mesmo locatário alterna entre duas locadoras autorizadas sem vazamento de dados; pode manter dois contratos ativos distintos.
- Proprietário cadastra veículo, imagens, tarifas e períodos indisponíveis; duas solicitações concorrentes não produzem reserva sobreposta.
- Locatário não vinculado não vê veículos privados/documentos; locatário vinculado sem contrato ativo não vê chassi/RENAVAM; acesso é revogado após término.
- Proprietário emite contrato com total/parcelas; locatário aceita; PDF inclui versão/aceite; contrato aceito não é editável silenciosamente.
- Pix/cartão simulados exibem aviso; pagamento fake altera parcela e métricas; nenhum dado real de cartão é coletado.
- Locatário envia vistoria com fotos; proprietário aprova ou solicita correção; histórico preservado; comparação de devolução.
- Manutenção gera alertas e Health Score explicável; incidentes e multas associados a contratos/veículos.
- Rastreamento fake inicia/pausa/reinicia, mostra rotas e geofence, sempre marcado simulado.
- Finanças e relatórios filtram por locadora; PDF/XLSX geram dados autorizados; notificações têm estados lida/não lida.
- Admin vê apenas agregados permitidos, pode suspender/reativar; usuário suspenso perde acesso pertinente.
- Landing demo pública funciona sem auth, apenas com dados fictícios; `/demo` exige autorização e também é acessível pelo painel demonstrativo.
- PWA instalável, PT-BR, responsivo, tema automático/manual, teclado e reduced motion.

## Automação
Playwright: jornadas de proprietário, locatário, admin, negativa de acesso entre tenants, convidado pendente, acesso documental após expiração, contrato/inspeção/pagamento simulados, demo e mobile. Testar validação de formulário, estados vazios, erros e loading. Scripts `lint`, `typecheck`, `build`, `test` e `test:e2e` documentados. Se não houver execução por falta de ambiente, registrar explicitamente.

## Definição de pronto
Feature somente concluída quando implementada ponta a ponta, protegida por autorização/RLS, testada, responsiva, com mensagens de erro e documentação mínima. Não confundir mock visual com recurso funcional; simulações previstas são exceção explícita.
