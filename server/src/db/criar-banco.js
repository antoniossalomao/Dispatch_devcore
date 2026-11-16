// Cria o arquivo do banco SQLite em server/data, monta as tabelas e cadastra o admin inicial.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

class CriadorBanco {
  constructor() {
    const caminhoPadrao = path.join(__dirname, '..', '..', 'data', 'dispatch.db');
    this.caminhoBanco = process.env.DB_CAMINHO || caminhoPadrao;
    this.caminhoSchema = path.join(__dirname, 'schema.sql');
  }

  executar() {
    // Se o banco já existe, para aqui para não apagar os dados sem querer.
    if (fs.existsSync(this.caminhoBanco)) {
      console.log('O banco já existe em: ' + this.caminhoBanco);
      console.log('Se quiser criar do zero, apague esse arquivo e rode o comando de novo.');
      process.exit(1);
    }

    fs.mkdirSync(path.dirname(this.caminhoBanco), { recursive: true });

    const sql = fs.readFileSync(this.caminhoSchema, 'utf-8');
    const db = new DatabaseSync(this.caminhoBanco);
    db.exec('PRAGMA foreign_keys = ON');

    try {
      db.exec(sql);

      // A senha nunca é salva em texto puro no banco: o bcrypt transforma ela em um código irreversível (hash).
      // Mantemos esse admin padrão só para o primeiro acesso ao subir o projeto.
      const senhaHash = bcrypt.hashSync('admin123', 10);
      db.prepare(
        'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)'
      ).run('Administrador', 'admin', senhaHash, 'admin');
    } catch (erro) {
      db.close();
      if (fs.existsSync(this.caminhoBanco)) {
        fs.unlinkSync(this.caminhoBanco);
      }
      console.log('Deu erro ao criar o banco: ' + erro.message);
      process.exit(1);
    }

    const tabelas = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .all();

    console.log('Banco criado com sucesso em: ' + this.caminhoBanco);
    console.log('Tabelas criadas: ' + tabelas.length);
    console.log('Usuário inicial criado -> login: admin | senha: *******');

    db.close();
  }
}

if (require.main === module) {
  new CriadorBanco().executar();
}

module.exports = CriadorBanco;
