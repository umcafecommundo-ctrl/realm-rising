// Teste de fumaça da simulação (headless): roda o jogo ao vivo e offline sem DOM.
import { newGame, timeInfo } from '../js/state.js';
import { tick, step, ensureRuntime, placeBuilding, adjustJob, getAlerts, eraStatus, advanceEra } from '../js/sim.js';
import { simulateOffline } from '../js/offline.js';

const s = newGame(12345);
ensureRuntime(s);
// 4 minutos de jogo ao vivo a 3x
for (let i = 0; i < 60 * 4 * 10; i++) tick(s, 0.1 * 3);
const th = timeInfo(s);
console.log('dia', th.day, 'pop', s.people.length, 'res', JSON.stringify(Object.fromEntries(Object.entries(s.res).map(([k, v]) => [k, Math.round(v)]))));
const b = placeBuilding(s, 'shelter', 28, 20);
console.log('shelter placed', !!b);
for (let i = 0; i < 60 * 3 * 10; i++) tick(s, 0.3);
console.log('buildings', s.buildings.map(b => b.type + ':' + (b.done ? 'ok' : Math.round(b.prog * 100))).join(','));
console.log('alerts', getAlerts(s).map(a => a.level + ':' + a.text).join(' | '));
console.log('people', s.people.map(p => `${p.name}(${p.job},${Math.round(p.n.hunger)})`).join(' '));
const rep = simulateOffline(s, 3 * 3600);
console.log('offline report', JSON.stringify({ days: rep.days, pop: [rep.before.pop, rep.after.pop], events: rep.events.length, lines: rep.lines.length }));
console.log('OK');
