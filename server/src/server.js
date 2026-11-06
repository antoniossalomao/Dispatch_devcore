// servidor principal do Dispatch: entrega as telas do client e responde a API
const path = require('path')
const express = require('express')
const session = require('express-session')

const rotasAuth = require('./routes/auth')
const rotasResumo = require('./routes/resumo')
const rotasConfiguracoes = require('./routes/configuracoes')
const rotasPessoas = require('./routes/pessoas')
const rotasAlojamentos = require('./routes/alojamentos')
const rotasFrota = require('./routes/frota')
const rotasRelatorios = require('./routes/relatorios')
const rotasAuditoria = require('./routes/auditoria')
const rotasIa = require('./routes/ia')
const rotasNotificacoes = require('./routes/notificacoes')
const notificacoes = require('./regras/notificacoes')

const app = express()
const porta = process.env.PORT || 3001

// libera chamadas vindas do Live Server do VS Code caso alguém abra o html por lá
app.use(function (req, res, next) {
  const origem = req.headers.origin
  if (origem && (origem.indexOf('localhost') !== -1 || origem.indexOf('127.0.0.1') !== -1)) {
    res.setHeader('Access-Control-Allow-Origin', origem)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204)
  }
  next()
})

app.use(express.json())

app.use(session({
  secret: process.env.SESSION_SECRET || 'dispatch-devcore-segredo',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 horas logado
  }
}))

// rotas da API
app.use('/api/auth', rotasAuth)
app.use('/api/resumo', rotasResumo)
app.use('/api/configuracoes', rotasConfiguracoes)
app.use('/api/pessoas', rotasPessoas)
app.use('/api/colaboradores', rotasPessoas)
app.use('/api/alojamentos', rotasAlojamentos)
app.use('/api/frota', rotasFrota)
app.use('/api/relatorios', rotasRelatorios)
app.use('/api/auditoria', rotasAuditoria)
app.use('/api/ia', rotasIa)
app.use('/api/notificacoes', rotasNotificacoes)

// entrega os arquivos html, css e js da pasta client
const pastaClient = path.join(__dirname, '..', '..', 'client')
app.use(express.static(pastaClient))

app.listen(porta, function () {
  console.log('Servidor rodando em http://localhost:' + porta)
  // confere os avisos assim que o server liga
  notificacoes.verificar(rotasConfiguracoes.lerConfig()).catch(function (erro) {
    console.log('Não foi possível verificar os avisos: ' + erro.message)
  })
})
