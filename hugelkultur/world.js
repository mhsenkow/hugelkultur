import { layGardens } from './gardens.js?v=fifty';
import { sculptTree } from './specimens.js?v=fifty';
import { freshChronicle, gladeBeams } from './clearing.js?v=fifty';

export const GRID_SIZES = [16, 32, 64];
export let GRID = 16;
export let ORIGIN = -8;
export let HEARTH_I = 8;
export let HEARTH_K = 8;

export function useGrid(grid) {
  const next = GRID_SIZES.includes(Number(grid)) ? Number(grid) : 16;
  GRID = next;
  ORIGIN = -next / 2;
  HEARTH_I = next / 2;
  HEARTH_K = next / 2;
  return next;
}
export const PAD = 1.85;
// Inside this, except the gates, the figure keeps a court. The wall wants to stand farther out.
export const COURT = 2.55;
// One year's mound, once it has become a block of the ground.
export const DIRT_CUBE = 0.74;
// Bricks drawn on a cell. Older bricks fold into cell.sunk so a long life stays cheap.
export const DIRT_CAP = 4;
// Full bricks until the ring stands above a saturated autumn, then the rise eases
// toward CREST. CREST stays far under the water solver's terrain limit.
export const RIDGE = 48;
export const CREST = 96;
// Height of the idol's feet above the clearing floor. Water may sheet
// across the circle; it has to climb this far before the figure is wet.
export const PEDESTAL = 0.26;

// One bit per season, in the order spring, summer, autumn, winter.
export const FLOW = { SPR: 1, SUM: 2, AUT: 4, WIN: 8 };

// Each season owns a braid: two strands that wander apart, then meet at a gate on the dry pad.
const FINGERS = [
  { bit: FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6], seed: 0.4 },
  { bit: FLOW.SUM, edge: 'E', mouth: [15, 11], gate: [10, 9], seed: 1.7 },
  { bit: FLOW.AUT, edge: 'S', mouth: [5, 15], gate: [7, 10], seed: 2.5 },
  { bit: FLOW.WIN, edge: 'W', mouth: [0, 4], gate: [6, 7], seed: 3.4 }
];

export const PALETTE = [
  0xf0eee9, 0x252629, 0xc49a62, 0xe6bc82, 0xf3d7a6, 0x8d5b4c, 0xf7efe2, 0x2f8f55,
  0x4fd18b, 0xb6e38a, 0xd97736, 0x5a3e2e, 0x7ec8c2, 0xe0a04a, 0xf4c56a, 0x1c6b40
];

export const INK = {
  charcoal: 1,
  soil: 2,
  sand: 3,
  bark: 5,
  moss: 7,
  lush: 8,
  leaf: 9,
  stick: 10,
  humus: 11,
  brass: 13,
  ember: 14,
  deep: 15
};

export const STIPPLE = {
  pixelSize: 2,
  tone: {
    preset: 'stipple',
    cutoff: 0.05,
    amount: 0.62,
    pattern: 'bayer',
    seed: 11,
    preserveDots: true,
    stops: [
      [0, '#000000'],
      [0.14, '#252629'],
      [0.28, '#5a3e2e'],
      [0.42, '#1c6b40'],
      [0.5, '#8d5b4c'],
      [0.58, '#2476c9'],
      [0.68, '#4fd18b'],
      [0.78, '#e6bc82'],
      [0.88, '#f3d7a6'],
      [1, '#f0eee9']
    ]
  }
};
const SAND = { r: [2, 3, 11, 5] };
const GLADE = { r: [6, 4, 6, 14] };
const CLEARING = { r: [0, 6, 4, 9] };
const CHANNEL = { r: [11, 2, 5, 3] };
const OLD = { r: [4, 6, 3, 0] };

const STONE = { r: [2, 5, 4, 6] };
const TREE_KINDS = ['oak', 'maple', 'birch', 'beech', 'ash', 'linden', 'hornbeam', 'alder', 'willow', 'pine', 'hemlock', 'cherry', 'chestnut', 'serviceberry'];

// One forest per visit. Fidelity is how tightly the sculpt packs spheres.
export const SCENE = { seed: 1, fidelity: 1 };

export function setScene({ seed, fidelity, grid } = {}) {
  if (grid !== undefined) useGrid(grid);
  SCENE.seed = (seed >>> 0) || 1;
  SCENE.fidelity = Math.min(4, Math.max(1, Math.round(Number(fidelity) || 1)));
}

export function sceneRes(res) {
  const gain = 1 + (SCENE.fidelity - 1) * 0.62;
  return Math.max(0.018, res / gain);
}

export function sceneCount(n) {
  return Math.max(1, Math.round(n * (1 + (SCENE.fidelity - 1) * 0.85)));
}

export function dressSculpt(S) {
  const scale = options => {
    const next = options ? { ...options } : {};
    next.res = sceneRes(next.res || S.res || 0.09);
    return next;
  };
  const wrap = (name, index) => {
    const fn = S[name].bind(S);
    S[name] = (...args) => {
      args[index] = scale(args[index]);
      return fn(...args);
    };
  };
  wrap('ball', 3);
  wrap('box', 3);
  wrap('lathe', 4);
  wrap('torus', 4);
  wrap('tube', 4);
  return S;
}

function mulberry(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
    a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
    return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
  };
}

export function hash(n) {
  let a = (n >>> 0) || 1;
  a = Math.imul(a ^ (a >>> 16), 0x7feb352d);
  a = Math.imul(a ^ (a >>> 15), 0x846ca68b);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}

export function cellCenter(i, k) {
  return { x: ORIGIN + (i + 0.5), z: ORIGIN + (k + 0.5) };
}

export function cellAt(cells, x, z) {
  const i = Math.floor(x - ORIGIN);
  const k = Math.floor(z - ORIGIN);
  if (i < 0 || k < 0 || i >= GRID || k >= GRID) return null;
  return cells[k * GRID + i];
}

export function blockHeights(cell) {
  if (!cell) return [];
  if (Array.isArray(cell.block) && cell.block.length) return cell.block;
  const n = Math.max(0, Math.min(cell.cubes || 0, DIRT_CAP));
  return Array.from({ length: n }, () => DIRT_CUBE);
}

export function brickGain(have, want) {
  const ask = Math.max(DIRT_CUBE, Number(want) || 0);
  if (!Number.isFinite(ask)) return DIRT_CUBE;
  const height = Number.isFinite(have) && have > 0 ? have : 0;
  if (height < RIDGE) return ask;
  const room = CREST - height;
  if (room <= 1e-6) return 0;
  return Math.min(ask, room);
}

function risen(cell) {
  let stack = cell.sunk || 0;
  if (!(cell.sunk > 0) && !Array.isArray(cell.block)) {
    const hidden = Math.max(0, (cell.cubes || 0) - DIRT_CAP);
    stack += hidden * DIRT_CUBE;
  }
  for (const height of blockHeights(cell)) stack += height;
  return (cell.land || 0) + stack;
}

export function walkHeight(cell) {
  if (!cell) return 1e9;
  const land = risen(cell);
  if (cell.plot) return cell.elevation + land + 0.24;
  if (cell.berm) return cell.elevation + land + (cell.rock ? 0.16 : 0.38);
  // A stack of sticks is a step. Four of them reach a single cube.
  return cell.elevation + land + Math.min(cell.layers || 0, 4) * 0.1;
}

export function bedHeight(cell) {
  const land = risen(cell);
  let height;
  if (cell.plot) height = cell.elevation + land + 0.3;
  else if (cell.berm) {
    const stack = (cell.sunk || 0) + blockHeights(cell).reduce((sum, height) => sum + height, 0);
    const body = cell.rock
      ? 0.2
      : 0.5 + Math.min(cell.coat || 1, 6) * 0.06 + (cell.lift || 0) * 0.1;
    const extra = Math.min(body, Math.max(0, CREST - stack));
    height = cell.elevation + land + extra;
  } else if (cell.hearth) height = cell.elevation + PEDESTAL;
  else height = cell.elevation + land + cell.layers * 0.16 * (1 + Math.min(cell.mass || 0, 3) * 0.05);
  if (cell.rooted) height += 0.16;
  if (cell.raft) height += Math.min(0.22, cell.raft * 0.1);
  if (cell.sill) height += cell.sill;
  // A drift is a soft crust. It eases the water aside and it does not lift the lake.
  if (!cell.hearth && cell.snow > 0.08) height += Math.min(cell.snow, 1.2) * 0.07;
  return height;
}

export function copyFingers() {
  return FINGERS.map(finger => ({
    bit: finger.bit,
    edge: finger.edge,
    mouth: finger.mouth.slice(),
    gate: finger.gate.slice(),
    seed: finger.seed
  }));
}

function onStrand(i, k, finger) {
  const [mx, mz] = finger.mouth;
  const [gx, gz] = finger.gate;
  const dx = gx - mx;
  const dz = gz - mz;
  const len2 = dx * dx + dz * dz;
  let t = ((i - mx) * dx + (k - mz) * dz) / len2;
  if (t < -0.04 || t > 1.08) return false;
  t = Math.max(0, Math.min(1, t));
  const len = Math.sqrt(len2);
  const px = -dz / len;
  const pz = dx / len;
  const fade = Math.sin(Math.PI * t);
  const wob = (Math.sin(t * 8.4 + finger.seed) * 2.15 + Math.sin(t * 15.5 + finger.seed * 2.1) * 0.85) * fade;
  const split = (1 - t) * 1.35;
  const width = 1.05 + 0.22 * Math.sin(t * 12 + finger.seed);
  for (const side of [-1, 1]) {
    const sx = mx + dx * t + px * (wob + side * split);
    const sz = mz + dz * t + pz * (wob + side * split);
    if (Math.hypot(i - sx, k - sz) <= width) return true;
  }
  return false;
}

export function flowBits(i, k) {
  if (Math.hypot(i - HEARTH_I, k - HEARTH_K) <= PAD) return 0;
  let bits = 0;
  for (const finger of FINGERS) if (onStrand(i, k, finger)) bits |= finger.bit;
  return bits;
}

export function isMouth(cell, edge) {
  if (!cell?.channel) return false;
  const finger = FINGERS.find(item => item.edge === edge);
  if (!finger || (cell.flow & finger.bit) === 0) return false;
  if (edge === 'N') return cell.k === 0;
  if (edge === 'S') return cell.k === GRID - 1;
  if (edge === 'W') return cell.i === 0;
  return cell.i === GRID - 1;
}

function elevationOf(i, k, channel) {
  const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
  const grain = (hash(i * 17 + k * 13 + SCENE.seed) - 0.5) * (channel ? 0.08 : 0.14);
  if (dist <= PAD) return 0.8 + grain * 0.25;
  if (channel) return 0.46 + dist * 0.038 + grain;
  return 0.9 + dist * 0.012 + grain;
}

function rollFingers(rand) {
  const last = GRID - 1;
  const lip = () => 2 + Math.floor(rand() * Math.max(1, GRID - 4));
  const slide = () => HEARTH_I - 4 + Math.floor(rand() * 9);
  const edges = [
    { bit: FLOW.SPR, edge: 'N', mouth: () => [lip(), 0], gate: () => [slide(), HEARTH_K - 2] },
    { bit: FLOW.SUM, edge: 'E', mouth: () => [last, lip()], gate: () => [HEARTH_I + 2, slide()] },
    { bit: FLOW.AUT, edge: 'S', mouth: () => [lip(), last], gate: () => [slide(), HEARTH_K + 2] },
    { bit: FLOW.WIN, edge: 'W', mouth: () => [0, lip()], gate: () => [HEARTH_I - 2, slide()] }
  ];
  edges.forEach((edge, index) => {
    FINGERS[index].bit = edge.bit;
    FINGERS[index].edge = edge.edge;
    FINGERS[index].mouth = edge.mouth();
    FINGERS[index].gate = edge.gate();
    FINGERS[index].seed = rand() * 6.2;
  });
}

function rollHollows() {
  if (GRID < 32) return [];
  const rand = mulberry((SCENE.seed ^ 0x51ed) >>> 0);
  const hollows = [];
  const want = GRID >= 64 ? 2 : 1;
  let guard = 0;
  while (hollows.length < want && guard++ < 60) {
    const i = 4 + Math.floor(rand() * (GRID - 8));
    const k = 4 + Math.floor(rand() * (GRID - 8));
    const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
    if (dist < GRID * 0.28 || dist > GRID * 0.46) continue;
    if (hollows.some(hollow => Math.hypot(hollow.i - i, hollow.k - k) < 12)) continue;
    if (flowBits(i, k)) continue;
    hollows.push({ i, k, r: 2.6 + rand() * 0.7, seed: rand() * 8, stand: hollows.length === 0 });
  }
  return hollows;
}

function inHollow(hollows, i, k) {
  return hollows.some(hollow => Math.hypot(i - hollow.i, k - hollow.k) < hollow.r);
}

function rollTrees(rand, hollows) {
  const trees = [];
  const used = new Set();
  const count = GRID === 64 ? 28 + Math.floor(rand() * 12) : GRID === 32 ? 16 + Math.floor(rand() * 8) : 6 + Math.floor(rand() * 4);
  const far = GRID === 16 ? 7.8 : GRID / 2 - 1.2;
  let guard = 0;
  while (trees.length < count && guard++ < count * 40) {
    let i;
    let k;
    if (trees.length && rand() < 0.5) {
      const host = trees[Math.floor(rand() * trees.length)];
      i = host.i + Math.floor(rand() * 3) - 1;
      k = host.k + Math.floor(rand() * 3) - 1;
    } else {
      i = Math.floor(rand() * GRID);
      k = Math.floor(rand() * GRID);
    }
    if (i < 0 || k < 0 || i >= GRID || k >= GRID) continue;
    const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
    if (dist < 4.4 || dist > far) continue;
    if (flowBits(i, k) || inHollow(hollows, i, k)) continue;
    const key = `${i},${k}`;
    if (used.has(key)) continue;
    used.add(key);
    trees.push({
      kind: TREE_KINDS[Math.floor(rand() * TREE_KINDS.length)],
      i,
      k,
      seed: 1 + Math.floor(rand() * 900)
    });
  }
  return trees;
}

function rollStones(rand, cells, blocked) {
  const stones = [];
  let guard = 0;
  const want = GRID === 64 ? 10 : GRID === 32 ? 7 : 4;
  const far = GRID === 16 ? 6.6 : Math.min(GRID / 2 - 1.5, 6.6 + (GRID - 16) * 0.35);
  while (stones.length < want && guard++ < want * 50) {
    const i = Math.floor(rand() * GRID);
    const k = Math.floor(rand() * GRID);
    const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
    if (dist < 3.1 || dist > far) continue;
    const key = `${i},${k}`;
    if (blocked.has(key)) continue;
    const cell = cells[k * GRID + i];
    if (!cell || cell.tree || cell.channel || cell.hearth || cell.clearing) continue;
    blocked.add(key);
    stones.push([i, k]);
  }
  return stones;
}

function takeRun(rand, cells, length, blocked) {
  for (let attempt = 0; attempt < 90; attempt++) {
    const horizontal = rand() < 0.5;
    const span = length - 1;
    const i0 = Math.max(1, Math.min(GRID - 2 - (horizontal ? span : 0), Math.round(HEARTH_I + (rand() - 0.5) * 8)));
    const k0 = Math.max(1, Math.min(GRID - 2 - (horizontal ? 0 : span), Math.round(HEARTH_K + (rand() - 0.5) * 8)));
    const spots = [];
    let ok = true;
    for (let step = 0; step < length; step++) {
      const i = i0 + (horizontal ? step : 0);
      const k = k0 + (horizontal ? 0 : step);
      const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
      if (dist < 2.2 || dist > 5.3) { ok = false; break; }
      const key = `${i},${k}`;
      if (blocked.has(key)) { ok = false; break; }
      const cell = cells[k * GRID + i];
      if (!cell || cell.tree || cell.channel || cell.hearth) { ok = false; break; }
      spots.push([i, k]);
    }
    if (!ok) continue;
    for (const [i, k] of spots) blocked.add(`${i},${k}`);
    return spots;
  }
  return null;
}

function rollBeds(rand, cells, blocked) {
  const specs = [
    { crop: 'carrot', length: 2, start: [0.42, 0.16] },
    { crop: 'turnip', length: 3, start: [0.7, 0.34, 0.12] },
    { crop: 'mushroom', length: 2, start: [1, 0.48] }
  ];
  const beds = [];
  for (const spec of specs) {
    const cellsForBed = takeRun(rand, cells, spec.length, blocked);
    if (!cellsForBed) continue;
    beds.push({ crop: spec.crop, cells: cellsForBed, start: spec.start });
  }
  return beds;
}

function rollLoose(rand, cells, blocked) {
  const loose = [];
  const count = 12 + Math.floor(rand() * 6);
  let guard = 0;
  while (loose.length < count && guard++ < 220) {
    const i = Math.max(0, Math.min(GRID - 1, HEARTH_I + Math.floor((rand() - 0.5) * 14)));
    const k = Math.max(0, Math.min(GRID - 1, HEARTH_K + Math.floor((rand() - 0.5) * 14)));
    const key = `${i},${k}`;
    if (blocked.has(key)) continue;
    const cell = cells[k * GRID + i];
    if (!cell || cell.hearth || cell.tree || cell.clearing) continue;
    blocked.add(key);
    loose.push([i, k]);
  }
  return loose;
}

function makeCells(grove, hollows) {
  const trees = new Set(grove.map(tree => `${tree.i},${tree.k}`));
  const cells = [];
  for (let k = 0; k < GRID; k++) {
    for (let i = 0; i < GRID; i++) {
      const { x, z } = cellCenter(i, k);
      const tree = trees.has(`${i},${k}`);
      const flow = tree ? 0 : flowBits(i, k);
      const channel = flow !== 0;
      const dist = Math.hypot(i - HEARTH_I, k - HEARTH_K);
      cells.push({
        i, k, x, z, channel, flow,
        elevation: elevationOf(i, k, channel),
        layers: 0,
        berm: false,
        moisture: 0,
        damp: 0,
        growth: 0,
        clearing: dist <= PAD,
        hollow: inHollow(hollows, i, k),
        hearth: i === HEARTH_I && k === HEARTH_K,
        tree
      });
    }
  }
  return cells;
}

function composeScene() {
  const rand = mulberry(SCENE.seed);
  rollFingers(rand);
  const hollows = rollHollows();
  const grove = rollTrees(rand, hollows);
  const cells = makeCells(grove, hollows);
  const blocked = new Set(grove.map(tree => `${tree.i},${tree.k}`));
  blocked.add(`${HEARTH_I},${HEARTH_K}`);
  return {
    cells,
    grove,
    stones: rollStones(rand, cells, blocked),
    beds: rollBeds(rand, cells, blocked),
    loose: rollLoose(rand, cells, blocked),
    hollows
  };
}

// The kept figure. One eye, a brass collar, an ember heart, and a single sprout.
// The camera opens from +x/+z, so the face and the sprout are turned that way.
function sculptIdol(S, x, y, z) {
  const floor = { r: [0, 6, 4] };
  const lip = { r: [INK.bark, INK.humus, INK.soil] };
  const drum = { r: [INK.soil, INK.bark, 4] };
  const brass = { r: [INK.brass, INK.ember, 3] };
  const body = { r: [6, 4, INK.bark, INK.soil] };
  const heart = { r: [INK.ember], em: true };
  const shoot = { r: [INK.deep, INK.lush] };
  const leaf = { r: [INK.leaf, INK.lush, 4] };

  S.lathe([x, y - 0.02, z], 0.055, 1.5, floor, { res: 0.12 });
  S.torus([x, y + 0.04, z], 1.44, 0.05, lip, { res: 0.055 });

  const gates = FINGERS.map(finger => {
    const g = cellCenter(finger.gate[0], finger.gate[1]);
    return Math.atan2(g.z - z, g.x - x);
  });
  for (let i = 0; i < gates.length; i++) {
    const a0 = gates[i];
    const a1 = gates[(i + 1) % gates.length];
    let span = a1 - a0;
    if (span < 0) span += Math.PI * 2;
    const a = a0 + span * 0.5;
    const lift = 0.07 + hash(i * 19 + 5) * 0.03;
    S.ball(
      [x + Math.cos(a) * 1.44, y + lift, z + Math.sin(a) * 1.44],
      [0.11, 0.075, 0.09],
      STONE,
      { res: 0.05 }
    );
  }

  S.lathe([x, y, z], 0.06, 0.72, lip, { res: 0.06 });
  S.lathe([x, y + 0.06, z], 0.12, t => 0.48 - t * 0.16, drum, { res: 0.05 });
  S.lathe([x, y + 0.18, z], 0.08, 0.5, brass, { res: 0.045 });
  const feet = y + PEDESTAL;

  S.lathe([x, feet - 0.02, z], 0.5, t => 0.08 + Math.sin(Math.PI * t) * 0.13, body, { res: 0.045 });
  const headY = feet + 0.58;
  S.ball([x + 0.03, headY, z + 0.03], [0.16, 0.18, 0.15], { r: [6, 4, 0] }, { res: 0.045 });
  S.ball([x + 0.11, headY + 0.03, z + 0.12], 0.045, { r: [INK.charcoal] }, { res: 0.025 });
  S.torus([x, feet + 0.4, z], 0.16, 0.045, brass, { res: 0.035 });
  S.ball([x + 0.12, feet + 0.24, z + 0.14], 0.065, heart, { res: 0.035 });
  S.tube(
    [[x + 0.12, feet + 0.32, z + 0.02], [x + 0.28, feet + 0.42, z - 0.1], [x + 0.34, feet + 0.34, z - 0.18]],
    0.06,
    0.04,
    body,
    { res: 0.035 }
  );
  S.tube(
    [[x - 0.02, headY + 0.1, z + 0.02], [x - 0.16, headY + 0.32, z + 0.08], [x - 0.26, headY + 0.5, z + 0.18]],
    0.065,
    0.032,
    shoot,
    { res: 0.035 }
  );
  S.ball([x - 0.3, headY + 0.54, z + 0.22], [0.12, 0.03, 0.07], leaf, { res: 0.03 });
}

// The idol's ring stays a cell at a time. Farther woods are broad overlapping
// plates so the floor reads as ground, with the river left as a cut.
function groundRes(dist, channel) {
  if (GRID <= 16 || dist < 6) return 0.34;
  if (channel && dist < 16) return GRID >= 64 ? 0.48 : 0.4;
  if (GRID === 32) return dist < 12 ? 0.5 : 0.72;
  return dist < 10 ? 0.52 : 0.9;
}

function floorPlate(cell) {
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  const rim = cell.i < 2 || cell.k < 2 || cell.i > GRID - 3 || cell.k > GRID - 3;
  return dist >= 6 && !rim && !cell.channel && !cell.clearing && !cell.hollow;
}

function layFrame(yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [[c, 0, -s], [0, 1, 0], [s, 0, c]];
}

function canopyLine(dist) {
  const rim = GRID >= 64 ? 26 : GRID >= 32 ? 18 : 13;
  const span = Math.max(5, GRID * 0.36);
  const t = Math.min(1, Math.max(0, (dist - 4.6) / span));
  return 4.8 + (rim - 4.8) * t * t;
}

function sculptStand(S, cells, hollows) {
  for (const hollow of hollows) {
    const heart = cells[Math.round(hollow.k) * GRID + Math.round(hollow.i)];
    if (!heart) continue;
    S.ball(
      [heart.x + 0.4, heart.elevation + 0.08, heart.z - 0.2],
      [0.28, 0.12, 0.2],
      STONE,
      { res: 0.14 }
    );
    if (!hollow.stand) continue;
    for (let n = 0; n < 4; n++) {
      const yaw = hollow.seed + n * 1.35;
      const reach = hollow.r * 0.62;
      const i = Math.max(0, Math.min(GRID - 1, Math.round(hollow.i + Math.cos(yaw) * reach)));
      const k = Math.max(0, Math.min(GRID - 1, Math.round(hollow.k + Math.sin(yaw) * reach)));
      const cell = cells[k * GRID + i];
      if (!cell) continue;
      const len = 1.35 + (n % 2) * 0.45;
      S.box(
        [cell.x, cell.elevation + 0.12, cell.z],
        [len * 0.5, 0.09, 0.12],
        { r: [5, 11, 1] },
        { res: 0.14, rd: 0.04, ax: layFrame(yaw + Math.PI / 2) }
      );
    }
  }
}

function sculptClearing(S, cells, stones, hollows) {
  const slab = GRID / 2 + 0.25;
  S.box([0, -0.72, 0], [slab, 0.72, slab], { r: [INK.charcoal, INK.charcoal, INK.charcoal] }, { res: Math.max(0.62, GRID / 28), rd: 0.12 });
  const skip = GRID > 16 ? new Uint8Array(cells.length) : null;
  if (skip) {
    const tile = GRID >= 64 ? 8 : 4;
    const bleed = 0.16;
    for (let k = 0; k + tile <= GRID; k += tile) {
      for (let i = 0; i + tile <= GRID; i += tile) {
        let elev = 0;
        let open = true;
        for (let dk = 0; dk < tile && open; dk++) {
          for (let di = 0; di < tile; di++) {
            const cell = cells[(k + dk) * GRID + (i + di)];
            if (!floorPlate(cell)) {
              open = false;
              break;
            }
            elev += cell.elevation;
          }
        }
        if (!open) continue;
        elev /= tile * tile;
        const cap = 0.18;
        S.box(
          [ORIGIN + i + tile / 2, elev - cap / 2, ORIGIN + k + tile / 2],
          [tile / 2 + bleed, cap / 2, tile / 2 + bleed],
          SAND,
          { res: tile >= 8 ? 1.7 : 1.15, rd: 0.02 }
        );
        for (let dk = 0; dk < tile; dk++) {
          for (let di = 0; di < tile; di++) skip[(k + dk) * GRID + (i + di)] = 1;
        }
      }
    }
  }
  for (const cell of cells) {
    if (skip?.[cell.k * GRID + cell.i]) continue;
    const half = cell.elevation / 2;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    const mat = cell.channel ? CHANNEL : cell.hollow ? OLD : cell.clearing ? CLEARING : dist <= 3.15 ? GLADE : SAND;
    const wide = GRID > 16 && dist >= 6 && !cell.channel && !cell.clearing;
    S.box(
      [cell.x, half, cell.z],
      [wide ? 0.58 : 0.46, half, wide ? 0.58 : 0.46],
      mat,
      { res: groundRes(dist, cell.channel), rd: wide ? 0.02 : 0.055 }
    );
  }
  const hearth = cells[HEARTH_K * GRID + HEARTH_I];
  sculptIdol(S, hearth.x, hearth.elevation, hearth.z);
  sculptStand(S, cells, hollows);
  for (const [i, k] of stones) {
    const cell = cells[k * GRID + i];
    S.ball([cell.x, cell.elevation + 0.06, cell.z], [0.24, 0.11, 0.18], STONE, { res: 0.11 });
  }
}

function sculptTrees(S, B, cells, grove) {
  const trees = [];
  const box = S.box;
  const ball = S.ball;
  let mark = -1;
  S.box = (...args) => {
    const solid = box(...args);
    if (mark >= 0 && solid) solid.grove = mark;
    return solid;
  };
  S.ball = (...args) => {
    const solid = ball(...args);
    if (mark >= 0 && solid) solid.grove = mark;
    return solid;
  };
  const prev = S.emit;
  const spot = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  S.emit = (solid, n0, n1) => {
    const tree = solid?.grove != null ? trees[solid.grove] : null;
    if (tree && n1 > n0) {
      for (let i = n0; i < n1; i++) {
        if (!B.dabAt(i, spot)) continue;
        const dx = spot[0] - tree.x;
        const dz = spot[2] - tree.z;
        // Trunks stay. Only this tree's own leaves, not the ground the field happened to credit to it.
        if (spot[6] >= 1 || dx * dx + dz * dz > 25) continue;
        if (!tree.ids) tree.ids = [];
        tree.ids.push(i);
      }
    }
    if (prev) prev(solid, n0, n1);
  };
  grove.forEach((spec, index) => {
    const cell = cells[spec.k * GRID + spec.i];
    const y0 = cell.elevation;
    const dist = Math.hypot(spec.i - HEARTH_I, spec.k - HEARTH_K);
    const lean = GRID > 16 && dist > (GRID >= 64 ? 8 : 9);
    mark = index;
    const tree = sculptTree(S, spec.kind, cell.x, y0, cell.z, {
      seed: spec.seed,
      arm: spec.seed,
      front: 0,
      vary: true,
      lean,
      loom: canopyLine(dist)
    });
    mark = -1;
    trees.push({
      i: spec.i,
      k: spec.k,
      x: cell.x,
      z: cell.z,
      drop: tree.drop,
      cooldown: 0,
      kind: spec.kind
    });
  });
  S.box = box;
  S.ball = ball;
  return trees;
}

// Trees between the eye and the figure thin out. The wall and the far wood stay solid.
export function crownFade(dx, dz, yaw = Math.PI / 4) {
  const hx = Math.sin(yaw);
  const hz = Math.cos(yaw);
  const along = dx * hx + dz * hz;
  // Behind the figure the forest stays a wall.
  if (along < 0.35) return 1;
  const lateral = Math.abs(dx * hz - dz * hx);
  // A crown between the eye and the figure thins. Nearer, and more on the sightline, sheerer.
  const near = Math.min(1, (along - 0.35) / 3.2);
  const onLine = Math.max(0, 1 - lateral / 7.2);
  const sheer = near * (0.55 + 0.45 * onLine);
  return 1 - sheer * 0.82;
}

export function veilGrove(sim, st) {
  if (!st?.D || !sim?.trees || !sim.hearth) return;
  const yaw = Number.isFinite(sim.viewYaw) ? sim.viewYaw : Math.PI / 4;
  const ox = sim.hearth.x;
  const oz = sim.hearth.z;
  const D = st.D;
  const base = st.base;
  for (const tree of sim.trees) {
    if (!tree.ids?.length) continue;
    if (tree.fallen) {
      if (tree.open === 'down') continue;
      tree.open = 'down';
      for (const i of tree.ids) {
        const o = i * 16;
        D[o + 3] = 0;
        st.touch(i);
      }
      continue;
    }
    const fade = crownFade(tree.x - ox, tree.z - oz, yaw);
    const open = fade < 0.62;
    if (tree.open === open) continue;
    tree.open = open;
    for (const i of tree.ids) {
      const o = i * 16;
      D[o + 3] = open ? 0 : base[o + 3];
      st.touch(i);
    }
  }
}

export function revealGlade(sim) {
  if (!sim?.glade || !sim.gladeAll) return;
  const show = gladeBeams(sim.year, sim.gladeAll.length);
  sim.glade.gaps = sim.gladeAll.slice(0, show);
}

export function buildWorld(kit, hooks) {
  const { makeBuilder, makeSculpt, KIT } = kit;
  const plan = composeScene();
  const cells = plan.cells;
  const sim = {
    kit,
    cells,
    trees: [],
    loose: [],
    plots: layGardens(cells, plan.beds),
    carrying: false,
    placeQueued: false,
    bedDirty: true,
    time: 0,
    seasonIndex: 0,
    year: 1,
    seasonTime: 0,
    flood: 0,
    over: false,
    berms: 0,
    haste: 0,
    pace: 1,
    speed: 1,
    fast: false,
    shed: 5.2,
    held: null,
    eatQueued: false,
    motions: [],
    seen: new Set(),
    fall: [],
    fallAcc: 0,
    weatherSeason: 0,
    events: [],
    snapshot: null,
    live: copyFingers(),
    chronicle: freshChronicle(),
    circleTime: 0,
    circleSaid: false,
    holding: false,
    attention: 0,
    watched: false,
    gazeCell: null,
    yearLine: '',
    carryKind: null,
    sow: null,
    away: false,
    quiet: false,
    guide: { goal: null, timer: 0, stuck: 0, x: 0, z: 0, skip: new Map(), pauseUntil: 0, nextLook: 0 },
    keys: new Set(),
    audio: true,
    onEvent: hooks?.onEvent || (() => {})
  };
  sim.hearth = cells[HEARTH_K * GRID + HEARTH_I];
  sim.drawGrowth = draw => hooks.drawGrowth(draw, sim);

  const B = makeBuilder(11, PALETTE, { initialCapacity: Math.max(1 << (16 + SCENE.fidelity), GRID * GRID * 24) });
  const S = dressSculpt(KIT.sculpt(makeSculpt(B)));
  const forestFidelity = SCENE.fidelity;
  if (GRID >= 64) SCENE.fidelity = Math.min(forestFidelity, 2);
  else if (GRID >= 32) SCENE.fidelity = Math.min(forestFidelity, 3);
  sculptClearing(S, cells, plan.stones, plan.hollows);
  sim.trees = sculptTrees(S, B, cells, plan.grove);
  SCENE.fidelity = forestFidelity;
  const hearth = cellCenter(HEARTH_I, HEARTH_K);
  const shafts = KIT.dapple({
    sun: GRID >= 32 ? [0.08, 0.99, 0.04] : [0.22, 0.95, 0.12],
    y: GRID >= 32 ? 2.2 : 10,
    at: [hearth.x, hearth.z],
    r: 2.7,
    n: 16,
    size: GRID >= 32 ? [0.42, 0.85] : [0.11, 0.26],
    seed: SCENE.seed % 997,
    floor: GRID >= 32 ? 0.75 : 0.5,
    under: 0.28,
    bound: GRID >= 32 ? [hearth.x, hearth.z, 3.4] : [0, 0, 14],
    cover: (x, z) => Math.hypot(x - hearth.x, z - hearth.z) > PAD + 0.35
  });
  const firstLight = Math.min(4, shafts.gaps.length);
  const later = shafts.gaps.splice(firstLight);
  shafts.motes(B, sceneCount(14), [6, 14, 4], { size: 0.03, low: 0.8 });
  shafts.gaps.push(...later);
  S.bake();
  sim.glade = shafts.air([6, 14, 4, 6, 14, 4], 0.36, 2);
  sim.gladeAll = sim.glade.gaps.map(gap => gap.slice());
  sim.shafts = sim.glade;
  revealGlade(sim);

  const woods = ['oak', 'maple', 'birch', 'willow', 'alder'];
  for (const [n, [i, k]] of plan.loose.entries()) {
    const cell = cells[k * GRID + i];
    const yaw = hash(n * 17 + 3) * Math.PI;
    sim.loose.push({
      x: cell.x + (hash(n * 5 + 1) - 0.5) * 0.34,
      z: cell.z + (hash(n * 9 + 2) - 0.5) * 0.34,
      yaw,
      kind: woods[Math.floor(hash(n * 13 + 4) * woods.length)],
      age: 0,
      fall: false
    });
  }

  sim.frame = hooks.createFrame(B, KIT, sim);
  sim.character = hooks.createAvatar(B, KIT, sim);
  sim.world = B.finish({
    cam: { target: [0, 0.8, 0], dist: 34 * (GRID / 16), yaw: Math.PI / 4, pitch: 0.72, fov: 0.66 },
    detail: 9,
    dither: 0.45,
    radius: Math.max(14, GRID * 0.9),
    look: STIPPLE
  });
  if (typeof sim.bindSpirits !== 'function') throw new Error('The avatar roster has no bind');
  sim.bindSpirits(sim);
  sim.world.glass = GRID >= 32 ? null : sim.shafts;
  sim.stage = KIT.stage(sim.world);
  sim.stage.add(sim.frame);
  sim.stage.add({ post: (_dt, _t, st) => veilGrove(sim, st) });
  hooks.createWater(KIT, sim);
  sim.riseCubes = bakeRiseCubes(kit);
  return sim;
}

// The same square the ground cell is. What builds up is another of these, not a pile.
function bakeRiseCubes(kit) {
  const { makeBuilder, makeSculpt, KIT } = kit;
  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 12 });
  const S = KIT.sculpt(makeSculpt(B));
  S.box([0, 0, 0], [0.46, 0.37, 0.46], { r: [11, 2, 5, 3] }, { res: 0.34, rd: 0.055 });
  S.bake();
  const baked = B.finish({
    cam: { target: [0, 0, 0], dist: 4, yaw: Math.PI / 4, pitch: 0.72, fov: 0.66 },
    detail: 9,
    dither: 0.45,
    radius: 4,
    look: STIPPLE
  });
  return { soil: KIT.frameSplats.capture(baked, [0, 0, 0]) };
}
