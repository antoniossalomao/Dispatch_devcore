const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const controleAcesso = require('../middlewares/autenticacao');
const validador = require('../regras/validacao');
const loginGoogle = require('../services/LoginGoogle');

// Cuida de login, logout, verificação de sessão aberta e auto-cadastro por convite.
class ControladorAutenticacao {
  constructor() {
    // Hash fictício usado para manter o mesmo tempo de resposta mesmo quando o login não existe no banco.
    this.hashFicticio = bcrypt.hashSync('dispatch-verificacao-tempo-constante', 10);
  }

  resumirTexto(valor) {
    return crypto.createHash('sha256').update(String(valor)).digest();
  }

  async entrar(req, res, next) {
    try {
      const login = validador.lerTexto(req.body && req.body.usuario);
      const senha = typeof (req.body && req.body.senha) === 'string' ? req.body.senha : '';

      if (login === '' || senha === '') {
        return res.status(400).json({ erro: 'Preencha o usuário e a senha.' });
      }
      if (login.length > 60 || senha.length > 72) {
        await bcrypt.compare('invalido', this.hashFicticio);
        return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
      }

      const usuarioBanco = db
        .prepare('SELECT id, nome, login, senha_hash, perfil, ativo FROM usuario WHERE login = ?')
        .get(login);

      // Mesmo sem usuário cadastrado, executamos bcrypt.compare para não vazar quais logins existem pelo tempo da resposta.
      const hashAlvo = usuarioBanco ? usuarioBanco.senha_hash : this.hashFicticio;
      const senhaBate = await bcrypt.compare(senha, hashAlvo);

      if (!usuarioBanco || usuarioBanco.ativo !== 1 || !senhaBate) {
        return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
      }

      this.abrirSessao(req, usuarioBanco, (erro) => {
        if (erro) return next(erro);
        res.json({ usuario: req.session.usuario });
      });
    } catch (erro) {
      next(erro);
    }
  }

  cadastroStatus(req, res) {
    const codigoEsperado = (process.env.CADASTRO_CODIGO || '').trim();
    res.json({ ativo: Boolean(codigoEsperado) });
  }

  async cadastrar(req, res, next) {
    try {
      const codigoEsperado = (process.env.CADASTRO_CODIGO || '').trim();
      if (!codigoEsperado) {
        return res.status(403).json({
          erro: 'Cadastro público desativado. Solicite seu acesso a um administrador.'
        });
      }

      const codigo = validador.lerTexto(req.body && req.body.codigo);
      // timingSafeEqual compara dois textos de mesmo tamanho em tempo constante, dificultando tentar adivinhar byte a byte.
      if (
        !codigo ||
        !crypto.timingSafeEqual(this.resumirTexto(codigo), this.resumirTexto(codigoEsperado))
      ) {
        return res.status(403).json({ erro: 'Código de convite inválido.' });
      }

      const nome = validador.lerTexto(req.body && req.body.nome);
      const login = validador.lerTexto(req.body && req.body.usuario);
      const senha = typeof (req.body && req.body.senha) === 'string' ? req.body.senha : '';

      if (nome === '' || login === '' || senha === '') {
        return res.status(400).json({ erro: 'Preencha todos os campos.' });
      }

      const erroNome = validador.textoDentroDoLimite(nome, 120, 'O nome');
      if (erroNome) return res.status(400).json({ erro: erroNome });

      const erroLogin = validador.validarLogin(login);
      if (erroLogin) return res.status(400).json({ erro: erroLogin });

      const erroSenha = validador.validarSenha(senha, login);
      if (erroSenha) return res.status(400).json({ erro: erroSenha });

      const jaExiste = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login);
      if (jaExiste) {
        return res.status(400).json({ erro: 'Esse nome de usuário já está em uso.' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);
      const resultado = db
        .prepare(
          'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)'
        )
        .run(nome, login, senhaHash, 'operador');
      const novoId = Number(resultado.lastInsertRowid);

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

      res.status(201).json({ mensagem: 'Conta criada com sucesso!' });
    } catch (erro) {
      next(erro);
    }
  }

  // Abre a sessão do usuário (senha ou Google) com um ID novo, contra fixação de sessão.
  abrirSessao(req, usuarioBanco, aoTerminar) {
    req.session.regenerate((erroRegen) => {
      if (erroRegen) return aoTerminar(erroRegen);
      req.session.usuario = {
        id: usuarioBanco.id,
        nome: usuarioBanco.nome,
        login: usuarioBanco.login,
        perfil: usuarioBanco.perfil
      };
      req.session.save(aoTerminar);
    });
  }

  googleStatus(req, res) {
    res.json({ ativo: loginGoogle.configuracao().ativo });
  }

  googleIniciar(req, res, next) {
    if (!loginGoogle.configuracao().ativo) {
      return res.redirect(302, '/login?google=indisponivel');
    }
    const { url, guardar } = loginGoogle.iniciar(req);
    req.session.google = guardar;
    req.session.save((erro) => {
      if (erro) return next(erro);
      res.redirect(302, url);
    });
  }

  // Cadastro com Google: confere o código de convite ANTES de mandar ao Google e marca a ida como
  // cadastro. O código não vai na URL (ficaria no histórico e nos logs); vai no corpo deste POST.
  googleCadastro(req, res, next) {
    const codigoEsperado = (process.env.CADASTRO_CODIGO || '').trim();
    if (!codigoEsperado) {
      return res.status(403).json({
        erro: 'Cadastro público desativado. Solicite seu acesso a um administrador.'
      });
    }
    if (!loginGoogle.configuracao().ativo) {
      return res.status(503).json({ erro: 'O login com Google não está configurado.' });
    }
    const codigo = validador.lerTexto(req.body && req.body.codigo);
    if (
      !codigo ||
      !crypto.timingSafeEqual(this.resumirTexto(codigo), this.resumirTexto(codigoEsperado))
    ) {
      return res.status(403).json({ erro: 'Código de convite inválido.' });
    }
    const { url, guardar } = loginGoogle.iniciar(req);
    guardar.cadastro = true;
    req.session.google = guardar;
    req.session.save((erro) => {
      if (erro) return next(erro);
      res.json({ url: url });
    });
  }

  // Login a partir do e-mail ("maria.souza@gmail.com" vira "maria.souza", "maria.souza2"...).
  loginLivre(email) {
    const base =
      email
        .split('@')[0]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 36) || 'usuario';
    let candidato = base.length >= 3 ? base : base + 'usr';
    let n = 2;
    while (db.prepare('SELECT 1 FROM usuario WHERE login = ?').get(candidato)) {
      candidato = base + n++;
    }
    return candidato;
  }

  criarUsuarioGoogle(identidade) {
    const nome = (identidade.nome || identidade.email.split('@')[0]).slice(0, 120);
    const login = this.loginLivre(identidade.email);
    // Conta criada pelo Google não tem senha conhecida: o hash é de um segredo aleatório descartado.
    // Se a pessoa quiser senha depois, o admin define em Configurações.
    const hashInutilizavel = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
    const resultado = db
      .prepare(
        'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo, email) VALUES (?, ?, ?, ?, 1, ?)'
      )
      .run(nome, login, hashInutilizavel, 'operador', identidade.email);
    const novoId = Number(resultado.lastInsertRowid);
    auditoria.registrarLog({
      usuarioId: novoId,
      acao: 'criou',
      tabela: 'usuario',
      registroId: novoId,
      resumo: 'Cadastro com convite pelo Google de @' + login + ' (operador)',
      depois: { id: novoId, nome: nome, login: login, perfil: 'operador', ativo: 1, email: identidade.email }
    });
    return { id: novoId, nome: nome, login: login, perfil: 'operador', ativo: 1 };
  }

  async googleRetorno(req, res) {
    const guardado = req.session.google;
    delete req.session.google;
    const voltar = (motivo) => res.redirect(302, '/login?google=' + motivo);

    try {
      if (!loginGoogle.configuracao().ativo) return voltar('indisponivel');
      if (req.query.error) return voltar('cancelado');
      const codigo = typeof req.query.code === 'string' ? req.query.code : '';
      if (!codigo || !loginGoogle.estadoValido(guardado, req.query.state)) return voltar('expirado');

      const identidade = await loginGoogle.confirmarIdentidade(codigo, guardado);
      let usuarioBanco = loginGoogle.buscarUsuarioPorEmail(identidade.email);
      if (!usuarioBanco && guardado.cadastro) {
        // E-mail ligado a um usuário desativado não ganha conta nova: o admin decide.
        const bloqueado = db.prepare('SELECT 1 FROM usuario WHERE lower(email) = ?').get(identidade.email);
        if (bloqueado) return voltar('sem-acesso');
        usuarioBanco = this.criarUsuarioGoogle(identidade);
      }
      if (!usuarioBanco) return voltar('sem-acesso');

      this.abrirSessao(req, usuarioBanco, (erro) => {
        if (erro) return voltar('falhou');
        res.redirect(302, '/resumo');
      });
    } catch (erro) {
      console.error('Login com Google falhou:', erro.message);
      voltar('falhou');
    }
  }

  consultarSessao(req, res) {
    const usuario = controleAcesso.validarSessaoUsuario(req);
    if (!usuario) {
      return res.status(401).json({ erro: 'Não autenticado.' });
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
      res.json({ ok: true });
    });
  }
}

module.exports = ControladorAutenticacao;
