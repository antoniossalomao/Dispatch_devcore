// rotas da frota: veiculos, saida e volta (regras F1 a F13) e manutencoes
const express = require('express')
const db = require('../db/conexao')
const auditoria = require('../regras/auditoria')
const regrasCnh = require('../regras/cnh')
const { agoraLocal, normalizarData, diasAte } = require('../regras/datas')
const rotasConfig = require('./configuracoes')

const router = express.Router()

const CATEGORIAS = ['A', 'B', 'C', 'D', 'E']

function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para acessar.' })
  }
  next()
}

router.use(exigirLogin)

// km atual do carro: km da ultima volta ou, se nunca saiu, o km do cadastro
function kmAtual(veiculo) {
  const ultimo = db.prepare(
    'SELECT km_retorno FROM uso_veiculo WHERE veiculo_id = ? AND km_retorno IS NOT NULL ORDER BY retorno DESC, id DESC LIMIT 1'
  ).get(veiculo.id)
  return ultimo ? ultimo.km_retorno : veiculo.km_inicial
}

// status calculado (nao fica salvo): manutencao > em uso > disponivel
function statusVeiculo(veiculoId) {
  if (db.prepare('SELECT id FROM manutencao WHERE veiculo_id = ? AND fim IS NULL').get(veiculoId)) return 'manutencao'
  if (db.prepare('SELECT id FROM uso_veiculo WHERE veiculo_id = ? AND retorno IS NULL').get(veiculoId)) return 'em_uso'
  return 'disponivel'
}

// situacao de um documento (licenciamento ou seguro)
function situacaoDocumento(validade, diasAlerta) {
  const dias = diasAte(validade)
  if (dias === null) return { status: 'sem_data', dias: null }
  if (dias < 0) return { status: 'vencido', dias: dias }
  if (dias <= diasAlerta) return { status: 'vencendo', dias: dias }
  return { status: 'valido', dias: dias }
}

// deixa a placa sempre no formato AAA-0000 / AAA-0A00, assim "abc1234" e "ABC-1234" sao a mesma
function normalizarPlaca(texto) {
  const limpa = String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return limpa.length === 7 ? limpa.slice(0, 3) + '-' + limpa.slice(3) : limpa
}

function lerDadosVeiculo(b) {
  return {
    placa: normalizarPlaca(b.placa),
    modelo: (b.modelo || '').trim(),
    lugares: Number(b.lugares),
    categoria: (b.categoria_cnh_exigida || '').trim().toUpperCase(),
    kmInicial: b.km_inicial === undefined || b.km_inicial === '' ? 0 : Number(b.km_inicial),
    licenciamento: b.licenciamento_validade ? String(b.licenciamento_validade).slice(0, 10) : null,
    seguro: b.seguro_validade ? String(b.seguro_validade).slice(0, 10) : null
  }
}

function validarVeiculo(d) {
  if (d.placa === '' || d.modelo === '') return 'Placa e modelo são obrigatórios.'
  if (!/^[A-Z]{3}-[0-9][A-Z0-9][0-9]{2}$/.test(d.placa)) return 'Placa inválida. Use o formato ABC-1234 ou ABC-1D23.'
  if (!Number.isInteger(d.lugares) || d.lugares < 1) return 'Informe a quantidade de lugares (contando o motorista).'
  if (CATEGORIAS.indexOf(d.categoria) === -1) return 'Categoria de CNH exigida inválida (A a E).'
  if (!Number.isInteger(d.kmInicial) || d.kmInicial < 0) return 'O km inicial precisa ser um número inteiro maior ou igual a zero.'
  return null
}

// ===== usos (precisam vir antes de /:id) =====

// registra a saida de um veiculo
router.post('/usos', function (req, res) {
  const cfg = rotasConfig.lerConfig()
  const veiculoId = Number(req.body.veiculo_id)
  const motoristaId = Number(req.body.motorista_id)
  const destino = (req.body.destino || '').trim()
  const kmSaida = Number(req.body.km_saida)
  const saida = req.body.saida ? normalizarData(req.body.saida) : agoraLocal()
  const passageiros = Array.isArray(req.body.passageiros)
    ? req.body.passageiros.map(Number).filter(function (n) { return n > 0 })
    : []

  if (!veiculoId || !motoristaId || destino === '') {
    return res.status(400).json({ erro: 'Informe veículo, motorista e destino.' })
  }
  if (!saida) return res.status(400).json({ erro: 'Data de saída inválida.' })
  if (!Number.isInteger(kmSaida) || kmSaida < 0) {
    return res.status(400).json({ erro: 'Informe o km de saída (número inteiro).' })
  }

  const veiculo = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(veiculoId)
  if (!veiculo) return res.status(404).json({ erro: 'Veículo não encontrado.' })
  if (veiculo.ativo !== 1) return res.status(400).json({ erro: 'Veículo inativo não pode sair.' })

  const motorista = db.prepare('SELECT * FROM pessoa WHERE id = ?').get(motoristaId)
  if (!motorista) return res.status(404).json({ erro: 'Motorista não encontrado.' })
  if (motorista.ativo !== 1) return res.status(400).json({ erro: 'Colaborador inativo não pode dirigir.' })

  const avisos = []

  // F3: motorista precisa ter CNH
  if (!motorista.cnh_categorias || motorista.cnh_categorias.trim() === '') {
    return res.status(400).json({ erro: motorista.nome + ' não tem CNH cadastrada.' })
  }

  // F4: CNH valida no dia da saida
  if (!motorista.cnh_validade || motorista.cnh_validade < saida.slice(0, 10)) {
    return res.status(400).json({ erro: 'A CNH de ' + motorista.nome + ' está vencida na data da saída.' })
  }

  // F5: categoria da CNH serve pro veiculo
  if (!regrasCnh.categoriaAtende(motorista.cnh_categorias, veiculo.categoria_cnh_exigida)) {
    return res.status(400).json({
      erro: 'A CNH de ' + motorista.nome + ' (' + motorista.cnh_categorias + ') não habilita para este veículo (categoria ' + veiculo.categoria_cnh_exigida + ').'
    })
  }

  // F6: motorista nao pode ser passageiro
  if (passageiros.indexOf(motoristaId) !== -1) {
    return res.status(400).json({ erro: 'O motorista não pode estar na lista de passageiros.' })
  }
  const unicos = passageiros.filter(function (p, i) { return passageiros.indexOf(p) === i })

  // F7: nao pode ter mais passageiros que lugares (tirando o motorista)
  if (unicos.length > veiculo.lugares - 1) {
    return res.status(400).json({
      erro: 'Passageiros demais: o veículo tem ' + veiculo.lugares + ' lugares (' + (veiculo.lugares - 1) + ' para passageiros).'
    })
  }

  // F12: licenciamento vencido bloqueia, seguro vencido so avisa
  const licDias = diasAte(veiculo.licenciamento_validade)
  if (licDias !== null && licDias < 0 && cfg.bloquearDocVencido) {
    return res.status(400).json({ erro: 'Licenciamento vencido: o veículo não pode sair.' })
  }
  const segDias = diasAte(veiculo.seguro_validade)
  if (segDias !== null && segDias < 0 && cfg.avisarSeguroVencido) {
    avisos.push('O seguro deste veículo está vencido.')
  }

  // F13: manutencao em aberto
  if (db.prepare('SELECT id FROM manutencao WHERE veiculo_id = ? AND fim IS NULL').get(veiculoId)) {
    return res.status(400).json({ erro: 'Veículo com manutenção em aberto não pode sair.' })
  }

  // F1: o mesmo carro nao pode ter dois usos no mesmo horario
  if (db.prepare('SELECT id FROM uso_veiculo WHERE veiculo_id = ? AND (retorno IS NULL OR retorno > ?)').get(veiculoId, saida)) {
    return res.status(400).json({ erro: 'Este veículo já está em uso nesse horário.' })
  }

  // F2: uma pessoa nao pode estar em dois carros ao mesmo tempo
  const envolvidos = [motoristaId].concat(unicos)
  for (let i = 0; i < envolvidos.length; i++) {
    const pid = envolvidos[i]
    const ocupado = db.prepare(
      'SELECT u.id FROM uso_veiculo u WHERE (u.retorno IS NULL OR u.retorno > ?) ' +
      'AND (u.motorista_id = ? OR EXISTS (SELECT 1 FROM uso_passageiro up WHERE up.uso_veiculo_id = u.id AND up.pessoa_id = ?)) LIMIT 1'
    ).get(saida, pid, pid)
    if (ocupado) {
      const p = db.prepare('SELECT nome FROM pessoa WHERE id = ?').get(pid)
      return res.status(400).json({ erro: (p ? p.nome : 'Colaborador') + ' já está em outro veículo nesse horário.' })
    }
    const ativo = db.prepare('SELECT ativo FROM pessoa WHERE id = ?').get(pid)
    if (!ativo) return res.status(404).json({ erro: 'Passageiro não encontrado.' })
    if (ativo.ativo !== 1) return res.status(400).json({ erro: 'Colaborador inativo não pode viajar.' })
  }

  // F9/F10: km da saida contra o km da ultima volta
  const esperado = kmAtual(veiculo)
  if (kmSaida < esperado) {
    return res.status(400).json({ erro: 'O km de saída (' + kmSaida + ') é menor que o km da última volta (' + esperado + ').' })
  }
  let kmSemRegistro = 0
  if (kmSaida > esperado) {
    kmSemRegistro = kmSaida - esperado
    avisos.push('O km de saída é ' + kmSemRegistro + ' km maior que o da última volta: alguém pode ter usado o veículo sem registrar.')
  }

  db.exec('BEGIN')
  let id
  try {
    const r = db.prepare(
      'INSERT INTO uso_veiculo (veiculo_id, motorista_id, destino, saida, km_saida) VALUES (?, ?, ?, ?, ?)'
    ).run(veiculoId, motoristaId, destino, saida, kmSaida)
    id = Number(r.lastInsertRowid)
    const inserirPassageiro = db.prepare('INSERT INTO uso_passageiro (uso_veiculo_id, pessoa_id) VALUES (?, ?)')
    unicos.forEach(function (pid) { inserirPassageiro.run(id, pid) })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    return res.status(500).json({ erro: 'Não foi possível registrar a saída: ' + e.message })
  }

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'uso_veiculo',
    registroId: id,
    resumo: 'Registrou saída do ' + veiculo.modelo + ' ' + veiculo.placa + ' com ' + motorista.nome + ' para ' + destino,
    depois: { id: id, veiculo_id: veiculoId, motorista_id: motoristaId, destino: destino, saida: saida, km_saida: kmSaida, passageiros: unicos, km_sem_registro: kmSemRegistro }
  })

  res.status(201).json({ mensagem: 'Saída registrada!', id: id, avisos: avisos })
})

// registra a volta (F8, F9, F11)
router.put('/usos/:id/retorno', function (req, res) {
  const cfg = rotasConfig.lerConfig()
  const id = Number(req.params.id)
  const uso = db.prepare('SELECT * FROM uso_veiculo WHERE id = ?').get(id)
  if (!uso) return res.status(404).json({ erro: 'Uso não encontrado.' })
  if (uso.retorno) return res.status(400).json({ erro: 'Esse uso já foi encerrado.' })

  const retorno = req.body.retorno ? normalizarData(req.body.retorno) : agoraLocal()
  const kmRetorno = Number(req.body.km_retorno)

  if (!retorno) return res.status(400).json({ erro: 'Data de volta inválida.' })
  // F8
  if (retorno <= uso.saida) {
    return res.status(400).json({ erro: 'A volta precisa ser depois da saída (' + uso.saida + ').' })
  }
  if (!Number.isInteger(kmRetorno)) return res.status(400).json({ erro: 'Informe o km de volta (número inteiro).' })
  // F9
  if (kmRetorno < uso.km_saida) {
    return res.status(400).json({ erro: 'O km da volta não pode ser menor que o da saída (' + uso.km_saida + ').' })
  }
  // F11: viagem muito longa pede confirmacao
  const rodados = kmRetorno - uso.km_saida
  if (rodados > cfg.kmConfirmacaoViagem && !req.body.confirmar) {
    return res.status(409).json({
      confirmar: true,
      erro: 'Essa viagem teve ' + rodados + ' km (mais de ' + cfg.kmConfirmacaoViagem + '). Confirme se o km está correto.'
    })
  }

  db.prepare('UPDATE uso_veiculo SET retorno = ?, km_retorno = ? WHERE id = ?').run(retorno, kmRetorno, id)

  const veiculo = db.prepare('SELECT modelo, placa FROM veiculo WHERE id = ?').get(uso.veiculo_id)
  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'uso_veiculo',
    registroId: id,
    resumo: 'Registrou volta do ' + veiculo.modelo + ' ' + veiculo.placa + ' (' + rodados + ' km rodados)',
    antes: { retorno: null, km_retorno: null },
    depois: { retorno: retorno, km_retorno: kmRetorno }
  })

  res.json({ mensagem: 'Volta registrada! ' + rodados + ' km rodados.', km_rodados: rodados })
})

// ===== manutencoes =====

router.put('/manutencoes/:id/concluir', function (req, res) {
  const id = Number(req.params.id)
  const m = db.prepare('SELECT * FROM manutencao WHERE id = ?').get(id)
  if (!m) return res.status(404).json({ erro: 'Manutenção não encontrada.' })
  if (m.fim) return res.status(400).json({ erro: 'Essa manutenção já foi concluída.' })

  const fim = req.body.fim ? normalizarData(req.body.fim) : agoraLocal()
  if (!fim) return res.status(400).json({ erro: 'Data de conclusão inválida.' })
  if (fim <= m.inicio) {
    return res.status(400).json({ erro: 'A conclusão precisa ser depois do início (' + m.inicio + ').' })
  }

  db.prepare('UPDATE manutencao SET fim = ? WHERE id = ?').run(fim, id)
  const v = db.prepare('SELECT modelo, placa FROM veiculo WHERE id = ?').get(m.veiculo_id)
  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'manutencao',
    registroId: id,
    resumo: 'Concluiu a manutenção do ' + v.modelo + ' ' + v.placa,
    antes: { fim: null },
    depois: { fim: fim }
  })

  res.json({ mensagem: 'Manutenção concluída! Veículo liberado.' })
})

// ===== veiculos =====

router.get('/', function (req, res) {
  const cfg = rotasConfig.lerConfig()
  const filtro = req.query.status || 'ativos'
  let sql = 'SELECT * FROM veiculo '
  if (filtro === 'ativos') sql += 'WHERE ativo = 1 '
  if (filtro === 'inativos') sql += 'WHERE ativo = 0 '
  sql += 'ORDER BY ativo DESC, modelo, placa'

  const veiculos = db.prepare(sql).all().map(function (v) {
    const status = statusVeiculo(v.id)
    const uso = status === 'em_uso'
      ? db.prepare(
        'SELECT u.id AS uso_id, u.destino, u.saida, p.nome AS motorista FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
        'WHERE u.veiculo_id = ? AND u.retorno IS NULL'
      ).get(v.id)
      : null
    return {
      id: v.id,
      placa: v.placa,
      modelo: v.modelo,
      lugares: v.lugares,
      categoria_cnh_exigida: v.categoria_cnh_exigida,
      km_inicial: v.km_inicial,
      km_atual: kmAtual(v),
      licenciamento_validade: v.licenciamento_validade,
      seguro_validade: v.seguro_validade,
      licenciamento: situacaoDocumento(v.licenciamento_validade, cfg.diasAvisoVencimento),
      seguro: situacaoDocumento(v.seguro_validade, cfg.diasAvisoVencimento),
      ativo: v.ativo,
      status: status,
      uso_atual: uso
    }
  })

  const totais = {
    total: veiculos.length,
    disponiveis: veiculos.filter(function (v) { return v.status === 'disponivel' }).length,
    emUso: veiculos.filter(function (v) { return v.status === 'em_uso' }).length,
    manutencao: veiculos.filter(function (v) { return v.status === 'manutencao' }).length,
    docsAtencao: veiculos.filter(function (v) {
      return v.licenciamento.status === 'vencido' || v.licenciamento.status === 'vencendo' ||
        v.seguro.status === 'vencido' || v.seguro.status === 'vencendo'
    }).length
  }

  res.json({ totais: totais, veiculos: veiculos })
})

router.get('/:id', function (req, res) {
  const id = Number(req.params.id)
  const v = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id)
  if (!v) return res.status(404).json({ erro: 'Veículo não encontrado.' })

  const usos = db.prepare(
    'SELECT u.*, p.nome AS motorista FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
    'WHERE u.veiculo_id = ? ORDER BY u.saida DESC LIMIT 100'
  ).all(id)
  const passageirosDoUso = db.prepare(
    'SELECT p.nome FROM uso_passageiro up JOIN pessoa p ON p.id = up.pessoa_id WHERE up.uso_veiculo_id = ? ORDER BY p.nome'
  )
  usos.forEach(function (u) {
    u.passageiros = passageirosDoUso.all(u.id).map(function (p) { return p.nome })
    u.km_rodados = u.km_retorno !== null ? u.km_retorno - u.km_saida : null
  })

  const manutencoes = db.prepare('SELECT * FROM manutencao WHERE veiculo_id = ? ORDER BY inicio DESC').all(id)

  res.json({
    veiculo: Object.assign({}, v, { km_atual: kmAtual(v), status: statusVeiculo(id) }),
    usos: usos,
    manutencoes: manutencoes
  })
})

router.post('/', function (req, res) {
  const d = lerDadosVeiculo(req.body)
  const erro = validarVeiculo(d)
  if (erro) return res.status(400).json({ erro: erro })

  if (db.prepare('SELECT id FROM veiculo WHERE placa = ?').get(d.placa)) {
    return res.status(400).json({ erro: 'Já existe um veículo com a placa ' + d.placa + '.' })
  }

  const r = db.prepare(
    'INSERT INTO veiculo (placa, modelo, lugares, categoria_cnh_exigida, km_inicial, licenciamento_validade, seguro_validade, ativo) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
  ).run(d.placa, d.modelo, d.lugares, d.categoria, d.kmInicial, d.licenciamento, d.seguro)
  const id = Number(r.lastInsertRowid)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'veiculo',
    registroId: id,
    resumo: 'Cadastrou o veículo ' + d.modelo + ' ' + d.placa,
    depois: { id: id, placa: d.placa, modelo: d.modelo, lugares: d.lugares, categoria_cnh_exigida: d.categoria, km_inicial: d.kmInicial, licenciamento_validade: d.licenciamento, seguro_validade: d.seguro }
  })

  res.status(201).json({ mensagem: 'Veículo cadastrado!', id: id })
})

router.put('/:id', function (req, res) {
  const id = Number(req.params.id)
  const atual = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id)
  if (!atual) return res.status(404).json({ erro: 'Veículo não encontrado.' })

  const d = lerDadosVeiculo(req.body)
  const erro = validarVeiculo(d)
  if (erro) return res.status(400).json({ erro: erro })

  if (db.prepare('SELECT id FROM veiculo WHERE placa = ? AND id != ?').get(d.placa, id)) {
    return res.status(400).json({ erro: 'A placa ' + d.placa + ' já está em uso por outro veículo.' })
  }

  db.prepare(
    'UPDATE veiculo SET placa = ?, modelo = ?, lugares = ?, categoria_cnh_exigida = ?, km_inicial = ?, licenciamento_validade = ?, seguro_validade = ? WHERE id = ?'
  ).run(d.placa, d.modelo, d.lugares, d.categoria, d.kmInicial, d.licenciamento, d.seguro, id)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'alterou',
    tabela: 'veiculo',
    registroId: id,
    resumo: 'Atualizou o veículo ' + d.modelo + ' ' + d.placa,
    antes: atual,
    depois: { id: id, placa: d.placa, modelo: d.modelo, lugares: d.lugares, categoria_cnh_exigida: d.categoria, km_inicial: d.kmInicial, licenciamento_validade: d.licenciamento, seguro_validade: d.seguro }
  })

  res.json({ mensagem: 'Veículo atualizado!' })
})

// ativa / desativa (U2: nada e apagado)
router.put('/:id/status', function (req, res) {
  const id = Number(req.params.id)
  const novoAtivo = req.body.ativo ? 1 : 0
  const v = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(id)
  if (!v) return res.status(404).json({ erro: 'Veículo não encontrado.' })

  if (novoAtivo === 0 && statusVeiculo(id) !== 'disponivel') {
    return res.status(400).json({ erro: 'Não é possível desativar: o veículo está em uso ou em manutenção.' })
  }

  db.prepare('UPDATE veiculo SET ativo = ? WHERE id = ?').run(novoAtivo, id)
  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
    tabela: 'veiculo',
    registroId: id,
    resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o veículo ' + v.modelo + ' ' + v.placa,
    antes: { ativo: v.ativo },
    depois: { ativo: novoAtivo }
  })

  res.json({ mensagem: novoAtivo === 1 ? 'Veículo reativado.' : 'Veículo desativado.' })
})

// abre manutencao (o carro nao pode estar na rua)
router.post('/:id/manutencoes', function (req, res) {
  const veiculoId = Number(req.params.id)
  const v = db.prepare('SELECT * FROM veiculo WHERE id = ?').get(veiculoId)
  if (!v) return res.status(404).json({ erro: 'Veículo não encontrado.' })

  const tipo = req.body.tipo
  const descricao = (req.body.descricao || '').trim()
  const inicio = req.body.inicio ? normalizarData(req.body.inicio) : agoraLocal()
  const km = req.body.km === undefined || req.body.km === '' || req.body.km === null ? null : Number(req.body.km)

  if (tipo !== 'preventiva' && tipo !== 'corretiva') return res.status(400).json({ erro: 'Tipo de manutenção inválido.' })
  if (descricao === '') return res.status(400).json({ erro: 'Descreva a manutenção.' })
  if (!inicio) return res.status(400).json({ erro: 'Data de início inválida.' })
  if (km !== null && (!Number.isInteger(km) || km < 0)) return res.status(400).json({ erro: 'Km inválido.' })

  const status = statusVeiculo(veiculoId)
  if (status === 'em_uso') return res.status(400).json({ erro: 'O veículo está em uso. Registre a volta antes de abrir a manutenção.' })
  if (status === 'manutencao') return res.status(400).json({ erro: 'O veículo já está em manutenção.' })

  const r = db.prepare('INSERT INTO manutencao (veiculo_id, tipo, descricao, inicio, km) VALUES (?, ?, ?, ?, ?)')
    .run(veiculoId, tipo, descricao, inicio, km)
  const id = Number(r.lastInsertRowid)

  auditoria.registrarLog({
    usuarioId: req.session.usuario.id,
    acao: 'criou',
    tabela: 'manutencao',
    registroId: id,
    resumo: 'Abriu manutenção ' + tipo + ' do ' + v.modelo + ' ' + v.placa,
    depois: { id: id, veiculo_id: veiculoId, tipo: tipo, descricao: descricao, inicio: inicio, km: km }
  })

  res.status(201).json({ mensagem: 'Manutenção registrada! O veículo ficou indisponível.', id: id })
})

module.exports = router
