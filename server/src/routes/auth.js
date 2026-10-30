// rotas de login, cadastro de usuário, sessão atual e logout
const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db/conexao')

const router = express.Router()

router.post('/login', function (req, res) {
  const login = (req.body.usuario || '').trim()
  const senha = req.body.senha || ''

  if (login === '' || senha === '') {
    return res.status(400).json({ erro: 'Preencha o usuário e a senha.' })
  }

  const usuarioBanco = db.prepare(
    'SELECT id, nome, login, senha_hash, perfil, ativo FROM usuario WHERE login = ?'
  ).get(login)

  // mesma mensagem pros dois casos pra não entregar se o login existe ou não
  if (!usuarioBanco || usuarioBanco.ativo === 0) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' })
  }

  const senhaBate = bcrypt.compareSync(senha, usuarioBanco.senha_hash)
  if (!senhaBate) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' })
  }

  req.session.usuario = {
    id: usuarioBanco.id,
    nome: usuarioBanco.nome,
    login: usuarioBanco.login,
    perfil: usuarioBanco.perfil
  }

  res.json({ usuario: req.session.usuario })
})

router.post('/cadastro', function (req, res) {
  const nome = (req.body.nome || '').trim()
  const login = (req.body.usuario || '').trim()
  const senha = req.body.senha || ''

  if (nome === '' || login === '' || senha === '') {
    return res.status(400).json({ erro: 'Preencha todos os campos.' })
  }

  if (login.indexOf(' ') !== -1) {
    return res.status(400).json({ erro: 'O nome de usuário não pode ter espaços.' })
  }

  if (senha.length < 4) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 4 caracteres.' })
  }

  const jaExiste = db.prepare('SELECT id FROM usuario WHERE login = ?').get(login)
  if (jaExiste) {
    return res.status(400).json({ erro: 'Esse nome de usuário já está em uso.' })
  }

  const senhaHash = bcrypt.hashSync(senha, 10)

  // quem se cadastra pela tela entra como operador; só o banco tem o admin inicial
  db.prepare(
    'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)'
  ).run(nome, login, senhaHash, 'operador')

  res.status(201).json({ mensagem: 'Conta criada com sucesso!' })
})

router.get('/eu', function (req, res) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Não autenticado.' })
  }
  res.json({ usuario: req.session.usuario })
})

router.post('/sair', function (req, res) {
  req.session.destroy(function () {
    res.json({ ok: true })
  })
})

module.exports = router
