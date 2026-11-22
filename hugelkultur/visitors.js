import { GRID, HEARTH_I, HEARTH_K, PAD, COURT, hash, cellAt, walkHeight, INK } from './world.js?v=hold';
import { seasonOf } from './water.js?v=hold';
import { stops, eraOf, fernCount } from './clearing.js?v=hold';

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAX = 2;

function speak(sim, text, type = 'note') {
  if (!sim.quiet) sim.events.push({ type, text });
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

function barrierOf(kind) {
  if (kind === 'deer' || kind === 'boar' || kind === 'fox') return 'beast';
  if (kind === 'wanderer') return 'people';
  return 'beast';
}

function pathStep(sim, from, goal, kind) {
  if (!from || !goal) return null;
  const rule = barrierOf(kind);
  const start = from.k * GRID + from.i;
  const end = goal.k * GRID + goal.i;
  const seen = new Uint8Array(sim.cells.length);
  const prev = new Int16Array(sim.cells.length);
  prev.fill(-1);
  const queue = [start];
  seen[start] = 1;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head];
    if (at === end) break;
    const cell = sim.cells[at];
    for (const index of neighbors(cell)) {
      if (seen[index]) continue;
      const next = sim.cells[index];
      if (stops(next, rule) && next !== goal) continue;
      seen[index] = 1;
      prev[index] = at;
      queue.push(index);
    }
  }
  if (!seen[end]) {
    let best = start;
    let bestD = Infinity;
    for (let index = 0; index < seen.length; index++) {
      if (!seen[index]) continue;
      const cell = sim.cells[index];
      const d = Math.hypot(cell.x - goal.x, cell.z - goal.z);
      if (d < bestD) {
        bestD = d;
        best = index;
      }
    }
    if (best === start) return from;
    let step = best;
    while (prev[step] !== start && prev[step] !== -1) step = prev[step];
    return sim.cells[step];
  }
  let step = end;
  while (prev[step] !== start && prev[step] !== -1) step = prev[step];
  return sim.cells[step];
}

function edgeCell(sim, salt) {
  const side = Math.floor(hash(salt) * 4);
  const along = Math.floor(hash(salt + 3) * GRID);
  if (side === 0) return sim.cells[along];
  if (side === 1) return sim.cells[(GRID - 1) * GRID + along];
  if (side === 2) return sim.cells[along * GRID];
  return sim.cells[along * GRID + (GRID - 1)];
}

function spawn(sim, kind, intent) {
  sim.visitors = sim.visitors || [];
  if (sim.visitors.length >= MAX) return null;
  if ((sim.visitCool?.[kind] || 0) > sim.time) return null;
  const edge = edgeCell(sim, (sim.time || 0) * 7 + (sim.visited?.[kind] || 0));
  if (!edge || edge.hearth) return null;
  const visitor = {
    kind,
    x: edge.x,
    z: edge.z,
    tx: edge.x,
    tz: edge.z,
    yaw: 0,
    intent,
    until: (sim.time || 0) + 28,
    cool: 0
  };
  sim.visitors.push(visitor);
  sim.visited = sim.visited || {};
  sim.visited[kind] = (sim.visited[kind] || 0) + 1;
  sim.visitCool = sim.visitCool || {};
  sim.visitCool[kind] = (sim.time || 0) + 40;
  if (sim.chronicle && !sim.chronicle.visitor) sim.chronicle.visitor = kind;
  return visitor;
}

function aimAt(visitor, cell) {
  if (!cell) return;
  visitor.tx = cell.x;
  visitor.tz = cell.z;
  visitor.target = cell;
}

function pickSapling(sim) {
  return (sim.trees || []).find(tree => tree.planted && !tree.fallen && (tree.growth || 0) < 0.8 && tree.group !== 'plant');
}

function pickMound(sim) {
  let best = null;
  let score = -1;
  for (const cell of sim.cells) {
    if (!cell.berm || cell.rock) continue;
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    const value = (cell.coat || 1) + (dist > PAD && dist < 3.35 ? 3 : 0);
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best;
}

function moveVisitor(sim, visitor, dt) {
  const here = cellAt(sim.cells, visitor.x, visitor.z);
  const goal = visitor.target || cellAt(sim.cells, visitor.tx, visitor.tz);
  if (!here || !goal) return;
  const next = pathStep(sim, here, goal, visitor.kind);
  if (!next) return;
  const dx = next.x - visitor.x;
  const dz = next.z - visitor.z;
  const dist = Math.hypot(dx, dz) || 1;
  const speed = visitor.kind === 'boar' ? 1.05 : visitor.kind === 'wanderer' ? 0.7 : 0.9;
  const step = Math.min(dist, dt * speed);
  visitor.x += (dx / dist) * step;
  visitor.z += (dz / dist) * step;
  visitor.yaw = Math.atan2(dz, dx);
}

function actDeer(sim, visitor) {
  const cell = cellAt(sim.cells, visitor.x, visitor.z);
  if (!cell) return;
  if (Math.hypot(visitor.x - visitor.tx, visitor.z - visitor.tz) > 0.4) return;
  const tree = pickSapling(sim);
  if (tree && Math.hypot(tree.x - visitor.x, tree.z - visitor.z) < 0.6) {
    tree.growth = Math.max(0.05, (tree.growth || 0.2) - 0.15);
    if (hash(sim.time + tree.i) < 0.18) tree.sick = true;
    speak(sim, 'A deer takes the sapling.');
    visitor.until = sim.time + 2;
    return;
  }
  for (const plot of sim.plots || []) {
    if (plot.growth < 0.4) continue;
    if (Math.hypot(plot.x - visitor.x, plot.z - visitor.z) > 0.55) continue;
    plot.growth = Math.max(0, plot.growth - 0.35);
    speak(sim, 'A deer takes the bed.');
    visitor.until = sim.time + 2;
    return;
  }
  if ((cell.layers || 0) > 0 && (cell.layers || 0) < 3 && !cell.berm) {
    cell.layers -= 1;
    cell.woods?.pop();
    sim.bedDirty = true;
  }
  const next = pickSapling(sim);
  if (next) aimAt(visitor, sim.cells[next.k * GRID + next.i]);
  else visitor.until = sim.time;
}

function actBoar(sim, visitor) {
  const cell = cellAt(sim.cells, visitor.x, visitor.z);
  if (!cell || Math.hypot(visitor.x - visitor.tx, visitor.z - visitor.tz) > 0.45) return;
  if (cell.berm && !cell.rock) {
    const story = cell.story || [];
    if (story.length) {
      const cause = story.pop();
      if (cell.marks) cell.marks[cause] = false;
    }
    cell.coat = Math.max(0, (cell.coat || 1) - 1);
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist > PAD && dist < 3.35 && (cell.layers || 0) >= 2) {
      cell.berm = false;
      cell.layers = 2;
      cell.woods = (cell.woods || ['maple', 'maple']).slice(0, 2);
      if (sim.chronicle) sim.chronicle.breach = true;
      speak(sim, 'A boar turns the mound.');
    } else speak(sim, 'A boar turns the mound.');
    if (sim.motions) {
      sim.motions.push({ kind: 'dust', t: 0, dur: 0.55, x: cell.x, y: cell.elevation + 0.2, z: cell.z });
    }
    sim.bedDirty = true;
    visitor.until = sim.time + 3;
    return;
  }
  const next = pickMound(sim);
  if (next) aimAt(visitor, next);
  else visitor.until = sim.time;
}

function actWanderer(sim, visitor) {
  const hearth = sim.hearth;
  if (!hearth) return;
  aimAt(visitor, hearth);
  if (Math.hypot(visitor.x - hearth.x, visitor.z - hearth.z) > COURT) return;
  const ferns = fernCount(sim.year);
  const husks = (sim.husks || []).length;
  const dry = (sim.flood || 0) < 0.5;
  const kept = ferns >= 3 && husks >= 4 && dry;
  if (kept) {
    sim.husks = sim.husks || [];
    sim.husks.push({
      x: hearth.x + (hash(sim.time) - 0.5) * 0.3,
      z: hearth.z + (hash(sim.time + 2) - 0.5) * 0.3
    });
    if (sim.husks.length > 12) sim.husks.splice(0, sim.husks.length - 12);
    speak(sim, 'A stranger leaves something.');
  } else {
    sim.yearLeaves = Math.max(0, (sim.yearLeaves ?? Math.max(0, (sim.year || 1) - 1)) - 1);
    speak(sim, 'A stranger takes a leaf.');
  }
  visitor.until = sim.time;
}

function considerSpawns(sim) {
  const season = seasonOf(sim).id;
  const era = eraOf(sim);
  const roll = hash((sim.year || 1) * 17 + (sim.seasonIndex || 0) * 5 + Math.floor((sim.time || 0) / 8));
  if ((season === 'WIN' || season === 'SPR') && roll > 0.55) {
    const deer = spawn(sim, 'deer', 'browse');
    if (deer) {
      const sap = pickSapling(sim);
      aimAt(deer, sap ? sim.cells[sap.k * GRID + sap.i] : sim.cells[4 * GRID + 4]);
      speak(sim, 'A deer comes.');
    }
  }
  if (season === 'AUT' && (era === 'ring' || era === 'keep' || era === 'undercroft') && roll > 0.62) {
    const boar = spawn(sim, 'boar', 'root');
    if (boar) {
      aimAt(boar, pickMound(sim) || sim.cells[6 * GRID + 6]);
      speak(sim, 'A boar comes.');
    }
  }
  if ((era === 'keep' || era === 'undercroft') && season !== 'WIN' && roll > 0.88) {
    const night = ((sim.time || 0) % 64) / 64;
    if (night > 0.7 && night < 0.94) {
      const wanderer = spawn(sim, 'wanderer', 'court');
      if (wanderer) {
        aimAt(wanderer, sim.hearth);
        speak(sim, 'A stranger comes.');
      }
    }
  }
}

export function shoo(sim, cell) {
  if (!cell || !sim?.visitors?.length) return false;
  let moved = false;
  for (const visitor of sim.visitors) {
    if (Math.hypot(visitor.x - cell.x, visitor.z - cell.z) > 1.4) continue;
    const dx = visitor.x - cell.x;
    const dz = visitor.z - cell.z;
    const len = Math.hypot(dx, dz) || 1;
    visitor.tx = cell.x + (dx / len) * 2.6;
    visitor.tz = cell.z + (dz / len) * 2.6;
    visitor.target = cellAt(sim.cells, visitor.tx, visitor.tz);
    visitor.until = Math.min(visitor.until, sim.time + 4);
    moved = true;
  }
  if (moved) speak(sim, 'They leave that ground.');
  return moved;
}

export function updateVisitors(sim, dt) {
  if (!sim || sim.over || sim.away) return;
  sim.visitors = sim.visitors || [];
  sim.visitWait = (sim.visitWait || 0) + dt;
  if (sim.visitWait > 6) {
    sim.visitWait = 0;
    considerSpawns(sim);
  }
  for (const visitor of sim.visitors) {
    moveVisitor(sim, visitor, dt);
    if (visitor.kind === 'deer') actDeer(sim, visitor);
    else if (visitor.kind === 'boar') actBoar(sim, visitor);
    else if (visitor.kind === 'wanderer') actWanderer(sim, visitor);
  }
  sim.visitors = sim.visitors.filter(visitor => visitor.until > sim.time);
}

function stroke(color, width) {
  return { width, color, density: 2.1, emissive: false, depth: true };
}

export function drawVisitors(draw, sim) {
  for (const visitor of sim.visitors || []) {
    const cell = cellAt(sim.cells, visitor.x, visitor.z);
    const y = cell ? walkHeight(cell) + 0.04 : 0.9;
    const fx = Math.cos(visitor.yaw || 0);
    const fz = Math.sin(visitor.yaw || 0);
    if (visitor.kind === 'deer') {
      draw.streak(
        [visitor.x - fx * 0.14, y + 0.08, visitor.z - fz * 0.14],
        [visitor.x + fx * 0.16, y + 0.12, visitor.z + fz * 0.16],
        stroke(INK.bark, 0.06)
      );
      draw.streak([visitor.x - 0.04, y, visitor.z], [visitor.x - 0.04, y + 0.1, visitor.z], stroke(5, 0.03));
      draw.streak([visitor.x + 0.05, y, visitor.z + 0.02], [visitor.x + 0.05, y + 0.1, visitor.z + 0.02], stroke(5, 0.03));
      if (seasonOf(sim).id === 'AUT' || seasonOf(sim).id === 'WIN') {
        draw.streak(
          [visitor.x + fx * 0.12, y + 0.16, visitor.z + fz * 0.12],
          [visitor.x + fx * 0.18, y + 0.28, visitor.z + fz * 0.1],
          stroke(INK.bark, 0.02)
        );
      }
    } else if (visitor.kind === 'boar') {
      draw.streak(
        [visitor.x - fx * 0.12, y + 0.04, visitor.z - fz * 0.12],
        [visitor.x + fx * 0.14, y + 0.08, visitor.z + fz * 0.14],
        stroke(INK.humus, 0.08)
      );
      draw.streak(
        [visitor.x + fx * 0.1, y + 0.06, visitor.z + fz * 0.1],
        [visitor.x + fx * 0.18, y + 0.05, visitor.z + fz * 0.18],
        stroke(6, 0.035)
      );
    } else if (visitor.kind === 'wanderer') {
      draw.streak(
        [visitor.x, y, visitor.z],
        [visitor.x + 0.02, y + 0.72, visitor.z],
        stroke(INK.charcoal, 0.07)
      );
      draw.point([visitor.x + 0.02, y + 0.78, visitor.z], stroke(INK.brass, 0.04));
    }
  }
}
