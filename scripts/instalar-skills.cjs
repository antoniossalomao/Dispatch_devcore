// Instala as fontes fixadas no lock sem executar código dos repositórios baixados.
// Uso: node scripts/instalar-skills.cjs [diretório com clones já baixados]
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const fontes = path.resolve(process.argv[2] || path.join(raiz, '.design-skills'));
const destino = path.join(raiz, '.agents', 'skills');
const lock = require('../docs/design-skills.lock.json');
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

fs.mkdirSync(fontes, { recursive: true });
fs.mkdirSync(destino, { recursive: true });
for (const fonte of lock.sources) {
  const pasta = path.join(fontes, fonte.name);
  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta);
    git(['init', '--quiet'], pasta);
    git(['remote', 'add', 'origin', fonte.repository], pasta);
    git(['fetch', '--depth', '1', 'origin', fonte.commit], pasta);
    git(['checkout', '--detach', fonte.commit], pasta);
  }
  if (git(['rev-parse', 'HEAD'], pasta) !== fonte.commit) {
    throw new Error('Versão diferente do lock em ' + pasta + '. Use outro diretório para preservar o clone existente.');
  }
  for (const skill of fonte.skills) {
    const origem = path.join(pasta, skill.path);
    const alvo = path.join(destino, skill.name);
    if (!fs.existsSync(origem)) throw new Error('Skill ausente: ' + origem);
    const existente = fs.lstatSync(alvo, { throwIfNoEntry: false });
    if (existente) {
      if (existente.isSymbolicLink() && path.resolve(destino, fs.readlinkSync(alvo)) === origem) continue;
      throw new Error('Destino já existe; nada foi sobrescrito: ' + alvo);
    }
    fs.symlinkSync(path.relative(destino, origem), alvo, 'dir');
    console.log('Instalada: ' + skill.name);
  }
}
