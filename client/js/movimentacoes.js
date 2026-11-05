// tela de Movimentacoes: linha do tempo de alojamentos e frota, com filtros e exportacao

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const toast = document.getElementById('toast-mov')

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
  return texto ? texto.slice(0, 16) : ''
}

function paraInputData(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate()
}

const campoDe = document.getElementById('mov-de')
const campoAte = document.getElementById('mov-ate')
const campoBusca = document.getElementById('mov-busca')
const seletorCategoria = document.getElementById('mov-categoria')
const seletorTipo = document.getElementById('mov-tipo')
const corpo = document.getElementById('mov-lista')
const botaoMais = document.getElementById('botao-mais')
const PASSO = 300

let limite = PASSO
let eventosAtuais = []
let timerBusca = null

// tipos de cada area (o filtro de tipo acompanha a area escolhida)
const tiposPorArea = { alojamento: ['Entrada', 'Saída'], frota: ['Retirada', 'Devolução'] }

function ajustarTipos() {
  const area = seletorCategoria.value
  Array.prototype.forEach.call(seletorTipo.options, function (o) {
    o.hidden = o.value !== '' && area !== '' && tiposPorArea[area].indexOf(o.value) === -1
  })
  if (seletorTipo.value !== '' && area !== '' && tiposPorArea[area].indexOf(seletorTipo.value) === -1) seletorTipo.value = ''
}

async function carregar() {
  if (!campoDe.value || !campoAte.value || campoDe.value > campoAte.value) {
    mostrarToast('Informe um período válido (a data inicial não pode ser depois da final).', 'erro')
    return
  }
  const q = '?de=' + encodeURIComponent(campoDe.value) + '&ate=' + encodeURIComponent(campoAte.value) +
    '&categoria=' + encodeURIComponent(seletorCategoria.value) + '&tipo=' + encodeURIComponent(seletorTipo.value) +
    '&busca=' + encodeURIComponent(campoBusca.value) + '&limite=' + limite
  const r = await chamarApi('/api/relatorios/movimentacoes' + q)
  corpo.innerHTML = ''
  if (!r.ok) {
    corpo.innerHTML = '<tr><td colspan="4" class="texto-vazio">' + esc(r.dados.erro || 'Erro ao carregar.') + '</td></tr>'
    botaoMais.hidden = true
    return
  }
  const d = r.dados
  eventosAtuais = d.eventos
  document.getElementById('kpi-entradas').textContent = d.por_tipo['Entrada']
  document.getElementById('kpi-saidas').textContent = d.por_tipo['Saída']
  document.getElementById('kpi-retiradas').textContent = d.por_tipo['Retirada']
  document.getElementById('kpi-devolucoes').textContent = d.por_tipo['Devolução']
  document.getElementById('mov-total').textContent = 'Mostrando ' + d.eventos.length + ' de ' + d.total
  botaoMais.hidden = d.total <= d.eventos.length || limite >= 1000

  if (d.eventos.length === 0) {
    corpo.innerHTML = '<tr><td colspan="4" class="texto-vazio">Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>'
    return
  }
  d.eventos.forEach(function (e) {
    const tr = document.createElement('tr')
    tr.innerHTML =
      '<td>' + formatarData(e.quando) + '</td>' +
      '<td><span class="status-tag ' + (e.categoria === 'frota' ? 'status-uso' : 'status-ativo') + '"><span class="status-ponto"></span>' + esc(e.tipo) + '</span></td>' +
      '<td>' + esc(e.colaborador) + '</td><td>' + esc(e.recurso) + '</td>'
    corpo.appendChild(tr)
  })
}

function recarregarDoInicio() {
  limite = PASSO
  carregar()
}

document.getElementById('botao-atualizar').addEventListener('click', recarregarDoInicio)
seletorCategoria.addEventListener('change', function () { ajustarTipos(); recarregarDoInicio() })
seletorTipo.addEventListener('change', recarregarDoInicio)
campoBusca.addEventListener('input', function () {
  if (timerBusca) clearTimeout(timerBusca)
  timerBusca = setTimeout(recarregarDoInicio, 300)
})
botaoMais.addEventListener('click', function () {
  limite = Math.min(limite + PASSO, 1000)
  carregar()
})

// exporta o que esta na tela (respeita os filtros) em CSV com ; e BOM pro Excel abrir os acentos
document.getElementById('botao-exportar').addEventListener('click', function () {
  if (eventosAtuais.length === 0) {
    mostrarToast('Não há movimentações para exportar.', 'erro')
    return
  }
  function celula(t) {
    const v = String(t === null || t === undefined ? '' : t)
    return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }
  const linhas = [['Quando', 'Área', 'Tipo', 'Colaborador', 'Recurso']].concat(eventosAtuais.map(function (e) {
    return [e.quando, e.categoria === 'frota' ? 'Frota' : 'Alojamento', e.tipo, e.colaborador, e.recurso]
  }))
  const csv = '\ufeff' + linhas.map(function (l) { return l.map(celula).join(';') }).join('\r\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  link.download = 'movimentacoes-' + campoDe.value + '-a-' + campoAte.value + '.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
})

function aoIniciar() {
  const hoje = new Date()
  campoAte.value = paraInputData(hoje)
  campoDe.value = paraInputData(new Date(hoje.getTime() - 30 * 86400000))
  carregar()
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
