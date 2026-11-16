// Ações de autenticação.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const { validarSessaoUsuario } = require('../middlewares/autenticacao');
const {
  lerTexto,
  validarLogin,
  validarSenha,
  textoDentroDoLimite
} = require('../regras/validacao');

const HASH_FALSO = bcrypt.hashSync('dispatch-verificacao-tempo-constante', 10);

function digestTexto(valor) {
  return crypto.createHash('sha256').update(String(valor)).digest();
}

class ControladorAutenticacao {
  async entrar(req, res, next) {
    try {
      const login = lerTexto(req.body && req.body.usuario);
      const senha = typeof (req.body && req.body.senha) === 'string' ? req.body.senha : '';
      if (login === '' || senha === '') {
        return res.status(400).json({
          erro: 'Preencha o usuário e a senha.'
        });
      }
      if (login.length > 60 || senha.length > 72) {
        await bcrypt.compare('invalido', HASH_FALSO);
        return res.status(401).json({
          erro: 'Usuário ou senha incorretos.'
        });
      }
      const usuarioBanco = db
        .prepare('SELECT id, nome, login, senha_hash, perfil, ativo FROM usuario WHERE login = ?')
        .get(login);
      const hashAlvo = usuarioBanco ? usuarioBanco.senha_hash : HASH_FALSO;
      const senhaBate = await bcrypt.compare(senha, hashAlvo);
      if (!usuarioBanco || usuarioBanco.ativo !== 1 || !senhaBate) {
        return res.status(401).json({
          erro: 'Usuário ou senha incorretos.'
        });
      }
      req.session.regenerate((erroRegen) => {
        if (erroRegen) return next(erroRegen);
        req.session.usuario = {
          id: usuarioBanco.id,
          nome: usuarioBanco.nome,
          login: usuarioBanco.login,
          perfil: usuarioBanco.perfil
        };
        req.session.save((erroSalvar) => {
          if (erroSalvar) return next(erroSalvar);
          res.json({
            usuario: req.session.usuario
          });
        });
      });
    } catch (erro) {
      next(erro);
    }
  }

  cadastroStatus(req, res) {
    const codigoEsperado = (process.env.CADASTRO_CODIGO || '').trim();
    res.json({
      ativo: Boolean(codigoEsperado)
    });
  }

  async cadastrar(req, res, next) {
    try {
      const codigoEsperado = (process.env.CADASTRO_CODIGO || '').trim();
      if (!codigoEsperado) {
        return res.status(403).json({
          erro: 'Cadastro público desativado. Solicite seu acesso a um administrador.'
        });
      }
      const codigo = lerTexto(req.body && req.body.codigo);
      if (!codigo || !crypto.timingSafeEqual(digestTexto(codigo), digestTexto(codigoEsperado))) {
        return res.status(403).json({
          erro: 'Código de convite inválido.'
        });
      }
      const nome = lerTexto(req.body && req.body.nome);
      const login = lerTexto(req.body && req.body.usuario);
      const senha = typeof (req.body && req.body.senha) === 'string' ? req.body.senha : '';
      if (nome === '' || login === '' || senha === '') {
        return res.status(400).json({
          erro: 'Preencha todos os campos.'
        });
      }
      const erroNome = textoDentroDoLimite(nome, 120, 'O nome');
      if (erroNome) {
        return res.status(400).json({ erro: erroNome });
      }
      const erroLogin = validarLogin(login);
      if (erroLogin) {
        return res.status(400).json({ erro: erroLogin });
      }
      const erroSenha = validarSenha(senha, login);
      if (erroSenha) {
        return res.status(400).json({ erro: erroSenha });
      }
      const jaExiste = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login);
      if (jaExiste) {
        return res.status(400).json({
          erro: 'Esse nome de usuário já está em uso.'
        });
      }
      const senhaHash = await bcrypt.hash(senha, 10);
      const r = db
        .prepare(
          'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)'
        )
        .run(nome, login, senhaHash, 'operador');
      const novoId = Number(r.lastInsertRowid);
      auditoria.registrarLog({
        usuarioId: novoId,
        acao: 'criou',
        tabela: 'usuario',
        registroId: novoId,
        resumo: 'Auto-cadastro com convite do usuário @' + login + ' (operador)',
        depois: {
          id: novoId,
          nome: nome,
          login: login,
          perfil: 'operador',
          ativo: 1
        }
      });
      res.status(201).json({
        mensagem: 'Conta criada com sucesso!'
      });
    } catch (erro) {
      next(erro);
    }
  }

  consultarSessao(req, res) {
    const usuario = validarSessaoUsuario(req);
    if (!usuario) {
      return res.status(401).json({
        erro: 'Não autenticado.'
      });
    }
    res.json({
      usuario: usuario,
      nomeEmpresa: configuracao.lerConfig().nomeEmpresa
    });
  }

  sair(req, res) {
    req.session.destroy((erro) => {
      if (erro) {
        return res.status(500).json({ erro: 'Não foi possível encerrar a sessão.' });
      }
      res.clearCookie('dispatch.sid', { path: '/' });
      res.json({
        ok: true
      });
    });
  }
}
module.exports = ControladorAutenticacao;
