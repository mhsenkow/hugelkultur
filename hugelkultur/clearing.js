// Shared rules for the clearing. The page, the guide, and the tests all read from here.

export const MEASURE_KEYS = [
  ['gate', 'Gates'],
  ['wade', 'Wade'],
  ['shake', 'Shake'],
  ['eat', 'Eat'],
  ['knit', 'Knit'],
  ['dry', 'Dry'],
  ['crust', 'Crust'],
  ['love', 'Love'],
  ['pause', 'Pause']
];

export const DEFAULT_MEASURES = {
  cloud: { gate: 0.86, wade: 0.16, shake: 0.28, eat: 0.34, knit: 0.22, dry: 0.1, crust: 0.16, love: 0.48, pause: 0.36, home: 'SPR' },
  water: { gate: 0.5, wade: 0.94, shake: 0.14, eat: 0.22, knit: 0.4, dry: 0.06, crust: 0.12, love: 0.32, pause: 0.18, home: 'SPR' },
  tree: { gate: 0.4, wade: 0.12, shake: 0.96, eat: 0.24, knit: 0.34, dry: 0.18, crust: 0.2, love: 0.42, pause: 0.28, home: 'AUT' },
  mushroom: { gate: 0.28, wade: 0.22, shake: 0.18, eat: 0.94, knit: 0.58, dry: 0.12, crust: 0.24, love: 0.52, pause: 0.22, home: 'SUM' },
  moss: { gate: 0.34, wade: 0.46, shake: 0.12, eat: 0.3, knit: 0.96, dry: 0.08, crust: 0.28, love: 0.58, pause: 0.5, home: 'SUM' },
  fire: { gate: 0.48, wade: 0.08, shake: 0.34, eat: 0.36, knit: 0.16, dry: 0.94, crust: 0.1, love: 0.36, pause: 0.14, home: 'AUT' },
  snow: { gate: 0.44, wade: 0.2, shake: 0.18, eat: 0.26, knit: 0.3, dry: 0.18, crust: 0.96, love: 0.62, pause: 0.4, home: 'WIN' }
};

export const CLIMB = 0.22;
export const YEAR_SPAN = 52 * 3 + 84;

const TREE_SIZES = [0.52, 0.74, 1, 1.32, 1.68];

function unit(salt) {
  const n = Number(salt);
  if (!Number.isFinite(n)) return 0;
  return ((n % 1) + 1) % 1;
}

export function treeScale(salt) {
  const index = Math.min(TREE_SIZES.length - 1, Math.floor(unit(salt) * TREE_SIZES.length));
  return TREE_SIZES[index];
}

export function gladeBeams(year, have) {
  const show = 4 + Math.max(0, (Number(year) || 1) - 1);
  return Math.max(0, Math.min(have || 0, show, 16));
}

export function sparkleSets(year) {
  return Math.floor(Math.max(0, Number(year) || 1) / 5);
}

export function fernCount(year) {
  return Math.min(6, Math.floor(Math.max(0, (Number(year) || 1) - 1) / 2));
}

export function stoneReady(stood, salt) {
  const years = Math.max(0, Number(stood) || 0) / YEAR_SPAN;
  return years > 6 + unit(salt) * 4;
}

// Years a healthy tree keeps. Pioneers go first. The oak and the pine outlast them.
// Chestnut, ash, and hemlock carry a sickness more easily than the others.
export const TREE_LIFE = {
  oak: [110, 180],
  chestnut: [36, 70],
  beech: [90, 150],
  maple: [70, 120],
  pine: [80, 140],
  hemlock: [55, 110],
  ash: [45, 85],
  linden: [60, 100],
  hornbeam: [80, 130],
  birch: [30, 55],
  cherry: [35, 60],
  alder: [24, 42],
  willow: [28, 48],
  serviceberry: [22, 40],
  hazel: [16, 28],
  elder: [14, 26]
};

export const BLIGHT = {
  chestnut: 0.04,
  ash: 0.022,
  hemlock: 0.016,
  beech: 0.008,
  cherry: 0.01,
  birch: 0.006,
  maple: 0.004,
  alder: 0.004,
  pine: 0.003,
  willow: 0.003,
  oak: 0.002
};

const BEAVER_WOOD = new Set(['willow', 'alder', 'birch']);

export function lifeSpan(kind, salt = 0) {
  const span = TREE_LIFE[kind] || [70, 120];
  return span[0] + unit(salt) * (span[1] - span[0]);
}

// Youth is the first span of growth. After that the tree keeps climbing, more slowly, and it does not stop.
export function statureOf(growth) {
  const g = Math.max(0, Number(growth) || 0);
  const youth = Math.min(1, g);
  const elder = Math.max(0, g - 1);
  return youth + elder / (1 + elder * 0.35);
}

export function growWood(growth, dt, shrub = false, sick = false) {
  const g = Math.max(0, Number(growth) || 0);
  const pace = shrub ? 0.007 : 0.0055;
  const ease = 1 / (1 + Math.max(0, g - 0.35) * 0.8);
  const next = g + Math.max(0, Number(dt) || 0) * pace * ease * (sick ? 0.3 : 1);
  return Math.min(8, next);
}

export function blightStrike(kind, salt) {
  const chance = BLIGHT[kind] ?? 0.003;
  return unit(salt) < chance;
}

export function beaverWood(kind) {
  return BEAVER_WOOD.has(kind);
}

export function fallReady(age, growth, salt, kind) {
  if ((Number(growth) || 0) < 0.8) return false;
  let name = 'maple';
  if (kind === true) name = 'hazel';
  else if (typeof kind === 'string') name = kind;
  return (Number(age) || 0) / YEAR_SPAN > lifeSpan(name, salt);
}
const GOD_KEY = 'hugelkultur-measures';

export const SEASON_LOOK = {
  SPR: { dots: 0.74, ink: 0.04, grain: 0.34, pattern: 'bayer' },
  SUM: { dots: 0.48, ink: 0.02, grain: 0.26, pattern: 'bayer' },
  AUT: { dots: 0.66, ink: 0.1, grain: 0.68, pattern: 'bayer' },
  WIN: { dots: 0.54, ink: 0.06, grain: 0.4, pattern: 'blue-noise' }
};

export const MOUTH_YAW = { N: 0, E: -Math.PI / 2, S: Math.PI, W: Math.PI / 2 };

export const SEASON_NAME = { SPR: 'Spring', SUM: 'Summer', AUT: 'Autumn', WIN: 'Winter' };
export const EDGE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };

export const WOOD = {
  oak: { weight: 1.4, slide: 0.04, bridge: 0, root: 0, sticks: 2, color: 5, half: 0.3, label: 'oak' },
  birch: { weight: 0.5, slide: 0.9, bridge: 0, root: 0, sticks: 1, color: 6, half: 0.44, label: 'birch' },
  willow: { weight: 0.72, slide: 0.18, bridge: 1, root: 0, sticks: 1, color: 9, half: 0.5, label: 'willow' },
  alder: { weight: 0.84, slide: 0.1, bridge: 0, root: 1, sticks: 1, color: 12, half: 0.36, label: 'alder' },
  maple: { weight: 0.9, slide: 0.28, bridge: 0, root: 0, sticks: 1, color: 10, half: 0.36, label: 'maple' }
};

export const OPEN_CROWN = new Set(['maple', 'birch', 'ash', 'willow', 'hemlock', 'alder', 'serviceberry', 'cherry']);

const STORY = { tend: 'you', leaf: 'leaves', snow: 'snow', rain: 'rain' };

export function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

export function blankMeasures() {
  const out = { climb: CLIMB };
  for (const [id, row] of Object.entries(DEFAULT_MEASURES)) out[id] = { ...row };
  return out;
}

export function loadMeasures() {
  const base = blankMeasures();
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = JSON.parse(localStorage.getItem(GOD_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    if (Number.isFinite(raw.climb)) base.climb = Math.min(0.8, Math.max(0, raw.climb));
    for (const id of Object.keys(DEFAULT_MEASURES)) {
      const row = raw[id];
      if (!row || typeof row !== 'object') continue;
      for (const [key] of MEASURE_KEYS) {
        if (Number.isFinite(row[key])) base[id][key] = clamp01(row[key]);
      }
      if (SEASON_NAME[row.home]) base[id].home = row.home;
    }
  } catch {
    /* the original measures still stand */
  }
  return base;
}

export function saveMeasures(measures) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(GOD_KEY, JSON.stringify(measures)); } catch { /* this run still bends */ }
}

export function wornMeasures(sim) {
  return sim?.measures?.[sim.spiritId] || DEFAULT_MEASURES[sim?.spiritId] || DEFAULT_MEASURES.cloud;
}

export function seasonFit(home, seasonId) {
  return home === seasonId ? 1.9 : 0.5;
}

// The shallow-water step refuses a rain rate above 10000 and a depth above 2000,
// and a fast flood also blows its work budget. Sixteen is the heaviest rain the
// clearing still carries: an autumn at that pressure stands about fourteen deep.
export const PRESSURE_CAP = 16;

export function pressureOf(year, climb = CLIMB) {
  const y = Math.max(1, Number(year) || 1);
  const c = Math.min(0.8, Math.max(0, Number(climb) || 0));
  if (!Number.isFinite(y)) return 1;
  return Math.min(PRESSURE_CAP, 1 + (y - 1) * c);
}

export function noteYear(sim) {
  if (!sim?.yearLine) return;
  sim.years = sim.years || [];
  sim.years.push(sim.yearLine);
  if (String(sim.yearLine).includes('gate')) sim.gates = (sim.gates || 0) + 1;
  if (sim.years.length > 24) sim.years.splice(0, sim.years.length - 24);
}

export function liftCap(year) {
  return 2 + Math.max(0, (Number(year) || 1) - 1);
}

export function woodOf(kind) {
  return WOOD[kind] || WOOD.maple;
}

export function phrase(name) {
  const lower = String(name || 'tree').toLowerCase();
  const article = /^[aeiou]/.test(lower) ? 'an' : 'a';
  return `${article} ${lower}`;
}

export function stickPhrase(label) {
  const lower = String(label || 'maple').toLowerCase();
  const article = /^[aeiou]/.test(lower) ? 'an' : 'a';
  return `${article} ${lower} stick`;
}

export function storyLine(story) {
  if (!story?.length) return 'A mound. It is good.';
  const name = cause => STORY[cause] || cause;
  const head = name(story[0]);
  const first = head.charAt(0).toUpperCase() + head.slice(1);
  if (story.length === 1) return `${first}. It is good.`;
  return `${first}. Then ${story.slice(1).map(name).join('. Then ')}.`;
}

const WEDGE_NAME = ['west', 'northwest', 'north', 'northeast', 'east', 'southeast', 'south', 'southwest'];

export function holdsWater(cell) {
  if (!cell || cell.hearth) return false;
  return !!cell.berm || (cell.layers || 0) >= 3 || (cell.cubes || 0) > 0 || !!cell.dam;
}

const SMALL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export function groundLine(cubes) {
  const n = Math.max(0, Math.round(Number(cubes) || 0));
  if (n <= 0) return '';
  if (n === 1) return 'A year is in this ground.';
  if (n < 10) {
    const word = SMALL[n - 1];
    return `${word.charAt(0).toUpperCase()}${word.slice(1)} years are in this ground.`;
  }
  return 'Many years are in this ground.';
}

export function idolVoice(peak) {
  if (peak === 'dry') return 'Nothing came. It is good.';
  if (peak === 'hem') return 'The water came to the hem. It passed.';
  return '';
}

export function wedgeOf(i, k, hearthI, hearthK) {
  const dx = i - hearthI;
  const dz = k - hearthK;
  return Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 8) % 8;
}

export function circleState(cells, hearthI, hearthK, pad) {
  const wedges = [false, false, false, false, false, false, false, false];
  let any = false;
  for (const cell of cells || []) {
    const dx = cell.i - hearthI;
    const dz = cell.k - hearthK;
    const dist = Math.hypot(dx, dz);
    if (dist <= pad || dist >= 3.35 || cell.hearth) continue;
    if (!holdsWater(cell)) continue;
    any = true;
    wedges[wedgeOf(cell.i, cell.k, hearthI, hearthK)] = true;
  }
  const missing = wedges.findIndex(held => !held);
  return {
    any,
    closed: any && missing < 0,
    filled: wedges.filter(Boolean).length,
    missing: missing < 0 ? '' : WEDGE_NAME[missing],
    missingIndex: missing
  };
}

export function circleClosed(cells, hearthI, hearthK, pad) {
  return circleState(cells, hearthI, hearthK, pad).closed;
}

export function compassName(i, k, hearthI = 8, hearthK = 8) {
  const dx = i - hearthI;
  const dz = k - hearthK;
  if (Math.abs(dx) < 0.5 && Math.abs(dz) < 0.5) return 'idol';
  if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? 'north' : 'south';
  return dx > 0 ? 'east' : 'west';
}

export function stillWants(marks) {
  const need = [
    ['tend', 'your hand'],
    ['leaf', 'leaves'],
    ['snow', 'snow'],
    ['rain', 'rain']
  ].filter(([key]) => !marks?.[key]).map(([, name]) => name);
  if (!need.length) return '';
  return ` It still wants ${need.join(', ')}.`;
}

export function buried(cell) {
  return !cell?.berm && (cell?.layers || 0) > 0 && cell.layers < 3 && (cell.snow || 0) > 0.45;
}

export function idolStage(depth) {
  const d = Number(depth);
  if (!Number.isFinite(d) || d < 0.008) return 'dry';
  if (d < 0.02) return 'hem';
  if (d < 0.045) return 'drinks';
  return 'under';
}

export function idolLabel(stage) {
  if (stage === 'hem') return 'at the hem';
  if (stage === 'drinks') return 'idol drinks';
  if (stage === 'under') return 'idol wet';
  return 'idol dry';
}

export function yearTitle(chronicle) {
  if (chronicle?.circle) return 'The year the circle held.';
  if (chronicle?.drank) return 'The year the idol drank.';
  if (chronicle?.wood && chronicle?.edge && EDGE_NAME[chronicle.edge]) {
    return `The year the ${chronicle.wood} took the ${EDGE_NAME[chronicle.edge]} gate.`;
  }
  if ((chronicle?.berms || 0) > 0) return 'The year the mounds kept the figure.';
  return 'The year the idol stayed dry.';
}

export function fitLine(voice, seasonId, home) {
  const season = SEASON_NAME[seasonId] || 'The year';
  const obj = voice?.obj || 'them';
  if (home === seasonId) return `${season} fits ${obj}.`;
  return `${season} asks more of ${obj}.`;
}

export function fittingId(measures, seasonId) {
  for (const [id, row] of Object.entries(measures || {})) {
    if (row && row.home === seasonId) return id;
  }
  return null;
}

export function awayLine(seasons, capped) {
  if (capped) return 'A year kept going.';
  if (seasons >= 4) return 'The year turned while you were gone.';
  if (seasons === 3) return 'Three seasons passed.';
  if (seasons === 2) return 'Two seasons passed.';
  if (seasons === 1) return 'A season passed.';
  return 'The clearing kept your work.';
}

export function freshChronicle() {
  return { circle: false, drank: false, wood: null, edge: null, berms: 0 };
}
