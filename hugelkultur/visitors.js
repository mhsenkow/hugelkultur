import { GRID, HEARTH_I, HEARTH_K, PAD, COURT, hash, cellAt, walkHeight, INK } from './world.js?v=hold';
import { seasonOf } from './water.js?v=hold';
import { stops, eraOf, fernCount, wallHeight } from './clearing.js?v=hold';
import { storeSheltered } from './signs.js?v=hold';

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MAX = 3;

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
  if (kind === 'deer' || kind === 'boar' || kind === 'fox' || kind === 'crow' || kind === 'mole') return 'beast';
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

function depthAt(sim, x, z) {
  return sim.snapshot?.sample?.(x, z)?.depth || 0;
}

function hollowsOf(sim) {
  if (sim.hollows?.length) return sim.hollows;
  return sim.cells.filter(cell => cell.hollow).map(cell => ({ i: cell.i, k: cell.k, r: 2.6 }));
}

function wallWithWetNeighbor(sim) {
  for (const cell of sim.cells) {
    if (wallHeight(cell) < 0.9 || cell.paved || (cell.ivy || 0) > 0) continue;
    let wet = false;
    for (const index of neighbors(cell)) {
      const next = sim.cells[index];
      if (!next) continue;
      const depth = depthAt(sim, next.x, next.z);
      if (depth > 0.03 || (next.moisture || 0) > 0.5) wet = true;
    }
    if (wet) return cell;
  }
  return null;
}

function pickPond(sim) {
  let best = null;
  let score = -1;
  for (const cell of sim.cells) {
    const depth = depthAt(sim, cell.x, cell.z);
    if (depth < 0.04 || depth > 0.12) continue;
    const value = depth * 10 + (cell.weir ? 2 : 0);
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best;
}

function crowLoot(sim, visitor) {
  const here = cellAt(sim.cells, visitor.x, visitor.z);
  if (!here) return false;
  if (here.thorn) return false;
  if (sim.store && !storeSheltered(sim, sim.cells[sim.store.k * GRID + sim.store.i])) {
    const store = sim.cells[sim.store.k * GRID + sim.store.i];
    if (here === store && (sim.store.sticks || []).length) {
      sim.store.sticks.pop();
      visitor.carry = true;
      speak(sim, 'A crow takes a stick.');
      return true;
    }
  }
  const stick = (sim.loose || []).find(item => !item.fall && Math.hypot(item.x - visitor.x, item.z - visitor.z) < 0.55);
  if (stick) {
    const index = sim.loose.indexOf(stick);
    if (index >= 0) sim.loose.splice(index, 1);
    visitor.carry = true;
    speak(sim, 'A crow takes a stick.');
    return true;
  }
  const husk = (sim.husks || []).find(item => Math.hypot(item.x - visitor.x, item.z - visitor.z) < 0.5);
  if (husk) {
    sim.husks = sim.husks.filter(item => item !== husk);
    visitor.carry = true;
    speak(sim, 'A crow takes a stick.');
    return true;
  }
  return false;
}

function dropStickBeyond(sim, visitor) {
  if (!visitor.carry) return;
  const edge = edgeCell(sim, hash(sim.time * 5 + visitor.x));
  if (!edge) return;
  sim.loose = sim.loose || [];
  sim.loose.push({
    x: edge.x,
    z: edge.z,
    yaw: hash(sim.time) * Math.PI,
    kind: 'birch',
    age: 0,
    fall: false
  });
  visitor.carry = false;
  speak(sim, 'A crow brings a stick.');
}

function actBoar(sim, visitor) {
  const cell = cellAt(sim.cells, visitor.x, visitor.z);
  if (!cell || Math.hypot(visitor.x - visitor.tx, visitor.z - visitor.tz) > 0.45) return;
  if ((cell.ivy || 0) > 0) {
    visitor.until = sim.time;
    return;
  }
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

function actMole(sim, visitor) {
  const cell = cellAt(sim.cells, visitor.x, visitor.z);
  if (!cell || cell.paved) {
    visitor.until = sim.time;
    return;
  }
  cell.burrow = (cell.burrow || 0) + 0.22;
  if (cell.burrow > 1) {
    cell.burrow = 1;
    cell.sill = Math.max(-0.9, (cell.sill || 0) - 0.25);
    sim.bedDirty = true;
    if (sim.chronicle) sim.chronicle.breach = true;
    speak(sim, 'The wall weeps.');
  }
  visitor.until = sim.time + 1;
}

function actCrow(sim, visitor) {
  if (visitor.carry && visitor.intent === 'nest') {
    const trees = (sim.trees || []).filter(tree => !tree.fallen && tree.group !== 'plant');
    const tree = trees[Math.floor(hash(sim.time + visitor.x) * trees.length)];
    if (tree && Math.hypot(tree.x - visitor.x, tree.z - visitor.z) < 0.7) {
      dropStickBeyond(sim, visitor);
      visitor.until = sim.time + 2;
      return;
    }
    if (tree) aimAt(visitor, sim.cells[tree.k * GRID + tree.i]);
    return;
  }
  if (crowLoot(sim, visitor)) {
    visitor.intent = 'nest';
    const trees = (sim.trees || []).filter(tree => !tree.fallen);
    const tree = trees[Math.floor(hash(sim.time * 2) * Math.max(1, trees.length))];
    if (tree) aimAt(visitor, sim.cells[tree.k * GRID + tree.i]);
    else visitor.until = sim.time + 3;
    return;
  }
  visitor.until = sim.time;
}

function actFox(sim, visitor) {
  const squirrels = sim.squirrels || [];
  let prey = null;
  let best = 1.4;
  for (const squirrel of squirrels) {
    const d = Math.hypot(squirrel.x - visitor.x, squirrel.z - visitor.z);
    if (d < best) {
      best = d;
      prey = squirrel;
    }
  }
  if (prey && best < 0.55) {
    sim.squirrels = squirrels.filter(item => item !== prey);
    speak(sim, 'The fox keeps the hollow.');
    visitor.until = sim.time + 2;
    return;
  }
  if (prey) aimAt(visitor, cellAt(sim.cells, prey.x, prey.z) || sim.hearth);
  else {
    const hollow = hollowsOf(sim)[0];
    if (hollow) aimAt(visitor, sim.cells[hollow.k * GRID + hollow.i]);
    else visitor.until = sim.time;
  }
}

function actHeron(sim, visitor) {
  const cell = cellAt(sim.cells, visitor.x, visitor.z);
  const depth = cell ? depthAt(sim, cell.x, cell.z) : 0;
  if (depth < 0.03) {
    visitor.until = sim.time;
    return;
  }
  visitor.pause = (visitor.pause || 0) + 0.1;
  if (visitor.pause > 6 && sim.chronicle) sim.chronicle.heron = true;
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
  if ((era === 'keep' || era === 'undercroft') && roll > 0.68) {
    const wall = wallWithWetNeighbor(sim);
    if (wall) {
      const mole = spawn(sim, 'mole', 'dig');
      if (mole) {
        aimAt(mole, wall);
        mole.until = sim.time + 6;
      }
    }
  }
  if ((season === 'AUT' || season === 'WIN') && roll > 0.52 && roll < 0.82) {
    const crow = spawn(sim, 'crow', 'loot');
    if (crow) {
      const here = cellAt(sim.cells, crow.x, crow.z);
      aimAt(crow, here);
    }
  }
  const night = ((sim.time || 0) % 64) / 64;
  if (night > 0.72 && night < 0.9 && roll > 0.74) {
    const fox = spawn(sim, 'fox', 'hunt');
    if (fox) {
      const hollow = hollowsOf(sim)[0];
      aimAt(fox, hollow ? sim.cells[hollow.k * GRID + hollow.i] : sim.hearth);
    }
  }
  if (season === 'SUM' && roll > 0.58 && roll < 0.72) {
    const pond = pickPond(sim);
    if (pond) {
      const heron = spawn(sim, 'heron', 'stand');
      if (heron) {
        aimAt(heron, pond);
        heron.until = sim.time + 40;
        speak(sim, 'A heron comes.');
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
    else if (visitor.kind === 'mole') actMole(sim, visitor);
    else if (visitor.kind === 'crow') actCrow(sim, visitor);
    else if (visitor.kind === 'fox') actFox(sim, visitor);
    else if (visitor.kind === 'heron') actHeron(sim, visitor);
    if (visitor.kind === 'crow' && !visitor.carry && hash(sim.time * 0.3 + visitor.x) < 0.04) dropStickBeyond(sim, visitor);
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
    } else if (visitor.kind === 'crow') {
      draw.streak([visitor.x - fx * 0.1, y + 0.12, visitor.z - fz * 0.1], [visitor.x + fx * 0.12, y + 0.14, visitor.z + fz * 0.12], stroke(INK.charcoal, 0.05));
      draw.streak([visitor.x + fx * 0.08, y + 0.15, visitor.z + fz * 0.08], [visitor.x + fx * 0.2, y + 0.11, visitor.z + fz * 0.16], stroke(INK.charcoal, 0.03));
    } else if (visitor.kind === 'fox') {
      draw.streak([visitor.x - fx * 0.1, y + 0.04, visitor.z - fz * 0.1], [visitor.x + fx * 0.12, y + 0.07, visitor.z + fz * 0.12], stroke(10, 0.06));
      draw.point([visitor.x + fx * 0.14, y + 0.1, visitor.z + fz * 0.14], stroke(14, 0.025));
    } else if (visitor.kind === 'heron') {
      draw.streak([visitor.x, y, visitor.z], [visitor.x + 0.02, y + 0.55, visitor.z], stroke(6, 0.035));
      draw.streak([visitor.x + 0.02, y + 0.52, visitor.z], [visitor.x + fx * 0.18, y + 0.45, visitor.z + fz * 0.18], stroke(INK.charcoal, 0.03));
    } else if (visitor.kind === 'mole') {
      draw.point([visitor.x, y + 0.02, visitor.z], stroke(INK.humus, 0.05));
    }
  }
}
