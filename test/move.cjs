// Inspetor: evoluir abrigo → casa, mover construção e "Organizar reino".
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  const out = await page.evaluate(async () => {
    const g = window.__game; const s = g.s; g.s.tut.done = true; g.tut.hide(); s.ev.cooldownUntil = 1e9;
    s.policies.autoBuild = false; s.policies.autoEvents = false;
    const sim = await import('/js/sim.js'); const st = await import('/js/state.js');
    s.era = 2; s.res.wood = 300; s.res.stone = 100;
    const a = st.addBuilding(s, 'shelter', 27, 21, true); const h = st.addBuilding(s, 'sawmill', 20, 36, true);
    sim.refresh(s); g.r.focus(30 * 32, 26 * 32, 1.4);
    g.ui.select({ kind: 'building', id: a.id });
    return { a: a.id, h: h.id };
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/mv-1.png' });
  await page.click('#inspector [data-i="upgrade"]');
  await page.waitForTimeout(300);
  console.log('after upgrade', await page.evaluate(() => { const b = window.__game.s.buildings.find(x => x.upgraded); return b && { t: b.type, done: b.done }; }));
  // mover a serraria
  await page.evaluate(id => window.__game.ui.select({ kind: 'building', id }), out.h);
  await page.waitForTimeout(200);
  await page.click('#inspector [data-i="move"]');
  await page.waitForTimeout(200);
  await page.mouse.move(700, 450); await page.waitForTimeout(150);
  await page.screenshot({ path: '/tmp/mv-2.png' });
  await page.mouse.click(700, 450);
  await page.waitForTimeout(300);
  console.log('moved', await page.evaluate(id => { const b = window.__game.s.buildings.find(x => x.id === id); return { x: b.x, y: b.y, pinned: b.pinned }; }, out.h));
  await page.click('#tab-build'); await page.waitForTimeout(250);
  await page.click('[data-act="organize"]'); await page.waitForTimeout(300);
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
