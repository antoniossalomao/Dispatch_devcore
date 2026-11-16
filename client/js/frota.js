// Tela da frota: cadastro de veículos, registro de saída/retorno com validação de CNH e histórico de manutenções.
export default class TelaFrota {
  // ctx vem da casca (js/app/App.js): sessão em cache, sinal para soltar eventos globais ao sair da tela e navegação sem recarregar.
  constructor(ctx) {
    this.ctx = ctx;
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.toast = document.getElementById('toast-frota');
    this.timerToast = null;

    this.lista = document.getElementById('lista-veiculos');
    this.seletorStatus = document.getElementById('seletor-status');
    this.gaveta = document.getElementById('gaveta-veiculo');
    this.gavetaBotaoStatus = document.getElementById('gaveta-botao-status');
    this.secoesGaveta = {
      usos: document.getElementById('gaveta-secao-usos'),
      manutencoes: document.getElementById('gaveta-secao-manutencoes')
    };

    this.veiculosCache = [];
    this.detalheAtual = null;
    this.colaboradores = [];
    this.rotulosStatus = {
      disponivel: ['status-ativo', 'Disponível'],
      em_uso: ['status-uso', 'Em uso'],
      manutencao: ['status-atencao', 'Em manutenção']
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

    this.seletorStatus.addEventListener('change', this.carregarVeiculos.bind(this));

    document.getElementById('fechar-gaveta').addEventListener('click', () => {
      this.gaveta.hidden = true;
      this.detalheAtual = null;
    });

    document.querySelectorAll('.gaveta-aba').forEach((aba) => {
      aba.addEventListener('click', () => {
        document.querySelectorAll('.gaveta-aba').forEach((outra) => {
          outra.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        Object.keys(this.secoesGaveta).forEach((chave) => {
          this.secoesGaveta[chave].hidden = chave !== aba.dataset.gaveta;
        });
      });
    });

    document.getElementById('botao-novo-veiculo').addEventListener('click', () => {
      this.abrirFormVeiculo(null);
    });

    document.getElementById('gaveta-botao-editar').addEventListener('click', () => {
      if (this.detalheAtual) this.abrirFormVeiculo(this.detalheAtual.veiculo);
    });

    document
      .getElementById('form-veiculo')
      .addEventListener('submit', this.salvarVeiculo.bind(this));

    this.gavetaBotaoStatus.addEventListener('click', this.alterarStatusVeiculo.bind(this));

    document
      .getElementById('saida-veiculo')
      .addEventListener('change', this.preencherKmSaida.bind(this));

    document.getElementById('botao-saida-geral').addEventListener('click', () => {
      this.abrirSaida(null);
    });

    document
      .getElementById('form-saida')
      .addEventListener('submit', this.registrarSaida.bind(this));

    document
      .getElementById('form-volta')
      .addEventListener('submit', this.registrarRetorno.bind(this));

    document.getElementById('botao-nova-manutencao').addEventListener('click', () => {
      document.getElementById('form-manutencao').reset();
      if (this.detalheAtual) {
        document.getElementById('manut-km').value = this.detalheAtual.veiculo.km_atual;
      }
      this.abrirModal('modal-manutencao');
    });

    document
      .getElementById('form-manutencao')
      .addEventListener('submit', this.salvarManutencao.bind(this));


    document.querySelectorAll('.menu-em-breve').forEach((link) => {
      link.addEventListener('click', (evento) => {
        evento.preventDefault();
        this.mostrarToast('Módulo "' + link.dataset.tela + '" em construção.', 'ok');
      });
    });
  }

  async salvarVeiculo(evento) {
    evento.preventDefault();
    const id = document.getElementById('veic-id').value;
    const corpo = {
      placa: document.getElementById('veic-placa').value,
      modelo: document.getElementById('veic-modelo').value,
      lugares: document.getElementById('veic-lugares').value,
      categoria_cnh_exigida: document.getElementById('veic-categoria').value,
      km_inicial: document.getElementById('veic-km').value,
      licenciamento_validade: document.getElementById('veic-licenciamento').value,
      seguro_validade: document.getElementById('veic-seguro').value
    };

    const resposta = await chamarApi(id ? '/api/frota/' + id : '/api/frota', {
      metodo: id ? 'PUT' : 'POST',
      corpo: corpo
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao salvar.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-veiculo');
    this.recarregarTudo();
  }

  async alterarStatusVeiculo() {
    if (!this.detalheAtual) return;
    const veiculo = this.detalheAtual.veiculo;
    const resposta = await chamarApi('/api/frota/' + veiculo.id + '/status', {
      metodo: 'PUT',
      corpo: { ativo: veiculo.ativo === 1 ? 0 : 1 }
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async registrarSaida(evento) {
    evento.preventDefault();
    const passageiros = Array.from(document.querySelectorAll('#saida-passageiros input:checked')).map(
      (checkbox) => Number(checkbox.value)
    );

    const resposta = await chamarApi('/api/frota/usos', {
      metodo: 'POST',
      corpo: {
        veiculo_id: Number(document.getElementById('saida-veiculo').value),
        motorista_id: Number(document.getElementById('saida-motorista').value),
        destino: document.getElementById('saida-destino').value,
        km_saida: Number(document.getElementById('saida-km').value),
        passageiros: passageiros
      }
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao registrar saída.', 'erro');
      return;
    }

    const avisos = resposta.dados.avisos || [];
    this.mostrarToast(
      resposta.dados.mensagem + (avisos.length ? ' Atenção: ' + avisos.join(' ') : ''),
      avisos.length ? 'erro' : 'ok'
    );
    this.fecharModal('modal-saida');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async registrarRetorno(evento) {
    evento.preventDefault();
    const id = document.getElementById('volta-uso-id').value;
    const corpo = {
      km_retorno: Number(document.getElementById('volta-km').value)
    };

    let resposta = await chamarApi('/api/frota/usos/' + id + '/retorno', {
      metodo: 'PUT',
      corpo: corpo
    });

    // Quando o km rodado fica muito acima do esperado, o servidor devolve status 409 pedindo confirmação.
    if (resposta.status === 409 && resposta.dados.confirmar) {
      const confirmado = await confirmar(resposta.dados.erro, {
        titulo: 'Confirmar viagem longa',
        confirmar: 'Confirmar km'
      });
      if (!confirmado) return;

      corpo.confirmar = true;
      resposta = await chamarApi('/api/frota/usos/' + id + '/retorno', {
        metodo: 'PUT',
        corpo: corpo
      });
    }

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao registrar volta.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-volta');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async salvarManutencao(evento) {
    evento.preventDefault();
    const resposta = await chamarApi('/api/frota/' + this.detalheAtual.veiculo.id + '/manutencoes', {
      metodo: 'POST',
      corpo: {
        tipo: document.getElementById('manut-tipo').value,
        descricao: document.getElementById('manut-descricao').value,
        km: document.getElementById('manut-km').value
      }
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao abrir manutenção.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-manutencao');
    this.recarregarTudo();
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

  tagDoc(rotulo, doc) {
    if (doc.status === 'vencido') {
      return (
        '<span class="status-tag status-problema"><span class="status-ponto"></span>' +
        rotulo +
        ' vencido</span>'
      );
    }
    if (doc.status === 'vencendo') {
      return (
        '<span class="status-tag status-atencao"><span class="status-ponto"></span>' +
        rotulo +
        ' em ' +
        doc.dias +
        'd</span>'
      );
    }
    if (doc.status === 'sem_data') return '<span class="doc-linha">' + rotulo + ': sem data</span>';
    return '';
  }

  celulaDocs(veiculo) {
    const tags =
      this.tagDoc('Licenciamento', veiculo.licenciamento) + this.tagDoc('Seguro', veiculo.seguro);
    return tags || '<span class="doc-linha">Em dia</span>';
  }

  formatarData(texto) {
    return texto ? texto.slice(0, 16).replace('T', ' ') : '';
  }

  async carregarVeiculos() {
    const resposta = await chamarApi('/api/frota?status=' + this.seletorStatus.value);
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao carregar a frota.', 'erro');
      return;
    }

    this.veiculosCache = resposta.dados.veiculos;
    const totais = resposta.dados.totais;
    document.getElementById('kpi-disponiveis').textContent = totais.disponiveis;
    document.getElementById('kpi-total').textContent = 'de ' + totais.total + ' veículos';
    document.getElementById('kpi-em-uso').textContent = totais.emUso;
    document.getElementById('kpi-manutencao').textContent = totais.manutencao;
    document.getElementById('kpi-docs').textContent = totais.docsAtencao;

    this.lista.innerHTML = '';
    if (this.veiculosCache.length === 0) {
      this.lista.innerHTML =
        '<tr><td colspan="6" class="texto-vazio">Nenhum veículo encontrado.</td></tr>';
      return;
    }

    this.veiculosCache.forEach((veiculo) => {
      const tr = document.createElement('tr');
      if (veiculo.ativo === 0) tr.className = 'colab-inativo';
      const estado = this.rotulosStatus[veiculo.status];

      tr.innerHTML =
        '<td><div class="veic-celula"><span class="veic-modelo">' +
        this.esc(veiculo.modelo) +
        '</span><span class="veic-placa"><span class="placa">' +
        this.esc(veiculo.placa) +
        '</span></span></div></td>' +
        '<td><span class="status-tag ' +
        estado[0] +
        '"><span class="status-ponto"></span>' +
        estado[1] +
        '</span></td>' +
        '<td class="num">' +
        veiculo.km_atual.toLocaleString('pt-BR') +
        ' km</td>' +
        '<td><div class="docs-celula">' +
        this.celulaDocs(veiculo) +
        '</div></td>' +
        '<td class="uso-celula">' +
        (veiculo.uso_atual
          ? this.esc(veiculo.uso_atual.motorista) +
            '<span>' +
            this.esc(veiculo.uso_atual.destino) +
            '</span>'
          : '<span>—</span>') +
        '</td>';

      const tdAcoes = document.createElement('td');
      tdAcoes.className = 'coluna-acoes';
      const box = document.createElement('div');
      box.className = 'botoes-acoes';

      if (veiculo.status === 'disponivel' && veiculo.ativo === 1) {
        box.appendChild(
          this.botao('Saída', () => {
            this.abrirSaida(veiculo.id);
          })
        );
      }
      if (veiculo.status === 'em_uso') {
        box.appendChild(
          this.botao('Volta', () => {
            this.abrirVolta(veiculo);
          })
        );
      }
      box.appendChild(
        this.botao('Detalhes', () => {
          this.abrirGaveta(veiculo.id);
        })
      );

      tdAcoes.appendChild(box);
      tr.appendChild(tdAcoes);
      this.lista.appendChild(tr);
    });
  }

  botao(texto, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-secundario btn-pequeno';
    botao.textContent = texto;
    botao.addEventListener('click', aoClicar);
    return botao;
  }

  async abrirGaveta(id) {
    const resposta = await chamarApi('/api/frota/' + id);
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Não foi possível abrir o veículo.', 'erro');
      return;
    }
    this.detalheAtual = resposta.dados;
    this.desenharGaveta();
    this.gaveta.hidden = false;
  }

  desenharGaveta() {
    const veiculo = this.detalheAtual.veiculo;
    document.getElementById('gaveta-veic-nome').textContent = veiculo.modelo + ' · ' + veiculo.placa;
    document.getElementById('gaveta-veic-sub').textContent =
      veiculo.lugares +
      ' lugares · CNH ' +
      veiculo.categoria_cnh_exigida +
      ' · ' +
      veiculo.km_atual.toLocaleString('pt-BR') +
      ' km';
    this.gavetaBotaoStatus.textContent = veiculo.ativo === 1 ? 'Desativar' : 'Reativar';

    document.getElementById('cont-usos').textContent = this.detalheAtual.usos.length;
    const listaUsos = document.getElementById('gaveta-lista-usos');
    listaUsos.innerHTML = '';
    if (this.detalheAtual.usos.length === 0) {
      listaUsos.innerHTML = '<p class="texto-vazio">Nenhum uso registrado.</p>';
    }

    this.detalheAtual.usos.forEach((uso) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!uso.retorno ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        this.esc(uso.motorista) +
        ' → ' +
        this.esc(uso.destino) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (uso.km_rodados !== null ? uso.km_rodados + ' km rodados' : 'Em trânsito') +
        (uso.passageiros.length ? ' · Passageiros: ' + this.esc(uso.passageiros.join(', ')) : '') +
        '</span>' +
        '<span class="timeline-data">Saída: ' +
        this.formatarData(uso.saida) +
        (uso.retorno ? ' | Volta: ' + this.formatarData(uso.retorno) : '') +
        '</span>';
      listaUsos.appendChild(item);
    });

    document.getElementById('cont-manut').textContent = this.detalheAtual.manutencoes.length;
    const listaManut = document.getElementById('gaveta-lista-manut');
    listaManut.innerHTML = '';
    if (this.detalheAtual.manutencoes.length === 0) {
      listaManut.innerHTML = '<p class="texto-vazio">Nenhuma manutenção registrada.</p>';
    }

    this.detalheAtual.manutencoes.forEach((manutencao) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!manutencao.fim ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        (manutencao.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva') +
        ' · ' +
        this.esc(manutencao.descricao) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (manutencao.km !== null ? manutencao.km.toLocaleString('pt-BR') + ' km · ' : '') +
        (manutencao.fim ? 'Concluída' : 'Na oficina') +
        '</span>' +
        '<span class="timeline-data">Início: ' +
        this.formatarData(manutencao.inicio) +
        (manutencao.fim ? ' | Fim: ' + this.formatarData(manutencao.fim) : '') +
        '</span>';

      if (!manutencao.fim) {
        const botaoConcluir = this.botao('Concluir', () => {
          this.concluirManutencao(manutencao);
        });
        botaoConcluir.classList.add('timeline-botoes');
        item.appendChild(botaoConcluir);
      }
      listaManut.appendChild(item);
    });
  }

  async recarregarTudo() {
    if (this.detalheAtual) {
      const resposta = await chamarApi('/api/frota/' + this.detalheAtual.veiculo.id);
      if (resposta.ok) {
        this.detalheAtual = resposta.dados;
        this.desenharGaveta();
      }
    }
    this.carregarVeiculos();
  }

  abrirFormVeiculo(veiculo) {
    document.getElementById('modal-veic-titulo').textContent = veiculo
      ? 'Editar veículo'
      : 'Novo veículo';
    document.getElementById('veic-id').value = veiculo ? veiculo.id : '';
    document.getElementById('veic-placa').value = veiculo ? veiculo.placa : '';
    document.getElementById('veic-modelo').value = veiculo ? veiculo.modelo : '';
    document.getElementById('veic-lugares').value = veiculo ? veiculo.lugares : '';
    document.getElementById('veic-categoria').value = veiculo
      ? veiculo.categoria_cnh_exigida
      : 'B';
    document.getElementById('veic-km').value = veiculo ? veiculo.km_inicial : 0;
    document.getElementById('veic-licenciamento').value =
      veiculo && veiculo.licenciamento_validade ? veiculo.licenciamento_validade : '';
    document.getElementById('veic-seguro').value =
      veiculo && veiculo.seguro_validade ? veiculo.seguro_validade : '';
    this.abrirModal('modal-veiculo');
  }

  abrirSaida(veiculoId) {
    const disponiveis = this.veiculosCache.filter(
      (veiculo) => veiculo.status === 'disponivel' && veiculo.ativo === 1
    );
    if (disponiveis.length === 0) {
      this.mostrarToast('Nenhum veículo disponível no momento.', 'erro');
      return;
    }

    const selectVeiculos = document.getElementById('saida-veiculo');
    selectVeiculos.innerHTML = '';
    disponiveis.forEach((veiculo) => {
      const opcao = document.createElement('option');
      opcao.value = veiculo.id;
      opcao.textContent = veiculo.modelo + ' · ' + veiculo.placa;
      selectVeiculos.appendChild(opcao);
    });
    if (veiculoId) selectVeiculos.value = String(veiculoId);

    const selectMotoristas = document.getElementById('saida-motorista');
    selectMotoristas.innerHTML = '';
    this.colaboradores
      .filter((colab) => colab.cnh_categorias)
      .forEach((colab) => {
        const opcao = document.createElement('option');
        opcao.value = colab.id;
        opcao.textContent =
          colab.nome + ' (CNH ' + colab.cnh_categorias + ')' + (colab.veiculo_atual ? ' · em viagem' : '');
        opcao.disabled = !!colab.veiculo_atual;
        selectMotoristas.appendChild(opcao);
      });

    const caixaPassageiros = document.getElementById('saida-passageiros');
    caixaPassageiros.innerHTML = '';
    this.colaboradores.forEach((colab) => {
      const rotulo = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = colab.id;
      checkbox.disabled = !!colab.veiculo_atual;
      rotulo.appendChild(checkbox);
      rotulo.appendChild(document.createTextNode(' ' + colab.nome));
      caixaPassageiros.appendChild(rotulo);
    });

    document.getElementById('saida-destino').value = '';
    this.preencherKmSaida();
    this.abrirModal('modal-saida');
  }

  preencherKmSaida() {
    const veiculo = this.veiculosCache.find(
      (item) => String(item.id) === document.getElementById('saida-veiculo').value
    );
    document.getElementById('saida-km').value = veiculo ? veiculo.km_atual : '';
  }

  abrirVolta(veiculo) {
    document.getElementById('volta-uso-id').value = veiculo.uso_atual.uso_id;
    document.getElementById('volta-resumo').textContent =
      veiculo.modelo +
      ' · ' +
      veiculo.placa +
      ' · saiu com km ' +
      veiculo.km_atual.toLocaleString('pt-BR');
    document.getElementById('volta-km').value = veiculo.km_atual;
    this.abrirModal('modal-volta');
  }

  async concluirManutencao(manutencao) {
    const resposta = await chamarApi('/api/frota/manutencoes/' + manutencao.id + '/concluir', {
      metodo: 'PUT',
      corpo: {}
    });
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao concluir.', 'erro');
      return;
    }
    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async carregarColaboradores() {
    const resposta = await chamarApi('/api/pessoas?status=ativos');
    this.colaboradores = resposta.ok ? resposta.dados.colaboradores : [];
  }

  async iniciar() {
    const sessao = await this.ctx.sessao();
    if (!sessao.ok) {
      window.location.href = 'login';
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
    await this.carregarColaboradores();
    this.carregarVeiculos();
  }
}
