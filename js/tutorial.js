// tutorial.js — tutorial guiado passo a passo (setas, destaques, textos curtos) + dicas contextuais (uma mecânica por vez)

import { eraStatus } from './sim.js';
import { countB, timeInfo } from './state.js';
import { capOf, foodDays } from './core.js';
import { TILE, RES_ORDER } from './data.js';

const $ = id => document.getElementById(id);
const touch = () => matchMedia('(pointer: coarse)').matches;

const STEPS = [
  { id: 'welcome', title: 'Bem-vindo ao reino!', text: 'Tomás e Joana acabaram de chegar a esta clareira. Eles trabalham sozinhos: ele corta lenha, ela colhe frutos e busca água. Seu papel é liderar o povoado.', world: s => s.people[0], next: true },
  { id: 'camera', title: 'Explore o mapa', text: () => touch() ? 'Arraste com um dedo para mover a câmera e use a pinça para dar zoom. Tente agora!' : 'Arraste o mapa para mover a câmera e use a roda do mouse para dar zoom. Tente agora!', wait: (s, t) => t.camMoved(), next: true },
  { id: 'res', title: 'Recursos', text: 'Aqui ficam seus recursos. O número menor é a <b>capacidade</b> de armazenamento — o que passar disso se perde. Madeira, pedra, comida e água são o começo de tudo.', target: '#res-bar', next: true },
  { id: 'time', title: 'Tempo e estações', text: 'Dias, noites e estações passam. Pause para pensar ou acelere (1x, 2x, 3x). O inverno é duro: prepare-se!', target: '#clock', next: true },
  { id: 'goals', title: 'Objetivos e alertas', text: 'Os <b>objetivos</b> sempre mostram o próximo passo e dão recompensas. Os <b>alertas</b> avisam antes dos problemas: verde = ok, amarelo = atenção, vermelho = perigo.', target: '#left', next: true },
  { id: 'gather', title: 'Colheita automática', text: 'Veja Tomás cortar árvores: a árvore balança e cai, e ele carrega a madeira até a fogueira. Aguarde juntar <b>12 de madeira</b> (use 3x para acelerar).', world: s => s.people[0], wait: s => s.res.wood >= 12 || s.buildings.some(b => b.type === 'shelter'), follow: true },
  { id: 'openbuild', title: 'Hora de construir', text: 'Abra o menu <b>Construir</b>.', target: '#tab-build', wait: (s, t, ui) => ui.isOpen('build') || !!ui.build || s.buildings.some(b => b.type === 'shelter') },
  { id: 'pickshelter', title: 'Um abrigo', text: 'Escolha o <b>Abrigo</b>. Ele acomoda 2 pessoas e atrai imigrantes.', target: '[data-act="build:shelter"]', fallback: '#tab-build', wait: (s, t, ui) => ui.build?.type === 'shelter' || s.buildings.some(b => b.type === 'shelter') },
  { id: 'place', title: 'Posicione', text: () => touch() ? 'Toque no mapa, perto da fogueira, e confirme em <b>✔ Construir</b>. Verde = pode; vermelho = não pode.' : 'Clique no mapa, perto da fogueira. Verde = pode; vermelho = não pode.', target: '#buildbar', world: 'ghost', wait: s => s.buildings.some(b => b.type === 'shelter') },
  { id: 'constructing', title: 'Obra em andamento', text: 'Moradores livres e <b>construtores</b> erguem a obra sozinhos: fundação → andaime → pronta. Aguarde a conclusão.', world: s => { const b = s.buildings.find(q => q.type === 'shelter'); return b && { x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2) * TILE }; }, wait: s => s.buildings.some(b => b.type === 'shelter' && b.done) },
  { id: 'jobs', title: 'Profissões', text: 'Cada morador tem uma profissão. Abra <b>Trabalho</b> para distribuir as tarefas.', target: '#tab-jobs', wait: (s, t, ui) => ui.isOpen('jobs') },
  { id: 'jobs2', title: 'Quem faz o quê', text: 'Use <b>+</b> e <b>−</b> para definir quantos moradores cortam madeira, colhem, caçam, constroem ou extraem pedra. Moradores "Livres" ajudam onde falta. Quando terminar, feche o painel.', target: '#sheet', next: true, onNext: ui => ui.closePanel() },
  { id: 'research', title: 'Pesquisa', text: 'Descobertas dão bônus e liberam construções. Abra <b>Pesquisa</b>.', target: '#tab-tech', wait: (s, t, ui) => ui.isOpen('tech') },
  { id: 'research2', title: 'Escolha uma tecnologia', text: 'Toque em <b>Ferramentas de Pedra</b> (douradas estão disponíveis). Os pontos de pesquisa vêm do próprio povo.', target: '[data-act="tech:stone_tools"]', fallback: '#sheet', wait: s => !!s.tech.current || !!s.tech.done.stone_tools, onDone: ui => ui.closePanel() },
  { id: 'end', title: 'Você está pronto!', text: 'Siga os objetivos, fique de olho nos alertas e tome boas decisões. Quando o povo crescer, novas mecânicas serão explicadas. Boa sorte, líder!', next: true, last: true },
];

const TIPS = [
  { id: 'immigrants', cond: s => s.stats.immigrants > 0, title: 'Imigrantes!', text: 'Novos moradores chegam quando há <b>camas livres</b>, comida suficiente e boa reputação. Construa mais abrigos/casas e mantenha o povo feliz.' },
  { id: 'storage', cond: s => RES_ORDER.some(r => s.res[r] >= capOf(s, r) * 0.97 && capOf(s, r) > 0 && ['wood', 'stone', 'food', 'water'].includes(r)), title: 'Armazém cheio', text: 'Quando um recurso chega ao limite, o excedente <b>se perde</b>. Construa uma Área de Coleta ou um Depósito para aumentar a capacidade.', target: '#tab-build' },
  { id: 'era', cond: s => eraStatus(s)?.ready, title: 'Evolua de era!', text: 'Você cumpriu os requisitos! Evoluir libera novas construções e expande seu território.', target: '[data-era]' },
  { id: 'hunger', cond: s => s.people.length > 2 && foodDays(s) < 2.2, title: 'Cuidado com a fome', text: 'A comida está acabando. Atribua mais <b>coletores</b> ou <b>caçadores</b> (e fazendeiros, na Vila). Moradores famintos adoecem e morrem.', target: '#tab-jobs' },
  { id: 'winter', cond: s => timeInfo(s).season === 2 && timeInfo(s).day > 12, title: 'O inverno vem aí', text: 'No inverno não há colheita e o povo precisa de <b>lenha</b> para se aquecer. Estoque comida e madeira agora — veja o alerta ❄️.', target: '#alerts' },
  { id: 'era2', cond: s => s.era >= 2, title: 'Era da Vila', text: 'Novas construções: <b>Casas</b> (4 camas), <b>Fazendas</b> (muita comida), <b>Poço</b>, <b>Serraria</b> (tábuas) e <b>Depósitos</b>. Atribua Agricultores na aba Trabalho.', target: '#tab-build' },
  { id: 'event', cond: s => s.stats.eventsSeen > 0, title: 'Eventos', text: 'Eventos trazem escolhas com consequências reais. Quando você está ausente, o jogo usa uma decisão padrão sensata — mas você pode influenciar com as <b>políticas</b>.' },
  { id: 'era3', cond: s => s.era >= 3, title: 'Era da Cidade', text: 'Agora há <b>Política</b> (impostos, racionamento...), mercado, ferraria, quartel e muralhas. A posição diplomática define como o reino reage quando você está fora.', target: '#tab-policy' },
  { id: 'world', cond: s => s.flags.worldUnlocked, title: 'Mapa-múndi', text: 'Cartografia liberada! Envie <b>batedores</b> para revelar o mapa, descobrir reinos rivais e territórios. Na aba Mundo você negocia e, se quiser, guerreia.', target: '#tab-world' },
  { id: 'army', cond: s => countB(s, 'barracks') > 0, title: 'Exército', text: 'Com o quartel, atribua <b>Soldados</b> em Trabalho e treine tropas em Mundo → Exército. Lanceiros vencem cavaleiros, cavaleiros vencem arqueiros, arqueiros vencem lanceiros.', target: '#tab-world' },
  { id: 'era4', cond: s => s.era >= 4, title: 'Era do Reino', text: 'Castelo, catedral, porto, academia e estradas! Sábios geram pesquisa; alianças e rotas comerciais enriquecem o reino.' },
  { id: 'era5', cond: s => s.era >= 5, title: 'Império', text: 'Conquiste territórios, erga monumentos e complete a <b>Grande Maravilha</b> para a glória final.' },
];

export class Tutorial {
  constructor(ui) {
    this.ui = ui; this.root = $('tut-root');
    this.cam0 = null; this.tipT = 0; this.queue = [];
    this.box = document.createElement('div'); this.box.className = 'tut-box'; this.hole = document.createElement('div'); this.hole.className = 'tut-hole'; this.arrow = document.createElement('div'); this.arrow.className = 'tut-arrow'; this.arrow.textContent = '👇';
    this.root.append(this.hole, this.arrow, this.box);
    this.box.addEventListener('click', e => { const a = e.target.closest('[data-t]')?.dataset.t; if (a === 'next') this.next(); else if (a === 'skip') this.skip(); else if (a === 'ok') this.closeTip(); });
    this.hide();
  }
  get s() { return this.ui.s; }
  camMoved() { const c = this.ui.r.cam; if (!this.cam0) this.cam0 = { x: c.x, y: c.y, z: c.z }; return Math.hypot(c.x - this.cam0.x, c.y - this.cam0.y) > 70 || Math.abs(c.z - this.cam0.z) > 0.15; }
  reset() { this.cam0 = null; this.cur = null; this.hide(); }
  hide() { this.hole.style.display = 'none'; this.arrow.style.display = 'none'; this.box.style.display = 'none'; }
  skip() { this.s.tut.done = true; this.cur = null; this.hide(); }
  next() {
    const st = STEPS[this.s.tut.step];
    if (st?.onNext) st.onNext(this.ui);
    this.advance();
  }
  advance() {
    const t = this.s.tut; const st = STEPS[t.step];
    if (st?.onDone) st.onDone(this.ui);
    t.step++; this.cam0 = null; this.cur = null;
    if (t.step >= STEPS.length) { t.done = true; this.hide(); }
  }
  closeTip() { if (this.tip) { this.s.tut.tips = this.s.tut.tips || {}; this.s.tut.tips[this.tip.id] = true; this.tip = null; this.hide(); } }

  update(dt) {
    const s = this.s, ui = this.ui;
    if (!s || !s.tut) return;
    s.tut.tips = s.tut.tips || {};
    if (ui.game.booting || ui.modals.length) { this.hide(); return; }
    // tutorial principal
    if (!s.tut.done) {
      const st = STEPS[s.tut.step];
      if (!st) { s.tut.done = true; return; }
      if (st.wait && st.wait(s, this, ui)) { this.advance(); return; }
      this.show(st, s.tut.step, STEPS.length, !!st.next, st.last ? 'Começar!' : 'Próximo');
      return;
    }
    // dicas contextuais
    this.tipT += dt;
    if (this.tip) { this.show(this.tip, 0, 0, true, 'Entendi', true); return; }
    this.hide();
    if (this.tipT > 6) {
      for (const t of TIPS) if (!s.tut.tips[t.id] && t.cond(s)) { this.tip = t; this.tipT = 0; break; }
    }
  }
  show(st, idx, total, nextBtn, label, isTip) {
    const ui = this.ui, r = ui.r;
    let rect = null, wpos = null, fromWorld = false;
    let sel = st.target;
    let el = sel && document.querySelector(sel);
    if ((!el || el.offsetParent === null) && st.fallback) el = document.querySelector(st.fallback);
    if (el && el.offsetParent !== null) rect = el.getBoundingClientRect();
    else if (st.world) {
      let p = st.world === 'ghost' ? (r.ghost && { x: (r.ghost.x + 1) * TILE, y: (r.ghost.y + 1) * TILE }) : st.world(ui.s);
      if (p) { fromWorld = true; const sp = r.toScreen(p.x, p.y - 12); rect = { left: sp.x - 36, top: sp.y - 40, width: 72, height: 80, right: sp.x + 36, bottom: sp.y + 40 }; }
      if (st.follow && st.world !== 'ghost' && p) r.following = (typeof st.world === 'function' ? st.world(ui.s) : null);
    }
    if (!st.follow && r.following && !ui.sel) r.following = null;
    const text = typeof st.text === 'function' ? st.text() : st.text;
    this.box.style.display = 'block';
    const html = `<b class="ttl">${st.title}</b>${text}<div class="tb"><span class="step">${isTip ? 'DICA' : `${idx + 1}/${total}`}</span><span>${isTip ? '' : '<button class="btn" data-t="skip">Pular</button> '}${nextBtn ? `<button class="btn pri" data-t="${isTip ? 'ok' : 'next'}">${label}</button>` : ''}</span></div>`;
    if (html !== this._boxHTML) { this._boxHTML = html; this.box.innerHTML = html; } // só reescreve quando muda (senão o clique se perde)
    const W = innerWidth, H = innerHeight, bw = this.box.offsetWidth, bh = this.box.offsetHeight;
    if (rect) {
      const pad = 6;
      this.hole.style.display = isTip ? 'none' : 'block';
      this.hole.style.left = rect.left - pad + 'px'; this.hole.style.top = rect.top - pad + 'px'; this.hole.style.width = rect.width + pad * 2 + 'px'; this.hole.style.height = rect.height + pad * 2 + 'px';
      const below = rect.top + rect.height / 2 < H * 0.5;
      let top = below ? rect.bottom + 26 : rect.top - bh - 26;
      top = Math.max(8, Math.min(H - bh - 8, top));
      let left = Math.max(8, Math.min(W - bw - 8, rect.left + rect.width / 2 - bw / 2));
      // evita cobrir o alvo
      if (top < rect.bottom && top + bh > rect.top && Math.abs((rect.left + rect.width / 2) - (left + bw / 2)) < bw / 2) { top = below ? Math.min(H - bh - 8, rect.bottom + 12) : Math.max(8, rect.top - bh - 12); }
      if (fromWorld) { left = Math.max(8, (W - bw) / 2); top = touch() ? 150 : H * 0.2; } // alvos móveis: caixa fixa (clicável)
      this.box.style.left = left + 'px'; this.box.style.top = top + 'px';
      this.arrow.style.display = 'block'; this.arrow.textContent = below ? '👆' : '👇';
      this.arrow.style.left = rect.left + rect.width / 2 - 14 + 'px'; this.arrow.style.top = (below ? rect.bottom + 2 : rect.top - 36) + 'px';
    } else {
      this.hole.style.display = 'none'; this.arrow.style.display = 'none';
      this.box.style.left = Math.max(8, (W - bw) / 2) + 'px'; this.box.style.top = (touch() ? 130 : H * 0.28) + 'px';
    }
  }
}
