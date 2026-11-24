// planner.js — urbanismo automático: onde construir (distritos organizados) e o que construir quando o jogador está ausente.
// Regras de economia: só gasta o excedente (mantém reservas), no máximo 2 obras abertas, e nunca constrói com fome/sede crítica.

import { BUILDINGS, SEASON_DAYS, ERAS } from './data.js';
import { CENTER, unlocked, countB, eraRadius } from './state.js';
import { footprintOk, placeBuilding, eraStatus, upgradeInfo, upgradeBuilding, moveBuilding } from './sim.js';
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
  const gx = type === 'port' ? 1 : Math.max(4, d.w + 1), gy = type === 'port' ? 1 : Math.max(3, d.h + 1);
  const saved = ignore ? s.buildings.splice(s.buildings.indexOf(ignore), 1) : null;
  let best = null;
  try {
    const stages = [[1, 0, 0], [0, 40, 0], [0, 180, 1], [0, 180, 2]];  // [folga, abertura extra, expansão de raio]
    for (const [margin, extra, grow] of stages) {
      if (best) break;
      const rmax = grow === 0 ? (z ? z.rmax : 24) : grow === 1 ? Math.max(z ? z.rmax : 24, eraRadius(s) - 2) : eraRadius(s) - 1;
      let bs = 1e9;
      for (let y = Math.floor(CENTER.y - rmax); y <= CENTER.y + rmax; y++) {
        if ((y - Math.floor(CENTER.y)) % gy !== 0) continue;
        for (let x = Math.floor(CENTER.x - rmax); x <= CENTER.x + rmax; x++) {
          if ((x - Math.floor(CENTER.x)) % gx !== 0) continue;
          const { r, a } = polar(x + d.w / 2, y + d.h / 2);
          if (r < (z ? z.rmin : 4) - 0.5 || r > rmax + 0.5) continue;
          if (onAvenue(x, y, d.w, d.h) && !d.road) continue;
          const ad = z ? angDiff(a, z.ang) : 0;
          if (z && ad > z.spread + extra) continue;
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
function reserves(s, k = 1) {
  const pop = s.people.length;
  return { wood: Math.max(15, pop * 0.35 * SEASON_DAYS * 0.6 * k), stone: 10 * k, planks: 10 * k, gold: 40 * k, iron: 10 * k, tools: 0, weapons: 0, cloth: 0, jewels: 0, food: 0, water: 0 };
}
function affordSafely(s, cost, frac = 0.7, k = 1) {
  const rs = reserves(s, k);
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
  // evolução de construções antigas (abrigo → casa, área de coleta → depósito) com excedente
  if (era >= 2 && !s.flags.noUp && !s.buildings.some(b => b.upgraded && !b.done)) {
    for (const b of s.buildings) {
      if (!b.done || !BUILDINGS[b.type].upgrade) continue;
      const info = upgradeInfo(s, b); if (!info || !info.ok) continue;
      if (info.to === 'storehouse' && !(have('storehouse') < 1 || capOf(s, 'food') < pop * SEASON_DAYS * 1.1)) continue;
      if (!affordSafely(s, info.cost, 0.8, d.beds < pop + 2 ? 0.4 : 1)) continue;
      if (upgradeBuilding(s, b)) { (s._autoBuilt ||= []).push(`${BUILDINGS[info.to].name} (evolução)`); return b; }
    }
  }
  // depósito junto às pedras: encurta a viagem dos pedreiros (a causa mais comum de pedra "parada")
  if (!s.buildings.some(b => b.type === 'gatherpoint' && b.pinned && !b.done) && (s.res.stone < capOf(s, 'stone') * 0.35 || (eraDeficits(s).stone))) {
    const rocks = s.nodes.filter(n => n.type === 'rock' && n.amt > 1 && Math.hypot(n.x - CENTER.x, n.y - CENTER.y) < eraRadius(s) + 3).sort((a, b) => Math.hypot(a.x - CENTER.x, a.y - CENTER.y) - Math.hypot(b.x - CENTER.x, b.y - CENTER.y));
    const far = rocks.filter(n => Math.hypot(n.x - CENTER.x, n.y - CENTER.y) > 9);
    const rk = far[0];
    const depotNear = rk && s.buildings.some(b => (b.type === 'gatherpoint' || b.type === 'storehouse') && b.done && Math.hypot(b.x + b.w / 2 - rk.x, b.y + b.h / 2 - rk.y) < 8);
    if (rk && !depotNear && affordSafely(s, BUILDINGS.gatherpoint.cost, 0.9, 0.3)) {
      let spot = null, bd = 1e9;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) {
        const x = Math.floor(rk.x) + dx, y = Math.floor(rk.y) + dy;
        const d = Math.hypot(dx, dy); if (d < 2.5 || d >= bd) continue;
        if (footprintOk(s, 'gatherpoint', x, y) || !clearOf(s, null, x, y, 3, 2, 0)) continue;
        bd = d; spot = [x, y];
      }
      if (spot) { const b = placeBuilding(s, 'gatherpoint', spot[0], spot[1]); if (b) { b.pinned = true; chron(s, 'Um depósito foi erguido junto às pedreiras para acelerar a mineração.', 'build'); (s._autoBuilt ||= []).push('Área de Coleta (pedreira)'); return b; } }
    }
  }
  const st = eraStatus(s);
  const saving = !!st && st.reqOk && !st.costOk;   // só falta juntar recursos: não gasta em extras
  const L = [];   // [tipo, condição, relaxado?]
  if (d.beds < pop - 1 && fd >= 2 && wd >= 1.5) L.push([era >= 2 ? 'house' : 'shelter', true, true]); // gente sem cama: moradia primeiro
  if (wd < 3 && era >= 2) L.push(['well', have('well') < 4, true]);
  if (fd < 4 && era >= 2) L.push(['farm', have('farm') < Math.ceil(pop / 8) + 1, true]);
  const foodCap = era >= 2 ? have('farm') * 20 + 8 : 12;   // população que a produção de comida sustenta (inclui o inverno)
  const calm = fd >= 6 && wd >= 3 && rate('food') > -4;
  L.push([era >= 2 ? 'house' : 'shelter', calm && d.beds < pop + 2 && pop + 2 <= foodCap * 1.15, true]);
  // o que falta para evoluir de era
  if (st) for (const [type, n] of Object.entries(ERAS[era + 1].req.buildings || {})) L.push([type, have(type) < n, 2]);
  const defs = eraDeficits(s);
  const capShort = Object.keys(defs).some(r => defs[r].target > capOf(s, r) * 0.98);   // o custo da era nem cabe no armazém
  const winterCap = capOf(s, 'food') < pop * SEASON_DAYS * 1.1 && pop >= 8; // estoque de comida não cobre um inverno
  L.push([era >= 2 ? 'storehouse' : 'gatherpoint', (winterCap && storageN < 10) || (capShort && storageN < 12) || (!saving && full && storageN < 1 + pop / 14), winterCap]);
  if (era >= 2) {
    L.push(['farm', (have('farm') < Math.ceil(pop / 7) + (pop >= 16 ? 1 : 0) && (fd < 20 || rate('food') < 0)) || pop + 4 > foodCap, true]);
    L.push(['well', have('well') < Math.max(1, Math.ceil(pop / 20)) && (wd < 14 || rate('water') < 0), true]);
    L.push(['sawmill', (!saving && pop >= 10 && !have('sawmill')) || (!s.flags.noSaw && defs.planks && pop >= 14 && have('sawmill') < Math.min(4, 1 + Math.ceil(defs.planks.deficit / 150))), defs.planks ? 2 : false]);
  }
  if (era >= 3 && ((defs.stone && s.res.stone < 40) || defs.iron) && !have('mine')) L.push(['mine', true, 2]);   // pedra/ferro em falta: mina   // pedra escassa: mina fornece pedra
  if (era >= 3) {
    L.push(['market', !saving && pop >= 18 && !have('market'), false]);
    L.push(['tavern', !saving && (pop >= 20 || avgJoy(s) < 55) && !have('tavern'), false]);
    L.push(['smithy', !saving && pop >= 22 && !have('smithy'), false]);
    L.push(['mine', !saving && pop >= 22 && s.flags.ore && !have('mine'), false]);
    L.push(['loom', !saving && pop >= 25 && !have('loom'), false]);
    L.push(['barracks', !saving && pop >= 18 && !have('barracks'), false]);
  }
  if (era >= 4) {
    L.push(['castle', !saving && pop >= 45 && !have('castle'), false]);
    L.push(['cathedral', !saving && pop >= 50 && !have('cathedral'), false]);
    L.push(['academy', !saving && pop >= 50 && !have('academy'), false]);
    L.push(['jeweler', !saving && pop >= 55 && !have('jeweler'), false]);
    L.push(['port', !saving && pop >= 50 && !have('port'), false]);
  }
  for (const [type, cond, relaxed] of L) {
    if (!cond || !unlocked(s, type) || pending(type)) continue;
    const def = BUILDINGS[type];
    if (def.unique && have(type)) continue;
    if (!affordSafely(s, def.cost, relaxed ? 0.95 : 0.7, relaxed === 2 ? 0.25 : 1)) continue;
    const slot = findSlot(s, type); if (!slot) continue;
    const b = placeBuilding(s, type, slot[0], slot[1]);
    if (b) {
      const z = zoneOf(type);
      chron(s, `O conselho mandou erguer ${def.name}${z ? ` (${z.name})` : ''}.`, 'build');
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

/** Reorganiza UM prédio fora do distrito por dia (automático). Prédios que o jogador moveu ("fixados") nunca são mexidos. */
export function tidyOne(s, max = 3) {
  if (!s.policies.autoBuild || s.flags.noTidy) return null;
  let moved = 0, last = null;
  for (const b of s.buildings) {
    if (moved >= max) break;
    if (b.pinned || ['campfire', 'road', 'wall'].includes(b.type) || !zoneOf(b.type) || inZone(b)) continue;
    if (b.tidyT && s.t - b.tidyT < 86400) continue;
    b.tidyT = s.t;
    const def = BUILDINGS[b.type];
    let fee = {}; if (b.done) for (const r in def.cost) fee[r] = Math.ceil(def.cost[r] * 0.25);
    if (b.done && !affordSafely(s, fee, 0.9, 0.5)) continue;
    const slot = findSlot(s, b.type, b); if (!slot) continue;
    if (moveBuilding(s, b, slot[0], slot[1], false, false)) {
      const z = zoneOf(b.type);
      chron(s, `${def.name} foi reorganizado(a) para o ${z.name.toLowerCase()}.`, 'build');
      (s._moved ||= []).push(`${def.name} → ${z.name}`);
      moved++; last = b;
    }
  }
  return last;
}
/** Botão "Organizar reino": move agora todos os prédios fora do lugar (respeitando o orçamento). */
export function reorganizeAll(s) {
  let n = 0;
  for (const b of [...s.buildings]) {
    if (b.pinned || ['campfire', 'road', 'wall'].includes(b.type) || !zoneOf(b.type) || inZone(b)) continue;
    const def = BUILDINGS[b.type];
    const fee = {}; if (b.done) for (const r in def.cost) fee[r] = Math.ceil(def.cost[r] * 0.25);
    if (b.done && !affordSafely(s, fee, 0.95, 0.3)) continue;
    const slot = findSlot(s, b.type, b); if (!slot) continue;
    if (moveBuilding(s, b, slot[0], slot[1], false, false)) { n++; chron(s, `${def.name} foi reorganizado(a) para o ${zoneOf(b.type).name.toLowerCase()}.`, 'build'); }
  }
  return n;
}

/** O que falta (por recurso) para a próxima era: custo da era + prédios exigidos ainda não construídos. */
export function eraDeficits(s) {
  const next = ERAS[s.era + 1]; if (!next) return {};
  const target = { ...next.cost };
  for (const [type, n] of Object.entries(next.req.buildings || {})) {
    const miss = Math.max(0, n - s.buildings.filter(b => b.type === type).length);
    if (miss && unlocked(s, type)) for (const r in BUILDINGS[type].cost) target[r] = (target[r] || 0) + BUILDINGS[type].cost[r] * miss;
  }
  const out = {};
  for (const r in target) { const d = target[r] - s.res[r]; if (d > 0 && r !== 'food' && r !== 'water') out[r] = { deficit: d, target: target[r] }; }
  return out;
}
