// Ações de resumo.
const db = require('../db/conexao');
const configuracao = require('../services/Configuracao');
const notificacoes = require('../services/Notificacoes');
class ControladorResumo {
  constructor() {
    this.titulosAviso = {
      cnh_vencendo: 'CNH próxima do vencimento',
      cnh_vencida: 'CNH vencida',
      cnh_vencida_na_rua: 'CNH vencida com veículo na rua',
      licenciamento_vencendo: 'Licenciamento próximo do vencimento',
      licenciamento_vencido: 'Licenciamento vencido',
      seguro_vencendo: 'Seguro próximo do vencimento',
      seguro_vencido: 'Seguro vencido',
      km_sem_registro: 'Divergência de quilometragem',
      nao_voltou: 'Veículo não devolvido',
      alojamento_lotado: 'Alojamento lotado',
      ocorrencia_antiga: 'Ocorrência aberta há muito tempo',
      oficina_longa: 'Veículo parado na oficina',
      log_adulterado: 'Log de auditoria adulterado'
    };
  }

  async consultar(req, res) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    const totalVeiculos = db
      .prepare('SELECT COUNT(*) AS total FROM veiculo WHERE ativo = 1')
      .get().total;
    const totalAlojamentos = db
      .prepare('SELECT COUNT(*) AS total FROM alojamento WHERE ativo = 1')
      .get().total;
    if (totalVeiculos === 0 && totalAlojamentos === 0) {
      return res.json({
        exemplo: true,
        nomeEmpresa: configuracao.lerConfig().nomeEmpresa,
        veiculosEmUso: 25,
        veiculosDisponiveis: 7,
        veiculosManutencao: 2,
        totalVeiculos: 34,
        totalAlojamentos: 3,
        totalLeitos: 42,
        leitosOcupados: 23,
        vagasDisponiveis: 19,
        movimentacoes: [
          {
            colaborador: 'João Vitor',
            cargo: 'Técnico de Obras',
            categoria: 'alojamento',
            tipo: 'Entrada',
            recurso: 'Alojamento Centro · Quarto 02',
            horario: '17:20',
            status: 'Ativo'
          },
          {
            colaborador: 'Kelvin Gomes',
            cargo: 'Engenheiro Residente',
            categoria: 'frota',
            tipo: 'Retirada',
            recurso: 'Toyota Corolla · ABC-1234',
            horario: '15:42',
            status: 'Em uso'
          },
          {
            colaborador: 'Bruno Martins',
            cargo: 'Mestre de Obras',
            categoria: 'alojamento',
            tipo: 'Transferência',
            recurso: 'Alojamento Sul → Centro',
            horario: '14:10',
            status: 'Concluído'
          },
          {
            colaborador: 'Henrique Di Manno',
            cargo: 'Topógrafo',
            categoria: 'frota',
            tipo: 'Devolução',
            recurso: 'Toyota Hilux · DEF-5678',
            horario: '11:35',
            status: 'Concluído'
          },
          {
            colaborador: 'Matheus Silva',
            cargo: 'Eletricista',
            categoria: 'frota',
            tipo: 'Retirada',
            recurso: 'Fiat Strada · GHI-9012',
            horario: '09:15',
            status: 'Em uso'
          }
        ],
        alojamentos: [
          {
            nome: 'Alojamento Centro',
            cidade: 'Marília/SP',
            ocupados: 11,
            total: 16
          },
          {
            nome: 'Alojamento Obra Norte',
            cidade: 'Assis/SP',
            ocupados: 8,
            total: 14
          },
          {
            nome: 'Alojamento Sul',
            cidade: 'Ourinhos/SP',
            ocupados: 4,
            total: 12
          }
        ],
        alertas: [
          {
            nivel: 'atencao',
            titulo: 'CNH próxima do vencimento',
            detalhe: 'Carlos Eduardo · vence em 12 dias'
          },
          {
            nivel: 'problema',
            titulo: 'Veículo em manutenção corretiva',
            detalhe: 'Renault Master · JKL-3456 há 4 dias na oficina'
          },
          {
            nivel: 'atencao',
            titulo: 'Divergência de quilometragem',
            detalhe: 'Saveiro MNO-7890 · +38 km sem saída registrada'
          }
        ]
      });
    }
    const veiculosEmUso = db
      .prepare(
        'SELECT COUNT(DISTINCT u.veiculo_id) AS total FROM uso_veiculo u ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'WHERE v.ativo = 1 AND u.retorno IS NULL'
      )
      .get().total;
    const veiculosManutencao = db
      .prepare(
        'SELECT COUNT(DISTINCT m.veiculo_id) AS total FROM manutencao m ' +
          'JOIN veiculo v ON v.id = m.veiculo_id ' +
          'WHERE v.ativo = 1 AND m.fim IS NULL'
      )
      .get().total;
    let veiculosDisponiveis = totalVeiculos - veiculosEmUso - veiculosManutencao;
    if (veiculosDisponiveis < 0) {
      veiculosDisponiveis = 0;
    }
    const totalLeitos = db
      .prepare(
        'SELECT COUNT(*) AS total FROM leito l ' +
          'JOIN quarto q ON q.id = l.quarto_id ' +
          'JOIN alojamento a ON a.id = q.alojamento_id ' +
          'WHERE a.ativo = 1'
      )
      .get().total;
    const leitosOcupados = db
      .prepare(
        'SELECT COUNT(DISTINCT e.leito_id) AS total FROM estadia e ' +
          'JOIN leito l ON l.id = e.leito_id ' +
          'JOIN quarto q ON q.id = l.quarto_id ' +
          'JOIN alojamento a ON a.id = q.alojamento_id ' +
          'WHERE a.ativo = 1 AND e.fim IS NULL'
      )
      .get().total;
    let vagasDisponiveis = totalLeitos - leitosOcupados;
    if (vagasDisponiveis < 0) {
      vagasDisponiveis = 0;
    }
    const ultimas = db
      .prepare(
        "SELECT p.nome AS colaborador, p.cargo AS cargo, 'alojamento' AS categoria, " +
          "CASE WHEN e.fim IS NULL THEN 'Entrada' ELSE 'Saída' END AS tipo, " +
          "(a.nome || ' · ' || l.codigo) AS recurso, " +
          'substr(COALESCE(e.fim, e.inicio), 12, 5) AS horario, ' +
          "CASE WHEN e.fim IS NULL THEN 'Ativo' ELSE 'Concluído' END AS status, " +
          'COALESCE(e.fim, e.inicio) AS data_ordem ' +
          'FROM estadia e ' +
          'JOIN pessoa p ON p.id = e.pessoa_id ' +
          'JOIN leito l ON l.id = e.leito_id ' +
          'JOIN quarto q ON q.id = l.quarto_id ' +
          'JOIN alojamento a ON a.id = q.alojamento_id ' +
          'UNION ALL ' +
          "SELECT p.nome AS colaborador, p.cargo AS cargo, 'frota' AS categoria, " +
          "CASE WHEN u.retorno IS NULL THEN 'Retirada' ELSE 'Devolução' END AS tipo, " +
          "(v.modelo || ' · ' || v.placa) AS recurso, " +
          'substr(COALESCE(u.retorno, u.saida), 12, 5) AS horario, ' +
          "CASE WHEN u.retorno IS NULL THEN 'Em uso' ELSE 'Concluído' END AS status, " +
          'COALESCE(u.retorno, u.saida) AS data_ordem ' +
          'FROM uso_veiculo u ' +
          'JOIN pessoa p ON p.id = u.motorista_id ' +
          'JOIN veiculo v ON v.id = u.veiculo_id ' +
          'ORDER BY data_ordem DESC LIMIT 6'
      )
      .all();
    const listaAlojamentos = db
      .prepare(
        'SELECT a.nome, a.cidade, ' +
          'COUNT(DISTINCT l.id) AS total, ' +
          'COUNT(DISTINCT CASE WHEN e.fim IS NULL THEN e.leito_id END) AS ocupados ' +
          'FROM alojamento a ' +
          'LEFT JOIN quarto q ON q.alojamento_id = a.id ' +
          'LEFT JOIN leito l ON l.quarto_id = q.id ' +
          'LEFT JOIN estadia e ON e.leito_id = l.id AND e.fim IS NULL ' +
          'WHERE a.ativo = 1 ' +
          'GROUP BY a.id'
      )
      .all();
    if (notificacoes.precisaVerificar()) {
      await notificacoes.verificar(configuracao.lerConfig());
    }
    const alertas = db
      .prepare(
        "SELECT tipo, severidade, mensagem FROM notificacao WHERE lida = 0 ORDER BY CASE severidade WHEN 'critico' THEN 0 ELSE 1 END, id DESC LIMIT 10"
      )
      .all()
      .map((n) => {
        return {
          nivel: n.severidade === 'critico' ? 'problema' : 'atencao',
          titulo: this.titulosAviso[n.tipo] || 'Aviso',
          detalhe: n.mensagem
        };
      });
    res.json({
      exemplo: false,
      nomeEmpresa: configuracao.lerConfig().nomeEmpresa,
      veiculosEmUso: veiculosEmUso,
      veiculosDisponiveis: veiculosDisponiveis,
      veiculosManutencao: veiculosManutencao,
      totalVeiculos: totalVeiculos,
      totalAlojamentos: totalAlojamentos,
      totalLeitos: totalLeitos,
      leitosOcupados: leitosOcupados,
      vagasDisponiveis: vagasDisponiveis,
      movimentacoes: ultimas,
      alojamentos: listaAlojamentos,
      alertas: alertas
    });
  }
}
module.exports = ControladorResumo;
