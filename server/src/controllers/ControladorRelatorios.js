const relatorios = require('../services/Relatorios');
// Ações de relatorios.
const db = require('../db/conexao');
const { agoraLocal, normalizarData } = require('../regras/datas');
class ControladorRelatorios {
  exigirLogin(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    next();
  }

  consultarOcupacao(req, res) {
    const periodo = relatorios.lerPeriodo(req.query);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    res.json(relatorios.calcularOcupacao(periodo));
  }

  consultarFrota(req, res) {
    const periodo = relatorios.lerPeriodo(req.query);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    res.json(relatorios.calcularFrota(periodo));
  }

  consultarMovimentacoes(req, res) {
    const periodo = relatorios.lerPeriodo(req.query);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    res.json(relatorios.calcularMovimentacoes(periodo, req.query));
  }

  consultarGargalos(req, res) {
    const periodo = relatorios.lerPeriodo(req.query);
    if (!periodo)
      return res.status(400).json({
        erro: 'Período inválido.'
      });
    res.json(relatorios.calcularGargalos(periodo));
  }

  consultarCondutor(req, res) {
    const veiculoId = Number(req.query.veiculo_id);
    const quando = normalizarData(req.query.quando);
    if (!veiculoId || !quando)
      return res.status(400).json({
        erro: 'Informe o veículo e a data/hora.'
      });
    const veiculo = db.prepare('SELECT id, placa, modelo FROM veiculo WHERE id = ?').get(veiculoId);
    if (!veiculo)
      return res.status(404).json({
        erro: 'Veículo não encontrado.'
      });
    const uso = db
      .prepare(
        'SELECT u.*, p.nome AS motorista, p.matricula FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id ' +
          'WHERE u.veiculo_id = ? AND u.saida <= ? AND (u.retorno IS NULL OR u.retorno >= ?) ORDER BY u.saida DESC LIMIT 1'
      )
      .get(veiculoId, quando, quando);
    if (uso) {
      const passageiros = db
        .prepare(
          'SELECT p.nome FROM uso_passageiro up JOIN pessoa p ON p.id = up.pessoa_id WHERE up.uso_veiculo_id = ? ORDER BY p.nome'
        )
        .all(uso.id)
        .map((p) => {
          return p.nome;
        });
      return res.json({
        encontrado: true,
        veiculo: veiculo,
        quando: quando,
        motorista: uso.motorista,
        matricula: uso.matricula,
        destino: uso.destino,
        saida: uso.saida,
        retorno: uso.retorno,
        passageiros: passageiros
      });
    }
    const anterior = db
      .prepare(
        'SELECT retorno, km_retorno FROM uso_veiculo WHERE veiculo_id = ? AND retorno IS NOT NULL AND retorno < ? ORDER BY retorno DESC LIMIT 1'
      )
      .get(veiculoId, quando);
    const seguinte = db
      .prepare(
        'SELECT saida, km_saida FROM uso_veiculo WHERE veiculo_id = ? AND saida > ? ORDER BY saida ASC LIMIT 1'
      )
      .get(veiculoId, quando);
    if (anterior && seguinte && seguinte.km_saida > anterior.km_retorno) {
      return res.json({
        encontrado: false,
        uso_sem_registro: true,
        veiculo: veiculo,
        quando: quando,
        aviso:
          'Nenhum uso registrado nesse horário, mas o km passou de ' +
          anterior.km_retorno +
          ' (volta em ' +
          anterior.retorno +
          ') para ' +
          seguinte.km_saida +
          ' (próxima saída em ' +
          seguinte.saida +
          '): o veículo foi usado sem registro (' +
          (seguinte.km_saida - anterior.km_retorno) +
          ' km).'
      });
    }
    res.json({
      encontrado: false,
      uso_sem_registro: false,
      veiculo: veiculo,
      quando: quando,
      aviso: 'Nenhum uso registrado para esse veículo nesse horário.'
    });
  }
}
module.exports = ControladorRelatorios;
