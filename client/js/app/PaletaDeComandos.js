// Paleta de comandos (Ctrl+K): um campo de busca que leva para qualquer tela, ação, pessoa ou veículo.
// Igual à do Gestor de Atualizações: dá para digitar só algumas letras ("nv vei" acha "Novo veículo")
// e o que foi usado por último aparece primeiro. Telas e ações aparecem na hora; pessoas, veículos e
// alojamentos chegam quando a API responde.
const MAX_RESULTADOS = 12;
const SAIDA_MS = 140;
const CHAVE_RECENTES = 'dispatch:paleta-recentes';

const ICONES = {
  tela: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  acao: '<path d="M12 5v14M5 12h14"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  veiculo:
    '<rect x="1" y="6" width="14" height="10" rx="1"/><path d="M15 9h4l3 3.5V16h-7V9z"/><circle cx="5.5" cy="17.5" r="2"/><circle cx="18.5" cy="17.5" r="2"/>',
  alojamento: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/>',
  tema: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>'
};

export class PaletaDeComandos {
  // Desenha um dos ícones da lista ICONES (todos no mesmo tamanho e traço).
  icone(nome) {
    return (
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONES[nome] || ICONES.tela) +
      '</svg>'
    );
  }

  // Tira acentos e deixa minúsculo, para "movimentacoes" achar "Movimentações".
  normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  // Dá uma nota para o comando: 0 = não aparece; quanto maior, mais para cima na lista.
  pontuar(cmd, termo, posicaoRecente) {
    // o que foi usado há pouco ganha um bônus (o mais recente ganha mais)
    const bonusRecente = posicaoRecente >= 0 ? 40 - posicaoRecente : 0;
    if (!termo) return cmd.soComBusca ? 0 : 10 + bonusRecente;

    const titulo = this.normalizar(cmd.titulo);
    const tudo = titulo + ' ' + this.normalizar(cmd.subtitulo) + ' ' + this.normalizar(cmd.grupo);

    if (titulo.startsWith(termo)) return 1000 + bonusRecente;
    if (titulo.includes(termo)) return 700 + bonusRecente;
    if (tudo.includes(termo)) return 400 + bonusRecente;

    // letras na ordem, mesmo com outras no meio: "nvc" acha "NoVo Colaborador"
    let posicao = 0;
    for (const letra of tudo) {
      if (letra === termo[posicao]) posicao++;
      if (posicao === termo.length) return 150 + bonusRecente;
    }
    return 0;
  }

  // comandosBase: telas e ações (não precisa de internet)
  // carregarExtras: busca pessoas, veículos e alojamentos na API
  constructor(comandosBase, carregarExtras) {
    this.comandosBase = comandosBase;
    this.carregarExtras = carregarExtras;
    this.aberta = false;
    this.comandos = [];
    this.filtrados = [];
    this.indiceAtivo = 0;
    this.recentes = this.lerRecentes();
  }

  lerRecentes() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || '[]');
      return Array.isArray(salvo) ? salvo.slice(0, 8) : [];
    } catch (_) {
      return [];
    }
  }

  guardarRecentes() {
    try {
      localStorage.setItem(CHAVE_RECENTES, JSON.stringify(this.recentes));
    } catch (_) {
      // Navegação anônima ou armazenamento bloqueado: só não lembra os recentes.
    }
  }

  ligarAtalho() {
    document.addEventListener('keydown', (evento) => {
      const combo = (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k';
      if (!combo) return;
      evento.preventDefault();
      if (this.aberta) this.fechar();
      else this.abrir();
    });
  }

  async abrir() {
    if (this.aberta) return;
    this.aberta = true;
    this.focoAnterior = document.activeElement;

    this.overlay = document.createElement('div');
    this.overlay.className = 'cmdk-overlay';
    this.overlay.innerHTML =
      '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Paleta de comandos">' +
      '<div class="cmdk-campo">' +
      this.icone('busca') +
      '<input type="text" class="cmdk-input" role="combobox" aria-expanded="true" aria-controls="cmdk-lista" aria-autocomplete="list" placeholder="Buscar telas, ações, pessoas ou veículos" autocomplete="off" spellcheck="false">' +
      '<kbd>Esc</kbd></div>' +
      '<div class="cmdk-lista" id="cmdk-lista" role="listbox" aria-label="Resultados"></div>' +
      '<div class="cmdk-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> fechar</span></div>' +
      '</div>';
    document.body.appendChild(this.overlay);
    document.body.classList.add('sem-rolagem');

    this.input = this.overlay.querySelector('.cmdk-input');
    this.lista = this.overlay.querySelector('.cmdk-lista');
    this.input.addEventListener('input', () => this.filtrar());
    this.input.addEventListener('keydown', (evento) => this.teclado(evento));
    this.overlay.addEventListener('mousedown', (evento) => {
      if (evento.target === this.overlay) this.fechar();
    });

    this.input.focus();
    this.comandos = this.comandosBase();
    this.filtrar();

    let extras = [];
    try {
      extras = await this.carregarExtras();
    } catch (_) {
      // Sem rede, a paleta continua útil com telas e ações.
    }
    if (!this.aberta) return;
    this.comandos = this.comandosBase().concat(extras);
    this.filtrar();
  }

  fechar() {
    if (!this.aberta) return;
    this.aberta = false;
    const saindo = this.overlay;
    saindo.classList.add('saindo');
    setTimeout(() => saindo.remove(), SAIDA_MS);
    this.overlay = null;
    if (!document.querySelector('.modal-overlay:not([hidden]), .gaveta-overlay:not([hidden])')) {
      document.body.classList.remove('sem-rolagem');
    }
    if (this.focoAnterior instanceof HTMLElement && document.body.contains(this.focoAnterior)) {
      this.focoAnterior.focus();
    }
  }

  filtrar() {
    const termo = this.normalizar(this.input.value.trim());
    const pontuados = [];
    this.comandos.forEach((cmd) => {
      const pontos = this.pontuar(cmd, termo, this.recentes.indexOf(cmd.id));
      if (pontos > 0) pontuados.push({ cmd: cmd, pontos: pontos });
    });
    // Sem termo, mantém a ordem dos grupos (telas, ações) e só puxa os recentes para cima.
    pontuados.sort((a, b) => b.pontos - a.pontos);
    this.filtrados = pontuados.slice(0, MAX_RESULTADOS).map((item) => item.cmd);
    this.indiceAtivo = 0;
    this.desenhar();
  }

  desenhar() {
    this.lista.replaceChildren();
    if (this.filtrados.length === 0) {
      this.input.removeAttribute('aria-activedescendant');
      const vazio = document.createElement('div');
      vazio.className = 'cmdk-vazio';
      vazio.textContent = 'Nada encontrado para "' + this.input.value + '".';
      this.lista.appendChild(vazio);
      return;
    }

    let grupoAtual = null;
    this.filtrados.forEach((cmd, indice) => {
      if (cmd.grupo !== grupoAtual) {
        grupoAtual = cmd.grupo;
        const cabecalho = document.createElement('div');
        cabecalho.className = 'cmdk-grupo';
        cabecalho.textContent = cmd.grupo;
        this.lista.appendChild(cabecalho);
      }
      const item = document.createElement('div');
      item.className = 'cmdk-item' + (indice === this.indiceAtivo ? ' ativo' : '');
      item.id = 'cmdk-item-' + indice;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(indice === this.indiceAtivo));

      const caixaIcone = document.createElement('span');
      caixaIcone.className = 'cmdk-icone';
      caixaIcone.innerHTML = this.icone(cmd.icone);
      const textos = document.createElement('span');
      textos.className = 'cmdk-textos';
      const titulo = document.createElement('strong');
      titulo.textContent = cmd.titulo;
      textos.appendChild(titulo);
      if (cmd.subtitulo) {
        const sub = document.createElement('span');
        sub.textContent = cmd.subtitulo;
        textos.appendChild(sub);
      }
      item.append(caixaIcone, textos);

      // mousedown em vez de click para o campo de busca não perder o foco antes de executar.
      item.addEventListener('mousedown', (evento) => {
        evento.preventDefault();
        this.executar(cmd);
      });
      item.addEventListener('mousemove', () => {
        if (this.indiceAtivo === indice) return;
        this.indiceAtivo = indice;
        this.marcarAtivo();
      });
      this.lista.appendChild(item);
    });
    this.input.setAttribute('aria-activedescendant', 'cmdk-item-' + this.indiceAtivo);
  }

  // Só troca qual item está marcado, sem montar a lista de novo (senão ela pisca a cada seta).
  marcarAtivo() {
    const itens = this.lista.querySelectorAll('.cmdk-item');
    itens.forEach((item, indice) => {
      const ativo = indice === this.indiceAtivo;
      item.classList.toggle('ativo', ativo);
      item.setAttribute('aria-selected', String(ativo));
    });
    if (itens.length > 0) {
      this.input.setAttribute('aria-activedescendant', 'cmdk-item-' + this.indiceAtivo);
      const ativo = this.lista.querySelector('.cmdk-item.ativo');
      if (ativo) ativo.scrollIntoView({ block: 'nearest' });
    }
  }

  teclado(evento) {
    const total = Math.max(1, this.filtrados.length);
    if (evento.key === 'Escape') {
      evento.preventDefault();
      // Impede o Esc de também fechar um modal aberto atrás da paleta.
      evento.stopPropagation();
      this.fechar();
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      this.indiceAtivo = (this.indiceAtivo + 1) % total;
      this.marcarAtivo();
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      this.indiceAtivo = (this.indiceAtivo - 1 + total) % total;
      this.marcarAtivo();
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const cmd = this.filtrados[this.indiceAtivo];
      if (cmd) this.executar(cmd);
    }
  }

  executar(cmd) {
    this.recentes = [cmd.id].concat(this.recentes.filter((id) => id !== cmd.id)).slice(0, 8);
    this.guardarRecentes();
    this.fechar();
    cmd.executar();
  }
}
