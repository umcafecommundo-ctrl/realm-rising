// offline.js — progresso enquanto o jogador está fora (até 12 h) + montagem do "Relatório do Reino"

import { OFFLINE_MAX, OFFLINE_SCALE, DAY_LEN, RES, RES_ORDER, ERAS, TECHS, BUILDINGS } from './data.js';
import { timeInfo } from './state.js';
import { step, refresh } from './sim.js';
import { resolveAuto } from './events.js';
import { foodDays, avgJoy } from './core.js';
import { tidyManual } from './planner.js';

/** Simula `realSeconds` de ausência. Devolve um relatório para exibição. */
export function simulateOffline(s, realSeconds) {
  const capped = realSeconds > OFFLINE_MAX;
  const secs = Math.min(realSeconds, OFFLINE_MAX);
  const gameSecs = secs * OFFLINE_SCALE;
  const th0 = timeInfo(s);
  const before = { res: { ...s.res }, pop: s.people.length, era: s.era, day: th0.day, season: th0.season, buildings: s.buildings.filter(b => b.done).length, joy: avgJoy(s), territories: s.territories.length };
  const chronMark = s.chronicle.length;
  const names0 = new Map(s.people.map(p => [p.id, p.name]));
  const techs0 = new Set(Object.keys(s.tech.done));
  const stats0 = { births: s.stats.births, deaths: s.stats.deaths, immigrants: s.stats.immigrants, won: s.stats.battlesWon, lost: s.stats.battlesLost };
  s._offLog = []; s._offBattles = []; s._left = 0; s._offSeasons = 0; s._autoBuilt = []; s._moved = [];
  if (s.policies.autoBuild) tidyManual(s); else for (const b of s.buildings) b.manual = false;
  let starveSec = 0, coldSec = 0, minFood = s.res.food, minJoy = 100, fullSec = 0;

  // decisões pendentes: resolvidas pela política padrão
  for (const inst of [...s.ev.pending]) resolveAuto(s, inst);
  s.ev.pending = [];
  s._offBudget = Math.max(2, Math.floor(s.people.length * 0.4));
  refresh(s);

  const DT = 2;
  let t = 0;
  while (t < gameSecs) {
    const d = Math.min(DT, gameSecs - t);
    step(s, d, true);
    t += d;
    if (s.res.food <= 0.5) starveSec += d;
    if (s._cold) coldSec += d;
    minFood = Math.min(minFood, s.res.food);
    minJoy = Math.min(minJoy, avgJoy(s));
    if (s.people.length === 0) break;
  }
  s._offBudget = undefined;
  for (const p of s.people) { p.rt = {}; if (p.away > 0 && p.away < 1e8) p.away = Math.max(0, p.away - gameSecs); }
  refresh(s);

  const th1 = timeInfo(s);
  const after = { res: { ...s.res }, pop: s.people.length, era: s.era, day: th1.day, season: th1.season, buildings: s.buildings.filter(b => b.done).length, joy: avgJoy(s), territories: s.territories.length };
  const dRes = {};
  for (const r of RES_ORDER) { const d = Math.round(after.res[r] - before.res[r]); if (Math.abs(d) >= 1) dRes[r] = d; }
  const newTechs = Object.keys(s.tech.done).filter(t => !techs0.has(t)).map(t => TECHS[t].name);
  const births = s.stats.births - stats0.births, deaths = s.stats.deaths - stats0.deaths, imm = s.stats.immigrants - stats0.immigrants;
  const chron = s.chronicle.slice(chronMark).filter(c => !['season'].includes(c.kind)).map(c => ({ day: c.day, text: c.text, kind: c.kind }));
  const daysGone = Math.round((after.day - before.day) * 10) / 10;

  // veredito
  const lines = [];
  let verdict = 'estavel';
  const popDelta = after.pop - before.pop;
  if (starveSec > 5 * DAY_LEN * 0.2 || deaths > Math.max(2, before.pop * 0.25) || after.pop < before.pop * 0.7) verdict = 'crise';
  else if (popDelta > 0 || after.era > before.era || newTechs.length > 1) verdict = 'prosperou';
  if (starveSec > 0) lines.push({ lvl: 'bad', text: `Fome: o reino ficou sem comida por cerca de ${Math.max(1, Math.round(starveSec / DAY_LEN * 10) / 10)} dia(s).` });
  if (coldSec > 0) lines.push({ lvl: 'bad', text: `Frio: faltou lenha por ~${Math.round(coldSec / DAY_LEN * 10) / 10} dia(s) de inverno.` });
  if (s._left) lines.push({ lvl: 'bad', text: `${s._left} morador(es) abandonaram o reino por infelicidade.` });
  if (minJoy < 30) lines.push({ lvl: 'warn', text: 'A felicidade chegou a níveis perigosos durante sua ausência.' });
  if (s._wasted > 30) lines.push({ lvl: 'warn', text: `Cerca de ${Math.round(s._wasted)} unidades de recursos foram desperdiçadas: os armazéns estavam cheios! Construa mais depósitos.` });
  s._wasted = 0;
  if (!starveSec && !coldSec && !s._left && deaths === 0) lines.push({ lvl: 'good', text: 'Os estoques de comida e as políticas seguraram o reino com tranquilidade.' });
  if (after.era > before.era) lines.push({ lvl: 'good', text: `O reino avançou para a era ${ERAS[after.era].name}!` });

  s._offLog = s._offLog || [];
  const report = {
    realSeconds: secs, capped, days: daysGone, before, after, dRes, births, deaths, immigrants: imm, left: s._left || 0,
    newTechs, events: s._offLog, battles: (s._offBattles || []).map(b => ({ title: b.title, win: b.win, lines: b.lines })), chron: chron.slice(-40), lines, verdict,
    seasons: s._offSeasons || 0, minFood: Math.round(minFood), starveDays: Math.round(starveSec / DAY_LEN * 10) / 10,
    builds: after.buildings - before.buildings, autoBuilt: s._autoBuilt || [], moved: s._moved || [], lostNames: [], vulnerable: after.pop === 0,
  };
  s._offLog = []; s._offBattles = []; s._autoBuilt = []; s._moved = [];
  return report;
}
