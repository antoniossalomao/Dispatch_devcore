// abre a conexão com o banco sqlite pra usar nas rotas
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const caminhoPadrao = path.join(__dirname, '..', '..', 'data', 'dispatch.db')
const caminhoBanco = process.env.DB_CAMINHO || caminhoPadrao

if (!fs.existsSync(caminhoBanco)) {
  console.log('Banco não encontrado em: ' + caminhoBanco)
  console.log('Rode antes o comando: npm run criar-banco')
  process.exit(1)
}

const db = new DatabaseSync(caminhoBanco)

// no sqlite a checagem das chaves estrangeiras (REFERENCES) vem desligada por padrão
db.exec('PRAGMA foreign_keys = ON')

module.exports = db
