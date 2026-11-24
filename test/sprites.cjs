// Folha de sprites: desenha todas as construções (e árvores/pedras) numa grade para revisão visual.
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '/tmp/sp'; const season = +(process.argv[3] || 1);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 1300 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + (e.stack || '').split('\n').slice(0, 3).join('|')));
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(800);
  await page.evaluate(async (season) => {
    const art = await import('/js/art_b.js'); const data = await import('/js/data.js');
    document.body.innerHTML = ''; const c = document.createElement('canvas'); c.width = 1500; c.height = 1300; document.body.appendChild(c); document.body.style.background = '#6db84a';
    const x = c.getContext('2d'); x.fillStyle = '#7cc156'; x.fillRect(0, 0, 1500, 1000);
    let px = 10, py = 10, rowH = 0;
    for (const t of Object.keys(data.BUILDINGS)) {
      if (['wall', 'road'].includes(t)) continue;
      const sp = art.buildingSprite(t, season);
      const w = sp.c.width / 2, h = sp.c.height / 2;
      if (px + w > 1490) { px = 10; py += rowH + 16; rowH = 0; }
      x.drawImage(sp.c, px, py, w, h);
      x.fillStyle = '#fff'; x.font = '11px sans-serif'; x.fillText(t, px + 4, py + h + 11);
      px += w + 14; rowH = Math.max(rowH, h + 8);
    }
  }, season);
  await page.screenshot({ path: out + '.png' });
  console.log('ERRS', errs);
  await browser.close();
})();
