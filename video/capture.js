const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const base = 'http://localhost:3001/';
  await p.goto(base + 'index.html'); await p.waitForTimeout(800);
  await p.screenshot({ path: 'shots/login.png' });
  await p.fill('#usuario', 'admin'); await p.fill('#senha', 'admin123');
  await Promise.all([p.waitForURL(/resumo/), p.click('#botao-entrar')]);
  for (const [n, f] of [['resumo','resumo.html'],['colaboradores','colaboradores.html'],['configuracoes','configuracoes.html'],['cadastro','cadastro.html']]) {
    const q = await ctx.newPage(); await q.goto(base + f); await q.waitForTimeout(1800);
    await q.screenshot({ path: `shots/${n}.png` }); console.log(n, q.url()); await q.close();
  }
  await b.close();
})();
