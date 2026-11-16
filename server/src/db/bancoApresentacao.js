// Monta um banco novo, já populado com a Construtora Aguapeí, pronto para a apresentação.
// Uso: npm run banco:apresentacao            (gera server/data/apresentacao.db)
//      npm run banco:apresentacao -- caminho  (gera no caminho escolhido)
// Depois é só apontar o DB_CAMINHO para o arquivo gerado, ou subir o arquivo para o servidor.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

class BancoApresentacao {
  constructor(destino) {
    this.destino = path.resolve(destino || path.join(__dirname, '..', '..', 'data', 'apresentacao.db'));
  }

  // Roda um dos scripts da pasta db usando o banco de destino.
  rodar(script) {
    execFileSync(process.execPath, [path.join(__dirname, script)], {
      stdio: 'inherit',
      env: Object.assign({}, process.env, { DB_CAMINHO: this.destino })
    });
  }

  montar() {
    // Começa sempre do zero: apaga o arquivo antigo (e os arquivos auxiliares do SQLite).
    ['', '-wal', '-shm', '-journal'].forEach((sufixo) => {
      if (fs.existsSync(this.destino + sufixo)) fs.unlinkSync(this.destino + sufixo);
    });
    fs.mkdirSync(path.dirname(this.destino), { recursive: true });
    this.rodar('criar-banco.js');
    this.rodar('seed.js');
    console.log('Banco de apresentação pronto em: ' + this.destino);
  }
}

new BancoApresentacao(process.argv[2]).montar();
