import { floraById } from './species.js?v=fifty';
import { wornMeasures, seasonFit } from './clearing.js?v=fifty';

const SEASON_ID = ['SPR', 'SUM', 'AUT', 'WIN'];

const HUMUS = 11;
const LUSH = 8;
const STICK = 10;
const EMBER = 14;

// Raised lines on dry ground beside the clearing. 1x2 and 1x3, above the banks.
const BEDS = [
  { crop: 'carrot', cells: [[10, 7], [11, 7]], start: [0.42, 0.16] },
  { crop: 'turnip', cells: [[5, 8], [5, 9], [5, 10]], start: [0.7, 0.34, 0.12] },
  { crop: 'mushroom', cells: [[8, 5], [9, 5]], start: [1, 0.48] }
];

const LOAM = { width: 0.2, color: HUMUS, density: 2.5, emissive: false, depth: true };
const TILTH = { width: 0.18, color: 4, density: 2.4, emissive: false, depth: true };
const LEAF = { width: 0.045, color: LUSH, density: 2.2, emissive: false, depth: true };
const ROOT = { width: 0.05, color: STICK, density: 2.3, emissive: false, depth: true };
const BULB = { width: 0.07, color: 6, density: 2.4, emissive: false, depth: true };
const CAP = { width: 0.07, color: EMBER, density: 2.4, emissive: false, depth: true };
const STEM = { width: 0.035, color: 4, density: 2.2, emissive: false, depth: true };

const GROW = 1 / 14;

export function layGardens(cells, beds = BEDS) {
  const span = Math.round(Math.sqrt(cells.length));
  const plots = [];
  for (const bed of beds) {
    const row = [];
    bed.cells.forEach(([i, k], index) => {
      const cell = cells[k * span + i];
      if (!cell) return;
      const plot = {
        id: `${i},${k}`,
        i, k,
        x: cell.x,
        z: cell.z,
        crop: bed.crop,
        growth: bed.start[index] ?? 0.2,
        cell
      };
      cell.plot = plot;
      row.push(plot);
      plots.push(plot);
    });
    if (!row.length) continue;
    row.bed = bed;
    for (const plot of row) plot.row = row;
  }
  return plots;
}

export function updateGardens(sim, dt, playerDriving) {
  if (sim.over) return;
  for (const plot of sim.plots) {
    if (plot.growth < 1) plot.growth = Math.min(1, plot.growth + dt * GROW);
  }
  if (sim.haste > 0) {
    sim.haste -= dt;
    if (sim.haste <= 0) {
      sim.haste = 0;
      sim.pace = 1;
      sim.events.push({ type: 'note', text: 'You are slow.' });
    }
  }
  if (sim.eatQueued) {
    sim.eatQueued = false;
    if (sim.held) {
      const kind = floraById(sim.held);
      const name = (kind?.name || 'bite').replace(/^Meadow /, '').toLowerCase();
      sim.motions.push({ kind: 'eat', crop: sim.held, t: 0, dur: 0.9 });
      sim.seen.add('eat');
      sim.pace = Math.max(sim.pace, kind?.pace || 1.4);
      sim.haste = Math.min(16, Math.max(sim.haste, 0) + (kind?.lasts || 8));
      let text = `You eat the ${name}. You are quick.`;
      if (sim.held === 'mushroom' && coatGround(sim)) text = 'You eat the meadow mushroom. It coats the ground.';
      if (sim.held === 'carrot') {
        sim.ford = sim.time + (kind?.lasts || 9);
        text = 'You eat the carrot. You can cross the gate.';
      }
      sim.events.push({ type: 'eat', text });
      const hearth = sim.hearth;
      const body = sim.character?.st;
      if (hearth && body && Math.hypot(body.x - hearth.x, body.z - hearth.z) <= 2.55) {
        sim.husks = sim.husks || [];
        const n = sim.husks.length + 1;
        sim.husks.push({
          x: hearth.x + (((n * 17) % 10) / 10 - 0.5) * 0.42,
          z: hearth.z + (((n * 29) % 10) / 10 - 0.5) * 0.42
        });
        if (sim.husks.length > 12) sim.husks.splice(0, sim.husks.length - 12);
      }
      sim.held = null;
    }
  }
  if (sim.away || sim.carrying || sim.held) return;
  const st = sim.character?.st;
  if (!st) return;
  const row = wornMeasures(sim);
  const eager = playerDriving
    || sim.guide?.goal?.kind === 'eat'
    || row.eat * seasonFit(row.home, SEASON_ID[sim.seasonIndex] || 'SPR') > 0.85;
  if (!eager) return;
  for (const plot of sim.plots) {
    if (plot.growth < 1) continue;
    if (Math.hypot(plot.x - st.x, plot.z - st.z) > 0.55) continue;
    takeFood(sim, plot.crop, plot.x, plot.cell.elevation + 0.28, plot.z);
    plot.growth = 0;
    break;
  }
  if (sim.held) return;
  for (const cell of sim.cells) {
    if (!cell.fruit || cell.fruitGrowth < 1) continue;
    if (Math.hypot(cell.x - st.x, cell.z - st.z) > 0.55) continue;
    takeFood(sim, cell.fruit, cell.x, cell.elevation + 0.4, cell.z);
    cell.fruitGrowth = 0.05;
    break;
  }
}

function coatGround(sim) {
  const st = sim.character?.st;
  if (!st) return false;
  let best = sim.gazeCell && (sim.gazeCell.berm || sim.gazeCell.cubes) ? sim.gazeCell : null;
  if (!best) {
    let dist = 1e9;
    for (const cell of sim.cells || []) {
      if (!cell.berm && !(cell.cubes > 0)) continue;
      const d = Math.hypot(cell.x - st.x, cell.z - st.z);
      if (d < dist) {
        dist = d;
        best = cell;
      }
    }
  }
  if (!best) return false;
  if (best.berm) best.coat = (best.coat || 0) + 1;
  else {
    if (!Array.isArray(best.block) || !best.block.length) best.block = Array.from({ length: best.cubes || 1 }, () => 0.74);
    best.block[best.block.length - 1] += 0.08;
  }
  sim.bedDirty = true;
  return true;
}

function takeFood(sim, crop, x, y, z) {
  const kind = floraById(crop);
  sim.held = crop;
  sim.seen.add('pick');
  sim.seen.add('carry');
  sim.motions.push({ kind: 'pick', crop, x, y, z, t: 0, dur: 0.48 });
  sim.events.push({ type: 'take', text: `You pick up a ${(kind?.name || 'crop').replace(/^Meadow /, '').toLowerCase()}.` });
}

export function drawGardens(draw, sim) {
  const drawn = new Set();
  for (const plot of sim.plots) {
    if (drawn.has(plot.row)) continue;
    drawn.add(plot.row);
    drawBed(draw, plot.row);
  }
  for (const plot of sim.plots) drawCrop(draw, plot);
}

function drawBed(draw, row) {
  const a = row[0];
  const b = row[row.length - 1];
  const y = a.cell.elevation + 0.02;
  const alongI = Math.abs(b.x - a.x) > Math.abs(b.z - a.z);
  const pad = 0.42;
  for (const side of [-0.28, -0.14, 0, 0.14, 0.28]) {
    const ox = alongI ? 0 : side;
    const oz = alongI ? side : 0;
    const x0 = a.x + (alongI ? -pad : ox);
    const z0 = a.z + (alongI ? oz : -pad);
    const x1 = b.x + (alongI ? pad : ox);
    const z1 = b.z + (alongI ? oz : pad);
    draw.streak([x0, y + 0.05, z0], [x1, y + 0.05, z1], LOAM);
    draw.streak([x0, y + 0.16, z0], [x1, y + 0.16, z1], TILTH);
  }
}

function drawCrop(draw, plot) {
  paintCrop(draw, plot.crop, plot.x, plot.cell.elevation + 0.24, plot.z, plot.growth);
}

function ink(color, width, density = 2.2) {
  return { width, color, density, emissive: false, depth: true };
}

function paintPlain(draw, crop, x, y, z, growth) {
  const h = 0.06 + growth * 0.34;
  if (crop === 'carrot') {
    draw.streak([x, y, z], [x + 0.03, y + h, z], { ...ROOT, width: 0.07 });
    draw.streak([x - 0.1, y + h, z], [x + 0.11, y + h + 0.08, z + 0.03], { ...LEAF, width: 0.06 });
    draw.streak([x, y + h, z - 0.08], [x + 0.04, y + h + 0.07, z + 0.09], { ...LEAF, width: 0.05 });
    return;
  }
  if (crop === 'turnip') {
    const bulb = 0.07 + growth * 0.08;
    draw.streak([x - bulb, y + 0.05, z], [x + bulb, y + 0.12, z], { ...BULB, width: 0.1 });
    draw.streak([x, y + 0.05, z - bulb], [x, y + 0.12, z + bulb], { ...BULB, width: 0.1 });
    draw.streak([x - 0.1, y + 0.14, z], [x + 0.12, y + h, z + 0.02], { ...LEAF, width: 0.06 });
    return;
  }
  draw.streak([x, y, z], [x + 0.01, y + h * 0.6, z], { ...STEM, width: 0.05 });
  const cap = 0.08 + growth * 0.1;
  draw.streak([x - cap, y + h * 0.62, z], [x + cap, y + h * 0.74, z], { ...CAP, width: 0.09 });
  draw.streak([x, y + h * 0.66, z - cap * 0.75], [x, y + h * 0.78, z + cap * 0.75], { ...CAP, width: 0.09 });
}

function paintBed(draw, crop, x, y, z, g) {
  draw.streak([x - 0.08, y + 0.012, z], [x + 0.08, y + 0.02, z + 0.02], ink(HUMUS, 0.04));
  if (crop === 'carrot') {
    const top = y + 0.05 + g * 0.14;
    draw.streak([x, top, z], [x + 0.015, y + 0.012, z], ink(STICK, 0.055 + g * 0.02));
    draw.streak([x - 0.02, top - 0.03, z + 0.02], [x + 0.01, y + 0.02, z], ink(STICK, 0.04));
    draw.streak([x, top, z], [x - 0.09 * (0.45 + g), top + 0.06 + g * 0.04, z - 0.02], ink(LUSH, 0.045));
    draw.streak([x, top, z], [x + 0.08 * (0.45 + g), top + 0.07 + g * 0.04, z + 0.03], ink(9, 0.04));
    draw.streak([x, top + 0.01, z], [x + 0.02, top + 0.08 + g * 0.05, z - 0.05], ink(15, 0.035));
    return;
  }
  if (crop === 'turnip') {
    const bulb = 0.055 + g * 0.07;
    draw.streak([x - bulb, y + 0.045, z], [x + bulb, y + 0.09, z], ink(6, 0.09));
    draw.streak([x, y + 0.04, z - bulb * 0.7], [x, y + 0.095, z + bulb * 0.7], ink(4, 0.08));
    const crown = y + 0.095;
    draw.streak([x, crown, z], [x - 0.09, crown + 0.045 + g * 0.05, z + 0.02], ink(LUSH, 0.045));
    draw.streak([x, crown, z], [x + 0.1, crown + 0.04 + g * 0.055, z - 0.015], ink(9, 0.04));
    return;
  }
  const stem = 0.045 + g * 0.07;
  const cap = 0.07 + g * 0.09;
  const cy = y + stem;
  draw.streak([x, y + 0.012, z], [x + 0.008, cy, z], ink(6, 0.042));
  draw.streak([x - cap, cy, z], [x, cy + 0.045 + g * 0.03, z + 0.01], ink(13, 0.07));
  draw.streak([x, cy + 0.045 + g * 0.03, z + 0.01], [x + cap, cy + 0.004, z + 0.02], ink(13, 0.07));
  draw.streak([x - cap * 0.5, cy + 0.012, z - 0.02], [x + cap * 0.55, cy + 0.018, z + 0.035], ink(EMBER, 0.042));
  draw.streak([x - 0.025, cy + 0.04, z], [x + 0.02, cy + 0.046, z + 0.015], ink(6, 0.028));
}

// The cube plants Bed. Plain stays in the library so the two can be compared.
export function paintCrop(draw, crop, x, y, z, growth, take = 'bed') {
  const g = Math.max(0, Math.min(1, Number(growth) || 0));
  if (take === 'plain') paintPlain(draw, crop, x, y, z, g);
  else paintBed(draw, crop, x, y, z, g);
}

export function paintLeaf(draw, x, y, z, yaw = 0.4) {
  const len = 0.085;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  draw.streak([x - c * len, y, z - s * len], [x + c * len, y + 0.02, z + s * len], ink(13, 0.05, 2.1));
  draw.streak(
    [x - s * len * 0.4, y + 0.008, z + c * len * 0.4],
    [x + s * len * 0.4, y + 0.016, z - c * len * 0.4],
    ink(STICK, 0.032, 2)
  );
}

export function paintFlake(draw, x, y, z, r = 0.045) {
  const puff = (ox, oy, oz, width, density) => {
    const px = x + ox;
    const py = y + oy;
    const pz = z + oz;
    draw.streak([px, py, pz], [px, py, pz], ink(6, width, density));
  };
  puff(0, 0, 0, 0.06, 1.55);
  puff(r * 0.42, 0.006, -r * 0.18, Math.max(0.034, r * 0.9), 1.2);
  puff(-r * 0.3, 0.01, r * 0.24, Math.max(0.026, r * 0.62), 1.1);
}

export function paintLeafStudy(draw, take) {
  const spots = [[0.04, 0.1, 0.4], [-0.22, 0.08, 1.2], [0.18, -0.14, 2.3], [-0.08, -0.2, 0.8]];
  for (const [x, z, yaw] of spots) paintLeaf(draw, x, 0.06, z, yaw);
  if (take === 'drift') {
    paintLeaf(draw, 0.1, 1.2, 0.04, 0.3);
    paintLeaf(draw, 1.02, 0.7, -0.58, 1.1);
  }
}

export function paintSnowStudy(draw, take) {
  if (take === 'spike') {
    draw.streak([-0.65, 0.1, -0.15], [0.75, 0.16, 0.3], { width: 0.42, color: 6, density: 1.15, emissive: false, depth: true });
    draw.streak([0.05, 0.85, 0.02], [0.18, 1.2, 0.08], ink(6, 0.05, 2));
    return;
  }
  const spots = [[0, 0.08, 0.05], [-0.22, 0.07, -0.08], [0.2, 0.09, 0.12], [-0.08, 0.1, 0.22], [0.12, 0.06, -0.2]];
  for (const [x, y, z] of spots) paintFlake(draw, x, y, z, 0.05);
}
