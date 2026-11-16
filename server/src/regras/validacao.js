// Regras compartilhadas de validação de entradas e política de senhas.
const SENHAS_FRACAS = new Set([
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

function lerIdPositivo(valor) {
  const texto = String(valor === undefined || valor === null ? '' : valor).trim();
  if (!/^\d+$/.test(texto)) return null;
  const numero = Number(texto);
  if (!Number.isSafeInteger(numero) || numero <= 0) return null;
  return numero;
}

function validarLogin(valor) {
  const login = String(valor || '').trim();
  if (login.length < 3 || login.length > 40) {
    return 'O login precisa ter entre 3 e 40 caracteres.';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(login)) {
    return 'O login só pode conter letras, números, ponto, hífen ou sublinhado.';
  }
  return null;
}

function validarSenha(senha, login) {
  if (typeof senha !== 'string') {
    return 'Informe uma senha válida.';
  }
  if (senha.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }
  if (senha.length > 72) {
    return 'A senha deve ter no máximo 72 caracteres.';
  }
  const limpa = senha.trim().toLowerCase();
  if (login && limpa === String(login).trim().toLowerCase()) {
    return 'A senha não pode ser igual ao login.';
  }
  if (SENHAS_FRACAS.has(limpa) || /^(\d)\1+$/.test(limpa) || /^(.)\1+$/.test(limpa)) {
    return 'Escolha uma senha menos previsível (evite sequências ou palavras comuns).';
  }
  return null;
}

function validarTelegramChatId(valor) {
  const texto = String(valor || '').trim();
  if (texto === '') return null;
  if (!/^-?\d{3,20}$/.test(texto)) {
    return 'ID do chat do Telegram inválido (use apenas números).';
  }
  return null;
}

function textoDentroDoLimite(valor, max, rotulo) {
  const texto = String(valor || '').trim();
  if (texto.length > max) {
    return rotulo + ' deve ter no máximo ' + max + ' caracteres.';
  }
  return null;
}

function lerTexto(valor) {
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor).trim();
  return '';
}

module.exports = {
  lerIdPositivo: lerIdPositivo,
  lerTexto: lerTexto,
  validarLogin: validarLogin,
  validarSenha: validarSenha,
  validarTelegramChatId: validarTelegramChatId,
  textoDentroDoLimite: textoDentroDoLimite
};
