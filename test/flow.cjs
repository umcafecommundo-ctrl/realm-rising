// Fluxo real de jogador: tutorial com cliques, construção por clique, offline, era e batalha.
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop';
  const out = process.argv[3] || '/tmp/f';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1300);
  const stepId = () => page.evaluate(() => window.__game.s.tut.step);
  const click = async sel => { await page.click(sel, { timeout: 3000 }); await page.waitForTimeout(250); };
  // tutorial: welcome → camera
  console.log('step0', await stepId());
  await click('.tut-box [data-t="next"]');
  console.log('step1', await stepId());
  // mover câmera arrastando
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(480, 380, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  console.log('after drag', await stepId());
  await page.screenshot({ path: out + '-1.png' });
  await click('.tut-box [data-t="next"]'); await click('.tut-box [data-t="next"]'); await click('.tut-box [data-t="next"]');
  console.log('step gather?', await stepId());
  await page.evaluate(() => { window.__game.s.speed = 3; window.__game.fast(180); });
  await page.waitForTimeout(500);
  console.log('after wood', await stepId(), await page.evaluate(() => Math.round(window.__game.s.res.wood)));
  await page.screenshot({ path: out + '-2.png' });
  await click('#tab-build');
  console.log('after open build', await stepId());
  await click('[data-act="build:shelter"]');
  console.log('after pick', await stepId(), await page.evaluate(() => !!window.__game.ui.build));
  // clique no mapa para construir (desktop) ou toque + confirmar (mobile)
  await page.mouse.move(mode === 'mobile' ? 195 : 560, mode === 'mobile' ? 450 : 330);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '-3.png' });
  if (mode === 'mobile') { await page.touchscreen.tap(195, 450); await page.waitForTimeout(200); await click('[data-b="ok"]'); }
  else await page.mouse.click(560, 330);
  await page.waitForTimeout(300);
  console.log('shelters', await page.evaluate(() => window.__game.s.buildings.filter(b => b.type === 'shelter').length), 'step', await stepId());
  await page.evaluate(() => { window.__game.fast(40); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '-4.png' });
  await page.evaluate(() => { window.__game.fast(80); });
  console.log('done?', await page.evaluate(() => window.__game.s.buildings.filter(b => b.type === 'shelter' && b.done).length), 'step', await stepId());
  await page.screenshot({ path: out + '-5.png' });
  // offline: salva, sai (página 404 da mesma origem) e volta 3h depois
  await page.evaluate(() => window.__game.saveNow());
  await page.goto('http://localhost:8080/nada');
  await page.evaluate(() => { const k = 'realm-rising-save-v1'; const s = JSON.parse(localStorage.getItem(k)); s.lastSaved = Date.now() - 3 * 3600 * 1000; s.tut.done = true; s.res.food = 40; localStorage.setItem(k, JSON.stringify(s)); });
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: out + '-6-offline.png' });
  console.log('modal?', await page.evaluate(() => document.querySelectorAll('.modal').length));
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
