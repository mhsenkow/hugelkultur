import { GRID, ORIGIN, FLOW, bedHeight, cellAt, isMouth, copyFingers, revealGlade } from './world.js?v=hold';
import { pressureOf, idolStage, yearTitle, freshChronicle, holdsWater, EDGE_NAME, SEASON_NAME, noteYear, idolVoice } from './clearing.js?v=hold';
import { settleMounds } from './growth.js?v=hold';

export const SEASON_LENGTH = 52;

export const SEASONS = [
  { id: 'SPR', edge: 'N', bit: FLOW.SPR, pip: '#4fd18b', inflow: 0.18, drain: 0.006, friction: 0.16, line: 'Spring. Rain from the north.' },
  { id: 'SUM', edge: 'E', bit: FLOW.SUM, pip: '#e0a04a', inflow: 0.07, drain: 0.055, friction: 0.22, line: 'Summer. It is clear.' },
  { id: 'AUT', edge: 'S', bit: FLOW.AUT, pip: '#d97736', inflow: 0.22, drain: 0.008, friction: 0.14, line: 'Autumn. Leaves fall.' },
  { id: 'WIN', edge: 'W', bit: FLOW.WIN, pip: '#9fd4e8', inflow: 0.09, drain: 0.014, friction: 0.4, line: 'Winter. Snow.' }
];

export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

const SEDIMENT = (color, strength) => ({ color, strength, height: 0.35, scale: 7 });

const LOOKS = {
  SPR: {
    tint: [0.34, 0.66, 0.98],
    extinction: [14, 10, 5],
    surfaceColor: [0.52, 0.78, 1],
    surface: 0.7,
    caustics: 0.16,
    foam: 0.1,
    depthRange: [1.1, 3.8],
    sediment: SEDIMENT([0.4, 0.62, 0.7], 0.04)
  },
  SUM: {
    tint: [0.22, 0.48, 0.9],
    extinction: [18, 12, 6],
    surfaceColor: [0.32, 0.58, 0.98],
    surface: 0.66,
    caustics: 0.2,
    foam: 0.08,
    depthRange: [1.2, 4.2],
    sediment: SEDIMENT([0.25, 0.45, 0.62], 0.02)
  },
  AUT: {
    tint: [0.48, 0.42, 0.26],
    extinction: [12, 10, 7],
    surfaceColor: [0.68, 0.5, 0.28],
    surface: 0.5,
    caustics: 0.06,
    foam: 0.14,
    depthRange: [0.9, 3.2],
    sediment: SEDIMENT([0.58, 0.38, 0.16], 0.48)
  },
  WIN: {
    tint: [0.82, 0.9, 0.98],
    extinction: [8, 8, 6],
    surfaceColor: [0.92, 0.96, 1],
    surface: 0.84,
    caustics: 0.03,
    foam: 0.06,
    depthRange: [0.7, 2.6],
    sediment: SEDIMENT([0.84, 0.9, 0.95], 0.32)
  }
};

export function seasonOf(sim) {
  return SEASONS[sim.seasonIndex];
}

export function seasonLength(sim) {
  return seasonOf(sim).id === 'SUM' ? 84 : SEASON_LENGTH;
}

function atMouth(cells, x, z, edge) {
  return isMouth(cellAt(cells, x, z), edge);
}

export function seasonOptics(season) {
  const id = season?.id || season;
  return LOOKS[id] || LOOKS.SUM;
}

function opticsFor(season) {
  return seasonOptics(season);
}

function terrainAt(sim, x, z) {
  const cell = cellAt(sim.cells, x, z);
  const height = cell ? bedHeight(cell) : 1.4;
  return Number.isFinite(height) ? height : 1.4;
}

function rateOf(value, cap = 8) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(cap, n);
}

export function createWater(KIT, sim) {
  if (!sim.live) sim.live = copyFingers();
  const solver = KIT.procedural.motion.shallowWater({
    width: GRID,
    height: GRID,
    cell: [1, 1],
    origin: [ORIGIN, ORIGIN],
    terrain: (x, z) => terrainAt(sim, x, z),
    initial: (x, z) => {
      const cell = cellAt(sim.cells, x, z);
      if (!isMouth(cell, 'N')) return 0;
      return { depth: 0.05, velocity: [0, 0.04] };
    }
  });
  sim.solver = solver;
  sim.bedDirty = false;
  publish(sim);
}

function publish(sim) {
  const shot = sim.solver.snapshot();
  sim.snapshot = shot;
  try {
    const { waterBodies } = sim.kit.KIT.procedural;
    const body = waterBodies.fromShallowWater(shot, { id: 'clearing', optics: opticsFor(seasonOf(sim)) });
    sim.world.water = waterBodies.scene([body]);
  } catch {
    /* keep the last water that drew */
  }
}

function rememberWater(sim) {
  if (!sim.snapshot?.sample) return;
  for (const cell of sim.cells) {
    if (cell.hearth) continue;
    const depth = sim.snapshot.sample(cell.x, cell.z)?.depth || 0;
    if (depth > 0.04) cell.stain = Math.min(1, (cell.stain || 0) + 0.28);
  }
}

function thickness(sim, i, k) {
  const cell = sim.cells[k * GRID + i];
  if (!cell) return 99;
  let blocks = cell.sunk || 0;
  if (Array.isArray(cell.block) && cell.block.length) {
    for (const height of cell.block) blocks += height;
  } else blocks += (cell.cubes || 0) * 0.74;
  return (cell.berm ? 4 : 0) + (cell.layers || 0) + (cell.lift || 0) + (cell.coat || 0) + blocks * 4;
}

export function sidleGate(sim, season) {
  const finger = sim.live?.find(item => item.bit === season.bit);
  if (!finger) return false;
  const [gi, gk] = finger.gate;
  const [mi, mk] = finger.mouth;
  let held = false;
  for (const cell of sim.cells) {
    if (Math.hypot(cell.i - gi, cell.k - gk) > 1.75) continue;
    if (holdsWater(cell)) held = true;
  }
  if (!held) return false;
  const dx = gi - mi;
  const dz = gk - mk;
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  let best = null;
  let bestThick = 1e9;
  for (const side of [-1, 1]) {
    const i = Math.max(0, Math.min(GRID - 1, Math.round(gi + px * side * 1.5)));
    const k = Math.max(0, Math.min(GRID - 1, Math.round(gk + pz * side * 1.5)));
    const cell = sim.cells[k * GRID + i];
    if (!cell || cell.hearth || cell.tree) continue;
    const dist = Math.hypot(i - 8, k - 8);
    if (dist < 2.1) continue;
    const thick = thickness(sim, i, k);
    if (thick < bestThick) {
      bestThick = thick;
      best = cell;
    }
  }
  if (!best || (best.i === gi && best.k === gk)) return false;
  const old = sim.cells[gk * GRID + gi];
  if (old) {
    old.stain = Math.min(1, (old.stain || 0) + 0.55);
    old.oldGate = true;
  }
  finger.gate = [best.i, best.k];
  best.sill = Math.min(best.sill || 0, 0) - 0.12;
  best.channel = true;
  sim.bedDirty = true;
  if (best.lastWood) {
    sim.chronicle.wood = best.lastWood;
    sim.chronicle.edge = finger.edge;
  } else if (old?.lastWood) {
    sim.chronicle.wood = old.lastWood;
    sim.chronicle.edge = finger.edge;
  }
  if (!sim.quiet) sim.events.push({ type: 'note', text: 'The water looks for another way.' });
  return true;
}

export function markMouth(sim) {
  if (!sim?.cells) return;
  const season = seasonOf(sim);
  const finger = sim.live?.find(item => item.bit === season.bit);
  for (const cell of sim.cells) cell.mouth = false;
  if (!finger) return;
  const [mi, mk] = finger.mouth;
  const [gi, gk] = finger.gate;
  for (const cell of sim.cells) {
    const mouth = Math.hypot(cell.i - mi, cell.k - mk) < 1.45;
    const gate = Math.hypot(cell.i - gi, cell.k - gk) < 1.25;
    if (!mouth && !gate) continue;
    cell.mouth = true;
    const press = pressureOf(sim.year, sim.measures?.climb);
    const heavy = Math.min(1, 0.55 + press / 10);
    cell.stain = Math.min(1, Math.max(cell.stain || 0, (gate ? 0.78 : 0.55) * heavy));
  }
}

function gateHeld(sim) {
  const finger = sim.live?.find(item => item.bit === seasonOf(sim).bit);
  if (!finger) return false;
  return sim.cells.some(cell => Math.hypot(cell.i - finger.gate[0], cell.k - finger.gate[1]) <= 1.75 && holdsWater(cell));
}

export function waterLine(sim, stage) {
  const season = seasonOf(sim);
  const edge = EDGE_NAME[season.edge] || 'north';
  const gate = `The ${edge} gate is ${gateHeld(sim) ? 'held' : 'open'}.`;
  const name = SEASON_NAME[season.id] || 'The year';
  if (stage === 'hem') return `${name} comes from the ${edge}. ${gate}`;
  if (stage === 'drinks') return `The idol drinks. ${gate}`;
  if (stage === 'under') return `The idol is under. ${gate}`;
  return 'The idol is dry.';
}

function puffAt(sim, finger, mode, ink) {
  if (!finger || !sim.motions) return;
  const cell = sim.cells[finger.gate[1] * GRID + finger.gate[0]]
    || sim.cells[finger.mouth[1] * GRID + finger.mouth[0]];
  if (!cell) return;
  sim.motions.push({
    kind: 'puff',
    t: 0,
    dur: 2,
    mode,
    ink,
    x: cell.x,
    y: cell.elevation + 0.28,
    z: cell.z
  });
}

export function closeSeason(sim) {
  const finished = seasonOf(sim);
  rememberWater(sim);
  if (!sim.quiet) {
    const line = idolVoice(sim.seasonPeak || 'dry');
    if (line) sim.events.push({ type: 'idol', text: line });
    const next = SEASONS[(sim.seasonIndex + 1) % SEASONS.length];
    puffAt(sim, sim.live?.find(item => item.bit === finished.bit), 'exhale', finished.id);
    puffAt(sim, sim.live?.find(item => item.bit === next.bit), 'inhale', next.id);
  }
  sim.seasonPeak = 'dry';
  if ((sim.flood || 0) < 1) sidleGate(sim, finished);
  sim.seasonTime = 0;
  sim.seasonIndex = (sim.seasonIndex + 1) % SEASONS.length;
  const rolled = sim.seasonIndex === 0;
  if (rolled) {
    sim.chronicle.berms = sim.berms || 0;
    sim.yearLine = yearTitle(sim.chronicle);
    noteYear(sim);
    if (!sim.quiet) sim.events.push({ type: 'year', text: sim.yearLine });
    sim.notches = (sim.notches || 0) + 1;
    if (!sim.quiet && sim.hearth && sim.motions) {
      const h = sim.hearth;
      sim.motions.push({
        kind: 'bird',
        t: 0,
        dur: 4,
        x0: h.x - 3.2,
        z0: h.z - 2.6,
        x1: h.x + 3.8,
        z1: h.z + 2.1,
        y: h.elevation + 2.35
      });
    }
    sim.year += 1;
    sim.chronicle = freshChronicle();
    revealGlade(sim);
  }
  if (!sim.quiet) sim.events.push({ type: 'season', text: seasonOf(sim).line });
  if (rolled) settleMounds(sim);
  markMouth(sim);
  return finished;
}

export function updateWater(sim, dt) {
  if (sim.over) return;
  sim.seasonTime += dt;
  let turned = 0;
  while (sim.seasonTime >= seasonLength(sim) && turned < 8 && !sim.over) {
    const extra = sim.seasonTime - seasonLength(sim);
    closeSeason(sim);
    sim.seasonTime = extra;
    turned += 1;
  }
  if (sim.bedDirty) {
    try {
      sim.solver.setTerrain((x, z) => terrainAt(sim, x, z));
      sim.bedDirty = false;
    } catch {
      sim.bedDirty = false;
    }
  }
  const current = seasonOf(sim);
  const leave = OPPOSITE[current.edge];
  const press = pressureOf(sim.year, sim.measures?.climb);
  const ease = 1 / (1 + Math.max(0, sim.year - 1) * Math.min(0.18, sim.measures?.climb ?? 0.22));
  const tick = Number.isFinite(dt) ? Math.max(0, Math.min(0.4, dt)) : 0;
  if (tick > 0) {
    try {
      sim.solver.step(tick, {
        friction: current.friction,
        rain: (x, z) => {
          let rate = atMouth(sim.cells, x, z, current.edge) ? Math.min(8, current.inflow * press) : 0;
          const thaw = Number(cellAt(sim.cells, x, z)?.thaw);
          if (Number.isFinite(thaw) && thaw > 0) rate += Math.min(0.02, thaw);
          return rateOf(rate);
        },
        drain: (x, z, _t, state) => {
          let rate = current.drain * ease;
          if (atMouth(sim.cells, x, z, leave)) rate += 0.04;
          if (state.depth < 0.02) rate += 0.012;
          return rateOf(rate, 1e4);
        }
      });
    } catch {
      /* a stiff tick is skipped. The cube still turns. */
    }
  }
  try {
    publish(sim);
  } catch {
    /* keep the last water that drew */
  }

  const depth = idolDepth(sim);
  const stage = idolStage(depth);
  if (Number.isFinite(depth) && depth > (sim.highWater || 0)) sim.highWater = depth;
  if (!Number.isFinite(sim.flood)) sim.flood = 0;
  const rank = { dry: 0, hem: 1, drinks: 2, under: 3 };
  if ((rank[stage] || 0) > (rank[sim.seasonPeak] || 0)) sim.seasonPeak = stage;
  if (stage === 'drinks') sim.flood += dt * 0.05;
  else if (stage === 'under') sim.flood += dt * 0.2;
  else if (stage === 'hem') sim.flood = Math.max(0, sim.flood - dt * 0.04);
  else sim.flood = Math.max(0, sim.flood - dt * 0.28);
  if (sim.stageSaid !== stage) {
    const prev = sim.stageSaid;
    sim.stageSaid = stage;
    const worse = (rank[stage] || 0) > (rank[prev] || 0);
    const recovered = stage === 'dry' && (rank[prev] || 0) >= 2;
    if (prev && !sim.quiet && (worse || recovered)) sim.events.push({ type: 'flood', text: waterLine(sim, stage) });
    if (stage === 'drinks' && worse && !sim.quiet && sim.hearth && sim.motions) {
      const hit = sim.snapshot?.sample?.(sim.hearth.x, sim.hearth.z);
      sim.motions.push({
        kind: 'ripple',
        t: 0,
        dur: 1.8,
        x: sim.hearth.x,
        y: (hit?.level || sim.hearth.elevation) + 0.02,
        z: sim.hearth.z
      });
    }
  }
  if (sim.flood >= 9) {
    sim.over = true;
    sim.chronicle.drank = true;
    sim.events.push({ type: 'flood', text: 'The idol is wet.' });
  }
}

export function idolDepth(sim) {
  const cell = sim.hearth;
  if (!cell || !sim.snapshot?.sample) return 0;
  return sim.snapshot.sample(cell.x, cell.z)?.depth || 0;
}

export function clearingDepth(sim) {
  if (!sim.snapshot?.sample) return 0;
  let depth = 0;
  for (const cell of sim.cells) {
    if (!cell.clearing || cell.hearth) continue;
    depth = Math.max(depth, sim.snapshot.sample(cell.x, cell.z)?.depth || 0);
  }
  return depth;
}
