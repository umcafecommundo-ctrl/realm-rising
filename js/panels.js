// panels.js — conteúdo HTML dos painéis (construir, povo, trabalho, política, tecnologia, crônica, conquistas)

import { BUILDINGS, BUILD_CATS, RES, JOBS, JOB_ORDER, TECHS, ERAS, POLICIES, FESTIVAL, SEASONS, ADULT_AGE, ELDER_AGE, DAY_LEN, UNITS } from './data.js';
import { iconURL } from './art.js';
import { buildingSprite } from './art_b.js';
import { unlocked, hasTech, jobUnlocked, countB, timeInfo } from './state.js';
import { jobCounts, techAvailable, festivalReady, reputation, repCost, techDef, leaderOf, faithTier } from './sim.js';
import { avgJoy, foodDays, dailyConsumption, defensePower, capOf } from './core.js';
import { ACHIEVEMENTS } from './quests.js';
import { weeklyList } from './weekly.js';
import { FAITHS, FAITH_STEP, TRAITS } from './data.js';
import { fmt, fmt1 } from './util.js';

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const rimg = (r, sz) => `<img src="${iconURL(r, 40)}" ${sz ? `style="width:${sz}px;height:${sz}px"` : ''} alt="">`;
export function costHTML(cost, s) {
  return `<div class="costs">${Object.entries(cost).map(([r, v]) => `<span class="cost ${s && s.res[r] < v ? 'no' : ''}">${rimg(r)}${v}</span>`).join('') || '<span class="cost">Grátis</span>'}</div>`;
}
const thumbs = {};
export function thumb(type) {
  if (thumbs[type]) return thumbs[type];
  const def = BUILDINGS[type];
  let html;
  if (def.repeat) html = `<div class="emo" style="width:58px;height:58px;font-size:34px;display:flex;align-items:center;justify-content:center">${def.icon}</div>`;
  else {
    const sp = buildingSprite(type, 1);
    const c = document.createElement('canvas'); c.width = 116; c.height = 116;
    const x = c.getContext('2d'); const sc = Math.min(110 / sp.c.width, 110 / sp.c.height);
    x.imageSmoothingQuality = 'high'; x.drawImage(sp.c, (116 - sp.c.width * sc) / 2, 116 - 3 - sp.c.height * sc, sp.c.width * sc, sp.c.height * sc);
    html = `<img src="${c.toDataURL()}" alt="">`;
  }
  return (thumbs[type] = html);
}

export function taskText(p) {
  const t = p.rt?.task; if (p.away > 0) return 'Em missão fora do reino';
  if (!t) return 'Parado';
  switch (t.k) {
    case 'gather': return t.res === 'wood' ? 'Cortando árvores' : t.res === 'stone' ? 'Extraindo pedra' : 'Colhendo frutos';
    case 'water': return 'Buscando água'; case 'hunt': return 'Caçando'; case 'build': return 'Construindo'; case 'sleep': return 'Dormindo';
    case 'eat': return 'Comendo'; case 'drill': return 'Treinando'; case 'play': return 'Brincando'; case 'work': return 'Trabalhando';
    default: return 'Descansando';
  }
}
const needBar = (v, col) => `<span><b style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></b></span>`;
export const needsMini = p => `<div class="mini" title="fome · sono · humor · saúde">${needBar(p.n.hunger, '#e8943a')}${needBar(p.n.sleep, '#6a8ae0')}${needBar(p.n.joy, '#f2c14e')}${needBar(p.n.health, '#62c46a')}</div>`;
export const ageText = p => p.age < ADULT_AGE ? `criança, ${Math.floor(p.age)} anos` : `${Math.floor(p.age)} anos`;

// ---------- Construir ----------
export function buildPanel(s, ui) {
  const cats = BUILD_CATS.filter(c => Object.values(BUILDINGS).some(d => d.cat === c && d.era <= s.era + 1));
  const cat = cats.includes(ui.buildCat) ? ui.buildCat : cats[0];
  ui.buildCat = cat;
  let h = `<button class="btn" data-act="organize" style="width:100%;margin-bottom:8px" data-tip="Move construções fora do lugar para seus distritos (custa 25% do valor das já prontas)">📐 Organizar reino agora</button><div class="pills">${cats.map(c => `<button class="pill ${c === cat ? 'on' : ''}" data-act="cat:${c}">${c}</button>`).join('')}</div><div class="grid">`;
  for (const [id, d] of Object.entries(BUILDINGS)) {
    if (d.cat !== cat || id === 'campfire' || d.era > s.era + 1) continue;
    let lock = '';
    if (s.era < d.era) lock = `Libera na era ${ERAS[d.era].name}`;
    else if (d.tech && !hasTech(s, d.tech)) lock = `Pesquise: ${TECHS[d.tech].name}`;
    const built = d.unique && s.buildings.some(b => b.type === id);
    h += `<button class="bcard ${lock ? 'lock' : ''} ${built ? 'done' : ''}" data-lock="${lock}" data-act="${lock || built ? 'noop' : 'build:' + id}" data-tip="<b>${d.name}</b><br>${d.desc}">
      ${thumb(id)}<div><div class="nm">${d.name}</div><div class="ds">${d.desc}</div>${costHTML(d.cost, s)}</div></button>`;
  }
  return { title: '🔨 Construir', help: 'Escolha uma construção e toque no mapa para posicionar. Os construtores (ou moradores livres) fazem o trabalho sozinhos. Verde = pode construir; vermelho = local inválido. Construções ficam dentro do território dourado — evoluir de era o expande.', html: h + '</div>' };
}

// ---------- Povo ----------
export function peoplePanel(s, ui) {
  const d = s._d; const pop = s.people.length;
  const kids = s.people.filter(p => p.age < ADULT_AGE).length;
  const sick = s.people.filter(p => p.sick > 0).length;
  let h = `<div class="statgrid">
    <div class="stat"><small>Habitantes</small><b>${pop}</b></div><div class="stat"><small>Camas</small><b class="${pop > d.beds ? 'n' : ''}">${d.beds}</b></div>
    <div class="stat"><small>Crianças</small><b>${kids}</b></div><div class="stat"><small>Felicidade</small><b>${Math.round(avgJoy(s))}</b></div>
    <div class="stat"><small>Reputação</small><b>${Math.round(reputation(s))}</b></div><div class="stat"><small>Doentes</small><b class="${sick ? 'n' : ''}">${sick}</b></div></div>
    <div class="help" style="margin-bottom:8px">Barras: 🟠 fome · 🔵 sono · 🟡 humor · 🟢 saúde. Imigrantes chegam quando há camas livres, comida e boa reputação.</div>`;
  const ld = leaderOf(s);
  if (ld) h = `<div class="row" data-act="sel:person:${ld.id}" style="cursor:pointer;border:1px solid rgba(242,193,78,.5)"><span style="font-size:24px">👑</span><div class="grow"><div class="nm">${esc(ld.name)} — Líder do reino (${s.dynasty.gen}ª geração)</div><div class="sub">${(ld.traits || []).map(x => TRAITS[x].icon + ' ' + TRAITS[x].name).join(' · ')}</div></div></div>` + h;
  const list = [...s.people].sort((a, b) => (b.age >= ADULT_AGE) - (a.age >= ADULT_AGE) || a.name.localeCompare(b.name));
  for (const p of list) {
    const j = JOBS[p.job];
    h += `<div class="row" data-act="sel:person:${p.id}" style="cursor:pointer"><span style="font-size:20px">${p.age < ADULT_AGE ? '🧒' : j.icon}</span>
      <div class="grow"><div class="nm">${esc(p.name)} ${p.partner ? '💞' : ''}${p.preg ? '🤰' : ''}${p.sick ? '🤒' : ''}</div><div class="sub">${p.age < ADULT_AGE ? ageText(p) : `${j.name} · ${ageText(p)}`} · ${taskText(p)}</div>${needsMini(p)}</div></div>`;
  }
  return { title: '👥 Povo', help: 'Todos os moradores do reino. Toque em um para acompanhá-lo no mapa. Habilidade melhora com o uso e aumenta a produtividade.', html: h };
}

// ---------- Trabalho ----------
export function jobsPanel(s, ui) {
  const c = jobCounts(s);
  const d = s._d;
  const free = c.livre || 0;
  const au = s.policies.autoJobs;
  let h = `<div class="row" style="flex-wrap:wrap"><span style="font-size:22px">🧭</span><div class="grow"><div class="nm">Distribuição automática</div><div class="sub">Quem está "Livre" vai sozinho para onde há mais necessidade. Escolhas manuais são respeitadas.</div></div><div class="seg" style="min-width:110px"><button class="${!au ? 'on' : ''}" data-act="pol:autoJobs:0">Off</button><button class="${au ? 'on' : ''}" data-act="pol:autoJobs:1">On</button></div></div>
    <div class="help" style="display:${ui.helpOn ? 'block' : 'none'}">Defina quantos moradores trabalham em cada profissão. Moradores <b>Livres</b> ajudam no que for mais necessário, com 70% de eficiência. Edifícios com vagas (serraria, fazenda...) usam trabalhadores da profissão correspondente primeiro.</div>
    <div class="row"><span style="font-size:22px">${JOBS.livre.icon}</span><div class="grow"><div class="nm">Livres</div><div class="sub">${JOBS.livre.desc}</div></div><b style="font-size:18px">${free}</b></div>`;
  for (const j of JOB_ORDER) {
    if (j === 'livre' || !jobUnlocked(s, j)) continue;
    const n = c[j] || 0;
    const slots = d.slots[j] || 0;
    const sub = slots ? `Vagas em edifícios: ${Math.min(n, slots)}/${slots}` : (j === 'soldado' ? `Capacidade: ${n}/${d.soldierCap}` : '');
    const canPlus = (j === 'soldado' ? n < d.soldierCap : true) && (free > 0 || Object.entries(c).some(([k, v]) => k !== j && v > 1));
    h += `<div class="row"><span style="font-size:22px">${JOBS[j].icon}</span><div class="grow"><div class="nm">${JOBS[j].name}</div><div class="sub">${JOBS[j].desc}</div>${sub ? `<div class="sub" style="color:#f2c14e">${sub}</div>` : ''}</div>
      <div class="stepper"><button data-act="job-:${j}" ${n < 1 ? 'disabled' : ''}>−</button><b>${n}</b><button data-act="job+:${j}" ${canPlus ? '' : 'disabled'}>+</button></div></div>`;
  }
  return { title: '⚒️ Trabalho', help: 'Defina quantos moradores trabalham em cada profissão. Moradores <b>Livres</b> ajudam no que for mais necessário (70% de eficiência). Prédios com vagas (serraria, fazenda, mina...) usam trabalhadores da profissão correspondente. Especialistas ganham habilidade com o tempo.', html: h };
}

// ---------- Política ----------
export function policyPanel(s, ui) {
  let h = '';
  for (const [k, p] of Object.entries(POLICIES)) {
    const locked = s.era < p.era;
    if (p.bool) {
      const on = s.policies[k];
      h += `<div class="row" style="flex-wrap:wrap;${locked ? 'opacity:.4' : ''}"><span style="font-size:22px">${p.icon}</span><div class="grow"><div class="nm">${p.name}</div><div class="sub">${p.desc}</div></div>
        <div class="seg" style="min-width:110px"><button class="${!on ? 'on' : ''} ${locked ? 'lockd' : ''}" data-act="pol:${k}:0">Off</button><button class="${on ? 'on' : ''} ${locked ? 'lockd' : ''}" data-act="pol:${k}:1">On</button></div>${locked ? `<div class="sub" style="width:100%">Disponível na era ${ERAS[p.era].name}</div>` : ''}</div>`;
    } else {
      const v = s.policies[k];
      h += `<div class="row" style="flex-wrap:wrap;${locked ? 'opacity:.4' : ''}"><span style="font-size:22px">${p.icon}</span><div class="grow"><div class="nm">${p.name}</div><div class="sub">${p.desc[v]}</div></div>
        <div class="seg" style="width:100%">${p.options.map((o, i) => `<button class="${i === v ? 'on' : ''} ${locked ? 'lockd' : ''}" data-act="pol:${k}:${i}">${o}</button>`).join('')}</div>${locked ? `<div class="sub" style="width:100%">Disponível na era ${ERAS[p.era].name}</div>` : ''}</div>`;
    }
  }
  {
    const hasTemple = s.buildings.some(b => (b.type === 'temple' || b.type === 'cathedral') && b.done);
    const f = s.faith, tier = faithTier(s);
    h += `<div class="sec">Fé</div>` + (!hasTemple && !f.id ? '<div class="help">Construa um <b>Templo</b> (era Cidade) para adotar uma fé. Templos e catedrais geram pontos de fé; a cada dogma o bônus cresce 50%. Reinos da mesma fé gostam mais de você.</div>' :
      `<div class="row" style="flex-wrap:wrap"><div class="grow"><div class="nm">${f.id ? FAITHS[f.id].icon + ' ' + FAITHS[f.id].name : 'Nenhuma fé adotada'}</div><div class="sub">${f.id ? `Dogma ${tier}/3 · ${Math.floor(f.pts)} pontos (${FAITH_STEP} por dogma)` : 'Escolha uma fé:'}</div></div></div>
      <div class="pills">${Object.entries(FAITHS).map(([id, ff]) => `<button class="pill ${f.id === id ? 'on' : ''}" data-act="faith:${id}" data-tip="${ff.desc}${f.id && f.id !== id ? '<br>Trocar custa 100 ouro e metade dos pontos.' : ''}">${ff.icon} ${ff.name}</button>`).join('')}</div>`);
  }
  const left = Math.max(0, s.festival.until - s.t), cd = Math.max(0, s.festival.cooldownUntil - s.t);
  h += `<div class="sec">Festival</div><div class="row"><span style="font-size:22px">🎉</span><div class="grow"><div class="nm">Festival do Reino</div><div class="sub">+${FESTIVAL.joy} felicidade por ${FESTIVAL.days} dias. Custa ${FESTIVAL.cost.food} comida e ${FESTIVAL.cost.water} água.</div>
    <div class="sub" style="color:#f2c14e">${left > 0 ? `Em andamento: ${(left / DAY_LEN).toFixed(1)} dias` : cd > 0 ? `Recarga: ${(cd / DAY_LEN).toFixed(1)} dias` : 'Pronto!'}</div></div>
    <button class="btn pri ${festivalReady(s) && s.res.food >= FESTIVAL.cost.food && s.res.water >= FESTIVAL.cost.water ? '' : 'dis'}" data-act="festival">Celebrar</button></div>`;
  return { title: '⚖️ Política', help: 'Leis têm consequências reais: impostos altos rendem ouro mas irritam o povo; racionamento poupa comida mas deprime; trabalho extra acelera tudo mas cansa. As políticas também valem quando você está ausente — o relatório offline mostra o resultado!', html: h };
}

// ---------- Tecnologia ----------
export function techPanel(s, ui) {
  const maxRow = Math.max(...Object.values(TECHS).map(x => x.pos[0]));
  const cw = 138, ch = 74, W = 3 * cw + 8, H = (maxRow + 1) * ch + 8 + (s.era >= 4 ? 84 : 0);
  // árvore vertical: cada "linha" avança no tempo/era; cabe na largura do painel
  const pos = id => ({ x: TECHS[id].pos[1] * cw + 4, y: TECHS[id].pos[0] * ch + 4 });
  let svg = `<svg class="techsvg" width="${W}" height="${H}">`;
  for (const [id, t] of Object.entries(TECHS)) for (const r of t.req) { const a = pos(r), b = pos(id); svg += `<path d="M${a.x + 62} ${a.y + 58} C ${a.x + 62} ${a.y + 70}, ${b.x + 62} ${b.y - 12}, ${b.x + 62} ${b.y}" stroke="${s.tech.done[r] ? '#62c46a' : 'rgba(255,255,255,.25)'}" stroke-width="2" fill="none"/>`; }
  svg += '</svg>';
  let nodes = '';
  for (const [id, t] of Object.entries(TECHS)) {
    const p = pos(id);
    const done = s.tech.done[id], cur = s.tech.current === id, av = techAvailable(s, id);
    const cls = done ? 'done' : cur ? 'cur' : av ? 'avail' : 'lock';
    const sub = done ? '✔ pesquisado' : cur ? `${Math.floor(s.tech.progress)}/${t.cost} RP` : s.era < t.era ? `Era ${ERAS[t.era].name}` : `${t.cost} RP`;
    nodes += `<button class="tnode ${cls}" style="left:${p.x}px;top:${p.y}px" data-act="${av ? 'tech:' + id : 'techinfo:' + id}" data-tip="<b>${t.name}</b><br>${t.desc}">${t.name}<small>${sub}</small></button>`;
  }
  if (s.era >= 4) { const cost = repCost(s), isCur = s.tech.current === 'rep'; nodes += `<button class="tnode ${isCur ? 'cur' : 'avail'}" style="left:4px;top:${(maxRow + 1) * ch + 8}px;width:${3 * cw - 14}px" data-act="tech:rep" data-tip="<b>Aperfeiçoamento Contínuo</b><br>Pesquisa infinita: +3% coleta/colheita/pesquisa e +2% obra por nível.">♾️ Aperfeiçoamento Contínuo — nível ${s.tech.rep || 0}<small>${isCur ? Math.floor(s.tech.progress) + '/' + cost + ' RP' : cost + ' RP · sem limite'}</small></button>`; }
  const cur = s.tech.current ? techDef(s, s.tech.current) : null;
  const rpd = (s._rpPerDay || 0);
  const head = `<div class="row"><span style="font-size:24px">🔬</span><div class="grow"><div class="nm">${cur ? 'Pesquisando: ' + cur.name : 'Nenhuma pesquisa ativa'}</div>
    <div class="sub">${cur ? cur.desc : `Pontos guardados: ${Math.floor(s.tech.rp)} RP — escolha uma tecnologia dourada.`}</div>
    ${cur ? `<div class="bar" style="margin-top:5px"><span style="width:${Math.min(100, s.tech.progress / cur.cost * 100)}%"></span></div>` : ''}</div><div style="text-align:right"><b>${fmt1(rpd)}</b><div class="sub">RP/dia</div></div></div>`;
  return { title: '🔬 Tecnologia', help: 'Pontos de pesquisa (RP) vêm da curiosidade do povo, de sábios e academias. Tecnologias douradas estão disponíveis; toque para pesquisar. Elas liberam construções e dão bônus permanentes. Role para baixo para ver as eras seguintes.', html: head + `<div class="techwrap"><div style="position:relative;width:${W}px;height:${H}px">${svg}${nodes}</div></div>` };
}

// ---------- Crônica / conquistas ----------
const CK = { era: '👑', birth: '👶', death: '💀', bad: '⚠️', good: '✨', build: '🏗️', tech: '🔬', season: '🍃', event: '❗', war: '⚔️', world: '🗺️', policy: '⚖️', achv: '🏆', info: '•' };
export function chroniclePanel(s, ui) {
  const f = ui.chrFilter || 'all';
  const sets = { all: null, event: ['event', 'bad', 'good'], war: ['war', 'world'], people: ['birth', 'death'], build: ['build', 'tech', 'era', 'achv'] };
  const names = { all: 'Tudo', event: 'Eventos', war: 'Guerra/Mundo', people: 'Povo', build: 'Progresso' };
  const items = [...s.chronicle].reverse().filter(c => !sets[f] || sets[f].includes(c.kind)).slice(0, 120);
  return { title: '📜 Crônica do Reino', help: 'O histórico dos principais acontecimentos do seu reino: nascimentos, mortes, construções, eventos, guerras e descobertas.',
    html: `<div class="pills">${Object.keys(sets).map(k => `<button class="pill ${k === f ? 'on' : ''}" data-act="chr:${k}">${names[k]}</button>`).join('')}</div>` +
      (items.map(c => `<div class="chr"><span class="d">Dia ${c.day + 1}</span><span class="ic">${CK[c.kind] || '•'}</span><span>${esc(c.text)}</span></div>`).join('') || '<p>Nada ainda.</p>') };
}
export function achievementsPanel(s) {
  const n = Object.keys(s.achievements).length;
  const wk = weeklyList(s);
  const wkH = wk.length ? `<div class="sec">📅 Desafios da semana (+1 Legado cada)</div>` + wk.map(g => `<div class="goal" style="padding:6px 0"><div class="t"><span>${g.done ? '✅ ' : ''}${esc(g.text)}</span><i>${g.cur}/${g.target}</i></div><div class="bar"><span style="width:${g.cur / g.target * 100}%"></span></div></div>`).join('') + `<div class="sec">Conquistas</div>` : '';
  return { title: `🏆 Conquistas (${n}/${ACHIEVEMENTS.length})`, help: 'Conquistas marcam seus feitos. Os desafios da semana mudam toda semana e dão Legado permanente.',
    html: wkH + ACHIEVEMENTS.map(a => { const got = s.achievements[a.id]; return `<div class="achv ${got ? '' : 'lock'}"><span class="ic">${a.icon}</span><div><b>${a.name}</b><small>${a.desc}${got ? ` · Dia ${got}` : ''}</small></div></div>`; }).join('') };
}
