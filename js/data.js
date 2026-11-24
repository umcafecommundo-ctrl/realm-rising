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
export const OUT_RATE = { lenhador: 30, coletor: 14, cacador: 15, pedreiro: 34, water: 18 };
export const CARRY = { wood: 6, stone: 6, food: 5, water: 5 };

// ---------- Construções ----------
// cost: custo, work: unidades de trabalho de obra, beds: camas, storage: capacidade extra, slots: vagas de trabalho
export const BUILDINGS = {
  campfire:  { name: 'Fogueira', icon: '🔥', era: 1, w: 2, h: 2, cost: {}, work: 0, cat: 'Especial', unique: true, light: 190, beds: 2, storage: 40, defense: 6,
    desc: 'O coração do acampamento. Aquece, ilumina e reúne o povo.' },
  shelter:   { upgrade: { to: 'house', frac: 0.6 }, name: 'Abrigo', icon: '⛺', era: 1, w: 2, h: 2, cost: { wood: 12 }, work: 10, cat: 'Moradia', beds: 2, light: 50,
    desc: 'Cabana de galhos e peles. Acomoda 2 pessoas.' },
  gatherpoint: { upgrade: { to: 'storehouse', frac: 0.6 }, name: 'Área de Coleta', icon: '🧺', era: 1, w: 3, h: 2, cost: { wood: 10 }, work: 10, cat: 'Armazém', storage: 40,
    desc: 'Ponto de entrega e estoque. +40 de capacidade para cada recurso básico; encurta viagens.' },
  house:     { upgrade: { to: 'stonehouse', frac: 0.6 }, name: 'Casa', icon: '🏠', era: 2, w: 3, h: 2, cost: { wood: 25, stone: 6 }, work: 28, cat: 'Moradia', beds: 4, light: 70,
    desc: 'Casa sólida com chaminé. Acomoda 4 pessoas.' },
  farm:      { upgrade: { to: 'irrfarm', frac: 0.6 }, name: 'Fazenda', icon: '🌾', era: 2, w: 4, h: 3, cost: { wood: 22 }, work: 22, cat: 'Produção', slots: { agricultor: 2 },
    desc: 'Campos cultivados. 2 agricultores. Colheita farta no verão/outono, quase nada no inverno.' },
  well:      { upgrade: { to: 'cistern', frac: 0.6 }, name: 'Poço', icon: '⛲', era: 2, w: 2, h: 2, cost: { stone: 12, wood: 6 }, work: 16, cat: 'Produção', slots: { coletor: 1 },
    desc: 'Fornece água constante (+14/dia) e reduz doenças. Um coletor aumenta a vazão.' },
  sawmill:   { upgrade: { to: 'sawmill2', frac: 0.6 }, name: 'Serraria', icon: '🪚', era: 2, w: 3, h: 2, cost: { wood: 30, stone: 8 }, work: 30, cat: 'Produção', slots: { lenhador: 2 }, light: 40,
    desc: 'Converte madeira em tábuas (2 → 1). 2 lenhadores.' },
  storehouse:{ name: 'Depósito', icon: '📦', era: 2, w: 3, h: 2, cost: { wood: 40, stone: 10 }, work: 30, cat: 'Armazém', storage: 150,
    desc: '+150 de capacidade para cada recurso. Ponto de entrega.' },
  market:    { upgrade: { to: 'bazaar', frac: 0.6 }, name: 'Mercado', icon: '🏪', era: 3, w: 3, h: 3, cost: { planks: 30, stone: 15 }, work: 45, cat: 'Economia', slots: { comerciante: 2 }, tech: 'commerce', light: 90, happy: 3, prestige: 4,
    desc: 'Gera ouro e permite comércio com outros reinos. 2 comerciantes.' },
  smithy:    { upgrade: { to: 'foundry', frac: 0.6 }, name: 'Ferraria', icon: '⚒️', era: 3, w: 3, h: 2, cost: { planks: 20, stone: 30 }, work: 42, cat: 'Produção', slots: { ferreiro: 2 }, tech: 'metallurgy', light: 110,
    desc: 'Forja ferramentas ou armas a partir de ferro. 2 ferreiros.' },
  mine:      { name: 'Mina', icon: '⛏️', era: 3, w: 2, h: 2, cost: { planks: 20, stone: 20 }, work: 40, cat: 'Produção', slots: { pedreiro: 3 }, tech: 'metallurgy', light: 60,
    desc: 'Extrai minério de ferro (precisa de veio descoberto) ou pedra em abundância. 3 pedreiros.' },
  loom:      { name: 'Tecelagem', icon: '🧵', era: 3, w: 2, h: 2, cost: { planks: 15, stone: 5 }, work: 26, cat: 'Produção', slots: { coletor: 2 },
    desc: 'Cria tecido de lã (1 comida → 1 tecido). 2 coletores.' },
  tavern:    { upgrade: { to: 'inn', frac: 0.6 }, name: 'Taverna', icon: '🍺', era: 3, w: 3, h: 2, cost: { planks: 25, stone: 10 }, work: 36, cat: 'Economia', slots: { comerciante: 1 }, light: 120, happy: 8, prestige: 3,
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
  // ---- evoluções (tier 2/3): mesma pegada do prédio base, melhores atributos ----
  stonehouse: { name: 'Casa de Pedra', icon: '🏡', era: 3, w: 3, h: 2, cost: { wood: 20, stone: 30, planks: 10 }, work: 40, cat: 'Moradia', beds: 6, light: 80, tech: 'architecture', as: 'house', tier: 2, upgrade: { to: 'manor', frac: 0.6 },
    desc: 'Evolução da casa: paredes de pedra e telhas. Acomoda 6 pessoas.' },
  manor:     { name: 'Mansão', icon: '🏰', era: 4, w: 3, h: 2, cost: { planks: 40, stone: 60, gold: 30 }, work: 70, cat: 'Moradia', beds: 10, happy: 2, prestige: 3, light: 90, tech: 'aristocracy', as: 'house', tier: 3,
    desc: 'Residência nobre: 10 pessoas, mais felicidade e prestígio.' },
  irrfarm:   { name: 'Fazenda Irrigada', icon: '💧', era: 3, w: 4, h: 3, cost: { planks: 25, stone: 20, wood: 20 }, work: 50, cat: 'Produção', slots: { agricultor: 3 }, mult: 1.5, tech: 'irrigation', as: 'farm', tier: 2,
    desc: 'Canais de irrigação: 3 agricultores e +50% de colheita.' },
  cistern:   { name: 'Cisterna', icon: '🪣', era: 3, w: 2, h: 2, cost: { stone: 30, planks: 10 }, work: 40, cat: 'Produção', slots: { coletor: 2 }, water: 34, tech: 'architecture', as: 'well', tier: 2,
    desc: 'Reservatório de pedra: +34 de água por dia.' },
  warehouse: { name: 'Armazém Real', icon: '🏛️', era: 3, w: 3, h: 2, cost: { planks: 40, stone: 40 }, work: 60, cat: 'Armazém', storage: 450, tech: 'architecture', as: 'storehouse', tier: 2,
    desc: '+450 de capacidade para cada recurso.' },
  sawmill2:  { name: 'Serraria Hidráulica', icon: '⚙️', era: 3, w: 3, h: 2, cost: { planks: 30, stone: 30 }, work: 60, cat: 'Produção', slots: { lenhador: 3 }, mult: 1.6, tech: 'waterpower', as: 'sawmill', tier: 2,
    desc: 'Roda d\'água: 3 lenhadores e +60% de tábuas.' },
  foundry:   { name: 'Fundição', icon: '🔥', era: 4, w: 3, h: 2, cost: { planks: 40, stone: 50, iron: 20 }, work: 80, cat: 'Produção', slots: { ferreiro: 3 }, mult: 1.6, light: 130, tech: 'steel', as: 'smithy', tier: 2,
    desc: 'Aço de alta qualidade: 3 ferreiros e +60% de produção.' },
  bazaar:    { name: 'Bazar', icon: '🛍️', era: 4, w: 3, h: 3, cost: { planks: 60, stone: 40, gold: 60 }, work: 90, cat: 'Economia', slots: { comerciante: 3 }, mult: 1.6, happy: 5, prestige: 6, light: 100, tech: 'banking', as: 'market', tier: 2,
    desc: 'Grande centro comercial: 3 comerciantes e +60% de ouro.' },
  inn:       { name: 'Estalagem', icon: '🛏️', era: 4, w: 3, h: 2, cost: { planks: 40, stone: 30, gold: 40 }, work: 70, cat: 'Economia', slots: { comerciante: 2 }, happy: 16, prestige: 5, light: 130, tech: 'aristocracy', as: 'tavern', tier: 2,
    desc: 'Hospedagem e banquetes: muito mais felicidade.' },
  // ---- maravilhas (únicas, com bônus globais) ----
  library:   { name: 'Grande Biblioteca', icon: '📚', era: 5, w: 4, h: 3, cost: { planks: 200, stone: 300, gold: 400, jewels: 15 }, work: 600, cat: 'Império', slots: { sabio: 3 }, unique: true, fx: { rp: 0.5 }, prestige: 60, light: 130, tech: 'monumental', as: 'academy', tier: 3,
    desc: 'Todo o saber do mundo: +50% de pesquisa e 3 vagas de sábios.' },
  colossus:  { name: 'Colosso', icon: '🗽', era: 5, w: 3, h: 3, cost: { stone: 400, gold: 300, iron: 60, jewels: 10 }, work: 500, cat: 'Império', unique: true, fx: { trade: 0.3, defense: 0.15 }, defense: 60, prestige: 50, light: 120, tech: 'monumental', as: 'monument', tier: 3,
    desc: 'Guardião do porto: +30% comércio, +15% defesa e muralha viva.' },
  gardens:   { name: 'Jardins Suspensos', icon: '🌿', era: 5, w: 4, h: 3, cost: { planks: 150, stone: 250, gold: 300, jewels: 12 }, work: 550, cat: 'Império', unique: true, fx: { farm: 0.4 }, happy: 12, prestige: 50, tech: 'monumental', as: 'farm', tier: 3,
    desc: 'Jardins lendários: +40% de colheita e +12 de felicidade.' },
  observatory: { name: 'Observatório', icon: '🔭', era: 6, w: 3, h: 3, cost: { planks: 250, stone: 400, gold: 500, jewels: 20 }, work: 700, cat: 'Império', unique: true, fx: { rp: 0.8 }, prestige: 70, light: 140, tech: 'astronomy', as: 'monument', tier: 3,
    desc: 'Lê as estrelas: +80% de pesquisa.' },
  palace:    { name: 'Palácio Imperial', icon: '👑', era: 6, w: 5, h: 4, cost: { planks: 400, stone: 600, gold: 900, jewels: 40 }, work: 1200, cat: 'Império', unique: true, happy: 20, prestige: 150, soldiers: 20, defense: 80, beds: 10, light: 200, tech: 'philosophy', as: 'castle', tier: 3,
    desc: 'O coração de uma civilização: +20 felicidade, prestígio imenso, guarnição e defesa.' },
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
    unlocks: 'Monumentos, a Grande Maravilha, bibliotecas, colossos, jardins e territórios conquistados.' },
  { id: 6, name: 'Era Dourada', radius: 40, color: '#ffd84a', cost: { planks: 400, stone: 600, gold: 800, jewels: 25 },
    req: { pop: 120, buildings: { wonder: 1, library: 1 }, tech: ['philosophy', 'astronomy'], territories: 4 },
    unlocks: 'Observatório, Palácio Imperial e o Legado: ascenda para um novo reino com bônus permanentes.' },
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
  architecture: { name: 'Arquitetura', era: 3, cost: 90, req: ['masonry'], fx: { build: 0.1 }, unlock: ['stonehouse', 'cistern', 'warehouse'], desc: 'Casa de pedra, cisterna e armazém real.', pos: [3, 2] },
  irrigation:  { name: 'Irrigação', era: 3, cost: 100, req: ['agriculture'], fx: { farm: 0.15 }, unlock: ['irrfarm'], desc: 'Fazenda irrigada. +15% colheita.', pos: [2, 2] },
  waterpower:  { name: 'Força Hidráulica', era: 3, cost: 110, req: ['masonry'], fx: { wood: 0.1 }, unlock: ['sawmill2'], desc: 'Serraria hidráulica. +10% madeira.', pos: [4, 2] },
  steel:       { name: 'Aço', era: 4, cost: 170, req: ['metallurgy'], fx: { defense: 0.1 }, unlock: ['foundry'], desc: 'Fundição. +10% defesa.', pos: [6, 2] },
  banking:     { name: 'Bancos', era: 4, cost: 170, req: ['commerce'], fx: { trade: 0.2 }, unlock: ['bazaar'], desc: 'Bazar. +20% comércio.', pos: [7, 1] },
  aristocracy: { name: 'Aristocracia', era: 4, cost: 180, req: ['writing'], fx: { joy: 2 }, unlock: ['manor', 'inn'], desc: 'Mansões e estalagens. +2 felicidade.', pos: [7, 2] },
  medicine:    { name: 'Medicina', era: 4, cost: 170, req: ['sanitation'], fx: { disease: -0.5 }, desc: '-50% de doenças.', pos: [8, 1] },
  astronomy:   { name: 'Astronomia', era: 5, cost: 420, req: ['science', 'monumental'], fx: { rp: 0.3 }, unlock: ['observatory'], desc: 'Observatório. +30% pesquisa.', pos: [9, 0] },
  philosophy:  { name: 'Filosofia', era: 5, cost: 450, req: ['theology', 'monumental'], fx: { joy: 4 }, unlock: ['palace'], desc: 'Palácio Imperial. +4 felicidade.', pos: [9, 1] },
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
  autoJobs: { name: 'Distribuição automática', era: 1, bool: true, icon: '🧭', desc: 'Moradores sem função fixa são enviados sozinhos para onde há mais necessidade (comida, água, obras, madeira, vagas nos prédios). Quem você escolhe manualmente não é mexido.' },
  autoBuild: { name: 'Construção automática', era: 1, bool: true, icon: '🏗️', desc: 'O conselho ergue o que o reino precisa (moradia, depósitos, fazendas, poço...) e o que falta para a próxima era, usando só o excedente. Quando você está offline também reorganiza obras suas em distritos.' },
  autoResearch: { name: 'Pesquisa automática', era: 1, bool: true, icon: '🔬', desc: 'Escolhe sozinha a próxima tecnologia: primeiro as exigidas pela próxima era e pelos prédios que faltam, depois as mais úteis.' },
  autoEra: { name: 'Evolução automática de era', era: 1, bool: true, icon: '⭐', desc: 'Quando todos os requisitos e o custo estiverem prontos, o reino evolui de era sozinho.' },
  autoEvents: { name: 'Piloto automático: decisões', era: 1, bool: true, icon: '🧠', desc: 'O conselho resolve eventos sozinho (escolha padrão sensata), faz festivais quando o povo está triste e ajusta impostos. Desligue para decidir você mesmo.' },
  autoWorld: { name: 'Piloto automático: mundo', era: 1, bool: true, icon: '🌍', desc: 'Envia batedores, cuida da diplomacia (paz, alianças, comércio) e conquista territórios vizinhos quando o exército é claramente superior.' },
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
