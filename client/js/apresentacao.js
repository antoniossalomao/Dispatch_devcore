// Página de apresentação do DevCore (a primeira página do site).
// Cuida da rolagem suave, das animações que aparecem conforme a pessoa desce a página,
// da lista de telas do Dispatch, da janela de detalhes e do menu no celular.
// Se a pessoa marcou "reduzir movimento" no computador, as animações ficam desligadas.
class TelaApresentacao {
  constructor() {
    this.reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mouseFino = window.matchMedia('(pointer: fine)').matches && !this.reduzirMovimento;

    // telas do Dispatch mostradas na seção "Dispatch"
    this.telas = [
      {
        nome: 'Visão geral',
        categoria: 'Resumo operacional',
        imagem: 'assets/apresentacao/tela-resumo.jpg',
        descricao:
          'Veículos em uso, vagas livres e as últimas movimentações do dia, com a ocupação de cada alojamento ao lado.'
      },
      {
        nome: 'Colaboradores',
        categoria: 'Pessoas e habilitações',
        imagem: 'assets/apresentacao/tela-colaboradores.jpg',
        descricao:
          'Equipe, CNH com prazo de vencimento e onde cada pessoa está alocada, com histórico de cada colaborador.'
      },
      {
        nome: 'Frota',
        categoria: 'Saídas, voltas e manutenções',
        imagem: 'assets/apresentacao/tela-frota.jpg',
        descricao:
          'Quem está com cada veículo, quilometragem e documentos. Licenciamento vencido bloqueia a saída.'
      },
      {
        nome: 'Relatórios',
        categoria: 'Ocupação e uso da frota',
        imagem: 'assets/apresentacao/tela-relatorios.jpg',
        descricao:
          'Ocupação média por alojamento, uso da frota, gargalos e quem estava dirigindo em cada período.'
      }
    ];

    // planos mostrados na seção "Planos" (a chave é o data-plano de cada linha no HTML)
    this.planos = {
      essencial: {
        nome: 'Essencial',
        categoria: 'O primeiro passo',
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
        categoria: 'Mais profundidade',
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
        categoria: 'Seu contexto no centro',
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

    // elementos da página
    this.hero = document.getElementById('topo');
    this.textoHero = document.getElementById('t1');
    this.setaHero = document.getElementById('t3');
    this.fundoHero = document.getElementById('hero-fundo');
    this.cabecalho = document.getElementById('cabecalho');
    this.barraProgresso = document.getElementById('progresso');
    this.janela = document.getElementById('janela');
    this.janelaImagem = document.getElementById('janela-pic');
    this.janelaFicha = document.getElementById('janela-ficha');
    this.botaoAnterior = document.getElementById('janela-ant');
    this.botaoProximo = document.getElementById('janela-prox');
    this.textoPosicao = document.getElementById('janela-pos');
    this.botaoMenu = document.getElementById('menu');
    this.gaveta = document.getElementById('gaveta');
    this.cursor = document.getElementById('cursor');
    this.linksMenu = Array.from(document.querySelectorAll('nav a.l'));
    this.secoesMenu = this.linksMenu.map((link) => document.querySelector(link.getAttribute('href')));

    // controle da janela de detalhes: lista de "abrir" e qual item está aberto
    this.listaJanela = [];
    this.indiceJanela = 0;
    this.indiceAnterior = 0;

    // controle da rolagem
    this.ultimoY = 0;
    this.ultimoTopo = null;
    this.pendentes = [];
    this.lenis = null;

    // posição do cursor (a atual vai "correndo atrás" do mouse para o movimento ficar suave)
    this.cursorX = -200;
    this.cursorY = -200;
    this.mouseX = -200;
    this.mouseY = -200;

    document.getElementById('ano').textContent = new Date().getFullYear();

    this.montarTelas();
    this.configurarPlanos();
    this.configurarJanela();
    this.configurarEquipe();
    this.configurarMenuCelular();
    this.prepararAnimacoes();
    this.configurarRolagemSuave();
    this.configurarCursor();
    this.iniciarLaco();
  }

  // Atalho para criar um elemento com classe e texto (o texto entra por textContent, então não vira HTML).
  criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto) elemento.textContent = texto;
    return elemento;
  }

  /* ===== seção Dispatch: uma linha por tela ===== */

  montarTelas() {
    const lista = document.getElementById('lista-telas');
    if (!lista) return;
    const funcoesAbrir = [];

    this.telas.forEach((tela, posicao) => {
      const artigo = this.criar('article', 'proj');

      const moldura = this.criar('button', 'frame');
      moldura.type = 'button';
      moldura.setAttribute('aria-label', 'Ver ' + tela.nome);
      const imagem = this.criar('img');
      imagem.src = tela.imagem;
      imagem.alt = 'Tela ' + tela.nome + ' do Dispatch';
      imagem.loading = 'lazy';
      moldura.appendChild(imagem);

      const info = this.criar('div', 'info');
      const link = this.criar('button', 'link', 'Ver a tela ');
      link.type = 'button';
      link.insertAdjacentHTML(
        'beforeend',
        '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M0 5h17M12 1l5 4-5 4"/></svg>'
      );
      info.append(
        this.criar('span', 'idx', '0' + (posicao + 1)),
        this.criar('h3', '', tela.nome),
        this.criar('span', 'cat', tela.categoria),
        this.criar('p', '', tela.descricao),
        link
      );

      artigo.append(moldura, info);
      lista.appendChild(artigo);

      funcoesAbrir.push(() => this.mostrarTela(tela));
      moldura.addEventListener('click', () => this.irPara(funcoesAbrir, posicao));
      link.addEventListener('click', () => this.irPara(funcoesAbrir, posicao));
    });
  }

  mostrarTela(tela) {
    this.janelaImagem.className = 'pic';
    const imagem = this.criar('img');
    imagem.src = tela.imagem;
    imagem.alt = 'Tela ' + tela.nome + ' do Dispatch';
    this.janelaImagem.replaceChildren(imagem);
    this.preencherJanela(tela.categoria, tela.nome, tela.descricao, [
      ['Módulo', tela.nome],
      ['Imagem', 'Tela real, dados fictícios']
    ]);
  }

  /* ===== seção Planos: cada linha abre a janela com os recursos ===== */

  configurarPlanos() {
    const cartoes = Array.from(document.querySelectorAll('.plano'));
    const funcoesAbrir = cartoes.map((cartao) => () => this.mostrarPlano(this.planos[cartao.dataset.plano]));
    cartoes.forEach((cartao, posicao) => {
      cartao.querySelector('button').addEventListener('click', () => this.irPara(funcoesAbrir, posicao));
    });
  }

  // Equipe: um grupo de rostos redondos. O da frente é o integrante atual; os outros ficam desfocados atrás.
  configurarEquipe() {
    const rostos = Array.from(document.querySelectorAll('.rosto'));
    const nome = document.getElementById('rosto-nome');
    const posicao = document.getElementById('rosto-pos');
    if (!rostos.length) return;
    let atual = 0;
    const mostrar = (indice) => {
      atual = (indice + rostos.length) % rostos.length;
      rostos.forEach((rosto, i) => {
        const distancia = (i - atual + rostos.length) % rostos.length;
        rosto.dataset.p = distancia < 3 ? String(distancia) : 'fora';
        rosto.tabIndex = distancia === 0 ? 0 : -1;
        rosto.setAttribute('aria-current', distancia === 0 ? 'true' : 'false');
      });
      nome.textContent = rostos[atual].dataset.nome;
      posicao.textContent = 'Integrante ' + (atual + 1) + ' de ' + rostos.length;
    };
    document.getElementById('rosto-prox').addEventListener('click', () => mostrar(atual + 1));
    document.getElementById('rosto-ant').addEventListener('click', () => mostrar(atual - 1));
    rostos.forEach((rosto, i) => rosto.addEventListener('click', () => { if (i !== atual) mostrar(i); }));
    mostrar(0);
  }

  mostrarPlano(plano) {
    this.janelaImagem.className = 'pic off';
    this.janelaImagem.replaceChildren();
    const ficha = plano.recursos.map((recurso) => ['Inclui', recurso]);
    this.preencherJanela(
      plano.categoria,
      plano.nome,
      plano.descricao + ' Proposta conceitual, ainda sem contratação ou condição comercial definida.',
      ficha
    );
  }

  /* ===== janela de detalhes (usada pelas telas e pelos planos) ===== */

  configurarJanela() {
    this.botaoAnterior.addEventListener('click', () => this.irPara(this.listaJanela, this.indiceJanela - 1));
    this.botaoProximo.addEventListener('click', () => this.irPara(this.listaJanela, this.indiceJanela + 1));
    this.janela.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') this.irPara(this.listaJanela, this.indiceJanela - 1);
      if (evento.key === 'ArrowRight') this.irPara(this.listaJanela, this.indiceJanela + 1);
    });
    document.getElementById('janela-fechar').addEventListener('click', () => this.janela.close());
    // clicar no fundo escuro fora da janela também fecha
    this.janela.addEventListener('click', (evento) => {
      if (evento.target === this.janela) this.janela.close();
    });
    // enquanto a janela está aberta a rolagem da página fica parada
    this.janela.addEventListener('close', () => {
      if (this.lenis) this.lenis.start();
    });
  }

  preencherJanela(categoria, nome, descricao, linhasFicha) {
    document.getElementById('janela-cat').textContent = categoria;
    document.getElementById('janela-nome').textContent = nome;
    document.getElementById('janela-desc').textContent = descricao;
    this.janelaFicha.replaceChildren();
    linhasFicha.forEach((linha) => {
      const div = this.criar('div');
      div.append(this.criar('span', '', linha[0]), this.criar('span', '', linha[1]));
      this.janelaFicha.appendChild(div);
    });
    this.abrirJanela();
  }

  abrirJanela() {
    this.janela.scrollTop = 0;
    if (this.janela.open) return;
    if (this.lenis) this.lenis.stop();
    this.janela.showModal();
  }

  // Abre o item "indice" da lista e atualiza os botões Anterior/Próximo.
  irPara(lista, indice) {
    if (indice < 0 || indice >= lista.length) return;
    const jaEstavaAberta = this.janela.open;
    this.listaJanela = lista;
    this.indiceJanela = indice;
    lista[indice]();

    // trocando de item com a janela aberta, o conteúdo desliza para o lado do botão clicado
    if (jaEstavaAberta && !this.reduzirMovimento) {
      const deslocamento = indice > this.indiceAnterior ? 24 : -24;
      this.janela.querySelector('.jn').animate(
        [
          { opacity: 0, transform: 'translateX(' + deslocamento + 'px)' },
          { opacity: 1, transform: 'none' }
        ],
        { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
    this.indiceAnterior = indice;
    this.botaoAnterior.disabled = indice <= 0;
    this.botaoProximo.disabled = indice >= lista.length - 1;
    this.textoPosicao.textContent = indice + 1 + ' de ' + lista.length;
  }

  /* ===== menu do celular ===== */

  configurarMenuCelular() {
    this.botaoMenu.addEventListener('click', () => this.abrirMenu(this.gaveta.hidden));
    this.gaveta.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => this.abrirMenu(false));
    });
    window.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape') this.abrirMenu(false);
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) this.abrirMenu(false);
      this.ultimoTopo = null;
    });
  }

  abrirMenu(aberto) {
    this.gaveta.hidden = !aberto;
    this.cabecalho.classList.toggle('aberto', aberto);
    this.botaoMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    this.botaoMenu.textContent = aberto ? 'Fechar' : 'Menu';
  }

  /* ===== animações de entrada ===== */

  // Marca os elementos que vão animar. Cada classe tem a animação dela no CSS:
  // rv = sobe e aparece, wipe = imagem abre como cortina, split = título sobe palavra por palavra.
  prepararAnimacoes() {
    document.documentElement.classList.add('js');
    if (this.reduzirMovimento) return;

    const blocos =
      '.manifesto p, .num, .cabeca .lede, .processo-cabeca .lede, .proj .info > *:not(h3), .plano, .nota, .faixa .label, .sobre p, .pilares > div, .processo div, .time-texto > *, .faq details, .contato .dentro > *:not(h2)';
    const titulos =
      '.manifesto h2, .cabeca h2, .processo-cabeca h2, .proj .info h3, .faixa q, .sobre h2, .contato h2';
    const imagens = '.proj .frame, .sobre-arte, .manifesto .f';

    document.querySelectorAll(blocos).forEach((el) => el.classList.add('rv'));
    document.querySelectorAll(imagens).forEach((el) => el.classList.add('wipe'));
    document.querySelectorAll(titulos).forEach((el) => this.separarPalavras(el));

    // irmãos aparecem um pouco depois do outro (efeito cascata)
    document.querySelectorAll('.rv').forEach((el) => {
      const irmaos = Array.from(el.parentElement.children).filter((c) => c.classList.contains('rv'));
      let atraso = Math.min(irmaos.indexOf(el), 6) * 0.08;
      if (el.closest('.cabeca, .processo-cabeca')) atraso += 0.25;
      el.style.setProperty('--d', atraso.toFixed(2) + 's');
    });

    this.pendentes = Array.from(document.querySelectorAll('.rv, .wipe, .split'));
    // por segurança: se algo der errado, depois de 15 segundos tudo aparece de qualquer jeito
    setTimeout(() => this.revelarTudo(), 15000);
  }

  // Coloca cada palavra do título dentro de dois spans: o de fora esconde, o de dentro sobe.
  separarPalavras(titulo) {
    let contador = 0;
    const percorrer = (no) => {
      Array.from(no.childNodes).forEach((filho) => {
        if (filho.nodeType === Node.TEXT_NODE) {
          const pedacos = document.createDocumentFragment();
          filho.textContent.split(/(\s+)/).forEach((parte) => {
            if (parte === '') return;
            if (parte.trim() === '') {
              pedacos.appendChild(document.createTextNode(parte));
              return;
            }
            const fora = this.criar('span', 'sw');
            const dentro = this.criar('span', '', parte);
            dentro.style.setProperty('--i', contador);
            contador++;
            fora.appendChild(dentro);
            pedacos.appendChild(fora);
          });
          no.replaceChild(pedacos, filho);
        } else if (filho.nodeType === Node.ELEMENT_NODE) {
          percorrer(filho);
        }
      });
    };
    percorrer(titulo);
    titulo.classList.add('split');
  }

  // Mostra o que entrou na tela. Os números da faixa contam de 0 até o valor.
  revelarVisiveis() {
    const alturaTela = window.innerHeight;
    this.pendentes = this.pendentes.filter((el) => {
      const caixa = el.getBoundingClientRect();
      const visivel = caixa.top < alturaTela * 0.88 && caixa.bottom > 0;
      if (!visivel) return true;
      el.classList.add('in');
      if (el.classList.contains('num')) this.contarNumero(el.querySelector('b'));
      return false;
    });
  }

  revelarTudo() {
    this.pendentes.forEach((el) => el.classList.add('in'));
    this.pendentes = [];
  }

  contarNumero(campo) {
    const textoFinal = campo.textContent.trim();
    if (!/^\d+$/.test(textoFinal)) return;
    const valorFinal = parseInt(textoFinal, 10);
    const inicio = performance.now();
    const duracao = 1600;

    const passo = (agora) => {
      const progresso = Math.min(1, (agora - inicio) / duracao);
      // começa rápido e desacelera no final
      const suavizado = 1 - Math.pow(1 - progresso, 3);
      campo.textContent = Math.round(valorFinal * suavizado);
      if (progresso < 1) requestAnimationFrame(passo);
      else campo.textContent = textoFinal;
    };
    requestAnimationFrame(passo);
  }

  /* ===== rolagem ===== */

  // Lenis deixa a rolagem do mouse suave. O arquivo fica em js/vendor porque o site só aceita scripts do próprio domínio.
  configurarRolagemSuave() {
    if (this.reduzirMovimento || !window.Lenis) return;
    try {
      this.lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
    } catch (erro) {
      this.lenis = null;
      return;
    }

    // links do menu (#dispatch, #planos...) descem até a seção com a mesma suavidade
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (evento) => {
        const destino = link.getAttribute('href');
        const alvo = destino === '#topo' ? 0 : document.querySelector(destino);
        if (alvo === null) return;
        evento.preventDefault();
        this.lenis.start();
        this.lenis.scrollTo(alvo, { offset: destino === '#topo' ? 0 : -72, duration: 1.6 });
      });
    });
  }

  // O cabeçalho some quando a pessoa desce a página e volta quando ela sobe.
  esconderCabecalho(y) {
    const menuAberto = this.cabecalho.classList.contains('aberto');
    const passouDoHero = y > window.innerHeight * 0.7;
    if (!menuAberto && passouDoHero && y > this.ultimoY + 6) {
      this.cabecalho.classList.add('esconde');
    } else if (y < this.ultimoY - 6 || menuAberto || !passouDoHero) {
      this.cabecalho.classList.remove('esconde');
    }
    this.ultimoY = y;
  }

  // Imagens marcadas com data-velocidade andam um pouco mais devagar (ou mais rápido) que a página.
  aplicarParallax() {
    const alturaTela = window.innerHeight;
    document.querySelectorAll('[data-velocidade]').forEach((camada) => {
      const caixa = camada.parentElement.getBoundingClientRect();
      if (caixa.bottom < -300 || caixa.top > alturaTela + 300) return;
      const distanciaDoCentro = caixa.top + caixa.height / 2 - alturaTela / 2;
      const deslocamento = distanciaDoCentro * parseFloat(camada.dataset.velocidade) * -1;
      camada.style.transform = 'translateY(' + deslocamento.toFixed(1) + 'px)';
    });
    document.querySelectorAll('.frame img, .sobre-arte img, .manifesto .f img').forEach((imagem) => {
      const caixa = imagem.parentElement.getBoundingClientRect();
      if (caixa.bottom < 0 || caixa.top > alturaTela) return;
      const posicao = (caixa.top + caixa.height / 2 - alturaTela / 2) / alturaTela;
      imagem.style.transform = 'translateY(' + (posicao * -6).toFixed(2) + '%)';
    });
  }

  // Roda sempre que a página rola: barra de progresso, cabeçalho, menu ativo, animações e parallax.
  aoRolar() {
    const y = Math.max(0, -this.hero.getBoundingClientRect().top);
    const maximo = document.documentElement.scrollHeight - window.innerHeight;
    const progresso = maximo > 0 ? Math.min(1, y / maximo) : 0;
    this.barraProgresso.style.transform = 'scaleX(' + progresso.toFixed(4) + ')';
    this.cabecalho.classList.toggle('solido', y > this.hero.offsetHeight - 120);

    // marca no menu a seção que está na tela
    const linha = y + window.innerHeight * 0.4;
    let atual = -1;
    this.secoesMenu.forEach((secao, i) => {
      if (secao && secao.offsetTop <= linha) atual = i;
    });
    this.linksMenu.forEach((link, i) => link.classList.toggle('on', i === atual));

    this.revelarVisiveis();
    this.esconderCabecalho(y);
    if (this.reduzirMovimento) return;

    // na abertura, o texto sobe e some enquanto o fundo desce mais devagar
    const quantoSaiuDoHero = Math.min(1, y / window.innerHeight);
    if (quantoSaiuDoHero < 1) {
      this.fundoHero.style.transform = 'translateY(' + (y * 0.22).toFixed(1) + 'px)';
      this.textoHero.style.opacity = (1 - Math.min(1, quantoSaiuDoHero * 1.6)).toFixed(3);
      this.textoHero.style.transform = 'translateY(' + (-y * 0.18).toFixed(1) + 'px)';
      this.setaHero.style.opacity = (1 - Math.min(1, quantoSaiuDoHero * 3)).toFixed(3);
    }
    this.aplicarParallax();
  }

  /* ===== cursor sobre as telas ===== */

  configurarCursor() {
    if (!this.mouseFino) return;
    window.addEventListener(
      'pointermove',
      (evento) => {
        this.mouseX = evento.clientX;
        this.mouseY = evento.clientY;
        const sobreTela = evento.target.closest && evento.target.closest('.frame');
        this.cursor.classList.toggle('on', Boolean(sobreTela));
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => this.cursor.classList.remove('on'));
  }

  moverCursor() {
    // a cada quadro o cursor anda 18% da distância até o mouse, por isso ele "flutua"
    this.cursorX += (this.mouseX - this.cursorX) * 0.18;
    this.cursorY += (this.mouseY - this.cursorY) * 0.18;
    this.cursor.style.transform =
      'translate(' + this.cursorX.toFixed(1) + 'px, ' + this.cursorY.toFixed(1) + 'px)';
  }

  /* ===== laço de animação: roda a cada quadro da tela ===== */

  iniciarLaco() {
    const quadro = (tempo) => {
      if (this.lenis) this.lenis.raf(tempo);
      // só recalcula a página quando ela realmente rolou
      const topo = this.hero.getBoundingClientRect().top;
      if (topo !== this.ultimoTopo) {
        this.ultimoTopo = topo;
        this.aoRolar();
      }
      if (this.mouseFino) this.moverCursor();
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }
}

new TelaApresentacao();
