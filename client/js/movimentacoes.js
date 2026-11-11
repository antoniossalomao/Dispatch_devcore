// Controla a tela de movimentacoes.
class TelaMovimentacoes {
  constructor() {
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.toast = document.getElementById('toast-mov');
    this.timerToast = null;
    this.campoDe = document.getElementById('mov-de');
    this.campoAte = document.getElementById('mov-ate');
    this.campoBusca = document.getElementById('mov-busca');
    this.seletorCategoria = document.getElementById('mov-categoria');
    this.seletorTipo = document.getElementById('mov-tipo');
    this.corpo = document.getElementById('mov-lista');
    this.botaoMais = document.getElementById('botao-mais');
    this.PASSO = 30;
    this.limite = this.PASSO;
    this.eventosAtuais = [];
    this.timerBusca = null;
    this.tiposPorArea = {
      alojamento: ['Entrada', 'Saída'],
      frota: ['Retirada', 'Devolução']
    };
    this.configurarEventos();
    this.iniciar();
  }

  configurarEventos() {
    document.querySelectorAll('[data-fechar]').forEach((b) => {
      b.addEventListener('click', () => {
        this.fecharModal(b.dataset.fechar);
      });
    });
    document
      .getElementById('botao-atualizar')
      .addEventListener('click', this.recarregarDoInicio.bind(this));
    this.seletorCategoria.addEventListener('change', () => {
      this.ajustarTipos();
      this.recarregarDoInicio();
    });
    this.seletorTipo.addEventListener('change', this.recarregarDoInicio.bind(this));
    this.campoBusca.addEventListener('input', () => {
      if (this.timerBusca) clearTimeout(this.timerBusca);
      this.timerBusca = setTimeout(this.recarregarDoInicio.bind(this), 300);
    });
    this.botaoMais.addEventListener('click', () => {
      this.limite = Math.min(this.limite + this.PASSO, 1000);
      this.carregar();
    });
    document
      .getElementById('botao-exportar')
      .addEventListener('click', this.exportarCsv.bind(this));
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
  }

  async exportarCsv() {
    const celula = (t) => {
      const v = String(t === null || t === undefined ? '' : t);
      return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    const r = await chamarApi('/api/relatorios/movimentacoes' + this.filtrosQuery(1000));
    const todos = r.ok ? r.dados.eventos : this.eventosAtuais;
    if (todos.length === 0) {
      this.mostrarToast('Não há movimentações para exportar.', 'erro');
      return;
    }
    const linhas = [['Quando', 'Área', 'Tipo', 'Colaborador', 'Recurso']].concat(
      todos.map((e) => {
        return [
          e.quando,
          e.categoria === 'frota' ? 'Frota' : 'Alojamento',
          e.tipo,
          e.colaborador,
          e.recurso
        ];
      })
    );
    const csv =
      '\ufeff' +
      linhas
        .map((l) => {
          return l.map(celula).join(';');
        })
        .join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([csv], {
        type: 'text/csv;charset=utf-8'
      })
    );
    link.download = 'movimentacoes-' + this.campoDe.value + '-a-' + this.campoAte.value + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  pegarIniciais(nome) {
    const texto = (nome || '').trim();
    if (texto === '') return '--';
    const partes = texto.split(' ');
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  mostrarToast(texto, tipo) {
    this.toast.textContent = texto;
    this.toast.className = tipo === 'erro' ? 'toast toast-erro' : 'toast';
    this.toast.hidden = false;
    if (this.timerToast) clearTimeout(this.timerToast);
    this.timerToast = setTimeout(() => {
      this.toast.hidden = true;
    }, 3200);
  }

  abrirModal(id) {
    document.getElementById(id).hidden = false;
  }

  fecharModal(id) {
    document.getElementById(id).hidden = true;
  }

  formatarData(texto) {
    return texto ? texto.slice(0, 16) : '';
  }

  paraInputData(d) {
    return (
      d.getFullYear() +
      '-' +
      (d.getMonth() + 1 < 10 ? '0' : '') +
      (d.getMonth() + 1) +
      '-' +
      (d.getDate() < 10 ? '0' : '') +
      d.getDate()
    );
  }

  ajustarTipos() {
    const area = this.seletorCategoria.value;
    Array.prototype.forEach.call(this.seletorTipo.options, (o) => {
      o.hidden = o.value !== '' && area !== '' && this.tiposPorArea[area].indexOf(o.value) === -1;
    });
    if (
      this.seletorTipo.value !== '' &&
      area !== '' &&
      this.tiposPorArea[area].indexOf(this.seletorTipo.value) === -1
    )
      this.seletorTipo.value = '';
  }

  filtrosQuery(qtd) {
    return (
      '?de=' +
      encodeURIComponent(this.campoDe.value) +
      '&ate=' +
      encodeURIComponent(this.campoAte.value) +
      '&categoria=' +
      encodeURIComponent(this.seletorCategoria.value) +
      '&tipo=' +
      encodeURIComponent(this.seletorTipo.value) +
      '&busca=' +
      encodeURIComponent(this.campoBusca.value) +
      '&limite=' +
      qtd
    );
  }

  async carregar() {
    if (!this.campoDe.value || !this.campoAte.value || this.campoDe.value > this.campoAte.value) {
      this.mostrarToast(
        'Informe um período válido (a data inicial não pode ser depois da final).',
        'erro'
      );
      return;
    }
    const r = await chamarApi('/api/relatorios/movimentacoes' + this.filtrosQuery(this.limite));
    this.corpo.innerHTML = '';
    if (!r.ok) {
      this.corpo.innerHTML =
        '<tr><td colspan="4" class="texto-vazio">' +
        this.esc(r.dados.erro || 'Erro ao carregar.') +
        '</td></tr>';
      this.botaoMais.hidden = true;
      return;
    }
    const d = r.dados;
    this.eventosAtuais = d.eventos;
    document.getElementById('kpi-entradas').textContent = d.por_tipo['Entrada'];
    document.getElementById('kpi-saidas').textContent = d.por_tipo['Saída'];
    document.getElementById('kpi-retiradas').textContent = d.por_tipo['Retirada'];
    document.getElementById('kpi-devolucoes').textContent = d.por_tipo['Devolução'];
    document.getElementById('mov-total').textContent =
      'Mostrando ' + d.eventos.length + ' de ' + d.total;
    this.botaoMais.hidden = d.total <= d.eventos.length || this.limite >= 1000;
    if (d.eventos.length === 0) {
      this.corpo.innerHTML =
        '<tr><td colspan="4" class="texto-vazio">Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>';
      return;
    }
    d.eventos.forEach((e) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        this.formatarData(e.quando) +
        '</td>' +
        '<td><span class="status-tag ' +
        (e.categoria === 'frota' ? 'status-uso' : 'status-ativo') +
        '"><span class="status-ponto"></span>' +
        this.esc(e.tipo) +
        '</span></td>' +
        '<td>' +
        this.esc(e.colaborador) +
        '</td><td>' +
        this.esc(e.recurso) +
        '</td>';
      this.corpo.appendChild(tr);
    });
  }

  recarregarDoInicio() {
    this.limite = this.PASSO;
    this.carregar();
  }

  aoIniciar() {
    const hoje = new Date();
    this.campoAte.value = this.paraInputData(hoje);
    this.campoDe.value = this.paraInputData(new Date(hoje.getTime() - 30 * 86400000));
    this.carregar();
  }

  async iniciar() {
    const sessao = await chamarApi('/api/auth/eu');
    if (!sessao.ok) {
      window.location.href = 'index.html';
      return;
    }
    const user = sessao.dados.usuario;
    this.perfilNome.textContent = user.nome;
    this.perfilTipo.textContent = user.perfil;
    this.usuarioIniciais.textContent = this.pegarIniciais(user.nome);
    if (user.perfil === 'admin') this.blocoMenuAdmin.hidden = false;
    const cfg = await chamarApi('/api/configuracoes');
    if (cfg.ok && cfg.dados.parametros && cfg.dados.parametros.nomeEmpresa) {
      this.nomeEmpresaMenu.textContent = cfg.dados.parametros.nomeEmpresa;
    }
    this.aoIniciar();
  }
}
new TelaMovimentacoes();
