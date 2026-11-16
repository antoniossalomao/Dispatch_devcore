// Roteador: troca de tela sem recarregar e mantendo o endereço certo na barra (/frota, /resumo...).
//
// Usamos o caminho (/frota) e não #/frota porque o # já é usado em Configurações para abrir as abas
// (#auditoria, #usuarios). O servidor devolve o app.html para todas essas rotas, então dá para
// recarregar a página ou mandar o link para alguém que abre na tela certa.
export class Roteador {
  // rotas: nomes das telas | padrao: tela que abre quando o endereço não é de nenhuma
  // aoMudar: função chamada ao trocar de tela; devolve false se a tela atual não deixou sair
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
