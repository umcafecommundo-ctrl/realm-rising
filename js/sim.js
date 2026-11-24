// sim.js — núcleo da simulação: relógio, estações, clima, necessidades, produção, população, API de ações
// Funciona em modo "ao vivo" (com movimento e tarefas — ai.js) e em modo "offline" (modelo abstrato, mesmas taxas).

import { DAY_LEN, YEAR_DAYS, SEASON_DAYS, TILE, MAP_W, MAP_H, BUILDINGS, RES, RES_ORDER, ERAS, TECHS, JOBS, JOB_ORDER, OUT_RATE, ADULT_AGE, ELDER_AGE, AGE_DAYS_PER_YEAR, OFFLINE_EFF, FESTIVAL, POLICIES, UNITS } from './data.js';
import { timeInfo, isNight, recalc, bdef, countB, techFx, hasTech, eraRadius, unlocked, jobUnlocked, CENTER, isWater, rebuildBlocked, makePerson } from './state.js';
import { bus, addRes, spend, canAfford, chron, toast, floatText, adultsOf, dailyConsumption, foodDays, waterDays, avgJoy, killPerson, addPerson, defensePower, globalMult, personMult, gainSkill, soldiersOf, capOf } from './core.js';
import { updatePerson, updateAnimals, eatNow, autoJob } from './ai.js';
import { autoBuild, findSlot, tidyOne, eraDeficits } from './planner.js';
import { rollEvent, resolveAuto, makeInstance } from './events.js';
import { worldDaily, worldSlow, initWorld, autoWorld } from './world.js';
import { warDaily, resolveThreat, trainTick, marchTick, autoMilitary, autoConquer } from './war.js';
import { checkQuests, checkAchievements } from './quests.js';
import { clamp, rnd, rint, chance, pick, hash2, randName } from './util.js';

// ---------- Atualização principal ----------
/** Avança o jogo `realDt` segundos reais (já multiplicados pela velocidade). */
export function tick(s, realDt) {
  if (s.paused) return;
  let dt = realDt * s.speed;
  while (dt > 0) { const d = Math.min(dt, 0.25); step(s, d, false); dt -= d; }
}

export function refresh(s) {
  recalc(s);
  // pontos de entrega
  s._drops = [];
  for (const b of s.buildings) {
    if (!b.done) continue;
    if (b.type === 'campfire' || b.type === 'gatherpoint' || b.type === 'storehouse' || b.type === 'castle' || b.type === 'port')
      s._drops.push({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h) * TILE + 10 });
  }
  assignWorkplaces(s);
  assignHomes(s);
}

export function ensureRuntime(s) {
  s._animals ||= [];
  s._flow ||= {};
  s._acc ||= 0;
  s._workMult ||= 1;
  refresh(s);
  calcHappiness(s, timeInfo(s));
  if (s.flags.worldUnlocked && !s.world) initWorld(s);
}

export function step(s, dt, offline) {
  if (s._dirty) refresh(s);
  const prevT = s.t;
  s.t += dt;
  const th = timeInfo(s);
  s._season = th.season;
  s._th = th;
  if (th.day !== (s._lastDay ?? th.day)) { s._lastDay = th.day; dailyTick(s, th, offline); }
  s._lastDay ??= th.day;

  updateWeather(s, th);
  if (!offline) {
    for (const p of s.people) updatePerson(s, p, dt, th);
    updateAnimals(s, dt, th);
    updateNodes(s, dt);
    completeBuildings(s);
  }
  for (const p of s.people) needsStep(s, p, dt, th, offline);
  computeStaff(s, offline);
  if (offline) offlineWork(s, dt, th);
  produce(s, dt, th, offline);
  researchStep(s, dt, th);
  trainTick(s, dt);
  // limpeza de mortos
  if (s._toKill?.length) { for (const [p, c] of s._toKill) if (s.people.includes(p)) killPerson(s, p, c); s._toKill = []; s._dirty = true; }
  // ameaças
  if (s.threats.length) for (const t of [...s.threats]) if (s.t >= t.at) { s.threats.splice(s.threats.indexOf(t), 1); resolveThreat(s, t, offline); }
  // tick lento (1s ao vivo, 10s offline)
  s._acc += dt;
  const slow = offline ? 10 : 1;
  if (s._acc >= slow) { const d = s._acc; s._acc = 0; slowTick(s, d, th, offline); }
}

function slowTick(s, dt, th, offline) {
  calcHappiness(s, th);
  // taxas líquidas por dia: janelas de ~8 s de jogo suavizadas (o consumo é discreto)
  s._flowT = (s._flowT || 0) + dt;
  if (s._flowT >= (offline ? 10 : 8)) {
    for (const r of RES_ORDER) {
      const f = (s._flow[r] || 0) / s._flowT * DAY_LEN;
      s.rates[r] = s.rates[r] === undefined ? f : s.rates[r] * 0.6 + f * 0.4;
      s._flow[r] = 0;
    }
    s._flowT = 0;
  }
  s._autoT = (s._autoT || 0) + dt; if (s._autoT >= (offline ? 10 : 6)) { s._autoT = 0; autoAssign(s, offline ? 6 : 2); }
  if (!offline && s.policies.autoEvents && s.ev.pending.length) for (const inst of [...s.ev.pending]) { const r = resolveAuto(s, inst); if (r !== null) { const l = (s._offLog || []).pop(); if (l) toast(s, `Conselho — ${l.title}: ${l.choice}`, 'info', l.icon); } }
  worldSlow(s, offline); marchTick(s, offline);
  s._toolFactor = s.res.tools > 0.5 ? 1.15 : (countB(s, 'smithy') ? 0.85 : 1);
  if (!offline) { checkQuests(s); checkAchievements(s); }
  s.bestPop = Math.max(s.bestPop, s.people.length);
}

// ---------- Clima ----------
function updateWeather(s, th) {
  const w = s.weather;
  if (s.t < w.until) return;
  const r = Math.random();
  const T = [[0.55, 0.9], [0.75, 0.93], [0.5, 0.92], [0.5, 0.93]][th.season]; // [limite clear, limite rain/snow]
  let type = 'clear';
  if (r > T[0]) type = th.season === 3 ? 'snow' : 'rain';
  if (r > T[1]) type = th.season === 3 ? 'snow' : 'storm';
  w.type = type;
  w.until = s.t + DAY_LEN * rnd(0.5, 1.6);
  w.intensity = type === 'storm' ? 1 : type === 'clear' ? 0 : rnd(0.5, 0.9);
  if (type === 'storm' && !w.announced) { w.announced = true; }
}

// ---------- Necessidades ----------
function needsStep(s, p, dt, th, offline) {
  const n = p.n;
  const child = p.age < ADULT_AGE;
  n.hunger = Math.max(0, n.hunger - dt * 0.7 * (s.policies.ration ? 0.7 : 1) * (child ? 0.7 : 1));
  if (offline) {
    n.sleep = 85;
    if (n.hunger < 36) eatNow(s, p, true);
  } else {
    const asleep = p.rt.task?.k === 'sleep' && p.rt.task.ph === 'zz';
    if (asleep) n.sleep = Math.min(100, n.sleep + dt * (p.home ? 1.5 : 1.0));
    else n.sleep = Math.max(0, n.sleep - dt * (s.policies.overtime ? 0.7 : 0.5));
  }
  // saúde
  let dh = 0, cause = null;
  const harsh = offline ? 0.35 : 1; // ausente, o povo emigra antes de morrer (ver dailyTick)
  if (n.hunger <= 0) { dh -= 0.26 * (0.6 + hash2(p.id, 3) * 0.8) * harsh; cause = 'morreu de fome'; }
  if (s.res.water <= 0 && p.thirst) { dh -= 0.25 * harsh; cause = cause || 'morreu de sede'; }
  if (p.sick > 0) { dh -= 0.14; cause = cause || 'sucumbiu à doença'; }
  if (s._cold) { dh -= 0.1; cause = cause || 'morreu de frio'; }
  if (dh === 0 && n.hunger > 35) dh = 0.1;
  n.health = clamp(n.health + dh * dt, 0, 100);
  if (n.health <= 0 && !p._dead) {
    // ausente: limite de mortes por privação (o resto foge em vez de morrer) — evita extinção total sem aviso
    if (offline && s._offBudget !== undefined && (cause === 'morreu de fome' || cause === 'morreu de sede' || cause === 'morreu de frio')) {
      if (s._offBudget <= 0) { n.health = 30; n.hunger = Math.max(n.hunger, 10); return; }
      s._offBudget--;
    }
    p._dead = true; (s._toKill ||= []).push([p, cause || 'faleceu']);
  }
  // alegria tende ao alvo global
  const target = (s._joyTarget ?? 60) + (hash2(p.id, 7) - 0.5) * 10 - (p.sick > 0 ? 15 : 0) - (n.hunger < 25 ? 15 : 0) - (n.sleep < 20 ? 8 : 0) + (p.hero ? 8 : 0);
  n.joy += (clamp(target, 0, 100) - n.joy) * Math.min(1, dt * 0.07);
}

export function calcHappiness(s, th) {
  const d = s._d || recalc(s);
  const pop = s.people.length;
  const beds = d.beds;
  let h = 52 + 3 + Math.min(28, d.happyB) + techFx(s, 'joy');
  if (s.t < s.festival.until) h += FESTIVAL.joy;
  h += [6, 0, -12][s.policies.tax] * (s.era >= 3 ? 1 : 0);
  if (s.policies.ration) h -= 8;
  if (s.policies.overtime) h -= 8;
  if (s.policies.conscription) h -= 10;
  if (pop > beds) h -= Math.min(16, (pop - beds) / Math.max(1, pop) * 40);
  if (s._cold) h -= 12;
  if (s.res.food <= 0) h -= 18;
  if (s.res.water <= 0) h -= 18;
  h -= Math.min(15, (s._deathMood || 0) * 3);
  h -= Math.min(12, (s.territories?.length || 0) * 1.5 * (soldiersOf(s).length < s.territories?.length * 2 ? 1 : 0.3));
  if (s.weather.type === 'storm') h -= 3;
  s._joyTarget = clamp(h, 0, 100);
  return s._joyTarget;
}

export function reputation(s) {
  const d = s._d || recalc(s);
  return clamp(avgJoy(s) * 0.6 + Math.min(28, d.prestige * 0.4) + (foodDays(s) >= 5 ? 8 : 0) + 8 + s.era * 2 + (s.territories?.length || 0) * 2, 0, 100);
}

// ---------- Equipes e produção ----------
function computeStaff(s, offline) {
  for (const b of s.buildings) { b._st = null; b._sm = 0; b._sc = 0; }
  const byId = s._byId || (s._byId = new Map());
  if (s._byIdN !== s.buildings.length) { byId.clear(); for (const b of s.buildings) byId.set(b.id, b); s._byIdN = s.buildings.length; }
  for (const p of s.people) {
    if (!p.workplace || p.age < ADULT_AGE || p.away) continue;
    const b = byId.get(p.workplace); if (!b || !b.done) continue;
    if (!offline && p.rt.working !== p.workplace) continue;
    (b._st ||= {})[p.job] = (b._st[p.job] || 0) + (offline ? OFFLINE_EFF : 1);
    b._sm += personMult(s, p, p.job) * (offline ? OFFLINE_EFF : 1); b._sc += (offline ? OFFLINE_EFF : 1);
  }
}
const staffN = (b, job) => (b._st && b._st[job]) || 0;
const staffTot = b => b._sc || 0;
const staffMult = b => b._sc ? b._sm / b._sc : 1;

function produce(s, dt, th, offline) {
  const k = dt / DAY_LEN;
  const gm = globalMult(s) * (s._workMult || 1);
  const farmSeason = [0.9, 1.25, 1.5, 0.3][th.season] * (s.weather.type === 'rain' ? 1.1 : s.weather.type === 'storm' ? 0.9 : 1);
  s._produced = s._produced || {};
  let rp = 0;
  for (const b of s.buildings) {
    if (!b.done || !b.enabled) continue;
    const sm = staffMult(b) * gm;
    switch (b.type) {
      case 'farm': { const n = staffTot(b); if (n) { addRes(s, 'food', n * 18 * sm * farmSeason * (1 + techFx(s, 'farm')) * k); } break; }
      case 'well': addRes(s, 'water', (14 + staffN(b, 'coletor') * 8 * sm) * k * (s.weather.type === 'rain' ? 1.2 : 1) * (s.t < (s.flags.droughtUntil || 0) ? 0.4 : 1)); break;
      case 'sawmill': { const n = staffTot(b); if (n && s.res.wood >= 16 && capOf(s, 'planks') > s.res.planks) { const make = Math.min(n * (s.flags.noSaw ? 8 : 12) * sm * k, (s.res.wood - 12) / 2); addRes(s, 'wood', -make * 2, { noStat: true }); addRes(s, 'planks', make); } break; }
      case 'mine': { const n = staffTot(b); if (n) { if (s.flags.ore) { addRes(s, 'iron', n * 5 * sm * k); addRes(s, 'stone', n * 4 * sm * k); } else addRes(s, 'stone', n * 9 * sm * k); } break; }
      case 'smithy': {
        const n = staffTot(b); if (!n) break;
        if (b.mode === 'tools') { const make = Math.min(n * 4 * sm * k, s.res.iron, s.res.wood / 2); if (make > 0) { addRes(s, 'iron', -make, { noStat: true }); addRes(s, 'wood', -make * 2, { noStat: true }); addRes(s, 'tools', make); } }
        else { const make = Math.min(n * 2 * sm * k, s.res.iron / 2, s.res.planks); if (make > 0) { addRes(s, 'iron', -make * 2, { noStat: true }); addRes(s, 'planks', -make, { noStat: true }); addRes(s, 'weapons', make); } }
        break; }
      case 'loom': { const n = staffTot(b); if (n && s.res.food > s.people.length * SEASON_DAYS * 1.3) { const make = Math.min(n * 6 * sm * k, s.res.food); if (make > 0) { addRes(s, 'food', -make, { noStat: true }); addRes(s, 'cloth', make); } } break; }
      case 'market': addRes(s, 'gold', staffTot(b) * 5 * sm * k * (1 + techFx(s, 'trade'))); break;
      case 'tavern': { if (s.res.food >= 1 || staffTot(b) === 0) { addRes(s, 'food', -2 * k, { noStat: true }); b._open = true; } else b._open = false; addRes(s, 'gold', staffTot(b) * 3 * sm * k * (b._open ? 1 : 0)); break; }
      case 'port': addRes(s, 'food', (6 + staffN(b, 'coletor') * 10 * sm) * k); addRes(s, 'gold', staffN(b, 'comerciante') * 6 * sm * k * (1 + techFx(s, 'trade'))); break;
      case 'academy': rp += staffTot(b) * 3 * sm * k; break;
      case 'jeweler': { const n = staffTot(b); if (n) { const make = Math.min(n * 1.5 * sm * k, s.res.gold / 4, s.res.stone / 2); if (make > 0) { addRes(s, 'gold', -make * 4, { noStat: true }); addRes(s, 'stone', -make * 2, { noStat: true }); addRes(s, 'jewels', make); } } break; }
    }
  }
  // sábios fora da academia e tradição da fogueira
  const free = s.people.filter(p => p.job === 'sabio' && p.age >= ADULT_AGE && !p.workplace).length;
  rp += (2 + s.people.length * 0.25 + free * 1.2) * k;
  s._rpGain = rp;
  // territórios rendem
  for (const t of s.territories || []) {
    const y = t.yield || {};
    for (const r in y) addRes(s, r, y[r] * k);
  }
  // consumo de ferramentas
  if (s.res.tools > 0) addRes(s, 'tools', -adultsOf(s).length / 14 * k, { noStat: true });
}

/** Escolhe a próxima pesquisa: exigidas pela próxima era / prédios que faltam → depois a mais barata disponível. */
export function pickTech(s) {
  const next = ERAS[s.era + 1];
  const targets = [];
  if (next) {
    for (const id of next.req.tech || []) targets.push(id);
    for (const type of Object.keys(next.req.buildings || {})) { const tg = BUILDINGS[type].tech; if (tg) targets.push(tg); }
  }
  for (const id of ['cartography', 'agriculture', 'masonry', 'sanitation', 'commerce', 'metallurgy', 'military', 'writing']) targets.push(id);
  const chain = id => { // primeira pesquisa disponível no caminho até id
    if (!TECHS[id] || s.tech.done[id]) return null;
    if (techAvailable(s, id)) return id;
    for (const r of TECHS[id].req) { const c = chain(r); if (c) return c; }
    return null;
  };
  for (const id of targets) { const c = chain(id); if (c) return c; }
  const av = Object.keys(TECHS).filter(id => techAvailable(s, id)).sort((a, b) => TECHS[a].cost - TECHS[b].cost);
  return av[0] || null;
}
function researchStep(s, dt) {
  if (!s.tech.current && s.policies.autoResearch) { const id = pickTech(s); if (id) startResearch(s, id); }
  const rp = (s._rpGain || 0) * (1 + techFx(s, 'rp'));
  s._rpPerDay = rp / (dt / DAY_LEN || 1);
  if (s.tech.current) {
    s.tech.progress += rp;
    const t = TECHS[s.tech.current];
    if (s.tech.progress >= t.cost) finishTech(s);
  } else s.tech.rp += rp;
}
function finishTech(s) {
  const id = s.tech.current, t = TECHS[id];
  s.tech.done[id] = true; s.tech.current = null; s.tech.progress = 0;
  if (t.unlock?.includes('world')) { s.flags.worldUnlocked = true; if (!s.world) initWorld(s); }
  chron(s, `Descoberta: ${t.name}. ${t.desc}`, 'tech');
  toast(s, `Pesquisa concluída: ${t.name}`, 'good', '🔬');
  bus.emit('tech', id);
  s._dirty = true;
}
export function startResearch(s, id) {
  const t = TECHS[id];
  if (!t || s.tech.done[id] || s.era < t.era || !t.req.every(r => s.tech.done[r])) return false;
  s.tech.current = id;
  s.tech.progress = Math.min(t.cost - 0.01, s.tech.rp); s.tech.rp = 0;
  return true;
}
export function techAvailable(s, id) {
  const t = TECHS[id];
  return !s.tech.done[id] && s.era >= t.era && t.req.every(r => s.tech.done[r]);
}

// ---------- Modo offline (modelo abstrato) ----------
function consumeNodes(s, type, amt) {
  // retira do nó mais próximo do centro; árvores derrubadas viram toco. A lista candidata é reaproveitada entre chamadas.
  const c = { x: CENTER.x, y: CENTER.y };
  const pools = s._pools || (s._pools = {});
  let pool = pools[type];
  if (!pool || pool.idx >= pool.list.length || pool.stamp !== s._poolStamp) {
    const R = eraRadius(s) + 3;
    const list = s.nodes.filter(n => n.type === type && n.amt > 0.01 && (type !== 'tree' || n.st === 'alive') && Math.hypot(n.x - c.x, n.y - c.y) < R)
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    pool = pools[type] = { list, idx: 0, stamp: s._poolStamp };
  }
  let left = amt;
  while (left > 0 && pool.idx < pool.list.length) {
    const n = pool.list[pool.idx];
    if (n.amt <= 0.01 || (type === 'tree' && n.st !== 'alive')) { pool.idx++; continue; }
    const take = Math.min(n.amt, left);
    n.amt -= take; left -= take;
    if (n.amt <= 0.01) { if (type === 'tree') { n.st = 'stump'; n.t = s.t + DAY_LEN * 7; } pool.idx++; }
  }
  return amt - left;
}
function offlineWork(s, dt, th) {
  const k = dt / DAY_LEN * OFFLINE_EFF;
  const gm = globalMult(s) * (s._workMult || 1);
  const winter = th.season === 3;
  let builders = 0;
  for (const p of s.people) {
    if (p.age < ADULT_AGE || p.away) continue;
    let job = p.job, mult = 1;
    if (job === 'livre') { mult = 0.7; job = autoJob(s); }
    if (p.workplace && p.job !== 'livre') continue; // cuidado em produce()
    const pm = personMult(s, p, job === 'water' ? 'coletor' : job) * gm * mult;
    switch (job) {
      case 'lenhador': { const a = consumeNodes(s, 'tree', OUT_RATE.lenhador * k * pm * (1 + techFx(s, 'wood'))); addRes(s, 'wood', a); gainSkill(p, 'lenhador', dt * 0.4); break; }
      case 'pedreiro': { const a = consumeNodes(s, 'rock', OUT_RATE.pedreiro * k * pm * (1 + techFx(s, 'stone'))); addRes(s, 'stone', a); gainSkill(p, 'pedreiro', dt * 0.4); break; }
      case 'coletor': case 'water': {
        const water = job === 'water' || waterDays(s) < 5 || waterDays(s) < foodDays(s) * 0.9 || winter;
        if (water) addRes(s, 'water', OUT_RATE.water * k * pm);
        else { const bushes = s.nodes.filter(n => n.type === 'bush' && n.amt >= 1); const a = bushes.length ? OUT_RATE.coletor * k * pm : 0; let left = a; for (const n of bushes) { const t = Math.min(n.amt, left); n.amt -= t; left -= t; if (left <= 0) break; } addRes(s, 'food', a - left); }
        gainSkill(p, 'coletor', dt * 0.4); break; }
      case 'cacador': addRes(s, 'food', OUT_RATE.cacador * k * pm * (1 + techFx(s, 'hunt')) * (s._d && s.res.food > capOf(s, 'food') * 0.9 ? 0.2 : 1)); gainSkill(p, 'cacador', dt * 0.4); break;
      case 'construtor': builders += pm; break;
      case 'agricultor': { // sem fazenda: age como livre colhendo
        break; }
    }
  }
  // obras: os construtores avançam as construções em fila
  if (builders > 0) {
    let work = builders * dt * OFFLINE_EFF * (1 + techFx(s, 'build'));
    for (const b of s.buildings) {
      if (b.done || work <= 0) continue;
      const def = BUILDINGS[b.type]; const need = def.work - b.wk; const use = Math.min(need, work);
      b.wk += use; work -= use; b.prog = b.wk / def.work;
      if (b.prog >= 0.999) { b.prog = 1; (s._completed ||= []).push(b); }
    }
    completeBuildings(s);
  }
  // regeneração de arbustos/árvores é feita em dailyTick
}

// ---------- Nós de recurso (animação de queda e rebrota) ----------
function updateNodes(s, dt) {
  for (const n of s.nodes) {
    if (n.st === 'falling') { n.fallT += dt; if (n.fallT > 1.3) { n.st = 'stump'; n.t = s.t + DAY_LEN * 7; } }
  }
}
function regrowNodes(s, th) {
  for (const n of s.nodes) {
    if (n.type === 'tree') {
      if (n.st === 'stump' && s.t >= n.t) { n.st = 'sapling'; n.t = s.t + DAY_LEN * 7; }
      else if (n.st === 'sapling' && s.t >= n.t) { n.st = 'alive'; n.amt = n.max; }
    } else if (n.type === 'bush') {
      if (th.season !== 3 && n.amt < n.max) n.amt = Math.min(n.max, n.amt + (th.season === 0 ? 0.7 : 1.2));
    } else if (n.type === 'rock' && n.amt < n.max) { n.amt = Math.min(n.max, Math.max(0, n.amt) + 0.8); }
  }
  s.nodes = s.nodes.filter(n => !n._gone && !(n.type === 'tree' && n.st === 'removed'));
}

// ---------- Obras concluídas ----------
function completeBuildings(s) {
  if (!s._completed?.length) return;
  for (const b of s._completed) {
    if (b.done) continue;
    b.done = true; b.prog = 1; b.doneT = s.t;
    s.stats.built[b.type] = (s.stats.built[b.type] || 0) + 1;
    const def = BUILDINGS[b.type];
    if (!def.repeat) { chron(s, `${def.name} concluído(a).`, 'build'); toast(s, `${def.name} pronto!`, 'good', def.icon); }
    bus.emit('built', b);
    s._dirty = true;
  }
  s._completed = [];
}

// ---------- Tick diário ----------
function dailyTick(s, th, offline) {
  const day = th.day;
  s._deathMood = Math.max(0, (s._deathMood || 0) - 0.6);
  // envelhecimento e doenças
  const san = 1 + techFx(s, 'disease');
  const wells = countB(s, 'well');
  const pop = s.people.length;
  for (const p of s.people) {
    p.age += p.age < ADULT_AGE ? 1 / AGE_DAYS_PER_YEAR : 1 / (AGE_DAYS_PER_YEAR * 3); // infância rápida, vida adulta longa
    if (p.sick > 0) { p.sick -= 1; if (p.sick <= 0) { p.sick = 0; } }
    if (p.age > 58 && chance((p.age - 58) * 0.03 / AGE_DAYS_PER_YEAR * 2)) (s._toKill ||= []).push([p, 'morreu de velhice']);
  }
  const over = s._d && pop > s._d.beds;
  const dis = 0.014 * Math.sqrt(pop) * san * (wells ? 0.6 : 1) * (th.season === 3 ? 1.6 : 1) * (over ? 1.4 : 1);
  if (pop > 1 && chance(dis)) { const v = pick(s.people.filter(p => !p.sick)); if (v) { v.sick = 4; chron(s, `${v.name} adoeceu.`, 'bad'); } }
  for (const p of s.people.filter(q => q.sick > 0)) if (chance(0.12 * san)) { const v = pick(s.people.filter(q => !q.sick)); if (v) { v.sick = 4; } }
  // racionamento de emergência automático (e retorno ao normal quando há folga)
  if (s.policies.autoJobs) {
    const fdn = foodDays(s);
    if (!s.policies.ration && fdn < 4 && s.people.length >= 4) { s.policies.ration = true; s.flags.autoRation = true; chron(s, 'A comida está acabando: o conselho decretou racionamento.', 'policy'); if (!offline) toast(s, 'Racionamento de emergência ativado', 'bad', '🍞'); }
    else if (s.policies.ration && s.flags.autoRation && fdn > 10) { s.policies.ration = false; s.flags.autoRation = false; chron(s, 'Comida em dia: o racionamento foi encerrado.', 'policy'); }
  }
  // aquecimento no inverno
  s._cold = false;
  if (th.season === 3) {
    const need = pop * 0.35 * (s.t < (s.flags.harshUntil || 0) ? 2 : 1);
    if (s.res.wood >= need) addRes(s, 'wood', -need, { noStat: true }); else { addRes(s, 'wood', -s.res.wood, { noStat: true }); s._cold = true; if (!offline) toast(s, 'Falta lenha! O povo está com frio.', 'bad', '🥶'); }
  }
  // impostos
  if (s.era >= 3) {
    const rate = [0.25, 0.5, 0.8][s.policies.tax] * (1 + 0.15 * countB(s, 'market'));
    addRes(s, 'gold', adultsOf(s).length * rate);
  }
  // recrutamento
  if (s.policies.conscription && s._d) {
    const sol = soldiersOf(s).length;
    if (sol < s._d.soldierCap) { const v = s.people.find(p => p.job === 'livre' && p.age >= ADULT_AGE) || s.people.find(p => p.age >= ADULT_AGE && p.job !== 'soldado' && p.job !== 'construtor'); if (v) { v.job = 'soldado'; s._dirty = true; } }
  }
  // fome/sede prolongada: moradores abandonam o reino em busca de comida (sobretudo quando o jogador está ausente)
  if ((s.res.food <= 0.5 || s.res.water <= 0.5) && s.people.length > 2 && (offline || chance(0.25))) {
    const n = Math.min(s.people.length - 2, Math.max(1, Math.ceil(s.people.length * (offline ? 0.08 : 0.03))));
    const names = [];
    for (let i = 0; i < n; i++) { const v = pick(s.people.filter(p => p.age >= ADULT_AGE)); if (!v) break; s.people.splice(s.people.indexOf(v), 1); for (const q of s.people) if (q.partner === v.id) q.partner = null; names.push(v.name); s._left = (s._left || 0) + 1; }
    if (names.length) { chron(s, `${names.join(', ')} abandonou(aram) o reino em busca de comida e água.`, 'bad'); if (!offline) toast(s, `${names.length} morador(es) fugiram da fome!`, 'bad', '🚪'); }
    s._dirty = true;
  }
  regrowNodes(s, th);
  s._poolStamp = (s._poolStamp || 0) + 1;
  populationDaily(s, th, offline);
  // ferramentas e pesquisa
  autoBuild(s); tidyOne(s); autoMilitary(s); autoPolicies(s, offline);
  if (s.policies.autoWorld) { autoWorld(s); autoConquer(s); }
  if (s.policies.autoEra && eraStatus(s)?.ready) advanceEra(s);
  worldDaily(s, offline);
  warDaily(s, offline);
  if (s._newEvents?.length) {
    for (const e of s._newEvents) { const inst = makeInstance(s, e.id, e.params); deliverEvent(s, inst, offline); }
    s._newEvents = [];
  }
  // eventos aleatórios
  if (s.t >= s.ev.cooldownUntil) {
    const ev = rollEvent(s, offline);
    s.ev.cooldownUntil = s.t + DAY_LEN * rnd(1.8, 3.8);
    if (ev) deliverEvent(s, ev, offline);
  }
  // avisos de estação
  if (!offline && th.dOfSeason === 0) { chron(s, `Chegou ${['a primavera', 'o verão', 'o outono', 'o inverno'][th.season]}. Ano ${th.year + 1}.`, 'season'); bus.emit('season', th.season); }
  if (offline && th.dOfSeason === 0) s._offSeasons = (s._offSeasons || 0) + 1;
  s._dirty = true;
}

/** Entrega um evento: resolvido pelo conselho (offline ou piloto automático) ou apresentado ao jogador. */
function deliverEvent(s, inst, offline) {
  if (offline || s.policies.autoEvents) {
    const res = resolveAuto(s, inst);
    if (!offline) { const l = (s._offLog || []).pop(); if (l) toast(s, `Conselho — ${l.title}: ${l.choice}`, 'info', l.icon); }
  } else { s.ev.pending.push(inst); bus.emit('event', inst); }
}
function autoPolicies(s, offline) {
  if (!s.policies.autoEvents) return;
  const j = avgJoy(s);
  if (s.era >= 3) { if (j < 35 && s.policies.tax > 0) setPolicy(s, 'tax', s.policies.tax - 1); else if (j > 72 && s.policies.tax < 1) setPolicy(s, 'tax', 1); }
  if (j < 55 && s.people.length >= 6 && festivalReady(s) && s.res.food > 120 && s.res.water > 60) startFestival(s);
  if (s.policies.overtime && j < 45) s.policies.overtime = false;
  if (s.policies.conscription && s.era < 3) s.policies.conscription = false;
}

function populationDaily(s, th, offline) {
  const day = th.day;
  const d = s._d || recalc(s);
  const pop = s.people.length;
  // partos
  for (const p of [...s.people]) {
    if (p.f && p.preg && day >= p.preg.due) {
      const f = Math.random() < 0.5;
      const child = makePerson(s, { f, age: 0, x: p.x, y: p.y, name: randName(f) });
      child.job = 'livre'; child.age = 0;
      s.people.push(child); p.preg = null; p.lastBirth = day; s.stats.births++;
      chron(s, `${child.name} nasceu, filho(a) de ${p.name}.`, 'birth');
      toast(s, `Nasceu ${child.name}!`, 'good', '👶');
      bus.emit('birth', child);
    }
  }
  // concepção
  const fd = foodDays(s);
  const joy = avgJoy(s);
  for (const p of s.people) {
    if (!p.f || p.preg || p.age < 12 || p.age > 42 || !p.partner || day - p.lastBirth < 10) continue;
    const mate = s.people.find(q => q.id === p.partner);
    if (!mate || mate.age < 12) continue;
    if (s.people.length >= d.beds + 1 || fd < 5 || (s.rates.food || 0) < -4 || joy < 42) continue;
    if (chance(0.3)) p.preg = { due: day + 5 };
  }
  // casais
  const singlesM = s.people.filter(p => !p.f && !p.partner && p.age >= 12 && p.age < 55);
  const singlesF = s.people.filter(p => p.f && !p.partner && p.age >= 12 && p.age < 45);
  for (const m of singlesM) {
    if (!chance(0.3)) continue;
    const f = singlesF.find(q => !q.partner && Math.abs(q.age - m.age) < 14);
    if (f) { m.partner = f.id; f.partner = m.id; chron(s, `${m.name} e ${f.name} formaram um casal.`, 'birth'); }
  }
  // recuperação após catástrofe: sobreviventes encontram o reino vazio / poucos moradores atraem esperança
  if (s.people.length === 0) {
    for (let i = 0; i < 2; i++) addPerson(s, { f: i === 0, age: 22 + i * 3 });
    chron(s, 'Dois sobreviventes de uma terra distante encontram as ruínas do reino e decidem recomeçar.', 'birth');
    toast(s, 'Sobreviventes chegaram para reerguer o reino!', 'good', '🌱');
    return;
  }
  if (s.people.length <= 3 && d.beds > s.people.length && s.policies.border === 0 && chance(0.3)) {
    const q = addPerson(s, { age: rint(18, 30) }); s.stats.immigrants++;
    chron(s, `${q.name} ouviu falar do reino e veio ajudar a reconstruí-lo.`, 'birth');
  }
  // imigrantes
  const rep = reputation(s);
  const free = d.beds - s.people.length;
  if (s.policies.border === 0 && free > 0 && fd >= 6 && (s.rates.food || 0) > -4 && rep >= 44) {
    const pr = 0.3 + (rep - 44) / 160;
    if (chance(pr) && s.people.length < 400) {
      const n = Math.min(free, rint(1, 3)), names = [];
      const startF = Math.random() < 0.5;
      for (let i = 0; i < n; i++) {
        const q = addPerson(s, { f: (i % 2 === 0) === startF, age: rint(18, 36) });
        if (s.era >= 3 && chance(0.4)) q.skill[pick(['lenhador', 'pedreiro', 'cacador'])] = rnd(1.5, 3);
        names.push(q.name);
      }
      s.stats.immigrants += n;
      chron(s, `${names.join(', ')} ${n > 1 ? 'chegaram' : 'chegou'} ao reino em busca de uma vida melhor.`, 'birth');
      toast(s, n > 1 ? `${n} imigrantes chegaram!` : `${names[0]} chegou ao reino!`, 'good', '🚶');
      bus.emit('immigrants', n);
    }
  }
  // fuga de moradores
  if (joy < 30 && s.people.length > 3 && chance((30 - joy) / 60)) {
    const v = pick(s.people.filter(p => p.age >= ADULT_AGE));
    if (v) { s.people.splice(s.people.indexOf(v), 1); for (const q of s.people) if (q.partner === v.id) q.partner = null; chron(s, `${v.name} abandonou o reino, infeliz com a situação.`, 'bad'); toast(s, `${v.name} foi embora!`, 'bad', '🚪'); s._left = (s._left || 0) + 1; }
  }
}

// ---------- Distribuição de moradias e locais de trabalho ----------
export function assignWorkplaces(s) {
  const bySlot = {};
  for (const b of s.buildings) {
    if (!b.done || !b.enabled) continue;
    const def = BUILDINGS[b.type];
    if (!def.slots) continue;
    for (const j in def.slots) (bySlot[j] ||= []).push({ b, left: def.slots[j] });
  }
  for (const p of s.people) p.workplace = null;
  const used = new Set();
  for (const j in bySlot) {
    const workers = s.people.filter(p => p.job === j && p.age >= ADULT_AGE).sort((a, b) => (b.skill[j] || 0) - (a.skill[j] || 0));
    let wi = 0;
    for (const slot of bySlot[j]) for (let i = 0; i < slot.left && wi < workers.length; i++) { workers[wi++].workplace = slot.b.id; }
  }
  // soldados: se não houver quartel, fica sem local
}
export function assignHomes(s) {
  const homes = s.buildings.filter(b => b.done && BUILDINGS[b.type].beds && b.type !== 'campfire').map(b => ({ b, left: BUILDINGS[b.type].beds }));
  for (const p of s.people) p.home = null;
  const done = new Set();
  const fam = [...s.people].sort((a, b) => (b.partner ? 1 : 0) - (a.partner ? 1 : 0));
  for (const p of fam) {
    if (p.home) continue;
    const mate = p.partner && s.people.find(q => q.id === p.partner);
    const need = mate && !mate.home ? 2 : 1;
    const h = homes.find(x => x.left >= need) || homes.find(x => x.left >= 1);
    if (!h) continue;
    p.home = h.b.id; h.left--;
    if (mate && !mate.home && h.left > 0) { mate.home = h.b.id; h.left--; }
  }
}

// ---------- API de ações do jogador ----------
export function footprintOk(s, type, x, y) {
  const def = BUILDINGS[type];
  if (x < 1 || y < 1 || x + def.w > MAP_W - 1 || y + def.h > MAP_H - 1) return 'Fora do mapa';
  const cx = x + def.w / 2, cy = y + def.h / 2;
  if (Math.hypot(cx - CENTER.x, (cy - CENTER.y) * 1.0) > eraRadius(s)) return 'Fora do território (evolua de era)';
  let touchesWater = false;
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    if (isWater(s, xx, yy)) return 'Sobre a água';
  }
  if (def.needsWater) {
    for (let yy = y - 1; yy <= y + def.h; yy++) for (let xx = x - 1; xx <= x + def.w; xx++) if (isWater(s, xx, yy)) touchesWater = true;
    if (!touchesWater) return 'Precisa ficar à beira d\'água';
  }
  for (const b of s.buildings) {
    if (b.x < x + def.w && b.x + b.w > x && b.y < y + def.h && b.y + b.h > y) {
      if (def.road && b.type === 'road') return 'Já existe estrada aqui';
      return 'Ocupado';
    }
  }
  for (const n of s.nodes) {
    if (n.type === 'tree') continue;
    const nx = Math.floor(n.x), ny = Math.floor(n.y);
    if (nx >= x && nx < x + def.w && ny >= y && ny < y + def.h) return n.type === 'bush' ? 'Arbusto no caminho' : 'Rocha no caminho';
  }
  return null;
}
export function canPlace(s, type, x, y) {
  const def = BUILDINGS[type];
  if (!unlocked(s, type)) return { ok: false, reason: 'Ainda bloqueado' };
  if (def.unique && s.buildings.some(b => b.type === type)) return { ok: false, reason: 'Só pode existir um' };
  const why = footprintOk(s, type, x, y);
  if (why) return { ok: false, reason: why };
  if (!canAfford(s, def.cost)) return { ok: false, reason: 'Recursos insuficientes', afford: false };
  return { ok: true };
}
export function placeBuilding(s, type, x, y) {
  const c = canPlace(s, type, x, y);
  if (!c.ok) return null;
  const def = BUILDINGS[type];
  spend(s, def.cost);
  // limpa árvores sob a construção
  for (const n of s.nodes) if (n.type === 'tree' && n.st !== 'removed') { const nx = Math.floor(n.x), ny = Math.floor(n.y); if (nx >= x - 0 && nx < x + def.w && ny >= y && ny < y + def.h) { n.st = 'removed'; } }
  const b = { id: s.nextBid++, type, x, y, w: def.w, h: def.h, prog: 0, done: false, enabled: true, mode: 'tools', hp: 100, t0: s.t, wk: 0 };
  s.buildings.push(b);
  s.nodes = s.nodes.filter(n => n.st !== 'removed');
  s._dirty = true;
  bus.emit('placed', b);
  return b;
}
/** Informações de evolução de uma construção (abrigo → casa, área de coleta → depósito). */
export function upgradeInfo(s, b) {
  const def = BUILDINGS[b.type];
  if (!def.upgrade || !b.done) return null;
  const to = def.upgrade.to, td = BUILDINGS[to];
  const cost = {}; for (const r in td.cost) cost[r] = Math.ceil(td.cost[r] * def.upgrade.frac);
  let reason = null;
  if (!unlocked(s, to)) reason = s.era < td.era ? `Libera na era ${ERAS[td.era].name}` : 'Pesquisa necessária';
  else if (!canAfford(s, cost)) reason = 'Recursos insuficientes';
  return { to, name: td.name, cost, ok: !reason, reason };
}
export function upgradeBuilding(s, b) {
  const info = upgradeInfo(s, b); if (!info || !info.ok) return false;
  const td = BUILDINGS[info.to];
  // cabe no mesmo lugar? senão procura um lugar no distrito
  let x = b.x, y = b.y;
  const i = s.buildings.indexOf(b); s.buildings.splice(i, 1);
  let fits = !footprintOkSized(s, info.to, x, y);
  s.buildings.splice(i, 0, b);
  if (!fits) { const slot = findSlot(s, info.to, b); if (!slot) return false; [x, y] = slot; }
  spend(s, info.cost);
  for (const n of s.nodes) if (n.type === 'tree') { const nx = Math.floor(n.x), ny = Math.floor(n.y); if (nx >= x && nx < x + td.w && ny >= y && ny < y + td.h) n.st = 'removed'; }
  s.nodes = s.nodes.filter(n => n.st !== 'removed');
  const from = BUILDINGS[b.type].name;
  b.type = info.to; b.w = td.w; b.h = td.h; b.x = x; b.y = y; b.done = false; b.prog = 0; b.wk = 0; b.upgraded = true;
  chron(s, `${from} está sendo evoluído(a) para ${td.name}.`, 'build');
  s._dirty = true; bus.emit('placed', b);
  return true;
}
const footprintOkSized = (s, type, x, y) => footprintOk(s, type, x, y);
/** Verifica se uma construção pode ser movida para (x, y). Mudar prédio pronto custa 25% do valor. */
export function moveCheck(s, b, x, y) {
  const def = BUILDINGS[b.type];
  if (b.type === 'campfire') return { ok: false, reason: 'A fogueira não pode ser movida' };
  const i = s.buildings.indexOf(b); s.buildings.splice(i, 1);
  let why; try { why = footprintOk(s, b.type, x, y); } finally { s.buildings.splice(i, 0, b); }
  if (why) return { ok: false, reason: why };
  const fee = {}; if (b.done) for (const r in def.cost) fee[r] = Math.ceil(def.cost[r] * 0.25);
  if (!canAfford(s, fee)) return { ok: false, reason: 'Falta recurso para a mudança', fee };
  return { ok: true, fee };
}
export function moveBuilding(s, b, x, y, free = false, pin = true) {
  const c = moveCheck(s, b, x, y); if (!c.ok) return false;
  const def = BUILDINGS[b.type];
  if (!free) spend(s, c.fee);
  for (const n of s.nodes) if (n.type === 'tree') { const nx = Math.floor(n.x), ny = Math.floor(n.y); if (nx >= x && nx < x + def.w && ny >= y && ny < y + def.h) n.st = 'removed'; }
  s.nodes = s.nodes.filter(n => n.st !== 'removed');
  b.x = x; b.y = y; b.pinned = pin; b.manual = false;
  s._dirty = true; bus.emit('moved', b);
  return true;
}
export function demolish(s, b) {
  if (b.type === 'campfire') return false;
  const def = BUILDINGS[b.type];
  const i = s.buildings.indexOf(b); if (i < 0) return false;
  s.buildings.splice(i, 1);
  const k = b.done ? 0.5 : 0.9 * (1 - b.prog) + 0.4 * b.prog;
  for (const r in def.cost) addRes(s, r, Math.floor(def.cost[r] * k), { noStat: true });
  s._dirty = true;
  bus.emit('demolished', b);
  return true;
}
export function setJob(s, p, job, auto = false) { p.job = job; p.auto = auto; s._dirty = true; p.rt.task = null; }
export function jobCounts(s) {
  const c = {};
  for (const p of s.people) if (p.age >= ADULT_AGE) c[p.job] = (c[p.job] || 0) + 1;
  return c;
}
/** Aumenta/diminui o número de trabalhadores de uma profissão (pega de "livre" ou do mais numeroso) */
export function adjustJob(s, job, delta) {
  if (job === 'soldado' && delta > 0 && s.people.filter(p => p.job === 'soldado').length >= (s._d?.soldierCap || 0)) return false;
  const adults = s.people.filter(p => p.age >= ADULT_AGE && !p.away);
  if (delta > 0) {
    let pool = adults.filter(p => p.job === 'livre');
    if (!pool.length) {
      const c = jobCounts(s);
      const donor = Object.keys(c).filter(j => j !== job && c[j] > 1).sort((a, b) => c[b] - c[a])[0];
      if (!donor) return false;
      pool = adults.filter(p => p.job === donor);
    }
    pool.sort((a, b) => (b.skill[job] || 0) - (a.skill[job] || 0));
    setJob(s, pool[0], job); return true;
  }
  const mine = adults.filter(p => p.job === job).sort((a, b) => (a.skill[job] || 0) - (b.skill[job] || 0));
  if (!mine.length) return false;
  setJob(s, mine[0], 'livre'); return true;
}
export function setPolicy(s, key, val) {
  s.policies[key] = val;
  chron(s, `Política alterada: ${POLICIES[key].name} → ${POLICIES[key].options ? POLICIES[key].options[val] : (val ? 'ativa' : 'desligada')}.`, 'policy');
  s._dirty = true;
}
export function festivalReady(s) { return s.t >= s.festival.cooldownUntil; }
export function startFestival(s) {
  if (!festivalReady(s) || !canAfford(s, FESTIVAL.cost)) return false;
  spend(s, FESTIVAL.cost, { ledger: true });
  s.festival.until = s.t + FESTIVAL.days * DAY_LEN;
  s.festival.cooldownUntil = s.t + FESTIVAL.cooldown * DAY_LEN;
  s.stats.festivals++;
  chron(s, 'Um festival animou o povo com música, dança e fartura!', 'good');
  toast(s, 'Festival começou! 🎉', 'good', '🎉');
  bus.emit('festival');
  return true;
}

/** Distribuição automática: os moradores "livres" (e os já auto-atribuídos) são todos empregados.
 *  1º cobre necessidades reais (comida, água, obras, vagas de prédios); 2º reparte o resto de forma preventiva,
 *  dando mais gente ao recurso mais "magro" para evitar a próxima necessidade. Escolhas manuais não são mexidas. */
export function autoAssign(s, maxChanges = 3) {
  if (!s.policies.autoJobs || !s._d) return 0;
  const adults = s.people.filter(p => p.age >= ADULT_AGE && !p.away);
  const pool = adults.filter(p => p.job === 'livre' || p.auto);
  if (!pool.length) return 0;
  const manual = adults.filter(p => !(p.job === 'livre' || p.auto) && p.job !== 'soldado' && p.job !== 'sabio');
  const N = adults.filter(p => p.job !== 'soldado' && p.job !== 'sabio').length;
  const d0 = s._d;
  const slots = s._d.slots, fd = foodDays(s), wd = waterDays(s), th = s._th || timeInfo(s);
  const sites = s.buildings.some(b => !b.done);
  const winterSoon = th.season === 2 || th.season === 3;
  const cnt = {}; for (const p of manual) cnt[p.job] = (cnt[p.job] || 0) + 1;
  const soldiersFixed = adults.filter(p => p.job === 'soldado' && !p.auto).length;
  const ok = j => jobUnlocked(s, j);
  // ---- 1) necessidades reais (mínimos) ----
  const T = {};
  if (sites) T.construtor = Math.max(1, Math.round(N * 0.2));
  if (slots.agricultor) T.agricultor = slots.agricultor;
  const crit = wd < 6 || fd < 5;
  if (wd < 6 || (fd < 5 && !slots.agricultor)) T.coletor = Math.max(1, Math.ceil(N * 0.25));
  else if (N >= 4) T.coletor = 1;
  if (th.season === 3 && fd < 12) T.cacador = Math.min(3, Math.ceil(N * 0.12));
  if (slots.lenhador) T.lenhador = slots.lenhador;
  if (slots.pedreiro && s.era >= 3) T.pedreiro = slots.pedreiro;
  if (slots.ferreiro) T.ferreiro = slots.ferreiro;
  if (slots.comerciante) T.comerciante = slots.comerciante;
  if (d0.soldierCap && jobUnlocked(s, 'soldado') && (s.threats.length || s.era >= 4 || (s.world?.kingdoms || []).some(k => k.known && k.pers === 'agressivo'))) T.soldado = Math.min(d0.soldierCap, Math.ceil(N * 0.1));
  // foco na próxima era: recursos que faltam para evoluir ganham trabalhadores
  const defs = eraDeficits(s), focus = { wood: 'lenhador', planks: 'lenhador', stone: 'pedreiro', iron: 'pedreiro', gold: 'comerciante' };
  const focusJobs = {};
  for (const r in defs) { const j = focus[r]; if (!j || !jobUnlocked(s, j)) continue; const share = Math.min(0.4, 0.15 + 0.25 * Math.min(1, defs[r].deficit / Math.max(1, defs[r].target))); focusJobs[j] = Math.max(focusJobs[j] || 0, share); }
  if (s.flags.noFocus) for (const j in focusJobs) delete focusJobs[j];
  for (const j in focusJobs) T[j] = Math.max(T[j] || 0, Math.ceil(N * focusJobs[j]));
  if (crit) { delete T.pedreiro; if (focusJobs.pedreiro) T.pedreiro = Math.max(1, Math.ceil(N * 0.15)); T.lenhador = Math.min(T.lenhador || 0, slots.lenhador || 0); if (sites) T.construtor = 1; }
  const want = {}; let left = pool.length;
  const give = (j, n) => { if (!ok(j) || n <= 0 || left <= 0) return; const k = Math.min(n, left); want[j] = (want[j] || 0) + k; left -= k; };
  const prio = ['coletor', 'agricultor', 'construtor', 'cacador', 'lenhador', 'pedreiro', 'ferreiro', 'comerciante'];
  cnt.soldado = soldiersFixed;
  for (const j of prio.concat(['soldado'])) if (T[j]) give(j, T[j] - (cnt[j] || 0));
  // ---- 2) reparte o restante conforme o que está mais "magro" (prevenção) ----
  const cap = r => Math.max(1, capOf(s, r));
  const lack = r => Math.max(0, 1 - s.res[r] / (cap(r) * 0.85));
  const need = {
    coletor: Math.max(0.15, 1 - Math.min(wd, fd) / 14, lack('food') * 0.6, lack('water') * 0.6),
    agricultor: slots.agricultor ? Math.max(0.2, 1 - fd / 14) : 0,
    lenhador: Math.max(0.2, lack('wood') + (winterSoon ? 0.35 : 0), s.era >= 2 ? lack('planks') * 0.4 : 0, (focusJobs.lenhador || 0) * 2),
    pedreiro: Math.max(0.15, lack('stone'), (focusJobs.pedreiro || 0) * 2),
    cacador: N >= 5 ? Math.max(0.05, (1 - fd / 14) * (th.season === 3 ? 1 : 0.4)) : 0,
    construtor: sites ? 0.9 : (N >= 6 ? 0.12 : 0),
  };
  if (!sites && s.res.wood > cap('wood') * 0.7 && s.res.stone > cap('stone') * 0.5) need.construtor = 0.3; // sobra material: ter construtores prontos
  if (s.era >= 3) { need.pedreiro = Math.max(need.pedreiro, lack('iron') * 0.5); }
  // limite de vagas em ofícios de prédio: não passa disso
  const capJob = j => (j === 'agricultor' ? (slots.agricultor || 0) + 0 : 99);
  while (left > 0) {
    let best = null, bs = -1;
    for (const j of Object.keys(need)) {
      if (!ok(j) || need[j] <= 0) continue;
      const have = (cnt[j] || 0) + (want[j] || 0);
      if (have >= capJob(j)) continue;
      const score = need[j] / (have + 1);
      if (score > bs) { bs = score; best = j; }
    }
    if (!best) break;
    give(best, 1);
  }
  // ---- 3) aplica a diferença com o mínimo de trocas ----
  const quota = { ...want };
  const stay = new Set(), move = [];
  for (const p of pool) { if (quota[p.job] > 0) { quota[p.job]--; stay.add(p); } else move.push(p); }
  let changes = 0;
  for (const p of move) {
    if (changes >= maxChanges) break;
    const j = Object.keys(quota).sort((a, b) => (quota[b] || 0) - (quota[a] || 0)).find(k => quota[k] > 0);
    if (!j) { if (p.job !== 'livre' || !p.auto) { setJob(s, p, 'livre', true); changes++; } continue; }
    quota[j]--;
    if (p.job !== j) { setJob(s, p, j, true); changes++; }
  }
  if (changes) s._dirty = true;
  return changes;
}

// ---------- Eras ----------
export function eraStatus(s) {
  const next = ERAS[s.era + 1];
  if (!next) return null;
  const checks = [];
  const r = next.req;
  checks.push({ text: `População ${s.people.length}/${r.pop}`, ok: s.people.length >= r.pop });
  for (const t in r.buildings) { const c = countB(s, t); checks.push({ text: `${BUILDINGS[t].name} ${Math.min(c, r.buildings[t])}/${r.buildings[t]}`, ok: c >= r.buildings[t] }); }
  for (const t of r.tech || []) checks.push({ text: `Pesquisar ${TECHS[t].name}`, ok: !!s.tech.done[t] });
  if (r.territories) checks.push({ text: `Territórios conquistados ${s.territories.length}/${r.territories}`, ok: s.territories.length >= r.territories });
  const reqOk = checks.every(c => c.ok);
  const costOk = canAfford(s, next.cost);
  return { next, checks, reqOk, costOk, ready: reqOk && costOk };
}
export function advanceEra(s) {
  const st = eraStatus(s);
  if (!st || !st.ready) return false;
  spend(s, st.next.cost);
  s.era++;
  if (s._offlineMode) (s._offEras ||= []).push(s.era);
  chron(s, `Marco histórico: o povoado agora é ${['', '', 'uma Vila', 'uma Cidade', 'um Reino', 'um Império'][s.era]}!`, 'era');
  if (!s._offlineMode) bus.emit('era', s.era);
  s._dirty = true;
  return true;
}

// ---------- Alertas ----------
export function getAlerts(s) {
  const out = [];
  const th = s._th || timeInfo(s);
  const cons = dailyConsumption(s);
  const add = (level, icon, text, key) => out.push({ level, icon, text, key });
  const rate = r => s.rates[r] || 0;
  const daysLeft = r => { const net = rate(r); return net < -0.05 ? s.res[r] / -net : Infinity; };
  const fl = daysLeft('food'), wl = daysLeft('water');
  const fd = foodDays(s), wd = waterDays(s);
  if (s.res.food <= 0.5) add('danger', '🍖', 'Sem comida! O povo está passando fome.', 'food');
  else if (fl < 2.5 || fd < 1.5) add('danger', '🍖', `Comida acaba em ${Math.max(0.5, Math.min(fl, fd)).toFixed(1)} dia(s)`, 'food');
  else if (fl < 6 || fd < 4) add('warn', '🍖', `Comida baixa: ~${Math.min(fl, fd).toFixed(1)} dias`, 'food');
  else add('ok', '🍖', `Comida para ${fd > 60 ? '60+' : Math.floor(fd)} dias`, 'food');
  if (s.res.water <= 0.5) add('danger', '💧', 'Sem água! Doenças e sede.', 'water');
  else if (wl < 2.5 || wd < 1.5) add('danger', '💧', `Água acaba em ${Math.max(0.5, Math.min(wl, wd)).toFixed(1)} dia(s)`, 'water');
  else if (wl < 6 || wd < 4) add('warn', '💧', `Água baixa: ~${Math.min(wl, wd).toFixed(1)} dias`, 'water');
  // inverno
  const daysToWinter = th.season === 3 ? 0 : (3 - th.season) * SEASON_DAYS - th.dOfSeason;
  if (th.season === 2 || (th.season === 1 && th.dOfSeason >= 3)) {
    const needFood = cons * SEASON_DAYS * 0.9, needWood = s.people.length * 0.35 * SEASON_DAYS;
    const okFood = s.res.food >= needFood * 0.8, okWood = s.res.wood >= needWood;
    add(okFood && okWood ? 'warn' : 'danger', '❄️', `Inverno em ${daysToWinter} dia(s): ${okFood ? 'comida ok' : `faltam ~${Math.ceil(needFood - s.res.food)} de comida`}, ${okWood ? 'lenha ok' : `faltam ~${Math.ceil(needWood - s.res.wood)} de lenha`}`, 'winter');
  } else if (th.season === 3) {
    if (s._cold) add('danger', '🥶', 'Sem lenha: o povo está congelando!', 'cold');
    else add('warn', '❄️', 'Inverno: sem colheita. Use o estoque e a caça.', 'winter');
  }
  // armazenamento
  for (const r of ['wood', 'stone', 'food', 'water', 'planks', 'iron']) {
    if (s.res[r] >= capOf(s, r) * 0.97 && capOf(s, r) > 0 && (RES[r].tier === 1 || s.res[r] > 5)) { add('warn', '📦', `${RES[r].name} no limite — construa depósitos`, 'cap_' + r); break; }
  }
  // moradia
  const d = s._d;
  if (d && s.people.length > d.beds) add('warn', '🏠', `${s.people.length - d.beds} sem cama — construa moradias`, 'beds');
  const j = avgJoy(s);
  if (j < 25) add('danger', '😠', 'Povo revoltado! Risco de rebelião e fugas.', 'joy');
  else if (j < 42) add('warn', '😟', `Felicidade baixa (${Math.round(j)})`, 'joy');
  else if (s.people.length > 3) add('ok', '😊', `Povo ${j > 70 ? 'feliz' : 'satisfeito'} (${Math.round(j)})`, 'joy');
  const sick = s.people.filter(p => p.sick > 0).length;
  if (sick) add(sick >= 3 ? 'danger' : 'warn', '🤒', `${sick} morador(es) doente(s)`, 'sick');
  for (const t of s.threats) {
    const eta = Math.max(0, t.at - s.t) / DAY_LEN;
    const dp = defensePower(s);
    add(dp < t.power ? 'danger' : 'warn', t.kind === 'wolves' ? '🐺' : '⚔️', `${t.label} em ${Math.ceil(eta * 24)}h — defesa ${Math.round(dp)} vs ${Math.round(t.power)}`, 'threat' + t.id);
  }
  if (s.ev.pending.length) add('warn', '❗', 'Há uma decisão aguardando você!', 'event');
  if (s.era >= 3 && s.res.tools < 1 && countB(s, 'smithy')) add('warn', '🔧', 'Sem ferramentas: produção −15%', 'tools');
  const free = s.people.filter(p => p.job === 'livre' && p.age >= ADULT_AGE).length;
  if (free >= 3) add('warn', '🙂', `${free} moradores livres — atribua profissões`, 'free');
  const order = { danger: 0, warn: 1, ok: 2 };
  out.sort((a, b) => order[a.level] - order[b.level]);
  return out;
}
