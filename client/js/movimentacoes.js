// Tela de movimentações: junta entradas/saídas dos alojamentos e retiradas/devoluções da frota, com exportação em CSV.
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
    document.querySelectorAll('[data-fechar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        this.fecharModal(botao.dataset.fechar);
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
      await chamarApi('/api/auth/sair', { metodo: 'POST' });
      window.location.href = 'index.html';
    });
  }

  async exportarCsv() {
    const formatarCelula = (valor) => {
      const bruto = String(valor === null || valor === undefined ? '' : valor);
      // Se começar com =, +, - ou @, colocamos um apóstrofo antes para o Excel não rodar como fórmula.
      const seguro = /^[=+\-@\t\r]/.test(bruto) ? "'" + bruto : bruto;
      return /[;"\r\n]/.test(seguro) ? '"' + seguro.replace(/"/g, '""') + '"' : seguro;
    };

    const resposta = await chamarApi('/api/relatorios/movimentacoes' + this.filtrosQuery(1000));
    const todos = resposta.ok ? resposta.dados.eventos : this.eventosAtuais;
    if (todos.length === 0) {
      this.mostrarToast('Não há movimentações para exportar.', 'erro');
      return;
    }

    const linhas = [['Quando', 'Área', 'Tipo', 'Colaborador', 'Recurso']].concat(
      todos.map((evento) => [
        evento.quando,
        evento.categoria === 'frota' ? 'Frota' : 'Alojamento',
        evento.tipo,
        evento.colaborador,
        evento.recurso
      ])
    );

    // O \ufeff no começo avisa o Excel para abrir com acentuação UTF-8 correta, e o ; combina com planilhas em português.
    const csv =
      '\ufeff' +
      linhas.map((linha) => linha.map(formatarCelula).join(';')).join('\r\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
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

  paraInputData(data) {
    return (
      data.getFullYear() +
      '-' +
      (data.getMonth() + 1 < 10 ? '0' : '') +
      (data.getMonth() + 1) +
      '-' +
      (data.getDate() < 10 ? '0' : '') +
      data.getDate()
    );
  }

  ajustarTipos() {
    const area = this.seletorCategoria.value;
    Array.from(this.seletorTipo.options).forEach((opcao) => {
      opcao.hidden =
        opcao.value !== '' && area !== '' && this.tiposPorArea[area].indexOf(opcao.value) === -1;
    });
    if (
      this.seletorTipo.value !== '' &&
      area !== '' &&
      this.tiposPorArea[area].indexOf(this.seletorTipo.value) === -1
    ) {
      this.seletorTipo.value = '';
    }
  }

  filtrosQuery(quantidade) {
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
      quantidade
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

    const resposta = await chamarApi('/api/relatorios/movimentacoes' + this.filtrosQuery(this.limite));
    this.corpo.innerHTML = '';

    if (!resposta.ok) {
      this.corpo.innerHTML =
        '<tr><td colspan="4" class="texto-vazio">' +
        this.esc(resposta.dados.erro || 'Erro ao carregar.') +
        '</td></tr>';
      this.botaoMais.hidden = true;
      return;
    }

    const dados = resposta.dados;
    this.eventosAtuais = dados.eventos;
    document.getElementById('kpi-entradas').textContent = dados.por_tipo['Entrada'];
    document.getElementById('kpi-saidas').textContent = dados.por_tipo['Saída'];
    document.getElementById('kpi-retiradas').textContent = dados.por_tipo['Retirada'];
    document.getElementById('kpi-devolucoes').textContent = dados.por_tipo['Devolução'];
    document.getElementById('mov-total').textContent =
      'Mostrando ' + dados.eventos.length + ' de ' + dados.total;
    this.botaoMais.hidden = dados.total <= dados.eventos.length || this.limite >= 1000;

    if (dados.eventos.length === 0) {
      this.corpo.innerHTML =
        '<tr><td colspan="4" class="texto-vazio">Nenhuma movimentação encontrada para os filtros selecionados.</td></tr>';
      return;
    }

    dados.eventos.forEach((evento) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        this.formatarData(evento.quando) +
        '</td>' +
        '<td><span class="status-tag ' +
        (evento.categoria === 'frota' ? 'status-uso' : 'status-ativo') +
        '"><span class="status-ponto"></span>' +
        this.esc(evento.tipo) +
        '</span></td>' +
        '<td>' +
        this.esc(evento.colaborador) +
        '</td><td>' +
        this.esc(evento.recurso) +
        '</td>';
      this.corpo.appendChild(tr);
    });
  }

  recarregarDoInicio() {
    this.limite = this.PASSO;
    this.carregar();
  }

  aoIniciar() {
    // Abre já mostrando os últimos 30 dias.
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

    const usuario = sessao.dados.usuario;
    this.perfilNome.textContent = usuario.nome;
    this.perfilTipo.textContent = usuario.perfil;
    this.usuarioIniciais.textContent = this.pegarIniciais(usuario.nome);
    if (usuario.perfil === 'admin') this.blocoMenuAdmin.hidden = false;
    if (sessao.dados.nomeEmpresa) {
      this.nomeEmpresaMenu.textContent = sessao.dados.nomeEmpresa;
    }
    this.aoIniciar();
  }
}

new TelaMovimentacoes();
