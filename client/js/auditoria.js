// Aba de auditoria dentro de Configurações: filtra alterações antigas e verifica a cadeia de hashes.
export default class TelaAuditoria {
  // ctx vem do js/app/App.js: ctx.sessao() diz quem está logado, ctx.sinal desliga os eventos
  // da janela quando a pessoa sai da tela e ctx.ir('tela') troca de tela sem recarregar.
  constructor(ctx) {
    this.ctx = ctx;
    this.acoes = {
      criou: ['status-ativo', 'Criou'],
      alterou: ['status-uso', 'Alterou'],
      arquivou: ['status-atencao', 'Arquivou']
    };
    this.campoBusca = document.getElementById('aud-busca');
    this.seletorTabela = document.getElementById('aud-tabela');
    this.seletorAcao = document.getElementById('aud-acao');
    this.corpo = document.getElementById('aud-lista');
    this.timerBusca = null;
    this.configurarEventos();
  }

  configurarEventos() {
    this.campoBusca.addEventListener('input', () => {
      if (this.timerBusca) clearTimeout(this.timerBusca);
      // Espera 300 ms após parar de digitar para não fazer uma busca a cada tecla.
      this.timerBusca = setTimeout(this.carregarLog.bind(this), 300);
    });

    this.seletorTabela.addEventListener('change', this.carregarLog.bind(this));
    this.seletorAcao.addEventListener('change', this.carregarLog.bind(this));

    document.getElementById('botao-verificar').addEventListener('click', async () => {
      const caixa = document.getElementById('aud-integridade');
      const resposta = await chamarApi('/api/auditoria/integridade');
      caixa.hidden = false;

      if (!resposta.ok) {
        caixa.className = 'resultado-caixa resultado-erro';
        caixa.textContent = resposta.dados.erro || 'Erro ao verificar.';
        return;
      }

      const dados = resposta.dados;
      caixa.className = 'resultado-caixa ' + (dados.integro ? 'resultado-ok' : 'resultado-erro');
      caixa.textContent =
        (dados.integro ? 'Log íntegro. ' : 'ATENÇÃO: log adulterado! ') +
        dados.motivo +
        ' (' +
        dados.totalLinhas +
        ' linhas conferidas)';
    });

    // Só carrega a tabela quando a pessoa abre a aba de Auditoria em Configurações.
    document.addEventListener(
      'dispatch:config-aba',
      (evento) => {
        if (evento.detail === 'auditoria') this.carregarLog();
      },
      { signal: this.ctx.sinal }
    );
  }

  formatarData(texto) {
    return texto ? texto.slice(0, 19) : '';
  }

  resumirJson(texto) {
    if (!texto) return '—';
    try {
      const objeto = JSON.parse(texto);
      return Object.keys(objeto)
        .map((chave) => {
          const valor = objeto[chave];
          let valorFormatado;
          if (valor === null) {
            valorFormatado = 'vazio';
          } else if (typeof valor === 'object') {
            valorFormatado = JSON.stringify(valor);
          } else {
            valorFormatado = valor;
          }
          return chave + ': ' + valorFormatado;
        })
        .join(' · ');
    } catch (erro) {
      return texto;
    }
  }

  mostrarLinhaAviso(texto) {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 5;
    celula.className = 'texto-vazio';
    celula.textContent = texto;
    linha.appendChild(celula);
    this.corpo.replaceChildren(linha);
  }

  async carregarLog() {
    const consulta =
      '?busca=' +
      encodeURIComponent(this.campoBusca.value) +
      '&tabela=' +
      encodeURIComponent(this.seletorTabela.value) +
      '&acao=' +
      encodeURIComponent(this.seletorAcao.value);

    const resposta = await chamarApi('/api/auditoria' + consulta);
    this.corpo.innerHTML = '';

    if (!resposta.ok) {
      this.mostrarLinhaAviso(resposta.dados.erro || 'Erro ao carregar o log.');
      return;
    }

    if (this.seletorTabela.options.length === 1) {
      resposta.dados.tabelas.forEach((nomeTabela) => {
        const opcao = document.createElement('option');
        opcao.value = nomeTabela;
        opcao.textContent = nomeTabela;
        this.seletorTabela.appendChild(opcao);
      });
    }

    document.getElementById('aud-total').textContent = resposta.dados.total + ' registros no log';
    if (resposta.dados.linhas.length === 0) {
      this.mostrarLinhaAviso('Nenhum registro encontrado.');
      return;
    }

    resposta.dados.linhas.forEach((registro) => {
      const acaoVisual = this.acoes[registro.acao] || ['status-concluido', registro.acao || ''];
      const tr = document.createElement('tr');

      const tdQuando = document.createElement('td');
      tdQuando.textContent = this.formatarData(registro.quando);

      const tdUsuario = document.createElement('td');
      tdUsuario.textContent = registro.usuario || '';

      const tdAcao = document.createElement('td');
      const tagAcao = document.createElement('span');
      tagAcao.className = 'status-tag ' + acaoVisual[0];
      const ponto = document.createElement('span');
      ponto.className = 'status-ponto';
      tagAcao.appendChild(ponto);
      tagAcao.appendChild(document.createTextNode(acaoVisual[1]));
      tdAcao.appendChild(tagAcao);

      const tdResumo = document.createElement('td');
      tdResumo.appendChild(document.createTextNode(registro.resumo || ''));
      const spanTabela = document.createElement('span');
      spanTabela.className = 'aud-tabela';
      const idTexto =
        registro.registro_id !== null && registro.registro_id !== undefined
          ? registro.registro_id
          : '';
      spanTabela.textContent = (registro.tabela || '') + ' #' + idTexto;
      tdResumo.appendChild(spanTabela);

      const tdDiff = document.createElement('td');
      tdDiff.className = 'aud-diff';
      if (registro.antes_json || registro.depois_json) {
        const spanAntes = document.createElement('span');
        spanAntes.textContent = this.resumirJson(registro.antes_json);
        const spanDepois = document.createElement('span');
        spanDepois.textContent = '→ ' + this.resumirJson(registro.depois_json);
        tdDiff.appendChild(spanAntes);
        tdDiff.appendChild(spanDepois);
      } else {
        tdDiff.textContent = '—';
      }

      tr.appendChild(tdQuando);
      tr.appendChild(tdUsuario);
      tr.appendChild(tdAcao);
      tr.appendChild(tdResumo);
      tr.appendChild(tdDiff);
      this.corpo.appendChild(tr);
    });
  }
}
