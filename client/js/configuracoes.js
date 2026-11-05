// tela de Configurações do sistema

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const avisoTela = document.getElementById('aviso-tela')
const seloAlterado = document.getElementById('selo-alterado')
const toast = document.getElementById('toast-retorno')

// navegação lateral das seções
const botoesNav = document.querySelectorAll('.config-nav-item')
const paineis = {
  regras: document.getElementById('painel-regras'),
  alertas: document.getElementById('painel-alertas'),
  usuarios: document.getElementById('painel-usuarios'),
  banco: document.getElementById('painel-banco'),
  conta: document.getElementById('painel-conta')
}

// campos de operação, frota, alojamento e alertas
const formRegras = document.getElementById('painel-regras')
const formAlertas = document.getElementById('form-alertas')
const botaoRestaurar = document.getElementById('botao-restaurar')

const cfgEmpresa = document.getElementById('cfg-empresa')
const cfgCidade = document.getElementById('cfg-cidade')
const cfgDocumento = document.getElementById('cfg-documento')
const cfgKmConfirmacao = document.getElementById('cfg-km-confirmacao')
const cfgHorasRetorno = document.getElementById('cfg-horas-retorno')
const cfgBloquearDoc = document.getElementById('cfg-bloquear-doc')
const cfgAvisarSeguro = document.getElementById('cfg-avisar-seguro')
const cfgMaxLeitos = document.getElementById('cfg-max-leitos')
const cfgAreaCama = document.getElementById('cfg-area-cama')
const cfgAreaBeliche = document.getElementById('cfg-area-beliche')
const cfgValidarNr24 = document.getElementById('cfg-validar-nr24')

const cfgDiasVencimento = document.getElementById('cfg-dias-vencimento')
const cfgDiasPendencia = document.getElementById('cfg-dias-pendencia')
const cfgLotacaoPct = document.getElementById('cfg-lotacao-pct')
const cfgTelegram = document.getElementById('cfg-telegram')

// integrações
const badgeIa = document.getElementById('badge-ia')
const descIa = document.getElementById('desc-ia')
const badgeTelegram = document.getElementById('badge-telegram')
const descTelegram = document.getElementById('desc-telegram')
const botaoTestarAlerta = document.getElementById('botao-testar-alerta')
const caixaPreviaAlerta = document.getElementById('caixa-previa-alerta')
const textoPreviaAlerta = document.getElementById('texto-previa-alerta')

// usuários
const contAtivos = document.getElementById('cont-ativos')
const contAdmins = document.getElementById('cont-admins')
const contOperadores = document.getElementById('cont-operadores')
const contInativos = document.getElementById('cont-inativos')
const abrirNovoUsuario = document.getElementById('abrir-novo-usuario')
const fecharNovoUsuario = document.getElementById('fechar-novo-usuario')
const formNovoUsuario = document.getElementById('form-novo-usuario')
const buscaUsuario = document.getElementById('busca-usuario')
const tabelaUsuarios = document.getElementById('tabela-usuarios')

const novoNome = document.getElementById('novo-nome')
const novoLogin = document.getElementById('novo-login')
const novoTelefone = document.getElementById('novo-telefone')
const novoPerfil = document.getElementById('novo-perfil')
const novoSenha = document.getElementById('novo-senha')

const caixaRedefinir = document.getElementById('caixa-redefinir')
const redefinirRotulo = document.getElementById('redefinir-rotulo')
const redefinirInput = document.getElementById('redefinir-input')
const redefinirSalvar = document.getElementById('redefinir-salvar')
const redefinirCancelar = document.getElementById('redefinir-cancelar')

// banco e auditoria
const linkBackup = document.getElementById('link-backup')
const dbTamanho = document.getElementById('db-tamanho')
const dbTabelas = document.getElementById('db-tabelas')
const dbPessoas = document.getElementById('db-pessoas')
const dbLogs = document.getElementById('db-logs')
const botaoVerificarLog = document.getElementById('botao-verificar-log')
const caixaIntegridade = document.getElementById('caixa-integridade')
const integridadeTitulo = document.getElementById('integridade-titulo')
const integridadeMotivo = document.getElementById('integridade-motivo')
const tabelaLogsRecentes = document.getElementById('tabela-logs-recentes')

// minha conta
const formMinhaConta = document.getElementById('form-minha-conta')
const contaAvatarPrevia = document.getElementById('conta-avatar-previa')
const contaTituloPrevia = document.getElementById('conta-titulo-previa')
const contaLoginPrevia = document.getElementById('conta-login-previa')
const contaNome = document.getElementById('conta-nome')
const contaTelefone = document.getElementById('conta-telefone')

const formMinhaSenha = document.getElementById('form-minha-senha')
const senhaAtual = document.getElementById('senha-atual')
const senhaNova = document.getElementById('senha-nova')
const senhaConfirmar = document.getElementById('senha-confirmar')
const mostrarSenhasConta = document.getElementById('mostrar-senhas-conta')

let meuId = null
let meuLogin = ''
let todosUsuarios = []
let usuarioRedefinindoId = null
let timerToast = null

// ajusta o link de download do backup caso esteja no Live Server
linkBackup.href = baseApi + '/api/configuracoes/backup'

function pegarIniciais(nome) {
  const texto = (nome || '').trim()
  if (texto === '') {
    return '--'
  }
  const partes = texto.split(' ')
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function mostrarToast(texto, tipo) {
  toast.textContent = texto
  toast.className = tipo === 'erro' ? 'toast toast-erro' : 'toast'
  toast.hidden = false

  if (timerToast) {
    clearTimeout(timerToast)
  }
  timerToast = setTimeout(function () {
    toast.hidden = true
  }, 3200)
}

function mostrarAvisoTopo(texto) {
  avisoTela.textContent = texto
  avisoTela.hidden = false
  setTimeout(function () {
    avisoTela.hidden = true
  }, 2600)
}

// troca entre os 5 painéis do submenu
botoesNav.forEach(function (botao) {
  botao.addEventListener('click', function () {
    botoesNav.forEach(function (b) {
      b.classList.remove('ativa')
    })
    botao.classList.add('ativa')

    const alvo = botao.dataset.aba
    Object.keys(paineis).forEach(function (chave) {
      paineis[chave].hidden = chave !== alvo
    })
  })
})

// avisa no topo quando algum parâmetro foi editado e ainda não salvo
const camposMonitorados = [
  cfgEmpresa, cfgCidade, cfgDocumento, cfgKmConfirmacao, cfgHorasRetorno,
  cfgBloquearDoc, cfgAvisarSeguro, cfgMaxLeitos, cfgAreaCama, cfgAreaBeliche,
  cfgValidarNr24, cfgDiasVencimento, cfgDiasPendencia, cfgLotacaoPct, cfgTelegram
]

camposMonitorados.forEach(function (campo) {
  campo.addEventListener('input', function () {
    seloAlterado.hidden = false
  })
  campo.addEventListener('change', function () {
    seloAlterado.hidden = false
  })
})

function lerFormularioParametros() {
  return {
    nomeEmpresa: cfgEmpresa.value,
    cidadeBase: cfgCidade.value,
    documentoEmpresa: cfgDocumento.value,
    diasAvisoVencimento: cfgDiasVencimento.value,
    horasAlertaRetorno: cfgHorasRetorno.value,
    kmConfirmacaoViagem: cfgKmConfirmacao.value,
    diasAlertaPendencia: cfgDiasPendencia.value,
    maxLeitosQuarto: cfgMaxLeitos.value,
    areaMinimaCama: cfgAreaCama.value,
    areaMinimaBeliche: cfgAreaBeliche.value,
    lotacaoAlertaPct: cfgLotacaoPct.value,
    bloquearDocVencido: cfgBloquearDoc.checked,
    avisarSeguroVencido: cfgAvisarSeguro.checked,
    validarNr24: cfgValidarNr24.checked,
    telegramCriticos: cfgTelegram.checked
  }
}

function preencherParametros(p) {
  nomeEmpresaMenu.textContent = p.nomeEmpresa
  cfgEmpresa.value = p.nomeEmpresa || ''
  cfgCidade.value = p.cidadeBase || ''
  cfgDocumento.value = p.documentoEmpresa || ''
  cfgDiasVencimento.value = p.diasAvisoVencimento
  cfgHorasRetorno.value = p.horasAlertaRetorno
  cfgKmConfirmacao.value = p.kmConfirmacaoViagem
  cfgDiasPendencia.value = p.diasAlertaPendencia
  cfgMaxLeitos.value = p.maxLeitosQuarto
  cfgAreaCama.value = p.areaMinimaCama
  cfgAreaBeliche.value = p.areaMinimaBeliche
  cfgLotacaoPct.value = p.lotacaoAlertaPct
  cfgBloquearDoc.checked = Boolean(p.bloquearDocVencido)
  cfgAvisarSeguro.checked = Boolean(p.avisarSeguroVencido)
  cfgValidarNr24.checked = Boolean(p.validarNr24)
  cfgTelegram.checked = Boolean(p.telegramCriticos)
  seloAlterado.hidden = true
}

async function salvarParametros(e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/parametros', {
    metodo: 'PUT',
    corpo: lerFormularioParametros()
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao salvar configurações.', 'erro')
    return
  }

  preencherParametros(r.dados.parametros)
  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
}

formRegras.addEventListener('submit', salvarParametros)
formAlertas.addEventListener('submit', salvarParametros)

botaoRestaurar.addEventListener('click', async function () {
  const r = await chamarApi('/api/configuracoes/restaurar-padrao', { metodo: 'POST' })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Não foi possível restaurar.', 'erro')
    return
  }
  preencherParametros(r.dados.parametros)
  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
})

botaoTestarAlerta.addEventListener('click', async function () {
  const r = await chamarApi('/api/configuracoes/testar-alerta', { metodo: 'POST' })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao simular alerta.', 'erro')
    return
  }
  textoPreviaAlerta.textContent = r.dados.previa
  caixaPreviaAlerta.hidden = false
  mostrarToast(r.dados.mensagem, 'ok')
})

// ---- usuários ----

abrirNovoUsuario.addEventListener('click', function () {
  formNovoUsuario.hidden = false
  novoNome.focus()
})

fecharNovoUsuario.addEventListener('click', function () {
  formNovoUsuario.hidden = true
})

buscaUsuario.addEventListener('input', function () {
  desenharUsuarios()
})

function atualizarResumoUsuarios(lista) {
  let ativos = 0
  let admins = 0
  let operadores = 0
  let inativos = 0

  lista.forEach(function (u) {
    if (u.ativo === 1) {
      ativos++
      if (u.perfil === 'admin') {
        admins++
      } else {
        operadores++
      }
    } else {
      inativos++
    }
  })

  contAtivos.textContent = ativos
  contAdmins.textContent = admins
  contOperadores.textContent = operadores
  contInativos.textContent = inativos
}

function desenharUsuarios() {
  tabelaUsuarios.innerHTML = ''
  const termo = buscaUsuario.value.trim().toLowerCase()

  const filtrados = todosUsuarios.filter(function (u) {
    if (termo === '') {
      return true
    }
    return (
      u.nome.toLowerCase().indexOf(termo) !== -1 ||
      u.login.toLowerCase().indexOf(termo) !== -1
    )
  })

  if (filtrados.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 5
    td.className = 'texto-vazio'
    td.textContent = 'Nenhum usuário encontrado.'
    tr.appendChild(td)
    tabelaUsuarios.appendChild(tr)
    return
  }

  filtrados.forEach(function (u) {
    const tr = document.createElement('tr')
    const ehEu = u.id === meuId

    const tdPessoa = document.createElement('td')
    const sNome = document.createElement('span')
    sNome.className = 'pessoa-nome'
    sNome.textContent = u.nome + (ehEu ? ' (você)' : '')
    const sLogin = document.createElement('span')
    sLogin.className = 'pessoa-cargo'
    sLogin.textContent = '@' + u.login
    tdPessoa.appendChild(sNome)
    tdPessoa.appendChild(sLogin)

    const tdTel = document.createElement('td')
    tdTel.textContent = u.telegram_chat_id || '—'

    const tdPerfil = document.createElement('td')
    const badge = document.createElement('span')
    badge.className = 'perfil-badge ' + (u.perfil === 'admin' ? 'perfil-admin' : 'perfil-operador')
    badge.textContent = u.perfil === 'admin' ? 'Admin' : 'Operador'
    tdPerfil.appendChild(badge)

    const tdStatus = document.createElement('td')
    const tag = document.createElement('span')
    tag.className = u.ativo === 1 ? 'status-tag status-ativo' : 'status-tag status-concluido'
    const ponto = document.createElement('span')
    ponto.className = 'status-ponto'
    tag.appendChild(ponto)
    tag.appendChild(document.createTextNode(u.ativo === 1 ? 'Ativo' : 'Inativo'))
    tdStatus.appendChild(tag)

    const tdAcoes = document.createElement('td')
    const box = document.createElement('div')
    box.className = 'acoes-linha'

    const btnSenha = document.createElement('button')
    btnSenha.type = 'button'
    btnSenha.className = 'btn-secundario btn-pequeno'
    btnSenha.textContent = 'Nova senha'
    btnSenha.addEventListener('click', function () {
      usuarioRedefinindoId = u.id
      redefinirRotulo.textContent = 'Nova senha para @' + u.login + ':'
      redefinirInput.value = ''
      caixaRedefinir.hidden = false
      redefinirInput.focus()
    })
    box.appendChild(btnSenha)

    if (!ehEu) {
      const btnPerfil = document.createElement('button')
      btnPerfil.type = 'button'
      btnPerfil.className = 'btn-secundario btn-pequeno'
      const outroPerfil = u.perfil === 'admin' ? 'operador' : 'admin'
      btnPerfil.textContent = u.perfil === 'admin' ? 'Tornar operador' : 'Tornar admin'
      btnPerfil.addEventListener('click', async function () {
        const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/perfil', {
          metodo: 'PUT',
          corpo: { perfil: outroPerfil }
        })
        if (!r.ok) {
          mostrarToast(r.dados.erro || 'Erro ao alterar perfil.', 'erro')
          return
        }
        mostrarToast(r.dados.mensagem, 'ok')
        carregarDados()
      })
      box.appendChild(btnPerfil)

      const btnAtivo = document.createElement('button')
      btnAtivo.type = 'button'
      btnAtivo.className = 'btn-secundario btn-pequeno'
      btnAtivo.textContent = u.ativo === 1 ? 'Desativar' : 'Reativar'
      btnAtivo.addEventListener('click', async function () {
        const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/ativo', {
          metodo: 'PUT',
          corpo: { ativo: u.ativo === 1 ? 0 : 1 }
        })
        if (!r.ok) {
          mostrarToast(r.dados.erro || 'Erro ao alterar acesso.', 'erro')
          return
        }
        mostrarToast(r.dados.mensagem, 'ok')
        carregarDados()
      })
      box.appendChild(btnAtivo)
    }

    tdAcoes.appendChild(box)

    tr.appendChild(tdPessoa)
    tr.appendChild(tdTel)
    tr.appendChild(tdPerfil)
    tr.appendChild(tdStatus)
    tr.appendChild(tdAcoes)

    tabelaUsuarios.appendChild(tr)
  })
}

redefinirCancelar.addEventListener('click', function () {
  caixaRedefinir.hidden = true
  usuarioRedefinindoId = null
})

redefinirSalvar.addEventListener('click', async function () {
  if (!usuarioRedefinindoId) {
    return
  }
  const r = await chamarApi('/api/configuracoes/usuarios/' + usuarioRedefinindoId + '/senha', {
    metodo: 'PUT',
    corpo: { novaSenha: redefinirInput.value }
  })
  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao redefinir a senha.', 'erro')
    return
  }
  caixaRedefinir.hidden = true
  usuarioRedefinindoId = null
  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
})

formNovoUsuario.addEventListener('submit', async function (e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/usuarios', {
    metodo: 'POST',
    corpo: {
      nome: novoNome.value,
      login: novoLogin.value,
      telegram_chat_id: novoTelefone.value,
      perfil: novoPerfil.value,
      senha: novoSenha.value
    }
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao cadastrar usuário.', 'erro')
    return
  }

  formNovoUsuario.reset()
  formNovoUsuario.hidden = true
  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
})

// ---- banco e auditoria ----

function desenharBanco(b) {
  dbTamanho.textContent = b.tamanhoKb + ' KB'
  dbTabelas.textContent = b.totalTabelas
  dbPessoas.textContent = b.contagens.colaboradores
  dbLogs.textContent = b.contagens.logs

  const intg = b.integridade
  if (intg.integro) {
    caixaIntegridade.className = 'integridade-status integridade-ok'
    integridadeTitulo.textContent = 'Cadeia íntegra (' + intg.totalLinhas + ' registros verificados)'
    integridadeMotivo.textContent = intg.motivo
  } else {
    caixaIntegridade.className = 'integridade-status integridade-erro'
    integridadeTitulo.textContent = 'Adulteração detectada na linha #' + intg.linhaComProblema
    integridadeMotivo.textContent = intg.motivo
  }

  tabelaLogsRecentes.innerHTML = ''
  const logs = b.ultimosLogs || []

  if (logs.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = 4
    td.className = 'texto-vazio'
    td.textContent = 'Nenhuma alteração registrada ainda no log.'
    tr.appendChild(td)
    tabelaLogsRecentes.appendChild(tr)
    return
  }

  logs.forEach(function (l) {
    const tr = document.createElement('tr')

    const tdId = document.createElement('td')
    tdId.className = 'celula-horario'
    tdId.textContent = '#' + l.id

    const tdQuando = document.createElement('td')
    tdQuando.className = 'celula-horario'
    tdQuando.textContent = l.quando.slice(0, 16)

    const tdAutor = document.createElement('td')
    tdAutor.textContent = '@' + l.autor

    const tdResumo = document.createElement('td')
    tdResumo.textContent = l.resumo

    tr.appendChild(tdId)
    tr.appendChild(tdQuando)
    tr.appendChild(tdAutor)
    tr.appendChild(tdResumo)

    tabelaLogsRecentes.appendChild(tr)
  })
}

botaoVerificarLog.addEventListener('click', async function () {
  const r = await chamarApi('/api/configuracoes/verificar-log')
  if (!r.ok) {
    mostrarToast('Não foi possível verificar o log.', 'erro')
    return
  }
  desenharBanco(r.dados.banco)
  mostrarToast('Verificação de integridade concluída.', 'ok')
})

// ---- minha conta ----

contaNome.addEventListener('input', function () {
  const nome = contaNome.value.trim() || 'Administrador'
  contaTituloPrevia.textContent = nome
  contaAvatarPrevia.textContent = pegarIniciais(nome)
})

mostrarSenhasConta.addEventListener('change', function () {
  const tipo = mostrarSenhasConta.checked ? 'text' : 'password'
  senhaAtual.type = tipo
  senhaNova.type = tipo
  senhaConfirmar.type = tipo
})

formMinhaConta.addEventListener('submit', async function (e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/minha-conta', {
    metodo: 'PUT',
    corpo: {
      nome: contaNome.value,
      telegram_chat_id: contaTelefone.value
    }
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao atualizar dados.', 'erro')
    return
  }

  const novoNome = r.dados.usuario.nome
  perfilNome.textContent = novoNome
  usuarioIniciais.textContent = pegarIniciais(novoNome)
  contaTituloPrevia.textContent = novoNome
  contaAvatarPrevia.textContent = pegarIniciais(novoNome)

  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
})

formMinhaSenha.addEventListener('submit', async function (e) {
  e.preventDefault()

  if (senhaNova.value !== senhaConfirmar.value) {
    mostrarToast('A confirmação da nova senha não confere.', 'erro')
    return
  }

  const r = await chamarApi('/api/configuracoes/minha-senha', {
    metodo: 'PUT',
    corpo: {
      senhaAtual: senhaAtual.value,
      novaSenha: senhaNova.value
    }
  })

  if (!r.ok) {
    mostrarToast(r.dados.erro || 'Erro ao alterar a senha.', 'erro')
    return
  }

  formMinhaSenha.reset()
  senhaAtual.type = 'password'
  senhaNova.type = 'password'
  senhaConfirmar.type = 'password'
  mostrarToast(r.dados.mensagem, 'ok')
  carregarDados()
})

const linksEmBreve = document.querySelectorAll('.menu-em-breve')
linksEmBreve.forEach(function (link) {
  link.addEventListener('click', function (e) {
    e.preventDefault()
    mostrarAvisoTopo('Módulo "' + link.dataset.tela + '" em construção.')
  })
})

botaoSair.addEventListener('click', async function () {
  await chamarApi('/api/auth/sair', { metodo: 'POST' })
  window.location.href = 'index.html'
})

function desenharAmbiente(amb) {
  if (amb.iaConfigurada) {
    badgeIa.className = 'status-tag status-ativo'
    badgeIa.innerHTML = '<span class="status-ponto"></span>Conectada'
    descIa.textContent = 'Chave GROQ_API_KEY presente no servidor. Consultas e resumos prontos para uso.'
  } else {
    badgeIa.className = 'status-tag status-concluido'
    badgeIa.innerHTML = '<span class="status-ponto"></span>Desligada'
    descIa.textContent = 'Defina GROQ_API_KEY no arquivo server/.env para ativar os recursos de IA.'
  }

  if (amb.telegramAtivo) {
    badgeTelegram.className = 'status-tag status-ativo'
    badgeTelegram.innerHTML = '<span class="status-ponto"></span>Bot ativo'
    descTelegram.textContent = 'Bot do Telegram conectado: alertas críticos enviados de verdade.'
  } else {
    badgeTelegram.className = 'status-tag status-uso'
    badgeTelegram.innerHTML = '<span class="status-ponto"></span>Modo terminal'
    descTelegram.textContent = 'Sem TELEGRAM_BOT_TOKEN no server/.env: os alertas aparecem formatados no terminal do servidor.'
  }
}

async function carregarDados() {
  try {
    const sessao = await chamarApi('/api/auth/eu')
    if (!sessao.ok) {
      window.location.href = 'index.html'
      return
    }

    const user = sessao.dados.usuario
    if (user.perfil !== 'admin') {
      window.location.href = 'resumo.html'
      return
    }

    meuId = user.id
    meuLogin = user.login
    perfilNome.textContent = user.nome
    perfilTipo.textContent = user.perfil
    usuarioIniciais.textContent = pegarIniciais(user.nome)

    const res = await chamarApi('/api/configuracoes')
    if (!res.ok) {
      mostrarToast(res.dados.erro || 'Erro ao carregar configurações.', 'erro')
      return
    }

    preencherParametros(res.dados.parametros)
    desenharAmbiente(res.dados.ambiente)

    todosUsuarios = res.dados.usuarios || []
    atualizarResumoUsuarios(todosUsuarios)
    desenharUsuarios()

    if (res.dados.banco) {
      desenharBanco(res.dados.banco)
    }

    const eu = res.dados.meuUsuario
    contaNome.value = eu.nome
    contaTelefone.value = eu.telegram_chat_id || ''
    contaTituloPrevia.textContent = eu.nome
    contaLoginPrevia.textContent = '@' + eu.login + ' · Perfil administrador'
    contaAvatarPrevia.textContent = pegarIniciais(eu.nome)
  } catch (erro) {
    mostrarToast('Sem conexão com o servidor.', 'erro')
  }
}

carregarDados()
