// Dados e validações do cadastro de veículos.
class Veiculo {
  constructor(dados) {
    this.placa = this.normalizarPlaca(dados.placa);
    this.modelo = (dados.modelo || '').trim();
    this.lugares = Number(dados.lugares);
    this.categoria = (dados.categoria_cnh_exigida || '').trim().toUpperCase();
    this.kmInicial =
      dados.km_inicial === undefined || dados.km_inicial === '' ? 0 : Number(dados.km_inicial);
    this.licenciamento = dados.licenciamento_validade
      ? String(dados.licenciamento_validade).slice(0, 10)
      : null;
    this.seguro = dados.seguro_validade ? String(dados.seguro_validade).slice(0, 10) : null;
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
    if (!/^[A-Z]{3}-[0-9][A-Z0-9][0-9]{2}$/.test(this.placa))
      return 'Placa inválida. Use o formato ABC-1234 ou ABC-1D23.';
    if (!Number.isInteger(this.lugares) || this.lugares < 1)
      return 'Informe a quantidade de lugares (contando o motorista).';
    if (['A', 'B', 'C', 'D', 'E'].indexOf(this.categoria) === -1)
      return 'Categoria de CNH exigida inválida (A a E).';
    if (!Number.isInteger(this.kmInicial) || this.kmInicial < 0)
      return 'O km inicial precisa ser um número inteiro maior ou igual a zero.';
    return null;
  }
}
module.exports = Veiculo;
