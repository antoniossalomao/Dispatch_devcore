// Ações de auditoria.
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
class ControladorAuditoria {
  exigirLogin(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    if (req.session.usuario.perfil !== 'admin') {
      return res.status(403).json({
        erro: 'Só administradores acessam a auditoria.'
      });
    }
    next();
  }

  listar(req, res) {
    const busca = (req.query.busca || '').trim().toLowerCase();
    const tabela = (req.query.tabela || '').trim();
    const acao = (req.query.acao || '').trim();
    const limite = Math.min(Number(req.query.limite) || 100, 500);
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
    sql += 'ORDER BY l.id DESC LIMIT ' + limite;
    const linhas = db.prepare(sql).all(...params);
    const tabelas = db
      .prepare('SELECT DISTINCT tabela FROM log_auditoria ORDER BY tabela')
      .all()
      .map((t) => {
        return t.tabela;
      });
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
