// Validações compartilhadas pelos controladores (IDs, textos, logins, senhas, documentos e contatos).
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

  somenteDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  // Confere os dígitos verificadores de CPF (11) ou CNPJ (14). Devolve só os números, ou null se inválido.
  lerCpfCnpj(valor) {
    const d = this.somenteDigitos(valor);
    if (/^(\d)\1+$/.test(d)) return null; // 000.000.000-00, 111... passam na conta mas não existem
    const digito = (base, pesos) => {
      const soma = base.split('').reduce((t, n, i) => t + Number(n) * pesos[i], 0);
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    if (d.length === 11) {
      const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
      const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
      const ok = digito(d.slice(0, 9), p1) === Number(d[9]) && digito(d.slice(0, 10), p2) === Number(d[10]);
      return ok ? d : null;
    }
    if (d.length === 14) {
      const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const ok = digito(d.slice(0, 12), p1) === Number(d[12]) && digito(d.slice(0, 13), p2) === Number(d[13]);
      return ok ? d : null;
    }
    return null;
  }

  // E-mail em minúsculas, ou null se não tiver cara de e-mail.
  lerEmail(valor) {
    const email = String(valor || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }

  // Deixa o texto pronto pra comparar na busca: minúsculo e sem acento ("José" vira "jose").
  // Assim quem digita sem acento acha o nome do mesmo jeito.
  paraBusca(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  // Telefone brasileiro com DDD: 10 dígitos (fixo) ou 11 (celular, começando com 9).
  lerTelefone(valor) {
    let d = this.somenteDigitos(valor);
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 10 || (d.length === 11 && d[2] === '9')) return d;
    return null;
  }
}

module.exports = new Validador();
