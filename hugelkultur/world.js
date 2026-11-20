import { layGardens } from './gardens.js';
import { sculptTree } from './specimens.js';

export const GRID = 16;
export const ORIGIN = -8;
export const HEARTH_I = 8;
export const HEARTH_K = 8;
export const PAD = 1.85;
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

const GROVE = [
  { kind: 'oak', i: 1, k: 2 },
  { kind: 'maple', i: 14, k: 2 },
  { kind: 'birch', i: 1, k: 14 },
  { kind: 'oak', i: 14, k: 13 },
  { kind: 'birch', i: 0, k: 8 },
  { kind: 'maple', i: 13, k: 8 }
];
const TREES = GROVE.map(tree => [tree.i, tree.k]);
const STONE = { r: [2, 5, 4, 6] };

const LOOSE = [[3, 10], [4, 12], [2, 11], [5, 9], [3, 13], [1, 10], [5, 12], [4, 8], [11, 4], [12, 8], [9, 3], [2, 4], [13, 11], [7, 2]];

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

export function walkHeight(cell) {
  if (!cell) return 1e9;
  if (cell.plot) return cell.elevation + 0.24;
  if (cell.berm) return cell.elevation + 0.38;
  return cell.elevation + Math.min(cell.layers, 2) * 0.03;
}

export function bedHeight(cell) {
  if (cell.plot) return cell.elevation + 0.3;
  if (cell.berm) return cell.elevation + 0.5 + Math.min(cell.coat || 1, 4) * 0.06;
  if (cell.hearth) return cell.elevation + PEDESTAL;
  return cell.elevation + cell.layers * 0.16;
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
  const grain = ((i * 5 + k * 3) % 3) * 0.01;
  if (dist <= PAD) return 0.8 + grain;
  if (channel) return 0.5 + dist * 0.04 + grain;
  return 0.98 + dist * 0.006 + grain;
}

function makeCells() {
  const cells = [];
  for (let k = 0; k < GRID; k++) {
    for (let i = 0; i < GRID; i++) {
      const { x, z } = cellCenter(i, k);
      const tree = TREES.some(([ti, tk]) => ti === i && tk === k);
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
        hearth: i === HEARTH_I && k === HEARTH_K,
        tree
      });
    }
  }
  return cells;
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

function sculptClearing(S, cells) {
  S.box([0, -0.72, 0], [8.25, 0.72, 8.25], { r: [INK.charcoal, INK.charcoal, INK.charcoal] }, { res: 0.62, rd: 0.12 });
  for (const cell of cells) {
    const half = cell.elevation / 2;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    const mat = cell.channel ? CHANNEL : cell.clearing ? CLEARING : dist <= 3.15 ? GLADE : SAND;
    S.box([cell.x, half, cell.z], [0.46, half, 0.46], mat, { res: 0.34, rd: 0.055 });
  }
  const hearth = cells[HEARTH_K * GRID + HEARTH_I];
  sculptIdol(S, hearth.x, hearth.elevation, hearth.z);
  for (const [i, k] of [[5, 4], [11, 5], [6, 14], [10, 2]]) {
    const cell = cells[k * GRID + i];
    S.ball([cell.x, cell.elevation + 0.06, cell.z], [0.24, 0.11, 0.18], STONE, { res: 0.11 });
  }
}

function sculptTrees(S, _K, cells) {
  const trees = [];
  GROVE.forEach((spec, index) => {
    const cell = cells[spec.k * GRID + spec.i];
    const y0 = cell.elevation;
    const front = Math.max(0, Math.min(1, (cell.x + cell.z + 14) / 26));
    const tree = sculptTree(S, spec.kind, cell.x, y0, cell.z, { seed: 20 + index * 13, arm: index, front });
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
  return trees;
}

export function buildWorld(kit, hooks) {
  const { makeBuilder, makeSculpt, KIT } = kit;
  const cells = makeCells();
  const sim = {
    kit,
    cells,
    trees: [],
    loose: [],
    plots: layGardens(cells),
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
    guide: { goal: null, timer: 0, stuck: 0, x: 0, z: 0, skip: new Map() },
    keys: new Set(),
    audio: true,
    onEvent: hooks?.onEvent || (() => {})
  };
  sim.hearth = cells[HEARTH_K * GRID + HEARTH_I];
  sim.drawGrowth = draw => hooks.drawGrowth(draw, sim);

  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 16 });
  const S = KIT.sculpt(makeSculpt(B));
  sculptClearing(S, cells);
  sim.trees = sculptTrees(S, KIT, cells);
  const hearth = cellCenter(HEARTH_I, HEARTH_K);
  const shafts = KIT.dapple({
    sun: [0.22, 0.95, 0.12],
    y: 10,
    at: [hearth.x, hearth.z],
    r: 2.5,
    n: 5,
    size: [0.16, 0.34],
    seed: 11,
    floor: 0.5,
    under: 0.28,
    bound: [0, 0, 14],
    cover: (x, z) => Math.hypot(x - hearth.x, z - hearth.z) > PAD + 0.35
  });
  shafts.motes(B, 14, [6, 14, 4], { size: 0.03, low: 0.8 });
  S.bake();

  for (const [n, [i, k]] of LOOSE.entries()) {
    const cell = cells[k * GRID + i];
    const yaw = hash(n * 17 + 3) * Math.PI;
    sim.loose.push({
      x: cell.x + (hash(n * 5 + 1) - 0.5) * 0.34,
      z: cell.z + (hash(n * 9 + 2) - 0.5) * 0.34,
      yaw
    });
  }

  sim.frame = hooks.createFrame(B, KIT, sim);
  sim.character = hooks.createAvatar(B, KIT, sim);
  sim.world = B.finish({
    cam: { target: [0, 0.8, 0], dist: 34, yaw: Math.PI / 4, pitch: 0.72, fov: 0.66 },
    detail: 9,
    dither: 0.45,
    radius: 14,
    look: STIPPLE
  });
  if (typeof sim.bindSpirits !== 'function') throw new Error('The avatar roster has no bind');
  sim.bindSpirits(sim);
  sim.world.glass = shafts.air([6, 14, 4, 6, 14, 4], 0.36, 5);
  sim.stage = KIT.stage(sim.world);
  sim.stage.add(sim.frame);
  hooks.createWater(KIT, sim);
  return sim;
}
