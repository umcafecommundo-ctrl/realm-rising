// events.js — eventos aleatórios com 2–3 opções e consequências reais.
// Instâncias são guardadas no save como { id, p: parâmetros }; as definições (funções) ficam aqui.

import { DAY_LEN, BUILDINGS, RES, ADULT_AGE, SEASON_DAYS, YEAR_DAYS } from './data.js';
import { timeInfo, countB, techFx } from './state.js';
import { leaderOf, setLeader } from './sim.js';
import { addRes, canAfford, spend, chron, toast, killSome, addPerson, avgJoy, foodDays, defensePower, soldiersOf, adultsOf, costStr, capOf, killPerson, bus } from './core.js';
import { clamp, rnd, rint, chance, pick } from './util.js';
import { fairPower } from './war.js';
import { kingdomById, changeRel, payTribute, refuseTribute, acceptAlliance, startRoute, proposeFromEnvoy } from './world.js';

const PRICE = { wood: 1, stone: 1.4, food: 1, water: 0.5, planks: 2.5, tools: 6, cloth: 4, iron: 3.5, gold: 5, weapons: 8, jewels: 15 };
const pct = (s, r, f) => { const v = Math.floor(s.res[r] * f); addRes(s, r, -v, { noStat: true }); return v; };
const day = s => timeInfo(s).day;

function threatPower(s, k = 1) { return Math.round((2 + s.era * 1.8 + day(s) * 0.05) * k); }
function pushThreat(s, kind, power, label, delay = 0.3) {
  if (kind === 'wolves' || kind === 'bandits') power = Math.max(3, Math.min(power, fairPower(s, power, kind) * (0.85 + Math.random() * 0.4)));
  const t = { id: (s._tid = (s._tid || 0) + 1), kind, power, label, at: s.t + DAY_LEN * delay };
  s.threats.push(t); return t;
}
function damageRandomBuilding(s, destroy) {
  const cand = s.buildings.filter(b => b.done && b.type !== 'campfire' && b.type !== 'road' && b.type !== 'wall');
  if (!cand.length) return null;
  const b = pick(cand);
  if (destroy) { s.buildings.splice(s.buildings.indexOf(b), 1); s._dirty = true; bus.emit('burned', b); }
  return b;
}

export const EVENTS = {
  // ----- Natureza -----
  wolves: {
    title: 'Lobos rondam o acampamento', icon: '🐺', era: [1, 5], weight: s => (timeInfo(s).day >= 8 && s.people.length >= 3 ? 3 : 0), cd: 7,
    text: s => 'Uivos ecoam na floresta. Um bando de lobos famintos se aproxima, atraído pelo cheiro de comida.',
    options: [
      { label: 'Acender fogueiras e vigiar', hint: 'Custa 10 madeira. Lobos ficam receosos (-40% de força).', need: { wood: 10 },
        fx: s => { spend(s, { wood: 10 }); pushThreat(s, 'wolves', threatPower(s, 0.6), 'Lobos'); return 'Fogueiras são acesas ao redor do acampamento. Os lobos se aproximam, mas hesitam.'; } },
      { label: 'Enviar os caçadores', hint: 'Sem custo. A defesa depende de caçadores e soldados.',
        fx: s => { pushThreat(s, 'wolves', threatPower(s, 0.9), 'Lobos'); return 'Os caçadores pegam suas lanças e esperam na borda da clareira.'; } },
      { label: 'Esconder-se e rezar', hint: 'Sem custo, mas arriscado: força total dos lobos.',
        fx: s => { pushThreat(s, 'wolves', threatPower(s, 1.2), 'Lobos'); return 'Todos se trancam nos abrigos. Resta esperar.'; } },
    ], auto: s => (s.res.wood >= 10 ? 0 : 1),
  },
  harsh_winter: {
    title: 'Inverno rigoroso à vista', icon: '🥶', era: [1, 5], weight: s => (timeInfo(s).season === 2 ? 5 : 0), cd: YEAR_DAYS - 2,
    text: s => 'Os anciões sentem no ar: este será um inverno muito mais cruel que o normal. Ventos gelados e neve profunda virão.',
    options: [
      { label: 'Estocar lenha agora', hint: 'Custa 30 madeira. Reduz o impacto do frio.', need: { wood: 30 },
        fx: s => { spend(s, { wood: 30 }); s.flags.harshUntil = s.t + DAY_LEN * 4; return 'Todos ajudam a empilhar lenha. O inverno será duro, mas suportável.'; } },
      { label: 'Racionar desde já', hint: 'Ativa o racionamento (menos felicidade, menos fome).',
        fx: s => { s.policies.ration = true; s.flags.harshUntil = s.t + DAY_LEN * 7; return 'O racionamento é decretado. Cada migalha conta.'; } },
      { label: 'Confiar nos deuses', hint: 'Sem custo. O frio será implacável.',
        fx: s => { s.flags.harshUntil = s.t + DAY_LEN * 9; return 'Nada é feito. O inverno chega com todo o seu rigor.'; } },
    ], auto: s => (s.res.wood >= 40 ? 0 : 1),
  },
  crop_blight: {
    title: 'Praga na plantação', icon: '🐛', era: [2, 5], weight: s => (countB(s, 'farm') && timeInfo(s).season < 3 ? 4 : 0), cd: 10,
    text: s => 'Pragas devoram as folhas das lavouras. Se nada for feito, a colheita será perdida.',
    options: [
      { label: 'Queimar os campos infectados', hint: 'Perde 15% da comida, mas contém a praga.', fx: s => { const v = pct(s, 'food', 0.15); return `Os campos queimam. Perda de ${v} comida, mas a praga foi contida.`; } },
      { label: 'Tratar com água e cinzas', hint: 'Custa 20 água. 60% de chance de salvar tudo.', need: { water: 20 },
        fx: s => { spend(s, { water: 20 }); if (chance(0.6)) return 'O tratamento funcionou! As lavouras foram salvas.'; const v = pct(s, 'food', 0.3); return `O tratamento falhou. Perdemos ${v} de comida.`; } },
      { label: 'Ignorar', hint: 'Perde 30% da comida.', fx: s => { const v = pct(s, 'food', 0.3); return `A praga se espalha: ${v} de comida perdida.`; } },
    ], auto: s => (s.res.water >= 40 ? 1 : 0),
  },
  illness: {
    title: 'Surto de doença', icon: '🤒', era: [1, 5], weight: s => (s.people.length >= 4 ? 3 : 0), cd: 8,
    text: s => 'Febre e tosse se espalham pelo povoado. Vários moradores estão de cama.',
    options: [
      { label: 'Ervas medicinais', hint: 'Custa 15 água e 10 comida. Cura rápido.', need: { water: 15, food: 10 },
        fx: s => { spend(s, { water: 15, food: 10 }); for (const p of s.people) if (p.sick) p.sick = 0; for (const p of s.people) p.n.health = Math.min(100, p.n.health + 15); return 'Chás e ervas aliviam os doentes. Todos se recuperam logo.'; } },
      { label: 'Isolar os doentes', hint: 'Sem custo. Doença se espalha menos, mas é demorada.',
        fx: s => { const sick = pick(adultsOf(s)); s.people.filter(p => chance(0.3)).forEach(p => p.sick = 3); return 'Os doentes são isolados. A recuperação será lenta.'; } },
      { label: 'Deixar o destino decidir', hint: 'Sem custo. Risco de mortes.',
        fx: s => { for (const p of s.people) if (chance(0.45)) p.sick = 5; const n = chance(0.5) ? 1 : 0; const names = killSome(s, n, 'não resistiu à doença'); return names.length ? `${names[0]} não resistiu à doença.` : 'Muitos adoecem, mas todos sobrevivem.'; } },
    ], auto: s => (s.res.water >= 30 && s.res.food >= 25 ? 0 : 1),
  },
  fire: {
    title: 'Incêndio!', icon: '🔥', era: [1, 5], weight: s => (s.buildings.filter(b => b.done && b.type !== 'campfire' && b.type !== 'road').length >= 2 ? 3 : 0), cd: 9,
    text: s => 'Uma faísca incendeia uma das construções! As chamas ameaçam se espalhar.',
    options: [
      { label: 'Combater com água', hint: 'Custa 25 água. Boa chance de salvar tudo.', need: { water: 25 },
        fx: s => { spend(s, { water: 25 }); if (chance(0.85)) return 'Uma corrente de baldes apaga o fogo a tempo. Nada se perde!'; const b = damageRandomBuilding(s, true); return b ? `O fogo vence: ${BUILDINGS[b.type].name} é destruído(a).` : 'O fogo se apaga sozinho.'; } },
      { label: 'Derrubar o que está perto', hint: 'Sem custo: perde 10 madeira e 5 pedra, mas evita o pior.',
        fx: s => { pct(s, 'wood', 0.1); pct(s, 'stone', 0.05); if (chance(0.5)) return 'O aceiro funcionou. O fogo morre sem estragos graves.'; const b = damageRandomBuilding(s, true); return b ? `${BUILDINGS[b.type].name} se perde nas chamas.` : 'O fogo se apaga.'; } },
      { label: 'Deixar queimar', hint: 'Perde a construção.', fx: s => { const b = damageRandomBuilding(s, true); return b ? `${BUILDINGS[b.type].name} é consumido(a) pelo fogo.` : 'Felizmente nada importante queimou.'; } },
    ], auto: s => (s.res.water >= 40 ? 0 : 1),
  },
  drought: {
    title: 'Seca', icon: '🏜️', era: [1, 5], weight: s => (timeInfo(s).season === 1 ? 4 : 0), cd: YEAR_DAYS - 2,
    text: s => 'O sol castiga sem piedade e as chuvas somem. Poços e riachos baixam. A água será escassa.',
    options: [
      { label: 'Cavar mais fundo', hint: 'Custa 20 pedra. Reduz o impacto da seca.', need: { stone: 20 },
        fx: s => { spend(s, { stone: 20 }); s.flags.droughtUntil = s.t + DAY_LEN * 2; return 'Os poços são aprofundados. A seca será branda.'; } },
      { label: 'Racionar água', hint: 'Ativa o racionamento.', fx: s => { s.policies.ration = true; s.flags.droughtUntil = s.t + DAY_LEN * 4; return 'A água é racionada. Todos precisam economizar.'; } },
      { label: 'Esperar a chuva', hint: 'Seca prolongada.', fx: s => { s.flags.droughtUntil = s.t + DAY_LEN * 5; return 'Ninguém faz nada. A seca castiga o reino.'; } },
    ], auto: s => (s.res.stone >= 30 ? 0 : 1),
  },
  harvest: {
    title: 'Colheita farta', icon: '🌽', era: [1, 5], weight: s => (timeInfo(s).season === 2 ? 4 : 0), cd: YEAR_DAYS - 2,
    text: s => 'O outono foi generoso! As frutas e grãos amadureceram além do esperado.',
    options: [{ label: 'Agradecer e colher', hint: '+30 comida e +5 felicidade.', fx: s => { const v = Math.round(30 + s.people.length * 1.5); addRes(s, 'food', v); for (const p of s.people) p.n.joy = Math.min(100, p.n.joy + 5); return `Celeiros cheios! +${v} de comida.`; } }],
    auto: () => 0,
  },
  // ----- Pessoas -----
  merchant: {
    title: 'Mercador viajante', icon: '🧳', era: [1, 5], weight: s => (s.people.length >= 3 ? 4 : 0), cd: 6,
    gen: s => {
      const sells = ['stone', 'planks', 'tools', 'cloth', 'iron', 'wood', 'food'].filter(r => (r === 'planks' ? s.era >= 2 : r === 'tools' || r === 'cloth' || r === 'iron' ? s.era >= 2 : true));
      const buys = ['wood', 'stone', 'food', 'water', 'planks', 'iron', 'gold'].filter(r => r !== 'gold' || s.era >= 3);
      const A = pick(sells);
      let B = buys.filter(r => r !== A).sort((x, y) => s.res[y] / Math.max(1, capOf(s, y)) - s.res[x] / Math.max(1, capOf(s, x)))[0];
      const amtA = clamp(Math.round(capOf(s, A) * 0.18 / 5) * 5, 10, 60);
      const amtB = Math.max(5, Math.round(amtA * PRICE[A] / PRICE[B] * 1.2));
      return { A, B, amtA, amtB };
    },
    text: (s, p) => `Um mercador de carroça oferece ${p.amtA} de ${RES[p.A].name.toLowerCase()} em troca de ${p.amtB} de ${RES[p.B].name.toLowerCase()}.`,
    options: [
      { label: 'Aceitar a troca', hint: (s, p) => `Dá ${p.amtB} ${RES[p.B].name}, recebe ${p.amtA} ${RES[p.A].name}.`, need: (s, p) => ({ [p.B]: p.amtB }),
        fx: (s, p) => { spend(s, { [p.B]: p.amtB }); addRes(s, p.A, p.amtA); s.stats.tradesDone++; return `Negócio fechado: +${p.amtA} ${RES[p.A].name}.`; } },
      { label: 'Pechinchar', hint: (s, p) => '50%: preço 30% menor. 50%: o mercador vai embora.', need: (s, p) => ({ [p.B]: Math.round(p.amtB * 0.7) }),
        fx: (s, p) => { if (chance(0.5)) { const c = Math.round(p.amtB * 0.7); spend(s, { [p.B]: c }); addRes(s, p.A, p.amtA); s.stats.tradesDone++; return `Ótima pechincha! Pagou só ${c} ${RES[p.B].name}.`; } return 'O mercador se ofende e parte sem negócio.'; } },
      { label: 'Recusar', hint: 'Nada acontece.', fx: s => 'O mercador segue viagem.' },
    ], auto: () => 2,
  },
  refugees: {
    title: 'Refugiados pedem abrigo', icon: '🧑‍🤝‍🧑', era: [1, 5], weight: s => (s.policies.border === 0 && s.people.length >= 3 ? 3 : 0), cd: 10,
    gen: s => ({ n: clamp(rint(2, 4) + Math.floor(s.era / 2), 2, 7) }),
    text: (s, p) => `${p.n} refugiados exaustos, fugindo de uma guerra distante, imploram por abrigo e comida.`,
    options: [
      { label: 'Acolher todos', hint: (s, p) => `+${p.n} moradores. Pressão sobre comida e camas.`, fx: (s, p) => { for (let i = 0; i < p.n; i++) addPerson(s, { age: rint(14, 40), f: i % 2 === 0 }); s.stats.immigrants += p.n; return `${p.n} refugiados se juntam ao povo. Agradecidos, prometem trabalhar duro.`; } },
      { label: 'Acolher só os aptos', hint: (s, p) => `+${Math.ceil(p.n / 2)} moradores.`, fx: (s, p) => { const n = Math.ceil(p.n / 2); for (let i = 0; i < n; i++) addPerson(s, { age: rint(18, 34), f: i % 2 === 0 }); s.stats.immigrants += n; return `${n} refugiados fortes são aceitos. Os demais seguem viagem.`; } },
      { label: 'Recusar', hint: '-5 de felicidade (consciência pesada).', fx: s => { for (const p of s.people) p.n.joy = Math.max(0, p.n.joy - 5); return 'Os refugiados partem. Muitos aldeões ficam amargurados.'; } },
    ], auto: s => (foodDays(s) > 8 && s._d && s.people.length < s._d.beds ? 0 : 2),
  },
  ore: {
    title: 'Veio de minério descoberto', icon: '⛏️', era: [1, 5], weight: s => (!s.flags.ore ? 4 : 0), cd: 99,
    text: s => 'Pedreiros notam manchas alaranjadas numa encosta rochosa: um rico veio de minério de ferro!',
    options: [
      { label: 'Registrar o local', hint: 'Libera ferro para a mina (era 3).', fx: s => { s.flags.ore = true; return 'O veio é marcado no mapa. Com metalurgia e uma mina, o ferro será seu.'; } },
      { label: 'Explorar de imediato', hint: 'Custa 10 comida. +12 ferro agora.', need: { food: 10 }, fx: s => { spend(s, { food: 10 }); s.flags.ore = true; addRes(s, 'iron', 12); return 'Uma pequena expedição traz os primeiros 12 de ferro!'; } },
    ], auto: () => 0,
  },
  festival_ev: {
    title: 'O povo quer festejar', icon: '🎉', era: [1, 5], weight: s => (s.people.length >= 5 && s.res.food > 40 && s.t >= s.festival.cooldownUntil ? 3 : 0), cd: 8,
    text: s => 'Aldeões sugerem um festival para celebrar a vida. Música, dança e uma boa fogueira!',
    options: [
      { label: 'Organizar o festival', hint: 'Custa 30 comida e 10 água. +20 felicidade por 2 dias.', need: { food: 30, water: 10 }, fx: s => { spend(s, { food: 30, water: 10 }); s.festival.until = s.t + DAY_LEN * 2; s.festival.cooldownUntil = s.t + DAY_LEN * 8; s.stats.festivals++; return 'A noite é de festa! Risos e música ecoam pela floresta.'; } },
      { label: 'Adiar', hint: 'Sem custo.', fx: s => { for (const p of s.people) p.n.joy = Math.max(0, p.n.joy - 3); return 'Os aldeões voltam ao trabalho, um pouco desapontados.'; } },
    ], auto: s => (s.res.food > 120 ? 0 : 1),
  },
  hero: {
    title: 'Um herói surge', icon: '🦸', era: [2, 5], weight: s => (s.people.some(p => !p.hero && p.age >= ADULT_AGE && Object.values(p.skill).some(v => v >= 3)) ? 2 : 0), cd: 15,
    gen: s => { const c = s.people.filter(p => !p.hero && p.age >= ADULT_AGE).sort((a, b) => Math.max(...Object.values(b.skill), 0) - Math.max(...Object.values(a.skill), 0))[0]; return { id: c?.id }; },
    text: (s, p) => { const q = s.people.find(x => x.id === p.id); return `${q ? q.name : 'Um morador'} salvou uma criança do rio e demonstrou grande coragem e talento. O povo o aclama!`; },
    options: [{ label: 'Nomear campeão do povo', hint: '+35% de produtividade para ele e +8 de felicidade.', fx: (s, p) => { const q = s.people.find(x => x.id === p.id); if (q) { q.hero = true; q.name = '⭐ ' + q.name.replace('⭐ ', ''); for (const j in q.skill) q.skill[j] += 1.5; } for (const x of s.people) x.n.joy = Math.min(100, x.n.joy + 8); return 'Nasce uma lenda! O povo se enche de orgulho.'; } }],
    auto: () => 0,
  },
  prodigy: {
    title: 'Criança prodígio', icon: '🧒', era: [2, 5], weight: s => (s.people.some(p => p.age < ADULT_AGE) ? 2 : 0), cd: 14,
    text: s => 'Uma criança surpreende os anciões com perguntas e ideias incríveis sobre o mundo.',
    options: [
      { label: 'Incentivar os estudos', hint: 'Custa 10 comida. +40 pontos de pesquisa.', need: { food: 10 }, fx: s => { spend(s, { food: 10 }); if (s.tech.current) s.tech.progress += 40; else s.tech.rp += 40; return 'O jovem sábio faz descobertas notáveis! +40 de pesquisa.'; } },
      { label: 'Deixar brincar', hint: 'Sem custo.', fx: s => 'A criança volta a brincar, feliz.' },
    ], auto: s => (s.res.food >= 40 ? 0 : 1),
  },
  stranger: {
    title: 'Estranho ferido', icon: '🩹', era: [1, 5], weight: s => (s.people.length >= 3 ? 2 : 0), cd: 10,
    text: s => 'Um viajante ferido cai desmaiado na entrada do povoado. Será um amigo ou uma ameaça?',
    options: [
      { label: 'Cuidar dele', hint: 'Custa 8 comida e 5 água. Pode virar um morador habilidoso.', need: { food: 8, water: 5 }, fx: s => { spend(s, { food: 8, water: 5 }); if (chance(0.7)) { const q = addPerson(s, { age: rint(24, 40) }); for (const j of ['lenhador', 'pedreiro', 'cacador', 'construtor']) q.skill[j] = rnd(2, 4); chron(s, `${q.name}, um viajante resgatado, decidiu ficar.`, 'birth'); return `${q.name} se recupera e decide ficar, grato e habilidoso!`; } s.res.food = Math.max(0, s.res.food - 5); return 'O viajante se recupera, rouba um pouco de comida e foge à noite.'; } },
      { label: 'Expulsar', hint: 'Sem custo.', fx: s => 'O estranho é levado para longe da vila.' },
    ], auto: s => (s.res.food >= 30 && s.res.water >= 15 ? 0 : 1),
  },
  rebellion: {
    title: 'Rebelião!', icon: '✊', era: [2, 5], weight: s => (avgJoy(s) < 28 && s.people.length >= 6 ? 10 : 0), cd: 6,
    text: s => 'O povo está furioso! Uma multidão se reúne com tochas e forcados exigindo mudanças.',
    options: [
      { label: 'Ceder às exigências', hint: 'Impostos baixos, sem trabalho extra/racionamento. +felicidade.', fx: s => { s.policies.tax = 0; s.policies.overtime = false; s.policies.ration = false; s.policies.conscription = false; for (const p of s.people) p.n.joy = Math.min(100, p.n.joy + 15); return 'As políticas são revistas. O povo se acalma.'; } },
      { label: 'Reprimir com soldados', hint: 'Precisa de 2+ soldados. Mortes e ressentimento.', need: s => (soldiersOf(s).length >= 2 ? {} : { __: 1 }),
        fx: s => { const names = killSome(s, 1, 'morreu na repressão'); for (const p of s.people) p.n.joy = Math.max(0, p.n.joy - 8); return `A revolta é esmagada, ${names[0] || 'um morador'} perde a vida. O medo reina.`; } },
      { label: 'Ignorar', hint: 'Saques: perde 25% de comida e ouro; fugas.', fx: s => { pct(s, 'food', 0.25); pct(s, 'gold', 0.25); const adults = adultsOf(s); for (let i = 0; i < 2 && s.people.length > 3; i++) { const v = pick(adults); if (v) { s.people.splice(s.people.indexOf(v), 1); } } return 'Depósitos são saqueados e alguns moradores abandonam o reino.'; } },
    ], auto: s => (soldiersOf(s).length >= 3 ? 1 : 0),
  },
  bandits: {
    title: 'Bandidos à vista', icon: '🗡️', era: [2, 5], weight: s => (s.people.length >= 8 ? 3 : 0), cd: 8,
    gen: s => ({ pay: s.era >= 3 ? { gold: 30 + s.era * 15 } : { food: 30 }, power: threatPower(s, 1.4) }),
    text: (s, p) => `Um grupo de bandidos exige tributo (${costStr(p.pay)}) para deixar o povoado em paz. Dizem que voltarão se recusarmos.`,
    options: [
      { label: 'Pagar o tributo', hint: (s, p) => `Custa ${costStr(p.pay)}.`, need: (s, p) => p.pay, fx: (s, p) => { spend(s, p.pay); return 'Os bandidos recebem e se vão, rindo.'; } },
      { label: 'Lutar', hint: (s, p) => `Defesa ${Math.round(defensePower(s))} contra ~${p.power}.`, fx: (s, p) => { pushThreat(s, 'bandits', p.power, 'Bandidos', 0.3); return 'Os homens pegam em armas. Os bandidos avançam!'; } },
      { label: 'Esconder o estoque', hint: 'Metade do saque, mas sem proteção.', fx: (s, p) => { pushThreat(s, 'bandits', p.power * 1.4, 'Bandidos', 0.3); s.threats[s.threats.length - 1].hidden = true; return 'Os suprimentos são escondidos na mata, e todos se escondem.'; } },
    ], auto: s => (defensePower(s) > threatPower(s, 1.6) ? 1 : 0),
  },
  storm_dmg: {
    title: 'Tempestade devastadora', icon: '⛈️', era: [1, 5], weight: s => (s.weather.type === 'storm' && s.buildings.length > 2 ? 6 : 1), cd: 8,
    text: s => 'Ventos violentos arrancam telhados e derrubam árvores. Há estragos em uma construção.',
    options: [
      { label: 'Reparar com tábuas/madeira', hint: 'Custa 12 madeira.', need: { wood: 12 }, fx: s => { spend(s, { wood: 12 }); return 'Os reparos são feitos rapidamente.'; } },
      { label: 'Deixar para depois', hint: 'Perde 8 madeira e 3 pedra; felicidade -3.', fx: s => { pct(s, 'wood', 0.1); pct(s, 'stone', 0.05); for (const p of s.people) p.n.joy -= 3; return 'Goteiras e frio aborrecem o povo.'; } },
    ], auto: s => (s.res.wood >= 25 ? 0 : 1),
  },
  // ----- Dinastia / desastres -----
  succession: {
    title: 'Disputa pelo trono', icon: '👑', era: [1, 6], weight: () => 0, cd: 0,
    text: s => 'O líder do reino se foi sem herdeiro direto. Facções disputam o poder: os anciões querem o mais capaz, o povo quer uma eleição.',
    options: [
      { label: 'Nomear o mais capaz', hint: 'O morador de maior habilidade assume.', fx: s => { const a = s.people.filter(p => p.age >= 14); const p = a.sort((x, y) => Math.max(0, ...Object.values(y.skill || {})) - Math.max(0, ...Object.values(x.skill || {})))[0]; if (p) setLeader(s, p, 'nomeado pelos anciões'); return 'Os anciões coroam o mais capaz.'; } },
      { label: 'Eleição popular', hint: '+6 felicidade; o mais querido assume.', fx: s => { const a = s.people.filter(p => p.age >= 14); const p = a.sort((x, y) => y.n.joy - x.n.joy)[0]; if (p) setLeader(s, p, 'eleito pelo povo'); for (const q of s.people) q.n.joy = Math.min(100, q.n.joy + 6); return 'O povo vai às urnas e escolhe seu líder.'; } },
    ], auto: () => 0,
  },
  earthquake: {
    title: 'Terremoto', icon: '🌋', era: [4, 6], weight: s => (s.buildings.length >= 15 ? 2 : 0), cd: 40,
    text: s => 'O chão treme com violência. Muros racham e telhados desabam por todo o reino.',
    options: [
      { label: 'Escorar tudo com pedra', hint: 'Custa 60 pedra. Quase nenhuma perda.', need: { stone: 60 }, fx: s => { spend(s, { stone: 60 }); return 'As estruturas escoradas resistem ao tremor.'; } },
      { label: 'Reconstruir depois', hint: 'Perde 1–2 construções.', fx: s => { const n = chance(0.5) ? 2 : 1; let lost = []; for (let i = 0; i < n; i++) { const b = damageRandomBuilding(s, true); if (b) lost.push(BUILDINGS[b.type].name); } return lost.length ? `Desabaram: ${lost.join(', ')}.` : 'Por sorte nada de importante caiu.'; } },
    ], auto: s => (s.res.stone >= 100 ? 0 : 1),
  },
  horde: {
    title: 'Horda bárbara', icon: '🪓', era: [5, 6], weight: s => (s.people.length >= 60 ? 3 : 0), cd: 30,
    gen: s => ({ pay: { gold: 300 + s.era * 80 } }),
    text: (s, p) => 'Uma enorme horda se junta além das fronteiras e marcha para o reino. Eles não negociam como os outros reinos — mas aceitam ouro para recuar.',
    options: [
      { label: 'Pagar para recuarem', hint: (s, p) => `Custa ${costStr(p.pay)}.`, need: (s, p) => p.pay, fx: (s, p) => { spend(s, p.pay); return 'A horda leva o ouro e desaparece nas montanhas.'; } },
      { label: 'Resistir nas muralhas', hint: 'Combate real: força muito acima do normal.', fx: s => { pushThreat(s, 'army', Math.round(defensePower(s) * 1.35 + s.era * 12), 'Horda Bárbara', 1.4); return 'Os sinos soam: todos às armas!'; } },
    ], auto: (s, p) => (canAfford(s, p.pay) ? 0 : 1),
  },
  great_famine: {
    title: 'Grande Fome', icon: '🥀', era: [3, 6], weight: s => (s.people.length >= 25 ? 2 : 0), cd: 45,
    text: s => 'Uma terrível ferrugem apodrece os celeiros. Metade dos grãos estocados se perde.',
    options: [
      { label: 'Importar grãos', hint: 'Custa 200 ouro: +120 comida.', need: { gold: 200 }, fx: s => { spend(s, { gold: 200 }); pct(s, 'food', 0.2); addRes(s, 'food', 120); return 'Caravanas trazem grãos de longe. A fome é contida.'; } },
      { label: 'Apertar o cinto', hint: 'Perde 45% da comida e ativa racionamento.', fx: s => { pct(s, 'food', 0.45); s.policies.ration = true; return 'O povo aperta o cinto. Racionamento decretado.'; } },
    ], auto: s => (s.res.gold >= 400 ? 0 : 1),
  },
  // ----- Eras avançadas -----
  comet: {
    title: 'Cometa no céu', icon: '☄️', era: [3, 6], weight: s => 2, cd: 20,
    text: s => 'Um cometa brilhante cruza o céu. Uns veem um presságio, outros uma oportunidade de estudo.',
    options: [
      { label: 'Estudar o fenômeno', hint: '+60 pontos de pesquisa.', fx: s => { if (s.tech.current) s.tech.progress += 60; else s.tech.rp += 60; return 'Os sábios registram tudo. +60 de pesquisa!'; } },
      { label: 'Celebrar o presságio', hint: '+8 felicidade.', fx: s => { for (const p of s.people) p.n.joy = Math.min(100, p.n.joy + 8); return 'O povo vê boa sorte no céu e se anima.'; } },
    ], auto: () => 0,
  },
  royal_wedding: {
    title: 'Casamento real', icon: '💒', era: [4, 6], weight: s => (s.people.length >= 30 ? 3 : 0), cd: 25,
    text: s => 'Nobres de reinos vizinhos pedem para casar suas famílias com as do seu reino, trazendo dotes generosos.',
    options: [
      { label: 'Aceitar as bodas', hint: '+120 ouro e +10 felicidade.', fx: s => { addRes(s, 'gold', 120); for (const p of s.people) p.n.joy = Math.min(100, p.n.joy + 10); return 'Banquetes, música e um bom dote: +120 ouro.'; } },
      { label: 'Recusar com educação', hint: 'Sem efeito.', fx: s => 'Os nobres partem sem ressentimentos.' },
    ], auto: () => 0,
  },
  great_plague: {
    title: 'A Grande Peste', icon: '☠️', era: [4, 6], weight: s => (s.people.length >= 40 ? 2 : 0), cd: 40,
    text: s => 'Uma peste terrível chega com os mercadores. Cidades inteiras estão em perigo.',
    options: [
      { label: 'Quarentena total', hint: 'Custa 40 comida e 30 água. Poucos adoecem.', need: { food: 40, water: 30 }, fx: s => { spend(s, { food: 40, water: 30 }); for (const p of s.people) if (chance(0.08)) p.sick = 4; return 'Portões fechados e hospitais de campanha: a peste é contida.'; } },
      { label: 'Orar e esperar', hint: 'Muitos adoecem; risco de mortes.', fx: s => { for (const p of s.people) if (chance(0.4)) p.sick = 5; const n = killSome(s, Math.max(1, Math.floor(s.people.length * 0.04)), 'sucumbiu à Grande Peste'); return `A peste cobra seu preço: ${n.length} morte(s) e muitos doentes.`; } },
    ], auto: s => (s.res.food >= 80 && s.res.water >= 50 ? 0 : 1),
  },
  // ----- Diplomacia (geradas por world.js) -----
  k_tribute: {
    title: 'Exigência de tributo', icon: '📜', era: [3, 5], weight: () => 0, cd: 0,
    text: (s, p) => { const k = kingdomById(s, p.k); return `Enviados de ${k?.name} exigem tributo (${costStr(p.pay)}) "pela proteção" de suas terras. Recusar pode significar guerra.`; },
    options: [
      { label: 'Pagar', hint: (s, p) => `Custa ${costStr(p.pay)}. Relações melhoram.`, need: (s, p) => p.pay, fx: (s, p) => payTribute(s, p) },
      { label: 'Recusar', hint: 'Relações pioram e eles podem atacar.', fx: (s, p) => refuseTribute(s, p) },
    ], auto: (s, p) => (s.policies.stance === 0 && canAfford(s, p.pay) ? 0 : 1),
  },
  k_trade: {
    title: 'Proposta comercial', icon: '🤝', era: [3, 5], weight: () => 0, cd: 0,
    text: (s, p) => { const k = kingdomById(s, p.k); return `${k?.name} propõe uma rota comercial regular: você envia ${p.give.amt} ${RES[p.give.res].name.toLowerCase()} e recebe ${p.get.amt} ${RES[p.get.res].name.toLowerCase()} a cada ${p.every} dias.`; },
    options: [
      { label: 'Aceitar a rota', hint: 'Caravanas viajarão entre os reinos.', fx: (s, p) => startRoute(s, p) },
      { label: 'Recusar', hint: 'Sem efeito.', fx: (s, p) => { const k = kingdomById(s, p.k); if (k) changeRel(s, k, -3); return 'A proposta é recusada educadamente.'; } },
    ], auto: (s, p) => (s.res[p.give.res] > p.give.amt * 4 ? 0 : 1),
  },
  k_alliance: {
    title: 'Proposta de aliança', icon: '🕊️', era: [3, 5], weight: () => 0, cd: 0,
    text: (s, p) => { const k = kingdomById(s, p.k); return `${k?.name} deseja selar uma aliança de ajuda mútua. Aliados não se atacam e podem enviar tropas.`; },
    options: [
      { label: 'Aceitar a aliança', hint: '+relações, proteção contra outros reinos.', fx: (s, p) => acceptAlliance(s, p) },
      { label: 'Recusar', hint: 'Relações caem um pouco.', fx: (s, p) => { const k = kingdomById(s, p.k); if (k) changeRel(s, k, -8); return 'A aliança é recusada.'; } },
    ], auto: () => 0,
  },
  k_envoy: {
    title: 'Emissário estrangeiro', icon: '🎩', era: [3, 5], weight: () => 0, cd: 0,
    text: (s, p) => { const k = kingdomById(s, p.k); return `Um emissário de ${k?.name} chega com presentes e propõe um tratado de paz entre os reinos.`; },
    options: [
      { label: 'Assinar o tratado de paz', hint: 'Sem ataques mútuos por tempo indeterminado.', fx: (s, p) => proposeFromEnvoy(s, p, true) },
      { label: 'Aceitar só os presentes', hint: '', fx: (s, p) => proposeFromEnvoy(s, p, false) },
    ], auto: () => 0,
  },
};

// ---------- Sorteio ----------
export function rollEvent(s, offline) {
  const th = timeInfo(s);
  if (th.day < 3) return null;
  const pool = [];
  for (const id in EVENTS) {
    const d = EVENTS[id];
    if (s.era < d.era[0] || s.era > d.era[1]) continue;
    const last = s.ev.counts[id]?.last ?? -999;
    if (th.day - last < d.cd) continue;
    if (s.ev.pending.some(e => e.id === id)) continue;
    const w = d.weight(s);
    if (w > 0) pool.push([id, w]);
  }
  if (!pool.length) return null;
  let tot = pool.reduce((a, [, w]) => a + w, 0), r = Math.random() * tot, pickId = pool[0][0];
  for (const [id, w] of pool) { r -= w; if (r <= 0) { pickId = id; break; } }
  return makeInstance(s, pickId);
}
export function makeInstance(s, id, params) {
  const d = EVENTS[id];
  const c = (s.ev.counts[id] ||= { n: 0, last: -999 });
  c.n++; c.last = timeInfo(s).day;
  return { id, p: params || (d.gen ? d.gen(s) : {}), at: s.t };
}

// ---------- Visualização / resolução ----------
export function eventView(s, inst) {
  const d = EVENTS[inst.id];
  return {
    title: d.title, icon: d.icon, text: d.text(s, inst.p),
    options: d.options.map(o => {
      const need = typeof o.need === 'function' ? o.need(s, inst.p) : (o.need || {});
      const ok = need.__ ? false : canAfford(s, need);
      return { label: o.label, hint: typeof o.hint === 'function' ? o.hint(s, inst.p) : (o.hint || ''), ok, need };
    }),
  };
}
export function chooseOption(s, inst, idx) {
  const d = EVENTS[inst.id];
  const o = d.options[idx];
  const need = typeof o.need === 'function' ? o.need(s, inst.p) : (o.need || {});
  if (need.__ || !canAfford(s, need)) return null;
  const res = o.fx(s, inst.p);
  s.stats.eventsSeen++;
  const i = s.ev.pending.indexOf(inst); if (i >= 0) s.ev.pending.splice(i, 1);
  chron(s, `${d.title}: ${res}`, 'event');
  s._dirty = true;
  return res;
}
/** Resolução automática (offline): usa a escolha padrão sensata ou postura diplomática */
export function resolveAuto(s, inst) {
  const d = EVENTS[inst.id];
  let idx = d.auto ? d.auto(s, inst.p) : d.options.length - 1;
  const v = eventView(s, inst);
  if (!v.options[idx]?.ok) idx = v.options.findIndex(o => o.ok && /Recusar|Ignorar|Deixar|Adiar|Esperar|Confiar/.test(o.label));
  if (idx < 0) idx = v.options.findIndex(o => o.ok);
  if (idx < 0) return null;
  const res = chooseOption(s, inst, idx);
  (s._offLog ||= []).push({ title: d.title, icon: d.icon, choice: v.options[idx].label, result: res });
  return res;
}
