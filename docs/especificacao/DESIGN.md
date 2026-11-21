# Design e experiência MOVIX

## Identidade
Marca MOVIX; slogan **Sua frota sempre conectada**. Referência visual fornecida pelo usuário: `assets/movix-referencia.png` (se incluída). Paleta predominante preto, azul muito escuro, azul elétrico e ciano, visual tecnológico sofisticado. Extrair/adaptar marca da imagem fornecida quando tecnicamente possível; não criar marca contraditória. Customização de logo e cores por locadora apenas em seu ambiente e PDFs.

## Landing page
Narrativa cinematográfica de scroll com hero forte, transições suaves, parallax, efeitos de profundidade, microinterações e reações ao ponteiro; GSAP/ScrollTrigger e Motion se adequados. Demonstrar valor do produto, três pilares proprietário/veículo/locatário, benefícios, funcionalidades e CTA. Incluir dashboard público interativo com dados sintéticos, gráficos, frota, alertas, mapa fictício e assistente demonstrativo. Não exigir login para explorar a demo pública.

## Dashboards
Proprietário: visão executiva + centro de operações, sidebar, KPIs, frota, financeiro, alertas, calendário e mapa simulado. Locatário: aparência de app mobile, bottom nav, veículos ativos, contratos, parcelas, vistorias, ocorrências e assistente; adaptação desktop. Admin: painel simples de métricas agregadas e suspensões.

## Qualidade visual e UX
Design system com tokens, estados loading/empty/error/success, skeletons, toasts, confirmações, foco visível, teclado, contraste, formulários acessíveis, modais consistentes. Tema conforme sistema com alternância manual; marketing pode usar tema escuro fixo. Responsivo de 320px a desktop. Reduzir/desativar animações com `prefers-reduced-motion`; otimizar performance, imagens e bundle. PWA manifest, ícones, instalação e caching responsável sem prometer offline completo.

## Sistema visual dos painéis (v2 · 13/11/2026)
Aplicação dos princípios do Impeccable (modo **Operate**: precisão e contenção; a marca vive nos detalhes).

- **Casca com cor comprometida:** trilho lateral azul-noite (`--rail*`) em ambos os temas, com indicador azul-elétrico e
  detalhes em ciano. O conteúdo fica em superfícies neutras levemente frias; o azul-elétrico é reservado a ações primárias,
  seleção e estado ativo.
- **Tipografia:** Inter para toda a interface (rótulos, dados, tabelas, numerais tabulares); Sora apenas no título da página
  e nos números de destaque. Escala fixa em rem (12 · 13 · 14 · 16 · 20 · 24 · 30). Sem eyebrows/kickers acima de títulos,
  sem texto em gradiente, sem caixa-alta espaçada em cabeçalhos de seção.
- **Assinatura do proprietário — "pulso da frota":** barra segmentada em que cada veículo é um segmento colorido pelo status
  (disponível, reservado, alugado, manutenção, inativo), com contagens e legenda textual. Mostra a situação da locadora em
  um olhar.
- **Assinatura do locatário — cartão do veículo:** foto real do veículo quando existe; caso contrário, ilustração vetorial
  tingida pela cor cadastrada (nunca foto fictícia), com a linha do tempo da locação (retirada → devolução).
- **Cores de estado** (sucesso, atenção, perigo, informação) só onde carregam significado, sempre com texto ou ícone.
- **Movimento:** 150–220 ms, ease-out, apenas para estado (hover, foco, abertura de menus, progresso). Sem coreografia de
  carregamento; tudo desativado com `prefers-reduced-motion`.
- **Componentes:** um único vocabulário — botões, campos, badges, tabelas com cabeçalho ordenável e busca, painéis com
  cabeçalho e ação. Skeletons no formato do conteúdo, estados vazios que ensinam o próximo passo.
- **Header do proprietário:** busca/atalho (Ctrl K) para páginas, veículos e ações; menu "Novo"; notificações.
- **Locatário:** mobile-first, navegação inferior no celular e abas no topo a partir de `md`.
