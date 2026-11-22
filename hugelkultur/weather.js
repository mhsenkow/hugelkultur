import { GRID, ORIGIN, hash, cellAt, walkHeight, bedHeight } from './world.js?v=hold';
import { nightAmount } from './day.js?v=hold';
import { seasonOf } from './water.js?v=hold';
import { beginMound } from './growth.js?v=hold';
import { OPEN_CROWN } from './clearing.js?v=hold';
import { paintLeaf, paintFlake } from './gardens.js?v=hold';

const RAIN = { width: 0.018, color: 12, density: 1.6, emissive: false, depth: true };
const STAIN = { width: 0.08, color: 11, density: 2.2, emissive: false, depth: true };
const SHAFT = { width: 0.035, color: 6, density: 1.15, emissive: true, depth: true };

const KIND = { SPR: 'rain', AUT: 'leaf', WIN: 'snow' };

function liveGate(sim) {
  return sim.live?.find(item => item.bit === seasonOf(sim).bit) || null;
}

function wallPinch(sim, cell) {
  let built = 0;
  let open = 0;
  for (const [di, dk] of STEP) {
    const next = sim.cells[(cell.k + dk) * GRID + (cell.i + di)];
    if (!next) continue;
    if ((next.cubes || 0) > 0 || next.berm || (next.layers || 0) >= 3) built += 1;
    else open += 1;
  }
  return built >= 2 && open <= 1;
}

function cling(bit) {
  const min = ORIGIN + 0.35;
  const max = ORIGIN + GRID - 0.35;
  bit.x = Math.max(min, Math.min(max, bit.x));
  bit.z = Math.max(min, Math.min(max, bit.z));
}

const MELT = { SPR: 0.028, SUM: 0.16, AUT: 0.01, WIN: 0 };
const SNOW_CAP = 1.2;
const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function near(cell, di, dk) {
  const i = cell.i + di;
  const k = cell.k + dk;
  if (i < 0 || k < 0 || i >= GRID || k >= GRID) return -1;
  return k * GRID + i;
}

function snowRoom(sim, cell) {
  if (cell.hearth) return 0;
  if (!sim.hearth) return SNOW_CAP;
  const dist = Math.hypot(cell.i - sim.hearth.i, cell.k - sim.hearth.k);
  return dist < 2.15 ? 0.1 : SNOW_CAP;
}

// Winter lays a quilt, deeper on the west, and walks it downhill.
function driftSnow(sim, dt) {
  if (seasonOf(sim).id !== 'WIN' || !sim.hearth) return 0;
  let moved = 0;
  for (const cell of sim.cells) {
    if (cell.roofed) continue;
    const room = snowRoom(sim, cell);
    if (room <= 0) continue;
    const dist = Math.hypot(cell.i - sim.hearth.i, cell.k - sim.hearth.k);
    const west = 1 - cell.i / Math.max(1, GRID - 1);
    const gain = dt * 0.0026 * (0.28 + west) * (dist < 2.15 ? 0.2 : 1);
    const before = qty(cell.snow);
    const add = Math.min(Math.max(0, room - before), gain);
    cell.snow = before + add;
    moved += add;
  }
  const send = new Float32Array(sim.cells.length);
  const into = new Int32Array(sim.cells.length);
  into.fill(-1);
  for (let index = 0; index < sim.cells.length; index++) {
    const cell = sim.cells[index];
    if (!cell || cell.hearth || qty(cell.snow) < 0.12) continue;
    let best = -1;
    let bestScore = 0.06;
    const here = bedHeight(cell);
    for (const [di, dk] of STEP) {
      const nextIndex = near(cell, di, dk);
      if (nextIndex < 0) continue;
      const next = sim.cells[nextIndex];
      if (!next || next.hearth) continue;
      const drop = here - bedHeight(next);
      const wind = di * 0.14;
      const score = drop + wind;
      if (score > bestScore) {
        bestScore = score;
        best = nextIndex;
      }
    }
    if (best < 0) continue;
    const flow = Math.min(qty(cell.snow) * 0.28, dt * 0.055);
    if (flow <= 0) continue;
    send[index] = flow;
    into[index] = best;
  }
  for (let index = 0; index < sim.cells.length; index++) {
    if (!send[index]) continue;
    const cell = sim.cells[index];
    const next = sim.cells[into[index]];
    const flow = Math.min(qty(cell.snow), send[index]);
    cell.snow = qty(cell.snow) - flow;
    const room = snowRoom(sim, next);
    next.snow = Math.min(room, qty(next.snow) + flow);
    moved += flow;
  }
  return moved;
}

// A shallow quilt soaks in. A deep drift lasts, and only the water the soil cannot hold runs off.
function meltSnow(sim, dt) {
  const pace = MELT[seasonOf(sim).id] || 0;
  let moved = 0;
  for (const cell of sim.cells) {
    cell.thaw = 0;
    cell.snow = qty(cell.snow);
    if (pace <= 0 || !(cell.snow > 0)) continue;
    const lost = Math.min(cell.snow, dt * pace / (1 + cell.snow * 1.15));
    if (!Number.isFinite(lost) || lost <= 0) continue;
    cell.snow -= lost;
    moved += lost;
    if (cell.hearth || lost <= 0) continue;
    const room = Math.max(0, 0.85 - (cell.moisture || 0));
    const intoSoil = Math.min(lost * 0.75, room);
    cell.moisture = Math.min(1, (cell.moisture || 0) + intoSoil);
    const leftover = lost - intoSoil;
    if (!(leftover > 0)) continue;
    const dist = sim.hearth ? Math.hypot(cell.i - sim.hearth.i, cell.k - sim.hearth.k) : 9;
    if (dist < 2.35) continue;
    const shed = leftover * (0.16 / (1 + cell.snow));
    const thaw = shed / Math.max(dt, 1e-4);
    cell.thaw = Number.isFinite(thaw) ? Math.min(0.02, Math.max(0, thaw)) : 0;
  }
  return moved;
}

function settleBit(sim, bit) {
  cling(bit);
  const cell = cellAt(sim.cells, bit.x, bit.z);
  if (!cell || cell.hearth) return;
  if (bit.kind === 'leaf') cell.litter = Math.min(1, (cell.litter || 0) + 0.18);
  else if (bit.kind === 'snow') {
    const room = snowRoom(sim, cell);
    cell.snow = Math.min(room, qty(cell.snow) + (room < 0.2 ? 0.004 : 0.008));
  }
  else cell.moisture = Math.min(1, (cell.moisture || 0) + 0.06);
}

function qty(n) {
  const value = Number(n);
  return Number.isFinite(value) ? value : 0;
}

export function updateWeather(sim, dt) {
  if (sim.over) return;
  const kind = KIND[seasonOf(sim).id] || null;
  if (!Array.isArray(sim.fall)) sim.fall = [];
  if (sim.weatherSeason !== sim.seasonIndex) {
    sim.weatherSeason = sim.seasonIndex;
    for (const cell of sim.cells) cell.soak = 0;
    for (const bit of sim.fall) settleBit(sim, bit);
    sim.fall.length = 0;
    sim.fallAcc = 0;
    sim.bedDirty = true;
    sim.snowShift = 0;
  }
  for (let n = sim.fall.length - 1; n >= 0; n--) {
    if (sim.fall[n].kind === kind) continue;
    settleBit(sim, sim.fall[n]);
    sim.fall.splice(n, 1);
  }
  if (kind) {
    const gust = sim.seasonTime < 5 ? 2.4 : 1;
    const rate = (kind === 'rain' ? 26 : kind === 'leaf' ? 11 : 16) * gust;
    sim.fallAcc = Math.min(64, qty(sim.fallAcc) + qty(dt) * rate);
    let hops = 0;
    while (sim.fallAcc >= 1 && sim.fall.length < 64 && hops < 64) {
      sim.fallAcc -= 1;
      hops += 1;
      const i = Math.min(GRID - 1, Math.floor(hash(sim.time * 1000 + sim.fall.length * 17) * GRID));
      const k = Math.min(GRID - 1, Math.floor(hash(sim.time * 1300 + sim.fall.length * 29) * GRID));
      const cell = sim.cells[k * GRID + i];
      if (!cell) continue;
      sim.fall.push({
        kind,
        x: cell.x + (hash(sim.fall.length * 3 + 1) - 0.5) * 0.8,
        z: cell.z + (hash(sim.fall.length * 5 + 2) - 0.5) * 0.8,
        y: 4.2 + hash(sim.fall.length * 9) * 2.4,
        vy: kind === 'rain' ? 7.5 : kind === 'snow' ? 0.48 : 1.35,
        spin: hash(sim.fall.length * 13) * Math.PI,
        drift: (hash(sim.fall.length * 11) - 0.5) * (kind === 'leaf' ? 0.35 : 0.12),
        raft: false,
        age: 0
      });
    }
  } else sim.fallAcc = 0;

  const fadeLeaf = kind === 'leaf' ? 0 : dt * 0.08;
  const snowMoved = driftSnow(sim, dt) + meltSnow(sim, dt);
  sim.snowShift = (sim.snowShift || 0) + snowMoved;
  if (!sim.snowBed) {
    sim.snowBed = true;
    if (sim.cells.some(cell => (cell.snow || 0) > 0.2)) sim.bedDirty = true;
  }
  if (sim.snowShift > 1.6) {
    sim.bedDirty = true;
    sim.snowShift = 0;
  }
  for (const cell of sim.cells) {
    if (fadeLeaf) cell.litter = Math.max(0, (cell.litter || 0) - fadeLeaf);
    if (!kind || cell.hearth || cell.plot) continue;
    if (cell.parched && kind === 'snow') continue;
    if (cell.roofed) continue;
    if (cell.layers >= 2 || cell.berm) cell.soak = (cell.soak || 0) + dt;
    const waited = cell.berm ? 8 : 12;
    if ((cell.soak || 0) < waited) continue;
    if (cell.berm && cell.marks?.[kind]) continue;
    if (!cell.berm && cell.layers < 2) continue;
    beginMound(sim, cell, kind);
    cell.soak = 0;
  }

  const gate = liveGate(sim);
  for (let n = sim.fall.length - 1; n >= 0; n--) {
    const bit = sim.fall[n];
    bit.age = (bit.age || 0) + dt;
    if (bit.age > (bit.raft ? 4.5 : 8)) {
      settleBit(sim, bit);
      sim.fall.splice(n, 1);
      continue;
    }
    const hit = sim.snapshot?.sample?.(bit.x, bit.z);
    const onWater = bit.kind === 'leaf' && hit && hit.depth > 0.03 && bit.y < (hit.level || 0) + 0.7;
    if (onWater) {
      bit.raft = true;
      bit.y = (hit.level || bit.y) + 0.04;
      bit.vy = 0;
      const [vx, vz] = hit.velocity || [0, 0];
      bit.x += vx * dt * 0.45 + bit.drift * dt * 0.08;
      bit.z += vz * dt * 0.45;
      for (const other of sim.fall) {
        if (other === bit || !other.raft) continue;
        const gap = Math.hypot(other.x - bit.x, other.z - bit.z);
        if (gap >= 0.9 || gap < 0.12) continue;
        const pull = dt * 0.22;
        bit.x += ((other.x - bit.x) / gap) * pull;
        bit.z += ((other.z - bit.z) / gap) * pull;
      }
      cling(bit);
      const cell = cellAt(sim.cells, bit.x, bit.z);
      const narrowRace = cell?.race && wallPinch(sim, cell);
      if (cell && ((gate && Math.hypot(cell.i - gate.gate[0], cell.k - gate.gate[1]) < 1.85) || narrowRace)) {
        cell.raft = Math.min(2.2, (cell.raft || 0) + 0.5);
        cell.litter = Math.min(1, (cell.litter || 0) + 0.25);
        cell.soak = (cell.soak || 0) + 5;
        sim.bedDirty = true;
        sim.fall.splice(n, 1);
        if ((cell.layers || 0) >= 2 || cell.berm) beginMound(sim, cell, 'leaf');
      }
      continue;
    }
    bit.raft = false;
    bit.y -= bit.vy * dt;
    bit.spin += dt * (bit.kind === 'leaf' ? 2.2 : bit.kind === 'snow' ? 0.6 : 1);
    bit.x += bit.drift * dt * (bit.kind === 'leaf' ? 0.65 : bit.kind === 'snow' ? 0.2 : 0.35);
    bit.z += Math.sin(bit.spin) * dt * (bit.kind === 'snow' ? 0.16 : 0.08);
    cling(bit);
    const cell = cellAt(sim.cells, bit.x, bit.z);
    if (!cell) {
      sim.fall.splice(n, 1);
      continue;
    }
    const ground = walkHeight(cell) + 0.05;
    if (bit.y > ground) continue;
    bit.y = ground;
    settleBit(sim, bit);
    sim.fall.splice(n, 1);
  }
}

export function drawMemory(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if ((cell.stain || 0) < 0.18 || n >= 28) continue;
    n += 1;
    const y = cell.elevation + 0.03;
    const span = 0.12 + cell.stain * 0.16;
    draw.streak([cell.x - span, y, cell.z - span * 0.3], [cell.x + span * 0.4, y + 0.02, cell.z + span], { ...STAIN, width: 0.05 + cell.stain * 0.04 });
  }
}

export function drawShafts(draw, sim) {
  if (seasonOf(sim).id !== 'SUM') return;
  if (nightAmount(sim.time) > 0.45) return;
  for (const tree of sim.trees) {
    if (!OPEN_CROWN.has(tree.kind)) continue;
    if (tree.planted && (tree.growth || 0) < 0.45) continue;
    const cell = sim.cells[tree.k * GRID + tree.i];
    if (!cell) continue;
    const crown = tree.drop || cell.elevation + 1.5;
    const top = Math.max(cell.elevation + 0.7, crown - 0.12);
    const foot = Math.max(cell.elevation + 0.28, top - 0.62);
    draw.streak([tree.x, foot, tree.z], [tree.x + 0.02, top, tree.z + 0.015], SHAFT);
  }
}

function drawGlade(draw, sim) {
  if (GRID < 32 || !sim.glade?.gaps?.length) return;
  if (nightAmount(sim.time) > 0.45) return;
  const light = { width: 0.28, color: 4, density: 0.65, emissive: true, depth: true };
  const count = Math.min(6, sim.glade.gaps.length);
  for (let i = 0; i < count; i++) {
    const gap = sim.glade.gaps[i];
    draw.streak([gap[0], 0.95, gap[2]], [gap[0] + 0.12, 2.05, gap[2] + 0.06], light);
  }
}

function drawSnowField(draw, sim) {
  if (seasonOf(sim).id !== 'WIN' || !sim.hearth) return;
  const step = GRID >= 64 ? 3 : GRID >= 32 ? 2 : 1;
  const cap = GRID >= 64 ? 90 : GRID >= 32 ? 64 : 48;
  let drawn = 0;
  for (let k = 0; k < GRID && drawn < cap; k += step) {
    for (let i = 0; i < GRID && drawn < cap; i += step) {
      if (hash(i * 13 + k * 29 + 5) < 0.28) continue;
      const cell = sim.cells[k * GRID + i];
      if (!cell || cell.channel || cell.hearth || cell.clearing || cell.plot) continue;
      const dist = Math.hypot(cell.i - sim.hearth.i, cell.k - sim.hearth.k);
      if (dist < 2.2) continue;
      drawn += 1;
      const y = walkHeight(cell) + 0.04;
      const jx = (hash(i * 3 + k) - 0.5) * 0.36;
      const jz = (hash(i + k * 17) - 0.5) * 0.36;
      paintFlake(draw, cell.x + jx, y, cell.z + jz, 0.04 + hash(i * 9 + k) * 0.025);
    }
  }
}

export function drawWeather(draw, sim) {
  const min = ORIGIN;
  const max = ORIGIN + GRID;
  for (const bit of sim.fall) {
    if (bit.x < min || bit.x > max || bit.z < min || bit.z > max) continue;
    if (bit.kind === 'rain') {
      draw.streak([bit.x, bit.y, bit.z], [bit.x + bit.drift * 0.02, bit.y - 0.34, bit.z], RAIN);
      continue;
    }
    if (bit.kind === 'snow') {
      paintFlake(draw, bit.x, bit.y, bit.z, 0.04);
      continue;
    }
    paintLeaf(draw, bit.x, bit.y, bit.z, bit.spin || 0);
  }
  drawSnowField(draw, sim);
  drawGlade(draw, sim);
  for (const cell of sim.cells) {
    const y = walkHeight(cell) + 0.035;
    if ((cell.litter || 0) > 0.32) {
      const count = cell.litter > 0.68 ? 3 : 2;
      for (let n = 0; n < count; n++) {
        const yaw = hash(cell.i * 17 + cell.k * 5 + n * 3) * Math.PI;
        const ox = (hash(cell.i * 9 + n * 13) - 0.5) * 0.3;
        const oz = (hash(cell.k * 11 + n * 7) - 0.5) * 0.3;
        paintLeaf(draw, cell.x + ox, y, cell.z + oz, yaw);
      }
    }
    const depth = cell.snow || 0;
    if (depth > 0.08) {
      const count = depth > 0.85 ? 4 : depth > 0.4 ? 3 : 2;
      const lift = Math.min(depth, 1) * 0.03;
      const radius = 0.026 + Math.min(depth, 1) * 0.016;
      for (let n = 0; n < count; n++) {
        const ox = (hash(cell.i * 5 + cell.k + n * 9) - 0.5) * 0.34;
        const oz = (hash(cell.k * 3 + n * 4) - 0.5) * 0.34;
        paintFlake(draw, cell.x + ox, y + lift, cell.z + oz, radius);
      }
    }
  }
  drawShafts(draw, sim);
}
