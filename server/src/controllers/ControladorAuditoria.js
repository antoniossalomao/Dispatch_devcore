const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');

// Consulta os logs de auditoria com filtros e dispara a checagem da cadeia de hashes.
class ControladorAuditoria {
  listar(req, res) {
    const busca = String(req.query.busca || '').trim().toLowerCase().slice(0, 200);
    const tabela = String(req.query.tabela || '').trim().slice(0, 60);
    const acao = String(req.query.acao || '').trim().slice(0, 30);
    const brutoLimite = Number(req.query.limite);
    const limite =
      Number.isFinite(brutoLimite) && brutoLimite > 0
        ? Math.min(Math.trunc(brutoLimite), 500)
        : 100;

    let sql =
      'SELECT l.id, l.quando, l.acao, l.tabela, l.registro_id, l.resumo, l.antes_json, l.depois_json, l.hash, u.nome AS usuario ' +
      'FROM log_auditoria l JOIN usuario u ON u.id = l.usuario_id WHERE 1=1 ';
    const params = [];

    if (tabela !== '') {
      sql += 'AND l.tabela = ? ';
      params.push(tabela);
    }
    if (acao !== '') {
      sql += 'AND l.acao = ? ';
      params.push(acao);
    }
    if (busca !== '') {
      sql += 'AND (LOWER(l.resumo) LIKE ? OR LOWER(u.nome) LIKE ?) ';
      params.push('%' + busca + '%', '%' + busca + '%');
    }

    sql += 'ORDER BY l.id DESC LIMIT ?';
    params.push(limite);

    const linhas = db.prepare(sql).all(...params);
    const tabelas = db
      .prepare('SELECT DISTINCT tabela FROM log_auditoria ORDER BY tabela')
      .all()
      .map((item) => item.tabela);
    const total = db.prepare('SELECT COUNT(*) AS n FROM log_auditoria').get().n;

    res.json({
      total: total,
      tabelas: tabelas,
      linhas: linhas
    });
  }

  verificarIntegridade(req, res) {
    res.json(auditoria.verificarIntegridadeLog());
  }
}

module.exports = ControladorAuditoria;
