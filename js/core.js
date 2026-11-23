// core.js — ajudantes de lógica compartilhados (recursos, pessoas, crônica, barramento de eventos)
// Sem dependência de DOM: pode rodar no navegador e em testes Node.

import { RES, RES_ORDER, UNITS, TILE, DAY_LEN, ADULT_AGE } from './data.js';
import { techFx, timeInfo, makePerson, recalc, CENTER } from './state.js';
import { clamp, pick, rnd } from './util.js';

// ---------- Barramento simples de eventos (UI/FX escutam) ----------
const handlers = {};
export const bus = {
  on(name, fn) { (handlers[name] ||= []).push(fn); },
  emit(name, data) { (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); },
};
export const SILENT = { silent: false };

// ---------- Recursos ----------
export function capOf(s, r) { if (!s._d || s._dirty) recalc(s); return s._d.cap[r]; }
/** Adiciona (ou remove, se negativo) recurso respeitando a capacidade. Retorna a quantidade efetivamente somada. */
export function addRes(s, r, amt, o = {}) {
  const cap = capOf(s, r);
  const before = s.res[r];
  s.res[r] = clamp(before + amt, 0, Math.max(cap, before > cap && amt < 0 ? before : cap));
  const real = s.res[r] - before;
  if (!o.noLedger) {
    const f = (s._flow ||= {});
    f[r] = (f[r] || 0) + real;
  }
  if (real > 0 && !o.noStat) { s.stats.gathered[r] = (s.stats.gathered[r] || 0) + real; }
  if (amt > 0 && real < amt - 0.001) s._wasted = (s._wasted || 0) + (amt - real);
  return real;
}
export const canAfford = (s, cost) => Object.keys(cost).every(r => s.res[r] >= cost[r] - 1e-9);
export function spend(s, cost, o = {}) {
  if (!canAfford(s, cost)) return false;
  for (const r in cost) addRes(s, r, -cost[r], { noLedger: !o.ledger, noStat: true });
  return true;
}
export const costStr = cost => Object.entries(cost).map(([r, v]) => `${v} ${RES[r].name.toLowerCase()}`).join(', ');

// ---------- Crônica / avisos ----------
export function chron(s, text, kind = 'info') {
  const { day } = timeInfo(s);
  s.chronicle.push({ day, text, kind });
  if (s.chronicle.length > 400) s.chronicle.shift();
  bus.emit('chron', { text, kind });
}
export function toast(s, text, kind = 'info', icon = '') { bus.emit('toast', { text, kind, icon }); }
export function floatText(x, y, text, color = '#fff', icon = null) { bus.emit('float', { x, y, text, color, icon }); }

// ---------- Pessoas ----------
export const adultsOf = s => s.people.filter(p => p.age >= ADULT_AGE);
export const kidsOf = s => s.people.filter(p => p.age < ADULT_AGE);

export function dailyConsumption(s) {
  const a = adultsOf(s).length, k = s.people.length - a;
  let c = a + k * 0.5;
  c *= 1 + techFx(s, 'consume');
  if (s.policies.ration) c *= 0.7;
  return c;
}
export const foodDays = s => s.res.food / Math.max(0.01, dailyConsumption(s));
export const waterDays = s => s.res.water / Math.max(0.01, dailyConsumption(s));

export function avgJoy(s) {
  if (!s.people.length) return 0;
  return s.people.reduce((a, p) => a + p.n.joy, 0) / s.people.length;
}

export function addPerson(s, o = {}) {
  const ang = Math.random() * Math.PI * 2;
  const p = makePerson(s, { x: (CENTER.x + Math.cos(ang) * 14) * TILE, y: (CENTER.y + Math.sin(ang) * 14) * TILE, ...o });
  s.people.push(p);
  s._dirty = true;
  return p;
}

export function killPerson(s, p, cause = 'morreu') {
  const i = s.people.indexOf(p);
  if (i < 0) return;
  s.people.splice(i, 1);
  s.stats.deaths++;
  for (const q of s.people) if (q.partner === p.id) { q.partner = null; q.n.joy = Math.max(0, q.n.joy - 25); }
  s._deathMood = (s._deathMood || 0) + 1;
  chron(s, `${p.name} ${cause}.`, 'death');
  bus.emit('death', { p, cause });
  s._dirty = true;
}

/** Remove n pessoas (preferindo idosos/doentes/fracos). Retorna os nomes. */
export function killSome(s, n, cause) {
  const names = [];
  for (let i = 0; i < n && s.people.length > 1; i++) {
    const sorted = [...s.people].sort((a, b) => (a.n.health - b.n.health) + (b.age > 45 ? -10 : 0) + (Math.random() - 0.5) * 30);
    const v = sorted[0];
    names.push(v.name);
    killPerson(s, v, cause);
  }
  return names;
}

// ---------- Defesa ----------
export function soldiersOf(s) { return s.people.filter(p => p.job === 'soldado' && p.age >= ADULT_AGE && !p.away); }
export function unitPower(p) { return UNITS[p.unit || 'recruta'].power * (1 + (p.skill.soldado || 0) * 0.05); }
export function defensePower(s) {
  if (!s._d || s._dirty) recalc(s);
  let pw = s._d.defense;
  for (const p of s.people) {
    if (p.age < ADULT_AGE || p.away) continue;
    if (p.job === 'soldado') pw += unitPower(p);
    else if (p.job === 'cacador') pw += 1.5;
    else pw += 0.4;
  }
  pw += Math.min(s.res.weapons, 30) * 0.3;
  return pw * (1 + techFx(s, 'defense'));
}

// ---------- Produção: multiplicadores ----------
export function globalMult(s) {
  let m = 1;
  if (s.policies.overtime) m *= 1.25;
  m *= 1 + techFx(s, 'gather');
  return m;
}
export function personMult(s, p, job) {
  const skill = p.skill[job] || 0;
  let m = 1 + Math.min(skill, 10) * 0.06;
  m *= 0.65 + 0.35 * (p.n.joy / 100);
  m *= p.n.sleep < 20 ? 0.7 : 1;
  m *= p.sick > 0 ? 0.5 : 1;
  m *= p.n.hunger < 15 ? 0.6 : 1;
  m *= s._toolFactor || 1;
  if (p.hero) m *= 1.35;
  return m;
}
export function gainSkill(p, job, dt) {
  const v = p.skill[job] || 0;
  if (v < 10) p.skill[job] = v + dt * 0.0018 / (1 + v * 0.25);
}
export const dayRate = perDay => perDay / DAY_LEN;
