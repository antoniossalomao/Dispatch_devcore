// tela de cadastro de usuário do Dispatch

const form = document.getElementById('form-cadastro')
const inputNome = document.getElementById('nome')
const inputUsuario = document.getElementById('usuario')
const inputSenha = document.getElementById('senha')
const inputConfirmar = document.getElementById('confirmar-senha')
const checkMostrar = document.getElementById('mostrar-senha')
const msgErro = document.getElementById('mensagem-erro')
const botaoCadastrar = document.getElementById('botao-cadastrar')

// mostra/esconde os dois campos de senha juntos
checkMostrar.addEventListener('change', function () {
  const tipo = checkMostrar.checked ? 'text' : 'password'
  inputSenha.type = tipo
  inputConfirmar.type = tipo
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
  const campos = [inputNome, inputUsuario, inputSenha, inputConfirmar]
  campos.forEach(function (campo) { campo.removeAttribute('aria-invalid') })
}

form.addEventListener('submit', async function (e) {
  e.preventDefault()
  esconderErro()

  const nome = inputNome.value.trim()
  const usuario = inputUsuario.value.trim()
  const senha = inputSenha.value
  const confirmar = inputConfirmar.value

  if (nome === '' || usuario === '' || senha === '' || confirmar === '') {
    mostrarErro('Preencha todos os campos.', [inputNome, inputUsuario, inputSenha, inputConfirmar].find(function (campo) { return campo.value.trim() === '' }))
    return
  }

  if (usuario.indexOf(' ') !== -1) {
    mostrarErro('O nome de usuário não pode ter espaços.', inputUsuario)
    return
  }

  if (senha.length < 4) {
    mostrarErro('A senha precisa ter pelo menos 4 caracteres.', inputSenha)
    return
  }

  if (senha !== confirmar) {
    mostrarErro('As senhas digitadas não conferem.', inputConfirmar)
    return
  }

  esconderErro()
  botaoCadastrar.disabled = true
  botaoCadastrar.textContent = 'Cadastrando...'

  try {
    const res = await chamarApi('/api/auth/cadastro', {
      metodo: 'POST',
      corpo: {
        nome: nome,
        usuario: usuario,
        senha: senha
      }
    })

    if (!res.ok) {
      mostrarErro(res.dados.erro || 'Erro ao criar a conta.')
      botaoCadastrar.disabled = false
      botaoCadastrar.textContent = 'Criar conta'
      return
    }

    // manda pro login avisando que a conta foi criada
    window.location.href = 'index.html?cadastro=ok'
  } catch (erro) {
    mostrarErro('Não consegui falar com o servidor. Confira se ele está ligado.')
    botaoCadastrar.disabled = false
    botaoCadastrar.textContent = 'Criar conta'
  }
})
