// Servidor principal do Dispatch: entrega as páginas do site (pasta client) e responde as rotas da API.
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

class Servidor {
  constructor() {
    this.app = express();
    this.porta = process.env.PORT || 3001;
    // No Azure ou quando NODE_ENV está como production, ligamos as regras mais rígidas de publicação.
    this.emProducao =
      process.env.NODE_ENV === 'production' || Boolean(process.env.WEBSITE_SITE_NAME);

    // Portas locais usadas pela extensão Live Server do VS Code só durante testes no PC.
    this.origensDev = new Set([
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://[::1]:5500',
      'http://localhost:5501',
      'http://127.0.0.1:5501',
      'http://[::1]:5501'
    ]);
    this.metodosQueAlteram = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

    // Esconde que o servidor usa Express para não dar dicas de graça sobre qual tecnologia está rodando.
    this.app.disable('x-powered-by');
    // No Azure, a conexão passa pelo proxy deles; isso faz o Express ler o HTTPS e o IP reais do visitante.
    // Fora de produção não tem proxy na frente, então não dá pra confiar no cabeçalho X-Forwarded-For:
    // qualquer um poderia trocar o IP nele e escapar do limite de tentativas de login.
    if (this.emProducao) {
      this.app.set('trust proxy', 1);
    }

    this.configurarCabecalhosSeguranca();
    this.configurarCors();
    // Limita o tamanho do JSON recebido para evitar que travem o servidor enviando textos gigantes.
    this.app.use(express.json({ limit: '100kb' }));
    this.configurarSessao();
    this.configurarProtecaoCsrf();
    this.configurarLimitesRequisicao();
    this.configurarRotas();
    this.configurarTratamentoErros();
  }

  extrairOrigemUrl(valor) {
    try {
      const url = new URL(String(valor));
      return url.origin && url.origin !== 'null' ? url.origin : null;
    } catch (_) {
      return null;
    }
  }

  escolherSegredoSessao() {
    const configurado = (process.env.SESSION_SECRET || '').trim();
    if (configurado && configurado !== 'dispatch-devcore-segredo') {
      return configurado;
    }
    console.warn(
      'Aviso: SESSION_SECRET não foi configurado no .env. Gerando uma chave temporária agora (quem estiver logado cai se o servidor reiniciar).'
    );
    return crypto.randomBytes(48).toString('hex');
  }

  // O Helmet coloca regras de proteção no navegador (barra script invasor, proíbe abrir o site dentro de iframe etc.).
  configurarCabecalhosSeguranca() {
    const connectSrc = this.emProducao
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
            upgradeInsecureRequests: this.emProducao ? [] : null
          }
        },
        frameguard: { action: 'deny' },
        hsts: this.emProducao ? undefined : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
      })
    );
  }

  // O navegador bloqueia por padrão chamadas entre portas/sites diferentes (regra chamada CORS).
  // Em produção tudo roda no mesmo endereço; fora de produção só liberamos as portas locais do Live Server.
  configurarCors() {
    this.app.use((req, res, next) => {
      const origem = req.headers.origin;
      if (origem) {
        res.vary('Origin');
        if (!this.emProducao && this.origensDev.has(origem)) {
          res.setHeader('Access-Control-Allow-Origin', origem);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
          }
        } else if (req.method === 'OPTIONS') {
          const hostAtual = req.get('host');
          const origemExtraida = this.extrairOrigemUrl(origem);
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
  }

  // Configura o cookie que mantém a pessoa logada:
  // httpOnly não deixa scripts da tela lerem o cookie e sameSite='lax' ajuda a impedir envio por outros sites.
  configurarSessao() {
    this.app.use(
      session({
        name: 'dispatch.sid',
        secret: this.escolherSegredoSessao(),
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
  }

  // Proteção contra CSRF (quando outro site tenta enviar uma ação disfarçada usando seu login aberto).
  // Para qualquer rota da API que cria, edita ou apaga, conferimos de qual site o pedido veio.
  configurarProtecaoCsrf() {
    this.app.use('/api', (req, res, next) => {
      if (!this.metodosQueAlteram.has(req.method)) return next();

      const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
      const origemBruta = req.headers.origin;
      const origem = origemBruta ? this.extrairOrigemUrl(origemBruta) : null;
      const refererOrigem =
        !origemBruta && req.headers.referer ? this.extrairOrigemUrl(req.headers.referer) : null;
      const origemPedido = origem || refererOrigem;

      if (origemBruta && !origem) {
        return res.status(403).json({ erro: 'Origem da requisição inválida.' });
      }

      if (origemPedido) {
        const hostAtual = req.get('host');
        const origemPropria = hostAtual ? req.protocol + '://' + hostAtual : null;
        const permitida =
          Boolean(origemPropria && origemPedido === origemPropria) ||
          (!this.emProducao && this.origensDev.has(origemPedido));
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
  }

  criarRespostaLimite(mensagem) {
    return (req, res) => {
      res.status(429).json({ erro: mensagem });
    };
  }

  // Freio para impedir tentativas seguidas de adivinhar senha ou sobrecarregar a IA/API.
  configurarLimitesRequisicao() {
    const janela15Min = 15 * 60 * 1000;

    const limiteGeralApi = rateLimit({
      windowMs: janela15Min,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: this.criarRespostaLimite(
        'Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.'
      )
    });

    const limiteLogin = rateLimit({
      windowMs: janela15Min,
      limit: 10,
      skipSuccessfulRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: this.criarRespostaLimite(
        'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
      )
    });

    const limiteCadastro = rateLimit({
      windowMs: janela15Min,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: this.criarRespostaLimite(
        'Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.'
      )
    });

    const limiteIa = rateLimit({
      windowMs: janela15Min,
      limit: 30,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: this.criarRespostaLimite(
        'Limite de consultas à IA atingido. Aguarde alguns minutos e tente novamente.'
      )
    });

    this.app.use('/api', limiteGeralApi);
    this.app.use('/api/auth/login', limiteLogin);
    this.app.use('/api/auth/google', limiteLogin);
    this.app.use('/api/auth/cadastro', limiteCadastro);
    this.app.use('/api/ia', limiteIa);
  }

  configurarRotas() {
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
      res.status(404).json({ erro: 'Endereço da API não encontrado.' });
    });

    // Entrega os arquivos HTML, CSS e JS das telas que ficam na pasta client.
    this.pastaClient = path.join(__dirname, '..', '..', 'client');
    // URLs limpas: /resumo.html vira /resumo (301) e /index.html vira /. O express.static acha o .html sozinho.
    this.app.use((req, res, next) => {
      // Os fragmentos das telas (/telas/*.html) são buscados pela casca e ficam fora da regra.
      if (
        (req.method === 'GET' || req.method === 'HEAD') &&
        req.path.endsWith('.html') &&
        !req.path.startsWith('/telas/')
      ) {
        const limpo = ['/index.html', '/apresentacao.html'].includes(req.path) ? '/' : req.path.slice(0, -'.html'.length);
        // A página de login era o index.html; links antigos para ela continuam caindo no login.
        if (req.path === '/index.html' && req.query.cadastro) {
          return res.redirect(301, '/login' + req.originalUrl.slice(req.originalUrl.indexOf('?')));
        }
        const consulta = req.originalUrl.slice(req.originalUrl.indexOf(req.path) + req.path.length);
        return res.redirect(301, limpo + consulta);
      }
      // A apresentação agora é a página inicial.
      if (req.path === '/apresentacao') {
        return res.redirect(301, '/');
      }
      next();
    });
    // Telas internas: todas abrem a mesma casca (client/app.html), que monta a tela pelo endereço.
    // Recarregar /frota ou colar o link dela abre direto na Frota, sem passar pelo Resumo.
    const telasDoSistema = [
      'resumo',
      'colaboradores',
      'alojamentos',
      'frota',
      'movimentacoes',
      'relatorios',
      'configuracoes'
    ];
    const casca = path.join(this.pastaClient, 'app.html');
    this.app.get(
      telasDoSistema.map((tela) => '/' + tela),
      (req, res) => {
        // A casca muda junto com os módulos das telas; sem cache para ninguém ficar com versões misturadas.
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(casca);
      }
    );
    // /app.html não é um endereço público; quem cair nele vai para o Resumo.
    this.app.get('/app', (req, res) => res.redirect(301, '/resumo'));
    this.app.use(express.static(this.pastaClient, { extensions: ['html'] }));
  }

  // Trata erros inesperados no fim da fila para nunca mostrar detalhes internos do sistema ao usuário.
  configurarTratamentoErros() {
    this.app.use((err, req, res, next) => {
      if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ erro: 'Os dados enviados não estão em formato JSON válido.' });
      }
      if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ erro: 'Os dados enviados são grandes demais para este pedido.' });
      }
      console.error('Erro não tratado no servidor:', err);
      if (res.headersSent) return next(err);
      res.status(500).json({ erro: 'Erro interno no servidor.' });
    });
  }

  iniciar() {
    return this.app.listen(this.porta, () => {
      console.log('Servidor rodando em http://localhost:' + this.porta);
      // Confere os avisos pendentes assim que o servidor liga.
      notificacoes.verificar(configuracao.lerConfig()).catch((erro) => {
        console.log('Não foi possível verificar os avisos: ' + erro.message);
      });
    });
  }
}

module.exports = Servidor;
if (require.main === module) new Servidor().iniciar();
