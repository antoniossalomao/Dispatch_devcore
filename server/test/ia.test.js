const test = require('node:test');
const assert = require('node:assert/strict');
const ia = require('../src/services/InteligenciaArtificial');

test('IA mantém as mensagens e os parâmetros enviados à Groq', async (t) => {
  const fetchOriginal = global.fetch;
  const chaveOriginal = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'chave-de-teste';
  t.after(() => {
    global.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = chaveOriginal;
  });

  let pedido;
  global.fetch = async (url, opcoes) => {
    pedido = { url, opcoes };
    return new Response(
      JSON.stringify({ choices: [{ message: { content: ' Resposta de teste ' } }] })
    );
  };
  const mensagens = [{ role: 'user', content: 'Qual a ocupação?' }];
  assert.equal(
    await ia.perguntar(mensagens, { temperatura: 0.1, maxTokens: 100 }),
    'Resposta de teste'
  );
  const corpo = JSON.parse(pedido.opcoes.body);
  assert.equal(pedido.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.deepEqual(corpo.messages, mensagens);
  assert.equal(corpo.temperature, 0.1);
  assert.equal(corpo.max_tokens, 100);

  // O alerta original continua disponível quando o serviço externo falha.
  global.fetch = async () => {
    throw new Error('Rede indisponível');
  };
  await assert.rejects(ia.perguntar(mensagens), /falha de rede/);
  assert.equal(await ia.redigirAlerta('Veículo não devolvido'), 'Veículo não devolvido');
});
