# Dispatch

Gestão de pessoas, alojamentos e frota com rastreabilidade total.

Projeto acadêmico do Grupo DevCore. O problema foi proposto pela Eficaz Marketing (Marília/SP) como desafio de faculdade — o sistema não precisa refletir a operação real da empresa; o cenário de uso é definido pelo grupo.

Rastreia quem está onde, quem está usando o quê, e registra tudo para auditoria.

## Cenário

Construtora fictícia (Construtora Aguapeí) com obras no interior de SP, equipes alojadas em repúblicas mantidas pela empresa e uma frota compartilhada entre as obras. Dados de exemplo: ~15 colaboradores, 3 alojamentos (~22 leitos) e 6 veículos, com 6 meses de histórico simulado.

## O que o sistema faz

- Cadastra colaboradores, alojamentos (com quartos, leitos e responsável) e veículos (com licenciamento e seguro).
- Registra quem está em qual leito e por quanto tempo, respeitando a capacidade e a metragem mínima por cama (NR-24), e as ocorrências de cada alojamento.
- Registra quem usa qual veículo, quando, com quem e com que quilometragem — validando CNH (validade e categoria), documentação e continuidade do km entre usos — e as manutenções da frota.
- Responde "quem estava dirigindo o veículo X na data Y?", útil para indicar o condutor em caso de multa (evita a multa por Não Indicação do Condutor).
- Gera relatórios: ocupação por alojamento, uso por veículo (utilização, ociosidade, km), padrões de movimentação e gargalos.
- Mantém log de auditoria de toda alteração (quem, quando, antes/depois), com hash encadeado para detectar edição feita fora do sistema.
- IA via Groq: perguntas em linguagem natural sobre os dados, resumo dos relatórios, chat de suporte e redação das notificações.
- Notificações no sistema (CNH vencendo, km sem registro, veículo não devolvido...) e envio dos alertas críticos por WhatsApp.

## Protótipo

Telas desenhadas no [Figma](https://www.figma.com/design/4ma1oH2S8GnmS6A7NNQTqk/Telas---Dispatch) e um protótipo navegável (HTML) com dados fictícios e as regras de negócio já simuladas: https://claude.ai/artifact/MNFq4skaifZLm8sqmrGWuJ (link privado).

Telas: Login, Resumo Operacional, Colaboradores, Gestão de Alojamentos, Gestão de Frota, Relatórios e Auditoria (Log).

## Stack

| Parte | Tecnologia |
|---|---|
| `client/` | HTML + CSS + JavaScript puro (sem framework), Chart.js para gráficos |
| `server/` | Node.js + Express, Knex, JWT + bcrypt, zod |
| Banco | SQLite no desenvolvimento, pronto para migrar a PostgreSQL (decisão em aberto) |
| IA | Groq (`groq-sdk`), chave gratuita, usada só pelo server |
| Avisos | WhatsApp (provedor em aberto), com modo console para desenvolvimento |
| Testes | Vitest (server) |

## Estrutura

```
dispatch/
├── client/     # front-end (HTML, CSS e JavaScript puro)
├── server/     # back-end (API, regras de negócio, banco, IA, notificações)
└── docs/       # planejamento
```

## Como rodar

Por enquanto só existe a tela de login (`client/index.html`). Para ver, abra o arquivo com a extensão **Live Server** do VS Code. O client não precisa de `npm install`.

Quando o server existir, ele também vai entregar a pasta `client/`:

```bash
cd server && npm install && npm run migrate && npm run seed && npm run dev
# abrir http://localhost:3001
```

Copie `server/.env.example` para `server/.env` e preencha `GROQ_API_KEY` só se for testar a IA.

## Documentação

- [docs/planejamento.md](docs/planejamento.md) — problema, solução proposta, telas, regras de negócio, arquitetura, banco de dados, IA, WhatsApp, organização do repositório, divisão de trabalho, cronograma e roteiro da apresentação.

## Roadmap

1. ~~Pesquisa de referências e desenho das telas (Figma + protótipo navegável)~~
2. Apresentação: telas do Figma + solução proposta.
3. Base do `server` (banco, login, auditoria) e do `client` (layout, rotas).
4. Cadastros (colaboradores, alojamentos/leitos, frota) com auditoria.
5. Estadias e uso de veículo com as regras de validação (CNH, NR-24, km).
6. Relatórios, consulta "quem estava dirigindo" e tela de auditoria.
7. IA (Groq) e central de notificações.
8. Integração com WhatsApp e ensaio da demonstração.

## Grupo DevCore

Bruno, Antonio, João, Henrique, Kelvin, Matheus, Vinicius

Problema proposto por: Eficaz Marketing (Marília/SP)
