// Captura de tela e verificação de erros no navegador headless
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop';
  const out = process.argv[3] || '/tmp/shot';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '-1.png' });
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
