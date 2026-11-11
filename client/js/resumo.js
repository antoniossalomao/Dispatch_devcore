// tela de Resumo Operacional

const numVeiculosUso = document.getElementById('num-veiculos-uso')
const subVeiculosUso = document.getElementById('sub-veiculos-uso')
const detalheVeiculosUso = document.getElementById('detalhe-veiculos-uso')

const numVeiculosDisp = document.getElementById('num-veiculos-disp')

const numAlojamentos = document.getElementById('num-alojamentos')
const subAlojamentos = document.getElementById('sub-alojamentos')
const detalheAlojamentos = document.getElementById('detalhe-alojamentos')

const numVagas = document.getElementById('num-vagas')

const listaMov = document.getElementById('lista-movimentacoes')
const listaAloj = document.getElementById('lista-alojamentos')

const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')

const campoBusca = document.getElementById('campo-busca')
const avisoTela = document.getElementById('aviso-tela')
const dataHoje = document.getElementById('data-hoje')
const abasFiltro = document.querySelectorAll('.aba-item')

let movimentacoesAtuais = []
let filtroCategoria = 'todos'

// mostra a data atual no cabeçalho
dataHoje.textContent = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'short'
})

function mostrarAviso(texto) {
  avisoTela.textContent = texto
  avisoTela.hidden = false
  setTimeout(function () {
    avisoTela.hidden = true
  }, 2800)
}

function pegarIniciais(nome) {
  const partes = nome.trim().split(' ')
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function classeStatus(status) {
  if (status === 'Ativo') {
    return 'status-tag status-ativo'
  }
  if (status === 'Em uso') {
    return 'status-tag status-uso'
  }
  return 'status-tag status-concluido'
}

function porcentagem(parte, total) {
  if (!total || total <= 0) {
    return 0
  }
  return Math.round((parte / total) * 100)
}

function aplicarFiltros() {
  const termo = campoBusca.value.trim().toLowerCase()

  const filtradas = movimentacoesAtuais.filter(function (item) {
    if (filtroCategoria !== 'todos' && item.categoria !== filtroCategoria) {
      return false
    }
    if (termo === '') {
      return true
    }
    return (
      item.colaborador.toLowerCase().indexOf(termo) !== -1 ||
      item.tipo.toLowerCase().indexOf(termo) !== -1 ||
      item.recurso.toLowerCase().indexOf(termo) !== -1 ||
      item.status.toLowerCase().indexOf(termo) !== -1
    )
  })

  desenharTabela(filtradas)
}

function desenharTabela(lista) {
  listaMov.innerHTML = ''

  if (lista.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 5
    td.className = 'texto-vazio'
    td.textContent = 'Nenhuma movimentação encontrada para esse filtro.'
    tr.appendChild(td)
    listaMov.appendChild(tr)
    return
  }

  lista.forEach(function (item) {
    const tr = document.createElement('tr')

    const tdPessoa = document.createElement('td')
    const spanNome = document.createElement('span')
    spanNome.className = 'pessoa-nome'
    spanNome.textContent = item.colaborador
    tdPessoa.appendChild(spanNome)

    if (item.cargo) {
      const spanCargo = document.createElement('span')
      spanCargo.className = 'pessoa-cargo'
      spanCargo.textContent = item.cargo
      tdPessoa.appendChild(spanCargo)
    }

    const tdTipo = document.createElement('td')
    tdTipo.textContent = item.tipo

    const tdRecurso = document.createElement('td')
    tdRecurso.textContent = item.recurso

    const tdHorario = document.createElement('td')
    tdHorario.className = 'celula-horario'
    tdHorario.textContent = item.horario

    const tdStatus = document.createElement('td')
    const tag = document.createElement('span')
    tag.className = classeStatus(item.status)
    const ponto = document.createElement('span')
    ponto.className = 'status-ponto'
    tag.appendChild(ponto)
    tag.appendChild(document.createTextNode(item.status))
    tdStatus.appendChild(tag)

    tr.appendChild(tdPessoa)
    tr.appendChild(tdTipo)
    tr.appendChild(tdRecurso)
    tr.appendChild(tdHorario)
    tr.appendChild(tdStatus)

    listaMov.appendChild(tr)
  })
}

function desenharAlojamentos(lista) {
  listaAloj.innerHTML = ''

  if (!lista || lista.length === 0) {
    const p = document.createElement('p')
    p.className = 'texto-vazio'
    p.textContent = 'Nenhum alojamento cadastrado ainda.'
    listaAloj.appendChild(p)
    return
  }

  lista.forEach(function (aloj) {
    const pct = porcentagem(aloj.ocupados, aloj.total)
    const div = document.createElement('div')

    const topo = document.createElement('div')
    topo.className = 'unidade-topo'

    const nome = document.createElement('span')
    nome.className = 'unidade-nome'
    nome.textContent = aloj.nome
    if (aloj.cidade) {
      const cid = document.createElement('span')
      cid.className = 'unidade-cidade'
      cid.textContent = '· ' + aloj.cidade
      nome.appendChild(cid)
    }

    const numeros = document.createElement('span')
    numeros.className = 'unidade-numeros'
    numeros.textContent = aloj.ocupados + '/' + aloj.total + ' leitos'

    topo.appendChild(nome)
    topo.appendChild(numeros)

    const fundo = document.createElement('div')
    fundo.className = 'barra-fundo'
    const barra = document.createElement('div')
    barra.className = 'barra-preenchimento ' + (pct >= 80 ? 'barra-azul' : 'barra-verde')
    barra.style.width = pct + '%'
    fundo.appendChild(barra)

    div.appendChild(topo)
    div.appendChild(fundo)
    listaAloj.appendChild(div)
  })
}

// filtro por abas (Todas / Frota / Alojamentos)
abasFiltro.forEach(function (aba) {
  aba.addEventListener('click', function () {
    abasFiltro.forEach(function (outra) {
      outra.classList.remove('ativa')
    })
    aba.classList.add('ativa')
    filtroCategoria = aba.dataset.filtro
    aplicarFiltros()
  })
})

campoBusca.addEventListener('input', aplicarFiltros)

// aviso pra telas que serão implementadas nas próximas tarefas
const linksEmBreve = document.querySelectorAll('.menu-em-breve')
linksEmBreve.forEach(function (link) {
  link.addEventListener('click', function (e) {
    e.preventDefault()
    mostrarAviso('Módulo "' + link.dataset.tela + '" em construção.')
  })
})

botaoSair.addEventListener('click', async function () {
  await chamarApi('/api/auth/sair', { metodo: 'POST' })
  window.location.href = 'index.html'
})

async function carregarPainel() {
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

    const res = await chamarApi('/api/resumo')
    if (!res.ok) {
      return
    }

    const d = res.dados
    if (d.nomeEmpresa) {
      nomeEmpresaMenu.textContent = d.nomeEmpresa
    }
    const pctOcup = porcentagem(d.leitosOcupados, d.totalLeitos)

    numVeiculosUso.textContent = d.veiculosEmUso
    subVeiculosUso.textContent = 'de ' + d.totalVeiculos + ' na frota'
    detalheVeiculosUso.textContent = d.veiculosManutencao > 0
      ? d.veiculosManutencao + ' em manutenção no momento'
      : 'Nenhum veículo na oficina'

    numVeiculosDisp.textContent = d.veiculosDisponiveis
    document.getElementById('detalhe-veiculos-disp').textContent = 'Documentação e CNH validadas na saída'

    numAlojamentos.textContent = d.totalAlojamentos
    subAlojamentos.textContent = d.totalLeitos + ' leitos no total'
    detalheAlojamentos.textContent = d.leitosOcupados + ' leitos ocupados hoje (' + pctOcup + '%)'

    numVagas.textContent = d.vagasDisponiveis

    movimentacoesAtuais = d.movimentacoes || []
    aplicarFiltros()
    desenharAlojamentos(d.alojamentos)
  } catch (erro) {
    mostrarAviso('Sem conexão com o servidor.')
  }
}

carregarPainel()
