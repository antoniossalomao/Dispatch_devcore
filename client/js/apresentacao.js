// Página de apresentação (DevCore / Dispatch): troca das abas de prévia, animações de rolagem e modal de planos.
// Usa apenas capturas de tela estáticas locais, sem precisar de login ou chamada de API.
class TelaApresentacao {
  constructor() {
    this.telas = {
      resumo: {
        alt: 'Resumo operacional do Dispatch com indicadores e movimentações',
        legenda: 'Clareza para acompanhar a operação. Tela demonstrativa com dados fictícios.'
      },
      colaboradores: {
        alt: 'Colaboradores no Dispatch, com filtros, situação da CNH e histórico',
        legenda: 'Pessoas e informações conectadas. Tela demonstrativa com dados fictícios.'
      },
      configuracoes: {
        alt: 'Configurações e preferências do Dispatch',
        legenda: 'Uma base organizada para sua operação. Tela demonstrativa com dados fictícios.'
      }
    };

    this.planos = {
      essencial: {
        nome: 'Essencial',
        descricao: 'Um ponto de partida para organizar os principais registros da operação.',
        recursos: [
          'Cadastro de colaboradores',
          'Alojamentos, quartos, leitos e estadias',
          'Frota e movimentações',
          'Resumo operacional'
        ]
      },
      profissional: {
        nome: 'Profissional',
        descricao: 'Uma proposta para ampliar a análise e a rastreabilidade da operação.',
        recursos: [
          'Escopo do Essencial',
          'Relatórios de ocupação e frota',
          'Histórico e auditoria com hashes encadeados',
          'Central de notificações'
        ]
      },
      'sob-medida': {
        nome: 'Sob medida',
        descricao:
          'Um convite para mapear necessidades e avaliar possibilidades. Novos recursos e integrações dependem de análise de viabilidade.',
        recursos: [
          'Levantamento de necessidades',
          'Definição conjunta de escopo',
          'Análise de integrações',
          'Planejamento de implantação'
        ]
      }
    };

    this.abas = Array.from(document.querySelectorAll('[role="tab"]'));
    this.imagem = document.getElementById('tela-dispatch');
    this.legendaTela = document.getElementById('legenda-tela');
    this.painelTela = document.getElementById('painel-tela');

    this.movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.ponteiroPreciso = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.hero = document.querySelector('.hero');
    this.produto = document.querySelector('.produto-cena');
    this.manifesto = document.querySelector('.manifesto');
    this.convite = document.querySelector('.convite');

    this.estadoMovimento = {
      hero: 0,
      produto: 0,
      manifesto: 0,
      convite: 0,
      x: 0,
      y: 0
    };
    this.mouseAlvo = { x: 0, y: 0 };
    this.frameMovimento = null;

    this.dialogo = document.getElementById('dialogo-plano');

    this.configurarAbas();
    this.configurarCenasRolagem();
    this.configurarDialogoPlanos();
  }

  limitar(valor, minimo = 0, maximo = 1) {
    return Math.max(minimo, Math.min(maximo, valor));
  }

  ativarAba(aba) {
    const chave = aba.dataset.tela;
    const dadosTela = this.telas[chave];
    if (!dadosTela) return;

    this.abas.forEach((item) => {
      item.setAttribute('aria-selected', String(item === aba));
      item.tabIndex = item === aba ? 0 : -1;
    });

    if (this.imagem) {
      this.imagem.src = 'assets/apresentacao/' + chave + '.png';
      this.imagem.alt = dadosTela.alt;
    }
    if (this.legendaTela) {
      this.legendaTela.textContent = dadosTela.legenda;
    }
    if (this.painelTela) {
      this.painelTela.setAttribute('aria-labelledby', aba.id);
    }
  }

  configurarAbas() {
    this.abas.forEach((aba, indice) => {
      aba.addEventListener('click', () => this.ativarAba(aba));
      aba.addEventListener('keydown', (evento) => {
        let destino;
        if (evento.key === 'ArrowRight') destino = (indice + 1) % this.abas.length;
        if (evento.key === 'ArrowLeft')
          destino = (indice - 1 + this.abas.length) % this.abas.length;
        if (evento.key === 'Home') destino = 0;
        if (evento.key === 'End') destino = this.abas.length - 1;
        if (destino === undefined) return;

        evento.preventDefault();
        this.abas[destino].focus();
        this.ativarAba(this.abas[destino]);
      });
    });
  }

  // Calcula de 0 a 1 quanto o usuário já rolou dentro de uma seção presa na tela.
  progressoCena(elemento, margem) {
    const caixa = elemento.getBoundingClientRect();
    const curso = Math.max(1, caixa.height - (window.innerHeight - margem));
    return this.limitar((margem - caixa.top) / curso);
  }

  // Calcula de -1 a 1 a posição de uma seção enquanto ela entra e sai da janela.
  passagem(elemento) {
    const caixa = elemento.getBoundingClientRect();
    return (
      this.limitar((window.innerHeight - caixa.top) / (window.innerHeight + caixa.height)) * 2 - 1
    );
  }

  // Atualiza as variáveis CSS (--hero-p, --mouse-x etc.) aos poucos para a animação ficar suave.
  animarCenas() {
    this.frameMovimento = null;
    if (this.movimentoReduzido.matches || document.hidden) return;
    if (!this.hero || !this.produto || !this.manifesto || !this.convite) return;

    const desktopPreso = window.innerWidth > 1000 && window.innerHeight >= 700;
    const alvos = {
      hero: desktopPreso
        ? this.progressoCena(this.hero, 88)
        : this.limitar(-this.hero.getBoundingClientRect().top / this.hero.offsetHeight),
      produto: this.progressoCena(this.produto, window.innerWidth <= 760 ? 145 : 105),
      manifesto: this.passagem(this.manifesto),
      convite: this.passagem(this.convite),
      x: this.mouseAlvo.x,
      y: this.mouseAlvo.y
    };

    let continuar = false;
    Object.keys(alvos).forEach((chave) => {
      const diferenca = alvos[chave] - this.estadoMovimento[chave];
      if (Math.abs(diferenca) < 0.0005) {
        this.estadoMovimento[chave] = alvos[chave];
      } else {
        this.estadoMovimento[chave] = this.estadoMovimento[chave] + diferenca * 0.14;
        continuar = true;
      }
    });

    this.hero.style.setProperty('--hero-p', this.estadoMovimento.hero.toFixed(4));
    this.hero.style.setProperty('--mouse-x', this.estadoMovimento.x.toFixed(4));
    this.hero.style.setProperty('--mouse-y', this.estadoMovimento.y.toFixed(4));
    this.produto.style.setProperty('--produto-p', this.estadoMovimento.produto.toFixed(4));
    this.manifesto.style.setProperty('--manifesto-p', this.estadoMovimento.manifesto.toFixed(4));
    this.convite.style.setProperty('--convite-p', this.estadoMovimento.convite.toFixed(4));

    if (continuar) {
      this.frameMovimento = requestAnimationFrame(this.animarCenas.bind(this));
    }
  }

  agendarMovimento() {
    if (this.frameMovimento === null && !this.movimentoReduzido.matches && !document.hidden) {
      this.frameMovimento = requestAnimationFrame(this.animarCenas.bind(this));
    }
  }

  // Respeita quem configurou "reduzir movimento" no sistema operacional desligando os efeitos de rolagem.
  configurarMovimento() {
    if (this.frameMovimento !== null) cancelAnimationFrame(this.frameMovimento);
    this.frameMovimento = null;
    document.body.classList.toggle('movimento-ativo', !this.movimentoReduzido.matches);

    if (this.movimentoReduzido.matches) {
      [this.hero, this.produto, this.manifesto, this.convite].forEach((elemento) => {
        if (!elemento) return;
        [
          '--hero-p',
          '--mouse-x',
          '--mouse-y',
          '--produto-p',
          '--manifesto-p',
          '--convite-p'
        ].forEach((propriedade) => elemento.style.removeProperty(propriedade));
      });
      Object.keys(this.estadoMovimento).forEach((chave) => {
        this.estadoMovimento[chave] = 0;
      });
      return;
    }

    this.agendarMovimento();
  }

  configurarCenasRolagem() {
    if (this.hero) {
      this.hero.addEventListener('pointermove', (evento) => {
        if (!this.ponteiroPreciso.matches || this.movimentoReduzido.matches) return;
        const blocoHero = this.hero.querySelector('.hero-conteudo');
        if (!blocoHero) return;

        const caixa = blocoHero.getBoundingClientRect();
        this.mouseAlvo.x = this.limitar(((evento.clientX - caixa.left) / caixa.width) * 2 - 1, -1, 1);
        this.mouseAlvo.y = this.limitar(((evento.clientY - caixa.top) / caixa.height) * 2 - 1, -1, 1);
        this.agendarMovimento();
      });

      this.hero.addEventListener('pointerleave', () => {
        this.mouseAlvo.x = 0;
        this.mouseAlvo.y = 0;
        this.agendarMovimento();
      });
    }

    window.addEventListener('scroll', this.agendarMovimento.bind(this), { passive: true });
    window.addEventListener('resize', this.agendarMovimento.bind(this));
    document.addEventListener('visibilitychange', this.agendarMovimento.bind(this));
    window.addEventListener('pageshow', this.agendarMovimento.bind(this));
    this.movimentoReduzido.addEventListener('change', this.configurarMovimento.bind(this));
    this.configurarMovimento();
  }

  configurarDialogoPlanos() {
    if (!this.dialogo) return;

    document.querySelectorAll('[data-plano]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const plano = this.planos[botao.dataset.plano];
        if (!plano) return;

        document.getElementById('dialogo-titulo').textContent = plano.nome;
        document.getElementById('dialogo-descricao').textContent = plano.descricao;
        document.getElementById('dialogo-recursos').replaceChildren(
          ...plano.recursos.map((texto) => {
            const item = document.createElement('li');
            item.textContent = texto;
            return item;
          })
        );

        this.dialogo.showModal();
        document.body.classList.add('dialogo-aberto');
      });
    });

    const botaoFechar = this.dialogo.querySelector('.dialogo-fechar');
    if (botaoFechar) {
      botaoFechar.addEventListener('click', () => this.dialogo.close());
    }

    // Permite fechar o diálogo clicando na parte escura fora do cartão.
    this.dialogo.addEventListener('click', (evento) => {
      const caixa = this.dialogo.getBoundingClientRect();
      if (
        evento.target === this.dialogo &&
        (evento.clientX < caixa.left ||
          evento.clientX > caixa.right ||
          evento.clientY < caixa.top ||
          evento.clientY > caixa.bottom)
      ) {
        this.dialogo.close();
      }
    });

    this.dialogo.addEventListener('close', () => {
      document.body.classList.remove('dialogo-aberto');
    });
  }
}

new TelaApresentacao();
