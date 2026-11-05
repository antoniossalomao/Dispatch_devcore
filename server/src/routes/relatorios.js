// relatorios: ocupacao, uso da frota, movimentacoes, gargalos e "quem estava dirigindo"
const express = require('express')
const db = require('../db/conexao')
const { agoraLocal, normalizarData } = require('../regras/datas')
const rotasConfig = require('./configuracoes')

const router = express.Router()

router.use(function (req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para acessar.' })
  }
  next()
})

const MS_DIA = 86400000

function paraMs(texto) {
  return new Date(texto.replace(' ', 'T')).getTime()
}

function doisDigitos(n) {
  return n < 10 ? '0' + n : String(n)
}

function formatar(ms) {
  const d = new Date(ms)
  return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate()) + ' ' +
    doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes()) + ':' + doisDigitos(d.getSeconds())
}

// periodo da consulta: ?de=AAAA-MM-DD&ate=AAAA-MM-DD (padrao: ultimos 30 dias). "ate" vale ate o fim do dia
function lerPeriodo(query) {
  const agora = Date.now()
  let ate = query.ate ? normalizarData(query.ate) : null
  let de = query.de ? normalizarData(query.de) : null
  const ateMs = ate ? paraMs(ate) + (query.ate.length <= 10 ? MS_DIA - 1000 : 0) : agora
  const deMs = de ? paraMs(de) : ateMs - 30 * MS_DIA
  if (isNaN(deMs) || isNaN(ateMs) || deMs >= ateMs) return null
  return { deMs: deMs, ateMs: ateMs, de: formatar(deMs), ate: formatar(ateMs), dias: (ateMs - deMs) / MS_DIA }
}

// quanto tempo (ms) o intervalo [ini, fim] fica dentro do periodo. fim vazio = ainda em andamento
function sobreposicao(ini, fim, periodo) {
  const a = Math.max(paraMs(ini), periodo.deMs)
  const b = Math.min(fim ? paraMs(fim) : Date.now(), periodo.ateMs)
  return b > a ? b - a : 0
}

function arredondar(n, casas) {
  const f = Math.pow(10, casas)
  return Math.round(n * f) / f
}

// ocupacao por alojamento: leito-dias ocupados / leito-dias disponiveis
function calcularOcupacao(periodo) {

  const alojamentos = db.prepare('SELECT id, nome, cidade FROM alojamento WHERE ativo = 1 ORDER BY nome').all()
  const estadias = db.prepare(
    'SELECT e.inicio, e.fim, q.alojamento_id FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id'
  ).all()

  const linhas = alojamentos.map(function (a) {
    const leitos = db.prepare(
      'SELECT COUNT(*) AS n FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = ?'
    ).get(a.id).n
    let msOcupado = 0
    let entradas = 0
    estadias.forEach(function (e) {
      if (e.alojamento_id !== a.id) return
      const ms = sobreposicao(e.inicio, e.fim, periodo)
      if (ms > 0) msOcupado += ms
      if (paraMs(e.inicio) >= periodo.deMs && paraMs(e.inicio) <= periodo.ateMs) entradas++
    })
    const diasLeitoOcupados = msOcupado / MS_DIA
    const capacidade = leitos * periodo.dias
    const agora = db.prepare(
      'SELECT COUNT(*) AS n FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
      'WHERE q.alojamento_id = ? AND e.fim IS NULL'
    ).get(a.id).n
    return {
      alojamento_id: a.id,
      nome: a.nome,
      cidade: a.cidade,
      leitos: leitos,
      ocupados_agora: agora,
      dias_leito_ocupados: arredondar(diasLeitoOcupados, 1),
      ocupacao_media_pct: capacidade > 0 ? arredondar((diasLeitoOcupados / capacidade) * 100, 1) : 0,
      entradas_no_periodo: entradas
    }
  })

  return { periodo: { de: periodo.de, ate: periodo.ate }, alojamentos: linhas }
}

router.get('/ocupacao', function (req, res) {
  const periodo = lerPeriodo(req.query)
  if (!periodo) return res.status(400).json({ erro: 'Período inválido.' })
  res.json(calcularOcupacao(periodo))
})

// uso por veiculo: viagens, km, horas em uso, utilizacao e ociosidade
function calcularFrota(periodo) {

  const veiculos = db.prepare('SELECT id, placa, modelo FROM veiculo WHERE ativo = 1 ORDER BY modelo, placa').all()
  const usos = db.prepare('SELECT veiculo_id, saida, retorno, km_saida, km_retorno FROM uso_veiculo').all()

  const linhas = veiculos.map(function (v) {
    let msUso = 0
    let km = 0
    let viagens = 0
    let ultimaSaida = null
    usos.forEach(function (u) {
      if (u.veiculo_id !== v.id) return
      const ms = sobreposicao(u.saida, u.retorno, periodo)
      if (ms > 0) {
        msUso += ms
        viagens++
        if (u.km_retorno !== null) km += u.km_retorno - u.km_saida
      }
      if (!ultimaSaida || u.saida > ultimaSaida) ultimaSaida = u.saida
    })
    const horasUso = msUso / 3600000
    const utilizacao = (msUso / (periodo.ateMs - periodo.deMs)) * 100
    return {
      veiculo_id: v.id,
      placa: v.placa,
      modelo: v.modelo,
      viagens: viagens,
      km_rodados: km,
      horas_em_uso: arredondar(horasUso, 1),
      utilizacao_pct: arredondar(utilizacao, 1),
      ociosidade_pct: arredondar(100 - utilizacao, 1),
      dias_sem_uso: ultimaSaida ? Math.max(0, Math.floor((Date.now() - paraMs(ultimaSaida)) / MS_DIA)) : null
    }
  })

  return { periodo: { de: periodo.de, ate: periodo.ate }, veiculos: linhas }
}

router.get('/frota', function (req, res) {
  const periodo = lerPeriodo(req.query)
  if (!periodo) return res.status(400).json({ erro: 'Período inválido.' })
  res.json(calcularFrota(periodo))
})

// linha do tempo unica: entradas/saidas de alojamento e saidas/voltas de veiculo
function calcularMovimentacoes(periodo, filtros) {
  const f = filtros || {}

  const eventos = []

  db.prepare(
    'SELECT e.inicio, e.fim, p.nome, a.nome AS alojamento, q.nome AS quarto, l.codigo FROM estadia e ' +
    'JOIN pessoa p ON p.id = e.pessoa_id JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id ' +
    'JOIN alojamento a ON a.id = q.alojamento_id'
  ).all().forEach(function (e) {
    const recurso = e.alojamento + ' · ' + e.quarto + ' (' + e.codigo + ')'
    if (paraMs(e.inicio) >= periodo.deMs && paraMs(e.inicio) <= periodo.ateMs) {
      eventos.push({ quando: e.inicio, categoria: 'alojamento', tipo: 'Entrada', colaborador: e.nome, recurso: recurso })
    }
    if (e.fim && paraMs(e.fim) >= periodo.deMs && paraMs(e.fim) <= periodo.ateMs) {
      eventos.push({ quando: e.fim, categoria: 'alojamento', tipo: 'Saída', colaborador: e.nome, recurso: recurso })
    }
  })

  db.prepare(
    'SELECT u.saida, u.retorno, u.destino, u.km_saida, u.km_retorno, p.nome, v.modelo, v.placa FROM uso_veiculo u ' +
    'JOIN pessoa p ON p.id = u.motorista_id JOIN veiculo v ON v.id = u.veiculo_id'
  ).all().forEach(function (u) {
    const recurso = u.modelo + ' · ' + u.placa
    if (paraMs(u.saida) >= periodo.deMs && paraMs(u.saida) <= periodo.ateMs) {
      eventos.push({ quando: u.saida, categoria: 'frota', tipo: 'Retirada', colaborador: u.nome, recurso: recurso + ' → ' + u.destino })
    }
    if (u.retorno && paraMs(u.retorno) >= periodo.deMs && paraMs(u.retorno) <= periodo.ateMs) {
      eventos.push({ quando: u.retorno, categoria: 'frota', tipo: 'Devolução', colaborador: u.nome, recurso: recurso + ' (' + (u.km_retorno - u.km_saida) + ' km)' })
    }
  })

  eventos.sort(function (a, b) { return a.quando < b.quando ? 1 : -1 })

  // filtros opcionais: categoria (alojamento/frota), tipo (Entrada, Saída, Retirada, Devolução) e busca por colaborador ou recurso
  const busca = String(f.busca || '').trim().toLowerCase()
  const filtrados = eventos.filter(function (e) {
    if (f.categoria && e.categoria !== f.categoria) return false
    if (f.tipo && e.tipo !== f.tipo) return false
    if (busca !== '' && (e.colaborador + ' ' + e.recurso).toLowerCase().indexOf(busca) === -1) return false
    return true
  })
  const porTipo = { 'Entrada': 0, 'Saída': 0, 'Retirada': 0, 'Devolução': 0 }
  filtrados.forEach(function (e) { porTipo[e.tipo]++ })
  const limite = Math.min(Math.max(Number(f.limite) || 300, 1), 1000)

  return {
    periodo: { de: periodo.de, ate: periodo.ate },
    total: filtrados.length,
    por_tipo: porTipo,
    eventos: filtrados.slice(0, limite)
  }
}

router.get('/movimentacoes', function (req, res) {
  const periodo = lerPeriodo(req.query)
  if (!periodo) return res.status(400).json({ erro: 'Período inválido.' })
  res.json(calcularMovimentacoes(periodo, req.query))
})

// gargalos: onde o sistema esta apertado ou parado
function calcularGargalos(periodo) {
  const cfg = rotasConfig.lerConfig()
  const agora = Date.now()
  const itens = []

  // alojamentos lotados
  db.prepare(
    'SELECT a.id, a.nome, ' +
    '(SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS leitos, ' +
    '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS ocupados ' +
    'FROM alojamento a WHERE a.ativo = 1'
  ).all().forEach(function (a) {
    if (a.leitos > 0) {
      const pct = Math.round((a.ocupados / a.leitos) * 100)
      if (pct >= cfg.lotacaoAlertaPct) {
        itens.push({ tipo: 'lotacao', severidade: pct === 100 ? 'critico' : 'atencao', mensagem: a.nome + ' está com ' + pct + '% de ocupação (' + a.ocupados + '/' + a.leitos + ' leitos).' })
      }
    }
  })

  // ocorrencias abertas ha muito tempo
  db.prepare('SELECT o.id, o.aberta_em, o.descricao, a.nome FROM ocorrencia o JOIN alojamento a ON a.id = o.alojamento_id WHERE o.resolvida_em IS NULL').all().forEach(function (o) {
    const dias = Math.floor((agora - paraMs(o.aberta_em)) / MS_DIA)
    if (dias >= cfg.diasAlertaPendencia) {
      itens.push({ tipo: 'ocorrencia_antiga', severidade: 'atencao', mensagem: 'Ocorrência aberta há ' + dias + ' dias em ' + o.nome + ': ' + o.descricao })
    }
  })

  // carros fora da garagem alem do prazo
  db.prepare('SELECT u.saida, u.destino, v.modelo, v.placa, p.nome FROM uso_veiculo u JOIN veiculo v ON v.id = u.veiculo_id JOIN pessoa p ON p.id = u.motorista_id WHERE u.retorno IS NULL').all().forEach(function (u) {
    const horas = Math.floor((agora - paraMs(u.saida)) / 3600000)
    if (horas >= cfg.horasAlertaRetorno) {
      itens.push({ tipo: 'nao_voltou', severidade: 'critico', mensagem: u.modelo + ' ' + u.placa + ' saiu há ' + horas + 'h com ' + u.nome + ' (' + u.destino + ') e não voltou.' })
    }
  })

  // carros parados na oficina
  db.prepare('SELECT m.inicio, m.descricao, v.modelo, v.placa FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id WHERE m.fim IS NULL').all().forEach(function (m) {
    const dias = Math.floor((agora - paraMs(m.inicio)) / MS_DIA)
    if (dias >= cfg.diasAlertaPendencia) {
      itens.push({ tipo: 'oficina_longa', severidade: 'atencao', mensagem: m.modelo + ' ' + m.placa + ' está na oficina há ' + dias + ' dias (' + m.descricao + ').' })
    }
  })

  // veiculos muito usados ou parados (no periodo)
  const usos = db.prepare('SELECT veiculo_id, saida, retorno FROM uso_veiculo').all()
  db.prepare('SELECT id, placa, modelo FROM veiculo WHERE ativo = 1').all().forEach(function (v) {
    let ms = 0
    usos.forEach(function (u) { if (u.veiculo_id === v.id) ms += sobreposicao(u.saida, u.retorno, periodo) })
    const pct = (ms / (periodo.ateMs - periodo.deMs)) * 100
    if (pct >= 70) {
      itens.push({ tipo: 'frota_sobrecarregada', severidade: 'atencao', mensagem: v.modelo + ' ' + v.placa + ' ficou ' + arredondar(pct, 0) + '% do período em uso: pode faltar carro.' })
    } else if (pct < 5 && periodo.dias >= 7) {
      itens.push({ tipo: 'frota_ociosa', severidade: 'atencao', mensagem: v.modelo + ' ' + v.placa + ' ficou parado (' + arredondar(pct, 0) + '% de uso no período).' })
    }
  })

  return { periodo: { de: periodo.de, ate: periodo.ate }, total: itens.length, gargalos: itens }
}

router.get('/gargalos', function (req, res) {
  const periodo = lerPeriodo(req.query)
  if (!periodo) return res.status(400).json({ erro: 'Período inválido.' })
  res.json(calcularGargalos(periodo))
})

// "quem estava dirigindo o veiculo X na data Y?"
router.get('/quem-dirigia', function (req, res) {
  const veiculoId = Number(req.query.veiculo_id)
  const quando = normalizarData(req.query.quando)
  if (!veiculoId || !quando) return res.status(400).json({ erro: 'Informe o veículo e a data/hora.' })

  const veiculo = db.prepare('SELECT id, placa, modelo FROM veiculo WHERE id = ?').get(veiculoId)
  if (!veiculo) return res.status(404).json({ erro: 'Veículo não encontrado.' })

  const uso = db.prepare(
    'SELECT u.*, p.nome AS motorista, p.matricula FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
    'WHERE u.veiculo_id = ? AND u.saida <= ? AND (u.retorno IS NULL OR u.retorno >= ?) ORDER BY u.saida DESC LIMIT 1'
  ).get(veiculoId, quando, quando)

  if (uso) {
    const passageiros = db.prepare(
      'SELECT p.nome FROM uso_passageiro up JOIN pessoa p ON p.id = up.pessoa_id WHERE up.uso_veiculo_id = ? ORDER BY p.nome'
    ).all(uso.id).map(function (p) { return p.nome })
    return res.json({
      encontrado: true,
      veiculo: veiculo,
      quando: quando,
      motorista: uso.motorista,
      matricula: uso.matricula,
      destino: uso.destino,
      saida: uso.saida,
      retorno: uso.retorno,
      passageiros: passageiros
    })
  }

  // sem uso registrado: se o km aumentou entre a volta anterior e a saida seguinte, o carro foi usado sem registro
  const anterior = db.prepare(
    'SELECT retorno, km_retorno FROM uso_veiculo WHERE veiculo_id = ? AND retorno IS NOT NULL AND retorno < ? ORDER BY retorno DESC LIMIT 1'
  ).get(veiculoId, quando)
  const seguinte = db.prepare(
    'SELECT saida, km_saida FROM uso_veiculo WHERE veiculo_id = ? AND saida > ? ORDER BY saida ASC LIMIT 1'
  ).get(veiculoId, quando)

  if (anterior && seguinte && seguinte.km_saida > anterior.km_retorno) {
    return res.json({
      encontrado: false,
      uso_sem_registro: true,
      veiculo: veiculo,
      quando: quando,
      aviso: 'Nenhum uso registrado nesse horário, mas o km passou de ' + anterior.km_retorno + ' (volta em ' + anterior.retorno + ') para ' +
        seguinte.km_saida + ' (próxima saída em ' + seguinte.saida + '): o veículo foi usado sem registro (' + (seguinte.km_saida - anterior.km_retorno) + ' km).'
    })
  }

  res.json({ encontrado: false, uso_sem_registro: false, veiculo: veiculo, quando: quando, aviso: 'Nenhum uso registrado para esse veículo nesse horário.' })
})

module.exports = router
module.exports.lerPeriodo = lerPeriodo
module.exports.calcularOcupacao = calcularOcupacao
module.exports.calcularFrota = calcularFrota
module.exports.calcularMovimentacoes = calcularMovimentacoes
module.exports.calcularGargalos = calcularGargalos
