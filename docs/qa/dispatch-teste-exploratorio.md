# Teste exploratório completo: Dispatch

Objetivo: QA exploratório de todos os módulos do Dispatch (front `client/` + API `server/`). Agir como usuário real: navegar, clicar, digitar, filtrar, salvar, reabrir. O produto final é um relatório de tudo que NÃO funciona, parece errado ou confunde o usuário.

## Ambiente e regras

- Subir localmente: `cd server && npm install && npm run criar-banco && npm run seed && npm start` → `http://localhost:3001`.
- Usar só o banco local (`server/data/dispatch.db` ou um `DB_CAMINHO` de teste). Nunca apontar para banco ou conta reais.
- Login admin de desenvolvimento (`admin` / `admin123`) só no banco local. Trocar a senha no primeiro teste de "Minha conta" e registrar isso.
- Credenciais de Google, Groq e Telegram: não usar tokens reais. Testar com valores falsos e com campos vazios. Sem `GROQ_API_KEY` e sem `TELEGRAM_*`, registrar o comportamento de "desligado".
- Método de automação: computer use (controle de mouse, teclado e captura de tela no desktop, via app Claude com Computer use ligado). Usar o navegador já aberto na máquina; não usar Playwright nem outra automação de browser. Registrar o método no relatório.
- Print antes e depois de cada ação relevante em `relatorio/prints/NN-tela-acao.png`.
- Itens: OK / FALHOU / PARCIAL / NÃO APLICÁVEL. Só marcar OK com resultado visto na tela ou na resposta da API.
- Bug: parar, anotar passos exatos, esperado x obtido, print, log do servidor, e reproduzir uma segunda vez.
- Não pular itens. Se um bloquear outros, registrar e seguir.

## Checklist

### 0. Inventário
Percorrer e listar TODAS as telas, abas, menus, botões, ícones, atalhos, modais, gavetas, toasts e notificações. Este inventário vira a base dos itens abaixo.

### 1. Público: Apresentação, Login e Cadastro
- **Apresentação** (`/`): prévias das telas, links, responsividade, texto cortado.
- **Login** (`/login`): e-mail/senha válidos, inválidos, campos vazios, e-mail sem formato, senha errada repetida (rate limit), mensagem de erro clara, Enter envia, sessão expira e redireciona.
- **Login com Google**: botão visível, fluxo com credencial falsa/cancelado, erro tratado, nada quebra.
- **Cadastro** (`/cadastro`): sem código de convite (fechado), código errado, código correto; campos obrigatórios vazios, CPF/CNPJ inválido, telefone, senha fraca, e-mail duplicado, nome com acentos/emoji/texto longo.
- Sair (`/sair`) encerra a sessão e impede voltar com o botão "voltar" do navegador.

### 2. Shell do app (`app.html`)
- Menu lateral: todos os itens levam à tela certa; rodapé com Configurações; recolher/expandir no desktop e no celular.
- Topo: perfil, troca de tema, sair, sino de notificações.
- Roteamento: `/resumo`, `/colaboradores`, etc. abrem a tela certa; recarregar a página mantém a tela; botão voltar/avançar funciona.
- **Paleta Ctrl+K**: abre, busca telas, ações, pessoas e veículos; setas + Enter; Esc fecha; clique fora fecha; busca sem resultado; busca com acentos.
- **Tema claro/escuro**: alterna, persiste após recarregar (`dispatch-tema`), contraste em todas as telas nos dois temas.
- **Sino e notificações**: contador, lista, marcar uma como lida, marcar todas (`PUT /lidas`), status de lida persiste após recarregar.

### 3. Resumo (`/resumo`)
- Números gerais batem com as telas de origem (colaboradores, leitos, frota).
- Últimas movimentações: ordem, link para o item, vazio tratado.
- Ocupação por unidade: percentuais corretos, barra não estoura.
- Estado sem dados (banco vazio): mensagem, sem tela quebrada.

### 4. Colaboradores (`/colaboradores`)
- Lista: busca por nome, CPF, e-mail; filtros de CNH (válida, vencendo, vencida, sem CNH); ordenação; paginação ou rolagem; contagem.
- Cadastro: obrigatórios vazios, CPF inválido, CNH com categoria e validade, data no passado e futuro, nome com acentos/emoji/500+ caracteres, salvar e ver na lista.
- Edição: alterar campo, cancelar sem salvar descarta mudanças, salvar persiste.
- Inativar (não apagar): some da lista padrão, aparece com filtro de inativos, pode ser reativado. Confirmar que nada é apagado de verdade (U2).
- Gaveta de histórico: abre, fecha com Esc e com clique fora, mostra alojamentos e veículos usados.
- Regra F3/F4/F5 refletida no cadastro: CNH vencida ou categoria incompatível aparece como aviso no lugar certo.

### 5. Alojamentos (`/alojamentos`)
- Lista e ocupação: totais por alojamento e por leito conferem com o mapa.
- Cadastro de alojamento com responsável: responsável deve ser colaborador ativo (A6); tentar com inativo.
- Quartos e leitos: adicionar quarto, passar de 8 leitos (A4 bloqueia), área insuficiente para as camas (A5: 3 m² por cama, 4,5 m² por beliche), leitos ocupados.
- Mapa de leitos: alocar pessoa, liberar leito, mesmo leito no mesmo período (A1 bloqueia), mesma pessoa em dois leitos (A2 bloqueia), saída antes da entrada (A3 bloqueia).
- Ocorrências: abrir, listar, resolver; data de resolução antes da abertura (A7 bloqueia); status atualizado.
- Manutenções/ocorrências com texto longo e emoji.

### 6. Frota (`/frota`)
- Lista com status (disponível, em uso, manutenção) e busca.
- Cadastro de veículo: placa, licenciamento e seguro. Licenciamento vencido: não sai (F12). Seguro vencido: só aviso.
- Saída (uso): motorista sem CNH (F3), CNH vencida no dia da saída (F4), categoria incompatível: B não dirige D, C/D dirige B (F5). Motorista na lista de passageiros (F6). Passageiros acima dos lugares (F7).
- Km: saída menor que a última volta gera aviso (F10, não bloqueia); km da volta menor que o da saída (F9 bloqueia); uso acima de 2.000 km pede confirmação (F11).
- Mesmo carro em dois usos no mesmo horário (F1) e mesma pessoa em dois carros (F2) bloqueiam.
- Carro com manutenção aberta não sai (F13). Concluir manutenção libera o carro.
- Volta: registra, carro volta a disponível; volta antes da saída (F8 bloqueia).

### 7. Movimentações (`/movimentacoes`)
- Histórico unificado de alojamentos e frota: filtros por período, tipo e pessoa; ordenação.
- Exportação CSV: abre no Excel/LibreOffice, acentos corretos, células que começam com `=`, `+`, `-`, `@` não viram fórmula (exportação segura).
- Período sem resultados: mensagem clara.

### 8. Relatórios (`/relatorios`)
- Ocupação por alojamento, uso da frota (utilização, ociosidade, km), movimentação, gargalos: cada um abre, filtra por período e mostra dados coerentes com as telas de origem.
- Exportação CSV de cada relatório que tiver botão.
- **Quem estava dirigindo**: data/hora dentro de uma saída retorna o condutor; fora de qualquer uso sem km aumentado: sem resultado; km aumentado sem uso: aviso de uso sem registro. Testar data em branco e data futura.
- **IA nos relatórios**: resumo e perguntas em linguagem natural. Sem chave Groq: aviso de IA desligada. Com chave falsa: erro claro, app continua usável. Pergunta vazia, pergunta longa, pergunta com acentos.

### 9. Configurações e Auditoria (`/configuracoes`, `/configuracoes#auditoria`)
Testar cada aba e cada opção: alterar, salvar, sair sem salvar, reabrir, reiniciar o servidor e verificar.
- **Regras da empresa** (parâmetros via `PUT /parametros`): valores inválidos e limites; "Restaurar padrão" (`POST /restaurar-padrao`) reverte e pede confirmação.
- **Alertas e Telegram**: campos de chave/chat com valores falsos e vazios; "Testar alerta" (`POST /testar-alerta`) sem Telegram configurado mostra aviso e não quebra; ativar/desativar envio persiste.
- **Usuários** (`POST/PUT /usuarios`): criar com perfil; e-mail duplicado; perfil alterado (efeito imediato: sessão do usuário afetado perde permissão); inativar derruba sessão na hora; trocar senha de outro usuário; não permitir o próprio admin se desativar ou rebaixar, se for a regra.
- **Backup** (`GET /backup`): gera arquivo `.db`; abre o arquivo; sem sessões ativas no backup; nome do arquivo com data.
- **Auditoria**: lista de alterações com quem, quando, antes e depois (U1); filtros; **verificação da cadeia SHA-256** (`GET /verificar-log`, `GET /integridade`): íntegra; depois de alterar uma linha direto no SQLite (fora do sistema), a verificação deve apontar onde quebrou (U3). Fazer isso só no banco de teste e registrar.
- **Minha conta** (`PUT /minha-conta`, `PUT /minha-senha`): alterar nome/e-mail; senha atual errada; nova senha igual à antiga; confirmação divergente; após trocar a senha, a sessão atual é renovada e as outras caem.
- Restaurar padrões, idioma (se houver), valores com acentos e emoji.

### 10. Segurança e API (visível ao usuário)
- Sessão: cookie não acessível por JS; sem sessão, qualquer tela redireciona para login; sessão de conta desativada cai na hora.
- Rate limit: muitas tentativas de login seguidas recebem bloqueio com mensagem clara.
- CSRF: requisição de outra origem (ex.: `curl` com `Origin` falso) é recusada.
- Erros: respostas de API com mensagem em português, sem stack trace na tela.
- Console do navegador: sem erros de CSP (scripts/estilos inline bloqueados) em nenhuma tela.

### 11. Robustez e desempenho
- Cliques rápidos e duplo envio em salvar: não duplica registro.
- Abrir e fechar gavetas, modais e telas 20x sem vazamento visível (memória no DevTools, sem crescimento contínuo).
- Rede: derrubar a conexão (modo offline do Playwright) no meio de um salvar: mensagem de erro, dado não some da tela, sem salvar parcial.
- Dois navegadores/abas editando o mesmo colaborador: o último salvar vence sem perder o registro, ou o conflito é avisado.
- Banco com ~1 ano de histórico (seed longo): listas e relatórios carregam em tempo razoável.

### 12. Teclado, acessibilidade e responsividade
- Tudo navegável com Tab/Shift+Tab/Enter/Espaço/setas/Esc. Foco visível, ordem lógica, nenhum elemento inalcançável, modais prendem o foco.
- Contraste de texto e de estados (hover, desabilitado) nos dois temas.
- Ícones sem rótulo acessível, textos pequenos.
- Celular (375 px e 768 px): sem rolagem horizontal, menu recolhível, tabelas com alternativa legível, botões com alvo de toque adequado.
- Escala de texto do navegador a 125% e 150%: sem corte nem sobreposição.

### 13. Persistência e consistência entre módulos
- Cadastrar colaborador → alocar em leito → usar veículo → ver no Resumo, Movimentações, Relatórios e Auditoria: os números e registros batem.
- Reiniciar o servidor: todos os dados, configurações, notificações lidas e sessões (conforme a regra) persistem.
- Backup restaurado em outra cópia do app: abre e mostra os mesmos dados.

## Relatório final

Salvar em `relatorio/RELATORIO.md`:

1. Resumo: total de itens; contagem de OK / FALHOU / PARCIAL / NÃO APLICÁVEL / NÃO TESTADO (com motivo).
2. Ambiente: sistema operacional, versão do Node, navegador e versão, commit testado, método de automação.
3. Inventário completo de telas e controles (seção 0).
4. Bugs ordenados por gravidade (CRÍTICO / ALTO / MÉDIO / BAIXO). Cada um com: título, módulo, passos para reproduzir, esperado, obtido, print, frequência (sempre/às vezes), trecho de log, e regra associada (A1–A7, F1–F13, U1–U3) se houver.
   - CRÍTICO: qualquer regra de bloqueio que deixe salvar o que deveria bloquear; vazamento de dados entre sessões; permissão burlada; auditoria que não detecta alteração.
5. Pontos de melhoria de UX que não são bugs.
6. O que NÃO foi possível testar e por quê (ex.: Google, Telegram e Groq reais sem credenciais).

Ser honesto: nada é "funcionando" sem ter sido visto.
