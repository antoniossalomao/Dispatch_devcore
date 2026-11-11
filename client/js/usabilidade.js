// Interações compartilhadas: navegação, busca, teclado e feedback de envio.
(function () {
  const principal = document.querySelector('main.conteudo')
  if (!principal) return

  principal.id = principal.id || 'ui-conteudo'
  principal.tabIndex = -1
  const pular = document.createElement('a')
  pular.className = 'ui-pular'
  pular.href = '#' + principal.id
  pular.textContent = 'Pular para o conteúdo'
  pular.addEventListener('click', function (evento) {
    evento.preventDefault() // Preserva o endereço da seção de Configurações.
    principal.focus({ preventScroll: true })
    principal.scrollIntoView({ block: 'start' })
  })
  document.body.prepend(pular)

  const menu = document.querySelector('.menu-lateral')
  const marca = menu.querySelector('.menu-marca')
  const nav = menu.querySelector('.menu-lista')
  nav.id = 'ui-menu-operacao'
  nav.setAttribute('aria-label', 'Operação')
  menu.querySelectorAll('a.menu-item').forEach(function (link) {
    if (new URL(link.href).pathname === window.location.pathname) link.setAttribute('aria-current', 'page')
  })

  const botaoMenu = document.createElement('button')
  botaoMenu.type = 'button'
  botaoMenu.className = 'ui-menu-botao'
  botaoMenu.textContent = 'Menu'
  botaoMenu.setAttribute('aria-controls', 'ui-menu-operacao bloco-menu-admin')
  botaoMenu.setAttribute('aria-expanded', 'false')
  marca.appendChild(botaoMenu)
  const celular = window.matchMedia('(max-width: 780px)')
  function mostrarMenu(aberto) {
    menu.classList.toggle('menu-aberto', aberto)
    botaoMenu.setAttribute('aria-expanded', String(aberto))
    botaoMenu.textContent = aberto ? 'Fechar menu' : 'Menu'
  }
  botaoMenu.addEventListener('click', function () { mostrarMenu(!menu.classList.contains('menu-aberto')) })
  menu.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape' && celular.matches && menu.classList.contains('menu-aberto')) {
      evento.preventDefault()
      mostrarMenu(false)
      botaoMenu.focus()
    }
  })
  celular.addEventListener('change', function () { mostrarMenu(false) })

  // Reconhecer e limpar uma busca exige um único controle, sem apagar caractere por caractere.
  document.querySelectorAll('.busca-caixa input[type="text"]').forEach(function (campo) {
    const limpar = document.createElement('button')
    limpar.type = 'button'
    limpar.className = 'ui-limpar-busca'
    limpar.setAttribute('aria-label', 'Limpar busca')
    limpar.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
    function atualizar() { limpar.hidden = campo.value.length === 0 }
    limpar.addEventListener('click', function () {
      campo.value = ''
      campo.dispatchEvent(new Event('input', { bubbles: true }))
      campo.focus()
    })
    campo.addEventListener('input', atualizar)
    campo.form && campo.form.addEventListener('reset', function () { setTimeout(atualizar, 0) })
    campo.parentElement.appendChild(limpar)
    atualizar()
  })

  function prepararAbas(grupo, seletor, painel, rotulo) {
    const botoes = Array.from(grupo.querySelectorAll(seletor))
    if (!botoes.length) return
    grupo.setAttribute('role', 'tablist')
    grupo.setAttribute('aria-label', rotulo)
    function sincronizar() {
      grupo.setAttribute('aria-orientation', getComputedStyle(grupo).flexDirection === 'column' ? 'vertical' : 'horizontal')
      botoes.forEach(function (botao, indice) {
        const alvo = painel(botao)
        const ativa = botao.classList.contains('ativa')
        botao.id = botao.id || grupo.id + '-aba-' + indice
        botao.setAttribute('role', 'tab')
        botao.setAttribute('aria-selected', String(ativa))
        botao.removeAttribute('aria-current')
        botao.tabIndex = ativa ? 0 : -1
        if (alvo) {
          botao.setAttribute('aria-controls', alvo.id)
          alvo.setAttribute('role', 'tabpanel')
          alvo.setAttribute('aria-labelledby', botao.id)
          alvo.tabIndex = 0
        }
      })
    }
    grupo.addEventListener('keydown', function (evento) {
      const atual = botoes.indexOf(document.activeElement)
      if (atual < 0) return
      const vertical = getComputedStyle(grupo).flexDirection === 'column'
      const anterior = vertical ? 'ArrowUp' : 'ArrowLeft'
      const proximo = vertical ? 'ArrowDown' : 'ArrowRight'
      let destino
      if (evento.key === anterior) destino = (atual - 1 + botoes.length) % botoes.length
      if (evento.key === proximo) destino = (atual + 1) % botoes.length
      if (evento.key === 'Home') destino = 0
      if (evento.key === 'End') destino = botoes.length - 1
      if (destino === undefined) return
      evento.preventDefault()
      botoes[destino].click()
      botoes[destino].focus()
    })
    const observador = new MutationObserver(sincronizar)
    botoes.forEach(function (botao) { observador.observe(botao, { attributes: true, attributeFilter: ['class'] }) })
    new ResizeObserver(sincronizar).observe(grupo)
    sincronizar()
  }

  document.querySelectorAll('.config-nav, .rel-abas, .gaveta-abas .filtro-abas').forEach(function (grupo, indice) {
    grupo.id = grupo.id || 'ui-abas-' + indice
    if (grupo.matches('.config-nav')) prepararAbas(grupo, '.config-nav-item', function (b) { return document.getElementById('painel-' + b.dataset.aba) }, 'Seções de configurações')
    else if (grupo.matches('.rel-abas')) prepararAbas(grupo, '.rel-aba', function (b) { return document.getElementById('aba-' + b.dataset.aba) }, 'Relatórios')
    else prepararAbas(grupo, '.gaveta-aba', function (b) { return document.getElementById('gaveta-secao-' + b.dataset.gaveta) }, 'Detalhes do registro')
  })
  document.querySelectorAll('.filtro-abas:not([role="tablist"])').forEach(function (grupo) {
    grupo.setAttribute('role', 'group')
    grupo.setAttribute('aria-label', 'Filtros da lista')
    const botoes = grupo.querySelectorAll('button')
    function sincronizar() {
      botoes.forEach(function (botao) { botao.setAttribute('aria-pressed', String(botao.classList.contains('ativa'))) })
    }
    const observador = new MutationObserver(sincronizar)
    botoes.forEach(function (botao) { observador.observe(botao, { attributes: true, attributeFilter: ['class'] }) })
    sincronizar()
  })

  document.querySelectorAll('.tabela-area').forEach(function (area, indice) {
    const tabela = area.querySelector('table')
    if (!tabela) return
    const titulo = area.closest('.bloco')?.querySelector('.bloco-titulo')?.textContent.trim() || 'Registros'
    const dica = document.createElement('p')
    dica.id = 'ui-rolagem-' + indice
    dica.className = 'ui-tabela-dica'
    dica.textContent = 'Role para ver todas as colunas'
    dica.hidden = true
    area.before(dica)
    function atualizar() {
      const precisaRolar = area.scrollWidth > area.clientWidth + 1
      dica.hidden = !precisaRolar
      if (precisaRolar) {
        area.tabIndex = 0
        area.setAttribute('role', 'region')
        area.setAttribute('aria-label', titulo + ', rolagem horizontal')
        area.setAttribute('aria-describedby', dica.id)
      } else {
        area.removeAttribute('tabindex')
        area.removeAttribute('role')
        area.removeAttribute('aria-label')
        area.removeAttribute('aria-describedby')
      }
    }
    const observador = new ResizeObserver(atualizar)
    observador.observe(area)
    observador.observe(tabela)
  })

  // Bloqueia reenvio enquanto o servidor processa a mesma submissão.
  const envios = new Map()
  const ocupados = new WeakMap()
  let envioAtual = null
  document.addEventListener('submit', function (evento) {
    if (ocupados.has(evento.target)) {
      evento.preventDefault()
      evento.stopImmediatePropagation()
      return
    }
    const envio = { form: evento.target, botoes: Array.from(evento.target.querySelectorAll('button[type="submit"]')).map(function (b) { return { el: b, texto: b.textContent, desativado: b.disabled } }) }
    envioAtual = envio
    setTimeout(function () { if (envioAtual === envio) envioAtual = null }, 0)
  }, true)
  document.addEventListener('dispatch:requisicao-inicio', function (evento) {
    if (!envioAtual || evento.detail.metodo === 'GET') return
    const envio = envioAtual
    envios.set(evento.detail.id, envio)
    ocupados.set(envio.form, true)
    envio.form.setAttribute('aria-busy', 'true')
    envio.botoes.forEach(function (b) { b.el.disabled = true; b.el.textContent = 'Enviando…' })
  })
  document.addEventListener('dispatch:requisicao-fim', function (evento) {
    const envio = envios.get(evento.detail.id)
    if (!envio) return
    envios.delete(evento.detail.id)
    if (Array.from(envios.values()).some(function (outro) { return outro.form === envio.form })) return
    ocupados.delete(envio.form)
    envio.form.removeAttribute('aria-busy')
    envio.botoes.forEach(function (b) { b.el.disabled = b.desativado; b.el.textContent = b.texto })
  })
})()
