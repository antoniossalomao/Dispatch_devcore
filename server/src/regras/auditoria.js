// grava alterações no log_auditoria e confere se o encadeamento de hashes está íntegro (regras U1 e U3)
const crypto = require('crypto')
const db = require('../db/conexao')

function doisDigitos(n) {
  return n < 10 ? '0' + n : String(n)
}

function agoraLocal() {
  const d = new Date()
  return (
    d.getFullYear() + '-' +
    doisDigitos(d.getMonth() + 1) + '-' +
    doisDigitos(d.getDate()) + ' ' +
    doisDigitos(d.getHours()) + ':' +
    doisDigitos(d.getMinutes()) + ':' +
    doisDigitos(d.getSeconds())
  )
}

function gerarHash(dados) {
  const texto = [
    dados.hashAnterior,
    dados.quando,
    dados.usuarioId,
    dados.acao,
    dados.tabela,
    dados.registroId,
    dados.resumo,
    dados.antesJson || '',
    dados.depoisJson || ''
  ].join('|')

  return crypto.createHash('sha256').update(texto).digest('hex')
}

function registrarLog(info) {
  const ultimo = db.prepare('SELECT hash FROM log_auditoria ORDER BY id DESC LIMIT 1').get()
  const hashAnterior = ultimo ? ultimo.hash : 'INICIO'
  const quando = agoraLocal()

  const antesJson = info.antes ? JSON.stringify(info.antes) : null
  const depoisJson = info.depois ? JSON.stringify(info.depois) : null

  const hash = gerarHash({
    hashAnterior: hashAnterior,
    quando: quando,
    usuarioId: info.usuarioId,
    acao: info.acao,
    tabela: info.tabela,
    registroId: info.registroId,
    resumo: info.resumo,
    antesJson: antesJson,
    depoisJson: depoisJson
  })

  db.prepare(
    'INSERT INTO log_auditoria ' +
    '(quando, usuario_id, acao, tabela, registro_id, resumo, antes_json, depois_json, hash_anterior, hash) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    quando,
    info.usuarioId,
    info.acao,
    info.tabela,
    info.registroId,
    info.resumo,
    antesJson,
    depoisJson,
    hashAnterior,
    hash
  )
}

function verificarIntegridadeLog() {
  const linhas = db.prepare('SELECT * FROM log_auditoria ORDER BY id ASC').all()
  let esperadoAnterior = 'INICIO'

  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i]

    if (l.hash_anterior !== esperadoAnterior) {
      return {
        integro: false,
        totalLinhas: linhas.length,
        linhaComProblema: l.id,
        motivo: 'O elo com o registro anterior foi quebrado na linha #' + l.id + '.'
      }
    }

    const recalculado = gerarHash({
      hashAnterior: l.hash_anterior,
      quando: l.quando,
      usuarioId: l.usuario_id,
      acao: l.acao,
      tabela: l.tabela,
      registroId: l.registro_id,
      resumo: l.resumo,
      antesJson: l.antes_json,
      depoisJson: l.depois_json
    })

    if (l.hash !== recalculado) {
      return {
        integro: false,
        totalLinhas: linhas.length,
        linhaComProblema: l.id,
        motivo: 'Os dados da linha #' + l.id + ' foram alterados fora do sistema.'
      }
    }

    esperadoAnterior = l.hash
  }

  return {
    integro: true,
    totalLinhas: linhas.length,
    linhaComProblema: null,
    motivo: 'Todos os registros conferem com a cadeia de hashes.'
  }
}

module.exports = {
  registrarLog: registrarLog,
  verificarIntegridadeLog: verificarIntegridadeLog
}
