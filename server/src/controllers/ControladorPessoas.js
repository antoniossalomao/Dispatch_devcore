const Cnh = require('../models/Cnh');
const db = require('../db/conexao');
const CargaExemplos = require('../db/seed');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const datas = require('../regras/datas');
const validador = require('../regras/validacao');

// Controla o cadastro, edição, ativação/inativação e ficha completa dos colaboradores.
class ControladorPessoas {
  // Aceita formatos como "A,B", "ab" ou "b d" e organiza sempre no padrão ordenado ("A,B").
  normalizarCategoriasCnh(valor) {
    const bruto = String(valor || '').trim().toUpperCase();
    if (bruto === '') return { erro: null, valor: '' };

    const partes = bruto.includes(',')
      ? bruto
          .split(',')
          .map((cat) => cat.trim())
          .filter(Boolean)
      : bruto.split('');

    if (partes.length === 0 || partes.some((cat) => !['A', 'B', 'C', 'D', 'E'].includes(cat))) {
      return {
        erro: 'Categorias de CNH inválidas (use apenas A, B, C, D ou E).',
        valor: ''
      };
    }

    const ordem = ['A', 'B', 'C', 'D', 'E'].filter((cat) => partes.includes(cat));
    return { erro: null, valor: ordem.join(',') };
  }

  listar(req, res) {
    const busca = validador.paraBusca(String(req.query.busca || '').slice(0, 100));
    const filtroStatus = req.query.status || 'ativos';
    const filtroCnh = req.query.cnh || 'todos';
    const cfg = configuracao.lerConfig();
    const diasAlerta = cfg.diasAvisoVencimento || 30;

    let sql = 'SELECT * FROM pessoa WHERE 1=1 ';
    if (filtroStatus === 'ativos') {
      sql += 'AND ativo = 1 ';
    } else if (filtroStatus === 'inativos') {
      sql += 'AND ativo = 0 ';
    }
    sql += 'ORDER BY ativo DESC, nome ASC';

    const pessoas = db.prepare(sql).all();
    const estadiasAtivas = db
      .prepare(
        'SELECT e.pessoa_id, a.nome AS alojamento_nome, q.nome AS quarto_nome, l.codigo AS leito_codigo, e.inicio ' +
          'FROM estadia e ' +
          'JOIN leito l ON l.id = e.leito_id ' +
          'JOIN quarto q ON q.id = l.quarto_id ' +
          'JOIN alojamento a ON a.id = q.alojamento_id ' +
          'WHERE e.fim IS NULL'
      )
      .all();
    const usosAtivos = db
      .prepare(
        // Pega quem está dirigindo e também quem foi de passageiro: os dois estão na rua
        // e não podem entrar em outra viagem (regra F2).
        'SELECT u.motorista_id AS pessoa_id, v.modelo, v.placa, u.destino, u.saida ' +
          'FROM uso_veiculo u ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'WHERE u.retorno IS NULL ' +
          'UNION ' +
          'SELECT up.pessoa_id, v.modelo, v.placa, u.destino, u.saida ' +
          'FROM uso_passageiro up ' +
          'JOIN uso_veiculo u ON u.id = up.uso_veiculo_id ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'WHERE u.retorno IS NULL'
      )
      .all();

    const mapaEstadia = {};
    estadiasAtivas.forEach((estadia) => {
      mapaEstadia[estadia.pessoa_id] = estadia;
    });

    const mapaUso = {};
    usosAtivos.forEach((uso) => {
      mapaUso[uso.pessoa_id] = uso;
    });

    const listaCompleta = pessoas.map((pessoa) => {
      const situacaoCnh = new Cnh(pessoa.cnh_categorias, pessoa.cnh_validade).situacao(diasAlerta);
      const estadiaAtual = mapaEstadia[pessoa.id] || null;
      const usoAtual = mapaUso[pessoa.id] || null;
      return {
        id: pessoa.id,
        nome: pessoa.nome,
        matricula: pessoa.matricula,
        cargo: pessoa.cargo,
        obra: pessoa.obra || 'Sede / Aguapeí',
        telefone: pessoa.telefone || '',
        cnh_categorias: pessoa.cnh_categorias || '',
        cnh_validade: pessoa.cnh_validade || '',
        ativo: pessoa.ativo,
        cnh_info: situacaoCnh,
        alojamento_atual: estadiaAtual
          ? {
              alojamento: estadiaAtual.alojamento_nome,
              quarto: estadiaAtual.quarto_nome,
              leito: estadiaAtual.leito_codigo,
              desde: estadiaAtual.inicio
            }
          : null,
        veiculo_atual: usoAtual
          ? {
              modelo: usoAtual.modelo,
              placa: usoAtual.placa,
              destino: usoAtual.destino,
              desde: usoAtual.saida
            }
          : null
      };
    });

    // Aplica os filtros de busca por texto e situação de CNH depois de calcular os indicadores de cada pessoa.
    const resultado = listaCompleta.filter((pessoa) => {
      if (busca !== '') {
        const textoPessoa = validador.paraBusca(
          pessoa.nome + ' ' + pessoa.matricula + ' ' + pessoa.cargo + ' ' + pessoa.obra
        );
        const bateuBusca = textoPessoa.includes(busca);
        if (!bateuBusca) return false;
      }
      if (filtroCnh === 'com_cnh') return pessoa.cnh_info.status !== 'sem_cnh';
      if (filtroCnh === 'vencendo') {
        return pessoa.cnh_info.status === 'vencendo' || pessoa.cnh_info.status === 'vencida';
      }
      if (filtroCnh === 'sem_cnh') return pessoa.cnh_info.status === 'sem_cnh';
      return true;
    });

    const totais = {
      total: pessoas.length,
      ativos: pessoas.filter((item) => item.ativo === 1).length,
      comCnh: listaCompleta.filter((item) => item.cnh_info.status !== 'sem_cnh').length,
      cnhAlerta: listaCompleta.filter(
        (item) => item.cnh_info.status === 'vencendo' || item.cnh_info.status === 'vencida'
      ).length,
      alojados: Object.keys(mapaEstadia).length,
      emTransito: Object.keys(mapaUso).length
    };

    res.json({
      totais: totais,
      colaboradores: resultado
    });
  }

  buscarPorId(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de colaborador inválido.' });
    }

    const pessoa = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id);
    if (!pessoa) {
      return res.status(404).json({ erro: 'Colaborador não encontrado.' });
    }

    const cfg = configuracao.lerConfig();
    const situacaoCnh = new Cnh(pessoa.cnh_categorias, pessoa.cnh_validade).situacao(
      cfg.diasAvisoVencimento
    );
    const estadias = db
      .prepare(
        'SELECT e.id, a.nome AS alojamento, q.nome AS quarto, l.codigo AS leito, e.inicio, e.fim ' +
          'FROM estadia e ' +
          'JOIN leito l ON l.id = e.leito_id ' +
          'JOIN quarto q ON q.id = l.quarto_id ' +
          'JOIN alojamento a ON a.id = q.alojamento_id ' +
          'WHERE e.pessoa_id = ? ' +
          'ORDER BY e.inicio DESC'
      )
      .all(id);
    const usosMotorista = db
      .prepare(
        'SELECT u.id, v.modelo, v.placa, u.destino, u.saida, u.retorno, u.km_saida, u.km_retorno, ' +
          '(CASE WHEN u.km_retorno IS NOT NULL THEN (u.km_retorno - u.km_saida) ELSE NULL END) AS km_rodados ' +
          'FROM uso_veiculo u ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'WHERE u.motorista_id = ? ' +
          'ORDER BY u.saida DESC'
      )
      .all(id);
    const usosPassageiro = db
      .prepare(
        'SELECT u.id, v.modelo, v.placa, p_motorista.nome AS motorista, u.destino, u.saida, u.retorno ' +
          'FROM uso_passageiro up ' +
          'JOIN uso_veiculo u ON u.id = up.uso_veiculo_id ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'JOIN pessoa p_motorista ON p_motorista.id = u.motorista_id ' +
          'WHERE up.pessoa_id = ? ' +
          'ORDER BY u.saida DESC'
      )
      .all(id);
    const ocorrencias = db
      .prepare(
        'SELECT o.id, a.nome AS alojamento, o.tipo, o.descricao, o.aberta_em, o.resolvida_em, o.solucao ' +
          'FROM ocorrencia o ' +
          'JOIN alojamento a ON a.id = o.alojamento_id ' +
          'WHERE o.pessoa_id = ? ' +
          'ORDER BY o.aberta_em DESC'
      )
      .all(id);

    res.json({
      colaborador: {
        id: pessoa.id,
        nome: pessoa.nome,
        matricula: pessoa.matricula,
        cargo: pessoa.cargo,
        obra: pessoa.obra,
        telefone: pessoa.telefone,
        cnh_categorias: pessoa.cnh_categorias,
        cnh_validade: pessoa.cnh_validade,
        ativo: pessoa.ativo,
        cnh_info: situacaoCnh
      },
      estadias: estadias,
      usos_motorista: usosMotorista,
      usos_passageiro: usosPassageiro,
      ocorrencias: ocorrencias
    });
  }

  cadastrar(req, res) {
    const corpo = req.body || {};
    const nome = String(corpo.nome || '').trim();
    const matricula = String(corpo.matricula || '').trim().toUpperCase();
    const cargo = String(corpo.cargo || '').trim();
    const obra = String(corpo.obra || '').trim();
    const telefone = String(corpo.telefone || '').trim();
    const cnh = this.normalizarCategoriasCnh(corpo.cnh_categorias);
    const cnhValidade = String(corpo.cnh_validade || '').trim();

    if (nome === '' || matricula === '' || cargo === '') {
      return res.status(400).json({ erro: 'Nome, matrícula e cargo são obrigatórios.' });
    }
    const erroTexto =
      validador.textoDentroDoLimite(nome, 120, 'O nome') ||
      validador.textoDentroDoLimite(matricula, 40, 'A matrícula') ||
      validador.textoDentroDoLimite(cargo, 80, 'O cargo') ||
      validador.textoDentroDoLimite(obra, 100, 'A obra') ||
      validador.textoDentroDoLimite(telefone, 30, 'O telefone') ||
      cnh.erro;
    if (erroTexto) {
      return res.status(400).json({ erro: erroTexto });
    }

    const jaExiste = db.prepare('SELECT id FROM pessoa WHERE matricula = ?').get(matricula);
    if (jaExiste) {
      return res.status(400).json({
        erro: 'Já existe um colaborador com a matrícula ' + matricula + '.'
      });
    }
    if (cnh.valor !== '' && cnhValidade === '') {
      return res.status(400).json({ erro: 'Informe a data de validade da CNH.' });
    }
    if (cnhValidade !== '' && !datas.dataIsoValida(cnhValidade)) {
      return res.status(400).json({ erro: 'Data de validade da CNH inválida.' });
    }

    const resultado = db
      .prepare(
        'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
      )
      .run(
        nome,
        matricula,
        cargo,
        obra === '' ? 'Sede' : obra,
        telefone === '' ? null : telefone,
        cnh.valor === '' ? null : cnh.valor,
        cnhValidade === '' ? null : cnhValidade
      );
    const novoId = Number(resultado.lastInsertRowid);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'criou',
      tabela: 'pessoa',
      registroId: novoId,
      resumo: 'Cadastrou o colaborador ' + nome + ' (matrícula ' + matricula + ')',
      depois: {
        id: novoId,
        nome: nome,
        matricula: matricula,
        cargo: cargo,
        obra: obra,
        cnh_categorias: cnh.valor
      }
    });

    res.status(201).json({
      mensagem: 'Colaborador cadastrado com sucesso!',
      id: novoId
    });
  }

  atualizar(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de colaborador inválido.' });
    }

    const pessoaAtual = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id);
    if (!pessoaAtual) {
      return res.status(404).json({ erro: 'Colaborador não encontrado.' });
    }

    const corpo = req.body || {};
    const nome = String(corpo.nome || '').trim();
    const matricula = String(corpo.matricula || '').trim().toUpperCase();
    const cargo = String(corpo.cargo || '').trim();
    const obra = String(corpo.obra || '').trim();
    const telefone = String(corpo.telefone || '').trim();
    const cnh = this.normalizarCategoriasCnh(corpo.cnh_categorias);
    const cnhValidade = String(corpo.cnh_validade || '').trim();

    if (nome === '' || matricula === '' || cargo === '') {
      return res.status(400).json({ erro: 'Nome, matrícula e cargo são obrigatórios.' });
    }
    const erroTexto =
      validador.textoDentroDoLimite(nome, 120, 'O nome') ||
      validador.textoDentroDoLimite(matricula, 40, 'A matrícula') ||
      validador.textoDentroDoLimite(cargo, 80, 'O cargo') ||
      validador.textoDentroDoLimite(obra, 100, 'A obra') ||
      validador.textoDentroDoLimite(telefone, 30, 'O telefone') ||
      cnh.erro;
    if (erroTexto) {
      return res.status(400).json({ erro: erroTexto });
    }

    const conflito = db
      .prepare('SELECT id FROM pessoa WHERE matricula = ? AND id != ?')
      .get(matricula, id);
    if (conflito) {
      return res.status(400).json({
        erro: 'A matrícula ' + matricula + ' já está em uso por outro colaborador.'
      });
    }
    if (cnh.valor !== '' && cnhValidade === '') {
      return res.status(400).json({ erro: 'Informe a data de validade da CNH.' });
    }
    if (cnhValidade !== '' && !datas.dataIsoValida(cnhValidade)) {
      return res.status(400).json({ erro: 'Data de validade da CNH inválida.' });
    }

    db.prepare(
      'UPDATE pessoa SET nome = ?, matricula = ?, cargo = ?, obra = ?, telefone = ?, cnh_categorias = ?, cnh_validade = ? ' +
        'WHERE id = ?'
    ).run(
      nome,
      matricula,
      cargo,
      obra === '' ? 'Sede' : obra,
      telefone === '' ? null : telefone,
      cnh.valor === '' ? null : cnh.valor,
      cnhValidade === '' ? null : cnhValidade,
      id
    );

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'pessoa',
      registroId: id,
      resumo: 'Atualizou dados do colaborador ' + nome + ' (' + matricula + ')',
      antes: pessoaAtual,
      depois: {
        id: id,
        nome: nome,
        matricula: matricula,
        cargo: cargo,
        obra: obra,
        cnh_categorias: cnh.valor,
        cnh_validade: cnhValidade
      }
    });

    res.json({ mensagem: 'Dados do colaborador atualizados!' });
  }

  alterarStatus(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de colaborador inválido.' });
    }

    const novoAtivo = req.body && req.body.ativo ? 1 : 0;
    const pessoa = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id);
    if (!pessoa) {
      return res.status(404).json({ erro: 'Colaborador não encontrado.' });
    }

    if (novoAtivo === 0) {
      const estadiaAberta = db
        .prepare('SELECT id FROM estadia WHERE pessoa_id = ? AND fim IS NULL')
        .get(id);
      if (estadiaAberta) {
        return res.status(400).json({
          erro: 'Não é possível desativar: o colaborador está atualmente ocupando um leito em alojamento. Registre a saída antes.'
        });
      }
      const usoAberto = db
        .prepare('SELECT id FROM uso_veiculo WHERE motorista_id = ? AND retorno IS NULL')
        .get(id);
      if (usoAberto) {
        return res.status(400).json({
          erro: 'Não é possível desativar: o colaborador está em trânsito com um veículo da frota. Registre a devolução antes.'
        });
      }
    }

    db.prepare('UPDATE pessoa SET ativo = ? WHERE id = ?').run(novoAtivo, id);

    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
      tabela: 'pessoa',
      registroId: id,
      resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o colaborador ' + pessoa.nome,
      antes: { ativo: pessoa.ativo },
      depois: { ativo: novoAtivo }
    });

    res.json({
      mensagem:
        novoAtivo === 1
          ? 'Colaborador reativado com sucesso.'
          : 'Colaborador desativado do quadro ativo.'
    });
  }

  // Carrega os dados de demonstração da Construtora Aguapeí (os mesmos do "npm run seed").
  // Só funciona com o banco ainda sem colaboradores, para nunca misturar com dados de verdade.
  carregarExemplos(req, res, next) {
    try {
      const resumo = new CargaExemplos().carregar();
      res.json({
        mensagem:
          'Dados de demonstração carregados: ' +
          resumo.colaboradores +
          ' colaboradores, ' +
          resumo.alojamentos +
          ' alojamentos e ' +
          resumo.veiculos +
          ' veículos com 6 meses de histórico.'
      });
    } catch (erro) {
      if (/já possui colaboradores/.test(erro.message)) {
        return res.status(400).json({ erro: erro.message });
      }
      next(erro);
    }
  }
}

module.exports = ControladorPessoas;
