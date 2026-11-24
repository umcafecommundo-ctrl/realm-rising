// world.js — mapa-múndi com névoa de guerra, reinos de IA, diplomacia, comércio e batedores

import { DAY_LEN, RES, ADULT_AGE } from './data.js';
import { fbm, hash2, RNG, clamp, rnd, rint, chance, pick } from './util.js';
import { addRes, canAfford, spend, chron, toast, costStr, adultsOf, defensePower, bus } from './core.js';
import { timeInfo, countB } from './state.js';
import { fairPower } from './war.js';

export const WW = 16, WH = 12;
export const HOME = { x: 2, y: 6 };
export const PERS = {
  pacifico: { name: 'Pacífico', icon: '🕊️', desc: 'Prefere a paz e as alianças.' },
  agressivo: { name: 'Agressivo', icon: '🔥', desc: 'Exige tributos e ataca os fracos.' },
  comerciante: { name: 'Comerciante', icon: '💰', desc: 'Adora rotas e acordos comerciais.' },
};
const KDATA = [
  { name: 'Reino de Valdoria', pers: 'pacifico', color: '#4a90d9', ruler: 'Rainha Elara' },
  { name: 'Império de Karthos', pers: 'agressivo', color: '#c0392b', ruler: 'General Draven' },
  { name: 'Liga de Mercara', pers: 'comerciante', color: '#e0a82e', ruler: 'Doge Lorenzo' },
  { name: 'Horda de Vargul', pers: 'agressivo', color: '#5a7a2b', ruler: 'Chefe Ghor' },
];
const idx = (x, y) => y * WW + x;
export const tileAt = (w, x, y) => (x < 0 || y < 0 || x >= WW || y >= WH) ? null : w.tiles[idx(x, y)];
export const kingdomById = (s, id) => s.world?.kingdoms.find(k => k.id === id);

export function initWorld(s) {
  const seed = s.seed + 777;
  const rng = new RNG(seed);
  const tiles = [];
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const e = Math.min(x, y, WW - 1 - x, WH - 1 - y);
    const h = fbm(x * 0.27, y * 0.27, seed) - (e < 1 ? 0.45 : e < 2 ? 0.1 : 0);
    const f = fbm(x * 0.4 + 9, y * 0.4, seed + 5);
    let t = h < 0.34 ? 'sea' : h > 0.7 ? 'mountain' : h > 0.6 ? 'hills' : f > 0.56 ? 'forest' : 'plains';
    tiles.push({ x, y, t, rev: false, owner: null, poi: null, v: hash2(x, y, seed) });
  }
  const w = { tiles, kingdoms: [], scouts: [], routes: [], caravans: [], marches: [], nextId: 1, log: [] };
  const T = (x, y) => w.tiles[idx(x, y)];
  // base do jogador
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = tileAt(w, HOME.x + dx, HOME.y + dy); if (t && t.t === 'sea') t.t = 'plains'; }
  T(HOME.x, HOME.y).t = 'plains'; T(HOME.x, HOME.y).owner = 'player';
  // reinos
  const spots = [];
  const land = w.tiles.filter(t => t.t !== 'sea' && t.t !== 'mountain' && Math.hypot(t.x - HOME.x, t.y - HOME.y) > 4);
  const chosen = [];
  for (let tries = 0; tries < 400 && chosen.length < KDATA.length; tries++) {
    const t = land[rng.int(0, land.length - 1)];
    if (chosen.every(c => Math.hypot(c.x - t.x, c.y - t.y) >= 4)) chosen.push(t);
  }
  // garante pelo menos posições (caso o mapa seja muito aquático)
  while (chosen.length < KDATA.length) { const t = w.tiles[rng.int(0, w.tiles.length - 1)]; if (t.t === 'sea') t.t = 'plains'; if (!chosen.includes(t) && Math.hypot(t.x - HOME.x, t.y - HOME.y) > 3) chosen.push(t); }
  chosen.sort((a, b) => a.x - b.x);
  KDATA.forEach((kd, i) => {
    const c = chosen[i];
    const k = { id: i + 1, ...kd, cap: { x: c.x, y: c.y }, rel: kd.pers === 'agressivo' ? -10 : kd.pers === 'pacifico' ? 15 : 5, known: false, str: rng.int(10, 18) + (kd.pers === 'agressivo' ? 6 : 0), wealth: rng.int(30, 90),
      treaty: { peace: false, alliance: false, trade: false }, war: false, vassal: false, defeated: false, lastTribute: -99, contact: false, nextAct: 3 + i * 2 };
    c.owner = k.id; c.t = c.t === 'sea' ? 'plains' : c.t; c.cap = true;
    // expande território
    let frontier = [c], owned = [c]; const want = rng.int(3, 5);
    while (owned.length < want && frontier.length) {
      const cur = frontier.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = tileAt(w, cur.x + dx, cur.y + dy);
        if (n && n.t !== 'sea' && n.owner == null && owned.length < want) { n.owner = k.id; owned.push(n); frontier.push(n); }
      }
    }
    w.kingdoms.push(k);
  });
  // pontos de interesse neutros
  const free = w.tiles.filter(t => t.t !== 'sea' && t.owner == null && Math.hypot(t.x - HOME.x, t.y - HOME.y) > 2.2);
  const kinds = [['camp', 'Acampamento de bandidos', { gold: 3 }], ['camp', 'Fortim de bandoleiros', { gold: 4, food: 3 }], ['iron', 'Depósito de ferro', { iron: 5 }], ['iron', 'Colinas ferrosas', { iron: 6 }],
    ['fertile', 'Vale fértil', { food: 9 }], ['fertile', 'Várzea rica', { food: 8, water: 4 }], ['lumber', 'Floresta antiga', { wood: 10 }], ['quarry', 'Pedreira abandonada', { stone: 9 }], ['ruins', 'Ruínas antigas', {}], ['ruins', 'Templo esquecido', {}], ['gold', 'Veio de ouro', { gold: 5 }]];
  for (const [type, name, yld] of kinds) {
    const cand = free.filter(t => !t.poi); if (!cand.length) break;
    const t = cand[rng.int(0, cand.length - 1)];
    const d = Math.hypot(t.x - HOME.x, t.y - HOME.y);
    t.poi = { type, name, yield: yld, power: type === 'ruins' ? 0 : Math.round(8 + d * 4 + rng.int(0, 8)), looted: false };
  }
  // revela o entorno inicial
  reveal(w, HOME.x, HOME.y, 2);
  s.world = w;
  return w;
}

export function reveal(w, cx, cy, r) {
  const newly = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const t = tileAt(w, cx + dx, cy + dy);
    if (t && !t.rev && Math.hypot(dx, dy) <= r + 0.4) { t.rev = true; newly.push(t); }
  }
  return newly;
}
export const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const travelDays = (x, y) => Math.max(0.4, Math.hypot(x - HOME.x, y - HOME.y) * 0.35);

// ---------- Batedores ----------
export function canScout(s, x, y) {
  const w = s.world; if (!w) return 'Mapa indisponível';
  const t = tileAt(w, x, y); if (!t) return 'Fora do mapa';
  if (t.rev) return 'Já explorado';
  if (t.t === 'sea') return 'Mar: precisa de porto (em breve)';
  if (!w.tiles.some(n => n.rev && n.t !== 'sea' && dist(n, t) <= 2)) return 'Longe demais — explore mais perto primeiro';
  if (s.res.food < 8) return 'Precisa de 8 de comida';
  if (w.scouts.length >= 3) return 'Máximo de 3 batedores';
  if (!adultsOf(s).some(p => !p.away && p.job !== 'soldado')) return 'Sem morador disponível';
  return null;
}
export function sendScout(s, x, y) {
  const why = canScout(s, x, y); if (why) return why;
  const w = s.world;
  const cand = adultsOf(s).filter(p => !p.away && p.job !== 'soldado').sort((a, b) => (a.job === 'cacador' ? -1 : a.job === 'livre' ? -0.5 : 0) - (b.job === 'cacador' ? -1 : b.job === 'livre' ? -0.5 : 0));
  const p = cand[0];
  const days = travelDays(x, y);
  spend(s, { food: 8 });
  p.away = days * 2 * DAY_LEN;
  w.scouts.push({ id: w.nextId++, x, y, pid: p.id, name: p.name, arrive: s.t + days * DAY_LEN, back: s.t + days * 2 * DAY_LEN, done: false });
  s.stats.scouts = (s.stats.scouts || 0) + 1;
  s._dirty = true;
  return null;
}

// ---------- Contato e relações ----------
export function changeRel(s, k, d) { k.rel = clamp(k.rel + d, -100, 100); }
function firstContact(s, k, offline) {
  if (k.known) return;
  k.known = true; k.contact = true;
  chron(s, `Primeiro contato com ${k.name} (${PERS[k.pers].name.toLowerCase()}).`, 'world');
  toast(s, `Você conheceu ${k.name}!`, 'gold', '🏳️');
}

// ---------- Rotinas periódicas ----------
export function worldSlow(s, offline) {
  const w = s.world; if (!w) return;
  // batedores chegando
  for (const sc of w.scouts) {
    if (!sc.done && s.t >= sc.arrive) {
      sc.done = true;
      const t = tileAt(w, sc.x, sc.y);
      const r = (t.t === 'hills' || t.t === 'mountain') ? 2 : 1;
      const fresh = reveal(w, sc.x, sc.y, r + 0);
      for (const n of fresh) if (typeof n.owner === 'number') firstContact(s, kingdomById(s, n.owner), offline);
      let msg = `${sc.name} explorou ${t.t === 'plains' ? 'planícies' : t.t === 'forest' ? 'florestas' : t.t === 'hills' ? 'colinas' : 'montanhas'}`;
      const poi = fresh.find(n => n.poi);
      if (poi) msg += ` e encontrou: ${poi.poi.name}`;
      for (const n of fresh) if (n.poi?.type === 'ruins' && !n.poi.looted) { n.poi.looted = true; const loot = pick([{ gold: 40 }, { jewels: 2, gold: 20 }, { iron: 15 }, { cloth: 15 }]); for (const r2 in loot) addRes(s, r2, loot[r2]); msg += ` (saque nas ruínas: ${costStr(loot)})`; }
      if (chance(0.08)) { sc.lost = true; msg += '. Mas foi emboscado e não voltou...'; }
      chron(s, msg + '.', 'world');
      if (!offline) toast(s, `Batedor revelou nova região`, 'good', '🧭');
      bus.emit('scouted', sc);
    }
    if (sc.done && s.t >= sc.back && !sc.ret) {
      sc.ret = true;
      const p = s.people.find(q => q.id === sc.pid);
      if (p) { if (sc.lost) { p.away = 0; s.people.splice(s.people.indexOf(p), 1); s.stats.deaths++; chron(s, `${p.name} nunca retornou da exploração.`, 'death'); } else { p.away = 0; p.skill.cacador = (p.skill.cacador || 0) + 0.8; } }
    }
  }
  w.scouts = w.scouts.filter(sc => !sc.ret);
  // caravanas
  for (const c of w.caravans) {
    if (!c.done && s.t >= c.at) {
      c.done = true;
      const k = kingdomById(s, c.k);
      if (k?.war || chance(0.04)) { chron(s, 'Uma caravana foi saqueada no caminho!', 'bad'); continue; }
      for (const r in c.get) addRes(s, r, c.get[r]);
      s.stats.tradesDone++;
      if (!offline) bus.emit('caravan', c);
    }
  }
  w.caravans = w.caravans.filter(c => !c.done);
}

export function worldDaily(s, offline) {
  const w = s.world; if (!w) return;
  const th = timeInfo(s), day = th.day;
  const dp = defensePower(s);
  for (const k of w.kingdoms) {
    if (k.defeated) continue;
    // crescimento
    const g = (k.pers === 'agressivo' ? 0.8 : k.pers === 'comerciante' ? 0.5 : 0.6) * (1 + s.era * 0.12) * rnd(0.6, 1.3);
    k.str = Math.min(500, k.str + g * (k.vassal ? 0.2 : 1));
    k.wealth += rnd(3, 9);
    // deriva de relações
    const base = k.pers === 'agressivo' ? -15 : k.pers === 'pacifico' ? 25 : 10;
    if (!k.treaty.alliance) k.rel += (base - k.rel) * 0.01;
    if (k.treaty.alliance) k.rel = Math.min(100, k.rel + 0.3);
    if (k.treaty.trade) k.rel = Math.min(100, k.rel + 0.2);
    if (k.war) k.rel = Math.max(-100, k.rel - 0.5);
    if (k.vassal) continue;
    // contato espontâneo (eles encontram você)
    if (!k.known && s.era >= 3 && chance(0.03)) { firstContact(s, k, offline); queueEvent(s, k.pers === 'agressivo' ? 'k_tribute' : 'k_envoy', k.pers === 'agressivo' ? tributeParams(s, k) : { k: k.id }); continue; }
    if (!k.known || s.era < 3) continue;
    if (day < k.nextAct) continue;
    k.nextAct = day + rint(2, 5);
    const calm = k.treaty.peace || k.treaty.alliance;
    // guerra aberta
    if (k.war) { if (chance(0.3)) launchEnemyArmy(s, k, 0.55); continue; }
    if (k.pers === 'agressivo' && !calm && k.str > dp * 0.8 && k.rel < 10) {
      const r = Math.random();
      if (r < 0.22) queueEvent(s, 'k_tribute', tributeParams(s, k));
      else if (r < 0.34) launchEnemyArmy(s, k, 0.45);
    } else if (k.pers === 'comerciante' && s.era >= 3 && countB(s, 'market') && !w.routes.some(r => r.k === k.id && r.active) && k.rel > -10 && chance(0.18)) {
      queueEvent(s, 'k_trade', tradeParams(s, k));
    } else if (k.pers === 'pacifico' && k.rel >= 40 && !k.treaty.alliance && chance(0.12)) {
      queueEvent(s, 'k_alliance', { k: k.id });
    } else if (k.rel >= 15 && !k.treaty.peace && !k.treaty.alliance && chance(0.06)) {
      queueEvent(s, 'k_envoy', { k: k.id });
    }
    // reinos fortes que odeiam você podem atacar mesmo sem exigir
    if (k.rel < -40 && !calm && k.str > dp && chance(0.1)) launchEnemyArmy(s, k, 0.5);
  }
  // rotas comerciais
  for (const r of w.routes) {
    if (!r.active) continue;
    if (day >= r.next) {
      r.next = day + r.every;
      if (canAfford(s, { [r.give.res]: r.give.amt })) {
        spend(s, { [r.give.res]: r.give.amt }, { ledger: true });
        const k = kingdomById(s, r.k);
        const dur = travelDays(k.cap.x, k.cap.y) * DAY_LEN * 0.8;
        w.caravans.push({ id: w.nextId++, route: r.id, k: r.k, sent: s.t, at: s.t + dur, get: { [r.get.res]: Math.round(r.get.amt * (1 + (s.tech.done.commerce ? 0.15 : 0) + (s.tech.done.navigation ? 0.15 : 0))) } });
        r.fails = 0;
      } else if (++r.fails >= 3) { r.active = false; chron(s, 'Uma rota comercial foi suspensa por falta de mercadoria.', 'bad'); const k = kingdomById(s, r.k); if (k) { k.treaty.trade = false; changeRel(s, k, -8); } }
    }
  }
}

// ---------- Propostas (viram eventos) ----------
export function queueEvent(s, id, params) { (s._newEvents ||= []).push({ id, params }); }
export function tributeParams(s, k) {
  const gold = s.era >= 3 && s.res.gold >= 30;
  return { k: k.id, pay: gold ? { gold: Math.round(30 + k.str * 0.6) } : { food: Math.round(30 + k.str * 0.8) } };
}
export function tradeParams(s, k) {
  const pairs = [[{ res: 'food', amt: 40 }, { res: 'gold', amt: 25 }], [{ res: 'wood', amt: 40 }, { res: 'iron', amt: 12 }], [{ res: 'stone', amt: 40 }, { res: 'cloth', amt: 16 }], [{ res: 'planks', amt: 20 }, { res: 'gold', amt: 40 }], [{ res: 'food', amt: 30 }, { res: 'weapons', amt: 6 }]];
  const [give, get] = pick(pairs.filter(([g]) => s.res[g.res] > 0 || true));
  return { k: k.id, give, get, every: 3 };
}
export function payTribute(s, p) {
  const k = kingdomById(s, p.k); spend(s, p.pay);
  if (k) { changeRel(s, k, 6); k.wealth += 20; k.nextAct = timeInfo(s).day + 6; }
  return `O tributo é pago. ${k?.name} fica satisfeito... por enquanto.`;
}
export function refuseTribute(s, p) {
  const k = kingdomById(s, p.k);
  if (k) { changeRel(s, k, -15); if (k.pers === 'agressivo' || chance(0.3)) { launchEnemyArmy(s, k, 0.5); return `${k.name} se enfurece e envia o exército!`; } }
  return 'A exigência é recusada. Relações esfriam.';
}
export function acceptAlliance(s, p) {
  const k = kingdomById(s, p.k); if (!k) return '';
  k.treaty.alliance = true; k.treaty.peace = true; changeRel(s, k, 15);
  chron(s, `Aliança formada com ${k.name}!`, 'world');
  return `Aliança selada com ${k.name}. Eles ajudarão em tempos difíceis.`;
}
export function startRoute(s, p) {
  const w = s.world, k = kingdomById(s, p.k);
  w.routes.push({ id: w.nextId++, k: p.k, give: p.give, get: p.get, every: p.every, next: timeInfo(s).day + 1, active: true, fails: 0 });
  if (k) { k.treaty.trade = true; changeRel(s, k, 8); }
  chron(s, `Rota comercial aberta com ${k?.name}.`, 'world');
  return 'A rota comercial é aberta. As caravanas começarão a circular!';
}
export function proposeFromEnvoy(s, p, peace) {
  const k = kingdomById(s, p.k); if (!k) return '';
  changeRel(s, k, peace ? 10 : 4);
  if (peace) { k.treaty.peace = true; k.war = false; chron(s, `Tratado de paz assinado com ${k.name}.`, 'world'); }
  addRes(s, 'gold', 20); addRes(s, 'cloth', 8);
  return peace ? 'A paz é selada e os presentes aceitos.' : 'Os presentes são aceitos com cortesia.';
}

// ---------- Ações diplomáticas do jogador ----------
export function diploActions(s, k) {
  const A = [];
  const calm = k.treaty.peace || k.treaty.alliance;
  A.push({ id: 'gift', label: 'Enviar presente', hint: '30 comida ou 30 ouro: +12 relação', ok: s.res.food >= 30 || s.res.gold >= 30 });
  if (k.war) A.push({ id: 'peace', label: 'Propor paz', hint: k.rel > -60 ? 'Pode aceitar se estiver cansado de guerra' : 'Eles estão furiosos', ok: true });
  else if (!k.treaty.peace) A.push({ id: 'treaty', label: 'Propor tratado de paz', hint: 'Requer relação ≥ 5', ok: k.rel >= 5 });
  if (!k.treaty.alliance && !k.war) A.push({ id: 'alliance', label: 'Propor aliança', hint: 'Requer relação ≥ 50 e era Reino', ok: k.rel >= 50 && s.era >= 4 });
  if (!k.treaty.trade && !k.war && countB(s, 'market')) A.push({ id: 'trade', label: 'Propor rota comercial', hint: 'Requer relação ≥ -5 e mercado', ok: k.rel >= -5 });
  if (!k.war && !k.vassal && s.era >= 3) A.push({ id: 'tribute', label: 'Exigir tributo', hint: 'Só funciona se você for mais forte (risco de guerra)', ok: true });
  if (!k.war && !k.vassal) A.push({ id: 'war', label: 'Declarar guerra', hint: 'Quebra tratados. Ataque pelo mapa.', ok: s.era >= 3, danger: true });
  return A;
}
export function doDiplo(s, k, id) {
  const dp = defensePower(s);
  switch (id) {
    case 'gift': { if (s.res.gold >= 30) spend(s, { gold: 30 }); else if (s.res.food >= 30) spend(s, { food: 30 }); else return 'Recursos insuficientes'; changeRel(s, k, 12); return `${k.name} agradece o presente.`; }
    case 'peace': { if (k.rel > -70 && chance(0.55 + k.rel / 200) || k.str < dp * 0.5) { k.war = false; k.treaty.peace = true; chron(s, `Paz com ${k.name}.`, 'world'); return 'A paz é aceita!'; } changeRel(s, k, -3); return 'Eles recusam a paz por enquanto.'; }
    case 'treaty': { if (k.rel >= 5) { k.treaty.peace = true; chron(s, `Tratado de paz com ${k.name}.`, 'world'); return 'Tratado de paz assinado.'; } return 'Relações insuficientes.'; }
    case 'alliance': { if (k.rel >= 50) { acceptAlliance(s, { k: k.id }); return `Aliança com ${k.name}!`; } return 'Eles não confiam em você o bastante.'; }
    case 'trade': { queueEvent(s, 'k_trade', tradeParams(s, k)); return 'Proposta enviada. A resposta chegará em breve.'; }
    case 'tribute': {
      if (k.str < dp * 0.7 && chance(0.7)) { const g = Math.round(30 + k.wealth * 0.4); addRes(s, 'gold', g); changeRel(s, k, -20); chron(s, `${k.name} pagou ${g} de ouro em tributo.`, 'world'); return `${k.name} se curva e paga ${g} de ouro. Mas jamais perdoará.`; }
      changeRel(s, k, -30); if (k.rel < -30) { k.war = true; return `${k.name} se ofende e declara guerra!`; } return `${k.name} recusa a ousadia.`; }
    case 'war': { k.war = true; k.treaty = { peace: false, alliance: false, trade: false }; for (const r of s.world.routes) if (r.k === k.id) r.active = false; changeRel(s, k, -50); chron(s, `Guerra declarada a ${k.name}!`, 'war'); return `Guerra declarada contra ${k.name}.`; }
  }
  return '';
}

// ---------- Exércitos inimigos (ver war.js) ----------
export function launchEnemyArmy(s, k, frac) {
  const eta = rnd(1, 1.6);
  const id = (s._tid = (s._tid || 0) + 1);
  const cap = k.str * frac;
  const fair = Math.max(5, fairPower(s, cap, 'army') * (0.85 + Math.random() * 0.4)); // ataques sempre enfrentáveis: seguem a força real da sua defesa
  s.threats.push({ id, kind: 'army', from: k.id, power: Math.round(Math.min(cap, fair)), label: `Exército de ${k.name}`, at: s.t + DAY_LEN * eta });
  chron(s, `${k.name} marcha contra nós!`, 'war');
  toast(s, `${k.name} está atacando!`, 'bad', '⚔️');
}

/** Piloto automático do mundo: explora, cuida da diplomacia e do comércio. */
export function autoWorld(s) {
  const w = s.world; if (!w || !s.flags.worldUnlocked) return;
  // exploração: sempre um batedor ativo enquanto houver mapa a descobrir
  if (w.scouts.length < 2 && s.res.food >= 30) {
    let best = null, bd = 1e9;
    for (const t of w.tiles) { if (t.rev || canScout(s, t.x, t.y)) continue; const d = Math.hypot(t.x - HOME.x, t.y - HOME.y); if (d < bd) { bd = d; best = t; } }
    if (best) sendScout(s, best.x, best.y);
  }
  const day = timeInfo(s).day;
  for (const k of w.kingdoms) {
    if (!k.known || k.defeated || k.vassal) continue;
    const acts = diploActions(s, k).filter(a => a.ok).map(a => a.id);
    if (k.war) { if (day % 4 === 0 && acts.includes('peace')) doDiplo(s, k, 'peace'); continue; }
    if (k.rel < 0 && s.res.gold >= 150 && day % 5 === 0 && acts.includes('gift')) doDiplo(s, k, 'gift');
    if (acts.includes('treaty') && k.rel >= 5) doDiplo(s, k, 'treaty');
    if (acts.includes('alliance') && k.rel >= 50) doDiplo(s, k, 'alliance');
    if (acts.includes('trade') && k.rel >= 5 && !(s._newEvents || []).some(e => e.id === 'k_trade') && day % 3 === 0) doDiplo(s, k, 'trade');
  }
}
