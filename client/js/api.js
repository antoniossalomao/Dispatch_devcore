// Centraliza as chamadas HTTP para o servidor usando fetch e mantém a sessão via cookie.
class Api {
  constructor() {
    const ehLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const liveServer =
      ehLocal &&
      window.location.protocol === 'http:' &&
      ['5500', '5501'].includes(window.location.port);

    // No site publicado, a API fica no mesmo domínio e protocolo da página (prefixo vazio).
    // Só quando abrimos o HTML pelo Live Server do VS Code (portas 5500/5501) apontamos para a porta 3001.
    this.endereco = liveServer ? 'http://' + window.location.hostname + ':3001' : '';
    this.sequencia = 0;
  }

  async enviar(caminho, opcoes) {
    const config = opcoes || {};
    const detalhe = { id: ++this.sequencia, metodo: config.metodo || 'GET' };

    // Avisa o resto da tela que uma requisição começou (usado para travar botão contra clique duplo).
    document.dispatchEvent(new CustomEvent('dispatch:requisicao-inicio', { detail: detalhe }));

    try {
      const resposta = await fetch(this.endereco + caminho, {
        method: detalhe.metodo,
        headers: { 'Content-Type': 'application/json' },
        // include envia o cookie de sessão mesmo quando o front roda no Live Server local.
        credentials: 'include',
        body: config.corpo ? JSON.stringify(config.corpo) : undefined
      });
      const dados = await resposta.json().catch(() => ({}));
      return { ok: resposta.ok, status: resposta.status, dados: dados };
    } finally {
      // Libera os formulários ao terminar, mesmo se a conexão falhar.
      document.dispatchEvent(new CustomEvent('dispatch:requisicao-fim', { detail: detalhe }));
    }
  }
}

const api = new Api();
const baseApi = api.endereco;

function chamarApi(caminho, opcoes) {
  return api.enviar(caminho, opcoes);
}
