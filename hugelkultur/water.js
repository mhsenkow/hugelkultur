import { GRID, ORIGIN, FLOW, bedHeight, cellAt, isMouth } from './world.js';

export const SEASON_LENGTH = 52;

export const SEASONS = [
  { id: 'SPR', edge: 'N', bit: FLOW.SPR, pip: '#4fd18b', inflow: 0.18, drain: 0.006, friction: 0.16, line: 'Spring. Rain from the north.' },
  { id: 'SUM', edge: 'E', bit: FLOW.SUM, pip: '#e0a04a', inflow: 0.07, drain: 0.055, friction: 0.22, line: 'Summer. It is clear.' },
  { id: 'AUT', edge: 'S', bit: FLOW.AUT, pip: '#d97736', inflow: 0.22, drain: 0.008, friction: 0.14, line: 'Autumn. Leaves fall.' },
  { id: 'WIN', edge: 'W', bit: FLOW.WIN, pip: '#9fd4e8', inflow: 0.09, drain: 0.014, friction: 0.4, line: 'Winter. Snow.' }
];

const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

// The stipple look keeps a pixel only when its luminance lands on the tide stop.
// From the isometric camera the Fresnel sheen is thin, so the volume itself has to
// be a bright pale cyan once the water is more than a film.
const SUMMER_LOOK = {
  tint: [0.32, 0.62, 0.96],
  extinction: [16, 11, 6],
  surfaceColor: [0.45, 0.72, 1],
  surface: 0.72,
  caustics: 0.12,
  foam: 0.12,
  depthRange: [1.2, 4]
};

const WINTER_LOOK = {
  tint: [0.55, 0.75, 0.98],
  extinction: [10, 8, 6],
  surfaceColor: [0.7, 0.86, 1],
  surface: 0.8,
  caustics: 0.04,
  foam: 0.08,
  depthRange: [1.2, 4]
};

export function seasonOf(sim) {
  return SEASONS[sim.seasonIndex];
}

function atMouth(cells, x, z, edge) {
  return isMouth(cellAt(cells, x, z), edge);
}

function opticsFor(season) {
  return season.id === 'WIN' ? WINTER_LOOK : SUMMER_LOOK;
}

function terrainAt(sim, x, z) {
  const cell = cellAt(sim.cells, x, z);
  return cell ? bedHeight(cell) : 1.4;
}

export function createWater(KIT, sim) {
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
  const { waterBodies } = sim.kit.KIT.procedural;
  const body = waterBodies.fromShallowWater(shot, { id: 'clearing', optics: opticsFor(seasonOf(sim)) });
  sim.world.water = waterBodies.scene([body]);
}

export function updateWater(sim, dt) {
  if (sim.over) return;
  sim.seasonTime += dt;
  if (sim.seasonTime >= SEASON_LENGTH) {
    sim.seasonTime = 0;
    sim.seasonIndex = (sim.seasonIndex + 1) % SEASONS.length;
    if (sim.seasonIndex === 0) sim.year += 1;
    sim.events.push({ type: 'season', text: seasonOf(sim).line });
  }
  if (sim.bedDirty) {
    sim.solver.setTerrain((x, z) => terrainAt(sim, x, z));
    sim.bedDirty = false;
  }
  const current = seasonOf(sim);
  const leave = OPPOSITE[current.edge];
  sim.solver.step(dt, {
    friction: current.friction,
    rain: (x, z) => (atMouth(sim.cells, x, z, current.edge) ? current.inflow : 0),
    drain: (x, z, _t, state) => {
      let rate = current.drain;
      if (atMouth(sim.cells, x, z, leave)) rate += 0.04;
      if (state.depth < 0.02) rate += 0.012;
      return rate;
    }
  });
  publish(sim);

  const depth = idolDepth(sim);
  if (depth > 0.035) sim.flood += dt;
  else sim.flood = Math.max(0, sim.flood - dt * 0.45);
  if (sim.flood >= 6) {
    sim.over = true;
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
