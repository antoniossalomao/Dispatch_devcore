// Controla a tela de auditoria.
class TelaAuditoria {
  constructor() {
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
      this.timerBusca = setTimeout(this.carregarLog.bind(this), 300);
    });
    this.seletorTabela.addEventListener('change', this.carregarLog.bind(this));
    this.seletorAcao.addEventListener('change', this.carregarLog.bind(this));
    document.getElementById('botao-verificar').addEventListener('click', async () => {
      const caixa = document.getElementById('aud-integridade');
      const r = await chamarApi('/api/auditoria/integridade');
      caixa.hidden = false;
      if (!r.ok) {
        caixa.className = 'resultado-caixa resultado-erro';
        caixa.textContent = r.dados.erro || 'Erro ao verificar.';
        return;
      }
      const d = r.dados;
      caixa.className = 'resultado-caixa ' + (d.integro ? 'resultado-ok' : 'resultado-erro');
      caixa.textContent =
        (d.integro ? 'Log íntegro. ' : 'ATENÇÃO: log adulterado! ') +
        d.motivo +
        ' (' +
        d.totalLinhas +
        ' linhas conferidas)';
    });
    document.addEventListener('dispatch:config-aba', (evento) => {
      if (evento.detail === 'auditoria') this.carregarLog();
    });
  }

  esc(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatarData(texto) {
    return texto ? texto.slice(0, 19) : '';
  }

  resumirJson(texto) {
    if (!texto) return '—';
    try {
      const o = JSON.parse(texto);
      return Object.keys(o)
        .map((k) => {
          return (
            k +
            ': ' +
            (o[k] === null ? 'vazio' : typeof o[k] === 'object' ? JSON.stringify(o[k]) : o[k])
          );
        })
        .join(' · ');
    } catch (e) {
      return texto;
    }
  }

  async carregarLog() {
    const q =
      '?busca=' +
      encodeURIComponent(this.campoBusca.value) +
      '&tabela=' +
      encodeURIComponent(this.seletorTabela.value) +
      '&acao=' +
      encodeURIComponent(this.seletorAcao.value);
    const r = await chamarApi('/api/auditoria' + q);
    this.corpo.innerHTML = '';
    if (!r.ok) {
      this.corpo.innerHTML =
        '<tr><td colspan="5" class="texto-vazio">' +
        this.esc(r.dados.erro || 'Erro ao carregar o log.') +
        '</td></tr>';
      return;
    }
    if (this.seletorTabela.options.length === 1) {
      r.dados.tabelas.forEach((t) => {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = t;
        this.seletorTabela.appendChild(o);
      });
    }
    document.getElementById('aud-total').textContent = r.dados.total + ' registros no log';
    if (r.dados.linhas.length === 0) {
      this.corpo.innerHTML =
        '<tr><td colspan="5" class="texto-vazio">Nenhum registro encontrado.</td></tr>';
      return;
    }
    r.dados.linhas.forEach((l) => {
      const a = this.acoes[l.acao] || ['status-concluido', l.acao || ''];
      const tr = document.createElement('tr');

      const tdQuando = document.createElement('td');
      tdQuando.textContent = this.formatarData(l.quando);

      const tdUsuario = document.createElement('td');
      tdUsuario.textContent = l.usuario || '';

      const tdAcao = document.createElement('td');
      const tagAcao = document.createElement('span');
      tagAcao.className = 'status-tag ' + a[0];
      const ponto = document.createElement('span');
      ponto.className = 'status-ponto';
      tagAcao.appendChild(ponto);
      tagAcao.appendChild(document.createTextNode(a[1]));
      tdAcao.appendChild(tagAcao);

      const tdResumo = document.createElement('td');
      tdResumo.appendChild(document.createTextNode(l.resumo || ''));
      const spanTabela = document.createElement('span');
      spanTabela.className = 'aud-tabela';
      spanTabela.textContent = (l.tabela || '') + ' #' + (l.registro_id ?? '');
      tdResumo.appendChild(spanTabela);

      const tdDiff = document.createElement('td');
      tdDiff.className = 'aud-diff';
      if (l.antes_json || l.depois_json) {
        const spanAntes = document.createElement('span');
        spanAntes.textContent = this.resumirJson(l.antes_json);
        const spanDepois = document.createElement('span');
        spanDepois.textContent = '→ ' + this.resumirJson(l.depois_json);
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
new TelaAuditoria();
