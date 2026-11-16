const crypto = require('crypto');
const bcrypt = require('bcryptjs');
// colunasUsuario garante email, documento e telefone em bancos antigos.
const db = require('../db/colunasUsuario');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const controleAcesso = require('../middlewares/autenticacao');
const validador = require('../regras/validacao');

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
      if (login.length > 254 || senha.length > 72) {
        await bcrypt.compare('invalido', this.hashFicticio);
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
      }

      // Aceita o usuário antigo ou o e-mail do cadastro.
      const usuarioBanco = db
        .prepare(
          'SELECT id, nome, login, senha_hash, perfil, ativo FROM usuario WHERE login = ? OR lower(email) = lower(?)'
        )
        .get(login, login);

      // Mesmo sem usuário cadastrado, executamos bcrypt.compare para não vazar quais logins existem pelo tempo da resposta.
      const hashAlvo = usuarioBanco ? usuarioBanco.senha_hash : this.hashFicticio;
      const senhaBate = await bcrypt.compare(senha, hashAlvo);

      if (!usuarioBanco || usuarioBanco.ativo !== 1 || !senhaBate) {
        return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
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

      const dadosConta = this.lerDadosConta(req.body);
      if (dadosConta.erro) return res.status(400).json({ erro: dadosConta.erro });

      const senha = typeof (req.body && req.body.senha) === 'string' ? req.body.senha : '';
      if (senha === '') return res.status(400).json({ erro: 'Preencha a senha.' });
      const email = validador.lerEmail(req.body && req.body.email);
      if (!email) return res.status(400).json({ erro: 'Informe um e-mail válido.' });

      const conflito = this.conflitoConta(email, dadosConta.documento);
      if (conflito) return res.status(400).json({ erro: conflito });

      const login = this.loginLivre(email);
      const erroSenha = validador.validarSenha(senha, email.split('@')[0]);
      if (erroSenha) return res.status(400).json({ erro: erroSenha });

      const senhaHash = await bcrypt.hash(senha, 10);
      this.inserirUsuario({
        nome: dadosConta.nome,
        login: login,
        senhaHash: senhaHash,
        email: email,
        documento: dadosConta.documento,
        telefone: dadosConta.telefone,
        origem: 'Auto-cadastro com convite'
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

  // Nome, CPF/CNPJ e telefone, comuns ao cadastro por senha e ao cadastro pelo Google.
  // nomeOpcional: no Google o nome pode vir da própria conta.
  lerDadosConta(corpo, nomeOpcional) {
    const nome = validador.lerTexto(corpo && corpo.nome);
    if (nome === '' && !nomeOpcional) return { erro: 'Preencha o nome.' };
    const erroNome = nome ? validador.textoDentroDoLimite(nome, 120, 'O nome') : null;
    if (erroNome) return { erro: erroNome };
    const documento = validador.lerCpfCnpj(corpo && corpo.documento);
    if (!documento) return { erro: 'Informe um CPF ou CNPJ válido.' };
    const telefone = validador.lerTelefone(corpo && corpo.telefone);
    if (!telefone) return { erro: 'Informe um telefone com DDD.' };
    return { nome: nome, documento: documento, telefone: telefone };
  }

  conflitoConta(email, documento) {
    if (email && db.prepare('SELECT 1 FROM usuario WHERE lower(email) = ?').get(email)) {
      return 'Já existe uma conta com esse e-mail.';
    }
    if (documento && db.prepare('SELECT 1 FROM usuario WHERE documento = ?').get(documento)) {
      return 'Já existe uma conta com esse CPF/CNPJ.';
    }
    return null;
  }

  inserirUsuario(dados) {
    const resultado = db
      .prepare(
        'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo, email, documento, telefone) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
      )
      .run(dados.nome, dados.login, dados.senhaHash, 'operador', dados.email, dados.documento, dados.telefone);
    const novoId = Number(resultado.lastInsertRowid);
    auditoria.registrarLog({
      usuarioId: novoId,
      acao: 'criou',
      tabela: 'usuario',
      registroId: novoId,
      resumo: dados.origem + ' de ' + dados.email + ' (operador)',
      // CPF/CNPJ e telefone ficam fora do log de auditoria: o log é lido por todos os admins.
      depois: { id: novoId, nome: dados.nome, login: dados.login, perfil: 'operador', ativo: 1, email: dados.email }
    });
    return { id: novoId, nome: dados.nome, login: dados.login, perfil: 'operador', ativo: 1 };
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
