const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + (e.stack || '').split('\n').slice(0, 3).join('|'))); page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(500); await page.goto('http://localhost:8080/nada');
  const save = JSON.parse(fs.readFileSync('/tmp/city.json', 'utf8')); save.tut.done = true; save.lastSaved = Date.now();
  await page.evaluate(s => localStorage.setItem('realm-rising-save-v1', JSON.stringify(s)), save);
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(1800);
  await page.evaluate(() => { const g = window.__game; g.r.focus(32 * 32, 26 * 32, 0.75); g.fast(10); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/city.png' });
  const info = await page.evaluate(() => ({ pop: window.__game.s.people.length, b: window.__game.s.buildings.length, bak: !!localStorage.getItem('realm-rising-save-v1-bak') }));
  console.log(JSON.stringify(info), 'ERRS', JSON.stringify(errs));
  await browser.close();
})();
