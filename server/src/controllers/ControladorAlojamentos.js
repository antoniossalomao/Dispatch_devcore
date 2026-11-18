const Quarto = require('../models/Quarto');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const datas = require('../regras/datas');
const validador = require('../regras/validacao');

// Cadastro e rotina de alojamentos, quartos/leitos, entradas, saídas e ocorrências.
class ControladorAlojamentos {
  constructor() {
    this.tiposOcorrencia = ['manutencao', 'conflito', 'reclamacao', 'regra', 'outro'];
  }

  // O responsável pelo alojamento precisa ser um colaborador ativo no quadro.
  conferirResponsavel(responsavelId) {
    if (responsavelId === null) return null;
    const pessoa = db.prepare('SELECT id, ativo FROM pessoa WHERE id = ?').get(responsavelId);
    if (!pessoa) return 'Responsável não encontrado.';
    if (pessoa.ativo !== 1) return 'O responsável precisa ser um colaborador ativo.';
    return null;
  }

  lerEndereco(corpo) {
    const entrada = corpo || {};
    return {
      nome: String(entrada.nome || '').trim(),
      cidade: String(entrada.cidade || '').trim(),
      cep: String(entrada.cep || '').trim() || null,
      rua: String(entrada.rua || '').trim() || null,
      numero: String(entrada.numero || '').trim() || null,
      bairro: String(entrada.bairro || '').trim() || null,
      observacoes: String(entrada.observacoes || '').trim() || null
    };
  }

  validarEndereco(dados) {
    return (
      validador.textoDentroDoLimite(dados.nome, 120, 'O nome') ||
      validador.textoDentroDoLimite(dados.cidade, 100, 'A cidade') ||
      validador.textoDentroDoLimite(dados.cep, 20, 'O CEP') ||
      validador.textoDentroDoLimite(dados.rua, 120, 'A rua') ||
      validador.textoDentroDoLimite(dados.numero, 20, 'O número') ||
      validador.textoDentroDoLimite(dados.bairro, 100, 'O bairro') ||
      validador.textoDentroDoLimite(dados.observacoes, 500, 'As observações')
    );
  }

  lerResponsavelId(corpo) {
    const valor = corpo && corpo.responsavel_id;
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      return { id: null, invalido: false };
    }
    const id = validador.lerIdPositivo(valor);
    if (!id) return { id: null, invalido: true };
    return { id: id, invalido: false };
  }

  alojar(req, res) {
    const corpo = req.body || {};
    const pessoaId = validador.lerIdPositivo(corpo.pessoa_id);
    const leitoId = validador.lerIdPositivo(corpo.leito_id);
    const inicio = corpo.inicio ? datas.normalizarData(corpo.inicio) : datas.agoraLocal();

    if (!pessoaId || !leitoId) {
      return res.status(400).json({ erro: 'Informe o colaborador e o leito.' });
    }
    if (!inicio) {
      return res.status(400).json({ erro: 'Data de entrada inválida.' });
    }
    if (datas.noFuturo(inicio)) {
      return res.status(400).json({ erro: 'A entrada não pode ser numa data futura.' });
    }
    // A saída é registrada depois, em PUT /estadias/:id/saida. Antes a data vinha e era ignorada calada.
    if (corpo.fim) {
      return res.status(400).json({
        erro: 'A entrada não recebe data de saída. Registre a saída depois, quando a pessoa deixar o leito.'
      });
    }

    const pessoa = db.prepare('SELECT id, nome, ativo FROM pessoa WHERE id = ?').get(pessoaId);
    if (!pessoa) {
      return res.status(404).json({ erro: 'Colaborador não encontrado.' });
    }
    if (pessoa.ativo !== 1) {
      return res.status(400).json({ erro: 'Colaborador inativo não pode ser alojado.' });
    }

    const leito = db
      .prepare(
        'SELECT l.id, l.codigo, a.nome AS alojamento, a.ativo FROM leito l ' +
          'JOIN quarto q ON q.id = l.quarto_id JOIN alojamento a ON a.id = q.alojamento_id WHERE l.id = ?'
      )
      .get(leitoId);
    if (!leito) {
      return res.status(404).json({ erro: 'Leito não encontrado.' });
    }
    if (leito.ativo !== 1) {
      return res.status(400).json({ erro: 'Este alojamento está inativo.' });
    }

    // Impede que a mesma pessoa ocupe dois leitos ao mesmo tempo.
    const pessoaOcupada = db
      .prepare('SELECT id FROM estadia WHERE pessoa_id = ? AND (fim IS NULL OR fim > ?)')
      .get(pessoaId, inicio);
    if (pessoaOcupada) {
      return res.status(400).json({
        erro: pessoa.nome + ' já está alojado(a) em outro leito nesse período.'
      });
    }

    // Impede colocar duas pessoas no mesmo leito durante o mesmo período.
    const leitoOcupado = db
      .prepare('SELECT id FROM estadia WHERE leito_id = ? AND (fim IS NULL OR fim > ?)')
      .get(leitoId, inicio);
    if (leitoOcupado) {
      return res.status(400).json({
        erro: 'O leito ' + leito.codigo + ' já está ocupado nesse período.'
      });
    }

    const resultado = db
      .prepare('INSERT INTO estadia (pessoa_id, leito_id, inicio) VALUES (?, ?, ?)')
      .run(pessoaId, leitoId, inicio);
    const id = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'estadia',
      registroId: id,
      resumo: 'Alojou ' + pessoa.nome + ' no leito ' + leito.codigo + ' (' + leito.alojamento + ')',
      depois: {
        id: id,
        pessoa_id: pessoaId,
        leito_id: leitoId,
        inicio: inicio
      }
    });

    res.status(201).json({
      mensagem: 'Entrada registrada!',
      id: id
    });
  }

  registrarSaida(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de estadia inválido.' });
    }

    const estadia = db.prepare('SELECT * FROM estadia WHERE id = ?').get(id);
    if (!estadia) {
      return res.status(404).json({ erro: 'Estadia não encontrada.' });
    }
    if (estadia.fim) {
      return res.status(400).json({ erro: 'Essa estadia já foi encerrada.' });
    }

    const corpo = req.body || {};
    const fim = corpo.fim ? datas.normalizarData(corpo.fim) : datas.agoraLocal();
    if (!fim) {
      return res.status(400).json({ erro: 'Data de saída inválida.' });
    }
    if (datas.noFuturo(fim)) {
      return res.status(400).json({ erro: 'A saída não pode ser numa data futura.' });
    }
    if (fim <= estadia.inicio) {
      return res.status(400).json({
        erro: 'A saída precisa ser depois da entrada (' + estadia.inicio + ').'
      });
    }

    db.prepare('UPDATE estadia SET fim = ? WHERE id = ?').run(fim, id);
    const pessoa = db.prepare('SELECT nome FROM pessoa WHERE id = ?').get(estadia.pessoa_id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'estadia',
      registroId: id,
      resumo: 'Registrou a saída de ' + (pessoa ? pessoa.nome : 'colaborador') + ' do leito',
      antes: { fim: null },
      depois: { fim: fim }
    });

    res.json({ mensagem: 'Saída registrada!' });
  }

  resolverOcorrencia(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de ocorrência inválido.' });
    }

    const ocorrencia = db.prepare('SELECT * FROM ocorrencia WHERE id = ?').get(id);
    if (!ocorrencia) {
      return res.status(404).json({ erro: 'Ocorrência não encontrada.' });
    }
    if (ocorrencia.resolvida_em) {
      return res.status(400).json({ erro: 'Essa ocorrência já foi resolvida.' });
    }

    const corpo = req.body || {};
    const solucao = String(corpo.solucao || '').trim();
    if (solucao === '') {
      return res.status(400).json({ erro: 'Descreva a solução.' });
    }
    const erroSolucao = validador.textoDentroDoLimite(solucao, 500, 'A solução');
    if (erroSolucao) {
      return res.status(400).json({ erro: erroSolucao });
    }

    const resolvidaEm = corpo.resolvida_em ? datas.normalizarData(corpo.resolvida_em) : datas.agoraLocal();
    if (!resolvidaEm) {
      return res.status(400).json({ erro: 'Data de resolução inválida.' });
    }
    if (datas.noFuturo(resolvidaEm)) {
      return res.status(400).json({ erro: 'A resolução não pode ser numa data futura.' });
    }
    if (resolvidaEm <= ocorrencia.aberta_em) {
      return res.status(400).json({
        erro: 'A resolução precisa ser depois da abertura (' + ocorrencia.aberta_em + ').'
      });
    }

    db.prepare('UPDATE ocorrencia SET resolvida_em = ?, solucao = ? WHERE id = ?').run(
      resolvidaEm,
      solucao,
      id
    );

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'ocorrencia',
      registroId: id,
      resumo: 'Resolveu a ocorrência #' + id,
      antes: { resolvida_em: null },
      depois: {
        resolvida_em: resolvidaEm,
        solucao: solucao
      }
    });

    res.json({ mensagem: 'Ocorrência resolvida!' });
  }

  listar(req, res) {
    const filtro = req.query.status || 'ativos';
    let sql =
      'SELECT a.*, p.nome AS responsavel_nome, ' +
      '(SELECT COUNT(*) FROM quarto q WHERE q.alojamento_id = a.id) AS total_quartos, ' +
      '(SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS total_leitos, ' +
      '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
      ' WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS leitos_ocupados, ' +
      '(SELECT COUNT(*) FROM ocorrencia o WHERE o.alojamento_id = a.id AND o.resolvida_em IS NULL) AS ocorrencias_abertas ' +
      'FROM alojamento a LEFT JOIN pessoa p ON p.id = a.responsavel_id ';

    if (filtro === 'ativos') sql += 'WHERE a.ativo = 1 ';
    if (filtro === 'inativos') sql += 'WHERE a.ativo = 0 ';
    sql += 'ORDER BY a.ativo DESC, a.nome ASC';

    const alojamentos = db
      .prepare(sql)
      .all()
      .map((alojamento) => {
        alojamento.leitos_livres = alojamento.total_leitos - alojamento.leitos_ocupados;
        alojamento.ocupacao_pct =
          alojamento.total_leitos > 0
            ? Math.round((alojamento.leitos_ocupados / alojamento.total_leitos) * 100)
            : 0;
        return alojamento;
      });

    const totais = alojamentos.reduce(
      (acumulado, alojamento) => {
        acumulado.leitos += alojamento.total_leitos;
        acumulado.ocupados += alojamento.leitos_ocupados;
        acumulado.ocorrenciasAbertas += alojamento.ocorrencias_abertas;
        return acumulado;
      },
      {
        alojamentos: alojamentos.length,
        leitos: 0,
        ocupados: 0,
        ocorrenciasAbertas: 0
      }
    );

    res.json({
      totais: totais,
      alojamentos: alojamentos
    });
  }

  buscarPorId(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }

    const alojamento = db
      .prepare(
        'SELECT a.*, p.nome AS responsavel_nome FROM alojamento a LEFT JOIN pessoa p ON p.id = a.responsavel_id WHERE a.id = ?'
      )
      .get(id);
    if (!alojamento) {
      return res.status(404).json({ erro: 'Alojamento não encontrado.' });
    }

    const quartos = db
      .prepare('SELECT * FROM quarto WHERE alojamento_id = ? ORDER BY nome')
      .all(id);
    const leitosDoQuarto = db.prepare(
      'SELECT l.id, l.codigo, l.tipo, e.id AS estadia_id, e.inicio, p.id AS pessoa_id, p.nome AS pessoa_nome ' +
        'FROM leito l LEFT JOIN estadia e ON e.leito_id = l.id AND e.fim IS NULL ' +
        'LEFT JOIN pessoa p ON p.id = e.pessoa_id WHERE l.quarto_id = ? ORDER BY l.codigo'
    );
    quartos.forEach((quarto) => {
      quarto.leitos = leitosDoQuarto.all(quarto.id);
    });

    const ocorrencias = db
      .prepare(
        'SELECT o.*, p.nome AS pessoa_nome FROM ocorrencia o LEFT JOIN pessoa p ON p.id = o.pessoa_id ' +
          'WHERE o.alojamento_id = ? ORDER BY o.aberta_em DESC'
      )
      .all(id);

    res.json({
      alojamento: alojamento,
      quartos: quartos,
      ocorrencias: ocorrencias
    });
  }

  cadastrar(req, res) {
    const dados = this.lerEndereco(req.body);
    const responsavel = this.lerResponsavelId(req.body);
    if (dados.nome === '' || dados.cidade === '') {
      return res.status(400).json({ erro: 'Nome e cidade são obrigatórios.' });
    }

    const erroEnd = this.validarEndereco(dados);
    if (erroEnd) {
      return res.status(400).json({ erro: erroEnd });
    }
    if (responsavel.invalido) {
      return res.status(400).json({ erro: 'Responsável inválido.' });
    }

    const erroResp = this.conferirResponsavel(responsavel.id);
    if (erroResp) {
      return res.status(400).json({ erro: erroResp });
    }

    const resultado = db
      .prepare(
        'INSERT INTO alojamento (nome, responsavel_id, cidade, cep, rua, numero, bairro, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
      )
      .run(
        dados.nome,
        responsavel.id,
        dados.cidade,
        dados.cep,
        dados.rua,
        dados.numero,
        dados.bairro,
        dados.observacoes
      );
    const id = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'alojamento',
      registroId: id,
      resumo: 'Cadastrou o alojamento ' + dados.nome + ' (' + dados.cidade + ')',
      depois: Object.assign(
        {
          id: id,
          responsavel_id: responsavel.id
        },
        dados
      )
    });

    res.status(201).json({
      mensagem: 'Alojamento cadastrado!',
      id: id
    });
  }

  atualizar(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }

    const atual = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id);
    if (!atual) {
      return res.status(404).json({ erro: 'Alojamento não encontrado.' });
    }

    const dados = this.lerEndereco(req.body);
    const responsavel = this.lerResponsavelId(req.body);
    if (dados.nome === '' || dados.cidade === '') {
      return res.status(400).json({ erro: 'Nome e cidade são obrigatórios.' });
    }

    const erroEnd = this.validarEndereco(dados);
    if (erroEnd) {
      return res.status(400).json({ erro: erroEnd });
    }
    if (responsavel.invalido) {
      return res.status(400).json({ erro: 'Responsável inválido.' });
    }
    if (responsavel.id !== atual.responsavel_id) {
      const erroResp = this.conferirResponsavel(responsavel.id);
      if (erroResp) {
        return res.status(400).json({ erro: erroResp });
      }
    }

    db.prepare(
      'UPDATE alojamento SET nome = ?, responsavel_id = ?, cidade = ?, cep = ?, rua = ?, numero = ?, bairro = ?, observacoes = ? WHERE id = ?'
    ).run(
      dados.nome,
      responsavel.id,
      dados.cidade,
      dados.cep,
      dados.rua,
      dados.numero,
      dados.bairro,
      dados.observacoes,
      id
    );

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'alojamento',
      registroId: id,
      resumo: 'Atualizou o alojamento ' + dados.nome,
      antes: atual,
      depois: Object.assign(
        {
          id: id,
          responsavel_id: responsavel.id
        },
        dados
      )
    });

    res.json({ mensagem: 'Alojamento atualizado!' });
  }

  alterarStatus(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }

    const novoAtivo = req.body && req.body.ativo ? 1 : 0;
    const alojamento = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id);
    if (!alojamento) {
      return res.status(404).json({ erro: 'Alojamento não encontrado.' });
    }

    if (novoAtivo === 0) {
      const ocupado = db
        .prepare(
          'SELECT e.id FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
            'WHERE q.alojamento_id = ? AND e.fim IS NULL LIMIT 1'
        )
        .get(id);
      if (ocupado) {
        return res.status(400).json({
          erro: 'Não é possível desativar: ainda há colaboradores alojados. Registre as saídas antes.'
        });
      }
    }

    db.prepare('UPDATE alojamento SET ativo = ? WHERE id = ?').run(novoAtivo, id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
      tabela: 'alojamento',
      registroId: id,
      resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o alojamento ' + alojamento.nome,
      antes: { ativo: alojamento.ativo },
      depois: { ativo: novoAtivo }
    });

    res.json({
      mensagem: novoAtivo === 1 ? 'Alojamento reativado.' : 'Alojamento desativado.'
    });
  }

  cadastrarQuarto(req, res) {
    const alojamentoId = validador.lerIdPositivo(req.params.id);
    if (!alojamentoId) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }

    const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId);
    if (!alojamento) {
      return res.status(404).json({ erro: 'Alojamento não encontrado.' });
    }

    const corpo = req.body || {};
    const nome = String(corpo.nome || '').trim();
    const areaM2 = Number(corpo.area_m2);
    const leitos = Array.isArray(corpo.leitos)
      ? corpo.leitos.map((leito) => ({
          codigo: String((leito && leito.codigo) || '').trim(),
          tipo: leito && leito.tipo
        }))
      : [];

    if (nome === '') {
      return res.status(400).json({ erro: 'Informe o nome do quarto.' });
    }
    const erroNome = validador.textoDentroDoLimite(nome, 80, 'O nome do quarto');
    if (erroNome) {
      return res.status(400).json({ erro: erroNome });
    }
    for (let i = 0; i < leitos.length; i++) {
      const erroCod = validador.textoDentroDoLimite(leitos[i].codigo, 30, 'O código do leito');
      if (erroCod) return res.status(400).json({ erro: erroCod });
    }
    if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 10000) {
      return res.status(400).json({ erro: 'Informe uma área válida para o quarto em m².' });
    }

    // Confere as regras da NR-24: limite de 8 leitos e área mínima por cama/beliche.
    const erroValidacao = new Quarto(areaM2, leitos).validar();
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    // Usa transação (BEGIN / COMMIT) para não deixar quarto salvo sem seus leitos caso dê erro.
    db.exec('BEGIN');
    let quartoId;
    try {
      const resQuarto = db
        .prepare('INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)')
        .run(alojamentoId, nome, areaM2);
      quartoId = Number(resQuarto.lastInsertRowid);

      const inserirLeito = db.prepare(
        'INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)'
      );
      leitos.forEach((leito) => {
        inserirLeito.run(quartoId, leito.codigo, leito.tipo);
      });
      db.exec('COMMIT');
    } catch (erro) {
      db.exec('ROLLBACK');
      console.error('Erro ao salvar quarto:', erro);
      return res.status(500).json({ erro: 'Não foi possível salvar o quarto.' });
    }

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'quarto',
      registroId: quartoId,
      resumo:
        'Cadastrou o quarto ' +
        nome +
        ' (' +
        leitos.length +
        ' leitos) no alojamento ' +
        alojamento.nome,
      depois: {
        id: quartoId,
        alojamento_id: alojamentoId,
        nome: nome,
        area_m2: areaM2,
        leitos: leitos
      }
    });

    res.status(201).json({
      mensagem: 'Quarto cadastrado!',
      id: quartoId
    });
  }

  registrarOcorrencia(req, res) {
    const alojamentoId = validador.lerIdPositivo(req.params.id);
    if (!alojamentoId) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }

    const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId);
    if (!alojamento) {
      return res.status(404).json({ erro: 'Alojamento não encontrado.' });
    }

    const corpo = req.body || {};
    const tipo = corpo.tipo;
    const descricao = String(corpo.descricao || '').trim();
    const temPessoa =
      corpo.pessoa_id !== undefined &&
      corpo.pessoa_id !== null &&
      String(corpo.pessoa_id).trim() !== '';
    const pessoaId = temPessoa ? validador.lerIdPositivo(corpo.pessoa_id) : null;

    if (temPessoa && !pessoaId) {
      return res.status(400).json({ erro: 'Colaborador inválido.' });
    }
    if (!this.tiposOcorrencia.includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo de ocorrência inválido.' });
    }
    if (descricao === '') {
      return res.status(400).json({ erro: 'Descreva a ocorrência.' });
    }
    const erroDesc = validador.textoDentroDoLimite(descricao, 500, 'A descrição');
    if (erroDesc) {
      return res.status(400).json({ erro: erroDesc });
    }
    if (pessoaId && !db.prepare('SELECT id FROM pessoa WHERE id = ?').get(pessoaId)) {
      return res.status(404).json({ erro: 'Colaborador não encontrado.' });
    }

    const abertaEm = datas.agoraLocal();
    const resultado = db
      .prepare(
        'INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em) VALUES (?, ?, ?, ?, ?)'
      )
      .run(alojamentoId, pessoaId, tipo, descricao, abertaEm);
    const id = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'ocorrencia',
      registroId: id,
      resumo: 'Abriu ocorrência (' + tipo + ') no alojamento ' + alojamento.nome,
      depois: {
        id: id,
        alojamento_id: alojamentoId,
        pessoa_id: pessoaId,
        tipo: tipo,
        descricao: descricao,
        aberta_em: abertaEm
      }
    });

    res.status(201).json({
      mensagem: 'Ocorrência registrada!',
      id: id
    });
  }
}

module.exports = ControladorAlojamentos;
