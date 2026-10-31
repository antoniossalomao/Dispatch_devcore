// regras de validacao e consulta de CNH (regras F3, F4 e F5 do planejamento)

// confere a situacao da CNH em relacao a data atual
// retorna: 'sem_cnh', 'vencida', 'vencendo' (em ate 30 dias) ou 'valida'
function verificarSituacaoCnh(cnhCategorias, cnhValidade, diasAlerta) {
  if (!cnhCategorias || cnhCategorias.trim() === '') {
    return {
      status: 'sem_cnh',
      rotulo: 'Sem CNH',
      diasRestantes: null
    }
  }

  if (!cnhValidade) {
    return {
      status: 'vencida',
      rotulo: 'Validade não informada',
      diasRestantes: null
    }
  }

  // comparacao de datas no formato AAAA-MM-DD
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const dataValidade = new Date(cnhValidade + 'T00:00:00')
  const diferencaMs = dataValidade.getTime() - hoje.getTime()
  const diasRestantes = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24))

  const prazoAlerta = diasAlerta || 30

  if (diasRestantes < 0) {
    return {
      status: 'vencida',
      rotulo: 'Vencida há ' + Math.abs(diasRestantes) + ' dias',
      diasRestantes: diasRestantes
    }
  }

  if (diasRestantes <= prazoAlerta) {
    return {
      status: 'vencendo',
      rotulo: 'Vence em ' + diasRestantes + ' dias',
      diasRestantes: diasRestantes
    }
  }

  return {
    status: 'valida',
    rotulo: 'Válida',
    diasRestantes: diasRestantes
  }
}

// regra F5: quem tem C ou D tambem dirige B, e quem tem E dirige tudo
function categoriaAtende(cnhColaborador, categoriaExigida) {
  if (!cnhColaborador || !categoriaExigida) {
    return false
  }

  // normaliza para letras maiusculas e pega as categorias separadas (ex: 'A,B' ou 'AB' ou 'B')
  const texto = cnhColaborador.toUpperCase().replace(/[^A-E]/g, '')
  const exigida = categoriaExigida.toUpperCase().trim()

  if (exigida === 'A') {
    return texto.indexOf('A') !== -1
  }

  if (exigida === 'B') {
    // B, C, D ou E podem dirigir veículo tipo B
    return (
      texto.indexOf('B') !== -1 ||
      texto.indexOf('C') !== -1 ||
      texto.indexOf('D') !== -1 ||
      texto.indexOf('E') !== -1
    )
  }

  if (exigida === 'C') {
    // carga: C ou E
    return texto.indexOf('C') !== -1 || texto.indexOf('E') !== -1
  }

  if (exigida === 'D') {
    // van/passageiros: D ou E
    return texto.indexOf('D') !== -1 || texto.indexOf('E') !== -1
  }

  if (exigida === 'E') {
    // articulado/pesado: apenas E
    return texto.indexOf('E') !== -1
  }

  return false
}

module.exports = {
  verificarSituacaoCnh: verificarSituacaoCnh,
  categoriaAtende: categoriaAtende
}
