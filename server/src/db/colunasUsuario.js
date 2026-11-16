// As colunas email, documento (CPF/CNPJ) e telefone foram criadas depois da primeira versão do banco.
// Como o projeto não tem migração, esta classe confere se elas existem e cria as que faltam,
// sem apagar nenhum dado. Bancos novos já recebem as colunas pelo schema.sql.
const db = require('./conexao');

class ColunasUsuario {
  constructor() {
    this.novasColunas = [
      { nome: 'email', tipo: 'TEXT' },
      { nome: 'documento', tipo: 'TEXT' },
      { nome: 'telefone', tipo: 'TEXT' }
    ];
  }

  garantir() {
    const existentes = db.prepare('PRAGMA table_info(usuario)').all().map((coluna) => coluna.name);
    this.novasColunas.forEach((coluna) => {
      if (!existentes.includes(coluna.nome)) {
        db.exec('ALTER TABLE usuario ADD COLUMN ' + coluna.nome + ' ' + coluna.tipo);
      }
    });

    // Índice único: o banco não deixa duas contas com o mesmo e-mail ou o mesmo CPF/CNPJ.
    // O "WHERE ... IS NOT NULL" deixa várias contas antigas ficarem sem esses dados.
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email) WHERE email IS NOT NULL'
    );
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_documento ON usuario (documento) WHERE documento IS NOT NULL'
    );
  }
}

new ColunasUsuario().garantir();

// Quem importa este arquivo recebe a mesma conexão do conexao.js, já com as colunas garantidas.
module.exports = db;
