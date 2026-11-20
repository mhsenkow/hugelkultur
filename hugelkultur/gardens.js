import { floraById } from './species.js';

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

export function layGardens(cells) {
  const plots = [];
  for (const bed of BEDS) {
    const row = [];
    bed.cells.forEach(([i, k], index) => {
      const cell = cells[k * 16 + i];
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
      sim.motions.push({ kind: 'eat', crop: sim.held, t: 0, dur: 0.42 });
      sim.seen.add('eat');
      sim.pace = Math.max(sim.pace, kind?.pace || 1.4);
      sim.haste = Math.min(16, Math.max(sim.haste, 0) + (kind?.lasts || 8));
      sim.events.push({ type: 'eat', text: `You eat the ${(kind?.name || 'bite').replace(/^Meadow /, '').toLowerCase()}. You are quick.` });
      sim.held = null;
    }
  }
  if (!playerDriving || sim.carrying || sim.held) return;
  const st = sim.character?.st;
  if (!st) return;
  for (const plot of sim.plots) {
    if (plot.growth < 1) continue;
    if (Math.hypot(plot.x - st.x, plot.z - st.z) > 0.55) continue;
    const kind = floraById(plot.crop);
    plot.growth = 0;
    sim.held = plot.crop;
    sim.seen.add('pick');
    sim.seen.add('carry');
    sim.motions.push({
      kind: 'pick',
      crop: plot.crop,
      x: plot.x,
      y: plot.cell.elevation + 0.28,
      z: plot.z,
      t: 0,
      dur: 0.48
    });
    sim.events.push({ type: 'take', text: `You pick up a ${(kind?.name || 'crop').replace(/^Meadow /, '').toLowerCase()}.` });
    break;
  }
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

export function paintCrop(draw, crop, x, y, z, growth) {
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
