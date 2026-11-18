// Faz a ponte com a API da Groq para responder perguntas do resumo e melhorar o texto dos alertas.
class InteligenciaArtificial {
  constructor() {
    this.modelo = process.env.GROQ_MODELO || 'llama-3.3-70b-versatile';
    this.urlGroq = 'https://api.groq.com/openai/v1/chat/completions';
  }

  configurada() {
    return Boolean(process.env.GROQ_API_KEY);
  }

  async perguntar(mensagens, opcoes) {
    if (!this.configurada()) {
      throw new Error('IA desligada: defina GROQ_API_KEY no server/.env para usar este recurso.');
    }
    const config = opcoes || {};
    let resposta;
    try {
      resposta = await fetch(this.urlGroq, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model: this.modelo,
          messages: mensagens,
          temperature: config.temperatura === undefined ? 0.2 : config.temperatura,
          max_tokens: config.maxTokens || 700
        }),
        // Cancela a chamada se passar de 10 segundos para o sistema não ficar travado esperando resposta externa.
        signal: AbortSignal.timeout(10000)
      });
    } catch (erro) {
      throw new Error(
        erro && (erro.name === 'TimeoutError' || erro.name === 'AbortError')
          ? 'Não foi possível falar com a Groq (falha de rede — tempo esgotado).'
          : 'Não foi possível falar com a Groq (falha de rede).'
      );
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = new Error(
        'A Groq recusou o pedido: ' + ((dados.error && dados.error.message) || resposta.status)
      );
      // 401 = a chave do .env está errada ou foi apagada lá na Groq; o controlador avisa isso na tela.
      erro.chaveInvalida = resposta.status === 401;
      throw erro;
    }

    return String(
      (dados.choices && dados.choices[0] && dados.choices[0].message.content) || ''
    ).trim();
  }

  // Tenta deixar o alerta mais curto e legível antes de mandar no Telegram; se falhar, manda o texto original.
  async redigirAlerta(texto) {
    if (!this.configurada()) return texto;
    try {
      const textoMelhorado = await this.perguntar(
        [
          {
            role: 'system',
            content:
              'Reescreva o alerta abaixo em português do Brasil, em no máximo 2 frases curtas, direto ao ponto, sem inventar dados e sem emojis. Mantenha placas, números e datas exatamente como estão.'
          },
          {
            role: 'user',
            content: texto
          }
        ],
        {
          maxTokens: 150,
          temperatura: 0.1
        }
      );
      return textoMelhorado || texto;
    } catch (erro) {
      return texto;
    }
  }
}

module.exports = new InteligenciaArtificial();
