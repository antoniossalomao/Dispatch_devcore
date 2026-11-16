// servidor principal do Dispatch: entrega as telas do client e responde a API
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
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
const sessionStore = require('./services/SessionStore');

const ORIGENS_DEV_PERMITIDAS = new Set([
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://[::1]:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://[::1]:5501'
]);

const METODOS_MUTACAO = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function extrairOrigemUrl(valor) {
  try {
    const u = new URL(String(valor));
    return u.origin && u.origin !== 'null' ? u.origin : null;
  } catch (_) {
    return null;
  }
}

function resolverSegredoSessao() {
  const configurado = (process.env.SESSION_SECRET || '').trim();
  if (configurado && configurado !== 'dispatch-devcore-segredo') {
    return configurado;
  }
  console.warn(
    '[SEGURANÇA] SESSION_SECRET ausente ou padrão. Usando chave temporária aleatória (sessões serão encerradas ao reiniciar).'
  );
  return crypto.randomBytes(48).toString('hex');
}

function criarHandlerLimite(mensagem) {
  return (req, res) => {
    res.status(429).json({ erro: mensagem });
  };
}

class Servidor {
  constructor() {
    this.app = express();
    this.porta = process.env.PORT || 3001;
    this.isProd =
      process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);

    this.app.disable('x-powered-by');
    this.app.set('trust proxy', 1);

    const connectSrc = this.isProd
      ? ["'self'"]
      : [
          "'self'",
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:5500',
          'http://127.0.0.1:5500',
          'http://localhost:5501',
          'http://127.0.0.1:5501'
        ];

    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: connectSrc,
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: this.isProd ? [] : null
          }
        },
        frameguard: { action: 'deny' },
        hsts: this.isProd ? undefined : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
      })
    );

    // Libera CORS apenas para as portas locais do Live Server fora de produção.
    this.app.use((req, res, next) => {
      const origem = req.headers.origin;
      if (origem) {
        res.vary('Origin');
        if (!this.isProd && ORIGENS_DEV_PERMITIDAS.has(origem)) {
          res.setHeader('Access-Control-Allow-Origin', origem);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
          }
        } else if (req.method === 'OPTIONS') {
          const hostAtual = req.get('host');
          const origemExtraida = extrairOrigemUrl(origem);
          const mesmaOrigem =
            Boolean(hostAtual && origemExtraida) &&
            origemExtraida === req.protocol + '://' + hostAtual;
          if (!mesmaOrigem) {
            return res.status(403).json({ erro: 'Origem não autorizada.' });
          }
          return res.sendStatus(204);
        }
      } else if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    this.app.use(express.json({ limit: '100kb' }));

    this.app.use(
      session({
        name: 'dispatch.sid',
        secret: resolverSegredoSessao(),
        store: sessionStore,
        proxy: true,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: 'auto',
          sameSite: 'lax',
          path: '/',
          maxAge: 1000 * 60 * 60 * 8 // 8 horas logado
        }
      })
    );

    // Proteção CSRF para rotas mutáveis da API usando Origin / Referer / Sec-Fetch-Site.
    this.app.use('/api', (req, res, next) => {
      if (!METODOS_MUTACAO.has(req.method)) return next();

      const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
      const origemBruta = req.headers.origin;
      const origem = origemBruta ? extrairOrigemUrl(origemBruta) : null;
      const refererOrigem =
        !origemBruta && req.headers.referer ? extrairOrigemUrl(req.headers.referer) : null;
      const origemReq = origem || refererOrigem;

      if (origemBruta && !origem) {
        return res.status(403).json({ erro: 'Origem da requisição inválida.' });
      }

      if (origemReq) {
        const hostAtual = req.get('host');
        const origemPropria = hostAtual ? req.protocol + '://' + hostAtual : null;
        const permitida =
          Boolean(origemPropria && origemReq === origemPropria) ||
          (!this.isProd && ORIGENS_DEV_PERMITIDAS.has(origemReq));
        if (!permitida) {
          return res.status(403).json({ erro: 'Origem da requisição não autorizada.' });
        }
        return next();
      }

      if (secFetchSite === 'cross-site') {
        return res.status(403).json({ erro: 'Origem da requisição não autorizada.' });
      }
      next();
    });

    const limitadorApi = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: criarHandlerLimite(
        'Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.'
      )
    });

    const limitadorLogin = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: criarHandlerLimite(
        'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
      )
    });

    const limitadorCadastro = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: criarHandlerLimite(
        'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.'
      )
    });

    const limitadorIa = rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: criarHandlerLimite(
        'Limite de consultas à IA atingido. Aguarde alguns minutos e tente novamente.'
      )
    });

    this.app.use('/api', limitadorApi);
    this.app.use('/api/auth/login', limitadorLogin);
    this.app.use('/api/auth/cadastro', limitadorCadastro);
    this.app.use('/api/ia', limitadorIa);

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

    this.app.use('/api', (req, res) => {
      res.status(404).json({ erro: 'Endpoint não encontrado.' });
    });

    // entrega os arquivos html, css e js da pasta client
    this.pastaClient = path.join(__dirname, '..', '..', 'client');
    this.app.use(express.static(this.pastaClient));

    this.app.use((err, req, res, next) => {
      if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'Corpo JSON inválido.' });
      }
      if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ erro: 'Payload muito grande.' });
      }
      console.error('Erro não tratado no servidor:', err);
      if (res.headersSent) return next(err);
      res.status(500).json({ erro: 'Erro interno no servidor.' });
    });
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
