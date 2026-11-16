// Representa a CNH de um colaborador e ajuda a checar validade e categorias permitidas.
class Cnh {
  constructor(categorias, validade) {
    this.categorias = categorias;
    this.validade = validade;
  }

  // Confere se a habilitação está sem cadastro, vencida, perto de vencer ou em dia.
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

    // Zera a hora para meia-noite local nos dois lados, evitando erro de 1 dia por causa do fuso horário.
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

  // Verifica se as categorias da CNH da pessoa cobrem o tipo exigido pelo veículo (regra do CTB).
  podeDirigir(categoriaExigida) {
    if (!this.categorias || !categoriaExigida) {
      return false;
    }

    // Limpa espaços e vírgulas para comparar apenas as letras A, B, C, D e E.
    const letras = this.categorias.toUpperCase().replace(/[^A-E]/g, '');
    const exigida = categoriaExigida.toUpperCase().trim();

    if (exigida === 'A') {
      return letras.includes('A');
    }
    if (exigida === 'B') {
      // Quem tem B, C, D ou E pode dirigir carro de passeio (categoria B).
      return (
        letras.includes('B') ||
        letras.includes('C') ||
        letras.includes('D') ||
        letras.includes('E')
      );
    }
    if (exigida === 'C') {
      return letras.includes('C') || letras.includes('E');
    }
    if (exigida === 'D') {
      return letras.includes('D') || letras.includes('E');
    }
    if (exigida === 'E') {
      return letras.includes('E');
    }
    return false;
  }
}

module.exports = Cnh;
