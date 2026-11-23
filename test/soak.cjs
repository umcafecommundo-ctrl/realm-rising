// Soak test no navegador: um bot joga dezenas de "dias" com renderização real entre os saltos, para achar erros de desenho/UI.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 640 } })).newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  await page.goto('http://localhost:8080/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const g = window.__game; g.s.tut.done = true; g.tut.hide();
    const sim = await import('/js/sim.js'); const st = await import('/js/state.js'); const data = await import('/js/data.js'); const core = await import('/js/core.js');
    const ev = await import('/js/events.js'); const war = await import('/js/war.js');
    window.__bot = () => {
      const s = g.s; const have = t => s.buildings.filter(b => b.type === t).length;
      const spot = type => { const d = data.BUILDINGS[type]; for (let r = 3; r < 24; r++) for (let k = 0; k < 32; k++) { const a = k / 32 * 6.283 + r, x = Math.round(32 + Math.cos(a) * r - d.w / 2), y = Math.round(26 + Math.sin(a) * r * 0.8 - d.h / 2); if (sim.canPlace(s, type, x, y).ok) return [x, y]; } return null; };
      const want = (type, n) => { if (!st.unlocked(s, type) || have(type) >= n || s.buildings.filter(b => !b.done).length >= 3) return; const sp = spot(type); if (sp) sim.placeBuilding(s, type, sp[0], sp[1]); };
      const pop = s.people.length, beds = s._d.beds;
      if (beds - pop < 3) want(s.era >= 2 ? 'house' : 'shelter', have('house') + have('shelter') + 1);
      want('gatherpoint', 1);
      if (s.era >= 2) { want('farm', Math.floor(pop / 9) + 1); want('well', 1); want('sawmill', 1); want('storehouse', 1 + Math.floor(pop / 22)); }
      if (s.era >= 3) for (const t of ['market', 'smithy', 'tavern', 'loom', 'mine', 'barracks']) want(t, 1);
      if (s.era >= 4) for (const t of ['castle', 'cathedral', 'academy', 'jeweler', 'port']) want(t, 1);
      if (s.era >= 5) { want('monument', 1); want('wonder', 1); }
      const N = core.adultsOf(s).length; const c = sim.jobCounts(s); const farms = s.buildings.filter(b => b.type === 'farm' && b.done).length;
      const tgt = { construtor: Math.max(1, Math.round(N * 0.12)), lenhador: Math.round(N * 0.28), agricultor: farms * 2, coletor: Math.round(N * 0.15), pedreiro: Math.round(N * 0.14), cacador: N > 6 ? 1 : 0 };
      if (s.era >= 3) { tgt.ferreiro = have('smithy') * 2; tgt.comerciante = have('market') * 2; }
      if (st.hasTech(s, 'military')) tgt.soldado = Math.min(s._d.soldierCap, Math.round(N * 0.12));
      for (const j in tgt) for (let i = 0; i < 10 && (c[j] || 0) < tgt[j]; i++) { if (!sim.adjustJob(s, j, 1)) break; c[j] = (c[j] || 0) + 1; }
      if (!s.tech.current) { const av = Object.keys(data.TECHS).filter(id => sim.techAvailable(s, id)).sort((a, b) => data.TECHS[a].cost - data.TECHS[b].cost); if (av.length) sim.startResearch(s, av[0]); }
      if (sim.eraStatus(s)?.ready) sim.advanceEra(s);
      if (s.era >= 3 && st.countB(s, 'barracks')) war.trainEnqueue(s, 'spear');
    };
  });
  let lastEra = 0, modalsResolved = 0;
  for (let i = 0; i < 260; i++) {
    await page.evaluate(() => { window.__bot(); window.__game.s.speed = 1; window.__game.fast(25); });
    await page.waitForTimeout(60);
    // resolve modais de evento/era/batalha como um jogador faria
    for (let k = 0; k < 4; k++) {
      const opt = await page.$('.modal .opt:not(.dis)');
      if (opt) { await opt.click({ force: true }).catch(() => { }); modalsResolved++; await page.waitForTimeout(40); }
      const done = await page.$('.modal [data-done]');
      if (done) { await done.click({ force: true }).catch(() => { }); await page.waitForTimeout(40); }
      const skip = await page.$('#battle-skip');
      if (skip) { await skip.click({ force: true }).catch(() => { }); await page.waitForTimeout(40); }
    }
    const info = await page.evaluate(() => { const s = window.__game.s; return { day: Math.floor(s.t / 100), era: s.era, pop: s.people.length, b: s.buildings.length, paused: s.paused, modals: window.__game.ui.modals.length }; });
    if (info.era !== lastEra) { lastEra = info.era; console.log('era', info.era, 'dia', info.day, 'pop', info.pop, 'prédios', info.b); await page.screenshot({ path: '/tmp/soak-era' + info.era + '.png' }); }
    if (i % 65 === 0) console.log(JSON.stringify(info));
  }
  const final = await page.evaluate(() => { const s = window.__game.s; return { day: Math.floor(s.t / 100), era: s.era, pop: s.people.length, b: s.buildings.length, won: s.stats.battlesWon, lost: s.stats.battlesLost, techs: Object.keys(s.tech.done).length }; });
  console.log('FINAL', JSON.stringify(final), 'modais resolvidos', modalsResolved);
  await page.screenshot({ path: '/tmp/soak-final.png' });
  console.log('ERRS', JSON.stringify(errs, null, 1));
  await browser.close();
})();
