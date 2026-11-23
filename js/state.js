// state.js — criação do jogo, geração do mapa, derivados (capacidade, camas), save/load

import { DAY_LEN, YEAR_DAYS, SEASON_DAYS, MAP_W, MAP_H, TILE, RES, RES_ORDER, BUILDINGS, BASE_CAP, ERAS, TECHS, JOBS } from './data.js';
import { RNG, fbm, hash2, randName, pick, rnd, clamp } from './util.js';

export const SAVE_KEY = 'realm-rising-save-v1';
export const CENTER = { x: 32, y: 26 };

// ---------- Terreno ----------
/** Gera o terreno (água) de forma determinística a partir da semente */
export function genTerrain(seed) {
  const water = new Uint8Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    // Lago a nordeste
    const dx = (x - 44) / 5.6, dy = (y - 18) / 3.8;
    const d = Math.hypot(dx, dy) + (fbm(x * 0.25, y * 0.25, seed) - 0.5) * 0.55;
    if (d < 1) water[y * MAP_W + x] = 1;
    // Pequena lagoa a sudoeste
    const ex = (x - 19) / 3.0, ey = (y - 36) / 2.2;
    if (Math.hypot(ex, ey) + (fbm(x * 0.3, y * 0.3, seed + 5) - 0.5) * 0.5 < 1) water[y * MAP_W + x] = 1;
  }
  return { water };
}

/** Gera as árvores, pedras, arbustos e minério (ficam no estado, pois mudam) */
export function genNodes(seed, terrain) {
  const rng = new RNG(seed);
  const nodes = [];
  let id = 1;
  const taken = new Set();
  const key = (x, y) => y * MAP_W + x;
  const add = (type, x, y, extra = {}) => { nodes.push({ id: id++, type, x, y, ...extra }); taken.add(key(Math.floor(x), Math.floor(y))); };
  // Rochas: aglomerados a oeste e um a sudeste
  const rockSpots = [[16, 30, 5], [20, 18, 3], [44, 36, 4], [52, 28, 3]];
  for (const [rx, ry, n] of rockSpots) for (let i = 0; i < n * 2; i++) {
    const x = Math.floor(rx + rng.range(-3.5, 3.5)), y = Math.floor(ry + rng.range(-3, 3));
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1 || terrain.water[key(x, y)] || taken.has(key(x, y))) continue;
    add('rock', x + 0.5, y + 0.5, { amt: 14, max: 14, v: rng.int(0, 2) });
  }
  // Veio de minério (oculto até ser descoberto)
  for (const [ox, oy] of [[14, 33], [45, 38], [19, 20]]) if (!taken.has(key(ox, oy)))
    add('ore', ox + 0.5, oy + 0.5, { amt: 400, max: 400, v: 0 });
  // Arbustos de frutas, em tufos perto da clareira
  for (let g = 0; g < 7; g++) {
    const ang = rng.range(0, Math.PI * 2), r = rng.range(6.5, 13);
    const cx = CENTER.x + Math.cos(ang) * r, cy = CENTER.y + Math.sin(ang) * r * 0.85;
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(cx + rng.range(-1.6, 1.6)), y = Math.floor(cy + rng.range(-1.6, 1.6));
      if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1 || terrain.water[key(x, y)] || taken.has(key(x, y))) continue;
      add('bush', x + 0.5, y + 0.5, { amt: 6, max: 6, v: rng.int(0, 2) });
    }
  }
  // Árvores: densidade por ruído, clareira central livre
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (terrain.water[key(x, y)] || taken.has(key(x, y))) continue;
    const dx = x - CENTER.x, dy = (y - CENTER.y) * 1.1;
    const d = Math.hypot(dx, dy);
    const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
    const clearing = clamp((d - 5.2) / 5, 0, 1);       // 0 na clareira → 1 floresta
    const f = fbm(x * 0.13, y * 0.13, seed + 11);
    let dens = (0.18 + f * 0.75) * clearing + (edge < 3 ? 0.6 : 0);
    if (hash2(x, y, seed) < dens * 0.62) {
      const sp = fbm(x * 0.07, y * 0.07, seed + 99);
      const species = sp < 0.38 ? 'pine' : sp > 0.62 ? 'birch' : 'oak';
      add('tree', x + 0.15 + hash2(x, y, seed + 1) * 0.7, y + 0.15 + hash2(x, y, seed + 2) * 0.7,
        { amt: 6, max: 6, v: Math.floor(hash2(x, y, seed + 3) * 3), sp: species, st: 'alive', t: 0 });
    }
  }
  return { nodes, nextId: id };
}

// ---------- Pessoas ----------
let _pid = 1;
export function makePerson(s, o = {}) {
  const f = o.f ?? Math.random() < 0.5;
  const p = {
    id: s.nextPid++, name: o.name || randName(f), f,
    age: o.age ?? 20 + Math.floor(Math.random() * 14),
    job: o.job || 'livre', workplace: null,
    skill: {}, n: { hunger: 85, sleep: 90, joy: 65, health: 100 },
    x: o.x ?? CENTER.x * TILE, y: o.y ?? CENTER.y * TILE,
    home: null, partner: null, preg: null, lastBirth: -99, sick: 0, hero: false, away: 0,
    look: { hair: pick(['#3b2a1a', '#5a3b1f', '#8a5a2b', '#c2933b', '#1f1a17', '#a1481f', '#d8d0c0']), skin: pick(['#f1c9a0', '#e0ac7c', '#c68a5c', '#a46a42', '#7b4a2d']), s: Math.random() },
    rt: {},
  };
  if (p.age >= 10) for (const j of ['lenhador', 'coletor', 'cacador', 'construtor', 'pedreiro']) p.skill[j] = Math.random() * 1.2;
  return p;
}

// ---------- Novo jogo ----------
export function newGame(seed = (Math.random() * 1e9) | 0) {
  const terrain = genTerrain(seed);
  const { nodes, nextId } = genNodes(seed, terrain);
  const s = {
    v: 1, seed, created: Date.now(), lastSaved: Date.now(),
    t: DAY_LEN * 0.3, era: 1, speed: 1, paused: false,
    res: { wood: 6, stone: 0, food: 18, water: 14, planks: 0, tools: 0, cloth: 0, iron: 0, gold: 0, weapons: 0, jewels: 0 },
    nodes, nextNid: nextId, nextPid: 1, nextBid: 1,
    people: [], buildings: [], roads: [],
    policies: { tax: 1, ration: false, overtime: false, conscription: false, border: 0, stance: 0 },
    festival: { until: 0, cooldownUntil: 0 },
    tech: { done: {}, current: null, rp: 0, progress: 0 },
    quests: { done: {}, claimed: {} }, achievements: {},
    stats: { gathered: {}, produced: {}, built: {}, births: 0, deaths: 0, immigrants: 0, battlesWon: 0, battlesLost: 0, eventsSeen: 0, festivals: 0, tradesDone: 0 },
    chronicle: [], flags: { ore: false, worldUnlocked: false }, threats: [],
    weather: { type: 'clear', until: DAY_LEN * 1.6, intensity: 0 },
    ev: { cooldownUntil: DAY_LEN * 3.2, pending: [], counts: {} },
    tut: { step: 0, done: false },
    world: null, army: { units: {}, queue: [] }, territories: [],
    lastEraSeen: 1, bestPop: 2, rates: {}, toastQueue: [],
  };
  const man = makePerson(s, { f: false, name: 'Tomás', age: 24, job: 'livre', x: (CENTER.x - 2) * TILE, y: (CENTER.y + 1) * TILE });
  const wom = makePerson(s, { f: true, name: 'Joana', age: 22, job: 'livre', x: (CENTER.x + 2) * TILE, y: (CENTER.y + 1) * TILE });
  man.partner = wom.id; wom.partner = man.id; man.skill.lenhador = 1.5; wom.skill.coletor = 1.5;
  s.people.push(man, wom);
  addBuilding(s, 'campfire', CENTER.x - 1, CENTER.y - 1, true);
  s.chronicle.push({ day: 0, text: 'Tomás e Joana chegam a uma clareira no meio da floresta. Uma fogueira é acesa: nasce o acampamento.', kind: 'era' });
  recalc(s);
  return s;
}

export function addBuilding(s, type, x, y, done = false) {
  const d = BUILDINGS[type];
  const b = { id: s.nextBid++, type, x, y, w: d.w, h: d.h, prog: done ? 1 : 0, done, enabled: true, mode: 'tools', hp: 100, t0: s.t, wk: 0 };
  s.buildings.push(b);
  s._dirty = true;
  return b;
}

// ---------- Tempo ----------
export function timeInfo(s) {
  const day = Math.floor(s.t / DAY_LEN);
  const frac = (s.t % DAY_LEN) / DAY_LEN;
  const dOfYear = day % YEAR_DAYS;
  return { day, frac, hour: frac * 24, season: Math.floor(dOfYear / SEASON_DAYS), year: Math.floor(day / YEAR_DAYS), dOfYear, dOfSeason: dOfYear % SEASON_DAYS };
}
export const isNight = h => h >= 20.5 || h < 5.5;

// ---------- Consultas ----------
export const bdef = b => BUILDINGS[b.type];
export const countB = (s, type, doneOnly = true) => s.buildings.reduce((n, b) => n + (b.type === type && (!doneOnly || b.done) ? 1 : 0), 0);
export const adults = s => s.people.filter(p => p.age >= 10 && !p.away);
export const popCount = s => s.people.length;
export const hasTech = (s, id) => !!s.tech.done[id];
export function techFx(s, key) {
  let v = 0;
  for (const id in s.tech.done) { const f = TECHS[id]?.fx[key]; if (f) v += f; }
  return v;
}
export function unlocked(s, what) {
  // construção liberada? (era + tecnologia)
  const d = BUILDINGS[what];
  if (d) return s.era >= d.era && (!d.tech || hasTech(s, d.tech));
  return false;
}
export function jobUnlocked(s, j) {
  const d = JOBS[j];
  if (!d || s.era < d.era) return false;
  if (j === 'sabio') return hasTech(s, 'writing');
  if (j === 'soldado') return hasTech(s, 'military');
  return true;
}
export function eraRadius(s) { return ERAS[s.era].radius; }

// ---------- Derivados (capacidade, camas, defesa) ----------
export function recalc(s) {
  const d = { cap: {}, beds: 0, defense: 0, prestige: 0, happyB: 0, soldierCap: 0, slots: {}, lights: [], storage: 0 };
  let storage = 0;
  for (const b of s.buildings) {
    if (!b.done) continue;
    const def = BUILDINGS[b.type];
    storage += def.storage || 0;
    d.beds += def.beds || 0;
    d.defense += def.defense || 0;
    d.prestige += def.prestige || 0;
    d.happyB += def.happy || 0;
    d.soldierCap += def.soldiers || 0;
    if (def.slots && b.enabled) for (const j in def.slots) d.slots[j] = (d.slots[j] || 0) + def.slots[j];
  }
  d.storage = storage;
  const mult = 1 + techFx(s, 'storage');
  for (const r of RES_ORDER) {
    const tier = RES[r].tier;
    const tm = tier === 1 ? 1 : tier === 2 ? 0.8 : 0.6;
    d.cap[r] = Math.floor((BASE_CAP * 0.33 + storage) * mult * tm);
    if (r === 'gold') d.cap[r] = Math.max(d.cap[r], 150);
  }
  s._d = d;
  rebuildBlocked(s);
  s._dirty = false;
  return d;
}

/** Grade de bloqueio para pathfinding: água, construções e pedras */
export function rebuildBlocked(s) {
  const terr = s._terr || (s._terr = genTerrain(s.seed));
  const bl = new Uint8Array(MAP_W * MAP_H);
  for (let i = 0; i < bl.length; i++) if (terr.water[i]) bl[i] = 1;
  for (const b of s.buildings) {
    if (BUILDINGS[b.type].road) continue;
    if (b.type === 'wall') { bl[b.y * MAP_W + b.x] = 1; continue; }
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) bl[yy * MAP_W + xx] = 1;
  }
  for (const n of s.nodes) if ((n.type === 'rock' || n.type === 'ore')) bl[Math.floor(n.y) * MAP_W + Math.floor(n.x)] = 1;
  s._blocked = bl;
  s._roadSet = new Set(s.roads.map(r => r[1] * MAP_W + r[0]));
  for (const b of s.buildings) if (b.type === 'road') s._roadSet.add(b.y * MAP_W + b.x);
}
export const isWater = (s, x, y) => !!(s._terr || (s._terr = genTerrain(s.seed))).water[y * MAP_W + x];

// ---------- Salvar / Carregar ----------
export function serialize(s) {
  s.lastSaved = Date.now();
  return JSON.stringify(s, (k, v) => (k[0] === '_' || k === 'rt') ? undefined : v);
}
export function save(s) {
  try { localStorage.setItem(SAVE_KEY, serialize(s)); return true; } catch (e) { console.warn('save failed', e); return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    for (const p of s.people) { p.rt = {}; if (p.away == null) p.away = 0; }
    s.toastQueue = [];
    return s;
  } catch (e) { console.warn('load failed', e); return null; }
}
export function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignora */ } }
