// Ações de configurações.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const configuracao = require('../services/Configuracao');
const sessionStore = require('../services/SessionStore');
const telegram = require('../services/Telegram');
const {
  lerIdPositivo,
  validarLogin,
  validarSenha,
  validarTelegramChatId,
  textoDentroDoLimite
} = require('../regras/validacao');

class ControladorConfiguracoes {
  constructor() {
    this.caminhoBanco =
      process.env.DB_CAMINHO || path.join(__dirname, '..', '..', 'data', 'dispatch.db');
  }

  montarDadosBanco() {
    let tamanhoKb = 0;
    if (fs.existsSync(this.caminhoBanco)) {
      const stat = fs.statSync(this.caminhoBanco);
      tamanhoKb = Math.round((stat.size / 1024) * 10) / 10;
    }
    const totalTabelas = db
      .prepare(
        "SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .get().total;
    const contagens = {
      usuarios: db.prepare('SELECT COUNT(*) AS t FROM usuario').get().t,
      colaboradores: db.prepare('SELECT COUNT(*) AS t FROM pessoa').get().t,
      alojamentos: db.prepare('SELECT COUNT(*) AS t FROM alojamento').get().t,
      veiculos: db.prepare('SELECT COUNT(*) AS t FROM veiculo').get().t,
      logs: db.prepare('SELECT COUNT(*) AS t FROM log_auditoria').get().t
    };
    const ultimosLogs = db
      .prepare(
        'SELECT l.id, l.quando, l.acao, l.tabela, l.resumo, u.login AS autor ' +
          'FROM log_auditoria l ' +
          'JOIN usuario u ON u.id = l.usuario_id ' +
          'ORDER BY l.id DESC LIMIT 6'
      )
      .all();
    return {
      arquivo: path.basename(this.caminhoBanco),
      tamanhoKb: tamanhoKb,
      totalTabelas: totalTabelas,
      contagens: contagens,
      integridade: auditoria.verificarIntegridadeLog(),
      ultimosLogs: ultimosLogs
    };
  }

  consultar(req, res) {
    const usuarios = db
      .prepare(
        'SELECT id, nome, login, perfil, telegram_chat_id, ativo FROM usuario ORDER BY ativo DESC, id ASC'
      )
      .all();
    const meuUsuario = db
      .prepare('SELECT id, nome, login, perfil, telegram_chat_id FROM usuario WHERE id = ?')
      .get(req.session.usuario.id);
    res.json({
      parametros: configuracao.lerConfig(),
      meuUsuario: meuUsuario,
      usuarios: usuarios,
      banco: this.montarDadosBanco(),
      ambiente: {
        iaConfigurada: Boolean(process.env.GROQ_API_KEY),
        telegramAtivo: telegram.configurado(),
        telegramModo: telegram.configurado() ? 'Bot conectado' : 'Simulação no terminal'
      }
    });
  }

  salvarParametros(req, res) {
    const b = req.body || {};
    const antes = configuracao.lerConfig();
    const nomeEmpresa = String(b.nomeEmpresa || '').trim();
    const cidadeBase = String(b.cidadeBase || '').trim();
    const documentoEmpresa = String(b.documentoEmpresa || '').trim();
    const diasAviso = Number(b.diasAvisoVencimento);
    const horasRetorno = Number(b.horasAlertaRetorno);
    const kmConfirmacao = Number(b.kmConfirmacaoViagem);
    const diasPendencia = Number(b.diasAlertaPendencia);
    const maxLeitos = Number(b.maxLeitosQuarto);
    const areaCama = Number(b.areaMinimaCama);
    const areaBeliche = Number(b.areaMinimaBeliche);
    const lotacaoPct = Number(b.lotacaoAlertaPct);
    if (nomeEmpresa === '') {
      return res.status(400).json({
        erro: 'Informe o nome da empresa ou operação.'
      });
    }
    const erroTexto =
      textoDentroDoLimite(nomeEmpresa, 120, 'O nome da empresa') ||
      textoDentroDoLimite(cidadeBase, 100, 'A base operacional') ||
      textoDentroDoLimite(documentoEmpresa, 40, 'O CNPJ / identificador');
    if (erroTexto) {
      return res.status(400).json({ erro: erroTexto });
    }
    if (!Number.isFinite(diasAviso) || diasAviso < 1 || diasAviso > 180) {
      return res.status(400).json({
        erro: 'A antecedência de vencimento deve ficar entre 1 e 180 dias.'
      });
    }
    if (!Number.isFinite(horasRetorno) || horasRetorno < 1 || horasRetorno > 168) {
      return res.status(400).json({
        erro: 'O limite de retorno do veículo deve ficar entre 1 e 168 horas.'
      });
    }
    if (!Number.isFinite(kmConfirmacao) || kmConfirmacao < 50 || kmConfirmacao > 100000) {
      return res.status(400).json({
        erro: 'O limite de km para confirmação deve ficar entre 50 e 100.000 km.'
      });
    }
    if (!Number.isFinite(diasPendencia) || diasPendencia < 1 || diasPendencia > 90) {
      return res.status(400).json({
        erro: 'O prazo de pendências deve ficar entre 1 e 90 dias.'
      });
    }
    if (!Number.isFinite(maxLeitos) || maxLeitos < 1 || maxLeitos > 20) {
      return res.status(400).json({
        erro: 'O limite de leitos por quarto deve ficar entre 1 e 20.'
      });
    }
    if (
      !Number.isFinite(areaCama) ||
      areaCama < 1 ||
      areaCama > 1000 ||
      !Number.isFinite(areaBeliche) ||
      areaBeliche < 1 ||
      areaBeliche > 1000
    ) {
      return res.status(400).json({
        erro: 'Informe metragens válidas para cama e beliche.'
      });
    }
    if (!Number.isFinite(lotacaoPct) || lotacaoPct < 50 || lotacaoPct > 100) {
      return res.status(400).json({
        erro: 'O percentual de alerta de lotação deve ficar entre 50% e 100%.'
      });
    }
    const novo = {
      nomeEmpresa: nomeEmpresa,
      cidadeBase: cidadeBase,
      documentoEmpresa: documentoEmpresa,
      diasAvisoVencimento: diasAviso,
      horasAlertaRetorno: horasRetorno,
      kmConfirmacaoViagem: kmConfirmacao,
      diasAlertaPendencia: diasPendencia,
      maxLeitosQuarto: maxLeitos,
      areaMinimaCama: areaCama,
      areaMinimaBeliche: areaBeliche,
      lotacaoAlertaPct: lotacaoPct,
      bloquearDocVencido: Boolean(b.bloquearDocVencido),
      avisarSeguroVencido: Boolean(b.avisarSeguroVencido),
      validarNr24: Boolean(b.validarNr24),
      telegramCriticos: Boolean(b.telegramCriticos)
    };
    configuracao.salvarConfig(novo);
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'configuracoes',
      registroId: 1,
      resumo: 'Atualizou parâmetros operacionais do sistema',
      antes: antes,
      depois: novo
    });
    res.json({
      mensagem: 'Configurações salvas.',
      parametros: novo
    });
  }

  restaurarPadrao(req, res) {
    const antes = configuracao.lerConfig();
    const padrao = Object.assign({}, configuracao.configPadrao);
    configuracao.salvarConfig(padrao);
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'configuracoes',
      registroId: 1,
      resumo: 'Restaurou parâmetros operacionais para o padrão',
      antes: antes,
      depois: padrao
    });
    res.json({
      mensagem: 'Valores padrão restaurados.',
      parametros: padrao
    });
  }

  async testarAlerta(req, res) {
    const cfg = configuracao.lerConfig();
    const admin = db
      .prepare('SELECT nome, telegram_chat_id FROM usuario WHERE id = ?')
      .get(req.session.usuario.id);
    const previa =
      '[DISPATCH · ' +
      cfg.nomeEmpresa +
      '] Alerta de teste: ' +
      'Veículo Saveiro MNO-7890 registrou diferença de +38 km sem saída vinculada. ' +
      'Destinatário: ' +
      admin.nome;
    const r = await telegram.enviar(previa, admin.telegram_chat_id);
    res.json({
      mensagem: r.enviado
        ? 'Mensagem enviada pelo Telegram!'
        : 'Disparo simulado! A mensagem foi registrada no terminal do servidor' +
          (r.motivo ? ' (' + r.motivo + ')' : '') +
          '.',
      previa: previa
    });
  }

  verificarLog(req, res) {
    res.json({
      integridade: auditoria.verificarIntegridadeLog(),
      banco: this.montarDadosBanco()
    });
  }

  baixarBackup(req, res, next) {
    if (!fs.existsSync(this.caminhoBanco)) {
      return res.status(404).json({
        erro: 'Arquivo do banco não encontrado.'
      });
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const caminhoTemp = path.join(
      os.tmpdir(),
      'dispatch-backup-' + crypto.randomUUID() + '.db'
    );
    try {
      auditoria.registrarLog({
        usuarioId: req.session.usuario.id,
        acao: 'criou',
        tabela: 'backup',
        registroId: 1,
        resumo: 'Gerou cópia de segurança do banco (.db)'
      });
      db.exec("VACUUM INTO '" + caminhoTemp.replace(/'/g, "''") + "'");
      const bancoTemp = new DatabaseSync(caminhoTemp);
      try {
        bancoTemp.exec('DELETE FROM sessao');
      } finally {
        bancoTemp.close();
      }
      const conteudo = fs.readFileSync(caminhoTemp);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="dispatch-backup-' + hoje + '.db"'
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(conteudo);
    } catch (erro) {
      next(erro);
    } finally {
      [caminhoTemp, caminhoTemp + '-wal', caminhoTemp + '-shm'].forEach((arq) => {
        if (fs.existsSync(arq)) {
          try {
            fs.unlinkSync(arq);
          } catch (_) {}
        }
      });
    }
  }

  atualizarConta(req, res) {
    const nome = String((req.body && req.body.nome) || '').trim();
    const telegram_chat_id = String((req.body && req.body.telegram_chat_id) || '').trim();
    if (nome === '') {
      return res.status(400).json({
        erro: 'O nome não pode ficar vazio.'
      });
    }
    const erroNome = textoDentroDoLimite(nome, 120, 'O nome');
    if (erroNome) {
      return res.status(400).json({ erro: erroNome });
    }
    const erroTel = validarTelegramChatId(telegram_chat_id);
    if (erroTel) {
      return res.status(400).json({ erro: erroTel });
    }
    const antes = db
      .prepare('SELECT id, nome, telegram_chat_id FROM usuario WHERE id = ?')
      .get(req.session.usuario.id);
    const telFinal = telegram_chat_id === '' ? null : telegram_chat_id;
    db.prepare('UPDATE usuario SET nome = ?, telegram_chat_id = ? WHERE id = ?').run(
      nome,
      telFinal,
      req.session.usuario.id
    );
    req.session.usuario.nome = nome;
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'usuario',
      registroId: req.session.usuario.id,
      resumo: 'Atualizou dados da própria conta (@' + req.session.usuario.login + ')',
      antes: antes,
      depois: {
        id: req.session.usuario.id,
        nome: nome,
        telegram_chat_id: telFinal
      }
    });
    res.json({
      mensagem: 'Dados da conta atualizados.',
      usuario: req.session.usuario
    });
  }

  async atualizarSenha(req, res, next) {
    try {
      const senhaAtual = typeof (req.body && req.body.senhaAtual) === 'string' ? req.body.senhaAtual : '';
      const novaSenha = typeof (req.body && req.body.novaSenha) === 'string' ? req.body.novaSenha : '';
      if (senhaAtual === '' || novaSenha === '') {
        return res.status(400).json({
          erro: 'Preencha a senha atual e a nova senha.'
        });
      }
      const erroSenha = validarSenha(novaSenha, req.session.usuario.login);
      if (erroSenha) {
        return res.status(400).json({ erro: erroSenha });
      }
      const atual = db
        .prepare('SELECT senha_hash FROM usuario WHERE id = ?')
        .get(req.session.usuario.id);
      if (
        !atual ||
        senhaAtual.length > 72 ||
        !(await bcrypt.compare(senhaAtual, atual.senha_hash))
      ) {
        return res.status(400).json({
          erro: 'A senha atual está incorreta.'
        });
      }
      const novoHash = await bcrypt.hash(novaSenha, 10);
      db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(
        novoHash,
        req.session.usuario.id
      );
      sessionStore.revogarPorUsuario(req.session.usuario.id, req.sessionID);
      auditoria.registrarLog({
        usuarioId: req.session.usuario.id,
        acao: 'alterou',
        tabela: 'usuario',
        registroId: req.session.usuario.id,
        resumo: 'Alterou a própria senha (@' + req.session.usuario.login + ')'
      });
      const usuarioAtualizado = Object.assign({}, req.session.usuario);
      req.session.regenerate((erroRegen) => {
        if (erroRegen) return next(erroRegen);
        req.session.usuario = usuarioAtualizado;
        req.session.save((erroSalvar) => {
          if (erroSalvar) return next(erroSalvar);
          res.json({
            mensagem: 'Senha alterada com sucesso.'
          });
        });
      });
    } catch (erro) {
      next(erro);
    }
  }

  async cadastrarUsuario(req, res, next) {
    try {
      const nome = String((req.body && req.body.nome) || '').trim();
      const login = String((req.body && req.body.login) || '').trim();
      const senha = (req.body && req.body.senha) || '';
      const perfil = req.body && req.body.perfil === 'admin' ? 'admin' : 'operador';
      const telegram_chat_id = String((req.body && req.body.telegram_chat_id) || '').trim();
      if (nome === '' || login === '' || senha === '') {
        return res.status(400).json({
          erro: 'Preencha nome, login e senha inicial.'
        });
      }
      const erroCampo =
        textoDentroDoLimite(nome, 120, 'O nome') ||
        validarLogin(login) ||
        validarSenha(senha, login) ||
        validarTelegramChatId(telegram_chat_id);
      if (erroCampo) {
        return res.status(400).json({ erro: erroCampo });
      }
      const repetido = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login);
      if (repetido) {
        return res.status(400).json({
          erro: 'Já existe um usuário com esse login.'
        });
      }
      const hash = await bcrypt.hash(senha, 10);
      const telFinal = telegram_chat_id === '' ? null : telegram_chat_id;
      const resultado = db
        .prepare(
          'INSERT INTO usuario (nome, login, senha_hash, perfil, telegram_chat_id, ativo) VALUES (?, ?, ?, ?, ?, 1)'
        )
        .run(nome, login, hash, perfil, telFinal);
      const novoId = Number(resultado.lastInsertRowid);
      auditoria.registrarLog({
        usuarioId: req.session.usuario.id,
        acao: 'criou',
        tabela: 'usuario',
        registroId: novoId,
        resumo: 'Cadastrou o usuário @' + login + ' (' + perfil + ')',
        depois: {
          id: novoId,
          nome: nome,
          login: login,
          perfil: perfil,
          telegram_chat_id: telFinal,
          ativo: 1
        }
      });
      res.status(201).json({
        mensagem: 'Usuário @' + login + ' criado com sucesso.',
        id: novoId
      });
    } catch (erro) {
      next(erro);
    }
  }

  alterarPerfil(req, res) {
    const idAlvo = lerIdPositivo(req.params.id);
    if (!idAlvo) {
      return res.status(400).json({ erro: 'ID de usuário inválido.' });
    }
    const novoPerfil = req.body && req.body.perfil;
    if (novoPerfil !== 'admin' && novoPerfil !== 'operador') {
      return res.status(400).json({
        erro: 'Perfil inválido.'
      });
    }
    if (idAlvo === req.session.usuario.id) {
      return res.status(400).json({
        erro: 'Você não pode remover seu próprio perfil de administrador.'
      });
    }
    const antes = db.prepare('SELECT id, login, perfil FROM usuario WHERE id = ?').get(idAlvo);
    if (!antes) {
      return res.status(404).json({
        erro: 'Usuário não encontrado.'
      });
    }
    db.prepare('UPDATE usuario SET perfil = ? WHERE id = ?').run(novoPerfil, idAlvo);
    sessionStore.revogarPorUsuario(idAlvo);
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'usuario',
      registroId: idAlvo,
      resumo: 'Alterou perfil de @' + antes.login + ' para ' + novoPerfil,
      antes: {
        perfil: antes.perfil
      },
      depois: {
        perfil: novoPerfil
      }
    });
    res.json({
      mensagem: 'Perfil de @' + antes.login + ' atualizado.'
    });
  }

  alterarStatus(req, res) {
    const idAlvo = lerIdPositivo(req.params.id);
    if (!idAlvo) {
      return res.status(400).json({ erro: 'ID de usuário inválido.' });
    }
    const novoAtivo = req.body && req.body.ativo ? 1 : 0;
    if (idAlvo === req.session.usuario.id) {
      return res.status(400).json({
        erro: 'Você não pode desativar a própria conta em uso.'
      });
    }
    const antes = db.prepare('SELECT id, login, ativo FROM usuario WHERE id = ?').get(idAlvo);
    if (!antes) {
      return res.status(404).json({
        erro: 'Usuário não encontrado.'
      });
    }
    db.prepare('UPDATE usuario SET ativo = ? WHERE id = ?').run(novoAtivo, idAlvo);
    if (novoAtivo === 0) {
      sessionStore.revogarPorUsuario(idAlvo);
    }
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: novoAtivo === 0 ? 'arquivou' : 'alterou',
      tabela: 'usuario',
      registroId: idAlvo,
      resumo: (novoAtivo === 1 ? 'Reativou' : 'Desativou') + ' o acesso de @' + antes.login,
      antes: {
        ativo: antes.ativo
      },
      depois: {
        ativo: novoAtivo
      }
    });
    res.json({
      mensagem: novoAtivo === 1 ? 'Acesso reativado.' : 'Acesso desativado.'
    });
  }

  async redefinirSenha(req, res, next) {
    try {
      const idAlvo = lerIdPositivo(req.params.id);
      if (!idAlvo) {
        return res.status(400).json({ erro: 'ID de usuário inválido.' });
      }
      const alvo = db.prepare('SELECT id, login FROM usuario WHERE id = ?').get(idAlvo);
      if (!alvo) {
        return res.status(404).json({
          erro: 'Usuário não encontrado.'
        });
      }
      const novaSenha = (req.body && req.body.novaSenha) || '';
      const erroSenha = validarSenha(novaSenha, alvo.login);
      if (erroSenha) {
        return res.status(400).json({ erro: erroSenha });
      }
      const hash = await bcrypt.hash(novaSenha, 10);
      db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(hash, idAlvo);
      sessionStore.revogarPorUsuario(idAlvo);
      auditoria.registrarLog({
        usuarioId: req.session.usuario.id,
        acao: 'alterou',
        tabela: 'usuario',
        registroId: idAlvo,
        resumo: 'Redefiniu a senha de @' + alvo.login
      });
      res.json({
        mensagem: 'Senha de @' + alvo.login + ' redefinida.'
      });
    } catch (erro) {
      next(erro);
    }
  }
}
module.exports = ControladorConfiguracoes;
