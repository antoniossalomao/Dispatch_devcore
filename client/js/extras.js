// pecas comuns a todas as telas do sistema: sininho de avisos e chat de ajuda (IA)
// precisa do api.js carregado antes
(function () {
  if (typeof chamarApi !== 'function') return

  // o css fica num arquivo separado, carregado por aqui pra nao precisar mexer em todos os html
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'css/extras.css'
  document.head.appendChild(link)

  function esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // ===== sininho =====

  const barraTopo = document.querySelector('.topo-direita')
  // a tela de Resumo ja tem o proprio sininho (que leva pra lista de pendencias)
  if (barraTopo && !document.getElementById('botao-notificacoes')) {
    const caixa = document.createElement('div')
    caixa.className = 'sino-caixa'
    caixa.innerHTML =
      '<button type="button" class="botao-notif" title="Avisos">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
        '<span class="sino-contador" hidden>0</span></button>' +
      '<div class="sino-painel" hidden>' +
        '<div class="sino-topo"><strong>Avisos</strong><button type="button" class="sino-todas">Marcar todos como lidos</button></div>' +
        '<div class="sino-lista"></div></div>'
    barraTopo.insertBefore(caixa, barraTopo.firstChild)

    const botao = caixa.querySelector('.botao-notif')
    const contador = caixa.querySelector('.sino-contador')
    const painel = caixa.querySelector('.sino-painel')
    const lista = caixa.querySelector('.sino-lista')

    async function carregarAvisos() {
      const r = await chamarApi('/api/notificacoes')
      if (!r.ok) return
      contador.textContent = r.dados.nao_lidas > 99 ? '99+' : r.dados.nao_lidas
      contador.hidden = r.dados.nao_lidas === 0
      lista.innerHTML = ''
      if (r.dados.notificacoes.length === 0) {
        lista.innerHTML = '<p class="sino-vazio">Nenhum aviso pendente.</p>'
        return
      }
      r.dados.notificacoes.forEach(function (n) {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'sino-item ' + (n.severidade === 'critico' ? 'sino-critico' : 'sino-atencao')
        item.innerHTML = '<span>' + esc(n.mensagem) + '</span><small>' + esc(n.criada_em.slice(0, 16)) + '</small>'
        item.title = 'Marcar como lido'
        item.addEventListener('click', async function () {
          await chamarApi('/api/notificacoes/' + n.id + '/lida', { metodo: 'PUT' })
          carregarAvisos()
        })
        lista.appendChild(item)
      })
    }

    botao.addEventListener('click', function () { painel.hidden = !painel.hidden })
    document.addEventListener('click', function (e) {
      if (!caixa.contains(e.target)) painel.hidden = true
    })
    caixa.querySelector('.sino-todas').addEventListener('click', async function () {
      await chamarApi('/api/notificacoes/lidas', { metodo: 'PUT' })
      carregarAvisos()
    })

    carregarAvisos()
    setInterval(carregarAvisos, 60000)
  }

  // ===== chat de ajuda =====

  const chat = document.createElement('div')
  chat.className = 'chat-caixa'
  chat.innerHTML =
    '<div class="chat-painel" hidden>' +
      '<div class="chat-topo"><strong>Ajuda do Dispatch</strong><button type="button" class="chat-fechar">&times;</button></div>' +
      '<div class="chat-msgs"><div class="chat-msg chat-bot">Oi! Pergunte como usar o sistema. Ex: "como registro a saída de um carro?"</div></div>' +
      '<form class="chat-form"><input type="text" maxlength="500" placeholder="Escreva sua dúvida..." required><button type="submit">Enviar</button></form>' +
    '</div>' +
    '<button type="button" class="chat-botao" title="Ajuda">?</button>'
  document.body.appendChild(chat)

  const painelChat = chat.querySelector('.chat-painel')
  const msgs = chat.querySelector('.chat-msgs')
  const entrada = chat.querySelector('input')

  function adicionar(texto, classe) {
    const d = document.createElement('div')
    d.className = 'chat-msg ' + classe
    d.textContent = texto
    msgs.appendChild(d)
    msgs.scrollTop = msgs.scrollHeight
    return d
  }

  chat.querySelector('.chat-botao').addEventListener('click', function () {
    painelChat.hidden = !painelChat.hidden
    if (!painelChat.hidden) entrada.focus()
  })
  chat.querySelector('.chat-fechar').addEventListener('click', function () { painelChat.hidden = true })

  chat.querySelector('form').addEventListener('submit', async function (e) {
    e.preventDefault()
    const texto = entrada.value.trim()
    if (texto === '') return
    entrada.value = ''
    adicionar(texto, 'chat-eu')
    const aguarde = adicionar('Pensando...', 'chat-bot')
    const r = await chamarApi('/api/ia/suporte', { metodo: 'POST', corpo: { mensagem: texto } })
    aguarde.textContent = r.ok ? r.dados.resposta : (r.dados.erro || 'Não consegui responder agora.')
    if (!r.ok) aguarde.classList.add('chat-erro')
  })
})()
