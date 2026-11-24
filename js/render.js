// render.js — câmera, desenho do mundo (terreno, entidades, partículas), iluminação dia/noite, clima e entrada (arrastar/zoom/pinça)

import { TILE, MAP_W, MAP_H, BUILDINGS, JOBS, DAY_LEN, SEASONS, ADULT_AGE } from './data.js';
import { timeInfo, isNight, CENTER, eraRadius, isWater, recalc, kindOf } from './state.js';
import { terrainTiles, treeSprite, stumpSprite, saplingSprite, rockSprite, bushSprite, iconURL, PAL, SC, TREE_BOX, rg } from './art.js';
import { buildingSprite, scaffoldSprite, foundationSprite } from './art_b.js';
import { bus } from './core.js';
import { clamp, lerp, hash2, fbm, rnd, shade, rgba, mix, smooth, pick } from './util.js';

const WW = MAP_W * TILE, WH = MAP_H * TILE;
const iconImgs = {};
export function iconImg(name) {
  if (!iconImgs[name]) { const i = new Image(); i.src = iconURL(name, 40); iconImgs[name] = i; }
  return iconImgs[name];
}

// Ciclo de iluminação: [hora, r, g, b, alfa]
const AMB = [[0, 12, 18, 62, 0.68], [4.8, 18, 24, 70, 0.62], [5.8, 255, 150, 100, 0.26], [7.2, 255, 220, 170, 0.07], [9, 255, 245, 220, 0], [16, 255, 240, 210, 0], [17.8, 255, 160, 80, 0.2], [19.2, 150, 70, 120, 0.38], [20.6, 20, 24, 72, 0.62], [24, 12, 18, 62, 0.68]];
function ambient(h) {
  for (let i = 0; i < AMB.length - 1; i++) {
    const a = AMB[i], b = AMB[i + 1];
    if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t)]; }
  }
  return AMB[0].slice(1);
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: CENTER.x * TILE, y: CENTER.y * TILE, z: 1.3 };
    this.parts = []; this.floats = []; this.fxWolves = [];
    this.time = 0; this.dpr = 1; this.w = 800; this.h = 600;
    this.selection = null; this.ghost = null; this.hover = null;
    this.light = document.createElement('canvas'); this.lctx = this.light.getContext('2d');
    this.macro = this.makeMacro();
    this.pointers = new Map(); this.dragMoved = 0;
    this.flash = 0; this.rainDrops = []; this.snowFlakes = [];
    this.emit = {}; this.quake = 0;
    this.attachInput();
    this.attachBus();
    this.resize();
  }
  makeMacro() {
    const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H;
    const x = c.getContext('2d'), img = x.createImageData(MAP_W, MAP_H);
    for (let j = 0; j < MAP_H; j++) for (let i = 0; i < MAP_W; i++) {
      const v = fbm(i * 0.17, j * 0.17, 33, 3), o = (j * MAP_W + i) * 4;
      if (v > 0.52) { img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 190; img.data[o + 3] = (v - 0.52) * 150; }
      else { img.data[o] = 10; img.data[o + 1] = 50; img.data[o + 2] = 30; img.data[o + 3] = (0.52 - v) * 150; }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.max(0.6, Math.min(window.devicePixelRatio || 1, 2) * (this.quality || 1));
    this.w = Math.max(100, r.width); this.h = Math.max(100, r.height);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.light.width = Math.ceil(this.w / 2); this.light.height = Math.ceil(this.h / 2);
    this.clampCam();
  }
  /** Qualidade adaptativa: se a taxa de quadros cair, reduz a resolução interna do canvas. */
  perf(rawDt) {
    this.ema = this.ema === undefined ? rawDt : this.ema * 0.95 + rawDt * 0.05;
    this.pt = (this.pt || 0) + rawDt;
    if (this.pt < 3) return;
    this.pt = 0;
    const q = this.quality || 1;
    if (this.ema > 0.036 && q > 0.6) { this.quality = Math.max(0.6, q - 0.15); this.resize(); }
    else if (this.ema < 0.019 && q < 1) { this.quality = Math.min(1, q + 0.1); this.resize(); }
  }
  clampCam() {
    const c = this.cam;
    const minZ = Math.max(this.w / WW, this.h / WH, 0.45);
    c.z = clamp(c.z, minZ, 3.2);
    const hw = this.w / 2 / c.z, hh = this.h / 2 / c.z;
    c.x = clamp(c.x, Math.min(hw, WW / 2), Math.max(WW - hw, WW / 2));
    c.y = clamp(c.y, Math.min(hh, WH / 2), Math.max(WH - hh, WH / 2));
  }
  toWorld(sx, sy) { const c = this.cam; return { x: c.x + (sx - this.w / 2) / c.z, y: c.y + (sy - this.h / 2) / c.z }; }
  toScreen(wx, wy) { const c = this.cam; return { x: (wx - c.x) * c.z + this.w / 2, y: (wy - c.y) * c.z + this.h / 2 }; }
  focus(wx, wy, z) { this.cam.x = wx; this.cam.y = wy; if (z) this.cam.z = z; this.clampCam(); }

  // ---------- Entrada ----------
  attachInput() {
    const cv = this.cv;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
      this.dragMoved = 0;
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z }; }
    });
    cv.addEventListener('pointermove', e => {
      const rect = cv.getBoundingClientRect();
      const p = this.pointers.get(e.pointerId);
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (!p) { this.hover = this.toWorld(sx, sy); this.onHover && this.onHover(this.hover, e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
        const before = this.toWorld(mid.x, mid.y);
        this.cam.z = this.pinch.z * d / this.pinch.d; this.clampCam();
        const after = this.toWorld(mid.x, mid.y);
        this.cam.x += before.x - after.x; this.cam.y += before.y - after.y; this.clampCam();
        this.dragMoved = 99;
        return;
      }
      this.dragMoved += Math.abs(dx) + Math.abs(dy);
      const wpos = this.toWorld(sx, sy);
      this.hover = wpos;
      if (this.paintMode && this.pointers.size === 1 && (p.type === 'mouse' || this.dragMoved > 4)) { this.onPaint && this.onPaint(wpos); return; }
      this.onHover && this.onHover(wpos, e);
      if (this.dragMoved > 5) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clampCam(); this.following = null; }
    });
    const up = e => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (p && this.dragMoved < 8 && this.pointers.size === 0) {
        const rect = cv.getBoundingClientRect();
        this.onTap && this.onTap(this.toWorld(e.clientX - rect.left, e.clientY - rect.top), e);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.pinch = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const before = this.toWorld(sx, sy);
      this.cam.z *= Math.exp(-e.deltaY * 0.0012); this.clampCam();
      const after = this.toWorld(sx, sy);
      this.cam.x += before.x - after.x; this.cam.y += before.y - after.y; this.clampCam();
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.key, st = 40 / this.cam.z;
      if (k === 'ArrowLeft' || k === 'a') this.cam.x -= st; else if (k === 'ArrowRight' || k === 'd') this.cam.x += st;
      else if (k === 'ArrowUp' || k === 'w') this.cam.y -= st; else if (k === 'ArrowDown' || k === 's') this.cam.y += st;
      else if (k === '+' || k === '=') this.cam.z *= 1.12; else if (k === '-') this.cam.z /= 1.12;
      this.clampCam();
    });
    window.addEventListener('resize', () => this.resize());
  }
  attachBus() {
    bus.on('float', f => this.floats.push({ ...f, t: 0 }));
    bus.on('treefall', n => { for (let i = 0; i < 10; i++) this.parts.push({ type: 'leaf', x: n.x * TILE + rnd(-14, 14), y: n.y * TILE - rnd(10, 40), vx: rnd(-18, 18), vy: rnd(10, 30), life: 0, max: rnd(1.2, 2), col: pick(['#4f9a3a', '#6cc24a', '#3f7f33']), sz: rnd(2, 3.5), rot: rnd(0, 6) }); });
    bus.on('built', b => { this.puff(b, 26, true); this.flashB = { b, t: 0 }; });
    bus.on('era', () => this.fireworks(8));
    bus.on('achievement', () => this.fireworks(2));
    bus.on('festival', () => this.fireworks(4));
    bus.on('burned', b => { for (let i = 0; i < 40; i++) this.parts.push({ type: 'fire', x: (b.x + rnd(0, b.w)) * TILE, y: (b.y + rnd(0.2, b.h)) * TILE, vx: rnd(-10, 10), vy: rnd(-40, -14), life: 0, max: rnd(0.8, 1.8), sz: rnd(4, 9) }); });
    bus.on('threat', t => { if (t.kind === 'wolves') this.spawnWolves(t.win); });
  }
  puff(b, n, ring) {
    const bx = (b.x + b.w / 2) * TILE, by = (b.y + b.h) * TILE;
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; this.parts.push({ type: 'dust', x: bx + Math.cos(a) * b.w * 12, y: by - 4 + Math.sin(a) * 6, vx: Math.cos(a) * rnd(8, 30), vy: rnd(-10, -2), life: 0, max: rnd(0.8, 1.6), sz: rnd(5, 11) }); }
  }
  fireworks(n) {
    for (let k = 0; k < n; k++) setTimeout(() => {
      const cx = this.cam.x + rnd(-200, 200) / this.cam.z, cy = this.cam.y - rnd(40, 160) / this.cam.z;
      const col = pick(['#ffd84a', '#ff6fb5', '#6fd0ff', '#9aff7a', '#ffffff', '#ff8a3c']);
      for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283, sp = rnd(40, 120); this.parts.push({ type: 'spark', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rnd(0.9, 1.7), col, sz: 2.2, grav: 60 }); }
    }, k * 380);
  }
  spawnWolves(win) {
    const edge = Math.random() < 0.5 ? 0 : WW;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.fxWolves.push({ x: edge + rnd(-30, 30), y: CENTER.y * TILE + rnd(-160, 160), t: -i * 0.4, win, ph: 'in', face: edge ? -1 : 1 });
  }

  // ---------- Quadro ----------
  render(s, dt) {
    this.time += dt; this.lastDt = dt;
    const ctx = this.ctx, c = this.cam, k = c.z * this.dpr;
    const th = s._th || timeInfo(s);
    if (this.following) { const p = this.following; this.cam.x += (p.x - this.cam.x) * 0.1; this.cam.y += (p.y - this.cam.y) * 0.1; this.clampCam(); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16231a'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(k, 0, 0, k, (this.w / 2 - c.x * c.z) * this.dpr, (this.h / 2 - c.y * c.z) * this.dpr);
    ctx.imageSmoothingEnabled = true;
    const vx0 = c.x - this.w / 2 / c.z, vy0 = c.y - this.h / 2 / c.z, vx1 = c.x + this.w / 2 / c.z, vy1 = c.y + this.h / 2 / c.z;
    this.view = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
    const tx0 = Math.max(0, Math.floor(vx0 / TILE) - 1), ty0 = Math.max(0, Math.floor(vy0 / TILE) - 1), tx1 = Math.min(MAP_W - 1, Math.ceil(vx1 / TILE) + 1), ty1 = Math.min(MAP_H - 1, Math.ceil(vy1 / TILE) + 1);
    this.drawTerrain(s, th, tx0, ty0, tx1, ty1);
    this.drawGround(s, th, tx0, ty0, tx1, ty1);
    this.lights = [];
    this.drawEntities(s, th, dt);
    this.updateParticles(s, th, dt);
    this.drawParticles(ctx, s, th);
    this.drawWolves(ctx, dt);
    this.drawGhost(ctx, s);
    this.drawLighting(ctx, s, th);
    this.drawFloats(ctx, dt);
    this.drawWeather(ctx, s, th, dt);
  }

  // ---------- Terreno ----------
  /** Padrão repetível (8x8 tiles com variantes) por estação: preenche o chão visível com uma única chamada. */
  groundPattern(season) {
    this._pat = this._pat || {};
    if (this._pat[season]) return this._pat[season];
    const tiles = terrainTiles(season), N = 8, S = TILE * SC;
    const c = document.createElement('canvas'); c.width = N * S; c.height = N * S;
    const x = c.getContext('2d');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) x.drawImage(tiles[Math.floor(hash2(i, j, 5) * tiles.length)], i * S, j * S, S, S);
    const pat = this.ctx.createPattern(c, 'repeat');
    pat.setTransform(new DOMMatrix().scale(1 / SC));
    return (this._pat[season] = pat);
  }
  /** Lista estática de margens de água e tiles de água (calculada uma vez por mapa). */
  prepShore(water) {
    if (this._shoreFor === water) return;
    this._shoreFor = water; this.shore = []; this.waterList = [];
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
      const i = ty * MAP_W + tx;
      if (water[i]) { this.waterList.push([tx, ty]); continue; }
      const l = tx > 0 && water[i - 1], r = tx < MAP_W - 1 && water[i + 1], u = ty > 0 && water[i - MAP_W], d = ty < MAP_H - 1 && water[i + MAP_W];
      if (l || r || u || d) this.shore.push([tx, ty, l, r, u, d]);
    }
  }
  drawTerrain(s, th, tx0, ty0, tx1, ty1) {
    const ctx = this.ctx, T = this.time, V = this.view;
    const season = th.season, nextS = (season + 1) % 4;
    const blendT = th.dOfSeason >= 5 ? clamp((th.dOfSeason - 5 + th.frac), 0, 1) : 0;
    const water = s._terr && s._terr.water;
    if (!water) return;
    this.prepShore(water);
    const winter = season === 3;
    const x0 = Math.max(0, V.x0), y0 = Math.max(0, V.y0), x1 = Math.min(WW, V.x1), y1 = Math.min(WH, V.y1);
    ctx.fillStyle = this.groundPattern(season); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (blendT > 0.02) { ctx.globalAlpha = blendT; ctx.fillStyle = this.groundPattern(nextS); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.globalAlpha = 1; }
    // margem arenosa junto à água
    const sand = winter ? '#e8e8ea' : season === 2 ? '#cdb888' : '#dcc896';
    for (const [tx, ty, l, r, u, d] of this.shore) {
      if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
      const px = tx * TILE, py = ty * TILE;
      ctx.fillStyle = sand;
      if (l) ctx.fillRect(px, py, 6, TILE); if (r) ctx.fillRect(px + TILE - 6, py, 6, TILE);
      if (u) ctx.fillRect(px, py, TILE, 6); if (d) ctx.fillRect(px, py + TILE - 6, TILE, 6);
      ctx.fillStyle = 'rgba(80,60,30,0.2)';
      if (l) ctx.fillRect(px + 5, py, 1.5, TILE); if (r) ctx.fillRect(px + TILE - 6.5, py, 1.5, TILE);
      if (u) ctx.fillRect(px, py + 5, TILE, 1.5); if (d) ctx.fillRect(px, py + TILE - 6.5, TILE, 1.5);
    }
    for (const [tx, ty] of this.waterList) {
      if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
      this.drawWater(ctx, water, tx, ty, tx * TILE, ty * TILE, season, T, blendT);
    }
    // variação de cor em grande escala
    ctx.globalAlpha = winter ? 0.35 : 0.85;
    ctx.drawImage(this.macro, 0, 0, WW, WH);
    ctx.globalAlpha = 1;
  }
  drawWater(ctx, water, tx, ty, px, py, season, T, blend) {
    const i = ty * MAP_W + tx;
    const inner = tx > 0 && ty > 0 && tx < MAP_W - 1 && ty < MAP_H - 1 && water[i - 1] && water[i + 1] && water[i - MAP_W] && water[i + MAP_W];
    const base = inner ? PAL.waterDeep[season] : PAL.water[season];
    ctx.fillStyle = base; ctx.fillRect(px, py, TILE + 0.6, TILE + 0.6);
    if (season === 3) { // gelo
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px, py, TILE + 0.6, TILE + 0.6);
      ctx.strokeStyle = 'rgba(120,160,190,0.5)'; ctx.lineWidth = 0.8; ctx.beginPath(); const h = hash2(tx, ty, 9); ctx.moveTo(px + h * 20, py); ctx.lineTo(px + 12 + h * 10, py + 16); ctx.lineTo(px + 6 + h * 20, py + TILE); ctx.stroke();
      return;
    }
    // reflexos animados
    const ph = T * 1.2 + tx * 0.9 + ty * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.08 * Math.sin(ph)})`;
    ctx.fillRect(px + 4 + 4 * Math.sin(ph * 0.7), py + 8, 12, 1.6);
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.08 * Math.sin(ph + 2)})`;
    ctx.fillRect(px + 14 + 3 * Math.cos(ph * 0.6), py + 22, 10, 1.6);
    if (!inner) { // espuma
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.2 * Math.sin(T * 2 + tx)})`; ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (tx > 0 && !water[i - 1]) { ctx.moveTo(px + 1, py); ctx.lineTo(px + 1, py + TILE); }
      if (tx < MAP_W - 1 && !water[i + 1]) { ctx.moveTo(px + TILE - 1, py); ctx.lineTo(px + TILE - 1, py + TILE); }
      if (ty > 0 && !water[i - MAP_W]) { ctx.moveTo(px, py + 1); ctx.lineTo(px + TILE, py + 1); }
      if (ty < MAP_H - 1 && !water[i + MAP_W]) { ctx.moveTo(px, py + TILE - 1); ctx.lineTo(px + TILE, py + TILE - 1); }
      ctx.stroke();
    }
    // vitórias-régias
    if (hash2(tx, ty, 77) < 0.06 && inner === false) { ctx.fillStyle = '#4f9a3a'; ctx.beginPath(); ctx.ellipse(px + 16, py + 16, 6, 3.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffb3d0'; ctx.beginPath(); ctx.arc(px + 17, py + 15, 1.6, 0, 7); ctx.fill(); }
  }
  drawGround(s, th, tx0, ty0, tx1, ty1) {
    const ctx = this.ctx;
    // clareira de terra batida ao redor da fogueira
    const cx = CENTER.x * TILE, cy = CENTER.y * TILE;
    const rg1 = ctx.createRadialGradient(cx, cy, 20, cx, cy, 190);
    const dirt = th.season === 3 ? ['rgba(190,180,170,0.75)', 'rgba(190,180,170,0.45)', 'rgba(190,180,170,0)'] : ['rgba(138,104,66,0.8)', 'rgba(138,104,66,0.45)', 'rgba(138,104,66,0)'];
    rg1.addColorStop(0, dirt[0]); rg1.addColorStop(0.55, dirt[1]); rg1.addColorStop(1, dirt[2]);
    ctx.fillStyle = rg1; ctx.beginPath(); ctx.ellipse(cx, cy, 200, 160, 0, 0, 7); ctx.fill();
    // trilhas de terra entre construções (leve): pontos de entrega ao campfire
    for (const d of s._drops || []) {
      if (Math.abs(d.x - cx) < 4 && Math.abs(d.y - cy) < 40) continue;
      ctx.strokeStyle = th.season === 3 ? 'rgba(200,190,180,0.5)' : 'rgba(130,98,62,0.45)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy + 20); ctx.quadraticCurveTo((cx + d.x) / 2, (cy + d.y) / 2 + 12, d.x, d.y - 6); ctx.stroke();
    }
    // estradas
    for (const b of s.buildings) {
      if (b.type !== 'road') continue;
      const px = b.x * TILE, py = b.y * TILE;
      if (px < this.view.x0 - TILE || px > this.view.x1 || py < this.view.y0 - TILE || py > this.view.y1) continue;
      const done = b.done;
      ctx.fillStyle = done ? '#a8a091' : '#8a7e6a'; ctx.beginPath(); ctx.roundRect(px + 1, py + 1, TILE - 2, TILE - 2, 5); ctx.fill();
      if (done) {
        ctx.fillStyle = '#bdb5a4'; for (let i = 0; i < 6; i++) { const hx = hash2(b.x, b.y, i) * (TILE - 8) + 3, hy = hash2(b.x, b.y, i + 9) * (TILE - 8) + 3; ctx.beginPath(); ctx.ellipse(px + hx, py + hy, 4.4, 3.2, hash2(i, b.y, 3) * 3, 0, 7); ctx.fill(); }
        ctx.strokeStyle = 'rgba(70,60,45,0.35)'; ctx.lineWidth = 0.8; ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
      }
    }
    // limite do território
    const R = eraRadius(s) * TILE;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, WW, WH); ctx.ellipse(cx, cy, R, R, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,16,26,0.28)'; ctx.fill('evenodd');
    ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.restore();
  }

  // ---------- Entidades ----------
  drawEntities(s, th, dt) {
    const ctx = this.ctx, T = this.time, V = this.view, pad = 90;
    const list = [];
    const season = th.season;
    const windy = s.weather.type === 'storm' ? 2.4 : s.weather.type === 'rain' ? 1.3 : 1;
    for (const n of s.nodes) {
      const x = n.x * TILE, y = n.y * TILE;
      if (x < V.x0 - pad || x > V.x1 + pad || y < V.y0 - 10 || y > V.y1 + pad + 80) continue;
      if (n.type === 'ore' && !s.flags.ore) continue;
      list.push({ y, k: 'n', o: n });
    }
    for (const b of s.buildings) {
      if (b.type === 'road') continue;
      const x = b.x * TILE, y = (b.y + b.h) * TILE;
      if (x > V.x1 + 40 || x + b.w * TILE < V.x0 - 40 || y < V.y0 - 10 || y - 260 > V.y1) continue;
      list.push({ y: y - 1, k: 'b', o: b });
    }
    for (const p of s.people) {
      if (p.rt.inside || p.away > 0) continue;
      if (p.x < V.x0 - 30 || p.x > V.x1 + 30 || p.y < V.y0 - 40 || p.y > V.y1 + 40) continue;
      list.push({ y: p.y, k: 'p', o: p });
    }
    for (const a of s._animals || []) { if (a.x < V.x0 - 30 || a.x > V.x1 + 30 || a.y < V.y0 - 30 || a.y > V.y1 + 30) continue; list.push({ y: a.y, k: 'a', o: a }); }
    list.sort((a, b) => a.y - b.y);
    const night = this.nightF(th);
    for (const e of list) {
      if (e.k === 'n') this.drawNode(ctx, e.o, season, T, windy, s);
      else if (e.k === 'b') this.drawBuilding(ctx, e.o, s, th, season, T, dt, night);
      else if (e.k === 'p') this.drawPerson(ctx, e.o, s, th, T);
      else this.drawAnimal(ctx, e.o, T);
    }
    // selecao
    const sel = this.selection;
    if (sel) {
      let x, y, rw, rh;
      if (sel.kind === 'person') { const p = s.people.find(q => q.id === sel.id); if (p && !p.rt.inside) { x = p.x; y = p.y; rw = 11; rh = 5; this.drawSel(ctx, x, y, rw, rh, T); this.drawTag(ctx, p.name, x, y - 36 * (p.age < 10 ? 0.75 : 1)); } }
      else if (sel.kind === 'building') { const b = s.buildings.find(q => q.id === sel.id); if (b) { this.drawSel(ctx, (b.x + b.w / 2) * TILE, (b.y + b.h) * TILE - b.h * TILE / 2, b.w * TILE * 0.55, b.h * TILE * 0.5, T); } }
    }
  }
  nightF(th) { const a = ambient(th.hour); return clamp(a[3] / 0.6, 0, 1); }
  drawSel(ctx, x, y, rw, rh, T) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,240,140,0.95)'; ctx.lineWidth = 2.2; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -T * 14;
    ctx.beginPath(); ctx.ellipse(x, y, rw + 2, rh + 2, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
  drawTag(ctx, text, x, y) {
    ctx.save(); ctx.font = '600 10px system-ui,sans-serif'; const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(20,24,30,0.78)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 15, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 1.5); ctx.restore();
  }
  shadow(ctx, x, y, rx, ry, a = 0.28) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x + rx * 0.2, y, rx, ry, 0, 0, 7); ctx.fill(); }
  spr(ctx, sp, x, y, w = sp.w, h = sp.h) { ctx.drawImage(sp.c, x - sp.ax * (w / sp.w), y - sp.ay * (h / sp.h), w, h); }

  drawNode(ctx, n, season, T, windy, s) {
    const x = n.x * TILE, y = n.y * TILE;
    if (n.type === 'tree') {
      if (n.st === 'removed') return;
      if (n.st === 'stump') { this.spr(ctx, stumpSprite(season), x, y); return; }
      if (n.st === 'sapling') { this.spr(ctx, saplingSprite(season), x, y); return; }
      const sp = treeSprite(n.sp, n.v, season);
      const sc = 0.78 + n.v * 0.05;
      const [bw, bh] = [sp.w * sc, sp.h * sc];
      this.shadow(ctx, x, y + 1, bw * 0.3, bw * 0.1, 0.25);
      ctx.save(); ctx.translate(x, y);
      if (n.st === 'falling') {
        const t = clamp(n.fallT / 1.2, 0, 1), ang = (t * t) * 1.45 * n.fallDir;
        ctx.rotate(ang); ctx.globalAlpha = 1 - clamp((t - 0.75) * 4, 0, 1);
        this.spr(ctx, sp, 0, 0, bw, bh);
        ctx.restore(); this.spr(ctx, stumpSprite(season), x, y); return;
      }
      const hitAge = s.t - (n.lastHit || -99);
      const shake = hitAge < 0.5 ? Math.sin(T * 38) * 0.035 * (1 - hitAge * 2) : 0;
      const sway = Math.sin(T * 1.3 + n.x * 1.7) * 0.012 * windy + (windy > 1 ? Math.sin(T * 5 + n.y) * 0.008 * windy : 0) + shake;
      ctx.transform(1, 0, sway * 2, 1, 0, 0); ctx.rotate(sway * 0.5);
      this.spr(ctx, sp, 0, 0, bw, bh);
      ctx.restore();
    } else if (n.type === 'rock' || n.type === 'ore') {
      if (n.type === 'rock' && n.amt <= 0.01) { this.shadow(ctx, x, y + 2, 10, 3, 0.2); return; }
      const sp = rockSprite(n.v, season, n.type === 'ore');
      this.shadow(ctx, x, y + 2, 20, 6, 0.25);
      const sc = 0.62; ctx.save(); ctx.translate(x, y);
      const hitAge = s.t - (n.lastHit || -99); if (hitAge < 0.4) ctx.translate(Math.sin(T * 40) * 0.8, 0);
      this.spr(ctx, sp, 0, 0, sp.w * sc, sp.h * sc); ctx.restore();
      if (n.type === 'ore') { ctx.fillStyle = `rgba(255,200,100,${0.5 + 0.4 * Math.sin(T * 3)})`; ctx.fillRect(x + 3, y - 14, 1.6, 1.6); }
    } else if (n.type === 'bush') {
      const level = season === 3 ? 0 : clamp(Math.round(n.amt / n.max * 3), 0, 3);
      const sp = bushSprite(n.v, season, level);
      this.shadow(ctx, x, y + 2, 11, 4, 0.22);
      this.spr(ctx, sp, x, y, sp.w * 0.8, sp.h * 0.8);
    }
  }

  // ---------- Construções ----------
  drawBuilding(ctx, b, s, th, season, T, dt, night) {
    const def = BUILDINGS[b.type];
    const bx = b.x * TILE, by = (b.y + b.h) * TILE;
    if (b.type === 'wall') return this.drawWall(ctx, b, s, season);
    if (!b.done) {
      const fd = foundationSprite(b.w, b.h);
      ctx.drawImage(fd.c, bx - fd.ox, by - fd.oy, fd.w, fd.h);
      const sp = buildingSprite(b.type, season);
      const q = clamp((b.prog - 0.12) / 0.88, 0, 1);
      if (q > 0) {
        // revela o prédio de baixo para cima
        const vis = sp.h * q, y0 = sp.h - vis;
        ctx.save(); ctx.globalAlpha = 0.97;
        ctx.drawImage(sp.c, 0, y0 * SC, sp.c.width, vis * SC, bx - sp.ox, by - sp.oy + y0, sp.w, vis);
        ctx.restore();
        if (q < 1) { const sf = scaffoldSprite(b.w, b.h, Math.min(sp.h, 120)); ctx.drawImage(sf.c, bx - sf.ox, by - sf.oy, sf.w, sf.h); }
      } else {
        const sf = scaffoldSprite(b.w, b.h, 30); ctx.globalAlpha = 0.75; ctx.drawImage(sf.c, bx - sf.ox, by - sf.oy, sf.w, sf.h); ctx.globalAlpha = 1;
      }
      // barra de progresso
      const w = Math.max(30, b.w * TILE * 0.6), px = bx + b.w * TILE / 2 - w / 2, py = by - sp.h * Math.max(q, 0.25) - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(px - 1, py - 1, w + 2, 7, 3); ctx.fill();
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.roundRect(px, py, w * b.prog, 5, 2.5); ctx.fill();
      // poeira da obra
      if (s.t - (b._lastWork || -9) < 0.5 && Math.random() < dt * 14) this.parts.push({ type: 'dust', x: bx + rnd(0, b.w * TILE), y: by - rnd(0, 14), vx: rnd(-8, 8), vy: rnd(-12, -3), life: 0, max: rnd(0.7, 1.3), sz: rnd(4, 8) });
      if (s.t - (b._lastWork || -9) < 0.5 && Math.random() < dt * 5) this.parts.push({ type: 'chip', x: bx + rnd(0, b.w * TILE), y: by - rnd(4, 20), vx: rnd(-30, 30), vy: rnd(-50, -20), life: 0, max: 0.7, col: '#d9b27a', sz: 1.8 });
      return;
    }
    const sp = buildingSprite(b.type, season);
    // pulo de conclusão
    let sc = 1;
    if (this.flashB && this.flashB.b === b) { this.flashB.t += dt; const t = this.flashB.t; if (t < 0.6) sc = 1 + Math.sin(t / 0.6 * Math.PI) * 0.06; else this.flashB = null; }
    ctx.save();
    if (sc !== 1) { ctx.translate(bx + b.w * TILE / 2, by); ctx.scale(1, sc); ctx.translate(-(bx + b.w * TILE / 2), -by); }
    ctx.drawImage(sp.c, bx - sp.ox, by - sp.oy, sp.w, sp.h);
    ctx.restore();
    if (b.type === 'campfire') this.drawFire(ctx, bx - sp.ox + sp.fire.x, by - sp.oy + sp.fire.y, 1, T, s);
    if (night > 0.12) {
      // janelas acesas
      for (const L of sp.lights) if (L.win) {
        const [wx, wy, ww, wh] = L.win; ctx.fillStyle = L.c; ctx.globalAlpha = clamp(night * 1.2, 0, 1) * 0.92;
        ctx.fillRect(bx - sp.ox + wx, by - sp.oy + wy, ww, wh); ctx.globalAlpha = 1;
      }
    }
    // luzes e fumaça
    for (const L of sp.lights) this.lights.push({ x: bx - sp.ox + L.x, y: by - sp.oy + L.y, r: L.r || (L.win ? 38 : 40), c: L.c, fire: !!L.fire, win: !!L.win });
    if (sp.smoke) {
      const active = (kindOf(b) === 'house' ? (night > 0.2 || th.season === 3 || th.hour < 9 || s.weather.type === 'rain') : kindOf(b) === 'tavern' ? (b._open !== false) : (b._sc > 0 || kindOf(b) === 'smithy' && b._sc > 0));
      if (active) { const key = b.id; this.emit[key] = (this.emit[key] || 0) + dt; if (this.emit[key] > 0.35) { this.emit[key] = 0; this.parts.push({ type: 'smoke', x: bx - sp.ox + sp.smoke.x, y: by - sp.oy + sp.smoke.y, vx: rnd(2, 8), vy: rnd(-16, -10), life: 0, max: rnd(2.2, 3.4), sz: rnd(3, 5) }); } }
    }
    if (kindOf(b) === 'smithy' && b._sc > 0 && Math.random() < dt * 6) this.parts.push({ type: 'spark', x: bx + 22, y: by - 18, vx: rnd(-20, 20), vy: rnd(-50, -20), life: 0, max: 0.7, col: '#ffb040', sz: 1.5, grav: 80 });
    if (kindOf(b) === 'sawmill' && b._sc > 0 && Math.random() < dt * 8) this.parts.push({ type: 'chip', x: bx + 30, y: by - 14, vx: rnd(-26, 26), vy: rnd(-40, -10), life: 0, max: 0.6, col: '#e6c58a', sz: 1.6 });
    // tochas à noite nas construções grandes
    if (def.light >= 80 && b.type !== 'campfire') this.drawTorch(ctx, bx - 6, by - 2, T, night); if (def.light >= 80 && b.type !== 'campfire') this.drawTorch(ctx, bx + b.w * TILE + 6, by - 2, T, night);
    if (kindOf(b) === 'farm' && th.season === 2 && Math.random() < dt * 0.6) this.parts.push({ type: 'leaf', x: bx + rnd(0, b.w * TILE), y: by - b.h * TILE, vx: rnd(-6, 6), vy: rnd(8, 16), life: 0, max: 2, col: '#e0b13a', sz: 2, rot: 0 });
    if (b.enabled === false) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx, by - b.h * TILE, b.w * TILE, b.h * TILE); }
  }
  drawTorch(ctx, x, y, T, night) {
    ctx.fillStyle = '#4a3220'; ctx.fillRect(x - 1, y - 22, 2.4, 22);
    if (night > 0.05) {
      const f = 1 + Math.sin(T * 14 + x) * 0.15;
      ctx.fillStyle = rg(ctx, x, y - 26, 0, 6 * f, [[0, '#fff6c0'], [0.5, '#ffa030'], [1, 'rgba(255,100,20,0)']]);
      ctx.beginPath(); ctx.ellipse(x, y - 26, 3.4 * f, 6.5 * f, 0, 0, 7); ctx.fill();
      this.lights.push({ x, y: y - 26, r: 55, c: '#ffa040', fire: true });
    }
  }
  drawFire(ctx, x, y, sc, T, s) {
    const f = 1 + Math.sin(T * 9) * 0.1 + Math.sin(T * 17 + 1) * 0.06;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg(ctx, x, y, 0, 36, [[0, 'rgba(255,170,60,0.55)'], [1, 'rgba(255,120,20,0)']]); ctx.beginPath(); ctx.arc(x, y, 36, 0, 7); ctx.fill();
    ctx.restore();
    for (const [rx, ry, col] of [[8, 16, '#e8541a'], [6, 13, '#ff9a2a'], [3.6, 9, '#ffe27a']]) {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - rx * f, y);
      ctx.bezierCurveTo(x - rx * 0.9, y - ry * 0.6 * f, x - 1.5 + Math.sin(T * 12) * 1.5, y - ry * f * 0.9, x + Math.sin(T * 10) * 1.2, y - ry * f * 1.5);
      ctx.bezierCurveTo(x + rx * 0.4, y - ry * 0.8 * f, x + rx * 0.9, y - ry * 0.5, x + rx * f, y); ctx.closePath(); ctx.fill();
    }
    if (Math.random() < 0.18) this.parts.push({ type: 'spark', x: x + rnd(-5, 5), y: y - 8, vx: rnd(-14, 14), vy: rnd(-46, -22), life: 0, max: rnd(0.8, 1.5), col: pick(['#ffcf5a', '#ff9a2a', '#fff0a0']), sz: 1.4, grav: -4 });
    if (Math.random() < 0.06) this.parts.push({ type: 'smoke', x: x + rnd(-3, 3), y: y - 16, vx: rnd(2, 9), vy: rnd(-22, -14), life: 0, max: rnd(2.2, 3.4), sz: rnd(3, 5) });
    this.lights.push({ x, y: y - 6, r: 200 * f, c: '#ff9a3c', fire: true, big: true });
  }
  drawWall(ctx, b, s, season) {
    const px = b.x * TILE, py = b.y * TILE;
    const has = (dx, dy) => s.buildings.some(o => o.type === 'wall' && o.x === b.x + dx && o.y === b.y + dy);
    const col = b.done ? '#9a958e' : '#7a766f';
    const draw = (x0, y0, w, h) => { ctx.fillStyle = lgs(ctx, x0, y0, h, col); ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 0.8; ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1); };
    const cx = px + TILE / 2, cy = py + TILE / 2;
    // base e conexões
    this.shadow(ctx, cx, py + TILE - 2, 14, 5, 0.25);
    const top = py + TILE - 24;
    if (has(1, 0)) draw(cx, top + 4, TILE / 2 + 1, 20); if (has(-1, 0)) draw(px - 1, top + 4, TILE / 2 + 1, 20);
    if (has(0, 1)) draw(cx - 6, cy, 12, TILE / 2 + 1); if (has(0, -1)) draw(cx - 6, py - 1, 12, TILE / 2 + 1);
    draw(cx - 8, top, 16, 26); ctx.fillStyle = '#8a857e'; for (let i = 0; i < 3; i++) ctx.fillRect(cx - 8 + i * 6, top - 4, 4, 5);
    if (!b.done) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx - 8, top - 4, 16, 30 * (1 - b.prog)); }
    if (season === 3) { ctx.fillStyle = '#f6faff'; ctx.fillRect(cx - 8, top - 5, 16, 3); }
  }

  // ---------- Pessoas ----------
  drawPerson(ctx, p, s, th, T) {
    const rt = p.rt, anim = rt.anim || 'idle';
    const child = p.age < ADULT_AGE;
    const sc = child ? 0.62 + Math.min(p.age, 10) * 0.028 : 0.95 + (p.look.s - 0.5) * 0.08;
    const face = rt.face || 1;
    const job = JOBS[p.job] || JOBS.livre;
    const phase = T * 9 + p.id * 1.3;
    const walking = anim === 'walk';
    const bob = walking ? Math.abs(Math.sin(phase)) * 1.4 : Math.sin(T * 2 + p.id) * 0.3;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc * face, sc);
    this.shadow(ctx, 0, 0, 7, 2.6, 0.3);
    if (anim === 'sleep') { this.drawSleeper(ctx, p, job, T); ctx.restore(); return; }
    const skin = p.look.skin, hair = p.look.hair, tun = p.hero ? '#c9a22a' : job.color;
    const pants = '#4a3d33';
    const sw = walking ? Math.sin(phase) : 0;
    // pernas
    ctx.strokeStyle = pants; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-1.8, -8); ctx.lineTo(-1.8 + sw * 4, -0.5); ctx.moveTo(1.8, -8); ctx.lineTo(1.8 - sw * 4, -0.5); ctx.stroke();
    ctx.fillStyle = '#2a2018'; ctx.fillRect(-3.4 + sw * 4, -1.4, 3.6, 1.8); ctx.fillRect(0.2 - sw * 4, -1.4, 3.6, 1.8);
    // corpo (vestido para mulheres)
    ctx.translate(0, -bob);
    ctx.fillStyle = tun;
    if (p.f && !child) { ctx.beginPath(); ctx.moveTo(-4.4, -19); ctx.lineTo(4.4, -19); ctx.lineTo(6.2, -7); ctx.lineTo(-6.2, -7); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(1, -19, 3.4, 12); }
    else { ctx.beginPath(); ctx.roundRect(-4.6, -19, 9.2, 12.5, 3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(1.2, -19, 3.4, 12.5); }
    ctx.fillStyle = '#3a2c20'; ctx.fillRect(-4.6, -11.5, 9.2, 1.6);
    if (p.hero) { ctx.fillStyle = '#b03a3a'; ctx.beginPath(); ctx.moveTo(-3, -19); ctx.lineTo(-8, -6 - Math.sin(T * 5) * 1); ctx.lineTo(-2, -8); ctx.closePath(); ctx.fill(); }
    // braços e ferramenta
    const armCol = skin;
    const tool = anim === 'chop' ? 'axe' : anim === 'mine' ? 'pick' : anim === 'hammer' ? 'hammer' : anim === 'hoe' ? 'hoe' : anim === 'spear' ? 'spear' : anim === 'saw' ? 'saw' : null;
    let swing = Math.sin(T * 7 + p.id), ang = 0;
    if (anim === 'chop' || anim === 'mine' || anim === 'hammer') ang = -1.2 + (swing * 0.5 + 0.5) * 2.2;
    else if (anim === 'hoe') ang = -0.6 + (swing * 0.5 + 0.5) * 1.6;
    else if (anim === 'spear') ang = swing * 0.9;
    ctx.save(); ctx.translate(2.5, -17);
    ctx.rotate(tool ? ang : (walking ? -sw * 0.7 : 0.1));
    ctx.strokeStyle = armCol; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 7); ctx.stroke();
    if (tool === 'axe') { ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 17); ctx.stroke(); ctx.fillStyle = '#aeb6bf'; ctx.beginPath(); ctx.moveTo(-1, 14); ctx.lineTo(5, 13); ctx.lineTo(5, 18); ctx.lineTo(-1, 17); ctx.fill(); }
    else if (tool === 'pick') { ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 17); ctx.stroke(); ctx.strokeStyle = '#8a929c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 15); ctx.quadraticCurveTo(0, 12, 5, 15); ctx.stroke(); }
    else if (tool === 'hammer') { ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, 15); ctx.stroke(); ctx.fillStyle = '#6f7a86'; ctx.fillRect(-3.4, 12, 7, 4); }
    else if (tool === 'hoe') { ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(3, 18); ctx.stroke(); ctx.fillStyle = '#8a929c'; ctx.fillRect(1.5, 17, 6, 1.8); }
    else if (tool === 'spear') { ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.stroke(); ctx.fillStyle = '#cfd6de'; ctx.beginPath(); ctx.moveTo(-1.6, -8); ctx.lineTo(0, -14); ctx.lineTo(1.6, -8); ctx.fill(); }
    else if (tool === 'saw') { ctx.fillStyle = '#c0c8d0'; ctx.fillRect(-1, 8 + swing * 2, 9, 1.6); }
    ctx.restore();
    // braço de trás
    ctx.strokeStyle = armCol; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-2.8, -17); ctx.lineTo(-3.6 + (walking ? sw * 2 : 0), -9.5); ctx.stroke();
    // carga
    const cr = rt.carry;
    if (cr && cr.amt > 0.3) {
      if (cr.res === 'wood') { ctx.fillStyle = '#8a5a30'; ctx.beginPath(); ctx.roundRect(-9, -24, 18, 4.6, 2.3); ctx.fill(); ctx.fillStyle = '#d6a86a'; ctx.beginPath(); ctx.ellipse(9, -21.7, 1.4, 2.3, 0, 0, 7); ctx.fill(); }
      else if (cr.res === 'stone') { ctx.fillStyle = '#8a929c'; ctx.beginPath(); ctx.ellipse(0, -22, 5.6, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b8c0c8'; ctx.beginPath(); ctx.ellipse(-1.5, -23, 2.4, 1.4, 0, 0, 7); ctx.fill(); }
      else if (cr.res === 'food') { ctx.fillStyle = '#a07840'; ctx.beginPath(); ctx.roundRect(-5.6, -25, 11, 7, 3); ctx.fill(); ctx.fillStyle = '#d8302f'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-3 + i * 3, -26, 1.8, 0, 7); ctx.fill(); } }
      else if (cr.res === 'water') { ctx.fillStyle = '#7a5a33'; ctx.fillRect(-4.5, -26, 9, 8); ctx.fillStyle = '#4aa8ff'; ctx.fillRect(-3.6, -26, 7.2, 2); }
    }
    // cabeça
    const hy = -23.2;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, hy, 4.4, 0, 7); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, hy - 0.8, 4.6, Math.PI * 0.98, Math.PI * 2.02); ctx.fill();
    if (p.f && !child) { ctx.fillRect(-4.6, hy - 1, 2, 7); }
    else if (p.age > 48) { ctx.fillStyle = '#d8d8d8'; ctx.beginPath(); ctx.arc(0, hy - 0.8, 4.6, Math.PI * 0.98, Math.PI * 2.02); ctx.fill(); }
    ctx.fillStyle = '#222'; ctx.fillRect(1.6, hy - 0.4, 1.2, 1.3);
    if (anim === 'eat') { ctx.fillStyle = '#d8302f'; ctx.beginPath(); ctx.arc(3.6, hy + 2.5, 1.7, 0, 7); ctx.fill(); }
    if (p.sick > 0) { ctx.fillStyle = 'rgba(120,200,90,0.5)'; ctx.beginPath(); ctx.arc(0, hy, 4.5, 0, 7); ctx.fill(); }
    ctx.restore();
    if (p.preg) { /* sem marcador */ }
    if (p.leader && !child) { ctx.font = '11px serif'; ctx.fillText('👑', p.x - 6, p.y - 36 * sc - 2); }
    // balões de estado
    if (p.n.hunger < 22 || p.sick > 0) { ctx.font = '10px serif'; ctx.fillText(p.sick > 0 ? '🤒' : '🍖', p.x - 5, p.y - 32 * sc - Math.sin(T * 4) * 1.2); }
    if (!child && p.n.joy < 20) { ctx.font = '10px serif'; ctx.fillText('😠', p.x - 5, p.y - 33 * sc); }
  }
  drawSleeper(ctx, p, job, T) {
    ctx.translate(0, -3);
    ctx.fillStyle = p.look.skin; ctx.beginPath(); ctx.arc(-9, -3, 4, 0, 7); ctx.fill();
    ctx.fillStyle = p.look.hair; ctx.beginPath(); ctx.arc(-9.5, -4, 4.2, Math.PI, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = '#7a5a8a'; ctx.beginPath(); ctx.roundRect(-5, -6, 17, 8, 4); ctx.fill(); ctx.fillStyle = '#9a7aaa'; ctx.fillRect(-1, -6, 3, 8);
    ctx.fillStyle = '#e8d8c0'; ctx.beginPath(); ctx.roundRect(-12, -1.5, 5, 3.4, 1.5, ); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 2 + p.id); ctx.fillText('z', 2, -12 - (T * 6 + p.id) % 6); ctx.fillText('Z', 7, -16 - (T * 5 + p.id) % 7); ctx.globalAlpha = 1;
  }
  drawAnimal(ctx, a, T) {
    ctx.save(); ctx.translate(a.x, a.y);
    if (a.dead) { ctx.globalAlpha = Math.max(0, 1 - a.deadT / 0.6); ctx.rotate(Math.min(1.4, a.deadT * 4)); }
    this.shadow(ctx, 0, 0, 8, 3, 0.25);
    ctx.scale(a.face * (a.fawn ? 0.75 : 1), a.fawn ? 0.75 : 1);
    const ph = a.moving ? T * (a.scared > 0 ? 18 : 9) : 0, sw = Math.sin(ph);
    ctx.strokeStyle = '#6a4a2b'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const [lx, o] of [[-5, 0], [-3, Math.PI], [4, Math.PI], [6, 0]]) { ctx.beginPath(); ctx.moveTo(lx, -8); ctx.lineTo(lx + Math.sin(ph + o) * 3, 0); ctx.stroke(); }
    ctx.fillStyle = '#b07a46'; ctx.beginPath(); ctx.ellipse(0, -10, 8.5, 4.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8b88a'; ctx.beginPath(); ctx.ellipse(0, -8, 7, 2.2, 0, 0, 7); ctx.fill();
    if (a.fawn) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 4; i++) ctx.fillRect(-4 + i * 3, -12 + (i % 2) * 2, 1.2, 1.2); }
    ctx.fillStyle = '#b07a46'; ctx.beginPath(); ctx.moveTo(6, -12); ctx.lineTo(10, -17); ctx.lineTo(12, -16); ctx.lineTo(8, -10); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11, -17, 3, 2.2, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(11.5, -18, 1, 1);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8.5, -11, 1.8, 0, 7); ctx.fill();
    if (!a.fawn) { ctx.strokeStyle = '#d8c9a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, -19); ctx.lineTo(9, -24); ctx.moveTo(9.5, -22); ctx.lineTo(12, -24); ctx.moveTo(12, -19); ctx.lineTo(13, -24); ctx.stroke(); }
    ctx.restore();
  }
  drawWolves(ctx, dt) {
    const c = new Set(); const ccx = CENTER.x * TILE, ccy = CENTER.y * TILE + 30;
    for (const w of this.fxWolves) {
      w.t += dt; if (w.t < 0) continue;
      const tx = w.ph === 'in' ? ccx + rnd(-20, 20) : (w.face > 0 ? -50 : WW + 50), ty = w.ph === 'in' ? ccy : w.y;
      if (w.ph === 'in' && Math.hypot(w.x - ccx, w.y - ccy) < 70) { w.ph = 'fight'; w.ft = 0; }
      if (w.ph === 'fight') { w.ft += dt; if (w.ft > 3 && w.win) { w.ph = 'out'; } }
      if (w.ph !== 'fight') { const d = Math.hypot(tx - w.x, ty - w.y) || 1, sp = 95; w.x += (tx - w.x) / d * sp * dt; w.y += (ty - w.y) / d * sp * dt; w.face = tx > w.x ? 1 : -1; }
      ctx.save(); ctx.translate(w.x, w.y); ctx.scale(w.face, 1); this.shadow(ctx, 0, 0, 9, 3, 0.3);
      const ph = this.time * 16 + w.x; ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      for (const [lx, o] of [[-6, 0], [-3, 3], [4, 3], [7, 0]]) { ctx.beginPath(); ctx.moveTo(lx, -6); ctx.lineTo(lx + Math.sin(ph + o) * 3.2, 0); ctx.stroke(); }
      ctx.fillStyle = '#6a6a74'; ctx.beginPath(); ctx.ellipse(0, -8, 9, 4.6, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, -11, 4.2, 3.2, 0.2, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(9.5, -17); ctx.lineTo(11, -13); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.fillRect(11, -12.4, 1.3, 1.1);
      ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-8, -9); ctx.quadraticCurveTo(-14, -12, -15, -6); ctx.stroke();
      ctx.restore();
    }
    this.fxWolves = this.fxWolves.filter(w => w.t < 14 && !(w.ph === 'out' && (w.x < -60 || w.x > WW + 60)) && !(w.ph === 'fight' && w.ft > 5));
  }

  // ---------- Partículas ----------
  updateParticles(s, th, dt) {
    const V = this.view;
    // ambiente: folhas (outono), pétalas (primavera), vaga-lumes (verão à noite)
    const night = this.nightF(th);
    const nA = this.parts.length;
    if (nA < 520) {
      if (th.season === 2 && Math.random() < dt * 14) this.parts.push({ type: 'leaf', x: rnd(V.x0, V.x1), y: V.y0 - 10, vx: rnd(8, 26), vy: rnd(14, 30), life: 0, max: 8, col: pick(['#d9792b', '#c4452c', '#e8b13a']), sz: rnd(2, 3.2), rot: rnd(0, 6), amb: true });
      if (th.season === 0 && Math.random() < dt * 9) this.parts.push({ type: 'leaf', x: rnd(V.x0, V.x1), y: V.y0 - 10, vx: rnd(6, 18), vy: rnd(10, 22), life: 0, max: 9, col: pick(['#ffd1e8', '#ffffff']), sz: rnd(1.4, 2.4), rot: rnd(0, 6), amb: true });
      if (th.season === 1 && night > 0.35 && Math.random() < dt * 5) this.parts.push({ type: 'fly', x: rnd(V.x0, V.x1), y: rnd(V.y0, V.y1), vx: 0, vy: 0, life: 0, max: rnd(4, 8), sz: 1.6, ph: rnd(0, 6) });
    }
  }
  drawParticles(ctx, s, th) {
    const dt = this.lastDt || 0.016;
    const V = this.view;
    const keep = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const t = p.life / p.max;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.type === 'smoke') { p.sz += dt * 2.4; p.vx += dt * 3; }
      if (p.type === 'dust') { p.sz += dt * 5; p.vx *= 0.97; }
      if (p.type === 'leaf') { p.vx += Math.sin(p.life * 2 + p.rot) * dt * 14; p.rot += dt * 2; }
      if (p.x < V.x0 - 40 || p.x > V.x1 + 40 || p.y < V.y0 - 60 || p.y > V.y1 + 40) { if (!p.amb) { keep.push(p); } continue; }
      if (p.type === 'smoke') { ctx.fillStyle = `rgba(210,212,216,${0.5 * (1 - t)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 7); ctx.fill(); }
      else if (p.type === 'dust') { ctx.fillStyle = `rgba(190,165,125,${0.45 * (1 - t)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, 7); ctx.fill(); }
      else if (p.type === 'spark') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = p.col; ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1 - t * 0.5), 0, 7); ctx.fill(); ctx.restore(); }
      else if (p.type === 'chip') { ctx.fillStyle = p.col; ctx.globalAlpha = 1 - t; ctx.fillRect(p.x, p.y, p.sz, p.sz * 0.7); ctx.globalAlpha = 1; p.vy += 140 * dt; }
      else if (p.type === 'leaf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.globalAlpha = 1 - clamp((t - 0.85) * 6, 0, 1); ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz * 0.55, 0, 0, 7); ctx.fill(); ctx.restore(); }
      else if (p.type === 'fire') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${120 + 80 * (1 - t)},30,${0.6 * (1 - t)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1 - t * 0.5), 0, 7); ctx.fill(); ctx.restore(); }
      else if (p.type === 'fly') { const a = 0.5 + 0.5 * Math.sin(p.life * 4 + p.ph); p.vx = Math.sin(p.life + p.ph) * 12; p.vy = Math.cos(p.life * 0.8 + p.ph) * 10; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(220,255,120,${a * 0.9})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 7); ctx.fill(); ctx.fillStyle = `rgba(220,255,120,${a * 0.25})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 7); ctx.fill(); ctx.restore(); }
      keep.push(p);
    }
    this.parts = keep.length > 900 ? keep.slice(-900) : keep;
  }

  // ---------- Ghost de construção ----------
  drawGhost(ctx, s) {
    const g = this.ghost; if (!g) return;
    const def = BUILDINGS[g.type];
    const sp = buildingSprite(g.type, (s._th || timeInfo(s)).season);
    const bx = g.x * TILE, by = (g.y + def.h) * TILE;
    // grade de área
    ctx.save();
    ctx.fillStyle = g.ok ? 'rgba(90,220,120,0.28)' : 'rgba(240,80,70,0.32)';
    ctx.fillRect(bx, g.y * TILE, def.w * TILE, def.h * TILE);
    ctx.strokeStyle = g.ok ? 'rgba(140,255,170,0.9)' : 'rgba(255,130,120,0.95)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.strokeRect(bx, g.y * TILE, def.w * TILE, def.h * TILE);
    ctx.setLineDash([]);
    if (!def.road && g.type !== 'wall') { ctx.globalAlpha = g.ok ? 0.72 : 0.45; ctx.drawImage(sp.c, bx - sp.ox, by - sp.oy, sp.w, sp.h); }
    if (g.reason && !g.ok) { this.drawTag(ctx, g.reason, bx + def.w * TILE / 2, g.y * TILE - 6); }
    ctx.restore();
  }

  // ---------- Iluminação ----------
  drawLighting(ctx, s, th) {
    const a = ambient(th.hour);
    let [r, g, b, al] = a;
    const wt = s.weather.type;
    if (wt === 'rain') { const k = 0.55; r = r + (85 - r) * k; g = g + (100 - g) * k; b = b + (130 - b) * k; al = Math.min(0.8, al + 0.14); }
    if (wt === 'storm') { const k = 0.75; r = r + (45 - r) * k; g = g + (55 - g) * k; b = b + (85 - b) * k; al = Math.min(0.85, al + 0.3); }
    if (th.season === 3 && al < 0.1) { al = 0.08; r = 190; g = 210; b = 255; }
    if (this.flash > 0) { al = Math.max(0, al - this.flash * 0.6); }
    if (al < 0.02 && !this.lights.length) return;
    const lw = this.light.width, lh = this.light.height, L = this.lctx, c = this.cam;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, lw, lh);
    L.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${al})`; L.fillRect(0, 0, lw, lh);
    const k = c.z * 0.5;
    L.setTransform(k, 0, 0, k, (this.w / 2 - c.x * c.z) * 0.5, (this.h / 2 - c.y * c.z) * 0.5);
    const strength = clamp(al / 0.5, 0, 1);
    L.globalCompositeOperation = 'destination-out';
    for (const li of this.lights) {
      const f = li.fire ? 1 + Math.sin(this.time * 11 + li.x) * 0.06 : 1;
      const rad = li.r * f;
      const gr = L.createRadialGradient(li.x, li.y, 0, li.x, li.y, rad);
      gr.addColorStop(0, `rgba(0,0,0,${0.95 * strength})`); gr.addColorStop(0.5, `rgba(0,0,0,${0.55 * strength})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr; L.beginPath(); L.arc(li.x, li.y, rad, 0, 7); L.fill();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.light, 0, 0, this.cv.width, this.cv.height);
    ctx.restore();
    // brilho quente aditivo
    if (strength > 0.1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const li of this.lights) {
        const rad = li.r * 0.8;
        const gr = ctx.createRadialGradient(li.x, li.y, 0, li.x, li.y, rad);
        const col = li.c || '#ffa040'; const m = /#(..)(..)(..)/.exec(col);
        const cr = parseInt(m[1], 16), cg = parseInt(m[2], 16), cb = parseInt(m[3], 16);
        gr.addColorStop(0, `rgba(${cr},${cg},${cb},${0.22 * strength})`); gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(li.x, li.y, rad, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- Números flutuantes ----------
  drawFloats(ctx, dt) {
    const keep = [];
    ctx.save(); ctx.font = '700 12px system-ui,sans-serif'; ctx.textAlign = 'left';
    for (const f of this.floats) {
      f.t += dt; if (f.t > 1.6) continue;
      const a = f.t < 1.1 ? 1 : 1 - (f.t - 1.1) / 0.5;
      const y = f.y - f.t * 22, x = f.x;
      const tw = ctx.measureText(f.text).width;
      const total = tw + (f.icon ? 14 : 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(x - total / 2 - 4, y - 12, total + 8, 16, 8); ctx.fill();
      ctx.fillStyle = f.color || '#fff'; ctx.fillText(f.text, x - total / 2 + (f.icon ? 14 : 0), y);
      if (f.icon) { const im = iconImg(f.icon); if (im.complete) ctx.drawImage(im, x - total / 2, y - 11, 13, 13); }
      keep.push(f);
    }
    ctx.restore();
    this.floats = keep;
  }

  // ---------- Clima (coordenadas de tela) ----------
  drawWeather(ctx, s, th, dt) {
    const wt = s.weather.type, W = this.cv.width, H = this.cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.dpr;
    if (wt === 'rain' || wt === 'storm') {
      const n = wt === 'storm' ? 420 : 220;
      while (this.rainDrops.length < n) this.rainDrops.push({ x: Math.random() * W, y: Math.random() * H, l: rnd(10, 22), v: rnd(700, 1000) });
      ctx.strokeStyle = wt === 'storm' ? 'rgba(200,220,245,0.7)' : 'rgba(200,218,240,0.55)'; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
      const wind = wt === 'storm' ? 0.4 : 0.15;
      for (const d of this.rainDrops) { d.y += d.v * dt * dpr; d.x -= d.v * dt * wind * dpr; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 200); } if (d.x < 0) d.x += W; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * wind * dpr, d.y - d.l * dpr); }
      ctx.stroke();
      if (wt === 'storm') {
        this.flash = Math.max(0, this.flash - dt * 3);
        if (Math.random() < dt * 0.12) { this.flash = 0.8; }
        if (this.flash > 0.01) { ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.45})`; ctx.fillRect(0, 0, W, H); }
      }
    } else this.rainDrops.length = 0;
    if (wt === 'snow' || th.season === 3) {
      const n = wt === 'snow' ? 150 : 40;
      while (this.snowFlakes.length < n) this.snowFlakes.push({ x: Math.random() * W, y: Math.random() * H, r: rnd(1, 2.8), v: rnd(30, 70), ph: rnd(0, 6) });
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (const f of this.snowFlakes) { f.y += f.v * dt * dpr; f.x += Math.sin(this.time + f.ph) * 20 * dt * dpr; if (f.y > H) { f.y = -5; f.x = Math.random() * W; } ctx.beginPath(); ctx.arc(f.x, f.y, f.r * dpr, 0, 7); ctx.fill(); }
      if (wt !== 'snow') while (this.snowFlakes.length > n) this.snowFlakes.pop();
    } else this.snowFlakes.length = 0;
    if (wt === 'storm' && th.season !== 3) { /* vento nas árvores já tratado */ }
  }
}

function lgs(ctx, x, y, h, col) { const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.2)); return g; }
