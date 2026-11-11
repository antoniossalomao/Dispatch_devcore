// Controla a tela de colaboradores.
class TelaColaboradores {
  constructor() {
    this.subtituloContagem = document.getElementById('subtitulo-contagem');
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.botaoSeed = document.getElementById('botao-seed');
    this.avisoTela = document.getElementById('aviso-tela');
    this.toast = document.getElementById('toast-colab');
    this.kpiTotalAtivos = document.getElementById('kpi-total-ativos');
    this.kpiComCnh = document.getElementById('kpi-com-cnh');
    this.kpiPctCnh = document.getElementById('kpi-pct-cnh');
    this.kpiCnhAlerta = document.getElementById('kpi-cnh-alerta');
    this.kpiAlojados = document.getElementById('kpi-alojados');
    this.kpiEmTransito = document.getElementById('kpi-em-transito');
    this.campoBusca = document.getElementById('campo-busca');
    this.seletorStatusAtivo = document.getElementById('seletor-status-ativo');
    this.abasFiltroCnh = document.querySelectorAll('.colab-filtros-topo .aba-item');
    this.listaColaboradores = document.getElementById('lista-colaboradores');
    this.botaoNovoColab = document.getElementById('botao-novo-colaborador');
    this.modalColab = document.getElementById('modal-colaborador');
    this.fecharModal = document.getElementById('fechar-modal');
    this.cancelarModal = document.getElementById('cancelar-modal');
    this.formColab = document.getElementById('form-colaborador');
    this.modalTitulo = document.getElementById('modal-titulo');
    this.colabId = document.getElementById('colab-id');
    this.colabNome = document.getElementById('colab-nome');
    this.colabMatricula = document.getElementById('colab-matricula');
    this.colabCargo = document.getElementById('colab-cargo');
    this.colabObra = document.getElementById('colab-obra');
    this.colabTelefone = document.getElementById('colab-telefone');
    this.colabTemCnh = document.getElementById('colab-tem-cnh');
    this.camposCnh = document.getElementById('campos-cnh');
    this.colabCnhValidade = document.getElementById('colab-cnh-validade');
    this.gavetaHistorico = document.getElementById('gaveta-historico');
    this.fecharGaveta = document.getElementById('fechar-gaveta');
    this.gavetaAvatar = document.getElementById('gaveta-avatar');
    this.gavetaNome = document.getElementById('gaveta-nome');
    this.gavetaSub = document.getElementById('gaveta-sub');
    this.contEstadias = document.getElementById('cont-estadias');
    this.contViagens = document.getElementById('cont-viagens');
    this.gavetaAtualAlojamento = document.getElementById('gaveta-atual-alojamento');
    this.gavetaAtualDesde = document.getElementById('gaveta-atual-desde');
    this.gavetaAtualVeiculo = document.getElementById('gaveta-atual-veiculo');
    this.gavetaAtualDestino = document.getElementById('gaveta-atual-destino');
    this.gavetaTel = document.getElementById('gaveta-tel');
    this.gavetaObra = document.getElementById('gaveta-obra');
    this.gavetaCnhCat = document.getElementById('gaveta-cnh-cat');
    this.gavetaCnhVal = document.getElementById('gaveta-cnh-val');
    this.gavetaCnhTag = document.getElementById('gaveta-cnh-tag');
    this.gavetaListaEstadias = document.getElementById('gaveta-lista-estadias');
    this.gavetaListaMotorista = document.getElementById('gaveta-lista-motorista');
    this.gavetaListaPassageiro = document.getElementById('gaveta-lista-passageiro');
    this.gavetaBotaoEditar = document.getElementById('gaveta-botao-editar');
    this.gavetaBotaoStatus = document.getElementById('gaveta-botao-status');
    this.gavetaAbas = document.querySelectorAll('.gaveta-aba');
    this.secoesGaveta = {
      visao: document.getElementById('gaveta-secao-visao'),
      alojamentos: document.getElementById('gaveta-secao-alojamentos'),
      frota: document.getElementById('gaveta-secao-frota')
    };
    this.colaboradoresCache = [];
    this.filtroCnhAtual = 'todos';
    this.colaboradorSelecionado = null;
    this.timerToast = null;
    this.configurarEventos();
    this.iniciar();
  }

  configurarEventos() {
    this.campoBusca.addEventListener('input', this.carregarColaboradores.bind(this));
    this.seletorStatusAtivo.addEventListener('change', this.carregarColaboradores.bind(this));
    this.abasFiltroCnh.forEach((aba) => {
      aba.addEventListener('click', () => {
        this.abasFiltroCnh.forEach((b) => {
          b.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        this.filtroCnhAtual = aba.dataset.filtroCnh;
        this.carregarColaboradores();
      });
    });
    this.botaoSeed.addEventListener('click', this.carregarExemplos.bind(this));
    this.botaoNovoColab.addEventListener('click', this.novoColaborador.bind(this));
    this.fecharModal.addEventListener('click', this.fecharModalColab.bind(this));
    this.cancelarModal.addEventListener('click', this.fecharModalColab.bind(this));
    this.colabTemCnh.addEventListener('change', () => {
      this.camposCnh.hidden = !this.colabTemCnh.checked;
    });
    this.formColab.addEventListener('submit', this.salvarColaborador.bind(this));
    this.fecharGaveta.addEventListener('click', this.fecharGavetaColab.bind(this));
    this.gavetaAbas.forEach((aba) => {
      aba.addEventListener('click', () => {
        this.gavetaAbas.forEach((a) => {
          a.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        const alvo = aba.dataset.gaveta;
        Object.keys(this.secoesGaveta).forEach((chave) => {
          this.secoesGaveta[chave].hidden = chave !== alvo;
        });
      });
    });
    this.gavetaBotaoEditar.addEventListener('click', () => {
      if (!this.colaboradorSelecionado) return;
      this.abrirEdicaoColaborador(this.colaboradorSelecionado);
    });
    this.gavetaBotaoStatus.addEventListener('click', this.alterarStatusColaborador.bind(this));
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
  }

  async carregarExemplos() {
    const r = await chamarApi('/api/pessoas/seed-exemplos', {
      metodo: 'POST'
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao carregar exemplos.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarColaboradores();
  }

  novoColaborador() {
    this.modalTitulo.textContent = 'Novo colaborador';
    this.formColab.reset();
    this.colabId.value = '';
    this.camposCnh.hidden = true;
    document.querySelectorAll('input[name="cat"]').forEach((c) => {
      c.checked = false;
    });
    this.modalColab.hidden = false;
    this.colabNome.focus();
  }

  async salvarColaborador(e) {
    e.preventDefault();
    const id = this.colabId.value;
    const temCnh = this.colabTemCnh.checked;
    const cats = [];
    if (temCnh) {
      document.querySelectorAll('input[name="cat"]:checked').forEach((chk) => {
        cats.push(chk.value);
      });
    }
    const corpo = {
      nome: this.colabNome.value,
      matricula: this.colabMatricula.value,
      cargo: this.colabCargo.value,
      obra: this.colabObra.value,
      telefone: this.colabTelefone.value,
      cnh_categorias: temCnh ? cats.join(',') : '',
      cnh_validade: temCnh ? this.colabCnhValidade.value : ''
    };
    const metodo = id ? 'PUT' : 'POST';
    const endpoint = id ? '/api/pessoas/' + id : '/api/pessoas';
    const r = await chamarApi(endpoint, {
      metodo: metodo,
      corpo: corpo
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao salvar colaborador.', 'erro');
      return;
    }
    this.fecharModalColab();
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.carregarColaboradores();
    if (this.colaboradorSelecionado && this.colaboradorSelecionado.id === Number(id)) {
      this.abrirHistoricoColaborador(id);
    }
  }

  async alterarStatusColaborador() {
    if (!this.colaboradorSelecionado) return;
    const novoAtivo = this.colaboradorSelecionado.ativo === 1 ? 0 : 1;
    const r = await chamarApi('/api/pessoas/' + this.colaboradorSelecionado.id + '/status', {
      metodo: 'PUT',
      corpo: {
        ativo: novoAtivo
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharGavetaColab();
    this.carregarColaboradores();
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

  tagCnh(info) {
    if (info.status === 'valida') {
      return (
        '<span class="status-tag status-ativo"><span class="status-ponto"></span>' +
        info.rotulo +
        '</span>'
      );
    }
    if (info.status === 'vencendo') {
      return (
        '<span class="status-tag status-atencao"><span class="status-ponto"></span>' +
        info.rotulo +
        '</span>'
      );
    }
    if (info.status === 'vencida') {
      return (
        '<span class="status-tag status-problema"><span class="status-ponto"></span>' +
        info.rotulo +
        '</span>'
      );
    }
    return '<span class="status-tag status-concluido"><span class="status-ponto"></span>Sem CNH</span>';
  }

  desenharTabela(lista) {
    this.listaColaboradores.innerHTML = '';
    if (lista.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'texto-vazio';
      td.textContent = 'Nenhum colaborador encontrado para os filtros selecionados.';
      tr.appendChild(td);
      this.listaColaboradores.appendChild(tr);
      return;
    }
    lista.forEach((c) => {
      const tr = document.createElement('tr');
      if (c.ativo === 0) tr.className = 'colab-inativo';
      const tdColab = document.createElement('td');
      const boxColab = document.createElement('div');
      boxColab.className = 'colab-celula';
      const avatar = document.createElement('div');
      avatar.className = 'colab-avatar';
      avatar.textContent = this.pegarIniciais(c.nome);
      const dadosNome = document.createElement('div');
      dadosNome.className = 'colab-dados-nome';
      const spanNome = document.createElement('button');
      spanNome.type = 'button';
      spanNome.className = 'colab-nome';
      spanNome.textContent = c.nome;
      spanNome.addEventListener('click', () => {
        this.abrirHistoricoColaborador(c.id);
      });
      const spanMatricula = document.createElement('span');
      spanMatricula.className = 'colab-matricula';
      spanMatricula.textContent = c.matricula + (c.ativo === 0 ? ' · (Inativo)' : '');
      dadosNome.appendChild(spanNome);
      dadosNome.appendChild(spanMatricula);
      boxColab.appendChild(avatar);
      boxColab.appendChild(dadosNome);
      tdColab.appendChild(boxColab);
      const tdCargo = document.createElement('td');
      const pCargo = document.createElement('div');
      pCargo.className = 'colab-cargo';
      pCargo.textContent = c.cargo;
      tdCargo.appendChild(pCargo);

      // CNH
      const tdCnh = document.createElement('td');
      const boxCnh = document.createElement('div');
      boxCnh.className = 'cnh-celula';

      // na lista so aparece a categoria; a etiqueta colorida fica pra CNH vencendo ou vencida
      const cat = document.createElement('span');
      cat.className = 'cnh-texto';
      cat.textContent = c.cnh_categorias ? 'Cat. ' + c.cnh_categorias : '—';
      boxCnh.appendChild(cat);
      if (c.cnh_info.status === 'vencendo' || c.cnh_info.status === 'vencida') {
        const spanTag = document.createElement('div');
        spanTag.innerHTML = this.tagCnh(c.cnh_info);
        boxCnh.appendChild(spanTag);
      }
      tdCnh.appendChild(boxCnh);
      const tdSituacao = document.createElement('td');
      const boxSit = document.createElement('div');
      boxSit.className = 'situacao-celula';
      if (c.alojamento_atual) {
        const divAloj = document.createElement('div');
        divAloj.className = 'situacao-alojamento';
        divAloj.textContent = c.alojamento_atual.alojamento + ' · ' + c.alojamento_atual.leito;
        boxSit.appendChild(divAloj);
      }
      if (c.veiculo_atual) {
        const divVeic = document.createElement('div');
        divVeic.className = 'situacao-veiculo';
        divVeic.textContent = c.veiculo_atual.modelo + ' · ' + c.veiculo_atual.placa;
        boxSit.appendChild(divVeic);
      }
      if (!c.alojamento_atual && !c.veiculo_atual) {
        const divLivre = document.createElement('div');
        divLivre.className = 'situacao-livre';
        divLivre.textContent = '—';
        boxSit.appendChild(divLivre);
      }
      tdSituacao.appendChild(boxSit);
      const tdAcoes = document.createElement('td');
      tdAcoes.className = 'coluna-acoes';
      const boxAcoes = document.createElement('div');
      boxAcoes.className = 'botoes-acoes';
      const btnHist = document.createElement('button');
      btnHist.type = 'button';
      btnHist.className = 'btn-secundario btn-pequeno';
      btnHist.textContent = 'Histórico';
      btnHist.addEventListener('click', () => {
        this.abrirHistoricoColaborador(c.id);
      });
      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn-secundario btn-pequeno';
      btnEditar.textContent = 'Editar';
      btnEditar.addEventListener('click', () => {
        this.abrirEdicaoColaborador(c);
      });
      boxAcoes.appendChild(btnHist);
      boxAcoes.appendChild(btnEditar);
      tdAcoes.appendChild(boxAcoes);
      tr.appendChild(tdColab);
      tr.appendChild(tdCargo);
      tr.appendChild(tdCnh);
      tr.appendChild(tdSituacao);
      tr.appendChild(tdAcoes);
      this.listaColaboradores.appendChild(tr);
    });
  }

  async carregarColaboradores() {
    const status = this.seletorStatusAtivo.value;
    const busca = encodeURIComponent(this.campoBusca.value.trim());
    const cnh = this.filtroCnhAtual;
    try {
      const res = await chamarApi(
        '/api/pessoas?status=' + status + '&cnh=' + cnh + '&busca=' + busca
      );
      if (!res.ok) {
        this.mostrarToast(res.dados.erro || 'Erro ao carregar colaboradores.', 'erro');
        return;
      }
      const totais = res.dados.totais;
      this.colaboradoresCache = res.dados.colaboradores || [];
      this.subtituloContagem.textContent =
        totais.ativos +
        ' ativos · ' +
        totais.comCnh +
        ' habilitados · ' +
        totais.emTransito +
        ' em trânsito';
      this.kpiTotalAtivos.textContent = totais.ativos;
      this.kpiComCnh.textContent = totais.comCnh;
      this.kpiPctCnh.textContent =
        totais.total > 0 ? Math.round((totais.comCnh / totais.total) * 100) + '% da equipe' : '0%';
      this.kpiCnhAlerta.textContent = totais.cnhAlerta;
      this.kpiAlojados.textContent = totais.alojados;
      this.kpiEmTransito.textContent = totais.emTransito + ' com veículo da frota';
      if (totais.total === 0) {
        this.botaoSeed.hidden = false;
      } else {
        this.botaoSeed.hidden = true;
      }
      this.desenharTabela(this.colaboradoresCache);
    } catch (erro) {
      this.mostrarToast('Sem conexão com o servidor.', 'erro');
    }
  }

  fecharModalColab() {
    this.modalColab.hidden = true;
  }

  abrirEdicaoColaborador(c) {
    this.modalTitulo.textContent = 'Editar colaborador';
    this.colabId.value = c.id;
    this.colabNome.value = c.nome;
    this.colabMatricula.value = c.matricula;
    this.colabCargo.value = c.cargo;
    this.colabObra.value = c.obra;
    this.colabTelefone.value = c.telefone || '';
    if (c.cnh_categorias) {
      this.colabTemCnh.checked = true;
      this.camposCnh.hidden = false;
      this.colabCnhValidade.value = c.cnh_validade || '';
      const cats = c.cnh_categorias.split(',');
      document.querySelectorAll('input[name="cat"]').forEach((chk) => {
        chk.checked = cats.indexOf(chk.value) !== -1;
      });
    } else {
      this.colabTemCnh.checked = false;
      this.camposCnh.hidden = true;
      this.colabCnhValidade.value = '';
      document.querySelectorAll('input[name="cat"]').forEach((chk) => {
        chk.checked = false;
      });
    }
    this.modalColab.hidden = false;
    this.colabNome.focus();
  }

  fecharGavetaColab() {
    this.gavetaHistorico.hidden = true;
    this.colaboradorSelecionado = null;
  }

  async abrirHistoricoColaborador(id) {
    try {
      const res = await chamarApi('/api/pessoas/' + id);
      if (!res.ok) {
        this.mostrarToast(res.dados.erro || 'Erro ao carregar dados do colaborador.', 'erro');
        return;
      }
      const c = res.dados.colaborador;
      this.colaboradorSelecionado = c;
      this.gavetaAvatar.textContent = this.pegarIniciais(c.nome);
      this.gavetaNome.textContent = c.nome;
      this.gavetaSub.textContent = c.matricula + ' · ' + c.cargo;
      this.gavetaTel.textContent = c.telefone || 'Não informado';
      this.gavetaObra.textContent = c.obra || 'Sede';
      this.gavetaCnhCat.textContent = c.cnh_categorias
        ? 'Categoria(s) ' + c.cnh_categorias
        : 'Sem CNH cadastrada';
      this.gavetaCnhVal.textContent = c.cnh_validade
        ? c.cnh_validade.split('-').reverse().join('/')
        : '—';
      this.gavetaCnhTag.innerHTML = this.tagCnh(c.cnh_info);
      const estadias = res.dados.estadias || [];
      const estadiaAtual = estadias.find((e) => {
        return !e.fim;
      });
      if (estadiaAtual) {
        this.gavetaAtualAlojamento.textContent =
          estadiaAtual.alojamento + ' · Quarto ' + estadiaAtual.quarto;
        this.gavetaAtualDesde.textContent =
          'Leito ' +
          estadiaAtual.leito +
          ' desde ' +
          estadiaAtual.inicio.slice(0, 10).split('-').reverse().join('/');
      } else {
        this.gavetaAtualAlojamento.textContent = 'Não alojado no momento';
        this.gavetaAtualDesde.textContent = 'Sem estadia em aberto';
      }
      const viagensMotorista = res.dados.usos_motorista || [];
      const viagemAtual = viagensMotorista.find((u) => {
        return !u.retorno;
      });
      if (viagemAtual) {
        this.gavetaAtualVeiculo.textContent = viagemAtual.modelo + ' (' + viagemAtual.placa + ')';
        this.gavetaAtualDestino.textContent =
          'Destino: ' + viagemAtual.destino + ' · saída às ' + viagemAtual.saida.slice(11, 16);
      } else {
        this.gavetaAtualVeiculo.textContent = 'Nenhum veículo em posse';
        this.gavetaAtualDestino.textContent = 'Sem saída de veículo ativa';
      }
      this.contEstadias.textContent = estadias.length;
      this.gavetaListaEstadias.innerHTML = '';
      if (estadias.length === 0) {
        this.gavetaListaEstadias.innerHTML =
          '<p class="texto-vazio">Nenhuma estadia registrada no histórico deste colaborador.</p>';
      } else {
        estadias.forEach((e) => {
          const item = document.createElement('div');
          item.className = 'timeline-item' + (!e.fim ? ' timeline-ativo' : '');
          item.innerHTML =
            '<span class="timeline-titulo">' +
            e.alojamento +
            ' · Quarto ' +
            e.quarto +
            ' (Leito ' +
            e.leito +
            ')</span>' +
            '<span class="timeline-detalhe">' +
            (!e.fim ? 'Estadia atual (em andamento)' : 'Saída registrada') +
            '</span>' +
            '<span class="timeline-data">Entrada: ' +
            e.inicio.slice(0, 16) +
            (e.fim ? ' | Saída: ' + e.fim.slice(0, 16) : '') +
            '</span>';
          this.gavetaListaEstadias.appendChild(item);
        });
      }

      // preenche abas de frota (motorista e passageiro)
      const viagensPassageiro = res.dados.usos_passageiro || [];
      this.contViagens.textContent = viagensMotorista.length + viagensPassageiro.length;
      this.gavetaListaMotorista.innerHTML = '';
      if (viagensMotorista.length === 0) {
        this.gavetaListaMotorista.innerHTML =
          '<p class="texto-vazio">Nenhum registro de condução como motorista.</p>';
      } else {
        viagensMotorista.forEach((u) => {
          const item = document.createElement('div');
          item.className = 'timeline-item' + (!u.retorno ? ' timeline-ativo' : '');
          item.innerHTML =
            '<span class="timeline-titulo">' +
            u.modelo +
            ' · Placa ' +
            u.placa +
            '</span>' +
            '<span class="timeline-detalhe">Destino: ' +
            u.destino +
            (u.km_rodados !== null ? ' (' + u.km_rodados + ' km percorridos)' : ' (Em trânsito)') +
            '</span>' +
            '<span class="timeline-data">Saída: ' +
            u.saida.slice(0, 16) +
            (u.retorno ? ' | Volta: ' + u.retorno.slice(0, 16) : '') +
            '</span>';
          this.gavetaListaMotorista.appendChild(item);
        });
      }
      this.gavetaListaPassageiro.innerHTML = '';
      if (viagensPassageiro.length === 0) {
        this.gavetaListaPassageiro.innerHTML =
          '<p class="texto-vazio">Nenhuma viagem como passageiro registrada.</p>';
      } else {
        viagensPassageiro.forEach((up) => {
          const item = document.createElement('div');
          item.className = 'timeline-item';
          item.innerHTML =
            '<span class="timeline-titulo">' +
            up.modelo +
            ' (' +
            up.placa +
            ')</span>' +
            '<span class="timeline-detalhe">Motorista: ' +
            up.motorista +
            ' · Destino: ' +
            up.destino +
            '</span>' +
            '<span class="timeline-data">Data: ' +
            up.saida.slice(0, 16) +
            '</span>';
          this.gavetaListaPassageiro.appendChild(item);
        });
      }
      this.gavetaBotaoStatus.textContent =
        c.ativo === 1 ? 'Desativar colaborador' : 'Reativar colaborador';
      this.gavetaHistorico.hidden = false;
    } catch (erro) {
      this.mostrarToast('Não foi possível abrir o histórico.', 'erro');
    }
  }

  async iniciar() {
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
      const resCfg = await chamarApi('/api/configuracoes');
      if (resCfg.ok && resCfg.dados.parametros && resCfg.dados.parametros.nomeEmpresa) {
        this.nomeEmpresaMenu.textContent = resCfg.dados.parametros.nomeEmpresa;
      }
      this.carregarColaboradores();
    } catch (e) {
      this.carregarColaboradores();
    }
  }
}
new TelaColaboradores();
