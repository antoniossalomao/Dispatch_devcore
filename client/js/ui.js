// Cuida das janelas (modais e gavetas), da navegação por teclado dentro delas e dos avisos de confirmação.
class Janelas {
  constructor() {
    this.seletorFoco =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    this.abertos = [];
    this.contador = 0;
    this.observadores = new Map();
    this.fundos = new Map();
    this.ultimoFoco = document.activeElement;
    document.addEventListener('focusin', (evento) => {
      const janela = evento.target.closest('[role="dialog"]');
      if (janela && this.observadores.has(janela) && !janela.hidden) this.aoAbrir(janela);
      this.ultimoFoco = evento.target;
    });

    document.addEventListener('keydown', (evento) => {
      if (this.abertos.length === 0) return;

      if (evento.key === 'Escape') {
        if (this.fecharTopo()) evento.preventDefault();
        return;
      }

      // Prende a tecla Tab dentro da janela aberta no momento para ninguém sair navegando no fundo escondido.
      if (evento.key === 'Tab') {
        const itens = this.focaveis(this.abertos[this.abertos.length - 1].el);
        if (itens.length === 0) {
          evento.preventDefault();
          this.abertos.at(-1).el.focus();
          return;
        }
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (evento.shiftKey && document.activeElement === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        } else if (!this.abertos.at(-1).el.contains(document.activeElement)) {
          evento.preventDefault();
          primeiro.focus();
        }
      }
    });

    this.prepararTela();

    this.sair = document.getElementById('botao-sair');
    if (this.sair && !this.sair.getAttribute('aria-label')) {
      this.sair.setAttribute('aria-label', 'Sair do sistema');
    }

    this.sino = document.getElementById('botao-notificacoes');
    if (this.sino && !this.sino.getAttribute('aria-label')) {
      this.sino.setAttribute('aria-label', 'Ver pendências');
    }

    // Substitui o window.confirm() e o window.prompt() padrões do navegador por janelas no visual do sistema.
    window.confirmar = (texto, opcoes) => {
      const config = opcoes || {};
      return this.criarDialogo(
        config.titulo || 'Confirmar',
        (corpo) => {
          const paragrafo = document.createElement('p');
          paragrafo.className = 'modal-subtitulo';
          paragrafo.textContent = texto;
          corpo.appendChild(paragrafo);
          return () => true;
        },
        config.confirmar || 'Confirmar',
        config.cancelar || 'Cancelar'
      ).then((confirmado) => confirmado === true);
    };

    window.pedirTexto = (titulo, rotulo, opcoes) => {
      const config = opcoes || {};
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
            const valor = campo.value.trim();
            if (config.obrigatorio !== false && valor === '') {
              campo.focus();
              return undefined;
            }
            return valor;
          };
        },
        config.confirmar || 'Salvar',
        config.cancelar || 'Cancelar'
      );
    };
  }

  // Chamado de novo pela casca (js/app/App.js) a cada troca de tela, porque os modais chegam junto com ela.
  prepararTela() {
    document.querySelectorAll('.modal-overlay, .gaveta-overlay').forEach(this.preparar.bind(this));
    document.querySelectorAll('.toast').forEach((aviso) => {
      aviso.setAttribute('role', 'status');
      aviso.setAttribute('aria-live', 'polite');
    });
  }

  // Ao sair de uma tela, as janelas dela somem do DOM sem passar pelo "fechar"; zera a pilha para o Tab e o Esc não apontarem para elas.
  limparTela() {
    this.observadores.forEach((observador, elemento) => {
      if (elemento.closest('#camada-tela') || !elemento.isConnected) {
        observador.disconnect();
        this.observadores.delete(elemento);
      }
    });
    this.abertos = [];
    this.atualizarRolagem();
  }

  focaveis(elemento) {
    return Array.from(elemento.querySelectorAll(this.seletorFoco)).filter(
      (item) => item.offsetParent !== null
    );
  }

  atualizarRolagem() {
    document.body.classList.toggle('sem-rolagem', this.abertos.length > 0);
    // O fundo também fica indisponível para mouse e tecnologias assistivas.
    // Restauramos os valores originais antes de calcular a camada ativa, inclusive em diálogos aninhados.
    this.fundos.forEach((valor, elemento) => { elemento.inert = valor; });
    this.fundos.clear();
    let ramo = this.abertos.at(-1)?.el;
    while (ramo && ramo !== document.body) {
      Array.from(ramo.parentElement.children).forEach((irmao) => {
        if (irmao === ramo || irmao.matches('script, style, link')) return;
        this.fundos.set(irmao, irmao.inert);
        irmao.inert = true;
      });
      ramo = ramo.parentElement;
    }
  }

  aoAbrir(elemento) {
    if (this.abertos.some((registro) => registro.el === elemento)) return;

    const registro = {
      el: elemento,
      abriuPor: elemento.contains(document.activeElement) ? this.ultimoFoco : document.activeElement,
      foto: null
    };
    this.abertos.push(registro);
    this.atualizarRolagem();

    // guarda como o formulário estava ao abrir, pra saber depois se a pessoa mexeu em algo
    setTimeout(() => {
      if (!elemento.isConnected || elemento.hidden) return;
      registro.foto = this.fotoDoFormulario(elemento);
    }, 50);

    setTimeout(() => {
      if (this.abertos.at(-1) !== registro || !elemento.isConnected || elemento.hidden) return;
      const campos = this.focaveis(elemento).filter((item) => !item.classList.contains('modal-fechar'));
      const alvo = campos[0] || this.focaveis(elemento)[0];
      if (alvo) alvo.focus();
    }, 0);
  }

  // Junta o valor de todos os campos do modal num texto só, pra comparar "antes" e "agora".
  fotoDoFormulario(elemento) {
    const valores = Array.from(elemento.querySelectorAll('input, select, textarea')).map((campo) => {
      if (campo.type === 'checkbox' || campo.type === 'radio') return campo.checked ? '1' : '0';
      return campo.value;
    });
    return JSON.stringify(valores);
  }

  temAlteracao(elemento) {
    const registro = this.abertos.find((item) => item.el === elemento);
    return Boolean(registro && registro.foto !== null && this.fotoDoFormulario(elemento) !== registro.foto);
  }

  aoFechar(elemento) {
    const indice = this.abertos.findIndex((registro) => registro.el === elemento);
    if (indice === -1) return;

    // Devolve o foco para o botão que abriu a janela antes dela fechar.
    const origem = this.abertos[indice].abriuPor;
    this.abertos.splice(indice, 1);
    this.atualizarRolagem();
    if (elemento.dataset.dialogo || elemento.classList.contains('cmdk-overlay')) {
      this.observadores.get(elemento)?.disconnect();
      this.observadores.delete(elemento);
    }
    if (origem && document.body.contains(origem) && typeof origem.focus === 'function') {
      origem.focus();
    }
  }

  preparar(elemento) {
    if (elemento.dataset.uiPronto) return;
    elemento.dataset.uiPronto = '1';
    elemento.setAttribute('role', 'dialog');
    elemento.setAttribute('aria-modal', 'true');
    elemento.tabIndex = -1;

    const titulo = elemento.querySelector('.modal-titulo, .gaveta-titulo');
    if (titulo) {
      if (!titulo.id) titulo.id = 'ui-titulo-' + ++this.contador;
      elemento.setAttribute('aria-labelledby', titulo.id);
    }

    elemento.querySelectorAll('.modal-fechar').forEach((botao) => {
      if (!botao.getAttribute('aria-label')) botao.setAttribute('aria-label', 'Fechar');
    });

    // Se a pessoa mexeu no formulário e clicou em ×, Cancelar ou apertou Esc, pergunta antes de jogar fora.
    // Roda na fase de captura (true) pra conseguir segurar o clique antes do código da tela fechar o modal.
    if (elemento.classList.contains('modal-overlay') && !elemento.dataset.dialogo) {
      elemento.addEventListener(
        'click',
        (evento) => {
          const botao = evento.target.closest('.modal-fechar, .modal-rodape .btn-secundario');
          if (!botao || !this.temAlteracao(elemento)) return;
          evento.preventDefault();
          evento.stopImmediatePropagation();
          window
            .confirmar('O que você digitou neste formulário vai ser perdido.', {
              titulo: 'Descartar alterações?',
              confirmar: 'Descartar',
              cancelar: 'Continuar editando'
            })
            .then((descartar) => {
              if (!descartar) return;
              const registro = this.abertos.find((item) => item.el === elemento);
              if (registro) registro.foto = null;
              botao.click();
            });
        },
        true
      );
    }

    // Observa quando o atributo hidden muda para saber a hora exata em que uma tela abre ou fecha a janela.
    const observador = new MutationObserver(() => {
      if (elemento.hidden) this.aoFechar(elemento);
      else this.aoAbrir(elemento);
    });
    observador.observe(elemento, {
      attributes: true,
      attributeFilter: ['hidden']
    });
    this.observadores.set(elemento, observador);

    if (!elemento.hidden) this.aoAbrir(elemento);
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
      let resolvido = false;
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.hidden = true;
      // as janelinhas de confirmação não perguntam "descartar alterações?" (senão perguntaria sobre ela mesma)
      overlay.dataset.dialogo = '1';

      const terminar = (valor) => {
        if (resolvido) return;
        resolvido = true;
        overlay.hidden = true;
        setTimeout(() => {
          overlay.remove();
        }, 0);
        resolve(valor);
      };

      overlay.innerHTML =
        '<div class="modal-card modal-pequeno"><form>' +
        '<div class="modal-cabecalho"><div><h2 class="modal-titulo"></h2></div>' +
        '<button type="button" class="modal-fechar">&times;</button></div>' +
        '<div class="modal-corpo"></div>' +
        '<div class="modal-rodape"><button type="button" class="btn-secundario" data-acao="cancelar"></button>' +
        '<button type="submit" class="btn-primario"></button></div></form></div>';

      // Textos entram sempre por textContent para nunca serem interpretados como código HTML.
      overlay.querySelector('.modal-titulo').textContent = titulo;
      overlay.querySelector('[data-acao="cancelar"]').textContent = rotuloCancelar;
      overlay.querySelector('.btn-primario').textContent = rotuloOk;

      const corpo = overlay.querySelector('.modal-corpo');
      const pegarValor = montarCorpo(corpo);
      document.body.appendChild(overlay);

      overlay.querySelector('.modal-fechar').addEventListener('click', () => {
        terminar(null);
      });
      overlay.querySelector('[data-acao="cancelar"]').addEventListener('click', () => {
        terminar(null);
      });
      overlay.querySelector('form').addEventListener('submit', (evento) => {
        evento.preventDefault();
        const valor = pegarValor();
        if (valor !== undefined) terminar(valor);
      });

      this.preparar(overlay);
      overlay.hidden = false;
    });
  }
}

window.janelas = new Janelas();
