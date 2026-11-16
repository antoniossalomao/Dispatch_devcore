// Tela de colaboradores: listagem, busca, filtros de CNH, cadastro/edição no modal e histórico na gaveta lateral.
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
    this.ehAdmin = false;
    this.timerToast = null;

    this.configurarEventos();
    this.iniciar();
  }

  configurarEventos() {
    this.campoBusca.addEventListener('input', this.carregarColaboradores.bind(this));
    this.seletorStatusAtivo.addEventListener('change', this.carregarColaboradores.bind(this));

    this.abasFiltroCnh.forEach((aba) => {
      aba.addEventListener('click', () => {
        this.abasFiltroCnh.forEach((outra) => {
          outra.classList.remove('ativa');
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
        this.gavetaAbas.forEach((outra) => {
          outra.classList.remove('ativa');
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
      await chamarApi('/api/auth/sair', { metodo: 'POST' });
      window.location.href = 'index.html';
    });
  }

  async carregarExemplos() {
    const resposta = await chamarApi('/api/pessoas/seed-exemplos', { metodo: 'POST' });
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao carregar exemplos.', 'erro');
      return;
    }
    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.carregarColaboradores();
  }

  novoColaborador() {
    this.modalTitulo.textContent = 'Novo colaborador';
    this.formColab.reset();
    this.colabId.value = '';
    this.camposCnh.hidden = true;
    document.querySelectorAll('input[name="cat"]').forEach((checkbox) => {
      checkbox.checked = false;
    });
    this.modalColab.hidden = false;
    this.colabNome.focus();
  }

  async salvarColaborador(evento) {
    evento.preventDefault();
    const id = this.colabId.value;
    const temCnh = this.colabTemCnh.checked;
    const categorias = [];

    if (temCnh) {
      document.querySelectorAll('input[name="cat"]:checked').forEach((checkbox) => {
        categorias.push(checkbox.value);
      });
    }

    const corpo = {
      nome: this.colabNome.value,
      matricula: this.colabMatricula.value,
      cargo: this.colabCargo.value,
      obra: this.colabObra.value,
      telefone: this.colabTelefone.value,
      cnh_categorias: temCnh ? categorias.join(',') : '',
      cnh_validade: temCnh ? this.colabCnhValidade.value : ''
    };

    // O mesmo formulário cria um colaborador novo (POST) ou atualiza quem já tinha id (PUT).
    const metodo = id ? 'PUT' : 'POST';
    const endpoint = id ? '/api/pessoas/' + id : '/api/pessoas';
    const resposta = await chamarApi(endpoint, {
      metodo: metodo,
      corpo: corpo
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao salvar colaborador.', 'erro');
      return;
    }

    this.fecharModalColab();
    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.carregarColaboradores();
    if (this.colaboradorSelecionado && this.colaboradorSelecionado.id === Number(id)) {
      this.abrirHistoricoColaborador(id);
    }
  }

  async alterarStatusColaborador() {
    if (!this.colaboradorSelecionado) return;
    const novoAtivo = this.colaboradorSelecionado.ativo === 1 ? 0 : 1;
    const resposta = await chamarApi('/api/pessoas/' + this.colaboradorSelecionado.id + '/status', {
      metodo: 'PUT',
      corpo: { ativo: novoAtivo }
    });
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }
    this.mostrarToast(resposta.dados.mensagem, 'ok');
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

  infoCnhVisual(info) {
    if (info && info.status === 'valida') {
      return { classe: 'status-ativo', texto: info.rotulo || 'Válida' };
    }
    if (info && info.status === 'vencendo') {
      return { classe: 'status-atencao', texto: info.rotulo || 'Vencendo' };
    }
    if (info && info.status === 'vencida') {
      return { classe: 'status-problema', texto: info.rotulo || 'Vencida' };
    }
    return { classe: 'status-concluido', texto: 'Sem CNH' };
  }

  criarTagCnh(info) {
    const visual = this.infoCnhVisual(info);
    const tag = document.createElement('span');
    tag.className = 'status-tag ' + visual.classe;
    const ponto = document.createElement('span');
    ponto.className = 'status-ponto';
    tag.appendChild(ponto);
    tag.appendChild(document.createTextNode(visual.texto));
    return tag;
  }

  criarItemTimeline(titulo, detalhe, data, ativo) {
    const item = document.createElement('div');
    item.className = 'timeline-item' + (ativo ? ' timeline-ativo' : '');

    const spanTitulo = document.createElement('span');
    spanTitulo.className = 'timeline-titulo';
    spanTitulo.textContent = titulo;

    const spanDetalhe = document.createElement('span');
    spanDetalhe.className = 'timeline-detalhe';
    spanDetalhe.textContent = detalhe;

    const spanData = document.createElement('span');
    spanData.className = 'timeline-data';
    spanData.textContent = data;

    item.appendChild(spanTitulo);
    item.appendChild(spanDetalhe);
    item.appendChild(spanData);
    return item;
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

    lista.forEach((colab) => {
      const tr = document.createElement('tr');
      if (colab.ativo === 0) tr.className = 'colab-inativo';

      const tdColab = document.createElement('td');
      const boxColab = document.createElement('div');
      boxColab.className = 'colab-celula';

      const avatar = document.createElement('div');
      avatar.className = 'colab-avatar';
      avatar.textContent = this.pegarIniciais(colab.nome);

      const dadosNome = document.createElement('div');
      dadosNome.className = 'colab-dados-nome';

      const botaoNome = document.createElement('button');
      botaoNome.type = 'button';
      botaoNome.className = 'colab-nome';
      botaoNome.textContent = colab.nome;
      botaoNome.addEventListener('click', () => {
        this.abrirHistoricoColaborador(colab.id);
      });

      const spanMatricula = document.createElement('span');
      spanMatricula.className = 'colab-matricula';
      spanMatricula.textContent = colab.matricula + (colab.ativo === 0 ? ' · (Inativo)' : '');

      dadosNome.appendChild(botaoNome);
      dadosNome.appendChild(spanMatricula);
      boxColab.appendChild(avatar);
      boxColab.appendChild(dadosNome);
      tdColab.appendChild(boxColab);

      const tdCargo = document.createElement('td');
      const divCargo = document.createElement('div');
      divCargo.className = 'colab-cargo';
      divCargo.textContent = colab.cargo;
      tdCargo.appendChild(divCargo);

      const tdCnh = document.createElement('td');
      const boxCnh = document.createElement('div');
      boxCnh.className = 'cnh-celula';

      // Na tabela mostramos só a categoria; a etiqueta colorida aparece só se estiver vencendo ou vencida.
      const cat = document.createElement('span');
      cat.className = 'cnh-texto';
      cat.textContent = colab.cnh_categorias ? 'Cat. ' + colab.cnh_categorias : '—';
      boxCnh.appendChild(cat);

      if (colab.cnh_info.status === 'vencendo' || colab.cnh_info.status === 'vencida') {
        const divTag = document.createElement('div');
        divTag.appendChild(this.criarTagCnh(colab.cnh_info));
        boxCnh.appendChild(divTag);
      }
      tdCnh.appendChild(boxCnh);

      const tdSituacao = document.createElement('td');
      const boxSit = document.createElement('div');
      boxSit.className = 'situacao-celula';

      if (colab.alojamento_atual) {
        const divAloj = document.createElement('div');
        divAloj.className = 'situacao-alojamento';
        divAloj.textContent = colab.alojamento_atual.alojamento + ' · ' + colab.alojamento_atual.leito;
        boxSit.appendChild(divAloj);
      }
      if (colab.veiculo_atual) {
        const divVeic = document.createElement('div');
        divVeic.className = 'situacao-veiculo';
        divVeic.textContent = colab.veiculo_atual.modelo + ' · ' + colab.veiculo_atual.placa;
        boxSit.appendChild(divVeic);
      }
      if (!colab.alojamento_atual && !colab.veiculo_atual) {
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
        this.abrirHistoricoColaborador(colab.id);
      });

      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn-secundario btn-pequeno';
      btnEditar.textContent = 'Editar';
      btnEditar.addEventListener('click', () => {
        this.abrirEdicaoColaborador(colab);
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
      const resposta = await chamarApi(
        '/api/pessoas?status=' + status + '&cnh=' + cnh + '&busca=' + busca
      );
      if (!resposta.ok) {
        this.mostrarToast(resposta.dados.erro || 'Erro ao carregar colaboradores.', 'erro');
        return;
      }

      const totais = resposta.dados.totais;
      this.colaboradoresCache = resposta.dados.colaboradores || [];

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

      // Só o admin vê o botão de gerar colaboradores de exemplo quando a base ainda estiver vazia.
      this.botaoSeed.hidden = !(this.ehAdmin && totais.total === 0);

      this.desenharTabela(this.colaboradoresCache);
    } catch (erro) {
      this.mostrarToast('Sem conexão com o servidor.', 'erro');
    }
  }

  fecharModalColab() {
    this.modalColab.hidden = true;
  }

  abrirEdicaoColaborador(colab) {
    this.modalTitulo.textContent = 'Editar colaborador';
    this.colabId.value = colab.id;
    this.colabNome.value = colab.nome;
    this.colabMatricula.value = colab.matricula;
    this.colabCargo.value = colab.cargo;
    this.colabObra.value = colab.obra;
    this.colabTelefone.value = colab.telefone || '';

    if (colab.cnh_categorias) {
      this.colabTemCnh.checked = true;
      this.camposCnh.hidden = false;
      this.colabCnhValidade.value = colab.cnh_validade || '';
      const categorias = colab.cnh_categorias.split(',');
      document.querySelectorAll('input[name="cat"]').forEach((checkbox) => {
        checkbox.checked = categorias.indexOf(checkbox.value) !== -1;
      });
    } else {
      this.colabTemCnh.checked = false;
      this.camposCnh.hidden = true;
      this.colabCnhValidade.value = '';
      document.querySelectorAll('input[name="cat"]').forEach((checkbox) => {
        checkbox.checked = false;
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
      const resposta = await chamarApi('/api/pessoas/' + id);
      if (!resposta.ok) {
        this.mostrarToast(resposta.dados.erro || 'Erro ao carregar dados do colaborador.', 'erro');
        return;
      }

      const colab = resposta.dados.colaborador;
      this.colaboradorSelecionado = colab;
      this.gavetaAvatar.textContent = this.pegarIniciais(colab.nome);
      this.gavetaNome.textContent = colab.nome;
      this.gavetaSub.textContent = colab.matricula + ' · ' + colab.cargo;
      this.gavetaTel.textContent = colab.telefone || 'Não informado';
      this.gavetaObra.textContent = colab.obra || 'Sede';
      this.gavetaCnhCat.textContent = colab.cnh_categorias
        ? 'Categoria(s) ' + colab.cnh_categorias
        : 'Sem CNH cadastrada';
      this.gavetaCnhVal.textContent = colab.cnh_validade
        ? colab.cnh_validade.split('-').reverse().join('/')
        : '—';

      const visualCnh = this.infoCnhVisual(colab.cnh_info);
      this.gavetaCnhTag.className = 'status-tag ' + visualCnh.classe;
      this.gavetaCnhTag.textContent = '';
      const pontoCnh = document.createElement('span');
      pontoCnh.className = 'status-ponto';
      this.gavetaCnhTag.appendChild(pontoCnh);
      this.gavetaCnhTag.appendChild(document.createTextNode(visualCnh.texto));

      const estadias = resposta.dados.estadias || [];
      const estadiaAtual = estadias.find((estadia) => !estadia.fim);
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

      const viagensMotorista = resposta.dados.usos_motorista || [];
      const viagemAtual = viagensMotorista.find((viagem) => !viagem.retorno);
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
        estadias.forEach((estadia) => {
          this.gavetaListaEstadias.appendChild(
            this.criarItemTimeline(
              estadia.alojamento + ' · Quarto ' + estadia.quarto + ' (Leito ' + estadia.leito + ')',
              !estadia.fim ? 'Estadia atual (em andamento)' : 'Saída registrada',
              'Entrada: ' +
                estadia.inicio.slice(0, 16) +
                (estadia.fim ? ' | Saída: ' + estadia.fim.slice(0, 16) : ''),
              !estadia.fim
            )
          );
        });
      }

      const viagensPassageiro = resposta.dados.usos_passageiro || [];
      this.contViagens.textContent = viagensMotorista.length + viagensPassageiro.length;
      this.gavetaListaMotorista.innerHTML = '';
      if (viagensMotorista.length === 0) {
        this.gavetaListaMotorista.innerHTML =
          '<p class="texto-vazio">Nenhum registro de condução como motorista.</p>';
      } else {
        viagensMotorista.forEach((viagem) => {
          this.gavetaListaMotorista.appendChild(
            this.criarItemTimeline(
              viagem.modelo + ' · Placa ' + viagem.placa,
              'Destino: ' +
                viagem.destino +
                (viagem.km_rodados !== null
                  ? ' (' + viagem.km_rodados + ' km percorridos)'
                  : ' (Em trânsito)'),
              'Saída: ' +
                viagem.saida.slice(0, 16) +
                (viagem.retorno ? ' | Volta: ' + viagem.retorno.slice(0, 16) : ''),
              !viagem.retorno
            )
          );
        });
      }

      this.gavetaListaPassageiro.innerHTML = '';
      if (viagensPassageiro.length === 0) {
        this.gavetaListaPassageiro.innerHTML =
          '<p class="texto-vazio">Nenhuma viagem como passageiro registrada.</p>';
      } else {
        viagensPassageiro.forEach((viagemPass) => {
          this.gavetaListaPassageiro.appendChild(
            this.criarItemTimeline(
              viagemPass.modelo + ' (' + viagemPass.placa + ')',
              'Motorista: ' + viagemPass.motorista + ' · Destino: ' + viagemPass.destino,
              'Data: ' + viagemPass.saida.slice(0, 16),
              false
            )
          );
        });
      }

      this.gavetaBotaoStatus.textContent =
        colab.ativo === 1 ? 'Desativar colaborador' : 'Reativar colaborador';
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

      const usuario = sessao.dados.usuario;
      this.perfilNome.textContent = usuario.nome;
      this.perfilTipo.textContent = usuario.perfil;
      this.usuarioIniciais.textContent = this.pegarIniciais(usuario.nome);
      this.ehAdmin = usuario.perfil === 'admin';
      if (this.ehAdmin) {
        this.blocoMenuAdmin.hidden = false;
      }
      if (sessao.dados.nomeEmpresa) {
        this.nomeEmpresaMenu.textContent = sessao.dados.nomeEmpresa;
      }
      this.carregarColaboradores();
    } catch (erro) {
      this.carregarColaboradores();
    }
  }
}

new TelaColaboradores();
