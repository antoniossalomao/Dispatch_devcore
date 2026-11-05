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

// aceita "2026-11-05", "2026-11-05T10:30" ou "2026-11-05 10:30" e devolve "AAAA-MM-DD HH:MM:SS"
function normalizarData(texto) {
  const t = String(texto || '').trim().replace('T', ' ')
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  return m[1] + ' ' + (m[2] || '00:00') + ':' + (m[3] || '00')
}

// diferenca em dias entre hoje e uma data AAAA-MM-DD (negativo = ja passou)
function diasAte(dataIso) {
  if (!dataIso) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(String(dataIso).slice(0, 10) + 'T00:00:00')
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000)
}

module.exports = { agoraLocal: agoraLocal, normalizarData: normalizarData, diasAte: diasAte }
