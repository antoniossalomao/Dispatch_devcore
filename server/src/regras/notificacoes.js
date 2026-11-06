// gera os avisos do sininho (e manda os criticos pro Telegram). roda quando o server liga e quando alguem abre o sistema
const db = require('../db/conexao')
const auditoria = require('./auditoria')
const telegram = require('./telegram')
const ia = require('./ia')
const regrasCnh = require('./cnh')
const { diasAte } = require('./datas')

let ultimaVerificacao = 0

// cria o aviso se ainda nao existe um igual (mesmo tipo e registro) nao lido ou criado nas ultimas 24h
function criar(lista, tipo, severidade, mensagem, tabela, registroId) {
  const existe = db.prepare(
    "SELECT id FROM notificacao WHERE tipo = ? AND IFNULL(tabela, '') = ? AND IFNULL(registro_id, 0) = ? " +
    "AND (lida = 0 OR criada_em >= datetime('now', 'localtime', '-1 day')) LIMIT 1"
  ).get(tipo, tabela || '', registroId || 0)
  if (existe) return
  const r = db.prepare('INSERT INTO notificacao (tipo, severidade, mensagem, tabela, registro_id) VALUES (?, ?, ?, ?, ?)')
    .run(tipo, severidade, mensagem, tabela || null, registroId || null)
  lista.push({ id: Number(r.lastInsertRowid), severidade: severidade, mensagem: mensagem })
}

function gerarAvisos(cfg) {
  const novos = []
  const dias = cfg.diasAvisoVencimento
  const agora = Date.now()
  const MS_H = 3600000

  // CNH vencendo ou vencida (vencida com o carro na rua e critico)
  db.prepare('SELECT id, nome, cnh_categorias, cnh_validade FROM pessoa WHERE ativo = 1 AND cnh_categorias IS NOT NULL').all().forEach(function (p) {
    const s = regrasCnh.verificarSituacaoCnh(p.cnh_categorias, p.cnh_validade, dias)
    if (s.status === 'vencendo') {
      criar(novos, 'cnh_vencendo', 'atencao', 'A CNH de ' + p.nome + ' vence em ' + s.diasRestantes + ' dias.', 'pessoa', p.id)
    } else if (s.status === 'vencida') {
      const naRua = db.prepare('SELECT id FROM uso_veiculo WHERE motorista_id = ? AND retorno IS NULL').get(p.id)
      criar(novos, naRua ? 'cnh_vencida_na_rua' : 'cnh_vencida', naRua ? 'critico' : 'atencao',
        'A CNH de ' + p.nome + ' está vencida' + (naRua ? ' e a pessoa está com um veículo na rua.' : '.'), 'pessoa', p.id)
    }
  })

  // licenciamento e seguro
  db.prepare('SELECT id, placa, modelo, licenciamento_validade, seguro_validade FROM veiculo WHERE ativo = 1').all().forEach(function (v) {
    [['licenciamento', 'Licenciamento', v.licenciamento_validade], ['seguro', 'Seguro', v.seguro_validade]].forEach(function (d) {
      const n = diasAte(d[2])
      if (n === null) return
      if (n < 0) criar(novos, d[0] + '_vencido', 'atencao', d[1] + ' do ' + v.modelo + ' ' + v.placa + ' venceu há ' + Math.abs(n) + ' dias.', 'veiculo', v.id)
      else if (n <= dias) criar(novos, d[0] + '_vencendo', 'atencao', d[1] + ' do ' + v.modelo + ' ' + v.placa + ' vence em ' + n + ' dias.', 'veiculo', v.id)
    })
  })

  // km sem registro (F10): saida com km maior que a ultima volta, nos ultimos 30 dias
  const veiculos = db.prepare('SELECT id, placa, modelo, km_inicial FROM veiculo').all()
  const limite = new Date(agora - 30 * 24 * MS_H)
  veiculos.forEach(function (v) {
    const usos = db.prepare('SELECT id, saida, km_saida, km_retorno FROM uso_veiculo WHERE veiculo_id = ? ORDER BY saida, id').all(v.id)
    let esperado = v.km_inicial
    usos.forEach(function (u) {
      if (u.km_saida > esperado && new Date(u.saida.replace(' ', 'T')) >= limite) {
        criar(novos, 'km_sem_registro', 'critico',
          'O ' + v.modelo + ' ' + v.placa + ' rodou ' + (u.km_saida - esperado) + ' km sem registro antes da saída de ' + u.saida.slice(0, 16) + '.', 'uso_veiculo', u.id)
      }
      if (u.km_retorno !== null) esperado = u.km_retorno
    })
  })

  // carro que nao voltou
  db.prepare('SELECT u.id, u.saida, v.modelo, v.placa FROM uso_veiculo u JOIN veiculo v ON v.id = u.veiculo_id WHERE u.retorno IS NULL').all().forEach(function (u) {
    const h = Math.floor((agora - new Date(u.saida.replace(' ', 'T')).getTime()) / MS_H)
    if (h >= cfg.horasAlertaRetorno) {
      criar(novos, 'nao_voltou', 'critico', 'O ' + u.modelo + ' ' + u.placa + ' saiu há ' + h + 'h e ainda não voltou.', 'uso_veiculo', u.id)
    }
  })

  // alojamento lotado
  db.prepare(
    'SELECT a.id, a.nome, (SELECT COUNT(*) FROM leito l JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id) AS leitos, ' +
    '(SELECT COUNT(*) FROM estadia e JOIN leito l ON l.id = e.leito_id JOIN quarto q ON q.id = l.quarto_id WHERE q.alojamento_id = a.id AND e.fim IS NULL) AS ocupados ' +
    'FROM alojamento a WHERE a.ativo = 1'
  ).all().forEach(function (a) {
    if (a.leitos > 0 && Math.round((a.ocupados / a.leitos) * 100) >= cfg.lotacaoAlertaPct) {
      criar(novos, 'alojamento_lotado', 'atencao', a.nome + ' está com ' + a.ocupados + ' de ' + a.leitos + ' leitos ocupados.', 'alojamento', a.id)
    }
  })

  // ocorrencia aberta ha muito tempo e carro parado na oficina
  db.prepare('SELECT o.id, o.aberta_em, o.descricao, a.nome FROM ocorrencia o JOIN alojamento a ON a.id = o.alojamento_id WHERE o.resolvida_em IS NULL').all().forEach(function (o) {
    const d = Math.floor((agora - new Date(o.aberta_em.replace(' ', 'T')).getTime()) / (24 * MS_H))
    if (d >= cfg.diasAlertaPendencia) criar(novos, 'ocorrencia_antiga', 'atencao', 'Ocorrência aberta há ' + d + ' dias em ' + o.nome + ': ' + o.descricao, 'ocorrencia', o.id)
  })
  db.prepare('SELECT m.id, m.inicio, v.modelo, v.placa FROM manutencao m JOIN veiculo v ON v.id = m.veiculo_id WHERE m.fim IS NULL').all().forEach(function (m) {
    const d = Math.floor((agora - new Date(m.inicio.replace(' ', 'T')).getTime()) / (24 * MS_H))
    if (d >= cfg.diasAlertaPendencia) criar(novos, 'oficina_longa', 'atencao', 'O ' + m.modelo + ' ' + m.placa + ' está na oficina há ' + d + ' dias.', 'manutencao', m.id)
  })

  // log adulterado
  const integridade = auditoria.verificarIntegridadeLog()
  if (!integridade.integro) {
    criar(novos, 'log_adulterado', 'critico', 'Log de auditoria adulterado: ' + integridade.motivo, 'log_auditoria', integridade.linhaComProblema)
  }

  return novos
}

// confere tudo e manda os criticos novos pro Telegram (se o admin ligou nas configuracoes)
async function verificar(cfg) {
  ultimaVerificacao = Date.now()
  const novos = gerarAvisos(cfg)
  if (cfg.telegramCriticos) {
    const criticos = novos.filter(function (n) { return n.severidade === 'critico' })
    for (let i = 0; i < criticos.length; i++) {
      const texto = await ia.redigirAlerta('[DISPATCH · ' + cfg.nomeEmpresa + '] ' + criticos[i].mensagem)
      const admins = db.prepare("SELECT telegram_chat_id FROM usuario WHERE perfil = 'admin' AND ativo = 1 AND telegram_chat_id IS NOT NULL").all()
      let enviado = false
      if (admins.length === 0) {
        enviado = (await telegram.enviar(texto)).enviado
      }
      for (let j = 0; j < admins.length; j++) {
        if ((await telegram.enviar(texto, admins[j].telegram_chat_id)).enviado) enviado = true
      }
      if (enviado) db.prepare('UPDATE notificacao SET enviada_telegram = 1 WHERE id = ?').run(criticos[i].id)
    }
  }
  return novos
}

// no maximo uma verificacao por minuto (a tela de Resumo chama toda hora)
function precisaVerificar() {
  return Date.now() - ultimaVerificacao > 60000
}

module.exports = { verificar: verificar, precisaVerificar: precisaVerificar }
