const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigo = fs.readFileSync(path.join(__dirname, '../../client/js/api.js'), 'utf8');

const cenarios = [
  [
    'Azure com HTTPS',
    'https://dispatch.azurewebsites.net/cadastro.html',
    'https://dispatch.azurewebsites.net'
  ],
  ['hospedagem com HTTP', 'http://dispatch.example/cadastro.html', 'http://dispatch.example'],
  ['servidor local', 'http://localhost:3001/cadastro.html', 'http://localhost:3001'],
  ['porta do Azure', 'http://localhost:8080/cadastro.html', 'http://localhost:8080'],
  ['Live Server', 'http://localhost:5500/cadastro.html', 'http://localhost:3001'],
  ['Live Server com IP', 'http://127.0.0.1:5501/cadastro.html', 'http://127.0.0.1:3001'],
  ['HTTPS em porta personalizada', 'https://localhost:5500/cadastro.html', 'https://localhost:5500']
];

for (const [nome, pagina, origemApi] of cenarios) {
  test('cadastro chama a API no endereço correto: ' + nome, async () => {
    let pedido;
    const eventos = [];
    const contexto = {
      window: { location: new URL(pagina) },
      document: { dispatchEvent: (evento) => eventos.push(evento.type) },
      CustomEvent: CustomEvent,
      fetch: async (endereco, opcoes) => {
        pedido = { endereco: new URL(endereco, pagina).href, opcoes: opcoes };
        return new Response(JSON.stringify({ mensagem: 'Conta criada' }), { status: 201 });
      }
    };

    const resultado = await vm.runInNewContext(
      codigo +
        `
      chamarApi('/api/auth/cadastro', {
        metodo: 'POST',
        corpo: { nome: 'Teste', usuario: 'teste', senha: 'teste123' }
      });
    `,
      contexto
    );

    assert.equal(pedido.endereco, origemApi + '/api/auth/cadastro');
    assert.equal(pedido.opcoes.method, 'POST');
    assert.equal(pedido.opcoes.credentials, 'include');
    assert.equal(JSON.parse(pedido.opcoes.body).usuario, 'teste');
    assert.equal(resultado.status, 201);
    assert.equal(resultado.dados.mensagem, 'Conta criada');
    assert.deepEqual(eventos, ['dispatch:requisicao-inicio', 'dispatch:requisicao-fim']);
  });
}
