// weekly.js — desafios da semana (semana real do calendário): 3 metas por semana com recompensa de Legado.

import { RNG } from './util.js';
import { chron, toast, addRes, bus } from './core.js';

const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
const snap = s => ({ built: sum(s.stats.built), tech: Object.keys(s.tech.done).length + (s.tech.rep || 0), won: s.stats.battlesWon, gold: s.stats.gathered.gold || 0, births: s.stats.births, terr: s.territories.length, events: s.stats.eventsSeen, trades: s.stats.tradesDone });
const POOL = [
  { id: 'built', text: n => `Conclua ${n} construções`, target: s => 4 + s.era * 3, cur: (s, b) => snap(s).built - b.built },
  { id: 'tech', text: n => `Pesquise ${n} tecnologias`, target: s => 2 + Math.floor(s.era / 2), cur: (s, b) => snap(s).tech - b.tech },
  { id: 'won', text: n => `Vença ${n} batalhas`, target: s => 1 + Math.floor(s.era / 3), cur: (s, b) => snap(s).won - b.won },
  { id: 'gold', text: n => `Junte ${n} de ouro`, target: s => 80 * s.era, cur: (s, b) => snap(s).gold - b.gold },
  { id: 'births', text: n => `Veja ${n} crianças nascerem`, target: s => 3 + s.era, cur: (s, b) => snap(s).births - b.births },
  { id: 'terr', text: n => `Conquiste ${n} território(s)`, target: s => 1, cur: (s, b) => snap(s).terr - b.terr },
  { id: 'events', text: n => `Resolva ${n} eventos`, target: s => 4, cur: (s, b) => snap(s).events - b.events },
  { id: 'pop', text: n => `Alcance ${n} moradores`, target: s => 15 * s.era + s.people.length * 0 + 10, cur: (s, b) => s.people.length },
  { id: 'trades', text: n => `Faça ${n} trocas comerciais`, target: s => 3, cur: (s, b) => snap(s).trades - b.trades },
];
export const weekIndex = () => Math.floor(Date.now() / (7 * 864e5));

export function ensureWeekly(s) {
  const w = weekIndex();
  if (s.weekly && s.weekly.week === w) return;
  const rng = new RNG((w * 2654435761) ^ s.seed);
  const pool = [...POOL], goals = [];
  while (goals.length < 3 && pool.length) { const g = pool.splice(rng.int(0, pool.length - 1), 1)[0]; goals.push({ id: g.id, target: g.target(s), done: false }); }
  s.weekly = { week: w, base: snap(s), goals };
}
export function weeklyList(s) {
  if (!s.weekly) return [];
  return s.weekly.goals.map(g => { const d = POOL.find(p => p.id === g.id); const cur = Math.max(0, Math.min(g.target, Math.floor(d.cur(s, s.weekly.base)))); return { text: d.text(g.target), cur, target: g.target, done: g.done }; });
}
export function checkWeekly(s) {
  if (!s.weekly) return;
  for (const g of s.weekly.goals) {
    if (g.done) continue;
    const d = POOL.find(p => p.id === g.id);
    if (d.cur(s, s.weekly.base) >= g.target) {
      g.done = true; s.legacy = (s.legacy || 0) + 1; addRes(s, 'jewels', 2, { noStat: true }); addRes(s, 'gold', 100, { noStat: true });
      chron(s, `Desafio da semana cumprido: ${d.text(g.target)}. +1 de Legado!`, 'achv'); toast(s, `Desafio da semana: ${d.text(g.target)} — +1 Legado`, 'gold', '📅');
      s._dirty = true;
    }
  }
}
