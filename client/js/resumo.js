// tela de Resumo Operacional

const manchete = document.getElementById('vg-manchete')
const atualizado = document.getElementById('vg-atualizado')

const frotaUso = document.getElementById('frota-uso')
const frotaSub = document.getElementById('frota-sub')
const frotaBarra = document.getElementById('frota-barra')
const frotaLegenda = document.getElementById('frota-legenda')

const leitosOcupados = document.getElementById('leitos-ocupados')
const leitosSub = document.getElementById('leitos-sub')
const leitosBarra = document.getElementById('leitos-barra')
const leitosLegenda = document.getElementById('leitos-legenda')

const pendTotal = document.getElementById('pend-total')
const pendSub = document.getElementById('pend-sub')
const pendBarra = document.getElementById('pend-barra')
const pendLegenda = document.getElementById('pend-legenda')
const pendContagem = document.getElementById('pend-contagem')

const listaMov = document.getElementById('lista-movimentacoes')
const listaAlertas = document.getElementById('lista-alertas')
const pontoAlerta = document.getElementById('ponto-alerta')

const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const blocoMenuAdmin = document.getElementById('bloco-menu-admin')
const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')

const campoBusca = document.getElementById('campo-busca')
const botaoNotif = document.getElementById('botao-notificacoes')
const secaoAlertas = document.getElementById('secao-alertas')
const avisoTela = document.getElementById('aviso-tela')
const dataHoje = document.getElementById('data-hoje')
const abasFiltro = document.querySelectorAll('.vg-aba')

// a visao geral mostra so o essencial: o resto fica nas telas de cada area
const LIMITE_MOV = 5
const LIMITE_ALERTAS = 4

let movimentacoesAtuais = []
let alertasAbertos = false
let filtroCategoria = 'todos'

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

function porcentagem(parte, total) {
  if (!total || total <= 0) {
    return 0
  }
  return Math.round((parte / total) * 100)
}

function plural(n, um, varios) {
  return n === 1 ? um : varios
}

function criar(tag, classe, texto) {
  const el = document.createElement(tag)
  if (classe) {
    el.className = classe
  }
  if (texto !== undefined) {
    el.textContent = texto
  }
  return el
}

function desenharSegmentos(barra, legenda, partes) {
  barra.innerHTML = ''
  legenda.innerHTML = ''

  partes.forEach(function (p) {
    if (p.valor > 0 && !p.soLegenda) {
      const seg = criar('span', p.cor)
      seg.style.flexGrow = p.valor
      barra.appendChild(seg)
    }

    const li = document.createElement('li')
    li.appendChild(criar('i', p.cor))
    li.appendChild(criar('b', null, p.valor))
    li.appendChild(document.createTextNode(p.nome))
    legenda.appendChild(li)
  })
}

function textoQuando(dataOrdem, horario) {
  if (!dataOrdem) {
    return { dia: '', hora: horario || '' }
  }

  const dia = dataOrdem.slice(0, 10)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)

  function formatar(d) {
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return d.getFullYear() + '-' + mes + '-' + dd
  }

  if (dia === formatar(hoje)) {
    return { dia: 'Hoje', hora: horario }
  }
  if (dia === formatar(ontem)) {
    return { dia: 'Ontem', hora: horario }
  }
  return { dia: dia.slice(8, 10) + '/' + dia.slice(5, 7), hora: horario }
}

function classeStatus(status) {
  if (status === 'Em uso') {
    return 'vg-status vg-status-uso'
  }
  if (status === 'Ativo') {
    return 'vg-status vg-status-ativo'
  }
  return 'vg-status'
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
    const td = criar('td', 'vg-vazio', 'Nenhuma movimentação encontrada para esse filtro.')
    td.colSpan = 4
    tr.appendChild(td)
    listaMov.appendChild(tr)
    return
  }

  lista.slice(0, LIMITE_MOV).forEach(function (item) {
    const tr = document.createElement('tr')

    const tdPessoa = document.createElement('td')
    const pessoa = criar('div', 'vg-pessoa')
    pessoa.appendChild(criar('span', 'vg-avatar', pegarIniciais(item.colaborador)))
    const nomes = document.createElement('div')
    nomes.appendChild(criar('span', 'vg-pessoa-nome', item.colaborador))
    pessoa.appendChild(nomes)
    tdPessoa.appendChild(pessoa)

    // o tipo do movimento vira so a seta antes do recurso (saida ↗, volta ↙)
    const sai = item.tipo === 'Retirada' || item.tipo === 'Saída'
    const tdRecurso = document.createElement('td')
    const recurso = criar('div', 'vg-recurso')
    const seta = criar('span', 'vg-tipo-seta ' + (sai ? 'vg-tipo-sai' : 'vg-tipo-entra'), sai ? '↗' : '↙')
    seta.title = item.tipo
    recurso.appendChild(seta)
    const pedacos = item.recurso.split(' · ')
    recurso.appendChild(criar('span', 'vg-recurso-nome', pedacos[0]))
    if (pedacos[1]) {
      recurso.appendChild(criar('span', 'vg-placa', pedacos[1]))
    }
    tdRecurso.appendChild(recurso)

    const quando = textoQuando(item.data_ordem, item.horario)
    const tdQuando = criar('td', 'vg-quando')
    tdQuando.appendChild(criar('b', null, quando.dia))
    tdQuando.appendChild(document.createTextNode(quando.dia ? ', ' + quando.hora : quando.hora))

    const tdStatus = document.createElement('td')
    tdStatus.appendChild(criar('span', classeStatus(item.status), item.status))

    tr.appendChild(tdPessoa)
    tr.appendChild(tdRecurso)
    tr.appendChild(tdQuando)
    tr.appendChild(tdStatus)
    listaMov.appendChild(tr)
  })
}

function linkDoAlerta(a) {
  const texto = (a.titulo + ' ' + a.detalhe).toLowerCase()
  if (texto.indexOf('cnh') !== -1) {
    return { href: 'colaboradores.html', nome: 'Ver colaborador' }
  }
  if (texto.indexOf('leito') !== -1 || texto.indexOf('alojamento') !== -1) {
    return { href: 'alojamentos.html', nome: 'Ver alojamento' }
  }
  return { href: 'frota.html', nome: 'Ver veículo' }
}

function desenharAlertas(lista) {
  listaAlertas.innerHTML = ''
  pendContagem.innerHTML = ''

  if (!lista || lista.length === 0) {
    pontoAlerta.hidden = true
    listaAlertas.appendChild(criar('p', 'vg-vazio', 'Nenhuma pendência em aberto. Tudo em dia.'))
    return
  }

  pontoAlerta.hidden = false

  const criticos = lista.filter(function (a) {
    return a.nivel === 'problema'
  }).length
  const atencao = lista.length - criticos

  if (criticos > 0) {
    pendContagem.appendChild(criar('span', 'vg-chip vg-chip-erro', criticos + ' ' + plural(criticos, 'crítica', 'críticas')))
  }
  if (atencao > 0) {
    pendContagem.appendChild(criar('span', 'vg-chip vg-chip-acento', atencao + ' atenção'))
  }

  // criticas primeiro; a lista completa fica no sino
  const ordenada = lista.slice().sort(function (a, b) {
    return (b.nivel === 'problema') - (a.nivel === 'problema')
  })

  ordenada.slice(0, alertasAbertos ? ordenada.length : LIMITE_ALERTAS).forEach(function (a) {
    const problema = a.nivel === 'problema'
    const item = criar('div', 'vg-alerta ' + (problema ? 'vg-alerta-problema' : 'vg-alerta-atencao'))
    item.appendChild(criar('span', 'vg-alerta-icone'))

    const corpo = document.createElement('div')
    corpo.appendChild(criar('p', 'vg-alerta-titulo', a.titulo))
    corpo.appendChild(criar('p', 'vg-alerta-detalhe', a.detalhe))
    const destino = linkDoAlerta(a)
    const link = criar('a', 'vg-link', destino.nome)
    link.href = destino.href
    item.appendChild(corpo)
    item.appendChild(link)
    listaAlertas.appendChild(item)
  })

  if (!alertasAbertos && lista.length > LIMITE_ALERTAS) {
    const resto = lista.length - LIMITE_ALERTAS
    const mais = criar('button', 'vg-link vg-alertas-mais', 'Ver mais ' + resto + ' ' + plural(resto, 'pendência', 'pendências'))
    mais.type = 'button'
    mais.addEventListener('click', function () {
      alertasAbertos = true
      desenharAlertas(lista)
    })
    listaAlertas.appendChild(mais)
  }
}

function desenharManchete(d, pendencias, criticos) {
  manchete.innerHTML = ''

  function numero(valor, classe) {
    const em = document.createElement('em')
    em.textContent = valor
    if (classe) {
      em.className = classe
    }
    manchete.appendChild(em)
  }

  function texto(t) {
    manchete.appendChild(document.createTextNode(t))
  }

  numero(d.veiculosEmUso)
  texto(' ' + plural(d.veiculosEmUso, 'veículo na rua', 'veículos na rua') + ', ')
  numero(d.leitosOcupados)
  texto(' ' + plural(d.leitosOcupados, 'pessoa alojada', 'pessoas alojadas') + ' e ')
  if (pendencias === 0) {
    texto('nenhuma pendência em aberto.')
    return
  }
  numero(pendencias, criticos > 0 ? 'vg-critico' : '')
  texto(' ' + plural(pendencias, 'pendência', 'pendências') + ' para resolver.')
}

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

botaoNotif.addEventListener('click', function () {
  secaoAlertas.scrollIntoView({ behavior: 'smooth' })
})

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

    const alertas = d.alertas || []
    const criticos = alertas.filter(function (a) {
      return a.nivel === 'problema'
    }).length

    atualizado.textContent = 'atualizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    desenharManchete(d, alertas.length, criticos)

    frotaUso.textContent = d.veiculosEmUso
    frotaSub.textContent = 'de ' + d.totalVeiculos + ' ' + plural(d.totalVeiculos, 'veículo', 'veículos') + ' na rua'
    desenharSegmentos(frotaBarra, frotaLegenda, [
      { nome: 'em uso', valor: d.veiculosEmUso, cor: 'cor-acento' },
      { nome: plural(d.veiculosDisponiveis, 'disponível', 'disponíveis'), valor: d.veiculosDisponiveis, cor: 'cor-livre' },
      { nome: 'na oficina', valor: d.veiculosManutencao, cor: 'cor-taupe' }
    ])

    leitosOcupados.textContent = d.leitosOcupados
    leitosSub.textContent = 'de ' + d.totalLeitos + ' leitos · ' + porcentagem(d.leitosOcupados, d.totalLeitos) + '%'
    desenharSegmentos(leitosBarra, leitosLegenda, [
      { nome: plural(d.leitosOcupados, 'ocupado', 'ocupados'), valor: d.leitosOcupados, cor: 'cor-acento' },
      { nome: plural(d.vagasDisponiveis, 'livre', 'livres'), valor: d.vagasDisponiveis, cor: 'cor-livre' },
      { nome: plural(d.totalAlojamentos, 'unidade', 'unidades'), valor: d.totalAlojamentos, cor: 'cor-trilho', soLegenda: true }
    ])

    pendTotal.textContent = alertas.length
    pendSub.textContent = alertas.length === 0 ? 'tudo em dia' : 'em aberto'
    desenharSegmentos(pendBarra, pendLegenda, [
      { nome: plural(criticos, 'crítica', 'críticas'), valor: criticos, cor: 'cor-erro' },
      { nome: 'de atenção', valor: alertas.length - criticos, cor: 'cor-acento' }
    ])

    movimentacoesAtuais = d.movimentacoes || []
    aplicarFiltros()
    desenharAlertas(alertas)
  } catch (erro) {
    mostrarAviso('Sem conexão com o servidor.')
  }
}

carregarPainel()
