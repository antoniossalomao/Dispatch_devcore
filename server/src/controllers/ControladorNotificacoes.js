// Ações de notificacoes.
const db = require('../db/conexao');
const notificacoes = require('../services/Notificacoes');
const configuracao = require('../services/Configuracao');
class ControladorNotificacoes {
  exigirLogin(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    next();
  }

  async listar(req, res) {
    if (notificacoes.precisaVerificar()) {
      await notificacoes.verificar(configuracao.lerConfig());
    }
    const todas = req.query.todas === '1';
    const linhas = db
      .prepare(
        'SELECT id, tipo, severidade, mensagem, tabela, registro_id, criada_em, lida, enviada_telegram FROM notificacao ' +
          (todas ? '' : 'WHERE lida = 0 ') +
          "ORDER BY lida ASC, CASE severidade WHEN 'critico' THEN 0 ELSE 1 END, id DESC LIMIT 100"
      )
      .all();
    const naoLidas = db.prepare('SELECT COUNT(*) AS n FROM notificacao WHERE lida = 0').get().n;
    res.json({
      nao_lidas: naoLidas,
      notificacoes: linhas
    });
  }

  marcarTodasComoLidas(req, res) {
    db.prepare('UPDATE notificacao SET lida = 1 WHERE lida = 0').run();
    res.json({
      mensagem: 'Todos os avisos foram marcados como lidos.'
    });
  }

  marcarComoLida(req, res) {
    const r = db.prepare('UPDATE notificacao SET lida = 1 WHERE id = ?').run(Number(req.params.id));
    if (Number(r.changes) === 0)
      return res.status(404).json({
        erro: 'Aviso não encontrado.'
      });
    res.json({
      mensagem: 'Aviso marcado como lido.'
    });
  }
}
module.exports = ControladorNotificacoes;
