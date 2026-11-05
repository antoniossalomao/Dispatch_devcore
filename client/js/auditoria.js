// tela de Auditoria: log de alteracoes e integridade da cadeia de hashes

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const toast = document.getElementById('toast-aud')

let timerToast = null

function esc(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pegarIniciais(nome) {
  const texto = (nome || '').trim()
  if (texto === '') return '--'
  const partes = texto.split(' ')
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function mostrarToast(texto, tipo) {
  toast.textContent = texto
  toast.className = tipo === 'erro' ? 'toast toast-erro' : 'toast'
  toast.hidden = false
  if (timerToast) clearTimeout(timerToast)
  timerToast = setTimeout(function () { toast.hidden = true }, 3200)
}

function abrirModal(id) { document.getElementById(id).hidden = false }
function fecharModal(id) { document.getElementById(id).hidden = true }

document.querySelectorAll('[data-fechar]').forEach(function (b) {
  b.addEventListener('click', function () { fecharModal(b.dataset.fechar) })
})

function formatarData(texto) {
  return texto ? texto.slice(0, 19) : ''
}

const acoes = { criou: ['status-ativo', 'Criou'], alterou: ['status-uso', 'Alterou'], arquivou: ['status-atencao', 'Arquivou'] }
const campoBusca = document.getElementById('aud-busca')
const seletorTabela = document.getElementById('aud-tabela')
const seletorAcao = document.getElementById('aud-acao')
const corpo = document.getElementById('aud-lista')
let timerBusca = null

function resumirJson(texto) {
  if (!texto) return '—'
  try {
    const o = JSON.parse(texto)
    return Object.keys(o).map(function (k) { return k + ': ' + (o[k] === null ? 'vazio' : (typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])) }).join(' · ')
  } catch (e) {
    return texto
  }
}

async function carregarLog() {
  const q = '?busca=' + encodeURIComponent(campoBusca.value) + '&tabela=' + encodeURIComponent(seletorTabela.value) + '&acao=' + encodeURIComponent(seletorAcao.value)
  const r = await chamarApi('/api/auditoria' + q)
  corpo.innerHTML = ''
  if (!r.ok) {
    corpo.innerHTML = '<tr><td colspan="5" class="texto-vazio">' + esc(r.dados.erro || 'Erro ao carregar o log.') + '</td></tr>'
    return
  }
  // preenche o filtro de tabelas uma vez
  if (seletorTabela.options.length === 1) {
    r.dados.tabelas.forEach(function (t) {
      const o = document.createElement('option')
      o.value = t
      o.textContent = t
      seletorTabela.appendChild(o)
    })
  }
  document.getElementById('aud-total').textContent = r.dados.total + ' registros no log'
  if (r.dados.linhas.length === 0) {
    corpo.innerHTML = '<tr><td colspan="5" class="texto-vazio">Nenhum registro encontrado.</td></tr>'
    return
  }
  r.dados.linhas.forEach(function (l) {
    const a = acoes[l.acao] || ['status-concluido', l.acao]
    const tr = document.createElement('tr')
    tr.innerHTML =
      '<td>' + formatarData(l.quando) + '</td><td>' + esc(l.usuario) + '</td>' +
      '<td><span class="status-tag ' + a[0] + '"><span class="status-ponto"></span>' + a[1] + '</span></td>' +
      '<td>' + esc(l.resumo) + '<span class="aud-tabela">' + esc(l.tabela) + ' #' + l.registro_id + '</span></td>' +
      '<td class="aud-diff">' + (l.antes_json || l.depois_json
        ? '<span>' + esc(resumirJson(l.antes_json)) + '</span><span>→ ' + esc(resumirJson(l.depois_json)) + '</span>'
        : '—') + '</td>'
    corpo.appendChild(tr)
  })
}

campoBusca.addEventListener('input', function () {
  if (timerBusca) clearTimeout(timerBusca)
  timerBusca = setTimeout(carregarLog, 300)
})
seletorTabela.addEventListener('change', carregarLog)
seletorAcao.addEventListener('change', carregarLog)

document.getElementById('botao-verificar').addEventListener('click', async function () {
  const caixa = document.getElementById('caixa-integridade')
  const r = await chamarApi('/api/auditoria/integridade')
  caixa.hidden = false
  if (!r.ok) {
    caixa.className = 'resultado-caixa resultado-erro'
    caixa.textContent = r.dados.erro || 'Erro ao verificar.'
    return
  }
  const d = r.dados
  caixa.className = 'resultado-caixa ' + (d.integro ? 'resultado-ok' : 'resultado-erro')
  caixa.textContent = (d.integro ? 'Log íntegro. ' : 'ATENÇÃO: log adulterado! ') + d.motivo + ' (' + d.totalLinhas + ' linhas conferidas)'
})

function aoIniciar() {
  carregarLog()
}

// ===== inicio =====

botaoSair.addEventListener('click', async function () {
  await chamarApi('/api/auth/sair', { metodo: 'POST' })
  window.location.href = 'index.html'
})

async function iniciar() {
  const sessao = await chamarApi('/api/auth/eu')
  if (!sessao.ok) {
    window.location.href = 'index.html'
    return
  }
  const user = sessao.dados.usuario
  perfilNome.textContent = user.nome
  perfilTipo.textContent = user.perfil
  usuarioIniciais.textContent = pegarIniciais(user.nome)
  if (user.perfil === 'admin') blocoMenuAdmin.hidden = false

  const cfg = await chamarApi('/api/configuracoes')
  if (cfg.ok && cfg.dados.parametros && cfg.dados.parametros.nomeEmpresa) {
    nomeEmpresaMenu.textContent = cfg.dados.parametros.nomeEmpresa
  }

  aoIniciar()
}

iniciar()
