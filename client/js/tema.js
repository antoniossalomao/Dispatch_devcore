// tema claro/escuro: aplica a escolha antes da tela aparecer (carregar no <head>) e coloca o botão de troca junto ao perfil no topo
(function () {
  const CHAVE = 'dispatch-tema'

  function lerSalvo() {
    try { return localStorage.getItem(CHAVE) } catch (e) { return null }
  }

  function temaAtual() {
    const salvo = lerSalvo()
    if (salvo === 'claro' || salvo === 'escuro') return salvo
    return 'escuro' // A identidade DevCore usa o tema escuro por padrão; preserva a escolha salva.
  }

  function aplicar(tema) {
    document.documentElement.setAttribute('data-tema', tema)
  }

  aplicar(temaAtual())

  document.addEventListener('DOMContentLoaded', function () {
    const perfil = document.querySelector('.topo-perfil')
    if (!perfil) return

    const botao = document.createElement('button')
    botao.type = 'button'
    botao.className = 'botao-tema'

    const SOL = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    const LUA = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'

    function desenhar() {
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro'
      botao.innerHTML = escuro ? SOL : LUA
      botao.title = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'
      botao.setAttribute('aria-label', botao.title)
    }

    botao.addEventListener('click', function () {
      const novo = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro'
      aplicar(novo)
      try { localStorage.setItem(CHAVE, novo) } catch (e) { /* sem armazenamento: vale so nesta tela */ }
      desenhar()
    })

    desenhar()
    const sair = document.getElementById('botao-sair')
    perfil.insertBefore(botao, sair || null)
  })
})()
