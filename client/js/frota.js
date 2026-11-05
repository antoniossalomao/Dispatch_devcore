// tela de Frota: veiculos, saidas, voltas e manutencoes

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const toast = document.getElementById('toast-frota')

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

const lista = document.getElementById('lista-veiculos')
const seletorStatus = document.getElementById('seletor-status')
const gaveta = document.getElementById('gaveta-veiculo')
const gavetaBotaoStatus = document.getElementById('gaveta-botao-status')
const secoesGaveta = {
  usos: document.getElementById('gaveta-secao-usos'),
  manutencoes: document.getElementById('gaveta-secao-manutencoes')
}

let veiculosCache = []
let detalheAtual = null // { veiculo, usos, manutencoes } aberto na gaveta
let colaboradores = []

const rotulosStatus = {
  disponivel: ['status-ativo', 'Disponível'],
  em_uso: ['status-uso', 'Em uso'],
  manutencao: ['status-atencao', 'Em manutenção']
}

function tagDoc(rotulo, doc) {
  if (doc.status === 'vencido') return '<span class="status-tag status-problema"><span class="status-ponto"></span>' + rotulo + ' vencido</span>'
  if (doc.status === 'vencendo') return '<span class="status-tag status-atencao"><span class="status-ponto"></span>' + rotulo + ' em ' + doc.dias + 'd</span>'
  if (doc.status === 'sem_data') return '<span class="doc-linha">' + rotulo + ': sem data</span>'
  return '<span class="doc-linha">' + rotulo + ' ok</span>'
}

function formatarData(texto) {
  return texto ? texto.slice(0, 16).replace('T', ' ') : ''
}

// ===== lista =====

async function carregarVeiculos() {
  const r = await chamarApi('/api/frota?status=' + seletorStatus.value)
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao carregar a frota.', 'erro')
    return
  }
  veiculosCache = r.dados.veiculos
  const t = r.dados.totais
  document.getElementById('kpi-disponiveis').textContent = t.disponiveis
  document.getElementById('kpi-total').textContent = 'de ' + t.total + ' veículos'
  document.getElementById('kpi-em-uso').textContent = t.emUso
  document.getElementById('kpi-manutencao').textContent = t.manutencao
  document.getElementById('kpi-docs').textContent = t.docsAtencao

  lista.innerHTML = ''
  if (veiculosCache.length === 0) {
    lista.innerHTML = '<tr><td colspan="6" class="texto-vazio">Nenhum veículo encontrado.</td></tr>'
    return
  }

  veiculosCache.forEach(function (v) {
    const tr = document.createElement('tr')
    if (v.ativo === 0) tr.className = 'colab-inativo'
    const st = rotulosStatus[v.status]
    tr.innerHTML =
      '<td><div class="veic-celula"><span class="veic-modelo">' + esc(v.modelo) + '</span><span class="veic-placa">' + esc(v.placa) + ' · ' + v.lugares + ' lugares · CNH ' + esc(v.categoria_cnh_exigida) + '</span></div></td>' +
      '<td><span class="status-tag ' + st[0] + '"><span class="status-ponto"></span>' + st[1] + '</span></td>' +
      '<td class="num">' + v.km_atual.toLocaleString('pt-BR') + ' km</td>' +
      '<td><div class="docs-celula">' + tagDoc('Licenciamento', v.licenciamento) + tagDoc('Seguro', v.seguro) + '</div></td>' +
      '<td class="uso-celula">' + (v.uso_atual
        ? esc(v.uso_atual.motorista) + '<span>' + esc(v.uso_atual.destino) + ' · desde ' + formatarData(v.uso_atual.saida) + '</span>'
        : '<span>—</span>') + '</td>'

    const tdAcoes = document.createElement('td')
    tdAcoes.className = 'coluna-acoes'
    const box = document.createElement('div')
    box.className = 'botoes-acoes'
    if (v.status === 'disponivel' && v.ativo === 1) {
      box.appendChild(botao('Saída', function () { abrirSaida(v.id) }))
    }
    if (v.status === 'em_uso') {
      box.appendChild(botao('Volta', function () { abrirVolta(v) }))
    }
    box.appendChild(botao('Detalhes', function () { abrirGaveta(v.id) }))
    tdAcoes.appendChild(box)
    tr.appendChild(tdAcoes)
    lista.appendChild(tr)
  })
}

function botao(texto, aoClicar) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'btn-secundario btn-pequeno'
  b.textContent = texto
  b.addEventListener('click', aoClicar)
  return b
}

seletorStatus.addEventListener('change', carregarVeiculos)

// ===== gaveta =====

async function abrirGaveta(id) {
  const r = await chamarApi('/api/frota/' + id)
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Não foi possível abrir o veículo.', 'erro')
    return
  }
  detalheAtual = r.dados
  desenharGaveta()
  gaveta.hidden = false
}

function desenharGaveta() {
  const v = detalheAtual.veiculo
  document.getElementById('gaveta-veic-nome').textContent = v.modelo + ' · ' + v.placa
  document.getElementById('gaveta-veic-sub').textContent = v.lugares + ' lugares · CNH ' + v.categoria_cnh_exigida + ' · ' + v.km_atual.toLocaleString('pt-BR') + ' km'
  gavetaBotaoStatus.textContent = v.ativo === 1 ? 'Desativar' : 'Reativar'

  document.getElementById('cont-usos').textContent = detalheAtual.usos.length
  const listaUsos = document.getElementById('gaveta-lista-usos')
  listaUsos.innerHTML = ''
  if (detalheAtual.usos.length === 0) listaUsos.innerHTML = '<p class="texto-vazio">Nenhum uso registrado.</p>'
  detalheAtual.usos.forEach(function (u) {
    const item = document.createElement('div')
    item.className = 'timeline-item' + (!u.retorno ? ' timeline-ativo' : '')
    item.innerHTML =
      '<span class="timeline-titulo">' + esc(u.motorista) + ' → ' + esc(u.destino) + '</span>' +
      '<span class="timeline-detalhe">' + (u.km_rodados !== null ? u.km_rodados + ' km rodados' : 'Em trânsito') +
        (u.passageiros.length ? ' · Passageiros: ' + esc(u.passageiros.join(', ')) : '') + '</span>' +
      '<span class="timeline-data">Saída: ' + formatarData(u.saida) + (u.retorno ? ' | Volta: ' + formatarData(u.retorno) : '') + '</span>'
    listaUsos.appendChild(item)
  })

  document.getElementById('cont-manut').textContent = detalheAtual.manutencoes.length
  const listaManut = document.getElementById('gaveta-lista-manut')
  listaManut.innerHTML = ''
  if (detalheAtual.manutencoes.length === 0) listaManut.innerHTML = '<p class="texto-vazio">Nenhuma manutenção registrada.</p>'
  detalheAtual.manutencoes.forEach(function (m) {
    const item = document.createElement('div')
    item.className = 'timeline-item' + (!m.fim ? ' timeline-ativo' : '')
    item.innerHTML =
      '<span class="timeline-titulo">' + (m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva') + ' · ' + esc(m.descricao) + '</span>' +
      '<span class="timeline-detalhe">' + (m.km !== null ? m.km.toLocaleString('pt-BR') + ' km · ' : '') + (m.fim ? 'Concluída' : 'Na oficina') + '</span>' +
      '<span class="timeline-data">Início: ' + formatarData(m.inicio) + (m.fim ? ' | Fim: ' + formatarData(m.fim) : '') + '</span>'
    if (!m.fim) {
      const b = botao('Concluir', function () { concluirManutencao(m) })
      b.classList.add('timeline-botoes')
      item.appendChild(b)
    }
    listaManut.appendChild(item)
  })
}

async function recarregarTudo() {
  if (detalheAtual) {
    const r = await chamarApi('/api/frota/' + detalheAtual.veiculo.id)
    if (r.ok) {
      detalheAtual = r.dados
      desenharGaveta()
    }
  }
  carregarVeiculos()
}

document.getElementById('fechar-gaveta').addEventListener('click', function () {
  gaveta.hidden = true
  detalheAtual = null
})

document.querySelectorAll('.gaveta-aba').forEach(function (aba) {
  aba.addEventListener('click', function () {
    document.querySelectorAll('.gaveta-aba').forEach(function (x) { x.classList.remove('ativa') })
    aba.classList.add('ativa')
    Object.keys(secoesGaveta).forEach(function (k) { secoesGaveta[k].hidden = k !== aba.dataset.gaveta })
  })
})

// ===== veiculo: cadastro / edicao =====

function abrirFormVeiculo(v) {
  document.getElementById('modal-veic-titulo').textContent = v ? 'Editar veículo' : 'Novo veículo'
  document.getElementById('veic-id').value = v ? v.id : ''
  document.getElementById('veic-placa').value = v ? v.placa : ''
  document.getElementById('veic-modelo').value = v ? v.modelo : ''
  document.getElementById('veic-lugares').value = v ? v.lugares : ''
  document.getElementById('veic-categoria').value = v ? v.categoria_cnh_exigida : 'B'
  document.getElementById('veic-km').value = v ? v.km_inicial : 0
  document.getElementById('veic-licenciamento').value = v && v.licenciamento_validade ? v.licenciamento_validade : ''
  document.getElementById('veic-seguro').value = v && v.seguro_validade ? v.seguro_validade : ''
  abrirModal('modal-veiculo')
}

document.getElementById('botao-novo-veiculo').addEventListener('click', function () { abrirFormVeiculo(null) })
document.getElementById('gaveta-botao-editar').addEventListener('click', function () {
  if (detalheAtual) abrirFormVeiculo(detalheAtual.veiculo)
})

document.getElementById('form-veiculo').addEventListener('submit', async function (e) {
  e.preventDefault()
  const id = document.getElementById('veic-id').value
  const corpo = {
    placa: document.getElementById('veic-placa').value,
    modelo: document.getElementById('veic-modelo').value,
    lugares: document.getElementById('veic-lugares').value,
    categoria_cnh_exigida: document.getElementById('veic-categoria').value,
    km_inicial: document.getElementById('veic-km').value,
    licenciamento_validade: document.getElementById('veic-licenciamento').value,
    seguro_validade: document.getElementById('veic-seguro').value
  }
  const r = await chamarApi(id ? '/api/frota/' + id : '/api/frota', { metodo: id ? 'PUT' : 'POST', corpo: corpo })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao salvar.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-veiculo')
  recarregarTudo()
})

gavetaBotaoStatus.addEventListener('click', async function () {
  if (!detalheAtual) return
  const v = detalheAtual.veiculo
  const r = await chamarApi('/api/frota/' + v.id + '/status', { metodo: 'PUT', corpo: { ativo: v.ativo === 1 ? 0 : 1 } })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  recarregarTudo()
})

// ===== saida =====

function abrirSaida(veiculoId) {
  const disponiveis = veiculosCache.filter(function (v) { return v.status === 'disponivel' && v.ativo === 1 })
  if (disponiveis.length === 0) {
    mostrarToast('Nenhum veículo disponível no momento.', 'erro')
    return
  }
  const selV = document.getElementById('saida-veiculo')
  selV.innerHTML = ''
  disponiveis.forEach(function (v) {
    const o = document.createElement('option')
    o.value = v.id
    o.textContent = v.modelo + ' · ' + v.placa
    selV.appendChild(o)
  })
  if (veiculoId) selV.value = String(veiculoId)

  const selM = document.getElementById('saida-motorista')
  selM.innerHTML = ''
  colaboradores.filter(function (c) { return c.cnh_categorias }).forEach(function (c) {
    const o = document.createElement('option')
    o.value = c.id
    o.textContent = c.nome + ' (CNH ' + c.cnh_categorias + ')' + (c.veiculo_atual ? ' · em viagem' : '')
    o.disabled = !!c.veiculo_atual
    selM.appendChild(o)
  })

  const caixa = document.getElementById('saida-passageiros')
  caixa.innerHTML = ''
  colaboradores.forEach(function (c) {
    const l = document.createElement('label')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.value = c.id
    cb.disabled = !!c.veiculo_atual
    l.appendChild(cb)
    l.appendChild(document.createTextNode(' ' + c.nome))
    caixa.appendChild(l)
  })

  document.getElementById('saida-destino').value = ''
  preencherKmSaida()
  abrirModal('modal-saida')
}

function preencherKmSaida() {
  const v = veiculosCache.filter(function (x) { return String(x.id) === document.getElementById('saida-veiculo').value })[0]
  document.getElementById('saida-km').value = v ? v.km_atual : ''
}
document.getElementById('saida-veiculo').addEventListener('change', preencherKmSaida)

document.getElementById('botao-saida-geral').addEventListener('click', function () { abrirSaida(null) })

document.getElementById('form-saida').addEventListener('submit', async function (e) {
  e.preventDefault()
  const passageiros = Array.prototype.slice.call(document.querySelectorAll('#saida-passageiros input:checked')).map(function (cb) { return Number(cb.value) })
  const r = await chamarApi('/api/frota/usos', {
    metodo: 'POST',
    corpo: {
      veiculo_id: Number(document.getElementById('saida-veiculo').value),
      motorista_id: Number(document.getElementById('saida-motorista').value),
      destino: document.getElementById('saida-destino').value,
      km_saida: Number(document.getElementById('saida-km').value),
      passageiros: passageiros
    }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao registrar saída.', 'erro')
    return
  }
  const avisos = r.dados.avisos || []
  mostrarToast(r.dados.mensagem + (avisos.length ? ' Atenção: ' + avisos.join(' ') : ''), avisos.length ? 'erro' : 'ok')
  fecharModal('modal-saida')
  await carregarColaboradores()
  recarregarTudo()
})

// ===== volta =====

function abrirVolta(v) {
  document.getElementById('volta-uso-id').value = v.uso_atual.uso_id
  document.getElementById('volta-resumo').textContent = v.modelo + ' · ' + v.placa + ' · saiu com km ' + v.km_atual.toLocaleString('pt-BR')
  document.getElementById('volta-km').value = v.km_atual
  abrirModal('modal-volta')
}

document.getElementById('form-volta').addEventListener('submit', async function (e) {
  e.preventDefault()
  const id = document.getElementById('volta-uso-id').value
  const corpo = { km_retorno: Number(document.getElementById('volta-km').value) }
  let r = await chamarApi('/api/frota/usos/' + id + '/retorno', { metodo: 'PUT', corpo: corpo })
  // F11: viagem muito longa pede confirmacao
  if (r.status === 409 && r.dados.confirmar) {
    if (!(await confirmar(r.dados.erro, { titulo: 'Confirmar viagem longa', confirmar: 'Confirmar km' }))) return
    corpo.confirmar = true
    r = await chamarApi('/api/frota/usos/' + id + '/retorno', { metodo: 'PUT', corpo: corpo })
  }
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao registrar volta.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-volta')
  await carregarColaboradores()
  recarregarTudo()
})

// ===== manutencao =====

document.getElementById('botao-nova-manutencao').addEventListener('click', function () {
  document.getElementById('form-manutencao').reset()
  if (detalheAtual) document.getElementById('manut-km').value = detalheAtual.veiculo.km_atual
  abrirModal('modal-manutencao')
})

document.getElementById('form-manutencao').addEventListener('submit', async function (e) {
  e.preventDefault()
  const r = await chamarApi('/api/frota/' + detalheAtual.veiculo.id + '/manutencoes', {
    metodo: 'POST',
    corpo: {
      tipo: document.getElementById('manut-tipo').value,
      descricao: document.getElementById('manut-descricao').value,
      km: document.getElementById('manut-km').value
    }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao abrir manutenção.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  fecharModal('modal-manutencao')
  recarregarTudo()
})

async function concluirManutencao(m) {
  const r = await chamarApi('/api/frota/manutencoes/' + m.id + '/concluir', { metodo: 'PUT', corpo: {} })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao concluir.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  recarregarTudo()
}

// ===== inicio =====

async function carregarColaboradores() {
  const r = await chamarApi('/api/pessoas?status=ativos')
  colaboradores = r.ok ? r.dados.colaboradores : []
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
  carregarVeiculos()
}

iniciar()
