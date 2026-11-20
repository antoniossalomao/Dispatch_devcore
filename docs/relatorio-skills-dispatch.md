# Revisão do Dispatch com sete skills

Revisão de 18/11/2026 sobre `688ea6d`, após `git pull --ff-only origin main`. Alvo: aplicativo operacional em HTML, CSS e JavaScript, login e cadastro.

## Direção visual

- **Produto:** acompanhar pessoas, alojamentos e frota de uma construtora.
- **Caráter:** preciso, sóbrio e prático.
- **Universo:** registros de campo e disponibilidade de recursos nas obras.
- **Momentos:** movimentações reais da API e disponibilidade de leitos por unidade.
- **Assinatura:** duplo chevron da marca Dispatch.

A base já apresentava identidade consistente. A revisão preserva IBM Plex Sans/Mono, superfícies grafite, temas claro/escuro e densidade compacta no desktop. O acento existente sinaliza a marca e situações de atenção. No celular, os indicadores passam a duas colunas entre 360 e 560 px, mantendo a ordem de leitura e os alvos de toque.

## Skills aplicadas

As fontes completas estão em `.design-skills/`; as instruções estão disponíveis em `.agents/skills/`. Os commits estão fixados em [design-skills.lock.json](design-skills.lock.json).

| Skill | Aplicação |
|---|---|
| [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Revisão visual a partir da operação da construtora; hierarquia e textos específicos; destaque para os registros e leitos, preservando a identidade |
| [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Regras atuais baixadas de `web-interface-guidelines/main/command.md`; rótulos, nomes de campos, semântica, foco, toque, overscroll, tema e datas |
| [Vercel Composition Patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | Princípios aplicáveis ao JavaScript puro: controle de janelas compartilhado, sessão fornecida pelo contexto da visita e separação entre roteamento e renderização. As APIs específicas de React não se aplicam a esta stack |
| [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | Busca local executada; recomendações pertinentes de foco e toque aplicadas. O sistema visual existente prevalece sobre sugestões genéricas de landing page e fontes que não se ajustavam ao aplicativo |
| [Bencium UX Designer](https://github.com/bencium/bencium-claude-code-design-skill) | Revisão de clareza, hierarquia, consistência, formulários e feedback, dentro da autorização para aprimorar o Dispatch |
| [AccessLint](https://github.com/accesslint/claude-marketplace) | Varredura do DOM real com `@accesslint/core` 0.21.0, correções e verificação automatizada. Fluxos de teclado verificados separadamente com Playwright |
| [Unslop](https://github.com/heydamir/unslop) | Polimento em nove passes; mantidas a identidade e as seções existentes, com correções de legibilidade e detalhes |

Unslop foi criado por **Damir Sokolovsky ([@heydamir](https://x.com/heydamir))**, sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Correções implementadas

| Local | Problema confirmado | Comportamento resultante |
|---|---|---|
| Login e cadastro | Ausência de landmark principal | Conteúdo dentro de `main`; nomes de campos e preenchimento automático preservados |
| Filtros | Três seletores sem nome acessível | Rótulos específicos para colaboradores, alojamentos e veículos |
| Configurações | `role="tabpanel"` aplicado sobre um `form` | Painel e formulário separados; abas por teclado e proteção de alterações mantidas |
| Ajuda | Conteúdo fora dos landmarks e fechamento sem devolver foco | Região complementar nomeada, histórico anunciado, estado expandido e Escape com retorno do foco |
| Busca global | Campo identificado apenas pelo placeholder; gatilho escondido no celular | Nome acessível, botão de fechar, acesso por toque e teclado e feedback de carregamento/falha |
| Busca global | Resultado de uma abertura anterior podia afetar uma nova abertura | Cada abertura descarta respostas de pedidos anteriores |
| Janelas | Fundo continuava interativo; foco podia escapar ou voltar para um campo já oculto | Uma pilha compartilhada controla foco, `inert`, rolagem, diálogos aninhados e restauração do fundo |
| Resumo | Falha HTTP deixava mensagens de carregamento permanentes | Estado de falha persistente e ação de tentar novamente; números aguardam os dados da API |
| Resumo | Barras de ocupação sem valor programático e pouca indicação de vagas | Progresso nomeado, ocupados/total, vagas por unidade e indicação textual de lotação |
| Resumo | Busca sem contagem de resultados ou caminhos próximos para as listas | Contagem anunciada e links para movimentações e alojamentos |
| Navegação | Pedidos simultâneos podiam atualizar histórico/URL depois de uma navegação mais recente | URL, título, foco e conteúdo respeitam o último pedido, inclusive ao voltar para a tela atual |
| Colaboradores | Busca disparava por tecla e respostas antigas podiam substituir o filtro atual | Espera de 200 ms, descarte de respostas antigas e limpeza do timer ao sair da tela |
| Sessão | Composição dos módulos e da busca precisava compartilhar o perfil sem manter dados indefinidamente | Uma resposta por visita; nova visita renova o perfil e a busca respeita o acesso de administrador |
| Camadas compartilhadas | Observadores permaneciam ligados aos elementos de telas removidas | Observadores de janelas, filtros, abas e tabelas são desconectados na troca de tela |

### Nove passes do Unslop

1. **Espaçamento:** agrupamento da busca, rodapés e disponibilidade de leitos na escala existente; resumo móvel com dois indicadores por linha.
2. **Cor:** paleta operacional preservada e browser chrome acompanhando o tema; estados de atenção mantêm texto além da cor.
3. **Ícones:** SVGs decorativos ocultos de tecnologias assistivas; busca e ajuda têm nomes acessíveis.
4. **Texto:** estados de erro com próximo passo, resultados contados e mensagens de carregamento explícitas.
5. **Tipografia:** fonte operacional também no login; textos de apoio revistos e campos móveis a 16 px nos componentes compartilhados.
6. **Layout:** mesmas seções e ordem; busca global acessível no celular; tabelas com rolagem local e cabeçalhos identificados.
7. **Detalhes:** foco, Escape, retorno do foco, bloqueio do fundo, alvos de toque e ocupação programática.
8. **Visual:** os dados reais da API são o destaque; sem imagens geradas para as telas de operação.
9. **Movimento:** removida a entrada por opacidade do conteúdo e do login, evitando contraste transitório; preferência de movimento reduzido preservada.

## Verificação

- `npm test`: **28 testes aprovados**.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: suíte com banco temporário, seed fictício e servidor isolado.
- AccessLint: **31 estados sem violações automatizadas** — sete telas × dois temas × duas larguras (1440 e 390 px), mais login, cadastro e busca global.
- Sem transbordamento horizontal nas páginas verificadas; um `h1` por tela e uma indicação de página atual.
- Fluxos: validação do login, seleção de comando por teclado/toque, foco em janelas aninhadas, cancelamento de descarte, falha HTTP 503 e recuperação, filtro vazio e limpeza, navegação rápida, Escape na ajuda, abas de Configurações e proteção de alterações, respostas de busca fora de ordem.
- Sem erros de JavaScript nos fluxos concluídos.
- Instalador de skills executado duas vezes; a segunda execução preservou a instalação existente.
- `git diff --check`: aprovado.

A varredura automática e os testes de teclado não representam uma certificação WCAG. Uso com leitor de tela real (NVDA/Firefox e VoiceOver/Safari), zoom de 400% e avaliação humana de leitura e compreensão continuam fora desta amostra. OAuth do Google, Groq, Telegram e produção não foram acionados nesta revisão.

## Evidências

- [Resumo antes da revisão](qa/skills-2026-11-18/resumo-antes.png)
- [Resumo depois, desktop escuro](qa/skills-2026-11-18/resumo-desktop.png)
- [Resumo depois, desktop claro](qa/skills-2026-11-18/resumo-claro.png)
- [Resumo depois, celular](qa/skills-2026-11-18/resumo-celular.png)
- [Resultado automatizado](qa/skills-2026-11-18/resultado.json)

## Reproduzir

Na raiz do repositório:

```bash
node scripts/instalar-skills.cjs
```

O instalador baixa os commits fixados, cria os atalhos locais, preserva destinos existentes e não executa código das fontes. Para reaproveitar clones na versão exata do lock, passe o diretório como argumento. As fontes e os atalhos são ignorados pelo Git; o lock e o instalador ficam versionados.

Para os testes da interface:

```bash
cd server
npm ci
npx playwright install chromium
npm run test:ui
```

Com Chromium já instalado, use `CHROMIUM_PATH=/caminho/do/chromium npm run test:ui`. Cada execução gera capturas e JSON em `server/test-ui/artifacts/` e remove seu banco temporário ao terminar.
