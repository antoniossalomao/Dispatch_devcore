// Controla as notificações e a ajuda.
class RecursosCompartilhados {
  constructor() {
    if (typeof chamarApi !== 'function') return;
    this.link = document.createElement('link');
    this.link.rel = 'stylesheet';
    this.link.href = 'css/extras.css';
    document.head.appendChild(this.link);
    this.barraTopo = document.querySelector('.topo-direita');
    if (this.barraTopo) {
      const posicionarPainel = () => {
        if (window.innerWidth <= 780) {
          const topo = Math.max(
            16,
            Math.min(botao.getBoundingClientRect().bottom + 8, window.innerHeight - 176)
          );
          painel.style.top = topo + 'px';
          painel.style.maxHeight = 'calc(100dvh - ' + (topo + 16) + 'px)';
        } else {
          painel.style.removeProperty('top');
          painel.style.removeProperty('max-height');
        }
      };
      const fecharPainel = () => {
        painel.hidden = true;
        botao.setAttribute('aria-expanded', 'false');
      };
      const mostrarErro = (texto) => {
        lista.innerHTML = '<p class="sino-vazio" role="alert">' + this.esc(texto) + '</p>';
      };
      const carregarAvisos = async () => {
        const pedido = ++pedidoAtual;
        try {
          const r = await chamarApi('/api/notificacoes');
          if (pedido !== pedidoAtual) return;
          if (!r.ok) throw new Error(r.dados.erro || 'Não foi possível carregar as notificações');
          const total = r.dados.nao_lidas;
          contador.textContent = total > 99 ? '99+' : total;
          contador.hidden = total === 0;
          botao.setAttribute(
            'aria-label',
            total ? 'Notificações: ' + total + ' não lidas' : 'Notificações: nenhuma pendente'
          );
          marcarTodas.disabled = total === 0;
          lista.innerHTML = '';
          if (r.dados.notificacoes.length === 0) {
            lista.innerHTML =
              '<p class="sino-vazio" role="status">Nenhuma pendência operacional aberta</p>';
            return;
          }
          r.dados.notificacoes.forEach((n) => {
            const critico = n.severidade === 'critico';
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'sino-item ' + (critico ? 'sino-critico' : 'sino-atencao');
            item.innerHTML =
              '<span class="sino-nivel">' +
              (critico ? 'Crítico' : 'Atenção') +
              '</span>' +
              '<span>' +
              this.esc(n.mensagem) +
              '</span><small>' +
              this.esc(n.criada_em.slice(0, 16)) +
              ' · Marcar como lida</small>';
            item.title = 'Marcar como lida';
            item.addEventListener('click', () => {
              marcarLidas('/api/notificacoes/' + n.id + '/lida');
            });
            lista.appendChild(item);
          });
        } catch (erro) {
          if (pedido === pedidoAtual)
            mostrarErro(
              erro instanceof TypeError
                ? 'Não foi possível carregar as notificações. Abra o sino para tentar novamente.'
                : erro.message
            );
        }
      };
      const marcarLidas = async (caminho) => {
        try {
          const r = await chamarApi(caminho, {
            metodo: 'PUT'
          });
          if (!r.ok)
            throw new Error(r.dados.erro || 'Não foi possível marcar as notificações como lidas');
          await carregarAvisos();
          if (!painel.hidden) (lista.querySelector('.sino-item') || botao).focus();
        } catch (erro) {
          mostrarErro(
            erro instanceof TypeError
              ? 'Não foi possível atualizar as notificações. Tente novamente.'
              : erro.message
          );
        }
      };
      const caixa = document.createElement('div');
      caixa.className = 'sino-caixa';
      caixa.innerHTML =
        '<button type="button" id="botao-notificacoes" class="botao-notif" title="Notificações" aria-label="Ver notificações" aria-expanded="false" aria-controls="painel-notificacoes">' +
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>' +
        '<span class="sino-contador" aria-hidden="true" hidden>0</span></button>' +
        '<section id="painel-notificacoes" class="sino-painel" aria-labelledby="titulo-notificacoes" hidden>' +
        '<div class="sino-topo"><strong id="titulo-notificacoes">Atenção operacional</strong><button type="button" class="sino-todas" disabled>Marcar todas como lidas</button></div>' +
        '<div class="sino-lista"><p class="sino-vazio" role="status">Carregando notificações</p></div></section>';
      this.barraTopo.insertBefore(caixa, this.barraTopo.querySelector('.topo-perfil'));
      const botao = caixa.querySelector('.botao-notif');
      const contador = caixa.querySelector('.sino-contador');
      const painel = caixa.querySelector('.sino-painel');
      const lista = caixa.querySelector('.sino-lista');
      const marcarTodas = caixa.querySelector('.sino-todas');
      let pedidoAtual = 0;
      botao.addEventListener('click', () => {
        if (!painel.hidden) {
          fecharPainel();
          return;
        }
        posicionarPainel();
        painel.hidden = false;
        botao.setAttribute('aria-expanded', 'true');
        carregarAvisos();
      });
      document.addEventListener('click', (e) => {
        if (!caixa.contains(e.target)) fecharPainel();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !painel.hidden) {
          e.preventDefault();
          fecharPainel();
          botao.focus();
        }
      });
      window.addEventListener('resize', () => {
        if (!painel.hidden) posicionarPainel();
      });
      marcarTodas.addEventListener('click', () => {
        marcarLidas('/api/notificacoes/lidas');
      });
      carregarAvisos();
      setInterval(carregarAvisos, 60000);
    }
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
    this.chat.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = this.entrada.value.trim();
      if (texto === '') return;
      this.entrada.value = '';
      this.adicionar(texto, 'chat-eu');
      const aguarde = this.adicionar('Pensando...', 'chat-bot');
      const r = await chamarApi('/api/ia/suporte', {
        metodo: 'POST',
        corpo: {
          mensagem: texto
        }
      });
      aguarde.textContent = r.ok
        ? r.dados.resposta
        : r.dados.erro || 'Não consegui responder agora.';
      if (!r.ok) aguarde.classList.add('chat-erro');
    });
  }

  esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  adicionar(texto, classe) {
    const d = document.createElement('div');
    d.className = 'chat-msg ' + classe;
    d.textContent = texto;
    this.msgs.appendChild(d);
    this.msgs.scrollTop = this.msgs.scrollHeight;
    return d;
  }
}
new RecursosCompartilhados();
