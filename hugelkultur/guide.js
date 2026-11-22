import { GRID, HEARTH_I, HEARTH_K, PAD, COURT, cellAt, hash, walkHeight, bedHeight } from './world.js?v=hold';
import { seasonOf } from './water.js?v=hold';
import { wornMeasures, seasonFit, liftCap, buried, EDGE_NAME, woodOf, circleState, wedgeOf, holdsWater, wallHeight, eraOf } from './clearing.js?v=hold';
const DAY_LEN = 64;

function dayPart(time) {
  const p = ((Number(time) || 0) % DAY_LEN) / DAY_LEN;
  if (p < 0.7) return 'day';
  if (p < 0.8) return 'dusk';
  if (p < 0.94) return 'night';
  return 'dawn';
}

function dayIndex(time) {
  return Math.floor(Math.max(0, Number(time) || 0) / DAY_LEN);
}
import { sowWood } from './sticks.js?v=hold';

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function metrics(sim) {
  const row = wornMeasures(sim);
  return { ...row, fit: seasonFit(row.home, seasonOf(sim).id) };
}

function keyOf(i, k) {
  return i + k * GRID;
}

function climbLimit(sim) {
  // The body treats a rise past 0.45 as a wall, so a path step has to stay under that.
  return sim?.ford > sim?.time ? 1.2 : 0.4;
}

function onWall(cell) {
  if (!cell || cell.hearth) return false;
  return (cell.cubes || 0) > 0 || !!cell.berm || (cell.layers || 0) >= 3;
}

function blockedStep(sim, from, to) {
  if (onWall(from) && onWall(to) && Math.abs(wallHeight(from) - wallHeight(to)) < 0.2) {
    return Math.abs(walkHeight(to) - walkHeight(from)) > 1.1;
  }
  if (to.stair && onWall(from)) return walkHeight(to) - walkHeight(from) > climbLimit(sim) + 0.3;
  return walkHeight(to) - walkHeight(from) > climbLimit(sim);
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
  const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
  if (!finger || cell.hearth || cell.tree || cell.plot) return false;
  return Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) < 1.75;
}

function canWork(sim, cell, row) {
  if (!cell || cell.hearth || cell.plot) return false;
  if (cell.rock || cell.log) return false;
  if (cell.tree && !cell.berm) return false;
  if (cell.berm) return (cell.lift || 0) < liftCap(sim.year);
  if ((cell.layers || 0) >= 5) return false;
  if (buried(cell) && !(row.crust > 0.7 && seasonOf(sim).id === 'WIN')) return false;
  return true;
}

function placeScore(sim, cell, row) {
  if (!canWork(sim, cell, row)) return -1e9;
  if ((sim.guide.skip.get(keyOf(cell.i, cell.k)) || 0) > sim.time) return -1e9;
  const gate = isGate(sim, cell);
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  const depth = Math.min(sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0, 0.8);
  const wet = depth > 0.03;
  const inRing = dist > PAD && dist < 5.5;
  const wading = row.wade * row.fit > 0.55 && wet && dist > PAD && dist < 6.4;
  const onLeak = sim._leak && cell.i === sim._leak.i && cell.k === sim._leak.k;
  const lip = !gate && !onLeak && dist < COURT;
  const temple = dist >= COURT && dist < 4.8;
  let raceSide = false;
  for (const index of neighbors(cell)) {
    if (sim.cells[index]?.race) raceSide = true;
  }
  if (!gate && !inRing && !wading && !onLeak && !raceSide) return -1e9;
  let knit = 0;
  for (const index of neighbors(cell)) knit += Math.min(sim.cells[index].layers || 0, 2) + (sim.cells[index].berm ? 1 : 0);
  knit = Math.min(knit, 4) / 4;
  const thin = cell.berm
    ? 0.8 + (sim.year - 1) * 0.45 - (cell.lift || 0) * 0.22
    : cell.layers === 0 ? 0.15 : cell.layers < 3 ? 3.1 - cell.layers * 0.32 : -1.6;
  const gaze = sim.gazeCell;
  const watched = gaze ? Math.max(0, 1.5 - Math.hypot(cell.i - gaze.i, cell.k - gaze.k)) : 0;
  const errand = sim.errand && sim.errand.until > sim.time && sim.errand.i === cell.i && sim.errand.k === cell.k ? 8 : 0;
  const love = row.love * (1 - Math.min(1, Math.abs(dist - 3.6) / 2.2));
  const dryNeed = row.dry * (seasonOf(sim).id === 'WIN' && !cell.parched && (cell.layers || cell.berm) ? 1 : 0);
  const st = sim.character.st;
  const gap = sim._ring && sim._ring.missingIndex >= 0 && wedgeOf(cell.i, cell.k, HEARTH_I, HEARTH_K) === sim._ring.missingIndex ? 6 : 0;
  return gate * (2.2 + row.gate * 2.4) * row.fit
    + (wet ? 1.15 + row.wade * 1.7 : 0) * row.fit
    + thin
    + knit * (0.8 + row.knit)
    + love * 1.5
    + (temple ? 1.8 : 0)
    + (lip ? -3.2 : 0)
    + (onLeak ? 24 : 0)
    + (raceSide ? 3.4 : 0)
    + watched * 2
    + errand
    + dryNeed * 2.2 * row.fit
    + gap
    - Math.hypot(cell.x - st.x, cell.z - st.z) / 16
    + (hash(cell.i * 17 + cell.k * 13 + sim.seasonIndex * 5 + sim.year) - 0.5) * 0.3;
}

function reachableFrom(sim) {
  const seen = new Uint8Array(sim.cells.length);
  const here = cellAt(sim.cells, sim.character.st.x, sim.character.st.z);
  if (!here) return seen;
  const queue = [here.k * GRID + here.i];
  seen[queue[0]] = 1;
  for (let head = 0; head < queue.length; head++) {
    const cell = sim.cells[queue[head]];
    for (const index of neighbors(cell)) {
      if (seen[index]) continue;
      if (blockedStep(sim, cell, sim.cells[index])) continue;
      seen[index] = 1;
      queue.push(index);
    }
  }
  return seen;
}

function approachable(sim, cell, seen) {
  for (const index of neighbors(cell)) {
    if (!seen[index]) continue;
    const next = sim.cells[index];
    if (Math.abs(next.elevation - cell.elevation) > 0.42) continue;
    if (walkHeight(next) - next.elevation > climbLimit(sim) + (next.land || 0) + 0.05) continue;
    return true;
  }
  return false;
}

function bestPlace(sim, row) {
  const seen = reachableFrom(sim);
  sim._ring = circleState(sim.cells, HEARTH_I, HEARTH_K, PAD);
  let best = null;
  let score = -1e8;
  for (const cell of sim.cells) {
    if (!approachable(sim, cell, seen)) continue;
    const value = placeScore(sim, cell, row);
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  // A reachable cell she is allowed to work is work, even when the score is only the best of a poor set.
  return score > -1e6 ? best : null;
}

function woodFit(sim, place, kind) {
  if (!place) return 0;
  const wood = woodOf(kind);
  const depth = Math.min(sim.snapshot?.sample?.(place.x, place.z)?.depth || 0, 0.8);
  const wet = depth > 0.03 || place.channel || (place.moisture || 0) > 0.28;
  const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
  const mouth = finger && (
    Math.hypot(place.i - finger.gate[0], place.k - finger.gate[1]) < 2.2
    || Math.hypot(place.i - finger.mouth[0], place.k - finger.mouth[1]) < 2.2
  );
  let beside = 0;
  for (const [di, dk] of STEP) {
    const next = sim.cells[(place.k + dk) * GRID + place.i + di];
    if (next && ((next.layers || 0) > 0 || next.berm || (next.cubes || 0) > 0)) beside += 1;
  }
  const velocity = sim.snapshot?.sample?.(place.x, place.z)?.velocity || [0, 0];
  const moving = Math.hypot(velocity[0] || 0, velocity[1] || 0) > 0.02;
  let score = 0;
  if (mouth && wet && wood.root) score += 4;
  if (!place.berm && (place.layers || 0) < 3 && wood.sticks >= 2) score += 2.4;
  if (beside > 0 && !place.berm && (place.layers || 0) < 2 && wood.bridge) score += 3;
  if (wet && moving && wood.slide > 0.6) score += 2.2;
  return score;
}

function bestStick(sim, place, row) {
  const st = sim.character.st;
  const idol = sim.hearth;
  let best = null;
  let score = -1e8;
  sim.loose.forEach((stick, index) => {
    if (stick.fall) return;
    if (skipped(sim, `fetch:${Math.round(stick.x * 2)},${Math.round(stick.z * 2)}`)) return;
    const toAvatar = Math.hypot(stick.x - st.x, stick.z - st.z);
    const toWork = place ? Math.hypot(stick.x - place.x, stick.z - place.z) : 0;
    let value = -toAvatar / 8 - toWork / 10;
    if (sim.gazeCell) {
      value += Math.max(0, 1.3 - Math.hypot(stick.x - sim.gazeCell.x, stick.z - sim.gazeCell.z) / 5) * 1.8;
    }
    if (Number.isInteger(sim.wantStick) && index === sim.wantStick) value += 12;
    value += woodFit(sim, place, stick.kind);
    if (row.love > 0.4 && idol) value += Math.max(0, 1.2 - Math.hypot(stick.x - idol.x, stick.z - idol.z) / 8) * row.love;
    if (value > score) {
      score = value;
      best = index;
    }
  });
  return best;
}

function belovedStick(sim) {
  const idol = sim.hearth;
  if (!idol) return null;
  let best = null;
  let dist = 1e9;
  sim.loose.forEach((stick, index) => {
    if (stick.fall) return;
    const d = Math.hypot(stick.x - idol.x, stick.z - idol.z);
    if (d < dist) {
      dist = d;
      best = index;
    }
  });
  return best;
}

function bestTree(sim, row) {
  const st = sim.character.st;
  let best = null;
  let score = -1e9;
  for (const tree of sim.trees) {
    if (tree.group === 'plant') continue;
    if (tree.planted && (tree.growth || 0) < 0.5) continue;
    if (skipped(sim, `shake:${Math.round(tree.x)},${Math.round(tree.z)}`)) continue;
    const dist = Math.hypot(tree.x - st.x, tree.z - st.z);
    let value = -dist + (tree.planted && tree.growth > 0.7 ? 5 * row.shake * row.fit : 0);
    if (value > score) {
      score = value;
      best = tree;
    }
  }
  return best;
}

function bestBuried(sim) {
  const st = sim.character.st;
  let best = null;
  let dist = 1e9;
  for (const cell of sim.cells) {
    if (!buried(cell)) continue;
    const d = Math.hypot(cell.x - st.x, cell.z - st.z);
    if (d < dist) {
      dist = d;
      best = cell;
    }
  }
  return best;
}

function skipped(sim, key) {
  return (sim.guide.skip.get(key) || 0) > sim.time;
}

function ripePlot(sim) {
  for (const plot of sim.plots) {
    if (plot.growth >= 1 && !skipped(sim, `eat:${plot.id}`)) return plot;
  }
  for (const cell of sim.cells) {
    if (cell.fruit && cell.fruitGrowth >= 1 && !skipped(sim, `eat:fruit:${cell.i},${cell.k}`)) {
      return { id: `fruit:${cell.i},${cell.k}`, x: cell.x, z: cell.z, fruit: true };
    }
  }
  return null;
}

function decline(sim, row) {
  const season = seasonOf(sim);
  if (row.home === season.id) return false;
  const mark = sim.year * 4 + sim.seasonIndex;
  if (sim.declined === mark) return false;
  let text = '';
  if (row.wade >= 0.7 && row.wade * row.fit < 0.55) text = 'She will not wade.';
  else if (row.shake >= 0.7 && row.shake * row.fit < 0.62) text = 'She will not shake.';
  else if (row.eat >= 0.7 && row.eat * row.fit < 0.55) text = 'She will not eat.';
  else if (row.crust >= 0.7 && season.id !== 'WIN') text = 'She will not dig.';
  else if (row.dry >= 0.7 && row.dry * row.fit < 0.62) text = 'She will not dry the stack.';
  if (!text) return false;
  sim.declined = mark;
  const edge = EDGE_NAME[season.edge] || 'north';
  sim.events.push({ type: 'note', text: `She looks ${edge}. ${text}` });
  sim.guide.pauseUntil = sim.time + 1.6;
  sim.guide.goal = { kind: 'look', edge: season.edge };
  return true;
}

function woodLeft(sim) {
  return (sim.loose || []).some(stick => !stick.fall);
}

const BLOCKS = ['dam', 'raise', 'root', 'knit', 'divert', 'race', 'unjam', 'sump', 'weir', 'door', 'pave', 'store', 'wood', 'stair', 'prune'];
const BLOCK_LINE = {
  dam: 'You dam the gap.',
  raise: 'You raise what holds.',
  root: 'You root the mouth.',
  knit: 'You knit the gap.',
  divert: 'You turn the water aside.',
  race: 'You give the water a road.',
  unjam: 'You take the trunk.',
  sump: 'You dig a sump.',
  weir: 'You lay a weir.',
  door: 'You set the door.',
  pave: 'You lay a flag.',
  store: 'You keep wood for winter.',
  wood: 'You go for wood.',
  stair: 'You lay a step.',
  prune: 'You hold the crown back.'
};

function seasonFinger(sim) {
  return sim.live?.find(item => item.bit === seasonOf(sim).bit) || null;
}

function doorGap(sim) {
  let best = null;
  let score = -1;
  for (const cell of sim.cells) {
    if (cell.hearth || onWall(cell)) continue;
    let walls = 0;
    for (const index of neighbors(cell)) {
      if (onWall(sim.cells[index])) walls += 1;
    }
    if (walls < 2) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= PAD) continue;
    if (walls > score) {
      score = walls;
      best = cell;
    }
  }
  return best;
}

function waterInsideRing(sim) {
  for (const cell of sim.cells) {
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= PAD || dist > 5.5 || cell.hearth) continue;
    if ((sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0) > 0.04) return true;
  }
  return false;
}

function sumpGoal(sim, row) {
  if (!waterInsideRing(sim)) return null;
  const seen = reachableFrom(sim);
  let best = null;
  let dist = -1;
  for (const cell of sim.cells) {
    const ring = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (ring <= PAD || ring > 5.2 || cell.hearth || cell.sump) continue;
    if (!approachable(sim, cell, seen) || !canWork(sim, cell, row)) continue;
    if (dist < ring) {
      dist = ring;
      best = cell;
    }
  }
  if (!best) return null;
  return { kind: 'cut', method: 'sump', i: best.i, k: best.k, sill: -0.6, sump: true };
}

function unjamGoal(sim, row) {
  const seen = reachableFrom(sim);
  for (const cell of sim.cells) {
    if (!cell.jam || !approachable(sim, cell, seen)) continue;
    if (sim.carrying) return { kind: 'unjam', method: 'unjam', i: cell.i, k: cell.k };
    return { kind: 'walk', method: 'unjam', i: cell.i, k: cell.k, x: cell.x, z: cell.z };
  }
  return null;
}

function weirGoal(sim, row) {
  const seen = reachableFrom(sim);
  let best = null;
  let low = 1e9;
  for (const cell of sim.cells) {
    if (!cell.race || cell.weir || cell.hearth) continue;
    if (!approachable(sim, cell, seen) || !canWork(sim, cell, row)) continue;
    const h = bedHeight(cell);
    if (h >= low) continue;
    low = h;
    best = cell;
  }
  if (!best) return null;
  if (sim.carrying) return { kind: 'place', method: 'weir', i: best.i, k: best.k };
  return placeGoal(sim, row, 'weir', best);
}

function doorGoal(sim, row) {
  const gap = doorGap(sim);
  if (!gap) return null;
  const seen = reachableFrom(sim);
  if (!approachable(sim, gap, seen)) return null;
  if (!gap.lintel) {
    if (sim.carrying && sim.carryKind === 'oak') return { kind: 'lintel', method: 'door', i: gap.i, k: gap.k };
    if (!sim.carrying && woodLeft(sim)) return placeGoal(sim, row, 'door', gap);
    const tree = bestTree(sim, row);
    if (tree) return { kind: 'shake', method: 'door', x: tree.x, z: tree.z };
    return null;
  }
  if (!gap.hurdle) {
    if (sim.carrying && sim.carryKind === 'willow') return { kind: 'hurdle', method: 'door', i: gap.i, k: gap.k };
    if (!sim.carrying && woodLeft(sim)) return placeGoal(sim, row, 'door', gap);
    const tree = bestTree(sim, row);
    if (tree) return { kind: 'shake', method: 'door', x: tree.x, z: tree.z };
  }
  return null;
}

function paveGoal(sim, row) {
  const seen = reachableFrom(sim);
  let best = null;
  let worn = 0;
  for (const cell of sim.cells) {
    if (cell.paved || cell.hearth || !approachable(sim, cell, seen)) continue;
    const gap = !onWall(cell) && wallNeighborsCount(sim, cell) >= 2;
    const rank = (cell.worn || 0) + (gap && cell.lintel ? 0.8 : 0);
    if (rank < 0.45 && !gap) continue;
    if (rank > worn) {
      worn = rank;
      best = cell;
    }
  }
  if (!best) return null;
  if (sim.carrying && sim.carryKind === 'stone') return { kind: 'place', method: 'pave', i: best.i, k: best.k };
  return null;
}

function wallNeighborsCount(sim, cell) {
  let n = 0;
  for (const index of neighbors(cell)) {
    if (onWall(sim.cells[index])) n += 1;
  }
  return n;
}

function highestWall(sim) {
  const finger = seasonFinger(sim);
  if (!finger) return null;
  const [gi, gk] = finger.gate;
  let best = null;
  let h = -1;
  for (const cell of sim.cells) {
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= PAD || dist > 4.2 || !onWall(cell)) continue;
    const toward = Math.hypot(cell.i - gi, cell.k - gk);
    const height = wallHeight(cell);
    const score = height - toward * 0.05;
    if (score > h) {
      h = score;
      best = cell;
    }
  }
  return best;
}

export function wallWalkGoal(sim) {
  if (eraOf(sim) === 'glade') return null;
  if (sim._wallKeptDay === dayIndex(sim.time || 0)) return null;
  if (dayPart(sim.time) !== 'dusk') return null;
  const wall = highestWall(sim);
  if (!wall) return null;
  return { kind: 'look', method: 'wall', x: wall.x, z: wall.z, i: wall.i, k: wall.k, face: Math.atan2(wall.z - HEARTH_K, wall.x - HEARTH_I) };
}

function openSoil(cell) {
  return cell && !cell.hearth && !cell.tree && !cell.plot && !cell.berm && !cell.log && !cell.rock;
}

function bankSpot(sim, method) {
  const hand = seasonFinger(sim);
  if (!hand) return null;
  const st = sim.character.st;
  let best = null;
  let dist = 1e9;
  for (const cell of sim.cells) {
    if (!openSoil(cell)) continue;
    if (Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) <= PAD) continue;
    if (cell.i === hand.gate[0] && cell.k === hand.gate[1]) continue;
    const ring = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (ring < 3.35 && !holdsWater(cell)) continue;
    const mouth = Math.hypot(cell.i - hand.mouth[0], cell.k - hand.mouth[1]);
    const gate = Math.hypot(cell.i - hand.gate[0], cell.k - hand.gate[1]);
    if (Math.min(mouth, gate) > 2.6) continue;
    const d = Math.hypot(cell.x - st.x, cell.z - st.z);
    if (d < dist) {
      dist = d;
      best = cell;
    }
  }
  if (!best) return null;
  return {
    kind: 'plant',
    method,
    wood: method === 'knit' ? 'willow' : 'alder',
    i: best.i,
    k: best.k,
    x: best.x,
    z: best.z
  };
}

function bestBerm(sim, row) {
  const seen = reachableFrom(sim);
  let best = null;
  let score = -1e8;
  const st = sim.character.st;
  for (const cell of sim.cells) {
    if (!cell.berm || !canWork(sim, cell, row) || !approachable(sim, cell, seen)) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if ((dist <= PAD || dist >= 5.5) && !isGate(sim, cell)) continue;
    const value = 2 - (cell.lift || 0) * 0.2 - Math.hypot(cell.x - st.x, cell.z - st.z) / 16;
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best;
}

function bestKnit(sim, row) {
  const seen = reachableFrom(sim);
  let best = null;
  let score = -1e8;
  const st = sim.character.st;
  for (const cell of sim.cells) {
    if (!canWork(sim, cell, row) || cell.berm || !approachable(sim, cell, seen)) continue;
    let beside = 0;
    for (const index of neighbors(cell)) {
      const next = sim.cells[index];
      if ((next.layers || 0) > 0 || next.berm || (next.cubes || 0) > 0) beside += 1;
    }
    if (!beside) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= PAD || dist >= 5.5) continue;
    const value = beside * 2 - Math.hypot(cell.x - st.x, cell.z - st.z) / 16;
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best;
}

function stickFor(sim, place, row, prefer) {
  if (prefer) {
    const st = sim.character.st;
    let best = null;
    let dist = 1e9;
    sim.loose.forEach((stick, index) => {
      if (stick.fall || stick.kind !== prefer) return;
      if (skipped(sim, `fetch:${Math.round(stick.x * 2)},${Math.round(stick.z * 2)}`)) return;
      const d = Math.hypot(stick.x - st.x, stick.z - st.z);
      if (d < dist) {
        dist = d;
        best = index;
      }
    });
    if (best != null) return best;
  }
  return bestStick(sim, place, row);
}

function placeGoal(sim, row, method, cell) {
  if (!cell) return null;
  if (sim.carrying) return { kind: 'place', method, i: cell.i, k: cell.k };
  const prefer = method === 'knit' ? 'willow' : null;
  const index = stickFor(sim, cell, row, prefer);
  const stick = index == null ? null : sim.loose[index];
  if (!stick) return null;
  return { kind: 'fetch', method, x: stick.x, z: stick.z };
}

function edgeRun(sim, edge) {
  const last = GRID - 1;
  const cells = [];
  if (edge === 'N') for (let i = 0; i < GRID; i++) cells.push(sim.cells[i]);
  else if (edge === 'S') for (let i = 0; i < GRID; i++) cells.push(sim.cells[last * GRID + i]);
  else if (edge === 'W') for (let k = 0; k < GRID; k++) cells.push(sim.cells[k * GRID]);
  else for (let k = 0; k < GRID; k++) cells.push(sim.cells[k * GRID + last]);
  return cells;
}

function spillPath(sim) {
  const hand = seasonFinger(sim);
  if (!hand) return [];
  const horizontal = hand.edge === 'N' || hand.edge === 'S';
  const at = cell => (horizontal ? cell.i : cell.k);
  const mouthAt = horizontal ? hand.mouth[0] : hand.mouth[1];
  const mouth = sim.cells[hand.mouth[1] * GRID + hand.mouth[0]];
  let bestSign = -1;
  let bestScore = Infinity;
  for (const sign of [-1, 1]) {
    let score = 0;
    for (const cell of edgeRun(sim, hand.edge)) {
      if (!cell || (at(cell) - mouthAt) * sign <= 0) continue;
      score += (cell.berm ? 3 : 0) + (cell.cubes || 0);
    }
    if (score < bestScore) {
      bestScore = score;
      bestSign = sign;
    }
  }
  const exit = [];
  const back = [];
  for (const cell of edgeRun(sim, hand.edge)) {
    if (!cell || cell === mouth || cell.hearth || cell.tree) continue;
    if (Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) <= PAD) continue;
    const delta = (at(cell) - mouthAt) * bestSign;
    if (delta > 0) exit.push(cell);
    else if (delta < 0) back.push(cell);
  }
  exit.sort((a, b) => Math.abs(at(a) - mouthAt) - Math.abs(at(b) - mouthAt));
  back.sort((a, b) => Math.abs(at(a) - mouthAt) - Math.abs(at(b) - mouthAt));
  const path = [];
  const add = (cell, sill) => {
    if (!cell || cell.hearth || cell.tree) return;
    if (Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) <= PAD) return;
    path.push({ cell, sill });
  };
  add(mouth, -0.55);
  exit.forEach((cell, n) => add(cell, -0.68 - n * 0.05));
  back.forEach((cell, n) => add(cell, Math.min(-0.32, -0.46 + n * 0.02)));
  return path;
}

function nextCut(sim) {
  for (const step of spillPath(sim)) {
    if (skipped(sim, keyOf(step.cell.i, step.cell.k))) continue;
    if ((step.cell.sill || 0) > step.sill + 0.04) return step;
  }
  return null;
}

function racePath(sim) {
  const hand = seasonFinger(sim);
  if (!hand) return [];
  const mouth = sim.cells[hand.mouth[1] * GRID + hand.mouth[0]];
  if (!mouth) return [];
  const gate = sim.cells[hand.gate[1] * GRID + hand.gate[0]];
  const held = gate && holdsWater(gate);
  if (!held) return [];
  const start = mouth.k * GRID + mouth.i;
  const seen = new Uint8Array(sim.cells.length);
  const prev = new Int16Array(sim.cells.length);
  prev.fill(-1);
  const queue = [start];
  seen[start] = 1;
  let end = -1;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    const cell = sim.cells[at];
    const onEdge = cell.i === 0 || cell.k === 0 || cell.i === GRID - 1 || cell.k === GRID - 1;
    const mouthEdge = hand.edge === 'N' ? cell.k === 0
      : hand.edge === 'S' ? cell.k === GRID - 1
      : hand.edge === 'W' ? cell.i === 0
        : cell.i === GRID - 1;
    if (onEdge && !mouthEdge && Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) >= 4) {
      end = at;
      break;
    }
    for (const index of neighbors(cell)) {
      if (seen[index]) continue;
      const next = sim.cells[index];
      if (!next || next.hearth || next.tree) continue;
      if (Math.hypot(next.i - HEARTH_I, next.k - HEARTH_K) < 4) continue;
      seen[index] = 1;
      prev[index] = at;
      queue.push(index);
    }
  }
  if (end < 0) return [];
  const path = [];
  let cursor = end;
  let depth = 0;
  while (cursor !== -1) {
    const cell = sim.cells[cursor];
    path.push({ cell, sill: -0.35 - depth * 0.04 });
    depth += 1;
    if (cursor === start) break;
    cursor = prev[cursor];
  }
  return path.reverse();
}

function nextRace(sim) {
  for (const step of racePath(sim)) {
    if (skipped(sim, keyOf(step.cell.i, step.cell.k))) continue;
    if ((step.cell.sill || 0) > step.sill + 0.04 || !step.cell.race) return step;
  }
  return null;
}

function pickStore(sim) {
  if (sim.store?.i != null) {
    const cell = sim.cells[sim.store.k * GRID + sim.store.i];
    if (cell) return cell;
  }
  let best = null;
  let score = -1e9;
  for (const cell of sim.cells) {
    if (!openSoil(cell) && !cell.store) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= COURT || dist >= 5.2) continue;
    const depth = sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
    if (depth > 0.03) continue;
    const value = 4 - Math.abs(dist - 3.4) - depth * 4;
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  if (!best) return null;
  best.store = true;
  sim.store = { i: best.i, k: best.k, sticks: sim.store?.sticks || [] };
  return best;
}

function storeGoal(sim, row) {
  const season = seasonOf(sim).id;
  const pile = pickStore(sim);
  if (!pile) return null;
  sim.store = sim.store || { i: pile.i, k: pile.k, sticks: [] };
  const sticks = sim.store.sticks || [];
  if (season === 'AUT' && (sim.loose || []).filter(item => !item.fall).length > 6 && sticks.length < 12) {
    if (sim.carrying) return { kind: 'store', method: 'store', i: pile.i, k: pile.k };
    const fetch = placeGoal(sim, row, 'store', pile);
    if (fetch) return fetch;
  }
  if ((season === 'WIN' || season === 'SPR') && !sim.carrying && !woodLeft(sim) && sticks.length) {
    return { kind: 'takeStore', method: 'store', i: pile.i, k: pile.k };
  }
  return null;
}

function methodGoal(sim, row, method) {
  if (method === 'dam') return placeGoal(sim, row, method, bestPlace(sim, row));
  if (method === 'raise') return placeGoal(sim, row, method, bestBerm(sim, row));
  if (method === 'knit') {
    const laid = placeGoal(sim, row, method, bestKnit(sim, row));
    if (laid) return laid;
    if (!sim.carrying) return bankSpot(sim, 'knit');
    return null;
  }
  if (method === 'root') return sim.carrying ? null : bankSpot(sim, 'root');
  if (method === 'divert') {
    if (sim.carrying) return null;
    const cut = nextCut(sim);
    if (!cut) return null;
    return { kind: 'cut', method, i: cut.cell.i, k: cut.cell.k, sill: cut.sill };
  }
  if (method === 'race') {
    if (sim.carrying) return null;
    const cut = nextRace(sim);
    if (!cut) return null;
    return { kind: 'cut', method, race: true, i: cut.cell.i, k: cut.cell.k, sill: cut.sill };
  }
  if (method === 'store') return storeGoal(sim, row);
  if (method === 'wood') {
    if (sim.carrying || woodLeft(sim)) return null;
    if ((sim.store?.sticks || []).length) {
      return { kind: 'takeStore', method: 'wood', i: sim.store.i, k: sim.store.k };
    }
    const tree = bestTree(sim, row);
    if (tree) return { kind: 'shake', method, x: tree.x, z: tree.z };
    if (seasonOf(sim).id === 'WIN') {
      const hidden = bestBuried(sim);
      if (hidden) return { kind: 'uncover', method, i: hidden.i, k: hidden.k };
    }
  }
  if (method === 'stair') return stairGoal(sim, row, sim.hearth);
  if (method === 'unjam') return unjamGoal(sim, row);
  if (method === 'sump') return sumpGoal(sim, row);
  if (method === 'weir') return weirGoal(sim, row);
  if (method === 'door') return doorGoal(sim, row);
  if (method === 'pave') return paveGoal(sim, row);
  if (method === 'prune') return pruneGoal(sim, row);
  return null;
}

function wallCellar(sim) {
  let best = null;
  let score = -1;
  for (const cell of sim.cells) {
    if ((cell.cubes || 0) < 2) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist < PAD || dist > 5.5) continue;
    const value = (cell.cubes || 0) * 2 - dist * 0.2;
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best;
}

function stashRipeCellar(sim, row) {
  if (row.eat >= 0.5) return;
  for (const plot of sim.plots || []) {
    if (plot.growth < 1) continue;
    const wall = wallCellar(sim);
    if (!wall) continue;
    wall.cellar = wall.cellar || [];
    if (wall.cellar.length >= 6) continue;
    wall.cellar.push(plot.crop);
    plot.growth = 0.08;
    sim.events?.push({ type: 'note', text: 'You keep the crop in the wall.' });
    return;
  }
}

function cellarWithFood(sim) {
  let best = null;
  for (const cell of sim.cells) {
    if (!cell.cellar?.length) continue;
    if (!best || cell.cellar.length > best.cellar.length) best = cell;
  }
  return best;
}

function pruneGoal(sim, row) {
  const tree = (sim.trees || []).find(item => item.planted && !item.fallen && (item.growth || 0) > 2
    && sim.cells[item.k * GRID + item.i]?.cubes >= 2);
  if (!tree) return null;
  const cell = sim.cells[tree.k * GRID + tree.i];
  if (!cell || !canWork(sim, cell, row)) return null;
  if (sim.carrying) return { kind: 'prune', i: cell.i, k: cell.k, tree };
  if (woodLeft(sim)) return null;
  const spare = (sim.loose || []).filter(stick => !stick.fall);
  if (spare.length < 2) {
    if (tree) return { kind: 'shake', method: 'prune', x: tree.x, z: tree.z };
    return null;
  }
  return { kind: 'shake', method: 'prune', x: tree.x, z: tree.z };
}

function nextBlock(sim, row) {
  const guide = sim.guide;
  const from = BLOCKS.indexOf(guide.method);
  const begin = from < 0 ? 0 : 1;
  const start = from < 0 ? 0 : from;
  const era = eraOf(sim);
  for (let n = 0; n < BLOCKS.length; n++) {
    const method = BLOCKS[(start + begin + n) % BLOCKS.length];
    if (era === 'glade' && ['unjam', 'sump', 'weir', 'door', 'pave'].includes(method)) continue;
    if (method === 'door' && !doorGap(sim)) continue;
    if (method === 'unjam' && !sim.cells.some(cell => cell.jam)) continue;
  if (method === 'sump' && (!waterInsideRing(sim) || sim.cells.some(cell => cell.sump))) continue;
    const goal = methodGoal(sim, row, method);
    if (!goal) continue;
    if (guide.method !== method) {
      guide.method = method;
      sim.events?.push({ type: 'note', text: BLOCK_LINE[method] });
    }
    goal.method = method;
    return goal;
  }
  return null;
}

const WEDGE = ['west', 'northwest', 'north', 'northeast', 'east', 'southeast', 'south', 'southwest'];

function depthAt(sim, cell) {
  if (!cell || !sim.snapshot?.sample) return 0;
  return sim.snapshot.sample(cell.x, cell.z)?.depth || 0;
}

function canPlug(sim, cell, row) {
  if (!canWork(sim, cell, row)) return false;
  if (skipped(sim, keyOf(cell.i, cell.k))) return false;
  return Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) > PAD;
}

// A stick holds only while its top stays above the water beside it. A short wall
// still lets the year pour over, so she keeps building that cell.
function seals(sim, cell) {
  if (!cell || cell.hearth || cell.tree) return false;
  if ((cell.burrow || 0) > 0.6 || cell.crack) return false;
  const built = cell.berm || (cell.cubes || 0) > 0 || (cell.layers || 0) > 0;
  if (!built) return false;
  let wet = 0;
  for (const index of neighbors(cell)) {
    const next = sim.cells[index];
    if (!next) continue;
    wet = Math.max(wet, bedHeight(next) + depthAt(sim, next));
  }
  return bedHeight(cell) >= wet + 0.08;
}

function stairCell(sim, row, target) {
  if (!target || !sim.character?.st) return null;
  const here = cellAt(sim.cells, sim.character.st.x, sim.character.st.z);
  if (!here) return null;
  const seen = reachableFrom(sim);
  const goal = target.k * GRID + target.i;
  if (seen[goal]) return null;
  let step = null;
  let stepD = 1e9;
  for (let index = 0; index < sim.cells.length; index++) {
    if (!seen[index]) continue;
    const cell = sim.cells[index];
    for (const nextIndex of neighbors(cell)) {
      if (seen[nextIndex]) continue;
      const next = sim.cells[nextIndex];
      if (!next || !blockedStep(sim, cell, next)) continue;
      const low = walkHeight(cell) <= walkHeight(next) ? cell : next;
      const lowIndex = low.k * GRID + low.i;
      if (!seen[lowIndex]) continue;
      if (!canWork(sim, low, row) || low.berm || low.hearth || low.tree) continue;
      if ((low.layers || 0) >= 4) continue;
      const dist = Math.hypot(next.i - target.i, next.k - target.k);
      if (dist < stepD) {
        stepD = dist;
        step = low;
      }
    }
  }
  return step;
}

function stairGoal(sim, row, target) {
  const step = stairCell(sim, row, target);
  if (!step) return null;
  if (sim.guide.method !== 'stair') {
    sim.guide.method = 'stair';
    sim.events?.push({ type: 'note', text: BLOCK_LINE.stair });
  }
  if (sim.carrying) return { kind: 'place', method: 'stair', i: step.i, k: step.k };
  const laid = placeGoal(sim, row, 'stair', step);
  if (laid) return laid;
  if (woodLeft(sim)) return null;
  const tree = bestTree(sim, row);
  if (!tree) return null;
  return { kind: 'shake', method: 'stair', x: tree.x, z: tree.z };
}

// From the water, walk away from the idol and lower the ground so the pool can leave.
function nextDrain(sim, from) {
  if (!from) return null;
  let cell = from;
  const seen = new Set([cell.k * GRID + cell.i]);
  for (let n = 0; n < GRID; n++) {
    let best = null;
    let bestD = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    for (const index of neighbors(cell)) {
      if (seen.has(index)) continue;
      const next = sim.cells[index];
      if (!next || next.hearth || next.tree) continue;
      const dist = Math.hypot(next.i - HEARTH_I, next.k - HEARTH_K);
      if (dist > bestD) {
        best = next;
        bestD = dist;
      }
    }
    if (!best) return null;
    seen.add(best.k * GRID + best.i);
    const outward = Math.hypot(best.i - HEARTH_I, best.k - HEARTH_K);
    if (outward <= PAD || best.berm || (best.cubes || 0) > 0) {
      cell = best;
      continue;
    }
    const want = -0.28 - n * 0.05;
    if ((best.sill || 0) > want + 0.04 && !skipped(sim, keyOf(best.i, best.k))) return { cell: best, sill: want };
    cell = best;
  }
  return null;
}

// Water that can still walk to the idol is the work. The plug is the farthest
// open cell on that path she can reach, so the cordon stands out at the water.
function leakPlug(sim, row) {
  sim._leak = null;
  if (!sim.cells || !sim.hearth || !sim.snapshot?.sample) return null;
  const hearth = sim.hearth;
  const start = hearth.k * GRID + hearth.i;
  if (!sim.cells[start]) return null;
  const prev = new Int32Array(sim.cells.length);
  prev.fill(-1);
  const seen = new Uint8Array(sim.cells.length);
  const queue = [start];
  seen[start] = 1;
  let threat = -1;
  let threatScore = -1e9;
  for (let head = 0; head < queue.length; head++) {
    const cell = sim.cells[queue[head]];
    for (const index of neighbors(cell)) {
      if (seen[index]) continue;
      const next = sim.cells[index];
      if (!next || next === hearth || seals(sim, next)) continue;
      seen[index] = 1;
      prev[index] = queue[head];
      queue.push(index);
      const depth = depthAt(sim, next);
      const burrow = (next.burrow || 0) > 0.5;
      if (depth < 0.04 && !burrow) continue;
      const dist = Math.hypot(next.i - hearth.i, next.k - hearth.k);
      if (dist <= PAD) continue;
      const score = -dist + depth * 0.25 + burrow * 2.5;
      if (score > threatScore) {
        threatScore = score;
        threat = index;
      }
    }
  }
  const reached = reachableFrom(sim);
  let plug = null;
  let plugDist = -1;
  if (threat >= 0) {
    let cursor = threat;
    while (cursor !== -1) {
      const cell = sim.cells[cursor];
      if (cell === hearth) break;
      if (canPlug(sim, cell, row) && approachable(sim, cell, reached)) {
        const dist = Math.hypot(cell.i - hearth.i, cell.k - hearth.k);
        if (dist > plugDist) {
          plugDist = dist;
          plug = cell;
        }
      }
      cursor = prev[cursor];
    }
  }
  if (!plug && depthAt(sim, hearth) > 0.008) {
    let best = 1e9;
    for (const cell of sim.cells) {
      if (!canPlug(sim, cell, row) || !approachable(sim, cell, reached)) continue;
      const dist = Math.hypot(cell.i - hearth.i, cell.k - hearth.k);
      if (dist > 4.2) continue;
      const rank = (depthAt(sim, cell) > 0.01 ? dist - 20 : dist);
      if (rank < best) {
        best = rank;
        plug = cell;
      }
    }
  }
  if (!plug && threat < 0) {
    sim.guide.leakWhere = '';
    return null;
  }
  if (plug) sim._leak = plug;
  return { plug, threat: threat >= 0 ? sim.cells[threat] : plug };
}

function sayLeak(sim, threat) {
  const where = WEDGE[wedgeOf(threat.i, threat.k, HEARTH_I, HEARTH_K)];
  if (sim.guide.leakWhere === where) return;
  sim.guide.leakWhere = where;
  sim.events?.push({ type: 'note', text: `Water comes from the ${where}. You build against it.` });
}

function leakGoal(sim, row) {
  const found = leakPlug(sim, row);
  if (!found) return null;
  sayLeak(sim, found.threat);
  if (!found.plug) return stairGoal(sim, row, found.threat);
  if (!sim.carrying && depthAt(sim, sim.hearth) > 0.015) {
    const cut = nextDrain(sim, found.threat);
    if (cut) {
      if (sim.guide.method !== 'divert') {
        sim.guide.method = 'divert';
        sim.events?.push({ type: 'note', text: BLOCK_LINE.divert });
      }
      return { kind: 'cut', method: 'divert', i: cut.cell.i, k: cut.cell.k, sill: cut.sill };
    }
  }
  const goal = placeGoal(sim, row, 'dam', found.plug);
  if (goal) {
    sim.guide.method = 'dam';
    goal.method = 'dam';
    return goal;
  }
  if (sim.carrying || woodLeft(sim)) return null;
  const tree = bestTree(sim, row);
  if (!tree) return null;
  sim.guide.method = 'wood';
  return { kind: 'shake', method: 'wood', x: tree.x, z: tree.z };
}

function choose(sim) {
  if (sim.held) return null;
  const row = metrics(sim);
  const guide = sim.guide;
  if (guide.pauseUntil > sim.time) return guide.goal;

  if (Number.isInteger(sim.wantStick)) {
    const wanted = sim.loose?.[sim.wantStick];
    if (wanted && !wanted.fall && !sim.carrying) return { kind: 'fetch', x: wanted.x, z: wanted.z };
    sim.wantStick = null;
  }

  if (sim.errand && sim.errand.until > sim.time && sim.carrying) {
    const cell = sim.cells[sim.errand.k * GRID + sim.errand.i];
    if (cell && canWork(sim, cell, row)) return { kind: 'place', i: cell.i, k: cell.k };
  }

  const leak = leakGoal(sim, row);
  if (leak) return leak;

  if (sim.hearth && !reachableFrom(sim)[sim.hearth.k * GRID + sim.hearth.i]) {
    const step = stairGoal(sim, row, sim.hearth);
    if (step) return step;
  }

  if (decline(sim, row)) return guide.goal;

  if (row.love * row.fit > 0.38) {
    const sick = (sim.trees || []).find(tree => tree.sick && !tree.fallen && !tree.attended && tree.group !== 'plant');
    if (sick && !skipped(sim, `attend:${sick.i},${sick.k}`)) {
      return { kind: 'attend', x: sick.x, z: sick.z, tree: sick };
    }
  }

  if (row.home !== seasonOf(sim).id && sim.time > (guide.nextLook || 0) && hash(sim.year * 40 + Math.floor(sim.time / 2)) < row.pause * 0.2) {
    guide.nextLook = sim.time + 7;
    guide.pauseUntil = sim.time + 0.9;
    const edge = EDGE_NAME[seasonOf(sim).edge] || 'north';
    sim.events.push({ type: 'note', text: `You look ${edge}.` });
    return { kind: 'look', edge: seasonOf(sim).edge };
  }

  if (sim.carrying) {
    const method = BLOCKS.includes(guide.method) ? guide.method : 'dam';
    const laid = methodGoal(sim, row, method) || methodGoal(sim, row, 'dam');
    if (laid) return laid;
  }

  const blocking = nextBlock(sim, row);
  if (blocking) return blocking;

  stashRipeCellar(sim, row);
  if (!sim.carrying && seasonOf(sim).id === 'WIN' && row.eat * row.fit > 0.4) {
    const bare = (sim.plots || []).every(plot => (plot.growth || 0) < 0.45);
    const wall = cellarWithFood(sim);
    if (bare && wall) return { kind: 'cellar', i: wall.i, k: wall.k };
  }

  if (!sim.carrying && row.eat * row.fit > 0.55) {
    const food = ripePlot(sim);
    if (food) return { kind: 'eat', id: food.id, x: food.x, z: food.z };
  }
  return null;
}

function standOn(sim, cell) {
  const st = sim.character.st;
  let best = null;
  let dist = 1e9;
  for (const index of neighbors(cell)) {
    const next = sim.cells[index];
    if (Math.abs(next.elevation - cell.elevation) > 0.42) continue;
    // Stand on the ground beside a mound. A stack of cubes is a wall, not a place to stand.
    if (walkHeight(next) - next.elevation > climbLimit(sim) + (next.land || 0) + 0.05) continue;
    const d = Math.hypot(next.x - st.x, next.z - st.z);
    if (d < dist) {
      dist = d;
      best = next;
    }
  }
  return best;
}

function chasePoint(sim, goal) {
  if (!goal || goal.kind === 'look') return null;
  if (goal.kind === 'place') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    const stand = cell && standOn(sim, cell);
    return stand ? { x: stand.x, z: stand.z } : null;
  }
  if (goal.kind === 'uncover' || goal.kind === 'cut' || goal.kind === 'store' || goal.kind === 'takeStore' || goal.kind === 'unjam' || goal.kind === 'walk' || goal.kind === 'lintel' || goal.kind === 'hurdle' || goal.kind === 'cellar' || goal.kind === 'prune') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    return cell ? { x: cell.x, z: cell.z } : null;
  }
  if (goal.kind === 'look' && goal.i != null) {
    const cell = sim.cells[goal.k * GRID + goal.i];
    return cell ? { x: cell.x, z: cell.z } : null;
  }
  if (goal.x == null) return null;
  return { x: goal.x, z: goal.z };
}

function abandon(sim, goal) {
  if (!goal) return;
  const until = sim.time + (goal.kind === 'eat' ? 12 : 8);
  if (goal.kind === 'place' || goal.kind === 'uncover' || goal.kind === 'cut' || goal.kind === 'store' || goal.kind === 'takeStore') {
    sim.guide.skip.set(keyOf(goal.i, goal.k), until);
  } else if (goal.kind === 'eat' && goal.id != null) sim.guide.skip.set(`eat:${goal.id}`, until);
  else if (goal.kind === 'fetch') sim.guide.skip.set(`fetch:${Math.round(goal.x * 2)},${Math.round(goal.z * 2)}`, until);
  else if (goal.kind === 'shake') sim.guide.skip.set(`shake:${Math.round(goal.x)},${Math.round(goal.z)}`, sim.time + 6);
  else if (goal.kind === 'attend' && goal.tree) sim.guide.skip.set(`attend:${goal.tree.i},${goal.tree.k}`, sim.time + 16);
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
    if (blockedStep(sim, cell, next)) continue;
      seen[index] = 1;
      prev[index] = at;
      queue.push(index);
    }
  }
  if (!seen[goal]) {
    let best = from;
    let bestD = Infinity;
    for (let index = 0; index < seen.length; index++) {
      if (!seen[index]) continue;
      const cell = sim.cells[index];
      const d = Math.hypot(cell.x - there.x, cell.z - there.z);
      if (d < bestD) {
        bestD = d;
        best = index;
      }
    }
    if (best === from) return here;
    let step = best;
    while (prev[step] !== from && prev[step] !== -1) step = prev[step];
    return sim.cells[step];
  }
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
  if (goal.kind === 'look') {
    if (goal.method === 'wall') {
      const st = sim.character?.st;
      const cell = goal.i != null ? sim.cells[goal.k * GRID + goal.i] : null;
      return Boolean(st && cell && Math.hypot(st.x - cell.x, st.z - cell.z) > 0.65);
    }
    return sim.guide.pauseUntil > sim.time;
  }
  if (goal.kind === 'attend') return Boolean(goal.tree && goal.tree.sick && !goal.tree.fallen);
  if (goal.kind === 'place') {
    if (!sim.carrying) return false;
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return false;
    if (goal.method === 'weir' && cell.weir) return false;
    if (goal.method === 'pave' && cell.paved) return false;
    if ((sim.guide.skip.get(keyOf(cell.i, cell.k)) || 0) > sim.time) return false;
    if (cell.rock || cell.log) return false;
    if (cell.berm) return (cell.lift || 0) < liftCap(sim.year);
    return cell.layers < 5 && !cell.tree && !cell.plot;
  }
  if (goal.kind === 'plant') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    return Boolean(cell && !cell.tree && !cell.berm && !cell.log && !sim.carrying);
  }
  if (goal.kind === 'fetch') {
    if (sim.carrying) return false;
    return sim.loose.some(stick => !stick.fall && Math.hypot(stick.x - goal.x, stick.z - goal.z) < 0.5);
  }
  if (goal.kind === 'eat') {
    if (String(goal.id).startsWith('fruit:')) {
      const [i, k] = goal.id.slice(6).split(',').map(Number);
      const cell = sim.cells[k * GRID + i];
      return Boolean(cell && cell.fruit && cell.fruitGrowth >= 1);
    }
    const plot = sim.plots.find(item => item.id === goal.id);
    return Boolean(plot && plot.growth >= 1);
  }
  if (goal.kind === 'uncover') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    return Boolean(cell && buried(cell));
  }
  if (goal.kind === 'cut') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell || cell.hearth || cell.tree) return false;
    if ((sim.guide.skip.get(keyOf(cell.i, cell.k)) || 0) > sim.time) return false;
    if (goal.sump) return !cell.sump;
    if (goal.race && !cell.race) return true;
    return (cell.sill || 0) > goal.sill + 0.04;
  }
  if (goal.kind === 'unjam') return Boolean(sim.cells[goal.k * GRID + goal.i]?.jam);
  if (goal.kind === 'lintel' || goal.kind === 'hurdle') return !sim.carrying;
  if (goal.kind === 'walk') return Boolean(sim.cells[goal.k * GRID + goal.i]?.jam);
  if (goal.kind === 'store') return Boolean(sim.carrying && sim.store);
  if (goal.kind === 'takeStore') {
    return !sim.carrying && (sim.store?.sticks || []).length > 0;
  }
  if (goal.kind === 'rest') return Boolean(sim.holding) && !sim.carrying;
  if (goal.kind === 'shake') return !sim.carrying && sim.loose.length < 10;
  if (goal.kind === 'cellar') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    return Boolean(cell?.cellar?.length);
  }
  if (goal.kind === 'prune') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    const tree = goal.tree;
    return Boolean(cell && tree && !tree.fallen && (sim.loose || []).filter(stick => !stick.fall).length >= 2);
  }
  return false;
}

const LOOK_FACE = { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI };

export function steer(sim, dt, playerDriving) {
  const guide = sim.guide;
  if (!playerDriving && !sim.over && (sim.resting === 'sleep' || sim.resting === 'wake')) {
    guide.stuck = 0;
    guide.goal = null;
    return { move: 0, mz: 0 };
  }
  if (!playerDriving && !sim.over && sim.resting === 'home' && sim.bed && sim.character?.st) {
    const wall = wallWalkGoal(sim);
    if (wall) {
      if (guide.method !== 'wall' && !sim.quiet) {
        guide.method = 'wall';
        sim.events.push({ type: 'note', text: 'She keeps the wall.' });
      }
      guide.goal = wall;
      const st = sim.character.st;
      const cell = sim.cells[wall.k * GRID + wall.i];
      if (cell && Math.hypot(st.x - cell.x, st.z - cell.z) < 0.62) {
        sim._wallKeptDay = dayIndex(sim.time || 0);
        guide.goal = null;
        guide.pauseUntil = sim.time + 1.2;
      } else return toward(sim, cell || wall);
    }
    guide.stuck = 0;
    if (!guide.goal) guide.goal = null;
    const home = sim.character.st;
    if (Math.hypot(sim.bed.x - home.x, sim.bed.z - home.z) < 0.42) return { move: 0, mz: 0 };
    return toward(sim, sim.bed);
  }
  const row = metrics(sim);
  if (!playerDriving && sim.held && row.eat > 0.45) {
    sim.holdFood = (sim.holdFood || 0) + dt;
    if (sim.holdFood > 1.15) sim.eatQueued = true;
  } else sim.holdFood = 0;

  if (playerDriving || sim.over) {
    guide.stuck = 0;
    return null;
  }
  const st = sim.character.st;
  const chase = chasePoint(sim, guide.goal);
  const resting = guide.goal?.kind === 'rest' && chase && Math.hypot(chase.x - st.x, chase.z - st.z) < 0.35;
  if (!guide.goal || guide.goal.kind === 'look' || resting) guide.stuck = 0;
  else if (!chase) guide.stuck += dt;
  else {
    const dist = Math.hypot(chase.x - st.x, chase.z - st.z);
    if (!(guide.bestDist < 1e8) || dist < guide.bestDist - 0.08) {
      guide.bestDist = dist;
      guide.stuck = 0;
    } else guide.stuck += dt;
  }
  if (!goalHolds(sim) || guide.stuck > 2.4) {
    if (guide.stuck > 2.4) abandon(sim, guide.goal);
    guide.goal = choose(sim);
    guide.stuck = 0;
    guide.bestDist = Infinity;
  }
  const goal = guide.goal;
  if (!goal) return { move: 0, mz: 0 };
  if (goal.kind === 'look') return { move: 0, mz: 0, face: goal.face ?? LOOK_FACE[goal.edge] ?? 0 };
  if (goal.kind === 'attend') {
    if (Math.hypot(goal.x - st.x, goal.z - st.z) < 0.52) {
      if (!goal.arrived) goal.arrived = sim.time;
      if (sim.time - goal.arrived > 1.25) {
        if (goal.tree) goal.tree.attended = true;
        guide.goal = null;
      }
      return { move: 0, mz: 0, face: Math.atan2(goal.z - st.z, goal.x - st.x) };
    }
    return toward(sim, goal);
  }
  if (goal.kind === 'place') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    const stand = standOn(sim, cell);
    if (!stand) return { move: 0, mz: 0 };
    const here = cellAt(sim.cells, st.x, st.z);
    if (sim.carrying && (here === stand || Math.hypot(stand.x - st.x, stand.z - st.z) < 0.62)) {
      const face = Math.atan2(cell.z - st.z, cell.x - st.x);
      sim.placeQueued = true;
      return { move: Math.cos(face) * 0.4, mz: Math.sin(face) * 0.4, face };
    }
    return toward(sim, stand);
  }
  if (goal.kind === 'cut') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55) {
      cell.sill = goal.sill;
      cell.stain = Math.min(1, (cell.stain || 0) + 0.45);
      if (goal.race) {
        cell.race = true;
        cell.channel = true;
      }
      if (goal.sump) cell.sump = true;
      sim.bedDirty = true;
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'store') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55 && sim.carrying) {
      sim.store = sim.store || { i: cell.i, k: cell.k, sticks: [] };
      if (sim.store.sticks.length < 12) {
        sim.store.sticks.push(sim.carryKind || 'maple');
        cell.store = true;
        sim.carrying = false;
        sim.carryKind = null;
        sim.events.push({ type: 'note', text: 'You keep wood for winter.' });
      }
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'takeStore') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55 && (sim.store?.sticks || []).length) {
      sim.carryKind = sim.store.sticks.pop() || 'maple';
      sim.carrying = true;
      sim.events.push({ type: 'take', text: 'You take from the store.' });
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'cellar') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55 && cell.cellar?.length) {
      const crop = cell.cellar.pop();
      sim.held = crop;
      sim.eatQueued = true;
      sim.events.push({ type: 'take', text: 'You take from the cellar.' });
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'prune') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55) {
      let spent = 0;
      for (let n = sim.loose.length - 1; n >= 0 && spent < 2; n--) {
        if (sim.loose[n].fall) continue;
        sim.loose.splice(n, 1);
        spent += 1;
      }
      if (goal.tree) {
        goal.tree.growth = Math.min(goal.tree.growth || 2, 1.9);
        goal.tree.prunedUntil = sim.time + seasonLength(sim) * 2;
      }
      sim.events.push({ type: 'note', text: 'You hold the crown back.' });
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'plant') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55) {
      sowWood(sim, cell, goal.wood || 'alder');
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'uncover') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.42) {
      cell.snow = 0.08;
      if (cell.layers > 0) {
        cell.layers -= 1;
        const kind = cell.woods?.pop() || cell.lastWood || 'birch';
        cell.mass = Math.max(0, (cell.mass || 0) - 0.5);
        sim.carrying = true;
        sim.carryKind = kind;
        sim.bedDirty = true;
        sim.events.push({ type: 'take', text: 'You find the stick.' });
        guide.goal = null;
      }
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'unjam') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55 && cell.jam) {
      cell.jam = false;
      sim.bedDirty = true;
      sim.carryKind = 'oak';
      sim.carrying = true;
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'lintel' || goal.kind === 'hurdle') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (Math.hypot(cell.x - st.x, cell.z - st.z) < 0.55 && sim.carrying) {
      if (goal.kind === 'lintel') cell.lintel = true;
      else cell.hurdle = true;
      sim.carrying = false;
      sim.carryKind = null;
      sim.bedDirty = true;
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
    return toward(sim, cell);
  }
  if (goal.kind === 'place' && goal.method === 'weir') {
    const cell = sim.cells[goal.k * GRID + goal.i];
    if (!cell) return { move: 0, mz: 0 };
    if (sim.carrying && Math.hypot(cell.x - st.x, cell.z - st.z) < 0.62) {
      cell.weir = true;
      cell.layers = Math.min(5, (cell.layers || 0) + 2);
      addWeirLayers(cell);
      sim.carrying = false;
      sim.carryKind = null;
      sim.bedDirty = true;
      guide.goal = null;
      return { move: 0, mz: 0 };
    }
  }
  if (goal.kind === 'rest' && Math.hypot(goal.x - st.x, goal.z - st.z) < 0.35) return { move: 0, mz: 0 };
  return toward(sim, goal);
}

function addWeirLayers(cell) {
  if (!cell.woods) cell.woods = [];
  while (cell.woods.length < (cell.layers || 0)) cell.woods.push('oak');
}
