// data.js — todas as definições estáticas do jogo (recursos, profissões, construções, eras, tecnologias...)

// ---------- Tempo ----------
export const DAY_LEN = 100;          // segundos reais por dia de jogo (velocidade 1x)
export const SEASON_DAYS = 6;        // dias por estação
export const YEAR_DAYS = 24;         // dias por ano
export const SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const SEASON_ICON = ['🌱', '☀️', '🍂', '❄️'];
export const AGE_DAYS_PER_YEAR = 3;  // 1 "ano de vida" = 3 dias de jogo
export const ADULT_AGE = 10;         // idade adulta (em anos de vida)
export const ELDER_AGE = 48;
export const OFFLINE_MAX = 12 * 3600;     // máximo de tempo offline contabilizado (12 h)
export const OFFLINE_SCALE = 0.2;         // 1s offline = 0.2s de jogo
export const OFFLINE_EFF = 0.7;           // eficiência dos trabalhadores sem supervisão
export const TILE = 32;
export const MAP_W = 64, MAP_H = 48;

// ---------- Recursos ----------
export const RES = {
  wood:   { name: 'Madeira',    color: '#a06a3a', tier: 1 },
  stone:  { name: 'Pedra',      color: '#9aa3ad', tier: 1 },
  food:   { name: 'Comida',     color: '#d9534f', tier: 1 },
  water:  { name: 'Água',       color: '#4aa8ff', tier: 1 },
  planks: { name: 'Tábuas',     color: '#d9a35f', tier: 2 },
  tools:  { name: 'Ferramentas', color: '#7f8c9a', tier: 2 },
  cloth:  { name: 'Tecido',     color: '#c58be0', tier: 2 },
  iron:   { name: 'Ferro',      color: '#6c7a89', tier: 2 },
  gold:   { name: 'Ouro',       color: '#f5c542', tier: 3 },
  weapons:{ name: 'Armas',      color: '#c0c7d0', tier: 3 },
  jewels: { name: 'Joias',      color: '#ff6fb5', tier: 3 },
};
export const RES_ORDER = Object.keys(RES);
export const BASE_CAP = 60;

// ---------- Profissões ----------
export const JOBS = {
  livre:       { name: 'Livre',       icon: '🙂', color: '#b7a58a', era: 1, desc: 'Ajuda no que for mais necessário (70% de eficiência).' },
  lenhador:    { name: 'Lenhador',    icon: '🪓', color: '#8d5a2b', era: 1, desc: 'Corta árvores → madeira. Também opera a serraria.' },
  coletor:     { name: 'Coletor',     icon: '🧺', color: '#58a64a', era: 1, desc: 'Colhe frutos silvestres e busca água. Opera poço e tecelagem.' },
  cacador:     { name: 'Caçador',     icon: '🏹', color: '#6b8e3d', era: 1, desc: 'Caça animais → comida. Útil no inverno.' },
  construtor:  { name: 'Construtor',  icon: '🔨', color: '#d98a2b', era: 1, desc: 'Ergue e repara construções.' },
  pedreiro:    { name: 'Pedreiro',    icon: '⛏️', color: '#7e8794', era: 1, desc: 'Extrai pedra e minério. Opera a mina.' },
  agricultor:  { name: 'Agricultor',  icon: '🌾', color: '#c9b037', era: 2, desc: 'Cultiva as fazendas. Produz muita comida (menos no inverno).' },
  ferreiro:    { name: 'Ferreiro',    icon: '⚒️', color: '#c0502d', era: 3, desc: 'Forja ferramentas e armas. Trabalha na ferraria e joalheria.' },
  comerciante: { name: 'Comerciante', icon: '💰', color: '#e0a82e', era: 3, desc: 'Gera ouro no mercado, taverna e porto.' },
  soldado:     { name: 'Soldado',     icon: '🗡️', color: '#b03a3a', era: 3, desc: 'Defende o reino e marcha para a guerra.' },
  sabio:       { name: 'Sábio',       icon: '📖', color: '#6a5acd', era: 3, desc: 'Gera pontos de pesquisa. Trabalha na academia.' },
};
export const JOB_ORDER = Object.keys(JOBS);
// Taxa de produção por trabalhador (por dia de jogo, habilidade 1.0) em tarefas ao ar livre
export const OUT_RATE = { lenhador: 26, coletor: 14, cacador: 15, pedreiro: 17, water: 18 };
export const CARRY = { wood: 4, stone: 3, food: 4, water: 4 };

// ---------- Construções ----------
// cost: custo, work: unidades de trabalho de obra, beds: camas, storage: capacidade extra, slots: vagas de trabalho
export const BUILDINGS = {
  campfire:  { name: 'Fogueira', icon: '🔥', era: 1, w: 2, h: 2, cost: {}, work: 0, cat: 'Especial', unique: true, light: 190, beds: 2, storage: 40, defense: 6,
    desc: 'O coração do acampamento. Aquece, ilumina e reúne o povo.' },
  shelter:   { name: 'Abrigo', icon: '⛺', era: 1, w: 2, h: 2, cost: { wood: 12 }, work: 10, cat: 'Moradia', beds: 2, light: 50,
    desc: 'Cabana de galhos e peles. Acomoda 2 pessoas.' },
  gatherpoint: { name: 'Área de Coleta', icon: '🧺', era: 1, w: 3, h: 2, cost: { wood: 10 }, work: 10, cat: 'Armazém', storage: 40,
    desc: 'Ponto de entrega e estoque. +40 de capacidade para cada recurso básico; encurta viagens.' },
  house:     { name: 'Casa', icon: '🏠', era: 2, w: 3, h: 2, cost: { wood: 25, stone: 6 }, work: 28, cat: 'Moradia', beds: 4, light: 70,
    desc: 'Casa sólida com chaminé. Acomoda 4 pessoas.' },
  farm:      { name: 'Fazenda', icon: '🌾', era: 2, w: 4, h: 3, cost: { wood: 22 }, work: 22, cat: 'Produção', slots: { agricultor: 2 },
    desc: 'Campos cultivados. 2 agricultores. Colheita farta no verão/outono, quase nada no inverno.' },
  well:      { name: 'Poço', icon: '⛲', era: 2, w: 2, h: 2, cost: { stone: 12, wood: 6 }, work: 16, cat: 'Produção', slots: { coletor: 1 },
    desc: 'Fornece água constante (+14/dia) e reduz doenças. Um coletor aumenta a vazão.' },
  sawmill:   { name: 'Serraria', icon: '🪚', era: 2, w: 3, h: 2, cost: { wood: 30, stone: 8 }, work: 30, cat: 'Produção', slots: { lenhador: 2 }, light: 40,
    desc: 'Converte madeira em tábuas (2 → 1). 2 lenhadores.' },
  storehouse:{ name: 'Depósito', icon: '📦', era: 2, w: 3, h: 2, cost: { wood: 40, stone: 10 }, work: 30, cat: 'Armazém', storage: 150,
    desc: '+150 de capacidade para cada recurso. Ponto de entrega.' },
  market:    { name: 'Mercado', icon: '🏪', era: 3, w: 3, h: 3, cost: { planks: 30, stone: 15 }, work: 45, cat: 'Economia', slots: { comerciante: 2 }, tech: 'commerce', light: 90, happy: 3, prestige: 4,
    desc: 'Gera ouro e permite comércio com outros reinos. 2 comerciantes.' },
  smithy:    { name: 'Ferraria', icon: '⚒️', era: 3, w: 3, h: 2, cost: { planks: 20, stone: 30 }, work: 42, cat: 'Produção', slots: { ferreiro: 2 }, tech: 'metallurgy', light: 110,
    desc: 'Forja ferramentas ou armas a partir de ferro. 2 ferreiros.' },
  mine:      { name: 'Mina', icon: '⛏️', era: 3, w: 2, h: 2, cost: { planks: 20, stone: 20 }, work: 40, cat: 'Produção', slots: { pedreiro: 3 }, tech: 'metallurgy', light: 60,
    desc: 'Extrai minério de ferro (precisa de veio descoberto) ou pedra em abundância. 3 pedreiros.' },
  loom:      { name: 'Tecelagem', icon: '🧵', era: 3, w: 2, h: 2, cost: { planks: 15, stone: 5 }, work: 26, cat: 'Produção', slots: { coletor: 2 },
    desc: 'Cria tecido de lã (1 comida → 1 tecido). 2 coletores.' },
  tavern:    { name: 'Taverna', icon: '🍺', era: 3, w: 3, h: 2, cost: { planks: 25, stone: 10 }, work: 36, cat: 'Economia', slots: { comerciante: 1 }, light: 120, happy: 8, prestige: 3,
    desc: 'O povo se diverte aqui: muito mais felicidade. Consome comida e rende algum ouro.' },
  barracks:  { name: 'Quartel', icon: '⚔️', era: 3, w: 4, h: 3, cost: { planks: 40, stone: 40 }, work: 60, cat: 'Militar', tech: 'military', light: 80, soldiers: 10, defense: 8,
    desc: 'Abriga até 10 soldados e permite treinar unidades.' },
  wall:      { name: 'Muralha', icon: '🧱', era: 3, w: 1, h: 1, cost: { stone: 6 }, work: 4, cat: 'Militar', tech: 'masonry', defense: 3, repeat: true,
    desc: 'Segmento de muralha. +3 de defesa cada. Arraste para construir várias.' },
  castle:    { name: 'Castelo', icon: '🏰', era: 4, w: 5, h: 4, cost: { planks: 120, stone: 200, iron: 30, gold: 100 }, work: 260, cat: 'Realeza', tech: 'engineering', unique: true, light: 160, defense: 60, soldiers: 20, prestige: 30, beds: 6,
    desc: 'Fortaleza real. +60 defesa, +20 vagas militares e grande prestígio.' },
  cathedral: { name: 'Catedral', icon: '⛪', era: 4, w: 4, h: 4, cost: { stone: 250, planks: 80, gold: 150 }, work: 300, cat: 'Realeza', tech: 'theology', unique: true, light: 140, happy: 14, prestige: 25,
    desc: 'Eleva a fé e a alegria de todo o reino.' },
  port:      { name: 'Porto', icon: '⚓', era: 4, w: 4, h: 3, cost: { planks: 100, stone: 50, gold: 80 }, work: 140, cat: 'Economia', slots: { comerciante: 2, coletor: 2 }, tech: 'navigation', needsWater: true, unique: true, light: 90, prestige: 8,
    desc: 'Deve ficar à beira d\'água. Pesca (+comida), comércio marítimo mais lucrativo.' },
  academy:   { name: 'Academia', icon: '🎓', era: 4, w: 4, h: 3, cost: { planks: 80, stone: 100, gold: 100 }, work: 160, cat: 'Realeza', slots: { sabio: 3 }, tech: 'writing', light: 110, prestige: 10,
    desc: 'Centro de estudos. 3 sábios geram muitos pontos de pesquisa.' },
  road:      { name: 'Estrada', icon: '🛤️', era: 4, w: 1, h: 1, cost: { stone: 1 }, work: 1, cat: 'Realeza', tech: 'engineering', repeat: true, road: true,
    desc: 'Pavimenta o chão: o povo anda 45% mais rápido. Arraste para pintar.' },
  jeweler:   { name: 'Joalheria', icon: '💎', era: 4, w: 3, h: 2, cost: { planks: 40, stone: 40, gold: 60 }, work: 80, cat: 'Produção', slots: { ferreiro: 1 }, tech: 'commerce', light: 100,
    desc: 'Transforma ouro e pedra em joias. 1 ferreiro.' },
  monument:  { name: 'Monumento', icon: '🗿', era: 5, w: 3, h: 3, cost: { stone: 400, gold: 300, jewels: 10 }, work: 400, cat: 'Império', tech: 'imperial', prestige: 40, happy: 5, light: 80,
    desc: 'Glória eterna do império: grande prestígio.' },
  wonder:    { name: 'Grande Maravilha', icon: '🌟', era: 5, w: 5, h: 5, cost: { planks: 300, stone: 500, gold: 600, jewels: 30 }, work: 900, cat: 'Império', tech: 'monumental', unique: true, prestige: 120, happy: 10, light: 220,
    desc: 'A obra final de um grande império. Completá-la é a glória suprema.' },
};
export const BUILD_CATS = ['Moradia', 'Armazém', 'Produção', 'Economia', 'Militar', 'Realeza', 'Império'];

// ---------- Eras ----------
export const ERAS = [
  null,
  { id: 1, name: 'Acampamento', radius: 11, color: '#c98a4b', desc: 'Dois sobreviventes, uma fogueira e uma floresta cheia de promessas.' },
  { id: 2, name: 'Vila', radius: 15, color: '#6fae52', cost: { wood: 40, stone: 10 },
    req: { pop: 6, buildings: { shelter: 2 } },
    unlocks: 'Casas, fazendas, poços, serraria e depósitos.' },
  { id: 3, name: 'Cidade', radius: 20, color: '#c9a64a', cost: { planks: 40, stone: 60, food: 60 },
    req: { pop: 16, buildings: { house: 3, sawmill: 1, storehouse: 1 }, tech: ['agriculture'] },
    unlocks: 'Mercado, ferraria, quartel, muralhas, taverna, mina e tecelagem. Diplomacia e guerra.' },
  { id: 4, name: 'Reino', radius: 27, color: '#b04a9a', cost: { planks: 120, stone: 200, gold: 120, iron: 30 },
    req: { pop: 38, buildings: { market: 1, smithy: 1, barracks: 1, tavern: 1 }, tech: ['commerce', 'metallurgy', 'military'] },
    unlocks: 'Castelo, catedral, porto, academia, estradas e joalheria.' },
  { id: 5, name: 'Império', radius: 40, color: '#e0c040', cost: { planks: 250, stone: 400, gold: 400, jewels: 8 },
    req: { pop: 80, buildings: { castle: 1, cathedral: 1, academy: 1 }, tech: ['engineering', 'theology'], territories: 2 },
    unlocks: 'Monumentos, a Grande Maravilha e territórios conquistados.' },
];

// ---------- Tecnologias ----------
// fx: modificadores globais (somados). pos: posição visual na árvore
export const TECHS = {
  stone_tools: { name: 'Ferramentas de Pedra', era: 1, cost: 15, req: [], fx: { wood: 0.15, stone: 0.15 }, desc: '+15% madeira e pedra.', pos: [0, 0] },
  basketry:    { name: 'Cestaria', era: 1, cost: 20, req: [], fx: { storage: 0.25 }, desc: '+25% de capacidade de armazenamento.', pos: [0, 1] },
  hunting:     { name: 'Armadilhas', era: 1, cost: 25, req: [], fx: { hunt: 0.3 }, desc: '+30% de comida da caça.', pos: [0, 2] },
  smoking:     { name: 'Defumação', era: 1, cost: 30, req: ['basketry'], fx: { consume: -0.1 }, desc: '-10% de consumo de comida.', pos: [1, 1] },
  agriculture: { name: 'Agricultura', era: 2, cost: 40, req: ['stone_tools'], fx: { farm: 0.25 }, desc: '+25% de produção das fazendas.', pos: [1, 0] },
  masonry:     { name: 'Alvenaria', era: 2, cost: 50, req: ['stone_tools'], fx: { build: 0.25 }, unlock: ['wall'], desc: '+25% velocidade de obra. Libera muralhas.', pos: [2, 0] },
  sanitation:  { name: 'Higiene', era: 2, cost: 50, req: ['basketry'], fx: { disease: -0.4 }, desc: '-40% de doenças.', pos: [2, 1] },
  cartography: { name: 'Cartografia', era: 2, cost: 60, req: ['hunting'], fx: {}, unlock: ['world'], desc: 'Libera o mapa-múndi e batedores.', pos: [1, 2] },
  commerce:    { name: 'Comércio', era: 3, cost: 80, req: ['agriculture'], fx: { trade: 0.15 }, unlock: ['market', 'jeweler'], desc: 'Libera mercado, rotas comerciais e joalheria.', pos: [3, 0] },
  metallurgy:  { name: 'Metalurgia', era: 3, cost: 80, req: ['masonry'], fx: {}, unlock: ['smithy', 'mine'], desc: 'Libera ferraria e mina de ferro.', pos: [3, 1] },
  writing:     { name: 'Escrita', era: 3, cost: 90, req: ['commerce'], fx: { rp: 0.25 }, unlock: ['sabio', 'academy'], desc: 'Sábios e academias. +25% pesquisa.', pos: [4, 0] },
  military:    { name: 'Tática Militar', era: 3, cost: 100, req: ['metallurgy'], fx: { defense: 0.1 }, unlock: ['barracks', 'soldado'], desc: 'Libera quartel, soldados e exército.', pos: [4, 1] },
  engineering: { name: 'Engenharia', era: 4, cost: 150, req: ['masonry', 'writing'], fx: { build: 0.25 }, unlock: ['road', 'castle'], desc: 'Estradas e castelos. +25% velocidade de obra.', pos: [5, 0] },
  theology:    { name: 'Teologia', era: 4, cost: 150, req: ['writing'], fx: { joy: 4 }, unlock: ['cathedral'], desc: 'Catedral. +4 de felicidade.', pos: [5, 1] },
  navigation:  { name: 'Navegação', era: 4, cost: 160, req: ['cartography', 'commerce'], fx: { trade: 0.25 }, unlock: ['port'], desc: 'Porto e comércio marítimo.', pos: [5, 2] },
  cavalry:     { name: 'Cavalaria e Cerco', era: 4, cost: 180, req: ['military'], fx: {}, unlock: ['knight', 'catapult'], desc: 'Libera cavaleiros e catapultas.', pos: [6, 1] },
  science:     { name: 'Ciência', era: 4, cost: 200, req: ['writing'], fx: { rp: 0.5, farm: 0.15 }, desc: '+50% pesquisa, +15% fazendas.', pos: [6, 0] },
  imperial:    { name: 'Administração Imperial', era: 5, cost: 300, req: ['engineering', 'theology'], fx: { gather: 0.1, trade: 0.15 }, unlock: ['monument'], desc: 'Monumentos. +10% coleta e comércio.', pos: [7, 0] },
  monumental:  { name: 'Arquitetura Monumental', era: 5, cost: 380, req: ['imperial'], fx: { build: 0.3 }, unlock: ['wonder'], desc: 'Libera a Grande Maravilha. +30% obra.', pos: [8, 0] },
};

// ---------- Unidades militares ----------
export const UNITS = {
  recruta:  { name: 'Recruta',   icon: '🧍', hp: 12, atk: 2, power: 2, cost: {}, counter: null, tech: null },
  spear:    { name: 'Lanceiro',  icon: '🔱', hp: 20, atk: 4, power: 5, cost: { food: 10, wood: 5 }, counter: 'knight', tech: null },
  archer:   { name: 'Arqueiro',  icon: '🏹', hp: 12, atk: 6, power: 6, cost: { food: 8, wood: 10, planks: 3 }, counter: 'spear', tech: null },
  knight:   { name: 'Cavaleiro', icon: '🐎', hp: 30, atk: 8, power: 10, cost: { food: 15, iron: 6, weapons: 2 }, counter: 'archer', tech: 'cavalry' },
  catapult: { name: 'Catapulta', icon: '🎯', hp: 40, atk: 14, power: 14, cost: { planks: 20, iron: 5, weapons: 1 }, counter: null, tech: 'cavalry', siege: true },
};

// ---------- Políticas ----------
export const POLICIES = {
  tax:   { name: 'Impostos', era: 3, options: ['Baixos', 'Médios', 'Altos'], icon: '🪙',
    desc: ['+6 felicidade, pouco ouro.', 'Equilíbrio.', '+60% de ouro, −12 felicidade.'] },
  ration: { name: 'Racionamento', era: 1, bool: true, icon: '🍞', desc: 'Consumo de comida e água −30%, mas −8 de felicidade.' },
  overtime: { name: 'Trabalho Extra', era: 1, bool: true, icon: '⏱️', desc: '+25% de produtividade, mas cansaço e −8 de felicidade.' },
  conscription: { name: 'Recrutamento Obrigatório', era: 3, bool: true, icon: '📯', desc: 'Convoca 1 morador livre por dia como soldado (até o limite). −10 de felicidade.' },
  border: { name: 'Fronteira', era: 1, options: ['Aberta', 'Fechada'], icon: '🚪', desc: ['Imigrantes são bem-vindos (mais moradores).', 'Sem imigrantes e sem refugiados.'] },
  stance: { name: 'Postura Diplomática', era: 3, options: ['Conciliadora', 'Orgulhosa'], icon: '🕊️',
    desc: ['Paga tributos para evitar guerra (usado quando você está ausente).', 'Recusa exigências: mais respeito, mais risco de ataque.'] },
};
export const FESTIVAL = { cost: { food: 30, water: 10 }, goldCost: 0, days: 2, joy: 20, cooldown: 8 };
