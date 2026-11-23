// Cenário de jogo guiado no navegador headless: constrói, avança o tempo e tira screenshots
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop';
  const out = process.argv[3] || '/tmp/p';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide();
    const sim = await import('/js/sim.js');
    g.s.res.wood = 200; g.s.res.stone = 60; g.s.res.food = 80;
    sim.placeBuilding(g.s, 'shelter', 27, 21); sim.placeBuilding(g.s, 'shelter', 36, 22); sim.placeBuilding(g.s, 'gatherpoint', 30, 31);
    g.fast(40);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '-a.png' });
  // acelera para ver construções prontas, noite
  await page.evaluate(() => { const g = window.__game; g.fast(60); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '-b.png' });
  await page.evaluate(() => { const g = window.__game; g.s.t = Math.floor(g.s.t / 100) * 100 + 83; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '-c.png' });
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
