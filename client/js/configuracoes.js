// tela de Configurações do sistema (acesso do perfil admin)

const nomeEmpresaMenu = document.getElementById('nome-empresa-menu')
const usuarioIniciais = document.getElementById('usuario-iniciais')
const perfilNome = document.getElementById('perfil-nome')
const perfilTipo = document.getElementById('perfil-tipo')
const botaoSair = document.getElementById('botao-sair')
const avisoTela = document.getElementById('aviso-tela')
const retornoGeral = document.getElementById('retorno-geral')

// abas
const botoesAba = document.querySelectorAll('.config-aba')
const paineisAba = {
  parametros: document.getElementById('painel-parametros'),
  usuarios: document.getElementById('painel-usuarios'),
  conta: document.getElementById('painel-conta')
}

// campos de parâmetros
const formParametros = document.getElementById('form-parametros')
const cfgEmpresa = document.getElementById('cfg-empresa')
const cfgDiasVencimento = document.getElementById('cfg-dias-vencimento')
const cfgHorasRetorno = document.getElementById('cfg-horas-retorno')
const cfgKmConfirmacao = document.getElementById('cfg-km-confirmacao')
const cfgDiasPendencia = document.getElementById('cfg-dias-pendencia')
const cfgBloquearDoc = document.getElementById('cfg-bloquear-doc')
const cfgValidarNr24 = document.getElementById('cfg-validar-nr24')
const cfgWhatsapp = document.getElementById('cfg-whatsapp')

const ambBanco = document.getElementById('amb-banco')
const ambIa = document.getElementById('amb-ia')
const ambWhats = document.getElementById('amb-whats')

// usuários
const tabelaUsuarios = document.getElementById('tabela-usuarios')
const formNovoUsuario = document.getElementById('form-novo-usuario')
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

// minha conta
const formMinhaConta = document.getElementById('form-minha-conta')
const contaLogin = document.getElementById('conta-login')
const contaNome = document.getElementById('conta-nome')
const contaTelefone = document.getElementById('conta-telefone')

const formMinhaSenha = document.getElementById('form-minha-senha')
const senhaAtual = document.getElementById('senha-atual')
const senhaNova = document.getElementById('senha-nova')
const senhaConfirmar = document.getElementById('senha-confirmar')

let meuId = null
let usuarioRedefinindoId = null

function pegarIniciais(nome) {
  const partes = nome.trim().split(' ')
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase()
  }
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function mostrarAvisoTopo(texto) {
  avisoTela.textContent = texto
  avisoTela.hidden = false
  setTimeout(function () {
    avisoTela.hidden = true
  }, 2800)
}

function mostrarRetorno(texto, tipo) {
  retornoGeral.textContent = texto
  retornoGeral.className = 'config-retorno ' + (tipo === 'erro' ? 'retorno-erro' : 'retorno-ok')
  retornoGeral.hidden = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function esconderRetorno() {
  retornoGeral.hidden = true
}

// troca entre as 3 abas
botoesAba.forEach(function (botao) {
  botao.addEventListener('click', function () {
    esconderRetorno()
    botoesAba.forEach(function (b) {
      b.classList.remove('ativa')
    })
    botao.classList.add('ativa')

    const alvo = botao.dataset.aba
    Object.keys(paineisAba).forEach(function (chave) {
      paineisAba[chave].hidden = chave !== alvo
    })
  })
})

function desenharUsuarios(lista) {
  tabelaUsuarios.innerHTML = ''

  lista.forEach(function (u) {
    const tr = document.createElement('tr')
    const ehEu = u.id === meuId

    // nome + login
    const tdPessoa = document.createElement('td')
    const sNome = document.createElement('span')
    sNome.className = 'pessoa-nome'
    sNome.textContent = u.nome + (ehEu ? ' (você)' : '')
    const sLogin = document.createElement('span')
    sLogin.className = 'pessoa-cargo'
    sLogin.textContent = '@' + u.login
    tdPessoa.appendChild(sNome)
    tdPessoa.appendChild(sLogin)

    // telefone
    const tdTel = document.createElement('td')
    tdTel.textContent = u.telefone || '—'

    // perfil
    const tdPerfil = document.createElement('td')
    const badge = document.createElement('span')
    badge.className = 'perfil-badge ' + (u.perfil === 'admin' ? 'perfil-admin' : 'perfil-operador')
    badge.textContent = u.perfil === 'admin' ? 'Admin' : 'Operador'
    tdPerfil.appendChild(badge)

    // status
    const tdStatus = document.createElement('td')
    const tag = document.createElement('span')
    tag.className = u.ativo === 1 ? 'status-tag status-ativo' : 'status-tag status-concluido'
    const ponto = document.createElement('span')
    ponto.className = 'status-ponto'
    tag.appendChild(ponto)
    tag.appendChild(document.createTextNode(u.ativo === 1 ? 'Ativo' : 'Inativo'))
    tdStatus.appendChild(tag)

    // botões de ação
    const tdAcoes = document.createElement('td')
    const box = document.createElement('div')
    box.className = 'acoes-linha'

    const btnSenha = document.createElement('button')
    btnSenha.type = 'button'
    btnSenha.className = 'btn-secundario'
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
      btnPerfil.className = 'btn-secundario'
      const outroPerfil = u.perfil === 'admin' ? 'operador' : 'admin'
      btnPerfil.textContent = u.perfil === 'admin' ? 'Tornar operador' : 'Tornar admin'
      btnPerfil.addEventListener('click', async function () {
        const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/perfil', {
          metodo: 'PUT',
          corpo: { perfil: outroPerfil }
        })
        if (!r.ok) {
          mostrarRetorno(r.dados.erro || 'Erro ao alterar perfil.', 'erro')
          return
        }
        mostrarRetorno(r.dados.mensagem, 'ok')
        carregarDados()
      })
      box.appendChild(btnPerfil)

      const btnAtivo = document.createElement('button')
      btnAtivo.type = 'button'
      btnAtivo.className = 'btn-secundario'
      btnAtivo.textContent = u.ativo === 1 ? 'Desativar' : 'Reativar'
      btnAtivo.addEventListener('click', async function () {
        const r = await chamarApi('/api/configuracoes/usuarios/' + u.id + '/ativo', {
          metodo: 'PUT',
          corpo: { ativo: u.ativo === 1 ? 0 : 1 }
        })
        if (!r.ok) {
          mostrarRetorno(r.dados.erro || 'Erro ao alterar status.', 'erro')
          return
        }
        mostrarRetorno(r.dados.mensagem, 'ok')
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
    mostrarRetorno(r.dados.erro || 'Erro ao redefinir a senha.', 'erro')
    return
  }
  caixaRedefinir.hidden = true
  usuarioRedefinindoId = null
  mostrarRetorno(r.dados.mensagem, 'ok')
})

formParametros.addEventListener('submit', async function (e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/parametros', {
    metodo: 'PUT',
    corpo: {
      nomeEmpresa: cfgEmpresa.value,
      diasAvisoVencimento: cfgDiasVencimento.value,
      horasAlertaRetorno: cfgHorasRetorno.value,
      kmConfirmacaoViagem: cfgKmConfirmacao.value,
      diasAlertaPendencia: cfgDiasPendencia.value,
      bloquearDocVencido: cfgBloquearDoc.checked,
      validarNr24: cfgValidarNr24.checked,
      whatsappCriticos: cfgWhatsapp.checked
    }
  })

  if (!r.ok) {
    mostrarRetorno(r.dados.erro || 'Erro ao salvar parâmetros.', 'erro')
    return
  }

  nomeEmpresaMenu.textContent = r.dados.parametros.nomeEmpresa
  mostrarRetorno(r.dados.mensagem, 'ok')
})

formNovoUsuario.addEventListener('submit', async function (e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/usuarios', {
    metodo: 'POST',
    corpo: {
      nome: novoNome.value,
      login: novoLogin.value,
      telefone: novoTelefone.value,
      perfil: novoPerfil.value,
      senha: novoSenha.value
    }
  })

  if (!r.ok) {
    mostrarRetorno(r.dados.erro || 'Erro ao cadastrar usuário.', 'erro')
    return
  }

  formNovoUsuario.reset()
  mostrarRetorno(r.dados.mensagem, 'ok')
  carregarDados()
})

formMinhaConta.addEventListener('submit', async function (e) {
  e.preventDefault()

  const r = await chamarApi('/api/configuracoes/minha-conta', {
    metodo: 'PUT',
    corpo: {
      nome: contaNome.value,
      telefone: contaTelefone.value
    }
  })

  if (!r.ok) {
    mostrarRetorno(r.dados.erro || 'Erro ao atualizar seus dados.', 'erro')
    return
  }

  perfilNome.textContent = r.dados.usuario.nome
  usuarioIniciais.textContent = pegarIniciais(r.dados.usuario.nome)
  mostrarRetorno(r.dados.mensagem, 'ok')
})

formMinhaSenha.addEventListener('submit', async function (e) {
  e.preventDefault()

  if (senhaNova.value !== senhaConfirmar.value) {
    mostrarRetorno('A confirmação da nova senha não confere.', 'erro')
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
    mostrarRetorno(r.dados.erro || 'Erro ao alterar a senha.', 'erro')
    return
  }

  formMinhaSenha.reset()
  mostrarRetorno(r.dados.mensagem, 'ok')
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
    perfilNome.textContent = user.nome
    perfilTipo.textContent = user.perfil
    usuarioIniciais.textContent = pegarIniciais(user.nome)

    const res = await chamarApi('/api/configuracoes')
    if (!res.ok) {
      mostrarRetorno(res.dados.erro || 'Não foi possível carregar as configurações.', 'erro')
      return
    }

    const p = res.dados.parametros
    nomeEmpresaMenu.textContent = p.nomeEmpresa
    cfgEmpresa.value = p.nomeEmpresa
    cfgDiasVencimento.value = p.diasAvisoVencimento
    cfgHorasRetorno.value = p.horasAlertaRetorno
    cfgKmConfirmacao.value = p.kmConfirmacaoViagem
    cfgDiasPendencia.value = p.diasAlertaPendencia
    cfgBloquearDoc.checked = p.bloquearDocVencido
    cfgValidarNr24.checked = p.validarNr24
    cfgWhatsapp.checked = p.whatsappCriticos

    const amb = res.dados.ambiente
    ambBanco.textContent = amb.banco
    ambIa.textContent = amb.iaConfigurada ? 'Chave GROQ ativa' : 'Desligada (sem chave no .env)'
    ambWhats.textContent = amb.whatsappModo

    const eu = res.dados.meuUsuario
    contaLogin.value = eu.login
    contaNome.value = eu.nome
    contaTelefone.value = eu.telefone || ''

    desenharUsuarios(res.dados.usuarios || [])
  } catch (erro) {
    mostrarRetorno('Sem conexão com o servidor.', 'erro')
  }
}

carregarDados()
