// Controla a tela de relatorios.
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
    document.querySelectorAll('[data-fechar]').forEach((b) => {
      b.addEventListener('click', () => {
        this.fecharModal(b.dataset.fechar);
      });
    });
    document.querySelectorAll('.rel-aba').forEach((b) => {
      b.addEventListener('click', () => {
        this.mostrarAba(b.dataset.aba);
      });
    });
    document
      .getElementById('botao-atualizar')
      .addEventListener('click', this.carregarTudo.bind(this));
    document
      .getElementById('form-dirigindo')
      .addEventListener('submit', this.consultarCondutor.bind(this));
    document.getElementById('form-ia').addEventListener('submit', (e) => {
      e.preventDefault();
      this.perguntarIa('/api/ia/perguntar', {
        pergunta: document.getElementById('ia-pergunta').value
      });
    });
    document.getElementById('botao-resumo-ia').addEventListener('click', () => {
      this.perguntarIa('/api/ia/resumo', {});
    });
    this.botaoSair.addEventListener('click', async () => {
      await chamarApi('/api/auth/sair', {
        metodo: 'POST'
      });
      window.location.href = 'index.html';
    });
  }

  async consultarCondutor(e) {
    e.preventDefault();
    const caixa = document.getElementById('dir-resultado');
    const r = await chamarApi(
      '/api/relatorios/quem-dirigia?veiculo_id=' +
        document.getElementById('dir-veiculo').value +
        '&quando=' +
        encodeURIComponent(document.getElementById('dir-quando').value)
    );
    caixa.hidden = false;
    if (!r.ok) {
      caixa.className = 'resultado-caixa resultado-erro';
      caixa.textContent = r.dados.erro || 'Erro na consulta.';
      return;
    }
    const d = r.dados;
    if (d.encontrado) {
      caixa.className = 'resultado-caixa resultado-ok';
      caixa.innerHTML =
        '<strong>' +
        this.esc(d.motorista) +
        '</strong> (matrícula ' +
        this.esc(d.matricula) +
        ') dirigia o ' +
        this.esc(d.veiculo.modelo) +
        ' ' +
        this.esc(d.veiculo.placa) +
        '.<br>' +
        'Destino: ' +
        this.esc(d.destino) +
        '<br>Saída: ' +
        this.formatarData(d.saida) +
        (d.retorno ? ' · Volta: ' + this.formatarData(d.retorno) : ' · ainda em trânsito') +
        (d.passageiros.length ? '<br>Passageiros: ' + this.esc(d.passageiros.join(', ')) : '');
    } else {
      caixa.className = 'resultado-caixa ' + (d.uso_sem_registro ? 'resultado-erro' : '');
      caixa.textContent = d.aviso;
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

  consulta() {
    return (
      '?de=' +
      encodeURIComponent(this.campoDe.value) +
      '&ate=' +
      encodeURIComponent(this.campoAte.value)
    );
  }

  mostrarAba(nome) {
    document.querySelectorAll('.rel-aba').forEach((b) => {
      b.classList.toggle('ativa', b.dataset.aba === nome);
    });
    document.querySelectorAll('.rel-secao').forEach((s) => {
      s.hidden = s.id !== 'aba-' + nome;
    });
    if (nome === 'dirigindo') this.carregarVeiculosSelect();
  }

  barra(pct, classeExtra) {
    const limitado = Math.max(0, Math.min(100, pct));
    return (
      '<div class="aloj-barra"><div class="aloj-barra-preench' +
      (classeExtra || '') +
      '" style="width:' +
      limitado +
      '%"></div></div>'
    );
  }

  async carregarOcupacao() {
    const r = await chamarApi('/api/relatorios/ocupacao' + this.consulta());
    const caixa = document.getElementById('rel-ocupacao');
    if (!r.ok) {
      caixa.innerHTML =
        '<p class="texto-vazio">' + this.esc(r.dados.erro || 'Erro ao carregar.') + '</p>';
      return;
    }
    if (r.dados.alojamentos.length === 0) {
      caixa.innerHTML = '<p class="texto-vazio">Nenhum alojamento ativo.</p>';
      return;
    }
    caixa.innerHTML = '';
    r.dados.alojamentos.forEach((a) => {
      const div = document.createElement('div');
      div.className = 'rel-linha';
      div.innerHTML =
        '<div class="rel-linha-topo"><strong>' +
        this.esc(a.nome) +
        '</strong><span>' +
        this.esc(a.cidade) +
        '</span></div>' +
        this.barra(a.ocupacao_media_pct) +
        '<div class="aloj-numeros"><span><strong>' +
        a.ocupacao_media_pct +
        '%</strong> de ocupação média no período</span>' +
        '<span>' +
        a.ocupados_agora +
        '/' +
        a.leitos +
        ' leitos agora · ' +
        a.entradas_no_periodo +
        ' entradas</span></div>';
      caixa.appendChild(div);
    });
  }

  async carregarFrota() {
    const r = await chamarApi('/api/relatorios/frota' + this.consulta());
    const corpo = document.getElementById('rel-frota');
    corpo.innerHTML = '';
    if (!r.ok) {
      corpo.innerHTML =
        '<tr><td colspan="6" class="texto-vazio">' +
        this.esc(r.dados.erro || 'Erro ao carregar.') +
        '</td></tr>';
      return;
    }
    if (r.dados.veiculos.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6" class="texto-vazio">Nenhum veículo ativo.</td></tr>';
      return;
    }
    r.dados.veiculos.forEach((v) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div class="veic-celula"><span class="veic-modelo">' +
        this.esc(v.modelo) +
        '</span><span class="veic-placa"><span class="placa">' +
        this.esc(v.placa) +
        '</span></span></div></td>' +
        '<td class="num">' +
        v.viagens +
        '</td><td class="num">' +
        v.km_rodados.toLocaleString('pt-BR') +
        ' km</td><td class="num">' +
        v.horas_em_uso +
        ' h</td>' +
        '<td class="celula-barra">' +
        this.barra(v.utilizacao_pct) +
        '<span class="rel-pct">' +
        v.utilizacao_pct +
        '% em uso · ' +
        v.ociosidade_pct +
        '% ocioso</span></td>' +
        '<td class="num">' +
        (v.dias_sem_uso === null ? '—' : v.dias_sem_uso + ' dias') +
        '</td>';
      corpo.appendChild(tr);
    });
  }

  async carregarGargalos() {
    const r = await chamarApi('/api/relatorios/gargalos' + this.consulta());
    const caixa = document.getElementById('rel-gargalos');
    caixa.innerHTML = '';
    if (!r.ok) {
      caixa.innerHTML =
        '<p class="texto-vazio">' + this.esc(r.dados.erro || 'Erro ao carregar.') + '</p>';
      return;
    }
    if (r.dados.gargalos.length === 0) {
      caixa.innerHTML = '<p class="texto-vazio">Nenhum gargalo identificado no período.</p>';
      return;
    }
    r.dados.gargalos.forEach((g) => {
      const div = document.createElement('div');
      div.className =
        'alerta-item ' + (g.severidade === 'critico' ? 'alerta-problema' : 'alerta-atencao');
      div.innerHTML = '<p class="alerta-detalhe">' + this.esc(g.mensagem) + '</p>';
      caixa.appendChild(div);
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
    const r = await chamarApi('/api/frota?status=todos');
    if (!r.ok) return;
    const sel = document.getElementById('dir-veiculo');
    sel.innerHTML = '';
    r.dados.veiculos.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = v.modelo + ' · ' + v.placa;
      sel.appendChild(o);
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
    const r = await chamarApi(url, {
      metodo: 'POST',
      corpo: corpo
    });
    if (!r.ok) {
      caixa.className = 'resultado-caixa resultado-erro';
      caixa.textContent = r.dados.erro || 'Erro ao consultar a IA.';
      return;
    }
    caixa.className = 'resultado-caixa resultado-ok';
    caixa.textContent = r.dados.resposta;
  }

  aoIniciar() {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 30 * 86400000);
    this.campoAte.value = this.paraInputData(hoje);
    this.campoDe.value = this.paraInputData(inicio);
    const aba = window.location.hash.replace('#', '');
    if (['ocupacao', 'frota', 'gargalos', 'dirigindo', 'ia'].indexOf(aba) !== -1)
      this.mostrarAba(aba);
    this.carregarTudo();
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
new TelaRelatorios();
