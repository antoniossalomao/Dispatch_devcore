// cria o arquivo do banco e as tabelas (lendo o schema.sql)
// pra rodar: npm run criar-banco (dentro da pasta server)

const fs = require('fs')
const path = require('path')
const os = require('os')
const Database = require('better-sqlite3')

// onde o banco vai ficar. da pra mudar no .env (DB_CAMINHO)
// o padrão é uma pasta fora do projeto, pq o projeto ta no OneDrive
// e o OneDrive sincronizando pode corromper o arquivo do banco
const caminhoBanco = process.env.DB_CAMINHO || path.join(os.homedir(), 'dispatch-dados', 'dispatch.db')

// se o banco já existe, não faz nada pra não perder os dados de ninguém
// (se quiser criar do zero, apaga o arquivo na mão e roda de novo)
if (fs.existsSync(caminhoBanco)) {
  console.log('O banco já existe em: ' + caminhoBanco)
  console.log('Se quiser criar de novo, apague esse arquivo e rode o comando outra vez.')
  process.exit(1)
}

// cria a pasta do banco caso ela ainda não exista
fs.mkdirSync(path.dirname(caminhoBanco), { recursive: true })

// lê o schema.sql que ta na mesma pasta desse arquivo
const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')

// abrir o banco já cria o arquivo
const db = new Database(caminhoBanco)

// no sqlite a checagem das chaves estrangeiras (REFERENCES) vem desligada, tem que ligar
db.pragma('foreign_keys = ON')

// exec roda o arquivo sql inteiro de uma vez
// se der erro em alguma tabela, apaga o arquivo pra não ficar um banco pela metade
try {
  db.exec(sql)
} catch (erro) {
  db.close()
  fs.unlinkSync(caminhoBanco)
  console.log('Deu erro ao criar as tabelas:', erro.message)
  process.exit(1)
}

// só pra conferir, lista as tabelas que foram criadas
const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all()

console.log('Banco criado em: ' + caminhoBanco)
console.log('Tabelas (' + tabelas.length + '):')
tabelas.forEach(function (t) {
  console.log(' - ' + t.name)
})

db.close()
