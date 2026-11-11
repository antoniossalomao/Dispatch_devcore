// Serviço de ia.
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
    const o = opcoes || {};
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
          temperature: o.temperatura === undefined ? 0.2 : o.temperatura,
          max_tokens: o.maxTokens || 700
        })
      });
    } catch (erro) {
      throw new Error('Não foi possível falar com a Groq (falha de rede).');
    }
    const dados = await resposta.json().catch(() => {
      return {};
    });
    if (!resposta.ok) {
      throw new Error(
        'A Groq recusou o pedido: ' + ((dados.error && dados.error.message) || resposta.status)
      );
    }
    return String(
      (dados.choices && dados.choices[0] && dados.choices[0].message.content) || ''
    ).trim();
  }

  // Se a Groq falhar, a notificação usa o texto original.

  async redigirAlerta(texto) {
    if (!this.configurada()) return texto;
    try {
      const r = await this.perguntar(
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
      return r || texto;
    } catch (erro) {
      return texto;
    }
  }
}
module.exports = new InteligenciaArtificial();
