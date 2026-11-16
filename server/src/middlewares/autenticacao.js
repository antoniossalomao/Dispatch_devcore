// Middleware centralizado de autenticação e autorização com revalidação no banco.
const db = require('../db/conexao');

function validarSessaoUsuario(req) {
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

function exigirLogin(req, res, next) {
  const usuario = validarSessaoUsuario(req);
  if (!usuario) {
    return res.status(401).json({
      erro: 'Faça login para acessar.'
    });
  }
  next();
}

function exigirAdmin(req, res, next) {
  const usuario = validarSessaoUsuario(req);
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

module.exports = {
  validarSessaoUsuario: validarSessaoUsuario,
  exigirLogin: exigirLogin,
  exigirAdmin: exigirAdmin
};
