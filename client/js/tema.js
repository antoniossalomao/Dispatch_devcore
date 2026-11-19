// Salva a escolha entre tema claro/escuro no navegador e coloca o botão de sol/lua no topo.
class Tema {
  constructor() {
    this.chave = 'dispatch-tema';
    this.aplicar(this.temaAtual());
    document.addEventListener('DOMContentLoaded', this.criarBotao.bind(this));
  }

  criarBotao() {
    const perfil = document.querySelector('.topo-perfil');
    if (!perfil) return;

    const iconeSol =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const iconeLua =
      '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao-tema';

    const atualizarIcone = () => {
      const escuro = document.documentElement.getAttribute('data-tema') === 'escuro';
      botao.innerHTML = escuro ? iconeSol : iconeLua;
      botao.title = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
      botao.setAttribute('aria-label', botao.title);
    };

    botao.addEventListener('click', () => {
      const novoTema =
        document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
      this.aplicar(novoTema);
      try {
        localStorage.setItem(this.chave, novoTema);
      } catch (erro) {
        // Ignora erro caso o navegador bloqueie o localStorage (ex.: aba anônima restrita).
      }
      atualizarIcone();
    });

    atualizarIcone();
    const botaoSair = document.getElementById('botao-sair');
    perfil.insertBefore(botao, botaoSair || null);
  }

  lerSalvo() {
    try {
      return localStorage.getItem(this.chave);
    } catch (erro) {
      return null;
    }
  }

  temaAtual() {
    const salvo = this.lerSalvo();
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
    return 'escuro';
  }

  aplicar(tema) {
    // O CSS troca as cores da página olhando este atributo data-tema no <html>.
    document.documentElement.setAttribute('data-tema', tema);
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = tema === 'escuro' ? '#111315' : '#f4f5f6';
  }
}

new Tema();
