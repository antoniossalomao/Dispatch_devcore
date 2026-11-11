// Serviço de telegram.
class Telegram {
  configurado() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  async enviar(texto, chatId) {
    const destino = chatId || process.env.TELEGRAM_CHAT_ID;
    if (!this.configurado() || !destino) {
      console.log('\n--- SIMULAÇÃO DE ALERTA TELEGRAM ---');
      console.log(texto);
      console.log('------------------------------------\n');
      return {
        enviado: false,
        motivo: !this.configurado() ? 'sem TELEGRAM_BOT_TOKEN' : 'sem chat id de destino'
      };
    }
    try {
      const resposta = await fetch(
        'https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chat_id: destino,
            text: texto
          })
        }
      );
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => {
          return {};
        });
        return {
          enviado: false,
          motivo: 'Telegram recusou: ' + (dados.description || resposta.status)
        };
      }
      return {
        enviado: true
      };
    } catch (erro) {
      return {
        enviado: false,
        motivo: 'falha de rede ao falar com o Telegram'
      };
    }
  }
}
module.exports = new Telegram();
