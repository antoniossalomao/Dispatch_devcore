// função única pra conversar com o back-end nas telas do sistema
// se abrir pelo Live Server (porta 5500), aponta pra porta 3001 do mesmo host
const baseApi = window.location.port === '3001'
  ? ''
  : 'http://' + (window.location.hostname || 'localhost') + ':3001'

let sequenciaRequisicao = 0

async function chamarApi(caminho, opcoes) {
  const config = opcoes || {}
  const detalhe = { id: ++sequenciaRequisicao, metodo: config.metodo || 'GET' }
  document.dispatchEvent(new CustomEvent('dispatch:requisicao-inicio', { detail: detalhe }))
  try {
    const resposta = await fetch(baseApi + caminho, {
      method: detalhe.metodo,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: config.corpo ? JSON.stringify(config.corpo) : undefined
    })
    const dados = await resposta.json().catch(function () { return {} })
    return { ok: resposta.ok, status: resposta.status, dados: dados }
  } finally {
    document.dispatchEvent(new CustomEvent('dispatch:requisicao-fim', { detail: detalhe }))
  }
}
