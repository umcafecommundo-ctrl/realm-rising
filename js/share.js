// share.js — cartão do reino (imagem PNG para compartilhar) e ranking local de reinos.

import { ERAS, BUILDINGS } from './data.js';
import { genTerrain } from './state.js';
import { wondersBuilt } from './sim.js';

const RANK_KEY = 'realm-rising-rank';
export const scoreOf = s => Math.round(s.people.length * 2 + (s.era - 1) * 120 + s.territories.length * 35 + wondersBuilt(s) * 150 + (s.legacy || 0) * 40 + Object.keys(s.achievements).length * 6 + (s.tech.rep || 0) * 5);
const daysOf = s => Math.floor(s.t / 100);

export function getRanking() { try { return JSON.parse(localStorage.getItem(RANK_KEY) || '[]'); } catch (e) { return []; } }
/** Registra/atualiza este reino no ranking local (mantém os 10 melhores). */
export function recordRun(s) {
  try {
    const r = getRanking().filter(x => x.id !== s.created);
    r.push({ id: s.created, name: s.name, score: scoreOf(s), era: s.era, pop: s.people.length, days: daysOf(s), legacy: s.legacy || 0, date: Date.now() });
    r.sort((a, b) => b.score - a.score);
    localStorage.setItem(RANK_KEY, JSON.stringify(r.slice(0, 10)));
  } catch (e) { /* ok */ }
}

const CAT = { Moradia: '#e8b06a', Armazém: '#b8905a', Produção: '#9a9aa8', Economia: '#e8c15a', Militar: '#c05a4a', Realeza: '#b07ad8', Império: '#ffd84a', Especial: '#ff9a3c' };
export function makeCard(s) {
  const W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const era = ERAS[s.era];
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#16231a'); g.addColorStop(1, '#2a1f12'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // minimapa 64x48 a 8 px por tile
  const mx = 40, my = 120, S = 8, terr = s._terr || genTerrain(s.seed);
  x.fillStyle = '#4f9a3a'; x.fillRect(mx, my, 64 * S, 48 * S);
  for (let i = 0; i < terr.water.length; i++) if (terr.water[i]) { x.fillStyle = '#3f9fd4'; x.fillRect(mx + (i % 64) * S, my + Math.floor(i / 64) * S, S, S); }
  for (const n of s.nodes) { if (n.type === 'tree' && n.st === 'alive') { x.fillStyle = '#2f6f35'; x.beginPath(); x.arc(mx + n.x * S, my + n.y * S, 3.2, 0, 7); x.fill(); } else if (n.type === 'rock') { x.fillStyle = '#9aa3ad'; x.fillRect(mx + n.x * S - 2, my + n.y * S - 2, 4, 4); } }
  for (const b of s.buildings) { const d = BUILDINGS[b.type]; x.fillStyle = b.type === 'road' ? '#b8b0a0' : (CAT[d.cat] || '#fff'); x.fillRect(mx + b.x * S, my + b.y * S, b.w * S, b.h * S); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.strokeRect(mx + b.x * S, my + b.y * S, b.w * S, b.h * S); }
  x.strokeStyle = era.color; x.lineWidth = 4; x.strokeRect(mx - 2, my - 2, 64 * S + 4, 48 * S + 4);
  // textos
  x.fillStyle = '#fff'; x.font = '700 46px system-ui,sans-serif'; x.fillText(s.name, 40, 70);
  x.fillStyle = era.color; x.font = '600 24px system-ui,sans-serif'; x.fillText(`Era ${era.name} · Ano ${Math.floor(s.t / 100 / 24) + 1}`, 40, 102);
  const L = [['👥 População', s.people.length], ['📅 Dias', daysOf(s)], ['🏗️ Construções', s.buildings.filter(b => b.done).length], ['🚩 Territórios', s.territories.length], ['🌟 Maravilhas', wondersBuilt(s)], ['🧬 Legado', s.legacy || 0], ['🔬 Pesquisas', Object.keys(s.tech.done).length + (s.tech.rep || 0)]];
  const rx = 600 + 40;
  x.font = '600 26px system-ui,sans-serif'; L.forEach(([k, v], i) => { x.fillStyle = '#c9d4c0'; x.fillText(k, rx, 190 + i * 52); x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(String(v), W - 60, 190 + i * 52); x.textAlign = 'left'; });
  x.fillStyle = '#f2c14e'; x.font = '800 54px system-ui,sans-serif'; x.fillText(`${scoreOf(s)} pts`, rx, 580);
  x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '500 20px system-ui,sans-serif'; x.fillText('Realm Rising', W - 190, 600);
  return c;
}
export async function shareCard(s) {
  const c = makeCard(s);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `${s.name.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: s.name, text: `${s.name} — ${scoreOf(s)} pontos no Realm Rising` }); return 'shared'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'download';
}
