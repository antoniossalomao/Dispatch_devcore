const datas = require('../regras/datas');

// Representa um veículo da frota, padronizando a placa e conferindo os campos obrigatórios.
class Veiculo {
  constructor(dados = {}) {
    const entrada = dados || {};
    this.placa = this.normalizarPlaca(entrada.placa);
    this.modelo = String(entrada.modelo || '').trim();
    this.lugares = Number(entrada.lugares);
    this.categoria = String(entrada.categoria_cnh_exigida || '')
      .trim()
      .toUpperCase();
    this.kmInicial =
      entrada.km_inicial === undefined || entrada.km_inicial === '' || entrada.km_inicial === null
        ? 0
        : Number(entrada.km_inicial);
    this.licenciamento = entrada.licenciamento_validade
      ? String(entrada.licenciamento_validade).trim().slice(0, 10)
      : null;
    this.seguro = entrada.seguro_validade
      ? String(entrada.seguro_validade).trim().slice(0, 10)
      : null;
  }

  // Deixa a placa sempre com hífen (AAA-0000 ou Mercosul AAA-0A00) para evitar duplicidade no banco.
  normalizarPlaca(texto) {
    const limpa = String(texto || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return limpa.length === 7 ? limpa.slice(0, 3) + '-' + limpa.slice(3) : limpa;
  }

  validar() {
    if (this.placa === '' || this.modelo === '') return 'Placa e modelo são obrigatórios.';
    if (this.modelo.length > 100) return 'O modelo deve ter no máximo 100 caracteres.';
    if (!/^[A-Z]{3}-[0-9][A-Z0-9][0-9]{2}$/.test(this.placa)) {
      return 'Placa inválida. Use o formato ABC-1234 ou ABC-1D23.';
    }
    if (!Number.isInteger(this.lugares) || this.lugares < 1 || this.lugares > 100) {
      return 'Informe a quantidade de lugares (contando o motorista).';
    }
    if (!['A', 'B', 'C', 'D', 'E'].includes(this.categoria)) {
      return 'Categoria de CNH exigida inválida (A a E).';
    }
    if (!Number.isInteger(this.kmInicial) || this.kmInicial < 0 || this.kmInicial > 10000000) {
      return 'O km inicial precisa ser um número inteiro maior ou igual a zero.';
    }
    if (this.licenciamento && !datas.dataIsoValida(this.licenciamento)) {
      return 'Data de validade do licenciamento inválida.';
    }
    if (this.seguro && !datas.dataIsoValida(this.seguro)) {
      return 'Data de validade do seguro inválida.';
    }
    return null;
  }
}

module.exports = Veiculo;
