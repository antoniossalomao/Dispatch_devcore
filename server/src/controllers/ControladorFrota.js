const Veiculo = require('../models/Veiculo');
const Cnh = require('../models/Cnh');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const datas = require('../regras/datas');
const validador = require('../regras/validacao');

// Controla o cadastro da frota, retiradas, devoluções e manutenções dos veículos.
class ControladorFrota {
  // Pega o hodômetro da última volta registrada; se o carro nunca saiu, usa o km inicial do cadastro.
  kmAtual(veiculo) {
    const ultimo = db
      .prepare(
        'SELECT km_retorno FROM uso_veiculo WHERE veiculo_id = ? AND km_retorno IS NOT NULL ORDER BY retorno DESC, id DESC LIMIT 1'
      )
      .get(veiculo.id);
    return ultimo ? ultimo.km_retorno : veiculo.km_inicial;
  }

  statusVeiculo(veiculoId) {
    if (db.prepare('SELECT id FROM manutencao WHERE veiculo_id = ? AND fim IS NULL').get(veiculoId)) {
      return 'manutencao';
    }
    if (
      db
        .prepare('SELECT id FROM uso_veiculo WHERE veiculo_id = ? AND retorno IS NULL')
        .get(veiculoId)
    ) {
      return 'em_uso';
    }
    return 'disponivel';
  }

  // Confere se o licenciamento ou seguro está sem data, vencido, perto de vencer ou em dia.
  situacaoDocumento(validade, diasAlerta) {
    const dias = datas.diasAte(validade);
    if (dias === null) return { status: 'sem_data', dias: null };
    if (dias < 0) return { status: 'vencido', dias: dias };
    if (dias <= diasAlerta) return { status: 'vencendo', dias: dias };
    return { status: 'valido', dias: dias };
  }

  registrarSaida(req, res) {
    const cfg = configuracao.lerConfig();
    const corpo = req.body || {};
    const veiculoId = validador.lerIdPositivo(corpo.veiculo_id);
    const motoristaId = validador.lerIdPositivo(corpo.motorista_id);
    const destino = String(corpo.destino || '').trim();
    const kmSaida = Number(corpo.km_saida);
    const saida = corpo.saida ? datas.normalizarData(corpo.saida) : datas.agoraLocal();

    const passageiros = [];
    if (corpo.passageiros !== undefined && corpo.passageiros !== null) {
      if (!Array.isArray(corpo.passageiros)) {
        return res.status(400).json({ erro: 'Lista de passageiros inválida.' });
      }
      for (let i = 0; i < corpo.passageiros.length; i++) {
        const passId = validador.lerIdPositivo(corpo.passageiros[i]);
        if (!passId) {
          return res.status(400).json({ erro: 'Passageiro inválido informado.' });
        }
        passageiros.push(passId);
      }
    }

    if (!veiculoId || !motoristaId || destino === '') {
      return res.status(400).json({ erro: 'Informe veículo, motorista e destino.' });
    }
    const erroDestino = validador.textoDentroDoLimite(destino, 200, 'O destino');
    if (erroDestino) {
      return res.status(400).json({ erro: erroDestino });
    }
    if (!saida) {
      return res.status(400).json({ erro: 'Data de saída inválida.' });
    }
    if (datas.noFuturo(saida)) {
      return res.status(400).json({ erro: 'A saída não pode ser numa data futura.' });
    }
    if (!Number.isInteger(kmSaida) || kmSaida < 0 || kmSaida > 10000000) {
      return res.status(400).json({ erro: 'Informe o km de saída (número inteiro válido).' });
    }

    const veiculo = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(veiculoId);
    if (!veiculo) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }
    if (veiculo.ativo !== 1) {
      return res.status(400).json({ erro: 'Veículo inativo não pode sair.' });
    }

    const motorista = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(motoristaId);
    if (!motorista) {
      return res.status(404).json({ erro: 'Motorista não encontrado.' });
    }
    if (motorista.ativo !== 1) {
      return res.status(400).json({ erro: 'Colaborador inativo não pode dirigir.' });
    }

    const avisos = [];

    // O motorista precisa ter CNH cadastrada, válida na data da viagem e na categoria exigida pelo veículo.
    if (!motorista.cnh_categorias || motorista.cnh_categorias.trim() === '') {
      return res.status(400).json({ erro: motorista.nome + ' não tem CNH cadastrada.' });
    }
    if (!motorista.cnh_validade || motorista.cnh_validade < saida.slice(0, 10)) {
      return res.status(400).json({
        erro: 'A CNH de ' + motorista.nome + ' está vencida na data da saída.'
      });
    }
    if (!new Cnh(motorista.cnh_categorias).podeDirigir(veiculo.categoria_cnh_exigida)) {
      return res.status(400).json({
        erro:
          'A CNH de ' +
          motorista.nome +
          ' (' +
          motorista.cnh_categorias +
          ') não habilita para este veículo (categoria ' +
          veiculo.categoria_cnh_exigida +
          ').'
      });
    }

    // Impede marcar o motorista também como passageiro e limita a lotação aos assentos disponíveis.
    if (passageiros.includes(motoristaId)) {
      return res.status(400).json({ erro: 'O motorista não pode estar na lista de passageiros.' });
    }
    const passageirosUnicos = passageiros.filter(
      (item, indice) => passageiros.indexOf(item) === indice
    );
    if (passageirosUnicos.length > veiculo.lugares - 1) {
      return res.status(400).json({
        erro:
          'Passageiros demais: o veículo tem ' +
          veiculo.lugares +
          ' lugares (' +
          (veiculo.lugares - 1) +
          ' para passageiros).'
      });
    }

    // Licenciamento vencido bloqueia a saída; seguro vencido apenas gera um aviso na tela.
    const licDias = datas.diasAte(veiculo.licenciamento_validade);
    if (licDias !== null && licDias < 0 && cfg.bloquearDocVencido) {
      return res.status(400).json({ erro: 'Licenciamento vencido: o veículo não pode sair.' });
    }
    const segDias = datas.diasAte(veiculo.seguro_validade);
    if (segDias !== null && segDias < 0 && cfg.avisarSeguroVencido) {
      avisos.push('O seguro deste veículo está vencido.');
    }

    // Bloqueia se o carro estiver na oficina ou em outra viagem aberta no mesmo horário.
    if (
      db.prepare('SELECT id FROM manutencao WHERE veiculo_id = ? AND fim IS NULL').get(veiculoId)
    ) {
      return res.status(400).json({ erro: 'Veículo com manutenção em aberto não pode sair.' });
    }
    if (
      db
        .prepare(
          'SELECT id FROM uso_veiculo WHERE veiculo_id = ? AND (retorno IS NULL OR retorno > ?)'
        )
        .get(veiculoId, saida)
    ) {
      return res.status(400).json({ erro: 'Este veículo já está em uso nesse horário.' });
    }

    // Ninguém (motorista ou passageiro) pode estar em dois carros ao mesmo tempo.
    const envolvidos = [motoristaId].concat(passageirosUnicos);
    for (let i = 0; i < envolvidos.length; i++) {
      const pessoaId = envolvidos[i];
      const ocupado = db
        .prepare(
          'SELECT u.id FROM uso_veiculo u WHERE (u.retorno IS NULL OR u.retorno > ?) ' +
            'AND (u.motorista_id = ? OR EXISTS (SELECT 1 FROM uso_passageiro up WHERE up.uso_veiculo_id = u.id AND up.pessoa_id = ?)) LIMIT 1'
        )
        .get(saida, pessoaId, pessoaId);
      if (ocupado) {
        const pessoaOcupada = db.prepare('SELECT nome FROM pessoa WHERE id = ?').get(pessoaId);
        return res.status(400).json({
          erro:
            (pessoaOcupada ? pessoaOcupada.nome : 'Colaborador') +
            ' já está em outro veículo nesse horário.'
        });
      }
      const registroAtivo = db.prepare('SELECT ativo FROM pessoa WHERE id = ?').get(pessoaId);
      if (!registroAtivo) {
        return res.status(404).json({ erro: 'Passageiro não encontrado.' });
      }
      if (registroAtivo.ativo !== 1) {
        return res.status(400).json({ erro: 'Colaborador inativo não pode viajar.' });
      }
    }

    // O hodômetro da nova saída nunca pode regredir; se subiu sem viagem registrada, gera um aviso.
    const kmEsperado = this.kmAtual(veiculo);
    if (kmSaida < kmEsperado) {
      return res.status(400).json({
        erro:
          'O km de saída (' + kmSaida + ') é menor que o km da última volta (' + kmEsperado + ').'
      });
    }
    let kmSemRegistro = 0;
    if (kmSaida > kmEsperado) {
      kmSemRegistro = kmSaida - kmEsperado;
      avisos.push(
        'O km de saída é ' +
          kmSemRegistro +
          ' km maior que o da última volta: alguém pode ter usado o veículo sem registrar.'
      );
    }

    db.exec('BEGIN');
    let id;
    try {
      const resultado = db
        .prepare(
          'INSERT INTO uso_veiculo (veiculo_id, motorista_id, destino, saida, km_saida) VALUES (?, ?, ?, ?, ?)'
        )
        .run(veiculoId, motoristaId, destino, saida, kmSaida);
      id = Number(resultado.lastInsertRowid);

      const inserirPassageiro = db.prepare(
        'INSERT INTO uso_passageiro (uso_veiculo_id, pessoa_id) VALUES (?, ?)'
      );
      passageirosUnicos.forEach((passId) => {
        inserirPassageiro.run(id, passId);
      });
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      console.error('Erro ao registrar saída de veículo:', erro);
      return res.status(500).json({ erro: 'Não foi possível registrar a saída.' });
    }

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'uso_veiculo',
      registroId: id,
      resumo:
        'Registrou saída do ' +
        veiculo.modelo +
        ' ' +
        veiculo.placa +
        ' com ' +
        motorista.nome +
        ' para ' +
        destino,
      depois: {
        id: id,
        veiculo_id: veiculoId,
        motorista_id: motoristaId,
        destino: destino,
        saida: saida,
        km_saida: kmSaida,
        passageiros: passageirosUnicos,
        km_sem_registro: kmSemRegistro
      }
    });

    res.status(201).json({
      mensagem: 'Saída registrada!',
      id: id,
      avisos: avisos
    });
  }

  registrarRetorno(req, res) {
    const cfg = configuracao.lerConfig();
    const corpo = req.body || {};
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de uso inválido.' });
    }

    const uso = db.prepare('SELECT * FROM uso_veiculo WHERE id = ?').get(id);
    if (!uso) {
      return res.status(404).json({ erro: 'Uso não encontrado.' });
    }
    if (uso.retorno) {
      return res.status(400).json({ erro: 'Esse uso já foi encerrado.' });
    }

    const retorno = corpo.retorno ? datas.normalizarData(corpo.retorno) : datas.agoraLocal();
    const kmRetorno = Number(corpo.km_retorno);
    if (!retorno) {
      return res.status(400).json({ erro: 'Data de volta inválida.' });
    }
    if (datas.noFuturo(retorno)) {
      return res.status(400).json({ erro: 'A volta não pode ser numa data futura.' });
    }
    if (retorno <= uso.saida) {
      return res.status(400).json({
        erro: 'A volta precisa ser depois da saída (' + uso.saida + ').'
      });
    }
    if (!Number.isInteger(kmRetorno) || kmRetorno < 0 || kmRetorno > 10000000) {
      return res.status(400).json({ erro: 'Informe o km de volta (número inteiro válido).' });
    }
    if (kmRetorno < uso.km_saida) {
      return res.status(400).json({
        erro: 'O km da volta não pode ser menor que o da saída (' + uso.km_saida + ').'
      });
    }

    // Se a viagem passou do limite configurado (ex: 2.000 km), pede confirmação extra para evitar erro de digitação.
    const rodados = kmRetorno - uso.km_saida;
    if (rodados > cfg.kmConfirmacaoViagem && !corpo.confirmar) {
      return res.status(409).json({
        confirmar: true,
        erro:
          'Essa viagem teve ' +
          rodados +
          ' km (mais de ' +
          cfg.kmConfirmacaoViagem +
          '). Confirme se o km está correto.'
      });
    }

    db.prepare('UPDATE uso_veiculo SET retorno = ?, km_retorno = ? WHERE id = ?').run(
      retorno,
      kmRetorno,
      id
    );
    const veiculo = db
      .prepare('SELECT modelo, placa FROM veiculo WHERE id = ?')
      .get(uso.veiculo_id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'uso_veiculo',
      registroId: id,
      resumo:
        'Registrou volta do ' +
        veiculo.modelo +
        ' ' +
        veiculo.placa +
        ' (' +
        rodados +
        ' km rodados)',
      antes: { retorno: null, km_retorno: null },
      depois: { retorno: retorno, km_retorno: kmRetorno }
    });

    res.json({
      mensagem: 'Volta registrada! ' + rodados + ' km rodados.',
      km_rodados: rodados
    });
  }

  concluirManutencao(req, res) {
    const corpo = req.body || {};
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de manutenção inválido.' });
    }

    const manutencao = db.prepare('SELECT * FROM manutencao WHERE id = ?').get(id);
    if (!manutencao) {
      return res.status(404).json({ erro: 'Manutenção não encontrada.' });
    }
    if (manutencao.fim) {
      return res.status(400).json({ erro: 'Essa manutenção já foi concluída.' });
    }

    const fim = corpo.fim ? datas.normalizarData(corpo.fim) : datas.agoraLocal();
    if (!fim) {
      return res.status(400).json({ erro: 'Data de conclusão inválida.' });
    }
    if (datas.noFuturo(fim)) {
      return res.status(400).json({ erro: 'A conclusão não pode ser numa data futura.' });
    }
    if (fim <= manutencao.inicio) {
      return res.status(400).json({
        erro: 'A conclusão precisa ser depois do início (' + manutencao.inicio + ').'
      });
    }

    db.prepare('UPDATE manutencao SET fim = ? WHERE id = ?').run(fim, id);
    const veiculo = db
      .prepare('SELECT modelo, placa FROM veiculo WHERE id = ?')
      .get(manutencao.veiculo_id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'manutencao',
      registroId: id,
      resumo: 'Concluiu a manutenção do ' + veiculo.modelo + ' ' + veiculo.placa,
      antes: { fim: null },
      depois: { fim: fim }
    });

    res.json({ mensagem: 'Manutenção concluída! Veículo liberado.' });
  }

  listar(req, res) {
    const cfg = configuracao.lerConfig();
    const filtro = req.query.status || 'ativos';
    let sql = 'SELECT * FROM veiculo ';
    if (filtro === 'ativos') sql += 'WHERE ativo = 1 ';
    if (filtro === 'inativos') sql += 'WHERE ativo = 0 ';
    sql += 'ORDER BY ativo DESC, modelo, placa';

    const veiculos = db
      .prepare(sql)
      .all()
      .map((veiculo) => {
        const status = this.statusVeiculo(veiculo.id);
        const uso =
          status === 'em_uso'
            ? db
                .prepare(
                  'SELECT u.id AS uso_id, u.destino, u.saida, p.nome AS motorista FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
                    'WHERE u.veiculo_id = ? AND u.retorno IS NULL'
                )
                .get(veiculo.id)
            : null;
        const licenciamento = this.situacaoDocumento(
          veiculo.licenciamento_validade,
          cfg.diasAvisoVencimento
        );
        // O carro parado na garagem pode estar impedido de sair (regra F12).
        // A tela usa isso pra não mostrar como "pronto pra sair" um carro que o back vai barrar.
        let bloqueio = null;
        if (status === 'disponivel' && licenciamento.status === 'vencido' && cfg.bloquearDocVencido) {
          bloqueio = 'Licenciamento vencido';
        }
        return {
          id: veiculo.id,
          placa: veiculo.placa,
          modelo: veiculo.modelo,
          lugares: veiculo.lugares,
          categoria_cnh_exigida: veiculo.categoria_cnh_exigida,
          km_inicial: veiculo.km_inicial,
          km_atual: this.kmAtual(veiculo),
          licenciamento_validade: veiculo.licenciamento_validade,
          seguro_validade: veiculo.seguro_validade,
          licenciamento: licenciamento,
          seguro: this.situacaoDocumento(veiculo.seguro_validade, cfg.diasAvisoVencimento),
          ativo: veiculo.ativo,
          status: status,
          bloqueio: bloqueio,
          uso_atual: uso
        };
      });

    const totais = {
      total: veiculos.length,
      disponiveis: veiculos.filter((item) => item.status === 'disponivel' && !item.bloqueio).length,
      emUso: veiculos.filter((item) => item.status === 'em_uso').length,
      manutencao: veiculos.filter((item) => item.status === 'manutencao').length,
      docsAtencao: veiculos.filter(
        (item) =>
          item.licenciamento.status === 'vencido' ||
          item.licenciamento.status === 'vencendo' ||
          item.seguro.status === 'vencido' ||
          item.seguro.status === 'vencendo'
      ).length
    };

    res.json({
      totais: totais,
      veiculos: veiculos
    });
  }

  buscarPorId(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de veículo inválido.' });
    }

    const veiculo = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id);
    if (!veiculo) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }

    const usos = db
      .prepare(
        'SELECT u.*, p.nome AS motorista FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
          'WHERE u.veiculo_id = ? ORDER BY u.saida DESC LIMIT 100'
      )
      .all(id);
    const passageirosDoUso = db.prepare(
      'SELECT p.nome FROM uso_passageiro up JOIN pessoa p ON p.id = up.pessoa_id WHERE up.uso_veiculo_id = ? ORDER BY p.nome'
    );
    usos.forEach((uso) => {
      uso.passageiros = passageirosDoUso.all(uso.id).map((pessoa) => pessoa.nome);
      uso.km_rodados = uso.km_retorno !== null ? uso.km_retorno - uso.km_saida : null;
    });

    const manutencoes = db
      .prepare('SELECT * FROM manutencao WHERE veiculo_id = ? ORDER BY inicio DESC')
      .all(id);

    res.json({
      veiculo: Object.assign({}, veiculo, {
        km_atual: this.kmAtual(veiculo),
        status: this.statusVeiculo(id)
      }),
      usos: usos,
      manutencoes: manutencoes
    });
  }

  cadastrar(req, res) {
    const dadosVeiculo = new Veiculo(req.body || {});
    const erro = dadosVeiculo.validar();
    if (erro) {
      return res.status(400).json({ erro: erro });
    }

    if (db.prepare('SELECT id FROM veiculo WHERE placa = ?').get(dadosVeiculo.placa)) {
      return res.status(400).json({
        erro: 'Já existe um veículo com a placa ' + dadosVeiculo.placa + '.'
      });
    }

    const resultado = db
      .prepare(
        'INSERT INTO veiculo (placa, modelo, lugares, categoria_cnh_exigida, km_inicial, licenciamento_validade, seguro_validade, ativo) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      )
      .run(
        dadosVeiculo.placa,
        dadosVeiculo.modelo,
        dadosVeiculo.lugares,
        dadosVeiculo.categoria,
        dadosVeiculo.kmInicial,
        dadosVeiculo.licenciamento,
        dadosVeiculo.seguro
      );
    const id = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'veiculo',
      registroId: id,
      resumo: 'Cadastrou o veículo ' + dadosVeiculo.modelo + ' ' + dadosVeiculo.placa,
      depois: {
        id: id,
        placa: dadosVeiculo.placa,
        modelo: dadosVeiculo.modelo,
        lugares: dadosVeiculo.lugares,
        categoria_cnh_exigida: dadosVeiculo.categoria,
        km_inicial: dadosVeiculo.kmInicial,
        licenciamento_validade: dadosVeiculo.licenciamento,
        seguro_validade: dadosVeiculo.seguro
      }
    });

    res.status(201).json({
      mensagem: 'Veículo cadastrado!',
      id: id
    });
  }

  atualizar(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de veículo inválido.' });
    }

    const atual = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id);
    if (!atual) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }

    const dadosVeiculo = new Veiculo(req.body || {});
    const erro = dadosVeiculo.validar();
    if (erro) {
      return res.status(400).json({ erro: erro });
    }

    if (
      db
        .prepare('SELECT id FROM veiculo WHERE placa = ? AND id != ?')
        .get(dadosVeiculo.placa, id)
    ) {
      return res.status(400).json({
        erro: 'A placa ' + dadosVeiculo.placa + ' já está em uso por outro veículo.'
      });
    }

    db.prepare(
      'UPDATE veiculo SET placa = ?, modelo = ?, lugares = ?, categoria_cnh_exigida = ?, km_inicial = ?, licenciamento_validade = ?, seguro_validade = ? WHERE id = ?'
    ).run(
      dadosVeiculo.placa,
      dadosVeiculo.modelo,
      dadosVeiculo.lugares,
      dadosVeiculo.categoria,
      dadosVeiculo.kmInicial,
      dadosVeiculo.licenciamento,
      dadosVeiculo.seguro,
      id
    );

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'veiculo',
      registroId: id,
      resumo: 'Atualizou o veículo ' + dadosVeiculo.modelo + ' ' + dadosVeiculo.placa,
      antes: atual,
      depois: {
        id: id,
        placa: dadosVeiculo.placa,
        modelo: dadosVeiculo.modelo,
        lugares: dadosVeiculo.lugares,
        categoria_cnh_exigida: dadosVeiculo.categoria,
        km_inicial: dadosVeiculo.kmInicial,
        licenciamento_validade: dadosVeiculo.licenciamento,
        seguro_validade: dadosVeiculo.seguro
      }
    });

    res.json({ mensagem: 'Veículo atualizado!' });
  }

  alterarStatus(req, res) {
    const corpo = req.body || {};
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de veículo inválido.' });
    }

    const novoAtivo = corpo.ativo ? 1 : 0;
    const veiculo = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id);
    if (!veiculo) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }
    if (novoAtivo === 0 && this.statusVeiculo(id) !== 'disponivel') {
      return res.status(400).json({
        erro: 'Não é possível desativar: o veículo está em uso ou em manutenção.'
      });
    }

    db.prepare('UPDATE veiculo SET ativo = ? WHERE id = ?').run(novoAtivo, id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
      tabela: 'veiculo',
      registroId: id,
      resumo:
        (novoAtivo === 1 ? 'Reativou' : 'Desativou') +
        ' o veículo ' +
        veiculo.modelo +
        ' ' +
        veiculo.placa,
      antes: { ativo: veiculo.ativo },
      depois: { ativo: novoAtivo }
    });

    res.json({
      mensagem: novoAtivo === 1 ? 'Veículo reativado.' : 'Veículo desativado.'
    });
  }

  registrarManutencao(req, res) {
    const corpo = req.body || {};
    const veiculoId = validador.lerIdPositivo(req.params.id);
    if (!veiculoId) {
      return res.status(400).json({ erro: 'ID de veículo inválido.' });
    }

    const veiculo = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(veiculoId);
    if (!veiculo) {
      return res.status(404).json({ erro: 'Veículo não encontrado.' });
    }

    const tipo = corpo.tipo;
    const descricao = String(corpo.descricao || '').trim();
    const inicio = corpo.inicio ? datas.normalizarData(corpo.inicio) : datas.agoraLocal();
    const km =
      corpo.km === undefined || corpo.km === '' || corpo.km === null ? null : Number(corpo.km);

    if (tipo !== 'preventiva' && tipo !== 'corretiva') {
      return res.status(400).json({ erro: 'Tipo de manutenção inválido.' });
    }
    if (descricao === '') {
      return res.status(400).json({ erro: 'Descreva a manutenção.' });
    }
    const erroDescricao = validador.textoDentroDoLimite(descricao, 500, 'A descrição da manutenção');
    if (erroDescricao) {
      return res.status(400).json({ erro: erroDescricao });
    }
    if (!inicio) {
      return res.status(400).json({ erro: 'Data de início inválida.' });
    }
    if (datas.noFuturo(inicio)) {
      return res.status(400).json({ erro: 'O início não pode ser numa data futura.' });
    }
    if (km !== null && (!Number.isInteger(km) || km < 0 || km > 10000000)) {
      return res.status(400).json({ erro: 'Km inválido.' });
    }

    const status = this.statusVeiculo(veiculoId);
    if (status === 'em_uso') {
      return res.status(400).json({
        erro: 'O veículo está em uso. Registre a volta antes de abrir a manutenção.'
      });
    }
    if (status === 'manutencao') {
      return res.status(400).json({ erro: 'O veículo já está em manutenção.' });
    }

    const resultado = db
      .prepare(
        'INSERT INTO manutencao (veiculo_id, tipo, descricao, inicio, km) VALUES (?, ?, ?, ?, ?)'
      )
      .run(veiculoId, tipo, descricao, inicio, km);
    const id = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'manutencao',
      registroId: id,
      resumo: 'Abriu manutenção ' + tipo + ' do ' + veiculo.modelo + ' ' + veiculo.placa,
      depois: {
        id: id,
        veiculo_id: veiculoId,
        tipo: tipo,
        descricao: descricao,
        inicio: inicio,
        km: km
      }
    });

    res.status(201).json({
      mensagem: 'Manutenção registrada! O veículo ficou indisponível.',
      id: id
    });
  }
}

module.exports = ControladorFrota;
