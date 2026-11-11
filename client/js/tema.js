// Controla a preferência de tema.
class Tema {
  constructor() {
    this.chave = 'dispatch-tema';
    this.aplicar(this.temaAtual());
    document.addEventListener('DOMContentLoaded', this.criarBotao.bind(this));
  }

  criarBotao() {
    const desenhar = () => {
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
      botao.innerHTML = escuro ? SOL : LUA;
      botao.title = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
      botao.setAttribute('aria-label', botao.title);
    };
    const perfil = document.querySelector('.topo-perfil');
    if (!perfil) return;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao-tema';
    const SOL =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const LUA =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    botao.addEventListener('click', () => {
      const novo =
        document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
      this.aplicar(novo);
      try {
        localStorage.setItem(this.chave, novo);
      } catch (e) {}
      desenhar();
    });
    desenhar();
    const sair = document.getElementById('botao-sair');
    perfil.insertBefore(botao, sair || null);
  }

  lerSalvo() {
    try {
      return localStorage.getItem(this.chave);
    } catch (e) {
      return null;
    }
  }

  temaAtual() {
    const salvo = this.lerSalvo();
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
    return 'escuro';
  }

  aplicar(tema) {
    document.documentElement.setAttribute('data-tema', tema);
  }
}
new Tema();
