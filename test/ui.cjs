// Teste de UI: monta um reino avançado (trapaça) e fotografa painéis/modais em desktop ou mobile.
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop';
  const out = process.argv[3] || '/tmp/u';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide();
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js'); const data = await import('/js/data.js'); const W = await import('/js/world.js');
    const s = g.s; s.era = 4; for (const t of ['stone_tools', 'basketry', 'hunting', 'agriculture', 'masonry', 'cartography', 'commerce', 'metallurgy', 'military', 'writing']) s.tech.done[t] = true;
    s.flags.worldUnlocked = true; s.flags.ore = true; W.initWorld(s);
    for (const r in s.res) s.res[r] = 150;
    for (let i = 0; i < 26; i++) core.addPerson(s, { age: 20 + i % 25 });
    const want = [['house', 26, 20], ['house', 30, 19], ['house', 36, 20], ['farm', 20, 24], ['well', 40, 26], ['sawmill', 38, 30], ['storehouse', 29, 31], ['market', 22, 18], ['smithy', 43, 22], ['tavern', 33, 14], ['barracks', 25, 29], ['gatherpoint', 36, 25], ['loom', 31, 35], ['mine', 16, 29], ['castle', 46, 28], ['cathedral', 17, 20]];
    for (const [t, x, y] of want) { const b = sim.placeBuilding(s, t, x, y); if (b && t !== 'castle') { b.done = true; b.prog = 1; } }
    for (let i = 0; i < 6; i++) sim.placeBuilding(s, 'wall', 34 + i, 33);
    sim.refresh(s); sim.adjustJob(s, 'soldado', 1); sim.adjustJob(s, 'soldado', 1);
    for (const [j, n] of [['lenhador', 4], ['pedreiro', 3], ['agricultor', 3], ['coletor', 2], ['construtor', 2], ['cacador', 1], ['comerciante', 2], ['ferreiro', 2]]) for (let i = 0; i < n; i++) sim.adjustJob(s, j, 1);
    s.world.tiles.forEach(t => { if (Math.hypot(t.x - 2, t.y - 6) < 6) t.rev = true; }); s.world.kingdoms[0].known = true;
    g.fast(30);
    g.s.t = Math.floor(g.s.t / 100) * 100 + 40;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '-main.png' });
  for (const tab of ['build', 'people', 'jobs', 'policy', 'tech', 'world', 'chronicle', 'achv']) {
    await page.click('#tab-' + tab); await page.waitForTimeout(450);
    await page.screenshot({ path: `${out}-${tab}.png` });
  }
  await page.evaluate(async () => { window.__game.ui.closePanel(); const ev = await import('/js/events.js'); const g = window.__game; const inst = ev.makeInstance(g.s, 'merchant'); g.s.ev.pending.push(inst); g.ui.pumpEvents(); });
  await page.waitForTimeout(500); await page.screenshot({ path: out + '-event.png' });
  await page.evaluate(() => window.__game.ui.closeModal && 0);
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
