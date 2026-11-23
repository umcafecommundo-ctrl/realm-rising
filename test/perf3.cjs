const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  await page.goto('http://localhost:8080/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const R = g.r; const out = {};
    R.cam.z = 1.0; R.clampCam(); R.focus(32 * 32, 26 * 32);
    const cvs = R.cv; const ctx = R.ctx;
    const bench = (label) => { ctx.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < 30; i++) { R.render(g.s, 0.016); } ctx.getImageData(0, 0, 1, 1); out[label] = +((performance.now() - t0) / 30).toFixed(1); };
    bench('all');
    const save = {}; for (const n of ['drawTerrain', 'drawEntities', 'drawLighting', 'drawWeather', 'drawGround']) { save[n] = R[n]; }
    for (const n of Object.keys(save)) { R[n] = () => { }; bench('no_' + n); R[n] = save[n]; }
    const m = R.macro; R.macro = document.createElement('canvas'); R.macro.width = 1; R.macro.height = 1; bench('no_macro'); R.macro = m;
    return out;
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
