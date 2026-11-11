# Organização do código

O projeto usa JavaScript puro no navegador e Node.js com Express no servidor. As classes agrupam os dados e as ações de cada parte do sistema. Não há herança nem uma camada de abstrações para consultas: os controladores e serviços usam SQL diretamente.

## Pastas

| Pasta | Responsabilidade |
| --- | --- |
| `client/js/` | Uma classe por tela e classes para API, tema, navegação, diálogos e ajuda. |
| `server/src/routes/` | Define os endereços da API e liga cada endereço ao método do controlador. |
| `server/src/controllers/` | Recebe a requisição, confere os dados, consulta o banco e envia a resposta. |
| `server/src/models/` | Regras de CNH, cadastro de veículo e capacidade do quarto. |
| `server/src/services/` | Configurações, cálculos dos relatórios, auditoria, notificações, Groq e Telegram. |
| `server/src/regras/` | Funções de data compartilhadas. |
| `server/src/db/` | Conexão, tabelas e comandos para criar e preencher o banco. |
| `server/test/` | Testes das regras e dos fluxos da API. |

## Exemplo: cadastro de veículo

1. `TelaFrota.salvarVeiculo()` lê o formulário e chama a API.
2. A rota `POST /api/frota` chama `ControladorFrota.cadastrar()`.
3. O controlador cria um `Veiculo` com os dados recebidos.
4. `veiculo.validar()` devolve uma mensagem de erro ou `null` quando os dados estão corretos.
5. O controlador salva o veículo, registra a auditoria e responde à tela.

```js
const veiculo = new Veiculo(req.body);
const erro = veiculo.validar();

if (erro) {
  return res.status(400).json({ erro: erro });
}
```

## Classes das telas

O `constructor` guarda os elementos e o estado da tela. `configurarEventos()` liga os botões e formulários aos métodos. As ações maiores, como salvar um cadastro, ficam em métodos próprios.

Ao passar um método para um evento, `bind(this)` mantém o acesso aos dados da instância:

```js
this.form.addEventListener('submit', this.entrar.bind(this));
```

`Api` centraliza as requisições. A função `chamarApi()` encaminha as chamadas para essa instância. Os eventos de início e fim permitem bloquear o formulário enquanto a requisição está em andamento.

A página de apresentação mantém seus arquivos próprios.

## Comentários

Os nomes explicam as ações comuns. Os comentários explicam regras menos evidentes, como a área mínima dos beliches, a comparação de datas locais, a prevenção de avisos repetidos e a cadeia de hashes da auditoria.

## Testes

Na pasta `server`, execute:

```bash
npm test
```

Os testes cobrem CNH, área e capacidade dos quartos, placas, quilometragem, permissões, cadastros, estadias, saídas e retornos, manutenção, relatórios e integridade da auditoria. Usam um banco temporário. As chamadas à Groq são simuladas, sem depender de chave ou de acesso à internet.
