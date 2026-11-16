const { dataIsoValida } = require('../regras/datas');

// Dados e validações do cadastro de veículos.
class Veiculo {
  constructor(dados = {}) {
    const b = dados || {};
    this.placa = this.normalizarPlaca(b.placa);
    this.modelo = String(b.modelo || '').trim();
    this.lugares = Number(b.lugares);
    this.categoria = String(b.categoria_cnh_exigida || '')
      .trim()
      .toUpperCase();
    this.kmInicial =
      b.km_inicial === undefined || b.km_inicial === '' || b.km_inicial === null
        ? 0
        : Number(b.km_inicial);
    this.licenciamento = b.licenciamento_validade
      ? String(b.licenciamento_validade).trim().slice(0, 10)
      : null;
    this.seguro = b.seguro_validade ? String(b.seguro_validade).trim().slice(0, 10) : null;
  }
  // deixa a placa sempre no formato AAA-0000 / AAA-0A00, assim "abc1234" e "ABC-1234" sao a mesma

  normalizarPlaca(texto) {
    const limpa = String(texto || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return limpa.length === 7 ? limpa.slice(0, 3) + '-' + limpa.slice(3) : limpa;
  }

  validar() {
    if (this.placa === '' || this.modelo === '') return 'Placa e modelo são obrigatórios.';
    if (this.modelo.length > 100) return 'O modelo deve ter no máximo 100 caracteres.';
    if (!/^[A-Z]{3}-[0-9][A-Z0-9][0-9]{2}$/.test(this.placa))
      return 'Placa inválida. Use o formato ABC-1234 ou ABC-1D23.';
    if (!Number.isInteger(this.lugares) || this.lugares < 1 || this.lugares > 100)
      return 'Informe a quantidade de lugares (contando o motorista).';
    if (['A', 'B', 'C', 'D', 'E'].indexOf(this.categoria) === -1)
      return 'Categoria de CNH exigida inválida (A a E).';
    if (!Number.isInteger(this.kmInicial) || this.kmInicial < 0 || this.kmInicial > 10000000)
      return 'O km inicial precisa ser um número inteiro maior ou igual a zero.';
    if (this.licenciamento && !dataIsoValida(this.licenciamento))
      return 'Data de validade do licenciamento inválida.';
    if (this.seguro && !dataIsoValida(this.seguro))
      return 'Data de validade do seguro inválida.';
    return null;
  }
}
module.exports = Veiculo;
