import { INK, hash } from './world.js';

const MOSS = { width: 0.045, color: INK.lush, density: 2, emissive: false, depth: true };
const DEEP = { width: 0.04, color: INK.deep, density: 2, emissive: false, depth: true };
const FUNGI = { width: 0.035, color: INK.ember, density: 2.3, emissive: true, depth: true };
const LITTER = { width: 0.05, color: INK.stick, density: 2.1, emissive: false, depth: true };
const DRIFT = { width: 0.06, color: 6, density: 2.1, emissive: false, depth: true };

const CAUSE = {
  tend: 'It is a mound. It is good.',
  leaf: 'Leaves make the mound. It is good.',
  snow: 'Snow makes the mound. It is good.',
  rain: 'Rain makes the mound. It is good.'
};

const RICHER = {
  leaf: 'The mound takes the leaves. It is good.',
  snow: 'The mound takes the snow. It is good.',
  rain: 'The mound takes the rain. It is good.',
  tend: 'You turn the mound. It is good.'
};

export function beginMound(sim, cell, cause) {
  if (cell.hearth || cell.plot || cell.tree) return;
  cell.marks = cell.marks || { tend: false, leaf: false, snow: false, rain: false };
  if (cell.berm) {
    if (cell.marks[cause]) return;
    cell.marks[cause] = true;
    cell.coat = (cell.coat || 1) + 1;
    sim.bedDirty = true;
    sim.seen.add('mound');
    sim.events.push({ type: 'berm', text: RICHER[cause] });
    return;
  }
  if (cell.layers < 2 && cause !== 'tend') return;
  cell.berm = true;
  cell.marks[cause] = true;
  cell.coat = 1;
  cell.settle = 1.25;
  cell.growth = hash(cell.i * 19 + cell.k * 7 + cell.coat);
  sim.bedDirty = true;
  sim.seen.add('mound');
  sim.motions.push({ kind: 'mound', i: cell.i, k: cell.k, t: 0, dur: 1.25 });
  sim.events.push({ type: 'berm', text: CAUSE[cause] });
}

function depthAt(sim, cell) {
  const hit = sim.snapshot?.sample?.(cell.x, cell.z);
  return hit?.depth || 0;
}

export function updateGrowth(sim, dt) {
  if (sim.over) return;
  let berms = 0;
  for (const cell of sim.cells) {
    const depth = depthAt(sim, cell);
    if (depth > 0.045) cell.moisture = Math.min(1, cell.moisture + dt * 0.24);
    else cell.moisture = Math.max(0, cell.moisture - dt * 0.04);
    if (cell.settle > 0) {
      cell.settle -= dt;
      if (cell.settle <= 0) {
        cell.settle = 0;
        cell.layers = 0;
      }
    }
    if (cell.berm) berms += 1;
  }
  sim.berms = berms;
}

export function drawGrowth(draw, sim) {
  for (const cell of sim.cells) {
    if (cell.berm) drawBerm(draw, cell);
    else if (cell.moisture > 0.55 && !cell.hearth && !cell.plot && cell.layers === 0) drawLush(draw, cell);
  }
}

const SOIL = { width: 0.2, color: INK.humus, density: 2.6, emissive: false, depth: true };
const CAP = { width: 0.18, color: INK.lush, density: 2.4, emissive: false, depth: true };

function drawBerm(draw, cell) {
  const rise = cell.settle ? Math.max(0, 1 - cell.settle / 1.25) : 1;
  const base = cell.elevation + 0.02;
  const bulk = 0.22 + Math.min(cell.coat || 1, 4) * 0.035;
  for (let row = -2; row <= 2; row++) {
    const t = row / 2;
    const z = cell.z + t * 0.3;
    const hump = bulk * (1 - t * t) * rise;
    draw.streak([cell.x - 0.34, base + 0.04, z], [cell.x + 0.34, base + hump * 0.65, z], SOIL);
    draw.streak([cell.x - 0.26, base + hump * 0.5, z], [cell.x + 0.26, base + hump, z], CAP);
  }
  const y = base + bulk * rise;
  const marks = cell.marks || {};
  if (marks.leaf) {
    draw.streak([cell.x - 0.16, y, cell.z - 0.04], [cell.x + 0.08, y + 0.04, cell.z + 0.06], LITTER);
    draw.streak([cell.x - 0.02, y + 0.02, cell.z + 0.08], [cell.x + 0.16, y + 0.05, cell.z - 0.02], LITTER);
  }
  if (marks.snow) draw.streak([cell.x - 0.2, y + 0.02, cell.z], [cell.x + 0.2, y + 0.06, cell.z + 0.02], DRIFT);
  if (marks.rain) draw.streak([cell.x - 0.12, y - 0.02, cell.z - 0.08], [cell.x + 0.1, y + 0.04, cell.z + 0.08], MOSS);
  if (marks.tend && rise > 0.8) {
    if (cell.growth < 0.5) {
      const top = y + 0.26;
      draw.streak([cell.x, y, cell.z], [cell.x + 0.03, top, cell.z], { ...DEEP, width: 0.03 });
      draw.streak([cell.x - 0.1, top - 0.02, cell.z], [cell.x + 0.12, top + 0.05, cell.z + 0.03], MOSS);
    } else {
      draw.streak([cell.x - 0.02, y, cell.z], [cell.x + 0.14, y + 0.06, cell.z + 0.03], FUNGI);
      draw.streak([cell.x + 0.04, y - 0.02, cell.z - 0.08], [cell.x + 0.16, y + 0.02, cell.z + 0.02], FUNGI);
    }
  }
}

function drawLush(draw, cell) {
  const y = cell.elevation + 0.04;
  const j = (hash(cell.i * 3 + cell.k) - 0.5) * 0.2;
  draw.streak([cell.x - 0.08 + j, y, cell.z], [cell.x + 0.08, y + 0.03, cell.z + 0.06], MOSS);
}
