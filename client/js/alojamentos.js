// Controla a tela de alojamentos.
class TelaAlojamentos {
  constructor() {
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.toast = document.getElementById('toast-aloj');
    this.grade = document.getElementById('grade-alojamentos');
    this.seletorStatus = document.getElementById('seletor-status');
    this.gaveta = document.getElementById('gaveta-alojamento');
    this.gavetaNome = document.getElementById('gaveta-aloj-nome');
    this.gavetaSub = document.getElementById('gaveta-aloj-sub');
    this.gavetaQuartos = document.getElementById('gaveta-quartos');
    this.gavetaOcorrencias = document.getElementById('gaveta-lista-ocorrencias');
    this.contOcorrencias = document.getElementById('cont-ocorrencias');
    this.gavetaBotaoStatus = document.getElementById('gaveta-botao-status');
    this.secoesGaveta = {
      leitos: document.getElementById('gaveta-secao-leitos'),
      ocorrencias: document.getElementById('gaveta-secao-ocorrencias')
    };
    this.alojamentoAtual = null;
    this.colaboradoresAtivos = [];
    this.timerToast = null;
    this.nomesTipoLeito = {
      cama: 'Cama',
      beliche_baixo: 'Beliche (baixo)',
      beliche_cima: 'Beliche (cima)'
    };
    this.nomesTipoOcorrencia = {
      manutencao: 'Manutenção',
      conflito: 'Conflito',
      reclamacao: 'Reclamação',
      regra: 'Regra',
      outro: 'Outro'
    };
    this.quartoCamas = document.getElementById('quarto-camas');
    this.quartoBeliches = document.getElementById('quarto-beliches');
    this.quartoArea = document.getElementById('quarto-area');
    this.configurarEventos();
    this.iniciar();
  }

  configurarEventos() {
    document.querySelectorAll('[data-fechar]').forEach((b) => {
      b.addEventListener('click', () => {
        this.fecharModal(b.dataset.fechar);
      });
    });
    this.seletorStatus.addEventListener('change', this.carregarAlojamentos.bind(this));
    document.getElementById('fechar-gaveta').addEventListener('click', () => {
      this.gaveta.hidden = true;
      this.alojamentoAtual = null;
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
    document.getElementById('botao-novo-alojamento').addEventListener('click', () => {
      this.abrirFormAlojamento(null);
    });
    document.getElementById('gaveta-botao-editar').addEventListener('click', () => {
      if (this.alojamentoAtual) this.abrirFormAlojamento(this.alojamentoAtual.alojamento);
    });
    document
      .getElementById('form-alojamento')
      .addEventListener('submit', this.salvarAlojamento.bind(this));
    this.gavetaBotaoStatus.addEventListener('click', this.alterarStatusAlojamento.bind(this));
    this.quartoCamas.addEventListener('input', this.resumoQuarto.bind(this));
    this.quartoBeliches.addEventListener('input', this.resumoQuarto.bind(this));
    document.getElementById('botao-novo-quarto').addEventListener('click', () => {
      document.getElementById('form-quarto').reset();
      this.resumoQuarto();
      this.abrirModal('modal-quarto');
    });
    document.getElementById('form-quarto').addEventListener('submit', this.salvarQuarto.bind(this));
    document
      .getElementById('form-alojar')
      .addEventListener('submit', this.alojarColaborador.bind(this));
    document
      .getElementById('botao-nova-ocorrencia')
      .addEventListener('click', this.novaOcorrencia.bind(this));
    document
      .getElementById('form-ocorrencia')
      .addEventListener('submit', this.salvarOcorrencia.bind(this));
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

  async salvarAlojamento(e) {
    e.preventDefault();
    const id = document.getElementById('aloj-id').value;
    const corpo = {
      nome: document.getElementById('aloj-nome').value,
      cidade: document.getElementById('aloj-cidade').value,
      rua: document.getElementById('aloj-rua').value,
      numero: document.getElementById('aloj-numero').value,
      bairro: document.getElementById('aloj-bairro').value,
      cep: document.getElementById('aloj-cep').value,
      observacoes: document.getElementById('aloj-obs').value,
      responsavel_id: document.getElementById('aloj-responsavel').value
    };
    const r = await chamarApi(id ? '/api/alojamentos/' + id : '/api/alojamentos', {
      metodo: id ? 'PUT' : 'POST',
      corpo: corpo
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao salvar.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-alojamento');
    this.recarregarTudo();
  }

  async alterarStatusAlojamento() {
    if (!this.alojamentoAtual) return;
    const a = this.alojamentoAtual.alojamento;
    const r = await chamarApi('/api/alojamentos/' + a.id + '/status', {
      metodo: 'PUT',
      corpo: {
        ativo: a.ativo === 1 ? 0 : 1
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async salvarQuarto(e) {
    const codigo = () => {
      return nome + '-' + (n < 10 ? '0' + n : n);
    };
    e.preventDefault();
    const nome = document.getElementById('quarto-nome').value.trim();
    const camas = Number(this.quartoCamas.value) || 0;
    const beliches = Number(this.quartoBeliches.value) || 0;
    const leitos = [];
    let n = 1;
    for (let i = 0; i < camas; i++) {
      leitos.push({
        codigo: codigo(),
        tipo: 'cama'
      });
      n++;
    }
    for (let i = 0; i < beliches; i++) {
      leitos.push({
        codigo: codigo(),
        tipo: 'beliche_baixo'
      });
      n++;
      leitos.push({
        codigo: codigo(),
        tipo: 'beliche_cima'
      });
      n++;
    }
    const r = await chamarApi(
      '/api/alojamentos/' + this.alojamentoAtual.alojamento.id + '/quartos',
      {
        metodo: 'POST',
        corpo: {
          nome: nome,
          area_m2: Number(this.quartoArea.value),
          leitos: leitos
        }
      }
    );
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao salvar quarto.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-quarto');
    this.recarregarTudo();
  }

  async alojarColaborador(e) {
    e.preventDefault();
    const r = await chamarApi('/api/alojamentos/estadias', {
      metodo: 'POST',
      corpo: {
        pessoa_id: Number(document.getElementById('alojar-pessoa').value),
        leito_id: Number(document.getElementById('alojar-leito-id').value)
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao registrar entrada.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-alojar');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  novaOcorrencia() {
    document.getElementById('form-ocorrencia').reset();
    const sel = document.getElementById('ocor-pessoa');
    sel.innerHTML = '<option value="">Ninguém</option>';
    this.colaboradoresAtivos.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome;
      sel.appendChild(o);
    });
    this.abrirModal('modal-ocorrencia');
  }

  async salvarOcorrencia(e) {
    e.preventDefault();
    const r = await chamarApi(
      '/api/alojamentos/' + this.alojamentoAtual.alojamento.id + '/ocorrencias',
      {
        metodo: 'POST',
        corpo: {
          tipo: document.getElementById('ocor-tipo').value,
          pessoa_id: document.getElementById('ocor-pessoa').value,
          descricao: document.getElementById('ocor-descricao').value
        }
      }
    );
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao abrir ocorrência.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.fecharModal('modal-ocorrencia');
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

  async carregarAlojamentos() {
    const r = await chamarApi('/api/alojamentos?status=' + this.seletorStatus.value);
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao carregar alojamentos.', 'erro');
      return;
    }
    const t = r.dados.totais;
    document.getElementById('kpi-alojamentos').textContent = t.alojamentos;
    document.getElementById('kpi-leitos').textContent = t.leitos;
    document.getElementById('kpi-livres').textContent = t.leitos - t.ocupados + ' livres';
    document.getElementById('kpi-ocupacao').textContent =
      (t.leitos > 0 ? Math.round((t.ocupados / t.leitos) * 100) : 0) + '%';
    document.getElementById('kpi-ocupados').textContent = t.ocupados + ' leitos ocupados';
    document.getElementById('kpi-ocorrencias').textContent = t.ocorrenciasAbertas;
    this.grade.innerHTML = '';
    if (r.dados.alojamentos.length === 0) {
      this.grade.innerHTML = '<p class="texto-vazio">Nenhum alojamento encontrado.</p>';
      return;
    }
    r.dados.alojamentos.forEach((a) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'aloj-cartao' + (a.ativo === 0 ? ' aloj-inativo' : '');
      const cheio = a.total_leitos > 0 && a.leitos_ocupados === a.total_leitos;
      card.innerHTML =
        '<div class="aloj-cartao-topo">' +
        '<div><div class="aloj-nome">' +
        this.esc(a.nome) +
        '</div>' +
        '<div class="aloj-local">' +
        this.esc(a.cidade) +
        (a.bairro ? ' · ' + this.esc(a.bairro) : '') +
        '</div></div>' +
        (a.ocorrencias_abertas > 0
          ? '<span class="status-tag status-atencao"><span class="status-ponto"></span>' +
            a.ocorrencias_abertas +
            (a.ocorrencias_abertas === 1 ? ' ocorrência' : ' ocorrências') +
            '</span>'
          : '') +
        '</div>' +
        '<div class="aloj-barra"><div class="aloj-barra-preench' +
        (cheio ? ' cheio' : '') +
        '" style="width:' +
        a.ocupacao_pct +
        '%"></div></div>' +
        '<div class="aloj-numeros"><span><strong>' +
        a.leitos_ocupados +
        '/' +
        a.total_leitos +
        '</strong> leitos ocupados</span><span>' +
        a.total_quartos +
        (a.total_quartos === 1 ? ' quarto' : ' quartos') +
        '</span></div>' +
        '<div class="aloj-resp">Responsável: ' +
        this.esc(a.responsavel_nome || 'não definido') +
        '</div>';
      card.addEventListener('click', () => {
        this.abrirGaveta(a.id);
      });
      this.grade.appendChild(card);
    });
  }

  async abrirGaveta(id) {
    const r = await chamarApi('/api/alojamentos/' + id);
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Não foi possível abrir o alojamento.', 'erro');
      return;
    }
    this.alojamentoAtual = r.dados;
    this.desenharGaveta();
    this.gaveta.hidden = false;
  }

  desenharGaveta() {
    const a = this.alojamentoAtual.alojamento;
    this.gavetaNome.textContent = a.nome;
    const endereco = [a.rua, a.numero].filter(Boolean).join(', ');
    this.gavetaSub.textContent =
      [endereco, a.bairro, a.cidade].filter(Boolean).join(' · ') +
      ' · Responsável: ' +
      (a.responsavel_nome || 'não definido');
    this.gavetaBotaoStatus.textContent = a.ativo === 1 ? 'Desativar' : 'Reativar';
    this.gavetaQuartos.innerHTML = '';
    if (this.alojamentoAtual.quartos.length === 0) {
      this.gavetaQuartos.innerHTML = '<p class="texto-vazio">Nenhum quarto cadastrado ainda.</p>';
    }
    this.alojamentoAtual.quartos.forEach((q) => {
      const ocupados = q.leitos.filter((l) => {
        return l.estadia_id;
      }).length;
      const card = document.createElement('div');
      card.className = 'quarto-card';
      card.innerHTML =
        '<div class="quarto-titulo">' +
        this.esc(q.nome) +
        '<span>' +
        q.area_m2 +
        ' m² · ' +
        ocupados +
        '/' +
        q.leitos.length +
        ' ocupados</span></div>';
      const g = document.createElement('div');
      g.className = 'leitos-grade';
      q.leitos.forEach((l) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'leito ' + (l.estadia_id ? 'ocupado' : 'livre');
        b.innerHTML =
          '<span class="leito-codigo">' +
          this.esc(l.codigo) +
          '</span>' +
          '<span class="leito-tipo">' +
          this.nomesTipoLeito[l.tipo] +
          '</span>' +
          '<span class="leito-pessoa">' +
          (l.estadia_id ? this.esc(l.pessoa_nome) : 'Livre') +
          '</span>';
        b.addEventListener('click', () => {
          if (l.estadia_id) this.registrarSaida(l);
          else this.abrirAlojar(l);
        });
        g.appendChild(b);
      });
      card.appendChild(g);
      this.gavetaQuartos.appendChild(card);
    });
    this.contOcorrencias.textContent = this.alojamentoAtual.ocorrencias.length;
    this.gavetaOcorrencias.innerHTML = '';
    if (this.alojamentoAtual.ocorrencias.length === 0) {
      this.gavetaOcorrencias.innerHTML =
        '<p class="texto-vazio">Nenhuma ocorrência registrada.</p>';
    }
    this.alojamentoAtual.ocorrencias.forEach((o) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!o.resolvida_em ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        this.nomesTipoOcorrencia[o.tipo] +
        ' · ' +
        this.esc(o.descricao) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (o.pessoa_nome ? 'Envolvido: ' + this.esc(o.pessoa_nome) + ' · ' : '') +
        (o.resolvida_em ? 'Solução: ' + this.esc(o.solucao) : 'Em aberto') +
        '</span>' +
        '<span class="timeline-data">Aberta: ' +
        o.aberta_em.slice(0, 16) +
        (o.resolvida_em ? ' | Resolvida: ' + o.resolvida_em.slice(0, 16) : '') +
        '</span>';
      if (!o.resolvida_em) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-secundario btn-pequeno ocor-acoes';
        b.textContent = 'Resolver';
        b.addEventListener('click', () => {
          this.resolverOcorrencia(o);
        });
        item.appendChild(b);
      }
      this.gavetaOcorrencias.appendChild(item);
    });
  }

  async recarregarTudo() {
    if (this.alojamentoAtual) {
      const r = await chamarApi('/api/alojamentos/' + this.alojamentoAtual.alojamento.id);
      if (r.ok) {
        this.alojamentoAtual = r.dados;
        this.desenharGaveta();
      }
    }
    this.carregarAlojamentos();
  }

  preencherResponsaveis(selecionado) {
    const sel = document.getElementById('aloj-responsavel');
    sel.innerHTML = '<option value="">Sem responsável</option>';
    this.colaboradoresAtivos.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome + ' (' + c.matricula + ')';
      sel.appendChild(o);
    });
    sel.value = selecionado ? String(selecionado) : '';
  }

  abrirFormAlojamento(a) {
    document.getElementById('modal-aloj-titulo').textContent = a
      ? 'Editar alojamento'
      : 'Novo alojamento';
    document.getElementById('aloj-id').value = a ? a.id : '';
    document.getElementById('aloj-nome').value = a ? a.nome : '';
    document.getElementById('aloj-cidade').value = a ? a.cidade : '';
    document.getElementById('aloj-rua').value = a && a.rua ? a.rua : '';
    document.getElementById('aloj-numero').value = a && a.numero ? a.numero : '';
    document.getElementById('aloj-bairro').value = a && a.bairro ? a.bairro : '';
    document.getElementById('aloj-cep').value = a && a.cep ? a.cep : '';
    document.getElementById('aloj-obs').value = a && a.observacoes ? a.observacoes : '';
    this.preencherResponsaveis(a ? a.responsavel_id : null);
    this.abrirModal('modal-alojamento');
  }

  resumoQuarto() {
    const camas = Number(this.quartoCamas.value) || 0;
    const beliches = Number(this.quartoBeliches.value) || 0;
    const leitos = camas + beliches * 2;
    const minimo = camas * 3 + beliches * 4.5;
    document.getElementById('quarto-resumo').textContent =
      leitos + ' leitos (máx. 8) · área mínima ' + minimo + ' m²';
  }

  abrirAlojar(leito) {
    const sel = document.getElementById('alojar-pessoa');
    sel.innerHTML = '';
    this.colaboradoresAtivos.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.nome + (c.alojamento_atual ? ' (já alojado)' : '');
      o.disabled = !!c.alojamento_atual;
      sel.appendChild(o);
    });
    document.getElementById('alojar-leito-id').value = leito.id;
    document.getElementById('alojar-leito-txt').textContent =
      'Leito ' + leito.codigo + ' · ' + this.nomesTipoLeito[leito.tipo];
    this.abrirModal('modal-alojar');
  }

  async registrarSaida(leito) {
    if (
      !(await confirmar(
        'Registrar a saída de ' + leito.pessoa_nome + ' do leito ' + leito.codigo + '?',
        {
          titulo: 'Registrar saída',
          confirmar: 'Registrar saída'
        }
      ))
    )
      return;
    const r = await chamarApi('/api/alojamentos/estadias/' + leito.estadia_id + '/saida', {
      metodo: 'PUT',
      corpo: {}
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao registrar saída.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async resolverOcorrencia(o) {
    const solucao = await pedirTexto('Resolver ocorrência', 'Como foi resolvido?', {
      confirmar: 'Resolver'
    });
    if (solucao === null) return;
    const r = await chamarApi('/api/alojamentos/ocorrencias/' + o.id + '/resolver', {
      metodo: 'PUT',
      corpo: {
        solucao: solucao
      }
    });
    if (!r.ok) {
      this.mostrarToast(r.dados.erro || 'Erro ao resolver.', 'erro');
      return;
    }
    this.mostrarToast(r.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async carregarColaboradores() {
    const r = await chamarApi('/api/pessoas?status=ativos');
    this.colaboradoresAtivos = r.ok ? r.dados.colaboradores : [];
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
    this.carregarAlojamentos();
  }
}
new TelaAlojamentos();
