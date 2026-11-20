import { drawGardens } from './gardens.js';
import { drawMotions } from './motions.js';
import { drawWeather } from './weather.js';
import { beginMound } from './growth.js';
import { INK, GRID, cellAt, hash } from './world.js';
import { floraName } from './species.js';
import { facedCell } from './avatar.js';

const PAINT = { width: 0.062, color: INK.stick, density: 2.2, emissive: false, depth: true };
const CAPACITY = 2800;

function spawn(sim, i, k, yaw) {
  if (sim.loose.length >= 36) return false;
  i = Math.max(0, Math.min(GRID - 1, i));
  k = Math.max(0, Math.min(GRID - 1, k));
  const cell = sim.cells[k * GRID + i];
  const n = sim.loose.length + 1;
  sim.loose.push({
    x: cell.x + (hash(n * 11 + i * 3) - 0.5) * 0.36,
    z: cell.z + (hash(n * 19 + k * 5) - 0.5) * 0.36,
    yaw: yaw ?? hash(n * 23 + i + k) * Math.PI,
    fall: false
  });
  return true;
}

function dropFrom(sim, tree, i, k) {
  if (!tree || sim.loose.length >= 36) return false;
  i = Math.max(0, Math.min(GRID - 1, i));
  k = Math.max(0, Math.min(GRID - 1, k));
  const cell = sim.cells[k * GRID + i];
  const n = sim.loose.length + 3;
  sim.loose.push({
    x: tree.x,
    z: tree.z,
    y: tree.drop,
    vy: 0.4,
    yaw: hash(n * 23 + i + k) * Math.PI,
    landX: cell.x + (hash(n * 11 + i) - 0.5) * 0.28,
    landZ: cell.z + (hash(n * 19 + k) - 0.5) * 0.28,
    fall: true
  });
  return true;
}

function surfaceY(sim, x, z, floor) {
  const hit = sim.snapshot?.sample?.(x, z);
  if (hit && hit.depth > 0.03) return Math.max(floor, hit.level + 0.02);
  return floor + 0.035;
}

export function createStickSystem(B, KIT, sim) {
  return KIT.frameSplats(B, CAPACITY, draw => {
    drawSticks(draw, sim);
    if (sim.drawGrowth) sim.drawGrowth(draw);
    drawGardens(draw, sim);
    drawWeather(draw, sim);
    drawMotions(draw, sim);
  });
}

function drawStick(draw, ax, ay, az, bx, by, bz) {
  draw.streak([ax, ay, az], [bx, by, bz], PAINT);
}

function drawSticks(draw, sim) {
  for (const stick of sim.loose) drawLoose(draw, sim, stick);
  if (sim.carrying && sim.character) {
    const st = sim.character.st;
    const y = st.y + 0.92;
    const dx = Math.cos(st.face) * 0.26;
    const dz = Math.sin(st.face) * 0.26;
    drawStick(draw, st.x - dx, y, st.z - dz, st.x + dx, y + 0.12, st.z + dz);
  }
  for (const cell of sim.cells) {
    for (let layer = 0; layer < cell.layers; layer++) {
      const alongX = layer % 2 === 0;
      const sink = cell.settle ? (1 - cell.settle / 1.25) * 0.16 : 0;
      const y = cell.elevation + 0.05 + layer * 0.08 - sink;
      const slide = (hash(cell.i * 31 + cell.k * 17 + layer) - 0.5) * 0.08;
      const half = 0.36;
      const gap = 0.09;
      if (alongX) {
        drawStick(draw, cell.x - half, y, cell.z + slide + gap, cell.x + half, y, cell.z - slide + gap);
        drawStick(draw, cell.x - half, y + 0.012, cell.z + slide - gap, cell.x + half, y + 0.012, cell.z - slide - gap);
      } else {
        drawStick(draw, cell.x + slide + gap, y, cell.z - half, cell.x - slide + gap, y + 0.01, cell.z + half);
        drawStick(draw, cell.x + slide - gap, y + 0.012, cell.z - half, cell.x - slide - gap, y + 0.02, cell.z + half);
      }
    }
  }
}

function drawLoose(draw, sim, stick) {
  const cell = cellAt(sim.cells, stick.x, stick.z);
  const floor = cell ? Math.max(cell.elevation, cell.plot ? cell.elevation + 0.2 : 0) : 0.8;
  const y = stick.fall ? stick.y : surfaceY(sim, stick.x, stick.z, floor);
  const dx = Math.cos(stick.yaw) * 0.28;
  const dz = Math.sin(stick.yaw) * 0.28;
  const tilt = stick.fall ? Math.sin(stick.yaw * 2) * 0.2 : 0.015;
  drawStick(draw, stick.x - dx, y - tilt, stick.z - dz, stick.x + dx, y + tilt, stick.z + dz);
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

export function updateSticks(sim, dt) {
  if (sim.over) return;
  for (const tree of sim.trees) tree.cooldown = Math.max(0, tree.cooldown - dt);
  sim.shed += dt;
  for (const stick of sim.loose) {
    if (!stick.fall) continue;
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
  }
  if (sim.shed > 6.5) {
    sim.shed = 0;
    const tree = sim.trees[Math.floor(hash(sim.time * 1000 + 4) * sim.trees.length)];
    const i = tree.i + Math.floor(hash(sim.year * 9 + sim.seasonTime) * 3) - 1;
    const k = tree.k + Math.floor(hash(sim.seasonTime * 13 + 2) * 3) - 1;
    if (dropFrom(sim, tree, i, k)) sim.events.push({ type: 'shed', text: `A stick falls from the ${floraName(tree.kind).toLowerCase()}.` });
  }

  const st = sim.character.st;
  const moving = Math.hypot(st.vx, st.vz) > 0.35;
  if (moving) {
    for (const tree of sim.trees) {
      if (tree.cooldown > 0) continue;
      if (Math.hypot(tree.x - st.x, tree.z - st.z) > 0.78) continue;
      tree.cooldown = 1.35;
      const dropped = dropFrom(sim, tree, tree.i, tree.k - 1) | dropFrom(sim, tree, tree.i + 1, tree.k);
      if (dropped) sim.events.push({ type: 'shake', text: 'The crown shakes, and sticks fall.' });
    }
  }

  if (!sim.carrying && !sim.held) {
    const index = nearestLoose(sim);
    if (index !== null) {
      sim.loose.splice(index, 1);
      sim.carrying = true;
      sim.events.push({ type: 'take', text: 'You pick up a stick.' });
    }
  }

  if (!sim.placeQueued) return;
  sim.placeQueued = false;
  if (sim.held) return;
  if (!sim.carrying) {
    sim.events.push({ type: 'note', text: 'Your hands are empty.' });
    return;
  }
  const cell = facedCell(sim);
  if (!cell) {
    sim.events.push({ type: 'note', text: 'The cube ends there.' });
    return;
  }
  if (cell.hearth) {
    sim.events.push({ type: 'note', text: 'The idol stands there.' });
    return;
  }
  if (cell.berm) {
    sim.events.push({ type: 'note', text: 'That ground has already grown over.' });
    return;
  }
  if (cell.plot) {
    sim.events.push({ type: 'note', text: 'That bed is for the garden.' });
    return;
  }
  if (cell.layers >= 5) {
    sim.events.push({ type: 'note', text: 'That stack will not take another stick.' });
    return;
  }
  cell.layers += 1;
  sim.carrying = false;
  sim.bedDirty = true;
  if (cell.layers >= 3) {
    beginMound(sim, cell, 'tend');
    return;
  }
  const placed = cell.layers === 1
    ? 'The first stick of a stack.'
    : `The stack is ${cell.layers} sticks deep.`;
  sim.events.push({ type: 'place', text: placed });
}

export function stackCount(sim) {
  return sim.cells.reduce((sum, cell) => sum + cell.layers, 0);
}
