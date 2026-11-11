// Controla a tela de frota.
class TelaFrota {
  constructor() {
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
    document.querySelectorAll('[data-fechar]').forEach((b) => {
      b.addEventListener('click', () => {
        this.fecharModal(b.dataset.fechar);
      });
    });
    this.seletorStatus.addEventListener('change', this.carregarVeiculos.bind(this));
    document.getElementById('fechar-gaveta').addEventListener('click', () => {
      this.gaveta.hidden = true;
      this.detalheAtual = null;
    });
    document.querySelectorAll('.gaveta-aba').forEach((aba) => {
      aba.addEventListener('click', () => {
        document.querySelectorAll('.gaveta-aba').forEach((x) => {
          x.classList.remove('ativa');
        });
        aba.classList.add('ativa');
        Object.keys(this.secoesGaveta).forEach((k) => {
          this.secoesGaveta[k].hidden = k !== aba.dataset.gaveta;
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
      if (this.detalheAtual)
        document.getElementById('manut-km').value = this.detalheAtual.veiculo.km_atual;
      this.abrirModal('modal-manutencao');
    });
    document
      .getElementById('form-manutencao')
      .addEventListener('submit', this.salvarManutencao.bind(this));
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
    document.querySelectorAll('.menu-em-breve').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.mostrarToast('Módulo "' + link.dataset.tela + '" em construção.', 'ok');
      });
    });
  }

  async salvarVeiculo(e) {
    e.preventDefault();
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
    const r = await chamarApi(id ? '/api/frota/' + id : '/api/frota', {
      metodo: id ? 'PUT' : 'POST',
      corpo: corpo
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao salvar.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-veiculo');
    this.recarregarTudo();
  }

  async alterarStatusVeiculo() {
    if (!this.detalheAtual) return;
    const v = this.detalheAtual.veiculo;
    const r = await chamarApi('/api/frota/' + v.id + '/status', {
      metodo: 'PUT',
      corpo: {
        ativo: v.ativo === 1 ? 0 : 1
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async registrarSaida(e) {
    e.preventDefault();
    const passageiros = Array.prototype.slice
      .call(document.querySelectorAll('#saida-passageiros input:checked'))
      .map((cb) => {
        return Number(cb.value);
      });
    const r = await chamarApi('/api/frota/usos', {
      metodo: 'POST',
      corpo: {
        veiculo_id: Number(document.getElementById('saida-veiculo').value),
        motorista_id: Number(document.getElementById('saida-motorista').value),
        destino: document.getElementById('saida-destino').value,
        km_saida: Number(document.getElementById('saida-km').value),
        passageiros: passageiros
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao registrar saída.', 'erro');
      return;
    }
    const avisos = r.dados.avisos || [];
    this.mostrarToast(
      r.dados.mensagem + (avisos.length ? ' Atenção: ' + avisos.join(' ') : ''),
      avisos.length ? 'erro' : 'ok'
    );
    this.fecharModal('modal-saida');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async registrarRetorno(e) {
    e.preventDefault();
    const id = document.getElementById('volta-uso-id').value;
    const corpo = {
      km_retorno: Number(document.getElementById('volta-km').value)
    };
    let r = await chamarApi('/api/frota/usos/' + id + '/retorno', {
      metodo: 'PUT',
      corpo: corpo
    });
    // F11: viagem muito longa pede confirmacao
    if (r.status === 409 && r.dados.confirmar) {
      if (
        !(await confirmar(r.dados.erro, {
          titulo: 'Confirmar viagem longa',
          confirmar: 'Confirmar km'
        }))
      )
        return;
      corpo.confirmar = true;
      r = await chamarApi('/api/frota/usos/' + id + '/retorno', {
        metodo: 'PUT',
        corpo: corpo
      });
    }
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao registrar volta.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-volta');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async salvarManutencao(e) {
    e.preventDefault();
    const r = await chamarApi('/api/frota/' + this.detalheAtual.veiculo.id + '/manutencoes', {
      metodo: 'POST',
      corpo: {
        tipo: document.getElementById('manut-tipo').value,
        descricao: document.getElementById('manut-descricao').value,
        km: document.getElementById('manut-km').value
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao abrir manutenção.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
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
    if (doc.status === 'vencido')
      return (
        '<span class="status-tag status-problema"><span class="status-ponto"></span>' +
        rotulo +
        ' vencido</span>'
      );
    if (doc.status === 'vencendo')
      return (
        '<span class="status-tag status-atencao"><span class="status-ponto"></span>' +
        rotulo +
        ' em ' +
        doc.dias +
        'd</span>'
      );
    if (doc.status === 'sem_data') return '<span class="doc-linha">' + rotulo + ': sem data</span>';
    return '';
  }

  celulaDocs(v) {
    const tags = this.tagDoc('Licenciamento', v.licenciamento) + this.tagDoc('Seguro', v.seguro);
    return tags || '<span class="doc-linha">Em dia</span>';
  }

  formatarData(texto) {
    return texto ? texto.slice(0, 16).replace('T', ' ') : '';
  }

  async carregarVeiculos() {
    const r = await chamarApi('/api/frota?status=' + this.seletorStatus.value);
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao carregar a frota.', 'erro');
      return;
    }
    this.veiculosCache = r.dados.veiculos;
    const t = r.dados.totais;
    document.getElementById('kpi-disponiveis').textContent = t.disponiveis;
    document.getElementById('kpi-total').textContent = 'de ' + t.total + ' veículos';
    document.getElementById('kpi-em-uso').textContent = t.emUso;
    document.getElementById('kpi-manutencao').textContent = t.manutencao;
    document.getElementById('kpi-docs').textContent = t.docsAtencao;
    this.lista.innerHTML = '';
    if (this.veiculosCache.length === 0) {
      this.lista.innerHTML =
        '<tr><td colspan="6" class="texto-vazio">Nenhum veículo encontrado.</td></tr>';
      return;
    }
    this.veiculosCache.forEach((v) => {
      const tr = document.createElement('tr');
      if (v.ativo === 0) tr.className = 'colab-inativo';
      const st = this.rotulosStatus[v.status];
      tr.innerHTML =
        '<td><div class="veic-celula"><span class="veic-modelo">' +
        this.esc(v.modelo) +
        '</span><span class="veic-placa"><span class="placa">' +
        this.esc(v.placa) +
        '</span></span></div></td>' +
        '<td><span class="status-tag ' +
        st[0] +
        '"><span class="status-ponto"></span>' +
        st[1] +
        '</span></td>' +
        '<td class="num">' +
        v.km_atual.toLocaleString('pt-BR') +
        ' km</td>' +
        '<td><div class="docs-celula">' +
        this.celulaDocs(v) +
        '</div></td>' +
        '<td class="uso-celula">' +
        (v.uso_atual
          ? this.esc(v.uso_atual.motorista) + '<span>' + this.esc(v.uso_atual.destino) + '</span>'
          : '<span>—</span>') +
        '</td>';
      const tdAcoes = document.createElement('td');
      tdAcoes.className = 'coluna-acoes';
      const box = document.createElement('div');
      box.className = 'botoes-acoes';
      if (v.status === 'disponivel' && v.ativo === 1) {
        box.appendChild(
          this.botao('Saída', () => {
            this.abrirSaida(v.id);
          })
        );
      }
      if (v.status === 'em_uso') {
        box.appendChild(
          this.botao('Volta', () => {
            this.abrirVolta(v);
          })
        );
      }
      box.appendChild(
        this.botao('Detalhes', () => {
          this.abrirGaveta(v.id);
        })
      );
      tdAcoes.appendChild(box);
      tr.appendChild(tdAcoes);
      this.lista.appendChild(tr);
    });
  }

  botao(texto, aoClicar) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-secundario btn-pequeno';
    b.textContent = texto;
    b.addEventListener('click', aoClicar);
    return b;
  }

  async abrirGaveta(id) {
    const r = await chamarApi('/api/frota/' + id);
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Não foi possível abrir o veículo.', 'erro');
      return;
    }
    this.detalheAtual = r.dados;
    this.desenharGaveta();
    this.gaveta.hidden = false;
  }

  desenharGaveta() {
    const v = this.detalheAtual.veiculo;
    document.getElementById('gaveta-veic-nome').textContent = v.modelo + ' · ' + v.placa;
    document.getElementById('gaveta-veic-sub').textContent =
      v.lugares +
      ' lugares · CNH ' +
      v.categoria_cnh_exigida +
      ' · ' +
      v.km_atual.toLocaleString('pt-BR') +
      ' km';
    this.gavetaBotaoStatus.textContent = v.ativo === 1 ? 'Desativar' : 'Reativar';
    document.getElementById('cont-usos').textContent = this.detalheAtual.usos.length;
    const listaUsos = document.getElementById('gaveta-lista-usos');
    listaUsos.innerHTML = '';
    if (this.detalheAtual.usos.length === 0)
      listaUsos.innerHTML = '<p class="texto-vazio">Nenhum uso registrado.</p>';
    this.detalheAtual.usos.forEach((u) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!u.retorno ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        this.esc(u.motorista) +
        ' → ' +
        this.esc(u.destino) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (u.km_rodados !== null ? u.km_rodados + ' km rodados' : 'Em trânsito') +
        (u.passageiros.length ? ' · Passageiros: ' + this.esc(u.passageiros.join(', ')) : '') +
        '</span>' +
        '<span class="timeline-data">Saída: ' +
        this.formatarData(u.saida) +
        (u.retorno ? ' | Volta: ' + this.formatarData(u.retorno) : '') +
        '</span>';
      listaUsos.appendChild(item);
    });
    document.getElementById('cont-manut').textContent = this.detalheAtual.manutencoes.length;
    const listaManut = document.getElementById('gaveta-lista-manut');
    listaManut.innerHTML = '';
    if (this.detalheAtual.manutencoes.length === 0)
      listaManut.innerHTML = '<p class="texto-vazio">Nenhuma manutenção registrada.</p>';
    this.detalheAtual.manutencoes.forEach((m) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!m.fim ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        (m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva') +
        ' · ' +
        this.esc(m.descricao) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (m.km !== null ? m.km.toLocaleString('pt-BR') + ' km · ' : '') +
        (m.fim ? 'Concluída' : 'Na oficina') +
        '</span>' +
        '<span class="timeline-data">Início: ' +
        this.formatarData(m.inicio) +
        (m.fim ? ' | Fim: ' + this.formatarData(m.fim) : '') +
        '</span>';
      if (!m.fim) {
        const b = this.botao('Concluir', () => {
          this.concluirManutencao(m);
        });
        b.classList.add('timeline-botoes');
        item.appendChild(b);
      }
      listaManut.appendChild(item);
    });
  }

  async recarregarTudo() {
    if (this.detalheAtual) {
      const r = await chamarApi('/api/frota/' + this.detalheAtual.veiculo.id);
      if (r.ok) {
        this.detalheAtual = r.dados;
        this.desenharGaveta();
      }
    }
    this.carregarVeiculos();
  }

  abrirFormVeiculo(v) {
    document.getElementById('modal-veic-titulo').textContent = v
      ? 'Editar veículo'
      : 'Novo veículo';
    document.getElementById('veic-id').value = v ? v.id : '';
    document.getElementById('veic-placa').value = v ? v.placa : '';
    document.getElementById('veic-modelo').value = v ? v.modelo : '';
    document.getElementById('veic-lugares').value = v ? v.lugares : '';
    document.getElementById('veic-categoria').value = v ? v.categoria_cnh_exigida : 'B';
    document.getElementById('veic-km').value = v ? v.km_inicial : 0;
    document.getElementById('veic-licenciamento').value =
      v && v.licenciamento_validade ? v.licenciamento_validade : '';
    document.getElementById('veic-seguro').value = v && v.seguro_validade ? v.seguro_validade : '';
    this.abrirModal('modal-veiculo');
  }

  abrirSaida(veiculoId) {
    const disponiveis = this.veiculosCache.filter((v) => {
      return v.status === 'disponivel' && v.ativo === 1;
    });
    if (disponiveis.length === 0) {
      this.mostrarToast('Nenhum veículo disponível no momento.', 'erro');
      return;
    }
    const selV = document.getElementById('saida-veiculo');
    selV.innerHTML = '';
    disponiveis.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.modelo + ' · ' + v.placa;
      selV.appendChild(o);
    });
    if (veiculoId) selV.value = String(veiculoId);
    const selM = document.getElementById('saida-motorista');
    selM.innerHTML = '';
    this.colaboradores
      .filter((c) => {
        return c.cnh_categorias;
      })
      .forEach((c) => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent =
          c.nome + ' (CNH ' + c.cnh_categorias + ')' + (c.veiculo_atual ? ' · em viagem' : '');
        o.disabled = !!c.veiculo_atual;
        selM.appendChild(o);
      });
    const caixa = document.getElementById('saida-passageiros');
    caixa.innerHTML = '';
    this.colaboradores.forEach((c) => {
      const l = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = c.id;
      cb.disabled = !!c.veiculo_atual;
      l.appendChild(cb);
      l.appendChild(document.createTextNode(' ' + c.nome));
      caixa.appendChild(l);
    });
    document.getElementById('saida-destino').value = '';
    this.preencherKmSaida();
    this.abrirModal('modal-saida');
  }

  preencherKmSaida() {
    const v = this.veiculosCache.filter((x) => {
      return String(x.id) === document.getElementById('saida-veiculo').value;
    })[0];
    document.getElementById('saida-km').value = v ? v.km_atual : '';
  }

  abrirVolta(v) {
    document.getElementById('volta-uso-id').value = v.uso_atual.uso_id;
    document.getElementById('volta-resumo').textContent =
      v.modelo + ' · ' + v.placa + ' · saiu com km ' + v.km_atual.toLocaleString('pt-BR');
    document.getElementById('volta-km').value = v.km_atual;
    this.abrirModal('modal-volta');
  }

  async concluirManutencao(m) {
    const r = await chamarApi('/api/frota/manutencoes/' + m.id + '/concluir', {
      metodo: 'PUT',
      corpo: {}
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao concluir.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async carregarColaboradores() {
    const r = await chamarApi('/api/pessoas?status=ativos');
    this.colaboradores = r.ok ? r.dados.colaboradores : [];
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
    await this.carregarColaboradores();
    this.carregarVeiculos();
  }
}
new TelaFrota();
