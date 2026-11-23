// planner.js — urbanismo automático: onde construir (distritos organizados) e o que construir quando o jogador está ausente.
// Regras de economia: só gasta o excedente (mantém reservas), no máximo 2 obras abertas, e nunca constrói com fome/sede crítica.

import { BUILDINGS, SEASON_DAYS } from './data.js';
import { CENTER, unlocked, countB } from './state.js';
import { footprintOk, placeBuilding } from './sim.js';
import { chron, foodDays, waterDays, avgJoy, capOf, adultsOf } from './core.js';

// Distritos: ângulo central (graus, 0 = leste, 90 = sul), abertura, faixa de raio (em tiles) e tipos
export const ZONES = {
  res: { name: 'Bairro residencial', ang: 180, spread: 55, rmin: 5, rmax: 15, types: ['shelter', 'house'] },
  civic: { name: 'Centro cívico', ang: 90, spread: 60, rmin: 4, rmax: 11, types: ['market', 'tavern', 'storehouse', 'gatherpoint', 'well', 'loom'] },
  ind: { name: 'Distrito industrial', ang: 0, spread: 55, rmin: 6, rmax: 15, types: ['sawmill', 'smithy', 'mine', 'jeweler'] },
  farm: { name: 'Zona agrícola', ang: -90, spread: 60, rmin: 7, rmax: 18, types: ['farm'] },
  grand: { name: 'Distrito real', ang: -135, spread: 45, rmin: 8, rmax: 18, types: ['castle', 'cathedral', 'academy', 'monument', 'wonder'] },
  mil: { name: 'Distrito militar', ang: 45, spread: 40, rmin: 9, rmax: 17, types: ['barracks'] },
  port: { name: 'Orla', ang: -34, spread: 70, rmin: 6, rmax: 24, types: ['port'] },
};
export const zoneOf = type => Object.values(ZONES).find(z => z.types.includes(type)) || null;
const angDiff = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const polar = (cx, cy) => { const dx = cx - CENTER.x, dy = cy - CENTER.y; return { r: Math.hypot(dx, dy), a: Math.atan2(dy, dx) * 180 / Math.PI }; };

/** O prédio já está num lugar coerente com seu distrito? */
export function inZone(b) {
  const z = zoneOf(b.type); if (!z) return true;
  const { r, a } = polar(b.x + b.w / 2, b.y + b.h / 2);
  return r >= z.rmin - 1.5 && r <= z.rmax + 2.5 && angDiff(a, z.ang) <= z.spread + 20;
}

// Avenidas livres (cruz central) e praça da fogueira
const onAvenue = (x, y, w, h) => (x < CENTER.x + 1 && x + w > CENTER.x - 1) || (y < CENTER.y + 1 && y + h > CENTER.y - 1);
function clearOf(s, ignore, x, y, w, h, m) {
  for (const b of s.buildings) {
    if (b === ignore || b.type === 'road') continue;
    if (b.x < x + w + m && b.x + b.w > x - m && b.y < y + h + m && b.y + b.h > y - m) return false;
  }
  return true;
}

/** Procura o melhor lugar: grade alinhada ao centro, dentro do distrito, com 1 tile de folga entre prédios. */
export function findSlot(s, type, ignore = null) {
  const d = BUILDINGS[type], z = zoneOf(type);
  const rmax = Math.min(z ? z.rmax : 24, 40);
  const gx = type === 'port' ? 1 : Math.max(4, d.w + 1), gy = type === 'port' ? 1 : Math.max(3, d.h + 1);
  const saved = ignore ? s.buildings.splice(s.buildings.indexOf(ignore), 1) : null;
  let best = null;
  try {
    for (let margin = 1; margin >= 0 && !best; margin--) {
      let bs = 1e9;
      for (let y = Math.floor(CENTER.y - rmax); y <= CENTER.y + rmax; y++) {
        if ((y - Math.floor(CENTER.y)) % gy !== 0) continue;
        for (let x = Math.floor(CENTER.x - rmax); x <= CENTER.x + rmax; x++) {
          if ((x - Math.floor(CENTER.x)) % gx !== 0) continue;
          const { r, a } = polar(x + d.w / 2, y + d.h / 2);
          if (r < (z ? z.rmin : 4) - 0.5 || r > rmax + 0.5) continue;
          if (onAvenue(x, y, d.w, d.h) && !d.road) continue;
          const ad = z ? angDiff(a, z.ang) : 0;
          if (z && ad > z.spread + (margin ? 0 : 40)) continue;
          const sc = r * 0.25 + ad * 0.12 + Math.abs(r - ((z ? z.rmin : 4) + 2)) * 0.1;
          if (sc >= bs) continue;
          if (footprintOk(s, type, x, y)) continue;
          if (!clearOf(s, ignore, x, y, d.w, d.h, margin)) continue;
          bs = sc; best = [x, y];
        }
      }
    }
  } finally { if (saved) s.buildings.push(...saved); }
  return best;
}

// ---------- Orçamento seguro ----------
function reserves(s) {
  const pop = s.people.length;
  return { wood: Math.max(20, pop * 0.35 * SEASON_DAYS * 0.6), stone: 10, planks: 10, gold: 40, iron: 10, tools: 0, weapons: 0, cloth: 0, jewels: 0, food: 0, water: 0 };
}
function affordSafely(s, cost, frac = 0.7) {
  const rs = reserves(s);
  for (const r in cost) { const have = s.res[r]; if (have < cost[r]) return false; if (have - cost[r] < (rs[r] || 0)) return false; if (cost[r] > have * frac && cost[r] > 12) return false; }
  return true;
}

// ---------- O que construir quando ausente ----------
export function autoBuild(s) {
  if (!s.policies.autoBuild) return null;
  const a = autoBuildOnce(s);
  return a || null;
}
function autoBuildOnce(s) {
  const open = s.buildings.filter(b => !b.done && b.type !== 'road' && b.type !== 'wall').length;
  if (open >= 3) return null;
  const pop = s.people.length, d = s._d; if (!d || pop < 2) return null;
  const fd = foodDays(s), wd = waterDays(s);
  const have = t => s.buildings.filter(b => b.type === t).length;
  const pending = t => s.buildings.some(b => b.type === t && !b.done);
  const rate = r => s.rates[r] || 0;
  const era = s.era;
  const storageN = have('storehouse') + have('gatherpoint');
  const full = ['wood', 'stone', 'food', 'water'].some(r => s.res[r] >= capOf(s, r) * 0.92);
  const L = [];   // [tipo, condição, relaxado?]
  if (d.beds < pop - 1 && fd >= 2 && wd >= 1.5) L.push([era >= 2 ? 'house' : 'shelter', true, true]); // gente sem cama: moradia primeiro
  if (wd < 3 && era >= 2) L.push(['well', have('well') < 4, true]);
  if (fd < 4 && era >= 2) L.push(['farm', have('farm') < Math.ceil(pop / 8) + 1, true]);
  const calm = fd >= 3 && wd >= 2;
  L.push([era >= 2 ? 'house' : 'shelter', calm && d.beds < pop + 2 && pop < 400, true]);
  L.push([era >= 2 ? 'storehouse' : 'gatherpoint', full && storageN < 1 + pop / 14, false]);
  if (era >= 2) {
    L.push(['farm', have('farm') < Math.ceil(pop / 9) && (fd < 14 || rate('food') < 0), false]);
    L.push(['well', have('well') < Math.max(1, Math.ceil(pop / 20)) && (wd < 14 || rate('water') < 0), false]);
    L.push(['sawmill', pop >= 10 && !have('sawmill'), false]);
  }
  if (era >= 3) {
    L.push(['market', pop >= 18 && !have('market'), false]);
    L.push(['tavern', (pop >= 20 || avgJoy(s) < 55) && !have('tavern'), false]);
    L.push(['smithy', pop >= 22 && !have('smithy'), false]);
    L.push(['mine', pop >= 22 && s.flags.ore && !have('mine'), false]);
    L.push(['loom', pop >= 25 && !have('loom'), false]);
    L.push(['barracks', pop >= 25 && !have('barracks') && (s.threats.length > 0 || (s.world?.kingdoms || []).some(k => k.known && k.pers === 'agressivo')), false]);
  }
  if (era >= 4) {
    L.push(['castle', pop >= 45 && !have('castle'), false]);
    L.push(['cathedral', pop >= 50 && !have('cathedral'), false]);
    L.push(['academy', pop >= 50 && !have('academy'), false]);
    L.push(['jeweler', pop >= 55 && !have('jeweler'), false]);
    L.push(['port', pop >= 50 && !have('port'), false]);
  }
  for (const [type, cond, relaxed] of L) {
    if (!cond || !unlocked(s, type) || pending(type)) continue;
    const def = BUILDINGS[type];
    if (def.unique && have(type)) continue;
    if (!affordSafely(s, def.cost, relaxed ? 0.9 : 0.7)) continue;
    const slot = findSlot(s, type); if (!slot) continue;
    const b = placeBuilding(s, type, slot[0], slot[1]);
    if (b) {
      const z = zoneOf(type);
      chron(s, `Sem o líder por perto, o conselho mandou erguer ${def.name}${z ? ` (${z.name})` : ''}.`, 'build');
      (s._autoBuilt ||= []).push(def.name);
      return b;
    }
  }
  return null;
}

// ---------- Realocação das obras do jogador ----------
/** Obras posicionadas manualmente que ficaram fora do distrito são reorganizadas (grátis se em obra; 25% do custo se prontas). */
export function tidyManual(s) {
  const moved = [];
  for (const b of [...s.buildings]) {
    if (!b.manual) continue;
    b.manual = false;
    if (['campfire', 'road', 'wall'].includes(b.type) || !zoneOf(b.type) || inZone(b)) continue;
    const def = BUILDINGS[b.type];
    let fee = null;
    if (b.done) { fee = {}; for (const r in def.cost) fee[r] = Math.ceil(def.cost[r] * 0.25); if (!affordSafely(s, fee, 0.9)) continue; }
    const slot = findSlot(s, b.type, b); if (!slot) continue;
    if (fee) for (const r in fee) s.res[r] = Math.max(0, s.res[r] - fee[r]);
    for (const n of s.nodes) if (n.type === 'tree' && n.st !== 'removed') { const nx = Math.floor(n.x), ny = Math.floor(n.y); if (nx >= slot[0] && nx < slot[0] + b.w && ny >= slot[1] && ny < slot[1] + b.h) n.st = 'removed'; }
    s.nodes = s.nodes.filter(n => n.st !== 'removed');
    const z = zoneOf(b.type);
    b.x = slot[0]; b.y = slot[1];
    moved.push(`${def.name} → ${z.name}`);
    chron(s, `${def.name} foi realocado(a) para o ${z.name.toLowerCase()}, para manter o reino organizado.`, 'build');
    s._dirty = true;
  }
  if (moved.length) (s._moved ||= []).push(...moved);
  return moved;
}
