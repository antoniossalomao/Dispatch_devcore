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
      const a = this.acoes[l.acao] || ['status-concluido', l.acao];
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' +
        this.formatarData(l.quando) +
        '</td><td>' +
        this.esc(l.usuario) +
        '</td>' +
        '<td><span class="status-tag ' +
        a[0] +
        '"><span class="status-ponto"></span>' +
        a[1] +
        '</span></td>' +
        '<td>' +
        this.esc(l.resumo) +
        '<span class="aud-tabela">' +
        this.esc(l.tabela) +
        ' #' +
        l.registro_id +
        '</span></td>' +
        '<td class="aud-diff">' +
        (l.antes_json || l.depois_json
          ? '<span>' +
            this.esc(this.resumirJson(l.antes_json)) +
            '</span><span>→ ' +
            this.esc(this.resumirJson(l.depois_json)) +
            '</span>'
          : '—') +
        '</td>';
      this.corpo.appendChild(tr);
    });
  }
}
new TelaAuditoria();
