// Close-ups: lenhador cortando, obra em andamento (andaime) e personagens de perto.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '/tmp/cu';
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
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js');
    const s = g.s; s.res.wood = 80; s.res.stone = 30;
    for (let i = 0; i < 4; i++) core.addPerson(s, { age: 25 });
    sim.adjustJob(s, 'lenhador', 1); sim.adjustJob(s, 'lenhador', 1); sim.adjustJob(s, 'construtor', 1); sim.adjustJob(s, 'construtor', 1);
    sim.placeBuilding(s, 'shelter', 27, 21);
    sim.refresh(s); g.s.speed = 1;
  });
  // acompanha um lenhador até vê-lo cortando
  let shots = 0;
  for (let i = 0; i < 40 && shots < 3; i++) {
    await page.evaluate(() => window.__game.fast(2));
    const st = await page.evaluate(() => {
      const g = window.__game; const p = g.s.people.find(q => q.job === 'lenhador' && q.rt.anim === 'chop'); if (p) { g.r.focus(p.x, p.y - 10, 3.2); return 'chop'; }
      const b = g.s.buildings.find(q => !q.done); const q = g.s.people.find(x => x.job === 'construtor' && x.rt.anim === 'hammer'); if (q && b) { g.r.focus((b.x + b.w / 2) * 32, (b.y + b.h / 2) * 32, 3.0); return 'hammer'; }
      return null;
    });
    if (st && (shots === 0 && st === 'chop' || shots === 1 && st === 'hammer' || shots === 2)) { await page.waitForTimeout(250); await page.screenshot({ path: out + '-' + shots + '-' + st + '.png' }); shots++; }
  }
  console.log('shots', shots, 'ERRS', JSON.stringify(errs));
  await browser.close();
})();
