import { GRID, HEARTH_I, HEARTH_K, cellAt, hash, walkHeight } from './world.js?v=fifty';
import { SPIRITS, spiritById } from './avatars.js?v=fifty';

// A day is long enough to watch the work. Night is long enough to see them rest.
// Sleep puts the worn body back on open ground, so a tower or a closed corner ends at dawn.
export const DAY = 64;

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ORDER = ['fire', 'water', 'tree', 'moss', 'mushroom', 'snow', 'cloud'];
const REST_AS = {
  cloud: 'weather',
  water: 'water',
  tree: 'wood',
  mushroom: 'a cap',
  moss: 'moss',
  fire: 'embers',
  snow: 'snow'
};
const SELF = { she: 'herself', he: 'himself', it: 'itself' };

function smooth(p, a, b) {
  if (p <= a) return 0;
  if (p >= b) return 1;
  const t = (p - a) / (b - a);
  return t * t * (3 - 2 * t);
}

export function dayPhase(time) {
  const t = ((Number(time) || 0) % DAY + DAY) % DAY;
  return t / DAY;
}

export function dayIndex(time) {
  return Math.floor(Math.max(0, Number(time) || 0) / DAY);
}

// The forest opens in daylight. Dusk, night, and dawn are the last part of each day.
export function dayPart(time) {
  const p = dayPhase(time);
  if (p < 0.7) return 'day';
  if (p < 0.8) return 'dusk';
  if (p < 0.94) return 'night';
  return 'dawn';
}

export function nightAmount(time) {
  const p = dayPhase(time);
  if (p < 0.7) return 0;
  if (p < 0.8) return smooth(p, 0.7, 0.8);
  if (p < 0.94) return 1;
  return 1 - smooth(p, 0.94, 1);
}

function voice(sim) {
  return spiritById(sim.spiritId || 'cloud').voice || { sub: 'she' };
}

function cap(sim) {
  const word = voice(sim).sub || 'she';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function sayRest(sim, kind) {
  if (!kind || sim.restSaid === kind) return;
  sim.restSaid = kind;
  const who = cap(sim);
  const element = REST_AS[sim.spiritId] || 'itself';
  const self = SELF[voice(sim).sub] || 'themselves';
  const text = kind === 'dusk' ? `Dusk. ${who} goes home.`
    : kind === 'nap' ? `The way is closed. ${who} goes home.`
    : kind === 'home' ? `${who} is home.`
    : kind === 'dawn' ? `Morning. ${who} is ${self} again.`
    : `Night. ${who} rests as ${element}.`;
  sim.events?.push({ type: 'note', text });
}

function safeStand(cell) {
  if (!cell || cell.hearth || cell.plot || cell.rock || cell.log || cell.tree) return false;
  if ((cell.layers || 0) >= 3) return false;
  if (cell.berm && (cell.lift || 0) > 0) return false;
  return walkHeight(cell) - cell.elevation < 0.5;
}

function elementScore(sim, id, cell) {
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  const wet = (sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0) > 0.03 || cell.channel || (cell.moisture || 0) > 0.35;
  let nearTree = false;
  for (const tree of sim.trees || []) {
    if (tree.group === 'plant' || tree.fallen) continue;
    if (Math.hypot(tree.x - cell.x, tree.z - cell.z) < 1.7) nearTree = true;
  }
  let score = (hash(cell.i * 19 + cell.k * 23 + (ORDER.indexOf(id) + 3) * 29) - 0.5) * 0.2;
  if (id === 'fire') score += 4.2 - Math.abs(dist - 1.05) * 3.2;
  else if (id === 'water') score += (wet ? 4.4 : 0) + (cell.channel ? 0.8 : 0) - Math.abs(dist - 4.2) * 0.18;
  else if (id === 'tree') score += (nearTree ? 3.6 : 0) - Math.abs(dist - 5) * 0.12;
  else if (id === 'mushroom') score += (nearTree ? 2.2 : 0) + ((cell.litter || 0) > 0.2 ? 1.3 : 0) + (wet ? 0.5 : 0) - Math.abs(dist - 4.6) * 0.1;
  else if (id === 'moss') score += ((cell.moisture || 0) > 0.2 || wet ? 1.6 : 0) + (dist > 2.1 && dist < 5.2 ? 2.1 : 0);
  else if (id === 'snow') score += (cell.i < HEARTH_I ? 1.3 : 0) + ((cell.snow || 0) > 0.2 ? 2.2 : 0) - Math.abs(dist - 5.2) * 0.08;
  else score += (nearTree ? -0.8 : 1.5) + (dist > 2.3 && dist < 6.2 ? 2 : 0) - (cell.layers || 0) * 0.35;
  return score;
}

function pickBed(sim, id, taken) {
  let best = null;
  let score = -1e9;
  let fallback = null;
  let fallbackRise = 1e9;
  for (const cell of sim.cells || []) {
    if (!cell || cell.hearth) continue;
    const key = cell.i + cell.k * GRID;
    if (taken?.has(key)) continue;
    const rise = walkHeight(cell) - cell.elevation;
    if (rise < fallbackRise) {
      fallbackRise = rise;
      fallback = cell;
    }
    if (!safeStand(cell)) continue;
    const value = elementScore(sim, id, cell);
    if (value > score) {
      score = value;
      best = cell;
    }
  }
  return best || fallback;
}

export function layBeds(sim) {
  const taken = new Set();
  const beds = {};
  const seen = new Set(ORDER);
  for (const form of SPIRITS) seen.add(form.id);
  for (const id of [...ORDER, ...seen]) {
    if (beds[id]) continue;
    const cell = pickBed(sim, id, taken);
    if (!cell) continue;
    beds[id] = cell;
    taken.add(cell.i + cell.k * GRID);
  }
  sim.restBeds = beds;
  sim.bed = beds[sim.spiritId] || beds.cloud || null;
  return sim.bed;
}

function dropCarry(sim) {
  if (!sim.carrying) return;
  const bed = sim.bed;
  const st = sim.character?.st;
  if (Array.isArray(sim.loose) && (bed || st)) {
    sim.loose.push({
      x: bed?.x ?? st.x,
      z: bed?.z ?? st.z,
      yaw: st?.face || 0,
      kind: sim.carryKind || 'maple',
      age: 0,
      fall: false
    });
  }
  sim.carrying = false;
  sim.carryKind = null;
  sim.placeQueued = false;
}

function fallAsleep(sim, kind) {
  if (!sim.restBeds) layBeds(sim);
  sim.bed = sim.restBeds?.[sim.spiritId] || sim.bed || pickBed(sim, sim.spiritId || 'cloud', new Set());
  dropCarry(sim);
  const st = sim.character.st;
  const bed = sim.bed;
  const y = bed ? walkHeight(bed) : st.y;
  const close = Boolean(bed)
    && Math.hypot(st.x - bed.x, st.z - bed.z) < 0.85
    && Math.abs((st.y ?? y) - y) < 0.55;
  if (bed) {
    st.x = bed.x;
    st.z = bed.z;
    st.y = y;
    st.gh = y;
  }
  st.vx = st.vy = st.vz = 0;
  st.ground = true;
  st.climb = false;
  st.dead = close ? Math.max(0, st.dead || 0) : 1.2;
  sim.resting = 'sleep';
  sim.asleep = true;
  sim.placeQueued = false;
  sim.still = 0;
  if (sim.guide) {
    sim.guide.goal = null;
    sim.guide.stuck = 0;
    sim.guide.bestDist = Infinity;
  }
  sayRest(sim, kind);
}

function holdSleep(sim) {
  const st = sim.character.st;
  st.vx = st.vy = st.vz = 0;
  if ((st.dead ?? -1) < 0) st.dead = 1.2;
  if (st.dead > 1.5) st.dead = 1.2;
  sim.asleep = true;
  sim.resting = 'sleep';
}

function wakeAt(sim) {
  if (!sim.restBeds) layBeds(sim);
  sim.bed = sim.restBeds?.[sim.spiritId] || sim.bed;
  const st = sim.character.st;
  const bed = sim.bed;
  if (bed) {
    const y = walkHeight(bed);
    st.x = bed.x;
    st.z = bed.z;
    st.y = y;
    st.gh = y;
  }
  st.vx = st.vy = st.vz = 0;
  st.ground = true;
  st.climb = false;
  st.dead = -1;
  st.born = 0;
  st.ph = 0;
  sim.asleep = false;
  sim.still = 0;
  sim.markX = st.x;
  sim.markZ = st.z;
  if (Array.isArray(sim.motions)) {
    sim.motions.push({
      kind: 'wake',
      t: 0,
      dur: 1.05,
      id: sim.spiritId || 'cloud',
      x: st.x,
      y: st.y,
      z: st.z
    });
  }
}

function pocketWalk(sim) {
  const here = cellAt(sim.cells, sim.character.st.x, sim.character.st.z);
  if (!here) return [];
  const seen = new Uint8Array(sim.cells.length);
  const queue = [here.k * GRID + here.i];
  seen[queue[0]] = 1;
  const cells = [];
  for (let head = 0; head < queue.length && cells.length < 8; head++) {
    const cell = sim.cells[queue[head]];
    cells.push(cell);
    for (const [di, dk] of STEP) {
      const i = cell.i + di;
      const k = cell.k + dk;
      if (i < 0 || k < 0 || i >= GRID || k >= GRID) continue;
      const index = k * GRID + i;
      if (seen[index]) continue;
      const next = sim.cells[index];
      if (Math.abs(walkHeight(cell) - walkHeight(next)) > 0.45) continue;
      seen[index] = 1;
      queue.push(index);
    }
  }
  return cells;
}

function pocket(sim) {
  return pocketWalk(sim).length;
}

function restScale(sim) {
  if (!sim.fast) return 1;
  return Math.min(8, Math.max(4, sim.speed || 8));
}

function bodyTrapped(sim) {
  const st = sim.character?.st;
  if (!st || !sim.cells) return false;
  const here = cellAt(sim.cells, st.x, st.z);
  if (here && walkHeight(here) - here.elevation > 0.65) return true;
  return pocket(sim) < 5;
}

function watchCorner(sim, dt) {
  if (!sim.cells || !sim.character?.st) return;
  const scale = restScale(sim);
  const st = sim.character.st;
  const moved = Math.hypot(st.x - (sim.markX ?? st.x), st.z - (sim.markZ ?? st.z));
  if (moved > 0.2) {
    sim.markX = st.x;
    sim.markZ = st.z;
    sim.still = 0;
    return;
  }
  const here = cellAt(sim.cells, st.x, st.z);
  const high = Boolean(here) && walkHeight(here) - here.elevation > 0.65;
  const goal = sim.guide?.goal;
  const trying = Boolean(goal && goal.kind !== 'look' && goal.kind !== 'rest');
  if (!high && !trying) {
    sim.still = 0;
    sim.pocketStill = (sim.pocketStill || 0) + dt;
    const waited = 6 * scale;
    if (sim.pocketStill < waited || pocket(sim) >= 5) {
      if (sim.pocketStill > waited) sim.pocketStill = waited;
      return;
    }
    fallAsleep(sim, 'nap');
    sim.pocketMark = pocketWalk(sim);
    sim.pocketUntil = (sim.time || 0) + 2.4;
    sim.napUntil = (sim.time || 0) + 8;
    return;
  }
  sim.pocketStill = 0;
  sim.still = (sim.still || 0) + dt;
  const waited = (high ? 3.5 : 6) * scale;
  if (sim.still < waited) return;
  fallAsleep(sim, 'nap');
  sim.pocketMark = pocketWalk(sim);
  sim.pocketUntil = (sim.time || 0) + 2.4;
  sim.napUntil = (sim.time || 0) + 8;
}

function threatened(sim) {
  const hearth = sim.hearth;
  if (!hearth || !sim.cells || !sim.snapshot?.sample) return false;
  if ((sim.snapshot.sample(hearth.x, hearth.z)?.depth || 0) > 0.008) return true;
  const hi = hearth.i ?? HEARTH_I;
  const hk = hearth.k ?? HEARTH_K;
  for (const cell of sim.cells) {
    if (!cell || cell.hearth) continue;
    const dist = Math.hypot(cell.i - hi, cell.k - hk);
    if (dist <= 1.85 || dist > 6.8) continue;
    if (cell.berm || (cell.layers || 0) >= 3 || (cell.cubes || 0) > 0) continue;
    if ((sim.snapshot.sample(cell.x, cell.z)?.depth || 0) > 0.035) return true;
  }
  return false;
}

export function updateDay(sim, dt, driving) {
  if (!sim?.character?.st || sim.over) return;
  const part = dayPart(sim.time || 0);

  if (driving) {
    sim.still = 0;
    if (sim.resting === 'sleep' || sim.asleep) wakeAt(sim);
    if (part !== 'day' || sim.resting) sim.upLate = dayIndex(sim.time || 0);
    sim.resting = null;
    sim.asleep = false;
    sim.napUntil = 0;
    return;
  }

  if (part === 'dawn') {
    if (sim.resting === 'sleep' || sim.asleep || sim.resting === 'home') {
      wakeAt(sim);
      sim.resting = 'wake';
      sim.napUntil = 0;
      sayRest(sim, 'dawn');
    } else if (sim.resting !== 'wake') sim.resting = 'wake';
    return;
  }

  if (sim.resting === 'sleep' && sim.napUntil && (sim.time || 0) < sim.napUntil && part === 'day') {
    holdSleep(sim);
    return;
  }
  if (sim.resting === 'sleep' && sim.napUntil && (sim.time || 0) >= sim.napUntil && part === 'day') {
    wakeAt(sim);
    sim.resting = null;
    sim.napUntil = 0;
    sayRest(sim, 'home');
    return;
  }

  // A free body stays up and works the water. A body that cannot move goes home.
  if (threatened(sim) && !bodyTrapped(sim)) {
    watchCorner(sim, dt);
    if (sim.resting === 'sleep') {
      holdSleep(sim);
      return;
    }
    if (sim.asleep) wakeAt(sim);
    sim.resting = null;
    sim.asleep = false;
    return;
  }

  const up = sim.upLate === dayIndex(sim.time || 0);
  if (up && (part === 'dusk' || part === 'night')) {
    if (sim.resting === 'sleep') holdSleep(sim);
    else watchCorner(sim, dt);
    return;
  }

  if (part === 'dusk') {
    if (sim.resting === 'sleep') {
      sim.napUntil = 0;
      holdSleep(sim);
      return;
    }
    if (sim.resting !== 'home') {
      layBeds(sim);
      sim.resting = 'home';
      sim.asleep = false;
      if (sim.guide) {
        sim.guide.goal = null;
        sim.guide.stuck = 0;
        sim.guide.bestDist = Infinity;
      }
      sayRest(sim, 'dusk');
    } else sim.bed = sim.restBeds?.[sim.spiritId] || sim.bed;
    const st = sim.character.st;
    const bed = sim.bed;
    const y = bed ? walkHeight(bed) : st.y;
    const close = bed
      && Math.hypot(st.x - bed.x, st.z - bed.z) < 0.85
      && Math.abs((st.y ?? y) - y) < 0.55;
    if (close) fallAsleep(sim, 'night');
    return;
  }

  if (part === 'night') {
    sim.napUntil = 0;
    if (sim.resting !== 'sleep') fallAsleep(sim, 'night');
    else {
      holdSleep(sim);
      if (sim.restSaid === 'nap') sayRest(sim, 'night');
    }
    return;
  }

  if (sim.resting === 'wake') {
    sim.resting = null;
    sim.still = 0;
    sim.markX = sim.character.st.x;
    sim.markZ = sim.character.st.z;
    return;
  }
  if (sim.resting === 'sleep' || sim.resting === 'home' || sim.asleep) {
    wakeAt(sim);
    sim.resting = null;
    sim.napUntil = 0;
    sayRest(sim, 'dawn');
    return;
  }
  watchCorner(sim, dt);
}

function ink(color, width, emissive = false) {
  return { width, color, density: emissive ? 0.7 : 1.5, emissive, depth: true };
}

function restY(sim, cell) {
  const water = sim.snapshot?.sample?.(cell.x, cell.z);
  if (water && water.depth > 0.03) return Math.max(cell.elevation + 0.04, (water.level || cell.elevation) + 0.03);
  return cell.elevation + 0.05;
}

function drawForm(draw, sim, id, cell, amount, time) {
  const x = cell.x;
  const z = cell.z;
  const y = restY(sim, cell);
  const breath = Math.sin(time * 0.65 + cell.i * 0.7) * 0.025 * amount;
  const w = width => width * (0.4 + 0.6 * amount);
  if (id === 'cloud') {
    const h = cell.elevation + 1.2 + breath;
    const puff = (ox, oy, oz, width, color) => {
      draw.streak([x + ox, h + oy, z + oz], [x + ox, h + oy, z + oz], ink(color, w(width), true));
    };
    puff(-0.16, 0.02, 0.02, 0.32, 6);
    puff(0.16, 0.08, -0.02, 0.26, 4);
    puff(0, 0.2, 0.04, 0.22, 6);
    puff(0.06, 0.34, 0, 0.14, 0);
    return;
  }
  if (id === 'water') {
    draw.streak([x - 0.42, y + breath, z], [x + 0.38, y + 0.03, z + 0.02], ink(12, w(0.11)));
    draw.streak([x - 0.22, y + 0.04, z - 0.12], [x + 0.24, y + 0.06, z + 0.1], ink(1, w(0.07)));
    draw.streak([x - 0.12, y + 0.07, z], [x + 0.14, y + 0.09, z + 0.02], ink(0, w(0.045)));
    return;
  }
  if (id === 'tree') {
    const top = y + 0.62 + breath;
    draw.streak([x, y, z], [x + 0.01, top, z], ink(5, w(0.07)));
    const puff = (ox, oy, oz, width, color) => {
      draw.streak([x + ox, top + oy, z + oz], [x + ox, top + oy, z + oz], ink(color, w(width)));
    };
    puff(0, 0.16, 0, 0.22, 15);
    puff(-0.12, 0.08, 0.04, 0.16, 8);
    puff(0.12, 0.1, -0.03, 0.15, 9);
    puff(0.02, 0.26, 0.02, 0.12, 9);
    return;
  }
  if (id === 'mushroom') {
    const cap = y + 0.34 + breath;
    draw.streak([x, y, z], [x, cap, z], ink(6, w(0.05)));
    draw.streak([x - 0.22, cap, z], [x + 0.22, cap + 0.04, z], ink(10, w(0.1)));
    draw.streak([x, cap + 0.02, z - 0.14], [x + 0.02, cap + 0.06, z + 0.14], ink(13, w(0.08)));
    return;
  }
  if (id === 'moss') {
    draw.streak([x - 0.38, y + breath, z - 0.06], [x + 0.34, y + 0.03, z + 0.08], ink(7, w(0.13)));
    draw.streak([x - 0.12, y + 0.03, z - 0.22], [x + 0.14, y + 0.05, z + 0.2], ink(8, w(0.09)));
    return;
  }
  if (id === 'fire') {
    const h = y + 0.28 + breath;
    draw.streak([x - 0.1, y, z], [x + 0.02, h, z + 0.01], ink(10, w(0.06), true));
    draw.streak([x, y + 0.06, z], [x + 0.04, h + 0.16, z], ink(14, w(0.05), true));
    draw.streak([x - 0.14, y + 0.02, z - 0.05], [x + 0.14, y + 0.04, z + 0.06], ink(5, w(0.05)));
    return;
  }
  draw.streak([x - 0.34, y + breath, z - 0.05], [x + 0.3, y + 0.04, z + 0.08], ink(6, w(0.12)));
  draw.streak([x - 0.12, y + 0.04, z], [x + 0.14, y + 0.07, z + 0.03], ink(0, w(0.06)));
}

function drawNightSky(draw, sim, amount) {
  const hearth = sim.hearth;
  if (!hearth) return;
  const y = (hearth.elevation || 1) + 3.2;
  const x = hearth.x - 2.1;
  const z = hearth.z - 1.2;
  draw.streak([x - 0.14, y, z], [x + 0.14, y + 0.02, z], ink(6, 0.07 * amount, true));
  for (let n = 0; n < 4; n++) {
    const sx = hearth.x + (hash(n * 11 + 4) - 0.5) * 7;
    const sz = hearth.z + (hash(n * 17 + 2) - 0.5) * 7;
    const sy = y - 0.4 + hash(n * 3 + 1) * 1.1;
    draw.streak([sx, sy, sz], [sx + 0.03, sy + 0.02, sz], ink(0, 0.018, true));
  }
  const glow = (hearth.elevation || 1) + 0.42;
  draw.streak(
    [hearth.x - 0.06, glow, hearth.z],
    [hearth.x + 0.05, glow + 0.2, hearth.z + 0.02],
    ink(14, 0.04 * (0.5 + amount), true)
  );
}

export function drawRest(draw, sim) {
  if (!sim?.cells) return;
  const clock = nightAmount(sim.time || 0);
  const sleeping = sim.resting === 'sleep';
  const heading = sim.resting === 'home';
  if (clock < 0.08 && !sleeping && !heading) return;
  if (!sim.restBeds) layBeds(sim);
  const amount = Math.max(clock, sleeping ? 1 : 0, heading ? 0.45 : 0);
  const deep = clock > 0.55 || (sleeping && !(sim.napUntil > sim.time && clock < 0.2));
  const ids = deep ? Object.keys(sim.restBeds) : [sim.spiritId || 'cloud'];
  for (const id of ids) {
    const cell = sim.restBeds[id];
    if (!cell) continue;
    drawForm(draw, sim, id, cell, amount, sim.time || 0);
  }
  if (clock > 0.45) drawNightSky(draw, sim, clock);
}
