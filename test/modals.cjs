const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop'; const out = process.argv[3] || '/tmp/o';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1100, height: 700 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); else if (m.text().startsWith('ERASTATUS')) console.log(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js');
    const s = g.s; s.era = 2; s.tech.done.stone_tools = true;
    for (let i = 0; i < 6; i++) core.addPerson(s, { age: 25 });
    for (const [t, x, y] of [['shelter', 28, 20], ['shelter', 36, 21]]) { const b = sim.placeBuilding(s, t, x, y); if (b) { b.done = true; b.prog = 1; } }
    s.res.wood = 150; s.res.stone = 80; s.res.food = 120; s.res.planks = 80;
    sim.refresh(s);
  });
  await page.click('#res-bar [data-era]'); await page.waitForTimeout(400);
  await page.screenshot({ path: out + '-erastatus.png' });
  await page.evaluate(() => { const g = window.__game; document.querySelector('.modal-back [data-x]').click(); });
  await page.evaluate(async () => { const sim = await import('/js/sim.js'); const g = window.__game; const s = g.s; const st0 = await import('/js/state.js'); let off = 0; const put = (t, x, y) => st0.addBuilding(s, t, 20 + (off++ % 6) * 5, 30 + Math.floor(off / 6) * 3, true); for (const [t, x, y] of [['house', 26, 24], ['house', 36, 25], ['house', 30, 27], ['house', 24, 18], ['house', 38, 17]]) put(t, x, y); s.res.wood = 200; s.res.stone = 200; s.res.food = 200; s.res.planks = 100; for (const t of ['sawmill', 'storehouse']) put(t, t === 'sawmill' ? 40 : 22, 30); s.tech.done.agriculture = true; for (let i = 0; i < 8; i++) (await import('/js/core.js')).addPerson(s, {}); sim.refresh(s); const st = sim.eraStatus(s); console.log('ERASTATUS ' + JSON.stringify(st.checks) + st.costOk); sim.advanceEra(s); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '-era.png' });
  console.log('era', await page.evaluate(() => window.__game.s.era));
  await page.click('.modal [data-done]'); await page.waitForTimeout(300);
  // batalha
  await page.evaluate(async () => {
    const g = window.__game; const s = g.s; s.era = 4;
    const war = await import('/js/war.js'); const core = await import('/js/core.js');
    for (let i = 0; i < 10; i++) { const p = core.addPerson(s, { age: 25 }); p.job = 'soldado'; p.unit = ['spear', 'archer', 'knight'][i % 3]; }
    s.threats.push({ id: 1, kind: 'bandits', power: 30, label: 'Bandidos', at: s.t + 0.5 });
    g.fast(2);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '-battle.png' });
  await page.waitForTimeout(8500);
  await page.screenshot({ path: out + '-battle2.png' });
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
