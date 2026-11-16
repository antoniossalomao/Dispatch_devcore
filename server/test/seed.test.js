// Confere se o banco de apresentação (Construtora Aguapeí) sai coerente:
// NR-24 nos quartos, ninguém em dois lugares ao mesmo tempo e motorista sempre com CNH.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

test('banco de apresentação sai completo e sem conflitos', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-seed-'));
  const arquivo = path.join(pasta, 'apresentacao.db');
  try {
    execFileSync(process.execPath, [path.join(__dirname, '../src/db/bancoApresentacao.js'), arquivo], {
      stdio: 'ignore'
    });
    const db = new DatabaseSync(arquivo);
    const contar = (sql) => db.prepare(sql).all().length;

    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pessoa').get().n, 28);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM alojamento').get().n, 4);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM veiculo').get().n, 10);
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM uso_veiculo').get().n > 100);
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM estadia WHERE fim IS NULL').get().n > 0);

    // NR-24: até 8 leitos por quarto e área mínima por cama (3 m²) e beliche (4,5 m²)
    assert.equal(
      contar('SELECT q.id FROM leito l JOIN quarto q ON q.id = l.quarto_id GROUP BY q.id HAVING COUNT(*) > 8'),
      0
    );
    assert.equal(
      contar(
        "SELECT q.id FROM quarto q JOIN leito l ON l.quarto_id = q.id GROUP BY q.id HAVING q.area_m2 < SUM(CASE WHEN l.tipo = 'cama' THEN 3 WHEN l.tipo = 'beliche_baixo' THEN 4.5 ELSE 0 END)"
      ),
      0
    );

    // ninguém em dois leitos, nem dois numa cama, nem motorista/veículo em duas viagens ao mesmo tempo
    const sobreposto = (tabela, coluna, ini, fim) =>
      contar(
        'SELECT a.id FROM ' + tabela + ' a JOIN ' + tabela + ' b ON a.' + coluna + ' = b.' + coluna +
          " AND a.id < b.id AND a." + ini + " < COALESCE(b." + fim + ", '9999') AND b." + ini +
          " < COALESCE(a." + fim + ", '9999')"
      );
    assert.equal(sobreposto('estadia', 'pessoa_id', 'inicio', 'fim'), 0);
    assert.equal(sobreposto('estadia', 'leito_id', 'inicio', 'fim'), 0);
    assert.equal(sobreposto('uso_veiculo', 'motorista_id', 'saida', 'retorno'), 0);
    assert.equal(sobreposto('uso_veiculo', 'veiculo_id', 'saida', 'retorno'), 0);
    assert.equal(
      contar('SELECT u.id FROM uso_veiculo u JOIN pessoa p ON p.id = u.motorista_id WHERE p.cnh_categorias IS NULL'),
      0
    );

    // usuários da apresentação entram pelo e-mail
    const helena = db.prepare("SELECT perfil, documento FROM usuario WHERE email = 'helena.castro@construtora-aguapei.com.br'").get();
    assert.equal(helena.perfil, 'admin');
    assert.match(helena.documento, /^\d{11}$/);
    db.close();
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
