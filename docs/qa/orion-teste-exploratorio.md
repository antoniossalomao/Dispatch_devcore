# Teste exploratório: app Orion (Windows, Vulkan)

Objetivo: teste de QA exploratório completo do app Orion (Windows, variante Vulkan) em `C:\orion-test\variante-vulkan\orion.exe`. Agir como usuário real: abrir, clicar, digitar, navegar. O produto final é um relatório de tudo que NÃO funciona ou parece estranho.

## Regras de segurança

- Trabalhar só dentro de `C:\orion-test`. Não apagar, mover nem editar nada fora dela.
- Não usar credenciais, chaves de API, tokens ou contas reais. Se pedirem, testar com valores falsos e com o campo vazio.
- Aprovar ações destrutivas do agente somente dentro de `C:\orion-test\sandbox`.
- Se precisar de vault, criar um vazio em `C:\orion-test\sandbox\vault-teste`.
- Não instalar nem alterar nada no sistema. Se algo exigir isso, anotar no relatório e seguir.

## Preparação

1. Criar `C:\orion-test\relatorio\` e `C:\orion-test\relatorio\prints\`.
2. Confirmar controle de mouse/teclado e captura de tela (computer-use). Se não houver, usar Python com pyautogui + pillow num venv em `C:\orion-test\qa-venv`. Registrar o método usado.
3. Antes de abrir o app, anotar versão do Windows, GPU e driver (`dxdiag` ou `Get-CimInstance Win32_VideoController`).
4. Abrir `orion.exe` e tirar print. Se não abrir ou fechar sozinho, rodar pelo terminal, capturar stdout/stderr e registrar como bug crítico.

## Método

- Print ANTES e DEPOIS de cada ação relevante, nomeado `NN-tela-acao.png`.
- Marcar cada item como OK / FALHOU / PARCIAL / NÃO APLICÁVEL.
- Ao achar bug: parar, anotar passos exatos, esperado x obtido, print, e reproduzir uma segunda vez.
- Não pular itens. Se um bloquear outros, registrar e seguir.
- Marcar OK só com resultado visto na tela. Nada de suposições.

## Checklist

**0. Inventário.** Listar TODAS as telas, abas, menus, botões, ícones, atalhos, overlays e janelas (mini barra, bandeja, notificações). Testar cada item do inventário.

**1. Inicialização e onboarding.** Primeira execução (limpar a pasta de dados só se estiver em `C:\orion-test`; senão registrar o caminho). Avançar, voltar, pular, cancelar, fechar no meio e reabrir. Campos obrigatórios vazios, valores inválidos, texto longo, caracteres especiais, emoji. Texto cortado, sobreposto, botão sem efeito, tela em branco, travamento. Tempo de abertura e flicker/artefatos na janela.

**2. Chat e entrada de texto.** Mensagem curta, longa (5.000+ caracteres), multilinha, emoji, acentos, RTL, URLs, código, markdown. Enter x Shift+Enter, colar texto/imagem, arrastar arquivo, desfazer/refazer, selecionar/copiar/recortar, Ctrl+A. Enviar vazio, duplo envio rápido, envio durante resposta, cancelar, regenerar. Rolagem, histórico longo, busca, copiar, editar, apagar. Estados de streaming/carregando. Erro de rede (desligar o Wi-Fi), timeout, API key inválida: a mensagem é clara e o app se recupera?

**3. Configurações.** Todas as abas e opções. Alterar, aplicar, fechar, reabrir, reiniciar o app e verificar persistência. Restaurar padrões. Valores inválidos. Campos de chave/token (falsos). Seletor de modelo/provedor. Idioma. Tema claro/escuro. Escala de fonte. Atalhos globais (configurar, testar e testar conflito). Toda alteração tem efeito visível imediato?

**4. Ferramentas do agente e aprovações** (sempre em `C:\orion-test\sandbox`). Ler arquivo, escrever, listar pasta, shell, rede/web, MCP, Telegram, vault. A janela de aprovação aparece? Testar aprovar, negar, aprovar sempre, cancelar e fechar sem responder. Tentar caminhos fora do sandbox (`..\`, absolutos, links simbólicos, UNC): o app deve BLOQUEAR ou pedir aprovação. Execução sem aviso = bug de segurança CRÍTICO. Shell com caracteres especiais, saída enorme, comando que não termina (o botão de parar funciona?). Vault: criar, editar, nome com caracteres inválidos, nome duplicado, pasta inexistente.

**5. Mini barra, overlays, bandeja e janelas.** Abrir/fechar/arrastar/redimensionar a mini barra; atalhos que a invocam; multi-monitor; sempre no topo; foco; digitar direto nela. Esc, clique fora, sobreposição, vários overlays. Bandeja: menu, clique, sair. Minimizar, maximizar, restaurar, fechar (vai para a bandeja ou encerra?), reabrir. Redimensionar até o mínimo e o máximo, tela cheia, mover entre monitores, escala do Windows 100%/125%/150% (cortes e borrões).

**6. Teclado e acessibilidade.** Tudo navegável só com Tab/Shift+Tab/Enter/Espaço/setas/Esc. Foco visível, ordem lógica, nenhum elemento inalcançável. Contraste, texto pequeno, ícones sem rótulo, estados hover/pressed/disabled.

**7. Robustez e desempenho.** Cliques rápidos, spam de atalhos, abrir/fechar telas 20x em loop. Ocioso por 10 min: CPU, GPU, RAM (`Get-Process`) e crescimento de memória. Matar o processo no meio de uma ação e reabrir: perda de dados ou estado corrompido? Duas instâncias ao mesmo tempo. Suspender/retomar, trocar de rede, bloquear a tela, se possível. Listar erros, panics e warnings dos logs.

**8. Variante Vulkan.** Falha sem suporte Vulkan, tela preta, artefatos, flicker, texto borrado, tearing, janela que não redesenha ao redimensionar, queda de FPS ao rolar/animar. Troca de monitor ou de GPU (integrada/dedicada), se houver.

**9. Persistência.** Fechar e reabrir mantém conversas, configurações, posição/tamanho da janela e estado do onboarding? Copiar a pasta para outro local e rodar: quebra por caminho fixo?

## Relatório final

Salvar em `C:\orion-test\relatorio\RELATORIO.md`:

1. Resumo: total testado; contagem de OK / FALHOU / PARCIAL / NÃO TESTADO (com motivo).
2. Ambiente: Windows, GPU, driver, versão do app, método de automação.
3. Inventário completo de telas e controles.
4. Bugs ordenados por gravidade (CRÍTICO / ALTO / MÉDIO / BAIXO). Cada um com: título, passos para reproduzir, esperado, obtido, print, frequência (sempre/às vezes) e trecho de log, se houver.
5. Pontos de melhoria de UX que não são bugs.
6. O que NÃO foi possível testar e por quê.

Ser honesto: nada é "funcionando" sem ter sido visto. Ao terminar, mostrar o resumo e o caminho do relatório.
