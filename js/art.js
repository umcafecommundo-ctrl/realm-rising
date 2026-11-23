// art.js — arte procedural: terreno, árvores, rochas, arbustos e ícones (tudo gerado em canvas, sem imagens externas)
// Sprites são desenhados em escala SC (2x) para ficarem nítidos ao dar zoom.

import { TILE } from './data.js';
import { RNG, shade, mix, rgba, clamp, hash2 } from './util.js';

export const SC = 2;

// Polyfill de roundRect para navegadores mais antigos (Safari < 16 etc.)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Array.isArray(r) ? r : [r, r, r, r];
    const [a, b, c, d] = rr.length === 4 ? rr : [rr[0], rr[0], rr[0], rr[0]];
    this.moveTo(x + a, y); this.lineTo(x + w - b, y); this.quadraticCurveTo(x + w, y, x + w, y + b);
    this.lineTo(x + w, y + h - c); this.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    this.lineTo(x + d, y + h); this.quadraticCurveTo(x, y + h, x, y + h - d);
    this.lineTo(x, y + a); this.quadraticCurveTo(x, y, x + a, y); this.closePath();
  };
}
export function cv(w, h, scale = SC) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const x = c.getContext('2d');
  x.scale(scale, scale);
  return [c, x];
}
export function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
export function rg(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
export function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
export function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
export function rrect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ---------- Paletas por estação (0 primavera, 1 verão, 2 outono, 3 inverno) ----------
export const PAL = {
  grass: ['#86c95f', '#6db84a', '#b0a94c', '#e6eef3'],
  grassDark: ['#6fb04a', '#58a03c', '#968f3c', '#cfdbe4'],
  grassLight: ['#a3dd78', '#8bd05c', '#c9c068', '#f8fcff'],
  leaf: ['#6cc24a', '#3f9a3a', '#e0902a', '#9aa6a0'],
  pine: ['#2f8a52', '#1f7345', '#3b7a3f', '#2a6a55'],
  water: ['#4aa6d8', '#3f9fd4', '#468fb0', '#8fc4dd'],
  waterDeep: ['#2f86c0', '#2a7db8', '#2d7497', '#6aa3c4'],
};

// ---------- Terreno ----------
const tileCache = {};
export function terrainTiles(season) {
  if (tileCache[season]) return tileCache[season];
  const out = [];
  for (let v = 0; v < 8; v++) {
    const [c, x] = cv(TILE, TILE);
    const r = new RNG(900 + v * 31 + season * 7);
    x.fillStyle = PAL.grass[season]; x.fillRect(0, 0, TILE, TILE);
    // manchas suaves
    for (let i = 0; i < 5; i++) ell(x, r.range(0, TILE), r.range(0, TILE), r.range(5, 11), r.range(4, 9), rgba(r.next() < 0.5 ? PAL.grassDark[season] : PAL.grassLight[season], 0.35));
    // grãos
    for (let i = 0; i < 34; i++) {
      x.fillStyle = r.next() < 0.5 ? rgba(PAL.grassDark[season], 0.7) : rgba(PAL.grassLight[season], 0.8);
      x.fillRect(r.range(0, TILE), r.range(0, TILE), season === 3 ? 1.4 : 1, 1);
    }
    // tufos de grama
    if (season !== 3) for (let i = 0; i < 4; i++) {
      const px = r.range(3, TILE - 3), py = r.range(5, TILE - 2);
      x.strokeStyle = shade(PAL.grassDark[season], -0.1); x.lineWidth = 0.9; x.lineCap = 'round';
      for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(px + k * 1.4, py); x.lineTo(px + k * 2.4, py - r.range(2.5, 4.5)); x.stroke(); }
    }
    // flores
    if (season <= 1 && v % 3 === 0) for (let i = 0; i < 3; i++) {
      const px = r.range(3, TILE - 3), py = r.range(3, TILE - 3);
      const col = r.pick(['#fff3a0', '#ffffff', '#ff9ac0', '#c7a5ff', '#ffb35c']);
      ell(x, px, py, 1.3, 1.3, col); ell(x, px, py, 0.5, 0.5, '#e8a21c');
    }
    // folhas caídas
    if (season === 2) for (let i = 0; i < 5; i++) ell(x, r.range(2, TILE - 2), r.range(2, TILE - 2), 1.6, 0.9, r.pick(['#d9792b', '#c4452c', '#e8b13a', '#a85a22']), r.range(0, 3));
    // neve: sombras azuladas e brilho
    if (season === 3) {
      for (let i = 0; i < 3; i++) ell(x, r.range(0, TILE), r.range(0, TILE), r.range(5, 10), r.range(2, 5), 'rgba(150,175,205,0.22)');
      for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(r.range(1, TILE - 2), r.range(1, TILE - 2), 1.2, 1.2); }
    }
    out.push(c);
  }
  tileCache[season] = out;
  return out;
}

// ---------- Árvores ----------
const treeCache = {};
export const TREE_BOX = { pine: [60, 92], oak: [68, 88], birch: [52, 84] };
export function treeSprite(sp, v, season) {
  const key = `${sp}${v}${season}`;
  if (treeCache[key]) return treeCache[key];
  const [W, H] = TREE_BOX[sp];
  const [c, x] = cv(W, H);
  const r = new RNG(v * 97 + season * 13 + sp.length * 31);
  const bx = W / 2, by = H - 4;
  if (sp === 'pine') drawPine(x, bx, by, r, season);
  else if (sp === 'oak') drawOak(x, bx, by, r, season);
  else drawBirch(x, bx, by, r, season);
  const spr = { c, w: W, h: H, ax: bx, ay: by };
  treeCache[key] = spr;
  return spr;
}
function snowCap(x, pts) { poly(x, pts, '#f4f9ff'); }
function drawPine(x, bx, by, r, season) {
  // tronco
  x.fillStyle = lg(x, bx - 3, 0, bx + 3, 0, [[0, '#5a3b22'], [0.6, '#7a5230'], [1, '#4a2f1a']]);
  x.beginPath(); x.moveTo(bx - 3.5, by); x.lineTo(bx - 2.2, by - 22); x.lineTo(bx + 2.2, by - 22); x.lineTo(bx + 3.5, by); x.closePath(); x.fill();
  const base = PAL.pine[season] === undefined ? '#2f8a52' : PAL.pine[season];
  const tiers = 4, jitter = r.range(-1, 1);
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const yb = by - 14 - i * 17, hh = 28 - i * 3, hw = 24 - i * 4.8 + jitter;
    const g = lg(x, bx - hw, yb, bx + hw, yb, [[0, shade(base, -0.25)], [0.45, base], [1, shade(base, 0.12)]]);
    // contorno irregular
    x.beginPath(); x.moveTo(bx, yb - hh);
    const n = 5;
    for (let k = 0; k <= n; k++) { const px = bx + hw - (2 * hw) * k / n, py = yb + (k % 2 ? -2.5 : 0.8); x.lineTo(px, py); }
    x.closePath(); x.fillStyle = g; x.fill();
    // sombra inferior
    x.fillStyle = 'rgba(0,0,0,0.13)'; x.beginPath(); x.moveTo(bx - hw, yb); x.lineTo(bx + hw, yb); x.lineTo(bx + hw * 0.7, yb - 5); x.lineTo(bx - hw * 0.7, yb - 5); x.closePath(); x.fill();
    // luz
    x.strokeStyle = rgba(shade(base, 0.35), 0.5); x.lineWidth = 1.2; x.beginPath(); x.moveTo(bx + 0.5, yb - hh + 1); x.lineTo(bx + hw * 0.85, yb - 1); x.stroke();
    if (season === 3) snowCap(x, [[bx, yb - hh - 0.5], [bx + hw * 0.55, yb - hh * 0.38], [bx + hw * 0.3, yb - hh * 0.44], [bx + 1, yb - hh * 0.3], [bx - hw * 0.25, yb - hh * 0.43], [bx - hw * 0.55, yb - hh * 0.38]]);
  }
}
function drawOak(x, bx, by, r, season) {
  // tronco
  x.fillStyle = lg(x, bx - 6, 0, bx + 6, 0, [[0, '#4d321c'], [0.5, '#7a5333'], [1, '#432b18']]);
  x.beginPath(); x.moveTo(bx - 6, by); x.quadraticCurveTo(bx - 3, by - 14, bx - 3.5, by - 32); x.lineTo(bx + 3.5, by - 32); x.quadraticCurveTo(bx + 3, by - 14, bx + 6, by); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 0.8; for (let i = 0; i < 4; i++) { const yy = by - 4 - i * 7; x.beginPath(); x.moveTo(bx - 1 + r.range(-1, 1), yy); x.lineTo(bx - 1 + r.range(-1, 1), yy - 5); x.stroke(); }
  if (season === 3) {
    // galhos nus com neve
    x.strokeStyle = '#5b4028'; x.lineCap = 'round';
    const br = [[-16, -26, 3], [14, -28, 3], [-8, -38, 2], [7, -40, 2], [0, -48, 2.4], [-20, -40, 1.6], [19, -42, 1.6]];
    for (const [dx, dy, lw] of br) { x.lineWidth = lw; x.beginPath(); x.moveTo(bx, by - 28); x.quadraticCurveTo(bx + dx * 0.4, by - 28 + dy * 0.5, bx + dx, by + dy - 22); x.stroke(); x.strokeStyle = '#f4f9ff'; x.lineWidth = lw * 0.55; x.beginPath(); x.moveTo(bx + dx * 0.4, by - 28 + dy * 0.5 - 0.5); x.lineTo(bx + dx, by + dy - 22.6); x.stroke(); x.strokeStyle = '#5b4028'; }
    return;
  }
  const cols = {
    0: ['#5fb04a', '#78c95a', '#92dd6e'], 1: ['#2f7f33', '#3f9a3a', '#58b24a'],
    2: ['#b8541f', '#e0902a', '#f0c23a'],
  }[season];
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([bx + r.range(-19, 19), by - 50 + r.range(-12, 12), r.range(11, 17)]);
  blobs.sort((a, b) => a[1] - b[1]);
  blobs.forEach(([px, py, rr], i) => {
    const col = season === 2 ? r.pick(cols) : cols[Math.min(2, Math.floor(i / 3))];
    ell(x, px + 1.5, py + 2.5, rr, rr * 0.92, shade(col, -0.35));
    x.fillStyle = rg(x, px - rr * 0.35, py - rr * 0.4, 1, rr * 1.15, [[0, shade(col, 0.28)], [0.6, col], [1, shade(col, -0.22)]]);
    x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
  });
  // luz salpicada
  for (let i = 0; i < 14; i++) ell(x, bx + r.range(-22, 14), by - 50 + r.range(-20, 6), r.range(1.5, 3.2), r.range(1, 2), rgba(shade(cols[2], 0.35), 0.55));
  if (season === 0) for (let i = 0; i < 12; i++) ell(x, bx + r.range(-24, 24), by - 50 + r.range(-20, 14), 1.4, 1.4, r.pick(['#ffd1e8', '#ffffff', '#ffb6d6']));
}
function drawBirch(x, bx, by, r, season) {
  x.fillStyle = lg(x, bx - 3, 0, bx + 3, 0, [[0, '#d8d4c8'], [0.5, '#f4f1e8'], [1, '#bcb8a8']]);
  x.beginPath(); x.moveTo(bx - 3.6, by); x.lineTo(bx - 2.2, by - 48); x.lineTo(bx + 2.2, by - 48); x.lineTo(bx + 3.6, by); x.closePath(); x.fill();
  x.fillStyle = '#2a2a2a';
  for (let i = 0; i < 7; i++) { const yy = by - 5 - i * 6.5 + r.range(-1, 1); x.fillRect(bx - 2.5 + r.range(-0.5, 1), yy, r.range(2, 3.5), 1.2); }
  if (season === 3) {
    x.strokeStyle = '#8a8472'; x.lineWidth = 1.4; x.lineCap = 'round';
    for (const [dx, dy] of [[-14, -62], [13, -64], [-6, -74], [6, -76], [0, -80], [-18, -52], [17, -54]]) { x.beginPath(); x.moveTo(bx, by - 44); x.quadraticCurveTo(bx + dx * 0.3, by + dy * 0.6, bx + dx, by + dy + 6); x.stroke(); }
    for (let i = 0; i < 8; i++) ell(x, bx + r.range(-16, 16), by - 60 + r.range(-14, 8), 1.6, 1.0, '#f4f9ff');
    return;
  }
  const cols = { 0: ['#8fd35a', '#a8e476', '#c8f090'], 1: ['#6fbd45', '#86d055', '#a0e068'], 2: ['#e8b520', '#f2cf3c', '#f7e070'] }[season];
  const blobs = [];
  for (let i = 0; i < 8; i++) blobs.push([bx + r.range(-14, 14), by - 58 + r.range(-12, 10), r.range(8, 12)]);
  blobs.sort((a, b) => a[1] - b[1]);
  blobs.forEach(([px, py, rr], i) => {
    const col = cols[Math.min(2, Math.floor(i / 3))];
    ell(x, px + 1, py + 2, rr, rr, shade(col, -0.3));
    x.fillStyle = rg(x, px - rr * 0.3, py - rr * 0.4, 1, rr * 1.1, [[0, shade(col, 0.3)], [0.6, col], [1, shade(col, -0.18)]]);
    x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
  });
}
const stumpCache = {};
export function stumpSprite(season) {
  if (stumpCache['s' + season]) return stumpCache['s' + season];
  const [c, x] = cv(26, 20);
  x.fillStyle = '#5a3b22'; x.beginPath(); x.ellipse(13, 15, 8, 4, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = lg(x, 6, 0, 20, 0, [[0, '#5a3b22'], [0.5, '#7e5733'], [1, '#4a2f1a']]); x.fillRect(6, 8, 14, 7);
  ell(x, 13, 8, 7, 3.6, '#c99a64'); ell(x, 13, 8, 4.6, 2.2, '#b9854f', 0); ell(x, 13, 8, 2, 1, '#9a6a3a');
  if (season === 3) ell(x, 13, 6.8, 6.4, 2.8, '#f4f9ff');
  return (stumpCache['s' + season] = { c, w: 26, h: 20, ax: 13, ay: 17 });
}
export function saplingSprite(season) {
  if (stumpCache['p' + season]) return stumpCache['p' + season];
  const [c, x] = cv(20, 28);
  x.strokeStyle = '#6b4a2b'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(10, 26); x.lineTo(10, 14); x.stroke();
  if (season !== 3) { const col = ['#78c95a', '#4ca843', '#c9a22a'][season]; ell(x, 10, 11, 5, 6, col); ell(x, 6.5, 15, 3.5, 2.5, shade(col, 0.15), -0.5); ell(x, 13.5, 14, 3.5, 2.5, shade(col, -0.1), 0.5); }
  else ell(x, 10, 12, 3, 2, '#f4f9ff');
  return (stumpCache['p' + season] = { c, w: 20, h: 28, ax: 10, ay: 26 });
}

// ---------- Rochas, minério, arbustos ----------
const rockCache = {};
export function rockSprite(v, season, ore = false) {
  const key = `${v}_${season}_${ore}`;
  if (rockCache[key]) return rockCache[key];
  const W = 54, H = 44;
  const [c, x] = cv(W, H);
  const r = new RNG(v * 71 + 3);
  const cx = W / 2, cy = H - 8;
  const pts = []; const n = 9;
  for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI; const rr = 20 + r.range(-4, 5); pts.push([cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * (rr * 0.95) * (i === 0 || i === n - 1 ? 0.2 : 1)]); }
  pts.push([cx + 21, cy + 3], [cx - 21, cy + 3]);
  const light = ore ? '#8a828f' : '#c3cad2', dark = ore ? '#4a4452' : '#6b7580';
  poly(x, pts, lg(x, cx - 20, cy - 24, cx + 22, cy + 4, [[0, light], [0.55, ore ? '#6a6272' : '#9aa3ad'], [1, dark]]), 'rgba(40,45,55,0.55)', 1);
  // facetas
  x.strokeStyle = 'rgba(30,35,45,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx + r.range(-14, 8), cy - r.range(4, 22)); x.lineTo(cx + r.range(-8, 16), cy - r.range(0, 12)); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(cx - 16, cy - 8); x.lineTo(cx - 6, cy - 21); x.lineTo(cx + 4, cy - 23); x.stroke();
  if (ore) { for (let i = 0; i < 12; i++) { const px = cx + r.range(-15, 15), py = cy - r.range(2, 18); ell(x, px, py, r.range(1.2, 2.6), r.range(0.8, 1.6), r.pick(['#e08a3c', '#f2b45a', '#c96a2a']), r.range(0, 3)); } ell(x, cx - 5, cy - 14, 1.3, 1.3, '#fff2c0'); }
  else if (season !== 3) ell(x, cx + 9, cy - 13, 6, 2.8, rgba(season === 2 ? '#a28c3a' : '#6f9a45', 0.7));
  if (season === 3) poly(x, [[cx - 17, cy - 9], [cx - 8, cy - 22], [cx + 3, cy - 25], [cx + 16, cy - 14], [cx + 8, cy - 12], [cx - 1, cy - 17], [cx - 9, cy - 8]], '#f4f9ff');
  return (rockCache[key] = { c, w: W, h: H, ax: cx, ay: cy + 2 });
}
export function bushSprite(v, season, level) {
  const key = `b${v}_${season}_${level}`;
  if (rockCache[key]) return rockCache[key];
  const W = 36, H = 28;
  const [c, x] = cv(W, H);
  const r = new RNG(v * 41 + level * 5);
  const cx = W / 2, cy = H - 5;
  if (season === 3) {
    x.strokeStyle = '#7a6a55'; x.lineWidth = 1.2; x.lineCap = 'round';
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(cx + r.range(-3, 3), cy); x.lineTo(cx + r.range(-13, 13), cy - r.range(7, 15)); x.stroke(); }
    for (let i = 0; i < 6; i++) ell(x, cx + r.range(-11, 11), cy - r.range(3, 12), 2.2, 1.3, '#f4f9ff');
  } else {
    const g = ['#5db04a', '#3f9a3a', '#a89030'][season];
    for (const [dx, dy, rr] of [[-8, -4, 8], [8, -4, 8], [0, -9, 9.5], [-3, -3, 8], [5, -2, 7]]) {
      ell(x, cx + dx + 0.8, cy + dy + 2, rr, rr * 0.85, shade(g, -0.3));
      x.fillStyle = rg(x, cx + dx - 2, cy + dy - 3, 1, rr, [[0, shade(g, 0.25)], [0.7, g], [1, shade(g, -0.2)]]);
      x.beginPath(); x.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); x.fill();
    }
    const nb = level * 2;
    for (let i = 0; i < nb; i++) { const px = cx + r.range(-12, 12), py = cy - r.range(2, 13); ell(x, px, py, 2, 2, '#d8302f'); ell(x, px - 0.5, py - 0.6, 0.7, 0.7, '#ff9a8a'); }
    if (season === 0) for (let i = 0; i < 4; i++) ell(x, cx + r.range(-11, 11), cy - r.range(3, 13), 1.2, 1.2, '#ffffff');
  }
  return (rockCache[key] = { c, w: W, h: H, ax: cx, ay: cy + 3 });
}

// ---------- Ícones de recursos (dataURL) ----------
const iconCache = {};
export function iconURL(name, size = 40) {
  const key = name + size;
  if (iconCache[key]) return iconCache[key];
  const [c, x] = cv(size, size, 2);
  x.scale(size / 40, size / 40);
  const o = ICONS[name]; if (o) o(x);
  return (iconCache[key] = c.toDataURL());
}
const ICONS = {
  wood(x) { for (const [yy, rot] of [[27, 0], [19, 0], [23, -0.12]]) { x.save(); x.translate(20, yy); x.rotate(rot); rrect(x, -14, -4.5, 28, 9, 4, lg(x, 0, -5, 0, 5, [[0, '#a86f3a'], [1, '#6b4423']])); ell(x, 14, 0, 3, 4.4, '#d9a56a'); ell(x, 14, 0, 1.6, 2.4, '#b8844a'); x.restore(); } },
  stone(x) { poly(x, [[6, 30], [10, 14], [20, 8], [31, 13], [35, 30]], lg(x, 8, 8, 34, 32, [[0, '#d0d6dd'], [1, '#6f7a86']]), '#4b5560'); poly(x, [[14, 30], [17, 22], [25, 20], [29, 30]], '#8e98a4', '#4b5560'); },
  food(x) { ell(x, 20, 24, 11, 10, lg(x, 9, 14, 31, 34, [[0, '#ff7a6a'], [1, '#c3252b']])); x.strokeStyle = '#6b4423'; x.lineWidth = 2; x.beginPath(); x.moveTo(20, 15); x.lineTo(22, 8); x.stroke(); ell(x, 26, 9, 5, 2.6, '#58b24a', -0.5); ell(x, 15, 21, 3, 4, 'rgba(255,255,255,0.4)', 0.4); },
  water(x) { x.beginPath(); x.moveTo(20, 5); x.bezierCurveTo(30, 18, 33, 24, 33, 27); x.arc(20, 27, 13, 0, Math.PI, false); x.bezierCurveTo(7, 24, 10, 18, 20, 5); x.fillStyle = lg(x, 8, 6, 32, 36, [[0, '#8fd4ff'], [1, '#2a7fd0']]); x.fill(); ell(x, 15, 26, 3, 5, 'rgba(255,255,255,0.55)', 0.3); },
  planks(x) { for (let i = 0; i < 3; i++) { rrect(x, 5, 9 + i * 8.5, 30, 7, 1.5, lg(x, 0, 0, 0, 8, [[0, '#f0c27a'], [1, '#b8803f']]), '#7a5028'); x.strokeStyle = 'rgba(120,80,40,0.5)'; x.beginPath(); x.moveTo(10, 12 + i * 8.5); x.lineTo(20, 12 + i * 8.5); x.stroke(); } },
  tools(x) { x.save(); x.translate(20, 20); x.rotate(0.7); rrect(x, -2, -16, 4, 32, 2, '#8a5a2b'); rrect(x, -10, -17, 20, 7, 3, lg(x, 0, -17, 0, -10, [[0, '#cfd6de'], [1, '#6f7a86']])); x.restore(); x.save(); x.translate(20, 20); x.rotate(-0.7); rrect(x, -2, -16, 4, 32, 2, '#8a5a2b'); poly(x, [[-9, -16], [9, -16], [6, -9], [-6, -9]], '#aeb6bf', '#4b5560'); x.restore(); },
  cloth(x) { rrect(x, 8, 10, 24, 20, 3, lg(x, 8, 10, 32, 30, [[0, '#d9a8f0'], [1, '#8a52b0']])); ell(x, 8, 20, 3, 10, '#e8c4fa'); ell(x, 32, 20, 3, 10, '#7a4aa0'); x.strokeStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(11, 14 + i * 4); x.lineTo(30, 14 + i * 4); x.stroke(); } },
  iron(x) { poly(x, [[6, 28], [11, 15], [31, 15], [35, 28]], lg(x, 6, 15, 35, 28, [[0, '#9aa7b4'], [1, '#4b5663']]), '#2f3944'); poly(x, [[11, 15], [31, 15], [28, 10], [14, 10]], '#c6d0da', '#2f3944'); },
  gold(x) { ell(x, 20, 22, 14, 13, lg(x, 6, 9, 34, 35, [[0, '#ffe680'], [1, '#d4900c']])); ell(x, 20, 22, 10, 9, '#f5c542'); x.fillStyle = '#b87a08'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.fillText('$', 20, 27.5); ell(x, 13, 15, 3, 2, 'rgba(255,255,255,0.6)', -0.6); },
  weapons(x) { x.save(); x.translate(20, 20); x.rotate(0.78); poly(x, [[-2, -17], [2, -17], [2.5, 8], [-2.5, 8]], lg(x, -3, 0, 3, 0, [[0, '#e8eef4'], [1, '#8a96a4']])); rrect(x, -8, 8, 16, 3.5, 1.5, '#b87a08'); rrect(x, -1.6, 11, 3.2, 8, 1.5, '#6b4423'); x.restore(); x.save(); x.translate(20, 20); x.rotate(-0.78); poly(x, [[-2, -17], [2, -17], [2.5, 8], [-2.5, 8]], lg(x, -3, 0, 3, 0, [[0, '#e8eef4'], [1, '#8a96a4']])); rrect(x, -8, 8, 16, 3.5, 1.5, '#b87a08'); rrect(x, -1.6, 11, 3.2, 8, 1.5, '#6b4423'); x.restore(); },
  jewels(x) { poly(x, [[8, 16], [14, 8], [26, 8], [32, 16], [20, 33]], lg(x, 8, 8, 32, 33, [[0, '#ffb3dc'], [0.5, '#ff4fa5'], [1, '#a3185f']]), '#7a0f45'); poly(x, [[8, 16], [32, 16], [20, 33]], 'rgba(160,20,100,0.35)'); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.moveTo(14, 8); x.lineTo(17, 16); x.lineTo(20, 33); x.moveTo(26, 8); x.lineTo(23, 16); x.lineTo(20, 33); x.stroke(); },
  pop(x) { ell(x, 14, 14, 5.5, 5.5, '#f1c9a0'); ell(x, 28, 15, 5, 5, '#e0ac7c'); rrect(x, 7, 20, 14, 15, 6, '#5a9bd4'); rrect(x, 22, 21, 13, 14, 6, '#d46a8c'); },
  research(x) { ell(x, 20, 20, 13, 13, lg(x, 7, 7, 33, 33, [[0, '#c4b5ff'], [1, '#5a43c8']])); x.strokeStyle = '#fff'; x.lineWidth = 1.8; x.beginPath(); x.ellipse(20, 20, 13, 5, 0.6, 0, 7); x.stroke(); x.beginPath(); x.ellipse(20, 20, 13, 5, -0.6, 0, 7); x.stroke(); ell(x, 20, 20, 3, 3, '#fff'); },
};
