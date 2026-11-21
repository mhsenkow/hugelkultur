import { drawGardens } from './gardens.js?v=age3';
import { drawMotions } from './motions.js';
import { drawWeather, drawMemory } from './weather.js?v=square24';
import { drawRest } from './day.js?v=square24';
import { beginMound, raiseLand } from './growth.js?v=square24';
import { INK, GRID, cellAt, hash, HEARTH_I, HEARTH_K, PAD, crownFade, walkHeight } from './world.js?v=square24';
import { facedCell } from './avatar.js?v=square24';
import { floraById } from './species.js?v=square24';
import { treeForm } from './specimens.js?v=square24';
import { seasonOf, seasonLength } from './water.js?v=square24';
import { woodOf, stickPhrase, phrase, buried, wornMeasures, liftCap, treeScale, fallReady, statureOf, growWood, lifeSpan, blightStrike, beaverWood, YEAR_SPAN } from './clearing.js';

const CAPACITY = 7200;
const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function paintOf(kind) {
  const wood = woodOf(kind);
  return { width: 0.055 + wood.half * 0.04, color: wood.color, density: 2.2, emissive: false, depth: true };
}

function spawn(sim, i, k, yaw, kind) {
  if (sim.loose.length >= 48) return false;
  i = Math.max(0, Math.min(GRID - 1, i));
  k = Math.max(0, Math.min(GRID - 1, k));
  const cell = sim.cells[k * GRID + i];
  const n = sim.loose.length + 1;
  sim.loose.push({
    x: cell.x + (hash(n * 11 + i * 3) - 0.5) * 0.36,
    z: cell.z + (hash(n * 19 + k * 5) - 0.5) * 0.36,
    yaw: yaw ?? hash(n * 23 + i + k) * Math.PI,
    kind: kind || 'maple',
    age: 0,
    fall: false
  });
  return true;
}

function dropFrom(sim, tree, i, k) {
  if (!tree || sim.loose.length >= 48) return false;
  if (tree.group === 'plant') return false;
  if (tree.planted && (tree.growth || 0) < 0.5) return false;
  i = Math.max(0, Math.min(GRID - 1, i));
  k = Math.max(0, Math.min(GRID - 1, k));
  const cell = sim.cells[k * GRID + i];
  const n = sim.loose.length + 3;
  sim.loose.push({
    x: tree.x,
    z: tree.z,
    y: tree.drop || cell.elevation + 1.2,
    vy: 0.4,
    yaw: hash(n * 23 + i + k) * Math.PI,
    landX: cell.x + (hash(n * 11 + i) - 0.5) * 0.28,
    landZ: cell.z + (hash(n * 19 + k) - 0.5) * 0.28,
    kind: woodKind(tree),
    age: 0,
    fall: true
  });
  return true;
}

function woodKind(tree) {
  const known = ['oak', 'birch', 'willow', 'alder', 'maple'];
  if (known.includes(tree?.kind)) return tree.kind;
  if (tree?.kind === 'ash' || tree?.kind === 'pine') return 'maple';
  if (tree?.kind === 'beech' || tree?.kind === 'hornbeam' || tree?.kind === 'chestnut') return 'oak';
  if (tree?.kind === 'serviceberry' || tree?.kind === 'cherry' || tree?.kind === 'hazel') return 'birch';
  return 'maple';
}

function surfaceY(sim, x, z, floor) {
  const hit = sim.snapshot?.sample?.(x, z);
  if (hit && hit.depth > 0.03) return Math.max(floor, hit.level + 0.02);
  return floor + 0.035;
}

export function createStickSystem(B, KIT, sim) {
  return KIT.frameSplats(B, CAPACITY, draw => {
    drawMemory(draw, sim);
    drawPlanted(draw, sim);
    drawSticks(draw, sim);
    if (sim.drawGrowth) sim.drawGrowth(draw);
    drawGardens(draw, sim);
    drawWeather(draw, sim);
    drawRest(draw, sim);
    drawMotions(draw, sim);
  });
}

function drawStick(draw, ax, ay, az, bx, by, bz, kind) {
  draw.streak([ax, ay, az], [bx, by, bz], paintOf(kind));
}

function stackHidden(sim, cell) {
  if (!buried(cell)) return false;
  const measures = wornMeasures(sim);
  return !(measures.crust > 0.7 && seasonOf(sim).id === 'WIN');
}

function drawSticks(draw, sim) {
  for (const stick of sim.loose) drawLoose(draw, sim, stick);
  if (sim.carrying && sim.character) {
    const st = sim.character.st;
    const y = st.y + 0.92;
    const wood = woodOf(sim.carryKind);
    const dx = Math.cos(st.face) * wood.half;
    const dz = Math.sin(st.face) * wood.half;
    drawStick(draw, st.x - dx, y, st.z - dz, st.x + dx, y + 0.12, st.z + dz, sim.carryKind);
  }
  for (const cell of sim.cells) {
    if (stackHidden(sim, cell)) {
      if (wornMeasures(sim).crust > 0.7 && seasonOf(sim).id === 'WIN') {
        const y = cell.elevation + 0.06;
        draw.streak([cell.x - 0.08, y, cell.z], [cell.x + 0.08, y + 0.03, cell.z], { width: 0.04, color: 6, density: 1.4, emissive: false, depth: true });
      }
      continue;
    }
    for (let layer = 0; layer < cell.layers; layer++) {
      const kind = cell.woods?.[layer] || cell.lastWood || 'maple';
      const wood = woodOf(kind);
      const alongX = layer % 2 === 0;
      const sink = cell.settle ? (1 - cell.settle / 1.25) * 0.16 : 0;
      const y = cell.elevation + 0.05 + layer * 0.08 - sink;
      const slide = (hash(cell.i * 31 + cell.k * 17 + layer) - 0.5) * 0.08;
      const half = wood.half;
      const gap = 0.09;
      if (alongX) {
        drawStick(draw, cell.x - half, y, cell.z + slide + gap, cell.x + half, y, cell.z - slide + gap, kind);
        drawStick(draw, cell.x - half, y + 0.012, cell.z + slide - gap, cell.x + half, y + 0.012, cell.z - slide - gap, kind);
      } else {
        drawStick(draw, cell.x + slide + gap, y, cell.z - half, cell.x - slide + gap, y + 0.01, cell.z + half, kind);
        drawStick(draw, cell.x + slide - gap, y + 0.012, cell.z - half, cell.x - slide - gap, y + 0.02, cell.z + half, kind);
      }
    }
  }
}

function drawLoose(draw, sim, stick) {
  const cell = cellAt(sim.cells, stick.x, stick.z);
  const floor = cell ? Math.max(cell.elevation, cell.plot ? cell.elevation + 0.2 : 0) : 0.8;
  const y = stick.fall ? stick.y : surfaceY(sim, stick.x, stick.z, floor);
  const wood = woodOf(stick.kind);
  const dx = Math.cos(stick.yaw) * wood.half * 0.85;
  const dz = Math.sin(stick.yaw) * wood.half * 0.85;
  const tilt = stick.fall ? Math.sin(stick.yaw * 2) * 0.2 : 0.015;
  drawStick(draw, stick.x - dx, y - tilt, stick.z - dz, stick.x + dx, y + tilt, stick.z + dz, stick.kind);
}

function blob(draw, x, y, z, r, color, density) {
  const puff = (ox, oy, oz, scale) => {
    const px = x + ox;
    const py = y + oy;
    const pz = z + oz;
    draw.streak([px, py, pz], [px, py, pz], {
      width: Math.max(0.06, r * scale),
      color,
      density,
      emissive: false,
      depth: true
    });
  };
  puff(0, r * 0.06, 0, 1.45);
  puff(r * 0.38, -r * 0.04, r * 0.14, 0.92);
  puff(-r * 0.32, r * 0.05, -r * 0.16, 0.74);
}

function drawPlanted(draw, sim) {
  for (const tree of sim.trees) {
    if (!tree.planted && !tree.fallen) continue;
    const cell = sim.cells[tree.k * GRID + tree.i];
    if (!cell) continue;
    const g = tree.growth || 0.1;
    const size = tree.size || 1;
    const y0 = walkHeight(cell) - 0.02;
    const form = treeForm(tree.kind);
    if (tree.fallen) {
      const rot = Math.min(1, (tree.rot || 0) / Math.max(1, seasonLength(sim) * 2));
      const len = (0.7 + size * 0.55) * (1 - rot * 0.7);
      const y = y0 + 0.06;
      const yaw = tree.yaw || 0;
      const bark = form?.bark?.r?.[0] ?? INK.bark;
      draw.streak(
        [tree.x - Math.cos(yaw) * len, y, tree.z - Math.sin(yaw) * len],
        [tree.x + Math.cos(yaw) * len * 0.35, y + 0.05, tree.z + Math.sin(yaw) * len * 0.35],
        { width: 0.07 * (1 - rot * 0.4), color: bark, density: 2.2, emissive: false, depth: true }
      );
      continue;
    }
    const tones = form?.leaf?.r || [INK.lush, INK.leaf];
    if (tree.group === 'plant') {
      const color = tree.kind === 'ginger' ? 11 : tones[0];
      const nubs = 5;
      for (let n = 0; n < nubs; n++) {
        const angle = (n / nubs) * Math.PI * 2 + (tree.seed || 1);
        const reach = (0.04 + g * 0.14) * size;
        blob(
          draw,
          tree.x + Math.cos(angle) * reach,
          y0 + 0.05 + g * 0.06,
          tree.z + Math.sin(angle) * reach * 0.75,
          (0.045 + g * 0.04) * size,
          color,
          2
        );
      }
      continue;
    }
    drawCrown(draw, sim, tree, y0, tones, g, size, form);
  }
  drawBeaver(draw, sim);
}

function woodName(kind) {
  const name = floraById(kind)?.name || kind || 'tree';
  return name.split(' ').pop().toLowerCase();
}

function drawCrown(draw, sim, tree, y0, tones, g, size, form) {
  const shrub = tree.group === 'shrub';
  const span = statureOf(g);
  const aim = (form?.h || 2.4) * (shrub ? 0.42 : 0.78);
  const reachH = aim * (0.62 + Math.min(size, 1.5) * 0.22);
  const h = Math.min(reachH, (shrub ? 0.16 : 0.22) + span * reachH * 0.42);
  const bark = form?.bark?.r?.[0] ?? INK.bark;
  const fade = Math.max(0.7, crownFade(tree.x - (sim.hearth?.x || 0), tree.z - (sim.hearth?.z || 0), sim.viewYaw));
  const sick = tree.sick ? 0.62 : 1;
  const trunk = { width: 0.04 + Math.min(span, 2.4) * 0.018, color: bark, density: 2.3, emissive: false, depth: true };
  const stems = Math.min(form?.stems || 1, shrub ? 4 : 3);
  const grown = span > 0.75 ? stems : 1;
  for (let s = 0; s < grown; s++) {
    const angle = grown === 1 ? 0 : (s / grown) * Math.PI * 2 + (tree.seed || 1);
    const lean = grown === 1 ? 0 : 0.08 + span * 0.04;
    const x = tree.x + Math.cos(angle) * lean;
    const z = tree.z + Math.sin(angle) * lean * 0.86;
    const top = y0 + h * (grown === 1 ? 0.52 : 0.42);
    draw.streak([x, y0, z], [x + 0.01, top, z], trunk);
  }
  const droop = (form?.rise || 0) < 0;
  const limbs = Math.min(shrub ? 4 : 6, Math.max(0, Math.floor(span * 2.1) - 1));
  const seed = tree.seed || 1;
  for (let n = 0; n < limbs; n++) {
    const tier = (n + 1) / (limbs + 1);
    const y = y0 + h * (0.34 + tier * 0.46);
    const angle = hash(seed + n * 7) * Math.PI * 2;
    const reach = (0.16 + span * 0.14) * (shrub ? 0.55 : 1) * Math.min(1.3, (form?.spread || 1.6) / 2);
    const tipY = y + (droop ? -reach * 0.62 : reach * (0.08 + tier * 0.12));
    const tx = tree.x + Math.cos(angle) * reach;
    const tz = tree.z + Math.sin(angle) * reach * 0.86;
    draw.streak([tree.x, y, tree.z], [tx, tipY, tz], { ...trunk, width: trunk.width * 0.62 });
    blob(draw, tx, tipY, tz, (0.08 + span * 0.05) * sick, tones[n % tones.length], 2 * fade);
  }
  const crown = y0 + h * (droop ? 0.62 : 0.74);
  const spread = (0.04 + span * 0.22) * (shrub ? 0.7 : 1) * Math.min(size, 1.35) * sick;
  let clumps = Math.min(14, (shrub ? 4 : 5) + Math.floor(span * 3));
  if (tree.sick) clumps = Math.max(2, clumps - 3);
  const radius = (0.08 + Math.min(span, 2.2) * 0.07) * sick;
  for (let n = 0; n < clumps; n++) {
    const angle = hash(seed + n * 9) * Math.PI * 2;
    const reach = n === 0 ? 0 : spread * (0.22 + hash(seed + n * 5) * 0.78);
    const lift = n === 0 ? radius * 0.2 : (hash(seed + n * 3) - (droop ? 0.7 : 0.35)) * radius;
    blob(
      draw,
      tree.x + Math.cos(angle) * reach,
      crown + lift,
      tree.z + Math.sin(angle) * reach * 0.86,
      radius * (0.82 + hash(seed + n) * 0.36),
      tones[n % tones.length],
      2.1 * fade
    );
  }
  if (tree.sick) {
    blob(draw, tree.x + 0.05, y0 + h * 0.4, tree.z, 0.05, 6, 1.4);
    blob(draw, tree.x - 0.04, y0 + h * 0.55, tree.z + 0.03, 0.04, 13, 1.3);
  }
}

function drawBeaver(draw, sim) {
  const beaver = sim.beaver;
  if (!beaver) return;
  const cell = cellAt(sim.cells, beaver.x, beaver.z);
  const y = cell ? walkHeight(cell) + 0.04 : 0.9;
  const fx = Math.cos(beaver.yaw || 0);
  const fz = Math.sin(beaver.yaw || 0);
  draw.streak(
    [beaver.x - fx * 0.08, y, beaver.z - fz * 0.08],
    [beaver.x + fx * 0.1, y + 0.03, beaver.z + fz * 0.1],
    { width: 0.07, color: 11, density: 2.2, emissive: false, depth: true }
  );
  draw.streak(
    [beaver.x - fx * 0.12, y + 0.01, beaver.z - fz * 0.12],
    [beaver.x - fx * 0.2, y + 0.015, beaver.z - fz * 0.2],
    { width: 0.05, color: 5, density: 2, emissive: false, depth: true }
  );
}

function takeLoose(sim) {
  let index = null;
  if (Number.isInteger(sim.wantStick) && sim.loose[sim.wantStick] && !sim.loose[sim.wantStick].fall) {
    const stick = sim.loose[sim.wantStick];
    const st = sim.character.st;
    if (Math.hypot(stick.x - st.x, stick.z - st.z) < 0.62) index = sim.wantStick;
  } else index = nearestLoose(sim);
  if (index === null) return;
  const stick = sim.loose.splice(index, 1)[0];
  if (sim.wantStick === index) sim.wantStick = null;
  else if (Number.isInteger(sim.wantStick) && sim.wantStick > index) sim.wantStick -= 1;
  sim.carrying = true;
  sim.carryKind = stick.kind || 'maple';
  sim.events.push({ type: 'take', text: `You pick up ${stickPhrase(woodOf(sim.carryKind).label)}.` });
}

function nearestLoose(sim) {
  const st = sim.character.st;
  let best = null;
  let bestD = 0.62;
  for (let n = 0; n < sim.loose.length; n++) {
    const stick = sim.loose[n];
    if (stick.fall) continue;
    const d = Math.hypot(stick.x - st.x, stick.z - st.z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

function slideBirch(sim, cell) {
  const hit = sim.snapshot?.sample?.(cell.x, cell.z);
  if (!hit || hit.depth < 0.05 || (cell.mass || 0) >= 1.1) return false;
  const [vx, vz] = hit.velocity || [0, 0];
  let di = Math.abs(vx) > 0.02 ? Math.sign(vx) : 0;
  let dk = Math.abs(vz) > 0.02 ? Math.sign(vz) : 0;
  if (!di && !dk) {
    di = hash(cell.i * 3 + sim.time) > 0.5 ? 1 : -1;
  }
  const i = cell.i + di;
  const k = cell.k + dk;
  if (i < 0 || k < 0 || i >= GRID || k >= GRID) return false;
  const next = sim.cells[k * GRID + i];
  if (!next || next.hearth || next.tree || next.plot || next.berm || next.layers >= 5) return false;
  cell.layers -= 1;
  cell.woods?.pop();
  cell.mass = Math.max(0, (cell.mass || 0) - woodOf('birch').weight);
  addWood(next, 'birch');
  sim.bedDirty = true;
  sim.events.push({ type: 'note', text: 'The birch slides.' });
  return true;
}

function addWood(cell, kind) {
  const wood = woodOf(kind);
  const gain = wood.sticks;
  cell.woods = cell.woods || [];
  for (let n = 0; n < gain && cell.layers < 8; n++) {
    cell.layers += 1;
    cell.woods.push(kind);
  }
  cell.mass = (cell.mass || 0) + wood.weight;
  cell.lastWood = wood.label;
}

function knitWillow(sim, cell) {
  let best = null;
  let score = -1;
  for (const [di, dk] of STEP) {
    const i = cell.i + di;
    const k = cell.k + dk;
    if (i < 0 || k < 0 || i >= GRID || k >= GRID) continue;
    const next = sim.cells[k * GRID + i];
    if (!next || next.hearth || next.tree || next.plot) continue;
    const value = (next.layers || 0) + (next.berm ? 3 : 0);
    if (value > score) {
      score = value;
      best = next;
    }
  }
  if (!best || score < 1) return;
  if (best.berm) {
    best.lift = (best.lift || 0) + 1;
    sim.bedDirty = true;
  } else {
    addWood(best, 'willow');
    if (best.layers >= 3) beginMound(sim, best, 'tend', 'The willow knits. It is good.');
  }
  sim.events.push({ type: 'note', text: 'The willow knits.' });
}

function compostStick(sim, stick) {
  const cell = cellAt(sim.cells, stick.x, stick.z);
  if (cell && !cell.hearth) {
    cell.compost = 1;
    cell.moisture = 1;
    raiseLand(sim, cell, 0.012);
  }
  if (!sim.compostAt || sim.time - sim.compostAt > 8) {
    sim.compostAt = sim.time;
    sim.events.push({ type: 'note', text: 'A stick becomes the floor.' });
  }
}

function rootTree(sim, tree) {
  if (tree.rooted || tree.kind !== 'alder' && tree.kind !== 'willow') return;
  if ((tree.growth || 0) < 0.58) return;
  const cell = sim.cells[tree.k * GRID + tree.i];
  if (!cell || cell.hearth) return;
  tree.rooted = true;
  cell.rooted = true;
  sim.bedDirty = true;
  sim.events.push({ type: 'note', text: 'The roots take the bank.' });
}

function shedTree(sim) {
  const standing = tree => !tree.fallen && tree.group !== 'plant';
  const mature = sim.trees.filter(tree => tree.planted && standing(tree) && (tree.growth || 0) > 0.62);
  const pool = mature.length && hash(sim.time * 40 + 2) < 0.62 ? mature : sim.trees.filter(standing);
  if (!pool.length) return;
  const tree = pool[Math.floor(hash(sim.time * 1000 + 4) * pool.length)];
  const extra = tree.planted && tree.growth > 0.62 ? 2 : 1;
  let dropped = 0;
  for (let n = 0; n < extra; n++) {
    const i = tree.i + Math.floor(hash(sim.year * 9 + sim.seasonTime + n) * 3) - 1;
    const k = tree.k + Math.floor(hash(sim.seasonTime * 13 + 2 + n) * 3) - 1;
    if (dropFrom(sim, { ...tree, kind: woodKind(tree) }, i, k)) dropped += 1;
  }
  if (dropped) sim.events.push({ type: 'shed', text: dropped > 1 ? 'Sticks fall.' : 'A stick falls.' });
}

function fellTree(sim, tree, text) {
  if (!tree || tree.fallen) return;
  const cell = sim.cells?.[tree.k * GRID + tree.i];
  tree.fallen = true;
  tree.rot = 0;
  tree.yaw = hash((tree.seed || 1) + 4) * Math.PI * 2;
  tree.open = null;
  if (cell) {
    cell.tree = false;
    cell.log = true;
  }
  sim.events?.push({ type: 'fall', text });
}

function nearWater(sim, tree) {
  const cell = sim.cells?.[tree.k * GRID + tree.i];
  if (!cell) return false;
  if (cell.channel || (cell.moisture || 0) > 0.45) return true;
  if ((sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0) > 0.03) return true;
  for (const [di, dk] of STEP) {
    const next = sim.cells[(tree.k + dk) * GRID + (tree.i + di)];
    if (!next) continue;
    if (next.channel) return true;
    if ((sim.snapshot?.sample?.(next.x, next.z)?.depth || 0) > 0.04) return true;
  }
  return false;
}

function rememberGrove(sim, tree) {
  if (tree.planted || tree.age != null) return;
  const salt = hash(tree.i * 17 + tree.k * 13 + 4);
  const span = lifeSpan(tree.kind, salt);
  tree.age = YEAR_SPAN * span * (0.2 + hash(tree.i * 3 + tree.k * 9) * 0.38);
  tree.growth = Math.max(tree.growth || 0, 2.2);
  tree.seed = tree.seed || 1 + Math.floor(salt * 900);
}

function tendLife(sim, tree) {
  if (tree.group === 'plant' || tree.fallen) return;
  const name = woodName(tree.kind);
  const year = Math.floor((tree.age || 0) / YEAR_SPAN);
  if (year > (tree.checkedYear ?? -1)) {
    tree.checkedYear = year;
    if (!tree.sick && blightStrike(tree.kind, hash((tree.seed || 1) * 13 + year * 5))) {
      tree.sick = true;
      tree.sickAt = tree.age;
      sim.events?.push({ type: 'fall', text: `The ${name} takes a sickness.` });
    }
  }
  if (tree.sick && tree.age - (tree.sickAt || tree.age) > YEAR_SPAN * (tree.kind === 'chestnut' || tree.kind === 'ash' ? 0.7 : 1.2)) {
    fellTree(sim, tree, `The ${name} gives in.`);
    return;
  }
  const grown = tree.planted ? tree.growth : Math.max(tree.growth || 0, 2);
  if (fallReady(tree.age, grown, hash((tree.seed || 1) + 11), tree.kind)) {
    fellTree(sim, tree, tree.group === 'shrub' ? `The ${name} grew old.` : `The ${name} grew old.`);
  }
}

function updateBeaver(sim, dt) {
  if (sim.beaver) {
    const beaver = sim.beaver;
    const tree = beaver.tree;
    if (!tree || tree.fallen) {
      beaver.leave = (beaver.leave || 0) + dt;
      if (beaver.leave > 8) sim.beaver = null;
      return;
    }
    const dx = tree.x - beaver.x;
    const dz = tree.z - beaver.z;
    const dist = Math.hypot(dx, dz) || 1;
    beaver.yaw = Math.atan2(dz, dx);
    if (dist > 0.35) {
      const step = Math.min(dist, dt * 0.85);
      beaver.x += (dx / dist) * step;
      beaver.z += (dz / dist) * step;
      return;
    }
    beaver.chew = (beaver.chew || 0) + dt;
    if (beaver.chew < 12) return;
    fellTree(sim, tree, `A beaver takes the ${woodName(tree.kind)}.`);
    beaver.leave = 0;
    return;
  }
  sim.beaverWait = (sim.beaverWait || 0) + dt;
  const due = YEAR_SPAN * (5 + hash((sim.year || 1) * 5 + 2) * 6);
  if (sim.beaverWait < due) return;
  const pool = (sim.trees || []).filter(tree => !tree.fallen && beaverWood(tree.kind) && nearWater(sim, tree) && (tree.growth || 0) > 0.45);
  if (!pool.length) {
    sim.beaverWait = due * 0.65;
    return;
  }
  const tree = pool[Math.floor(hash(sim.year * 9 + sim.beaverWait) * pool.length)];
  sim.beaverWait = 0;
  sim.beaver = { x: tree.x + 1.1, z: tree.z + 0.4, yaw: Math.PI, chew: 0, tree };
  sim.events?.push({ type: 'note', text: 'A beaver comes to the water.' });
}

export function updateSticks(sim, dt) {
  if (sim.over) return;
  const gone = [];
  for (const tree of sim.trees) {
    tree.cooldown = Math.max(0, (tree.cooldown || 0) - dt);
    const cell = sim.cells[tree.k * GRID + tree.i];
    if (tree.fallen) {
      if (!tree.planted) continue;
      tree.rot = (tree.rot || 0) + dt;
      if (tree.rot > seasonLength(sim) * 2) gone.push(tree);
      continue;
    }
    rememberGrove(sim, tree);
    if (tree.planted && tree.group === 'plant') tree.growth = Math.min(1, (tree.growth || 0) + dt * 0.012);
    else if (tree.planted) tree.growth = growWood(tree.growth, dt, tree.group === 'shrub', tree.sick);
    tree.age = (tree.age || 0) + dt;
    const form = treeForm(tree.kind);
    const full = (form?.h || 2.4) * (tree.size || 1);
    const span = statureOf(tree.planted ? tree.growth : 2.4);
    tree.drop = (cell?.elevation || 0.8) + Math.max(0.4, full * 0.22 * Math.min(span, 2.6));
    if (tree.group === 'plant' && cell) cell.moisture = Math.min(1, (cell.moisture || 0) + dt * 0.08);
    if (tree.planted) rootTree(sim, tree);
    tendLife(sim, tree);
  }
  updateBeaver(sim, dt);
  if (gone.length) {
    for (const tree of gone) {
      const cell = sim.cells[tree.k * GRID + tree.i];
      if (cell) {
        cell.log = false;
        cell.tree = false;
        cell.compost = 1;
        cell.moisture = 1;
        raiseLand(sim, cell, 0.04);
      }
    }
    sim.trees = sim.trees.filter(tree => !gone.includes(tree));
    sim.events.push({ type: 'rot', text: 'The trunk becomes the floor.' });
  }
  const mature = sim.trees.filter(tree => tree.planted && tree.group !== 'plant' && tree.growth > 0.62).length;
  sim.shed += dt * (1 + mature * 0.5);
  const compostAfter = seasonLength(sim) * 2;
  for (let n = sim.loose.length - 1; n >= 0; n--) {
    const stick = sim.loose[n];
    if (stick.fall) {
      stick.vy -= 13 * dt;
      stick.y += stick.vy * dt;
      stick.yaw += dt * 7;
      const glide = Math.min(1, dt * 1.6);
      stick.x += (stick.landX - stick.x) * glide;
      stick.z += (stick.landZ - stick.z) * glide;
      const cell = cellAt(sim.cells, stick.x, stick.z);
      const floor = cell ? cell.elevation + (cell.plot ? 0.22 : 0.04) : 0.8;
      if (stick.y > floor) continue;
      stick.y = floor;
      stick.x = stick.landX;
      stick.z = stick.landZ;
      stick.fall = false;
      continue;
    }
    stick.age = (stick.age || 0) + dt;
    const wood = woodOf(stick.kind);
    if (wood.slide > 0.6) {
      const hit = sim.snapshot?.sample?.(stick.x, stick.z);
      if (hit && hit.depth > 0.05) {
        stick.x += (hit.velocity?.[0] || 0) * dt * 0.75;
        stick.z += (hit.velocity?.[1] || 0) * dt * 0.75;
      }
    }
    if (stick.age > compostAfter) {
      compostStick(sim, stick);
      sim.loose.splice(n, 1);
    }
  }
  if (!sim.away && sim.shed > 6.5) {
    sim.shed = 0;
    shedTree(sim);
  }

  if (sim.away) return;

  const st = sim.character.st;
  const moving = Math.hypot(st.vx, st.vz) > 0.35;
  const shake = wornMeasures(sim).shake || 0.2;
  const inSeason = wornMeasures(sim).home === seasonOf(sim).id;
  const shakes = 1 + Math.round(shake * (inSeason ? 2 : 0.5));
  if (moving) {
    for (const tree of sim.trees) {
      if (tree.group === 'plant' || tree.cooldown > 0) continue;
      if (tree.planted && tree.growth < 0.5) continue;
      if (Math.hypot(tree.x - st.x, tree.z - st.z) > 0.78) continue;
      tree.cooldown = Math.max(0.45, 1.35 - wornMeasures(sim).shake);
      let dropped = 0;
      const gift = tree.planted && tree.growth > 0.65 ? shakes + 1 : shakes;
      for (let n = 0; n < gift; n++) {
        const i = tree.i + (n % 2);
        const k = tree.k - (n % 3 === 0 ? 1 : 0);
        if (dropFrom(sim, { ...tree, kind: woodKind(tree) }, i, k)) dropped += 1;
      }
      if (dropped) sim.events.push({ type: 'shake', text: 'Sticks fall.' });
    }
  }

  if (!sim.carrying && !sim.held) takeLoose(sim);

  if (!sim.placeQueued) return;
  placeStick(sim);
}

function placeStick(sim) {
  sim.placeQueued = false;
  if (sim.held) return;
  if (!sim.carrying) {
    sim.events.push({ type: 'note', text: 'Your hands are empty.' });
    return;
  }
  const cell = facedCell(sim);
  if (!cell) {
    sim.events.push({ type: 'note', text: 'The cube ends.' });
    return;
  }
  if (cell.hearth) {
    sim.events.push({ type: 'note', text: 'The idol is there.' });
    return;
  }
  if (cell.plot) {
    sim.events.push({ type: 'note', text: 'That is a bed.' });
    return;
  }
  const kind = sim.carryKind || 'maple';
  const wood = woodOf(kind);
  if (cell.log) {
    sim.events.push({ type: 'note', text: 'A trunk lies there.' });
    return;
  }
  if (cell.rock) {
    sim.events.push({ type: 'note', text: 'The stone is set.' });
    return;
  }
  if (cell.berm) {
    if ((cell.lift || 0) >= liftCap(sim.year)) {
      sim.events.push({ type: 'note', text: 'The mound is tall.' });
      return;
    }
    cell.lift = (cell.lift || 0) + 1;
    cell.lastWood = wood.label;
    sim.carrying = false;
    sim.carryKind = null;
    sim.bedDirty = true;
    sim.events.push({ type: 'place', text: 'You raise the mound. It is good.' });
    return;
  }
  if (cell.tree) {
    sim.events.push({ type: 'note', text: 'A tree stands there.' });
    return;
  }
  if (cell.layers >= 5 && wood.sticks < 2) {
    sim.events.push({ type: 'note', text: 'The stack is full.' });
    return;
  }
  addWood(cell, kind);
  sim.carrying = false;
  sim.carryKind = null;
  sim.bedDirty = true;
  if (wood.root && (cell.channel || cell.moisture > 0.28 || (sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0) > 0.03)) {
    cell.layers = Math.max(cell.layers, 2);
    beginMound(sim, cell, 'tend', 'The alder roots. It is good.');
    return;
  }
  if (wood.bridge) knitWillow(sim, cell);
  if (wood.slide > 0.6 && slideBirch(sim, cell)) return;
  if (cell.layers >= 3) {
    beginMound(sim, cell, 'tend');
    return;
  }
  const placed = cell.layers <= 1
    ? `You set down ${stickPhrase(wood.label)}.`
    : `The mound is ${cell.layers} sticks. It is good.`;
  sim.events.push({ type: wood.label, text: placed });
}

function tendMouth(sim, cell, kind) {
  let finger = null;
  let dist = 2.6;
  for (const item of sim.live || []) {
    const near = Math.min(
      Math.hypot(cell.i - item.gate[0], cell.k - item.gate[1]),
      Math.hypot(cell.i - item.mouth[0], cell.k - item.mouth[1])
    );
    if (near < dist) {
      dist = near;
      finger = item;
    }
  }
  if (!finger) return '';
  const gate = sim.cells[finger.gate[1] * GRID + finger.gate[0]];
  const line = kind === 'alder' ? 'The alder roots at the mouth.' : 'The willow knits the mouth.';
  if (!gate || gate.hearth || gate.plot || gate.tree) {
    cell.rooted = true;
    sim.bedDirty = true;
    return line;
  }
  gate.lastWood = kind;
  gate.moisture = 1;
  if (kind === 'alder') gate.rooted = true;
  if (gate.berm) gate.lift = (gate.lift || 0) + 1;
  else if ((gate.layers || 0) < 2) {
    gate.layers = 2;
    gate.woods = [kind, kind];
  }
  sim.bedDirty = true;
  beginMound(sim, gate, 'tend', line);
  return line;
}

export function sowWood(sim, cell, kind = 'alder') {
  const wood = kind === 'willow' || kind === 'oak' ? kind : 'alder';
  if (!cell || cell.hearth || cell.tree || cell.plot || cell.berm || cell.log) return false;
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  if (dist <= PAD) return false;
  if (wood === 'oak' && dist < 3.5) return false;
  const prev = sim.sow;
  sim.sow = { id: wood };
  const planted = plantAt(sim, cell);
  if (!planted) sim.sow = prev;
  return planted;
}

export function plantAt(sim, cell) {
  const sow = sim.sow;
  if (!sow || !cell) return false;
  const spec = floraById(sow.id);
  if (!spec) return false;
  if (spec.group === 'crop') {
    const ready = cell.berm && cell.marks?.tend && cell.marks?.leaf && cell.marks?.snow && cell.marks?.rain;
    if (!ready) {
      sim.events.push({ type: 'sow', text: 'The mound is not ready.' });
      return false;
    }
    cell.fruit = spec.id;
    cell.fruitGrowth = 0.2;
    sim.sow = null;
    sim.events.push({ type: 'plant', text: `You plant ${phrase(spec.name)}.` });
    return true;
  }
  if (cell.hearth || cell.tree || cell.plot || cell.berm || cell.log) {
    sim.events.push({ type: 'sow', text: 'The ground is taken.' });
    return false;
  }
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  if (spec.group === 'tree' && dist < PAD) {
    sim.events.push({ type: 'sow', text: 'The circle stays open.' });
    return false;
  }
  cell.tree = true;
  const form = treeForm(spec.id);
  sim.trees.push({
    i: cell.i,
    k: cell.k,
    x: cell.x,
    z: cell.z,
    kind: spec.id,
    size: spec.group === 'crop' ? 1 : treeScale(hash(cell.i * 19 + cell.k * 7 + (sim.year || 1))),
    drop: cell.elevation + 0.45,
    cooldown: 1.6,
    planted: true,
    growth: spec.group === 'tree' ? 0.12 : 0.35,
    group: spec.group,
    seed: 1 + Math.floor(hash(sim.time * 1000 + cell.i * 17 + cell.k) * 900),
    rooted: false
  });
  if (spec.group === 'plant') cell.moisture = Math.min(1, (cell.moisture || 0) + 0.35);
  const mouth = spec.id === 'alder' || spec.id === 'willow' ? tendMouth(sim, cell, spec.id) : '';
  sim.sow = null;
  sim.events.push({ type: 'plant', text: mouth || `You plant ${phrase(spec.name)}.` });
  if (form?.h) sim.trees[sim.trees.length - 1].drop = cell.elevation + form.h * (sim.trees[sim.trees.length - 1].size || 1) * 0.15;
  return true;
}

export function stackCount(sim) {
  return sim.cells.reduce((sum, cell) => sum + cell.layers + (cell.lift || 0), 0);
}
