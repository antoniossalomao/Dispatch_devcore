// Controla os diálogos e o foco.
class Janelas {
  constructor() {
    this.seletorFoco =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    this.abertos = [];
    this.contador = 0;
    document.addEventListener('keydown', (e) => {
      if (this.abertos.length === 0) return;
      if (e.key === 'Escape') {
        if (this.fecharTopo()) e.preventDefault();
        return;
      }
      if (e.key === 'Tab') {
        // mantem o foco dentro da janela aberta
        const itens = this.focaveis(this.abertos[this.abertos.length - 1].el);
        if (itens.length === 0) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    });
    document.querySelectorAll('.modal-overlay, .gaveta-overlay').forEach(this.preparar.bind(this));
    document.querySelectorAll('.toast').forEach((t) => {
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    });
    this.sair = document.getElementById('botao-sair');
    if (this.sair && !this.sair.getAttribute('aria-label'))
      this.sair.setAttribute('aria-label', 'Sair do sistema');
    this.sino = document.getElementById('botao-notificacoes');
    if (this.sino && !this.sino.getAttribute('aria-label'))
      this.sino.setAttribute('aria-label', 'Ver pendências');
    window.confirmar = (texto, opcoes) => {
      const o = opcoes || {};
      return this.criarDialogo(
        o.titulo || 'Confirmar',
        (corpo) => {
          const p = document.createElement('p');
          p.className = 'modal-subtitulo';
          p.textContent = texto;
          corpo.appendChild(p);
          return () => {
            return true;
          };
        },
        o.confirmar || 'Confirmar',
        o.cancelar || 'Cancelar'
      ).then((v) => {
        return v === true;
      });
    };
    window.pedirTexto = (titulo, rotulo, opcoes) => {
      const o = opcoes || {};
      return this.criarDialogo(
        titulo,
        (corpo) => {
          const grupo = document.createElement('div');
          grupo.className = 'campo-grupo';
          const label = document.createElement('label');
          label.className = 'campo-label';
          label.textContent = rotulo;
          const campo = document.createElement('textarea');
          campo.className = 'config-input campo-texto-longo';
          campo.rows = 3;
          campo.maxLength = 500;
          label.htmlFor = campo.id = 'ui-texto-' + ++this.contador;
          grupo.appendChild(label);
          grupo.appendChild(campo);
          corpo.appendChild(grupo);
          return () => {
            const v = campo.value.trim();
            if (o.obrigatorio !== false && v === '') {
              campo.focus();
              return undefined;
            }
            return v;
          };
        },
        o.confirmar || 'Salvar',
        o.cancelar || 'Cancelar'
      );
    };
  }

  focaveis(el) {
    return Array.prototype.filter.call(el.querySelectorAll(this.seletorFoco), (x) => {
      return x.offsetParent !== null;
    });
  }

  atualizarRolagem() {
    document.body.classList.toggle('sem-rolagem', this.abertos.length > 0);
  }

  aoAbrir(el) {
    if (
      this.abertos.some((a) => {
        return a.el === el;
      })
    )
      return;
    this.abertos.push({
      el: el,
      abriuPor: document.activeElement
    });
    this.atualizarRolagem();
    setTimeout(() => {
      const itens = this.focaveis(el).filter((x) => {
        return !x.classList.contains('modal-fechar');
      });
      const alvo = itens[0] || this.focaveis(el)[0];
      if (alvo) alvo.focus();
    }, 0);
  }

  aoFechar(el) {
    const i = this.abertos.findIndex((a) => {
      return a.el === el;
    });
    if (i === -1) return;
    const origem = this.abertos[i].abriuPor;
    this.abertos.splice(i, 1);
    this.atualizarRolagem();
    if (origem && document.body.contains(origem) && typeof origem.focus === 'function')
      origem.focus();
  }

  preparar(el) {
    if (el.dataset.uiPronto) return;
    el.dataset.uiPronto = '1';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    const titulo = el.querySelector('.modal-titulo, .gaveta-titulo');
    if (titulo) {
      if (!titulo.id) titulo.id = 'ui-titulo-' + ++this.contador;
      el.setAttribute('aria-labelledby', titulo.id);
    }
    el.querySelectorAll('.modal-fechar').forEach((b) => {
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Fechar');
    });
    new MutationObserver(() => {
      if (el.hidden) this.aoFechar(el);
      else this.aoAbrir(el);
    }).observe(el, {
      attributes: true,
      attributeFilter: ['hidden']
    });
    if (!el.hidden) this.aoAbrir(el);
  }

  fecharTopo() {
    const topo = this.abertos[this.abertos.length - 1];
    if (!topo) return false;
    const botao = topo.el.querySelector('.modal-fechar');
    if (botao) botao.click();
    else topo.el.hidden = true;
    return true;
  }

  criarDialogo(titulo, montarCorpo, rotuloOk, rotuloCancelar) {
    return new Promise((resolve) => {
      const terminar = (valor) => {
        if (resolvido) return;
        resolvido = true;
        overlay.hidden = true;
        setTimeout(() => {
          overlay.remove();
        }, 0);
        resolve(valor);
      };
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.hidden = true;
      overlay.innerHTML =
        '<div class="modal-card modal-pequeno"><form>' +
        '<div class="modal-cabecalho"><div><h2 class="modal-titulo"></h2></div>' +
        '<button type="button" class="modal-fechar">&times;</button></div>' +
        '<div class="modal-corpo"></div>' +
        '<div class="modal-rodape"><button type="button" class="btn-secundario" data-acao="cancelar"></button>' +
        '<button type="submit" class="btn-primario"></button></div></form></div>';
      overlay.querySelector('.modal-titulo').textContent = titulo;
      overlay.querySelector('[data-acao="cancelar"]').textContent = rotuloCancelar;
      overlay.querySelector('.btn-primario').textContent = rotuloOk;
      const corpo = overlay.querySelector('.modal-corpo');
      const pegarValor = montarCorpo(corpo);
      document.body.appendChild(overlay);
      let resolvido = false;
      overlay.querySelector('.modal-fechar').addEventListener('click', () => {
        terminar(null);
      });
      overlay.querySelector('[data-acao="cancelar"]').addEventListener('click', () => {
        terminar(null);
      });
      overlay.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const valor = pegarValor();
        if (valor !== undefined) terminar(valor);
      });
      this.preparar(overlay);
      overlay.hidden = false;
    });
  }
}
new Janelas();
