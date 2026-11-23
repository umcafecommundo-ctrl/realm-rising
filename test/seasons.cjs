const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '/tmp/s';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide();
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js');
    const s = g.s; s.era = 3; for (const t of ['stone_tools', 'basketry', 'agriculture', 'masonry']) s.tech.done[t] = true;
    for (const r in s.res) s.res[r] = 100;
    for (let i = 0; i < 14; i++) core.addPerson(s, { age: 20 + i });
    for (const [t, x, y] of [['house', 26, 21], ['house', 36, 21], ['farm', 24, 28], ['sawmill', 38, 28], ['well', 29, 29], ['storehouse', 33, 30], ['shelter', 28, 18], ['wall', 33, 17], ['wall', 34, 17], ['wall', 35, 17]]) { const b = sim.placeBuilding(s, t, x, y); if (b) { b.done = true; b.prog = 1; } }
    sim.refresh(s); s.ev.cooldownUntil = 1e9; g.fast(20);
    g.r.focus(32 * 32, 25 * 32, 1.6); g.ui.select(null);
  });
  const set = (day, hour, weather) => page.evaluate(([d, h, w]) => { const g = window.__game; g.s.t = d * 100 + h / 24 * 100; g.s.weather = { type: w, until: g.s.t + 1e6, intensity: 0.9 }; g.fast(3); }, [day, hour, weather]);
  const shots = [['summer', 7 + 12 - 12 + 6 * 1, 13, 'clear'], ['autumn', 13, 14, 'clear'], ['winter', 19, 13, 'snow'], ['rain', 3, 13, 'rain'], ['storm', 3, 15, 'storm'], ['night', 3, 22.5, 'clear'], ['dusk', 3, 18.6, 'clear']];
  for (const [name, day, hour, w] of shots) { await set(day, hour, w); await page.waitForTimeout(900); await page.screenshot({ path: `${out}-${name}.png` }); }
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
