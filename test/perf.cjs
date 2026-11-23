const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  await page.goto('http://localhost:8080/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const core = await import('/js/core.js'); const sim = await import('/js/sim.js');
    for (let i = 0; i < 60; i++) core.addPerson(g.s, { age: 25 });
    sim.refresh(g.s);
    const out = {};
    for (const z of [1.6, 1.0, 0.6]) {
      g.r.cam.z = z; g.r.clampCam(); g.r.focus(32 * 32, 26 * 32);
      const t0 = performance.now(); let n = 0;
      for (let i = 0; i < 30; i++) { g.r.render(g.s, 0.016); n++; }
      const r = (performance.now() - t0) / n;
      const t1 = performance.now(); for (let i = 0; i < 30; i++) sim.tick(g.s, 0.016); out['z' + z] = { render_ms: +r.toFixed(1), sim_ms: +((performance.now() - t1) / 30).toFixed(2) };
    }
    out.nodes = g.s.nodes.length; out.people = g.s.people.length;
    return out;
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
