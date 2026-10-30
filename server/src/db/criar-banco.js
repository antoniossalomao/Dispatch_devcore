// cria o arquivo do banco na pasta server/data, roda o schema.sql e cadastra o admin inicial
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const bcrypt = require('bcryptjs')

const caminhoPadrao = path.join(__dirname, '..', '..', 'data', 'dispatch.db')
const caminhoBanco = process.env.DB_CAMINHO || caminhoPadrao

// se já existe, para aqui pra não sobrescrever sem querer
if (fs.existsSync(caminhoBanco)) {
  console.log('O banco já existe em: ' + caminhoBanco)
  console.log('Se quiser criar do zero, apague esse arquivo e rode o comando de novo.')
  process.exit(1)
}

fs.mkdirSync(path.dirname(caminhoBanco), { recursive: true })

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
const db = new DatabaseSync(caminhoBanco)
db.exec('PRAGMA foreign_keys = ON')

try {
  db.exec(sql)

  // cria o primeiro login de administrador pra já conseguir entrar no sistema
  const senhaHash = bcrypt.hashSync('admin123', 10)
  db.prepare(
    'INSERT INTO usuario (nome, login, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, 1)'
  ).run('Administrador', 'admin', senhaHash, 'admin')
} catch (erro) {
  db.close()
  if (fs.existsSync(caminhoBanco)) {
    fs.unlinkSync(caminhoBanco)
  }
  console.log('Deu erro ao criar o banco: ' + erro.message)
  process.exit(1)
}

const tabelas = db.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
).all()

console.log('Banco criado com sucesso em: ' + caminhoBanco)
console.log('Tabelas criadas: ' + tabelas.length)
console.log('Usuário inicial criado -> login: admin | senha: *******')

db.close()
