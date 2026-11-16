// funcoes de data usadas pelas rotas (formato do banco: AAAA-MM-DD HH:MM:SS, horario local)

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

function dataCalendarioValida(ano, mes, dia) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return false
  const dt = new Date(ano, mes - 1, dia)
  return dt.getFullYear() === ano && dt.getMonth() === mes - 1 && dt.getDate() === dia
}

function dataIsoValida(texto) {
  const m = String(texto || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return false
  return dataCalendarioValida(Number(m[1]), Number(m[2]), Number(m[3]))
}

// aceita "2026-11-05", "2026-11-05T10:30" ou "2026-11-05 10:30" e devolve "AAAA-MM-DD HH:MM:SS"
function normalizarData(texto) {
  const t = String(texto || '').trim().replace('T', ' ')
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (!dataCalendarioValida(ano, mes, dia)) return null
  const hora = m[4] === undefined ? 0 : Number(m[4])
  const min = m[5] === undefined ? 0 : Number(m[5])
  const seg = m[6] === undefined ? 0 : Number(m[6])
  if (hora > 23 || min > 59 || seg > 59) return null
  return m[1] + '-' + m[2] + '-' + m[3] + ' ' + doisDigitos(hora) + ':' + doisDigitos(min) + ':' + doisDigitos(seg)
}

// diferenca em dias entre hoje e uma data AAAA-MM-DD (negativo = ja passou)
function diasAte(dataIso) {
  if (!dataIso) return null
  const trecho = String(dataIso).trim().slice(0, 10)
  if (!dataIsoValida(trecho)) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(trecho + 'T00:00:00')
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000)
}

module.exports = {
  agoraLocal: agoraLocal,
  normalizarData: normalizarData,
  diasAte: diasAte,
  dataIsoValida: dataIsoValida
}
