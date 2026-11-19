# Dispatch

Gestão de pessoas, alojamentos e frota com rastreabilidade total.

Projeto acadêmico do Grupo DevCore. O problema foi proposto pela Eficaz Marketing (Marília/SP) como desafio de faculdade — o sistema não precisa refletir a operação real da empresa; o cenário de uso é definido pelo grupo.

Rastreia quem está onde, quem está usando o quê, e registra tudo para auditoria.

## Cenário

Construtora fictícia (Construtora Aguapeí) com obras no interior de SP, equipes alojadas em repúblicas mantidas pela empresa e uma frota compartilhada entre as obras. Dados de exemplo: 15 colaboradores, 3 alojamentos (23 leitos) e 6 veículos, com 6 meses de histórico simulado.

## O que o sistema faz

- Cadastra colaboradores, alojamentos (com quartos, leitos e responsável) e veículos (com licenciamento e seguro).
- Registra quem está em qual leito e por quanto tempo, respeitando a capacidade e a metragem mínima por cama (NR-24), e as ocorrências de cada alojamento.
- Registra quem usa qual veículo, quando, com quem e com que quilometragem — validando CNH (validade e categoria), documentação e continuidade do km entre usos — e as manutenções da frota.
- Responde "quem estava dirigindo o veículo X na data Y?", útil para indicar o condutor em caso de multa (evita a multa por Não Indicação do Condutor).
- Gera relatórios: ocupação por alojamento, uso por veículo (utilização, ociosidade, km), padrões de movimentação (com exportação CSV segura contra fórmulas) e gargalos.
- Mantém log de auditoria de toda alteração (quem, quando, antes/depois), com hash encadeado SHA-256 para detectar edição feita fora do sistema.
- IA via Groq: perguntas em linguagem natural sobre os dados, resumo dos relatórios, chat de suporte e redação das notificações.
- Notificações no sistema (CNH vencendo, km sem registro, veículo não devolvido...) e envio dos alertas críticos por Telegram.

## Protótipo e telas

Telas desenhadas no [Figma](https://www.figma.com/design/4ma1oH2S8GnmS6A7NNQTqk/Telas---Dispatch) e implementadas no navegador em `client/`:

- **Públicas:** Apresentação DevCore (`/`, arquivo `index.html`), Login (`/login`) e Cadastro por código de convite (`/cadastro`). Login com e-mail e senha ou com Google.
- **Operação:** Resumo Operacional (`/resumo`), Colaboradores, Alojamentos, Frota, Movimentações e Relatórios.
- **Administração:** Configurações, Usuários, Backup e Auditoria (`/configuracoes`; o endereço antigo `auditoria.html` redireciona para `/configuracoes#auditoria`).

As telas internas abrem dentro de uma página só (`client/app.html`): o menu e o topo ficam fixos e só o conteúdo troca, sem recarregar. Cada tela tem o seu HTML em `client/telas/` e a sua classe em `client/js/`. A paleta Ctrl+K busca telas, ações, pessoas e veículos.

## Stack

| Parte | Tecnologia |
|---|---|
| `client/` | HTML + CSS + JavaScript puro, organizado em classes (`class`) por tela; telas internas carregadas pelo `js/app/App.js` |
| `server/` | Node.js (22.13+) + Express 5, `express-session` (`SqliteSessionStore`), `bcryptjs`, `helmet` e `express-rate-limit` |
| Banco | SQLite com `node:sqlite` (nativo do Node.js), SQL puro (14 tabelas em `server/src/db/schema.sql`) |
| IA | Groq via `fetch`, usada só pelo servidor |
| Avisos | Telegram (Bot API), com modo console para desenvolvimento |

## Estrutura

```text
dispatch/
├── .github/workflows/  # build, testes e deploy automático na Azure Web App
├── client/             # front-end (HTML, CSS e classes JS por tela)
├── server/             # API Express (src/routes, controllers, models, services, middlewares, regras, db) e testes
└── docs/               # planejamento, estrutura do código, identidade visual e prints
```

## Como rodar

Precisa do **Node.js 22.13+** (ou 24+).

```bash
cd server
npm install
npm run criar-banco
npm run seed   # opcional: dados da Construtora Aguapeí (28 colaboradores, 4 alojamentos, 10 veículos e 6 meses de histórico)
# ou, para gerar um banco novo só para a apresentação:
# npm run banco:apresentacao   (cria server/data/apresentacao.db já populado)
npm start
```

Isso cria o banco em `server/data/dispatch.db` já com o usuário administrador inicial (login `admin`, senha `admin123`) e sobe o sistema (front + back) em `http://localhost:3001`. Para mudar o lugar do banco, copie `server/.env.example` para `server/.env` e preencha `DB_CAMINHO`.

### Configuração do ambiente (`server/.env`)

Copie `server/.env.example` para `server/.env`:

- `NODE_ENV`: defina `production` ao publicar na web (ativa cookies `Secure`, HSTS e CORS restrito à mesma origem).
- `DB_CAMINHO`: caminho do arquivo SQLite (vazio usa `server/data/dispatch.db`; na Azure recomenda-se `/home/data/dispatch.db`).
- `SESSION_SECRET`: segredo forte para assinar os cookies de sessão.
- `CADASTRO_CODIGO`: código de convite para liberar o auto-cadastro público em `cadastro.html` (vazio mantém fechado).
- `GROQ_API_KEY`: liga a IA (perguntas, resumo dos relatórios e chat de ajuda). Sem ela os recursos de IA avisam que estão desligados.
- `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`: enviam os alertas críticos pelo Telegram (crie o bot no @BotFather). Sem eles a mensagem só aparece no terminal. Depois, ative o envio em Configurações.

### Segurança aplicada

- Sessões salvas no SQLite (`SqliteSessionStore`) com cookie `HttpOnly` e `SameSite=Lax`, além de renovação de ID no login e ao trocar senha.
- Validação de usuário ativo e perfil no banco a cada requisição (`ControleAcesso`), derrubando sessões na hora quando uma conta é bloqueada ou muda de permissão.
- Cabeçalhos via `helmet` com CSP estrita (sem scripts ou estilos inline), trava contra CSRF conferindo `Origin`/`Referer`/`Sec-Fetch-Site`, `express-rate-limit` nas rotas e backup `.db` gerado com `VACUUM INTO` sem sessões ativas.

## Testes

```bash
cd server
npm test
```

Os testes (`server/test/`) usam um banco temporário e simulam as chamadas à Groq, cobrindo modelos, helper de API do navegador (`client/js/api.js`), permissões, segurança (CSRF, CSP, CORS em produção, rate limit, backup higienizado) e cadeia de hashes da auditoria.

Para verificar a interface no Chromium com Playwright e AccessLint:

```bash
cd server
npm ci
npx playwright install chromium
npm run test:ui
```

A suíte cria e remove um banco temporário com dados fictícios. Verifica as sete telas em dois temas e duas larguras, teclado, janelas, buscas, recuperação de falhas e navegação rápida. Relatório JSON e capturas ficam em `server/test-ui/artifacts/`. Para usar um Chromium já instalado, defina `CHROMIUM_PATH` com o caminho do executável.

As sete skills usadas na revisão podem ser instaladas localmente, a partir da raiz do repositório, com `node scripts/instalar-skills.cjs`. O instalador usa as versões fixadas em `docs/design-skills.lock.json`, preserva destinos existentes e não executa código das fontes baixadas. As instruções ficam em `.agents/skills/` e as fontes completas em `.design-skills/`, fora do versionamento.

## Documentação

- [docs/estrutura-codigo.md](docs/estrutura-codigo.md) — classes, responsabilidades, fluxo das telas e testes.
- [docs/planejamento.md](docs/planejamento.md) — problema, solução proposta, telas, regras de negócio, arquitetura, banco de dados, IA, Telegram, organização do repositório, divisão de trabalho, cronograma e roteiro da apresentação.
- [docs/identidade-visual.md](docs/identidade-visual.md) — paleta compartilhada, apresentação pública, tema escuro/claro e navegação.
- [docs/ui-ux.md](docs/ui-ux.md) — princípios de usabilidade, acessibilidade por teclado e comportamento no celular.
- [docs/unslop-dispatch.md](docs/unslop-dispatch.md) — revisão visual aplicada às telas operacionais.
- [docs/relatorio-skills-dispatch.md](docs/relatorio-skills-dispatch.md) — aplicação das sete skills, correções e evidências da revisão atual.

## Roadmap

1. ~~Pesquisa de referências e desenho das telas (Figma + protótipo navegável)~~
2. ~~Apresentação institucional e demonstração pública~~ (`client/index.html` pronta; faltando apenas a apresentação em sala).
3. ~~Base do `server` (banco, login, auditoria) e do `client` (layout, rotas).~~
4. ~~Cadastros (colaboradores, alojamentos/leitos, frota) com auditoria.~~
5. ~~Estadias e uso de veículo com as regras de validação (CNH, NR-24, km).~~
6. ~~Relatórios, consulta "quem estava dirigindo", movimentações e tela de auditoria.~~
7. ~~IA (Groq) e central de notificações.~~
8. ~~Integração com Telegram~~ (código pronto; falta testar o envio real com token).
9. ~~Padronização em POO, reforço de segurança e deploy contínuo na Azure Web App.~~
10. Ensaio da demonstração.

## Grupo DevCore

Bruno, Antonio, João, Henrique, Kelvin, Matheus, Vinicius

Problema proposto por: Eficaz Marketing (Marília/SP)
