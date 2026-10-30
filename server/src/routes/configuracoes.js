// rotas do painel de configurações (acesso exclusivo do perfil admin)
const fs = require('fs')
const path = require('path')
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db/conexao')

const router = express.Router()

const caminhoConfig = path.join(__dirname, '..', '..', 'data', 'config.json')

const configPadrao = {
  nomeEmpresa: 'Construtora Aguapeí',
  diasAvisoVencimento: 30,
  horasAlertaRetorno: 12,
  kmConfirmacaoViagem: 2000,
  diasAlertaPendencia: 7,
  bloquearDocVencido: true,
  validarNr24: true,
  whatsappCriticos: false
}

function lerConfig() {
  if (!fs.existsSync(caminhoConfig)) {
    return Object.assign({}, configPadrao)
  }
  try {
    const texto = fs.readFileSync(caminhoConfig, 'utf-8')
    const salvo = JSON.parse(texto)
    return Object.assign({}, configPadrao, salvo)
  } catch (erro) {
    return Object.assign({}, configPadrao)
  }
}

function salvarConfig(dados) {
  fs.mkdirSync(path.dirname(caminhoConfig), { recursive: true })
  fs.writeFileSync(caminhoConfig, JSON.stringify(dados, null, 2), 'utf-8')
}

// bloqueia quem não está logado ou quem é apenas operador
function exigirAdmin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para acessar.' })
  }
  if (req.session.usuario.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' })
  }
  next()
}

router.use(exigirAdmin)

router.get('/', function (req, res) {
  const usuarios = db.prepare(
    'SELECT id, nome, login, perfil, telefone, ativo FROM usuario ORDER BY id ASC'
  ).all()

  const meuUsuario = db.prepare(
    'SELECT id, nome, login, perfil, telefone FROM usuario WHERE id = ?'
  ).get(req.session.usuario.id)

  res.json({
    parametros: lerConfig(),
    meuUsuario: meuUsuario,
    usuarios: usuarios,
    ambiente: {
      banco: 'SQLite ativo (server/data/dispatch.db)',
      iaConfigurada: Boolean(process.env.GROQ_API_KEY),
      whatsappModo: process.env.WHATSAPP_TOKEN ? 'API oficial ativa' : 'Modo terminal (desenvolvimento)'
    }
  })
})

router.put('/parametros', function (req, res) {
  const b = req.body || {}
  const nomeEmpresa = (b.nomeEmpresa || '').trim()

  const diasAviso = Number(b.diasAvisoVencimento)
  const horasRetorno = Number(b.horasAlertaRetorno)
  const kmConfirmacao = Number(b.kmConfirmacaoViagem)
  const diasPendencia = Number(b.diasAlertaPendencia)

  if (nomeEmpresa === '') {
    return res.status(400).json({ erro: 'Informe o nome da empresa ou operação.' })
  }

  if (!diasAviso || diasAviso < 1 || diasAviso > 180) {
    return res.status(400).json({ erro: 'O prazo de aviso de vencimento deve ficar entre 1 e 180 dias.' })
  }

  if (!horasRetorno || horasRetorno < 1 || horasRetorno > 168) {
    return res.status(400).json({ erro: 'O tempo de alerta de retorno deve ficar entre 1 e 168 horas.' })
  }

  if (!kmConfirmacao || kmConfirmacao < 50) {
    return res.status(400).json({ erro: 'O limite de km para confirmação deve ser de pelo menos 50 km.' })
  }

  if (!diasPendencia || diasPendencia < 1 || diasPendencia > 90) {
    return res.status(400).json({ erro: 'O prazo de alerta de pendências deve ficar entre 1 e 90 dias.' })
  }

  const novo = {
    nomeEmpresa: nomeEmpresa,
    diasAvisoVencimento: diasAviso,
    horasAlertaRetorno: horasRetorno,
    kmConfirmacaoViagem: kmConfirmacao,
    diasAlertaPendencia: diasPendencia,
    bloquearDocVencido: Boolean(b.bloquearDocVencido),
    validarNr24: Boolean(b.validarNr24),
    whatsappCriticos: Boolean(b.whatsappCriticos)
  }

  salvarConfig(novo)
  res.json({ mensagem: 'Parâmetros salvos com sucesso.', parametros: novo })
})

router.put('/minha-conta', function (req, res) {
  const nome = (req.body.nome || '').trim()
  const telefone = (req.body.telefone || '').trim()

  if (nome === '') {
    return res.status(400).json({ erro: 'O nome não pode ficar vazio.' })
  }

  db.prepare('UPDATE usuario SET nome = ?, telefone = ? WHERE id = ?').run(
    nome,
    telefone === '' ? null : telefone,
    req.session.usuario.id
  )

  req.session.usuario.nome = nome

  res.json({
    mensagem: 'Dados da conta atualizados.',
    usuario: req.session.usuario
  })
})

router.put('/minha-senha', function (req, res) {
  const senhaAtual = req.body.senhaAtual || ''
  const novaSenha = req.body.novaSenha || ''

  if (senhaAtual === '' || novaSenha === '') {
    return res.status(400).json({ erro: 'Preencha a senha atual e a nova senha.' })
  }

  if (novaSenha.length < 4) {
    return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 4 caracteres.' })
  }

  const atual = db.prepare('SELECT senha_hash FROM usuario WHERE id = ?').get(req.session.usuario.id)
  if (!atual || !bcrypt.compareSync(senhaAtual, atual.senha_hash)) {
    return res.status(400).json({ erro: 'A senha atual está incorreta.' })
  }

  const novoHash = bcrypt.hashSync(novaSenha, 10)
  db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(novoHash, req.session.usuario.id)

  res.json({ mensagem: 'Senha alterada com sucesso.' })
})

router.post('/usuarios', function (req, res) {
  const nome = (req.body.nome || '').trim()
  const login = (req.body.login || '').trim()
  const senha = req.body.senha || ''
  const perfil = req.body.perfil === 'admin' ? 'admin' : 'operador'
  const telefone = (req.body.telefone || '').trim()

  if (nome === '' || login === '' || senha === '') {
    return res.status(400).json({ erro: 'Preencha nome, login e senha inicial.' })
  }

  if (login.indexOf(' ') !== -1) {
    return res.status(400).json({ erro: 'O login não pode conter espaços.' })
  }

  if (senha.length < 4) {
    return res.status(400).json({ erro: 'A senha inicial precisa ter pelo menos 4 caracteres.' })
  }

  const repetido = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login)
  if (repetido) {
    return res.status(400).json({ erro: 'Já existe um usuário com esse login.' })
  }

  const hash = bcrypt.hashSync(senha, 10)
  db.prepare(
    'INSERT INTO usuario (nome, login, senha_hash, perfil, telefone, ativo) VALUES (?, ?, ?, ?, ?, 1)'
  ).run(nome, login, hash, perfil, telefone === '' ? null : telefone)

  res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' })
})

router.put('/usuarios/:id/perfil', function (req, res) {
  const idAlvo = Number(req.params.id)
  const novoPerfil = req.body.perfil

  if (novoPerfil !== 'admin' && novoPerfil !== 'operador') {
    return res.status(400).json({ erro: 'Perfil inválido.' })
  }

  if (idAlvo === req.session.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode remover seu próprio perfil de administrador.' })
  }

  db.prepare('UPDATE usuario SET perfil = ? WHERE id = ?').run(novoPerfil, idAlvo)
  res.json({ mensagem: 'Perfil atualizado.' })
})

router.put('/usuarios/:id/ativo', function (req, res) {
  const idAlvo = Number(req.params.id)
  const novoAtivo = req.body.ativo ? 1 : 0

  if (idAlvo === req.session.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode desativar a própria conta em uso.' })
  }

  db.prepare('UPDATE usuario SET ativo = ? WHERE id = ?').run(novoAtivo, idAlvo)
  res.json({ mensagem: novoAtivo === 1 ? 'Usuário reativado.' : 'Usuário desativado.' })
})

router.put('/usuarios/:id/senha', function (req, res) {
  const idAlvo = Number(req.params.id)
  const novaSenha = req.body.novaSenha || ''

  if (novaSenha.length < 4) {
    return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 4 caracteres.' })
  }

  const hash = bcrypt.hashSync(novaSenha, 10)
  db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(hash, idAlvo)
  res.json({ mensagem: 'Senha redefinida com sucesso.' })
})

router.lerConfig = lerConfig

module.exports = router
