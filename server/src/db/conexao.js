// Abre a conexão com o SQLite para todas as consultas do servidor.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

class ConexaoBanco {
  constructor() {
    const caminhoPadrao = path.join(__dirname, '..', '..', 'data', 'dispatch.db');
    this.caminho = process.env.DB_CAMINHO || caminhoPadrao;
  }

  conectar() {
    if (!fs.existsSync(this.caminho)) {
      console.log('Banco não encontrado em: ' + this.caminho);
      console.log('Rode antes o comando: npm run criar-banco');
      process.exit(1);
    }

    const db = new DatabaseSync(this.caminho);

    // No SQLite a conferência de chave estrangeira vem desligada por padrão.
    // Ligando aqui, o banco barra registros ligados a um ID que não existe.
    db.exec('PRAGMA foreign_keys = ON');

    // Se dois pedidos tentarem gravar ao mesmo tempo, espera até 5 segundos antes de dar erro de ocupado.
    db.exec('PRAGMA busy_timeout = 5000');

    return db;
  }
}

module.exports = new ConexaoBanco().conectar();
