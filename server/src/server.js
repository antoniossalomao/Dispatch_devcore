// servidor principal do Dispatch: entrega as telas do client e responde a API
const path = require('path');
const express = require('express');
const session = require('express-session');
const rotasAuth = require('./routes/auth');
const rotasResumo = require('./routes/resumo');
const rotasConfiguracoes = require('./routes/configuracoes');
const rotasPessoas = require('./routes/pessoas');
const rotasAlojamentos = require('./routes/alojamentos');
const rotasFrota = require('./routes/frota');
const rotasRelatorios = require('./routes/relatorios');
const rotasAuditoria = require('./routes/auditoria');
const rotasIa = require('./routes/ia');
const rotasNotificacoes = require('./routes/notificacoes');
const configuracao = require('./services/Configuracao');
const notificacoes = require('./services/Notificacoes');
class Servidor {
  constructor() {
    this.app = express();
    this.porta = process.env.PORT || 3001;
    // libera chamadas vindas do Live Server do VS Code caso alguém abra o html por lá
    this.app.use((req, res, next) => {
      const origem = req.headers.origin;
      if (origem && (origem.indexOf('localhost') !== -1 || origem.indexOf('127.0.0.1') !== -1)) {
        res.setHeader('Access-Control-Allow-Origin', origem);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
    this.app.use(express.json());
    this.app.use(
      session({
        secret: process.env.SESSION_SECRET || 'dispatch-devcore-segredo',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          maxAge: 1000 * 60 * 60 * 8 // 8 horas logado
        }
      })
    );

    // rotas da API
    this.app.use('/api/auth', rotasAuth);
    this.app.use('/api/resumo', rotasResumo);
    this.app.use('/api/configuracoes', rotasConfiguracoes);
    this.app.use('/api/pessoas', rotasPessoas);
    this.app.use('/api/colaboradores', rotasPessoas);
    this.app.use('/api/alojamentos', rotasAlojamentos);
    this.app.use('/api/frota', rotasFrota);
    this.app.use('/api/relatorios', rotasRelatorios);
    this.app.use('/api/auditoria', rotasAuditoria);
    this.app.use('/api/ia', rotasIa);
    this.app.use('/api/notificacoes', rotasNotificacoes);

    // entrega os arquivos html, css e js da pasta client
    this.pastaClient = path.join(__dirname, '..', '..', 'client');
    this.app.use(express.static(this.pastaClient));
  }

  iniciar() {
    return this.app.listen(this.porta, () => {
      console.log('Servidor rodando em http://localhost:' + this.porta);
      // confere os avisos assim que o server liga
      notificacoes.verificar(configuracao.lerConfig()).catch((erro) => {
        console.log('Não foi possível verificar os avisos: ' + erro.message);
      });
    });
  }
}
module.exports = Servidor;
if (require.main === module) new Servidor().iniciar();
