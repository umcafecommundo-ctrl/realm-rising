// Menu (compartilhar/ranking/som), fé, líder, mapa maior, desafios da semana.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8080/'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; const s = g.s; s.tut.done = true; g.tut.hide(); s.ev.cooldownUntil = 1e9;
    const sim = await import('/js/sim.js'); const core = await import('/js/core.js'); const st = await import('/js/state.js'); const W = await import('/js/world.js'); const data = await import('/js/data.js');
    s.era = 5; for (const t of Object.keys(data.TECHS)) s.tech.done[t] = true; s.flags.worldUnlocked = true; s.flags.ore = true; W.initWorld(s);
    for (const r in s.res) s.res[r] = 800; for (let i = 0; i < 40; i++) core.addPerson(s, { age: 20 + i % 30 });
    let o = 0; for (const t of ['house', 'temple', 'farm', 'port', 'library', 'barracks', 'market']) { st.addBuilding(s, t, 12 + (o % 5) * 7, 8 + Math.floor(o / 5) * 7, true); o++; }
    sim.refresh(s); s.world.tiles.forEach(t => { if (Math.hypot(t.x - 3, t.y - 8) < 9) t.rev = true; }); s.world.kingdoms.forEach(k => { k.known = true; });
    sim.ensureLeader(s, false); sim.chooseFaith(s, 'natureza'); s.faith.pts = 330; sim.refresh(s);
    g.fast(5);
  });
  const shot = n => page.screenshot({ path: '/tmp/x-' + n + '.png' });
  await page.click('#tab-people'); await page.waitForTimeout(400); await shot('people');
  await page.click('#tab-policy'); await page.waitForTimeout(400); await page.evaluate(() => { document.querySelector('.sh-body').scrollTop = 9999; }); await page.waitForTimeout(200); await shot('policy');
  await page.click('#tab-world'); await page.waitForTimeout(500); await shot('world');
  await page.click('#tab-achv'); await page.waitForTimeout(400); await shot('achv');
  await page.click('#btn-sound'); await page.waitForTimeout(200);
  await page.click('#btn-menu'); await page.waitForTimeout(300); await shot('menu');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('[data-m="share"]')]);
  console.log('download', dl ? dl.suggestedFilename() : 'none');
  await page.click('[data-m="rank"]'); await page.waitForTimeout(300); await shot('rank');
  console.log('leader', await page.evaluate(() => { const s = window.__game.s; const l = s.people.find(p => p.leader); return l && [l.name, l.traits]; }), 'faith', await page.evaluate(() => window.__game.s.faith), 'audio', await page.evaluate(async () => { const a = await import('/js/audio.js'); return !!a.Sound.ctx; }));
  console.log('ERRS', JSON.stringify(errs));
  await browser.close();
})();
