// Clica em (quase) tudo da UI num reino avançado e verifica se algum handler lança erro.
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'desktop';
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mode === 'mobile' ? { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide(); g.s.ev.cooldownUntil = 1e9;
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js'); const W = await import('/js/world.js'); const st = await import('/js/state.js');
    const data = await import('/js/data.js');
    const s = g.s; s.era = 5;
    for (const t of Object.keys(data.TECHS)) s.tech.done[t] = true;
    s.flags.worldUnlocked = true; s.flags.ore = true; W.initWorld(s);
    for (const r in s.res) s.res[r] = 3000;
    for (let i = 0; i < 30; i++) core.addPerson(s, { age: 20 + i });
    let off = 0;
    for (const t of ['house', 'house', 'farm', 'well', 'sawmill', 'storehouse', 'market', 'smithy', 'tavern', 'barracks', 'loom', 'mine', 'academy', 'port', 'jeweler']) {
      st.addBuilding(s, t, 12 + (off % 7) * 6, 8 + Math.floor(off / 7) * 6, true); off++;
    }
    sim.refresh(s);
    s.world.tiles.forEach(t => { t.rev = true; });
    s.world.kingdoms.forEach(k => { k.known = true; });
    for (const j of ['soldado', 'soldado', 'soldado', 'ferreiro', 'sabio']) sim.adjustJob(s, j, 1);
  });
  const clickAll = async (sel, max) => {
    const els = await page.$$(sel);
    let n = 0;
    for (const el of els.slice(0, max || 40)) {
      try { await el.click({ timeout: 800, force: true }); n++; } catch (e) { /* ignora */ }
      await page.waitForTimeout(30);
    }
    return n;
  };
  const sels = { build: '#sheet [data-act^="cat:"]', people: '#sheet [data-act^="sel:"]', jobs: '#sheet [data-act^="job"]', policy: '#sheet [data-act]', tech: '#sheet [data-act^="tech"]', chronicle: '#sheet [data-act^="chr:"]', achv: '#sheet [data-act="help"]' };
  for (const tab of ['build', 'people', 'jobs', 'policy', 'tech', 'chronicle', 'achv', 'world']) {
    await page.click('#tab-' + tab, { force: true });
    await page.waitForTimeout(250);
    if (tab === 'world') {
      for (const sub of ['k', 'army', 'trade', 'map']) {
        await page.click('[data-w="sub:' + sub + '"]', { force: true });
        await page.waitForTimeout(200);
        await clickAll('#sheet [data-w]', 25);
      }
      continue;
    }
    console.log(tab, await clickAll(sels[tab], 40));
    await page.waitForTimeout(100);
  }
  // construir clicando nas construções
  await page.click('#tab-build', { force: true });
  await page.waitForTimeout(150);
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#sheet [data-act^="build:"]')).map(e => e.dataset.act));
  console.log('build buttons', ids.length);
  for (const a of ids.slice(0, 8)) {
    await page.evaluate(() => { window.__game.ui.closePanel(); });
    await page.click('#tab-build', { force: true });
    await page.waitForTimeout(100);
    const b = await page.$('#sheet [data-act="' + a + '"]');
    if (b) {
      await b.click({ force: true });
      await page.mouse.move(640, 380); await page.waitForTimeout(80);
      await page.mouse.click(640, 380); await page.waitForTimeout(60);
      await page.keyboard.press('Escape');
    }
  }
  for (const [x, y] of [[640, 380], [500, 300], [700, 450], [400, 500], [800, 250]]) {
    await page.mouse.click(x, y); await page.waitForTimeout(100);
    await clickAll('#inspector [data-i]', 6);
  }
  await page.evaluate(() => window.__game.fast(120));
  await page.click('#btn-menu'); await page.waitForTimeout(200);
  await page.click('[data-m="help"]'); await page.waitForTimeout(200);
  await page.click('.modal [data-done]');
  await page.click('#res-bar [data-era]'); await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/c-era.png' });
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
