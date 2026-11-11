# Unslop no Dispatch

Aplicação da [skill Unslop](https://github.com/heydamir/unslop), criada por Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), sob licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Direção

- **Produto:** gestão de pessoas, alojamentos e frota em obras.
- **Caráter:** preciso, sóbrio e prático.
- **Universo:** registros de campo e acompanhamento operacional.
- **Momentos:** indicadores reais, movimentações e ocupação por unidade.
- **Assinatura:** o duplo chevron já presente na marca Dispatch, sem brilho.

A apresentação do DevCore permanece como referência da marca. Para o uso diário do sistema, a direção aprovada no pedido mais recente usa grafite e cinza nas superfícies, com verde apenas em estados positivos e ouro em pequenos detalhes. Nenhum recurso ou seção foi acrescentado ou removido.

## Auditoria e correções

| Local | Sinal encontrado | Ajuste |
|---|---|---|
| Menu lateral | Degradê verde e marca com sombra dourada | Fundo sólido neutro, marca plana |
| Login | Fundo radial, grade e iluminação decorativa | Duas superfícies neutras com borda discreta |
| Indicadores do resumo | Quatro barras e ícones repetidos competindo com os dados | Números, contexto e detalhes; barras mantidas no painel de ocupação |
| Indicadores de colaboradores | Ícones decorativos repetidos | Mesma apresentação numérica dos demais módulos |
| Resumo antes da resposta da API | Valores estáticos diferentes dos dados de demonstração | Travessão e indicação de carregamento |
| Menu e cartões | Espaçamentos de 18, 22 e 26 px | Ritmo de 4 px, menu de 256 px e cartões com 24 px |
| Títulos e métricas | Peso 700 na marca, tracking negativo em textos pequenos | Pesos de 400 a 600 e tracking normal |
| Menu | Rótulos em caixa alta | Operação, Sistema e Visão geral |
| Situação dos colaboradores | Emojis de casa e carro | Rótulos textuais com os dados existentes |
| Barras do resumo | Animação da largura | Atualização direta; movimento restante em opacidade e transform |
| Botões e foco | Sombra colorida e foco verde pouco visível no escuro | Ações claras, foco ouro no escuro e ocre no claro |
| Alertas | Grandes preenchimentos coloridos | Fundo neutro, título e borda lateral com a cor da severidade |
| Ajuda | Botão verde destacado e saudação com exclamação | Controle discreto e orientação sobre os assuntos atendidos |
| Celular | Controles pequenos e tabelas com colunas espremidas | Alvos de 44 px nos controles principais e rolagem local das tabelas |

## Nove passes

1. **Espaçamento:** menu, cabeçalho, indicadores, filtros e alertas seguem a mesma escala; conteúdo ocupa a largura disponível até 1600 px.
2. **Cor:** superfícies operacionais neutras nos dois temas. Tokens DevCore preservados para a apresentação e a marca; cores semânticas continuam distinguindo os estados.
3. **Ícones:** conjunto linear existente a 18 px e traço 1,5 nos controles compartilhados; removida a decoração dos indicadores e das alocações.
4. **Texto:** rótulos em caixa normal, busca mais curta com nome acessível, textos de acesso mais diretos e carregamento sem números fictícios.
5. **Tipografia:** números tabulares, métricas de 32 px, títulos e rótulos com pesos moderados. Identificadores continuam monoespaçados.
6. **Layout:** mesma ordem de seções, menu de 256 px, área principal fluida e adaptação dos controles para celular.
7. **Detalhes:** raios consistentes, bordas discretas, ações principais claras, estados de foco visíveis e alertas com cor concentrada na severidade.
8. **Visual:** os dados do produto são o destaque. Sem geração de imagens; as três capturas da apresentação foram renovadas a partir do aplicativo com dados fictícios.
9. **Movimento:** removida a animação de largura; transições compartilhadas com a mesma curva e preferência de movimento reduzido respeitada.

## Verificação

Verificação no Chromium com a API local e uma cópia temporária do banco de demonstração. Login, busca e filtros do resumo, alternância e persistência do tema, abertura do histórico e do cadastro de colaboradores e preferência de movimento reduzido foram conferidos. Os oito módulos foram abertos em 1440 e 390 px, sem erros de JavaScript nem transbordamento horizontal da página. As tabelas mantêm sua rolagem interna no celular.

Os arquivos HTML, CSS e JavaScript da apresentação e os SVGs da marca foram preservados. Somente as capturas do aplicativo exibidas na apresentação foram atualizadas.

## Organização da navegação

A pedido do usuário, Configurações foi para o rodapé do menu e Auditoria virou uma seção interna de Configurações. O perfil, a troca de tema e a saída foram para o cabeçalho. A lista de Atenção operacional saiu do resumo e passou para o sino compartilhado entre as telas, mantendo leitura individual, leitura em lote e indicação de pendências.

A Auditoria conserva a busca, os filtros de tabela e ação, os valores anteriores e posteriores e a verificação de integridade. O endereço antigo redireciona para a nova seção. As restrições de administrador permanecem no servidor.

Essa organização foi verificada nas sete telas operacionais em 1440, 1024 e 390 px: sem erros de JavaScript, IDs duplicados ou transbordamento da página. Também foram conferidos os filtros e a integridade da Auditoria, navegação por URL e histórico, leitura individual e em lote, estado vazio, falha de rede e recuperação das notificações, fechamento por Escape com retorno do foco, alternância persistente de tema, saída e restrições de operador. A verificação usou uma cópia temporária do banco de demonstração.

## Padrão aplicado às demais telas

O mesmo visual passou a cobrir login, cadastro, cartões de alojamento, mapa de leitos, frota, relatórios, todas as seções de Configurações, cadastros e históricos. A interface usa IBM Plex Sans, identificadores monoespaçados, superfícies neutras, bordas discretas e a escala de espaçamento compartilhada. Leitos ocupados e categorias selecionadas usam superfícies neutras; cores de atenção ficam nos estados que exigem atenção.

Modais mantêm o rodapé acessível enquanto o formulário rola. No celular, botões, campos e abas têm alvos de pelo menos 44 px. O foco por teclado é visível também nos seletores e nas chaves, e a preferência de movimento reduzido se aplica a modais e históricos.

A [galeria de prints](prints/index.html) contém 56 capturas da aplicação com dados fictícios: 39 de desktop e 17 de celular. Inclui telas principais, abas de relatórios e configurações, cadastros, históricos, notificações, ajuda e exemplos do tema claro. A verificação dessas capturas não encontrou erros de JavaScript nem transbordamento horizontal; o cadastro móvel foi conferido com o rodapé dentro da tela.

Nesta extensão, a página de apresentação, seu CSS, JavaScript, paleta compartilhada e todos os assets que ela usa permaneceram idênticos aos arquivos anteriores.
