const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const base='http://localhost:3001/';
  await p.goto(base+'index.html'); await p.fill('#usuario','admin'); await p.fill('#senha','admin123');
  await Promise.all([p.waitForURL(/resumo/), p.click('#botao-entrar')]);
  await p.goto(base+'configuracoes.html'); await p.waitForTimeout(1200);
  for (const a of ['alertas','usuarios','banco']) { await p.click(`[data-aba="${a}"]`); await p.waitForTimeout(900); await p.screenshot({path:`shots/cfg_${a}.png`}); }
  await p.goto(base+'colaboradores.html'); await p.waitForTimeout(1200);
  await p.click('#botao-novo-colaborador'); await p.waitForTimeout(800); await p.screenshot({path:'shots/colab_modal.png'});
  await p.keyboard.press('Escape'); await p.reload(); await p.waitForTimeout(1200);
  await p.locator('button:has-text("Histórico")').nth(2).click(); await p.waitForTimeout(1500); await p.screenshot({path:'shots/colab_historico.png'});
  await b.close();})();
