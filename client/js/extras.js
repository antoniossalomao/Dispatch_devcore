// Coloca o sino de pendências no cabeçalho e o botão flutuante de ajuda com IA em todas as telas logadas.
class RecursosCompartilhados {
  constructor() {
    if (typeof chamarApi !== 'function') return;

    this.linkCss = document.createElement('link');
    this.linkCss.rel = 'stylesheet';
    this.linkCss.href = 'css/extras.css';
    document.head.appendChild(this.linkCss);

    this.barraTopo = document.querySelector('.topo-direita');
    this.pedidoAtual = 0;

    if (this.barraTopo) {
      this.montarSinoNotificacoes();
    }
    this.montarChatAjuda();
  }

  montarSinoNotificacoes() {
    this.caixaNotif = document.createElement('div');
    this.caixaNotif.className = 'sino-caixa';
    this.caixaNotif.innerHTML =
      '<button type="button" id="botao-notificacoes" class="botao-notif" title="Notificações" aria-label="Ver notificações" aria-expanded="false" aria-controls="painel-notificacoes">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
      '<span class="sino-contador" aria-hidden="true" hidden>0</span></button>' +
      '<section id="painel-notificacoes" class="sino-painel" aria-labelledby="titulo-notificacoes" hidden>' +
      '<div class="sino-topo"><strong id="titulo-notificacoes">Atenção operacional</strong><button type="button" class="sino-todas" disabled>Marcar todas como lidas</button></div>' +
      '<div class="sino-lista"><p class="sino-vazio" role="status">Carregando notificações</p></div></section>';

    this.barraTopo.insertBefore(this.caixaNotif, this.barraTopo.querySelector('.topo-perfil'));

    this.botaoNotif = this.caixaNotif.querySelector('.botao-notif');
    this.contadorNotif = this.caixaNotif.querySelector('.sino-contador');
    this.painelNotif = this.caixaNotif.querySelector('.sino-painel');
    this.listaNotif = this.caixaNotif.querySelector('.sino-lista');
    this.botaoMarcarTodas = this.caixaNotif.querySelector('.sino-todas');

    this.botaoNotif.addEventListener('click', () => {
      if (!this.painelNotif.hidden) {
        this.fecharPainelNotif();
        return;
      }
      this.posicionarPainelNotif();
      this.painelNotif.hidden = false;
      this.botaoNotif.setAttribute('aria-expanded', 'true');
      this.carregarAvisos();
    });

    document.addEventListener('click', (evento) => {
      if (!this.caixaNotif.contains(evento.target)) this.fecharPainelNotif();
    });

    document.addEventListener('keydown', (evento) => {
      if (evento.key === 'Escape' && !this.painelNotif.hidden) {
        evento.preventDefault();
        this.fecharPainelNotif();
        this.botaoNotif.focus();
      }
    });

    window.addEventListener('resize', () => {
      if (!this.painelNotif.hidden) this.posicionarPainelNotif();
    });

    this.botaoMarcarTodas.addEventListener('click', () => {
      this.marcarLidas('/api/notificacoes/lidas');
    });

    this.carregarAvisos();
    // Atualiza a contagem de pendências a cada 1 minuto em segundo plano.
    setInterval(this.carregarAvisos.bind(this), 60000);
  }

  posicionarPainelNotif() {
    if (window.innerWidth <= 780) {
      const topo = Math.max(
        16,
        Math.min(this.botaoNotif.getBoundingClientRect().bottom + 8, window.innerHeight - 176)
      );
      this.painelNotif.style.top = topo + 'px';
      this.painelNotif.style.maxHeight = 'calc(100dvh - ' + (topo + 16) + 'px)';
    } else {
      this.painelNotif.style.removeProperty('top');
      this.painelNotif.style.removeProperty('max-height');
    }
  }

  fecharPainelNotif() {
    this.painelNotif.hidden = true;
    this.botaoNotif.setAttribute('aria-expanded', 'false');
  }

  mostrarErroNotificacoes(texto) {
    const aviso = document.createElement('p');
    aviso.className = 'sino-vazio';
    aviso.setAttribute('role', 'alert');
    aviso.textContent = texto;
    this.listaNotif.replaceChildren(aviso);
  }

  async carregarAvisos() {
    const pedido = ++this.pedidoAtual;
    try {
      const resposta = await chamarApi('/api/notificacoes');
      // Descarta respostas antigas se o usuário tiver clicado de novo antes da anterior voltar.
      if (pedido !== this.pedidoAtual) return;
      if (!resposta.ok) {
        throw new Error(resposta.dados.erro || 'Não foi possível carregar as notificações');
      }

      const total = resposta.dados.nao_lidas;
      this.contadorNotif.textContent = total > 99 ? '99+' : total;
      this.contadorNotif.hidden = total === 0;
      this.botaoNotif.setAttribute(
        'aria-label',
        total ? 'Notificações: ' + total + ' não lidas' : 'Notificações: nenhuma pendente'
      );
      this.botaoMarcarTodas.disabled = total === 0;

      this.listaNotif.innerHTML = '';
      if (resposta.dados.notificacoes.length === 0) {
        const vazio = document.createElement('p');
        vazio.className = 'sino-vazio';
        vazio.setAttribute('role', 'status');
        vazio.textContent = 'Nenhuma pendência operacional aberta';
        this.listaNotif.appendChild(vazio);
        return;
      }

      resposta.dados.notificacoes.forEach((aviso) => {
        const critico = aviso.severidade === 'critico';
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sino-item ' + (critico ? 'sino-critico' : 'sino-atencao');

        // Monta os elementos com textContent para evitar que qualquer texto do banco vire HTML.
        const nivel = document.createElement('span');
        nivel.className = 'sino-nivel';
        nivel.textContent = critico ? 'Crítico' : 'Atenção';

        const texto = document.createElement('span');
        texto.textContent = aviso.mensagem || '';

        const rodape = document.createElement('small');
        rodape.textContent = (aviso.criada_em || '').slice(0, 16) + ' · Marcar como lida';

        item.appendChild(nivel);
        item.appendChild(texto);
        item.appendChild(rodape);
        item.title = 'Marcar como lida';
        item.addEventListener('click', () => {
          this.marcarLidas('/api/notificacoes/' + aviso.id + '/lida');
        });
        this.listaNotif.appendChild(item);
      });
    } catch (erro) {
      if (pedido === this.pedidoAtual) {
        this.mostrarErroNotificacoes(
          erro instanceof TypeError
            ? 'Não foi possível carregar as notificações. Abra o sino para tentar novamente.'
            : erro.message
        );
      }
    }
  }

  async marcarLidas(caminho) {
    try {
      const resposta = await chamarApi(caminho, { metodo: 'PUT' });
      if (!resposta.ok) {
        throw new Error(resposta.dados.erro || 'Não foi possível marcar as notificações como lidas');
      }
      await this.carregarAvisos();
      if (!this.painelNotif.hidden) {
        (this.listaNotif.querySelector('.sino-item') || this.botaoNotif).focus();
      }
    } catch (erro) {
      this.mostrarErroNotificacoes(
        erro instanceof TypeError
          ? 'Não foi possível atualizar as notificações. Tente novamente.'
          : erro.message
      );
    }
  }

  montarChatAjuda() {
    this.chat = document.createElement('div');
    this.chat.className = 'chat-caixa';
    this.chat.innerHTML =
      '<div class="chat-painel" hidden>' +
      '<div class="chat-topo"><strong>Ajuda do Dispatch</strong><button type="button" class="chat-fechar" aria-label="Fechar ajuda">&times;</button></div>' +
      '<div class="chat-msgs"><div class="chat-msg chat-bot">Tire dúvidas sobre cadastros, alojamentos e frota. Por exemplo: como registrar a saída de um veículo?</div></div>' +
      '<form class="chat-form"><input type="text" maxlength="500" aria-label="Sua dúvida" placeholder="Sua dúvida" required><button type="submit">Enviar</button></form>' +
      '</div>' +
      '<button type="button" class="chat-botao" title="Ajuda" aria-label="Abrir ajuda">?</button>';
    document.body.appendChild(this.chat);

    this.painelChat = this.chat.querySelector('.chat-painel');
    this.msgs = this.chat.querySelector('.chat-msgs');
    this.entrada = this.chat.querySelector('input');

    this.chat.querySelector('.chat-botao').addEventListener('click', () => {
      this.painelChat.hidden = !this.painelChat.hidden;
      if (!this.painelChat.hidden) this.entrada.focus();
    });

    this.chat.querySelector('.chat-fechar').addEventListener('click', () => {
      this.painelChat.hidden = true;
    });

    this.chat.querySelector('form').addEventListener('submit', this.enviarPerguntaChat.bind(this));
  }

  async enviarPerguntaChat(evento) {
    evento.preventDefault();
    const texto = this.entrada.value.trim();
    if (texto === '') return;

    this.entrada.value = '';
    this.adicionarMensagem(texto, 'chat-eu');
    const aguarde = this.adicionarMensagem('Pensando...', 'chat-bot');

    const resposta = await chamarApi('/api/ia/suporte', {
      metodo: 'POST',
      corpo: { mensagem: texto }
    });

    aguarde.textContent = resposta.ok
      ? resposta.dados.resposta
      : resposta.dados.erro || 'Não consegui responder agora.';
    if (!resposta.ok) aguarde.classList.add('chat-erro');
  }

  adicionarMensagem(texto, classe) {
    const balao = document.createElement('div');
    balao.className = 'chat-msg ' + classe;
    balao.textContent = texto;
    this.msgs.appendChild(balao);
    this.msgs.scrollTop = this.msgs.scrollHeight;
    return balao;
  }
}

new RecursosCompartilhados();
