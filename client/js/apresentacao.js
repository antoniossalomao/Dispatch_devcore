// Apresentação do DevCore. Mesmo sistema de movimento do site do Ricardo Salomão:
// rolagem suave (Lenis, servido localmente em js/vendor), títulos que sobem palavra por palavra,
// blocos que aparecem ao entrar na tela, imagens que se abrem com uma cortina, parallax leve,
// números que contam, cabeçalho que some ao descer e uma janela de detalhes para telas e planos.
// Com "reduzir movimento" no sistema, tudo aparece no lugar, sem animação.
(function () {
  'use strict';

  var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var TELAS = [
    {
      nome: 'Visão geral',
      cat: 'Resumo operacional',
      img: 'assets/apresentacao/tela-resumo.jpg',
      desc: 'Veículos em uso, vagas livres e as últimas movimentações do dia, com a ocupação de cada alojamento ao lado.'
    },
    {
      nome: 'Colaboradores',
      cat: 'Pessoas e habilitações',
      img: 'assets/apresentacao/tela-colaboradores.jpg',
      desc: 'Equipe, CNH com prazo de vencimento e onde cada pessoa está alocada, com histórico de cada colaborador.'
    },
    {
      nome: 'Frota',
      cat: 'Saídas, voltas e manutenções',
      img: 'assets/apresentacao/tela-frota.jpg',
      desc: 'Quem está com cada veículo, quilometragem e documentos. Licenciamento vencido bloqueia a saída.'
    },
    {
      nome: 'Relatórios',
      cat: 'Ocupação e uso da frota',
      img: 'assets/apresentacao/tela-relatorios.jpg',
      desc: 'Ocupação média por alojamento, uso da frota, gargalos e quem estava dirigindo em cada período.'
    }
  ];

  var PLANOS = {
    essencial: {
      nome: 'Essencial',
      cat: 'O primeiro passo',
      desc: 'Um ponto de partida para organizar os principais registros da operação.',
      recursos: ['Cadastro de colaboradores', 'Alojamentos, quartos, leitos e estadias', 'Frota e movimentações', 'Resumo operacional']
    },
    profissional: {
      nome: 'Profissional',
      cat: 'Mais profundidade',
      desc: 'Uma proposta para ampliar a análise e a rastreabilidade da operação.',
      recursos: ['Escopo do Essencial', 'Relatórios de ocupação e frota', 'Histórico e auditoria com hashes encadeados', 'Central de notificações']
    },
    'sob-medida': {
      nome: 'Sob medida',
      cat: 'Seu contexto no centro',
      desc: 'Um convite para mapear necessidades e avaliar possibilidades. Novos recursos e integrações dependem de análise de viabilidade.',
      recursos: ['Levantamento de necessidades', 'Definição conjunta de escopo', 'Análise de integrações', 'Planejamento de implantação']
    }
  };

  var hero = $('#topo'), t1 = $('#t1'), t3 = $('#t3'), fundoHero = $('#hero-fundo');
  var hdr = $('#cabecalho'), barra = $('#progresso');
  var janela = $('#janela'), pic = $('#janela-pic'), ficha = $('#janela-ficha');
  var ant = $('#janela-ant'), prox = $('#janela-prox'), pos = $('#janela-pos');

  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto) e.textContent = texto;
    return e;
  }

  /* ===== janela de detalhes ===== */
  var sequencia = [], indice = 0, indiceAnterior = 0;
  function mostrar() {
    janela.scrollTop = 0;
    if (janela.open) return;
    if (window._lenis) window._lenis.stop();
    janela.showModal();
  }
  function ir(lista, i) {
    if (i < 0 || i >= lista.length) return;
    var estava = janela.open;
    sequencia = lista; indice = i; lista[i]();
    if (estava && !reduzir) {
      $('.jn', janela).animate(
        [{ opacity: 0, transform: 'translate3d(' + (i > indiceAnterior ? 24 : -24) + 'px,0,0)' }, { opacity: 1, transform: 'none' }],
        { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' }
      );
    }
    indiceAnterior = i;
    ant.disabled = i <= 0; prox.disabled = i >= lista.length - 1;
    pos.textContent = (i + 1) + ' de ' + lista.length;
  }
  function preencherFicha(linhas) {
    ficha.replaceChildren();
    linhas.forEach(function (l) {
      var d = el('div'); d.append(el('span', '', l[0]), el('span', '', l[1])); ficha.appendChild(d);
    });
  }
  ant.addEventListener('click', function () { ir(sequencia, indice - 1); });
  prox.addEventListener('click', function () { ir(sequencia, indice + 1); });
  janela.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') ir(sequencia, indice - 1);
    if (e.key === 'ArrowRight') ir(sequencia, indice + 1);
  });
  $('#janela-fechar').addEventListener('click', function () { janela.close(); });
  janela.addEventListener('click', function (e) { if (e.target === janela) janela.close(); });
  janela.addEventListener('close', function () { if (window._lenis) window._lenis.start(); });

  /* telas do Dispatch em linhas editoriais */
  var lista = $('#lista-telas'), aberturasTelas = [];
  TELAS.forEach(function (t, k) {
    var art = el('article', 'proj');
    var frame = el('button', 'frame'); frame.type = 'button'; frame.setAttribute('aria-label', 'Ver ' + t.nome);
    var im = el('img'); im.src = t.img; im.alt = 'Tela ' + t.nome + ' do Dispatch'; im.loading = 'lazy'; im.decoding = 'async';
    frame.appendChild(im);
    var info = el('div', 'info');
    var link = el('button', 'link', 'Ver a tela '); link.type = 'button';
    link.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M0 5h17M12 1l5 4-5 4"/></svg>');
    info.append(el('span', 'idx', '0' + (k + 1)), el('h3', '', t.nome), el('span', 'cat', t.cat), el('p', '', t.desc), link);
    art.append(frame, info);
    function abrir() {
      pic.className = 'pic';
      var g = el('img'); g.src = t.img; g.alt = 'Tela ' + t.nome + ' do Dispatch';
      pic.replaceChildren(g);
      $('#janela-cat').textContent = t.cat;
      $('#janela-nome').textContent = t.nome;
      $('#janela-desc').textContent = t.desc;
      preencherFicha([['Módulo', t.nome], ['Imagem', 'Tela real, dados fictícios']]);
      mostrar();
    }
    aberturasTelas.push(abrir);
    var abrirAqui = function () { ir(aberturasTelas, k); };
    frame.addEventListener('click', abrirAqui);
    link.addEventListener('click', abrirAqui);
    lista.appendChild(art);
  });

  /* planos */
  var linhasPlano = $$('.ix');
  var aberturasPlanos = linhasPlano.map(function (linha) {
    var p = PLANOS[linha.dataset.plano];
    return function () {
      pic.className = 'pic off'; pic.replaceChildren();
      $('#janela-cat').textContent = p.cat;
      $('#janela-nome').textContent = p.nome;
      $('#janela-desc').textContent = p.desc + ' Proposta conceitual, ainda sem contratação ou condição comercial definida.';
      preencherFicha(p.recursos.map(function (r, i) { return ['0' + (i + 1), r]; }));
      mostrar();
    };
  });
  linhasPlano.forEach(function (linha, i) {
    var abrir = function () { ir(aberturasPlanos, i); };
    linha.addEventListener('click', abrir);
    linha.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });
  });

  $('#ano').textContent = new Date().getFullYear();

  /* menu do celular */
  var botaoMenu = $('#menu'), gaveta = $('#gaveta');
  function menu(aberto) {
    gaveta.hidden = !aberto;
    hdr.classList.toggle('aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    botaoMenu.textContent = aberto ? 'Fechar' : 'Menu';
  }
  botaoMenu.addEventListener('click', function () { menu(gaveta.hidden); });
  $$('a', gaveta).forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) menu(false); });

  /* ===== animações de entrada ===== */
  document.documentElement.classList.add('js');
  var seletorBloco = '.manifesto p,.num,.cabeca .lede,.processo-cabeca .lede,.proj .info>*:not(h3),.ix-h,.ix,.nota,.faixa .label,.sobre p,.pilares>div,.processo div,.integrantes li,.faq details,.contato .dentro>*:not(h2)';
  var seletorTitulo = '.manifesto h2,.cabeca h2,.processo-cabeca h2,.proj .info h3,.faixa q,.sobre h2,.contato h2';
  var seletorCortina = '.proj .frame,.sobre-arte,.manifesto .f';

  if (!reduzir) {
    $$(seletorBloco).forEach(function (e) { e.classList.add('rv'); });
    $$(seletorCortina).forEach(function (e) { e.classList.add('wipe'); });
    $$(seletorTitulo).forEach(dividirPalavras);
    $$('.rv').forEach(function (e) {
      var irmaos = Array.prototype.filter.call(e.parentElement.children, function (c) { return c.classList.contains('rv'); });
      var atraso = Math.min(irmaos.indexOf(e), 6) * 0.08 + (e.closest('.cabeca,.processo-cabeca') ? 0.25 : 0);
      e.style.setProperty('--d', atraso.toFixed(2) + 's');
    });
  }

  // Quebra o título em palavras, cada uma numa "janela" que a esconde até subir.
  function dividirPalavras(alvo) {
    var i = 0;
    (function andar(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var fora = el('span', 'sw'), dentro = el('span', '', w);
            dentro.style.setProperty('--i', i++);
            fora.appendChild(dentro); frag.appendChild(fora);
          });
          no.replaceChild(frag, c);
        } else if (c.nodeType === 1) {
          andar(c);
        }
      });
    })(alvo);
    alvo.classList.add('split');
  }

  function formatar(v) { return Math.round(v).toLocaleString('pt-BR'); }
  function contar(b) {
    var texto = b.textContent.trim();
    if (!/^\d+$/.test(texto) || reduzir) return;
    var alvo = parseInt(texto, 10), t0 = performance.now();
    (function passo(agora) {
      var k = Math.min(1, (agora - t0) / 1600), v = alvo * (1 - Math.pow(1 - k, 3));
      b.textContent = formatar(v);
      if (k < 1) requestAnimationFrame(passo); else b.textContent = texto;
    })(t0);
  }

  var pendentes = $$('.rv,.wipe,.split');
  function revelar() {
    var vh = window.innerHeight;
    pendentes = pendentes.filter(function (e) {
      var r = e.getBoundingClientRect();
      if (r.top < vh * 0.88 && r.bottom > 0) {
        e.classList.add('in');
        if (e.classList.contains('num')) contar($('b', e));
        return false;
      }
      return true;
    });
  }
  // Rede de segurança: nada fica escondido para sempre se algo falhar.
  setTimeout(function () { pendentes.forEach(function (e) { e.classList.add('in'); }); pendentes = []; }, 15000);

  var ultimoY = 0;
  function esconderCabecalho(y) {
    var aberto = hdr.classList.contains('aberto');
    if (!aberto && y > window.innerHeight * 0.7 && y > ultimoY + 6) hdr.classList.add('esconde');
    else if (y < ultimoY - 6 || aberto || y < window.innerHeight * 0.7) hdr.classList.remove('esconde');
    ultimoY = y;
  }

  var links = $$('nav a.l');
  var secoes = links.map(function (a) { return $(a.getAttribute('href')); });
  var camadas = $$('[data-velocidade]');
  var imagensParallax = $$('.frame img,.sobre-arte img,.manifesto .f img');

  function parallax() {
    var vh = window.innerHeight;
    camadas.forEach(function (c) {
      var p = c.parentElement.getBoundingClientRect();
      if (p.bottom < -300 || p.top > vh + 300) return;
      var d = p.top + p.height / 2 - vh / 2;
      c.style.transform = 'translate3d(0,' + (d * parseFloat(c.dataset.velocidade) * -1).toFixed(1) + 'px,0)';
    });
    imagensParallax.forEach(function (im) {
      var r = im.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var t = (r.top + r.height / 2 - vh / 2) / vh;
      im.style.transform = 'translate3d(0,' + (t * -6).toFixed(2) + '%,0)';
    });
  }

  function atualizar() {
    var y = Math.max(0, -hero.getBoundingClientRect().top);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')';
    hdr.classList.toggle('solido', y > hero.offsetHeight - 120);
    var linha = y + window.innerHeight * 0.4, atual = -1;
    secoes.forEach(function (s, i) { if (s && s.offsetTop <= linha) atual = i; });
    links.forEach(function (a, i) { a.classList.toggle('on', i === atual); });
    revelar();
    esconderCabecalho(y);
    if (!reduzir) {
      var hp = Math.max(0, Math.min(1, y / window.innerHeight));
      if (hp < 1) {
        fundoHero.style.transform = 'translate3d(0,' + (y * 0.22).toFixed(1) + 'px,0)';
        t1.style.opacity = (1 - Math.min(1, hp * 1.6)).toFixed(3);
        t1.style.transform = 'translate3d(0,' + (-y * 0.18).toFixed(1) + 'px,0)';
        t3.style.opacity = (1 - Math.min(1, hp * 3)).toFixed(3);
      }
      parallax();
    }
  }

  /* rolagem suave */
  if (!reduzir && window.Lenis) {
    try {
      var lenis = window._lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true });
      $$('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          var id = a.getAttribute('href');
          var alvo = id === '#topo' ? 0 : $(id);
          if (alvo === null) return;
          e.preventDefault();
          lenis.start();
          lenis.scrollTo(alvo, { offset: id === '#topo' ? 0 : -72, duration: 1.6 });
        });
      });
    } catch (erro) {
      window._lenis = null;
    }
  }

  /* cursor "Ver" que segue o mouse sobre as telas */
  var cursor = $('#cursor'), cx = -200, cy = -200, tx = -200, ty = -200;
  var fino = window.matchMedia('(pointer: fine)').matches && !reduzir;
  if (fino) {
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      var sobre = e.target.closest && e.target.closest('.frame');
      cursor.classList.toggle('on', !!sobre);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cursor.classList.remove('on'); });
  }

  var ultimoTopo = null;
  window.addEventListener('resize', function () { ultimoTopo = null; });
  (function laco(t) {
    if (window._lenis) window._lenis.raf(t);
    var topo = hero.getBoundingClientRect().top;
    if (topo !== ultimoTopo) { ultimoTopo = topo; atualizar(); }
    if (fino) {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
    }
    requestAnimationFrame(laco);
  })(performance.now());
})();
