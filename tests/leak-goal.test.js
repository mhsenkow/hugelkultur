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
        channel: false
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  return cells[k * 16 + i];
}

function wetMap(cells, spots) {
  const wet = new Set(spots.map(([i, k]) => `${i},${k}`));
  return (x, z) => {
    const i = Math.round(x + 8 - 0.5);
    const k = Math.round(z + 8 - 0.5);
    return { depth: wet.has(`${i},${k}`) ? 0.24 : 0, velocity: [0, 0] };
  };
}

function worker(cells, sample) {
  return {
    cells,
    hearth: at(cells, 8, 8),
    held: false,
    holding: false,
    carrying: true,
    carryKind: 'oak',
    loose: [{ x: at(cells, 8, 4).x, z: at(cells, 8, 4).z, fall: false, kind: 'oak' }],
    trees: [],
    plots: [],
    live: [{ bit: 1, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    measures: null,
    spiritId: 'cloud',
    seasonIndex: 0,
    year: 2,
    time: 4,
    snapshot: { sample },
    character: { st: { x: at(cells, 8, 4).x, z: at(cells, 8, 4).z, vx: 0, vz: 0 } },
    guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 0 }
  };
}

function toward(goal, wetI, wetK) {
  return (goal.i - 8) * (wetI - 8) + (goal.k - 8) * (wetK - 8);
}

test('he builds against water that can reach the idol, not the dry gate', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  const cells = board();
  const gate = at(cells, 8, 6);
  gate.berm = true;
  gate.layers = 3;
  gate.coat = 1;
  const sim = worker(cells, wetMap(cells, [[4, 12], [3, 12], [4, 13]]));
  sim.measures = rules.blankMeasures();
  sim.live[0].bit = world.FLOW.SPR;

  guide.steer(sim, 0.2, false);
  const goal = sim.guide.goal;
  assert.equal(goal.kind, 'place');
  assert.equal(sim.guide.method, 'dam');
  assert.ok(toward(goal, 4, 12) > 0, `placed at ${goal.i},${goal.k}`);
  assert.ok(!(goal.i === 8 && goal.k === 6));
  assert.ok(Math.hypot(goal.i - 8, goal.k - 8) > 1.85);
  assert.ok(sim.events.some(event => /Water comes from the (south|southwest|west)/.test(event.text)));

  const first = { i: goal.i, k: goal.k };
  at(cells, goal.i, goal.k).layers = 1;
  sim.guide.goal = null;
  guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.goal.i, first.i);
  assert.equal(sim.guide.goal.k, first.k);
  assert.equal(sim.events.filter(event => event.text.includes('Water comes from')).length, 1);

  at(cells, goal.i, goal.k).layers = 3;
  sim.guide.goal = null;
  guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.method, 'dam');
  assert.ok(toward(sim.guide.goal, 4, 12) > 0, `next gap ${sim.guide.goal.i},${sim.guide.goal.k}`);
  assert.ok(!(sim.guide.goal.i === first.i && sim.guide.goal.k === first.k));
});

test('closer water outranks a farther sheet and a dry board still has other work', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  const cells = board();
  const sim = worker(cells, wetMap(cells, [[8, 3], [8, 2], [4, 12]]));
  sim.measures = rules.blankMeasures();
  sim.live[0].bit = world.FLOW.SPR;
  guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.goal.kind, 'place');
  assert.ok(sim.guide.goal.k < 8, `followed the near water to ${sim.guide.goal.i},${sim.guide.goal.k}`);

  const dryCells = board();
  const dry = worker(dryCells, () => ({ depth: 0, velocity: [0, 0] }));
  dry.measures = rules.blankMeasures();
  dry.live[0].bit = world.FLOW.SPR;
  dry.carrying = false;
  guide.steer(dry, 0.2, false);
  assert.ok(dry.guide.goal);
  assert.equal(dry.events.some(event => event.text.includes('Water comes from')), false);
});

test('he stays up when water is already against the idol', async () => {
  const day = await import('../hugelkultur/day.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  function night(sample) {
    const cells = board();
    const here = at(cells, 8, 4);
    return {
      cells,
      hearth: at(cells, 8, 8),
      trees: [],
      loose: [],
      spiritId: 'cloud',
      time: day.DAY * 0.86,
      events: [],
      carrying: false,
      over: false,
      snapshot: { sample },
      character: {
        st: { x: here.x, z: here.z, y: 0.9, gh: 0.9, vx: 0, vy: 0, vz: 0, dead: -1, born: 2, ground: true, face: 0 }
      },
      guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0 }
    };
  }

  const wet = night(wetMap(board(), [[6, 11]]));
  day.updateDay(wet, 0.2, false);
  assert.equal(wet.resting ?? null, null);

  const calm = night(() => ({ depth: 0, velocity: [0, 0] }));
  day.updateDay(calm, 0.2, false);
  assert.equal(calm.resting, 'sleep');
});
