// envio de alertas pelo Telegram (Bot API). sem token configurado, so mostra a mensagem no terminal
// precisa de TELEGRAM_BOT_TOKEN no .env. o destino padrao vem de TELEGRAM_CHAT_ID (ou do chat do usuario)

function configurado() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

// devolve { enviado: true } ou { enviado: false, motivo } (nesse caso a mensagem vai pro terminal)
async function enviar(texto, chatId) {
  const destino = chatId || process.env.TELEGRAM_CHAT_ID

  if (!configurado() || !destino) {
    console.log('\n--- SIMULAÇÃO DE ALERTA TELEGRAM ---')
    console.log(texto)
    console.log('------------------------------------\n')
    return {
      enviado: false,
      motivo: !configurado() ? 'sem TELEGRAM_BOT_TOKEN' : 'sem chat id de destino'
    }
  }

  try {
    const resposta = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: destino, text: texto })
    })
    if (!resposta.ok) {
      const dados = await resposta.json().catch(function () { return {} })
      return { enviado: false, motivo: 'Telegram recusou: ' + (dados.description || resposta.status) }
    }
    return { enviado: true }
  } catch (erro) {
    return { enviado: false, motivo: 'falha de rede ao falar com o Telegram' }
  }
}

module.exports = { configurado: configurado, enviar: enviar }
