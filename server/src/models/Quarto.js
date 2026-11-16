// Representa um quarto de alojamento e valida as regras de segurança e espaço da NR-24.
class Quarto {
  constructor(areaM2, leitos) {
    this.areaM2 = areaM2;
    this.leitos = leitos;
  }

  // Pela NR-24, o quarto não pode passar de 8 leitos e a metragem precisa comportar todas as camas/beliches.
  validar() {
    if (this.leitos.length === 0) return 'Informe ao menos um leito.';
    if (this.leitos.length > 8) {
      return 'Um quarto pode ter no máximo 8 leitos (NR-24).';
    }

    let camas = 0;
    let belichesBaixo = 0;
    let belichesCima = 0;
    const codigosUsados = {};

    for (let i = 0; i < this.leitos.length; i++) {
      const leito = this.leitos[i];
      if (!leito.codigo || !['cama', 'beliche_baixo', 'beliche_cima'].includes(leito.tipo)) {
        return 'Cada leito precisa de código e tipo (cama, beliche_baixo ou beliche_cima).';
      }
      if (codigosUsados[leito.codigo]) {
        return 'O código ' + leito.codigo + ' está repetido no quarto.';
      }
      codigosUsados[leito.codigo] = true;

      if (leito.tipo === 'cama') camas++;
      if (leito.tipo === 'beliche_baixo') belichesBaixo++;
      if (leito.tipo === 'beliche_cima') belichesCima++;
    }

    if (belichesCima > belichesBaixo) {
      return 'Todo beliche de cima precisa de um beliche de baixo.';
    }

    // Cada cama simples exige 3 m²; cada beliche (parte de baixo + parte de cima) exige 4,5 m² no total.
    const areaMinima = camas * 3 + belichesBaixo * 4.5;
    if (this.areaM2 < areaMinima) {
      return (
        'Área insuficiente: para esses leitos o quarto precisa de pelo menos ' +
        areaMinima +
        ' m² (NR-24).'
      );
    }
    return null;
  }
}

module.exports = Quarto;
