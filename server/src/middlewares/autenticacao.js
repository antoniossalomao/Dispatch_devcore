// Confere se quem fez a requisição está logado e se tem permissão (admin ou operador).
const db = require('../db/conexao');

class ControleAcesso {
  constructor() {
    this.validarSessaoUsuario = this.validarSessaoUsuario.bind(this);
    this.exigirLogin = this.exigirLogin.bind(this);
    this.exigirAdmin = this.exigirAdmin.bind(this);
  }

  // Confere direto no banco se o usuário continua ativo e com o mesmo perfil.
  // Assim, se um admin bloquear alguém ou mudar o perfil, o bloqueio vale na hora.
  validarSessaoUsuario(req) {
    const sessUsuario = req.session && req.session.usuario;
    if (!sessUsuario || !sessUsuario.id) return null;

    const usuarioAtual = db
      .prepare('SELECT id, nome, login, perfil, ativo FROM usuario WHERE id = ?')
      .get(Number(sessUsuario.id));

    if (!usuarioAtual || usuarioAtual.ativo !== 1) {
      if (req.session) {
        req.session.destroy(() => {});
      }
      return null;
    }

    req.session.usuario = {
      id: usuarioAtual.id,
      nome: usuarioAtual.nome,
      login: usuarioAtual.login,
      perfil: usuarioAtual.perfil
    };
    return req.session.usuario;
  }

  exigirLogin(req, res, next) {
    const usuario = this.validarSessaoUsuario(req);
    if (!usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    next();
  }

  exigirAdmin(req, res, next) {
    const usuario = this.validarSessaoUsuario(req);
    if (!usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    if (usuario.perfil !== 'admin') {
      return res.status(403).json({
        erro: 'Acesso restrito a administradores.'
      });
    }
    next();
  }
}

module.exports = new ControleAcesso();
