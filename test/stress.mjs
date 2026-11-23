// Teste de estresse: exercita eventos, mundo, diplomacia, guerra, offline e save/load sem DOM.
import { newGame, timeInfo, serialize } from '../js/state.js';
import * as sim from '../js/sim.js';
import { EVENTS, makeInstance, eventView, chooseOption, resolveAuto } from '../js/events.js';
import * as W from '../js/world.js';
import * as War from '../js/war.js';
import { simulateOffline } from '../js/offline.js';
import { BUILDINGS, TECHS, UNITS } from '../js/data.js';
import { addPerson, adultsOf, bus } from '../js/core.js';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FALHA:', m); } };
const s = newGame(4242); sim.ensureRuntime(s);
// cheat: tudo liberado
s.era = 5; for (const t in TECHS) s.tech.done[t] = true; s.flags.worldUnlocked = true; s.flags.ore = true;
for (const r in s.res) s.res[r] = 400;
for (let i = 0; i < 40; i++) addPerson(s, { age: 20 + i % 20 });
sim.refresh(s); W.initWorld(s);
// constrói um monte de coisas
let n = 0;
for (const [type, d] of Object.entries(BUILDINGS)) {
  if (type === 'campfire') continue;
  for (let tries = 0; tries < 200; tries++) { const x = 10 + Math.floor(Math.random() * 44), y = 8 + Math.floor(Math.random() * 30); if (sim.canPlace(s, type, x, y).ok) { const b = sim.placeBuilding(s, type, x, y); if (b) { b.done = true; b.prog = 1; s._dirty = true; n++; break; } } }
}
ok(n > 13, 'construiu ' + n + ' tipos');
for (const r in s.res) s.res[r] = 300;
sim.refresh(s);
for (const j of ['soldado', 'ferreiro', 'comerciante', 'sabio', 'agricultor', 'pedreiro', 'cacador', 'construtor', 'lenhador', 'coletor']) for (let i = 0; i < 4; i++) sim.adjustJob(s, j, 1);
// 1) todos os eventos, todas as opções
for (const id of Object.keys(EVENTS)) {
  for (let o = 0; o < EVENTS[id].options.length; o++) {
    const ss = JSON.parse(serialize(s)); for (const p of ss.people) p.rt = {}; sim.ensureRuntime(ss); ss.world ||= W.initWorld(ss);
    for (const k of ss.world.kingdoms) k.known = true;
    const params = id.startsWith('k_') ? (id === 'k_tribute' ? W.tributeParams(ss, ss.world.kingdoms[1]) : id === 'k_trade' ? W.tradeParams(ss, ss.world.kingdoms[2]) : { k: 1 }) : undefined;
    try { const inst = makeInstance(ss, id, params); const v = eventView(ss, inst); ok(v.title && v.options.length, id + ' view'); ss.ev.pending.push(inst); const r = chooseOption(ss, inst, o); ok(r === null || typeof r === 'string', id + ' opt ' + o); for (let i = 0; i < 100; i++) sim.tick(ss, 0.25); }
    catch (e) { fails++; console.log('EXC evento', id, o, e.stack.split('\n').slice(0, 3).join(' | ')); }
  }
}
// 2) mundo: batedores, diplomacia, ataque
try {
  const w = s.world;
  for (let i = 0; i < 12; i++) { const t = w.tiles.find(t => !t.rev && t.t !== 'sea' && !W.canScout(s, t.x, t.y)); if (!t) break; W.sendScout(s, t.x, t.y); for (let k = 0; k < 600; k++) sim.tick(s, 0.25); }
  ok(w.tiles.filter(t => t.rev).length > 30, 'revelou mapa');
  for (const k of w.kingdoms) { k.known = true; for (const a of W.diploActions(s, k)) W.doDiplo(s, k, a.id); }
  for (let i = 0; i < 3; i++) s.world.tiles.forEach(t => (t.rev = true));
  for (let i = 0; i < 12; i++) War.trainEnqueue(s, ['spear', 'archer', 'knight', 'catapult'][i % 4]);
  for (let k = 0; k < 200; k++) sim.tick(s, 0.25);
  let attacked = 0;
  for (const t of w.tiles) { if (attacked > 1) break; if (War.attackInfo(s, t.x, t.y)) { const r = War.launchAttack(s, t.x, t.y, 0.4); if (!r) attacked++; for (let k = 0; k < 800; k++) sim.tick(s, 0.25); } }
  ok(attacked > 0, 'atacou');
  console.log('batalhas', s.stats.battlesWon, s.stats.battlesLost, 'territórios', s.territories.length);
} catch (e) { fails++; console.log('EXC mundo', e.stack.split('\n').slice(0, 4).join(' | ')); }
// 3) lobos/bandidos/exército
try { for (const kind of ['wolves', 'bandits', 'army']) { s.threats.push({ id: 90, kind, power: 30, label: kind, at: s.t + 1, from: 2 }); for (let k = 0; k < 20; k++) sim.tick(s, 0.25); } } catch (e) { fails++; console.log('EXC ameaça', e.stack.split('\n').slice(0, 4).join(' | ')); }
// 4) offline longo (12h) + save/load
try {
  const rep = simulateOffline(s, 12 * 3600);
  console.log('offline: dias', rep.days.toFixed(1), 'pop', rep.before.pop, '->', rep.after.pop, 'veredito', rep.verdict, 'eventos', rep.events.length, 'batalhas', rep.battles.length, 'fome', rep.starveDays);
  const raw = serialize(s); const s2 = JSON.parse(raw); ok(s2.people.length === s.people.length, 'save/load');
  console.log('save bytes', raw.length);
} catch (e) { fails++; console.log('EXC offline', e.stack.split('\n').slice(0, 5).join(' | ')); }
// 5) novo jogo abandonado por 12h (reino pequeno)
try {
  const t = newGame(5); sim.ensureRuntime(t); t.res.food = 5; t.res.water = 5;
  const rep = simulateOffline(t, 12 * 3600);
  console.log('offline de jogo novo sem preparo: pop', rep.before.pop, '->', rep.after.pop, rep.verdict, rep.lines.map(l => l.text).join(' / '));
} catch (e) { fails++; console.log('EXC offline2', e.stack.split('\n').slice(0, 5).join(' | ')); }
console.log(fails ? `FALHAS: ${fails}` : 'STRESS OK');
process.exit(fails ? 1 : 0);
