// Tela de alojamentos: cartões por unidade, gaveta com mapa de quartos/leitos, entradas, saídas e ocorrências.
export default class TelaAlojamentos {
  // ctx vem do js/app/App.js: ctx.sessao() diz quem está logado, ctx.sinal desliga os eventos
  // da janela quando a pessoa sai da tela e ctx.ir('tela') troca de tela sem recarregar.
  constructor(ctx) {
    this.ctx = ctx;
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
    document.querySelectorAll('[data-fechar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        this.fecharModal(botao.dataset.fechar);
      });
    });

    this.seletorStatus.addEventListener('change', this.carregarAlojamentos.bind(this));

    document.getElementById('fechar-gaveta').addEventListener('click', () => {
      this.gaveta.hidden = true;
      this.alojamentoAtual = null;
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


    document.querySelectorAll('.menu-em-breve').forEach((link) => {
      link.addEventListener('click', (evento) => {
        evento.preventDefault();
        this.mostrarToast('Módulo "' + link.dataset.tela + '" em construção.', 'ok');
      });
    });
  }

  async salvarAlojamento(evento) {
    evento.preventDefault();
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

    const resposta = await chamarApi(id ? '/api/alojamentos/' + id : '/api/alojamentos', {
      metodo: id ? 'PUT' : 'POST',
      corpo: corpo
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao salvar.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-alojamento');
    this.recarregarTudo();
  }

  async alterarStatusAlojamento() {
    if (!this.alojamentoAtual) return;
    const alojamento = this.alojamentoAtual.alojamento;
    const resposta = await chamarApi('/api/alojamentos/' + alojamento.id + '/status', {
      metodo: 'PUT',
      corpo: { ativo: alojamento.ativo === 1 ? 0 : 1 }
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao alterar status.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async salvarQuarto(evento) {
    evento.preventDefault();
    const nome = document.getElementById('quarto-nome').value.trim();
    const camas = Number(this.quartoCamas.value) || 0;
    const beliches = Number(this.quartoBeliches.value) || 0;
    const leitos = [];
    let numeroLeito = 1;

    const proximoCodigo = () => {
      const codigo = nome + '-' + (numeroLeito < 10 ? '0' + numeroLeito : numeroLeito);
      numeroLeito++;
      return codigo;
    };

    for (let i = 0; i < camas; i++) {
      leitos.push({ codigo: proximoCodigo(), tipo: 'cama' });
    }
    // Cada beliche vira dois leitos ligados na lista (baixo e cima).
    for (let i = 0; i < beliches; i++) {
      leitos.push({ codigo: proximoCodigo(), tipo: 'beliche_baixo' });
      leitos.push({ codigo: proximoCodigo(), tipo: 'beliche_cima' });
    }

    const resposta = await chamarApi(
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

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao salvar quarto.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-quarto');
    this.recarregarTudo();
  }

  async alojarColaborador(evento) {
    evento.preventDefault();
    const resposta = await chamarApi('/api/alojamentos/estadias', {
      metodo: 'POST',
      corpo: {
        pessoa_id: Number(document.getElementById('alojar-pessoa').value),
        leito_id: Number(document.getElementById('alojar-leito-id').value)
      }
    });

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao registrar entrada.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.fecharModal('modal-alojar');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  novaOcorrencia() {
    document.getElementById('form-ocorrencia').reset();
    const select = document.getElementById('ocor-pessoa');
    select.innerHTML = '<option value="">Ninguém</option>';
    this.colaboradoresAtivos.forEach((colab) => {
      const opcao = document.createElement('option');
      opcao.value = colab.id;
      opcao.textContent = colab.nome;
      select.appendChild(opcao);
    });
    this.abrirModal('modal-ocorrencia');
  }

  async salvarOcorrencia(evento) {
    evento.preventDefault();
    const resposta = await chamarApi(
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

    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao abrir ocorrência.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
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
    const resposta = await chamarApi('/api/alojamentos?status=' + this.seletorStatus.value);
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao carregar alojamentos.', 'erro');
      return;
    }

    const totais = resposta.dados.totais;
    document.getElementById('kpi-alojamentos').textContent = totais.alojamentos;
    document.getElementById('kpi-leitos').textContent = totais.leitos;
    document.getElementById('kpi-livres').textContent = totais.leitos - totais.ocupados + ' livres';
    document.getElementById('kpi-ocupacao').textContent =
      (totais.leitos > 0 ? Math.round((totais.ocupados / totais.leitos) * 100) : 0) + '%';
    document.getElementById('kpi-ocupados').textContent = totais.ocupados + ' leitos ocupados';
    document.getElementById('kpi-ocorrencias').textContent = totais.ocorrenciasAbertas;

    this.grade.innerHTML = '';
    if (resposta.dados.alojamentos.length === 0) {
      this.grade.innerHTML = '<p class="texto-vazio">Nenhum alojamento encontrado.</p>';
      return;
    }

    resposta.dados.alojamentos.forEach((alojamento) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'aloj-cartao' + (alojamento.ativo === 0 ? ' aloj-inativo' : '');
      const cheio = alojamento.total_leitos > 0 && alojamento.leitos_ocupados === alojamento.total_leitos;
      const pct = Math.max(0, Math.min(100, Number(alojamento.ocupacao_pct) || 0));

      card.innerHTML =
        '<div class="aloj-cartao-topo">' +
        '<div><div class="aloj-nome">' +
        this.esc(alojamento.nome) +
        '</div>' +
        '<div class="aloj-local">' +
        this.esc(alojamento.cidade) +
        (alojamento.bairro ? ' · ' + this.esc(alojamento.bairro) : '') +
        '</div></div>' +
        (alojamento.ocorrencias_abertas > 0
          ? '<span class="status-tag status-atencao"><span class="status-ponto"></span>' +
            alojamento.ocorrencias_abertas +
            (alojamento.ocorrencias_abertas === 1 ? ' ocorrência' : ' ocorrências') +
            '</span>'
          : '') +
        '</div>' +
        '<div class="aloj-barra"><div class="aloj-barra-preench' +
        (cheio ? ' cheio' : '') +
        '"></div></div>' +
        '<div class="aloj-numeros"><span><strong>' +
        alojamento.leitos_ocupados +
        '/' +
        alojamento.total_leitos +
        '</strong> leitos ocupados</span><span>' +
        alojamento.total_quartos +
        (alojamento.total_quartos === 1 ? ' quarto' : ' quartos') +
        '</span></div>' +
        '<div class="aloj-resp">Responsável: ' +
        this.esc(alojamento.responsavel_nome || 'não definido') +
        '</div>';

      card.querySelector('.aloj-barra-preench').style.width = pct + '%';
      // a paleta Ctrl+K usa esse id pra achar o card e abrir o alojamento escolhido
      card.dataset.alojamentoId = alojamento.id;
      card.addEventListener('click', () => {
        this.abrirGaveta(alojamento.id);
      });
      this.grade.appendChild(card);
    });
  }

  async abrirGaveta(id) {
    const resposta = await chamarApi('/api/alojamentos/' + id);
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Não foi possível abrir o alojamento.', 'erro');
      return;
    }
    this.alojamentoAtual = resposta.dados;
    this.desenharGaveta();
    this.gaveta.hidden = false;
  }

  desenharGaveta() {
    const alojamento = this.alojamentoAtual.alojamento;
    this.gavetaNome.textContent = alojamento.nome;
    const endereco = [alojamento.rua, alojamento.numero].filter(Boolean).join(', ');
    this.gavetaSub.textContent =
      [endereco, alojamento.bairro, alojamento.cidade].filter(Boolean).join(' · ') +
      ' · Responsável: ' +
      (alojamento.responsavel_nome || 'não definido');
    this.gavetaBotaoStatus.textContent = alojamento.ativo === 1 ? 'Desativar' : 'Reativar';

    this.gavetaQuartos.innerHTML = '';
    if (this.alojamentoAtual.quartos.length === 0) {
      this.gavetaQuartos.innerHTML = '<p class="texto-vazio">Nenhum quarto cadastrado ainda.</p>';
    }

    this.alojamentoAtual.quartos.forEach((quarto) => {
      const ocupados = quarto.leitos.filter((leito) => leito.estadia_id).length;
      const card = document.createElement('div');
      card.className = 'quarto-card';
      card.innerHTML =
        '<div class="quarto-titulo">' +
        this.esc(quarto.nome) +
        '<span>' +
        quarto.area_m2 +
        ' m² · ' +
        ocupados +
        '/' +
        quarto.leitos.length +
        ' ocupados</span></div>';

      const gradeLeitos = document.createElement('div');
      gradeLeitos.className = 'leitos-grade';

      quarto.leitos.forEach((leito) => {
        const botaoLeito = document.createElement('button');
        botaoLeito.type = 'button';
        botaoLeito.className = 'leito ' + (leito.estadia_id ? 'ocupado' : 'livre');
        botaoLeito.innerHTML =
          '<span class="leito-codigo">' +
          this.esc(leito.codigo) +
          '</span>' +
          '<span class="leito-tipo">' +
          this.esc(this.nomesTipoLeito[leito.tipo] || leito.tipo) +
          '</span>' +
          '<span class="leito-pessoa">' +
          (leito.estadia_id ? this.esc(leito.pessoa_nome) : 'Livre') +
          '</span>';

        // Leito livre abre a seleção de colaborador; leito ocupado pergunta se deseja registrar saída.
        botaoLeito.addEventListener('click', () => {
          if (leito.estadia_id) this.registrarSaida(leito);
          else this.abrirAlojar(leito);
        });
        gradeLeitos.appendChild(botaoLeito);
      });

      card.appendChild(gradeLeitos);
      this.gavetaQuartos.appendChild(card);
    });

    this.contOcorrencias.textContent = this.alojamentoAtual.ocorrencias.length;
    this.gavetaOcorrencias.innerHTML = '';
    if (this.alojamentoAtual.ocorrencias.length === 0) {
      this.gavetaOcorrencias.innerHTML =
        '<p class="texto-vazio">Nenhuma ocorrência registrada.</p>';
    }

    this.alojamentoAtual.ocorrencias.forEach((ocorrencia) => {
      const item = document.createElement('div');
      item.className = 'timeline-item' + (!ocorrencia.resolvida_em ? ' timeline-ativo' : '');
      item.innerHTML =
        '<span class="timeline-titulo">' +
        this.esc(this.nomesTipoOcorrencia[ocorrencia.tipo] || ocorrencia.tipo) +
        ' · ' +
        this.esc(ocorrencia.descricao) +
        '</span>' +
        '<span class="timeline-detalhe">' +
        (ocorrencia.pessoa_nome ? 'Envolvido: ' + this.esc(ocorrencia.pessoa_nome) + ' · ' : '') +
        (ocorrencia.resolvida_em ? 'Solução: ' + this.esc(ocorrencia.solucao) : 'Em aberto') +
        '</span>' +
        '<span class="timeline-data">Aberta: ' +
        ocorrencia.aberta_em.slice(0, 16) +
        (ocorrencia.resolvida_em ? ' | Resolvida: ' + ocorrencia.resolvida_em.slice(0, 16) : '') +
        '</span>';

      if (!ocorrencia.resolvida_em) {
        const botaoResolver = document.createElement('button');
        botaoResolver.type = 'button';
        botaoResolver.className = 'btn-secundario btn-pequeno ocor-acoes';
        botaoResolver.textContent = 'Resolver';
        botaoResolver.addEventListener('click', () => {
          this.resolverOcorrencia(ocorrencia);
        });
        item.appendChild(botaoResolver);
      }

      this.gavetaOcorrencias.appendChild(item);
    });
  }

  async recarregarTudo() {
    if (this.alojamentoAtual) {
      const resposta = await chamarApi('/api/alojamentos/' + this.alojamentoAtual.alojamento.id);
      if (resposta.ok) {
        this.alojamentoAtual = resposta.dados;
        this.desenharGaveta();
      }
    }
    this.carregarAlojamentos();
  }

  preencherResponsaveis(selecionado) {
    const select = document.getElementById('aloj-responsavel');
    select.innerHTML = '<option value="">Sem responsável</option>';
    this.colaboradoresAtivos.forEach((colab) => {
      const opcao = document.createElement('option');
      opcao.value = colab.id;
      opcao.textContent = colab.nome + ' (' + colab.matricula + ')';
      select.appendChild(opcao);
    });
    select.value = selecionado ? String(selecionado) : '';
  }

  abrirFormAlojamento(alojamento) {
    document.getElementById('modal-aloj-titulo').textContent = alojamento
      ? 'Editar alojamento'
      : 'Novo alojamento';
    document.getElementById('aloj-id').value = alojamento ? alojamento.id : '';
    document.getElementById('aloj-nome').value = alojamento ? alojamento.nome : '';
    document.getElementById('aloj-cidade').value = alojamento ? alojamento.cidade : '';
    document.getElementById('aloj-rua').value = alojamento && alojamento.rua ? alojamento.rua : '';
    document.getElementById('aloj-numero').value =
      alojamento && alojamento.numero ? alojamento.numero : '';
    document.getElementById('aloj-bairro').value =
      alojamento && alojamento.bairro ? alojamento.bairro : '';
    document.getElementById('aloj-cep').value = alojamento && alojamento.cep ? alojamento.cep : '';
    document.getElementById('aloj-obs').value =
      alojamento && alojamento.observacoes ? alojamento.observacoes : '';
    this.preencherResponsaveis(alojamento ? alojamento.responsavel_id : null);
    this.abrirModal('modal-alojamento');
  }

  // Prévia em tempo real da regra da NR-24: 3 m² por cama simples e 4,5 m² por beliche.
  resumoQuarto() {
    const camas = Number(this.quartoCamas.value) || 0;
    const beliches = Number(this.quartoBeliches.value) || 0;
    const leitos = camas + beliches * 2;
    const minimo = camas * 3 + beliches * 4.5;
    document.getElementById('quarto-resumo').textContent =
      leitos + ' leitos (máx. 8) · área mínima ' + minimo + ' m²';
  }

  abrirAlojar(leito) {
    const select = document.getElementById('alojar-pessoa');
    select.innerHTML = '';
    this.colaboradoresAtivos.forEach((colab) => {
      const opcao = document.createElement('option');
      opcao.value = colab.id;
      opcao.textContent = colab.nome + (colab.alojamento_atual ? ' (já alojado)' : '');
      opcao.disabled = !!colab.alojamento_atual;
      select.appendChild(opcao);
    });
    document.getElementById('alojar-leito-id').value = leito.id;
    document.getElementById('alojar-leito-txt').textContent =
      'Leito ' + leito.codigo + ' · ' + this.nomesTipoLeito[leito.tipo];
    this.abrirModal('modal-alojar');
  }

  async registrarSaida(leito) {
    const confirmado = await confirmar(
      'Registrar a saída de ' + leito.pessoa_nome + ' do leito ' + leito.codigo + '?',
      {
        titulo: 'Registrar saída',
        confirmar: 'Registrar saída'
      }
    );
    if (!confirmado) return;

    const resposta = await chamarApi('/api/alojamentos/estadias/' + leito.estadia_id + '/saida', {
      metodo: 'PUT',
      corpo: {}
    });
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao registrar saída.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    await this.carregarColaboradores();
    this.recarregarTudo();
  }

  async resolverOcorrencia(ocorrencia) {
    const solucao = await pedirTexto('Resolver ocorrência', 'Como foi resolvido?', {
      confirmar: 'Resolver'
    });
    if (solucao === null) return;

    const resposta = await chamarApi(
      '/api/alojamentos/ocorrencias/' + ocorrencia.id + '/resolver',
      {
        metodo: 'PUT',
        corpo: { solucao: solucao }
      }
    );
    if (!resposta.ok) {
      this.mostrarToast(resposta.dados.erro || 'Erro ao resolver.', 'erro');
      return;
    }

    this.mostrarToast(resposta.dados.mensagem, 'ok');
    this.recarregarTudo();
  }

  async carregarColaboradores() {
    const resposta = await chamarApi('/api/pessoas?status=ativos');
    this.colaboradoresAtivos = resposta.ok ? resposta.dados.colaboradores : [];
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
    this.carregarAlojamentos();
  }
}
