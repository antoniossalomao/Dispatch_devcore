// Controla a tela de resumo.
class TelaResumo {
  constructor() {
    this.numVeiculosUso = document.getElementById('num-veiculos-uso');
    this.subVeiculosUso = document.getElementById('sub-veiculos-uso');
    this.detalheVeiculosUso = document.getElementById('detalhe-veiculos-uso');
    this.numVeiculosDisp = document.getElementById('num-veiculos-disp');
    this.numAlojamentos = document.getElementById('num-alojamentos');
    this.subAlojamentos = document.getElementById('sub-alojamentos');
    this.detalheAlojamentos = document.getElementById('detalhe-alojamentos');
    this.numVagas = document.getElementById('num-vagas');
    this.listaMov = document.getElementById('lista-movimentacoes');
    this.listaAloj = document.getElementById('lista-alojamentos');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.campoBusca = document.getElementById('campo-busca');
    this.avisoTela = document.getElementById('aviso-tela');
    this.dataHoje = document.getElementById('data-hoje');
    this.abasFiltro = document.querySelectorAll('.aba-item');
    this.movimentacoesAtuais = [];
    this.filtroCategoria = 'todos';
    this.dataHoje.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'short'
    });
    this.linksEmBreve = document.querySelectorAll('.menu-em-breve');
    this.configurarEventos();
    this.carregarPainel();
  }

  configurarEventos() {
    this.abasFiltro.forEach((aba) => {
      aba.addEventListener('click', () => {
        this.abasFiltro.forEach((outra) => {
          outra.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        this.filtroCategoria = aba.dataset.filtro;
        this.aplicarFiltros();
      });
    });
    this.campoBusca.addEventListener('input', this.aplicarFiltros.bind(this));
    this.linksEmBreve.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.mostrarAviso('Módulo "' + link.dataset.tela + '" em construção.');
      });
    });
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
  }

  mostrarAviso(texto) {
    this.avisoTela.textContent = texto;
    this.avisoTela.hidden = false;
    setTimeout(() => {
      this.avisoTela.hidden = true;
    }, 2800);
  }

  pegarIniciais(nome) {
    const partes = nome.trim().split(' ');
    if (partes.length === 1) {
      return partes[0].slice(0, 2).toUpperCase();
    }
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }

  classeStatus(status) {
    if (status === 'Ativo') {
      return 'status-tag status-ativo';
    }
    if (status === 'Em uso') {
      return 'status-tag status-uso';
    }
    return 'status-tag status-concluido';
  }

  porcentagem(parte, total) {
    if (!total || total <= 0) {
      return 0;
    }
    return Math.round((parte / total) * 100);
  }

  aplicarFiltros() {
    const termo = this.campoBusca.value.trim().toLowerCase();
    const filtradas = this.movimentacoesAtuais.filter((item) => {
      if (this.filtroCategoria !== 'todos' && item.categoria !== this.filtroCategoria) {
        return false;
      }
      if (termo === '') {
        return true;
      }
      return (
        item.colaborador.toLowerCase().indexOf(termo) !== -1 ||
        item.tipo.toLowerCase().indexOf(termo) !== -1 ||
        item.recurso.toLowerCase().indexOf(termo) !== -1 ||
        item.status.toLowerCase().indexOf(termo) !== -1
      );
    });
    this.desenharTabela(filtradas);
  }

  desenharTabela(lista) {
    this.listaMov.innerHTML = '';
    if (lista.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'texto-vazio';
      td.textContent = 'Nenhuma movimentação encontrada para esse filtro.';
      tr.appendChild(td);
      this.listaMov.appendChild(tr);
      return;
    }
    lista.forEach((item) => {
      const tr = document.createElement('tr');
      const tdPessoa = document.createElement('td');
      const spanNome = document.createElement('span');
      spanNome.className = 'pessoa-nome';
      spanNome.textContent = item.colaborador;
      tdPessoa.appendChild(spanNome);
      if (item.cargo) {
        const spanCargo = document.createElement('span');
        spanCargo.className = 'pessoa-cargo';
        spanCargo.textContent = item.cargo;
        tdPessoa.appendChild(spanCargo);
      }
      const tdTipo = document.createElement('td');
      tdTipo.textContent = item.tipo;
      const tdRecurso = document.createElement('td');
      tdRecurso.textContent = item.recurso;
      const tdHorario = document.createElement('td');
      tdHorario.className = 'celula-horario';
      tdHorario.textContent = item.horario;
      const tdStatus = document.createElement('td');
      const tag = document.createElement('span');
      tag.className = this.classeStatus(item.status);
      const ponto = document.createElement('span');
      ponto.className = 'status-ponto';
      tag.appendChild(ponto);
      tag.appendChild(document.createTextNode(item.status));
      tdStatus.appendChild(tag);
      tr.appendChild(tdPessoa);
      tr.appendChild(tdTipo);
      tr.appendChild(tdRecurso);
      tr.appendChild(tdHorario);
      tr.appendChild(tdStatus);
      this.listaMov.appendChild(tr);
    });
  }

  desenharAlojamentos(lista) {
    this.listaAloj.innerHTML = '';
    if (!lista || lista.length === 0) {
      const p = document.createElement('p');
      p.className = 'texto-vazio';
      p.textContent = 'Nenhum alojamento cadastrado ainda.';
      this.listaAloj.appendChild(p);
      return;
    }
    lista.forEach((aloj) => {
      const pct = this.porcentagem(aloj.ocupados, aloj.total);
      const div = document.createElement('div');
      const topo = document.createElement('div');
      topo.className = 'unidade-topo';
      const nome = document.createElement('span');
      nome.className = 'unidade-nome';
      nome.textContent = aloj.nome;
      if (aloj.cidade) {
        const cid = document.createElement('span');
        cid.className = 'unidade-cidade';
        cid.textContent = '· ' + aloj.cidade;
        nome.appendChild(cid);
      }
      const numeros = document.createElement('span');
      numeros.className = 'unidade-numeros';
      numeros.textContent = aloj.ocupados + '/' + aloj.total + ' leitos';
      topo.appendChild(nome);
      topo.appendChild(numeros);
      const fundo = document.createElement('div');
      fundo.className = 'barra-fundo';
      const barra = document.createElement('div');
      barra.className = 'barra-preenchimento ' + (pct >= 80 ? 'barra-azul' : 'barra-verde');
      barra.style.width = pct + '%';
      fundo.appendChild(barra);
      div.appendChild(topo);
      div.appendChild(fundo);
      this.listaAloj.appendChild(div);
    });
  }

  async carregarPainel() {
    try {
      const sessao = await chamarApi('/api/auth/eu');
      if (!sessao.ok) {
        window.location.href = 'index.html';
        return;
      }
      const user = sessao.dados.usuario;
      this.perfilNome.textContent = user.nome;
      this.perfilTipo.textContent = user.perfil;
      this.usuarioIniciais.textContent = this.pegarIniciais(user.nome);
      if (user.perfil === 'admin') {
        this.blocoMenuAdmin.hidden = false;
      }
      const res = await chamarApi('/api/resumo');
      if (!res.ok) {
        return;
      }
      const d = res.dados;
      if (d.nomeEmpresa) {
        this.nomeEmpresaMenu.textContent = d.nomeEmpresa;
      }
      const pctOcup = this.porcentagem(d.leitosOcupados, d.totalLeitos);
      this.numVeiculosUso.textContent = d.veiculosEmUso;
      this.subVeiculosUso.textContent = 'de ' + d.totalVeiculos + ' na frota';
      this.detalheVeiculosUso.textContent =
        d.veiculosManutencao > 0
          ? d.veiculosManutencao + ' em manutenção no momento'
          : 'Nenhum veículo na oficina';
      this.numVeiculosDisp.textContent = d.veiculosDisponiveis;
      document.getElementById('detalhe-veiculos-disp').textContent =
        'Documentação e CNH validadas na saída';
      this.numAlojamentos.textContent = d.totalAlojamentos;
      this.subAlojamentos.textContent = d.totalLeitos + ' leitos no total';
      this.detalheAlojamentos.textContent =
        d.leitosOcupados + ' leitos ocupados hoje (' + pctOcup + '%)';
      this.numVagas.textContent = d.vagasDisponiveis;
      this.movimentacoesAtuais = d.movimentacoes || [];
      this.aplicarFiltros();
      this.desenharAlojamentos(d.alojamentos);
    } catch (erro) {
      this.mostrarAviso('Sem conexão com o servidor.');
    }
  }
}
new TelaResumo();
