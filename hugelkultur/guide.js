import { GRID, HEARTH_I, HEARTH_K, PAD, cellAt, hash } from './world.js';
import { seasonOf } from './water.js';

// A four-feature linear policy. It runs on the grid, with no network call.
// Gate cells (where this season's tendril meets the dry pad) outrank a thicker
// stack, a wet cell outranks a dry one, and a little noise keeps the wall uneven.
const PLACE = [3.2, 1.6, 1.2, 1, 0.85, 0.7];
const FETCH = [-1, -0.62, 0.35];

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function dot(weights, features) {
  let score = 0;
  for (let i = 0; i < weights.length; i++) score += weights[i] * features[i];
  return score;
}

function keyOf(i, k) {
  return i + k * GRID;
}

function neighbors(cell) {
  const out = [];
  for (const [di, dk] of STEP) {
    const i = cell.i + di;
    const k = cell.k + dk;
    if (i >= 0 && k >= 0 && i < GRID && k < GRID) out.push(k * GRID + i);
  }
  return out;
}

function isGate(sim, cell) {
  if (!cell.channel) return false;
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  return dist > PAD && dist < 3.15;
}

function knit(sim, cell) {
  let layers = 0;
  for (const index of neighbors(cell)) layers += Math.min(sim.cells[index].layers, 2);
  return Math.min(layers, 3) / 3;
}

function placeScore(sim, cell, bit) {
  if (cell.hearth || cell.berm || cell.tree || cell.plot || cell.layers >= 5) return -1e9;
  if ((cell.flow & bit) === 0) return -1e9;
  if ((sim.guide.skip.get(keyOf(cell.i, cell.k)) || 0) > sim.time) return -1e9;
  const gate = isGate(sim, cell);
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  if (!gate && (dist < PAD || dist > 5.2)) return -1e9;
  const st = sim.character.st;
  const wet = Math.min(sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0, 0.5);
  const thin = cell.layers === 0 ? 0.15 : cell.layers < 3 ? 3.2 - cell.layers * 0.35 : -2.4 - (cell.layers - 3);
  return dot(PLACE, [
    gate ? 1 : 0,
    wet,
    knit(sim, cell),
    thin,
    -Math.hypot(cell.x - st.x, cell.z - st.z) / 14,
    hash(cell.i * 17 + cell.k * 13 + sim.seasonIndex * 5 + sim.year) - 0.5
  ]);
}

function bestPlace(sim) {
  const bit = seasonOf(sim).bit;
  let best = null;
  let score = -1e8;
  for (const cell of sim.cells) {
    const value = placeScore(sim, cell, bit);
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return score > 0 ? best : null;
}

function bestStick(sim, place) {
  const st = sim.character.st;
  let best = null;
  let score = -1e8;
  sim.loose.forEach((stick, index) => {
    const toAvatar = Math.hypot(stick.x - st.x, stick.z - st.z);
    const toWork = place ? Math.hypot(stick.x - place.x, stick.z - place.z) : 0;
    const along = place
      ? ((place.x - st.x) * (stick.x - st.x) + (place.z - st.z) * (stick.z - st.z)) /
        (Math.hypot(place.x - st.x, place.z - st.z) * Math.max(0.2, toAvatar) || 1)
      : 0;
    const value = dot(FETCH, [toAvatar / 8, toWork / 10, Math.max(-1, Math.min(1, along))]);
    if (value > score) {
      score = value;
      best = index;
    }
  });
  return best;
}

function nearestTree(sim) {
  const st = sim.character.st;
  let best = null;
  let dist = 1e9;
  for (const tree of sim.trees) {
    const d = Math.hypot(tree.x - st.x, tree.z - st.z);
    if (d < dist) {
      dist = d;
      best = tree;
    }
  }
  return best;
}

function choose(sim) {
  if (sim.held) return null;
  const place = bestPlace(sim);
  if (sim.carrying) return place ? { kind: 'place', i: place.i, k: place.k } : null;
  if (!sim.loose.length) {
    const tree = nearestTree(sim);
    return tree ? { kind: 'shake', x: tree.x, z: tree.z } : null;
  }
  const index = bestStick(sim, place);
  const stick = sim.loose[index];
  return { kind: 'fetch', x: stick.x, z: stick.z };
}

function standOn(sim, cell) {
  const st = sim.character.st;
  let best = null;
  let dist = 1e9;
  for (const index of neighbors(cell)) {
    const next = sim.cells[index];
    if (Math.abs(next.elevation - cell.elevation) > 0.42) continue;
    const d = Math.hypot(next.x - st.x, next.z - st.z);
    if (d < dist) {
      dist = d;
      best = next;
    }
  }
  return best;
}

function nextStep(sim, here, there) {
  const from = here.k * GRID + here.i;
  const goal = there.k * GRID + there.i;
  const seen = new Uint8Array(sim.cells.length);
  const prev = new Int16Array(sim.cells.length);
  prev.fill(-1);
  const queue = [from];
  seen[from] = 1;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === goal) break;
    const cell = sim.cells[at];
    for (const index of neighbors(cell)) {
      if (seen[index]) continue;
      const next = sim.cells[index];
      if (Math.abs(next.elevation - cell.elevation) > 0.42) continue;
      seen[index] = 1;
      prev[index] = at;
      queue.push(index);
    }
  }
  if (!seen[goal]) return there;
  let step = goal;
  while (prev[step] !== from && prev[step] !== -1) step = prev[step];
  return sim.cells[step];
}

function toward(sim, point) {
  const st = sim.character.st;
  const here = cellAt(sim.cells, st.x, st.z);
  const there = cellAt(sim.cells, point.x, point.z);
  const aim = !here || !there || here === there ? point : nextStep(sim, here, there);
  const dx = (here === there ? point.x : aim.x) - st.x;
  const dz = (here === there ? point.z : aim.z) - st.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.08) return { move: 0, mz: 0 };
  return { move: dx / length, mz: dz / length };
}

function goalHolds(sim) {
  const goal = sim.guide.goal;
  if (!goal) return false;
  if (goal.kind === 'place') {
    if (!sim.carrying) return false;
    const cell = sim.cells[goal.k * GRID + goal.i];
    return Boolean(cell && !cell.berm && cell.layers < 5 && (sim.guide.skip.get(keyOf(cell.i, cell.k)) || 0) <= sim.time);
  }
  if (goal.kind === 'fetch') {
    if (sim.carrying) return false;
    return sim.loose.some(stick => Math.hypot(stick.x - goal.x, stick.z - goal.z) < 0.5);
  }
  if (goal.kind === 'eat') {
    const plot = sim.plots.find(item => item.id === goal.id);
    return Boolean(plot && plot.growth >= 1);
  }
  return !sim.carrying && sim.loose.length === 0;
}

export function steer(sim, dt, playerDriving) {
  const guide = sim.guide;
  if (playerDriving || sim.over) {
    guide.stuck = 0;
    return null;
  }
  const st = sim.character.st;
  const moved = Math.hypot(st.x - guide.x, st.z - guide.z);
  guide.stuck = moved < 0.05 ? guide.stuck + dt : 0;
  guide.x = st.x;
  guide.z = st.z;
  if (!goalHolds(sim) || guide.stuck > 2.4) {
    if (guide.stuck > 2.4 && guide.goal?.kind === 'place') {
      guide.skip.set(keyOf(guide.goal.i, guide.goal.k), sim.time + 8);
    }
    const next = choose(sim);
    guide.goal = next;
    guide.stuck = 0;
  }
  const goal = guide.goal;
  if (!goal) return { move: 0, mz: 0 };
  if (goal.kind === 'place') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    const stand = standOn(sim, cell);
    if (!stand) return { move: 0, mz: 0 };
    if (Math.hypot(stand.x - st.x, stand.z - st.z) < 0.28 && sim.carrying) {
      const face = Math.atan2(cell.z - st.z, cell.x - st.x);
      sim.placeQueued = true;
      return { move: Math.cos(face) * 0.4, mz: Math.sin(face) * 0.4, face };
    }
    return toward(sim, stand);
  }
  return toward(sim, goal);
}
