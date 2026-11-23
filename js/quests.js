// quests.js — objetivos/missões (curto, médio e longo prazo) e conquistas

import { BUILDINGS, TECHS, JOBS, YEAR_DAYS, RES } from './data.js';
import { countB, timeInfo } from './state.js';
import { addRes, chron, toast, soldiersOf, bus } from './core.js';

const g = (r, n) => s => [Math.min(n, Math.floor(s.stats.gathered[r] || 0)), n];
const bld = (t, n) => s => [Math.min(n, countB(s, t)), n];
const pop = n => s => [Math.min(n, s.people.length), n];
const job = (j, n) => s => [Math.min(n, s.people.filter(p => p.job === j).length), n];
const era = n => s => [s.era >= n ? 1 : 0, 1];
const tech = id => s => [s.tech.done[id] ? 1 : 0, 1];
const stat = (fn, n) => s => [Math.min(n, fn(s)), n];

// ordem importa: o jogo mostra as próximas pendentes
export const QUESTS = [
  { id: 'q_wood', era: 1, text: 'Junte 15 de madeira', prog: g('wood', 15), reward: { food: 6 } },
  { id: 'q_shelter', era: 1, text: 'Construa um Abrigo', prog: bld('shelter', 1), reward: { wood: 8 } },
  { id: 'q_food', era: 1, text: 'Colete 20 de comida', prog: g('food', 20), reward: { water: 10 } },
  { id: 'q_stone', era: 1, text: 'Junte 10 de pedra (atribua um Pedreiro)', prog: g('stone', 10), reward: { wood: 10 } },
  { id: 'q_gather', era: 1, text: 'Construa uma Área de Coleta', prog: bld('gatherpoint', 1), reward: { wood: 10 } },
  { id: 'q_pop4', era: 1, text: 'Chegue a 4 moradores', prog: pop(4), reward: { food: 15 } },
  { id: 'q_tech1', era: 1, text: 'Pesquise Ferramentas de Pedra', prog: tech('stone_tools'), reward: { stone: 10 } },
  { id: 'q_pop6', era: 1, text: 'Chegue a 6 moradores', prog: pop(6), reward: { wood: 15 } },
  { id: 'q_era2', era: 1, text: 'Evolua para a Vila', prog: era(2), reward: { wood: 30, stone: 10 } },
  { id: 'q_house', era: 2, text: 'Construa 2 Casas', prog: bld('house', 2), reward: { wood: 20 } },
  { id: 'q_farm', era: 2, text: 'Construa uma Fazenda', prog: bld('farm', 1), reward: { food: 25 } },
  { id: 'q_farmer', era: 2, text: 'Tenha 2 Agricultores', prog: job('agricultor', 2), reward: { wood: 15 } },
  { id: 'q_well', era: 2, text: 'Construa um Poço', prog: bld('well', 1), reward: { stone: 10 } },
  { id: 'q_sawmill', era: 2, text: 'Construa uma Serraria', prog: bld('sawmill', 1), reward: { planks: 10 } },
  { id: 'q_store', era: 2, text: 'Construa um Depósito', prog: bld('storehouse', 1), reward: { planks: 10, stone: 10 } },
  { id: 'q_agri', era: 2, text: 'Pesquise Agricultura', prog: tech('agriculture'), reward: { food: 30 } },
  { id: 'q_pop12', era: 2, text: 'Chegue a 12 moradores', prog: pop(12), reward: { planks: 10 } },
  { id: 'q_carto', era: 2, text: 'Pesquise Cartografia (mapa-múndi)', prog: tech('cartography'), reward: { food: 30 } },
  { id: 'q_pop16', era: 2, text: 'Chegue a 16 moradores', prog: pop(16), reward: { planks: 15 } },
  { id: 'q_era3', era: 2, text: 'Evolua para a Cidade', prog: era(3), reward: { planks: 30, stone: 30 } },
  { id: 'q_scout', era: 3, text: 'Envie um batedor ao mundo', prog: stat(s => s.stats.scouts || 0, 1), reward: { food: 30 } },
  { id: 'q_comm', era: 3, text: 'Pesquise Comércio', prog: tech('commerce'), reward: { gold: 30 } },
  { id: 'q_market', era: 3, text: 'Construa um Mercado', prog: bld('market', 1), reward: { gold: 40 } },
  { id: 'q_metal', era: 3, text: 'Pesquise Metalurgia', prog: tech('metallurgy'), reward: { stone: 40 } },
  { id: 'q_smithy', era: 3, text: 'Construa uma Ferraria', prog: bld('smithy', 1), reward: { iron: 10 } },
  { id: 'q_tavern', era: 3, text: 'Construa uma Taverna', prog: bld('tavern', 1), reward: { gold: 40 } },
  { id: 'q_mil', era: 3, text: 'Pesquise Tática Militar', prog: tech('military'), reward: { planks: 30 } },
  { id: 'q_barracks', era: 3, text: 'Construa um Quartel', prog: bld('barracks', 1), reward: { weapons: 3 } },
  { id: 'q_route', era: 3, text: 'Estabeleça uma rota comercial', prog: stat(s => s.world?.routes?.filter(r => r.active).length || 0, 1), reward: { gold: 60 } },
  { id: 'q_sold5', era: 3, text: 'Tenha 5 soldados', prog: stat(s => soldiersOf(s).length, 5), reward: { weapons: 5 } },
  { id: 'q_pop38', era: 3, text: 'Chegue a 38 moradores', prog: pop(38), reward: { gold: 80 } },
  { id: 'q_era4', era: 3, text: 'Evolua para o Reino', prog: era(4), reward: { gold: 120, planks: 50 } },
  { id: 'q_eng', era: 4, text: 'Pesquise Engenharia', prog: tech('engineering'), reward: { gold: 80 } },
  { id: 'q_castle', era: 4, text: 'Construa o Castelo', prog: bld('castle', 1), reward: { jewels: 2 } },
  { id: 'q_ally', era: 4, text: 'Forme uma aliança com outro reino', prog: stat(s => (s.world?.kingdoms || []).filter(k => k.treaty.alliance).length, 1), reward: { gold: 100 } },
  { id: 'q_theo', era: 4, text: 'Pesquise Teologia', prog: tech('theology'), reward: { gold: 80 } },
  { id: 'q_cath', era: 4, text: 'Construa a Catedral', prog: bld('cathedral', 1), reward: { jewels: 3 } },
  { id: 'q_acad', era: 4, text: 'Construa a Academia', prog: bld('academy', 1), reward: { gold: 100 } },
  { id: 'q_win', era: 4, text: 'Vença uma batalha', prog: stat(s => s.stats.battlesWon, 1), reward: { weapons: 8, gold: 60 } },
  { id: 'q_conq', era: 4, text: 'Conquiste um território', prog: stat(s => s.territories.length, 1), reward: { gold: 150, iron: 20 } },
  { id: 'q_pop80', era: 4, text: 'Chegue a 80 moradores', prog: pop(80), reward: { jewels: 4 } },
  { id: 'q_era5', era: 4, text: 'Evolua para o Império', prog: era(5), reward: { gold: 300, jewels: 5 } },
  { id: 'q_mon', era: 5, text: 'Construa um Monumento', prog: bld('monument', 1), reward: { gold: 200 } },
  { id: 'q_terr4', era: 5, text: 'Conquiste 4 territórios', prog: stat(s => s.territories.length, 4), reward: { jewels: 10 } },
  { id: 'q_wonder', era: 5, text: 'Construa a Grande Maravilha', prog: bld('wonder', 1), reward: { gold: 1000, jewels: 20 } },
];

export function activeQuests(s, n = 3) {
  return QUESTS.filter(q => !s.quests.done[q.id] && q.era <= s.era).slice(0, n).map(q => ({ q, prog: q.prog(s) }));
}
export function longGoal(s) {
  const goals = ['Transformar o acampamento em uma Vila', 'Crescer até se tornar uma Cidade (16 moradores)', 'Erguer um Reino: mercado, ferraria, quartel e taverna', 'Conquistar o império: castelo, catedral e academia', 'Construir a Grande Maravilha'];
  return goals[Math.min(s.era - 1, 4)];
}
export function checkQuests(s) {
  for (const q of QUESTS) {
    if (s.quests.done[q.id] || q.era > s.era) continue;
    const [c, t] = q.prog(s);
    if (c >= t) {
      s.quests.done[q.id] = timeInfo(s).day + 1;
      for (const r in q.reward) addRes(s, r, q.reward[r], { noStat: true });
      const rw = Object.entries(q.reward).map(([r, v]) => `+${v} ${RES[r].name}`).join(' ');
      toast(s, `Objetivo: ${q.text} — ${rw}`, 'good', '🎯');
      bus.emit('quest', q);
    }
  }
}

// ---------- Conquistas ----------
export const ACHIEVEMENTS = [
  { id: 'a_first_build', name: 'Primeira Pedra', icon: '🧱', desc: 'Conclua sua primeira construção.', check: s => s.buildings.filter(b => b.done).length > 1 },
  { id: 'a_pop10', name: 'Povoado', icon: '👥', desc: 'Alcance 10 moradores.', check: s => s.people.length >= 10 },
  { id: 'a_pop25', name: 'Multidão', icon: '🏘️', desc: 'Alcance 25 moradores.', check: s => s.people.length >= 25 },
  { id: 'a_pop50', name: 'Metrópole', icon: '🌆', desc: 'Alcance 50 moradores.', check: s => s.people.length >= 50 },
  { id: 'a_pop100', name: 'Formigueiro Real', icon: '🏙️', desc: 'Alcance 100 moradores.', check: s => s.people.length >= 100 },
  { id: 'a_birth', name: 'Nova Vida', icon: '👶', desc: 'Veja a primeira criança nascer no reino.', check: s => s.stats.births >= 1 },
  { id: 'a_year', name: 'Sobreviventes', icon: '📅', desc: 'Complete um ano inteiro de reino.', check: s => timeInfo(s).day >= YEAR_DAYS },
  { id: 'a_era2', name: 'Aldeia', icon: '🏡', desc: 'Evolua para a Vila.', check: s => s.era >= 2 },
  { id: 'a_era3', name: 'Urbanistas', icon: '🏛️', desc: 'Evolua para a Cidade.', check: s => s.era >= 3 },
  { id: 'a_era4', name: 'Coroa', icon: '👑', desc: 'Evolua para o Reino.', check: s => s.era >= 4 },
  { id: 'a_era5', name: 'Imperador', icon: '🌟', desc: 'Evolua para o Império.', check: s => s.era >= 5 },
  { id: 'a_tech10', name: 'Sábios', icon: '🔬', desc: 'Pesquise 10 tecnologias.', check: s => Object.keys(s.tech.done).length >= 10 },
  { id: 'a_trade', name: 'Mascate', icon: '🧳', desc: 'Faça 3 negócios com mercadores.', check: s => s.stats.tradesDone >= 3 },
  { id: 'a_rich', name: 'Cofres Cheios', icon: '💰', desc: 'Acumule 500 de ouro.', check: s => s.res.gold >= 500 },
  { id: 'a_hero', name: 'Lenda Viva', icon: '🦸', desc: 'Tenha um herói no povo.', check: s => s.people.some(p => p.hero) },
  { id: 'a_battle', name: 'Batismo de Fogo', icon: '⚔️', desc: 'Vença sua primeira batalha.', check: s => s.stats.battlesWon >= 1 },
  { id: 'a_army20', name: 'Exército Real', icon: '🛡️', desc: 'Tenha 20 soldados.', check: s => soldiersOf(s).length >= 20 },
  { id: 'a_conquer', name: 'Conquistador', icon: '🚩', desc: 'Conquiste um território.', check: s => s.territories.length >= 1 },
  { id: 'a_ally', name: 'Diplomata', icon: '🕊️', desc: 'Forme uma aliança.', check: s => (s.world?.kingdoms || []).some(k => k.treaty.alliance) },
  { id: 'a_fest', name: 'Boa Companhia', icon: '🎉', desc: 'Promova 3 festivais.', check: s => s.stats.festivals >= 3 },
  { id: 'a_wonder', name: 'Maravilha do Mundo', icon: '🌠', desc: 'Construa a Grande Maravilha.', check: s => countB(s, 'wonder') >= 1 },
];
export function checkAchievements(s) {
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    if (a.check(s)) {
      s.achievements[a.id] = timeInfo(s).day + 1;
      chron(s, `Conquista desbloqueada: ${a.name}.`, 'achv');
      toast(s, `Conquista: ${a.name}`, 'gold', a.icon);
      bus.emit('achievement', a);
    }
  }
}
