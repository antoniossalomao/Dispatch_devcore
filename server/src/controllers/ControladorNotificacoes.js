const db = require('../db/conexao');
const notificacoes = require('../services/Notificacoes');
const configuracao = require('../services/Configuracao');
const validador = require('../regras/validacao');

// Lista avisos gerados pelo sistema e permite marcar como lidos (ocultando alertas críticos de auditoria para operadores).
class ControladorNotificacoes {
  async listar(req, res) {
    if (notificacoes.precisaVerificar()) {
      await notificacoes.verificar(configuracao.lerConfig());
    }

    const todas = req.query.todas === '1';
    const ehAdmin = req.session.usuario.perfil === 'admin';
    const condicoes = [];
    if (!todas) condicoes.push('lida = 0');
    if (!ehAdmin) condicoes.push("tipo != 'log_adulterado'");

    const whereSql = condicoes.length > 0 ? 'WHERE ' + condicoes.join(' AND ') + ' ' : '';
    const linhas = db
      .prepare(
        'SELECT id, tipo, severidade, mensagem, tabela, registro_id, criada_em, lida, enviada_telegram FROM notificacao ' +
          whereSql +
          "ORDER BY lida ASC, CASE severidade WHEN 'critico' THEN 0 ELSE 1 END, id DESC LIMIT 100"
      )
      .all();

    const whereNaoLidas = ehAdmin ? 'WHERE lida = 0' : "WHERE lida = 0 AND tipo != 'log_adulterado'";
    const naoLidas = db.prepare('SELECT COUNT(*) AS n FROM notificacao ' + whereNaoLidas).get().n;

    res.json({
      nao_lidas: naoLidas,
      notificacoes: linhas
    });
  }

  marcarTodasComoLidas(req, res) {
    if (req.session.usuario.perfil === 'admin') {
      db.prepare('UPDATE notificacao SET lida = 1 WHERE lida = 0').run();
    } else {
      db.prepare("UPDATE notificacao SET lida = 1 WHERE lida = 0 AND tipo != 'log_adulterado'").run();
    }
    res.json({ mensagem: 'Todos os avisos foram marcados como lidos.' });
  }

  marcarComoLida(req, res) {
    const id = validador.lerIdPositivo(req.params.id);
    if (!id) {
      return res.status(400).json({ erro: 'ID de aviso inválido.' });
    }

    const aviso = db.prepare('SELECT id, tipo FROM notificacao WHERE id = ?').get(id);
    if (!aviso) {
      return res.status(404).json({ erro: 'Aviso não encontrado.' });
    }
    if (aviso.tipo === 'log_adulterado' && req.session.usuario.perfil !== 'admin') {
      return res.status(403).json({
        erro: 'Apenas administradores podem dispensar alertas de adulteração.'
      });
    }

    db.prepare('UPDATE notificacao SET lida = 1 WHERE id = ?').run(id);
    res.json({ mensagem: 'Aviso marcado como lido.' });
  }
}

module.exports = ControladorNotificacoes;
