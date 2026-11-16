const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

// Cada execução usa um banco temporário e não altera os dados do projeto.
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-teste-'));
process.env.DB_CAMINHO = path.join(pasta, 'teste.db');
delete process.env.GROQ_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.CADASTRO_CODIGO;
execFileSync(process.execPath, [path.join(__dirname, '../src/db/criar-banco.js')]);
const Servidor = require('../src/server');
const db = require('../src/db/conexao');
const configuracao = require('../src/services/Configuracao');
const notificacoes = require('../src/services/Notificacoes');

assert.equal(configuracao.caminhoConfig, path.join(pasta, 'config.json'));

function cliente(endereco) {
  let cookie = '';
  const req = async (rota, metodo = 'GET', corpo, headersExtras = {}) => {
    const resposta = await fetch(endereco + '/api' + rota, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...headersExtras
      },
      body:
        corpo === undefined
          ? undefined
          : typeof corpo === 'string'
            ? corpo
            : JSON.stringify(corpo)
    });
    if (resposta.headers.has('set-cookie')) {
      cookie = resposta.headers.get('set-cookie').split(';')[0];
    }
    const dados = await resposta.json();
    assert.notEqual(resposta.status, 500, JSON.stringify(dados));
    return { status: resposta.status, dados, headers: resposta.headers };
  };
  req.cookie = () => cookie;
  return req;
}

test('cadastros, movimentações, permissões e segurança continuam funcionando juntos', async (t) => {
  const servidor = new Servidor().app.listen(0, '127.0.0.1');
  await new Promise((ok) => servidor.once('listening', ok));
  const endereco = 'http://127.0.0.1:' + servidor.address().port;
  const admin = cliente(endereco);
  const operador = cliente(endereco);
  let pessoaId, alojamentoId, leitoId, estadiaId, veiculoId, usoId;

  try {
    await t.test('sessão, cadastro bloqueado e acesso restrito de operador', async () => {
      assert.equal((await admin('/pessoas')).status, 401);
      assert.equal((await admin('/resumo')).status, 401);
      assert.equal((await admin('/notificacoes')).status, 401);
      assert.equal((await admin('/configuracoes')).status, 401);
      assert.equal((await admin('/auditoria')).status, 401);

      const statusCadastro = await admin('/auth/cadastro-status');
      assert.equal(statusCadastro.status, 200);
      assert.equal(statusCadastro.dados.ativo, false);

      assert.equal(
        (
          await operador('/auth/cadastro', 'POST', {
            nome: 'Operador',
            usuario: 'operador',
            senha: 'Oper@2026'
          })
        ).status,
        403
      );

      assert.equal(
        (await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'errada' })).status,
        401
      );
      const loginAdmin = await admin('/auth/login', 'POST', {
        usuario: 'admin',
        senha: 'admin123'
      });
      assert.equal(loginAdmin.status, 200);
      const cookie1 = admin.cookie();
      assert.ok(cookie1.startsWith('dispatch.sid='));
      const setCookie = loginAdmin.headers.get('set-cookie') || '';
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);

      // Segundo login deve regenerar o ID de sessão.
      await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'admin123' });
      assert.notEqual(admin.cookie(), cookie1);

      const eu = await admin('/auth/eu');
      assert.equal(eu.status, 200);
      assert.equal(eu.dados.usuario.perfil, 'admin');
      assert.ok(eu.dados.nomeEmpresa);

      // Admin cadastra operador e valida política de senha.
      assert.equal(
        (
          await admin('/configuracoes/usuarios', 'POST', {
            nome: 'Operador',
            login: 'operador',
            perfil: 'operador',
            senha: '1234567'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await admin('/configuracoes/usuarios', 'POST', {
            nome: 'Operador',
            login: 'operador',
            perfil: 'operador',
            senha: 'operador'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await admin('/configuracoes/usuarios', 'POST', {
            nome: 'Operador',
            login: 'operador',
            perfil: 'operador',
            senha: 'Oper@2026'
          })
        ).status,
        201
      );

      assert.equal(
        (await operador('/auth/login', 'POST', { usuario: 'operador', senha: 'Oper@2026' }))
          .status,
        200
      );
      assert.equal((await operador('/pessoas')).status, 200);
      assert.equal((await operador('/resumo')).status, 200);
      assert.equal((await operador('/notificacoes')).status, 200);
      assert.equal((await operador('/configuracoes')).status, 403);
      assert.equal((await operador('/configuracoes/backup')).status, 403);
      assert.equal((await operador('/auditoria')).status, 403);
      assert.equal((await operador('/auditoria/integridade')).status, 403);
      assert.equal((await operador('/pessoas/seed-exemplos', 'POST', {})).status, 403);
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
        '/auditoria',
        '/auditoria?limite=999999'
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

      // Alerta de log adulterado é visível e dispensável somente por administradores.
      notificacoes.ultimaVerificacao = 0;
      const avisosOperador = await operador('/notificacoes');
      assert.equal(avisosOperador.status, 200);
      assert.equal(
        avisosOperador.dados.notificacoes.some((n) => n.tipo === 'log_adulterado'),
        false
      );
      const avisosAdmin = await admin('/notificacoes');
      const alertaLog = avisosAdmin.dados.notificacoes.find((n) => n.tipo === 'log_adulterado');
      assert.ok(alertaLog);
      assert.equal(
        (await operador('/notificacoes/' + alertaLog.id + '/lida', 'PUT', {})).status,
        403
      );
      await operador('/notificacoes/lidas', 'PUT', {});
      assert.ok((await admin('/notificacoes')).dados.nao_lidas >= 1);
      assert.equal((await admin('/notificacoes?todas=1')).status, 200);

      await admin('/auth/sair', 'POST', {});
      assert.equal((await admin('/auth/eu')).status, 401);
      await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'admin123' });
    });

    await t.test('cadastro com código de convite e revogação imediata de sessão', async () => {
      process.env.CADASTRO_CODIGO = 'Convite@2026';
      try {
        assert.equal((await admin('/auth/cadastro-status')).dados.ativo, true);
        const novo = cliente(endereco);
        assert.equal(
          (
            await novo('/auth/cadastro', 'POST', {
              nome: 'Convidado',
              usuario: 'convidado1',
              senha: 'Senha@2026',
              codigo: 'errado'
            })
          ).status,
          403
        );
        assert.equal(
          (
            await novo('/auth/cadastro', 'POST', {
              nome: 'Convidado',
              usuario: 'convidado1',
              senha: '12345678',
              codigo: 'Convite@2026'
            })
          ).status,
          400
        );
        assert.equal(
          (
            await novo('/auth/cadastro', 'POST', {
              nome: 'Convidado',
              usuario: 'convidado1',
              senha: 'Senha@2026',
              perfil: 'admin',
              codigo: 'Convite@2026'
            })
          ).status,
          201
        );
        const convidadoBanco = db
          .prepare('SELECT id, perfil FROM usuario WHERE login = ?')
          .get('convidado1');
        assert.equal(convidadoBanco.perfil, 'operador');

        assert.equal(
          (await novo('/auth/login', 'POST', { usuario: 'convidado1', senha: 'Senha@2026' }))
            .status,
          200
        );
        assert.equal((await novo('/auth/eu')).status, 200);

        // Alteração de perfil revoga sessões existentes do usuário alvo.
        assert.equal(
          (
            await admin('/configuracoes/usuarios/' + convidadoBanco.id + '/perfil', 'PUT', {
              perfil: 'admin'
            })
          ).status,
          200
        );
        assert.equal((await novo('/auth/eu')).status, 401);

        // Desativação revoga sessão imediatamente.
        assert.equal(
          (await novo('/auth/login', 'POST', { usuario: 'convidado1', senha: 'Senha@2026' }))
            .status,
          200
        );
        assert.equal(
          (
            await admin('/configuracoes/usuarios/' + convidadoBanco.id + '/ativo', 'PUT', {
              ativo: false
            })
          ).status,
          200
        );
        assert.equal((await novo('/auth/eu')).status, 401);

        // Reativa, faz login e redefine senha: deve derrubar a sessão ativa.
        await admin('/configuracoes/usuarios/' + convidadoBanco.id + '/ativo', 'PUT', {
          ativo: true
        });
        assert.equal(
          (await novo('/auth/login', 'POST', { usuario: 'convidado1', senha: 'Senha@2026' }))
            .status,
          200
        );
        assert.equal(
          (
            await admin('/configuracoes/usuarios/' + convidadoBanco.id + '/senha', 'PUT', {
              novaSenha: 'Nova@2026'
            })
          ).status,
          200
        );
        assert.equal((await novo('/auth/eu')).status, 401);

        // Mesmo se um usuário for desativado fora do controlador, a sessão é bloqueada e removida.
        assert.equal(
          (await novo('/auth/login', 'POST', { usuario: 'convidado1', senha: 'Nova@2026' }))
            .status,
          200
        );
        db.prepare('UPDATE usuario SET ativo = 0 WHERE id = ?').run(convidadoBanco.id);
        assert.equal((await novo('/auth/eu')).status, 401);
        assert.equal(
          db.prepare('SELECT COUNT(*) AS n FROM sessao WHERE usuario_id = ?').get(convidadoBanco.id)
            .n,
          0
        );
      } finally {
        delete process.env.CADASTRO_CODIGO;
      }
    });

    await t.test('cabeçalhos de segurança, proteção CSRF e validação estrita de entradas', async () => {
      const raiz = await fetch(endereco + '/');
      assert.equal(raiz.status, 200);
      const csp = raiz.headers.get('content-security-policy') || '';
      assert.ok(csp.includes("script-src 'self'"));
      assert.equal(csp.includes("'unsafe-inline'"), false);
      assert.equal(raiz.headers.get('x-frame-options'), 'DENY');
      assert.equal(raiz.headers.get('x-powered-by'), null);
      assert.equal(raiz.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

      // CSRF em rotas mutáveis
      assert.equal(
        (
          await admin('/pessoas', 'POST', { nome: 'Teste' }, { Origin: 'https://evil.com' })
        ).status,
        403
      );
      assert.equal(
        (await admin('/pessoas', 'POST', { nome: 'Teste' }, { Origin: 'null' })).status,
        403
      );
      assert.equal(
        (
          await admin(
            '/pessoas',
            'POST',
            { nome: 'Teste' },
            { Referer: 'https://evil.com/ataque.html' }
          )
        ).status,
        403
      );
      assert.equal(
        (
          await admin('/pessoas', 'POST', { nome: 'Teste' }, { 'Sec-Fetch-Site': 'cross-site' })
        ).status,
        403
      );

      // IDs inválidos, datas impossíveis, CNH inválida, JSON malformado e payload grande
      assert.equal((await admin('/pessoas/abc')).status, 400);
      assert.equal((await admin('/frota/0')).status, 400);
      assert.equal((await admin('/alojamentos/-5')).status, 400);
      assert.equal((await admin('/notificacoes/xyz/lida', 'PUT', {})).status, 400);
      assert.equal((await admin('/configuracoes/usuarios/abc/perfil', 'PUT', {})).status, 400);
      assert.equal(
        (
          await admin('/pessoas', 'POST', {
            nome: 'CNH Ruim',
            matricula: 'T-99',
            cargo: 'Motorista',
            cnh_categorias: 'X',
            cnh_validade: '2099-12-31'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await admin('/pessoas', 'POST', {
            nome: 'Data Falsa',
            matricula: 'T-98',
            cargo: 'Motorista',
            cnh_categorias: 'B',
            cnh_validade: '2026-02-30'
          })
        ).status,
        400
      );
      assert.equal(
        (
          await admin('/frota', 'POST', {
            placa: 'XYZ-1234',
            modelo: 'Furgão',
            lugares: 4,
            categoria_cnh_exigida: 'B',
            licenciamento_validade: '2026-02-31'
          })
        ).status,
        400
      );
      assert.equal(
        (await admin('/auth/login', 'POST', { usuario: { toString: null }, senha: 'x' })).status,
        400
      );
      assert.equal((await admin('/auth/login', 'POST', '{json-quebrado')).status, 400);
      assert.equal(
        (await admin('/pessoas', 'POST', { nome: 'a'.repeat(120000) })).status,
        413
      );
      assert.equal((await admin('/rota-inexistente')).status, 404);
    });

    await t.test('backup higienizado remove sessões ativas e registra auditoria', async () => {
      const contagemSessoesAtivas = db.prepare('SELECT COUNT(*) AS n FROM sessao').get().n;
      assert.ok(contagemSessoesAtivas >= 1);

      const resp = await fetch(endereco + '/api/configuracoes/backup', {
        headers: { Cookie: admin.cookie() }
      });
      assert.equal(resp.status, 200);
      assert.equal(resp.headers.get('cache-control'), 'no-store');
      const buffer = Buffer.from(await resp.arrayBuffer());
      assert.equal(buffer.subarray(0, 15).toString('utf8'), 'SQLite format 3');

      const arquivoBackup = path.join(pasta, 'backup-recebido.db');
      fs.writeFileSync(arquivoBackup, buffer);
      const dbBackup = new DatabaseSync(arquivoBackup);
      try {
        assert.equal(dbBackup.prepare('SELECT COUNT(*) AS n FROM sessao').get().n, 0);
        assert.ok(dbBackup.prepare('SELECT COUNT(*) AS n FROM usuario').get().n >= 1);
      } finally {
        dbBackup.close();
      }
      assert.ok(
        db.prepare("SELECT COUNT(*) AS n FROM log_auditoria WHERE tabela = 'backup'").get().n >= 1
      );
    });
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
});

test('CORS em produção, proxy HTTPS do Azure e rate limit funcionam juntos', async () => {
  const nodeEnvOriginal = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const servidorProd = new Servidor().app.listen(0, '127.0.0.1');
  await new Promise((ok) => servidorProd.once('listening', ok));
  const enderecoProd = 'http://127.0.0.1:' + servidorProd.address().port;

  try {
    const preflightLive = await fetch(enderecoProd + '/api/pessoas', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5500' }
    });
    assert.equal(preflightLive.status, 403);
    assert.equal(preflightLive.headers.get('access-control-allow-origin'), null);

    const preflightSpoof = await fetch(enderecoProd + '/api/pessoas', {
      method: 'OPTIONS',
      headers: { Origin: 'https://localhost.evil.com' }
    });
    assert.equal(preflightSpoof.status, 403);
    assert.equal(preflightSpoof.headers.get('access-control-allow-origin'), null);

    const raizProd = await fetch(enderecoProd + '/');
    const cspProd = raizProd.headers.get('content-security-policy') || '';
    assert.ok(cspProd.includes('upgrade-insecure-requests'));
    assert.ok(raizProd.headers.get('strict-transport-security'));

    // Atrás de proxy HTTPS do Azure, cookie recebe Secure e CSRF aceita mesma origem HTTPS.
    const requisitarHttp = (caminho, metodo, headers, corpo) =>
      new Promise((resolve, reject) => {
        const dados = corpo === undefined ? null : JSON.stringify(corpo);
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: servidorProd.address().port,
            path: '/api' + caminho,
            method: metodo,
            headers: {
              ...(dados ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados) } : {}),
              ...headers
            }
          },
          (res) => {
            let txt = '';
            res.on('data', (chunk) => {
              txt += chunk;
            });
            res.on('end', () => {
              resolve({ status: res.statusCode, headers: res.headers, txt: txt });
            });
          }
        );
        req.on('error', reject);
        if (dados) req.write(dados);
        req.end();
      });

    const loginAzure = await requisitarHttp(
      '/auth/login',
      'POST',
      {
        Host: 'dispach-teste.azurewebsites.net',
        'X-Forwarded-Proto': 'https',
        Origin: 'https://dispach-teste.azurewebsites.net'
      },
      { usuario: 'admin', senha: 'admin123' }
    );
    assert.equal(loginAzure.status, 200);
    const cookieAzure = Array.isArray(loginAzure.headers['set-cookie'])
      ? loginAzure.headers['set-cookie'][0]
      : loginAzure.headers['set-cookie'] || '';
    assert.match(cookieAzure, /;\s*Secure/i);

    const optMesmaOrigem = await requisitarHttp('/pessoas', 'OPTIONS', {
      Host: 'dispach-teste.azurewebsites.net',
      'X-Forwarded-Proto': 'https',
      Origin: 'https://dispach-teste.azurewebsites.net'
    });
    assert.equal(optMesmaOrigem.status, 204);

    const autenticadoHttps = await requisitarHttp(
      '/pessoas',
      'POST',
      {
        Host: 'dispach-teste.azurewebsites.net',
        'X-Forwarded-Proto': 'https',
        Origin: 'https://dispach-teste.azurewebsites.net',
        Cookie: cookieAzure.split(';')[0]
      },
      { nome: 'SemMat' }
    );
    assert.equal(autenticadoHttps.status, 400);

    const downgradeCsrf = await requisitarHttp(
      '/pessoas',
      'POST',
      {
        Host: 'dispach-teste.azurewebsites.net',
        'X-Forwarded-Proto': 'https',
        Origin: 'http://dispach-teste.azurewebsites.net',
        Cookie: cookieAzure.split(';')[0]
      },
      { nome: 'SemMat' }
    );
    assert.equal(downgradeCsrf.status, 403);

    const c = cliente(enderecoProd);
    for (let i = 0; i < 10; i++) {
      assert.equal(
        (await c('/auth/login', 'POST', { usuario: 'admin', senha: 'errada' })).status,
        401
      );
    }
    assert.equal(
      (await c('/auth/login', 'POST', { usuario: 'admin', senha: 'errada' })).status,
      429
    );
  } finally {
    if (nodeEnvOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnvOriginal;
    await new Promise((ok) => servidorProd.close(ok));
  }
});

test('telas do sistema abrem a casca única e endereços antigos redirecionam', async () => {
  const servidor = new Servidor().app.listen(0, '127.0.0.1');
  await new Promise((ok) => servidor.once('listening', ok));
  const endereco = 'http://127.0.0.1:' + servidor.address().port;
  const pegar = (rota) => fetch(endereco + rota, { redirect: 'manual' });
  try {
    const telas = ['resumo', 'colaboradores', 'alojamentos', 'frota', 'movimentacoes', 'relatorios', 'configuracoes'];
    for (const tela of telas) {
      const resposta = await pegar('/' + tela);
      assert.equal(resposta.status, 200, tela);
      const texto = await resposta.text();
      assert.match(texto, /js\/app\/App\.js/, tela + ' deve entregar a casca');
      assert.equal(resposta.headers.get('cache-control'), 'no-cache');

      const fragmento = await pegar('/telas/' + tela + '.html');
      assert.equal(fragmento.status, 200, 'fragmento ' + tela);
      assert.match(await fragmento.text(), /data-parte="conteudo"/);
    }

    const antigo = await pegar('/frota.html');
    assert.equal(antigo.status, 301);
    assert.equal(antigo.headers.get('location'), '/frota');

    const casca = await pegar('/app');
    assert.equal(casca.status, 301);
    assert.equal(casca.headers.get('location'), '/resumo');

    assert.equal((await pegar('/')).status, 200);
    assert.equal((await pegar('/login')).status, 200);
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
});

test('login com Google só entra em usuário ativo com o e-mail ligado pelo admin', async () => {
  const servidor = new Servidor().app.listen(0, '127.0.0.1');
  await new Promise((ok) => servidor.once('listening', ok));
  const endereco = 'http://127.0.0.1:' + servidor.address().port;
  const fetchOriginal = globalThis.fetch;
  const envAntes = { id: process.env.GOOGLE_CLIENT_ID, segredo: process.env.GOOGLE_CLIENT_SECRET };
  let cargaGoogle = null;

  // Só o endpoint de token do Google é simulado; o resto passa pelo fetch de verdade.
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const corpo = new URLSearchParams(opcoes.body);
      assert.equal(corpo.get('code'), 'codigo-teste');
      assert.equal(corpo.get('client_secret'), 'segredo-teste');
      const jwt = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      return new Response(
        JSON.stringify({ id_token: jwt({ alg: 'RS256' }) + '.' + jwt(cargaGoogle) + '.assinatura' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return fetchOriginal(url, opcoes);
  };

  const pegar = async (rota, cookie) => {
    const r = await fetchOriginal(endereco + rota, {
      redirect: 'manual',
      headers: cookie ? { Cookie: cookie } : {}
    });
    const novo = r.headers.get('set-cookie');
    return { r, cookie: novo ? novo.split(';')[0] : cookie };
  };
  const tentar = async (claims) => {
    const ida = await pegar('/api/auth/google');
    assert.equal(ida.r.status, 302);
    const destino = new URL(ida.r.headers.get('location'));
    assert.equal(destino.host, 'accounts.google.com');
    assert.equal(destino.searchParams.get('client_id'), 'cliente-teste');
    const estado = destino.searchParams.get('state');
    cargaGoogle = Object.assign(
      {
        iss: 'https://accounts.google.com',
        aud: 'cliente-teste',
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: destino.searchParams.get('nonce'),
        email: 'Admin.Teste@Gmail.com',
        email_verified: true
      },
      claims
    );
    const volta = await pegar(
      '/api/auth/google/retorno?code=codigo-teste&state=' + encodeURIComponent(estado),
      ida.cookie
    );
    return { local: volta.r.headers.get('location'), cookie: volta.cookie };
  };

  try {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const desligado = await (await fetchOriginal(endereco + '/api/auth/google/status')).json();
    assert.equal(desligado.ativo, false);
    assert.equal((await pegar('/api/auth/google')).r.headers.get('location'), '/login?google=indisponivel');

    process.env.GOOGLE_CLIENT_ID = 'cliente-teste';
    process.env.GOOGLE_CLIENT_SECRET = 'segredo-teste';
    assert.equal((await (await fetchOriginal(endereco + '/api/auth/google/status')).json()).ativo, true);

    // Sem e-mail ligado, a conta Google não entra.
    assert.equal((await tentar({})).local, '/login?google=sem-acesso');

    // Admin liga o e-mail ao usuário admin.
    const admin = cliente(endereco);
    assert.equal((await admin('/auth/login', 'POST', { usuario: 'admin', senha: 'admin123' })).status, 200);
    const config = await admin('/configuracoes');
    const idAdmin = config.dados.usuarios.find((u) => u.login === 'admin').id;
    assert.equal((await admin('/configuracoes/usuarios/' + idAdmin + '/email', 'PUT', { email: 'nao-e-email' })).status, 400);
    assert.equal((await admin('/configuracoes/usuarios/' + idAdmin + '/email', 'PUT', { email: 'admin.teste@gmail.com' })).status, 200);

    // Estado trocado, token de outro cliente e e-mail não verificado continuam barrados.
    const ida = await pegar('/api/auth/google');
    const forjado = await pegar('/api/auth/google/retorno?code=codigo-teste&state=forjado', ida.cookie);
    assert.equal(forjado.r.headers.get('location'), '/login?google=expirado');
    assert.equal((await tentar({ aud: 'outro-cliente' })).local, '/login?google=falhou');
    assert.equal((await tentar({ email_verified: false })).local, '/login?google=falhou');
    assert.equal((await tentar({ nonce: 'outro' })).local, '/login?google=falhou');

    // Tudo certo: entra e a sessão vale para a API.
    const ok = await tentar({});
    assert.equal(ok.local, '/resumo');
    const eu = await fetchOriginal(endereco + '/api/auth/eu', { headers: { Cookie: ok.cookie } });
    assert.equal(eu.status, 200);
    assert.equal((await eu.json()).usuario.login, 'admin');

    // Remover o e-mail tira o acesso pelo Google.
    assert.equal((await admin('/configuracoes/usuarios/' + idAdmin + '/email', 'PUT', { email: '' })).status, 200);
    assert.equal((await tentar({})).local, '/login?google=sem-acesso');
  } finally {
    globalThis.fetch = fetchOriginal;
    if (envAntes.id === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = envAntes.id;
    if (envAntes.segredo === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = envAntes.segredo;
    await new Promise((ok) => servidor.close(ok));
  }
});

test.after(() => {
  db.close();
  fs.rmSync(pasta, { recursive: true, force: true });
});
