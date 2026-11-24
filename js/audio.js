// audio.js — som procedural (WebAudio, sem arquivos): efeitos, ambiente (chuva, vento, fogueira, pássaros, grilos) e música generativa por estação.

import { bus } from './core.js';

const KEY = 'realm-rising-audio';
const SCALES = [[0, 2, 4, 7, 9], [0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 3, 7, 10]];   // primavera/verão: maior; outono: menor; inverno: esparso
const ROOT = [261.6, 293.7, 220, 196];

class SoundEngine {
  constructor() {
    this.ctx = null; this.sfx = true; this.music = true; this.vol = 0.6;
    try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (o.sfx === false) this.sfx = false; if (o.music === false) this.music = false; } catch (e) { /* ok */ }
    this.lastSfx = {}; this.nextNote = 0; this.nextBird = 0;
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ sfx: this.sfx, music: this.music })); } catch (e) { /* ok */ } }
  /** Cria o AudioContext (precisa de um gesto do usuário). */
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol; this.master.connect(c.destination);
    // reverb simples (delay com realimentação)
    this.rev = c.createGain(); const dl = c.createDelay(1); dl.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.38; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.rev.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.master); this.rev.gain.value = 0.5;
    // ruído para ambiente
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const loop = (type, freq, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return g; };
    this.rain = loop('bandpass', 1800, 0.6); this.wind = loop('lowpass', 420, 0.8); this.fire = loop('bandpass', 900, 1.2);
    bus.emit('audio-ready');
  }
  setSfx(v) { this.sfx = v; this.save(); }
  setMusic(v) { this.music = v; this.save(); }
  tone(f, dur, type = 'sine', g = 0.12, slide = 0, delay = 0, rev = 0.3) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), a = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.012); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); a.connect(this.master); if (rev) { const r = c.createGain(); r.gain.value = rev; a.connect(r); r.connect(this.rev); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, freq, g = 0.1, delay = 0, q = 1) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const a = c.createGain();
    a.gain.setValueAtTime(g, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(a); a.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  /** Efeito sonoro com limite de frequência por tipo (evita sobrecarga) */
  play(k, o = {}) {
    if (!this.ctx || !this.sfx) return;
    const now = this.ctx.currentTime, gap = { chop: 0.35, mine: 0.4, hammer: 0.35, fall: 0.2, click: 0.05 }[k] ?? 0.08;
    if (now - (this.lastSfx[k] || -9) < gap) return; this.lastSfx[k] = now;
    const v = o.v ?? 1;
    switch (k) {
      case 'chop': this.noise(0.09, 1100, 0.16 * v, 0, 1.4); this.tone(150, 0.12, 'triangle', 0.1 * v, -60, 0, 0); break;
      case 'mine': this.tone(1700 + Math.random() * 500, 0.06, 'square', 0.04 * v, -400, 0, 0.1); this.noise(0.05, 2600, 0.1 * v); break;
      case 'hammer': this.tone(330, 0.1, 'triangle', 0.11 * v, -120, 0, 0.1); this.noise(0.04, 1800, 0.08 * v); break;
      case 'fall': this.noise(0.5, 500, 0.25 * v, 0, 0.7); this.tone(90, 0.35, 'sine', 0.2 * v, -50, 0.12, 0); break;
      case 'click': this.tone(900, 0.04, 'square', 0.025, 0, 0, 0); break;
      case 'built': [523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, 0, i * 0.09)); break;
      case 'good': this.tone(784, 0.2, 'sine', 0.08); this.tone(1047, 0.3, 'sine', 0.07, 0, 0.09); break;
      case 'bad': this.tone(196, 0.3, 'sawtooth', 0.06, -40, 0, 0.1); this.tone(147, 0.4, 'sawtooth', 0.05, -30, 0.12, 0.1); break;
      case 'gold': [659, 880, 1175, 1568].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.08, 0, i * 0.07)); break;
      case 'era': [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => { this.tone(f, 0.7, 'triangle', 0.1, 0, i * 0.12); this.tone(f / 2, 0.9, 'sine', 0.06, 0, i * 0.12); }); break;
      case 'event': this.tone(660, 0.9, 'sine', 0.09, 0, 0, 0.6); this.tone(990, 0.9, 'sine', 0.05, 0, 0.02, 0.6); break;
      case 'battle': for (let i = 0; i < 8; i++) { this.noise(0.12, 220, 0.2, i * 0.18, 0.8); this.tone(85, 0.14, 'sine', 0.18, -20, i * 0.18, 0); } break;
      case 'birth': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.07, 0, i * 0.12)); break;
    }
  }
  /** Ambiente + música: chamado a cada quadro com o estado do jogo. */
  update(s, th, dt, view) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const on = this.sfx ? 1 : 0, wt = s.weather.type;
    const night = th.hour >= 20.5 || th.hour < 5.5;
    const set = (g, v) => g.gain.setTargetAtTime(v * on, t, 0.6);
    set(this.rain, wt === 'storm' ? 0.2 : wt === 'rain' ? 0.1 : 0);
    set(this.wind, wt === 'storm' ? 0.18 : th.season === 3 ? 0.07 : 0.025);
    set(this.fire, 0.045 + (night ? 0.03 : 0));
    // pássaros (dia, primavera/verão) e grilos (noite de verão)
    if (this.sfx && t > this.nextBird) {
      this.nextBird = t + 2.5 + Math.random() * 6;
      if (!night && th.season <= 1 && wt === 'clear') { const f = 2200 + Math.random() * 1400; this.tone(f, 0.09, 'sine', 0.025, 500, 0, 0.1); this.tone(f * 1.2, 0.09, 'sine', 0.02, -300, 0.11, 0.1); this.tone(f * 0.9, 0.12, 'sine', 0.02, 400, 0.24, 0.1); }
      else if (night && th.season === 1) { for (let i = 0; i < 5; i++) this.tone(4200, 0.03, 'square', 0.008, 0, i * 0.06, 0); }
      else if (night && th.season === 3 && Math.random() < 0.2) this.tone(330, 1.6, 'sine', 0.03, 120, 0, 0.7);   // vento/uivo distante
    }
    // música generativa
    if (this.music && t > this.nextNote) {
      const sc = SCALES[th.season], root = ROOT[th.season] * (night ? 0.5 : 1);
      const deg = sc[Math.floor(Math.random() * sc.length)], oct = Math.random() < 0.3 ? 2 : 1;
      const f = root * Math.pow(2, deg / 12) * oct;
      this.tone(f, 2.2, 'triangle', th.season === 3 ? 0.03 : 0.045, 0, 0, 0.8);
      if (Math.random() < 0.35) this.tone(f * 1.5, 2.6, 'sine', 0.02, 0, 0.05, 0.8);
      this.nextNote = t + (th.season === 3 ? 3.5 : 1.8) + Math.random() * 2.5;
    }
  }
}
export const Sound = new SoundEngine();

/** Liga o som aos eventos do jogo (efeitos). `listener` devolve o retângulo visível da câmera. */
export function bindSound(listener) {
  const inView = (x, y) => { const v = listener(); return !v || (x >= v.x0 - 80 && x <= v.x1 + 80 && y >= v.y0 - 80 && y <= v.y1 + 80); };
  bus.on('sfx', e => { if (e.x != null && !inView(e.x, e.y)) return; Sound.play(e.k, { v: e.v }); });
  bus.on('treefall', n => { if (inView(n.x * 32, n.y * 32)) Sound.play('fall'); });
  bus.on('built', () => Sound.play('built'));
  bus.on('era', () => Sound.play('era'));
  bus.on('battle', () => Sound.play('battle'));
  bus.on('event', () => Sound.play('event'));
  bus.on('birth', () => Sound.play('birth'));
  bus.on('achievement', () => Sound.play('gold'));
  bus.on('toast', t => { if (t.kind === 'bad') Sound.play('bad'); else if (t.kind === 'gold') Sound.play('gold'); else if (t.kind === 'good') Sound.play('good'); });
  const unlock = () => Sound.start();
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { once: false, passive: true });
  document.addEventListener('click', e => { if (e.target.closest('button')) Sound.play('click'); }, true);
}
