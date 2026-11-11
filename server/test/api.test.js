const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Cada execução usa um banco temporário e não altera os dados do projeto.
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-teste-'));
process.env.DB_CAMINHO = path.join(pasta, 'teste.db');
delete process.env.GROQ_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
execFileSync(process.execPath, [path.join(__dirname, '../src/db/criar-banco.js')]);
const Servidor = require('../src/server');
const db = require('../src/db/conexao');
const configuracao = require('../src/services/Configuracao');
configuracao.caminhoConfig = path.join(pasta, 'config.json');

function cliente(endereco) {
  let cookie = '';
  return async (rota, metodo = 'GET', corpo) => {
    const resposta = await fetch(endereco + '/api' + rota, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: corpo === undefined ? undefined : JSON.stringify(corpo)
    });
    if (resposta.headers.has('set-cookie'))
      cookie = resposta.headers.get('set-cookie').split(';')[0];
    const dados = await resposta.json();
    assert.notEqual(resposta.status, 500, JSON.stringify(dados));
    return { status: resposta.status, dados };
  };
}

test('cadastros, movimentações e permissões continuam funcionando juntos', async (t) => {
  const servidor = new Servidor().app.listen(0, '127.0.0.1');
  await new Promise((ok) => servidor.once('listening', ok));
  const endereco = 'http://127.0.0.1:' + servidor.address().port;
  const admin = cliente(endereco);
  let pessoaId, alojamentoId, leitoId, estadiaId, veiculoId, usoId;

  try {
    await t.test('sessão e acesso de operador às áreas restritas', async () => {
      assert.equal((await admin('/pessoas')).status, 401);
      assert.equal(
        (await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'errada' })).status,
        401
      );
      assert.equal(
        (await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'admin123' })).status,
        200
      );
      const operador = cliente(endereco);
      assert.equal(
        (
          await operador('/auth/cadastro', 'POST', {
            nome: 'Operador',
            usuario: 'operador',
            senha: 'teste123'
          })
        ).status,
        201
      );
      await operador('/auth/login', 'POST', { usuario: 'operador', senha: 'teste123' });
      assert.equal((await operador('/pessoas')).status, 200);
      assert.equal((await operador('/configuracoes')).status, 403);
      assert.equal((await operador('/auditoria')).status, 403);
    });

    await t.test('colaborador: cadastro, matrícula duplicada e edição', async () => {
      const pessoa = {
        nome: 'Motorista',
        matricula: 'T-01',
        cargo: 'Motorista',
        cnh_categorias: 'D',
        cnh_validade: '2099-12-31'
      };
      const resposta = await admin('/pessoas', 'POST', pessoa);
      assert.equal(resposta.status, 201);
      pessoaId = resposta.dados.id;
      assert.equal((await admin('/pessoas', 'POST', pessoa)).status, 400);
      assert.equal(
        (await admin('/pessoas/' + pessoaId, 'PUT', { ...pessoa, nome: 'Motorista de teste' }))
          .status,
        200
      );
      assert.equal(
        (await admin('/pessoas/' + pessoaId)).dados.colaborador.nome,
        'Motorista de teste'
      );
    });

    await t.test('quarto, ocupação e bloqueio de alojamento ocupado', async () => {
      const resposta = await admin('/alojamentos', 'POST', {
        nome: 'Casa de teste',
        cidade: 'Marília',
        responsavel_id: pessoaId
      });
      assert.equal(resposta.status, 201);
      alojamentoId = resposta.dados.id;
      const quarto = { nome: 'Quarto 1', area_m2: 3, leitos: [{ codigo: '1', tipo: 'cama' }] };
      assert.equal(
        (
          await admin('/alojamentos/' + alojamentoId + '/quartos', 'POST', {
            ...quarto,
            area_m2: 2
          })
        ).status,
        400
      );
      assert.equal(
        (await admin('/alojamentos/' + alojamentoId + '/quartos', 'POST', quarto)).status,
        201
      );
      leitoId = (await admin('/alojamentos/' + alojamentoId)).dados.quartos[0].leitos[0].id;
      const estadia = await admin('/alojamentos/estadias', 'POST', {
        pessoa_id: pessoaId,
        leito_id: leitoId,
        inicio: '2026-01-01T08:00'
      });
      assert.equal(estadia.status, 201);
      estadiaId = estadia.dados.id;
      assert.equal(
        (await admin('/alojamentos/estadias', 'POST', { pessoa_id: pessoaId, leito_id: leitoId }))
          .status,
        400
      );
      assert.equal(
        (await admin('/alojamentos/' + alojamentoId + '/status', 'PUT', { ativo: false })).status,
        400
      );
      assert.equal(
        (
          await admin('/alojamentos/estadias/' + estadiaId + '/saida', 'PUT', {
            fim: '2026-01-02T08:00'
          })
        ).status,
        200
      );
    });

    await t.test('saída, retorno, manutenção e continuidade do km', async () => {
      const veiculo = await admin('/frota', 'POST', {
        placa: 'abc1d23',
        modelo: 'Van',
        lugares: 8,
        categoria_cnh_exigida: 'D',
        km_inicial: 100,
        licenciamento_validade: '2099-12-31'
      });
      assert.equal(veiculo.status, 201);
      veiculoId = veiculo.dados.id;
      const saida = {
        veiculo_id: veiculoId,
        motorista_id: pessoaId,
        destino: 'Obra',
        km_saida: 100,
        saida: '2026-01-03T08:00'
      };
      assert.equal(
        (await admin('/frota/usos', 'POST', { ...saida, passageiros: [pessoaId] })).status,
        400
      );
      const uso = await admin('/frota/usos', 'POST', saida);
      assert.equal(uso.status, 201);
      usoId = uso.dados.id;
      assert.equal((await admin('/frota/usos', 'POST', saida)).status, 400);
      assert.equal(
        (
          await admin('/frota/usos/' + usoId + '/retorno', 'PUT', {
            km_retorno: 99,
            retorno: '2026-01-03T10:00'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await admin('/frota/usos/' + usoId + '/retorno', 'PUT', {
            km_retorno: 150,
            retorno: '2026-01-03T10:00'
          })
        ).status,
        200
      );
      assert.equal(
        (await admin('/frota/usos', 'POST', { ...saida, saida: '2026-01-04T08:00', km_saida: 149 }))
          .status,
        400
      );
      const manutencao = await admin('/frota/' + veiculoId + '/manutencoes', 'POST', {
        tipo: 'preventiva',
        descricao: 'Revisão',
        inicio: '2026-01-04T08:00'
      });
      assert.equal(manutencao.status, 201);
      assert.equal((await admin('/frota/usos', 'POST', { ...saida, km_saida: 150 })).status, 400);
      assert.equal(
        (
          await admin('/frota/manutencoes/' + manutencao.dados.id + '/concluir', 'PUT', {
            fim: '2026-01-04T12:00'
          })
        ).status,
        200
      );
    });

    await t.test('relatórios, notificações, IA desligada e cadeia da auditoria', async () => {
      for (const rota of [
        '/resumo',
        '/relatorios/ocupacao',
        '/relatorios/frota',
        '/relatorios/movimentacoes',
        '/relatorios/gargalos',
        '/notificacoes',
        '/configuracoes',
        '/auditoria'
      ]) {
        assert.equal((await admin(rota)).status, 200, rota);
      }
      assert.equal((await admin('/relatorios/ocupacao?de=2026-02-01&ate=2026-01-01')).status, 400);
      assert.equal(
        (await admin('/ia/perguntar', 'POST', { pergunta: 'Qual a ocupação?' })).status,
        503
      );
      assert.equal((await admin('/ia/resumo', 'POST', {})).status, 503);
      assert.equal(
        (await admin('/ia/suporte', 'POST', { mensagem: 'Como cadastrar?' })).status,
        503
      );
      await admin('/notificacoes/lidas', 'PUT', {});
      assert.equal((await admin('/notificacoes')).dados.nao_lidas, 0);
      assert.equal((await admin('/auditoria/integridade')).dados.integro, true);
      db.prepare("UPDATE log_auditoria SET resumo = 'Alteração externa' WHERE id = 1").run();
      assert.equal((await admin('/auditoria/integridade')).dados.integro, false);
      await admin('/auth/sair', 'POST', {});
      assert.equal((await admin('/auth/eu')).status, 401);
    });
  } finally {
    await new Promise((ok) => servidor.close(ok));
    db.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
