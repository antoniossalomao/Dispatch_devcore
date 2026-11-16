// Login com Google.
//
// Como funciona: o botão manda a pessoa para a página do Google; ela escolhe a conta e o Google
// devolve para /api/auth/google/retorno com um código. O servidor troca esse código pelos dados da
// pessoa (nome e e-mail) direto com o Google.
//
// Quem pode entrar continua sendo decidido aqui, e não pelo Google: o e-mail precisa estar ligado
// a um usuário ativo do Dispatch (pelo cadastro ou pelo admin em Configurações). Sem isso, qualquer
// pessoa com Gmail entraria no painel.
//
// Variáveis de ambiente (no Azure: App Service → Variáveis de ambiente):
//   GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET  vêm do Google Cloud (APIs e serviços → Credenciais)
//   GOOGLE_REDIRECT_URI  opcional; se não tiver, usa https://<domínio>/api/auth/google/retorno
// Sem as duas primeiras, o botão do Google não aparece.
const crypto = require('crypto');
// Garante as colunas email/documento/telefone em bancos antigos.
const db = require('../db/colunasUsuario');

const URL_AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const EMISSORES = new Set(['https://accounts.google.com', 'accounts.google.com']);
// O "estado" guardado na sessão vale 10 minutos, tempo de sobra para escolher a conta no Google.
const VALIDADE_ESTADO_MS = 10 * 60 * 1000;

class LoginGoogle {
  configuracao() {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const segredo = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    return { ativo: Boolean(clientId && segredo), clientId: clientId, segredo: segredo };
  }

  enderecoRetorno(req) {
    const fixo = (process.env.GOOGLE_REDIRECT_URI || '').trim();
    if (fixo) return fixo;
    // No Azure o "trust proxy" está ligado, então req.protocol já vem como https.
    return req.protocol + '://' + req.get('host') + '/api/auth/google/retorno';
  }

  novoSegredo() {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Monta o endereço do Google. O "estado" e o "nonce" são números aleatórios que guardamos na sessão:
  // na volta conferimos se são os mesmos, para ninguém conseguir entrar com uma volta forjada.
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

  // Compara dois textos sempre no mesmo tempo, para não dar pistas pelo tempo de resposta.
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

  // Troca o código pelos dados da pessoa (o "id_token"), conversando direto com o Google por HTTPS
  // e com o nosso segredo. Como a resposta vem do próprio Google, não precisamos conferir a
  // assinatura do token, mas conferimos o resto: quem emitiu, para qual sistema, validade, nonce
  // e se o e-mail foi confirmado pelo Google.
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
