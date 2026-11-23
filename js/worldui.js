// worldui.js — interface do mapa-múndi, diplomacia, comércio, exército e visualizador de batalhas

import { DAY_LEN, RES, UNITS, TECHS } from './data.js';
import { WW, WH, HOME, tileAt, kingdomById, PERS, diploActions, doDiplo, canScout, sendScout, travelDays, dist } from './world.js';
import { unitCounts, armyPower, canTrain, trainEnqueue, recruitsFree, attackInfo, launchAttack, UT } from './war.js';
import { defensePower, soldiersOf, toast, bus } from './core.js';
import { countB, timeInfo, hasTech } from './state.js';
import { esc, rimg, costHTML } from './panels.js';
import { rnd, hash2, fbm, shade, rgba } from './util.js';

const TCOL = { sea: '#2f77a8', plains: '#8cc063', forest: '#4f8f45', hills: '#b9a56a', mountain: '#8d8f98' };

export class WorldUI {
  constructor(ui) { this.ui = ui; this.sub = 'map'; this.sel = null; this.frac = 0.6; this.last = ''; }
  mount(body) {
    body.innerHTML = `<div class="pills" id="w-tabs"></div><div id="w-body"></div>`;
    this.tabs = body.querySelector('#w-tabs'); this.body = body.querySelector('#w-body');
    this.canvas = null; this.last = '';
    body.onclick = e => this.click(e);
    body.oninput = e => { if (e.target.id === 'w-frac') { this.frac = e.target.value / 100; const l = body.querySelector('#w-fraclbl'); if (l) l.textContent = Math.round(this.frac * 100) + '%'; } };
  }
  act(s) { return s; }
  update(s) {
    const subs = [['map', '🗺️ Mapa'], ['k', '👑 Reinos'], ['army', '⚔️ Exército'], ['trade', '🐪 Comércio']];
    const th = subs.map(([k, n]) => `<button class="pill ${this.sub === k ? 'on' : ''}" data-w="sub:${k}">${n}</button>`).join('');
    if (this.tabs.innerHTML !== th) this.tabs.innerHTML = th;
    if (this.sub === 'map') this.updateMap(s); else {
      this.canvas = null;
      const html = this.sub === 'k' ? this.kingdoms(s) : this.sub === 'army' ? this.army(s) : this.trade(s);
      if (html !== this.last) { this.last = html; const sc = this.body.parentElement.scrollTop; this.body.innerHTML = html; this.body.parentElement.scrollTop = sc; }
    }
  }
  // ---------- Mapa ----------
  updateMap(s) {
    if (!this.canvas || !this.body.contains(this.canvas)) {
      this.body.innerHTML = `<canvas class="worldcv" id="w-cv"></canvas><div id="w-info" style="margin-top:8px"></div><div class="help" style="margin-top:8px">Toque em uma região para explorar ou atacar. A névoa cobre o que você ainda não viu. Batedores custam 8 comida e levam um morador por alguns dias.</div>`;
      this.canvas = this.body.querySelector('#w-cv'); this.info = this.body.querySelector('#w-info');
      this.canvas.addEventListener('click', e => { const r = this.canvas.getBoundingClientRect(); const tx = Math.floor((e.clientX - r.left) / r.width * WW), ty = Math.floor((e.clientY - r.top) / r.height * WH); this.sel = { x: tx, y: ty }; this.last = ''; this.drawInfo(this.ui.game.s); });
    }
    const cw = Math.min(520, this.body.clientWidth || 400);
    const ch = Math.round(cw * WH / WW);
    if (this.canvas.width !== cw * 2) { this.canvas.width = cw * 2; this.canvas.height = ch * 2; this.canvas.style.height = ch + 'px'; }
    this.draw(s);
    this.drawInfo(s);
  }
  draw(s) {
    const w = s.world, c = this.canvas, x = c.getContext('2d');
    const T = c.width / WW, now = performance.now() / 1000;
    x.clearRect(0, 0, c.width, c.height);
    for (const t of w.tiles) {
      const px = t.x * T, py = t.y * T;
      if (!t.rev) { x.fillStyle = '#1a2630'; x.fillRect(px, py, T + 1, T + 1); x.fillStyle = 'rgba(255,255,255,0.03)'; for (let i = 0; i < 3; i++) x.fillRect(px + hash2(t.x, t.y, i) * T, py + hash2(t.y, t.x, i + 4) * T, 3, 3); continue; }
      x.fillStyle = TCOL[t.t]; x.fillRect(px, py, T + 1, T + 1);
      const sh = hash2(t.x, t.y, 3);
      if (t.t === 'sea') { x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px + T * 0.2, py + T * (0.4 + 0.1 * Math.sin(now + t.x))); x.quadraticCurveTo(px + T * 0.4, py + T * 0.3, px + T * 0.6, py + T * 0.4); x.stroke(); }
      else if (t.t === 'forest') { for (let i = 0; i < 4; i++) { const tx = px + (0.2 + 0.2 * i) * T, ty = py + (0.4 + 0.35 * hash2(i, t.x + t.y, 1)) * T; x.fillStyle = '#2f6a35'; x.beginPath(); x.moveTo(tx, ty - T * 0.28); x.lineTo(tx + T * 0.12, ty); x.lineTo(tx - T * 0.12, ty); x.fill(); } }
      else if (t.t === 'hills') { x.fillStyle = 'rgba(80,60,30,0.3)'; x.beginPath(); x.arc(px + T * 0.4, py + T * 0.7, T * 0.3, Math.PI, 0); x.arc(px + T * 0.75, py + T * 0.72, T * 0.22, Math.PI, 0); x.fill(); }
      else if (t.t === 'mountain') { x.fillStyle = '#6a6c76'; x.beginPath(); x.moveTo(px + T * 0.1, py + T * 0.85); x.lineTo(px + T * 0.4, py + T * 0.2); x.lineTo(px + T * 0.65, py + T * 0.85); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(px + T * 0.4, py + T * 0.2); x.lineTo(px + T * 0.5, py + T * 0.38); x.lineTo(px + T * 0.3, py + T * 0.38); x.fill(); }
      x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1; x.strokeRect(px, py, T, T);
    }
    // territórios
    for (const t of w.tiles) {
      if (!t.rev || t.owner == null) continue;
      const col = t.owner === 'player' ? '#f2c14e' : (kingdomById(s, t.owner)?.color || '#888');
      x.fillStyle = rgba(col, 0.28); x.fillRect(t.x * T, t.y * T, T, T);
      x.strokeStyle = col; x.lineWidth = 2.4; x.strokeRect(t.x * T + 1.5, t.y * T + 1.5, T - 3, T - 3);
      x.font = `${T * 0.5}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (t.cap) x.fillText('🏰', (t.x + 0.5) * T, (t.y + 0.55) * T);
    }
    // pontos de interesse
    for (const t of w.tiles) {
      if (!t.rev || !t.poi || t.owner === 'player') continue;
      const ic = { camp: '⛺', iron: '⛏️', fertile: '🌾', lumber: '🪵', quarry: '🪨', ruins: t.poi.looted ? '🏚️' : '🏛️', gold: '🪙' }[t.poi.type];
      x.font = `${T * 0.5}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ic, (t.x + 0.5) * T, (t.y + 0.55) * T);
    }
    for (const tr of s.territories) { x.font = `${T * 0.5}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🚩', (tr.x + 0.5) * T, (tr.y + 0.55) * T); }
    // base
    x.font = `${T * 0.62}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🏕️', (HOME.x + 0.5) * T, (HOME.y + 0.5) * T);
    // viajantes: batedores, caravanas e marchas
    const dot = (px, py, col, ic) => { x.fillStyle = col; x.beginPath(); x.arc(px, py, T * 0.15, 0, 7); x.fill(); x.font = `${T * 0.34}px serif`; x.fillText(ic, px, py - T * 0.28); };
    for (const sc of w.scouts) { const f = Math.min(1, (s.t - (sc.arrive - travelDays(sc.x, sc.y) * DAY_LEN)) / (travelDays(sc.x, sc.y) * DAY_LEN)); const g = sc.done ? 1 - Math.min(1, (s.t - sc.arrive) / (sc.back - sc.arrive)) : f; dot(((HOME.x + (sc.x - HOME.x) * g) + 0.5) * T, ((HOME.y + (sc.y - HOME.y) * g) + 0.5) * T, '#fff', '🧭'); }
    for (const ca of w.caravans) { const k = kingdomById(s, ca.k); const g = Math.min(1, (s.t - ca.sent) / (ca.at - ca.sent)); dot(((k.cap.x + (HOME.x - k.cap.x) * g) + 0.5) * T, ((k.cap.y + (HOME.y - k.cap.y) * g) + 0.5) * T, '#e0a82e', '🐪'); }
    for (const m of w.marches) { const d = (m.arrive - m.depart); const g = m.returning ? 1 - Math.min(1, (s.t - m.arrive) / Math.max(1, m.back - m.arrive)) : Math.min(1, (s.t - m.depart) / d); dot(((HOME.x + (m.tx - HOME.x) * g) + 0.5) * T, ((HOME.y + (m.ty - HOME.y) * g) + 0.5) * T, '#e85a4a', '⚔️'); }
    if (this.sel) { x.strokeStyle = '#fff'; x.lineWidth = 3; x.setLineDash([6, 4]); x.lineDashOffset = -now * 12; x.strokeRect(this.sel.x * T + 2, this.sel.y * T + 2, T - 4, T - 4); x.setLineDash([]); }
  }
  drawInfo(s) {
    const w = s.world, sel = this.sel;
    let h = '';
    if (!sel) h = '<div class="sub" style="color:#a9b5a3">Selecione uma região no mapa.</div>';
    else {
      const t = tileAt(w, sel.x, sel.y);
      if (!t) return;
      const tn = { sea: 'Mar', plains: 'Planície', forest: 'Floresta', hills: 'Colinas', mountain: 'Montanhas' }[t.t];
      if (!t.rev) {
        const why = canScout(s, sel.x, sel.y);
        h = `<div class="krow" style="border-color:#555"><div class="kh"><b>Região desconhecida</b><span class="tag">fora do mapa</span></div><div class="sub">Distância: ${travelDays(sel.x, sel.y).toFixed(1)} dias de viagem.</div>
          <div class="acts"><button class="btn pri ${why ? 'dis' : ''}" data-w="scout:${sel.x}:${sel.y}">🧭 Enviar batedor</button></div>${why ? `<div class="sub" style="color:#ffb3a8;margin-top:4px">${why}</div>` : ''}</div>`;
      } else {
        let title = tn, extra = '', acts = '';
        if (t.owner === 'player') title = t.x === HOME.x && t.y === HOME.y ? 'Seu reino' : 'Território conquistado';
        else if (typeof t.owner === 'number') { const k = kingdomById(s, t.owner); title = `${t.cap ? 'Capital de' : 'Província de'} ${k.name}`; }
        else if (t.poi) title = t.poi.name;
        const ai = attackInfo(s, sel.x, sel.y);
        if (ai) {
          const mine = armyPower(unitCounts(s));
          extra = `<div class="sub">Defesa estimada: <b>${ai.power}</b> · Seu exército: <b>${mine}</b> · Marcha: ${(travelDays(sel.x, sel.y) * 0.8).toFixed(1)} dias</div>`;
          const can = soldiersOf(s).length >= 2 && countB(s, 'barracks');
          acts = `<div style="margin:8px 0 2px;font-size:12px">Enviar <b id="w-fraclbl">${Math.round(this.frac * 100)}%</b> dos soldados</div><input type="range" id="w-frac" min="25" max="100" step="25" value="${Math.round(this.frac * 100)}" style="width:100%">
            <div class="acts"><button class="btn bad ${can ? '' : 'dis'}" data-w="attack:${sel.x}:${sel.y}">⚔️ Atacar</button></div>${can ? '' : '<div class="sub" style="color:#ffb3a8">Precisa de quartel e 2+ soldados.</div>'}`;
        } else if (t.poi && t.poi.type === 'ruins') extra = `<div class="sub">${t.poi.looted ? 'Já saqueado pelos seus batedores.' : 'Antigas ruínas...'}</div>`;
        if (t.owner === 'player' && s.territories.find(q => q.x === t.x && q.y === t.y)) { const y = s.territories.find(q => q.x === t.x && q.y === t.y).yield; extra = `<div class="sub">Rende por dia: ${Object.entries(y).map(([r, v]) => `+${v} ${RES[r].name}`).join(', ')}</div>`; }
        h = `<div class="krow" style="border-color:${t.owner === 'player' ? '#f2c14e' : typeof t.owner === 'number' ? kingdomById(s, t.owner).color : '#666'}"><div class="kh"><b>${title}</b><span class="tag">${tn}</span></div>${extra}${acts}</div>`;
      }
    }
    if (this._info !== h) { this._info = h; this.info.innerHTML = h; }
  }
  // ---------- Reinos ----------
  kingdoms(s) {
    const mine = armyPower(unitCounts(s)) + defensePower(s) * 0.5;
    let h = '';
    const ks = s.world.kingdoms;
    if (!ks.some(k => k.known)) h += '<div class="help">Você ainda não conhece nenhum reino. Envie batedores pelo mapa para encontrá-los!</div>';
    for (const k of ks) {
      if (!k.known) { h += `<div class="krow" style="border-color:#444;opacity:.5"><b>??? Reino desconhecido</b></div>`; continue; }
      const rel = Math.round(k.rel);
      const tags = [k.vassal ? '<span class="tag y">Vassalo</span>' : '', k.war ? '<span class="tag r">GUERRA</span>' : '', k.treaty.alliance ? '<span class="tag g">Aliança</span>' : k.treaty.peace ? '<span class="tag b">Paz</span>' : '', k.treaty.trade ? '<span class="tag y">Comércio</span>' : ''].join(' ');
      const ratio = k.str / Math.max(5, mine);
      const cmp = ratio > 1.3 ? '<span class="tag r">Mais forte</span>' : ratio < 0.7 ? '<span class="tag g">Mais fraco</span>' : '<span class="tag y">Equilibrado</span>';
      h += `<div class="krow" style="border-color:${k.color}"><div class="kh"><b>${k.name}</b><span>${tags}</span></div>
        <div class="sub">${PERS[k.pers].icon} ${PERS[k.pers].name} · ${k.ruler} · ${cmp} <span style="color:#a9b5a3">(força ≈ ${Math.round(k.str)})</span></div>
        <div class="relbar"><i style="left:${(rel + 100) / 2}%"></i></div><div class="sub">Relação: ${rel > 40 ? 'amistosa' : rel > 0 ? 'cordial' : rel > -40 ? 'fria' : 'hostil'} (${rel})</div>
        <div class="acts">${diploActions(s, k).map(a => `<button class="btn ${a.danger ? 'bad' : ''} ${a.ok ? '' : 'dis'}" data-tip="${a.hint}" data-w="diplo:${k.id}:${a.id}">${a.label}</button>`).join('')}</div></div>`;
    }
    return h || '<p>Nada ainda.</p>';
  }
  // ---------- Exército ----------
  army(s) {
    const u = unitCounts(s); const sol = soldiersOf(s); const d = s._d;
    let h = `<div class="statgrid"><div class="stat"><small>Soldados</small><b>${sol.length}/${d.soldierCap}</b></div><div class="stat"><small>Poder do exército</small><b>${armyPower(u)}</b></div><div class="stat"><small>Defesa total</small><b>${Math.round(defensePower(s))}</b></div><div class="stat"><small>Muralhas+castelo</small><b>${d.defense}</b></div></div>`;
    if (!countB(s, 'barracks')) return h + '<div class="help">Construa um <b>Quartel</b> (era Cidade + Tática Militar) para treinar tropas. Atribua moradores como <b>Soldado</b> na aba Trabalho.</div>';
    h += `<div class="sec">Unidades</div>`;
    for (const [id, un] of Object.entries(UNITS)) {
      const have = u[id] || 0;
      const why = id === 'recruta' ? null : canTrain(s, id);
      h += `<div class="unitrow"><span class="ic">${un.icon}</span><div class="grow" style="flex:1"><b style="font-size:13px">${un.name}</b> <span class="tag">${have}</span><div class="sub" style="font-size:11px;color:#a9b5a3">HP ${un.hp} · Ataque ${un.atk}${un.counter ? ` · forte contra ${UNITS[un.counter].name}` : ''}${un.siege ? ' · cerco' : ''}</div>${id !== 'recruta' ? costHTML(un.cost, s) : ''}</div>
        ${id === 'recruta' ? '' : `<button class="btn pri ${why ? 'dis' : ''}" data-tip="${why || 'Treinar 1 unidade'}" data-w="train:${id}">Treinar</button>`}</div>`;
    }
    if (s.army.queue.length) h += `<div class="sec">Fila de treino</div>` + s.army.queue.map(q => `<div class="unitrow"><span class="ic">${UNITS[q.unit].icon}</span><div style="flex:1"><div class="bar"><span style="width:${q.t / q.dur * 100}%"></span></div></div></div>`).join('');
    h += `<div class="help" style="margin-top:10px">Recrutas livres: ${Math.max(0, recruitsFree(s))}. Lanceiros vencem cavaleiros, cavaleiros vencem arqueiros, arqueiros vencem lanceiros. Muralhas e castelo aumentam a vida dos defensores. Ataque pelo mapa-múndi.</div>`;
    const bl = (s.battleLog || []).slice(-4).reverse();
    if (bl.length) h += `<div class="sec">Últimas batalhas</div>` + bl.map(b => `<div class="row"><span>${b.win ? '🏆' : '💀'}</span><div class="grow"><div class="nm">${esc(b.title)}</div><div class="sub">${esc(b.lines.join(' '))}</div></div></div>`).join('');
    return h;
  }
  // ---------- Comércio ----------
  trade(s) {
    const w = s.world;
    let h = '';
    if (!countB(s, 'market')) h += '<div class="help">Construa um <b>Mercado</b> (pesquise Comércio) para estabelecer rotas comerciais. Reinos comerciantes propõem acordos por conta própria.</div>';
    const act = w.routes.filter(r => r.active);
    h += `<div class="sec">Rotas comerciais (${act.length})</div>`;
    for (const r of act) {
      const k = kingdomById(s, r.k);
      h += `<div class="krow" style="border-color:${k.color}"><div class="kh"><b>${k.name}</b><button class="btn bad" data-w="route-x:${r.id}">Cancelar</button></div>
        <div class="sub">A cada ${r.every} dias: envia ${r.give.amt} ${RES[r.give.res].name} → recebe ${r.get.amt} ${RES[r.get.res].name}</div></div>`;
    }
    if (!act.length) h += '<p style="color:#a9b5a3;font-size:13px">Nenhuma rota ativa. Proponha uma na aba Reinos.</p>';
    h += `<div class="sec">Caravanas em trânsito (${w.caravans.length})</div>` + (w.caravans.map(c => `<div class="row"><span>🐪</span><div class="grow"><div class="nm">${kingdomById(s, c.k)?.name}</div><div class="sub">Chega em ${Math.max(0, (c.at - s.t) / DAY_LEN).toFixed(1)} dias</div></div></div>`).join('') || '<p style="color:#a9b5a3;font-size:13px">Nenhuma.</p>');
    return h;
  }
  click(e) {
    const el = e.target.closest('[data-w]'); if (!el) return;
    const [a, p1, p2] = el.dataset.w.split(':'); const s = this.ui.game.s;
    if (a === 'sub') { this.sub = p1; this.last = ''; this.canvas = null; this._info = ''; this.update(s); }
    else if (a === 'scout') { const why = sendScout(s, +p1, +p2); if (why) toast(s, why, 'bad', '🧭'); else { toast(s, 'Batedor enviado!', 'good', '🧭'); this.sel = null; } this._info = ''; }
    else if (a === 'attack') { const why = launchAttack(s, +p1, +p2, this.frac); if (why) toast(s, why, 'bad', '⚔️'); else toast(s, 'Tropas em marcha!', 'gold', '⚔️'); this._info = ''; }
    else if (a === 'diplo') { const k = kingdomById(s, +p1); const m = doDiplo(s, k, p2); if (m) toast(s, m, 'info', '🕊️'); this.last = ''; this.update(s); }
    else if (a === 'train') { if (trainEnqueue(s, p1)) toast(s, `${UNITS[p1].name} em treinamento`, 'good', UNITS[p1].icon); this.last = ''; this.update(s); }
    else if (a === 'route-x') { const r = s.world.routes.find(x => x.id === +p1); if (r) { r.active = false; const k = kingdomById(s, r.k); if (k) k.treaty.trade = false; } this.last = ''; this.update(s); }
  }
}

// ---------- Visualizador de batalha ----------
export function battleHTML(rep) {
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  return `<div class="modal"><h2><span class="big">${rep.win ? '🏆' : '💀'}</span><span>${esc(rep.title)}</span></h2>
    <canvas class="battlecv" id="battle-cv"></canvas>
    <div id="battle-log" style="min-height:44px;font-size:13px;margin:8px 0;color:#d9e2d3"></div>
    <div class="statgrid"><div class="stat"><small>${esc(rep.dName)}</small><b>${sum(rep.d0)}</b></div><div class="stat"><small>${esc(rep.aName)}</small><b>${sum(rep.a0)}</b></div></div>
    <button class="btn pri" id="battle-skip" style="width:100%">Pular animação</button></div>`;
}
export function runBattle(root, rep, done) {
  const cv = root.querySelector('#battle-cv'), log = root.querySelector('#battle-log'), skip = root.querySelector('#battle-skip');
  const dpr = 2; const w = cv.clientWidth || 520, h = 190; cv.width = w * dpr; cv.height = h * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  // lado esquerdo = defensores (ou seu exército em ataque); direito = atacantes/inimigos
  const left = rep.kind === 'defesa' ? { u: rep.d0, snaps: rep.rounds.map(r => r.d), col: '#3a78c8' } : { u: rep.a0, snaps: rep.rounds.map(r => r.a), col: '#3a78c8' };
  const right = rep.kind === 'defesa' ? { u: rep.a0, snaps: rep.rounds.map(r => r.a), col: '#c0392b' } : { u: rep.d0, snaps: rep.rounds.map(r => r.d), col: '#c0392b' };
  const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
  const scale = Math.max(1, Math.ceil(Math.max(tot(left.u), tot(right.u)) / 26));
  const figs = side => { const f = []; for (const t in side.u) for (let i = 0; i < Math.ceil(side.u[t] / scale); i++) f.push({ t, i: f.length }); return f; };
  left.f = figs(left); right.f = figs(right);
  const t0 = performance.now(); let stop = false;
  const R = rep.rounds.length - 1, RT = 1000;
  const sparks = [];
  function alive(side, r) { const o = {}; const sn = side.snaps[Math.min(r, R)]; const out = []; for (const t in side.u) { const n = Math.ceil((sn[t] || 0) / scale); let k = 0; for (const f of side.f) if (f.t === t && k < n) { out.push(f); k++; } } return new Set(out); }
  function frame() {
    if (stop) return;
    const el = performance.now() - t0, r = Math.min(R, Math.floor(el / RT)), fr = (el % RT) / RT;
    x.clearRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fd0a0'); g.addColorStop(1, '#5f9a48'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(40,90,40,0.15)'; x.fillRect(hash2(i, 1, 1) * w, 30 + hash2(i, 2, 2) * (h - 30), 10, 2); }
    const aliveL = alive(left, r), aliveR = alive(right, r);
    const engaged = r < R && fr < 0.9;
    const drawSide = (side, alv, dir) => {
      side.f.forEach((f, idx) => {
        const row = idx % 6, col = Math.floor(idx / 6);
        const base = dir < 0 ? w * 0.5 - 40 - col * 22 : w * 0.5 + 40 + col * 22;
        const lunge = engaged ? Math.max(0, Math.sin((fr * 3 + idx * 0.37) * Math.PI)) * 22 : 0;
        const px = base + dir * -1 * lunge * -1 + (dir < 0 ? lunge : -lunge) - (engaged ? 0 : 0) * 0;
        const py = 40 + row * 24 + (col % 2) * 8;
        const dead = !alv.has(f);
        if (dead) { const lay = x; lay.save(); lay.globalAlpha = 0.5; lay.translate(px, py); lay.rotate(1.5); lay.fillStyle = shade(side.col, -0.3); lay.fillRect(-4, -8, 8, 12); lay.restore(); return; }
        x.save(); x.translate(px, py); x.scale(-dir, 1);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(0, 10, 7, 2.6, 0, 0, 7); x.fill();
        const big = f.t === 'knight' || f.t === 'catapult';
        x.fillStyle = side.col; x.beginPath(); x.roundRect(-4, -6, 8, 13, 3); x.fill();
        x.fillStyle = '#f1c9a0'; x.beginPath(); x.arc(0, -10, 4, 0, 7); x.fill();
        x.fillStyle = '#6a6a74'; x.beginPath(); x.arc(0, -11, 4.2, Math.PI, 0); x.fill();
        if (f.t === 'spear' || f.t === 'recruta' || f.t === 'bandit') { x.strokeStyle = '#7a5a33'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(5, 8); x.lineTo(8, -16); x.stroke(); x.fillStyle = '#d8dee4'; x.fillRect(7, -19, 3, 5); }
        else if (f.t === 'archer') { x.strokeStyle = '#7a5a33'; x.lineWidth = 1.4; x.beginPath(); x.arc(6, -2, 7, -1.2, 1.2); x.stroke(); }
        else if (f.t === 'knight') { x.fillStyle = '#8a6a4a'; x.beginPath(); x.ellipse(0, 9, 12, 6, 0, 0, 7); x.fill(); }
        else if (f.t === 'wolf') { x.fillStyle = '#6a6a74'; x.beginPath(); x.ellipse(0, 4, 9, 5, 0, 0, 7); x.fill(); }
        else if (f.t === 'catapult') { x.fillStyle = '#7a5a33'; x.fillRect(-9, 2, 18, 6); }
        x.restore();
        if (engaged && Math.random() < 0.01) sparks.push({ x: w / 2 + rnd(-14, 14), y: py, t: 0 });
      });
    };
    drawSide(left, aliveL, -1); drawSide(right, aliveR, 1);
    for (const sp of sparks) { sp.t += 0.03; x.fillStyle = `rgba(255,230,140,${1 - sp.t})`; x.beginPath(); x.arc(sp.x + Math.sin(sp.t * 20) * 4, sp.y - sp.t * 30, 2.4 * (1 - sp.t), 0, 7); x.fill(); }
    while (sparks.length && sparks[0].t > 1) sparks.shift();
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.roundRect(w / 2 - 38, 6, 76, 20, 8); x.fill(); x.fillStyle = '#fff'; x.font = '700 12px system-ui'; x.textAlign = 'center'; x.fillText(r >= R ? 'Fim' : `Rodada ${r + 1}`, w / 2, 20);
    if (r >= R && el > (R + 0.6) * RT) { finish(); return; }
    requestAnimationFrame(frame);
  }
  function finish() {
    stop = true;
    log.innerHTML = `<div class="verdict ${rep.win ? 'prosperou' : 'crise'}">${rep.win ? '🏆 Vitória!' : '💀 Derrota...'}</div>` + rep.lines.map(l => `<div class="ll">${esc(l)}</div>`).join('');
    skip.textContent = 'Continuar'; skip.onclick = done;
  }
  skip.onclick = () => { if (!stop) finish(); else done(); };
  requestAnimationFrame(frame);
}
