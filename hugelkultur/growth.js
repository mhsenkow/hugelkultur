import { INK, hash, HEARTH_I, HEARTH_K, PAD, COURT, PEDESTAL, GRID, cellAt, walkHeight, blockHeights, bedHeight, DIRT_CUBE, DIRT_CAP, brickGain } from './world.js?v=fifty';
import { paintCrop, paintLeaf, paintFlake } from './gardens.js?v=fifty';
import { seasonOf, seasonLength, idolDepth } from './water.js?v=fifty';
import { circleState, wornMeasures, seasonFit, storyLine, YEAR_SPAN, treeScale, fernCount, sparkleSets, stillWants, wedgeOf } from './clearing.js?v=fifty';

const MOSS = { width: 0.045, color: INK.lush, density: 2, emissive: false, depth: true };
const DEEP = { width: 0.04, color: INK.deep, density: 2, emissive: false, depth: true };
const FUNGI = { width: 0.035, color: INK.ember, density: 2.3, emissive: true, depth: true };
const WET = { width: 0.07, color: INK.charcoal, density: 2.5, emissive: false, depth: true };

const BAND = { tend: INK.deep, leaf: INK.brass, snow: 6, rain: INK.lush };

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

const CROPS = ['carrot', 'turnip', 'mushroom'];

function speak(sim, type, text) {
  if (!sim.quiet) sim.events.push({ type, text });
}

export function raiseLand(sim, cell, amount) {
  if (!cell || cell.hearth || !(amount > 0)) return;
  const next = Math.min(0.42, (cell.land || 0) + amount);
  if (next === (cell.land || 0)) return;
  cell.land = next;
  sim.bedDirty = true;
}

export function compactMound(sim, cell) {
  if (!cell?.berm || cell.rock || cell.hearth) return false;
  cell.rock = true;
  cell.rockAge = sim.year || 1;
  cell.lift = Math.max(0, Math.round((cell.lift || 0) * 0.35));
  cell.coat = Math.max(1, (cell.coat || 1) * 0.4);
  raiseLand(sim, cell, 0.08);
  sim.bedDirty = true;
  speak(sim, 'stone', 'The mound becomes stone.');
  return true;
}

function remember(cell, cause) {
  cell.marks = cell.marks || { tend: false, leaf: false, snow: false, rain: false };
  cell.story = cell.story || [];
  if (!cell.marks[cause]) cell.story.push(cause);
  cell.marks[cause] = true;
}

function offerFruit(sim, cell) {
  const marks = cell.marks || {};
  if (!marks.tend || !marks.leaf || !marks.snow || !marks.rain || cell.fruit) return;
  cell.fruit = CROPS[Math.floor(hash(cell.i * 9 + cell.k * 4 + (sim.year || 1)) * CROPS.length) % CROPS.length];
  cell.fruitGrowth = 0.08;
  speak(sim, 'berm', 'The mound keeps a seed. It is good.');
}

export function beginMound(sim, cell, cause, line) {
  if (cell.hearth || cell.plot || cell.tree) return false;
  if (cell.berm) {
    if (cell.marks?.[cause]) return false;
    remember(cell, cause);
    cell.coat = (cell.coat || 1) + 1;
    sim.bedDirty = true;
    sim.seen.add('mound');
    offerFruit(sim, cell);
    speak(sim, 'berm', `${line || RICHER[cause]}${stillWants(cell.marks)}`);
    return true;
  }
  if ((cell.layers || 0) < 2 && cause !== 'tend') return false;
  remember(cell, cause);
  cell.berm = true;
  cell.coat = 1;
  cell.settle = 1.25;
  if (crowdsFigure(sim, cell)) speak(sim, 'note', 'The figure keeps its court.');
  cell.growth = hash(cell.i * 19 + cell.k * 7 + cell.coat);
  sim.bedDirty = true;
  sim.seen.add('mound');
  if (!sim.quiet && sim.motions) sim.motions.push({ kind: 'mound', i: cell.i, k: cell.k, t: 0, dur: 1.25 });
  offerFruit(sim, cell);
  speak(sim, 'berm', `${line || CAUSE[cause]}${stillWants(cell.marks)}`);
  noteGate(sim, cell);
  if (cause === 'tend' && !sim.quiet && sim.guide && sim.character?.st && sim.hearth) {
    const pause = wornMeasures(sim).pause || 0;
    if (pause > 0.42) {
      const st = sim.character.st;
      sim.guide.pauseUntil = (sim.time || 0) + 1.15;
      sim.guide.goal = { kind: 'look', face: Math.atan2(sim.hearth.z - st.z, sim.hearth.x - st.x) };
    }
  }
  return true;
}

function crowdsFigure(sim, cell) {
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  if (dist <= PAD || dist >= COURT) return false;
  for (const finger of sim.live || []) {
    if (Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) < 0.8) return false;
  }
  return true;
}

function noteGate(sim, cell) {
  const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
  if (!finger || !sim.chronicle) return;
  if (Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) > 1.85) return;
  if (cell.lastWood) sim.chronicle.wood = cell.lastWood;
  sim.chronicle.edge = finger.edge;
}

function depthAt(sim, cell) {
  const hit = sim.snapshot?.sample?.(cell.x, cell.z);
  return hit?.depth || 0;
}

export function moundLine(cell) {
  return storyLine(cell?.story);
}

export function updateGrowth(sim, dt) {
  if (sim.over) return;
  const measures = wornMeasures(sim);
  const fit = seasonFit(measures.home, seasonOf(sim).id);
  const st = sim.character?.st;
  let berms = 0;
  for (const cell of sim.cells) {
    const depth = depthAt(sim, cell);
    if (depth > 0.045) cell.moisture = Math.min(1, cell.moisture + dt * 0.24);
    else cell.moisture = Math.max(0, cell.moisture - dt * 0.04);
    if (cell.raft) {
      const next = Math.max(0, cell.raft - dt * 0.035);
      if (Math.abs(next - cell.raft) > 0.02) sim.bedDirty = true;
      cell.raft = next;
    }
    if (cell.stain) cell.stain = Math.max(0, cell.stain - dt * 0.003);
    if (cell.settle > 0) {
      cell.settle -= dt;
      if (cell.settle <= 0) {
        cell.settle = 0;
        cell.layers = 0;
        cell.woods = [];
      }
    }
    if (cell.fruit && cell.fruitGrowth < 1) cell.fruitGrowth = Math.min(1, cell.fruitGrowth + dt / 16);
    if (st && (cell.layers || cell.berm)) {
      const near = Math.hypot(cell.x - st.x, cell.z - st.z) < 1.25;
      if (near && measures.dry * fit > 0.62 && !cell.parched) {
        cell.parched = true;
        if (!sim.driedAt || sim.time - sim.driedAt > 9) {
          sim.driedAt = sim.time;
          speak(sim, 'note', 'The stack dries.');
        }
      }
      if (near && measures.knit * fit > 0.5 && (cell.layers >= 2 || cell.berm || cell.cubes)) {
        cell.soak = (cell.soak || 0) + dt * measures.knit * fit * 1.6;
        if ((cell.soak || 0) > 2.6 && cell.berm && !cell.knitted) {
          cell.knitted = true;
          cell.coat = (cell.coat || 1) + 1;
          sim.bedDirty = true;
          speak(sim, 'berm', 'The mound knits.');
        }
      }
    }
    if (cell.nutAt && sim.time - cell.nutAt > YEAR_SPAN * 1.4) sproutNut(sim, cell);
    if (cell.berm) {
      berms += 1;
      cell.stood = (cell.stood || 0) + dt;
    }
  }
  ageRelic(sim);
  updateSquirrels(sim, dt);
  sim.berms = berms;
  if (sim.chronicle) sim.chronicle.berms = berms;
  const state = circleState(sim.cells, HEARTH_I, HEARTH_K, PAD);
  if (state.closed) {
    sim.circleGap = 0;
    sim.gapSaid = '';
    sim.circleTime = (sim.circleTime || 0) + dt;
    if (!sim.circleSaid && sim.circleTime >= Math.min(28, seasonLength(sim) * 0.45)) {
      sim.circleSaid = true;
      sim.holding = true;
      if (sim.chronicle) sim.chronicle.circle = true;
      speak(sim, 'circle', 'The circle holds.');
    }
  } else if (sim.circleTime) {
    sim.circleGap = (sim.circleGap || 0) + dt;
    if (sim.circleGap > 4) {
      sim.circleTime = 0;
      sim.circleGap = 0;
      if (sim.holding) {
        sim.holding = false;
        sim.circleSaid = false;
        speak(sim, 'circle', 'The circle opens.');
      }
      if (state.missing && sim.gapSaid !== state.missing) {
        sim.gapSaid = state.missing;
        speak(sim, 'circle', `The ${state.missing} of the circle is open.`);
      }
    }
  } else if (state.filled >= 6 && state.missing && sim.gapSaid !== state.missing) {
    sim.gapSaid = state.missing;
    speak(sim, 'circle', `The ${state.missing} of the circle is open.`);
  }
  if (idolDepth(sim) > 0.02) sim.holding = false;
}

export function drawGrowth(draw, sim) {
  drawIdol(draw, sim);
  drawRises(draw, sim);
  for (const cell of sim.cells) {
    if (cell.berm || cell.cubes || cell.fruit || (cell.story || []).length) drawCrown(draw, cell);
    if ((cell.sill || 0) < -0.2) drawCut(draw, cell);
    if (cell.nutAt) drawNut(draw, cell);
    if (cell.mouth) drawMouth(draw, cell);
    if (cell.parched) drawParched(draw, cell);
    if ((cell.soak || 0) > 0.8) drawKnit(draw, sim, cell);
    if (!cell.berm && (cell.moisture > 0.55 || cell.compost > 0.4) && !cell.hearth && !cell.plot && cell.layers === 0) drawLush(draw, cell);
  }
  drawRelic(draw, sim);
  drawSparkles(draw, sim);
  drawSquirrels(draw, sim);
}

const SOIL = { width: 0.2, color: INK.humus, density: 2.6, emissive: false, depth: true };

function drawIdol(draw, sim) {
  const depth = idolDepth(sim);
  if (depth < 0.008 || !sim.hearth) return;
  const climb = Math.min(1, (depth - 0.008) / 0.07);
  const y = sim.hearth.elevation + 0.04 + climb * (PEDESTAL + 0.35);
  const x = sim.hearth.x;
  const z = sim.hearth.z;
  draw.streak([x - 0.24, y, z - 0.06], [x + 0.24, y, z + 0.08], WET);
  draw.streak([x - 0.06, y, z - 0.24], [x + 0.08, y, z + 0.24], WET);
}

const WOOD = { width: 0.045, color: INK.bark, density: 2.4, emissive: false, depth: true };
const HEART = { width: 0.04, color: INK.stick, density: 2.2, emissive: false, depth: true };

function groundY(cell) {
  let stack = cell.sunk || 0;
  for (const height of blockHeights(cell)) stack += height;
  return cell.elevation + (cell.land || 0) + stack;
}

function moundRise(cell) {
  if (cell.rock) return DIRT_CUBE;
  const coat = Math.min(cell.coat || 1, 6);
  const lift = cell.lift || 0;
  let rise = 0.5 + coat * 0.06 + lift * 0.1;
  if (cell.rooted) rise += 0.16;
  if (cell.raft) rise += Math.min(0.22, cell.raft * 0.1);
  const marks = cell.marks || {};
  if (marks.tend && marks.leaf && marks.snow && marks.rain) rise += DIRT_CUBE;
  return rise;
}

function stackHeight(cell) {
  let stack = cell.sunk || 0;
  for (const height of blockHeights(cell)) stack += height;
  return stack;
}

function settleOne(sim, cell) {
  if (!cell?.berm || cell.hearth) return false;
  const gain = brickGain(stackHeight(cell), moundRise(cell));
  if (gain > 0) {
    const blocks = blockHeights(cell).slice();
    blocks.push(gain);
    cell.cubes = (cell.cubes || 0) + 1;
    if (!cell.rockAge) cell.rockAge = sim.year || 1;
    while (blocks.length > DIRT_CAP) cell.sunk = (cell.sunk || 0) + blocks.shift();
    cell.block = blocks;
  }
  cell.berm = false;
  cell.rock = false;
  cell.lift = 0;
  cell.coat = 0;
  cell.layers = 0;
  cell.woods = [];
  cell.settle = 0;
  cell.stood = 0;
  return true;
}

export function settleMounds(sim) {
  const ready = (sim.cells || []).filter(cell => cell.berm && !cell.hearth);
  if (!ready.length) return 0;
  for (const cell of ready) settleOne(sim, cell);
  if (!sim.quiet && sim.motions) {
    ready.forEach((cell, index) => {
      sim.motions.push({
        kind: 'dust',
        t: -index * 0.4,
        dur: 0.55,
        x: cell.x,
        y: cell.elevation + 0.2,
        z: cell.z
      });
    });
  }
  sim.berms = 0;
  sim.bedDirty = true;
  speak(sim, 'ground', ready.length === 1 ? 'The mound becomes the ground.' : 'The mounds become the ground.');
  return ready.length;
}

function columnHeight(cell) {
  if (!cell || cell.hearth) return 0;
  let top = bedHeight(cell);
  if (cell.berm && cell.settle > 0) {
    const rise = Math.max(0, 1 - cell.settle / 1.25);
    const floor = cell.elevation + (cell.land || 0);
    top = floor + (top - floor) * rise;
  }
  return top - cell.elevation;
}

function riseName() {
  return 'soil';
}

const BRICK = 0.74;

function putBrick(draw, cubes, cell, y, scaleY = 1) {
  const model = cubes[riseName(cell)] || cubes.glade;
  if (!model) return false;
  const dist = Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K);
  const wide = GRID > 16 && dist >= 6 && !cell.channel && !cell.clearing;
  const span = wide ? 0.58 / 0.46 : 1;
  const options = span === 1 && scaleY === 1 ? undefined : { matrix: [span, 0, 0, 0, scaleY, 0, 0, 0, span] };
  return draw.model(model, [cell.x, y, cell.z], options);
}

function drawRises(draw, sim) {
  const cubes = sim.riseCubes;
  if (!cubes) return;
  const risen = [];
  for (const cell of sim.cells) {
    const h = columnHeight(cell);
    if (h > 0.12) risen.push([cell, h]);
  }
  risen.sort((a, b) => b[1] - a[1]);
  let left = 72;
  for (const [cell, h] of risen) {
    if (left <= 0) return;
    if (h <= BRICK * 1.15) {
      const scale = Math.min(1, Math.max(0.45, h / BRICK));
      if (!putBrick(draw, cubes, cell, cell.elevation + h / 2, scale)) return;
      left -= 1;
      continue;
    }
    const n = Math.min(6, Math.ceil(h / BRICK));
    for (let i = 0; i < n - 1 && left > 0; i++) {
      if (!putBrick(draw, cubes, cell, cell.elevation + BRICK / 2 + i * BRICK)) return;
      left -= 1;
    }
    if (left <= 0) return;
    if (!putBrick(draw, cubes, cell, cell.elevation + h - BRICK / 2)) return;
    left -= 1;
  }
}

function drawCut(draw, cell) {
  const y = cell.elevation + 0.05;
  const half = 0.34;
  const ink = { width: 0.1, color: INK.charcoal, density: 2.5, emissive: false, depth: true };
  draw.streak([cell.x - half, y, cell.z - half], [cell.x + half, y + 0.01, cell.z - half], ink);
  draw.streak([cell.x - half, y, cell.z + half], [cell.x + half, y + 0.01, cell.z + half], ink);
  draw.streak([cell.x - half, y, cell.z - half], [cell.x - half, y + 0.01, cell.z + half], ink);
  draw.streak([cell.x + half, y, cell.z - half], [cell.x + half, y + 0.01, cell.z + half], ink);
}

function drawNut(draw, cell) {
  const y = groundY(cell) + 0.04;
  draw.point([cell.x, y, cell.z], { width: 0.04, color: INK.bark, density: 2.4, emissive: false, depth: true });
}

function drawMouth(draw, cell) {
  const y = cell.elevation + 0.04;
  draw.streak([cell.x - 0.22, y, cell.z - 0.02], [cell.x + 0.22, y + 0.02, cell.z + 0.04], { ...WET, width: 0.07 });
}

function drawParched(draw, cell) {
  const y = groundY(cell) + 0.05;
  draw.streak([cell.x - 0.2, y, cell.z], [cell.x + 0.18, y + 0.02, cell.z + 0.03], { width: 0.06, color: INK.sand, density: 2.2, emissive: false, depth: true });
}

function drawKnit(draw, sim, cell) {
  let best = null;
  let score = 0;
  for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const next = sim.cells[(cell.k + dk) * GRID + cell.i + di];
    if (!next) continue;
    const value = (next.layers || 0) + (next.berm ? 3 : 0) + (next.cubes || 0);
    if (value > score) {
      score = value;
      best = next;
    }
  }
  if (!best) return;
  const y = groundY(cell) + 0.08;
  draw.streak([cell.x, y, cell.z], [best.x, groundY(best) + 0.08, best.z], { ...MOSS, width: 0.04 });
}

function drawCrown(draw, cell) {
  const y = cell.elevation + Math.max(0, columnHeight(cell)) + 0.03;
  if (cell.berm && !cell.rock) {
    draw.streak([cell.x - 0.22, y, cell.z - 0.06], [cell.x + 0.18, y + 0.04, cell.z + 0.08], WOOD);
    draw.streak([cell.x - 0.06, y, cell.z - 0.18], [cell.x + 0.08, y + 0.04, cell.z + 0.16], HEART);
  }
  if (cell.rock) {
    draw.streak([cell.x - 0.16, y, cell.z - 0.04], [cell.x + 0.12, y + 0.04, cell.z + 0.05], { ...MOSS, width: 0.05 });
  }
  if (cell.berm) {
    const marks = cell.marks || {};
    ['tend', 'leaf', 'snow', 'rain'].forEach((key, index) => {
      const a = index * (Math.PI / 2);
      const ox = Math.cos(a) * 0.16;
      const oz = Math.sin(a) * 0.16;
      const filled = marks[key];
      draw.point(
        [cell.x + ox, y + 0.05, cell.z + oz],
        { width: filled ? 0.032 : 0.016, color: filled ? (BAND[key] ?? INK.lush) : 1, density: 2.2, emissive: false, depth: true }
      );
    });
  }
  const story = cell.story || [];
  story.forEach((cause, index) => {
    const band = y + 0.03 + index * 0.045;
    if (cause === 'snow') {
      paintFlake(draw, cell.x - 0.08, band, cell.z - 0.02, 0.04);
      paintFlake(draw, cell.x + 0.02, band + 0.012, cell.z + 0.04, 0.034);
      paintFlake(draw, cell.x + 0.12, band, cell.z - 0.01, 0.028);
      return;
    }
    draw.streak(
      [cell.x - 0.22, band, cell.z - 0.04],
      [cell.x + 0.22, band + 0.02, cell.z + 0.05],
      { ...SOIL, width: 0.08, color: BAND[cause] ?? INK.lush }
    );
  });
  const marks = cell.marks || {};
  if (marks.leaf && !story.includes('leaf')) {
    paintLeaf(draw, cell.x - 0.06, y + 0.02, cell.z, 0.5);
    paintLeaf(draw, cell.x + 0.08, y + 0.03, cell.z + 0.05, 1.7);
  }
  if (marks.snow && !story.includes('snow')) {
    paintFlake(draw, cell.x - 0.05, y + 0.03, cell.z, 0.042);
    paintFlake(draw, cell.x + 0.07, y + 0.04, cell.z + 0.04, 0.034);
  }
  if (marks.tend && !(cell.settle > 0.3)) {
    if ((cell.growth || 0) < 0.5) {
      const top = y + 0.26;
      draw.streak([cell.x, y, cell.z], [cell.x + 0.03, top, cell.z], { ...DEEP, width: 0.03 });
      draw.streak([cell.x - 0.1, top - 0.02, cell.z], [cell.x + 0.12, top + 0.05, cell.z + 0.03], MOSS);
    } else {
      draw.streak([cell.x - 0.02, y, cell.z], [cell.x + 0.14, y + 0.06, cell.z + 0.03], FUNGI);
      draw.streak([cell.x + 0.04, y - 0.02, cell.z - 0.08], [cell.x + 0.16, y + 0.02, cell.z + 0.02], FUNGI);
    }
  }
  if (cell.fruit) paintCrop(draw, cell.fruit, cell.x, y + 0.08, cell.z, cell.fruitGrowth || 0);
}

function drawLush(draw, cell) {
  const y = groundY(cell) + 0.04;
  const j = (hash(cell.i * 3 + cell.k) - 0.5) * 0.2;
  draw.streak([cell.x - 0.08 + j, y, cell.z], [cell.x + 0.08, y + 0.03, cell.z + 0.06], MOSS);
  if (cell.compost > 0.4) {
    draw.streak([cell.x - 0.16, y + 0.02, cell.z - 0.06], [cell.x + 0.12, y + 0.05, cell.z + 0.08], { ...MOSS, color: INK.leaf });
  }
}

function drawRelic(draw, sim) {
  const cell = sim.hearth;
  if (!cell) return;
  const n = fernCount(sim.year);
  const x = cell.x;
  const z = cell.z;
  const foot = cell.elevation + PEDESTAL * 0.35;
  for (let i = 0; i < n; i++) {
    const angle = hash(i * 17 + 3) * Math.PI * 2;
    const lean = 0.1 + (i % 3) * 0.04;
    const top = foot + 0.16 + i * 0.07;
    draw.streak(
      [x + Math.cos(angle) * 0.06, foot, z + Math.sin(angle) * 0.06],
      [x + Math.cos(angle) * lean, top, z + Math.sin(angle) * lean],
      { ...DEEP, width: 0.02 }
    );
    draw.streak(
      [x + Math.cos(angle) * lean, top, z + Math.sin(angle) * lean],
      [x + Math.cos(angle) * (lean + 0.08), top + 0.03, z + Math.sin(angle) * (lean + 0.05)],
      { ...MOSS, width: 0.035 }
    );
  }
  if ((sim.year || 1) >= 4) {
    draw.streak([x - 0.18, cell.elevation + 0.05, z - 0.04], [x + 0.16, cell.elevation + 0.08, z + 0.06], MOSS);
  }
}

function drawSparkles(draw, sim) {
  const sets = sparkleSets(sim.year);
  const cell = sim.hearth;
  if (!sets || !cell) return;
  const count = Math.min(36, sets * 10);
  for (let i = 0; i < count; i++) {
    const angle = hash(i * 19) * Math.PI * 2 + sim.time * 0.12;
    const reach = 0.35 + hash(i * 7) * 2.15;
    const bob = 0.55 + hash(i * 3) * 1.5 + Math.sin(sim.time * 1.3 + i) * 0.06;
    draw.point(
      [cell.x + Math.cos(angle) * reach, cell.elevation + bob, cell.z + Math.sin(angle) * reach],
      { width: 0.028, color: i % 5 === 0 ? INK.brass : 6, density: 1.1, emissive: true, depth: true }
    );
  }
}

function ageRelic(sim) {
  const ferns = fernCount(sim.year);
  if (sim.ferns === undefined) sim.ferns = ferns;
  else if (ferns > sim.ferns) {
    sim.ferns = ferns;
    speak(sim, 'fern', 'A fern takes the figure.');
  }
  const sets = sparkleSets(sim.year);
  if (sim.sparkles === undefined) sim.sparkles = sets;
  else if (sets > sim.sparkles) {
    sim.sparkles = sets;
    speak(sim, 'glade', 'The glade takes more light.');
  }
}

function openGround(sim, cell) {
  if (!cell || cell.hearth || cell.tree || cell.plot || cell.berm || cell.log || cell.nutAt || cell.channel) return false;
  if (Math.hypot(cell.i - HEARTH_I, cell.k - HEARTH_K) < PAD) return false;
  const depth = sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
  return depth < 0.06;
}

function sproutNut(sim, cell) {
  if (sim.trees.filter(tree => tree.nut).length >= 8) {
    cell.nutAt = sim.time;
    return;
  }
  cell.nutAt = 0;
  if (!openGround(sim, cell) || cell.tree) return;
  cell.tree = true;
  const kind = hash(cell.i * 5 + cell.k * 3) > 0.45 ? 'oak' : 'serviceberry';
  sim.trees.push({
    i: cell.i,
    k: cell.k,
    x: cell.x,
    z: cell.z,
    kind,
    size: treeScale(hash(cell.i * 19 + cell.k * 7)),
    drop: cell.elevation + 0.4,
    cooldown: 2.2,
    planted: true,
    nut: true,
    growth: 0.1,
    group: 'tree',
    seed: 1 + Math.floor(hash((sim.time || 0) + cell.i * 13) * 900),
    rooted: false,
    age: 0
  });
  raiseLand(sim, cell, 0.025);
  speak(sim, 'nut', 'A nut takes.');
}

function nutGround(sim, cell, finger) {
  if (openGround(sim, cell)) return true;
  if (!finger || !cell || cell.hearth || cell.tree || cell.plot || cell.berm || cell.log || cell.nutAt) return false;
  const nearMouth = Math.hypot(cell.i - finger.mouth[0], cell.k - finger.mouth[1]) < 2.5;
  const nearGate = Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) < 2.3;
  if ((!nearMouth && !nearGate) || cell.channel) return false;
  const depth = sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
  return depth < 0.1;
}

function pickSpot(sim, salt, plant) {
  const state = circleState(sim.cells, HEARTH_I, HEARTH_K, PAD);
  const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
  let best = null;
  let bestScore = -1;
  for (let n = 0; n < 28; n++) {
    const i = Math.floor(hash(salt + n * 3.1) * GRID);
    const k = Math.floor(hash(salt + n * 5.7) * GRID);
    const cell = sim.cells[k * GRID + i];
    if (!cell || cell.hearth) continue;
    if (plant && !nutGround(sim, cell, finger)) continue;
    let value = hash(salt + n * 1.7);
    if (plant && state.missingIndex >= 0 && wedgeOf(cell.i, cell.k, HEARTH_I, HEARTH_K) === state.missingIndex) value += 4;
    if (plant && finger && Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) < 2.4) value += 3.2;
    if (plant && finger && Math.hypot(cell.i - finger.mouth[0], cell.k - finger.mouth[1]) < 2.6) value += 2.2;
    if (value > bestScore) {
      bestScore = value;
      best = cell;
    }
  }
  return best;
}

export function shooSquirrel(sim, cell) {
  if (!cell || !sim?.squirrels?.length) return false;
  let moved = false;
  for (const squirrel of sim.squirrels) {
    const here = Math.hypot(squirrel.x - cell.x, squirrel.z - cell.z);
    const aim = Math.hypot(squirrel.tx - cell.x, squirrel.tz - cell.z);
    if (here > 1.35 && aim > 1.15) continue;
    squirrel.plant = false;
    const dx = squirrel.x - cell.x;
    const dz = squirrel.z - cell.z;
    const len = Math.hypot(dx, dz) || 1;
    squirrel.tx = cell.x + (dx / len) * 2.4;
    squirrel.tz = cell.z + (dz / len) * 2.4;
    squirrel.pause = 0.15;
    moved = true;
  }
  if (moved) speak(sim, 'squirrel', 'The squirrel leaves that ground.');
  return moved;
}

export function seedSquirrels(sim) {
  const homes = sim.trees.filter(tree => !tree.planted);
  const made = [];
  for (let n = 0; n < 2; n++) {
    const home = homes[n] || homes[0];
    const cell = home ? sim.cells[home.k * GRID + home.i] : sim.cells[4 * GRID + 4];
    if (!cell) continue;
    made.push({
      x: cell.x + 0.35,
      z: cell.z + 0.15,
      tx: cell.x,
      tz: cell.z,
      yaw: n,
      hop: n,
      pause: 0.6 + n * 0.4,
      plant: false
    });
  }
  sim.squirrels = made;
}

function updateSquirrels(sim, dt) {
  if (!sim.squirrels) seedSquirrels(sim);
  if ((sim.year || 1) >= 6 && sim.squirrels.length < 3) {
    const cell = pickSpot(sim, sim.year * 9, false) || sim.hearth;
    if (cell && !cell.hearth) {
      sim.squirrels.push({ x: cell.x, z: cell.z, tx: cell.x, tz: cell.z, yaw: 0, hop: 0, pause: 0.4, plant: false });
    }
  }
  for (const squirrel of sim.squirrels) {
    if (squirrel.pause > 0) {
      squirrel.pause -= dt;
      continue;
    }
    const dx = squirrel.tx - squirrel.x;
    const dz = squirrel.tz - squirrel.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.14) {
      const cell = cellAt(sim.cells, squirrel.x, squirrel.z);
      const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
      if (squirrel.eat && cell?.nutAt) {
        cell.nutAt = 0;
        squirrel.eat = false;
        squirrel.ateYear = sim.year;
        if (sim.motions) sim.motions.push({ kind: 'dig', t: 0, dur: 0.6, x: cell.x, y: cell.elevation + 0.08, z: cell.z });
        speak(sim, 'squirrel', 'A squirrel remembers a nut.');
      } else if (squirrel.plant && cell && nutGround(sim, cell, finger)) {
        cell.nutAt = sim.time;
        speak(sim, 'squirrel', 'A squirrel plants a nut.');
      }
      squirrel.plant = false;
      squirrel.eat = false;
      squirrel.pause = 0.7 + hash(sim.time + squirrel.x) * 1.2;
      if (seasonOf(sim).id === 'WIN' && squirrel.ateYear !== sim.year) {
        const nuts = sim.cells.filter(item => item.nutAt && sim.time - item.nutAt > 10);
        if (nuts.length && hash(sim.time * 5 + squirrel.x) > 0.55) {
          const nut = nuts[Math.floor(hash(sim.time + squirrel.z) * nuts.length)];
          squirrel.tx = nut.x;
          squirrel.tz = nut.z;
          squirrel.eat = true;
          continue;
        }
      }
      const plant = hash(sim.time * 3 + squirrel.z) > 0.42;
      const next = pickSpot(sim, sim.time * 4 + squirrel.hop, plant);
      if (next) {
        squirrel.tx = next.x + (hash(next.i + sim.time) - 0.5) * 0.2;
        squirrel.tz = next.z + (hash(next.k * 3 + sim.time) - 0.5) * 0.2;
        squirrel.plant = plant;
      }
      continue;
    }
    const step = Math.min(dist, dt * 1.15);
    squirrel.x += (dx / dist) * step;
    squirrel.z += (dz / dist) * step;
    squirrel.yaw = Math.atan2(dz, dx);
    squirrel.hop = (squirrel.hop || 0) + dt * 9;
  }
}

function drawSquirrels(draw, sim) {
  for (const squirrel of sim.squirrels || []) {
    const cell = cellAt(sim.cells, squirrel.x, squirrel.z);
    const ground = cell ? walkHeight(cell) : 0.8;
    const hop = squirrel.pause > 0 ? 0 : Math.abs(Math.sin(squirrel.hop)) * 0.07;
    const y = ground + 0.04 + hop;
    const fx = Math.cos(squirrel.yaw);
    const fz = Math.sin(squirrel.yaw);
    draw.streak(
      [squirrel.x - fx * 0.06, y, squirrel.z - fz * 0.06],
      [squirrel.x + fx * 0.08, y + 0.025, squirrel.z + fz * 0.08],
      { width: 0.042, color: INK.bark, density: 2.3, emissive: false, depth: true }
    );
    draw.streak(
      [squirrel.x - fx * 0.04, y + 0.02, squirrel.z - fz * 0.04],
      [squirrel.x - fx * 0.12, y + 0.1, squirrel.z - fz * 0.11],
      { width: 0.028, color: INK.ember, density: 1.8, emissive: false, depth: true }
    );
  }
}
