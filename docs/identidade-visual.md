# Identidade visual DevCore

A apresentação pública está em `client/apresentacao.html`, acessível pelo link na tela de login. O site usa HTML, CSS e JavaScript sem dependências adicionais em produção.

## Paleta compartilhada

Os tokens estão em `client/css/paleta.css`, importados pelo sistema e pelo portfólio.

| Token | Cor | Uso |
|---|---|---|
| `--dc-noite` | `#0A0A09` | Fundo principal |
| `--dc-carvao` | `#1A1916` | Superfícies da apresentação |
| `--dc-floresta` | `#16281C` | Superfícies e profundidade |
| `--dc-musgo` | `#254226` | Variações de verde |
| `--dc-creme` | `#EDECE6` | Texto e botões de destaque |
| `--dc-ocre` | `#826426` | Acentos e indicadores |
| `--dc-ouro` | `#CFAD68` | Detalhes e foco visual |
| `--dc-taupe` | `#9D836A` | Acento secundário |
| `--dc-salvia` | `#B9B5AB` | Texto secundário |

O Dispatch inicia em tema escuro quando não existe preferência salva. A alternância claro/escuro continua disponível e preserva a escolha em `dispatch-tema`. Cores semânticas de erro e alertas críticos continuam distintas da identidade da marca.

### Superfícies operacionais

No sistema, a direção visual é mais sóbria: grafite e cinza nos fundos, cartões, campos, navegação e tabelas. O verde fica restrito a estados positivos; ouro e creme mantêm a ligação com a marca em detalhes e ações. A apresentação conserva sua paleta original.

Os tokens `--op-*`, no mesmo `paleta.css`, definem o tema escuro: fundo `#111315`, painel `#191C20`, superfície elevada `#24282D`, borda `#30353B`, texto `#ECEEF0` e texto secundário `#A8AFB8`. O tema claro usa fundo `#F4F5F6`, cartões brancos e texto `#202328`. Os nomes legados `--verde` e `--marinho` continuam disponíveis para os módulos, mas apontam para controles e superfícies neutros.

O refinamento de espaçamento, tipografia e componentes está documentado em [Unslop no Dispatch](unslop-dispatch.md).

## Logo vetorial

`client/assets/apresentacao/devcore.svg` contém a marca completa. `devcore-simbolo.svg` contém o recorte do símbolo. Ambos são SVGs com contornos vetoriais, sem bitmap embutido ou dependência de fonte. A origem é a logo original em `video/shots/devcore.jpg`; os contornos foram vetorizados e suavizados com Potrace. O download da marca completa está no rodapé do portfólio.

## Movimento e navegação

A predominância visual é de preto e carvão, com creme, ocre e taupe; o verde fica restrito a detalhes e estados semânticos.

O parallax acompanha a rolagem nativa sem capturar eventos de wheel ou touch. Em desktops com altura suficiente, a abertura fica presa durante parte do percurso: a logo muda de escala e perspectiva, os anéis giram em planos distintos e o texto passa para uma segunda composição. O mouse acrescenta profundidade, apenas com ponteiro preciso.

A cena do produto também fica presa: a interface começa inclinada e menor, ocupa progressivamente o quadro e os cartões decorativos se afastam. Manifesto e encerramento têm camadas independentes. O motor interpola as mudanças em `requestAnimationFrame` apenas até estabilizar, agrupando leituras antes de escritas. Em celular a abertura segue o fluxo normal e a cena do produto tem percurso e inclinação menores.

`prefers-reduced-motion: reduce` desativa os movimentos e a rolagem suave e remove os percursos extras, inclusive quando a preferência muda durante a navegação. Sem JavaScript, o conteúdo segue no fluxo normal. Não há rolagem artificial nem dependência de biblioteca de animação.

As abas do produto aceitam clique, setas, Home e End. Os detalhes de planos usam `dialog` nativo, com foco modal e fechamento por Escape, botão ou clique fora. FAQ usa `details` e `summary`, funcionando sem JavaScript.

## Navegação do sistema

Configurações fica no rodapé do menu lateral para administradores. A seção Auditoria está dentro de Configurações, com filtros do histórico e verificação de integridade; o endereço antigo `auditoria.html` redireciona para `configuracoes.html#auditoria`.

O perfil, a troca de tema e a saída ficam no cabeçalho de todas as telas operacionais. Os alertas de Atenção operacional ficam no sino ao lado do perfil, com contagem de pendências, leitura individual e leitura em lote. O resumo concentra os indicadores, as movimentações e a ocupação por unidade.

No celular, o menu operacional é recolhível para priorizar o conteúdo. As abas de relatórios, configurações e históricos aceitam teclado; buscas têm limpeza direta e tabelas indicam quando há mais colunas fora da área visível. Feedback de envio e proteção de alterações seguem os [princípios de UI/UX aplicados](ui-ux.md).

## Planos e conteúdo

Essencial, Profissional e Sob medida são propostas conceituais de escopo, explicitamente identificadas como tal. Não há preços, contratação, cobrança ou formulário de contato fictício. Os botões mostram o escopo e dão acesso à demonstração. Para uma oferta comercial, definir valores, disponibilidade e condições antes de atualizar o conteúdo.

As três capturas exibidas no portfólio foram atualizadas a partir do aplicativo com a nova paleta e dados fictícios. Se a interface mudar, renovar os PNGs em `client/assets/apresentacao/`.
