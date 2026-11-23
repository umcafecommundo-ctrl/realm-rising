// war.js — exército, treinamento, batalhas automáticas (com relatório animável), defesa e conquista

import { DAY_LEN, UNITS, ADULT_AGE, BUILDINGS } from './data.js';
import { timeInfo, techFx, hasTech, countB } from './state.js';
import { addRes, spend, canAfford, chron, toast, killPerson, soldiersOf, adultsOf, defensePower, costStr, bus, floatText } from './core.js';
import { kingdomById, tileAt, travelDays, changeRel, HOME, PERS } from './world.js';
import { rnd, rint, chance, pick, clamp } from './util.js';

const ENEMY = {
  wolf: { name: 'Lobo', icon: '🐺', hp: 10, atk: 3, power: 3, counter: null },
  bandit: { name: 'Bandido', icon: '🗡️', hp: 14, atk: 4, power: 4, counter: null },
};
export const UT = t => UNITS[t] || ENEMY[t];
const fakeP = u => ({ unit: u });

// ---------- Consultas ----------
export function unitCounts(s, ps = soldiersOf(s)) {
  const c = {};
  for (const p of ps) { const u = p.unit || 'recruta'; c[u] = (c[u] || 0) + 1; }
  return c;
}
export function armyPower(units) { let t = 0; for (const u in units) t += (UT(u)?.power || 0) * units[u]; return Math.round(t); }

// ---------- Treinamento ----------
export function recruitsFree(s) {
  const queued = s.army.queue.length;
  return soldiersOf(s).filter(p => !p.unit || p.unit === 'recruta').length - queued;
}
export function canTrain(s, unit) {
  const u = UNITS[unit];
  if (!u || unit === 'recruta') return 'Inválido';
  if (u.tech && !hasTech(s, u.tech)) return 'Requer pesquisa';
  if (!countB(s, 'barracks')) return 'Precisa de um Quartel';
  if (recruitsFree(s) < 1) return 'Sem recrutas livres (atribua Soldados)';
  if (!canAfford(s, u.cost)) return 'Recursos insuficientes';
  if (s.army.queue.length >= 6) return 'Fila cheia';
  return null;
}
export function trainEnqueue(s, unit) {
  if (canTrain(s, unit)) return false;
  spend(s, UNITS[unit].cost);
  s.army.queue.push({ unit, t: 0, dur: 8 });
  return true;
}
export function trainTick(s, dt) {
  const q = s.army.queue; if (!q.length) return;
  const h = q[0];
  h.t = Math.min(h.dur, h.t + dt);
  if (h.t >= h.dur) {
    const r = soldiersOf(s).find(p => !p.unit || p.unit === 'recruta');
    if (r) { r.unit = h.unit; r.skill.soldado = (r.skill.soldado || 0) + 0.4; q.shift(); toast(s, `${UNITS[h.unit].name} treinado!`, 'good', UNITS[h.unit].icon); }
  }
}

// ---------- Simulação de batalha ----------
function mkSide(units, hpMult) {
  return Object.entries(units).filter(([, n]) => n > 0).map(([type, n]) => ({ type, n, hp: UT(type).hp * hpMult, acc: 0 }));
}
const totalN = g => g.reduce((a, x) => a + x.n, 0);
function counterMult(g, enemy) {
  let tot = 0, w = 0;
  for (const e of enemy) {
    let m = 1;
    if (UT(g.type).counter === e.type) m = 1.45;
    else if (UT(e.type).counter === g.type) m = 0.75;
    tot += m * e.n; w += e.n;
  }
  return w ? tot / w : 1;
}
const snap = side => { const o = {}; for (const g of side) o[g.type] = g.n; return o; };

/** Resolve uma batalha em até 8 rodadas. Retorna relatório com instantâneos por rodada (para animação). */
export function simulateBattle(aUnits, dUnits, o = {}) {
  const A = mkSide(aUnits, o.aHp || 1), D = mkSide(dUnits, o.dHp || 1);
  const a0 = snap(A), d0 = snap(D);
  const rounds = [{ a: snap(A), d: snap(D) }];
  for (let r = 0; r < 8 && totalN(A) > 0 && totalN(D) > 0; r++) {
    const dmgA = A.reduce((t, g) => t + g.n * UT(g.type).atk * counterMult(g, D) * (g.type === 'archer' && r === 0 ? 1.5 : 1) * 0.85 * (o.aAtk || 1), 0);
    const dmgD = D.reduce((t, g) => t + g.n * UT(g.type).atk * counterMult(g, A) * (g.type === 'archer' && r === 0 ? 1.5 : 1) * 0.85 * (o.dAtk || 1), 0);
    applyDamage(D, dmgA); applyDamage(A, dmgD);
    rounds.push({ a: snap(A), d: snap(D) });
  }
  const hpLeft = side => side.reduce((t, g) => t + g.n * g.hp, 0);
  const aWin = totalN(D) === 0 ? true : totalN(A) === 0 ? false : hpLeft(A) / Math.max(1, hpLeft(A) + hpLeft(D)) > 0.5;
  const aLeft = snap(A), dLeft = snap(D);
  const loss = (s0, s1) => { const l = {}; for (const t in s0) l[t] = s0[t] - (s1[t] || 0); return l; };
  return { win: aWin, rounds, a0, d0, aLeft, dLeft, aLoss: loss(a0, aLeft), dLoss: loss(d0, dLeft) };
}
function applyDamage(side, dmg) {
  const tot = side.reduce((t, g) => t + g.n * g.hp, 0);
  if (tot <= 0) return;
  for (const g of side) {
    const share = dmg * (g.n * g.hp) / tot;
    g.acc += share / g.hp;
    const kill = Math.min(g.n, Math.floor(g.acc));
    g.n -= kill; g.acc -= kill;
  }
}

// ---------- Composição de exércitos ----------
function composeEnemy(power, kind, era = 3) {
  if (kind === 'wolves') return { wolf: Math.max(2, Math.round(power / 3)) };
  if (kind === 'bandits') return { bandit: Math.max(2, Math.round(power / 4)) };
  const u = {};
  u.spear = Math.max(1, Math.round(power * 0.45 / 5));
  u.archer = Math.round(power * 0.3 / 6);
  if (era >= 4) u.knight = Math.round(power * 0.25 / 10); else u.spear += Math.round(power * 0.25 / 5);
  return u;
}
export function defenders(s) {
  const u = unitCounts(s);
  const others = adultsOf(s).filter(p => p.job !== 'soldado');
  const hunters = others.filter(p => p.job === 'cacador').length;
  u.archer = (u.archer || 0) + hunters;
  u.recruta = (u.recruta || 0) + Math.floor((others.length - hunters) * 0.35);
  return u;
}
const defHpMult = s => 1 + (s._d?.defense || 0) / 140 + techFx(s, 'defense');

// ---------- Aplicar baixas ----------
function applyLosses(s, loss, ps, cause = 'tombou em combate', scale = 1) {
  const dead = [];
  for (const t in loss) {
    let n = Math.floor(loss[t] * scale + Math.random());
    if (t === 'archer' || t === 'recruta') { /* inclui caçadores/milícia */ }
    const pool = ps.filter(p => (p.unit || 'recruta') === t && !dead.includes(p));
    for (let i = 0; i < n && pool.length; i++) { const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; dead.push(p); }
    // sobras (milícia/caçadores) saem dos civis
    const rest = n - Math.min(n, dead.filter(p => (p.unit || 'recruta') === t).length);
    if (rest > 0 && (t === 'archer' || t === 'recruta')) {
      const civ = adultsOf(s).filter(p => p.job !== 'soldado' && !dead.includes(p));
      for (let i = 0; i < Math.ceil(rest * 0.5) && civ.length; i++) dead.push(civ.splice(Math.floor(Math.random() * civ.length), 1)[0]);
    }
  }
  for (const p of dead) killPerson(s, p, cause);
  return dead.length;
}

// ---------- Defesa contra ameaças ----------
export function resolveThreat(s, t, offline) {
  const th = timeInfo(s);
  const A = composeEnemy(t.power, t.kind === 'army' ? 'army' : t.kind, s.era);
  const D = defenders(s);
  // aliados ajudam
  let allyHelp = null;
  if (t.kind === 'army' || t.kind === 'bandits') {
    for (const k of s.world?.kingdoms || []) if (k.treaty.alliance && k.id !== t.from && !k.war) { const n = Math.floor(k.str * 0.18 / 5); if (n > 0) { D.spear = (D.spear || 0) + n; allyHelp = k.name; } }
  }
  const r = simulateBattle(A, D, { dHp: defHpMult(s) * (t.hidden ? 0.9 : 1) });
  const playerWin = !r.win;
  const rep = { id: s.stats.battlesWon + s.stats.battlesLost + 1, kind: 'defesa', title: `Defesa contra ${t.label}`, win: playerWin, aName: t.label, dName: 'Seu povo' + (allyHelp ? ` + ${allyHelp}` : ''), rounds: r.rounds, a0: r.a0, d0: r.d0, aLoss: r.aLoss, dLoss: r.dLoss, day: th.day, lines: [] };
  // baixas do jogador (soldados primeiro)
  const lost = applyLosses(s, r.dLoss, soldiersOf(s).concat(adultsOf(s).filter(p => p.job === 'cacador')), 'tombou em combate', playerWin ? 0.45 : 0.8);
  rep.lines.push(`Baixas: ${lost} morador(es). Inimigos derrotados: ${Object.values(r.aLoss).reduce((a, b) => a + b, 0)}.`);
  if (playerWin) {
    if (t.kind !== 'wolves') s.stats.battlesWon++;
    if (t.kind === 'bandits') { const g = rint(20, 50); addRes(s, 'gold', g); addRes(s, 'weapons', rint(0, 3)); rep.lines.push(`Espólios: ${g} ouro.`); }
    if (t.kind === 'wolves') { const f = rint(8, 16); addRes(s, 'food', f); rep.lines.push(`Peles e carne: +${f} comida.`); }
    if (t.kind === 'army') { const k = kingdomById(s, t.from); if (k) { k.str = Math.max(5, k.str * 0.85); changeRel(s, k, -5); rep.lines.push(`${k.name} recua com perdas.`); } }
    chron(s, `${t.label} foi repelido(a)! (${lost} baixas)`, 'war');
  } else {
    if (t.kind !== 'wolves') s.stats.battlesLost++;
    const frac = (t.hidden ? 0.15 : 0.28) * (t.kind === 'wolves' ? 0.6 : 1);
    const stolen = [];
    for (const r2 of ['food', 'wood', 'stone', 'gold', 'planks', 'iron', 'water']) { const v = Math.floor(s.res[r2] * frac); if (v > 0) { addRes(s, r2, -v, { noStat: true }); stolen.push(`${v} ${r2}`); } }
    const extra = t.kind === 'wolves' ? (s.people.length >= 8 ? 1 : 0) : (s.people.length >= 6 ? rint(0, 2) : 0);
    if (extra === 0) for (const q of s.people) q.n.health = Math.max(20, q.n.health - 25);
    const names = []; for (let i = 0; i < extra && s.people.length > 2; i++) { const v = pick(adultsOf(s)); if (v) { names.push(v.name); killPerson(s, v, 'foi morto(a) no ataque'); } }
    if (t.kind === 'army' && chance(0.5)) { const cand = s.buildings.filter(b => b.done && b.type !== 'campfire' && b.type !== 'road' && b.type !== 'wall'); if (cand.length) { const b = pick(cand); s.buildings.splice(s.buildings.indexOf(b), 1); rep.lines.push(`${BUILDINGS[b.type].name} foi incendiado(a)!`); s._dirty = true; } }
    rep.lines.push(`Saque: ${stolen.join(', ') || 'nada'}.`);
    chron(s, `${t.label} venceu a defesa e saqueou o reino.`, 'war');
    toast(s, `${t.label} saqueou o reino!`, 'bad', '💀');
  }
  s.battleLog = s.battleLog || []; s.battleLog.push({ ...rep, rounds: undefined }); if (s.battleLog.length > 20) s.battleLog.shift();
  bus.emit('threat', { kind: t.kind, win: playerWin });
  if (offline) (s._offBattles ||= []).push(rep);
  else if (t.kind !== 'wolves') bus.emit('battle', rep);
  else toast(s, playerWin ? 'Os lobos foram afugentados!' : 'Os lobos atacaram o acampamento!', playerWin ? 'good' : 'bad', '🐺');
  s._dirty = true;
}

// ---------- Ataque do jogador ----------
export function attackInfo(s, tx, ty) {
  const w = s.world; const t = tileAt(w, tx, ty);
  if (!t || !t.rev || t.t === 'sea') return null;
  if (t.owner === 'player') return null;
  let power = 0, name = '', kingdom = null, cap = false;
  if (typeof t.owner === 'number') {
    kingdom = kingdomById(s, t.owner); if (!kingdom || kingdom.defeated) return null;
    cap = !!t.cap; power = Math.round(kingdom.str * (cap ? 0.7 : 0.3)); name = cap ? `Capital de ${kingdom.name}` : `Província de ${kingdom.name}`;
  } else if (t.poi && t.poi.power > 0) { power = t.poi.power; name = t.poi.name; } else return null;
  return { tile: t, power, name, kingdom, cap };
}
export function launchAttack(s, tx, ty, frac) {
  if (!countB(s, 'barracks')) return 'Precisa de um Quartel';
  const info = attackInfo(s, tx, ty); if (!info) return 'Alvo inválido';
  const ps = soldiersOf(s).sort((a, b) => (UT(b.unit || 'recruta').power) - (UT(a.unit || 'recruta').power));
  if (ps.length < 2) return 'Precisa de pelo menos 2 soldados';
  const n = clamp(Math.ceil(ps.length * frac), 1, ps.length);
  const sel = ps.slice(0, n);
  const days = travelDays(tx, ty) * 0.8;
  if (info.kingdom && !info.kingdom.war) { info.kingdom.war = true; info.kingdom.treaty = { peace: false, alliance: false, trade: false }; changeRel(s, info.kingdom, -50); chron(s, `Guerra declarada a ${info.kingdom.name}!`, 'war'); }
  const w = s.world;
  const m = { id: w.nextId++, tx, ty, pids: sel.map(p => p.id), depart: s.t, arrive: s.t + days * DAY_LEN, days, done: false };
  for (const p of sel) p.away = 1e9;
  w.marches.push(m);
  chron(s, `${n} soldados marcham para ${info.name}.`, 'war');
  return null;
}
export function marchTick(s, offline) {
  const w = s.world; if (!w) return;
  for (const m of w.marches) {
    if (m.done) continue;
    if (!m.returning && s.t >= m.arrive) {
      const ps = m.pids.map(id => s.people.find(p => p.id === id)).filter(Boolean);
      const info = attackInfo(s, m.tx, m.ty);
      m.returning = true;
      if (!info) { for (const p of ps) p.away = m.days * DAY_LEN; m.back = s.t + m.days * DAY_LEN; continue; }
      const A = unitCounts(s, ps);
      const siege = (A.catapult || 0) > 0;
      const D = composeEnemy(info.power, info.kingdom ? 'army' : 'bandits', Math.max(3, s.era));
      const r = simulateBattle(A, D, { dHp: info.cap ? (siege ? 1.15 : 1.5) : 1.1 });
      const rep = { id: s.stats.battlesWon + s.stats.battlesLost + 1, kind: 'ataque', title: `Ataque a ${info.name}`, win: r.win, aName: 'Seu exército', dName: info.name, rounds: r.rounds, a0: r.a0, d0: r.d0, aLoss: r.aLoss, dLoss: r.dLoss, day: timeInfo(s).day, lines: [] };
      const dead = applyLosses(s, r.aLoss, ps, 'tombou na campanha');
      rep.lines.push(`Baixas: ${dead} soldado(s).`);
      const alive = ps.filter(p => s.people.includes(p));
      for (const p of alive) { p.away = Math.max(1, m.days * DAY_LEN); p.skill.soldado = (p.skill.soldado || 0) + 0.5; }
      m.back = s.t + m.days * DAY_LEN;
      if (r.win) {
        s.stats.battlesWon++;
        const t = info.tile;
        const yld = info.kingdom ? (info.cap ? { gold: 6 } : pick([{ food: 6 }, { wood: 6 }, { stone: 6 }, { iron: 3 }])) : t.poi.yield;
        t.owner = 'player';
        s.territories.push({ x: t.x, y: t.y, name: info.name, yield: yld });
        let loot = {};
        if (info.kingdom) {
          const k = info.kingdom; k.str = Math.max(4, k.str * (info.cap ? 0.45 : 0.8)); changeRel(s, k, -25);
          const g = Math.round(k.wealth * (info.cap ? 0.6 : 0.25)); loot = { gold: g, food: rint(10, 30) }; k.wealth -= g;
          if (info.cap) { k.vassal = true; k.war = false; k.treaty.peace = true; k.defeated = true; rep.lines.push(`${k.name} foi subjugado e agora paga tributo.`); (s.territories.find(x => x.x === t.x && x.y === t.y)).yield = { gold: 8 }; }
        } else { loot = { gold: rint(20, 60), weapons: rint(0, 4) }; }
        for (const r2 in loot) addRes(s, r2, loot[r2]);
        rep.lines.push(`Território conquistado: ${info.name}. Espólios: ${costStr(loot)}.`);
        chron(s, `Vitória! ${info.name} foi conquistado.`, 'war'); toast(s, `${info.name} conquistado!`, 'gold', '🚩');
      } else {
        s.stats.battlesLost++;
        rep.lines.push('O ataque fracassou. Os sobreviventes recuam.');
        chron(s, `O ataque a ${info.name} fracassou.`, 'war');
      }
      s.battleLog = s.battleLog || []; s.battleLog.push({ ...rep, rounds: undefined }); if (s.battleLog.length > 20) s.battleLog.shift();
      if (offline) (s._offBattles ||= []).push(rep); else bus.emit('battle', rep);
      s._dirty = true;
    }
    if (m.returning && s.t >= m.back) { m.done = true; for (const id of m.pids) { const p = s.people.find(q => q.id === id); if (p) p.away = 0; } }
  }
  w.marches = w.marches.filter(m => !m.done);
}

export function warDaily(s, offline) {
  for (const k of s.world?.kingdoms || []) if (k.vassal && k.defeated) { addRes(s, 'gold', 2); }
}

/** Treino automático (política de construção automática): mantém uma guarnição proporcional, usando só o excedente. */
export function autoMilitary(s) {
  if (!s.policies.autoBuild || !countB(s, 'barracks')) return;
  const sol = soldiersOf(s).length;
  const want = Math.min(s._d.soldierCap, Math.ceil(s.people.length * 0.12));
  if (sol >= want || s.army.queue.length >= 2) return;
  if (s.res.food < 60 || s.res.wood < 60) return;
  const counts = unitCounts(s);
  const opts = ['spear', 'archer', 'knight'].filter(u => !UNITS[u].tech || hasTech(s, UNITS[u].tech)).sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
  for (const u of opts) { if (!canTrain(s, u)) { trainEnqueue(s, u); return; } }
}

/** Maior força inimiga que os defensores atuais ainda derrotam (busca binária sobre a batalha real). Garante ataques "justos". */
export function fairPower(s, cap, kind = 'army') {
  const D = defenders(s), hp = defHpMult(s);
  let lo = 3, hi = Math.max(4, cap);
  if (simulateBattle(composeEnemy(hi, kind, s.era), D, { dHp: hp }).win === false) return hi;
  for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; const r = simulateBattle(composeEnemy(mid, kind, s.era), D, { dHp: hp }); if (r.win) hi = mid; else lo = mid; }
  return lo;
}
