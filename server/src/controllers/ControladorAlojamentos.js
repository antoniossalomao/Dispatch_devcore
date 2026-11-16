const Quarto = require('../models/Quarto');
// Ações de alojamentos.
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const { agoraLocal, normalizarData } = require('../regras/datas');
const { lerIdPositivo, textoDentroDoLimite } = require('../regras/validacao');

class ControladorAlojamentos {
  constructor() {
    this.tiposOcorrencia = ['manutencao', 'conflito', 'reclamacao', 'regra', 'outro'];
  }

  // A6: o responsavel tem que ser um colaborador ativo

  conferirResponsavel(responsavelId) {
    if (responsavelId === null) return null;
    const pessoa = db.prepare('SELECT id, ativo FROM pessoa WHERE id = ?').get(responsavelId);
    if (!pessoa) return 'Responsável não encontrado.';
    if (pessoa.ativo !== 1) return 'O responsável precisa ser um colaborador ativo.';
    return null;
  }
  // A4 e A5: no maximo 8 leitos e a area precisa caber os leitos

  lerEndereco(corpo) {
    const b = corpo || {};
    return {
      nome: String(b.nome || '').trim(),
      cidade: String(b.cidade || '').trim(),
      cep: String(b.cep || '').trim() || null,
      rua: String(b.rua || '').trim() || null,
      numero: String(b.numero || '').trim() || null,
      bairro: String(b.bairro || '').trim() || null,
      observacoes: String(b.observacoes || '').trim() || null
    };
  }

  validarEndereco(dados) {
    return (
      textoDentroDoLimite(dados.nome, 120, 'O nome') ||
      textoDentroDoLimite(dados.cidade, 100, 'A cidade') ||
      textoDentroDoLimite(dados.cep, 20, 'O CEP') ||
      textoDentroDoLimite(dados.rua, 120, 'A rua') ||
      textoDentroDoLimite(dados.numero, 20, 'O número') ||
      textoDentroDoLimite(dados.bairro, 100, 'O bairro') ||
      textoDentroDoLimite(dados.observacoes, 500, 'As observações')
    );
  }

  lerResponsavelId(corpo) {
    const valor = corpo && corpo.responsavel_id;
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      return { id: null, invalido: false };
    }
    const id = lerIdPositivo(valor);
    if (!id) return { id: null, invalido: true };
    return { id: id, invalido: false };
  }

  alojar(req, res) {
    const b = req.body || {};
    const pessoaId = lerIdPositivo(b.pessoa_id);
    const leitoId = lerIdPositivo(b.leito_id);
    const inicio = b.inicio ? normalizarData(b.inicio) : agoraLocal();
    if (!pessoaId || !leitoId) {
      return res.status(400).json({
        erro: 'Informe o colaborador e o leito.'
      });
    }
    if (!inicio) {
      return res.status(400).json({
        erro: 'Data de entrada inválida.'
      });
    }
    const pessoa = db.prepare('SELECT id, nome, ativo FROM pessoa WHERE id = ?').get(pessoaId);
    if (!pessoa)
      return res.status(404).json({
        erro: 'Colaborador não encontrado.'
      });
    if (pessoa.ativo !== 1)
      return res.status(400).json({
        erro: 'Colaborador inativo não pode ser alojado.'
      });
    const leito = db
      .prepare(
        'SELECT l.id, l.codigo, a.nome AS alojamento, a.ativo FROM leito l ' +
          'JOIN quarto q ON q.id = l.quarto_id JOIN alojamento a ON a.id = q.alojamento_id WHERE l.id = ?'
      )
      .get(leitoId);
    if (!leito)
      return res.status(404).json({
        erro: 'Leito não encontrado.'
      });
    if (leito.ativo !== 1)
      return res.status(400).json({
        erro: 'Este alojamento está inativo.'
      });

    // A2: a pessoa nao pode estar em dois leitos ao mesmo tempo
    const pessoaOcupada = db
      .prepare('SELECT id FROM estadia WHERE pessoa_id = ? AND (fim IS NULL OR fim > ?)')
      .get(pessoaId, inicio);
    if (pessoaOcupada) {
      return res.status(400).json({
        erro: pessoa.nome + ' já está alojado(a) em outro leito nesse período.'
      });
    }

    // A1: o leito nao pode ter duas pessoas no mesmo periodo
    const leitoOcupado = db
      .prepare('SELECT id FROM estadia WHERE leito_id = ? AND (fim IS NULL OR fim > ?)')
      .get(leitoId, inicio);
    if (leitoOcupado) {
      return res.status(400).json({
        erro: 'O leito ' + leito.codigo + ' já está ocupado nesse período.'
      });
    }
    const r = db
      .prepare('INSERT INTO estadia (pessoa_id, leito_id, inicio) VALUES (?, ?, ?)')
      .run(pessoaId, leitoId, inicio);
    const id = Number(r.lastInsertRowid);
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
    const id = lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de estadia inválido.' });
    }
    const estadia = db.prepare('SELECT * FROM estadia WHERE id = ?').get(id);
    if (!estadia)
      return res.status(404).json({
        erro: 'Estadia não encontrada.'
      });
    if (estadia.fim)
      return res.status(400).json({
        erro: 'Essa estadia já foi encerrada.'
      });
    const b = req.body || {};
    const fim = b.fim ? normalizarData(b.fim) : agoraLocal();
    if (!fim)
      return res.status(400).json({
        erro: 'Data de saída inválida.'
      });
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
      antes: {
        fim: null
      },
      depois: {
        fim: fim
      }
    });
    res.json({
      mensagem: 'Saída registrada!'
    });
  }

  resolverOcorrencia(req, res) {
    const id = lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de ocorrência inválido.' });
    }
    const ocorrencia = db.prepare('SELECT * FROM ocorrencia WHERE id = ?').get(id);
    if (!ocorrencia)
      return res.status(404).json({
        erro: 'Ocorrência não encontrada.'
      });
    if (ocorrencia.resolvida_em)
      return res.status(400).json({
        erro: 'Essa ocorrência já foi resolvida.'
      });
    const b = req.body || {};
    const solucao = String(b.solucao || '').trim();
    if (solucao === '')
      return res.status(400).json({
        erro: 'Descreva a solução.'
      });
    const erroSolucao = textoDentroDoLimite(solucao, 500, 'A solução');
    if (erroSolucao) {
      return res.status(400).json({ erro: erroSolucao });
    }
    const resolvidaEm = b.resolvida_em ? normalizarData(b.resolvida_em) : agoraLocal();
    if (!resolvidaEm)
      return res.status(400).json({
        erro: 'Data de resolução inválida.'
      });
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
      antes: {
        resolvida_em: null
      },
      depois: {
        resolvida_em: resolvidaEm,
        solucao: solucao
      }
    });
    res.json({
      mensagem: 'Ocorrência resolvida!'
    });
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
      .map((a) => {
        a.leitos_livres = a.total_leitos - a.leitos_ocupados;
        a.ocupacao_pct =
          a.total_leitos > 0 ? Math.round((a.leitos_ocupados / a.total_leitos) * 100) : 0;
        return a;
      });
    const totais = alojamentos.reduce(
      (t, a) => {
        t.leitos += a.total_leitos;
        t.ocupados += a.leitos_ocupados;
        t.ocorrenciasAbertas += a.ocorrencias_abertas;
        return t;
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
    const id = lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }
    const alojamento = db
      .prepare(
        'SELECT a.*, p.nome AS responsavel_nome FROM alojamento a LEFT JOIN pessoa p ON p.id = a.responsavel_id WHERE a.id = ?'
      )
      .get(id);
    if (!alojamento)
      return res.status(404).json({
        erro: 'Alojamento não encontrado.'
      });
    const quartos = db
      .prepare('SELECT * FROM quarto WHERE alojamento_id = ? ORDER BY nome')
      .all(id);
    const leitosDoQuarto = db.prepare(
      'SELECT l.id, l.codigo, l.tipo, e.id AS estadia_id, e.inicio, p.id AS pessoa_id, p.nome AS pessoa_nome ' +
        'FROM leito l LEFT JOIN estadia e ON e.leito_id = l.id AND e.fim IS NULL ' +
        'LEFT JOIN pessoa p ON p.id = e.pessoa_id WHERE l.quarto_id = ? ORDER BY l.codigo'
    );
    quartos.forEach((q) => {
      q.leitos = leitosDoQuarto.all(q.id);
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
    const resp = this.lerResponsavelId(req.body);
    if (dados.nome === '' || dados.cidade === '') {
      return res.status(400).json({
        erro: 'Nome e cidade são obrigatórios.'
      });
    }
    const erroEnd = this.validarEndereco(dados);
    if (erroEnd) {
      return res.status(400).json({ erro: erroEnd });
    }
    if (resp.invalido) {
      return res.status(400).json({ erro: 'Responsável inválido.' });
    }
    const erroResp = this.conferirResponsavel(resp.id);
    if (erroResp)
      return res.status(400).json({
        erro: erroResp
      });
    const r = db
      .prepare(
        'INSERT INTO alojamento (nome, responsavel_id, cidade, cep, rua, numero, bairro, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
      )
      .run(
        dados.nome,
        resp.id,
        dados.cidade,
        dados.cep,
        dados.rua,
        dados.numero,
        dados.bairro,
        dados.observacoes
      );
    const id = Number(r.lastInsertRowid);
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'alojamento',
      registroId: id,
      resumo: 'Cadastrou o alojamento ' + dados.nome + ' (' + dados.cidade + ')',
      depois: Object.assign(
        {
          id: id,
          responsavel_id: resp.id
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
    const id = lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }
    const atual = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id);
    if (!atual)
      return res.status(404).json({
        erro: 'Alojamento não encontrado.'
      });
    const dados = this.lerEndereco(req.body);
    const resp = this.lerResponsavelId(req.body);
    if (dados.nome === '' || dados.cidade === '') {
      return res.status(400).json({
        erro: 'Nome e cidade são obrigatórios.'
      });
    }
    const erroEnd = this.validarEndereco(dados);
    if (erroEnd) {
      return res.status(400).json({ erro: erroEnd });
    }
    if (resp.invalido) {
      return res.status(400).json({ erro: 'Responsável inválido.' });
    }
    if (resp.id !== atual.responsavel_id) {
      const erroResp = this.conferirResponsavel(resp.id);
      if (erroResp)
        return res.status(400).json({
          erro: erroResp
        });
    }
    db.prepare(
      'UPDATE alojamento SET nome = ?, responsavel_id = ?, cidade = ?, cep = ?, rua = ?, numero = ?, bairro = ?, observacoes = ? WHERE id = ?'
    ).run(
      dados.nome,
      resp.id,
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
          responsavel_id: resp.id
        },
        dados
      )
    });
    res.json({
      mensagem: 'Alojamento atualizado!'
    });
  }

  alterarStatus(req, res) {
    const id = lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }
    const novoAtivo = req.body && req.body.ativo ? 1 : 0;
    const alojamento = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id);
    if (!alojamento)
      return res.status(404).json({
        erro: 'Alojamento não encontrado.'
      });
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
      antes: {
        ativo: alojamento.ativo
      },
      depois: {
        ativo: novoAtivo
      }
    });
    res.json({
      mensagem: novoAtivo === 1 ? 'Alojamento reativado.' : 'Alojamento desativado.'
    });
  }

  cadastrarQuarto(req, res) {
    const alojamentoId = lerIdPositivo(req.params.id);
    if (!alojamentoId) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }
    const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId);
    if (!alojamento)
      return res.status(404).json({
        erro: 'Alojamento não encontrado.'
      });
    const b = req.body || {};
    const nome = String(b.nome || '').trim();
    const areaM2 = Number(b.area_m2);
    const leitos = Array.isArray(b.leitos)
      ? b.leitos.map((l) => {
          return {
            codigo: String((l && l.codigo) || '').trim(),
            tipo: l && l.tipo
          };
        })
      : [];
    if (nome === '')
      return res.status(400).json({
        erro: 'Informe o nome do quarto.'
      });
    const erroNome = textoDentroDoLimite(nome, 80, 'O nome do quarto');
    if (erroNome) {
      return res.status(400).json({ erro: erroNome });
    }
    for (let i = 0; i < leitos.length; i++) {
      const erroCod = textoDentroDoLimite(leitos[i].codigo, 30, 'O código do leito');
      if (erroCod) return res.status(400).json({ erro: erroCod });
    }
    if (!Number.isFinite(areaM2) || areaM2 <= 0 || areaM2 > 10000)
      return res.status(400).json({
        erro: 'Informe uma área válida para o quarto em m².'
      });
    const erro = new Quarto(areaM2, leitos).validar();
    if (erro)
      return res.status(400).json({
        erro: erro
      });
    db.exec('BEGIN');
    let quartoId;
    try {
      const rq = db
        .prepare('INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)')
        .run(alojamentoId, nome, areaM2);
      quartoId = Number(rq.lastInsertRowid);
      const inserirLeito = db.prepare(
        'INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)'
      );
      leitos.forEach((l) => {
        inserirLeito.run(quartoId, l.codigo, l.tipo);
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      console.error('Erro ao salvar quarto:', e);
      return res.status(500).json({
        erro: 'Não foi possível salvar o quarto.'
      });
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
    const alojamentoId = lerIdPositivo(req.params.id);
    if (!alojamentoId) {
      return res.status(400).json({ erro: 'ID de alojamento inválido.' });
    }
    const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId);
    if (!alojamento)
      return res.status(404).json({
        erro: 'Alojamento não encontrado.'
      });
    const b = req.body || {};
    const tipo = b.tipo;
    const descricao = String(b.descricao || '').trim();
    const temPessoa = b.pessoa_id !== undefined && b.pessoa_id !== null && String(b.pessoa_id).trim() !== '';
    const pessoaId = temPessoa ? lerIdPositivo(b.pessoa_id) : null;
    if (temPessoa && !pessoaId) {
      return res.status(400).json({ erro: 'Colaborador inválido.' });
    }
    if (this.tiposOcorrencia.indexOf(tipo) === -1)
      return res.status(400).json({
        erro: 'Tipo de ocorrência inválido.'
      });
    if (descricao === '')
      return res.status(400).json({
        erro: 'Descreva a ocorrência.'
      });
    const erroDesc = textoDentroDoLimite(descricao, 500, 'A descrição');
    if (erroDesc) {
      return res.status(400).json({ erro: erroDesc });
    }
    if (pessoaId && !db.prepare('SELECT id FROM pessoa WHERE id = ?').get(pessoaId)) {
      return res.status(404).json({
        erro: 'Colaborador não encontrado.'
      });
    }
    const abertaEm = agoraLocal();
    const r = db
      .prepare(
        'INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em) VALUES (?, ?, ?, ?, ?)'
      )
      .run(alojamentoId, pessoaId, tipo, descricao, abertaEm);
    const id = Number(r.lastInsertRowid);
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
