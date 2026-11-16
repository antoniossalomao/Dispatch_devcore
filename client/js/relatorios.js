// Tela de relatórios: ocupação média, uso/ociosidade da frota, gargalos, consulta de condutor (multas) e perguntas à IA.
class TelaRelatorios {
  constructor() {
    this.nomeEmpresaMenu = document.getElementById('nome-empresa-menu');
    this.usuarioIniciais = document.getElementById('usuario-iniciais');
    this.perfilNome = document.getElementById('perfil-nome');
    this.perfilTipo = document.getElementById('perfil-tipo');
    this.botaoSair = document.getElementById('botao-sair');
    this.blocoMenuAdmin = document.getElementById('bloco-menu-admin');
    this.toast = document.getElementById('toast-rel');
    this.timerToast = null;
    this.campoDe = document.getElementById('rel-de');
    this.campoAte = document.getElementById('rel-ate');
    this.veiculosCarregados = false;

    this.configurarEventos();
    this.iniciar();
  }

  configurarEventos() {
    document.querySelectorAll('[data-fechar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        this.fecharModal(botao.dataset.fechar);
      });
    });

    document.querySelectorAll('.rel-aba').forEach((botao) => {
      botao.addEventListener('click', () => {
        this.mostrarAba(botao.dataset.aba);
      });
    });

    document
      .getElementById('botao-atualizar')
      .addEventListener('click', this.carregarTudo.bind(this));

    document
      .getElementById('form-dirigindo')
      .addEventListener('submit', this.consultarCondutor.bind(this));

    document.getElementById('form-ia').addEventListener('submit', (evento) => {
      evento.preventDefault();
      this.perguntarIa('/api/ia/perguntar', {
        pergunta: document.getElementById('ia-pergunta').value
      });
    });

    document.getElementById('botao-resumo-ia').addEventListener('click', () => {
      this.perguntarIa('/api/ia/resumo', {});
    });

    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', { metodo: 'POST' });
      window.location.href = 'index.html';
    });
  }

  async consultarCondutor(evento) {
    evento.preventDefault();
    const caixa = document.getElementById('dir-resultado');
    const resposta = await chamarApi(
      '/api/relatorios/quem-dirigia?veiculo_id=' +
        document.getElementById('dir-veiculo').value +
        '&quando=' +
        encodeURIComponent(document.getElementById('dir-quando').value)
    );

    caixa.hidden = false;
    if (!resposta.ok) {
      caixa.className = 'resultado-caixa resultado-erro';
      caixa.textContent = resposta.dados.erro || 'Erro na consulta.';
      return;
    }

    const dados = resposta.dados;
    if (dados.encontrado) {
      caixa.className = 'resultado-caixa resultado-ok';
      caixa.innerHTML =
        '<strong>' +
        this.esc(dados.motorista) +
        '</strong> (matrícula ' +
        this.esc(dados.matricula) +
        ') dirigia o ' +
        this.esc(dados.veiculo.modelo) +
        ' ' +
        this.esc(dados.veiculo.placa) +
        '.<br>' +
        'Destino: ' +
        this.esc(dados.destino) +
        '<br>Saída: ' +
        this.formatarData(dados.saida) +
        (dados.retorno ? ' · Volta: ' + this.formatarData(dados.retorno) : ' · ainda em trânsito') +
        (dados.passageiros.length
          ? '<br>Passageiros: ' + this.esc(dados.passageiros.join(', '))
          : '');
    } else {
      // Quando houver diferença no hodômetro sem saída registrada no período, destaca como alerta vermelho.
      caixa.className = 'resultado-caixa ' + (dados.uso_sem_registro ? 'resultado-erro' : '');
      caixa.textContent = dados.aviso;
    }
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

  consulta() {
    return (
      '?de=' +
      encodeURIComponent(this.campoDe.value) +
      '&ate=' +
      encodeURIComponent(this.campoAte.value)
    );
  }

  mostrarAba(nome) {
    document.querySelectorAll('.rel-aba').forEach((botao) => {
      botao.classList.toggle('ativa', botao.dataset.aba === nome);
    });
    document.querySelectorAll('.rel-secao').forEach((secao) => {
      secao.hidden = secao.id !== 'aba-' + nome;
    });
    if (nome === 'dirigindo') this.carregarVeiculosSelect();
  }

  barra(classeExtra) {
    return (
      '<div class="aloj-barra"><div class="aloj-barra-preench' +
      (classeExtra || '') +
      '"></div></div>'
    );
  }

  aplicarLarguraBarra(container, pct) {
    const limitado = Math.max(0, Math.min(100, Number(pct) || 0));
    const preench = container.querySelector('.aloj-barra-preench');
    if (preench) preench.style.width = limitado + '%';
  }

  async carregarOcupacao() {
    const resposta = await chamarApi('/api/relatorios/ocupacao' + this.consulta());
    const caixa = document.getElementById('rel-ocupacao');

    if (!resposta.ok) {
      caixa.innerHTML =
        '<p class="texto-vazio">' + this.esc(resposta.dados.erro || 'Erro ao carregar.') + '</p>';
      return;
    }

    if (resposta.dados.alojamentos.length === 0) {
      caixa.innerHTML = '<p class="texto-vazio">Nenhum alojamento ativo.</p>';
      return;
    }

    caixa.innerHTML = '';
    resposta.dados.alojamentos.forEach((alojamento) => {
      const linha = document.createElement('div');
      linha.className = 'rel-linha';
      linha.innerHTML =
        '<div class="rel-linha-topo"><strong>' +
        this.esc(alojamento.nome) +
        '</strong><span>' +
        this.esc(alojamento.cidade) +
        '</span></div>' +
        this.barra() +
        '<div class="aloj-numeros"><span><strong>' +
        alojamento.ocupacao_media_pct +
        '%</strong> de ocupação média no período</span>' +
        '<span>' +
        alojamento.ocupados_agora +
        '/' +
        alojamento.leitos +
        ' leitos agora · ' +
        alojamento.entradas_no_periodo +
        ' entradas</span></div>';
      this.aplicarLarguraBarra(linha, alojamento.ocupacao_media_pct);
      caixa.appendChild(linha);
    });
  }

  async carregarFrota() {
    const resposta = await chamarApi('/api/relatorios/frota' + this.consulta());
    const corpo = document.getElementById('rel-frota');
    corpo.innerHTML = '';

    if (!resposta.ok) {
      corpo.innerHTML =
        '<tr><td colspan="6" class="texto-vazio">' +
        this.esc(resposta.dados.erro || 'Erro ao carregar.') +
        '</td></tr>';
      return;
    }

    if (resposta.dados.veiculos.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Nenhum veículo ativo.</td></tr>';
      return;
    }

    resposta.dados.veiculos.forEach((veiculo) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div class="veic-celula"><span class="veic-modelo">' +
        this.esc(veiculo.modelo) +
        '</span><span class="veic-placa"><span class="placa">' +
        this.esc(veiculo.placa) +
        '</span></span></div></td>' +
        '<td class="num">' +
        veiculo.viagens +
        '</td><td class="num">' +
        veiculo.km_rodados.toLocaleString('pt-BR') +
        ' km</td><td class="num">' +
        veiculo.horas_em_uso +
        ' h</td>' +
        '<td class="celula-barra">' +
        this.barra() +
        '<span class="rel-pct">' +
        veiculo.utilizacao_pct +
        '% em uso · ' +
        veiculo.ociosidade_pct +
        '% ocioso</span></td>' +
        '<td class="num">' +
        (veiculo.dias_sem_uso === null ? '—' : veiculo.dias_sem_uso + ' dias') +
        '</td>';
      this.aplicarLarguraBarra(tr, veiculo.utilizacao_pct);
      corpo.appendChild(tr);
    });
  }

  async carregarGargalos() {
    const resposta = await chamarApi('/api/relatorios/gargalos' + this.consulta());
    const caixa = document.getElementById('rel-gargalos');
    caixa.innerHTML = '';

    if (!resposta.ok) {
      caixa.innerHTML =
        '<p class="texto-vazio">' + this.esc(resposta.dados.erro || 'Erro ao carregar.') + '</p>';
      return;
    }

    if (resposta.dados.gargalos.length === 0) {
      caixa.innerHTML = '<p class="texto-vazio">Nenhum gargalo identificado no período.</p>';
      return;
    }

    resposta.dados.gargalos.forEach((gargalo) => {
      const item = document.createElement('div');
      item.className =
        'alerta-item ' + (gargalo.severidade === 'critico' ? 'alerta-problema' : 'alerta-atencao');
      item.innerHTML = '<p class="alerta-detalhe">' + this.esc(gargalo.mensagem) + '</p>';
      caixa.appendChild(item);
    });
  }

  carregarTudo() {
    if (!this.campoDe.value || !this.campoAte.value || this.campoDe.value > this.campoAte.value) {
      this.mostrarToast(
        'Informe um período válido (a data inicial não pode ser depois da final).',
        'erro'
      );
      return;
    }
    this.carregarOcupacao();
    this.carregarFrota();
    this.carregarGargalos();
  }

  async carregarVeiculosSelect() {
    if (this.veiculosCarregados) return;
    const resposta = await chamarApi('/api/frota?status=todos');
    if (!resposta.ok) return;

    const select = document.getElementById('dir-veiculo');
    select.innerHTML = '';
    resposta.dados.veiculos.forEach((veiculo) => {
      const opcao = document.createElement('option');
      opcao.value = veiculo.id;
      opcao.textContent = veiculo.modelo + ' · ' + veiculo.placa;
      select.appendChild(opcao);
    });
    this.veiculosCarregados = true;
  }

  async perguntarIa(url, corpo) {
    const caixa = document.getElementById('ia-resultado');
    caixa.hidden = false;
    caixa.className = 'resultado-caixa';
    caixa.textContent = 'Pensando...';
    corpo.de = this.campoDe.value;
    corpo.ate = this.campoAte.value;

    const resposta = await chamarApi(url, {
      metodo: 'POST',
      corpo: corpo
    });
    if (!resposta.ok) {
      caixa.className = 'resultado-caixa resultado-erro';
      caixa.textContent = resposta.dados.erro || 'Erro ao consultar a IA.';
      return;
    }
    caixa.className = 'resultado-caixa resultado-ok';
    caixa.textContent = resposta.dados.resposta;
  }

  aoIniciar() {
    // Define os últimos 30 dias como intervalo inicial e aceita abrir direto uma aba pelo #hash da URL.
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 30 * 86400000);
    this.campoAte.value = this.paraInputData(hoje);
    this.campoDe.value = this.paraInputData(inicio);

    const aba = window.location.hash.replace('#', '');
    if (['ocupacao', 'frota', 'gargalos', 'dirigindo', 'ia'].indexOf(aba) !== -1) {
      this.mostrarAba(aba);
    }
    this.carregarTudo();
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

new TelaRelatorios();
