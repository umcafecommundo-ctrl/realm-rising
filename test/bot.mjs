// Bot de equilíbrio: joga o jogo de forma razoável (headless) para detectar travas e problemas de ritmo.
import { newGame, timeInfo, unlocked, hasTech, countB, CENTER } from '../js/state.js';
import { tick, ensureRuntime, placeBuilding, canPlace, adjustJob, jobCounts, eraStatus, advanceEra, techAvailable, startResearch, setPolicy } from '../js/sim.js';
import { resolveAuto } from '../js/events.js';
import { BUILDINGS, TECHS, JOBS, DAY_LEN } from '../js/data.js';
import { adultsOf, soldiersOf } from '../js/core.js';
import { trainEnqueue } from '../js/war.js';

const MIN = +process.argv[2] || 60;
const seed = +process.argv[3] || 777;
const s = newGame(seed); ensureRuntime(s);
const W = { wood: 0 };
function spot(type) {
  const d = BUILDINGS[type];
  for (let r = 3; r < 22; r++) for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + r;
    const x = Math.round(CENTER.x + Math.cos(a) * r - d.w / 2), y = Math.round(CENTER.y + Math.sin(a) * r * 0.8 - d.h / 2);
    if (canPlace(s, type, x, y).ok) return [x, y];
  }
  return null;
}
const have = t => s.buildings.filter(b => b.type === t).length;
function want(type, n) { if (!unlocked(s, type)) return; if (have(type) >= n) return; if (s.buildings.filter(b => !b.done).length >= 3) return; const sp = spot(type); if (sp) placeBuilding(s, type, sp[0], sp[1]); }
function jobs() {
  const N = adultsOf(s).length;
  const tgt = {};
  const farms = s.buildings.filter(b => b.type === 'farm' && b.done).length;
  tgt.construtor = Math.max(1, Math.round(N * 0.12));
  tgt.lenhador = Math.round(N * 0.28);
  tgt.agricultor = farms * 2;
  tgt.coletor = Math.round(N * (farms ? 0.1 : 0.25));
  tgt.pedreiro = Math.round(N * 0.14);
  tgt.cacador = N > 6 ? 1 : 0;
  if (s.era >= 3) { tgt.ferreiro = have('smithy') * 2; tgt.comerciante = have('market') * 2 + have('tavern'); }
  if (hasTech(s, 'military')) tgt.soldado = Math.min(s._d.soldierCap, Math.round(N * 0.12));
  if (hasTech(s, 'writing')) tgt.sabio = Math.min(have('academy') * 3, 6);
  const c = jobCounts(s);
  for (const j in tgt) { for (let i = 0; i < 30 && (c[j] || 0) < tgt[j]; i++) { if (!adjustJob(s, j, 1)) break; c[j] = (c[j] || 0) + 1; } }
}
const log = [];
globalThis.__dbg = s;
let nextCheck = 0, lastDay = -1;
for (let t = 0; t < MIN * 60; t += 0.25) {
  tick(s, 0.25);
  if (s.t < nextCheck) continue;
  nextCheck = s.t + 4;
  for (const e of [...s.ev.pending]) resolveAuto(s, e);
  s.ev.pending = [];
  const pop = s.people.length, beds = s._d.beds;
  if (beds - pop < 3) want(s.era >= 2 ? 'house' : 'shelter', have('house') + have('shelter') + 1);
  want('gatherpoint', 1);
  if (s.era >= 2) { want('farm', Math.floor(pop / 9) + 1); want('well', 1); want('sawmill', 1); want('storehouse', 1 + Math.floor(pop / 22)); }
  if (s.era >= 3) { want('market', 1); want('smithy', 1); want('tavern', 1); want('loom', 1); want('mine', 1); want('barracks', 1); want('well', 2); want('storehouse', 2 + Math.floor(pop / 18)); }
  if (s.era >= 4) { want('castle', 1); want('cathedral', 1); want('academy', 1); want('jeweler', 1); want('port', 1); want('storehouse', 3 + Math.floor(pop / 15)); }
  if (s.era >= 5) { want('monument', 1); want('wonder', 1); }
  jobs();
  if (!s.tech.current) { const av = Object.keys(TECHS).filter(id => techAvailable(s, id)).sort((a, b) => TECHS[a].cost - TECHS[b].cost); if (av.length) startResearch(s, av[0]); }
  if (eraStatus(s)?.ready) advanceEra(s);
  if (s.era >= 3 && countB(s, 'barracks')) for (let i = 0; i < 2; i++) trainEnqueue(s, 'spear');
  const th = timeInfo(s);
  if (process.env.DBG && Math.round(s.t) % 20 === 0) console.log(Math.round(s.t), 'water', s.res.water.toFixed(1), 'food', s.res.food.toFixed(1), s.people.map(p => p.job + ':' + (p.rt.task?.k || '-') + ':' + (p.rt.task?.ph || '') + ' h' + Math.round(p.n.hunger)).join(' | '));
  if (th.day !== lastDay && th.day % 6 === 0) {
    lastDay = th.day;
    log.push(`d${String(th.day).padStart(3)} era${s.era} pop${String(pop).padStart(3)}/${String(beds).padStart(3)} joy${Math.round(s.people.reduce((a, p) => a + p.n.joy, 0) / pop)} ` +
      ['wood', 'stone', 'food', 'water', 'planks', 'iron', 'gold'].map(r => r[0] + Math.round(s.res[r])).join(' ') + ` b${s.buildings.filter(b => b.done).length} tech${Object.keys(s.tech.done).length} deaths${s.stats.deaths} thr${s.threats.length} bw${s.stats.battlesWon}/${s.stats.battlesLost}`);
  }
  if (pop === 0) { log.push('EXTINCT at day ' + th.day); break; }
}
console.log(log.join('\n'));
console.log('chronicle tail:\n' + s.chronicle.slice(-12).map(c => `  d${c.day} [${c.kind}] ${c.text}`).join('\n'));
if (process.env.OFF) {
  const { simulateOffline } = await import('../js/offline.js');
  const rep = simulateOffline(s, +process.env.OFF * 3600);
  console.log('OFFLINE', process.env.OFF + 'h', 'dias', rep.days.toFixed(1), 'pop', rep.before.pop, '->', rep.after.pop, 'era', rep.before.era, '->', rep.after.era, rep.verdict, 'mortes', rep.deaths, 'fugas', rep.left, 'nasc', rep.births, 'imig', rep.immigrants);
  console.log(rep.lines.map(l => ' - ' + l.text).join('\n')); console.log(' recursos:', JSON.stringify(rep.dRes)); console.log(' eventos:', rep.events.map(e => e.title + '→' + e.choice).join('; '));
}
if (process.env.OFF) { const k = {}; for (const c of s.chronicle) if (c.kind === 'death') { const m = c.text.replace(/^.*? (morreu|sucumbiu|tombou|foi morto|faleceu|não resistiu)/, '$1'); k[m] = (k[m] || 0) + 1; } console.log('MORTES', JSON.stringify(k)); }
console.log('BATALHAS', s.stats.battlesWon, s.stats.battlesLost, (s.battleLog || []).slice(-8).map(b => `${b.win ? 'V' : 'D'} ${b.title}: ${b.lines.join(' ')}`).join('\n  '));
console.log('def', Math.round((await import('../js/core.js')).defensePower(s)), 'kingdoms', s.world ? s.world.kingdoms.map(k => `${k.name.split(' ')[0]} str${Math.round(k.str)} rel${Math.round(k.rel)} ${k.war ? 'WAR' : ''}${k.treaty.peace ? 'peace' : ''}`).join(' | ') : '-');
