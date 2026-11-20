// Casca do sistema (app.html): o menu da esquerda e o topo ficam parados e só o meio da tela troca.
// Assim, clicar no menu não recarrega a página inteira.
//
// Como funciona:
//   - cada tela tem um arquivo em client/telas/<tela>.html com 4 partes (cabeçalho, botões do topo,
//     conteúdo e janelas/modais), e esta classe encaixa cada parte no lugar;
//   - o JS de cada tela é um módulo que exporta a classe da tela; a cada visita criamos um objeto novo;
//   - o endereço continua /frota, /resumo etc. (quem cuida disso é o Roteador).
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
  // A auditoria vem primeiro porque ela precisa estar ouvindo antes de Configurações abrir a aba.
  configuracoes: {
    modulos: ['auditoria', 'configuracoes'],
    titulo: 'Configurações',
    descricao: 'Regras, usuários e auditoria'
  }
};

// Ações rápidas da paleta (Ctrl+K): abrem a tela e clicam no botão que já existe nela.
// Assim não precisamos repetir aqui a lógica de cada formulário.
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
    this.sessao = this.criarSessao();

    this.roteador = new Roteador(Object.keys(TELAS), 'resumo', (rota, origem) =>
      this.abrir(rota, origem)
    );

    this.configurarSair();
    this.configurarPreCarga();
    this.configurarPaleta();
    this.roteador.iniciar();
  }

  // Vai para a tela (se ainda não estiver nela) e só depois roda a ação, quando os botões já existem.
  async naTela(rota, acao) {
    await this.roteador.ir(rota);
    if (this.telaAtual === rota) acao();
  }

  // A lista da tela chega da API um pouco depois de a tela abrir.
  // Fica conferindo a cada 100 ms (por até 3 s) se o elemento já apareceu e aí clica nele.
  clicarQuandoAparecer(seletor) {
    let tentativas = 0;
    const timer = setInterval(() => {
      const elemento = document.querySelector(seletor);
      tentativas++;
      if (elemento) {
        clearInterval(timer);
        elemento.click();
      } else if (tentativas >= 30) {
        clearInterval(timer);
      }
    }, 100);
  }

  configurarPaleta() {
    const base = () => {
      const telas = Object.keys(TELAS)
        .filter((rota) => rota !== 'configuracoes' || this.usuario?.perfil === 'admin')
        .map((rota) => ({
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

    // Pessoas, veículos e alojamentos só aparecem quando a pessoa digita alguma coisa.
    const extras = async () => {
      await this.sessao();
      const [pessoas, frota, alojamentos] = await Promise.all([
        chamarApi('/api/pessoas'),
        chamarApi('/api/frota'),
        chamarApi('/api/alojamentos')
      ]);
      if (![pessoas, frota, alojamentos].every((resposta) => resposta.ok)) {
        throw new Error('Cadastros indisponíveis');
      }
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
          executar: () =>
            this.naTela('frota', () => {
              this.clicarQuandoAparecer('tr[data-veiculo-id="' + v.id + '"] .botoes-acoes button:last-child');
            })
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
          executar: () =>
            this.naTela('alojamentos', () => {
              this.clicarQuandoAparecer('[data-alojamento-id="' + a.id + '"]');
            })
        });
      });
      return lista;
    };

    this.paleta = new PaletaDeComandos(base, extras);
    this.paleta.ligarAtalho();

    const gatilho = document.getElementById('botao-paleta');
    if (gatilho) gatilho.addEventListener('click', () => this.paleta.abrir());
  }

  // Configurações tem dois módulos que perguntam quem está logado; os dois usam a mesma resposta.
  criarSessao() {
    let pedido = null;
    return () => {
      if (!pedido) {
        pedido = chamarApi('/api/auth/eu')
          .then((resposta) => {
            if (resposta.ok) this.usuario = resposta.dados.usuario;
            else pedido = null;
            return resposta;
          })
          .catch((erro) => {
            pedido = null;
            throw erro;
          });
      }
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

  // Quando o mouse passa por cima de um item do menu, a tela já começa a ser baixada.
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
      // Se der erro, apaga da memória para tentar baixar de novo na próxima vez.
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

  // origem: 'inicio' (abriu o site), 'link' (clicou no menu) ou 'historico' (voltar/avançar do navegador).
  async abrir(rota, origem) {
    const numero = ++this.pedido;
    if (rota === this.telaAtual && origem !== 'inicio') {
      this.principal.setAttribute('aria-busy', 'false');
      return true;
    }
    if (this.telaAtual && !(await this.podeSair())) return false;
    if (numero !== this.pedido) return true;
    this.principal.setAttribute('aria-busy', 'true');

    let carregada;
    try {
      carregada = await this.carregarTela(rota);
    } catch (erro) {
      console.error('Falha ao abrir a tela', rota, erro);
      if (numero === this.pedido) this.mostrarFalha(rota);
      return true;
    }
    // Se a pessoa clicou em outra tela enquanto esta baixava, fica valendo só o último clique.
    if (numero !== this.pedido) return true;

    const trocar = () => { if (numero === this.pedido) this.montar(rota, carregada); };
    const animar =
      origem !== 'inicio' &&
      typeof document.startViewTransition === 'function' &&
      !this.movimentoReduzido.matches;

    if (animar) {
      const transicao = document.startViewTransition(trocar);
      // Se o navegador cancelar a animação (aba escondida, outra transição em andamento), a tela troca
      // do mesmo jeito; só não deixamos o "erro" do cancelamento aparecer no console.
      transicao.ready.catch(() => {});
      transicao.finished.catch(() => {});
      await transicao.updateCallbackDone.catch(() => {});
    } else {
      trocar();
    }

    if (origem !== 'inicio' && numero === this.pedido) {
      window.scrollTo(0, 0);
      // Coloca o foco no conteúdo novo (ajuda quem usa teclado ou leitor de tela).
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
    // Os botões da tela entram antes da busca (Ctrl+K), do sino e do perfil, que são fixos.
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
    // Compartilha entre módulos da visita atual, mas renova após alterações de perfil em outra tela.
    this.sessao = this.criarSessao();
    const contexto = {
      sinal: this.controlador.signal,
      sessao: this.sessao,
      ir: (destino) => this.roteador.ir(destino)
    };
    this.instancias = classes.map((Classe) => new Classe(contexto));

    if (window.janelas) window.janelas.prepararTela();
    if (window.navegacao) {
      window.navegacao.prepararTela();
      if (typeof window.navegacao.mostrarMenu === 'function') window.navegacao.mostrarMenu(false);
    }
    const sinal = this.controlador.signal;
    Promise.allSettled(this.instancias.map((tela) => tela.pronto)).then(() => {
      if (!sinal.aborted) this.principal.setAttribute('aria-busy', 'false');
    });
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
    const titulo = document.createElement('h1');
    titulo.className = 'topo-titulo';
    titulo.textContent = TELAS[rota].titulo;
    this.esquerda.replaceChildren(titulo);
    document.title = 'Dispatch — ' + TELAS[rota].titulo;
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
