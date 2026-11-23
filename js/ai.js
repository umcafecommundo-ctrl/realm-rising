// ai.js — comportamento dos moradores (tarefas, movimento) e dos animais (modo "ao vivo")
// Em modo offline estas rotinas NÃO são usadas: sim.js usa um modelo abstrato com as mesmas taxas.

import { TILE, DAY_LEN, ADULT_AGE, OUT_RATE, CARRY, BUILDINGS, MAP_W, MAP_H, UNITS } from './data.js';
import { findPath } from './path.js';
import { addRes, floatText, personMult, globalMult, gainSkill, foodDays, waterDays, bus } from './core.js';
import { CENTER, isWater, eraRadius, techFx, isNight } from './state.js';
import { rnd, pick, clamp, dist } from './util.js';

const SPEED = 38;
const ctr = () => ({ x: CENTER.x * TILE, y: CENTER.y * TILE });

// ---------- Utilidades de movimento ----------
function goTo(s, p, x, y) {
  const path = findPath(s, p.x, p.y, x, y);
  p.rt.path = path && path.length ? path : [{ x, y }];
  p.rt.pi = 0; p.rt.stuck = 0;
}
/** Segue o caminho. Retorna true ao chegar. */
function follow(s, p, dt, th) {
  const rt = p.rt, path = rt.path;
  if (!path || rt.pi >= path.length) { rt.anim = 'idle'; return true; }
  const tgt = path[rt.pi];
  const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy);
  let sp = SPEED * (p.age < ADULT_AGE ? 0.85 : 1) * (rt.carry ? 0.9 : 1);
  if (th.season === 3) sp *= 0.85;
  if (s.weather.type === 'storm') sp *= 0.85;
  if (s._roadSet && s._roadSet.has(Math.floor(p.y / TILE) * MAP_W + Math.floor(p.x / TILE))) sp *= 1.45;
  if (p.sick > 0) sp *= 0.8;
  const step = sp * dt;
  if (d <= step) { p.x = tgt.x; p.y = tgt.y; rt.pi++; }
  else { p.x += dx / d * step; p.y += dy / d * step; rt.stuck += dt; }
  if (Math.abs(dx) > 0.5) rt.face = dx > 0 ? 1 : -1;
  rt.anim = 'walk';
  return rt.pi >= path.length;
}

const front = (b, i = 0) => ({ x: (b.x + b.w * (0.25 + ((i * 0.37) % 0.5))) * TILE, y: (b.y + b.h) * TILE + 12 });
const center = b => ({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2) * TILE });

export function nearestDrop(s, x, y) {
  let best = null, bd = 1e9;
  for (const d of s._drops || []) { const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } }
  return best || ctr();
}

// ---------- Busca de recursos ----------
function findNode(s, p, type, maxR) {
  const R = (maxR || eraRadius(s) + 3) * TILE;
  const c = ctr();
  let best = null, bd = 1e9;
  for (const n of s.nodes) {
    if (n.type !== type) continue;
    if (type === 'tree' && n.st !== 'alive') continue;
    if (n.amt <= 0.01 || (n.rsv || 0) >= (type === 'tree' ? 1 : 2)) continue;
    if (type === 'bush' && n.amt < 1) continue;
    const nx = n.x * TILE, ny = n.y * TILE;
    if (Math.hypot(nx - c.x, ny - c.y) > R) continue;
    const d = Math.hypot(nx - p.x, ny - p.y) + Math.random() * 60;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function findWaterSpot(s, p) {
  let best = null, bd = 1e9;
  const c = ctr();
  // varre uma janela ao redor da base procurando margem
  for (let y = 2; y < MAP_H - 2; y += 1) for (let x = 2; x < MAP_W - 2; x += 1) {
    if (isWater(s, x, y) || s._blocked[y * MAP_W + x]) continue;
    if (!(isWater(s, x + 1, y) || isWater(s, x - 1, y) || isWater(s, x, y + 1) || isWater(s, x, y - 1))) continue;
    const px = (x + 0.5) * TILE, py = (y + 0.5) * TILE;
    if (Math.hypot(px - c.x, py - c.y) > (eraRadius(s) + 8) * TILE) continue;
    const d = Math.hypot(px - p.x, py - p.y) + Math.random() * 80;
    if (d < bd) { bd = d; best = { x: px, y: py, wx: isWater(s, x + 1, y) ? 1 : isWater(s, x - 1, y) ? -1 : 0 }; }
  }
  return best;
}
function findDeer(s, p) {
  let best = null, bd = 1e9;
  for (const a of s._animals || []) {
    if (a.type !== 'deer' || a.dead || a.rsv) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function findSite(s, p) {
  let best = null, bd = 1e9;
  for (const b of s.buildings) {
    if (b.done) continue;
    const d = Math.hypot(center(b).x - p.x, center(b).y - p.y) - (b._builders || 0) * 40;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Profissão efetiva de um morador "livre": decide pelo que está mais faltando */
export function autoJob(s) {
  const fd = foodDays(s), wd = waterDays(s);
  const critical = wd < 1.5 || fd < 2;
  const sites = s.buildings.some(b => !b.done);
  if (sites && !critical) {
    // no máximo metade dos livres ajuda na obra enquanto não houver construtores
    const builders = s.people.filter(q => q.job === 'construtor').length;
    const helping = s.people.filter(q => q.job === 'livre' && q.rt?.task?.k === 'build').length;
    const livres = s.people.filter(q => q.job === 'livre' && q.age >= ADULT_AGE).length;
    if (builders === 0 && helping < Math.max(1, Math.ceil(livres / 2))) return 'construtor';
  }
  if (wd < 2.5 && wd <= fd) return 'water';
  if (fd < 4) return s._season === 3 ? 'cacador' : 'coletor';
  if (s.res.wood < 25) return 'lenhador';
  if (s.res.stone < 14) return 'pedreiro';
  if (wd < 6) return 'water';
  return pick(['lenhador', 'coletor', 'lenhador']);
}

// ---------- Decisão de tarefa ----------
function think(s, p, th) {
  const night = isNight(th.hour);
  if (p.n.sleep < 10 || (night && p.n.sleep < 97)) return { k: 'sleep' };
  if (p.n.hunger < 36 && s.res.food > 0.2) return { k: 'eat' };
  if (p.age < ADULT_AGE) return { k: 'play' };
  let job = p.job;
  const mult = job === 'livre' ? 0.7 : 1;
  if (job === 'livre') job = autoJob(s);
  const wp = p.workplace && s.buildings.find(b => b.id === p.workplace && b.done && b.enabled);
  const winter = th.season === 3;

  if (job === 'construtor') {
    const site = findSite(s, p);
    if (site) { site._builders = (site._builders || 0) + 1; return { k: 'build', b: site, mult, ph: 'go' }; }
  } else if (wp && p.job !== 'livre') {
    return { k: 'work', b: wp, ph: 'go', t: 0 };
  }
  switch (job) {
    case 'lenhador': {
      const n = findNode(s, p, 'tree'); if (n) { n.rsv = (n.rsv || 0) + 1; return { k: 'gather', node: n, res: 'wood', job: 'lenhador', mult, ph: 'go' }; }
      break; }
    case 'pedreiro': {
      const n = findNode(s, p, 'rock'); if (n) { n.rsv = (n.rsv || 0) + 1; return { k: 'gather', node: n, res: 'stone', job: 'pedreiro', mult, ph: 'go' }; }
      break; }
    case 'coletor': case 'water': {
      const wantWater = job === 'water' || waterDays(s) < 5 || waterDays(s) < foodDays(s) * 0.9 || winter;
      if (!wantWater && !winter) { const n = findNode(s, p, 'bush'); if (n) { n.rsv = (n.rsv || 0) + 1; return { k: 'gather', node: n, res: 'food', job: 'coletor', mult, ph: 'go' }; } }
      const sp = findWaterSpot(s, p); if (sp) return { k: 'water', spot: sp, mult, ph: 'go', job: 'coletor' };
      break; }
    case 'cacador': {
      const a = findDeer(s, p);
      if (a) { a.rsv = true; return { k: 'hunt', a, mult, ph: 'go', t: 0 }; }
      if (!winter) { const n = findNode(s, p, 'bush'); if (n) { n.rsv = (n.rsv || 0) + 1; return { k: 'gather', node: n, res: 'food', job: 'cacador', mult: 0.6, ph: 'go' }; } }
      break; }
    case 'agricultor': {
      const farm = s.buildings.find(b => b.type === 'farm' && b.done);
      if (farm) return { k: 'work', b: farm, ph: 'go', t: 0 };
      break; }
    case 'soldado': return { k: 'drill', ph: 'go', t: 0 };
    case 'sabio': case 'comerciante': case 'ferreiro': {
      const c = ctr(); return { k: 'wander', x: c.x + rnd(-80, 80), y: c.y + rnd(30, 110), ph: 'go', t: rnd(2, 5) };
    }
  }
  // sem nada útil: perambula perto da fogueira
  const c = ctr();
  return { k: 'wander', x: c.x + rnd(-140, 140), y: c.y + rnd(-90, 130), ph: 'go', t: rnd(2, 6) };
}

function release(s, t) {
  if (!t) return;
  if (t.node && t.node.rsv) t.node.rsv = Math.max(0, t.node.rsv - 1);
  if (t.a) t.a.rsv = false;
  if (t.k === 'build' && t.b && t.b._builders) t.b._builders--;
}

// ---------- Execução de tarefas ----------
function deposit(s, p) {
  const c = p.rt.carry;
  if (!c) return;
  const real = addRes(s, c.res, c.amt);
  if (real > 0.4) floatText(p.x, p.y - 22, `+${Math.round(real)}`, '#fff', c.res);
  else if (real < c.amt - 0.4 && s.t - (s._fullMsg || -9) > 5) { s._fullMsg = s.t; floatText(p.x, p.y - 22, 'Armazém cheio!', '#ff9b7a'); }
  p.rt.carry = null;
}

function run(s, p, t, dt, th) {
  const rt = p.rt;
  switch (t.k) {
    case 'sleep': {
      if (t.ph === undefined) {
        t.ph = 'go';
        const home = p.home && s.buildings.find(b => b.id === p.home && b.done);
        if (home) { const f = front(home, p.id); t.bed = { x: f.x, y: f.y }; t.inside = true; }
        else { const a = (p.id * 2.399) % (Math.PI * 2); t.bed = { x: CENTER.x * TILE + Math.cos(a) * 46, y: CENTER.y * TILE + Math.sin(a) * 34 + 8 }; }
        goTo(s, p, t.bed.x, t.bed.y);
      }
      if (t.ph === 'go') { if (follow(s, p, dt, th)) { t.ph = 'zz'; if (t.inside) rt.inside = true; } break; }
      rt.anim = 'sleep';
      if (rt.carry && !t.inside) { /* dorme com a carga ao lado */ }
      if (!isNight(th.hour) && p.n.sleep > 55 || p.n.sleep >= 100) { t.done = true; rt.inside = false; }
      break; }
    case 'eat': {
      if (t.ph === undefined) {
        t.ph = 'go'; const d = nearestDrop(s, p.x, p.y); goTo(s, p, d.x + rnd(-14, 14), d.y + rnd(0, 12));
      }
      if (t.ph === 'go') { if (follow(s, p, dt, th)) { t.ph = 'eat'; t.t = 0; } break; }
      rt.anim = 'eat'; t.t += dt;
      if (t.t > 1.6) { eatNow(s, p); deposit(s, p); t.done = true; }
      break; }
    case 'play': case 'wander': {
      if (t.ph === undefined) { t.ph = 'go'; const c = ctr(); t.x = t.x ?? c.x + rnd(-160, 160); t.y = t.y ?? c.y + rnd(-110, 150); t.t = rnd(1.5, 5); }
      if (t.ph === 'go') { if (!rt.path || rt.pi === undefined || t.fresh !== true) { goTo(s, p, t.x, t.y); t.fresh = true; } if (follow(s, p, dt, th)) t.ph = 'idle'; break; }
      rt.anim = 'idle'; t.t -= dt; if (t.t <= 0) t.done = true;
      break; }
    case 'gather': {
      const n = t.node;
      if (t.ph === 'go') {
        if (!n || n.amt <= 0.01 || (n.type === 'tree' && n.st !== 'alive')) { t.ph = rt.carry ? 'back' : 'end'; break; }
        if (!t.pathSet) { goTo(s, p, n.x * TILE + (p.x < n.x * TILE ? -12 : 12), n.y * TILE + 8); t.pathSet = true; }
        if (follow(s, p, dt, th)) { t.ph = 'work'; rt.face = p.x < n.x * TILE ? 1 : -1; }
        break;
      }
      if (t.ph === 'work') {
        if (!n || n.amt <= 0.01 || (n.type === 'tree' && n.st !== 'alive')) { t.ph = rt.carry ? 'back' : 'end'; break; }
        if (n.type === 'bush' && th.season === 3) { t.ph = rt.carry ? 'back' : 'end'; break; }
        const cur = rt.carry || (rt.carry = { res: t.res, amt: 0 });
        const cap = CARRY[t.res] || 4;
        const base = (t.job === 'cacador' ? OUT_RATE.cacador : OUT_RATE[t.job]) / DAY_LEN;
        const tm = 1 + techFx(s, t.res === 'wood' ? 'wood' : t.res === 'stone' ? 'stone' : 'zz');
        const rate = base * t.mult * personMult(s, p, t.job) * globalMult(s) * tm * (s._workMult || 1);
        const take = Math.min(rate * dt, n.amt, cap - cur.amt);
        n.amt -= take; cur.amt += take; gainSkill(p, t.job, dt);
        rt.anim = n.type === 'tree' ? 'chop' : n.type === 'rock' ? 'mine' : 'pick';
        n.hit = (n.hit || 0) + dt; n.lastHit = s.t;
        if (n.type === 'tree' && n.amt <= 0.01) { n.st = 'falling'; n.fallT = 0; n.fallDir = p.x < n.x * TILE ? 1 : -1; n.t = s.t; bus.emit('treefall', n); }
        if (cur.amt >= cap - 0.01 || n.amt <= 0.01) t.ph = 'back';
        break;
      }
      if (t.ph === 'back') {
        if (!t.backSet) { const d = nearestDrop(s, p.x, p.y); goTo(s, p, d.x + rnd(-12, 12), d.y + rnd(0, 10)); t.backSet = true; }
        if (follow(s, p, dt, th)) { deposit(s, p); t.done = true; }
        break;
      }
      t.done = true; break; }
    case 'water': {
      if (t.ph === 'go') {
        if (!t.pathSet) { goTo(s, p, t.spot.x, t.spot.y); t.pathSet = true; }
        if (follow(s, p, dt, th)) { t.ph = 'work'; rt.face = t.spot.wx || 1; }
        break;
      }
      if (t.ph === 'work') {
        const cur = rt.carry || (rt.carry = { res: 'water', amt: 0 });
        const rate = OUT_RATE.water / DAY_LEN * t.mult * personMult(s, p, 'coletor') * globalMult(s);
        cur.amt += rate * dt; rt.anim = 'fill'; gainSkill(p, 'coletor', dt);
        if (cur.amt >= CARRY.water) t.ph = 'back';
        break;
      }
      if (t.ph === 'back') {
        if (!t.backSet) { const d = nearestDrop(s, p.x, p.y); goTo(s, p, d.x + rnd(-12, 12), d.y + rnd(0, 10)); t.backSet = true; }
        if (follow(s, p, dt, th)) { deposit(s, p); t.done = true; }
      }
      break; }
    case 'hunt': {
      const a = t.a;
      if (!a || a.dead && t.ph !== 'back') { if (t.ph !== 'back') { t.done = true; break; } }
      if (t.ph === 'go') {
        t.t += dt;
        if (t.t > 0.7 || !rt.path) { goTo(s, p, a.x, a.y); t.t = 0; }
        follow(s, p, dt, th);
        if (Math.hypot(a.x - p.x, a.y - p.y) < 20) { t.ph = 'kill'; t.t = 0; rt.face = a.x > p.x ? 1 : -1; }
        if (a.scared > 0 && Math.hypot(a.x - p.x, a.y - p.y) > 400) t.done = true;
        break;
      }
      if (t.ph === 'kill') {
        rt.anim = 'spear'; t.t += dt; a.scared = 4;
        if (t.t > 1.1) {
          a.dead = true; a.deadT = 0; gainSkill(p, 'cacador', 4);
          const amt = 7 * (1 + techFx(s, 'hunt')) * personMult(s, p, 'cacador') * t.mult;
          rt.carry = { res: 'food', amt }; t.ph = 'back';
        }
        break;
      }
      if (t.ph === 'back') {
        if (!t.backSet) { const d = nearestDrop(s, p.x, p.y); goTo(s, p, d.x + rnd(-12, 12), d.y + rnd(0, 10)); t.backSet = true; }
        if (follow(s, p, dt, th)) { deposit(s, p); t.done = true; }
      }
      break; }
    case 'build': {
      const b = t.b;
      if (!b || b.done || !s.buildings.includes(b)) { t.done = true; break; }
      if (t.ph === 'go') {
        if (!t.pathSet) { const f = front(b, p.id); goTo(s, p, f.x, f.y); t.pathSet = true; }
        if (follow(s, p, dt, th)) t.ph = 'work';
        break;
      }
      rt.anim = 'hammer'; rt.face = center(b).x > p.x ? 1 : -1;
      const def = BUILDINGS[b.type];
      const speed = (1 + techFx(s, 'build')) * personMult(s, p, 'construtor') * t.mult * (s._workMult || 1);
      b.wk += dt * speed; b.prog = Math.min(1, b.wk / def.work); b._lastWork = s.t;
      gainSkill(p, 'construtor', dt);
      if (b.prog >= 1) { s._completed = s._completed || []; s._completed.push(b); t.done = true; }
      break; }
    case 'work': {
      const b = t.b;
      if (!b || !b.done || !b.enabled) { t.done = true; break; }
      if (t.ph === 'go') {
        if (!t.pathSet) {
          let pt = front(b, p.id);
          if (b.type === 'farm') pt = { x: (b.x + 0.5 + Math.random() * (b.w - 1)) * TILE, y: (b.y + 0.5 + Math.random() * (b.h - 1)) * TILE };
          goTo(s, p, pt.x, pt.y); t.pathSet = true;
        }
        if (follow(s, p, dt, th)) { t.ph = 'work'; t.t = rnd(3, 6); }
        break;
      }
      rt.working = b.id; rt.face = center(b).x > p.x ? 1 : -1;
      rt.anim = b.type === 'farm' ? 'hoe' : b.type === 'sawmill' ? 'saw' : b.type === 'smithy' ? 'hammer' : b.type === 'mine' ? 'mine' : b.type === 'jeweler' ? 'hammer' : 'craft';
      gainSkill(p, p.job, dt);
      t.t -= dt; if (t.t <= 0 && b.type === 'farm') { t.done = true; }
      break; }
    case 'drill': {
      const bk = s.buildings.find(b => b.type === 'barracks' && b.done);
      if (t.ph === 'go') {
        if (!t.pathSet) { const f = bk ? front(bk, p.id) : { x: CENTER.x * TILE + 60, y: CENTER.y * TILE + 40 }; goTo(s, p, f.x + rnd(-30, 30), f.y + rnd(0, 24)); t.pathSet = true; }
        if (follow(s, p, dt, th)) { t.ph = 'work'; t.t = rnd(6, 12); }
        break;
      }
      rt.anim = 'spear'; rt.face = 1; gainSkill(p, 'soldado', dt * 0.8); t.t -= dt; if (t.t <= 0) t.done = true;
      break; }
    default: t.done = true;
  }
}

export function eatNow(s, p, offline = false) {
  const need = (100 - p.n.hunger) / 70;
  let cons = need * (s.policies.ration ? 0.7 : 1) * (1 + techFx(s, 'consume'));
  const f = Math.min(cons, s.res.food);
  addRes(s, 'food', -f, { noStat: true });
  const w = Math.min(cons, s.res.water);
  addRes(s, 'water', -w, { noStat: true });
  p.thirst = w < cons * 0.5;
  p.n.hunger = f >= cons * 0.8 ? 100 : p.n.hunger + (f / cons) * (100 - p.n.hunger);
}

// ---------- Atualização de uma pessoa ----------
export function updatePerson(s, p, dt, th) {
  const rt = p.rt;
  if (p.away > 0) { p.away -= dt; rt.inside = true; return; }
  rt.inside = rt.inside && rt.task?.k === 'sleep';
  rt.t = (rt.t || 0) + dt;
  rt.working = null;
  // reavaliação de prioridades
  rt.chk = (rt.chk || 0) - dt;
  if (rt.task && rt.chk <= 0) {
    rt.chk = 0.6;
    const k = rt.task.k;
    const night = isNight(th.hour);
    if (k !== 'sleep' && (p.n.sleep < 10 || (night && p.n.sleep < 97))) { release(s, rt.task); rt.task = null; }
    else if (k !== 'sleep' && k !== 'eat' && p.n.hunger < 30 && s.res.food > 0.2) { release(s, rt.task); rt.task = null; }
    else if (k === 'sleep' && rt.task.ph === 'zz' && !night && p.n.sleep > 55) { rt.task.done = true; }
  }
  if (!rt.task || rt.task.done) {
    release(s, rt.task);
    rt.task = think(s, p, th);
    rt.anim = 'idle';
  }
  run(s, p, rt.task, dt, th);
  if (rt.stuck > 6) { rt.stuck = 0; if (rt.path && rt.path[rt.pi]) { p.x = rt.path[rt.pi].x; p.y = rt.path[rt.pi].y; rt.pi++; } }
  // mantém dentro do mapa
  p.x = clamp(p.x, TILE, (MAP_W - 1) * TILE); p.y = clamp(p.y, TILE, (MAP_H - 1) * TILE);
}

// ---------- Animais ----------
export function updateAnimals(s, dt, th) {
  const an = s._animals || (s._animals = []);
  const c = ctr();
  s._animTimer = (s._animTimer || 0) - dt;
  if (s._animTimer <= 0) {
    s._animTimer = 6;
    const deer = an.filter(a => a.type === 'deer' && !a.dead).length;
    const want = 6 + Math.floor(s.era / 2) * 2;
    if (deer < want && an.length < 40) {
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2, r = rnd(10, 20);
        const x = Math.floor(CENTER.x + Math.cos(a) * r), y = Math.floor(CENTER.y + Math.sin(a) * r * 0.85);
        if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2 || s._blocked[y * MAP_W + x]) continue;
        an.push({ type: 'deer', x: x * TILE, y: y * TILE, tx: x * TILE, ty: y * TILE, wait: rnd(0, 3), face: 1, scared: 0, fawn: Math.random() < 0.25 });
        break;
      }
    }
  }
  for (let i = an.length - 1; i >= 0; i--) {
    const a = an[i];
    if (a.dead) { a.deadT += dt; if (a.deadT > 0.6) an.splice(i, 1); continue; }
    if (a.type === 'deer') {
      a.scared = Math.max(0, a.scared - dt);
      // foge de pessoas muito próximas
      let fleeX = 0, fleeY = 0;
      for (const p of s.people) { const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < 70 && p.job !== 'cacador') { fleeX += (a.x - p.x) / d; fleeY += (a.y - p.y) / d; } }
      if (fleeX || fleeY) { a.tx = a.x + fleeX * 90; a.ty = a.y + fleeY * 90; a.scared = 1.5; a.wait = 0; }
      if (a.wait > 0) { a.wait -= dt; a.moving = false; continue; }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 4) { a.wait = rnd(2, 7); a.tx = a.x + rnd(-120, 120); a.ty = a.y + rnd(-90, 90); const gx = Math.floor(a.tx / TILE), gy = Math.floor(a.ty / TILE); if (gx < 2 || gy < 2 || gx >= MAP_W - 2 || gy >= MAP_H - 2 || s._blocked[gy * MAP_W + gx] || Math.hypot(a.tx - c.x, a.ty - c.y) < 150) { a.tx = a.x; a.ty = a.y; } a.moving = false; continue; }
      const sp = a.scared > 0 ? 80 : 18;
      const nx = a.x + dx / d * sp * dt, ny = a.y + dy / d * sp * dt;
      const gx = Math.floor(nx / TILE), gy = Math.floor(ny / TILE);
      if (gx < 1 || gy < 1 || gx >= MAP_W - 1 || gy >= MAP_H - 1 || s._blocked[gy * MAP_W + gx]) { a.tx = a.x; a.ty = a.y; continue; }
      a.x = nx; a.y = ny; a.face = dx > 0 ? 1 : -1; a.moving = true;
    }
  }
}
