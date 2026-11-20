import { GRID, ORIGIN, hash } from './world.js';
import { seasonOf } from './water.js';
import { beginMound } from './growth.js';

const LEAF = { width: 0.055, color: 13, density: 2.1, emissive: false, depth: true };
const SNOW = { width: 0.04, color: 6, density: 2, emissive: false, depth: true };
const RAIN = { width: 0.018, color: 12, density: 1.6, emissive: false, depth: true };
const LITTER = { width: 0.05, color: 10, density: 2, emissive: false, depth: true };
const DRIFT = { width: 0.045, color: 6, density: 2, emissive: false, depth: true };

const KIND = { SPR: 'rain', AUT: 'leaf', WIN: 'snow' };

export function updateWeather(sim, dt) {
  if (sim.over) return;
  const kind = KIND[seasonOf(sim).id] || null;
  if (sim.weatherSeason !== sim.seasonIndex) {
    sim.weatherSeason = sim.seasonIndex;
    for (const cell of sim.cells) cell.soak = 0;
  }
  if (kind) {
    const gust = sim.seasonTime < 5 ? 2.4 : 1;
    const rate = (kind === 'rain' ? 26 : kind === 'leaf' ? 11 : 8) * gust;
    sim.fallAcc += dt * rate;
    while (sim.fallAcc >= 1 && sim.fall.length < 56) {
      sim.fallAcc -= 1;
      const i = Math.floor(hash(sim.time * 1000 + sim.fall.length * 17) * GRID);
      const k = Math.floor(hash(sim.time * 1300 + sim.fall.length * 29) * GRID);
      const cell = sim.cells[k * GRID + i];
      sim.fall.push({
        kind,
        x: cell.x + (hash(sim.fall.length * 3 + 1) - 0.5) * 0.8,
        z: cell.z + (hash(sim.fall.length * 5 + 2) - 0.5) * 0.8,
        y: 4.2 + hash(sim.fall.length * 9) * 2.4,
        vy: kind === 'rain' ? 7.5 : kind === 'snow' ? 0.85 : 1.35,
        spin: hash(sim.fall.length * 13) * Math.PI,
        drift: (hash(sim.fall.length * 11) - 0.5) * (kind === 'leaf' ? 0.8 : 0.25)
      });
    }
  } else sim.fallAcc = 0;

  const fadeLeaf = kind === 'leaf' ? 0 : dt * 0.08;
  const fadeSnow = kind === 'snow' ? 0 : dt * 0.05;
  for (const cell of sim.cells) {
    if (fadeLeaf) cell.litter = Math.max(0, (cell.litter || 0) - fadeLeaf);
    if (fadeSnow) cell.snow = Math.max(0, (cell.snow || 0) - fadeSnow);
    if (!kind || cell.hearth || cell.plot) continue;
    if (cell.layers >= 2) cell.soak = (cell.soak || 0) + dt;
    else if (cell.berm) cell.soak = (cell.soak || 0) + dt;
    const waited = cell.berm ? 8 : 12;
    if ((cell.soak || 0) < waited) continue;
    if (cell.berm && cell.marks?.[kind]) continue;
    if (!cell.berm && cell.layers < 2) continue;
    beginMound(sim, cell, kind);
    cell.soak = 0;
  }

  for (let n = sim.fall.length - 1; n >= 0; n--) {
    const bit = sim.fall[n];
    bit.y -= bit.vy * dt;
    bit.spin += dt * (bit.kind === 'leaf' ? 4 : 1);
    bit.x += bit.drift * dt;
    bit.z += Math.sin(bit.spin) * dt * 0.15;
    const i = Math.max(0, Math.min(GRID - 1, Math.floor(bit.x - ORIGIN)));
    const k = Math.max(0, Math.min(GRID - 1, Math.floor(bit.z - ORIGIN)));
    const cell = sim.cells[k * GRID + i];
    if (bit.y > cell.elevation + 0.08) continue;
    if (bit.kind === 'leaf') cell.litter = Math.min(1, (cell.litter || 0) + 0.22);
    if (bit.kind === 'snow') cell.snow = Math.min(1, (cell.snow || 0) + 0.18);
    if (bit.kind === 'rain') cell.moisture = Math.min(1, cell.moisture + 0.08);
    sim.fall.splice(n, 1);
  }
}

export function drawWeather(draw, sim) {
  for (const bit of sim.fall) {
    if (bit.kind === 'rain') {
      draw.streak([bit.x, bit.y, bit.z], [bit.x + bit.drift * 0.02, bit.y - 0.34, bit.z], RAIN);
      continue;
    }
    const tilt = Math.sin(bit.spin) * (bit.kind === 'leaf' ? 0.14 : 0.05);
    const paint = bit.kind === 'snow' ? SNOW : { ...LEAF, width: 0.08 };
    const span = bit.kind === 'leaf' ? 0.11 : 0.05;
    draw.streak([bit.x - span, bit.y - tilt, bit.z], [bit.x + span, bit.y + tilt, bit.z + 0.03], paint);
  }
  for (const cell of sim.cells) {
    const y = cell.elevation + 0.05;
    if (cell.litter > 0.35) {
      draw.streak([cell.x - 0.16, y, cell.z - 0.04], [cell.x + 0.06, y + 0.03, cell.z + 0.08], LITTER);
      if (cell.litter > 0.62) {
        draw.streak([cell.x - 0.02, y + 0.02, cell.z + 0.1], [cell.x + 0.16, y + 0.04, cell.z - 0.02], { ...LITTER, color: 13 });
      }
    }
    if (cell.snow > 0.3) {
      draw.streak([cell.x - 0.2, y + 0.01, cell.z - 0.06], [cell.x + 0.18, y + 0.04, cell.z + 0.08], DRIFT);
      if (cell.snow > 0.6) {
        draw.streak([cell.x - 0.08, y + 0.04, cell.z], [cell.x + 0.1, y + 0.07, cell.z + 0.04], { ...DRIFT, width: 0.06 });
      }
    }
  }
}
