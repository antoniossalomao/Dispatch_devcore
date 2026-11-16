// Colunas de usuario que surgiram depois da primeira versão do banco (login com Google e o
// cadastro completo). O projeto não tem sistema de migração, então quem carrega este arquivo
// garante que elas existam: bancos novos já as recebem pelo schema.sql e bancos antigos ganham
// as colunas aqui, sem perder dados. Os índices únicos impedem duas contas com o mesmo e-mail
// ou o mesmo CPF/CNPJ.
const db = require('./conexao');

const NOVAS = [
  ['email', 'TEXT'],
  ['documento', 'TEXT'],
  ['telefone', 'TEXT']
];

const existentes = new Set(db.prepare('PRAGMA table_info(usuario)').all().map((c) => c.name));
NOVAS.forEach(([nome, tipo]) => {
  if (!existentes.has(nome)) db.exec('ALTER TABLE usuario ADD COLUMN ' + nome + ' ' + tipo);
});
db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email) WHERE email IS NOT NULL'
);
db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_documento ON usuario (documento) WHERE documento IS NOT NULL'
);

module.exports = db;
