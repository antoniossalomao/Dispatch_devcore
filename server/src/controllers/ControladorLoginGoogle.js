// Entrar e criar conta com o Google.
// É uma classe filha de ControladorAutenticacao: herda dela o que é igual para senha e Google
// (abrir a sessão, ler e conferir os dados do cadastro, criar o usuário) e só acrescenta o
// caminho de ida e volta até o Google. A conversa com o Google em si fica no serviço LoginGoogle.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/colunasUsuario');
const validador = require('../regras/validacao');
const loginGoogle = require('../services/LoginGoogle');
const ControladorAutenticacao = require('./ControladorAutenticacao');

class ControladorLoginGoogle extends ControladorAutenticacao {
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
    const dadosConta = this.lerDadosConta(req.body, true);
    if (dadosConta.erro) return res.status(400).json({ erro: dadosConta.erro });
    if (this.conflitoConta(null, dadosConta.documento)) {
      return res.status(400).json({ erro: 'Já existe uma conta com esse CPF/CNPJ.' });
    }
    const { url, guardar } = loginGoogle.iniciar(req);
    // O e-mail vem do Google; o resto do formulário espera na sessão até a volta.
    guardar.cadastro = dadosConta;
    req.session.google = guardar;
    req.session.save((erro) => {
      if (erro) return next(erro);
      res.json({ url: url });
    });
  }

  criarUsuarioGoogle(identidade, dadosConta) {
    if (dadosConta.documento && db.prepare('SELECT 1 FROM usuario WHERE documento = ?').get(dadosConta.documento)) {
      return null;
    }
    // Conta criada pelo Google não tem senha conhecida: o hash é de um segredo aleatório descartado.
    // Se a pessoa quiser senha depois, o admin define em Configurações.
    return this.inserirUsuario({
      nome: (dadosConta.nome || identidade.nome || identidade.email.split('@')[0]).slice(0, 120),
      login: this.loginLivre(identidade.email),
      senhaHash: bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10),
      email: identidade.email,
      documento: dadosConta.documento,
      telefone: dadosConta.telefone,
      origem: 'Cadastro com convite pelo Google'
    });
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
        usuarioBanco = this.criarUsuarioGoogle(identidade, guardado.cadastro);
        if (!usuarioBanco) return voltar('documento-em-uso');
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
}

module.exports = ControladorLoginGoogle;
