// Muralhas, estradas e inspetor de construção (visual + erros).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const sim = await import('/js/sim.js'); const st = await import('/js/state.js'); const core = await import('/js/core.js');
    const s = g.s; s.era = 4; for (const t of ['masonry', 'engineering', 'metallurgy', 'military']) s.tech.done[t] = true;
    for (const r in s.res) s.res[r] = 500;
    for (let i = 0; i < 10; i++) core.addPerson(s, {});
    for (let x = 26; x <= 38; x++) st.addBuilding(s, 'wall', x, 30, true);
    for (let y = 22; y <= 30; y++) st.addBuilding(s, 'wall', 26, y, true);
    for (let y = 22; y <= 30; y++) st.addBuilding(s, 'wall', 38, y, true);
    for (let x = 26; x <= 38; x++) if (x !== 32) st.addBuilding(s, 'wall', x, 22, true);
    for (let y = 23; y <= 29; y++) st.addBuilding(s, 'road', 32, y, true);
    st.addBuilding(s, 'castle', 29, 15, true); st.addBuilding(s, 'barracks', 22, 24, true); st.addBuilding(s, 'smithy', 40, 24, true);
    const w = sim.placeBuilding(s, 'wall', 40, 30);
    sim.refresh(s); g.fast(5);
    g.r.focus(32 * 32, 25 * 32, 1.5);
    g.ui.select({ kind: 'building', id: s.buildings.find(b => b.type === 'smithy').id });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/walls.png' });
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
