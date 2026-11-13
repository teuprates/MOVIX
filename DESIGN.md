# Design e experiência MOVIX

## Identidade
Marca MOVIX; slogan **Sua frota sempre conectada**. Referência visual fornecida pelo usuário: `assets/movix-referencia.png` (se incluída). Paleta predominante preto, azul muito escuro, azul elétrico e ciano, visual tecnológico sofisticado. Extrair/adaptar marca da imagem fornecida quando tecnicamente possível; não criar marca contraditória. Customização de logo e cores por locadora apenas em seu ambiente e PDFs.

## Landing page
Narrativa cinematográfica de scroll com hero forte, transições suaves, parallax, efeitos de profundidade, microinterações e reações ao ponteiro; GSAP/ScrollTrigger e Motion se adequados. Demonstrar valor do produto, três pilares proprietário/veículo/locatário, benefícios, funcionalidades e CTA. Incluir dashboard público interativo com dados sintéticos, gráficos, frota, alertas, mapa fictício e assistente demonstrativo. Não exigir login para explorar a demo pública.

## Dashboards
Proprietário: visão executiva + centro de operações, sidebar, KPIs, frota, financeiro, alertas, calendário e mapa simulado. Locatário: aparência de app mobile, bottom nav, veículos ativos, contratos, parcelas, vistorias, ocorrências e assistente; adaptação desktop. Admin: painel simples de métricas agregadas e suspensões.

## Qualidade visual e UX
Design system com tokens, estados loading/empty/error/success, skeletons, toasts, confirmações, foco visível, teclado, contraste, formulários acessíveis, modais consistentes. Tema conforme sistema com alternância manual; marketing pode usar tema escuro fixo. Responsivo de 320px a desktop. Reduzir/desativar animações com `prefers-reduced-motion`; otimizar performance, imagens e bundle. PWA manifest, ícones, instalação e caching responsável sem prometer offline completo.
