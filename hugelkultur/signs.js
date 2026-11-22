import { INK, GRID, ORIGIN, HEARTH_I, HEARTH_K, PAD, COURT, PEDESTAL, hash, cellAt, bedHeight, walkHeight } from './world.js?v=hold';
import { seasonOf, seasonLength, idolDepth, OPPOSITE } from './water.js?v=hold';
import { idolStage, holdsWater, wedgeOf, MOUTH_YAW, pressureOf, wornMeasures, seasonFit, stillWants, roomsOf, woodOf } from './clearing.js?v=hold';
import { nightAmount, dayIndex } from './day.js?v=hold';

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const MARKS = ['tend', 'leaf', 'snow', 'rain'];
const BAND = { tend: INK.deep, leaf: INK.brass, snow: 6, rain: INK.lush };
const SEASON_INK = { SPR: INK.lush, SUM: INK.brass, AUT: INK.stick, WIN: 6 };

function stroke(color, width, extra = {}) {
  const next = Number(width);
  const size = Number.isFinite(next) && next > 0 ? Math.max(0.008, next) : 0.008;
  return { width: size, color, density: extra.density ?? 2.1, emissive: extra.emissive ?? false, depth: true };
}

function liveFinger(sim) {
  return sim.live?.find(item => item.bit === seasonOf(sim).bit) || null;
}

function waterAt(sim, x, z) {
  return sim.snapshot?.sample?.(x, z) || null;
}

function capPush(list, item, max) {
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
}

export function offerHusk(sim) {
  const hearth = sim.hearth;
  const st = sim.character?.st;
  if (!hearth || !st) return;
  if (Math.hypot(st.x - hearth.x, st.z - hearth.z) > COURT) return;
  sim.husks = sim.husks || [];
  const n = sim.husks.length + 1;
  capPush(sim.husks, {
    x: hearth.x + (hash(n * 11 + sim.time) - 0.5) * 0.42,
    z: hearth.z + (hash(n * 19 + 3) - 0.5) * 0.42,
    yaw: hash(n * 7) * Math.PI
  }, 12);
}

export function updateSigns(sim, dt) {
  if (!sim || sim.over) return;
  if (sim.weaves?.length) {
    sim.weaves = sim.weaves.filter(item => item.until > (sim.time || 0)).slice(-8);
  }
  updateRooms(sim);
  updateTraces(sim, dt);
  updateDream(sim);
  updateFlies(sim);
}

function updateRooms(sim) {
  const rooms = roomsOf(sim.cells, HEARTH_I, HEARTH_K, PAD);
  const count = rooms.length;
  if ((sim.roomCount || 0) < count && count > 0) {
    if (sim.chronicle) sim.chronicle.room = true;
    if (!sim.quiet) sim.events.push({ type: 'note', text: 'The wall makes a room.' });
  }
  sim.roomCount = count;
  sim.rooms = rooms;
}

function updateTraces(sim, dt) {
  const traces = sim.traces || (sim.traces = []);
  for (const trace of traces) trace.t += dt;
  sim.traces = traces.filter(trace => trace.t < trace.dur);
  const st = sim.character?.st;
  if (!st || sim.asleep || sim.resting === 'sleep') return;
  const moving = Math.hypot(st.vx || 0, st.vz || 0) > 0.22;
  const here = cellAt(sim.cells, st.x, st.z);
  const hit = waterAt(sim, st.x, st.z);
  const depth = hit?.depth || 0;
  const id = sim.spiritId || 'cloud';
  sim.traceWait = (sim.traceWait || 0) - dt;
  if (id === 'moss') {
    if (sim.mossCell === here) sim.mossFor = (sim.mossFor || 0) + dt;
    else {
      sim.mossCell = here;
      sim.mossFor = 0;
    }
    if (here && !here.hearth && sim.mossFor > 1.05) {
      capPush(sim.traces, { kind: 'blush', x: here.x, z: here.z, y: walkHeight(here) + 0.03, t: 0, dur: 3.2 }, 18);
      sim.mossFor = 0;
    }
  }
  if (sim.traceWait > 0 || !moving) return;
  sim.traceWait = 0.3;
  const y = (hit && depth > 0.03 ? (hit.level || st.y) + 0.02 : (here ? walkHeight(here) : st.y) + 0.02);
  if (id === 'water' && depth > 0.03) {
    capPush(sim.traces, { kind: 'ripple', x: st.x, z: st.z, y, t: 0, dur: 1.35 }, 18);
  } else if (id === 'snow' && seasonOf(sim).id === 'WIN') {
    capPush(sim.traces, { kind: 'print', x: st.x, z: st.z, y, yaw: st.face || 0, t: 0, dur: 2.4 }, 18);
  } else if (id === 'fire' && depth > 0.018 && depth < 0.09) {
    capPush(sim.traces, { kind: 'dry', x: st.x, z: st.z, y, t: 0, dur: 1.7 }, 18);
  }
}

function updateDream(sim) {
  if (!sim.asleep && sim.resting !== 'sleep') return;
  if (nightAmount(sim.time) < 0.72) return;
  const night = dayIndex(sim.time);
  if (sim.dreamed === night) return;
  const mounds = sim.cells.filter(cell => cell.berm && stillWants(cell.marks));
  if (!mounds.length) return;
  sim.dreamed = night;
  const pick = mounds[Math.floor(hash(night * 17 + (sim.year || 1)) * mounds.length)];
  const st = sim.character?.st;
  if (!st || !sim.motions) return;
  sim.motions.push({
    kind: 'dream',
    t: 0,
    dur: 3.6,
    x0: st.x,
    y0: (st.y || 1) + 0.42,
    z0: st.z,
    x1: pick.x,
    y1: walkHeight(pick) + 0.22,
    z1: pick.z
  });
}

function updateFlies(sim) {
  const night = nightAmount(sim.time);
  if (seasonOf(sim).id !== 'SUM' || night < 0.3) {
    sim.flies = null;
    return;
  }
  if (sim.flies?.length) return;
  const wet = [];
  for (const cell of sim.cells) {
    if ((waterAt(sim, cell.x, cell.z)?.depth || 0) > 0.04) wet.push(cell);
  }
  const flies = [];
  const n = Math.min(8, wet.length);
  for (let i = 0; i < n; i++) {
    const cell = wet[Math.floor(hash((sim.year || 1) * 9 + i * 13) * wet.length)];
    flies.push({
      x: cell.x + (hash(i * 5) - 0.5) * 0.3,
      z: cell.z + (hash(i * 11) - 0.5) * 0.3,
      phase: hash(i * 3) * 6
    });
  }
  sim.flies = flies;
}

export function drawSigns(draw, sim) {
  if (!sim?.cells) return;
  drawIdolLife(draw, sim);
  drawCircleThread(draw, sim);
  drawCourtDamp(draw, sim);
  drawMouths(draw, sim);
  drawOldGates(draw, sim);
  drawOutlets(draw, sim);
  drawRaces(draw, sim);
  drawStore(draw, sim);
  drawWorn(draw, sim);
  drawSummerMemory(draw, sim);
  drawFrost(draw, sim);
  drawThaw(draw, sim);
  drawWeaves(draw, sim);
  drawAlder(draw, sim);
  drawMossedStone(draw, sim);
  drawCompost(draw, sim);
  drawDam(draw, sim);
  drawTraces(draw, sim);
  drawWeariness(draw, sim);
  drawHomePath(draw, sim);
  drawPocket(draw, sim);
  drawFlies(draw, sim);
  drawStrata(draw, sim);
}

function drawOutlets(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if (!cell.outlet || n >= 8) continue;
    n += 1;
    const y = cell.elevation + 0.04;
    const out = cell.k === 0 ? [0, -1] : cell.k === GRID - 1 ? [0, 1] : cell.i === 0 ? [-1, 0] : [1, 0];
    draw.streak(
      [cell.x, y, cell.z],
      [cell.x + out[0] * 0.22, y + 0.01, cell.z + out[1] * 0.22],
      stroke(12, 0.035, { density: 1.5 })
    );
  }
}

function drawRaces(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if ((!cell.race && !cell.river) || n >= 36) continue;
    n += 1;
    const y = cell.elevation + 0.03;
    const ink = cell.river ? INK.sand : 12;
    draw.streak(
      [cell.x - 0.18, y, cell.z - 0.04],
      [cell.x + 0.16, y + 0.01, cell.z + 0.06],
      stroke(ink, cell.river ? 0.05 : 0.03, { density: 1.6 })
    );
    if (cell.river) {
      draw.streak(
        [cell.x - 0.06, y + 0.02, cell.z - 0.18],
        [cell.x + 0.08, y + 0.03, cell.z + 0.16],
        stroke(INK.humus, 0.028, { density: 1.7 })
      );
    }
  }
}

function drawStore(draw, sim) {
  if (!sim.store) return;
  const cell = sim.cells[sim.store.k * GRID + sim.store.i];
  if (!cell) return;
  const sticks = sim.store.sticks || [];
  const y = walkHeight(cell) + 0.06;
  sticks.slice(0, 8).forEach((kind, index) => {
    const wood = woodOf(kind);
    const along = index % 2 === 0;
    const lift = Math.floor(index / 2) * 0.05;
    if (along) {
      draw.streak(
        [cell.x - wood.half * 0.7, y + lift, cell.z - 0.04],
        [cell.x + wood.half * 0.7, y + lift + 0.01, cell.z + 0.04],
        stroke(wood.color, 0.045)
      );
    } else {
      draw.streak(
        [cell.x - 0.04, y + lift, cell.z - wood.half * 0.7],
        [cell.x + 0.04, y + lift + 0.01, cell.z + wood.half * 0.7],
        stroke(wood.color, 0.045)
      );
    }
  });
}

function drawWorn(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if ((cell.worn || 0) < 0.45 || cell.hearth || n >= 28) continue;
    n += 1;
    const y = walkHeight(cell) + 0.02;
    const span = 0.1 + Math.min(0.2, cell.worn * 0.1);
    draw.streak(
      [cell.x - span, y, cell.z - span * 0.2],
      [cell.x + span, y + 0.01, cell.z + span * 0.15],
      stroke(INK.sand, 0.05, { density: 1.8 })
    );
  }
}

function drawCircleThread(draw, sim) {
  if (!sim.holding || !sim.hearth) return;
  const holders = [null, null, null, null, null, null, null, null];
  const near = [1e9, 1e9, 1e9, 1e9, 1e9, 1e9, 1e9, 1e9];
  for (const cell of sim.cells) {
    const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
    if (dist <= PAD || dist >= 3.35 || cell.hearth) continue;
    if (!holdsWater(cell)) continue;
    const w = wedgeOf(cell.i, cell.k, HEARTH_I, HEARTH_K);
    if (dist < near[w]) {
      near[w] = dist;
      holders[w] = cell;
    }
  }
  if (holders.some(cell => !cell)) return;
  const pulse = 0.7 + Math.sin((sim.time || 0) * 0.55) * 0.3;
  for (let i = 0; i < 8; i++) {
    const a = holders[i];
    const b = holders[(i + 1) % 8];
    const ya = walkHeight(a) + 0.04;
    const yb = walkHeight(b) + 0.04;
    draw.streak(
      [a.x, ya, a.z],
      [b.x, yb, b.z],
      stroke(INK.brass, 0.018 * pulse, { density: 1.3, emissive: true })
    );
  }
}

function drawCourtDamp(draw, sim) {
  const hearth = sim.hearth;
  const finger = liveFinger(sim);
  if (!hearth || !finger) return;
  const gates = (sim.live || []).map(item => {
    const cell = sim.cells[item.gate[1] * GRID + item.gate[0]];
    if (!cell) return 0;
    return Math.atan2(cell.z - hearth.z, cell.x - hearth.x);
  });
  if (gates.length < 2) return;
  const live = sim.cells[finger.gate[1] * GRID + finger.gate[0]];
  const liveA = live ? Math.atan2(live.z - hearth.z, live.x - hearth.x) : 0;
  let best = 0;
  let bestD = 1e9;
  for (let i = 0; i < gates.length; i++) {
    const a0 = gates[i];
    const a1 = gates[(i + 1) % gates.length];
    let span = a1 - a0;
    if (span < 0) span += Math.PI * 2;
    const a = a0 + span * 0.5;
    let d = Math.abs(a - liveA);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  const left = seasonLength(sim) - (sim.seasonTime || 0);
  const fade = left < 8 ? Math.max(0.15, left / 8) : 1;
  const x = hearth.x + Math.cos(best) * 1.44;
  const z = hearth.z + Math.sin(best) * 1.44;
  const y = hearth.elevation + 0.1;
  draw.streak(
    [x - Math.sin(best) * 0.08, y, z + Math.cos(best) * 0.08],
    [x + Math.sin(best) * 0.08, y + 0.01, z - Math.cos(best) * 0.08],
    stroke(INK.charcoal, 0.045 * fade, { density: 2.4 })
  );
}

function drawMouths(draw, sim) {
  const season = seasonOf(sim);
  const finger = liveFinger(sim);
  if (!finger) return;
  const press = pressureOf(sim.year, sim.measures?.climb);
  const dashes = Math.min(5, 1 + Math.round(press * 0.55));
  const yaw = MOUTH_YAW[season.edge] || 0;
  const fx = Math.cos(yaw);
  const fz = Math.sin(yaw);
  const leave = OPPOSITE[season.edge];
  const outYaw = MOUTH_YAW[leave] || 0;
  const ox = Math.cos(outYaw);
  const oz = Math.sin(outYaw);
  let foam = 0;
  let drain = 0;
  for (const cell of sim.cells) {
    const atMouth = Math.hypot(cell.i - finger.mouth[0], cell.k - finger.mouth[1]) < 1.45;
    const atGate = Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) < 1.25;
    if (atMouth && !atGate && foam < 10) {
      foam += 1;
      const y = cell.elevation + 0.05;
      for (let n = 0; n < dashes; n++) {
        const j = (hash(sim.time * 37 + cell.i * 3 + n) - 0.5) * 0.16;
        const along = (n / dashes - 0.5) * 0.34;
        const x = cell.x + fx * 0.12 + Math.cos(yaw + Math.PI / 2) * (along + j);
        const z = cell.z + fz * 0.12 + Math.sin(yaw + Math.PI / 2) * (along + j);
        draw.streak([x, y, z], [x + fx * 0.1, y + 0.01, z + fz * 0.1], stroke(6, 0.022, { density: 1.4 }));
      }
    }
    const onLeave = (leave === 'N' && cell.k === 0)
      || (leave === 'S' && cell.k === GRID - 1)
      || (leave === 'W' && cell.i === 0)
      || (leave === 'E' && cell.i === GRID - 1);
    if (onLeave && cell.channel && drain < 8) {
      drain += 1;
      if (hash(cell.i * 9 + cell.k * 4 + Math.floor((sim.time || 0) * 2)) < 0.55) continue;
      const y = cell.elevation + 0.04;
      draw.streak(
        [cell.x, y, cell.z],
        [cell.x + ox * 0.16, y + 0.01, cell.z + oz * 0.16],
        stroke(INK.sand, 0.03, { density: 1.8 })
      );
    }
  }
}

function drawOldGates(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if (!cell.oldGate || n > 8) continue;
    n += 1;
    const y = walkHeight(cell) + 0.05;
    for (let s = 0; s < 6; s++) {
      if (s % 2) continue;
      const a0 = (s / 6) * Math.PI * 2;
      const a1 = ((s + 1) / 6) * Math.PI * 2;
      draw.streak(
        [cell.x + Math.cos(a0) * 0.28, y, cell.z + Math.sin(a0) * 0.28],
        [cell.x + Math.cos(a1) * 0.28, y, cell.z + Math.sin(a1) * 0.28],
        stroke(INK.charcoal, 0.02, { density: 1.5 })
      );
    }
  }
}

function drawSummerMemory(draw, sim) {
  if (seasonOf(sim).id !== 'SUM') return;
  let stains = 0;
  let cracks = 0;
  for (const cell of sim.cells) {
    const depth = waterAt(sim, cell.x, cell.z)?.depth || 0;
    if ((cell.stain || 0) > 0.18 && depth < 0.02 && !cell.hearth && stains < 24) {
      stains += 1;
      const y = cell.elevation + 0.035;
      const span = 0.1 + cell.stain * 0.2;
      draw.streak(
        [cell.x - span, y, cell.z - span * 0.2],
        [cell.x + span * 0.5, y + 0.01, cell.z + span * 0.35],
        stroke(INK.charcoal, 0.028 + cell.stain * 0.03, { density: 2.3 })
      );
    }
    if (cell.channel && depth < 0.015 && cracks < 20) {
      cracks += 1;
      const y = cell.elevation + 0.03;
      const j = (hash(cell.i * 5 + cell.k) - 0.5) * 0.08;
      draw.streak([cell.x - 0.16 + j, y, cell.z - 0.04], [cell.x + 0.14, y, cell.z + 0.08], stroke(1, 0.018));
      draw.streak([cell.x - 0.04, y, cell.z - 0.14], [cell.x + 0.06, y, cell.z + 0.16 + j], stroke(1, 0.016));
    }
  }
}

function drawFrost(draw, sim) {
  const season = seasonOf(sim);
  if (season.id !== 'WIN') return;
  if ((sim.seasonTime || 0) > seasonLength(sim) * 0.1) return;
  let n = 0;
  for (const cell of sim.cells) {
    const hit = waterAt(sim, cell.x, cell.z);
    if (!hit || hit.depth < 0.04 || n >= 18) continue;
    n += 1;
    const y = (hit.level || cell.elevation) + 0.02;
    const span = 0.12 + hash(cell.i + cell.k) * 0.08;
    draw.streak(
      [cell.x - span, y, cell.z],
      [cell.x + span, y, cell.z + 0.02],
      stroke(6, 0.016, { density: 1.2 })
    );
  }
}

function drawThaw(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if (!(cell.thaw > 0) || n >= 16) continue;
    n += 1;
    let best = null;
    let low = bedHeight(cell);
    for (const [di, dk] of STEP) {
      const next = sim.cells[(cell.k + dk) * GRID + (cell.i + di)];
      if (!next) continue;
      const y = bedHeight(next);
      if (y < low) {
        low = y;
        best = next;
      }
    }
    if (!best) continue;
    const y0 = walkHeight(cell) + 0.03;
    const y1 = walkHeight(best) + 0.03;
    draw.streak([cell.x, y0, cell.z], [best.x, y1, best.z], stroke(12, 0.014, { density: 1.3 }));
  }
}

function drawWeaves(draw, sim) {
  for (const weave of sim.weaves || []) {
    if (weave.until < sim.time) continue;
    const a = sim.cells[weave.k * GRID + weave.i];
    const b = sim.cells[weave.nk * GRID + weave.ni];
    if (!a || !b) continue;
    const y = Math.max(walkHeight(a), walkHeight(b)) + 0.07;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    const px = -(b.z - a.z) * 0.18;
    const pz = (b.x - a.x) * 0.18;
    draw.streak([a.x, y, a.z], [mx + px, y + 0.05, mz + pz], stroke(INK.leaf, 0.03));
    draw.streak([mx + px, y + 0.05, mz + pz], [b.x, y, b.z], stroke(INK.leaf, 0.03));
    draw.streak([a.x, y + 0.02, a.z], [mx - px, y + 0.04, mz - pz], stroke(INK.deep, 0.024));
    draw.streak([mx - px, y + 0.04, mz - pz], [b.x, y + 0.02, b.z], stroke(INK.deep, 0.024));
  }
}

function drawAlder(draw, sim) {
  if (seasonOf(sim).id !== 'SPR') return;
  let n = 0;
  for (const cell of sim.cells) {
    if (!cell.rooted || n >= 12) continue;
    n += 1;
    const phase = ((sim.time || 0) + hash(cell.i * 9 + cell.k * 4) * 4) % 4.2;
    if (phase > 1.3) continue;
    const t = phase / 1.3;
    const y = walkHeight(cell) + 0.06 + t * 0.32;
    draw.point([cell.x + 0.04, y, cell.z - 0.02], stroke(INK.lush, 0.018, { density: 1.6 }));
  }
}

function drawMossedStone(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    const age = cell.rock ? (sim.year || 1) - (cell.rockAge || sim.year || 1) : (cell.cubes ? (sim.year || 1) - (cell.rockAge || sim.year || 1) : 0);
    const streaks = Math.min(4, Math.max(0, age));
    if (!streaks || n >= 20) continue;
    if (!cell.rock && !(cell.cubes > 0)) continue;
    n += 1;
    const y = walkHeight(cell) + 0.04;
    for (let i = 0; i < streaks; i++) {
      const ox = (hash(cell.i * 3 + i) - 0.5) * 0.16;
      draw.streak(
        [cell.x + ox - 0.08, y + i * 0.03, cell.z - 0.16],
        [cell.x + ox + 0.05, y + 0.02 + i * 0.03, cell.z - 0.02],
        stroke(INK.moss, 0.03, { density: 1.8 })
      );
    }
  }
}

function drawCompost(draw, sim) {
  let n = 0;
  for (const cell of sim.cells) {
    if ((cell.compost || 0) < 0.4 || cell.hearth || n >= 22) continue;
    n += 1;
    let ox = 0;
    let oz = 0;
    for (const [di, dk] of STEP) {
      const next = sim.cells[(cell.k + dk) * GRID + (cell.i + di)];
      if ((next?.compost || 0) > 0.4) {
        ox += next.x - cell.x;
        oz += next.z - cell.z;
      }
    }
    const len = Math.hypot(ox, oz) || 1;
    ox = (ox / len) * 0.14;
    oz = (oz / len) * 0.14;
    const y = walkHeight(cell) + 0.03;
    draw.streak(
      [cell.x - 0.18 + ox, y, cell.z - 0.1 + oz],
      [cell.x + 0.16 + ox, y + 0.02, cell.z + 0.12 + oz],
      stroke(INK.humus, 0.12, { density: 2.5 })
    );
  }
}

function drawDam(draw, sim) {
  for (const cell of sim.cells) {
    if (!cell.dam) continue;
    const y = walkHeight(cell) + 0.08;
    draw.streak([cell.x - 0.22, y, cell.z - 0.08], [cell.x + 0.2, y + 0.02, cell.z + 0.1], stroke(INK.bark, 0.05));
    draw.streak([cell.x - 0.08, y, cell.z - 0.2], [cell.x + 0.1, y + 0.02, cell.z + 0.22], stroke(INK.stick, 0.045));
  }
}

function drawTraces(draw, sim) {
  for (const trace of sim.traces || []) {
    const k = 1 - trace.t / trace.dur;
    if (trace.kind === 'ripple') {
      const r = 0.08 + trace.t * 0.22;
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2;
        const a1 = ((i + 1) / 6) * Math.PI * 2;
        draw.streak(
          [trace.x + Math.cos(a0) * r, trace.y, trace.z + Math.sin(a0) * r],
          [trace.x + Math.cos(a1) * r, trace.y, trace.z + Math.sin(a1) * r],
          stroke(12, 0.016 * k, { density: 1.2 })
        );
      }
    } else if (trace.kind === 'print') {
      const fx = Math.cos(trace.yaw || 0);
      const fz = Math.sin(trace.yaw || 0);
      draw.streak(
        [trace.x - fz * 0.04, trace.y, trace.z + fx * 0.04],
        [trace.x + fz * 0.03, trace.y + 0.01, trace.z - fx * 0.03],
        stroke(6, 0.04 * k, { density: 1.5 })
      );
    } else if (trace.kind === 'blush') {
      draw.streak(
        [trace.x - 0.14, trace.y, trace.z],
        [trace.x + 0.12, trace.y + 0.01, trace.z + 0.04],
        stroke(INK.moss, 0.07 * k, { density: 1.7 })
      );
    } else if (trace.kind === 'dry') {
      draw.streak(
        [trace.x - 0.1, trace.y, trace.z - 0.04],
        [trace.x + 0.1, trace.y, trace.z + 0.05],
        stroke(INK.sand, 0.03 * k)
      );
    }
  }
}

function drawWeariness(draw, sim) {
  const st = sim.character?.st;
  if (!st || sim.asleep) return;
  const row = wornMeasures(sim);
  if (seasonFit(row.home, seasonOf(sim).id) >= 1) return;
  if (Math.hypot(st.vx || 0, st.vz || 0) < 0.18) return;
  if (hash(Math.floor((sim.time || 0) * 1.35) + 2) < 0.48) return;
  const back = (st.face || 0) + Math.PI;
  const x = st.x + Math.cos(back) * 0.16;
  const z = st.z + Math.sin(back) * 0.16;
  draw.streak([x, st.y + 0.72, z], [x + 0.02, st.y + 0.42, z + 0.02], stroke(INK.bark, 0.03, { density: 1.4 }));
}

function drawHomePath(draw, sim) {
  if (sim.resting !== 'home' || !sim.bed || !sim.character?.st) return;
  const st = sim.character.st;
  const bed = sim.bed;
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    const x = st.x + (bed.x - st.x) * t;
    const z = st.z + (bed.z - st.z) * t;
    const y = st.y + (walkHeight(bed) - st.y) * t + 0.12;
    draw.point([x, y, z], stroke(6, 0.03 * (1 - t * 0.5), { density: 1.1, emissive: true }));
  }
}

function drawPocket(draw, sim) {
  if (!sim.pocketMark?.length || (sim.pocketUntil || 0) < sim.time) return;
  const fade = Math.max(0, ((sim.pocketUntil - sim.time) / 2.4));
  for (const cell of sim.pocketMark) {
    const y = walkHeight(cell) + 0.05;
    draw.streak(
      [cell.x - 0.22, y, cell.z - 0.22],
      [cell.x + 0.22, y, cell.z - 0.22],
      stroke(1, 0.02 * fade, { density: 1.6 })
    );
    draw.streak(
      [cell.x - 0.22, y, cell.z + 0.22],
      [cell.x + 0.22, y, cell.z + 0.22],
      stroke(1, 0.02 * fade, { density: 1.6 })
    );
  }
}

function drawFlies(draw, sim) {
  for (const fly of sim.flies || []) {
    const hit = waterAt(sim, fly.x, fly.z);
    if (!hit || hit.depth < 0.02) continue;
    const y = (hit.level || 1) + 0.18 + Math.sin((sim.time || 0) * 1.7 + fly.phase) * 0.08;
    const x = fly.x + Math.sin((sim.time || 0) * 0.9 + fly.phase) * 0.06;
    const z = fly.z + Math.cos((sim.time || 0) * 0.7 + fly.phase) * 0.06;
    draw.point([x, y, z], stroke(INK.brass, 0.022, { density: 0.7, emissive: true }));
  }
}

function drawStrata(draw, sim) {
  let cubes = 0;
  for (const cell of sim.cells) cubes += cell.cubes || 0;
  const n = Math.min(16, cubes);
  if (!n) return;
  const slab = GRID / 2 + 0.25;
  for (let i = 0; i < n; i++) {
    const y = -0.12 - i * 0.065;
    const wob = (hash(i * 13 + 4) - 0.5) * 0.35;
    draw.streak(
      [-slab * 0.72 + wob, y, slab],
      [slab * 0.72 + wob * 0.4, y - 0.01, slab],
      stroke(INK.humus, 0.028, { density: 2.2 })
    );
    draw.streak(
      [slab, y, -slab * 0.72 + wob],
      [slab, y - 0.01, slab * 0.72],
      stroke(INK.humus, 0.028, { density: 2.2 })
    );
  }
}

export function drawIdolLife(draw, sim) {
  const cell = sim.hearth;
  if (!cell) return;
  const x = cell.x;
  const z = cell.z;
  const floor = cell.elevation;
  const feet = floor + PEDESTAL;
  const headY = feet + 0.58;
  const depth = idolDepth(sim);
  const stage = idolStage(depth);
  const finger = liveFinger(sim);
  const gate = finger ? sim.cells[finger.gate[1] * GRID + finger.gate[0]] : null;
  const eyeX = x + 0.11;
  const eyeY = headY + 0.03;
  const eyeZ = z + 0.12;
  let lookX = 0;
  let lookZ = 0;
  if (gate) {
    const dx = gate.x - eyeX;
    const dz = gate.z - eyeZ;
    const len = Math.hypot(dx, dz) || 1;
    lookX = (dx / len) * 0.028;
    lookZ = (dz / len) * 0.028;
  }
  draw.point([eyeX + lookX, eyeY, eyeZ + lookZ], stroke(INK.charcoal, 0.022, { density: 2.6 }));

  const period = sim.holding ? 1.65 : stage === 'drinks' || stage === 'under' ? 0.42 : stage === 'hem' ? 0.78 : 1.38;
  const beat = 0.45 + 0.55 * Math.max(0, Math.sin((sim.time || 0) * Math.PI * 2 / period));
  draw.point(
    [x + 0.12, feet + 0.24, z + 0.14],
    stroke(INK.ember, 0.028 + beat * 0.038, { density: 0.8, emissive: true })
  );

  const high = sim.highWater || 0;
  if (high >= 0.008) drawPedestalRing(draw, x, floor + 0.09, z, 0.44, INK.charcoal);
  if (high >= 0.02) drawPedestalRing(draw, x, floor + 0.16, z, 0.38, 1);

  const notches = Math.min(48, sim.notches || 0);
  for (let i = 0; i < notches; i++) {
    const a = (i / 8) * Math.PI * 2 + i * 0.04;
    const band = i % 8 === 7;
    const y = floor + 0.11 + (Math.floor(i / 8) % 3) * 0.018;
    if (band) {
      drawPedestalRing(draw, x, y, z, 0.5, INK.bark);
      continue;
    }
    const r0 = 0.46;
    const r1 = 0.52;
    draw.streak(
      [x + Math.cos(a) * r0, y, z + Math.sin(a) * r0],
      [x + Math.cos(a) * r1, y + 0.01, z + Math.sin(a) * r1],
      stroke(INK.bark, 0.016)
    );
  }

  const leaves = Math.min(8, Math.max(0, sim.yearLeaves ?? ((sim.year || 1) - 1)));
  for (let i = 0; i < leaves; i++) {
    const t = i / 8;
    const a = i * 0.95;
    const sx = x - 0.26 - Math.cos(a) * 0.08 * t;
    const sy = headY + 0.5 + t * 0.22;
    const sz = z + 0.18 + Math.sin(a) * 0.08 * t;
    draw.streak(
      [sx, sy, sz],
      [sx + Math.cos(a) * 0.1, sy + 0.02, sz + Math.sin(a) * 0.07],
      stroke(INK.leaf, 0.028)
    );
  }

  (sim.husks || []).forEach((husk, index) => {
    const fade = 1 - index / 14;
    draw.point(
      [husk.x, floor + 0.05, husk.z],
      stroke(INK.bark, 0.026 * fade, { density: 2.3 })
    );
  });

  if (stage === 'hem' || stage === 'drinks' || stage === 'under') {
    const hit = waterAt(sim, x, z);
    const y = (hit?.level || floor) + 0.015;
    draw.streak([x + 0.04, y, z + 0.18], [x + 0.08, y, z + 0.32], stroke(1, 0.03, { density: 1.4 }));
    draw.streak([x + 0.1, y, z + 0.16], [x + 0.16, y, z + 0.28], stroke(INK.charcoal, 0.022, { density: 1.3 }));
    draw.streak([x - 0.02, y, z + 0.2], [x + 0.02, y, z + 0.3], stroke(1, 0.02, { density: 1.2 }));
    if (stage !== 'hem') {
      draw.streak([x + 0.06, y, z + 0.14], [x + 0.12, y, z + 0.24], stroke(INK.ember, 0.018, { density: 1.1, emissive: true }));
    }
  }
}

function drawPedestalRing(draw, x, y, z, r, color) {
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2;
    draw.streak(
      [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r],
      [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r],
      stroke(color, 0.016, { density: 2.3 })
    );
  }
}

export { MARKS, BAND, SEASON_INK };
