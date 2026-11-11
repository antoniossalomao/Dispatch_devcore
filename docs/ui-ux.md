# Princípios de UI/UX aplicados ao Dispatch

O visual aprovado foi mantido. Esta revisão concentra as mudanças no esforço para navegar, encontrar registros, preencher formulários e entender o estado do sistema. A apresentação e seus arquivos permanecem intactos.

| Princípio ou técnica | Aplicação no sistema | Resultado esperado |
|---|---|---|
| Lei de Fitts | Menu e limpeza de busca com alvos de 44 px no celular; ação de abrir o colaborador usa um botão nativo | Facilitar o acionamento por toque e teclado |
| Lei de Hick e divulgação progressiva | Navegação operacional recolhível no celular; página e perfil continuam visíveis | Reduzir as opções e a altura ocupada pela navegação no primeiro contato |
| Gestalt: proximidade e similaridade | Limpar fica dentro da própria busca; orientação de rolagem fica junto à tabela; controles seguem o mesmo padrão | Explicar a relação entre a ação e seu conteúdo |
| Padrões familiares de interação | Abas de relatórios, configurações e históricos aceitam setas, Home e End | Manter uma interação previsível entre seções |
| Nielsen: visibilidade do estado | Botão mostra envio em andamento; formulário expõe `aria-busy`; filtros e abas anunciam sua seleção; alterações não salvas são identificadas | Tornar o estado atual reconhecível |
| Nielsen: prevenção de erros | Reenvio bloqueado enquanto a mesma submissão está em andamento; restauração exige confirmação; saída avisa sobre parâmetros alterados | Evitar duplicações e perda acidental de configurações |
| Nielsen: reconhecer e recuperar erros | Login e cadastro anunciam erros e levam o foco ao campo que precisa de correção | Oferecer um próximo passo claro |
| Reconhecimento em vez de memorização | Limpeza de busca em um clique e indicação quando uma tabela tem mais colunas fora da área visível | Evidenciar ações e conteúdo disponíveis |
| Acessibilidade por teclado | Link para pular ao conteúdo, página atual identificada, nomes de colaboradores acionáveis, abas com semântica e tabelas roláveis focáveis | Permitir usar esses fluxos sem depender do mouse |

## Configurações e salvamento

Salvar parâmetros fica disponível quando há diferença em relação aos dados carregados. Reverter manualmente um campo ao valor original remove o aviso de alteração. Trocar entre seções mantém os valores em edição; sair da página com alterações dispara o aviso do navegador. Restaurar padrões abre um diálogo que explica a substituição antes de enviar a solicitação.

A camada compartilhada acompanha o início e o fim da requisição de cada submissão. Durante o envio, desativa os botões daquele formulário e impede uma segunda submissão. Ao terminar, restaura os controles e seus rótulos. Os fluxos e validações de negócio existentes continuam responsáveis pelo resultado da operação.

## Verificação

Verificado no Chromium: foco de erro no login e cadastro, busca e limpeza, estado dos filtros, abertura do histórico pelo teclado, abas com setas e End, envio único com resposta atrasada e recuperação após validação, link para pular ao conteúdo preservando a seção, alterações não salvas, cancelamento da restauração, menu móvel, alvos de 44 px e indicação de rolagem das tabelas.

As sete telas operacionais foram conferidas em 1440 e 390 px, sem erros de JavaScript, IDs duplicados ou transbordamento horizontal da página. As [capturas](prints/index.html) mostram a interface atualizada em desktop e celular.
