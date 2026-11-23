// main.js — inicialização, laço principal, autosave e progresso offline

import { newGame as mkGame, load, save, wipeSave, timeInfo, serialize, migrate } from './state.js';
import { tick, ensureRuntime } from './sim.js';
import { simulateOffline } from './offline.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Tutorial } from './tutorial.js';
import { bus } from './core.js';
import { OFFLINE_MAX } from './data.js';

const game = {
  s: null, r: null, ui: null, tut: null, booting: true,
  saveNow() { if (this.s) save(this.s); },
  newGame() {
    wipeSave();
    this.s = mkGame(); ensureRuntime(this.s);
    this.ui.reset(); this.r.parts = []; this.r.floats = []; this.r.focus(32 * 32, 26 * 32, 1.4);
    this.tut.reset(); this.saveNow();
  },
  importSave(text) {
    const s = JSON.parse(text);
    if (!s || s.v !== 1 || !s.people) throw new Error('inválido');
    migrate(s);
    this.s = s; ensureRuntime(s); this.ui.reset(); this.tut.reset(); this.saveNow();
  },
  /** Auxiliar de depuração/testes: avança a simulação `sec` segundos de jogo (ao vivo). */
  fast(sec) { for (let t = 0; t < sec; t += 0.25) tick(this.s, 0.25 / (this.s.speed || 1)); },
  restartTutorial() { this.s.tut = { step: 0, done: false, tips: this.s.tut.tips || {} }; this.tut.reset(); },
};
window.__game = game;

async function boot() {
  const canvas = document.getElementById('game');
  let s = load();
  const fresh = !s;
  if (!s) s = mkGame();
  game.s = s;
  ensureRuntime(s);
  game.r = new Renderer(canvas);
  const mobile = innerWidth < 760;
  game.r.focus(32 * 32, 26 * 32 + 10, mobile ? 1.15 : 1.5);
  game.ui = new UI(game);
  game.tut = new Tutorial(game.ui);

  // progresso offline
  let report = null;
  if (!fresh) {
    const away = (Date.now() - s.lastSaved) / 1000;
    if (away > 45) { try { report = simulateOffline(s, away); s.pendingReports.push(report); save(s); } catch (e) { console.error('offline falhou', e); } }
  }
  game.ui.updateHUD(s); game.ui.updateGoals(s); game.ui.updateAlerts(s);
  setTimeout(() => {
    document.getElementById('boot').classList.add('gone');
    game.booting = false;
    game.ui.pumpEvents();
  }, 450);

  // laço principal
  let last = performance.now(), saveT = 0, hiddenAt = null;
  function frame(now) {
    const raw = (now - last) / 1000; const dt = Math.min(0.1, raw); last = now;
    if (raw < 0.5) game.r.perf(raw);
    const st = game.s;
    if (!game.booting || true) tick(st, dt);
    game.r.render(st, dt);
    game.r.lastDt = dt;
    game.ui.update(dt);
    game.tut.update(dt);
    saveT += dt;
    if (saveT > 5) { saveT = 0; save(st); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // aba oculta: conta como tempo offline ao voltar
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); save(game.s); }
    else if (hiddenAt) {
      const away = (Date.now() - hiddenAt) / 1000; hiddenAt = null; last = performance.now();
      if (away > 45) {
        game.s.lastSaved = Date.now() - away * 1000;
        try { const rep = simulateOffline(game.s, away); game.s.pendingReports.push(rep); save(game.s); game.ui.pumpEvents(); } catch (e) { console.error(e); }
      }
    }
  });
  // salva logo após qualquer interação (debounce) e em todos os eventos de saída
  let soon = 0; const saveSoon = () => { clearTimeout(soon); soon = setTimeout(() => save(game.s), 700); };
  game.saveSoon = saveSoon;
  document.addEventListener('pointerup', saveSoon, true); document.addEventListener('keyup', saveSoon, true);
  for (const ev of ['bought', 'placed', 'built', 'era', 'tech', 'quest', 'achievement', 'demolished', 'event']) bus.on(ev, saveSoon);
  document.addEventListener('freeze', () => save(game.s));
  window.addEventListener('blur', () => save(game.s));
  try { navigator.storage?.persist?.(); } catch (e) { /* ok */ }
  window.addEventListener('pagehide', () => save(game.s));
  window.addEventListener('beforeunload', () => save(game.s));
}
boot().catch(e => { console.error(e); document.querySelector('.boot-inner p').textContent = 'Erro ao iniciar: ' + e.message; });
