// rotas de alojamentos: cadastro, quartos e leitos, estadias (entrada/saida) e ocorrencias (regras A1 a A7)
const express = require('express')
const db = require('../db/conexao')
const auditoria = require('../regras/auditoria')

const router = express.Router()

const MAX_LEITOS_POR_QUARTO = 8 // NR-24
const M2_POR_CAMA = 3 // NR-24
const M2_POR_BELICHE = 4.5 // NR-24
const TIPOS_LEITO = ['cama', 'beliche_baixo', 'beliche_cima']
const TIPOS_OCORRENCIA = ['manutencao', 'conflito', 'reclamacao', 'regra', 'outro']

function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para acessar.' })
  }
  next()
}

router.use(exigirLogin)

function doisDigitos(n) {
  return n < 10 ? '0' + n : String(n)
}

function agoraLocal() {
  const d = new Date()
  return (
    d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate()) + ' ' +
    doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes()) + ':' + doisDigitos(d.getSeconds())
  )
}

// aceita "2026-11-05", "2026-11-05T10:30" ou "2026-11-05 10:30" e devolve "AAAA-MM-DD HH:MM:SS"
function normalizarData(texto) {
  const t = String(texto || '').trim().replace('T', ' ')
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  return m[1] + ' ' + (m[2] || '00:00') + ':' + (m[3] || '00')
}

// A6: o responsavel tem que ser um colaborador ativo
function conferirResponsavel(responsavelId) {
  if (responsavelId === null) return null
  const pessoa = db.prepare('SELECT id, ativo FROM pessoa WHERE id = ?').get(responsavelId)
  if (!pessoa) return 'Responsável não encontrado.'
  if (pessoa.ativo !== 1) return 'O responsável precisa ser um colaborador ativo.'
  return null
}

// A4 e A5: no maximo 8 leitos e a area precisa caber os leitos
function conferirQuarto(areaM2, leitos) {
  if (leitos.length === 0) return 'Informe ao menos um leito.'
  if (leitos.length > MAX_LEITOS_POR_QUARTO) {
    return 'Um quarto pode ter no máximo ' + MAX_LEITOS_POR_QUARTO + ' leitos (NR-24).'
  }

  let camas = 0
  let baixos = 0
  let cimas = 0
  const codigos = {}
  for (let i = 0; i < leitos.length; i++) {
    const l = leitos[i]
    if (!l.codigo || TIPOS_LEITO.indexOf(l.tipo) === -1) {
      return 'Cada leito precisa de código e tipo (cama, beliche_baixo ou beliche_cima).'
    }
    if (codigos[l.codigo]) return 'O código ' + l.codigo + ' está repetido no quarto.'
    codigos[l.codigo] = true
    if (l.tipo === 'cama') camas++
    if (l.tipo === 'beliche_baixo') baixos++
    if (l.tipo === 'beliche_cima') cimas++
  }
  if (cimas > baixos) return 'Todo beliche de cima precisa de um beliche de baixo.'

  const minimo = camas * M2_POR_CAMA + baixos * M2_POR_BELICHE
  if (areaM2 < minimo) {
    return 'Área insuficiente: para esses leitos o quarto precisa de pelo menos ' + minimo + ' m² (NR-24).'
  }
  return null
}

function lerEndereco(corpo) {
  return {
    nome: (corpo.nome || '').trim(),
    cidade: (corpo.cidade || '').trim(),
    cep: (corpo.cep || '').trim() || null,
    rua: (corpo.rua || '').trim() || null,
    numero: (corpo.numero || '').trim() || null,
    bairro: (corpo.bairro || '').trim() || null,
    observacoes: (corpo.observacoes || '').trim() || null
  }
}

function lerResponsavelId(corpo) {
  if (corpo.responsavel_id === undefined || corpo.responsavel_id === null || corpo.responsavel_id === '') return null
  return Number(corpo.responsavel_id)
}

// ===== estadias (precisam vir antes de /:id) =====

// registra a entrada de uma pessoa num leito (A1 e A2)
router.post('/estadias', function (req, res) {
  const pessoaId = Number(req.body.pessoa_id)
  const leitoId = Number(req.body.leito_id)
  const inicio = req.body.inicio ? normalizarData(req.body.inicio) : agoraLocal()

  if (!pessoaId || !leitoId) {
    return res.status(400).json({ erro: 'Informe o colaborador e o leito.' })
  }
  if (!inicio) {
    return res.status(400).json({ erro: 'Data de entrada inválida.' })
  }

  const pessoa = db.prepare('SELECT id, nome, ativo FROM pessoa WHERE id = ?').get(pessoaId)
  if (!pessoa) return res.status(404).json({ erro: 'Colaborador não encontrado.' })
  if (pessoa.ativo !== 1) return res.status(400).json({ erro: 'Colaborador inativo não pode ser alojado.' })

  const leito = db.prepare(
    'SELECT l.id, l.codigo, a.nome AS alojamento, a.ativo FROM leito l ' +
    'JOIN quarto q ON q.id = l.quarto_id JOIN alojamento a ON a.id = q.alojamento_id WHERE l.id = ?'
  ).get(leitoId)
  if (!leito) return res.status(404).json({ erro: 'Leito não encontrado.' })
  if (leito.ativo !== 1) return res.status(400).json({ erro: 'Este alojamento está inativo.' })

  // A2: a pessoa nao pode estar em dois leitos ao mesmo tempo
  const pessoaOcupada = db.prepare(
    'SELECT id FROM estadia WHERE pessoa_id = ? AND (fim IS NULL OR fim > ?)'
  ).get(pessoaId, inicio)
  if (pessoaOcupada) {
    return res.status(400).json({ erro: pessoa.nome + ' já está alojado(a) em outro leito nesse período.' })
  }

  // A1: o leito nao pode ter duas pessoas no mesmo periodo
  const leitoOcupado = db.prepare(
    'SELECT id FROM estadia WHERE leito_id = ? AND (fim IS NULL OR fim > ?)'
  ).get(leitoId, inicio)
  if (leitoOcupado) {
    return res.status(400).json({ erro: 'O leito ' + leito.codigo + ' já está ocupado nesse período.' })
  }

  const r = db.prepare('INSERT INTO estadia (pessoa_id, leito_id, inicio) VALUES (?, ?, ?)').run(pessoaId, leitoId, inicio)
  const id = Number(r.lastInsertRowid)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'estadia',
    registroId: id,
    resumo: 'Alojou ' + pessoa.nome + ' no leito ' + leito.codigo + ' (' + leito.alojamento + ')',
    depois: { id: id, pessoa_id: pessoaId, leito_id: leitoId, inicio: inicio }
  })

  res.status(201).json({ mensagem: 'Entrada registrada!', id: id })
})

// registra a saida de uma pessoa do leito (A3)
router.put('/estadias/:id/saida', function (req, res) {
  const id = Number(req.params.id)
  const estadia = db.prepare('SELECT * FROM estadia WHERE id = ?').get(id)
  if (!estadia) return res.status(404).json({ erro: 'Estadia não encontrada.' })
  if (estadia.fim) return res.status(400).json({ erro: 'Essa estadia já foi encerrada.' })

  const fim = req.body.fim ? normalizarData(req.body.fim) : agoraLocal()
  if (!fim) return res.status(400).json({ erro: 'Data de saída inválida.' })
  if (fim <= estadia.inicio) {
    return res.status(400).json({ erro: 'A saída precisa ser depois da entrada (' + estadia.inicio + ').' })
  }

  db.prepare('UPDATE estadia SET fim = ? WHERE id = ?').run(fim, id)

  const pessoa = db.prepare('SELECT nome FROM pessoa WHERE id = ?').get(estadia.pessoa_id)
  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'estadia',
    registroId: id,
    resumo: 'Registrou a saída de ' + pessoa.nome + ' do leito',
    antes: { fim: null },
    depois: { fim: fim }
  })

  res.json({ mensagem: 'Saída registrada!' })
})

// resolve uma ocorrencia (A7)
router.put('/ocorrencias/:id/resolver', function (req, res) {
  const id = Number(req.params.id)
  const ocorrencia = db.prepare('SELECT * FROM ocorrencia WHERE id = ?').get(id)
  if (!ocorrencia) return res.status(404).json({ erro: 'Ocorrência não encontrada.' })
  if (ocorrencia.resolvida_em) return res.status(400).json({ erro: 'Essa ocorrência já foi resolvida.' })

  const solucao = (req.body.solucao || '').trim()
  if (solucao === '') return res.status(400).json({ erro: 'Descreva a solução.' })

  const resolvidaEm = req.body.resolvida_em ? normalizarData(req.body.resolvida_em) : agoraLocal()
  if (!resolvidaEm) return res.status(400).json({ erro: 'Data de resolução inválida.' })
  if (resolvidaEm <= ocorrencia.aberta_em) {
    return res.status(400).json({ erro: 'A resolução precisa ser depois da abertura (' + ocorrencia.aberta_em + ').' })
  }

  db.prepare('UPDATE ocorrencia SET resolvida_em = ?, solucao = ? WHERE id = ?').run(resolvidaEm, solucao, id)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'ocorrencia',
    registroId: id,
    resumo: 'Resolveu a ocorrência #' + id,
    antes: { resolvida_em: null },
    depois: { resolvida_em: resolvidaEm, solucao: solucao }
  })

  res.json({ mensagem: 'Ocorrência resolvida!' })
})

// ===== alojamentos =====

// lista os alojamentos com responsavel e ocupacao
router.get('/', function (req, res) {
  const filtro = req.query.status || 'ativos' // 'ativos', 'inativos' ou 'todos'
  let sql =
    'SELECT a.*, p.nome AS responsavel_nome, ' +
    '(SELECT COUNT(*) FROM quarto q WHERE q.alojamento_id = a.id) AS total_quartos, ' +
    '(SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS total_leitos, ' +
    '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
    ' WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS leitos_ocupados, ' +
    '(SELECT COUNT(*) FROM ocorrencia o WHERE o.alojamento_id = a.id AND o.resolvida_em IS NULL) AS ocorrencias_abertas ' +
    'FROM alojamento a LEFT JOIN pessoa p ON p.id = a.responsavel_id '
  if (filtro === 'ativos') sql += 'WHERE a.ativo = 1 '
  if (filtro === 'inativos') sql += 'WHERE a.ativo = 0 '
  sql += 'ORDER BY a.ativo DESC, a.nome ASC'

  const alojamentos = db.prepare(sql).all().map(function (a) {
    a.leitos_livres = a.total_leitos - a.leitos_ocupados
    a.ocupacao_pct = a.total_leitos > 0 ? Math.round((a.leitos_ocupados / a.total_leitos) * 100) : 0
    return a
  })

  const totais = alojamentos.reduce(function (t, a) {
    t.leitos += a.total_leitos
    t.ocupados += a.leitos_ocupados
    t.ocorrenciasAbertas += a.ocorrencias_abertas
    return t
  }, { alojamentos: alojamentos.length, leitos: 0, ocupados: 0, ocorrenciasAbertas: 0 })

  res.json({ totais: totais, alojamentos: alojamentos })
})

// detalhe: quartos, leitos com ocupante atual e ocorrencias
router.get('/:id', function (req, res) {
  const id = Number(req.params.id)
  const alojamento = db.prepare(
    'SELECT a.*, p.nome AS responsavel_nome FROM alojamento a LEFT JOIN pessoa p ON p.id = a.responsavel_id WHERE a.id = ?'
  ).get(id)
  if (!alojamento) return res.status(404).json({ erro: 'Alojamento não encontrado.' })

  const quartos = db.prepare('SELECT * FROM quarto WHERE alojamento_id = ? ORDER BY nome').all(id)
  const leitosDoQuarto = db.prepare(
    'SELECT l.id, l.codigo, l.tipo, e.id AS estadia_id, e.inicio, p.id AS pessoa_id, p.nome AS pessoa_nome ' +
    'FROM leito l LEFT JOIN estadia e ON e.leito_id = l.id AND e.fim IS NULL ' +
    'LEFT JOIN pessoa p ON p.id = e.pessoa_id WHERE l.quarto_id = ? ORDER BY l.codigo'
  )
  quartos.forEach(function (q) {
    q.leitos = leitosDoQuarto.all(q.id)
  })

  const ocorrencias = db.prepare(
    'SELECT o.*, p.nome AS pessoa_nome FROM ocorrencia o LEFT JOIN pessoa p ON p.id = o.pessoa_id ' +
    'WHERE o.alojamento_id = ? ORDER BY o.aberta_em DESC'
  ).all(id)

  res.json({ alojamento: alojamento, quartos: quartos, ocorrencias: ocorrencias })
})

// cadastra alojamento (A6)
router.post('/', function (req, res) {
  const dados = lerEndereco(req.body)
  const responsavelId = lerResponsavelId(req.body)

  if (dados.nome === '' || dados.cidade === '') {
    return res.status(400).json({ erro: 'Nome e cidade são obrigatórios.' })
  }
  const erroResp = conferirResponsavel(responsavelId)
  if (erroResp) return res.status(400).json({ erro: erroResp })

  const r = db.prepare(
    'INSERT INTO alojamento (nome, responsavel_id, cidade, cep, rua, numero, bairro, observacoes, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(dados.nome, responsavelId, dados.cidade, dados.cep, dados.rua, dados.numero, dados.bairro, dados.observacoes)
  const id = Number(r.lastInsertRowid)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'alojamento',
    registroId: id,
    resumo: 'Cadastrou o alojamento ' + dados.nome + ' (' + dados.cidade + ')',
    depois: Object.assign({ id: id, responsavel_id: responsavelId }, dados)
  })

  res.status(201).json({ mensagem: 'Alojamento cadastrado!', id: id })
})

// atualiza alojamento (A6)
router.put('/:id', function (req, res) {
  const id = Number(req.params.id)
  const atual = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id)
  if (!atual) return res.status(404).json({ erro: 'Alojamento não encontrado.' })

  const dados = lerEndereco(req.body)
  const responsavelId = lerResponsavelId(req.body)

  if (dados.nome === '' || dados.cidade === '') {
    return res.status(400).json({ erro: 'Nome e cidade são obrigatórios.' })
  }
  // se o responsavel nao mudou, nao exige que continue ativo (so vale pra quem for escolhido agora)
  if (responsavelId !== atual.responsavel_id) {
    const erroResp = conferirResponsavel(responsavelId)
    if (erroResp) return res.status(400).json({ erro: erroResp })
  }

  db.prepare(
    'UPDATE alojamento SET nome = ?, responsavel_id = ?, cidade = ?, cep = ?, rua = ?, numero = ?, bairro = ?, observacoes = ? WHERE id = ?'
  ).run(dados.nome, responsavelId, dados.cidade, dados.cep, dados.rua, dados.numero, dados.bairro, dados.observacoes, id)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'alojamento',
    registroId: id,
    resumo: 'Atualizou o alojamento ' + dados.nome,
    antes: atual,
    depois: Object.assign({ id: id, responsavel_id: responsavelId }, dados)
  })

  res.json({ mensagem: 'Alojamento atualizado!' })
})

// ativa / desativa alojamento (so desativa sem ninguem alojado)
router.put('/:id/status', function (req, res) {
  const id = Number(req.params.id)
  const novoAtivo = req.body.ativo ? 1 : 0
  const alojamento = db.prepare('SELECT * FROM alojamento WHERE id = ?').get(id)
  if (!alojamento) return res.status(404).json({ erro: 'Alojamento não encontrado.' })

  if (novoAtivo === 0) {
    const ocupado = db.prepare(
      'SELECT e.id FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
      'WHERE q.alojamento_id = ? AND e.fim IS NULL LIMIT 1'
    ).get(id)
    if (ocupado) {
      return res.status(400).json({ erro: 'Não é possível desativar: ainda há colaboradores alojados. Registre as saídas antes.' })
    }
  }

  db.prepare('UPDATE alojamento SET ativo = ? WHERE id = ?').run(novoAtivo, id)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
    tabela: 'alojamento',
    registroId: id,
    resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o alojamento ' + alojamento.nome,
    antes: { ativo: alojamento.ativo },
    depois: { ativo: novoAtivo }
  })

  res.json({ mensagem: novoAtivo === 1 ? 'Alojamento reativado.' : 'Alojamento desativado.' })
})

// cadastra um quarto com seus leitos (A4 e A5)
router.post('/:id/quartos', function (req, res) {
  const alojamentoId = Number(req.params.id)
  const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId)
  if (!alojamento) return res.status(404).json({ erro: 'Alojamento não encontrado.' })

  const nome = (req.body.nome || '').trim()
  const areaM2 = Number(req.body.area_m2)
  const leitos = Array.isArray(req.body.leitos) ? req.body.leitos.map(function (l) {
    return { codigo: String(l.codigo || '').trim(), tipo: l.tipo }
  }) : []

  if (nome === '') return res.status(400).json({ erro: 'Informe o nome do quarto.' })
  if (!(areaM2 > 0)) return res.status(400).json({ erro: 'Informe a área do quarto em m².' })

  const erro = conferirQuarto(areaM2, leitos)
  if (erro) return res.status(400).json({ erro: erro })

  db.exec('BEGIN')
  let quartoId
  try {
    const rq = db.prepare('INSERT INTO quarto (alojamento_id, nome, area_m2) VALUES (?, ?, ?)').run(alojamentoId, nome, areaM2)
    quartoId = Number(rq.lastInsertRowid)
    const inserirLeito = db.prepare('INSERT INTO leito (quarto_id, codigo, tipo) VALUES (?, ?, ?)')
    leitos.forEach(function (l) {
      inserirLeito.run(quartoId, l.codigo, l.tipo)
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return res.status(500).json({ erro: 'Não foi possível salvar o quarto: ' + e.message })
  }

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'quarto',
    registroId: quartoId,
    resumo: 'Cadastrou o quarto ' + nome + ' (' + leitos.length + ' leitos) no alojamento ' + alojamento.nome,
    depois: { id: quartoId, alojamento_id: alojamentoId, nome: nome, area_m2: areaM2, leitos: leitos }
  })

  res.status(201).json({ mensagem: 'Quarto cadastrado!', id: quartoId })
})

// abre uma ocorrencia no alojamento
router.post('/:id/ocorrencias', function (req, res) {
  const alojamentoId = Number(req.params.id)
  const alojamento = db.prepare('SELECT id, nome FROM alojamento WHERE id = ?').get(alojamentoId)
  if (!alojamento) return res.status(404).json({ erro: 'Alojamento não encontrado.' })

  const tipo = req.body.tipo
  const descricao = (req.body.descricao || '').trim()
  const pessoaId = req.body.pessoa_id ? Number(req.body.pessoa_id) : null

  if (TIPOS_OCORRENCIA.indexOf(tipo) === -1) return res.status(400).json({ erro: 'Tipo de ocorrência inválido.' })
  if (descricao === '') return res.status(400).json({ erro: 'Descreva a ocorrência.' })
  if (pessoaId && !db.prepare('SELECT id FROM pessoa WHERE id = ?').get(pessoaId)) {
    return res.status(404).json({ erro: 'Colaborador não encontrado.' })
  }

  const abertaEm = agoraLocal()
  const r = db.prepare(
    'INSERT INTO ocorrencia (alojamento_id, pessoa_id, tipo, descricao, aberta_em) VALUES (?, ?, ?, ?, ?)'
  ).run(alojamentoId, pessoaId, tipo, descricao, abertaEm)
  const id = Number(r.lastInsertRowid)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'ocorrencia',
    registroId: id,
    resumo: 'Abriu ocorrência (' + tipo + ') no alojamento ' + alojamento.nome,
    depois: { id: id, alojamento_id: alojamentoId, pessoa_id: pessoaId, tipo: tipo, descricao: descricao, aberta_em: abertaEm }
  })

  res.status(201).json({ mensagem: 'Ocorrência registrada!', id: id })
})

module.exports = router
