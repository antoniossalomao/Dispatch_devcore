// tela de Relatorios: ocupacao, frota, movimentacoes, gargalos, quem estava dirigindo e IA

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const toast = document.getElementById('toast-rel')

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

const campoDe = document.getElementById('rel-de')
const campoAte = document.getElementById('rel-ate')

function consulta() {
  return '?de=' + encodeURIComponent(campoDe.value) + '&ate=' + encodeURIComponent(campoAte.value)
}

// ===== abas =====

function mostrarAba(nome) {
  document.querySelectorAll('.rel-aba').forEach(function (b) { b.classList.toggle('ativa', b.dataset.aba === nome) })
  document.querySelectorAll('.rel-secao').forEach(function (s) { s.hidden = s.id !== 'aba-' + nome })
  if (nome === 'dirigindo') carregarVeiculosSelect()
}

document.querySelectorAll('.rel-aba').forEach(function (b) {
  b.addEventListener('click', function () { mostrarAba(b.dataset.aba) })
})

// ===== relatorios =====

function barra(pct, classeExtra) {
  const limitado = Math.max(0, Math.min(100, pct))
  return '<div class="aloj-barra"><div class="aloj-barra-preench' + (classeExtra || '') + '" style="width:' + limitado + '%"></div></div>'
}

async function carregarOcupacao() {
  const r = await chamarApi('/api/relatorios/ocupacao' + consulta())
  const caixa = document.getElementById('rel-ocupacao')
  if (!r.ok) { caixa.innerHTML = '<p class="texto-vazio">' + esc(r.dados.erro || 'Erro ao carregar.') + '</p>'; return }
  if (r.dados.alojamentos.length === 0) { caixa.innerHTML = '<p class="texto-vazio">Nenhum alojamento ativo.</p>'; return }
  caixa.innerHTML = ''
  r.dados.alojamentos.forEach(function (a) {
    const div = document.createElement('div')
    div.className = 'rel-linha'
    div.innerHTML =
      '<div class="rel-linha-topo"><strong>' + esc(a.nome) + '</strong><span>' + esc(a.cidade) + '</span></div>' +
      barra(a.ocupacao_media_pct) +
      '<div class="aloj-numeros"><span><strong>' + a.ocupacao_media_pct + '%</strong> de ocupação média no período</span>' +
      '<span>' + a.ocupados_agora + '/' + a.leitos + ' leitos agora · ' + a.entradas_no_periodo + ' entradas</span></div>'
    caixa.appendChild(div)
  })
}

async function carregarFrota() {
  const r = await chamarApi('/api/relatorios/frota' + consulta())
  const corpo = document.getElementById('rel-frota')
  corpo.innerHTML = ''
  if (!r.ok) { corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">' + esc(r.dados.erro || 'Erro ao carregar.') + '</td></tr>'; return }
  if (r.dados.veiculos.length === 0) { corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Nenhum veículo ativo.</td></tr>'; return }
  r.dados.veiculos.forEach(function (v) {
    const tr = document.createElement('tr')
    tr.innerHTML =
      '<td><div class="veic-celula"><span class="veic-modelo">' + esc(v.modelo) + '</span><span class="veic-placa">' + esc(v.placa) + '</span></div></td>' +
      '<td class="num">' + v.viagens + '</td><td class="num">' + v.km_rodados.toLocaleString('pt-BR') + ' km</td><td class="num">' + v.horas_em_uso + ' h</td>' +
      '<td class="celula-barra">' + barra(v.utilizacao_pct) + '<span class="rel-pct">' + v.utilizacao_pct + '% em uso · ' + v.ociosidade_pct + '% ocioso</span></td>' +
      '<td class="num">' + (v.dias_sem_uso === null ? '—' : v.dias_sem_uso + ' dias') + '</td>'
    corpo.appendChild(tr)
  })
}

async function carregarGargalos() {
  const r = await chamarApi('/api/relatorios/gargalos' + consulta())
  const caixa = document.getElementById('rel-gargalos')
  caixa.innerHTML = ''
  if (!r.ok) { caixa.innerHTML = '<p class="texto-vazio">' + esc(r.dados.erro || 'Erro ao carregar.') + '</p>'; return }
  if (r.dados.gargalos.length === 0) { caixa.innerHTML = '<p class="texto-vazio">Nenhum gargalo identificado no período.</p>'; return }
  r.dados.gargalos.forEach(function (g) {
    const div = document.createElement('div')
    div.className = 'alerta-item ' + (g.severidade === 'critico' ? 'alerta-problema' : 'alerta-atencao')
    div.innerHTML = '<p class="alerta-detalhe">' + esc(g.mensagem) + '</p>'
    caixa.appendChild(div)
  })
}

function carregarTudo() {
  if (!campoDe.value || !campoAte.value || campoDe.value > campoAte.value) {
    mostrarToast('Informe um período válido (a data inicial não pode ser depois da final).', 'erro')
    return
  }
  carregarOcupacao()
  carregarFrota()
  carregarGargalos()
}

document.getElementById('botao-atualizar').addEventListener('click', carregarTudo)

// ===== quem estava dirigindo =====

let veiculosCarregados = false
async function carregarVeiculosSelect() {
  if (veiculosCarregados) return
  const r = await chamarApi('/api/frota?status=todos')
  if (!r.ok) return
  const sel = document.getElementById('dir-veiculo')
  sel.innerHTML = ''
  r.dados.veiculos.forEach(function (v) {
    const o = document.createElement('option')
    o.value = v.id
    o.textContent = v.modelo + ' · ' + v.placa
    sel.appendChild(o)
  })
  veiculosCarregados = true
}

document.getElementById('form-dirigindo').addEventListener('submit', async function (e) {
  e.preventDefault()
  const caixa = document.getElementById('dir-resultado')
  const r = await chamarApi('/api/relatorios/quem-dirigia?veiculo_id=' + document.getElementById('dir-veiculo').value +
    '&quando=' + encodeURIComponent(document.getElementById('dir-quando').value))
  caixa.hidden = false
  if (!r.ok) {
    caixa.className = 'resultado-caixa resultado-erro'
    caixa.textContent = r.dados.erro || 'Erro na consulta.'
    return
  }
  const d = r.dados
  if (d.encontrado) {
    caixa.className = 'resultado-caixa resultado-ok'
    caixa.innerHTML =
      '<strong>' + esc(d.motorista) + '</strong> (matrícula ' + esc(d.matricula) + ') dirigia o ' + esc(d.veiculo.modelo) + ' ' + esc(d.veiculo.placa) + '.<br>' +
      'Destino: ' + esc(d.destino) + '<br>Saída: ' + formatarData(d.saida) + (d.retorno ? ' · Volta: ' + formatarData(d.retorno) : ' · ainda em trânsito') +
      (d.passageiros.length ? '<br>Passageiros: ' + esc(d.passageiros.join(', ')) : '')
  } else {
    caixa.className = 'resultado-caixa ' + (d.uso_sem_registro ? 'resultado-erro' : '')
    caixa.textContent = d.aviso
  }
})

// ===== IA =====

async function perguntarIa(url, corpo) {
  const caixa = document.getElementById('ia-resultado')
  caixa.hidden = false
  caixa.className = 'resultado-caixa'
  caixa.textContent = 'Pensando...'
  corpo.de = campoDe.value
  corpo.ate = campoAte.value
  const r = await chamarApi(url, { metodo: 'POST', corpo: corpo })
  if (!r.ok) {
    caixa.className = 'resultado-caixa resultado-erro'
    caixa.textContent = r.dados.erro || 'Erro ao consultar a IA.'
    return
  }
  caixa.className = 'resultado-caixa resultado-ok'
  caixa.textContent = r.dados.resposta
}

document.getElementById('form-ia').addEventListener('submit', function (e) {
  e.preventDefault()
  perguntarIa('/api/ia/perguntar', { pergunta: document.getElementById('ia-pergunta').value })
})
document.getElementById('botao-resumo-ia').addEventListener('click', function () {
  perguntarIa('/api/ia/resumo', {})
})

function aoIniciar() {
  const hoje = new Date()
  const inicio = new Date(hoje.getTime() - 30 * 86400000)
  campoAte.value = paraInputData(hoje)
  campoDe.value = paraInputData(inicio)
  const aba = window.location.hash.replace('#', '')
  if (['ocupacao', 'frota', 'gargalos', 'dirigindo', 'ia'].indexOf(aba) !== -1) mostrarAba(aba)
  carregarTudo()
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
