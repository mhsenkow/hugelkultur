const test = require('node:test');
const assert = require('node:assert/strict');

function board() {
  const cells = [];
  for (let k = 0; k < 16; k++) {
    for (let i = 0; i < 16; i++) {
      cells.push({
        i,
        k,
        x: -8 + i + 0.5,
        z: -8 + k + 0.5,
        elevation: 0.9,
        land: 0,
        layers: 0,
        cubes: 0,
        berm: false,
        coat: 0,
        lift: 0,
        mass: 0,
        hearth: i === 8 && k === 8,
        plot: null,
        tree: null,
        rock: false,
        log: false,
        snow: 0,
        thaw: 0,
        sill: 0,
        channel: false
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  return cells[k * 16 + i];
}

test('snow drifts downhill in winter, and a deep pile outlasts a shallow one into summer', async () => {
  const weather = await import('../hugelkultur/weather.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const cells = board();
  const high = at(cells, 2, 8);
  const low = at(cells, 3, 8);
  high.elevation = 3;
  low.elevation = 0.4;
  high.snow = 1.8;
  const sim = {
    cells,
    hearth: at(cells, 8, 8),
    seasonIndex: 3,
    weatherSeason: 3,
    seasonTime: 20,
    time: 10,
    fall: [],
    fallAcc: 0,
    events: [],
    live: [],
    over: false
  };
  weather.updateWeather(sim, 8);
  assert.ok(low.snow > 0.3, `the hollow caught ${low.snow}`);
  assert.ok(high.snow < 1.8, `the ridge gave some up, ${high.snow}`);
  assert.ok(world.bedHeight(high) > world.bedHeight({ ...high, snow: 0 }) + 0.05);

  const summer = board();
  const quilt = at(summer, 4, 4);
  const drift = at(summer, 5, 4);
  quilt.snow = 0.2;
  drift.snow = 2;
  const warm = {
    cells: summer,
    hearth: at(summer, 8, 8),
    seasonIndex: 1,
    weatherSeason: 1,
    seasonTime: 20,
    time: 30,
    fall: [],
    fallAcc: 0,
    events: [],
    live: [],
    over: false
  };
  weather.updateWeather(warm, 2);
  assert.ok(quilt.snow < 0.02, `shallow snow left ${quilt.snow}`);
  assert.ok(drift.snow > 1.5, `the drift is still ${drift.snow}`);
  assert.ok(quilt.thaw > drift.thaw && drift.thaw > 0, `thaw quilt ${quilt.thaw} drift ${drift.thaw}`);
});

test('a deep spring pack soaks in and leaves the idol dry', async () => {
  const weather = await import('../hugelkultur/weather.js');
  const world = await import('../hugelkultur/world.js');
  const core = require('..');
  world.useGrid(16);
  const cells = board();
  for (const cell of cells) {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    cell.elevation = dist < 2.2 ? 1.05 : 0.7 + dist * 0.012;
    cell.snow = cell.hearth ? 0 : 2.2;
    cell.moisture = 1;
  }
  const sim = {
    cells,
    hearth: at(cells, 8, 8),
    seasonIndex: 0,
    weatherSeason: 0,
    seasonTime: 8,
    time: 10,
    fall: [],
    fallAcc: 0,
    events: [],
    live: [],
    over: false
  };
  const solver = core.load().KIT.procedural.motion.shallowWater({
    width: 16,
    height: 16,
    cell: [1, 1],
    origin: [-8, -8],
    terrain: (x, z) => {
      const i = Math.max(0, Math.min(15, Math.floor(x + 8)));
      const k = Math.max(0, Math.min(15, Math.floor(z + 8)));
      const dist = Math.hypot(i - 8, k - 8);
      return dist < 2.2 ? 1.05 : 0.7 + dist * 0.012;
    },
    initial: () => 0
  });
  let volume = 0;
  let idol = 0;
  for (let n = 0; n < 26; n++) {
    weather.updateWeather(sim, 2);
    for (const cell of cells) volume += (cell.thaw || 0) * 2;
    const shot = solver.step(2, {
      friction: 0.16,
      rain: (x, z) => {
        const i = Math.max(0, Math.min(15, Math.floor(x + 8)));
        const k = Math.max(0, Math.min(15, Math.floor(z + 8)));
        return Math.min(0.02, cells[k * 16 + i].thaw || 0);
      },
      drain: (_x, _z, _t, state) => (state.depth < 0.02 ? 0.018 : 0.006)
    });
    idol = shot.sample(0.5, 0.5).depth;
    sim.time += 2;
    sim.seasonTime += 2;
  }
  const court = cells.filter(cell => !cell.hearth && Math.hypot(cell.i - 8, cell.k - 8) < 2.35);
  assert.ok(court.every(cell => !(cell.thaw > 0)), 'the knoll keeps its melt');
  assert.ok(volume < 12, `freshet ${volume}`);
  assert.ok(idol < 0.02, `idol depth ${idol}`);
  assert.ok(cells.some(cell => cell.snow > 0.4), 'a deep pack outlasts the spring');
});

test('a wall home gets a step, and water on the idol is turned outward', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  const walled = board();
  for (const cell of walled) if (cell.k === 4) cell.cubes = 1;
  const here = at(walled, 8, 2);
  const trapped = {
    cells: walled,
    hearth: at(walled, 8, 8),
    held: false,
    holding: false,
    carrying: true,
    carryKind: 'oak',
    loose: [],
    trees: [],
    plots: [],
    live: [{ bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    seasonIndex: 0,
    year: 3,
    time: 4,
    character: { st: { x: here.x, z: here.z, vx: 0, vz: 0 } },
    guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 0, method: 'dam' }
  };
  guide.steer(trapped, 0.2, false);
  assert.equal(trapped.guide.method, 'stair');
  assert.equal(trapped.guide.goal.kind, 'place');
  assert.ok(trapped.guide.goal.k < 4, `step at ${trapped.guide.goal.i},${trapped.guide.goal.k}`);
  assert.ok(trapped.events.some(event => event.text === 'You lay a step.'));

  const cells = board();
  const bank = at(cells, 8, 4);
  const wet = new Set(['8,11', '8,12', '9,12']);
  const flooded = {
    cells,
    hearth: at(cells, 8, 8),
    held: false,
    holding: false,
    carrying: false,
    loose: [{ x: bank.x, z: bank.z, fall: false, kind: 'oak' }],
    trees: [],
    plots: [],
    live: [{ bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    seasonIndex: 0,
    year: 4,
    time: 4,
    snapshot: {
      sample: (x, z) => {
        const i = Math.round(x + 8 - 0.5);
        const k = Math.round(z + 8 - 0.5);
        if (i === 8 && k === 8) return { depth: 0.03, velocity: [0, 0] };
        return { depth: wet.has(`${i},${k}`) ? 0.3 : 0, velocity: [0, 0] };
      }
    },
    character: { st: { x: bank.x, z: bank.z, vx: 0, vz: 0 } },
    guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 0, method: 'dam' }
  };
  guide.steer(flooded, 0.2, false);
  assert.equal(flooded.guide.method, 'divert');
  assert.equal(flooded.guide.goal.kind, 'cut');
  assert.ok(flooded.guide.goal.k > 8, `gutter at ${flooded.guide.goal.i},${flooded.guide.goal.k}`);
  assert.ok(flooded.events.some(event => event.text === 'You turn the water aside.'));
});
