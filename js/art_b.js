// art_b.js — sprites procedurais de construções (3/4 top-down), andaimes e fundações

import { TILE, BUILDINGS } from './data.js';
import { cv, lg, rg, ell, poly, rrect } from './art.js';
import { RNG, shade, mix, rgba } from './util.js';

export const M = 10; // margem horizontal do sprite
const cache = {};

// ---------- Primitivas ----------
function planks(x, X, Y, W, H, base, vertical = true) {
  x.fillStyle = lg(x, X, Y, X, Y + H, [[0, shade(base, 0.12)], [1, shade(base, -0.18)]]); x.fillRect(X, Y, W, H);
  x.strokeStyle = rgba(shade(base, -0.45), 0.55); x.lineWidth = 0.8;
  if (vertical) for (let i = 4; i < W; i += 5.2) { x.beginPath(); x.moveTo(X + i, Y); x.lineTo(X + i, Y + H); x.stroke(); }
  else for (let i = 5; i < H; i += 5.5) { x.beginPath(); x.moveTo(X, Y + i); x.lineTo(X + W, Y + i); x.stroke(); }
  x.fillStyle = rgba(shade(base, 0.35), 0.25); x.fillRect(X, Y, W, 1.4);
}
function stones(x, X, Y, W, H, base, seed = 1) {
  const r = new RNG(seed);
  x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip();
  x.fillStyle = shade(base, -0.25); x.fillRect(X, Y, W, H);
  const bh = 6.5;
  for (let row = 0, yy = Y; yy < Y + H; row++, yy += bh) {
    let xx = X - (row % 2 ? 5 : 0);
    while (xx < X + W) {
      const bw = r.range(8, 13);
      const col = shade(base, r.range(-0.12, 0.14));
      rrect(x, xx + 0.5, yy + 0.5, bw - 1, bh - 1, 1.4, lg(x, xx, yy, xx, yy + bh, [[0, shade(col, 0.1)], [1, shade(col, -0.12)]]));
      xx += bw;
    }
  }
  x.restore();
}
function shingles(x, pts, base, rows, X0, X1, Ytop, Ybot) {
  poly(x, pts, lg(x, 0, Ytop, 0, Ybot, [[0, shade(base, 0.15)], [1, shade(base, -0.22)]]));
  x.save(); x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.clip();
  x.strokeStyle = rgba(shade(base, -0.5), 0.45); x.lineWidth = 0.8;
  const hgt = (Ybot - Ytop) / rows;
  for (let i = 1; i < rows; i++) { const yy = Ytop + i * hgt; x.beginPath(); x.moveTo(X0, yy); x.lineTo(X1, yy); x.stroke(); for (let k = (i % 2) * 4; k < X1 - X0; k += 8) { x.beginPath(); x.moveTo(X0 + k, yy); x.lineTo(X0 + k, yy + hgt); x.stroke(); } }
  x.restore();
}
/** Telhado de duas águas visto de frente */
function gable(x, X, Y, W, rise, oh, base, snow, rows = 6) {
  const pts = [[X - oh, Y], [X + W / 2, Y - rise], [X + W + oh, Y], [X + W + oh - 3, Y + 6], [X - oh + 3, Y + 6]];
  shingles(x, pts, base, rows, X - oh, X + W + oh, Y - rise, Y + 6);
  // metade direita mais escura
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.moveTo(X + W / 2, Y - rise); x.lineTo(X + W + oh, Y); x.lineTo(X + W + oh - 3, Y + 6); x.lineTo(X + W / 2, Y + 6); x.closePath(); x.fill();
  x.strokeStyle = shade(base, -0.45); x.lineWidth = 1; x.beginPath(); x.moveTo(X - oh, Y); x.lineTo(X + W / 2, Y - rise); x.lineTo(X + W + oh, Y); x.stroke();
  x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(X - oh + 3, Y + 6, W + 2 * oh - 6, 3);
  if (snow) { poly(x, [[X - oh + 1, Y - 0.5], [X + W / 2, Y - rise - 1.5], [X + W + oh - 1, Y - 0.5], [X + W + oh - 4, Y + 3], [X + W / 2 + 8, Y - rise * 0.55], [X + W / 2 - 8, Y - rise * 0.5], [X - oh + 4, Y + 3]], '#f6faff'); }
}
function door(x, X, Y, w, h, col = '#5a3a22') {
  rrect(x, X - 1.5, Y - h - 1.5, w + 3, h + 1.5, [w / 2 + 2, w / 2 + 2, 0, 0], shade(col, -0.35));
  x.fillStyle = lg(x, X, Y - h, X + w, Y, [[0, shade(col, 0.15)], [1, shade(col, -0.2)]]);
  x.beginPath(); x.roundRect(X, Y - h, w, h, [w / 2, w / 2, 0, 0]); x.fill();
  x.fillStyle = '#e8c15a'; x.fillRect(X + w - 3.4, Y - h * 0.45, 1.8, 1.8);
  x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 0.7; x.beginPath(); x.moveTo(X + w / 2, Y - h); x.lineTo(X + w / 2, Y); x.stroke();
}
function win(x, X, Y, w, h, lights, glow = '#ffcf6a') {
  rrect(x, X - 1.5, Y - 1.5, w + 3, h + 3, 1.5, '#4a3524');
  x.fillStyle = lg(x, X, Y, X + w, Y + h, [[0, '#8ec8e8'], [1, '#4a86b0']]); x.fillRect(X, Y, w, h);
  x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(X, Y + h * 0.7); x.lineTo(X + w * 0.6, Y); x.lineTo(X + w, Y); x.lineTo(X + w * 0.3, Y + h); x.lineTo(X, Y + h); x.closePath(); x.fill();
  x.strokeStyle = '#4a3524'; x.lineWidth = 1; x.beginPath(); x.moveTo(X + w / 2, Y); x.lineTo(X + w / 2, Y + h); x.moveTo(X, Y + h / 2); x.lineTo(X + w, Y + h / 2); x.stroke();
  x.fillStyle = '#7a4f2e'; x.fillRect(X - 2.5, Y + h + 1.5, w + 5, 1.8);
  lights.push({ x: X + w / 2, y: Y + h / 2, w, h, c: glow, win: [X, Y, w, h] });
}
function chimney(x, X, Y, w, h, snow) {
  stones(x, X, Y - h, w, h, '#8a7f76', 7);
  rrect(x, X - 1.5, Y - h - 3, w + 3, 4, 1, '#6a6058');
  x.fillStyle = '#23201e'; x.fillRect(X + 1.5, Y - h - 2.5, w - 3, 1.8);
  if (snow) rrect(x, X - 1.5, Y - h - 5, w + 3, 3, 1.5, '#f6faff');
  return { x: X + w / 2, y: Y - h - 4 };
}
function groundShadow(x, X, Y, W, D) {
  x.fillStyle = rg(x, X + W / 2, Y, 2, W * 0.62, [[0, 'rgba(0,0,0,0.38)'], [1, 'rgba(0,0,0,0)']]);
  x.save(); x.translate(0, Y); x.scale(1, D / (W * 0.62) * 0.9); x.translate(0, -Y); x.fillRect(X - W * 0.2, Y - W * 0.62, W * 1.4, W * 1.24); x.restore();
}
function dirtPad(x, X, Y, W, D, r = new RNG(5)) {
  x.fillStyle = rg(x, X + W / 2, Y - D / 2, 4, Math.max(W, D) * 0.7, [[0, 'rgba(120,92,60,0.85)'], [0.7, 'rgba(120,92,60,0.5)'], [1, 'rgba(120,92,60,0)']]);
  x.save(); x.translate(X + W / 2, Y - D / 2); x.scale(1, D / W + 0.15); x.beginPath(); x.arc(0, 0, W * 0.62, 0, 7); x.fill(); x.restore();
}
function bannerFlag(x, X, Y, h, col) {
  x.strokeStyle = '#5a4630'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y - h); x.stroke();
  poly(x, [[X, Y - h], [X + 13, Y - h + 3], [X + 9, Y - h + 6], [X + 13, Y - h + 9], [X, Y - h + 9]], col, shade(col, -0.4), 0.7);
}

// ---------- Desenhos por tipo ----------
// Cada função recebe (x, W, H, season, o) e preenche o.lights / o.smoke. Y1 = linha de base frontal.
const DRAW = {
  campfire(x, W, H, s, o) {
    const cx = M + W / 2, cy = H - 26;
    dirtPad(x, M, H - 4, W, 54);
    ell(x, cx, cy + 3, 27, 12, 'rgba(40,28,20,0.5)');
    const r = new RNG(11);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const px = cx + Math.cos(a) * 21, py = cy + Math.sin(a) * 9.5; ell(x, px, py + 1.5, 5.4, 3.4, 'rgba(0,0,0,0.3)'); ell(x, px, py, 5.2, 3.6, lg(x, px - 4, py - 3, px + 4, py + 3, [[0, '#c9ced4'], [1, '#6c7680']])); ell(x, px - 1, py - 1, 2, 1, 'rgba(255,255,255,0.4)'); }
    ell(x, cx, cy, 15, 6.5, '#1b1612'); ell(x, cx, cy, 11, 4.6, '#3a2a20');
    for (const [dx, rot] of [[-5, -0.35], [5, 0.35], [0, 1.57]]) { x.save(); x.translate(cx + dx, cy - 1); x.rotate(rot); rrect(x, -11, -2.6, 22, 5.2, 2.5, lg(x, 0, -3, 0, 3, [[0, '#8a5a30'], [1, '#4a2f18']])); ell(x, 11, 0, 1.5, 2.6, '#c99a64'); x.restore(); }
    // espeto com panela
    x.strokeStyle = '#5a3b22'; x.lineWidth = 2; for (const dx of [-24, 24]) { x.beginPath(); x.moveTo(cx + dx, cy + 2); x.lineTo(cx + dx, cy - 22); x.lineTo(cx + dx - 2, cy - 25); x.stroke(); x.beginPath(); x.moveTo(cx + dx, cy - 22); x.lineTo(cx + dx + 2, cy - 25); x.stroke(); }
    x.beginPath(); x.moveTo(cx - 24, cy - 23); x.lineTo(cx + 24, cy - 23); x.stroke();
    x.strokeStyle = '#333'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(cx + 8, cy - 23); x.lineTo(cx + 8, cy - 17); x.stroke();
    ell(x, cx + 8, cy - 12, 6.2, 5.2, lg(x, cx + 2, cy - 17, cx + 14, cy - 7, [[0, '#6a727c'], [1, '#2a2f36']])); ell(x, cx + 8, cy - 16, 5, 1.8, '#7a5a30');
    o.fire = { x: cx, y: cy - 4 }; o.lights.push({ x: cx, y: cy - 6, r: 190, c: '#ff9a3c', fire: true });
  },
  shelter(x, W, H, s, o) {
    const cx = M + W / 2, Y1 = H - 6;
    dirtPad(x, M, H - 4, W, 36); groundShadow(x, M + 6, Y1, W - 6, 14);
    // pontas de varas
    x.strokeStyle = '#5a3b22'; x.lineWidth = 2.4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 5, 4); x.lineTo(cx + 4, 22); x.moveTo(cx + 5, 4); x.lineTo(cx - 4, 22); x.stroke();
    // face lateral (direita)
    poly(x, [[cx, 8], [M + W - 2, Y1 - 10], [M + W - 12, Y1 - 3], [cx + 3, Y1]], lg(x, cx, 0, M + W, 0, [[0, '#8c6a46'], [1, '#6a4c30']]), '#3f2c1a', 0.8);
    // frente
    poly(x, [[M + 3, Y1], [cx, 8], [cx + 3, Y1]], null);
    poly(x, [[M + 2, Y1 + 1], [cx - 1, 8], [cx + 6, Y1 + 1]], lg(x, M, 8, M + W / 2, Y1, [[0, '#d2ad7c'], [1, '#a47f52']]), '#4a3320', 1);
    x.strokeStyle = 'rgba(70,45,25,0.45)'; x.lineWidth = 0.9;
    for (let i = 1; i < 5; i++) { const t = i / 5; x.beginPath(); x.moveTo(cx - 1 - (cx - M - 3) * t * 0.9, 8 + (Y1 - 8) * t); x.lineTo(cx + 5 - 1 + 3 * t, 8 + (Y1 - 8) * t); x.stroke(); }
    poly(x, [[cx - 7, Y1 + 1], [cx + 1, Y1 - 24], [cx + 8, Y1 + 1]], '#2a1c12');
    poly(x, [[cx - 4, Y1 + 1], [cx + 1, Y1 - 15], [cx + 5, Y1 + 1]], '#120c08');
    for (let i = 0; i < 3; i++) ell(x, M + 8 + i * 10, Y1 + 0.5, 4, 2.4, '#8a929c');
    // pilha de lenha
    for (let i = 0; i < 3; i++) rrect(x, M + W - 22 + (i % 2) * 3, Y1 - 1 - i * 3.6, 16, 3.6, 1.8, i % 2 ? '#7a5230' : '#946a3c');
    o.lights.push({ x: cx + 1, y: Y1 - 9, r: 55, c: '#ff9a4a' });
  },
  gatherpoint(x, W, H, s, o) {
    const Y1 = H - 6;
    dirtPad(x, M, H - 4, W, 46);
    ell(x, M + W / 2, Y1 - 12, W * 0.42, 14, 'rgba(150,110,60,0.65)'); ell(x, M + W / 2, Y1 - 12, W * 0.38, 12, 'rgba(190,150,90,0.8)');
    // caixas
    const crate = (cx, cy, w, h) => { planks(x, cx, cy - h, w, h, '#b88a50'); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(cx, cy - h, w, 2); x.strokeStyle = '#6a4a26'; x.lineWidth = 1; x.strokeRect(cx + 0.5, cy - h + 0.5, w - 1, h - 1); x.beginPath(); x.moveTo(cx, cy - h); x.lineTo(cx + w, cy); x.stroke(); };
    crate(M + 8, Y1 - 4, 20, 16); crate(M + 12, Y1 - 18, 15, 13); crate(M + W - 34, Y1 - 3, 22, 14);
    // cestos
    for (const [cx, cy, c] of [[M + 42, Y1 - 6, '#d8302f'], [M + 56, Y1 - 3, '#58a64a'], [M + 66, Y1 - 8, '#e8a21c']]) { ell(x, cx, cy + 2, 9, 4, 'rgba(0,0,0,0.25)'); x.fillStyle = lg(x, cx - 8, 0, cx + 8, 0, [[0, '#a07840'], [1, '#6a4a26']]); x.beginPath(); x.moveTo(cx - 8, cy - 8); x.lineTo(cx + 8, cy - 8); x.lineTo(cx + 6, cy + 1); x.lineTo(cx - 6, cy + 1); x.closePath(); x.fill(); ell(x, cx, cy - 8, 8, 3, '#4a3018'); for (let i = 0; i < 6; i++) ell(x, cx - 5 + i * 2, cy - 9.5 + (i % 2), 1.8, 1.8, c); }
    // varal
    x.strokeStyle = '#5a3b22'; x.lineWidth = 2; x.beginPath(); x.moveTo(M + W - 12, Y1 - 4); x.lineTo(M + W - 12, Y1 - 32); x.moveTo(M + W - 40, Y1 - 4); x.lineTo(M + W - 40, Y1 - 32); x.moveTo(M + W - 12, Y1 - 30); x.lineTo(M + W - 40, Y1 - 30); x.stroke();
    for (let i = 0; i < 4; i++) poly(x, [[M + W - 36 + i * 6, Y1 - 29], [M + W - 33 + i * 6, Y1 - 29], [M + W - 34 + i * 6, Y1 - 20]], ['#c9704a', '#e8c15a', '#8aa0c0', '#c9704a'][i]);
  },
  house(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 8, WW = W - 16;
    groundShadow(x, X, Y1, WW, 18); dirtPad(x, M, H - 4, W, 30);
    const wallH = 38;
    stones(x, X, Y1 - 11, WW, 11, '#8f8a82', 3);
    planks(x, X, Y1 - wallH, WW, wallH - 11, '#d6b583', false);
    x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(X + WW - 6, Y1 - wallH, 6, wallH);
    // vigas
    x.fillStyle = '#5a3d26'; x.fillRect(X, Y1 - wallH, 3, wallH); x.fillRect(X + WW - 3, Y1 - wallH, 3, wallH); x.fillRect(X, Y1 - wallH, WW, 3);
    door(x, X + 12, Y1, 14, 24, '#6a4328');
    win(x, X + WW - 30, Y1 - 31, 14, 13, o.lights);
    const ry = Y1 - wallH;
    o.smoke = chimney(x, X + WW - 20, ry - 6, 8, 16, s === 3);
    gable(x, X, ry, WW, 34, 7, '#b5503a', s === 3, 6);
  },
  farm(x, W, H, s, o) {
    const FD = H - 8, Y1 = H - 4, r = new RNG(9);
    x.fillStyle = '#7a5a3a'; x.beginPath(); x.roundRect(M, Y1 - FD, W, FD, 4); x.fill();
    const rows = 6, rh = (FD - 8) / rows;
    for (let i = 0; i < rows; i++) {
      const yy = Y1 - FD + 4 + i * rh;
      x.fillStyle = s === 3 ? '#e6eef3' : '#5e4128'; x.beginPath(); x.roundRect(M + 4, yy + 1, W - 8, rh - 3, 2); x.fill();
      x.fillStyle = s === 3 ? '#cdd9e3' : '#4a3320'; x.fillRect(M + 4, yy + rh - 4, W - 8, 1.6);
      // plantas
      if (s !== 3) for (let k = 0; k < 16; k++) {
        const px = M + 8 + k * ((W - 16) / 15), py = yy + rh * 0.55;
        const col = [['#78c95a', '#5fb04a'], ['#8fcf3a', '#f2d230'], ['#d9a52a', '#e8bd3c']][s];
        const grown = s === 0 ? 3 : s === 1 ? 6 : 9;
        x.strokeStyle = col[k % 2]; x.lineWidth = 1.5; x.lineCap = 'round';
        for (let b = -1; b <= 1; b++) { x.beginPath(); x.moveTo(px, py + 2); x.lineTo(px + b * 2.4, py - grown + r.range(-1, 1)); x.stroke(); }
        if (s === 2) ell(x, px, py - grown, 1.5, 2.6, '#f2cf4a');
      }
    }
    // cerca
    x.strokeStyle = '#6a4a2b'; x.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const px = M + i * (W / 8); x.beginPath(); x.moveTo(px, Y1 - FD - 3); x.lineTo(px, Y1 - FD + 5); x.stroke(); x.beginPath(); x.moveTo(px, Y1 + 1); x.lineTo(px, Y1 - 6); x.stroke(); }
    x.beginPath(); x.moveTo(M, Y1 - FD + 1); x.lineTo(M + W, Y1 - FD + 1); x.stroke();
    // espantalho
    const sx = M + W - 16, sy = Y1 - FD * 0.45;
    x.strokeStyle = '#6a4a2b'; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, sy + 8); x.lineTo(sx, sy - 14); x.moveTo(sx - 9, sy - 8); x.lineTo(sx + 9, sy - 8); x.stroke();
    ell(x, sx, sy - 17, 4.2, 4.2, '#e8d29a'); poly(x, [[sx - 7, sy - 19], [sx + 7, sy - 19], [sx + 3, sy - 26], [sx - 3, sy - 26]], '#7a4a2a'); poly(x, [[sx - 4, sy - 8], [sx + 4, sy - 8], [sx + 5, sy + 1], [sx - 5, sy + 1]], '#a8553a');
  },
  well(x, W, H, s, o) {
    const cx = M + W / 2, Y1 = H - 8;
    groundShadow(x, M + 6, Y1, W - 12, 12); dirtPad(x, M, H - 4, W, 30);
    stones(x, cx - 17, Y1 - 18, 34, 18, '#9a948a', 5);
    ell(x, cx, Y1 - 18, 17, 6, '#8a847a'); ell(x, cx, Y1 - 18, 13, 4.2, '#1b3a55'); ell(x, cx - 2, Y1 - 18.5, 8, 2, 'rgba(120,190,240,0.5)');
    x.fillStyle = '#6a4a2b'; x.fillRect(cx - 17, Y1 - 46, 3.5, 30); x.fillRect(cx + 13.5, Y1 - 46, 3.5, 30);
    rrect(x, cx - 3, Y1 - 43, 6, 6, 3, '#8a5a30');
    x.strokeStyle = '#d0c0a0'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, Y1 - 38); x.lineTo(cx, Y1 - 24); x.stroke();
    x.fillStyle = lg(x, cx - 3, 0, cx + 3, 0, [[0, '#a07840'], [1, '#6a4a26']]); x.fillRect(cx - 3.5, Y1 - 24, 7, 6);
    gable(x, cx - 19, Y1 - 44, 38, 14, 5, '#8a5a32', s === 3, 3);
  },
  sawmill(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 6, WW = W - 12;
    groundShadow(x, X, Y1, WW, 18); dirtPad(x, M, H - 4, W, 36);
    planks(x, X, Y1 - 32, WW * 0.62, 32, '#a8825a', false);
    x.fillStyle = '#2a1c12'; x.fillRect(X + 10, Y1 - 24, WW * 0.62 - 20, 24);
    planks(x, X + 10, Y1 - 24, WW * 0.62 - 20, 24, '#6a4a2a');
    // lâmina circular
    const bx = X + WW * 0.31, by = Y1 - 11;
    ell(x, bx, by, 9, 9, lg(x, bx - 9, by - 9, bx + 9, by + 9, [[0, '#dfe5ea'], [1, '#7a8794']]));
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; poly(x, [[bx + Math.cos(a) * 9, by + Math.sin(a) * 9], [bx + Math.cos(a + 0.2) * 11.5, by + Math.sin(a + 0.2) * 11.5], [bx + Math.cos(a + 0.4) * 9, by + Math.sin(a + 0.4) * 9]], '#b8c2cc'); }
    ell(x, bx, by, 2.5, 2.5, '#444');
    gable(x, X - 2, Y1 - 32, WW * 0.62 + 4, 20, 5, '#7a5a3a', s === 3, 5);
    // toras empilhadas
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const lx = X + WW * 0.68 + i * 11 + row * 5.5, ly = Y1 - 5 - row * 9; ell(x, lx, ly, 6, 5, lg(x, lx - 6, ly - 5, lx + 6, ly + 5, [[0, '#8a5a30'], [1, '#5a3a1a']])); ell(x, lx + 1, ly, 4, 3.6, '#d6a86a'); ell(x, lx + 1, ly, 2, 1.8, '#b8844a'); }
    // tábuas
    for (let i = 0; i < 4; i++) rrect(x, X + WW * 0.64, Y1 - 38 - i * 2.8, 24, 2.6, 0.8, '#e0b878', '#8a6a3a', 0.5);
    o.lights.push({ x: bx, y: by, r: 40, c: '#ffcf8a' });
  },
  storehouse(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 6, WW = W - 12, wallH = 36;
    groundShadow(x, X, Y1, WW, 18); dirtPad(x, M, H - 4, W, 36);
    stones(x, X, Y1 - 9, WW, 9, '#8a857c', 4);
    planks(x, X, Y1 - wallH, WW, wallH - 9, '#9c7048');
    x.fillStyle = '#4a3220'; x.fillRect(X, Y1 - wallH, 3, wallH); x.fillRect(X + WW - 3, Y1 - wallH, 3, wallH); x.fillRect(X + WW / 2 - 1, Y1 - wallH, 2, wallH);
    // portão duplo
    const gw = 30; planks(x, X + WW / 2 - gw / 2, Y1 - 27, gw, 27, '#6a4328'); x.strokeStyle = '#2a1a0e'; x.lineWidth = 1.2; x.strokeRect(X + WW / 2 - gw / 2, Y1 - 27, gw, 27); x.beginPath(); x.moveTo(X + WW / 2, Y1 - 27); x.lineTo(X + WW / 2, Y1); x.moveTo(X + WW / 2 - gw / 2, Y1 - 27); x.lineTo(X + WW / 2, Y1 - 5); x.moveTo(X + WW / 2 + gw / 2, Y1 - 27); x.lineTo(X + WW / 2, Y1 - 5); x.stroke();
    win(x, X + 8, Y1 - 28, 9, 9, o.lights); win(x, X + WW - 17, Y1 - 28, 9, 9, o.lights);
    gable(x, X, Y1 - wallH, WW, 30, 6, '#7a5a38', s === 3, 6);
    rrect(x, X + WW / 2 - 8, Y1 - wallH - 12, 16, 9, 2, '#3a2a1a'); x.fillStyle = '#e8c15a'; x.font = 'bold 7px sans-serif'; x.textAlign = 'center'; x.fillText('▤', X + WW / 2, Y1 - wallH - 4.5);
  },
  market(x, W, H, s, o) {
    const Y1 = H - 6; dirtPad(x, M, H - 4, W, 70); groundShadow(x, M + 4, Y1, W - 8, 16);
    const stall = (X, Y, w, col1, col2, items) => {
      planks(x, X + 3, Y - 20, w - 6, 20, '#a07848', false);
      x.fillStyle = '#6a4a2b'; x.fillRect(X, Y - 44, 3, 44); x.fillRect(X + w - 3, Y - 44, 3, 44);
      // toldo listrado
      const n = 7, sw = w / n;
      for (let i = 0; i < n; i++) poly(x, [[X + i * sw, Y - 44], [X + (i + 1) * sw, Y - 44], [X + (i + 1) * sw + 1.5, Y - 30], [X + i * sw - 1.5, Y - 30]], i % 2 ? col1 : col2);
      for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? col1 : col2; x.beginPath(); x.arc(X + i * sw + sw / 2, Y - 30, sw / 2, 0, Math.PI); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(X, Y - 44, w, 3);
      items(X, Y, w);
    };
    stall(M + 4, Y1 - 8, 44, '#d9453a', '#f4efe2', (X, Y, w) => { for (let i = 0; i < 6; i++) ell(x, X + 8 + i * 6, Y - 22 - (i % 2) * 2, 3, 3, ['#d8302f', '#f2a21c', '#58a64a'][i % 3]); });
    stall(M + W - 50, Y1 - 4, 44, '#3a7bc8', '#f4efe2', (X, Y, w) => { for (let i = 0; i < 4; i++) rrect(x, X + 6 + i * 9, Y - 28, 7, 8, 1, ['#c58be0', '#e8c15a', '#7fc4a0', '#e08a8a'][i]); });
    // caixotes e barris
    for (const bx of [M + W / 2 - 6, M + W / 2 + 12]) { x.fillStyle = lg(x, bx - 7, 0, bx + 7, 0, [[0, '#a07848'], [1, '#6a4a26']]); x.beginPath(); x.roundRect(bx - 7, Y1 - 18, 14, 18, 4); x.fill(); x.fillStyle = '#4a3a2a'; x.fillRect(bx - 7, Y1 - 13, 14, 1.6); x.fillRect(bx - 7, Y1 - 6, 14, 1.6); }
    bannerFlag(x, M + W / 2, Y1 - 24, 38, '#e0a82e');
    o.lights.push({ x: M + 26, y: Y1 - 34, r: 70, c: '#ffcf6a' }, { x: M + W - 28, y: Y1 - 34, r: 70, c: '#ffcf6a' });
  },
  smithy(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 6, WW = W - 12, wallH = 38;
    groundShadow(x, X, Y1, WW, 18); dirtPad(x, M, H - 4, W, 34);
    stones(x, X, Y1 - wallH, WW * 0.7, wallH, '#7d7a80', 11);
    planks(x, X + WW * 0.7, Y1 - wallH + 8, WW * 0.3, wallH - 8, '#5a4332', false);
    // forja brilhante
    rrect(x, X + 10, Y1 - 24, 24, 24, [12, 12, 0, 0], '#1a1210'); rrect(x, X + 14, Y1 - 20, 16, 20, [8, 8, 0, 0], rg(x, X + 22, Y1 - 6, 1, 14, [[0, '#fff2a0'], [0.4, '#ff9a2a'], [1, '#a82a0a']]));
    o.lights.push({ x: X + 22, y: Y1 - 10, r: 105, c: '#ff7a2a', fire: true });
    win(x, X + WW * 0.7 + 6, Y1 - 28, 10, 10, o.lights);
    gable(x, X, Y1 - wallH, WW * 0.7, 20, 5, '#4a4048', s === 3, 5);
    o.smoke = chimney(x, X + WW * 0.18, Y1 - wallH - 8, 11, 26, s === 3);
    // bigorna
    const ax = X + WW * 0.6 + 20, ay = Y1 - 2;
    rrect(x, ax - 4, ay - 6, 8, 6, 1, '#4a3a2a'); poly(x, [[ax - 11, ay - 12], [ax + 11, ay - 12], [ax + 7, ay - 6], [ax - 7, ay - 6]], lg(x, ax - 11, ay - 12, ax + 11, ay - 6, [[0, '#8a96a4'], [1, '#2f3640']])); poly(x, [[ax + 11, ay - 12], [ax + 17, ay - 10], [ax + 11, ay - 9]], '#6a7682');
  },
  mine(x, W, H, s, o) {
    const Y1 = H - 6, cx = M + W / 2;
    groundShadow(x, M, Y1, W, 14);
    // morro rochoso
    x.fillStyle = lg(x, M, 4, M + W, Y1, [[0, '#9aa3ad'], [1, '#5f6872']]);
    x.beginPath(); x.moveTo(M - 2, Y1); x.quadraticCurveTo(M + 2, 14, cx - 6, 8); x.quadraticCurveTo(cx + 6, 4, M + W - 6, 18); x.quadraticCurveTo(M + W + 2, 36, M + W + 1, Y1); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(30,35,45,0.4)'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(M + 8 + i * 8, 16 + (i % 3) * 5); x.lineTo(M + 12 + i * 8, 28 + (i % 2) * 6); x.stroke(); }
    if (s === 3) poly(x, [[M + 4, 24], [cx - 6, 8], [cx + 6, 5], [M + W - 6, 18], [M + W - 12, 20], [cx, 15], [M + 12, 26]], '#f4f9ff');
    // entrada
    poly(x, [[cx - 13, Y1], [cx - 13, Y1 - 24], [cx - 8, Y1 - 31], [cx + 8, Y1 - 31], [cx + 13, Y1 - 24], [cx + 13, Y1]], '#0d0b0a');
    x.fillStyle = '#6a4a2b'; x.fillRect(cx - 15, Y1 - 31, 3.4, 31); x.fillRect(cx + 11.6, Y1 - 31, 3.4, 31); x.fillRect(cx - 16, Y1 - 33, 32, 3.6);
    // trilhos e vagonete
    x.strokeStyle = '#5a4632'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx - 8, Y1 - 2); x.lineTo(cx - 18, Y1 + 4); x.moveTo(cx + 8, Y1 - 2); x.lineTo(cx + 18, Y1 + 4); x.stroke();
    poly(x, [[cx + 14, Y1 - 12], [cx + 30, Y1 - 12], [cx + 27, Y1 - 3], [cx + 17, Y1 - 3]], '#6a4a2b', '#2a1a0e'); ell(x, cx + 22, Y1 - 13, 7, 2.6, '#8a929c'); ell(x, cx + 17, Y1 - 3, 2.2, 2.2, '#333'); ell(x, cx + 27, Y1 - 3, 2.2, 2.2, '#333');
    o.lights.push({ x: cx - 18, y: Y1 - 24, r: 55, c: '#ffb04a' });
  },
  loom(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 4, WW = W - 8, wallH = 28;
    groundShadow(x, X, Y1, WW, 14); dirtPad(x, M, H - 4, W, 30);
    planks(x, X, Y1 - wallH, WW, wallH, '#c9a672', false);
    x.fillStyle = '#5a3d26'; x.fillRect(X, Y1 - wallH, 3, wallH); x.fillRect(X + WW - 3, Y1 - wallH, 3, wallH);
    door(x, X + 6, Y1, 11, 20); win(x, X + WW - 20, Y1 - 24, 11, 10, o.lights);
    gable(x, X, Y1 - wallH, WW, 22, 5, '#a8503a', s === 3, 5);
    // fardos de lã
    for (const [bx, by] of [[X + WW - 8, Y1 - 2], [X + WW - 2, Y1 - 9]]) { ell(x, bx, by, 7, 5.5, lg(x, bx - 7, by - 5, bx + 7, by + 5, [[0, '#fbfaf5'], [1, '#c9c4b8']])); }
    // ovelha
    ell(x, X + 2, Y1 + 1, 6, 4.6, '#f4f2ea'); ell(x, X - 3, Y1 - 1, 2.6, 2.4, '#3a3532'); x.fillStyle = '#3a3532'; x.fillRect(X - 1, Y1 + 4, 1.2, 3); x.fillRect(X + 4, Y1 + 4, 1.2, 3);
  },
  tavern(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 6, WW = W - 12, wallH = 44;
    groundShadow(x, X, Y1, WW, 18); dirtPad(x, M, H - 4, W, 34);
    stones(x, X, Y1 - 10, WW, 10, '#8f8a82', 8);
    x.fillStyle = '#efe0c0'; x.fillRect(X, Y1 - wallH, WW, wallH - 10);
    // enxaimel
    x.strokeStyle = '#5a3d26'; x.lineWidth = 2.4;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(X + i * WW / 4, Y1 - wallH); x.lineTo(X + i * WW / 4, Y1 - 10); x.stroke(); }
    x.beginPath(); x.moveTo(X, Y1 - wallH + 16); x.lineTo(X + WW, Y1 - wallH + 16); x.moveTo(X, Y1 - wallH); x.lineTo(X + WW, Y1 - wallH); x.stroke();
    x.beginPath(); x.moveTo(X, Y1 - 10); x.lineTo(X + WW / 4, Y1 - wallH + 16); x.moveTo(X + WW, Y1 - 10); x.lineTo(X + WW * 0.75, Y1 - wallH + 16); x.stroke();
    door(x, X + WW / 2 - 8, Y1, 16, 26, '#6a3a22');
    win(x, X + 9, Y1 - 28, 12, 11, o.lights, '#ffb84a'); win(x, X + WW - 21, Y1 - 28, 12, 11, o.lights, '#ffb84a');
    win(x, X + 11, Y1 - wallH + 3, 10, 9, o.lights, '#ffb84a'); win(x, X + WW - 21, Y1 - wallH + 3, 10, 9, o.lights, '#ffb84a');
    o.smoke = chimney(x, X + WW - 14, Y1 - wallH - 12, 8, 18, s === 3);
    gable(x, X, Y1 - wallH, WW, 30, 8, '#8a3f3a', s === 3, 6);
    // placa com caneca
    x.strokeStyle = '#2a2a2a'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(X + WW / 2 + 12, Y1 - 36); x.lineTo(X + WW / 2 + 24, Y1 - 36); x.stroke();
    rrect(x, X + WW / 2 + 15, Y1 - 35, 14, 14, 3, '#6a4328', '#2a1a0e', 0.8); rrect(x, X + WW / 2 + 19, Y1 - 31, 6, 7, 1.5, '#e8c15a'); rrect(x, X + WW / 2 + 19, Y1 - 33, 6, 2.4, 1, '#fff');
    // barris
    for (const bx of [X - 2, X + 6]) { x.fillStyle = lg(x, bx - 5, 0, bx + 5, 0, [[0, '#a07848'], [1, '#6a4a26']]); x.beginPath(); x.roundRect(bx - 5, Y1 - 13, 10, 13, 3); x.fill(); }
  },
  barracks(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 6, WW = W - 12, wallH = 44;
    groundShadow(x, X, Y1, WW, 20); dirtPad(x, M, H - 4, W, 40);
    stones(x, X, Y1 - wallH, WW, wallH, '#9a958e', 21);
    // ameias
    for (let i = 0; i < 9; i++) { x.fillStyle = '#8a857e'; x.fillRect(X + i * (WW / 9) + 1, Y1 - wallH - 7, WW / 9 - 4, 7); }
    // torres laterais
    for (const tx of [X - 4, X + WW - 14]) { stones(x, tx, Y1 - wallH - 14, 18, wallH + 14, '#8a857e', tx); for (let i = 0; i < 3; i++) { x.fillStyle = '#7a756e'; x.fillRect(tx + i * 6.5, Y1 - wallH - 20, 4.4, 6); } x.fillStyle = '#1a1612'; x.fillRect(tx + 7, Y1 - wallH - 4, 4, 11); }
    // portão
    door(x, X + WW / 2 - 11, Y1, 22, 30, '#4a3220'); x.strokeStyle = '#8a929c'; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(X + WW / 2 - 11, Y1 - 24 + i * 7); x.lineTo(X + WW / 2 + 11, Y1 - 24 + i * 7); x.stroke(); }
    bannerFlag(x, X + WW / 2 - 24, Y1 - 8, 24, '#b03a3a'); bannerFlag(x, X + WW / 2 + 24, Y1 - 8, 24, '#b03a3a');
    // boneco de treino + rack
    const dx = X + 14, dy = Y1 + 4;
    x.strokeStyle = '#6a4a2b'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(dx, dy); x.lineTo(dx, dy - 20); x.moveTo(dx - 7, dy - 15); x.lineTo(dx + 7, dy - 15); x.stroke(); ell(x, dx, dy - 22, 4, 4, '#d9c49a'); poly(x, [[dx - 5, dy - 16], [dx + 5, dy - 16], [dx + 4, dy - 6], [dx - 4, dy - 6]], '#a8553a');
    o.lights.push({ x: X + WW / 2, y: Y1 - 14, r: 80, c: '#ffb04a' });
  },
  castle(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 4, WW = W - 8;
    groundShadow(x, X, Y1, WW, 26); dirtPad(x, M, H - 4, W, 50);
    // corpo central
    const kh = 76;
    stones(x, X + 34, Y1 - kh, WW - 68, kh, '#a39e96', 31);
    for (let i = 0; i < 8; i++) { x.fillStyle = '#948f87'; x.fillRect(X + 34 + i * ((WW - 68) / 8) + 1, Y1 - kh - 7, (WW - 68) / 8 - 3.5, 8); }
    // torres
    for (const [tx, th] of [[X, 98], [X + WW - 40, 98], [X + 18, 70], [X + WW - 58, 70]]) {
      const tw = th === 98 ? 40 : 24;
      stones(x, tx, Y1 - th, tw, th, '#98938b', tx);
      poly(x, [[tx - 3, Y1 - th], [tx + tw / 2, Y1 - th - 28], [tx + tw + 3, Y1 - th]], lg(x, tx, Y1 - th - 28, tx + tw, Y1 - th, [[0, '#4a73b8'], [1, '#2a4a80']]), '#1a2a50', 1);
      if (s === 3) poly(x, [[tx - 1, Y1 - th - 1], [tx + tw / 2, Y1 - th - 27], [tx + tw + 1, Y1 - th - 1], [tx + tw / 2 + 5, Y1 - th - 10], [tx + tw / 2 - 5, Y1 - th - 10]], '#f6faff');
      win(x, tx + tw / 2 - 4, Y1 - th + 14, 8, 12, o.lights, '#ffcf6a');
      if (th === 98) bannerFlag(x, tx + tw / 2, Y1 - th - 28, 18, '#c0392b');
    }
    // portão
    x.fillStyle = '#1a1410'; x.beginPath(); x.roundRect(X + WW / 2 - 15, Y1 - 38, 30, 38, [15, 15, 0, 0]); x.fill();
    x.strokeStyle = '#8a929c'; x.lineWidth = 1.6; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(X + WW / 2 - 12 + i * 6, Y1 - 36); x.lineTo(X + WW / 2 - 12 + i * 6, Y1); x.stroke(); } for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(X + WW / 2 - 15, Y1 - 28 + i * 8); x.lineTo(X + WW / 2 + 15, Y1 - 28 + i * 8); x.stroke(); }
    win(x, X + WW / 2 - 24, Y1 - 60, 9, 12, o.lights); win(x, X + WW / 2 + 15, Y1 - 60, 9, 12, o.lights);
    o.lights.push({ x: X + WW / 2, y: Y1 - 20, r: 120, c: '#ffb04a' });
  },
  cathedral(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 4, WW = W - 8, cx = M + W / 2;
    groundShadow(x, X, Y1, WW, 24); dirtPad(x, M, H - 4, W, 46);
    stones(x, X + 8, Y1 - 62, WW - 16, 62, '#d2cdc2', 41);
    gable(x, X + 8, Y1 - 62, WW - 16, 34, 4, '#3f5f8f', s === 3, 6);
    // torre central + agulha
    stones(x, cx - 15, Y1 - 112, 30, 112, '#d8d3c8', 43);
    poly(x, [[cx - 18, Y1 - 112], [cx, Y1 - 150], [cx + 18, Y1 - 112]], lg(x, cx - 18, 0, cx + 18, 0, [[0, '#5a82b8'], [1, '#2c4e80']]), '#1a2a50');
    x.strokeStyle = '#e8c15a'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(cx, Y1 - 150); x.lineTo(cx, Y1 - 160); x.moveTo(cx - 4, Y1 - 156); x.lineTo(cx + 4, Y1 - 156); x.stroke();
    // torres laterais
    for (const tx of [X, X + WW - 16]) { stones(x, tx, Y1 - 82, 16, 82, '#cfcabe', tx); poly(x, [[tx - 2, Y1 - 82], [tx + 8, Y1 - 104], [tx + 18, Y1 - 82]], '#3f5f8f', '#1a2a50'); }
    // rosácea e portal
    ell(x, cx, Y1 - 86, 9.5, 9.5, '#2a2f55'); const gl = rg(x, cx, Y1 - 86, 1, 9, [[0, '#ffe8a0'], [0.5, '#c4506a'], [1, '#3a5ac0']]); ell(x, cx, Y1 - 86, 8, 8, gl);
    x.strokeStyle = '#2a2f55'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; x.beginPath(); x.moveTo(cx, Y1 - 86); x.lineTo(cx + Math.cos(a) * 8, Y1 - 86 + Math.sin(a) * 8); x.stroke(); }
    o.lights.push({ x: cx, y: Y1 - 86, w: 16, h: 16, r: 50, c: '#ffcf8a' });
    x.fillStyle = '#2a1a10'; x.beginPath(); x.roundRect(cx - 11, Y1 - 36, 22, 36, [11, 11, 0, 0]); x.fill(); x.strokeStyle = '#d2cdc2'; x.lineWidth = 2; x.stroke();
    for (const wx of [X + 26, X + WW - 38]) { x.fillStyle = '#2a2f55'; x.beginPath(); x.roundRect(wx, Y1 - 52, 12, 26, [6, 6, 0, 0]); x.fill(); x.fillStyle = lg(x, wx, Y1 - 52, wx, Y1 - 26, [[0, '#e07a8a'], [0.5, '#6a8ae0'], [1, '#e8c15a']]); x.beginPath(); x.roundRect(wx + 1.5, Y1 - 50, 9, 23, [5, 5, 0, 0]); x.fill(); o.lights.push({ x: wx + 6, y: Y1 - 38, w: 9, h: 22, r: 36, c: '#ffcf8a' }); }
  },
  port(x, W, H, s, o) {
    const Y1 = H - 6, X = M;
    dirtPad(x, M, H - 4, W, 30);
    // cais de madeira
    planks(x, X + 4, Y1 - 28, W - 8, 24, '#9c7a52', false);
    for (let i = 0; i < 6; i++) { x.fillStyle = '#4a3220'; x.fillRect(X + 8 + i * ((W - 24) / 5), Y1 - 6, 4, 10); }
    // armazém
    const bw = 60, bx = X + 10;
    planks(x, bx, Y1 - 62, bw, 34, '#b08a5a'); door(x, bx + 8, Y1 - 28, 14, 22, '#5a3a22'); win(x, bx + 34, Y1 - 52, 11, 11, o.lights);
    gable(x, bx, Y1 - 62, bw, 22, 5, '#4a6a8a', s === 3, 4);
    // barco
    const sx = X + W - 40, sy = Y1 - 18;
    x.fillStyle = rgba('#000', 0.15); x.beginPath(); x.ellipse(sx + 4, sy + 6, 34, 6, 0, 0, 7); x.fill();
    poly(x, [[sx - 28, sy - 4], [sx + 30, sy - 4], [sx + 22, sy + 8], [sx - 20, sy + 8]], lg(x, sx, sy - 4, sx, sy + 8, [[0, '#8a5a30'], [1, '#4a2f18']]), '#2a180c');
    x.strokeStyle = '#4a3220'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(sx, sy - 4); x.lineTo(sx, sy - 52); x.stroke();
    poly(x, [[sx + 1, sy - 50], [sx + 24, sy - 12], [sx + 1, sy - 12]], '#f4efe2', '#bdb6a2', 0.8); poly(x, [[sx - 1, sy - 44], [sx - 16, sy - 14], [sx - 1, sy - 14]], '#e8e2d2', '#bdb6a2', 0.8);
    bannerFlag(x, sx, sy - 52, 12, '#e0a82e');
    o.lights.push({ x: bx + 40, y: Y1 - 46, r: 70, c: '#ffcf6a' });
  },
  academy(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 4, WW = W - 8, cx = M + W / 2;
    groundShadow(x, X, Y1, WW, 22); dirtPad(x, M, H - 4, W, 40);
    // base em degraus
    for (let i = 0; i < 3; i++) rrect(x, X + 4 - i * 3, Y1 - 6 + i * 2 - 6, WW - 8 + i * 6, 6, 1, shade('#d9d4c8', -i * 0.06 - 0.02));
    stones(x, X + 10, Y1 - 62, WW - 20, 52, '#e6e1d4', 51);
    // colunas
    for (let i = 0; i < 6; i++) { const px = X + 14 + i * ((WW - 34) / 5); x.fillStyle = lg(x, px, 0, px + 7, 0, [[0, '#f4f0e6'], [0.5, '#fffdf6'], [1, '#c8c2b4']]); x.fillRect(px, Y1 - 62, 7, 52); rrect(x, px - 1.5, Y1 - 64, 10, 4, 1, '#d8d2c4'); rrect(x, px - 1.5, Y1 - 12, 10, 4, 1, '#d8d2c4'); }
    // frontão
    poly(x, [[X + 6, Y1 - 62], [cx, Y1 - 86], [X + WW - 6, Y1 - 62]], lg(x, 0, Y1 - 86, 0, Y1 - 62, [[0, '#f4f0e6'], [1, '#d2ccbd']]), '#aaa294', 1);
    poly(x, [[X + 26, Y1 - 66], [cx, Y1 - 82], [X + WW - 26, Y1 - 66]], '#c9c2b2');
    ell(x, cx, Y1 - 72, 4.5, 4.5, '#e8c15a');
    // domo
    x.fillStyle = lg(x, cx - 18, 0, cx + 18, 0, [[0, '#6a8ae0'], [0.5, '#8ab0f0'], [1, '#4a62b0']]); x.beginPath(); x.arc(cx, Y1 - 88, 18, Math.PI, 0); x.fill();
    rrect(x, cx - 20, Y1 - 90, 40, 4, 1, '#d8d2c4'); x.fillStyle = '#e8c15a'; x.fillRect(cx - 1, Y1 - 112, 2, 8); ell(x, cx, Y1 - 113, 2.6, 2.6, '#ffd84a');
    door(x, cx - 7, Y1 - 6, 14, 28, '#4a3a2a');
    o.lights.push({ x: cx, y: Y1 - 30, r: 90, c: '#ffd890' });
  },
  jeweler(x, W, H, s, o) {
    const Y1 = H - 8, X = M + 4, WW = W - 8, wallH = 34;
    groundShadow(x, X, Y1, WW, 16); dirtPad(x, M, H - 4, W, 30);
    planks(x, X, Y1 - wallH, WW, wallH, '#e3d4c4', false); x.fillStyle = '#5a3d70'; x.fillRect(X, Y1 - wallH, 3, wallH); x.fillRect(X + WW - 3, Y1 - wallH, 3, wallH);
    door(x, X + 10, Y1, 13, 24, '#5a3d70'); win(x, X + WW - 32, Y1 - 28, 20, 14, o.lights, '#ffe0f0');
    gable(x, X, Y1 - wallH, WW, 24, 6, '#6a4890', s === 3, 5);
    // placa joia
    x.strokeStyle = '#2a2a2a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X + WW + 2, Y1 - 28); x.lineTo(X + WW + 10, Y1 - 28); x.stroke();
    poly(x, [[X + WW + 10, Y1 - 26], [X + WW + 6, Y1 - 21], [X + WW + 10, Y1 - 15], [X + WW + 14, Y1 - 21]], '#ff5fae', '#a3185f', 0.8);
  },
  monument(x, W, H, s, o) {
    const cx = M + W / 2, Y1 = H - 6;
    groundShadow(x, M + 4, Y1, W - 8, 16); dirtPad(x, M, H - 4, W, 40);
    for (let i = 0; i < 3; i++) rrect(x, M + 6 + i * 6, Y1 - 8 - i * 7, W - 12 - i * 12, 8, 1.5, shade('#cfc9bc', -i * 0.05), '#8a8478', 0.8);
    poly(x, [[cx - 11, Y1 - 24], [cx + 11, Y1 - 24], [cx + 6, Y1 - 100], [cx, Y1 - 112], [cx - 6, Y1 - 100]], lg(x, cx - 11, 0, cx + 11, 0, [[0, '#f0ece0'], [0.5, '#fffdf6'], [1, '#b8b2a2']]), '#9a9486', 1);
    x.strokeStyle = '#e8c15a'; x.lineWidth = 1.4; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(cx - 7, Y1 - 36 - i * 12); x.lineTo(cx + 7, Y1 - 36 - i * 12); x.stroke(); }
    poly(x, [[cx - 3, Y1 - 112], [cx, Y1 - 120], [cx + 3, Y1 - 112]], '#ffd84a'); o.lights.push({ x: cx, y: Y1 - 90, r: 80, c: '#ffe08a' });
  },
  wonder(x, W, H, s, o) {
    const cx = M + W / 2, Y1 = H - 8, X = M + 4, WW = W - 8;
    groundShadow(x, X, Y1, WW, 30); dirtPad(x, M, H - 4, W, 60);
    for (let i = 0; i < 5; i++) { const w = WW - i * 22, h = 15; rrect(x, cx - w / 2, Y1 - h * (i + 1), w, h, 1.5, lg(x, 0, Y1 - h * (i + 1), 0, Y1 - h * i, [[0, shade('#f1ecdf', -i * 0.03)], [1, shade('#c9c2b0', -i * 0.04)]]), '#8a8478', 0.8); }
    for (let i = 0; i < 6; i++) { const px = cx - 56 + i * 22.4; x.fillStyle = lg(x, px, 0, px + 8, 0, [[0, '#fffdf6'], [1, '#bdb6a4']]); x.fillRect(px, Y1 - 82, 8, 46); }
    rrect(x, cx - 70, Y1 - 88, 140, 7, 2, '#e8c15a'); poly(x, [[cx - 66, Y1 - 88], [cx, Y1 - 120], [cx + 66, Y1 - 88]], lg(x, 0, Y1 - 120, 0, Y1 - 88, [[0, '#f4f0e6'], [1, '#c9c2b0']]), '#8a8478', 1);
    // cristal brilhante
    poly(x, [[cx, Y1 - 160], [cx + 13, Y1 - 135], [cx, Y1 - 112], [cx - 13, Y1 - 135]], lg(x, cx - 13, Y1 - 160, cx + 13, Y1 - 112, [[0, '#fff0ff'], [0.5, '#c88aff'], [1, '#5a43c8']]), '#fff', 1);
    o.lights.push({ x: cx, y: Y1 - 136, r: 190, c: '#c8a0ff', fire: true });
    x.fillStyle = '#1a1410'; x.beginPath(); x.roundRect(cx - 13, Y1 - 52, 26, 38, [13, 13, 0, 0]); x.fill();
  },
};

/** Sprite da construção pronta. Retorna { c, w, h, ox, oy (posição da base no sprite), lights, smoke, fire } */
export function buildingSprite(type, season) {
  const def = BUILDINGS[type];
  if (def.as) { // evolução: sprite do prédio base + distintivo dourado (estrelas por nível) e brilho nos tier 3
    const key2 = type + '_t_' + season;
    if (cache[key2]) return cache[key2];
    const base = buildingSprite(def.as, season);
    const [c, x] = cv(base.w, base.h);
    if (def.tier >= 3) { x.fillStyle = rg(x, base.w / 2, base.h - 10, 4, base.w * 0.6, [[0, 'rgba(255,225,120,0.45)'], [1, 'rgba(255,225,120,0)']]); x.fillRect(0, 0, base.w, base.h); }
    x.drawImage(base.c, 0, 0, base.w, base.h);
    // tonalidade nobre sutil + estrelas
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = def.tier >= 3 ? 'rgba(255,215,90,0.10)' : 'rgba(120,170,255,0.08)'; x.fillRect(0, 0, base.w, base.h); x.globalCompositeOperation = 'source-over';
    for (let i = 0; i < def.tier; i++) { const sx = base.w - 12 - i * 11, sy = 10; poly(x, Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.6 : 5.4; return [sx + Math.cos(a) * r, sy + Math.sin(a) * r]; }), '#ffd84a', '#8a5a00', 0.7); }
    return (cache[key2] = { ...base, c });
  }
  const key = type + '_' + (['farm', 'house', 'shelter'].includes(type) || def.slots || def.era >= 4 || type === 'storehouse' || type === 'mine' || type === 'well' ? season : 0);
  if (cache[key]) return cache[key];
  const W = def.w * TILE;
  const Hh = { campfire: 74, shelter: 72, gatherpoint: 70, house: 100, farm: def.h * TILE + 14, well: 76, sawmill: 90, storehouse: 100, market: 112, smithy: 100, mine: 84, loom: 82, tavern: 120, barracks: 120, castle: 190, cathedral: 220, port: 130, academy: 170, jeweler: 94, monument: 148, wonder: 230 }[type] || def.h * TILE + 40;
  const [c, x] = cv(W + M * 2, Hh);
  const o = { lights: [], smoke: null, fire: null };
  (DRAW[type] || (() => { }))(x, W, Hh, season, o);
  return (cache[key] = { c, w: W + M * 2, h: Hh, ox: M, oy: Hh - 4, ...o });
}

// ---------- Andaime e fundação ----------
export function scaffoldSprite(w, h, vh) {
  const key = `sc${w}_${h}_${vh}`;
  if (cache[key]) return cache[key];
  const W = w * TILE, H = Math.max(vh, 40) + 10;
  const [c, x] = cv(W + M * 2, H);
  const Y1 = H - 6;
  x.lineCap = 'round';
  const poles = Math.max(2, Math.round(W / 36));
  const top = Y1 - Math.min(vh - 16, 100);
  for (let i = 0; i <= poles; i++) {
    const px = M + 3 + i * ((W - 6) / poles);
    x.strokeStyle = '#6a4a2b'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(px, Y1); x.lineTo(px + 1, top); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(px - 0.7, Y1); x.lineTo(px + 0.3, top); x.stroke();
  }
  for (const f of [0.35, 0.7, 1]) {
    const yy = Y1 - (Y1 - top) * f;
    x.strokeStyle = '#8a6a3b'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(M + 2, yy); x.lineTo(M + W - 2, yy); x.stroke();
    if (f < 1) { rrect(x, M + 4, yy - 1, W - 8, 4, 1, '#b48a52', '#6a4a26', 0.6); }
  }
  x.strokeStyle = '#7a5a33'; x.lineWidth = 1.6;
  for (let i = 0; i < poles; i++) { const a = M + 3 + i * ((W - 6) / poles), b = M + 3 + (i + 1) * ((W - 6) / poles); x.beginPath(); x.moveTo(a, Y1); x.lineTo(b, Y1 - (Y1 - top) * 0.7); x.stroke(); }
  return (cache[key] = { c, w: W + M * 2, h: H, ox: M, oy: H - 4 });
}
export function foundationSprite(w, h) {
  const key = `fd${w}_${h}`;
  if (cache[key]) return cache[key];
  const W = w * TILE, D = h * TILE;
  const [c, x] = cv(W + M * 2, D + 16);
  const r = new RNG(w * 7 + h);
  const Y1 = D + 10;
  x.fillStyle = rg(x, M + W / 2, Y1 - D / 2, 2, W * 0.7, [[0, 'rgba(120,92,62,0.9)'], [0.8, 'rgba(120,92,62,0.55)'], [1, 'rgba(120,92,62,0)']]);
  x.beginPath(); x.ellipse(M + W / 2, Y1 - D / 2, W / 2 + 1, D / 2 + 1, 0, 0, 7); x.fill();
  for (let i = 0; i < 40; i++) ell(x, M + r.range(2, W - 2), Y1 - r.range(2, D - 2), r.range(1, 2.2), r.range(0.6, 1.3), r.pick(['#8a6d4a', '#6a5236', '#a08560']));
  // pedras de canto + estacas com corda
  const corners = [[M + 4, Y1 - D + 4], [M + W - 4, Y1 - D + 4], [M + 4, Y1 - 4], [M + W - 4, Y1 - 4]];
  x.strokeStyle = '#d8c9a0'; x.lineWidth = 1; x.setLineDash([3, 2]); x.strokeRect(M + 4, Y1 - D + 4, W - 8, D - 8); x.setLineDash([]);
  for (const [px, py] of corners) { x.strokeStyle = '#6a4a2b'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 9); x.stroke(); ell(x, px, py + 1, 4, 2.4, '#8a929c'); }
  return (cache[key] = { c, w: W + M * 2, h: D + 16, ox: M, oy: D + 12 });
}
