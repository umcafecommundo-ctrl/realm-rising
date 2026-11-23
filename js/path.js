// path.js — A* em grade para movimentação dos moradores

import { MAP_W, MAP_H, TILE } from './data.js';

const SQ = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ], [-1, 1, SQ], [1, -1, SQ], [-1, -1, SQ]];

// Heap binário mínimo
class Heap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = i * 2 + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top[1]; }
  get size() { return this.a.length; }
}

const G = new Float32Array(MAP_W * MAP_H);
const FROM = new Int32Array(MAP_W * MAP_H);
const SEEN = new Int32Array(MAP_W * MAP_H);
let stamp = 0;

function nearestFree(bl, tx, ty) {
  if (!bl[ty * MAP_W + tx]) return [tx, ty];
  for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = tx + dx, y = ty + dy;
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !bl[y * MAP_W + x]) return [x, y];
  }
  return null;
}

/** Retorna lista de pontos em pixels do mundo, ou null. Coordenadas de entrada em pixels. */
export function findPath(s, sx, sy, tx, ty) {
  const bl = s._blocked;
  if (!bl) return null;
  let x0 = Math.max(0, Math.min(MAP_W - 1, Math.floor(sx / TILE))), y0 = Math.max(0, Math.min(MAP_H - 1, Math.floor(sy / TILE)));
  const s0 = nearestFree(bl, x0, y0); if (!s0) return null; [x0, y0] = s0;
  const gx0 = Math.max(0, Math.min(MAP_W - 1, Math.floor(tx / TILE))), gy0 = Math.max(0, Math.min(MAP_H - 1, Math.floor(ty / TILE)));
  const g = nearestFree(bl, gx0, gy0); if (!g) return null;
  const [gx, gy] = g;
  if (x0 === gx && y0 === gy) return [{ x: tx, y: ty }];
  stamp++;
  const open = new Heap();
  const start = y0 * MAP_W + x0, goal = gy * MAP_W + gx;
  G[start] = 0; FROM[start] = -1; SEEN[start] = stamp;
  open.push(start, 0);
  let steps = 0, found = false;
  while (open.size && steps++ < 2600) {
    const cur = open.pop();
    if (cur === goal) { found = true; break; }
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    for (const [dx, dy, c] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (bl[ni]) continue;
      if (dx && dy && (bl[cy * MAP_W + nx] || bl[ny * MAP_W + cx])) continue; // sem cortar quinas
      const ng = G[cur] + c;
      if (SEEN[ni] !== stamp || ng < G[ni]) {
        SEEN[ni] = stamp; G[ni] = ng; FROM[ni] = cur;
        const h = Math.hypot(gx - nx, gy - ny);
        open.push(ni, ng + h * 1.05);
      }
    }
  }
  if (!found) return null;
  const pts = [];
  let c = goal;
  while (c !== -1 && c !== start) { pts.push({ x: ((c % MAP_W) + 0.5) * TILE, y: (((c / MAP_W) | 0) + 0.5) * TILE }); c = FROM[c]; }
  pts.reverse();
  // Último ponto: o alvo exato se estiver livre
  if (!bl[gy0 * MAP_W + gx0]) pts.push({ x: tx, y: ty });
  return pts;
}
