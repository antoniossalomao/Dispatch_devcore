// tela de login do Dispatch
// por enquanto só valida se preencheu os campos, ainda não tem back-end

// pegando as coisas do html pelo id
const form = document.getElementById('form-login')
const inputUsuario = document.getElementById('usuario')
const inputSenha = document.getElementById('senha')
const checkMostrar = document.getElementById('mostrar-senha')
const msgErro = document.getElementById('mensagem-erro')


// quando marca/desmarca a caixinha de mostrar senha
checkMostrar.addEventListener('change', function () {
  // se tiver marcada troca pra text (aí da pra ver a senha),
  // se não volta pra password (bolinhas)
  if (checkMostrar.checked) {
    inputSenha.type = 'text'
  } else {
    inputSenha.type = 'password'
  }
})


function mostrarErro(texto) {
  msgErro.textContent = texto
  msgErro.hidden = false
}

function esconderErro() {
  msgErro.textContent = ''
  msgErro.hidden = true
}


// isso roda quando clica em Entrar (ou aperta enter)
form.addEventListener('submit', function (e) {
  // sem isso a página recarrega sozinha quando envia o form
  e.preventDefault()

  // trim tira os espaços que sobram no começo e no fim
  const usuario = inputUsuario.value.trim()
  const senha = inputSenha.value // na senha nao usei trim pq espaço pode fazer parte dela

  // se um dos dois tiver vazio mostra o erro e para por aqui
  if (usuario === '' || senha === '') {
    mostrarErro('Preencha o usuário e a senha.')
    return
  }

  esconderErro()

  // TODO: mandar pro back-end (POST /api/auth/login) quando o server estiver pronto
  // por enquanto só aparece no console (F12). a senha eu não coloquei no log de proposito
  console.log('login com o usuario:', usuario)
})
