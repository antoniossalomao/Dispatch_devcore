// Confere a capacidade, os tipos de leito e a área mínima da NR-24.
class Quarto {
  constructor(areaM2, leitos) {
    this.areaM2 = areaM2;
    this.leitos = leitos;
  }
  // A4 e A5: no maximo 8 leitos e a area precisa caber os leitos

  validar() {
    if (this.leitos.length === 0) return 'Informe ao menos um leito.';
    if (this.leitos.length > 8) {
      return 'Um quarto pode ter no máximo 8 leitos (NR-24).';
    }
    let camas = 0;
    let baixos = 0;
    let cimas = 0;
    const codigos = {};
    for (let i = 0; i < this.leitos.length; i++) {
      const l = this.leitos[i];
      if (!l.codigo || ['cama', 'beliche_baixo', 'beliche_cima'].indexOf(l.tipo) === -1) {
        return 'Cada leito precisa de código e tipo (cama, beliche_baixo ou beliche_cima).';
      }
      if (codigos[l.codigo]) return 'O código ' + l.codigo + ' está repetido no quarto.';
      codigos[l.codigo] = true;
      if (l.tipo === 'cama') camas++;
      if (l.tipo === 'beliche_baixo') baixos++;
      if (l.tipo === 'beliche_cima') cimas++;
    }
    if (cimas > baixos) return 'Todo beliche de cima precisa de um beliche de baixo.';
    // Os dois leitos do beliche compartilham a área mínima de 4,5 m².
    const minimo = camas * 3 + baixos * 4.5;
    if (this.areaM2 < minimo) {
      return (
        'Área insuficiente: para esses leitos o quarto precisa de pelo menos ' +
        minimo +
        ' m² (NR-24).'
      );
    }
    return null;
  }
}
module.exports = Quarto;
