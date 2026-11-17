# Relatório — 7 skills de design/UX/a11y contra o Dispatch

Data: 2026-11-17 · Alvo: `client/` (HTML/CSS/JS puro, 8 telas + login/cadastro/apresentação) · commit base `c91a28b`.
Método: skills clonadas, app rodando local (Node 22, seed de demonstração), Chromium headless em 1440 e 390 px, tema escuro (padrão). `npm test` do servidor: 26/26 passando.

## Resumo executivo

Nenhuma falha crítica de produto. Base sólida: sem `user-scalable=no`, sem `transition: all`, sem bloqueio de paste, sem `div onclick`, `lang="pt-BR"`, skip link, `:focus-visible` global, `prefers-reduced-motion` tratado, sem overflow horizontal em nenhuma tela (1440/390), nenhum botão sem nome, 1 `h1` por tela.

Problemas reais, em ordem de prioridade:

| # | Sev. | Achado | Skill |
|---|---|---|---|
| 1 | Crítico (a11y) | 3 `<select>` de filtro sem rótulo acessível (WCAG 1.3.1/4.1.2) | AccessLint, Vercel |
| 2 | Moderado | `login.html` e `cadastro.html` sem landmark `<main>` | AccessLint |
| 3 | Moderado | Chat de ajuda (`.chat-caixa`, criado em `js/extras.js:190`) fora de qualquer landmark, em todas as telas | AccessLint |
| 4 | Menor | `<form role="tabpanel">` não permitido (`js/usabilidade.js:301` aplica o role em qualquer elemento; afeta `#painel-regras` em Configurações) | AccessLint |
| 5 | Alto | Alvos de toque < 44 px: 25 em Colaboradores e 11 em Configurações no celular; menu lateral com itens de 32 px no desktop | UI/UX Pro Max |
| 6 | Médio | Texto < 12 px (10–11 px): atalho "Ctrl K", iniciais do avatar, contador do sino | UI/UX Pro Max, Vercel |
| 7 | Médio | Contraste transitório durante carga (3,43:1 e 2,42:1 no texto secundário/"Carregando...") | AccessLint |
| 8 | Baixo | Datas formatadas à mão em `js/colaboradores.js:504` e `:524` (`split('-').reverse()`), em vez de `Intl.DateTimeFormat` | Vercel |
| 9 | Baixo | Tipografia: `...` em vez de `…` (5 ocorrências em `telas/configuracoes.html:96,103,110,117,492`); placeholders "Ex: …" sem reticências | Vercel |
| 10 | Baixo | Falta `touch-action: manipulation`, `overscroll-behavior: contain` em modais/gavetas, `translate="no"` em marca/placas/IDs | Vercel |
| 11 | Baixo | `outline: none` em 7 pontos: 5 têm substituto (anel via `box-shadow`/`focus-within`); conferir `css/app.css:99` (`.cmdk-input:focus`) e `css/configuracoes.css:134` | Vercel |

## 1. AccessLint (WCAG 2.2 AA, engine 0.21.0, 94 regras)

Escopo: 9 páginas (login, cadastro, resumo, colaboradores, alojamentos, frota, movimentações, relatórios, configurações). Escaneadas duas vezes: no carregamento e depois de a tela terminar de renderizar (`--wait-for`).

Resultado estável (após renderizar):

- ● `labels-and-names/form-label` — `select#seletor-status` em `telas/alojamentos.html:48` e `telas/frota.html:37`; `select#seletor-status-ativo` em `telas/colaboradores.html:79`. Correção: `aria-label="Filtrar por situação"` (ou `<label>` visível).
- ● `landmarks/landmark-main` — `login.html` e `cadastro.html` (`<body>` sem `<main>`).
- ● `landmarks/region` — chat de ajuda fora de landmark, todas as telas. Correção: `role="complementary"` + `aria-label="Ajuda do Dispatch"` no `.chat-caixa`.
- ● `aria/aria-allowed-role` — `form#painel-regras[role=tabpanel]`. Correção: envolver o form num `div role="tabpanel"`.

Só no carregamento (desaparecem depois): 12–46 falhas de `color-contrast` por tela (texto secundário `--op-secundario #a8afb8` medido a 3,43:1 e "Carregando..." a 2,42:1) e `th-has-data-cells` nas tabelas ainda vazias. Computado depois: `#a8afb8` sobre `#191c20` ≈ 7,6:1, passa. Causa provável: transição de cor/opacidade na entrada da tela (`tema.css:745`), então o leitor de tela e o scan automático pegam o estado intermediário. Sugestão: não animar `color` na entrada, e manter `aria-busy` até o conteúdo estar pronto.

Não verificado nesta rodada (precisa de sessão deslogada): contraste de `/login` e `/cadastro` (o scan inicial acusou 2,33:1 no `h1` "Dispatch" e nos ícones do cadastro, mas foi capturado em carga, então precisa ser confirmado). Camada manual (teclado, leitor de tela, zoom 400%, WCAG-EM completo) fica como pendência humana (○).

## 2. Vercel Web Interface Guidelines

Aplicadas as regras da versão atual do `command.md` (acessibilidade, foco, formulários, animação, tipografia, imagens, navegação, toque, tema, i18n). Passa: sem `transition: all`, sem `user-scalable=no`, sem `onPaste` bloqueado, sem imagem sem `alt`, `color-scheme` e `theme-color` definidos, `tabular-nums` nos números principais, `text-wrap: balance` na apresentação, ações destrutivas via modal próprio (`ui.js`, substitui `confirm()`).

Falhas:

- Rótulos de formulário: ver item 1 (AccessLint).
- `client/index.html:64,65,90,97` — `<img>` sem `width`/`height` (CLS); as 3 primeiras são decorativas (`alt=""`, corretas).
- Formulários sem `autocomplete`/`name`/`inputmode`: `telas/frota.html:76,80,86,102,150,154,185,218,223` e `telas/configuracoes.html:133,138`. Placa: `spellcheck="false"` + `autocomplete="off"`.
- `telas/configuracoes.html:96,103,110,117,492` — `...` → `…`.
- Datas manuais: `js/colaboradores.js:504,524`.
- Sem `touch-action: manipulation` e sem `overscroll-behavior: contain` nos modais/gavetas.
- Sem `translate="no"` em marca "Dispatch", placas, IDs de leito.
- Reduced motion: guardas globais em `base.css:455` e `tema.css:745`; os arquivos por tela dependem delas (ok), mas `login.css` e `app.css` só animam sob `no-preference` (bom).

## 3. Vercel Composition Patterns

Skill é para React; o Dispatch é JS puro com classes por tela, então as regras de props booleanas/Context/`forwardRef` não se aplicam literalmente. Transposição para classes:

- Classes de tela grandes: `configuracoes.js` 814 linhas, `colaboradores.js` 635, `frota.js` 630, `alojamentos.js` 621; cada uma monta modal, gaveta, tabela e filtros dentro da mesma classe (equivalente a "boolean prop proliferation").
- Padrão repetido por tela (cartão KPI, tabela com estado vazio, gaveta de cadastro, seletor de filtro): extrair componentes pequenos em `js/ui.js` (ou `js/componentes/`) com variantes explícitas em vez de flags.
- CSS: 18 arquivos / 6,0 mil linhas, `densidade.css`, `leve.css`, `usabilidade.css`, `extras.css` e `paleta.css` sobrepõem a base; 4 `!important`. Consolidar tokens em um único lugar (`tema.css`/`paleta.css`).

## 4. UI/UX Pro Max (checklist por prioridade)

1. Acessibilidade: contraste ok depois da carga; foco visível; itens 1–4 acima.
2. Toque (CRÍTICO na skill): 44×44 px. Medido: desktop 13–102 alvos menores por tela (menu lateral 207×32, ações de linha de tabela); celular: Colaboradores 25, Configurações 11, demais 0–1. `docs/unslop-dispatch.md` registra alvos de 44 px no celular nos controles principais; confirmado em 5 das 7 telas.
3. Performance: imagens da apresentação com `loading="lazy"` e `decoding="async"` (bom); falta dimensão.
4. Estilo: coerente (grafite, ícones lineares únicos, sem emoji nas telas operacionais).
5. Layout: sem overflow horizontal em 14 combinações tela × viewport.
6. Tipografia: texto < 12 px: "Ctrl K" 10 px (`app.css:49`), avatar/contador 11 px (`base.css:401`, `densidade.css:44,99`, `configuracoes.css:233`).
7. Animação: sem animação de largura/altura (corrigido no unslop anterior).
8. Formulários: rótulos visíveis na maioria; placeholders só como exemplo; erros inline.
9. Navegação: deep links por rota (`/frota` etc.), paleta Ctrl+K.
10. Dados: barras de ocupação dependem de cor (ouro vs. cinza) além do texto "6/8 leitos" (ok, texto presente).

## 5. Bencium UX Designer (design-audit, modo auditoria sem implementar)

Fase 1 — Crítico: rótulos dos `select` (item 1); alvos de toque no celular em Colaboradores/Configurações.
Fase 2 — Refinamento: raios de borda com 7 valores (2/3/6/8/10/12/16 px, mais 999 px) e 43 sombras decorativas além dos anéis de foco; texto de 10–11 px; tamanho do menu lateral (32 px de altura).
Fase 3 — Polish: estados de carregamento ("Carregando..." deve virar esqueleto ou `…`), estado vazio com próxima ação, atalho do sino com contador legível, landmark do chat.
Redução: o painel "Ocupação por unidade" no resumo deixa a coluna direita vazia abaixo (a tela tem muito espaço morto abaixo das duas colunas, visível na captura 1440×900).

## 6. Anthropic Frontend Design

Direção declarada em `docs/unslop-dispatch.md` (preciso, sóbrio, grafite) segue coerente com o produto. Pontos contra as próprias regras da skill: rótulos em caixa alta (6 ocorrências fora da apresentação), tipografia sem hierarquia clara nos cartões de KPI (rótulo, número, legenda no mesmo peso visual), e três telas com cartões idênticos lado a lado (kit "SaaS card"). O ponto memorável do sistema é a marca (duplo chevron) e a tabela de movimentações; vale deixar só um destaque por tela.

## 7. Unslop

O Dispatch já passou por uma rodada (`docs/unslop-dispatch.md`, 9 passes). Resíduos encontrados: 1 gradiente fora da apresentação, 2 textos com " — ", 3 setas "→", 6 `text-transform: uppercase`, apresentação (`apresentacao.css`) mantém grade/degradê de marca (aceito, documentado). Nenhum emoji nas telas operacionais.

## Ordem sugerida de correção

1. `aria-label` nos 3 `select` + `<main>` no login/cadastro + landmark do chat + wrapper do tabpanel (30 min, fecha todos os achados verificados do AccessLint).
2. Alvos 44 px nas linhas de Colaboradores e Configurações no celular; `min-height` no menu lateral.
3. Remover animação de cor na entrada e `aria-busy` correto (some o falso positivo de contraste).
4. `Intl.DateTimeFormat`, `…`, `autocomplete`/`inputmode`, `translate="no"`, `touch-action`, `overscroll-behavior`.
5. Dimensões das imagens da apresentação; extrair componentes repetidos das classes de tela.

## Limitações

Conformidade WCAG completa exige teste humano com leitor de tela e teclado (○). Contraste de login/cadastro e tema claro não foram reverificados após a carga. As skills de React (Composition Patterns) foram aplicadas só por analogia.
