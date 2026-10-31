// rotas para gerenciamento de colaboradores (cadastro, consulta, historico e situacao)
const express = require('express')
const db = require('../db/conexao')
const auditoria = require('../regras/auditoria')
const regrasCnh = require('../regras/cnh')
const rotasConfig = require('./configuracoes')

const router = express.Router()

// middleware de autenticacao simples
function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para acessar.' })
  }
  next()
}

router.use(exigirLogin)

// lista todos os colaboradores com situacao atual (leito e carro) e status da CNH
router.get('/', function (req, res) {
  const busca = (req.query.busca || '').trim().toLowerCase()
  const filtroStatus = req.query.status || 'ativos' // 'ativos', 'inativos' ou 'todos'
  const filtroCnh = req.query.cnh || 'todos' // 'todos', 'com_cnh', 'vencendo', 'sem_cnh'

  const cfg = rotasConfig.lerConfig ? rotasConfig.lerConfig() : { diasAvisoVencimento: 30 }
  const diasAlerta = cfg.diasAvisoVencimento || 30

  let sql = 'SELECT * FROM pessoa WHERE 1=1 '

  if (filtroStatus === 'ativos') {
    sql += 'AND ativo = 1 '
  } else if (filtroStatus === 'inativos') {
    sql += 'AND ativo = 0 '
  }

  sql += 'ORDER BY ativo DESC, nome ASC'

  const pessoas = db.prepare(sql).all()

  // busca quem esta atualmente em leito e quem esta com veiculo
  const estadiasAtivas = db.prepare(
    'SELECT e.pessoa_id, a.nome AS alojamento_nome, q.nome AS quarto_nome, l.codigo AS leito_codigo, e.inicio ' +
    'FROM estadia e ' +
    'JOIN leito l ON l.id = e.leito_id ' +
    'JOIN quarto q ON q.id = l.quarto_id ' +
    'JOIN alojamento a ON a.id = q.alojamento_id ' +
    'WHERE e.fim IS NULL'
  ).all()

  const usosAtivos = db.prepare(
    'SELECT u.motorista_id AS pessoa_id, v.modelo, v.placa, u.destino, u.saida ' +
    'FROM uso_veiculo u ' +
    'JOIN veiculo v ON v.id = u.veiculo_id ' +
    'WHERE u.retorno IS NULL'
  ).all()

  // mapa rapido por pessoa_id
  const mapaEstadia = {}
  estadiasAtivas.forEach(function (e) {
    mapaEstadia[e.pessoa_id] = e
  })

  const mapaUso = {}
  usosAtivos.forEach(function (u) {
    mapaUso[u.pessoa_id] = u
  })

  const listaCompleta = pessoas.map(function (p) {
    const situacaoCnh = regrasCnh.verificarSituacaoCnh(p.cnh_categorias, p.cnh_validade, diasAlerta)
    const estadiaAtual = mapaEstadia[p.id] || null
    const usoAtual = mapaUso[p.id] || null

    return {
      id: p.id,
      nome: p.nome,
      matricula: p.matricula,
      cargo: p.cargo,
      obra: p.obra || 'Sede / Aguapeí',
      telefone: p.telefone || '',
      cnh_categorias: p.cnh_categorias || '',
      cnh_validade: p.cnh_validade || '',
      ativo: p.ativo,
      cnh_info: situacaoCnh,
      alojamento_atual: estadiaAtual ? {
        alojamento: estadiaAtual.alojamento_nome,
        quarto: estadiaAtual.quarto_nome,
        leito: estadiaAtual.leito_codigo,
        desde: estadiaAtual.inicio
      } : null,
      veiculo_atual: usoAtual ? {
        modelo: usoAtual.modelo,
        placa: usoAtual.placa,
        destino: usoAtual.destino,
        desde: usoAtual.saida
      } : null
    }
  })

  // aplica filtros adicionais de busca e CNH em memoria
  const resultado = listaCompleta.filter(function (p) {
    if (busca !== '') {
      const bateuBusca = (
        p.nome.toLowerCase().indexOf(busca) !== -1 ||
        p.matricula.toLowerCase().indexOf(busca) !== -1 ||
        p.cargo.toLowerCase().indexOf(busca) !== -1 ||
        p.obra.toLowerCase().indexOf(busca) !== -1
      )
      if (!bateuBusca) return false
    }

    if (filtroCnh === 'com_cnh') {
      return p.cnh_info.status !== 'sem_cnh'
    }
    if (filtroCnh === 'vencendo') {
      return p.cnh_info.status === 'vencendo' || p.cnh_info.status === 'vencida'
    }
    if (filtroCnh === 'sem_cnh') {
      return p.cnh_info.status === 'sem_cnh'
    }

    return true
  })

  // contadores gerais para o topo da tela
  const totais = {
    total: pessoas.length,
    ativos: pessoas.filter(function (p) { return p.ativo === 1 }).length,
    comCnh: listaCompleta.filter(function (p) { return p.cnh_info.status !== 'sem_cnh' }).length,
    cnhAlerta: listaCompleta.filter(function (p) { return p.cnh_info.status === 'vencendo' || p.cnh_info.status === 'vencida' }).length,
    alojados: Object.keys(mapaEstadia).length,
    emTransito: Object.keys(mapaUso).length
  }

  res.json({
    totais: totais,
    colaboradores: resultado
  })
})

// busca detalhes e historico completo de um colaborador especifico
router.get('/:id', function (req, res) {
  const id = Number(req.params.id)
  const pessoa = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id)

  if (!pessoa) {
    return res.status(404).json({ erro: 'Colaborador não encontrado.' })
  }

  const cfg = rotasConfig.lerConfig ? rotasConfig.lerConfig() : { diasAvisoVencimento: 30 }
  const situacaoCnh = regrasCnh.verificarSituacaoCnh(pessoa.cnh_categorias, pessoa.cnh_validade, cfg.diasAvisoVencimento)

  // historico de alojamentos (estadias)
  const estadias = db.prepare(
    'SELECT e.id, a.nome AS alojamento, q.nome AS quarto, l.codigo AS leito, e.inicio, e.fim ' +
    'FROM estadia e ' +
    'JOIN leito l ON l.id = e.leito_id ' +
    'JOIN quarto q ON q.id = l.quarto_id ' +
    'JOIN alojamento a ON a.id = q.alojamento_id ' +
    'WHERE e.pessoa_id = ? ' +
    'ORDER BY e.inicio DESC'
  ).all(id)

  // historico de conducao de veiculos (como motorista)
  const usosMotorista = db.prepare(
    'SELECT u.id, v.modelo, v.placa, u.destino, u.saida, u.retorno, u.km_saida, u.km_retorno, ' +
    '(CASE WHEN u.km_retorno IS NOT NULL THEN (u.km_retorno - u.km_saida) ELSE NULL END) AS km_rodados ' +
    'FROM uso_veiculo u ' +
    'JOIN veiculo v ON v.id = u.veiculo_id ' +
    'WHERE u.motorista_id = ? ' +
    'ORDER BY u.saida DESC'
  ).all(id)

  // viagens em que participou como passageiro
  const usosPassageiro = db.prepare(
    'SELECT u.id, v.modelo, v.placa, p_motorista.nome AS motorista, u.destino, u.saida, u.retorno ' +
    'FROM uso_passageiro up ' +
    'JOIN uso_veiculo u ON u.id = up.uso_veiculo_id ' +
    'JOIN veiculo v ON v.id = u.veiculo_id ' +
    'JOIN pessoa p_motorista ON p_motorista.id = u.motorista_id ' +
    'WHERE up.pessoa_id = ? ' +
    'ORDER BY u.saida DESC'
  ).all(id)

  // ocorrencias vinculadas a ele (se houver)
  const ocorrencias = db.prepare(
    'SELECT o.id, a.nome AS alojamento, o.tipo, o.descricao, o.aberta_em, o.resolvida_em, o.solucao ' +
    'FROM ocorrencia o ' +
    'JOIN alojamento a ON a.id = o.alojamento_id ' +
    'WHERE o.pessoa_id = ? ' +
    'ORDER BY o.aberta_em DESC'
  ).all(id)

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
  })
})

// cadastrar novo colaborador
router.post('/', function (req, res) {
  const nome = (req.body.nome || '').trim()
  const matricula = (req.body.matricula || '').trim().toUpperCase()
  const cargo = (req.body.cargo || '').trim()
  const obra = (req.body.obra || '').trim()
  const telefone = (req.body.telefone || '').trim()
  const cnhCategorias = (req.body.cnh_categorias || '').trim().toUpperCase()
  const cnhValidade = (req.body.cnh_validade || '').trim()

  if (nome === '' || matricula === '' || cargo === '') {
    return res.status(400).json({ erro: 'Nome, matrícula e cargo são obrigatórios.' })
  }

  // confere matricula duplicada
  const jaExiste = db.prepare('SELECT id FROM pessoa WHERE matricula = ?').get(matricula)
  if (jaExiste) {
    return res.status(400).json({ erro: 'Já existe um colaborador com a matrícula ' + matricula + '.' })
  }

  if (cnhCategorias !== '' && cnhValidade === '') {
    return res.status(400).json({ erro: 'Informe a data de validade da CNH.' })
  }

  const r = db.prepare(
    'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(
    nome,
    matricula,
    cargo,
    obra === '' ? 'Sede' : obra,
    telefone === '' ? null : telefone,
    cnhCategorias === '' ? null : cnhCategorias,
    cnhValidade === '' ? null : cnhValidade
  )

  const novoId = Number(r.lastInsertRowid)

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
      cnh_categorias: cnhCategorias
    }
  })

  res.status(201).json({
    mensagem: 'Colaborador cadastrado com sucesso!',
    id: novoId
  })
})

// atualizar dados do colaborador
router.put('/:id', function (req, res) {
  const id = Number(req.params.id)
  const pessoaAtual = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id)

  if (!pessoaAtual) {
    return res.status(404).json({ erro: 'Colaborador não encontrado.' })
  }

  const nome = (req.body.nome || '').trim()
  const matricula = (req.body.matricula || '').trim().toUpperCase()
  const cargo = (req.body.cargo || '').trim()
  const obra = (req.body.obra || '').trim()
  const telefone = (req.body.telefone || '').trim()
  const cnhCategorias = (req.body.cnh_categorias || '').trim().toUpperCase()
  const cnhValidade = (req.body.cnh_validade || '').trim()

  if (nome === '' || matricula === '' || cargo === '') {
    return res.status(400).json({ erro: 'Nome, matrícula e cargo são obrigatórios.' })
  }

  // confere se nova matricula nao colide com outro colaborador
  const conflito = db.prepare('SELECT id FROM pessoa WHERE matricula = ? AND id != ?').get(matricula, id)
  if (conflito) {
    return res.status(400).json({ erro: 'A matrícula ' + matricula + ' já está em uso por outro colaborador.' })
  }

  if (cnhCategorias !== '' && cnhValidade === '') {
    return res.status(400).json({ erro: 'Informe a data de validade da CNH.' })
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
    cnhCategorias === '' ? null : cnhCategorias,
    cnhValidade === '' ? null : cnhValidade,
    id
  )

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
      cnh_categorias: cnhCategorias,
      cnh_validade: cnhValidade
    }
  })

  res.json({ mensagem: 'Dados do colaborador atualizados!' })
})

// ativar / desativar colaborador (regra U2)
router.put('/:id/status', function (req, res) {
  const id = Number(req.params.id)
  const novoAtivo = req.body.ativo ? 1 : 0
  const pessoa = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(id)

  if (!pessoa) {
    return res.status(404).json({ erro: 'Colaborador não encontrado.' })
  }

  // se for desativar, confere se nao ha pendencia em aberto com o colaborador
  if (novoAtivo === 0) {
    const estadiaAberta = db.prepare('SELECT id FROM estadia WHERE pessoa_id = ? AND fim IS NULL').get(id)
    if (estadiaAberta) {
      return res.status(400).json({
        erro: 'Não é possível desativar: o colaborador está atualmente ocupando um leito em alojamento. Registre a saída antes.'
      })
    }

    const usoAberto = db.prepare('SELECT id FROM uso_veiculo WHERE motorista_id = ? AND retorno IS NULL').get(id)
    if (usoAberto) {
      return res.status(400).json({
        erro: 'Não é possível desativar: o colaborador está em trânsito com um veículo da frota. Registre a devolução antes.'
      })
    }
  }

  db.prepare('UPDATE pessoa SET ativo = ? WHERE id = ?').run(novoAtivo, id)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
    tabela: 'pessoa',
    registroId: id,
    resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o colaborador ' + pessoa.nome,
    antes: { ativo: pessoa.ativo },
    depois: { ativo: novoAtivo }
  })

  res.json({
    mensagem: novoAtivo === 1 ? 'Colaborador reativado com sucesso.' : 'Colaborador desativado do quadro ativo.'
  })
})

// povoa o banco com a equipe inicial da Construtora Aguapei (caso o usuario queira carregar os dados de exemplo)
router.post('/seed-exemplos', function (req, res) {
  const existentes = db.prepare('SELECT COUNT(*) AS total FROM pessoa').get().total
  if (existentes > 0) {
    return res.status(400).json({ erro: 'O banco já possui colaboradores cadastrados.' })
  }

  const equipe = [
    { nome: 'João Vitor Santos', matricula: 'AG-101', cargo: 'Técnico de Obras', obra: 'Marília Norte', tel: '14991230001', cnh: 'B', val: '2027-08-15' },
    { nome: 'Kelvin Gomes', matricula: 'AG-102', cargo: 'Engenheiro Residente', obra: 'Sede / Rodovia SP-294', tel: '14991230002', cnh: 'B,D', val: '2028-01-20' },
    { nome: 'Bruno Martins', matricula: 'AG-103', cargo: 'Mestre de Obras', obra: 'Alojamento Centro', tel: '14991230003', cnh: 'B', val: '2027-05-10' },
    { nome: 'Henrique Di Manno', matricula: 'AG-104', cargo: 'Topógrafo', obra: 'Assis Sul', tel: '14991230004', cnh: 'A,B', val: '2026-11-20' }, // vencendo em breve
    { nome: 'Matheus Silva', matricula: 'AG-105', cargo: 'Eletricista Predial', obra: 'Marília Norte', tel: '14991230005', cnh: 'B', val: '2027-10-30' },
    { nome: 'Carlos Eduardo Ramos', matricula: 'AG-106', cargo: 'Motorista de Van', obra: 'Transporte Intermunicipal', tel: '14991230006', cnh: 'D', val: '2026-11-12' }, // vencendo em breve
    { nome: 'Vinicius Almeida', matricula: 'AG-107', cargo: 'Operador de Máquinas', obra: 'Rodovia SP-294', tel: '14991230007', cnh: 'C,E', val: '2028-03-14' },
    { nome: 'Antônio Ferreira', matricula: 'AG-108', cargo: 'Encanador Industrial', obra: 'Alojamento Sul', tel: '14991230008', cnh: null, val: null },
    { nome: 'Lucas Oliveira', matricula: 'AG-109', cargo: 'Carpinteiro', obra: 'Marília Norte', tel: '14991230009', cnh: null, val: null },
    { nome: 'Rafael Costa', matricula: 'AG-110', cargo: 'Pedreiro de Acabamento', obra: 'Assis Sul', tel: '14991230010', cnh: null, val: null },
    { nome: 'Guilherme Souza', matricula: 'AG-111', cargo: 'Auxiliar de Almoxarifado', obra: 'Sede', tel: '14991230011', cnh: 'B', val: '2026-09-01' }, // vencida
    { nome: 'Fernando Dias', matricula: 'AG-112', cargo: 'Soldador', obra: 'Rodovia SP-294', tel: '14991230012', cnh: 'B', val: '2027-12-05' },
    { nome: 'Rodrigo Pires', matricula: 'AG-113', cargo: 'Pintor Industrial', obra: 'Alojamento Centro', tel: '14991230013', cnh: null, val: null },
    { nome: 'Marcos Vinicius', matricula: 'AG-114', cargo: 'Apontador de Obra', obra: 'Marília Norte', tel: '14991230014', cnh: 'B', val: '2028-06-18' },
    { nome: 'Leandro Barbosa', matricula: 'AG-115', cargo: 'Encarregado Geral', obra: 'Assis Sul', tel: '14991230015', cnh: 'B,C', val: '2027-04-22' }
  ]

  const insert = db.prepare(
    'INSERT INTO pessoa (nome, matricula, cargo, obra, telefone, cnh_categorias, cnh_validade, ativo) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  )

  equipe.forEach(function (p) {
    insert.run(p.nome, p.matricula, p.cargo, p.obra, p.tel, p.cnh, p.val)
  })

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'pessoa',
    registroId: 1,
    resumo: 'Carregou 15 colaboradores de demonstração (Construtora Aguapeí)'
  })

  res.json({
    mensagem: '15 colaboradores de demonstração carregados com sucesso!',
    total: equipe.length
  })
})

module.exports = router
