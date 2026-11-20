// Regressões de navegação, teclado e acessibilidade usando somente um banco temporário.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const raiz = path.resolve(__dirname, '..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-ui-'));
const artifacts = path.join(__dirname, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const env = { ...process.env, DB_CAMINHO: path.join(pasta, 'teste.db'), SESSION_SECRET: 'somente-teste-ui-local', NODE_ENV: 'test' };
const resultados = [];
let servidor, browser;

async function etapa(nome, executar) {
  await executar();
  resultados.push(nome);
  console.log('✓ ' + nome);
}

(async () => {
  const porta = await new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => {
      const numero = socket.address().port;
      socket.close(() => resolve(numero));
    });
  });
  env.PORT = String(porta);
  const base = 'http://localhost:' + porta;
  for (const script of ['criar-banco', 'seed']) {
    execFileSync(process.execPath, ['src/db/' + script + '.js'], { cwd: raiz, env, stdio: 'pipe' });
  }
  servidor = spawn(process.execPath, ['src/server.js'], { cwd: raiz, env, stdio: 'pipe' });
  for (let tentativa = 0; ; tentativa++) {
    try { if ((await fetch(base + '/login')).ok) break; } catch (_) {}
    if (tentativa === 100) throw new Error('Servidor de teste não iniciou');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  // CSP é contornado somente neste contexto de teste para injetar o motor AccessLint.
  const contexto = await browser.newContext({ bypassCSP: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (erro) => erros.push(erro.message));
  const auditorias = [];
  async function auditar(nome) {
    await page.addScriptTag({ path: require.resolve('@accesslint/core/iife') });
    const falhas = await page.evaluate(() => window.AccessLint.runAudit(document).violations.map((v) => ({ regra: v.ruleId, seletor: v.selector, impacto: v.impact, mensagem: v.message })));
    auditorias.push({ nome, falhas });
    assert.deepEqual(falhas, [], nome + ': AccessLint');
  }
  async function abrir(rota) {
    await page.goto(base + '/' + rota);
    await page.waitForLoadState('networkidle');
    if (!['login', 'cadastro'].includes(rota)) await page.locator('main[aria-busy="false"]').waitFor();
  }
  const semTransbordamento = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'A página tem rolagem horizontal');

  await etapa('Login e cadastro: semântica e validação com foco', async () => {
    await abrir('cadastro'); await auditar('cadastro');
    await abrir('login'); await auditar('login');
    await page.locator('#botao-entrar').click();
    await page.locator('#mensagem-erro').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'usuario');
    await page.locator('#usuario').fill('admin');
    await page.locator('#senha').fill('admin123');
    await page.locator('#botao-entrar').click();
    await page.waitForURL('**/resumo');
    await page.waitForLoadState('networkidle');
  });

  await etapa('Sete telas em dois temas e duas larguras: AccessLint e layout', async () => {
    for (const largura of [1440, 390]) {
      await page.setViewportSize({ width: largura, height: 1000 });
      for (const tema of ['escuro', 'claro']) {
        await page.evaluate((valor) => localStorage.setItem('dispatch-tema', valor), tema);
        for (const rota of ['resumo', 'colaboradores', 'alojamentos', 'frota', 'movimentacoes', 'relatorios', 'configuracoes']) {
          await abrir(rota);
          await auditar(`${rota}-${tema}-${largura}`);
          await semTransbordamento();
          assert.equal(await page.locator('h1').count(), 1);
          assert.equal(await page.locator('[aria-current="page"]').count(), 1);
          if (rota === 'resumo') await page.screenshot({ path: path.join(artifacts, `resumo-${tema}-${largura}.png`), fullPage: true });
        }
      }
    }
  });

  await etapa('Busca global por toque, teclado, seleção e retorno do foco', async () => {
    await abrir('resumo');
    const gatilho = page.locator('#botao-paleta');
    assert(await gatilho.isVisible());
    const tamanho = await gatilho.boundingBox();
    assert(tamanho.width >= 44 && tamanho.height >= 44);
    await gatilho.click();
    await auditar('busca-global');
    assert(await page.locator('.area-conteudo').evaluate((el) => el.inert));
    await page.keyboard.press('Shift+Tab');
    assert(await page.locator('.cmdk-fechar').evaluate((el) => el === document.activeElement));
    await page.keyboard.press('Tab');
    await page.locator('.cmdk-input').fill('Novo veículo');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/frota');
    await page.locator('.modal-overlay:not([hidden])').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.modal-overlay:not([hidden])').waitFor({ state: 'hidden' });
    await gatilho.click();
    await page.locator('.cmdk-fechar').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'botao-paleta');
    assert.equal(await page.locator('[inert]:not(.saindo)').count(), 0);
  });

  await etapa('Modal aninhado: descartar, continuar editando e foco', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await abrir('colaboradores');
    await page.locator('#botao-novo-colaborador').click();
    await page.locator('#colab-nome').fill('Teste sem salvar');
    // A captura inicial do formulário ocorre após o preenchimento dos valores da edição.
    await page.waitForTimeout(70);
    await page.locator('#colab-nome').fill('Alteração sem salvar');
    await page.keyboard.press('Escape');
    const confirmar = page.locator('[data-dialogo="1"]');
    await confirmar.waitFor();
    await confirmar.getByRole('button', { name: 'Continuar editando' }).click();
    assert(await page.locator('#colab-nome').isVisible());
    assert(await page.locator('.area-conteudo').evaluate((el) => el.inert));
    await page.keyboard.press('Escape');
    await page.locator('[data-dialogo="1"]').getByRole('button', { name: 'Descartar', exact: true }).click();
    await page.locator('.modal-overlay:not([hidden])').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'botao-novo-colaborador');
    assert.equal(await page.locator('[inert]').count(), 0);
  });

  await etapa('Resumo: falha HTTP, recuperação e dados sem números inventados', async () => {
    await page.route('**/api/resumo', (rota) => rota.fulfill({ status: 503, contentType: 'application/json', body: '{"erro":"Indisponível"}' }));
    await abrir('resumo');
    await page.locator('#resumo-falha').waitFor();
    assert.equal(await page.locator('#num-veiculos-uso').textContent(), '—');
    assert(!(await page.locator('#conteudo').textContent()).includes('Carregando'));
    await page.unroute('**/api/resumo');
    await page.locator('#resumo-tentar').click();
    await page.waitForFunction(() => document.getElementById('num-veiculos-uso').textContent !== '—');
    assert(await page.locator('#resumo-falha').isHidden());
    await page.locator('#campo-busca').fill('nenhum-registro');
    assert((await page.locator('#resumo-contagem').textContent()).startsWith('0 '));
    await page.locator('.ui-limpar-busca').click();
    assert((await page.locator('#resumo-contagem').textContent()).startsWith('6 '));
  });

  await etapa('Navegação rápida: URL, título e conteúdo seguem o último clique', async () => {
    await abrir('resumo');
    await page.route('**/telas/frota.html', async (rota) => { await new Promise((resolve) => setTimeout(resolve, 350)); await rota.continue(); });
    await page.locator('[data-rota="frota"]').click();
    await page.locator('[data-rota="alojamentos"]').click();
    await page.waitForURL('**/alojamentos');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('h1').textContent(), 'Alojamentos');
    await page.unrouteAll({ behavior: 'wait' });
    // Regressão: clicar na tela atual também cancela uma navegação pendente.
    await abrir('resumo');
    await page.route('**/telas/frota.html', async (rota) => { await new Promise((resolve) => setTimeout(resolve, 350)); await rota.continue(); });
    await page.locator('[data-rota="frota"]').click();
    await page.locator('[data-rota="resumo"]').click();
    await page.waitForLoadState('networkidle');
    assert(new URL(page.url()).pathname === '/resumo');
    assert.equal(await page.locator('h1').textContent(), 'Resumo operacional');
    await page.unrouteAll({ behavior: 'wait' });
  });

  await etapa('Ajuda fecha com Escape e devolve o foco', async () => {
    await page.locator('.chat-botao').click();
    await page.keyboard.press('Escape');
    assert(await page.locator('.chat-painel').isHidden());
    assert(await page.locator('.chat-botao').evaluate((el) => el === document.activeElement));
  });

  await etapa('Configurações: abas por teclado e proteção de alterações', async () => {
    await abrir('configuracoes');
    await page.locator('[data-aba="regras"]').focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('[data-aba="conta"]').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    await page.locator('#cfg-empresa').fill('Alteração local de teste');
    await page.locator('[data-rota="resumo"]').click();
    await page.locator('[data-dialogo="1"]').getByRole('button', { name: 'Continuar editando' }).click();
    assert(new URL(page.url()).pathname === '/configuracoes');
    assert.equal(await page.locator('#cfg-empresa').inputValue(), 'Alteração local de teste');
    await page.locator('[data-rota="resumo"]').click();
    await page.locator('[data-dialogo="1"]').getByRole('button', { name: 'Sair sem salvar', exact: true }).click();
    await page.waitForURL('**/resumo');
  });

  await etapa('Busca de colaboradores mantém a resposta do filtro mais recente', async () => {
    await abrir('colaboradores');
    await page.route('**/api/pessoas?**', async (rota) => {
      const url = new URL(rota.request().url());
      if (url.searchParams.get('busca') === 'Ricardo') await new Promise((resolve) => setTimeout(resolve, 500));
      await rota.continue();
    });
    const pedidoAntigo = page.waitForRequest((req) => req.url().includes('busca=Ricardo'));
    const respostaAntiga = page.waitForResponse((res) => res.url().includes('busca=Ricardo'));
    await page.locator('#campo-busca').fill('Ricardo');
    await pedidoAntigo;
    const respostaNova = page.waitForResponse((res) => res.url().includes('busca=Juliana'));
    await page.locator('#campo-busca').fill('Juliana');
    await Promise.all([respostaAntiga, respostaNova]);
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => document.querySelectorAll('#lista-colaboradores tr').length === 1 && document.getElementById('lista-colaboradores').textContent.includes('Juliana'));
    assert(!(await page.locator('#lista-colaboradores').textContent()).includes('Ricardo'));
    await page.unrouteAll({ behavior: 'wait' });
  });

  assert.deepEqual(erros, [], 'Erros de JavaScript no navegador');
  fs.writeFileSync(path.join(artifacts, 'resultado.json'), JSON.stringify({ grupos: resultados, auditorias, erros }, null, 2));
  console.log(`${resultados.length} grupos aprovados; ${auditorias.length} estados sem violações automatizadas`);
})().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (servidor) { servidor.kill(); await new Promise((resolve) => servidor.once('exit', resolve)); }
  fs.rmSync(pasta, { recursive: true, force: true });
});
