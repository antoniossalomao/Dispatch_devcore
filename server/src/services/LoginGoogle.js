// Login com Google (OpenID Connect, fluxo "authorization code" feito todo no servidor).
//
// Regra de acesso: o Google só confirma QUEM é a pessoa. Quem pode entrar continua sendo decidido
// aqui: o e-mail do Google precisa estar associado a um usuário ativo do Dispatch (o admin faz isso
// em Configurações → Usuários). Não existe cadastro automático por conta Google; sem isso qualquer
// pessoa com Gmail entraria no painel da construtora.
//
// Configuração (variáveis de ambiente, no Azure em "Variáveis de ambiente" do App Service):
//   GOOGLE_CLIENT_ID      ID do cliente OAuth (Google Cloud → APIs e serviços → Credenciais)
//   GOOGLE_CLIENT_SECRET  segredo do mesmo cliente
//   GOOGLE_REDIRECT_URI   opcional; padrão https://<domínio>/api/auth/google/retorno
// Sem as duas primeiras, o botão "Entrar com Google" simplesmente não aparece.
const crypto = require('crypto');
const db = require('../db/conexao');

const URL_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const EMISSORES = new Set(['https://accounts.google.com', 'accounts.google.com']);
// O estado guardado na sessão vale por 10 minutos: tempo de sobra para escolher a conta no Google.
const VALIDADE_ESTADO_MS = 10 * 60 * 1000;

class LoginGoogle {
  constructor() {
    this.garantirColunaEmail();
  }

  // Bancos criados antes do login com Google não têm a coluna email. Adiciona sem perder dados,
  // e o índice único impede que um mesmo e-mail fique ligado a dois usuários.
  garantirColunaEmail() {
    const colunas = db.prepare('PRAGMA table_info(usuario)').all();
    if (!colunas.some((coluna) => coluna.name === 'email')) {
      db.exec('ALTER TABLE usuario ADD COLUMN email TEXT');
    }
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email) WHERE email IS NOT NULL'
    );
  }

  configuracao() {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const segredo = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    return { ativo: Boolean(clientId && segredo), clientId: clientId, segredo: segredo };
  }

  enderecoRetorno(req) {
    const fixo = (process.env.GOOGLE_REDIRECT_URI || '').trim();
    if (fixo) return fixo;
    // Com "trust proxy" ligado, req.protocol já é https atrás do proxy do Azure.
    return req.protocol + '://' + req.get('host') + '/api/auth/google/retorno';
  }

  novoSegredo() {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Monta o endereço do Google e devolve também o que precisa ficar guardado na sessão.
  iniciar(req) {
    const cfg = this.configuracao();
    const estado = this.novoSegredo();
    const nonce = this.novoSegredo();
    const retorno = this.enderecoRetorno(req);
    const parametros = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: retorno,
      response_type: 'code',
      scope: 'openid email profile',
      state: estado,
      nonce: nonce,
      prompt: 'select_account'
    });
    return {
      url: URL_AUTORIZACAO + '?' + parametros.toString(),
      guardar: { estado: estado, nonce: nonce, retorno: retorno, criadoEm: Date.now() }
    };
  }

  // Compara em tempo constante para não vazar o estado esperado pela diferença de tempo.
  mesmoTexto(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
  }

  estadoValido(guardado, estadoRecebido) {
    if (!guardado || !estadoRecebido) return false;
    if (Date.now() - guardado.criadoEm > VALIDADE_ESTADO_MS) return false;
    return this.mesmoTexto(guardado.estado, estadoRecebido);
  }

  lerCargaJwt(token) {
    const partes = String(token || '').split('.');
    if (partes.length !== 3) throw new Error('id_token em formato inválido');
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
  }

  // Troca o código pelo id_token direto com o Google, por HTTPS e com o segredo do cliente.
  // Pela especificação do OpenID Connect (3.1.3.7), um id_token recebido assim do próprio endpoint
  // de token dispensa conferir a assinatura; as demais conferências abaixo continuam obrigatórias.
  async confirmarIdentidade(codigo, guardado) {
    const cfg = this.configuracao();
    const resposta = await fetch(URL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: codigo,
        client_id: cfg.clientId,
        client_secret: cfg.segredo,
        redirect_uri: guardado.retorno,
        grant_type: 'authorization_code'
      }).toString()
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok || !dados.id_token) {
      throw new Error('Google recusou o código: ' + (dados.error || resposta.status));
    }

    const carga = this.lerCargaJwt(dados.id_token);
    const agora = Math.floor(Date.now() / 1000);
    if (!EMISSORES.has(carga.iss)) throw new Error('Emissor do token inesperado');
    const publico = Array.isArray(carga.aud) ? carga.aud : [carga.aud];
    if (!publico.includes(cfg.clientId)) throw new Error('Token emitido para outro cliente');
    if (!carga.exp || carga.exp < agora - 60) throw new Error('Token expirado');
    if (!carga.nonce || !this.mesmoTexto(carga.nonce, guardado.nonce)) {
      throw new Error('Nonce não confere');
    }
    if (carga.email_verified !== true && carga.email_verified !== 'true') {
      throw new Error('E-mail do Google não verificado');
    }
    return { email: String(carga.email || '').trim().toLowerCase(), nome: carga.name || '' };
  }

  buscarUsuarioPorEmail(email) {
    if (!email) return null;
    return db
      .prepare(
        'SELECT id, nome, login, perfil, ativo FROM usuario WHERE lower(email) = ? AND ativo = 1'
      )
      .get(email);
  }
}

module.exports = new LoginGoogle();
