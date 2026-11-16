// Casca do sistema: menu lateral e topo ficam fixos e só o miolo da tela troca, sem recarregar a página.
//
// Antes cada tela era um HTML inteiro. Clicar no menu baixava tudo de novo (CSS, scripts, sessão),
// a tela piscava em branco e o estado do menu se perdia. Agora:
//   - cada tela é um fragmento em client/telas/<rota>.html (cabeçalho, ações do topo, conteúdo e modais);
//   - o JS da tela é um módulo que exporta a classe da tela, criada de novo a cada visita;
//   - a URL continua limpa (/frota, /resumo) pela History API. O hash fica livre para a própria tela
//     usar (Configurações abre abas por #auditoria, #usuarios etc.).
import { Roteador } from './Roteador.js';
import { PaletaDeComandos } from './PaletaDeComandos.js';

const TELAS = {
  resumo: { modulos: ['resumo'], titulo: 'Visão geral', descricao: 'Resumo operacional do dia' },
  colaboradores: {
    modulos: ['colaboradores'],
    titulo: 'Colaboradores',
    descricao: 'Equipe, habilitações e histórico'
  },
  alojamentos: {
    modulos: ['alojamentos'],
    titulo: 'Alojamentos',
    descricao: 'Quartos, leitos e ocorrências'
  },
  frota: { modulos: ['frota'], titulo: 'Frota', descricao: 'Veículos, saídas, voltas e manutenções' },
  movimentacoes: {
    modulos: ['movimentacoes'],
    titulo: 'Movimentações',
    descricao: 'Entradas, saídas, retiradas e devoluções'
  },
  relatorios: { modulos: ['relatorios'], titulo: 'Relatórios', descricao: 'Indicadores por período' },
  // A ordem importa: a auditoria escuta o evento de troca de aba que Configurações dispara ao abrir.
  configuracoes: {
    modulos: ['auditoria', 'configuracoes'],
    titulo: 'Configurações',
    descricao: 'Regras, usuários e auditoria'
  }
};

// Ações rápidas da paleta: abrem a tela e clicam no botão que já existe nela,
// para a regra de cada formulário continuar morando num lugar só.
const ACOES = [
  { id: 'acao:novo-colaborador', titulo: 'Novo colaborador', tela: 'colaboradores', botao: '#botao-novo-colaborador' },
  { id: 'acao:novo-veiculo', titulo: 'Novo veículo', tela: 'frota', botao: '#botao-novo-veiculo' },
  { id: 'acao:registrar-saida', titulo: 'Registrar saída de veículo', tela: 'frota', botao: '#botao-saida-geral' },
  { id: 'acao:novo-alojamento', titulo: 'Novo alojamento', tela: 'alojamentos', botao: '#botao-novo-alojamento' }
];

class App {
  constructor() {
    this.esquerda = document.getElementById('topo-esquerda');
    this.direita = document.getElementById('topo-direita');
    this.principal = document.getElementById('conteudo');
    this.camada = document.getElementById('camada-tela');
    this.menu = document.querySelector('.menu-lateral');

    this.fragmentos = new Map();
    this.telaAtual = null;
    this.instancias = [];
    this.controlador = null;
    this.acoesAtuais = [];
    this.pedido = 0;
    this.movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.roteador = new Roteador(Object.keys(TELAS), 'resumo', (rota, origem) =>
      this.abrir(rota, origem)
    );

    this.configurarSair();
    this.configurarPreCarga();
    this.configurarPaleta();
    this.roteador.iniciar();
  }

  // Abre a tela (se ainda não estiver nela) e só então roda a ação, com os elementos já no DOM.
  async naTela(rota, acao) {
    await this.roteador.ir(rota);
    if (this.telaAtual === rota) acao();
  }

  configurarPaleta() {
    const base = () => {
      const telas = Object.keys(TELAS).map((rota) => ({
        id: 'tela:' + rota,
        titulo: TELAS[rota].titulo,
        subtitulo: TELAS[rota].descricao,
        grupo: 'Telas',
        icone: 'tela',
        executar: () => this.roteador.ir(rota)
      }));
      const acoes = ACOES.map((acao) => ({
        id: acao.id,
        titulo: acao.titulo,
        subtitulo: TELAS[acao.tela].titulo,
        grupo: 'Ações',
        icone: 'acao',
        executar: () =>
          this.naTela(acao.tela, () => {
            const botao = document.querySelector(acao.botao);
            if (botao && !botao.disabled) botao.click();
          })
      }));
      const sistema = [
        {
          id: 'sistema:tema',
          titulo: 'Alternar tema claro/escuro',
          grupo: 'Sistema',
          icone: 'tema',
          executar: () => {
            const botao = document.querySelector('.botao-tema');
            if (botao) botao.click();
          }
        },
        {
          id: 'sistema:sair',
          titulo: 'Sair do sistema',
          grupo: 'Sistema',
          icone: 'sair',
          executar: () => document.getElementById('botao-sair').click()
        }
      ];
      return telas.concat(acoes, sistema);
    };

    // Cadastros só aparecem quando a pessoa digita: sem termo, a paleta mostra telas e ações.
    const extras = async () => {
      const [pessoas, frota, alojamentos] = await Promise.all([
        chamarApi('/api/pessoas'),
        chamarApi('/api/frota'),
        chamarApi('/api/alojamentos')
      ]);
      const lista = [];
      ((pessoas.ok && pessoas.dados.colaboradores) || []).forEach((p) => {
        lista.push({
          id: 'pessoa:' + p.id,
          titulo: p.nome,
          subtitulo: [p.matricula, p.cargo].filter(Boolean).join(' · '),
          grupo: 'Colaboradores',
          icone: 'pessoa',
          soComBusca: true,
          executar: () =>
            this.naTela('colaboradores', () => {
              const busca = document.getElementById('campo-busca');
              if (!busca) return;
              busca.value = p.nome;
              busca.dispatchEvent(new Event('input', { bubbles: true }));
            })
        });
      });
      ((frota.ok && frota.dados.veiculos) || []).forEach((v) => {
        lista.push({
          id: 'veiculo:' + v.id,
          titulo: v.placa + ' · ' + v.modelo,
          subtitulo: 'Frota',
          grupo: 'Veículos',
          icone: 'veiculo',
          soComBusca: true,
          executar: () => this.roteador.ir('frota')
        });
      });
      ((alojamentos.ok && alojamentos.dados.alojamentos) || []).forEach((a) => {
        lista.push({
          id: 'alojamento:' + a.id,
          titulo: a.nome,
          subtitulo: a.cidade || 'Alojamentos',
          grupo: 'Alojamentos',
          icone: 'alojamento',
          soComBusca: true,
          executar: () => this.roteador.ir('alojamentos')
        });
      });
      return lista;
    };

    this.paleta = new PaletaDeComandos(base, extras);
    this.paleta.ligarAtalho();

    const gatilho = document.getElementById('botao-paleta');
    if (gatilho) gatilho.addEventListener('click', () => this.paleta.abrir());
  }

  // Uma tela pode ter mais de um módulo pedindo a sessão; todos dividem a mesma resposta.
  criarSessao() {
    let pedido = null;
    return () => {
      if (!pedido) pedido = chamarApi('/api/auth/eu');
      return pedido;
    };
  }

  configurarSair() {
    const botao = document.getElementById('botao-sair');
    if (!botao) return;
    botao.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', { metodo: 'POST' });
      window.location.href = 'login';
    });
  }

  // Passar o mouse (ou o foco do teclado) num item do menu já baixa a tela; o clique chega com tudo pronto.
  configurarPreCarga() {
    const preCarregar = (evento) => {
      const link = evento.target.closest && evento.target.closest('a[data-rota]');
      if (link) this.carregarTela(link.dataset.rota).catch(() => {});
    };
    this.menu.addEventListener('pointerover', preCarregar);
    this.menu.addEventListener('focusin', preCarregar);
  }

  async buscarFragmento(rota) {
    if (!this.fragmentos.has(rota)) {
      const pedido = fetch('/telas/' + rota + '.html', { credentials: 'same-origin' }).then(
        async (resposta) => {
          if (!resposta.ok) throw new Error('Tela indisponível (' + resposta.status + ')');
          const modelo = document.createElement('template');
          modelo.innerHTML = await resposta.text();
          return modelo.content;
        }
      );
      // Se falhar, tira do cache para a próxima tentativa buscar de novo.
      pedido.catch(() => this.fragmentos.delete(rota));
      this.fragmentos.set(rota, pedido);
    }
    return this.fragmentos.get(rota);
  }

  async carregarTela(rota) {
    const [fragmento, modulos] = await Promise.all([
      this.buscarFragmento(rota),
      Promise.all(TELAS[rota].modulos.map((nome) => import('../' + nome + '.js')))
    ]);
    return { fragmento, classes: modulos.map((modulo) => modulo.default) };
  }

  parte(fragmento, nome) {
    return fragmento.querySelector('template[data-parte="' + nome + '"]');
  }

  async podeSair() {
    const pendente = this.instancias.some(
      (tela) => typeof tela.temAlteracoesPendentes === 'function' && tela.temAlteracoesPendentes()
    );
    if (!pendente) return true;
    return window.confirmar('Existem alterações que ainda não foram salvas nesta tela.', {
      titulo: 'Sair sem salvar?',
      confirmar: 'Sair sem salvar',
      cancelar: 'Continuar editando'
    });
  }

  // origem: 'inicio' (primeira carga), 'link' (clique) ou 'historico' (voltar/avançar do navegador).
  async abrir(rota, origem) {
    if (rota === this.telaAtual && origem !== 'inicio') return true;
    if (this.telaAtual && !(await this.podeSair())) return false;

    const numero = ++this.pedido;
    this.principal.setAttribute('aria-busy', 'true');

    let carregada;
    try {
      carregada = await this.carregarTela(rota);
    } catch (erro) {
      console.error('Falha ao abrir a tela', rota, erro);
      if (numero === this.pedido) this.mostrarFalha(rota);
      return true;
    }
    // Clicou em outra tela enquanto esta baixava: só a última vale.
    if (numero !== this.pedido) return true;

    const trocar = () => this.montar(rota, carregada);
    const animar =
      origem !== 'inicio' &&
      typeof document.startViewTransition === 'function' &&
      !this.movimentoReduzido.matches;

    if (animar) {
      await document.startViewTransition(trocar).updateCallbackDone;
    } else {
      trocar();
    }

    if (origem !== 'inicio') {
      window.scrollTo(0, 0);
      // Leitor de tela e teclado começam pela tela nova, e não pelo item do menu clicado.
      this.principal.focus({ preventScroll: true });
    }
    return true;
  }

  desmontarAtual() {
    if (this.controlador) this.controlador.abort();
    this.instancias.forEach((tela) => {
      if (typeof tela.desmontar === 'function') tela.desmontar();
    });
    this.instancias = [];
    this.acoesAtuais.forEach((no) => no.remove());
    this.acoesAtuais = [];
    if (window.janelas) window.janelas.limparTela();
  }

  montar(rota, { fragmento, classes }) {
    this.desmontarAtual();

    const cabecalho = this.parte(fragmento, 'cabecalho');
    const acoes = this.parte(fragmento, 'acoes');
    const conteudo = this.parte(fragmento, 'conteudo');
    const extras = this.parte(fragmento, 'extras');

    this.esquerda.replaceChildren(cabecalho.content.cloneNode(true));

    this.direita.className = ('topo-direita ' + (acoes.dataset.classe || '')).trim();
    // As ações da tela entram antes da busca (Ctrl+K), do sino e do perfil, que pertencem à casca.
    const ancora = this.direita.querySelector('#botao-paleta, .sino-caixa, .topo-perfil');
    const novasAcoes = acoes.content.cloneNode(true);
    this.acoesAtuais = Array.from(novasAcoes.childNodes);
    this.direita.insertBefore(novasAcoes, ancora);

    this.principal.className = conteudo.dataset.classe || 'conteudo';
    this.principal.replaceChildren(conteudo.content.cloneNode(true));
    this.camada.replaceChildren(extras.content.cloneNode(true));

    document.title = 'Dispatch — ' + (cabecalho.dataset.titulo || '');
    this.marcarMenu(rota);
    this.telaAtual = rota;

    this.controlador = new AbortController();
    const contexto = {
      sinal: this.controlador.signal,
      sessao: this.criarSessao(),
      ir: (destino) => this.roteador.ir(destino)
    };
    this.instancias = classes.map((Classe) => new Classe(contexto));

    if (window.janelas) window.janelas.prepararTela();
    if (window.navegacao) {
      window.navegacao.prepararTela();
      if (typeof window.navegacao.mostrarMenu === 'function') window.navegacao.mostrarMenu(false);
    }
    this.principal.setAttribute('aria-busy', 'false');
  }

  marcarMenu(rota) {
    this.menu.querySelectorAll('a[data-rota]').forEach((link) => {
      const ativo = link.dataset.rota === rota;
      link.classList.toggle('ativo', ativo);
      if (ativo) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  mostrarFalha(rota) {
    this.desmontarAtual();
    this.telaAtual = null;
    this.marcarMenu(rota);
    this.principal.className = 'conteudo';
    const caixa = document.createElement('div');
    caixa.className = 'estado-vazio estado-falha';
    caixa.setAttribute('role', 'alert');
    caixa.innerHTML =
      '<strong>Não foi possível abrir esta tela.</strong>' +
      '<p>Confira a conexão e tente de novo.</p>' +
      '<button type="button" class="btn-secundario">Tentar de novo</button>';
    caixa.querySelector('button').addEventListener('click', () => this.abrir(rota, 'link'));
    this.principal.replaceChildren(caixa);
    this.principal.setAttribute('aria-busy', 'false');
  }
}

new App();
