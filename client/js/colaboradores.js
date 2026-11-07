// gerenciamento da tela de Colaboradores

const subtituloContagem = document.getElementById('subtitulo-contagem')
const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const botaoSeed = document.getElementById('botao-seed')
const avisoTela = document.getElementById('aviso-tela')
const toast = document.getElementById('toast-colab')

// KPIs do topo
const kpiTotalAtivos = document.getElementById('kpi-total-ativos')
const kpiComCnh = document.getElementById('kpi-com-cnh')
const kpiPctCnh = document.getElementById('kpi-pct-cnh')
const kpiCnhAlerta = document.getElementById('kpi-cnh-alerta')
const kpiAlojados = document.getElementById('kpi-alojados')
const kpiEmTransito = document.getElementById('kpi-em-transito')

// busca e filtros
const campoBusca = document.getElementById('campo-busca')
const seletorStatusAtivo = document.getElementById('seletor-status-ativo')
const abasFiltroCnh = document.querySelectorAll('.colab-filtros-topo .aba-item')
const listaColaboradores = document.getElementById('lista-colaboradores')

// modal de cadastro / edicao
const botaoNovoColab = document.getElementById('botao-novo-colaborador')
const modalColab = document.getElementById('modal-colaborador')
const fecharModal = document.getElementById('fechar-modal')
const cancelarModal = document.getElementById('cancelar-modal')
const formColab = document.getElementById('form-colaborador')
const modalTitulo = document.getElementById('modal-titulo')
const colabId = document.getElementById('colab-id')
const colabNome = document.getElementById('colab-nome')
const colabMatricula = document.getElementById('colab-matricula')
const colabCargo = document.getElementById('colab-cargo')
const colabObra = document.getElementById('colab-obra')
const colabTelefone = document.getElementById('colab-telefone')
const colabTemCnh = document.getElementById('colab-tem-cnh')
const camposCnh = document.getElementById('campos-cnh')
const colabCnhValidade = document.getElementById('colab-cnh-validade')

// gaveta de historico
const gavetaHistorico = document.getElementById('gaveta-historico')
const fecharGaveta = document.getElementById('fechar-gaveta')
const gavetaAvatar = document.getElementById('gaveta-avatar')
const gavetaNome = document.getElementById('gaveta-nome')
const gavetaSub = document.getElementById('gaveta-sub')
const contEstadias = document.getElementById('cont-estadias')
const contViagens = document.getElementById('cont-viagens')
const gavetaAtualAlojamento = document.getElementById('gaveta-atual-alojamento')
const gavetaAtualDesde = document.getElementById('gaveta-atual-desde')
const gavetaAtualVeiculo = document.getElementById('gaveta-atual-veiculo')
const gavetaAtualDestino = document.getElementById('gaveta-atual-destino')
const gavetaTel = document.getElementById('gaveta-tel')
const gavetaObra = document.getElementById('gaveta-obra')
const gavetaCnhCat = document.getElementById('gaveta-cnh-cat')
const gavetaCnhVal = document.getElementById('gaveta-cnh-val')
const gavetaCnhTag = document.getElementById('gaveta-cnh-tag')
const gavetaListaEstadias = document.getElementById('gaveta-lista-estadias')
const gavetaListaMotorista = document.getElementById('gaveta-lista-motorista')
const gavetaListaPassageiro = document.getElementById('gaveta-lista-passageiro')
const gavetaBotaoEditar = document.getElementById('gaveta-botao-editar')
const gavetaBotaoStatus = document.getElementById('gaveta-botao-status')
const gavetaAbas = document.querySelectorAll('.gaveta-aba')
const secoesGaveta = {
  visao: document.getElementById('gaveta-secao-visao'),
  alojamentos: document.getElementById('gaveta-secao-alojamentos'),
  frota: document.getElementById('gaveta-secao-frota')
}

let colaboradoresCache = []
let filtroCnhAtual = 'todos'
let colaboradorSelecionado = null
let timerToast = null

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
  timerToast = setTimeout(function () {
    toast.hidden = true
  }, 3200)
}

function tagCnh(info) {
  if (info.status === 'valida') {
    return '<span class="status-tag status-ativo"><span class="status-ponto"></span>' + info.rotulo + '</span>'
  }
  if (info.status === 'vencendo') {
    return '<span class="status-tag status-atencao"><span class="status-ponto"></span>' + info.rotulo + '</span>'
  }
  if (info.status === 'vencida') {
    return '<span class="status-tag status-problema"><span class="status-ponto"></span>' + info.rotulo + '</span>'
  }
  return '<span class="status-tag status-concluido"><span class="status-ponto"></span>Sem CNH</span>'
}

function desenharTabela(lista) {
  listaColaboradores.innerHTML = ''

  if (lista.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 5
    td.className = 'texto-vazio'
    td.textContent = 'Nenhum colaborador encontrado para os filtros selecionados.'
    tr.appendChild(td)
    listaColaboradores.appendChild(tr)
    return
  }

  lista.forEach(function (c) {
    const tr = document.createElement('tr')
    if (c.ativo === 0) tr.className = 'colab-inativo'

    // Colaborador (avatar + nome + matricula)
    const tdColab = document.createElement('td')
    const boxColab = document.createElement('div')
    boxColab.className = 'colab-celula'

    const avatar = document.createElement('div')
    avatar.className = 'colab-avatar'
    avatar.textContent = pegarIniciais(c.nome)

    const dadosNome = document.createElement('div')
    dadosNome.className = 'colab-dados-nome'

    const spanNome = document.createElement('span')
    spanNome.className = 'colab-nome'
    spanNome.textContent = c.nome
    spanNome.addEventListener('click', function () {
      abrirHistoricoColaborador(c.id)
    })

    const spanMatricula = document.createElement('span')
    spanMatricula.className = 'colab-matricula'
    spanMatricula.textContent = c.matricula + (c.ativo === 0 ? ' · (Inativo)' : '')

    dadosNome.appendChild(spanNome)
    dadosNome.appendChild(spanMatricula)
    boxColab.appendChild(avatar)
    boxColab.appendChild(dadosNome)
    tdColab.appendChild(boxColab)

    // Cargo / Obra
    const tdCargo = document.createElement('td')
    const pCargo = document.createElement('div')
    pCargo.className = 'colab-cargo'
    pCargo.textContent = c.cargo
    tdCargo.appendChild(pCargo)

    // CNH
    const tdCnh = document.createElement('td')
    const boxCnh = document.createElement('div')
    boxCnh.className = 'cnh-celula'

    // na lista so aparece a categoria; a etiqueta colorida fica pra CNH vencendo ou vencida
    const cat = document.createElement('span')
    cat.className = 'cnh-texto'
    cat.textContent = c.cnh_categorias ? 'Cat. ' + c.cnh_categorias : '—'
    boxCnh.appendChild(cat)
    if (c.cnh_info.status === 'vencendo' || c.cnh_info.status === 'vencida') {
      const spanTag = document.createElement('div')
      spanTag.innerHTML = tagCnh(c.cnh_info)
      boxCnh.appendChild(spanTag)
    }
    tdCnh.appendChild(boxCnh)

    // Situacao operacional
    const tdSituacao = document.createElement('td')
    const boxSit = document.createElement('div')
    boxSit.className = 'situacao-celula'

    if (c.alojamento_atual) {
      const divAloj = document.createElement('div')
      divAloj.className = 'situacao-alojamento'
      divAloj.textContent = c.alojamento_atual.alojamento + ' · ' + c.alojamento_atual.leito
      boxSit.appendChild(divAloj)
    }

    if (c.veiculo_atual) {
      const divVeic = document.createElement('div')
      divVeic.className = 'situacao-veiculo'
      divVeic.textContent = c.veiculo_atual.modelo + ' · ' + c.veiculo_atual.placa
      boxSit.appendChild(divVeic)
    }

    if (!c.alojamento_atual && !c.veiculo_atual) {
      const divLivre = document.createElement('div')
      divLivre.className = 'situacao-livre'
      divLivre.textContent = '—'
      boxSit.appendChild(divLivre)
    }
    tdSituacao.appendChild(boxSit)

    // Acoes
    const tdAcoes = document.createElement('td')
    tdAcoes.className = 'coluna-acoes'
    const boxAcoes = document.createElement('div')
    boxAcoes.className = 'botoes-acoes'

    const btnHist = document.createElement('button')
    btnHist.type = 'button'
    btnHist.className = 'btn-secundario btn-pequeno'
    btnHist.textContent = 'Histórico'
    btnHist.addEventListener('click', function () {
      abrirHistoricoColaborador(c.id)
    })

    const btnEditar = document.createElement('button')
    btnEditar.type = 'button'
    btnEditar.className = 'btn-secundario btn-pequeno'
    btnEditar.textContent = 'Editar'
    btnEditar.addEventListener('click', function () {
      abrirEdicaoColaborador(c)
    })

    boxAcoes.appendChild(btnHist)
    boxAcoes.appendChild(btnEditar)
    tdAcoes.appendChild(boxAcoes)

    tr.appendChild(tdColab)
    tr.appendChild(tdCargo)
    tr.appendChild(tdCnh)
    tr.appendChild(tdSituacao)
    tr.appendChild(tdAcoes)

    listaColaboradores.appendChild(tr)
  })
}

async function carregarColaboradores() {
  const status = seletorStatusAtivo.value
  const busca = encodeURIComponent(campoBusca.value.trim())
  const cnh = filtroCnhAtual

  try {
    const res = await chamarApi('/api/pessoas?status=' + status + '&cnh=' + cnh + '&busca=' + busca)
    if (!res.ok) {
      mostrarToast(res.dados.erro || 'Erro ao carregar colaboradores.', 'erro')
      return
    }

    const totais = res.dados.totais
    colaboradoresCache = res.dados.colaboradores || []

    subtituloContagem.textContent = totais.ativos + ' ativos · ' + totais.comCnh + ' habilitados · ' + totais.emTransito + ' em trânsito'
    kpiTotalAtivos.textContent = totais.ativos
    kpiComCnh.textContent = totais.comCnh
    kpiPctCnh.textContent = totais.total > 0 ? Math.round((totais.comCnh / totais.total) * 100) + '% da equipe' : '0%'
    kpiCnhAlerta.textContent = totais.cnhAlerta
    kpiAlojados.textContent = totais.alojados
    kpiEmTransito.textContent = totais.emTransito + ' com veículo da frota'

    // exibe o botao de seed se o banco estiver totalmente zerado
    if (totais.total === 0) {
      botaoSeed.hidden = false
    } else {
      botaoSeed.hidden = true
    }

    desenharTabela(colaboradoresCache)
  } catch (erro) {
    mostrarToast('Sem conexão com o servidor.', 'erro')
  }
}

// filtros
campoBusca.addEventListener('input', carregarColaboradores)
seletorStatusAtivo.addEventListener('change', carregarColaboradores)

abasFiltroCnh.forEach(function (aba) {
  aba.addEventListener('click', function () {
    abasFiltroCnh.forEach(function (b) { b.classList.remove('ativa') })
    aba.classList.add('ativa')
    filtroCnhAtual = aba.dataset.filtroCnh
    carregarColaboradores()
  })
})

// carregar 15 exemplos
botaoSeed.addEventListener('click', async function () {
  const r = await chamarApi('/api/pessoas/seed-exemplos', { metodo: 'POST' })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao carregar exemplos.', 'erro')
    return
  }
  mostrarToast(r.dados.mensagem, 'ok')
  carregarColaboradores()
})

// modal de novo colaborador / edicao
botaoNovoColab.addEventListener('click', function () {
  modalTitulo.textContent = 'Novo colaborador'
  formColab.reset()
  colabId.value = ''
  camposCnh.hidden = true
  document.querySelectorAll('input[name="cat"]').forEach(function (c) { c.checked = false })
  modalColab.hidden = false
  colabNome.focus()
})

function fecharModalColab() {
  modalColab.hidden = true
}

fecharModal.addEventListener('click', fecharModalColab)
cancelarModal.addEventListener('click', fecharModalColab)

colabTemCnh.addEventListener('change', function () {
  camposCnh.hidden = !colabTemCnh.checked
})

function abrirEdicaoColaborador(c) {
  modalTitulo.textContent = 'Editar colaborador'
  colabId.value = c.id
  colabNome.value = c.nome
  colabMatricula.value = c.matricula
  colabCargo.value = c.cargo
  colabObra.value = c.obra
  colabTelefone.value = c.telefone || ''

  if (c.cnh_categorias) {
    colabTemCnh.checked = true
    camposCnh.hidden = false
    colabCnhValidade.value = c.cnh_validade || ''

    const cats = c.cnh_categorias.split(',')
    document.querySelectorAll('input[name="cat"]').forEach(function (chk) {
      chk.checked = cats.indexOf(chk.value) !== -1
    })
  } else {
    colabTemCnh.checked = false
    camposCnh.hidden = true
    colabCnhValidade.value = ''
    document.querySelectorAll('input[name="cat"]').forEach(function (chk) {
      chk.checked = false
    })
  }

  modalColab.hidden = false
  colabNome.focus()
}

formColab.addEventListener('submit', async function (e) {
  e.preventDefault()

  const id = colabId.value
  const temCnh = colabTemCnh.checked
  const cats = []
  if (temCnh) {
    document.querySelectorAll('input[name="cat"]:checked').forEach(function (chk) {
      cats.push(chk.value)
    })
  }

  const corpo = {
    nome: colabNome.value,
    matricula: colabMatricula.value,
    cargo: colabCargo.value,
    obra: colabObra.value,
    telefone: colabTelefone.value,
    cnh_categorias: temCnh ? cats.join(',') : '',
    cnh_validade: temCnh ? colabCnhValidade.value : ''
  }

  const metodo = id ? 'PUT' : 'POST'
  const endpoint = id ? '/api/pessoas/' + id : '/api/pessoas'

  const r = await chamarApi(endpoint, {
    metodo: metodo,
    corpo: corpo
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao salvar colaborador.', 'erro')
    return
  }

  fecharModalColab()
  mostrarToast(r.dados.mensagem, 'ok')
  carregarColaboradores()

  if (colaboradorSelecionado && colaboradorSelecionado.id === Number(id)) {
    abrirHistoricoColaborador(id)
  }
})

// ---- gaveta lateral de historico ----

function fecharGavetaColab() {
  gavetaHistorico.hidden = true
  colaboradorSelecionado = null
}

fecharGaveta.addEventListener('click', fecharGavetaColab)

// alternar abas da gaveta
gavetaAbas.forEach(function (aba) {
  aba.addEventListener('click', function () {
    gavetaAbas.forEach(function (a) { a.classList.remove('ativa') })
    aba.classList.add('ativa')
    const alvo = aba.dataset.gaveta
    Object.keys(secoesGaveta).forEach(function (chave) {
      secoesGaveta[chave].hidden = chave !== alvo
    })
  })
})

async function abrirHistoricoColaborador(id) {
  try {
    const res = await chamarApi('/api/pessoas/' + id)
    if (!res.ok) {
      mostrarToast(res.dados.erro || 'Erro ao carregar dados do colaborador.', 'erro')
      return
    }

    const c = res.dados.colaborador
    colaboradorSelecionado = c

    gavetaAvatar.textContent = pegarIniciais(c.nome)
    gavetaNome.textContent = c.nome
    gavetaSub.textContent = c.matricula + ' · ' + c.cargo
    gavetaTel.textContent = c.telefone || 'Não informado'
    gavetaObra.textContent = c.obra || 'Sede'
    gavetaCnhCat.textContent = c.cnh_categorias ? 'Categoria(s) ' + c.cnh_categorias : 'Sem CNH cadastrada'
    gavetaCnhVal.textContent = c.cnh_validade ? c.cnh_validade.split('-').reverse().join('/') : '—'
    gavetaCnhTag.innerHTML = tagCnh(c.cnh_info)

    // situacao atual
    const estadias = res.dados.estadias || []
    const estadiaAtual = estadias.find(function (e) { return !e.fim })
    if (estadiaAtual) {
      gavetaAtualAlojamento.textContent = estadiaAtual.alojamento + ' · Quarto ' + estadiaAtual.quarto
      gavetaAtualDesde.textContent = 'Leito ' + estadiaAtual.leito + ' desde ' + estadiaAtual.inicio.slice(0, 10).split('-').reverse().join('/')
    } else {
      gavetaAtualAlojamento.textContent = 'Não alojado no momento'
      gavetaAtualDesde.textContent = 'Sem estadia em aberto'
    }

    const viagensMotorista = res.dados.usos_motorista || []
    const viagemAtual = viagensMotorista.find(function (u) { return !u.retorno })
    if (viagemAtual) {
      gavetaAtualVeiculo.textContent = viagemAtual.modelo + ' (' + viagemAtual.placa + ')'
      gavetaAtualDestino.textContent = 'Destino: ' + viagemAtual.destino + ' · saída às ' + viagemAtual.saida.slice(11, 16)
    } else {
      gavetaAtualVeiculo.textContent = 'Nenhum veículo em posse'
      gavetaAtualDestino.textContent = 'Sem saída de veículo ativa'
    }

    // preenche abas de estadias
    contEstadias.textContent = estadias.length
    gavetaListaEstadias.innerHTML = ''
    if (estadias.length === 0) {
      gavetaListaEstadias.innerHTML = '<p class="texto-vazio">Nenhuma estadia registrada no histórico deste colaborador.</p>'
    } else {
      estadias.forEach(function (e) {
        const item = document.createElement('div')
        item.className = 'timeline-item' + (!e.fim ? ' timeline-ativo' : '')
        item.innerHTML =
          '<span class="timeline-titulo">' + e.alojamento + ' · Quarto ' + e.quarto + ' (Leito ' + e.leito + ')</span>' +
          '<span class="timeline-detalhe">' + (!e.fim ? 'Estadia atual (em andamento)' : 'Saída registrada') + '</span>' +
          '<span class="timeline-data">Entrada: ' + e.inicio.slice(0, 16) + (e.fim ? ' | Saída: ' + e.fim.slice(0, 16) : '') + '</span>'
        gavetaListaEstadias.appendChild(item)
      })
    }

    // preenche abas de frota (motorista e passageiro)
    const viagensPassageiro = res.dados.usos_passageiro || []
    contViagens.textContent = viagensMotorista.length + viagensPassageiro.length

    gavetaListaMotorista.innerHTML = ''
    if (viagensMotorista.length === 0) {
      gavetaListaMotorista.innerHTML = '<p class="texto-vazio">Nenhum registro de condução como motorista.</p>'
    } else {
      viagensMotorista.forEach(function (u) {
        const item = document.createElement('div')
        item.className = 'timeline-item' + (!u.retorno ? ' timeline-ativo' : '')
        item.innerHTML =
          '<span class="timeline-titulo">' + u.modelo + ' · Placa ' + u.placa + '</span>' +
          '<span class="timeline-detalhe">Destino: ' + u.destino + (u.km_rodados !== null ? ' (' + u.km_rodados + ' km percorridos)' : ' (Em trânsito)') + '</span>' +
          '<span class="timeline-data">Saída: ' + u.saida.slice(0, 16) + (u.retorno ? ' | Volta: ' + u.retorno.slice(0, 16) : '') + '</span>'
        gavetaListaMotorista.appendChild(item)
      })
    }

    gavetaListaPassageiro.innerHTML = ''
    if (viagensPassageiro.length === 0) {
      gavetaListaPassageiro.innerHTML = '<p class="texto-vazio">Nenhuma viagem como passageiro registrada.</p>'
    } else {
      viagensPassageiro.forEach(function (up) {
        const item = document.createElement('div')
        item.className = 'timeline-item'
        item.innerHTML =
          '<span class="timeline-titulo">' + up.modelo + ' (' + up.placa + ')</span>' +
          '<span class="timeline-detalhe">Motorista: ' + up.motorista + ' · Destino: ' + up.destino + '</span>' +
          '<span class="timeline-data">Data: ' + up.saida.slice(0, 16) + '</span>'
        gavetaListaPassageiro.appendChild(item)
      })
    }

    // botao de status (desativar / reativar)
    gavetaBotaoStatus.textContent = c.ativo === 1 ? 'Desativar colaborador' : 'Reativar colaborador'

    gavetaHistorico.hidden = false
  } catch (erro) {
    mostrarToast('Não foi possível abrir o histórico.', 'erro')
  }
}

gavetaBotaoEditar.addEventListener('click', function () {
  if (!colaboradorSelecionado) return
  abrirEdicaoColaborador(colaboradorSelecionado)
})

gavetaBotaoStatus.addEventListener('click', async function () {
  if (!colaboradorSelecionado) return
  const novoAtivo = colaboradorSelecionado.ativo === 1 ? 0 : 1

  const r = await chamarApi('/api/pessoas/' + colaboradorSelecionado.id + '/status', {
    metodo: 'PUT',
    corpo: { ativo: novoAtivo }
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro')
    return
  }

  mostrarToast(r.dados.mensagem, 'ok')
  fecharGavetaColab()
  carregarColaboradores()
})

botaoSair.addEventListener('click', async function () {
  await chamarApi('/api/auth/sair', { metodo: 'POST' })
  window.location.href = 'index.html'
})

// inicializacao e checagem de perfil admin
async function iniciar() {
  try {
    const sessao = await chamarApi('/api/auth/eu')
    if (!sessao.ok) {
      window.location.href = 'index.html'
      return
    }

    const user = sessao.dados.usuario
    perfilNome.textContent = user.nome
    perfilTipo.textContent = user.perfil
    usuarioIniciais.textContent = pegarIniciais(user.nome)

    if (user.perfil === 'admin') {
      blocoMenuAdmin.hidden = false
    }

    // carrega dados da empresa nas configuracoes
    const resCfg = await chamarApi('/api/configuracoes')
    if (resCfg.ok && resCfg.dados.parametros && resCfg.dados.parametros.nomeEmpresa) {
      nomeEmpresaMenu.textContent = resCfg.dados.parametros.nomeEmpresa
    }

    carregarColaboradores()
  } catch (e) {
    carregarColaboradores()
  }
}

iniciar()
