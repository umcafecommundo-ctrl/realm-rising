// util.js — funções utilitárias puras (matemática, ruído, cores, RNG, nomes)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const chance = p => Math.random() < p;
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Hash determinístico 2D → [0,1) */
export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruído de valor suave */
export function noise2(x, y, s = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
export function fbm(x, y, s = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += noise2(x * f, y * f, s + i * 17) * amp; tot += amp; amp *= 0.5; f *= 2; }
  return v / tot;
}

/** RNG semeado (mulberry32) usado para gerar o mapa de forma reproduzível */
export class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
}

// ---------- Cores ----------
export function hexToRgb(h) {
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
/** Clareia (f>0) ou escurece (f<0) uma cor hex */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return f >= 0 ? rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
    : rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ---------- Formatação ----------
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
export const fmt1 = n => (Math.round(n * 10) / 10).toString();
export function fmtDur(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : m > 0 ? `${m}min` : `${sec}s`;
}

// ---------- Nomes ----------
export const NAMES_M = ['Tomás', 'Rui', 'Bento', 'Caio', 'Dário', 'Élio', 'Fausto', 'Gil', 'Hugo', 'Ivo', 'Jonas', 'Leandro', 'Mateus', 'Nuno', 'Osório', 'Paulo', 'Remo', 'Salvador', 'Tiago', 'Ulisses', 'Vasco', 'Xavier', 'Ambrósio', 'Bruno', 'Cândido', 'Davi', 'Eurico', 'Flávio', 'Gaspar', 'Heitor', 'Inácio', 'Júlio', 'Lucas', 'Murilo', 'Noé', 'Otávio'];
export const NAMES_F = ['Joana', 'Alda', 'Bia', 'Clara', 'Dora', 'Elisa', 'Frida', 'Gema', 'Helena', 'Inês', 'Jade', 'Lia', 'Maria', 'Nina', 'Olívia', 'Paula', 'Rita', 'Sara', 'Teresa', 'Úrsula', 'Vera', 'Zélia', 'Aurora', 'Beatriz', 'Cecília', 'Débora', 'Estela', 'Flora', 'Graça', 'Hilda', 'Íris', 'Laura', 'Mirela', 'Nair', 'Ofélia', 'Pia'];
export const SURNAMES = ['da Mata', 'do Rio', 'Pedreira', 'do Vale', 'Ferraz', 'Campos', 'da Serra', 'Lenha', 'Moura', 'Brandão', 'Linhares', 'Teixeira', 'Duarte', 'Sousa', 'Araújo', 'Rocha'];
export const randName = female => pick(female ? NAMES_F : NAMES_M);
