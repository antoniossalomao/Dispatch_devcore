// Validade e categorias da habilitação do colaborador.
class Cnh {
  constructor(categorias, validade) {
    this.categorias = categorias;
    this.validade = validade;
  }

  situacao(diasAlerta) {
    if (!this.categorias || this.categorias.trim() === '') {
      return {
        status: 'sem_cnh',
        rotulo: 'Sem CNH',
        diasRestantes: null
      };
    }
    if (!this.validade) {
      return {
        status: 'vencida',
        rotulo: 'Validade não informada',
        diasRestantes: null
      };
    }

    // Compara as datas à meia-noite local para não deslocar o dia pelo fuso.
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataValidade = new Date(this.validade + 'T00:00:00');
    const diferencaMs = dataValidade.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24));
    const prazoAlerta = diasAlerta || 30;
    if (diasRestantes < 0) {
      return {
        status: 'vencida',
        rotulo: 'Vencida há ' + Math.abs(diasRestantes) + ' dias',
        diasRestantes: diasRestantes
      };
    }
    if (diasRestantes <= prazoAlerta) {
      return {
        status: 'vencendo',
        rotulo: 'Vence em ' + diasRestantes + ' dias',
        diasRestantes: diasRestantes
      };
    }
    return {
      status: 'valida',
      rotulo: 'Válida',
      diasRestantes: diasRestantes
    };
  }

  podeDirigir(categoriaExigida) {
    if (!this.categorias || !categoriaExigida) {
      return false;
    }

    // normaliza para letras maiusculas e pega as categorias separadas (ex: 'A,B' ou 'AB' ou 'B')
    const texto = this.categorias.toUpperCase().replace(/[^A-E]/g, '');
    const exigida = categoriaExigida.toUpperCase().trim();
    if (exigida === 'A') {
      return texto.indexOf('A') !== -1;
    }
    if (exigida === 'B') {
      // B, C, D ou E podem dirigir veículo tipo B
      return (
        texto.indexOf('B') !== -1 ||
        texto.indexOf('C') !== -1 ||
        texto.indexOf('D') !== -1 ||
        texto.indexOf('E') !== -1
      );
    }
    if (exigida === 'C') {
      // carga: C ou E
      return texto.indexOf('C') !== -1 || texto.indexOf('E') !== -1;
    }
    if (exigida === 'D') {
      // van/passageiros: D ou E
      return texto.indexOf('D') !== -1 || texto.indexOf('E') !== -1;
    }
    if (exigida === 'E') {
      // articulado/pesado: apenas E
      return texto.indexOf('E') !== -1;
    }
    return false;
  }
}
module.exports = Cnh;
