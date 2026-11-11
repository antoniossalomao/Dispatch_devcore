// Controla a navegação e os controles compartilhados.
class Navegacao {
  constructor() {
    this.principal = document.querySelector('main.conteudo');
    if (!this.principal) return;
    this.principal.id = this.principal.id || 'ui-conteudo';
    this.principal.tabIndex = -1;
    this.pular = document.createElement('a');
    this.pular.className = 'ui-pular';
    this.pular.href = '#' + this.principal.id;
    this.pular.textContent = 'Pular para o conteúdo';
    this.pular.addEventListener('click', (evento) => {
      evento.preventDefault();
      this.principal.focus({
        preventScroll: true
      });
      this.principal.scrollIntoView({
        block: 'start'
      });
    });
    document.body.prepend(this.pular);
    this.menu = document.querySelector('.menu-lateral');
    this.marca = this.menu.querySelector('.menu-marca');
    this.nav = this.menu.querySelector('.menu-lista');
    this.nav.id = 'ui-menu-operacao';
    this.nav.setAttribute('aria-label', 'Operação');
    this.menu.querySelectorAll('a.menu-item').forEach((link) => {
      if (new URL(link.href).pathname === window.location.pathname)
        link.setAttribute('aria-current', 'page');
    });
    this.botaoMenu = document.createElement('button');
    this.botaoMenu.type = 'button';
    this.botaoMenu.className = 'ui-menu-botao';
    this.botaoMenu.textContent = 'Menu';
    this.botaoMenu.setAttribute('aria-controls', 'ui-menu-operacao bloco-menu-admin');
    this.botaoMenu.setAttribute('aria-expanded', 'false');
    this.marca.appendChild(this.botaoMenu);
    this.celular = window.matchMedia('(max-width: 780px)');
    this.botaoMenu.addEventListener('click', () => {
      this.mostrarMenu(!this.menu.classList.contains('menu-aberto'));
    });
    this.menu.addEventListener('keydown', (evento) => {
      if (
        evento.key === 'Escape' &&
        this.celular.matches &&
        this.menu.classList.contains('menu-aberto')
      ) {
        evento.preventDefault();
        this.mostrarMenu(false);
        this.botaoMenu.focus();
      }
    });
    this.celular.addEventListener('change', () => {
      this.mostrarMenu(false);
    });
    this.configurarBuscas();
    this.configurarGruposDeAbas();
    this.configurarFiltros();
    this.configurarTabelas();
    this.configurarEnvios();
  }

  configurarBuscas() {
    document.querySelectorAll('.busca-caixa input[type="text"]').forEach((campo) => {
      const atualizar = () => {
        limpar.hidden = campo.value.length === 0;
      };
      const limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.className = 'ui-limpar-busca';
      limpar.setAttribute('aria-label', 'Limpar busca');
      limpar.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
      limpar.addEventListener('click', () => {
        campo.value = '';
        campo.dispatchEvent(
          new Event('input', {
            bubbles: true
          })
        );
        campo.focus();
      });
      campo.addEventListener('input', atualizar);
      campo.form &&
        campo.form.addEventListener('reset', () => {
          setTimeout(atualizar, 0);
        });
      campo.parentElement.appendChild(limpar);
      atualizar();
    });
  }

  configurarGruposDeAbas() {
    document
      .querySelectorAll('.config-nav, .rel-abas, .gaveta-abas .filtro-abas')
      .forEach((grupo, indice) => {
        grupo.id = grupo.id || 'ui-abas-' + indice;
        if (grupo.matches('.config-nav'))
          this.prepararAbas(
            grupo,
            '.config-nav-item',
            (b) => {
              return document.getElementById('painel-' + b.dataset.aba);
            },
            'Seções de configurações'
          );
        else if (grupo.matches('.rel-abas'))
          this.prepararAbas(
            grupo,
            '.rel-aba',
            (b) => {
              return document.getElementById('aba-' + b.dataset.aba);
            },
            'Relatórios'
          );
        else
          this.prepararAbas(
            grupo,
            '.gaveta-aba',
            (b) => {
              return document.getElementById('gaveta-secao-' + b.dataset.gaveta);
            },
            'Detalhes do registro'
          );
      });
  }

  configurarFiltros() {
    document.querySelectorAll('.filtro-abas:not([role="tablist"])').forEach((grupo) => {
      const sincronizar = () => {
        botoes.forEach((botao) => {
          botao.setAttribute('aria-pressed', String(botao.classList.contains('ativa')));
        });
      };
      grupo.setAttribute('role', 'group');
      grupo.setAttribute('aria-label', 'Filtros da lista');
      const botoes = grupo.querySelectorAll('button');
      const observador = new MutationObserver(sincronizar);
      botoes.forEach((botao) => {
        observador.observe(botao, {
          attributes: true,
          attributeFilter: ['class']
        });
      });
      sincronizar();
    });
  }

  configurarTabelas() {
    document.querySelectorAll('.tabela-area').forEach((area, indice) => {
      const atualizar = () => {
        const precisaRolar = area.scrollWidth > area.clientWidth + 1;
        dica.hidden = !precisaRolar;
        if (precisaRolar) {
          area.tabIndex = 0;
          area.setAttribute('role', 'region');
          area.setAttribute('aria-label', titulo + ', rolagem horizontal');
          area.setAttribute('aria-describedby', dica.id);
        } else {
          area.removeAttribute('tabindex');
          area.removeAttribute('role');
          area.removeAttribute('aria-label');
          area.removeAttribute('aria-describedby');
        }
      };
      const tabela = area.querySelector('table');
      if (!tabela) return;
      const titulo =
        area.closest('.bloco')?.querySelector('.bloco-titulo')?.textContent.trim() || 'Registros';
      const dica = document.createElement('p');
      dica.id = 'ui-rolagem-' + indice;
      dica.className = 'ui-tabela-dica';
      dica.textContent = 'Role para ver todas as colunas';
      dica.hidden = true;
      area.before(dica);
      const observador = new ResizeObserver(atualizar);
      observador.observe(area);
      observador.observe(tabela);
    });

    // Bloqueia reenvio enquanto o servidor processa a mesma submissão.
  }

  configurarEnvios() {
    this.envios = new Map();
    this.ocupados = new WeakMap();
    this.envioAtual = null;
    document.addEventListener(
      'submit',
      (evento) => {
        if (this.ocupados.has(evento.target)) {
          evento.preventDefault();
          evento.stopImmediatePropagation();
          return;
        }
        const envio = {
          form: evento.target,
          botoes: Array.from(evento.target.querySelectorAll('button[type="submit"]')).map((b) => {
            return {
              el: b,
              texto: b.textContent,
              desativado: b.disabled
            };
          })
        };
        this.envioAtual = envio;
        setTimeout(() => {
          if (this.envioAtual === envio) this.envioAtual = null;
        }, 0);
      },
      true
    );
    document.addEventListener('dispatch:requisicao-inicio', (evento) => {
      if (!this.envioAtual || evento.detail.metodo === 'GET') return;
      const envio = this.envioAtual;
      this.envios.set(evento.detail.id, envio);
      this.ocupados.set(envio.form, true);
      envio.form.setAttribute('aria-busy', 'true');
      envio.botoes.forEach((b) => {
        b.el.disabled = true;
        b.el.textContent = 'Enviando…';
      });
    });
    document.addEventListener('dispatch:requisicao-fim', (evento) => {
      const envio = this.envios.get(evento.detail.id);
      if (!envio) return;
      this.envios.delete(evento.detail.id);
      if (
        Array.from(this.envios.values()).some((outro) => {
          return outro.form === envio.form;
        })
      )
        return;
      this.ocupados.delete(envio.form);
      envio.form.removeAttribute('aria-busy');
      envio.botoes.forEach((b) => {
        b.el.disabled = b.desativado;
        b.el.textContent = b.texto;
      });
    });
  }

  mostrarMenu(aberto) {
    this.menu.classList.toggle('menu-aberto', aberto);
    this.botaoMenu.setAttribute('aria-expanded', String(aberto));
    this.botaoMenu.textContent = aberto ? 'Fechar menu' : 'Menu';
  }

  prepararAbas(grupo, seletor, painel, rotulo) {
    const sincronizar = () => {
      grupo.setAttribute(
        'aria-orientation',
        getComputedStyle(grupo).flexDirection === 'column' ? 'vertical' : 'horizontal'
      );
      botoes.forEach((botao, indice) => {
        const alvo = painel(botao);
        const ativa = botao.classList.contains('ativa');
        botao.id = botao.id || grupo.id + '-aba-' + indice;
        botao.setAttribute('role', 'tab');
        botao.setAttribute('aria-selected', String(ativa));
        botao.removeAttribute('aria-current');
        botao.tabIndex = ativa ? 0 : -1;
        if (alvo) {
          botao.setAttribute('aria-controls', alvo.id);
          alvo.setAttribute('role', 'tabpanel');
          alvo.setAttribute('aria-labelledby', botao.id);
          alvo.tabIndex = 0;
        }
      });
    };
    const botoes = Array.from(grupo.querySelectorAll(seletor));
    if (!botoes.length) return;
    grupo.setAttribute('role', 'tablist');
    grupo.setAttribute('aria-label', rotulo);
    grupo.addEventListener('keydown', (evento) => {
      const atual = botoes.indexOf(document.activeElement);
      if (atual < 0) return;
      const vertical = getComputedStyle(grupo).flexDirection === 'column';
      const anterior = vertical ? 'ArrowUp' : 'ArrowLeft';
      const proximo = vertical ? 'ArrowDown' : 'ArrowRight';
      let destino;
      if (evento.key === anterior) destino = (atual - 1 + botoes.length) % botoes.length;
      if (evento.key === proximo) destino = (atual + 1) % botoes.length;
      if (evento.key === 'Home') destino = 0;
      if (evento.key === 'End') destino = botoes.length - 1;
      if (destino === undefined) return;
      evento.preventDefault();
      botoes[destino].click();
      botoes[destino].focus();
    });
    const observador = new MutationObserver(sincronizar);
    botoes.forEach((botao) => {
      observador.observe(botao, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
    new ResizeObserver(sincronizar).observe(grupo);
    sincronizar();
  }
}
new Navegacao();
