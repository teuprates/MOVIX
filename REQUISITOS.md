# MOVIX — Requisitos e regras de negócio

## Visão
Plataforma SaaS multi-tenant para gestão e operação de pequenas frotas de veículos alugados, conectando proprietário, veículo e locatário, com motor de alertas e análises. Slogan: **Sua frota sempre conectada**. Dados reais do produto persistidos no Supabase; funcionalidades explicitamente simuladas identificadas.

## Identidades e acesso
- Proprietário: cadastro público gratuito, cria e personaliza locadora (nome, CPF/CNPJ, endereço, telefone comercial, logo, cores), gerencia frota, convites, contratos, finanças e inspeções.
- Locatário: cadastro exclusivamente por link/código de convite compartilhável por WhatsApp; um usuário pode ter vínculos independentes com várias locadoras e múltiplas locações simultâneas. Acesso restrito até aprovação explícita de cada proprietário.
- Administrador MOVIX: métricas agregadas (contas, locadoras, veículos, contratos, crescimento), suspender/reativar contas; não tem acesso irrestrito a documentos pessoais ou finanças detalhadas.
- Cadastro locatário: nome, CPF, nascimento, e-mail, telefone, endereço, CNH número/categoria/validade, contato de emergência, upload privado de CNH e comprovante de residência. Sem verificação externa de autenticidade no MVP.
- Isolamento por locadora, com autorização também no backend. Suspensão bloqueia operações pertinentes.

## Frota e calendário
CRUD completo: marca, modelo, versão, ano, placa, cor, combustível, câmbio, quilometragem, lugares, fotos, preços diário/semanal/mensal, status, notas, histórico. Chassi, RENAVAM e vencimentos documentais: proprietário e somente locatário com contrato ativo daquele veículo. Revogar acesso ao término. Calendário disponível/reservado/alugado/manutenção; impedir reservas sobrepostas com proteção transacional no banco, não apenas na interface.

## Contratos e locações
Proprietário seleciona locatário aprovado, veículo, período, modalidade diária/semanal/mensal, preço, parcelas e cláusulas editáveis; mostra total antes da confirmação. Locatário aceita eletronicamente; guardar identidade, data/hora, versão e evidência. Gerar PDF com identidade da locadora e registro de aceite. Versão aceita imutável; alterações exigem novo aceite. Não chamar isso de assinatura digital certificada.

## Pagamentos simulados e finanças
Parcelas automáticas; Pix fictício (código/QR demonstrativo) e cartão apenas simulado: **não solicitar nem armazenar dados reais de cartão**. Confirmação de teste atualiza status persistido, dashboards e notificações; sem transação bancária. Receitas e despesas categorizadas (manutenção, seguro, IPVA, licenciamento, combustível, limpeza, multas, outros), lucro estimado por veículo e gráficos. Relatórios PDF e Excel `.xlsx` com filtros, escopo autorizado e marca da locadora.

## Inspeções
Locatário preenche retirada/devolução com fotos frente/trás/laterais/interior, combustível, quilometragem, checklist, danos e observações. Proprietário aprova ou pede correção; guardar histórico e timestamps, notificações e comparação lado a lado. Sem IA real de reconhecimento de danos.

## Manutenção, incidentes e multas
Histórico de manutenções, custos, quilometragem, revisões planejadas e alertas por data/km. Health Score 0–100 estimado por regras determinísticas transparentes, nunca diagnóstico. Locatário/proprietário registram acidentes, panes, avarias com anexos; estados aberto/em análise/resolvido/cancelado. Proprietário associa multas e custos a veículo e contrato.

## Rastreamento simulado
Mapa interativo, rotas predefinidas, posições fictícias, velocidade, histórico e geofence simulados. Proprietário inicia/pausa/reinicia rotas; claramente **DEMONSTRAÇÃO — sem GPS físico**. Não simular atualização de localização como se fosse coleta real.

## Assistente e insights
Insights para proprietário baseados em regras e dados autorizados: rentabilidade, contratos a vencer, manutenção e inadimplência simulada. Chatbot básico para locatário, fallback roteirizado; API de IA opcional, apenas via servidor, se chave configurada. Sem alegar inteligência preditiva que não exista.

## Notificações e comunicação
Central interna com lidas/não lidas, alertas de contrato, pagamentos, inspeções, manutenção e ocorrências. WhatsApp somente links de compartilhamento com texto pré-preenchido, não envio automático.

## Experiência pública e apresentação
Landing page escura/cinematográfica com storytelling por scroll, parallax, movimento e ponteiro, demo pública interativa **sem login e sem acesso a dados reais** (cards, gráficos, frota, mapa e IA demonstrativos). Modo apresentação protegido acessível via botão no dashboard demonstrativo e `/demo`; atalhos e simulações seguras com dados sintéticos, sem afetar outras locadoras.

## Qualidade e operações
PWA instalável, experiência online para dados Supabase, tema automático com override claro/escuro, PT-BR, BRL, datas e máscaras brasileiras, responsividade, acessibilidade e reduced motion. Seed idempotente, sem dados pessoais reais. GitHub público e deploy Vercel após acesso autorizado. Testes E2E com papéis e casos de negação.
