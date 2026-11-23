// ui.js — HUD, abas, objetivos/alertas, inspetor, modo de construção, modais (eventos, relatório offline, eras), toasts e tooltips

import { RES, RES_ORDER, BUILDINGS, JOBS, ERAS, SEASONS, SEASON_ICON, TILE, POLICIES, DAY_LEN, TECHS, ADULT_AGE, UNITS } from './data.js';
import { timeInfo, jobUnlocked, unlocked, countB, hasTech, serialize, bdef } from './state.js';
import { bus, capOf, avgJoy, foodDays, costStr, canAfford } from './core.js';
import { canPlace, placeBuilding, adjustJob, setPolicy, startResearch, startFestival, eraStatus, advanceEra, getAlerts, demolish, setJob, jobCounts } from './sim.js';
import { eventView, chooseOption } from './events.js';
import { activeQuests, longGoal, QUESTS } from './quests.js';
import { iconURL } from './art.js';
import { buildPanel, peoplePanel, jobsPanel, policyPanel, techPanel, chroniclePanel, achievementsPanel, esc, rimg, costHTML, taskText, needsMini, ageText } from './panels.js';
import { WorldUI, battleHTML, runBattle } from './worldui.js';
import { fmt, fmt1, fmtDur } from './util.js';

const $ = id => document.getElementById(id);
const TABS = [
  { id: 'build', ic: '🔨', n: 'Construir' }, { id: 'people', ic: '👥', n: 'Povo' }, { id: 'jobs', ic: '⚒️', n: 'Trabalho' },
  { id: 'policy', ic: '⚖️', n: 'Política' }, { id: 'tech', ic: '🔬', n: 'Pesquisa' }, { id: 'world', ic: '🗺️', n: 'Mundo' },
  { id: 'chronicle', ic: '📜', n: 'Crônica' }, { id: 'achv', ic: '🏆', n: 'Troféus' },
];

export class UI {
  constructor(game) {
    this.game = game; this.panel = null; this.helpOn = false; this.buildCat = null; this.chrFilter = 'all';
    this.build = null; this.modals = []; this.pauseHold = 0; this.prevPaused = false;
    this.hudT = 0; this.slowT = 0; this.prevRes = {}; this.lastPanelHTML = ''; this.worldUI = new WorldUI(this);
    this.init();
  }
  get s() { return this.game.s; }
  get r() { return this.game.r; }

  init() {
    // abas
    $('tabs').innerHTML = TABS.map(t => `<button class="tab" id="tab-${t.id}" data-tab="${t.id}"><span class="ic">${t.ic}</span>${t.n}<i class="dot"></i></button>`).join('');
    $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) this.togglePanel(b.dataset.tab); });
    for (const b of document.querySelectorAll('#speed button')) b.addEventListener('click', () => this.setSpeed(+b.dataset.speed));
    $('btn-menu').addEventListener('click', () => this.showMenu());
    $('sheet').addEventListener('click', e => this.sheetClick(e));
    $('inspector').addEventListener('click', e => this.inspectorClick(e));
    $('buildbar').addEventListener('click', e => this.buildbarClick(e));
    $('res-bar').addEventListener('click', e => { if (e.target.closest('[data-era]')) this.showEraStatus(); });
    $('left').addEventListener('click', e => { if (window.innerWidth <= 760 && e.target.closest('h4')) $('left').classList.toggle('expanded'); });
    // tooltips (mouse)
    document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && e.pointerType !== 'touch') this.showTip(t.dataset.tip, e); else this.hideTip(); });
    document.addEventListener('mousemove', e => { if (!$('tip').classList.contains('hidden')) this.moveTip(e); });
    document.addEventListener('keydown', e => this.onKey(e));
    // renderer
    const r = this.r;
    r.onTap = (wp, e) => this.onMapTap(wp, e);
    r.onHover = (wp, e) => this.onMapHover(wp, e);
    r.onPaint = wp => this.onMapPaint(wp);
    // eventos
    bus.on('toast', t => this.toast(t.text, t.kind, t.icon));
    bus.on('event', () => { });
    bus.on('era', era => this.showEraCelebration(era));
    bus.on('battle', rep => this.showBattle(rep));
    bus.on('death', () => { });
    this.buildTabsState();
  }
  reset() { this.closePanel(); this.cancelBuild(); this.select(null); this.modals.forEach(m => m.el.remove()); this.modals = []; this.pauseHold = 0; this.prevRes = {}; $('res-bar').innerHTML = ''; }

  // ---------- Velocidade ----------
  setSpeed(v) {
    const s = this.s;
    if (this.pauseHold > 0) return;
    if (v === 0) s.paused = true; else { s.paused = false; s.speed = v; }
    this.updateSpeedBtns();
  }
  updateSpeedBtns() {
    const s = this.s;
    for (const b of document.querySelectorAll('#speed button')) b.classList.toggle('on', s.paused ? +b.dataset.speed === 0 : +b.dataset.speed === s.speed);
  }
  hold() { if (this.pauseHold++ === 0) { this.prevPaused = this.s.paused; this.s.paused = true; this.updateSpeedBtns(); } }
  release() { if (--this.pauseHold <= 0) { this.pauseHold = 0; this.s.paused = this.prevPaused; this.updateSpeedBtns(); } }

  // ---------- Atalhos ----------
  onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key;
    if (k === ' ') { e.preventDefault(); this.setSpeed(this.s.paused ? Math.max(1, this.s.speed) : 0); }
    else if (k === '1' || k === '2' || k === '3') this.setSpeed(+k);
    else if (k === 'Escape') { if (this.build) this.cancelBuild(); else if (this.modals.length && this.modals.at(-1).closable) this.closeModal(); else if (this.panel) this.closePanel(); else this.select(null); }
    else if (k === 'b') this.togglePanel('build'); else if (k === 'p') this.togglePanel('people'); else if (k === 'j') this.togglePanel('jobs'); else if (k === 't') this.togglePanel('tech');
  }

  // ---------- Tooltip ----------
  showTip(html, e) { const t = $('tip'); t.innerHTML = html; t.classList.remove('hidden'); this.moveTip(e); }
  moveTip(e) { const t = $('tip'); let x = e.clientX + 14, y = e.clientY + 16; const w = t.offsetWidth, h = t.offsetHeight; if (x + w > innerWidth - 6) x = e.clientX - w - 10; if (y + h > innerHeight - 6) y = e.clientY - h - 10; t.style.left = x + 'px'; t.style.top = y + 'px'; }
  hideTip() { $('tip').classList.add('hidden'); }

  // ---------- Toasts ----------
  toast(text, kind = 'info', icon = '') {
    const box = $('toasts');
    while (box.children.length >= 4) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = `${icon ? `<span>${icon}</span>` : ''}<span>${esc(text)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3600);
  }

  // ---------- Loop ----------
  update(dt) {
    const s = this.s;
    this.hudT += dt; this.slowT += dt;
    if (this.hudT > 0.2) { this.hudT = 0; this.updateHUD(s); }
    if (this.slowT > 0.9) {
      this.slowT = 0; this.updateGoals(s); this.updateAlerts(s); this.updateTabsState(s); this.refreshPanel(); this.updateInspector(); this.pumpEvents();
    }
    if (this.panel === 'world') this.worldFast = (this.worldFast || 0) + dt, this.worldFast > 0.25 && (this.worldFast = 0, this.worldUI.update(s));
    if (this.build) this.updateBuildbar();
  }

  // ---------- HUD ----------
  updateHUD(s) {
    const bar = $('res-bar');
    const th = s._th || timeInfo(s);
    const show = RES_ORDER.filter(r => RES[r].tier === 1 || (r === 'planks' ? s.era >= 2 : r === 'jewels' ? s.era >= 4 : r === 'weapons' ? s.era >= 3 && (s.res.weapons > 0 || countB(s, 'barracks') || countB(s, 'smithy')) : s.era >= 3));
    const key = show.join(',') + s.era;
    if (this._hudKey !== key) {
      this._hudKey = key;
      bar.innerHTML = `<div class="chip" data-chip="pop"><img src="${iconURL('pop', 40)}"><div class="v"><b></b><small></small></div></div>` +
        show.map(r => `<div class="chip" data-chip="${r}"><img src="${iconURL(r, 40)}"><div class="v"><b></b><small></small></div></div>`).join('') +
        `<div class="chip era" data-era="1"><span style="font-size:18px">👑</span><div class="v"><b></b><small></small></div></div>`;
    }
    const d = s._d;
    for (const ch of bar.children) {
      const r = ch.dataset.chip;
      if (r === 'pop') {
        const b = ch.querySelector('b'), sm = ch.querySelector('small'); const v = `${s.people.length}`; if (b.textContent !== v) b.textContent = v;
        const t = `${d.beds} camas`; if (sm.textContent !== t) sm.textContent = t;
        ch.classList.toggle('low', s.people.length > d.beds + 2);
        ch.dataset.tip = `<b>População</b><br>${s.people.length} moradores, ${d.beds} camas.<br>Felicidade média: ${Math.round(avgJoy(s))}`;
      } else if (r) {
        const cap = capOf(s, r), v = s.res[r], rate = s.rates[r] || 0;
        const b = ch.querySelector('b'), sm = ch.querySelector('small');
        const txt = `${fmt(v)}`; if (b.textContent !== txt + '/' + cap) b.textContent = txt + '/' + cap;
        const rt = Math.abs(rate) < 0.05 ? '' : (rate > 0 ? '+' : '') + fmt1(rate) + '/dia';
        if (sm.textContent !== rt) { sm.textContent = rt; sm.className = rate > 0.05 ? 'up' : rate < -0.05 ? 'dn' : ''; }
        ch.classList.toggle('full', v >= cap * 0.97 && cap > 0);
        ch.classList.toggle('low', (r === 'food' || r === 'water') && v < dailyNeed(s) * 1.5);
        if (this.prevRes[r] !== undefined && v > this.prevRes[r] + 0.9) { ch.classList.add('bump'); setTimeout(() => ch.classList.remove('bump'), 220); }
        this.prevRes[r] = v;
        ch.dataset.tip = `<b>${RES[r].name}</b><br>${Math.floor(v)} de ${cap}<br>Saldo: ${rate >= 0 ? '+' : ''}${fmt1(rate)} por dia${v >= cap * 0.97 ? '<br><span style="color:#f0b429">Armazém cheio! Construa depósitos.</span>' : ''}`;
      } else if (ch.dataset.era) {
        const st = eraStatus(s);
        ch.querySelector('b').textContent = ERAS[s.era].name;
        ch.querySelector('small').textContent = st ? (st.ready ? 'Evoluir!' : st.reqOk ? 'Faltam recursos' : 'Próxima era →') : 'Era final';
        ch.classList.toggle('ready', !!st?.ready);
        ch.dataset.tip = st ? `<b>Próxima era: ${st.next.name}</b><br>Toque para ver os requisitos.` : 'Você chegou ao Império!';
      }
    }
    const month = ['', '', '', ''];
    const hh = Math.floor(th.hour), mm = Math.floor((th.hour % 1) * 60);
    $('date').innerHTML = `Dia ${th.day + 1} · Ano ${th.year + 1}<small>${SEASON_ICON[th.season]} ${SEASONS[th.season]} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${s.weather.type === 'rain' ? '🌧' : s.weather.type === 'storm' ? '⛈' : s.weather.type === 'snow' ? '🌨' : ''}</small>`;
    this.updateSpeedBtns();
  }

  // ---------- Objetivos ----------
  updateGoals(s) {
    const qs = activeQuests(s, 3);
    const st = eraStatus(s);
    let h = `<h4>🎯 Objetivos</h4>`;
    qs.forEach(({ q, prog }, i) => {
      const [c, t] = prog;
      h += `<div class="goal"><div class="t"><span>${esc(q.text)}</span><i>${c}/${t}</i></div><div class="bar"><span style="width:${c / t * 100}%"></span></div><div class="rw">Recompensa: ${Object.entries(q.reward).map(([r, v]) => `+${v} ${RES[r].name}`).join(', ')}</div></div>`;
    });
    if (!qs.length) h += '<div class="goal"><div class="t">Nenhum objetivo pendente nesta era!</div></div>';
    if (st) { const done = st.checks.filter(c => c.ok).length; h += `<div class="goal"><div class="t"><span>🏛️ Próxima era: ${st.next.name}</span><i>${done}/${st.checks.length}</i></div><div class="bar"><span style="width:${done / st.checks.length * 100}%"></span></div></div>`; }
    h += `<div class="goal long"><div class="t"><span>⭐ ${esc(longGoal(s))}</span></div></div>`;
    if (h !== this._goalsH) { this._goalsH = h; $('goals').innerHTML = h; }
  }
  updateAlerts(s) {
    const al = getAlerts(s);
    const keep = al.filter(a => a.level !== 'ok').slice(0, 5).concat(al.filter(a => a.level === 'ok').slice(0, 2));
    const h = `<h4>🚨 Alertas <span>${al.filter(a => a.level === 'danger').length ? '🔴' + al.filter(a => a.level === 'danger').length : ''} ${al.filter(a => a.level === 'warn').length ? '🟡' + al.filter(a => a.level === 'warn').length : ''}</span></h4>` +
      keep.map(a => `<div class="alert ${a.level}"><span>${a.icon}</span><span>${esc(a.text)}</span></div>`).join('');
    if (h !== this._alertsH) { this._alertsH = h; $('alerts').innerHTML = h; }
  }
  buildTabsState() { this._seenUnlock = this._seenUnlock || {}; }
  updateTabsState(s) {
    const set = (id, on, good) => { const d = $('tab-' + id)?.querySelector('.dot'); if (d) { d.classList.toggle('show', !!on); d.classList.toggle('good', !!good); } };
    const free = s.people.filter(p => p.job === 'livre' && p.age >= ADULT_AGE).length;
    const newB = Object.entries(BUILDINGS).some(([id, d]) => unlocked(s, id) && !this._seenUnlock[id] && id !== 'campfire');
    set('jobs', free >= 2);
    set('tech', !s.tech.current && Object.keys(TECHS).some(id => !s.tech.done[id] && s.era >= TECHS[id].era && TECHS[id].req.every(r => s.tech.done[r]) && s.tech.rp + 1 >= TECHS[id].cost * 0.5), true);
    set('build', newB, true);
    set('world', s.ev.pending.length > 0 && s.ev.pending.some(e => e.id.startsWith('k_')));
    $('tab-world').classList.toggle('locked', !s.flags.worldUnlocked);
    const pol = s.era >= 3 && !this._seenPolicy; set('policy', pol, true);
  }

  // ---------- Painéis ----------
  togglePanel(id) {
    if (id === 'world' && !this.s.flags.worldUnlocked) { this.toast('Pesquise Cartografia para liberar o mapa-múndi.', 'info', '🗺️'); return; }
    if (this.panel === id) return this.closePanel();
    this.cancelBuild();
    this.panel = id; this.helpOn = false; this.lastPanelHTML = ''; this.worldMounted = false;
    $('sheet').classList.remove('hidden');
    for (const t of TABS) $('tab-' + t.id).classList.toggle('on', t.id === id);
    if (id === 'policy') this._seenPolicy = true;
    if (id === 'build') for (const k in BUILDINGS) if (unlocked(this.s, k)) this._seenUnlock[k] = 1;
    this.refreshPanel(true);
    this.onPanel && this.onPanel(id);
  }
  closePanel() {
    this.panel = null; $('sheet').classList.add('hidden'); this.hideTip();
    for (const t of TABS) $('tab-' + t.id).classList.remove('on');
  }
  isOpen(id) { return this.panel === id; }
  panelData(s) {
    switch (this.panel) {
      case 'build': return buildPanel(s, this); case 'people': return peoplePanel(s, this); case 'jobs': return jobsPanel(s, this);
      case 'policy': return policyPanel(s, this); case 'tech': return techPanel(s, this); case 'chronicle': return chroniclePanel(s, this);
      case 'achv': return achievementsPanel(s); case 'world': return { title: '🗺️ Mundo', help: 'O mapa-múndi mostra terras, reinos rivais e pontos de interesse. Explore com batedores, negocie, e se quiser, conquiste.', html: '' };
    }
    return null;
  }
  refreshPanel(force) {
    if (!this.panel) return;
    const s = this.s; const d = this.panelData(s); if (!d) return;
    const sh = $('sheet');
    if (!sh.querySelector('.sh-body') || force) {
      sh.innerHTML = `<div class="sh-head"><h3></h3><button class="iconbtn" data-act="help" title="Ajuda">?</button><button class="iconbtn" data-act="close">✕</button></div><div class="sh-body"></div>`;
      this.lastPanelHTML = ''; this.worldMounted = false;
    }
    sh.querySelector('h3').textContent = d.title;
    const body = sh.querySelector('.sh-body');
    if (this.panel === 'world') {
      if (!this.worldMounted) { this.worldMounted = true; body.innerHTML = `<div class="help" style="display:${this.helpOn ? 'block' : 'none'}" id="w-help">${d.help}</div><div id="w-mount"></div>`; this.worldUI.mount(body.querySelector('#w-mount')); }
      body.querySelector('#w-help').style.display = this.helpOn ? 'block' : 'none';
      this.worldUI.update(s);
      return;
    }
    const html = (this.helpOn ? `<div class="help">${d.help}</div>` : '') + d.html;
    if (html !== this.lastPanelHTML) { const sc = body.scrollTop; const scx = body.querySelector('.techwrap')?.scrollLeft || 0; body.innerHTML = html; body.scrollTop = sc; const tw = body.querySelector('.techwrap'); if (tw) tw.scrollLeft = scx || this._techScroll || 0; this.lastPanelHTML = html; }
  }
  sheetClick(e) {
    const el = e.target.closest('[data-act]'); if (!el) return;
    this.act(el.dataset.act);
  }
  act(act) {
    const [a, b, c] = act.split(':'); const s = this.s;
    switch (a) {
      case 'close': this.closePanel(); return;
      case 'help': this.helpOn = !this.helpOn; this.lastPanelHTML = ''; this.refreshPanel(); return;
      case 'noop': return;
      case 'cat': this.buildCat = b; break;
      case 'build': this.startBuild(b); return;
      case 'job+': if (!adjustJob(s, b, 1)) this.toast('Sem moradores disponíveis para essa vaga.', 'bad', '🙂'); break;
      case 'job-': adjustJob(s, b, -1); break;
      case 'pol': { const p = POLICIES[b]; setPolicy(s, b, p.bool ? c === '1' : +c); break; }
      case 'tech': { const sc = document.querySelector('.techwrap'); this._techScroll = sc ? sc.scrollLeft : 0; if (startResearch(s, b)) this.toast(`Pesquisando: ${TECHS[b].name}`, 'good', '🔬'); break; }
      case 'techinfo': { const t = TECHS[b]; this.toast(`${t.name}: ${t.desc}${s.era < t.era ? ` (disponível na era ${ERAS[t.era].name})` : ''}`, 'info', '🔬'); return; }
      case 'sel': { this.select({ kind: b, id: +c }, true); if (window.innerWidth <= 760) this.closePanel(); return; }
      case 'festival': if (!startFestival(s)) this.toast('Festival indisponível agora.', 'bad', '🎉'); break;
      case 'chr': this.chrFilter = b; break;
    }
    this.lastPanelHTML = ''; this.refreshPanel();
  }

  // ---------- Seleção / inspetor ----------
  select(sel, focus) {
    this.sel = sel; this.r.selection = sel;
    const s = this.s;
    if (sel && focus) {
      const e = sel.kind === 'person' ? s.people.find(p => p.id === sel.id) : s.buildings.find(b => b.id === sel.id);
      if (e) { const x = e.w ? (e.x + e.w / 2) * TILE : e.x, y = e.w ? (e.y + e.h / 2) * TILE : e.y; this.r.focus(x, y, Math.max(this.r.cam.z, 1.6)); }
    }
    this.updateInspector();
  }
  onMapTap(wp, e) {
    const s = this.s;
    if (this.build) return this.buildTap(wp, e);
    const z = Math.max(0.6, this.r.cam.z);
    let best = null, bd = (22 / z) ** 2;
    for (const p of s.people) { if (p.rt.inside || p.away > 0) continue; const d = (p.x - wp.x) ** 2 + (p.y - 10 - wp.y) ** 2; if (d < bd) { bd = d; best = { kind: 'person', id: p.id }; } }
    if (!best) {
      for (const b of [...s.buildings].sort((a, c) => (c.y + c.h) - (a.y + a.h))) {
        if (b.type === 'road') continue;
        const x0 = b.x * TILE, x1 = (b.x + b.w) * TILE, y1 = (b.y + b.h) * TILE, y0 = b.y * TILE - (b.type === 'wall' ? 8 : 30);
        if (wp.x >= x0 && wp.x <= x1 && wp.y >= y0 && wp.y <= y1) { best = { kind: 'building', id: b.id }; break; }
      }
    }
    this.select(best);
    if (best && window.innerWidth <= 760) this.closePanel();
  }
  onMapHover(wp, e) { if (this.build && (e.pointerType === 'mouse' || !e.pointerType)) this.moveGhost(wp); }
  inspectorClick(e) {
    const el = e.target.closest('[data-i]'); if (!el) return;
    const [a, b, c] = el.dataset.i.split(':'); const s = this.s;
    if (a === 'close') this.select(null);
    else if (a === 'job') { const p = s.people.find(q => q.id === this.sel?.id); if (p) { setJob(s, p, b); } }
    else if (a === 'follow') { const p = s.people.find(q => q.id === this.sel?.id); this.r.following = this.r.following ? null : p; }
    else if (a === 'toggle') { const bd = s.buildings.find(q => q.id === this.sel?.id); if (bd) { bd.enabled = !bd.enabled; s._dirty = true; } }
    else if (a === 'mode') { const bd = s.buildings.find(q => q.id === this.sel?.id); if (bd) bd.mode = b; }
    else if (a === 'demolish') { const bd = s.buildings.find(q => q.id === this.sel?.id); if (bd && confirm(`Demolir ${bdef(bd).name}? Você recupera parte dos recursos.`)) { demolish(s, bd); this.select(null); } }
    this.updateInspector(true);
  }
  updateInspector(force) {
    const el = $('inspector'), s = this.s, sel = this.sel;
    if (!sel) { el.classList.add('hidden'); this.r.following = null; return; }
    let h = '';
    if (sel.kind === 'person') {
      const p = s.people.find(q => q.id === sel.id);
      if (!p) { this.select(null); return; }
      const top = Object.entries(p.skill).sort((a, b) => b[1] - a[1])[0];
      const jobs = Object.keys(JOBS).filter(j => jobUnlocked(s, j));
      const bar = (l, v, col) => `<div>${l}<div class="bar"><span style="width:${v}%;background:${col}"></span></div></div>`;
      h = `<div class="ih"><span style="font-size:26px">${p.age < ADULT_AGE ? '🧒' : JOBS[p.job].icon}</span><b>${esc(p.name)} ${p.hero ? '⭐' : ''}</b><button class="iconbtn" data-i="follow" title="Seguir">🎯</button><button class="iconbtn" data-i="close">✕</button></div>
        <div class="sub" style="font-size:12px;color:#a9b5a3">${p.age < ADULT_AGE ? '' : JOBS[p.job].name + ' · '}${ageText(p)} · ${taskText(p)}${p.sick ? ' · 🤒 doente' : ''}${p.preg ? ' · 🤰' : ''}${p.partner ? ' · 💞 casado(a)' : ''}</div>
        <div class="need">${bar('Fome', p.n.hunger, '#e8943a')}${bar('Sono', p.n.sleep, '#6a8ae0')}${bar('Humor', p.n.joy, '#f2c14e')}${bar('Saúde', p.n.health, '#62c46a')}</div>
        ${top && top[1] > 0.3 ? `<div class="sub" style="font-size:12px">Habilidade: ${JOBS[top[0]]?.name || top[0]} nv ${top[1].toFixed(1)}</div>` : ''}
        ${p.age >= ADULT_AGE ? `<div class="pills" style="margin:8px 0 0">${jobs.map(j => `<button class="pill ${p.job === j ? 'on' : ''}" data-i="job:${j}">${JOBS[j].icon} ${JOBS[j].name}</button>`).join('')}</div>` : ''}`;
    } else {
      const b = s.buildings.find(q => q.id === sel.id);
      if (!b) { this.select(null); return; }
      const def = bdef(b);
      const staff = b._st ? Object.values(b._st).reduce((a, v) => a + v, 0) : 0;
      const slots = def.slots ? Object.values(def.slots).reduce((a, v) => a + v, 0) : 0;
      const assigned = s.people.filter(p => p.workplace === b.id).length;
      h = `<div class="ih"><span style="font-size:26px">${def.icon}</span><b>${def.name}</b><button class="iconbtn" data-i="close">✕</button></div>
        <div class="sub" style="font-size:12px;color:#a9b5a3">${def.desc}</div>
        <div style="margin:6px 0;font-size:12.5px">${b.done ? `<span class="tag g">Pronto</span>` : `<span class="tag y">Construindo ${Math.round(b.prog * 100)}%</span>`} ${slots ? `<span class="tag b">Trabalhadores ${assigned}/${slots}</span>` : ''} ${def.beds ? `<span class="tag">🛏 ${def.beds}</span>` : ''} ${def.storage ? `<span class="tag">📦 +${def.storage}</span>` : ''} ${def.defense ? `<span class="tag r">🛡 +${def.defense}</span>` : ''}</div>
        ${b.done && b.type === 'smithy' ? `<div class="seg" style="margin:6px 0"><button class="${b.mode === 'tools' ? 'on' : ''}" data-i="mode:tools">Ferramentas</button><button class="${b.mode === 'weapons' ? 'on' : ''}" data-i="mode:weapons">Armas</button></div>` : ''}
        <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap">${b.done && def.slots ? `<button class="btn" data-i="toggle">${b.enabled ? '⏸ Desativar' : '▶ Ativar'}</button>` : ''}${b.type !== 'campfire' ? `<button class="btn bad" data-i="demolish">Demolir</button>` : ''}</div>`;
    }
    if (force || h !== this._inspH) { this._inspH = h; el.innerHTML = h; }
    el.classList.remove('hidden');
  }

  // ---------- Modo de construção ----------
  startBuild(type) {
    const def = BUILDINGS[type];
    this.select(null); this.closePanel();
    this.build = { type, x: null, y: null };
    this.r.paintMode = !!def.repeat; $('game').classList.add('building');
    const c = this.r.cam; this.moveGhost({ x: c.x, y: c.y });
    $('buildbar').classList.remove('hidden');
    this.updateBuildbar(true);
    this.onBuildStart && this.onBuildStart(type);
  }
  cancelBuild() {
    if (!this.build) return;
    this.build = null; this.r.ghost = null; this.r.paintMode = false; $('game').classList.remove('building'); $('buildbar').classList.add('hidden');
  }
  moveGhost(wp) {
    const b = this.build; if (!b) return;
    const def = BUILDINGS[b.type];
    b.x = Math.round(wp.x / TILE - def.w / 2); b.y = Math.round(wp.y / TILE - def.h / 2);
    if (def.w === 1) { b.x = Math.floor(wp.x / TILE); b.y = Math.floor(wp.y / TILE); }
    const c = canPlace(this.s, b.type, b.x, b.y);
    b.ok = c.ok; b.reason = c.reason;
    this.r.ghost = { type: b.type, x: b.x, y: b.y, ok: c.ok, reason: c.reason };
  }
  buildTap(wp, e) {
    const b = this.build; const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const px = b.x, py = b.y;
    this.moveGhost(wp);
    if (touch && !(px === b.x && py === b.y)) { this.updateBuildbar(true); return; } // 1º toque posiciona
    this.confirmBuild(e.shiftKey);
  }
  onMapPaint(wp) {
    const b = this.build; if (!b) return;
    this.moveGhost(wp);
    if (b.ok) this.confirmBuild(true, true);
  }
  confirmBuild(keep, quiet) {
    const b = this.build; if (!b || b.x == null) return;
    const def = BUILDINGS[b.type];
    const nb = placeBuilding(this.s, b.type, b.x, b.y);
    if (nb) {
      nb.manual = true;
      if (!quiet) this.toast(`${def.name}: obra iniciada`, 'good', def.icon);
      if (!def.repeat && !keep) this.cancelBuild();
      else this.moveGhost({ x: (b.x + def.w / 2) * TILE, y: (b.y + def.h / 2) * TILE });
    } else if (!quiet) this.toast(b.reason || 'Não pode construir aqui', 'bad', '🚫');
    this.updateBuildbar(true);
  }
  buildbarClick(e) {
    const el = e.target.closest('[data-b]'); if (!el) return;
    if (el.dataset.b === 'ok') this.confirmBuild(false); else this.cancelBuild();
  }
  updateBuildbar(force) {
    const b = this.build; if (!b) return;
    const def = BUILDINGS[b.type]; const s = this.s;
    const touch = matchMedia('(pointer: coarse)').matches;
    const c = b.x != null ? canPlace(s, b.type, b.x, b.y) : { ok: false, reason: '' };
    const h = `<div class="grow"><b>${def.icon} ${def.name}</b><small>${c.ok ? (touch ? 'Toque em outro local para mover, ou confirme.' : 'Clique no mapa para construir (Esc cancela).') : `<span style="color:#ff9b8a">${c.reason || ''}</span>`}</small>${costHTML(def.cost, s)}</div>
      ${touch || true ? `<button class="btn pri ${c.ok ? '' : 'dis'}" data-b="ok">✔ Construir</button>` : ''}<button class="btn" data-b="x">✖</button>`;
    if (force || h !== this._bbH) { this._bbH = h; $('buildbar').innerHTML = h; }
    if (this.r.ghost) { this.r.ghost.ok = c.ok; this.r.ghost.reason = c.reason; }
  }

  // ---------- Modais ----------
  openModal(html, o = {}) {
    const back = document.createElement('div'); back.className = 'modal-back'; back.innerHTML = html;
    if (o.closable !== false) back.addEventListener('pointerdown', e => { if (e.target === back) this.closeModal(); });
    $('modal-root').appendChild(back);
    const m = { el: back, closable: o.closable !== false, pause: o.pause !== false, onClose: o.onClose };
    this.modals.push(m);
    if (m.pause) this.hold();
    return back;
  }
  closeModal() {
    const m = this.modals.pop(); if (!m) return;
    m.el.remove();
    if (m.pause) this.release();
    if (m.onClose) m.onClose();
    this.pumpEvents();
  }
  pumpEvents() {
    const s = this.s;
    if (this.modals.length || this.game.booting) return;
    if (s.pendingReports?.length) { this.showOffline(s.pendingReports[0], true); return; }
    if (!s.ev.pending.length) return;
    this.showEvent(s.ev.pending[0]);
  }
  showEvent(inst) {
    const s = this.s;
    const v = eventView(s, inst);
    const html = `<div class="modal"><h2><span class="big">${v.icon}</span>${esc(v.title)}</h2><p>${esc(v.text)}</p>
      ${v.options.map((o, i) => `<button class="opt ${o.ok ? '' : 'dis'}" data-opt="${i}"><b>${esc(o.label)}</b><small>${esc(o.hint)}${o.ok ? '' : ' — <span style="color:#ff9b8a">recursos insuficientes</span>'}</small></button>`).join('')}</div>`;
    const el = this.openModal(html, { closable: false });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-opt]'); if (!b) return;
      const res = chooseOption(s, inst, +b.dataset.opt);
      if (res == null) return;
      el.querySelector('.modal').innerHTML = `<h2><span class="big">${v.icon}</span>${esc(v.title)}</h2><p>${esc(res)}</p><button class="btn pri" data-done style="width:100%">Continuar</button>`;
      el.querySelector('[data-done]').addEventListener('click', () => this.closeModal());
    });
  }
  showOffline(rep, fromPending) {
    const s = this.s;
    const dres = Object.entries(rep.dRes).map(([r, v]) => `<span class="delta ${v > 0 ? 'p' : 'n'}">${rimg(r)}${v > 0 ? '+' : ''}${v}</span>`).join('');
    const vText = { prosperou: ['🌟', 'O reino prosperou durante sua ausência!'], estavel: ['⚖️', 'O reino se manteve estável.'], crise: ['🔥', 'O reino enfrentou uma crise!'] }[rep.verdict];
    const evs = rep.events.map(e => `<div class="ll"><b>${e.icon} ${esc(e.title)}</b> — escolha automática: <i>${esc(e.choice)}</i><br><span style="color:#a9b5a3">${esc(e.result || '')}</span></div>`).join('');
    const bat = rep.battles.map(b => `<div class="ll ${b.win ? 'good' : 'bad'}"><b>${b.win ? '🏆' : '💀'} ${esc(b.title)}</b> — ${esc(b.lines.join(' '))}</div>`).join('');
    const chr = rep.chron.filter(c => !['event'].includes(c.kind)).slice(-10).map(c => `<div class="ll">Dia ${c.day + 1}: ${esc(c.text)}</div>`).join('');
    const html = `<div class="modal"><h2><span class="big">📜</span>Relatório do Reino</h2>
      <p style="margin-top:2px">Você ficou fora por <b>${fmtDur(rep.realSeconds)}</b>${rep.capped ? ' (limite de 12 h)' : ''}. Passaram-se <b>${rep.days.toFixed(1)} dias</b> no reino${rep.seasons ? `, ${rep.seasons} estação(ões)` : ''}.</p>
      <div class="verdict ${rep.verdict}"><span style="font-size:26px">${vText[0]}</span>${vText[1]}</div>
      <div class="statgrid">
        <div class="stat"><small>População</small><b>${rep.before.pop} → ${rep.after.pop} <span class="${rep.after.pop >= rep.before.pop ? 'p' : 'n'}">(${rep.after.pop - rep.before.pop >= 0 ? '+' : ''}${rep.after.pop - rep.before.pop})</span></b></div>
        <div class="stat"><small>Nascimentos / chegadas</small><b class="p">+${rep.births} / +${rep.immigrants}</b></div>
        <div class="stat"><small>Mortes / fugas</small><b class="${rep.deaths + rep.left ? 'n' : ''}">${rep.deaths} / ${rep.left}</b></div>
        <div class="stat"><small>Construções</small><b>${rep.builds >= 0 ? '+' : ''}${rep.builds}</b></div></div>
      ${rep.lines.map(l => `<div class="ll ${l.lvl}">${esc(l.text)}</div>`).join('')}
      <div class="sec">Recursos</div><div>${dres || '<span class="sub">Sem mudanças relevantes.</span>'}</div>
      ${rep.newTechs.length ? `<div class="sec">Descobertas</div><div class="ll good">🔬 ${rep.newTechs.join(', ')}</div>` : ''}
      ${evs ? `<div class="sec">Eventos resolvidos</div>${evs}` : ''}${bat ? `<div class="sec">Batalhas</div>${bat}` : ''}
      ${(rep.autoBuilt?.length) ? `<div class="sec">Obras do conselho</div><div class="ll good">🏗️ ${rep.autoBuilt.join(', ')}</div>` : ''}${(rep.moved?.length) ? `<div class="sec">Realocações</div>${rep.moved.map(m => `<div class="ll">📐 ${esc(m)}</div>`).join('')}` : ''}
      ${chr ? `<div class="sec">Crônica</div>${chr}` : ''}
      <button class="btn pri" data-done style="width:100%;margin-top:14px">Retomar o reino</button></div>`;
    const el = this.openModal(html, { closable: false, onClose: () => { if (fromPending) { const i = s.pendingReports.indexOf(rep); if (i >= 0) s.pendingReports.splice(i, 1); this.game.saveNow(); } } });
    el.querySelector('[data-done]').addEventListener('click', () => this.closeModal());
  }
  showEraCelebration(era) {
    const def = ERAS[era]; const s = this.s;
    const newB = Object.entries(BUILDINGS).filter(([id, d]) => d.era === era);
    const newJ = Object.entries(JOBS).filter(([id, j]) => j.era === era && id !== 'livre');
    const html = `<div class="modal era-modal"><div class="big" style="font-size:60px">${['', '🏕️', '🏘️', '🏙️', '👑', '🌟'][era]}</div>
      <p style="margin:0;color:#e8d4a0;letter-spacing:.2em;font-size:12px">NOVA ERA</p><h1>${def.name}</h1><p>${def.desc || def.unlocks}</p>
      <div class="unl"><b>Liberado:</b><br>${def.unlocks || ''}</div>
      <div class="statgrid">${newB.slice(0, 8).map(([id, d]) => `<div class="stat" style="text-align:center"><div style="font-size:22px">${d.icon}</div><small>${d.name}</small></div>`).join('')}</div>
      ${newJ.length ? `<p>Novas profissões: ${newJ.map(([id, j]) => j.icon + ' ' + j.name).join(', ')}</p>` : ''}
      <p style="color:#e8d4a0;font-size:13px">Seu território se expandiu. Novos objetivos e eventos o aguardam.</p>
      <button class="btn pri" data-done style="width:100%">Continuar</button></div>`;
    const el = this.openModal(html, { closable: false });
    el.querySelector('[data-done]').addEventListener('click', () => this.closeModal());
    this.r.fireworks(10);
  }
  showEraStatus() {
    const s = this.s; const st = eraStatus(s);
    if (!st) { this.toast('Você já é um Império!', 'gold', '🌟'); return; }
    const html = `<div class="modal"><h2><span class="big">🏛️</span>Evoluir para ${st.next.name}</h2><p>${st.next.unlocks}</p>
      <div class="sec">Requisitos</div>${st.checks.map(c => `<div class="ll ${c.ok ? 'good' : ''}">${c.ok ? '✅' : '⬜'} ${esc(c.text)}</div>`).join('')}
      <div class="sec">Custo</div>${costHTML(st.next.cost, s)}
      <div class="acts" style="display:flex;gap:8px;margin-top:14px"><button class="btn" data-x style="flex:1">Fechar</button><button class="btn pri ${st.ready ? '' : 'dis'}" data-go style="flex:2">⭐ Evoluir</button></div></div>`;
    const el = this.openModal(html, { pause: false });
    el.querySelector('[data-x]').addEventListener('click', () => this.closeModal());
    el.querySelector('[data-go]').addEventListener('click', () => { if (advanceEra(s)) { this.closeModal(); } });
  }
  showBattle(rep) {
    const el = this.openModal(battleHTML(rep), { closable: false });
    runBattle(el, rep, () => this.closeModal());
  }
  showMenu() {
    const g = this.game;
    const html = `<div class="modal"><h2><span class="big">⚙️</span>Menu</h2>
      <button class="opt" data-m="save"><b>💾 Salvar agora</b><small>O jogo também salva automaticamente a cada 10 segundos.</small></button>
      <button class="opt" data-m="export"><b>📤 Exportar save</b><small>Copia seu progresso para a área de transferência.</small></button>
      <button class="opt" data-m="import"><b>📥 Importar save</b><small>Cole um save exportado anteriormente.</small></button>
      <button class="opt" data-m="tut"><b>🎓 Rever tutorial</b><small>Reinicia as dicas guiadas.</small></button>
      <button class="opt" data-m="help"><b>❓ Como jogar</b><small>Controles e dicas rápidas.</small></button>
      <button class="opt" data-m="new"><b style="color:#ff9b8a">🗑️ Novo jogo</b><small>Apaga o progresso atual.</small></button>
      <button class="btn" data-m="close" style="width:100%;margin-top:6px">Fechar</button></div>`;
    const el = this.openModal(html, {});
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return; const m = b.dataset.m;
      if (m === 'close') this.closeModal();
      else if (m === 'save') { g.saveNow(); this.toast('Jogo salvo!', 'good', '💾'); }
      else if (m === 'export') { const t = serialize(this.s); navigator.clipboard?.writeText(t).then(() => this.toast('Save copiado!', 'good', '📤'), () => this.promptText('Copie o save:', t)); }
      else if (m === 'import') { this.closeModal(); const t = prompt('Cole aqui o save exportado:'); if (t) { try { g.importSave(t); this.toast('Save importado!', 'good', '📥'); } catch (err) { this.toast('Save inválido.', 'bad', '⚠️'); } } }
      else if (m === 'tut') { this.closeModal(); g.restartTutorial(); }
      else if (m === 'help') { this.closeModal(); this.showHowTo(); }
      else if (m === 'new') { if (confirm('Apagar todo o progresso e começar de novo?')) { this.closeModal(); g.newGame(); } }
    });
  }
  promptText(msg, t) { prompt(msg, t); }
  showHowTo() {
    const html = `<div class="modal"><h2><span class="big">❓</span>Como jogar</h2>
      <p><b>Câmera:</b> arraste para mover; role (ou use pinça) para zoom. Toque em moradores e construções para ver detalhes.</p>
      <p><b>Objetivo:</b> transforme dois sobreviventes em um império. Os moradores trabalham sozinhos — você decide <b>o que construir</b>, <b>quem faz o quê</b>, as <b>políticas</b> e como reagir aos <b>eventos</b>.</p>
      <p><b>Sobrevivência:</b> mantenha comida e água positivas (veja os alertas coloridos). O inverno exige estoque de comida e lenha. Construa camas para atrair imigrantes.</p>
      <p><b>Offline:</b> o reino continua enquanto você está fora (até 12 h, em ritmo reduzido). Ao voltar, o Relatório do Reino mostra o que aconteceu.</p>
      <p><b>Atalhos:</b> Espaço pausa · 1/2/3 velocidade · B construir · P povo · J trabalho · T pesquisa · Esc cancela.</p>
      <button class="btn pri" data-done style="width:100%">Entendi</button></div>`;
    const el = this.openModal(html, {}); el.querySelector('[data-done]').addEventListener('click', () => this.closeModal());
  }
}

function dailyNeed(s) { return Math.max(1, s.people.length * 0.8); }
