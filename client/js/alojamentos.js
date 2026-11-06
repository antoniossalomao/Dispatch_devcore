// tela de Alojamentos: lista, mapa de leitos, estadias e ocorrencias

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const toast = document.getElementById('toast-aloj')

const grade = document.getElementById('grade-alojamentos')
const seletorStatus = document.getElementById('seletor-status')

const gaveta = document.getElementById('gaveta-alojamento')
const gavetaNome = document.getElementById('gaveta-aloj-nome')
const gavetaSub = document.getElementById('gaveta-aloj-sub')
const gavetaQuartos = document.getElementById('gaveta-quartos')
const gavetaOcorrencias = document.getElementById('gaveta-lista-ocorrencias')
const contOcorrencias = document.getElementById('cont-ocorrencias')
const gavetaBotaoStatus = document.getElementById('gaveta-botao-status')
const secoesGaveta = {
  leitos: document.getElementById('gaveta-secao-leitos'),
  ocorrencias: document.getElementById('gaveta-secao-ocorrencias')
}

let alojamentoAtual = null // detalhe aberto na gaveta
let colaboradoresAtivos = []
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

const nomesTipoLeito = { cama: 'Cama', beliche_baixo: 'Beliche (baixo)', beliche_cima: 'Beliche (cima)' }
const nomesTipoOcorrencia = { manutencao: 'Manutenção', conflito: 'Conflito', reclamacao: 'Reclamação', regra: 'Regra', outro: 'Outro' }

// ===== lista =====

async function carregarAlojamentos() {
  const r = await chamarApi('/api/alojamentos?status=' + seletorStatus.value)
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao carregar alojamentos.', 'erro')
    return
  }

  const t = r.dados.totais
  document.getElementById('kpi-alojamentos').textContent = t.alojamentos
  document.getElementById('kpi-leitos').textContent = t.leitos
  document.getElementById('kpi-livres').textContent = (t.leitos - t.ocupados) + ' livres'
  document.getElementById('kpi-ocupacao').textContent = (t.leitos > 0 ? Math.round((t.ocupados / t.leitos) * 100) : 0) + '%'
  document.getElementById('kpi-ocupados').textContent = t.ocupados + ' leitos ocupados'
  document.getElementById('kpi-ocorrencias').textContent = t.ocorrenciasAbertas

  grade.innerHTML = ''
  if (r.dados.alojamentos.length === 0) {
    grade.innerHTML = '<p class="texto-vazio">Nenhum alojamento encontrado.</p>'
    return
  }

  r.dados.alojamentos.forEach(function (a) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'aloj-cartao' + (a.ativo === 0 ? ' aloj-inativo' : '')
    const cheio = a.total_leitos > 0 && a.leitos_ocupados === a.total_leitos
    card.innerHTML =
      '<div class="aloj-cartao-topo">' +
        '<div><div class="aloj-nome">' + esc(a.nome) + '</div>' +
        '<div class="aloj-local">' + esc(a.cidade) + (a.bairro ? ' · ' + esc(a.bairro) : '') + '</div></div>' +
        (a.ocorrencias_abertas > 0
          ? '<span class="status-tag status-atencao"><span class="status-ponto"></span>' + a.ocorrencias_abertas + (a.ocorrencias_abertas === 1 ? ' ocorrência' : ' ocorrências') + '</span>'
          : '') +
      '</div>' +
      '<div class="aloj-barra"><div class="aloj-barra-preench' + (cheio ? ' cheio' : '') + '" style="width:' + a.ocupacao_pct + '%"></div></div>' +
      '<div class="aloj-numeros"><span><strong>' + a.leitos_ocupados + '/' + a.total_leitos + '</strong> leitos ocupados</span><span>' + a.total_quartos + (a.total_quartos === 1 ? ' quarto' : ' quartos') + '</span></div>' +
      '<div class="aloj-resp">Responsável: ' + esc(a.responsavel_nome || 'não definido') + '</div>'
    card.addEventListener('click', function () { abrirGaveta(a.id) })
    grade.appendChild(card)
  })
}

seletorStatus.addEventListener('change', carregarAlojamentos)

// ===== gaveta =====

async function abrirGaveta(id) {
  const r = await chamarApi('/api/alojamentos/' + id)
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Não foi possível abrir o alojamento.', 'erro')
    return
  }
  alojamentoAtual = r.dados
  desenharGaveta()
  gaveta.hidden = false
}

function desenharGaveta() {
  const a = alojamentoAtual.alojamento
  gavetaNome.textContent = a.nome
  const endereco = [a.rua, a.numero].filter(Boolean).join(', ')
  gavetaSub.textContent = [endereco, a.bairro, a.cidade].filter(Boolean).join(' · ') + ' · Responsável: ' + (a.responsavel_nome || 'não definido')
  gavetaBotaoStatus.textContent = a.ativo === 1 ? 'Desativar' : 'Reativar'

  gavetaQuartos.innerHTML = ''
  if (alojamentoAtual.quartos.length === 0) {
    gavetaQuartos.innerHTML = '<p class="texto-vazio">Nenhum quarto cadastrado ainda.</p>'
  }
  alojamentoAtual.quartos.forEach(function (q) {
    const ocupados = q.leitos.filter(function (l) { return l.estadia_id }).length
    const card = document.createElement('div')
    card.className = 'quarto-card'
    card.innerHTML =
      '<div class="quarto-titulo">' + esc(q.nome) + '<span>' + q.area_m2 + ' m² · ' + ocupados + '/' + q.leitos.length + ' ocupados</span></div>'
    const g = document.createElement('div')
    g.className = 'leitos-grade'
    q.leitos.forEach(function (l) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'leito ' + (l.estadia_id ? 'ocupado' : 'livre')
      b.innerHTML =
        '<span class="leito-codigo">' + esc(l.codigo) + '</span>' +
        '<span class="leito-tipo">' + nomesTipoLeito[l.tipo] + '</span>' +
        '<span class="leito-pessoa">' + (l.estadia_id ? esc(l.pessoa_nome) : 'Livre') + '</span>'
      b.addEventListener('click', function () {
        if (l.estadia_id) registrarSaida(l)
        else abrirAlojar(l)
      })
      g.appendChild(b)
    })
    card.appendChild(g)
    gavetaQuartos.appendChild(card)
  })

  contOcorrencias.textContent = alojamentoAtual.ocorrencias.length
  gavetaOcorrencias.innerHTML = ''
  if (alojamentoAtual.ocorrencias.length === 0) {
    gavetaOcorrencias.innerHTML = '<p class="texto-vazio">Nenhuma ocorrência registrada.</p>'
  }
  alojamentoAtual.ocorrencias.forEach(function (o) {
    const item = document.createElement('div')
    item.className = 'timeline-item' + (!o.resolvida_em ? ' timeline-ativo' : '')
    item.innerHTML =
      '<span class="timeline-titulo">' + nomesTipoOcorrencia[o.tipo] + ' · ' + esc(o.descricao) + '</span>' +
      '<span class="timeline-detalhe">' + (o.pessoa_nome ? 'Envolvido: ' + esc(o.pessoa_nome) + ' · ' : '') +
        (o.resolvida_em ? 'Solução: ' + esc(o.solucao) : 'Em aberto') + '</span>' +
      '<span class="timeline-data">Aberta: ' + o.aberta_em.slice(0, 16) + (o.resolvida_em ? ' | Resolvida: ' + o.resolvida_em.slice(0, 16) : '') + '</span>'
    if (!o.resolvida_em) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'btn-secundario btn-pequeno ocor-acoes'
      b.textContent = 'Resolver'
      b.addEventListener('click', function () { resolverOcorrencia(o) })
      item.appendChild(b)
    }
    gavetaOcorrencias.appendChild(item)
  })
}

async function recarregarTudo() {
  if (alojamentoAtual) {
    const r = await chamarApi('/api/alojamentos/' + alojamentoAtual.alojamento.id)
    if (r.ok) {
      alojamentoAtual = r.dados
      desenharGaveta()
    }
  }
  carregarAlojamentos()
}

document.getElementById('fechar-gaveta').addEventListener('click', function () {
  gaveta.hidden = true
  alojamentoAtual = null
})

document.querySelectorAll('.gaveta-aba').forEach(function (aba) {
  aba.addEventListener('click', function () {
    document.querySelectorAll('.gaveta-aba').forEach(function (x) { x.classList.remove('ativa') })
    aba.classList.add('ativa')
    Object.keys(secoesGaveta).forEach(function (k) { secoesGaveta[k].hidden = k !== aba.dataset.gaveta })
  })
})

// ===== alojamento: cadastro / edicao =====

function preencherResponsaveis(selecionado) {
  const sel = document.getElementById('aloj-responsavel')
  sel.innerHTML = '<option value="">Sem responsável</option>'
  colaboradoresAtivos.forEach(function (c) {
    const o = document.createElement('option')
    o.value = c.id
    o.textContent = c.nome + ' (' + c.matricula + ')'
    sel.appendChild(o)
  })
  sel.value = selecionado ? String(selecionado) : ''
}

function abrirFormAlojamento(a) {
  document.getElementById('modal-aloj-titulo').textContent = a ? 'Editar alojamento' : 'Novo alojamento'
  document.getElementById('aloj-id').value = a ? a.id : ''
  document.getElementById('aloj-nome').value = a ? a.nome : ''
  document.getElementById('aloj-cidade').value = a ? a.cidade : ''
  document.getElementById('aloj-rua').value = a && a.rua ? a.rua : ''
  document.getElementById('aloj-numero').value = a && a.numero ? a.numero : ''
  document.getElementById('aloj-bairro').value = a && a.bairro ? a.bairro : ''
  document.getElementById('aloj-cep').value = a && a.cep ? a.cep : ''
  document.getElementById('aloj-obs').value = a && a.observacoes ? a.observacoes : ''
  preencherResponsaveis(a ? a.responsavel_id : null)
  abrirModal('modal-alojamento')
}

document.getElementById('botao-novo-alojamento').addEventListener('click', function () { abrirFormAlojamento(null) })
document.getElementById('gaveta-botao-editar').addEventListener('click', function () {
  if (alojamentoAtual) abrirFormAlojamento(alojamentoAtual.alojamento)
})

document.getElementById('form-alojamento').addEventListener('submit', async function (e) {
  e.preventDefault()
  const id = document.getElementById('aloj-id').value
  const corpo = {
    nome: document.getElementById('aloj-nome').value,
    cidade: document.getElementById('aloj-cidade').value,
    rua: document.getElementById('aloj-rua').value,
    numero: document.getElementById('aloj-numero').value,
    bairro: document.getElementById('aloj-bairro').value,
    cep: document.getElementById('aloj-cep').value,
    observacoes: document.getElementById('aloj-obs').value,
    responsavel_id: document.getElementById('aloj-responsavel').value
  }
  const r = await chamarApi(id ? '/api/alojamentos/' + id : '/api/alojamentos', { metodo: id ? 'PUT' : 'POST', corpo: corpo })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao salvar.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-alojamento')
  recarregarTudo()
})

gavetaBotaoStatus.addEventListener('click', async function () {
  if (!alojamentoAtual) return
  const a = alojamentoAtual.alojamento
  const r = await chamarApi('/api/alojamentos/' + a.id + '/status', { metodo: 'PUT', corpo: { ativo: a.ativo === 1 ? 0 : 1 } })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  recarregarTudo()
})

// ===== quarto =====

const quartoCamas = document.getElementById('quarto-camas')
const quartoBeliches = document.getElementById('quarto-beliches')
const quartoArea = document.getElementById('quarto-area')

function resumoQuarto() {
  const camas = Number(quartoCamas.value) || 0
  const beliches = Number(quartoBeliches.value) || 0
  const leitos = camas + beliches * 2
  const minimo = camas * 3 + beliches * 4.5
  document.getElementById('quarto-resumo').textContent =
    leitos + ' leitos (máx. 8) · área mínima ' + minimo + ' m²'
}
quartoCamas.addEventListener('input', resumoQuarto)
quartoBeliches.addEventListener('input', resumoQuarto)

document.getElementById('botao-novo-quarto').addEventListener('click', function () {
  document.getElementById('form-quarto').reset()
  resumoQuarto()
  abrirModal('modal-quarto')
})

document.getElementById('form-quarto').addEventListener('submit', async function (e) {
  e.preventDefault()
  const nome = document.getElementById('quarto-nome').value.trim()
  const camas = Number(quartoCamas.value) || 0
  const beliches = Number(quartoBeliches.value) || 0
  const leitos = []
  let n = 1
  function codigo() { return nome + '-' + (n < 10 ? '0' + n : n) }
  for (let i = 0; i < camas; i++) { leitos.push({ codigo: codigo(), tipo: 'cama' }); n++ }
  for (let i = 0; i < beliches; i++) {
    leitos.push({ codigo: codigo(), tipo: 'beliche_baixo' }); n++
    leitos.push({ codigo: codigo(), tipo: 'beliche_cima' }); n++
  }
  const r = await chamarApi('/api/alojamentos/' + alojamentoAtual.alojamento.id + '/quartos', {
    metodo: 'POST',
    corpo: { nome: nome, area_m2: Number(quartoArea.value), leitos: leitos }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao salvar quarto.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-quarto')
  recarregarTudo()
})

// ===== estadias =====

function abrirAlojar(leito) {
  const sel = document.getElementById('alojar-pessoa')
  sel.innerHTML = ''
  colaboradoresAtivos.forEach(function (c) {
    const o = document.createElement('option')
    o.value = c.id
    o.textContent = c.nome + (c.alojamento_atual ? ' (já alojado)' : '')
    o.disabled = !!c.alojamento_atual
    sel.appendChild(o)
  })
  document.getElementById('alojar-leito-id').value = leito.id
  document.getElementById('alojar-leito-txt').textContent = 'Leito ' + leito.codigo + ' · ' + nomesTipoLeito[leito.tipo]
  abrirModal('modal-alojar')
}

document.getElementById('form-alojar').addEventListener('submit', async function (e) {
  e.preventDefault()
  const r = await chamarApi('/api/alojamentos/estadias', {
    metodo: 'POST',
    corpo: {
      pessoa_id: Number(document.getElementById('alojar-pessoa').value),
      leito_id: Number(document.getElementById('alojar-leito-id').value)
    }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao registrar entrada.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-alojar')
  await carregarColaboradores()
  recarregarTudo()
})

async function registrarSaida(leito) {
  if (!(await confirmar('Registrar a saída de ' + leito.pessoa_nome + ' do leito ' + leito.codigo + '?', { titulo: 'Registrar saída', confirmar: 'Registrar saída' }))) return
  const r = await chamarApi('/api/alojamentos/estadias/' + leito.estadia_id + '/saida', { metodo: 'PUT', corpo: {} })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao registrar saída.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  await carregarColaboradores()
  recarregarTudo()
}

// ===== ocorrencias =====

document.getElementById('botao-nova-ocorrencia').addEventListener('click', function () {
  document.getElementById('form-ocorrencia').reset()
  const sel = document.getElementById('ocor-pessoa')
  sel.innerHTML = '<option value="">Ninguém</option>'
  colaboradoresAtivos.forEach(function (c) {
    const o = document.createElement('option')
    o.value = c.id
    o.textContent = c.nome
    sel.appendChild(o)
  })
  abrirModal('modal-ocorrencia')
})

document.getElementById('form-ocorrencia').addEventListener('submit', async function (e) {
  e.preventDefault()
  const r = await chamarApi('/api/alojamentos/' + alojamentoAtual.alojamento.id + '/ocorrencias', {
    metodo: 'POST',
    corpo: {
      tipo: document.getElementById('ocor-tipo').value,
      pessoa_id: document.getElementById('ocor-pessoa').value,
      descricao: document.getElementById('ocor-descricao').value
    }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao abrir ocorrência.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-ocorrencia')
  recarregarTudo()
})

async function resolverOcorrencia(o) {
  const solucao = await pedirTexto('Resolver ocorrência', 'Como foi resolvido?', { confirmar: 'Resolver' })
  if (solucao === null) return
  const r = await chamarApi('/api/alojamentos/ocorrencias/' + o.id + '/resolver', { metodo: 'PUT', corpo: { solucao: solucao } })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao resolver.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  recarregarTudo()
}

// ===== inicio =====

async function carregarColaboradores() {
  const r = await chamarApi('/api/pessoas?status=ativos')
  colaboradoresAtivos = r.ok ? r.dados.colaboradores : []
}

botaoSair.addEventListener('click', async function () {
  await chamarApi('/api/auth/sair', { metodo: 'POST' })
  window.location.href = 'index.html'
})

document.querySelectorAll('.menu-em-breve').forEach(function (link) {
  link.addEventListener('click', function (e) {
    e.preventDefault()
    mostrarToast('Módulo "' + link.dataset.tela + '" em construção.', 'ok')
  })
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

  await carregarColaboradores()
  carregarAlojamentos()
}

iniciar()
