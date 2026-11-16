// Roteamento pela History API: /frota, /resumo etc. continuam sendo endereços reais.
//
// Escolhemos caminho em vez de hash (#/frota) porque o hash já tem dono: Configurações usa
// #auditoria, #usuarios para abrir abas, e links antigos com esses hashes continuam valendo.
// O servidor devolve a casca (app.html) para qualquer uma dessas rotas, então recarregar a
// página ou colar o link numa conversa abre a tela certa.
export class Roteador {
  /**
   * @param {string[]} rotas telas conhecidas
   * @param {string} padrao tela aberta quando a URL não aponta para nenhuma
   * @param {(rota: string, origem: 'inicio'|'link'|'historico') => Promise<boolean>} aoMudar
   *   devolve false quando a tela atual recusou a saída (alterações não salvas)
   */
  constructor(rotas, padrao, aoMudar) {
    this.rotas = new Set(rotas);
    this.padrao = padrao;
    this.aoMudar = aoMudar;
    this.rotaAtual = null;

    window.addEventListener('popstate', () => this.aoVoltar());
    document.addEventListener('click', (evento) => this.aoClicar(evento));
  }

  rotaDe(url) {
    const nome = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
    return this.rotas.has(nome) ? nome : null;
  }

  atual() {
    return this.rotaDe(window.location) || this.padrao;
  }

  async iniciar() {
    const rota = this.atual();
    // Corrige endereços como /app para a rota real, sem criar entrada nova no histórico.
    if (this.rotaDe(window.location) !== rota) {
      history.replaceState(null, '', '/' + rota + window.location.search + window.location.hash);
    }
    this.rotaAtual = rota;
    await this.aoMudar(rota, 'inicio');
  }

  async ir(rota, hash) {
    if (!this.rotas.has(rota)) return;
    const destino = '/' + rota + (hash || '');
    const anterior = this.rotaAtual;
    if (rota === anterior) {
      if (hash !== undefined && window.location.hash !== hash) history.pushState(null, '', destino);
      return;
    }
    const aceitou = await this.aoMudar(rota, 'link');
    if (!aceitou) return;
    history.pushState(null, '', destino);
    this.rotaAtual = rota;
  }

  async aoVoltar() {
    const rota = this.atual();
    if (rota === this.rotaAtual) return;
    const aceitou = await this.aoMudar(rota, 'historico');
    if (!aceitou) {
      // A tela recusou sair: devolve a URL para onde a pessoa estava.
      history.pushState(null, '', '/' + this.rotaAtual);
      return;
    }
    this.rotaAtual = rota;
  }

  aoClicar(evento) {
    if (evento.defaultPrevented || evento.button !== 0) return;
    if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
    const link = evento.target.closest && evento.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const rota = this.rotaDe(url);
    if (!rota) return;

    evento.preventDefault();
    this.ir(rota, url.hash || undefined);
  }
}
