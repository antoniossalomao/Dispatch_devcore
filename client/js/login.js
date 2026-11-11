// tela de login do Dispatch

const form = document.getElementById('form-login')
const inputUsuario = document.getElementById('usuario')
const inputSenha = document.getElementById('senha')
const checkMostrar = document.getElementById('mostrar-senha')
const msgErro = document.getElementById('mensagem-erro')
const msgSucesso = document.getElementById('mensagem-sucesso')
const botaoEntrar = document.getElementById('botao-entrar')

// se veio da tela de cadastro com ?cadastro=ok, avisa que deu certo
if (window.location.search.indexOf('cadastro=ok') !== -1) {
  msgSucesso.textContent = 'Conta criada com sucesso! Agora é só entrar.'
  msgSucesso.hidden = false
}

// quando marca/desmarca a caixinha de mostrar senha
checkMostrar.addEventListener('change', function () {
  if (checkMostrar.checked) {
    inputSenha.type = 'text'
  } else {
    inputSenha.type = 'password'
  }
})

function mostrarErro(texto, campo) {
  msgErro.textContent = texto
  msgErro.hidden = false
  if (campo) {
    campo.setAttribute('aria-invalid', 'true')
    campo.focus()
  } else msgErro.focus()
}

function esconderErro() {
  msgErro.textContent = ''
  msgErro.hidden = true
  const campos = [inputUsuario, inputSenha]
  campos.forEach(function (campo) { campo.removeAttribute('aria-invalid') })
}

// roda quando clica em Entrar (ou aperta enter)
form.addEventListener('submit', async function (e) {
  e.preventDefault()
  esconderErro()

  const usuario = inputUsuario.value.trim()
  const senha = inputSenha.value

  if (usuario === '' || senha === '') {
    mostrarErro('Preencha o usuário e a senha.', usuario === '' ? inputUsuario : inputSenha)
    return
  }

  esconderErro()
  msgSucesso.hidden = true
  botaoEntrar.disabled = true
  botaoEntrar.textContent = 'Entrando...'

  try {
    const res = await chamarApi('/api/auth/login', {
      metodo: 'POST',
      corpo: { usuario: usuario, senha: senha }
    })

    if (!res.ok) {
      mostrarErro(res.dados.erro || 'Não foi possível entrar.')
      botaoEntrar.disabled = false
      botaoEntrar.textContent = 'Entrar'
      return
    }

    // deu certo, manda pro dashboard (Resumo Operacional)
    window.location.href = 'resumo.html'
  } catch (erro) {
    mostrarErro('Não consegui falar com o servidor. Confira se ele está ligado.')
    botaoEntrar.disabled = false
    botaoEntrar.textContent = 'Entrar'
  }
})
