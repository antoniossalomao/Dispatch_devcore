class Api {
  constructor() {
    // O Live Server abre o HTML em outra porta durante o desenvolvimento.
    this.endereco =
      window.location.port === '3001'
        ? ''
        : 'http://' + (window.location.hostname || 'localhost') + ':3001';
    this.sequencia = 0;
  }

  async enviar(caminho, opcoes) {
    const config = opcoes || {};
    const detalhe = { id: ++this.sequencia, metodo: config.metodo || 'GET' };
    document.dispatchEvent(new CustomEvent('dispatch:requisicao-inicio', { detail: detalhe }));

    try {
      const resposta = await fetch(this.endereco + caminho, {
        method: detalhe.metodo,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: config.corpo ? JSON.stringify(config.corpo) : undefined
      });
      const dados = await resposta.json().catch(() => ({}));
      return { ok: resposta.ok, status: resposta.status, dados: dados };
    } finally {
      // Libera o formulário mesmo quando a rede falha.
      document.dispatchEvent(new CustomEvent('dispatch:requisicao-fim', { detail: detalhe }));
    }
  }
}

const api = new Api();
const baseApi = api.endereco;

function chamarApi(caminho, opcoes) {
  return api.enviar(caminho, opcoes);
}
