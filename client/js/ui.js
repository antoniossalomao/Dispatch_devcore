// comportamento comum de modais e gavetas (acessibilidade) e dialogos de confirmacao/texto no padrao visual do sistema
// carregar depois do html da tela; nao depende de outros scripts
(function () {
  const SELETOR_FOCO = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  const abertos = [] // pilha de janelas abertas: { el, abriuPor }
  let contador = 0

  function focaveis(el) {
    return Array.prototype.filter.call(el.querySelectorAll(SELETOR_FOCO), function (x) { return x.offsetParent !== null })
  }

  function atualizarRolagem() {
    document.body.classList.toggle('sem-rolagem', abertos.length > 0)
  }

  function aoAbrir(el) {
    if (abertos.some(function (a) { return a.el === el })) return
    abertos.push({ el: el, abriuPor: document.activeElement })
    atualizarRolagem()
    setTimeout(function () {
      const itens = focaveis(el).filter(function (x) { return !x.classList.contains('modal-fechar') })
      const alvo = itens[0] || focaveis(el)[0]
      if (alvo) alvo.focus()
    }, 0)
  }

  function aoFechar(el) {
    const i = abertos.findIndex(function (a) { return a.el === el })
    if (i === -1) return
    const origem = abertos[i].abriuPor
    abertos.splice(i, 1)
    atualizarRolagem()
    if (origem && document.body.contains(origem) && typeof origem.focus === 'function') origem.focus()
  }

  // marca a janela como dialogo e acompanha quando ela aparece ou some (atributo hidden)
  function preparar(el) {
    if (el.dataset.uiPronto) return
    el.dataset.uiPronto = '1'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    const titulo = el.querySelector('.modal-titulo, .gaveta-titulo')
    if (titulo) {
      if (!titulo.id) titulo.id = 'ui-titulo-' + (++contador)
      el.setAttribute('aria-labelledby', titulo.id)
    }
    el.querySelectorAll('.modal-fechar').forEach(function (b) {
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Fechar')
    })
    new MutationObserver(function () {
      if (el.hidden) aoFechar(el)
      else aoAbrir(el)
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] })
    if (!el.hidden) aoAbrir(el)
  }

  function fecharTopo() {
    const topo = abertos[abertos.length - 1]
    if (!topo) return false
    const botao = topo.el.querySelector('.modal-fechar')
    if (botao) botao.click()
    else topo.el.hidden = true
    return true
  }

  document.addEventListener('keydown', function (e) {
    if (abertos.length === 0) return
    if (e.key === 'Escape') {
      if (fecharTopo()) e.preventDefault()
      return
    }
    if (e.key === 'Tab') {
      // mantem o foco dentro da janela aberta
      const itens = focaveis(abertos[abertos.length - 1].el)
      if (itens.length === 0) return
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primeiro.focus()
      }
    }
  })

  // ---- nomes acessiveis e avisos ----
  document.querySelectorAll('.modal-overlay, .gaveta-overlay').forEach(preparar)
  document.querySelectorAll('.toast').forEach(function (t) {
    t.setAttribute('role', 'status')
    t.setAttribute('aria-live', 'polite')
  })
  const sair = document.getElementById('botao-sair')
  if (sair && !sair.getAttribute('aria-label')) sair.setAttribute('aria-label', 'Sair do sistema')
  const sino = document.getElementById('botao-notificacoes')
  if (sino && !sino.getAttribute('aria-label')) sino.setAttribute('aria-label', 'Ver pendências')

  // ---- dialogos no padrao visual (substituem confirm e prompt do navegador) ----
  function criarDialogo(titulo, montarCorpo, rotuloOk, rotuloCancelar) {
    return new Promise(function (resolve) {
      const overlay = document.createElement('div')
      overlay.className = 'modal-overlay'
      overlay.hidden = true
      overlay.innerHTML =
        '<div class="modal-card modal-pequeno"><form>' +
          '<div class="modal-cabecalho"><div><h2 class="modal-titulo"></h2></div>' +
          '<button type="button" class="modal-fechar">&times;</button></div>' +
          '<div class="modal-corpo"></div>' +
          '<div class="modal-rodape"><button type="button" class="btn-secundario" data-acao="cancelar"></button>' +
          '<button type="submit" class="btn-primario"></button></div></form></div>'
      overlay.querySelector('.modal-titulo').textContent = titulo
      overlay.querySelector('[data-acao="cancelar"]').textContent = rotuloCancelar
      overlay.querySelector('.btn-primario').textContent = rotuloOk
      const corpo = overlay.querySelector('.modal-corpo')
      const pegarValor = montarCorpo(corpo)
      document.body.appendChild(overlay)

      let resolvido = false
      function terminar(valor) {
        if (resolvido) return
        resolvido = true
        overlay.hidden = true
        setTimeout(function () { overlay.remove() }, 0)
        resolve(valor)
      }
      overlay.querySelector('.modal-fechar').addEventListener('click', function () { terminar(null) })
      overlay.querySelector('[data-acao="cancelar"]').addEventListener('click', function () { terminar(null) })
      overlay.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault()
        const valor = pegarValor()
        if (valor !== undefined) terminar(valor)
      })
      preparar(overlay)
      overlay.hidden = false
    })
  }

  // confirmar('texto', { titulo, confirmar, cancelar }) -> Promise<boolean>
  window.confirmar = function (texto, opcoes) {
    const o = opcoes || {}
    return criarDialogo(o.titulo || 'Confirmar', function (corpo) {
      const p = document.createElement('p')
      p.className = 'modal-subtitulo'
      p.textContent = texto
      corpo.appendChild(p)
      return function () { return true }
    }, o.confirmar || 'Confirmar', o.cancelar || 'Cancelar').then(function (v) { return v === true })
  }

  // pedirTexto('Titulo', 'Rotulo do campo', { obrigatorio }) -> Promise<string | null>
  window.pedirTexto = function (titulo, rotulo, opcoes) {
    const o = opcoes || {}
    return criarDialogo(titulo, function (corpo) {
      const grupo = document.createElement('div')
      grupo.className = 'campo-grupo'
      const label = document.createElement('label')
      label.className = 'campo-label'
      label.textContent = rotulo
      const campo = document.createElement('textarea')
      campo.className = 'config-input campo-texto-longo'
      campo.rows = 3
      campo.maxLength = 500
      label.htmlFor = campo.id = 'ui-texto-' + (++contador)
      grupo.appendChild(label)
      grupo.appendChild(campo)
      corpo.appendChild(grupo)
      return function () {
        const v = campo.value.trim()
        if (o.obrigatorio !== false && v === '') {
          campo.focus()
          return undefined
        }
        return v
      }
    }, o.confirmar || 'Salvar', o.cancelar || 'Cancelar')
  }
})()
