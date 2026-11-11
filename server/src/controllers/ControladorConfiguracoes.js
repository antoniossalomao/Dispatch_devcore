const configuracao = require('../services/Configuracao');
// Ações de configuracoes.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db/conexao');
const auditoria = require('../services/Auditoria');
const telegram = require('../services/Telegram');
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
      arquivo: 'server/data/dispatch.db',
      tamanhoKb: tamanhoKb,
      totalTabelas: totalTabelas,
      contagens: contagens,
      integridade: auditoria.verificarIntegridadeLog(),
      ultimosLogs: ultimosLogs
    };
  }

  exigirAdmin(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        erro: 'Faça login para acessar.'
      });
    }
    if (req.session.usuario.perfil !== 'admin') {
      return res.status(403).json({
        erro: 'Acesso restrito a administradores.'
      });
    }
    next();
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
    const nomeEmpresa = (b.nomeEmpresa || '').trim();
    const cidadeBase = (b.cidadeBase || '').trim();
    const documentoEmpresa = (b.documentoEmpresa || '').trim();
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
    if (!diasAviso || diasAviso < 1 || diasAviso > 180) {
      return res.status(400).json({
        erro: 'A antecedência de vencimento deve ficar entre 1 e 180 dias.'
      });
    }
    if (!horasRetorno || horasRetorno < 1 || horasRetorno > 168) {
      return res.status(400).json({
        erro: 'O limite de retorno do veículo deve ficar entre 1 e 168 horas.'
      });
    }
    if (!kmConfirmacao || kmConfirmacao < 50) {
      return res.status(400).json({
        erro: 'O limite de km para confirmação deve ser de pelo menos 50 km.'
      });
    }
    if (!diasPendencia || diasPendencia < 1 || diasPendencia > 90) {
      return res.status(400).json({
        erro: 'O prazo de pendências deve ficar entre 1 e 90 dias.'
      });
    }
    if (!maxLeitos || maxLeitos < 1 || maxLeitos > 20) {
      return res.status(400).json({
        erro: 'O limite de leitos por quarto deve ficar entre 1 e 20.'
      });
    }
    if (!areaCama || areaCama < 1 || !areaBeliche || areaBeliche < 1) {
      return res.status(400).json({
        erro: 'Informe metragens válidas para cama e beliche.'
      });
    }
    if (!lotacaoPct || lotacaoPct < 50 || lotacaoPct > 100) {
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

  baixarBackup(req, res) {
    if (!fs.existsSync(this.caminhoBanco)) {
      return res.status(404).json({
        erro: 'Arquivo do banco não encontrado.'
      });
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const conteudo = fs.readFileSync(this.caminhoBanco);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="dispatch-backup-' + hoje + '.db"');
    res.send(conteudo);
  }

  atualizarConta(req, res) {
    const nome = (req.body.nome || '').trim();
    const telegram_chat_id = (req.body.telegram_chat_id || '').trim();
    if (nome === '') {
      return res.status(400).json({
        erro: 'O nome não pode ficar vazio.'
      });
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

  atualizarSenha(req, res) {
    const senhaAtual = req.body.senhaAtual || '';
    const novaSenha = req.body.novaSenha || '';
    if (senhaAtual === '' || novaSenha === '') {
      return res.status(400).json({
        erro: 'Preencha a senha atual e a nova senha.'
      });
    }
    if (novaSenha.length < 4) {
      return res.status(400).json({
        erro: 'A nova senha precisa ter pelo menos 4 caracteres.'
      });
    }
    const atual = db
      .prepare('SELECT senha_hash FROM usuario WHERE id = ?')
      .get(req.session.usuario.id);
    if (!atual || !bcrypt.compareSync(senhaAtual, atual.senha_hash)) {
      return res.status(400).json({
        erro: 'A senha atual está incorreta.'
      });
    }
    const novoHash = bcrypt.hashSync(novaSenha, 10);
    db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(
      novoHash,
      req.session.usuario.id
    );
    auditoria.registrarLog({
      usuarioId: req.session.usuario.id,
      acao: 'alterou',
      tabela: 'usuario',
      registroId: req.session.usuario.id,
      resumo: 'Alterou a própria senha (@' + req.session.usuario.login + ')'
    });
    res.json({
      mensagem: 'Senha alterada com sucesso.'
    });
  }

  cadastrarUsuario(req, res) {
    const nome = (req.body.nome || '').trim();
    const login = (req.body.login || '').trim();
    const senha = req.body.senha || '';
    const perfil = req.body.perfil === 'admin' ? 'admin' : 'operador';
    const telegram_chat_id = (req.body.telegram_chat_id || '').trim();
    if (nome === '' || login === '' || senha === '') {
      return res.status(400).json({
        erro: 'Preencha nome, login e senha inicial.'
      });
    }
    if (login.indexOf(' ') !== -1) {
      return res.status(400).json({
        erro: 'O login não pode conter espaços.'
      });
    }
    if (senha.length < 4) {
      return res.status(400).json({
        erro: 'A senha inicial precisa ter pelo menos 4 caracteres.'
      });
    }
    const repetido = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login);
    if (repetido) {
      return res.status(400).json({
        erro: 'Já existe um usuário com esse login.'
      });
    }
    const hash = bcrypt.hashSync(senha, 10);
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
      mensagem: 'Usuário @' + login + ' criado com sucesso.'
    });
  }

  alterarPerfil(req, res) {
    const idAlvo = Number(req.params.id);
    const novoPerfil = req.body.perfil;
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
    const idAlvo = Number(req.params.id);
    const novoAtivo = req.body.ativo ? 1 : 0;
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

  redefinirSenha(req, res) {
    const idAlvo = Number(req.params.id);
    const novaSenha = req.body.novaSenha || '';
    if (novaSenha.length < 4) {
      return res.status(400).json({
        erro: 'A nova senha precisa ter pelo menos 4 caracteres.'
      });
    }
    const alvo = db.prepare('SELECT id, login FROM usuario WHERE id = ?').get(idAlvo);
    if (!alvo) {
      return res.status(404).json({
        erro: 'Usuário não encontrado.'
      });
    }
    const hash = bcrypt.hashSync(novaSenha, 10);
    db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(hash, idAlvo);
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
  }
}
module.exports = ControladorConfiguracoes;
