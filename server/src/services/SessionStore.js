// Guarda os logins ativos dentro do SQLite para ninguém perder a sessão se o servidor reiniciar
// e permitir encerrar sessões na hora quando um usuário é bloqueado ou troca a senha.
const session = require('express-session');
const db = require('../db/conexao');

class SqliteSessionStore extends session.Store {
  constructor(conexao, opcoes = {}) {
    super();
    this.db = conexao;
    this.ttlMs = opcoes.ttlMs || 1000 * 60 * 60 * 8;

    this.db.exec(
      'CREATE TABLE IF NOT EXISTS sessao (' +
        'sid TEXT PRIMARY KEY, ' +
        'usuario_id INTEGER REFERENCES usuario(id) ON DELETE CASCADE, ' +
        'dados TEXT NOT NULL, ' +
        'expira_em INTEGER NOT NULL' +
        ');' +
        'CREATE INDEX IF NOT EXISTS idx_sessao_usuario ON sessao (usuario_id);' +
        'CREATE INDEX IF NOT EXISTS idx_sessao_expira ON sessao (expira_em);'
    );

    // Faxina automática a cada 15 minutos para apagar sessões antigas que já venceram.
    this.timerLimpeza = setInterval(() => {
      this.limparExpiradas();
    }, 15 * 60 * 1000);
    // O .unref() avisa o Node para não segurar o processo aberto só por causa desse timer na hora de fechar.
    if (this.timerLimpeza.unref) this.timerLimpeza.unref();
  }

  get(sid, cb) {
    try {
      const linha = this.db
        .prepare('SELECT dados, expira_em FROM sessao WHERE sid = ?')
        .get(sid);
      if (!linha) return cb(null, null);

      if (linha.expira_em <= Date.now()) {
        this.db.prepare('DELETE FROM sessao WHERE sid = ?').run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(linha.dados));
    } catch (erro) {
      return cb(erro);
    }
  }

  set(sid, sess, cb) {
    try {
      const expiraEm =
        sess && sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires).getTime()
          : Date.now() + this.ttlMs;
      const uid =
        sess && sess.usuario && Number.isInteger(Number(sess.usuario.id))
          ? Number(sess.usuario.id)
          : null;
      const dadosJson = JSON.stringify(sess);

      this.db
        .prepare(
          'INSERT INTO sessao (sid, usuario_id, dados, expira_em) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(sid) DO UPDATE SET usuario_id = excluded.usuario_id, dados = excluded.dados, expira_em = excluded.expira_em'
        )
        .run(sid, uid, dadosJson, expiraEm);
      if (cb) cb(null);
    } catch (erro) {
      if (cb) cb(erro);
    }
  }

  destroy(sid, cb) {
    try {
      this.db.prepare('DELETE FROM sessao WHERE sid = ?').run(sid);
      if (cb) cb(null);
    } catch (erro) {
      if (cb) cb(erro);
    }
  }

  touch(sid, sess, cb) {
    try {
      const expiraEm =
        sess && sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires).getTime()
          : Date.now() + this.ttlMs;
      const uid =
        sess && sess.usuario && Number.isInteger(Number(sess.usuario.id))
          ? Number(sess.usuario.id)
          : null;

      this.db
        .prepare('UPDATE sessao SET expira_em = ?, usuario_id = ? WHERE sid = ?')
        .run(expiraEm, uid, sid);
      if (cb) cb(null);
    } catch (erro) {
      if (cb) cb(erro);
    }
  }

  limparExpiradas() {
    try {
      this.db.prepare('DELETE FROM sessao WHERE expira_em <= ?').run(Date.now());
    } catch (_) {
      // Se o banco já fechou durante o desligamento ou nos testes, apenas ignora.
    }
  }

  // Derruba todas as sessões de um usuário (opcionalmente mantendo a sessão atual se ele mesmo trocou a senha).
  revogarPorUsuario(usuarioId, excetoSid) {
    const uid = Number(usuarioId);
    if (!Number.isInteger(uid) || uid <= 0) return;

    if (excetoSid) {
      this.db.prepare('DELETE FROM sessao WHERE usuario_id = ? AND sid != ?').run(uid, excetoSid);
    } else {
      this.db.prepare('DELETE FROM sessao WHERE usuario_id = ?').run(uid);
    }
  }
}

module.exports = new SqliteSessionStore(db);
module.exports.SqliteSessionStore = SqliteSessionStore;
