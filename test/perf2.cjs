const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  await page.goto('http://localhost:8080/' + (process.argv[2] || '')); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  const res = await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const R = g.r; const out = {}; if (window.location.hash === '#nomacro') { R.macro = document.createElement('canvas'); R.macro.width = 1; R.macro.height = 1; }
    R.cam.z = 1.0; R.clampCam(); R.focus(32 * 32, 26 * 32);
    for (const name of ['drawTerrain', 'drawGround', 'drawEntities', 'drawParticles', 'drawLighting', 'drawWeather', 'drawFloats']) {
      const orig = R[name].bind(R); let tot = 0, n = 0;
      R[name] = (...a) => { const t = performance.now(); const r = orig(...a); tot += performance.now() - t; n++; out[name] = +(tot / n).toFixed(2); return r; };
    }
    const t0 = performance.now(); for (let i = 0; i < 40; i++) R.render(g.s, 0.016); out.total = +((performance.now() - t0) / 40).toFixed(1);
    return out;
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
