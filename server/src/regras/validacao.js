// Validações compartilhadas pelos controladores (IDs, textos, logins e senhas).
class Validador {
  constructor() {
    this.senhasFracas = new Set([
      '12345678',
      '123456789',
      '1234567890',
      '87654321',
      '00000000',
      '11111111',
      'admin123',
      'password',
      'qwertyui',
      'dispatch',
      'senhaforte',
      'mudar123'
    ]);

    this.lerIdPositivo = this.lerIdPositivo.bind(this);
    this.lerTexto = this.lerTexto.bind(this);
    this.validarLogin = this.validarLogin.bind(this);
    this.validarSenha = this.validarSenha.bind(this);
    this.validarTelegramChatId = this.validarTelegramChatId.bind(this);
    this.textoDentroDoLimite = this.textoDentroDoLimite.bind(this);
  }

  // Garante que o ID vindo da URL ou do formulário seja um número inteiro maior que zero.
  lerIdPositivo(valor) {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    if (!/^\d+$/.test(texto)) return null;

    const numero = Number(texto);
    if (!Number.isSafeInteger(numero) || numero <= 0) return null;
    return numero;
  }

  // Só aceita string, número ou booleano simples; evita que objetos estranhos no JSON quebrem o código.
  lerTexto(valor) {
    if (typeof valor === 'string') return valor.trim();
    if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor).trim();
    return '';
  }

  validarLogin(valor) {
    const login = String(valor || '').trim();
    if (login.length < 3 || login.length > 40) {
      return 'O login precisa ter entre 3 e 40 caracteres.';
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(login)) {
      return 'O login só pode conter letras, números, ponto, hífen ou sublinhado.';
    }
    return null;
  }

  validarSenha(senha, login) {
    if (typeof senha !== 'string') {
      return 'Informe uma senha válida.';
    }
    if (senha.length < 8) {
      return 'A senha precisa ter pelo menos 8 caracteres.';
    }
    // O algoritmo bcrypt só lê até 72 bytes; limitar aqui evita cortes silenciosos ou lentidão.
    if (senha.length > 72) {
      return 'A senha deve ter no máximo 72 caracteres.';
    }
    const limpa = senha.trim().toLowerCase();
    if (login && limpa === String(login).trim().toLowerCase()) {
      return 'A senha não pode ser igual ao login.';
    }
    if (this.senhasFracas.has(limpa) || /^(\d)\1+$/.test(limpa) || /^(.)\1+$/.test(limpa)) {
      return 'Escolha uma senha menos previsível (evite sequências ou palavras comuns).';
    }
    return null;
  }

  validarTelegramChatId(valor) {
    const texto = String(valor || '').trim();
    if (texto === '') return null;
    if (!/^-?\d{3,20}$/.test(texto)) {
      return 'ID do chat do Telegram inválido (use apenas números).';
    }
    return null;
  }

  textoDentroDoLimite(valor, max, rotulo) {
    const texto = String(valor || '').trim();
    if (texto.length > max) {
      return rotulo + ' deve ter no máximo ' + max + ' caracteres.';
    }
    return null;
  }
}

module.exports = new Validador();
