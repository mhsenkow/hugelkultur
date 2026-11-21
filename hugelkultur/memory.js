import { GRID, cellAt } from './world.js?v=square24';
import { seasonOf, seasonLength, sidleGate, markMouth } from './water.js?v=square24';
import { beginMound, raiseLand, settleMounds } from './growth.js?v=square24';
import { yearTitle, freshChronicle, awayLine, noteYear, growWood } from './clearing.js';

const FOREST_KEY = 'hugelkultur-forest';

function forestKey() {
  return GRID === 16 ? FOREST_KEY : `${FOREST_KEY}-${GRID}`;
}
const KIND = { SPR: 'rain', AUT: 'leaf', WIN: 'snow' };

function cellRow(cell) {
  const lived = cell.layers || cell.berm || cell.stain || cell.fruit || cell.sill || cell.compost
    || cell.lift || cell.raft || cell.rooted || cell.parched || cell.rock || cell.log || cell.stood
    || (cell.land || 0) > 0 || (cell.sunk || 0) > 0 || cell.nutAt || cell.cubes
    || (cell.litter || 0) > 0.2 || (cell.snow || 0) > 0.2
    || (cell.moisture || 0) > 0.4;
  if (!lived) return null;
  return {
    i: cell.i,
    k: cell.k,
    layers: cell.layers || 0,
    berm: !!cell.berm,
    coat: cell.coat || 0,
    lift: cell.lift || 0,
    marks: cell.marks || null,
    story: cell.story || null,
    woods: cell.woods || null,
    fruit: cell.fruit || null,
    fruitGrowth: cell.fruitGrowth || 0,
    stain: cell.stain || 0,
    sill: cell.sill || 0,
    raft: cell.raft || 0,
    litter: cell.litter || 0,
    snow: cell.snow || 0,
    moisture: cell.moisture || 0,
    compost: cell.compost || 0,
    mass: cell.mass || 0,
    lastWood: cell.lastWood || null,
    parched: !!cell.parched,
    rooted: !!cell.rooted,
    tree: !!cell.tree,
    rock: !!cell.rock,
    log: !!cell.log,
    stood: cell.stood || 0,
    land: cell.land || 0,
    sunk: cell.sunk || 0,
    nutAt: cell.nutAt || 0,
    cubes: cell.cubes || 0,
    block: Array.isArray(cell.block) ? cell.block.slice() : null,
    knitted: !!cell.knitted
  };
}

export function snapshotForest(sim, seed) {
  let water = null;
  try {
    const point = sim.solver?.checkpoint?.();
    if (point) {
      water = {
        time: point.time,
        added: point.added,
        drained: point.drained,
        moved: point.moved,
        startVolume: point.startVolume,
        bed: Array.from(point.bed),
        depth: Array.from(point.depth),
        mx: Array.from(point.mx),
        mz: Array.from(point.mz)
      };
    }
  } catch {
    water = null;
  }
  return {
    v: 1,
    seed,
    grid: GRID,
    at: Date.now(),
    year: sim.year,
    seasonIndex: sim.seasonIndex,
    seasonTime: sim.seasonTime,
    spiritId: sim.spiritId,
    yearLine: sim.yearLine || '',
    circleSaid: !!sim.circleSaid,
    holding: !!sim.holding,
    circleTime: sim.circleTime || 0,
    chronicle: sim.chronicle,
    live: sim.live?.map(finger => ({
      bit: finger.bit,
      edge: finger.edge,
      mouth: finger.mouth.slice(),
      gate: finger.gate.slice(),
      seed: finger.seed
    })),
    cells: sim.cells.map(cellRow).filter(Boolean),
    loose: sim.loose.filter(stick => !stick.fall).map(stick => ({
      x: stick.x, z: stick.z, yaw: stick.yaw, kind: stick.kind, age: stick.age || 0
    })),
    planted: sim.trees.filter(tree => tree.planted).map(tree => ({
      kind: tree.kind,
      i: tree.i,
      k: tree.k,
      growth: tree.growth || 0,
      group: tree.group || 'tree',
      seed: tree.seed || 1,
      rooted: !!tree.rooted,
      size: tree.size || 1,
      age: tree.age || 0,
      fallen: !!tree.fallen,
      rot: tree.rot || 0,
      yaw: tree.yaw || 0,
      sick: !!tree.sick,
      sickAt: tree.sickAt || 0
    })),
    stumps: sim.trees.filter(tree => !tree.planted && tree.fallen).map(tree => ({
      i: tree.i,
      k: tree.k,
      yaw: tree.yaw || 0,
      rot: tree.rot || 0
    })),
    beaverWait: sim.beaverWait || 0,
    water,
    over: !!sim.over,
    flood: sim.flood || 0,
    years: sim.years || [],
    gates: sim.gates || 0,
    taught: !!sim.taught
  };
}

export function readForest() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem(forestKey()) || 'null');
    return saved && saved.v === 1 ? saved : null;
  } catch {
    return null;
  }
}

export function writeForest(sim, seed) {
  if (typeof localStorage === 'undefined' || !sim) return;
  try { localStorage.setItem(forestKey(), JSON.stringify(snapshotForest(sim, seed))); } catch { /* the visit still holds */ }
}

export function clearForest() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(forestKey()); } catch { /* already gone */ }
}

export function applyForest(sim, saved) {
  if (!saved) return;
  if ((saved.grid || 16) !== GRID) return;
  sim.year = saved.year || 1;
  sim.seasonIndex = saved.seasonIndex || 0;
  sim.seasonTime = saved.seasonTime || 0;
  sim.yearLine = saved.yearLine || '';
  sim.circleSaid = !!saved.circleSaid;
  sim.holding = !!saved.holding;
  sim.circleTime = saved.circleTime || 0;
  sim.chronicle = saved.chronicle || freshChronicle();
  sim.over = !!saved.over;
  sim.flood = saved.flood || 0;
  sim.years = Array.isArray(saved.years) ? saved.years.slice() : [];
  sim.gates = Number.isFinite(saved.gates) ? saved.gates : sim.years.filter(line => String(line).includes('gate')).length;
  if (sim.years.length > 24) sim.years = sim.years.slice(-24);
  sim.taught = !!saved.taught;
  if (Array.isArray(saved.live) && saved.live.length === sim.live.length) {
    sim.live = saved.live.map(finger => ({
      bit: finger.bit,
      edge: finger.edge,
      mouth: finger.mouth.slice(),
      gate: finger.gate.slice(),
      seed: finger.seed
    }));
  }
  for (const row of saved.cells || []) {
    const cell = sim.cells[row.k * GRID + row.i];
    if (!cell) continue;
    cell.layers = row.layers || 0;
    cell.berm = !!row.berm;
    cell.coat = row.coat || 0;
    cell.lift = row.lift || 0;
    cell.marks = row.marks || null;
    cell.story = row.story || null;
    cell.woods = row.woods || null;
    cell.fruit = row.fruit || null;
    cell.fruitGrowth = row.fruitGrowth || 0;
    cell.stain = row.stain || 0;
    cell.sill = row.sill || 0;
    cell.raft = row.raft || 0;
    cell.litter = row.litter || 0;
    cell.snow = row.snow || 0;
    cell.moisture = row.moisture || 0;
    cell.compost = row.compost || 0;
    cell.mass = row.mass || 0;
    cell.lastWood = row.lastWood || null;
    cell.parched = !!row.parched;
    cell.rooted = !!row.rooted;
    cell.rock = !!row.rock;
    cell.log = !!row.log;
    cell.stood = row.stood || 0;
    cell.land = row.land || 0;
    cell.sunk = row.sunk || 0;
    cell.nutAt = row.nutAt || 0;
    cell.cubes = row.cubes || 0;
    cell.block = Array.isArray(row.block) ? row.block.slice() : null;
    cell.knitted = !!row.knitted;
    if (row.tree) cell.tree = true;
  }
  if (Array.isArray(saved.loose)) {
    sim.loose = saved.loose.map(stick => ({
      x: stick.x,
      z: stick.z,
      yaw: stick.yaw || 0,
      kind: stick.kind || 'maple',
      age: stick.age || 0,
      fall: false
    }));
  }
  for (const tree of saved.planted || []) {
    const cell = sim.cells[tree.k * GRID + tree.i];
    if (!cell || sim.trees.some(item => item.i === tree.i && item.k === tree.k)) continue;
    cell.tree = !tree.fallen;
    cell.log = !!tree.fallen;
    cell.rooted = cell.rooted || !!tree.rooted;
    sim.trees.push({
      i: tree.i,
      k: tree.k,
      x: cell.x,
      z: cell.z,
      kind: tree.kind,
      drop: cell.elevation + 0.5,
      cooldown: 1,
      planted: true,
      growth: tree.growth || 0.2,
      group: tree.group || 'tree',
      seed: tree.seed || 1,
      rooted: !!tree.rooted,
      size: tree.size || 1,
      age: tree.age || 0,
      fallen: !!tree.fallen,
      rot: tree.rot || 0,
      yaw: tree.yaw || 0,
      sick: !!tree.sick,
      sickAt: tree.sickAt || 0
    });
  }
  sim.beaverWait = saved.beaverWait || 0;
  for (const stump of saved.stumps || []) {
    const tree = sim.trees.find(item => !item.planted && item.i === stump.i && item.k === stump.k);
    if (!tree) continue;
    tree.fallen = true;
    tree.rot = stump.rot || 0;
    tree.yaw = stump.yaw || 0;
    tree.age = tree.age ?? 1;
    const cell = sim.cells[stump.k * GRID + stump.i];
    if (cell) {
      cell.tree = false;
      cell.log = true;
    }
  }
  sim.bedDirty = true;
  if (saved.water && sim.solver?.restore) {
    try { sim.solver.restore(saved.water); } catch { /* the river begins again on the same land */ }
  }
  if (saved.spiritId) sim.pendingSpirit = saved.spiritId;
}

export function passSeason(sim) {
  const kind = KIND[seasonOf(sim).id];
  sim.quiet = true;
  if (kind) {
    for (const cell of sim.cells) {
      if (cell.hearth || cell.plot) continue;
      if (kind === 'leaf') cell.litter = Math.min(1, (cell.litter || 0) + 0.5);
      if (kind === 'snow') cell.snow = Math.min(1, (cell.snow || 0) + 0.45);
      if (kind === 'rain') cell.moisture = Math.min(1, (cell.moisture || 0) + 0.35);
      if (cell.channel) cell.stain = Math.min(1, (cell.stain || 0) + 0.22);
      if (cell.parched && kind === 'snow') continue;
      if ((cell.layers >= 2 || cell.berm) && !cell.marks?.[kind]) beginMound(sim, cell, kind);
    }
  }
  for (const tree of sim.trees) {
    if (!tree.planted || tree.fallen) continue;
    const waited = seasonLength(sim);
    tree.growth = tree.group === 'plant'
      ? Math.min(1, (tree.growth || 0) + 0.2)
      : growWood(tree.growth, waited, tree.group === 'shrub', tree.sick);
    tree.age = (tree.age || 0) + waited;
    if ((tree.kind === 'alder' || tree.kind === 'willow') && tree.growth > 0.55) {
      const cell = sim.cells[tree.k * GRID + tree.i];
      if (cell) {
        tree.rooted = true;
        cell.rooted = true;
      }
    }
  }
  for (const plot of sim.plots || []) plot.growth = Math.min(1, (plot.growth || 0) + 0.5);
  for (const cell of sim.cells) {
    if (cell.fruit) cell.fruitGrowth = Math.min(1, (cell.fruitGrowth || 0) + 0.5);
  }
  const waited = seasonLength(sim);
  for (let n = sim.loose.length - 1; n >= 0; n--) {
    const stick = sim.loose[n];
    stick.age = (stick.age || 0) + waited;
    if (stick.age <= waited * 2) continue;
    const cell = cellAt(sim.cells, stick.x, stick.z);
    if (cell && !cell.hearth) {
      cell.compost = 1;
      cell.moisture = 1;
      raiseLand(sim, cell, 0.012);
    }
    sim.loose.splice(n, 1);
  }
  if ((sim.flood || 0) < 1) sidleGate(sim, seasonOf(sim));
  sim.seasonTime = 0;
  sim.seasonIndex = (sim.seasonIndex + 1) % 4;
  if (sim.seasonIndex === 0) {
    if (sim.chronicle) sim.chronicle.berms = sim.berms || 0;
    sim.yearLine = yearTitle(sim.chronicle);
    noteYear(sim);
    sim.year += 1;
    sim.chronicle = freshChronicle();
    sim.quiet = false;
    settleMounds(sim);
    sim.quiet = true;
  }
  markMouth(sim);
  sim.quiet = false;
  sim.bedDirty = true;
}

export function catchUp(sim, ms) {
  if (!Number.isFinite(ms) || ms < 20000) return null;
  const seasons = Math.floor(ms / 1000 / 52);
  if (seasons < 1) return null;
  const run = Math.min(4, seasons);
  for (let n = 0; n < run; n++) passSeason(sim);
  sim.events.push({ type: 'note', text: awayLine(run, seasons > 4) });
  return run;
}
