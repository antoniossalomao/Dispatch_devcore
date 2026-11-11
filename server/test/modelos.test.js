const test = require('node:test');
const assert = require('node:assert/strict');
const Cnh = require('../src/models/Cnh');
const Quarto = require('../src/models/Quarto');
const Veiculo = require('../src/models/Veiculo');

function dataEm(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return (
    data.getFullYear() +
    '-' +
    String(data.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(data.getDate()).padStart(2, '0')
  );
}

test('CNH distingue ausência, vencimento e prazo de aviso', () => {
  assert.equal(new Cnh('', null).situacao().status, 'sem_cnh');
  assert.equal(new Cnh('B', null).situacao().status, 'vencida');
  assert.equal(new Cnh('B', dataEm(-1)).situacao().status, 'vencida');
  assert.equal(new Cnh('B', dataEm(0)).situacao().status, 'vencendo');
  assert.equal(new Cnh('B', dataEm(30)).situacao().status, 'vencendo');
  assert.equal(new Cnh('B', dataEm(31)).situacao().status, 'valida');
  assert.equal(new Cnh('B', dataEm(15)).situacao(10).status, 'valida');
});

test('categorias de carga e passageiros respeitam a habilitação exigida', () => {
  assert.equal(new Cnh('C').podeDirigir('B'), true);
  assert.equal(new Cnh('D').podeDirigir('C'), false);
  assert.equal(new Cnh('C').podeDirigir('D'), false);
  assert.equal(new Cnh('E').podeDirigir('D'), true);
  assert.equal(new Cnh('E').podeDirigir('A'), false);
  assert.equal(new Cnh('a,b').podeDirigir('A'), true);
  assert.equal(new Cnh('').podeDirigir('B'), false);
});

test('quarto aceita a área mínima e rejeita excesso de leitos', () => {
  const camas = [
    { codigo: '1', tipo: 'cama' },
    { codigo: '2', tipo: 'cama' }
  ];
  assert.equal(new Quarto(6, camas).validar(), null);
  assert.match(new Quarto(5.9, camas).validar(), /Área insuficiente/);
  const noveCamas = Array.from({ length: 9 }, (_, i) => ({ codigo: String(i), tipo: 'cama' }));
  assert.match(new Quarto(50, noveCamas).validar(), /máximo 8/);
});

test('beliche precisa do par e os códigos do quarto não podem se repetir', () => {
  const beliche = [
    { codigo: '1', tipo: 'beliche_baixo' },
    { codigo: '2', tipo: 'beliche_cima' }
  ];
  assert.equal(new Quarto(4.5, beliche).validar(), null);
  assert.match(new Quarto(4.4, beliche).validar(), /Área insuficiente/);
  assert.match(new Quarto(10, [beliche[1]]).validar(), /beliche de baixo/);
  assert.match(new Quarto(10, [beliche[0], beliche[0]]).validar(), /repetido/);
  assert.match(new Quarto(10, []).validar(), /ao menos um leito/);
});

test('veículo normaliza placas antigas e Mercosul e valida lugares e km', () => {
  const dados = {
    placa: 'abc1234',
    modelo: '  Van  ',
    lugares: '8',
    categoria_cnh_exigida: 'd',
    km_inicial: '100'
  };
  const veiculo = new Veiculo(dados);
  assert.equal(veiculo.validar(), null);
  assert.equal(veiculo.placa, 'ABC-1234');
  assert.equal(veiculo.modelo, 'Van');
  assert.equal(new Veiculo({ ...dados, placa: 'abc1d23' }).validar(), null);
  assert.match(new Veiculo({ ...dados, placa: 'abc12' }).validar(), /Placa inválida/);
  assert.match(new Veiculo({ ...dados, lugares: 0 }).validar(), /lugares/);
  assert.match(new Veiculo({ ...dados, km_inicial: -1 }).validar(), /km inicial/);
  assert.match(new Veiculo({ ...dados, km_inicial: 1.5 }).validar(), /inteiro/);
});
