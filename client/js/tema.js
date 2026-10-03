// troca entre o tema escuro e o claro
// esse arquivo é carregado no head (e não no fim do body) pra aplicar o tema
// antes da pagina aparecer, senão ela aparece escura e depois pisca pra clara

// o escuro é o padrão, então só precisa fazer algo se tiver salvo "claro"
// a classe vai no html pq aqui no head o body ainda nem existe
if (localStorage.getItem('tema') === 'claro') {
  document.documentElement.classList.add('tema-claro')
}

// o botão tbm ainda não existe aqui, então espera o html terminar de carregar
document.addEventListener('DOMContentLoaded', function () {
  const botaoTema = document.getElementById('botao-tema')

  // se a pagina não tiver o botão não tem o que fazer
  if (!botaoTema) {
    return
  }

  atualizarBotaoTema(botaoTema)

  botaoTema.addEventListener('click', function () {
    // toggle: se tem a classe ele tira, se não tem ele coloca
    document.documentElement.classList.toggle('tema-claro')

    // salva no navegador pra lembrar quando abrir de novo ou trocar de pagina
    if (document.documentElement.classList.contains('tema-claro')) {
      localStorage.setItem('tema', 'claro')
    } else {
      localStorage.setItem('tema', 'escuro')
    }

    atualizarBotaoTema(botaoTema)
  })
})

// no escuro mostra o sol (clica pra ir pro claro) e no claro mostra a lua
function atualizarBotaoTema(botao) {
  if (document.documentElement.classList.contains('tema-claro')) {
    botao.textContent = '🌙'
    botao.title = 'Mudar pro tema escuro'
  } else {
    botao.textContent = '☀️'
    botao.title = 'Mudar pro tema claro'
  }
}
