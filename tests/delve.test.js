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
        clearing: Math.hypot(i - 8, k - 8) <= 1.85,
        moisture: 0.2,
        snow: 0,
        litter: 0
      });
    }
  }
  return cells;
}

function ring(cells) {
  for (const cell of cells) {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    if (dist <= 1.85 || dist >= 3.35) continue;
    cell.berm = false;
    cell.layers = 0;
    cell.cubes = 2;
    cell.block = [0.74, 0.74];
  }
}

test('the druid stakes a store and closes it', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  const cells = board();
  ring(cells);
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    events: [],
    quiet: true,
    year: 3,
    holding: true,
    circleSaid: true
  };
  assert.equal(rules.eraOf(sim), 'ring');
  plan.planKeep(sim);
  const room = sim.plan.rooms.find(item => item.name === 'store');
  assert.ok(room && !room.closed);
  for (const cell of cells) {
    if (!cell.planned || cell.plannedDoor) continue;
    cell.cubes = 2;
    cell.block = [0.74, 0.74];
    cell.berm = false;
  }
  const door = cells.find(cell => cell.plannedDoor);
  assert.ok(door);
  door.lintel = true;
  plan.planKeep(sim);
  assert.equal(room.closed, true);
  const rooms = rules.roomsOf(cells, 8, 8);
  assert.ok(rooms.some(item => item.name === 'store'), rooms.map(item => item.name).join(','));
  assert.equal(rules.eraOf(sim), 'keep');
});

test('a grate passes water and a deep moat stops a beast', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  assert.equal(rules.stops({ grate: true }, 'water'), false);
  assert.equal(rules.stops({ grate: true }, 'beast'), true);
  assert.equal(rules.stops({ grate: true }, 'people'), true);
  assert.equal(rules.stops({ moat: true, moatDeep: true, sill: -0.5 }, 'beast'), true);
  assert.equal(rules.stops({ moat: true, moatDeep: true, sill: -0.5 }, 'water'), false);
  assert.equal(rules.holdsWater({ plannedDoor: 'store-0' }), true);
  assert.equal(rules.holdsWater({ grate: true, cubes: 2 }), false);
});

test('year titles keep the breach first', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  assert.equal(rules.yearTitle({ breach: true, fire: true, drought: true }), 'The year the wall broke.');
  assert.equal(rules.yearTitle({ fire: true }), 'The year the fire came.');
  assert.equal(rules.yearTitle({ rot: true }), 'The year the door fell.');
  assert.equal(rules.yearTitle({ heave: true }), 'The year the frost lifted the wall.');
  assert.equal(rules.yearTitle({ seep: true }), 'The year water rose through the floor.');
  assert.equal(rules.yearTitle({ drought: true }), 'The year the pond went dry.');
  assert.equal(rules.endBrow({ fire: true }, 'flood'), 'The keep burned. The water came after.');
  assert.equal(rules.endBrow({ rot: true }, 'breach'), 'The door fell. The water came after.');
  assert.equal(rules.endBrow({}, 'breach'), 'The wall gave way');
  assert.equal(rules.endBrow({}, 'flood'), 'The idol went under');
});

test('groundwater seeps once the court is a pit', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  for (const cell of cells) {
    if (cell.hearth) continue;
    if (Math.hypot(cell.i - 8, cell.k - 8) > 1.85) cell.land = 0.8;
  }
  const sim = { cells, hearth: cells[8 * 16 + 8], era: 'keep', events: [], quiet: true, chronicle: { seep: false } };
  assert.ok(stress.noteSeep(sim) > 0);
  assert.equal(sim.chronicle.seep, true);
  sim.saidSeep = false;
  sim.hearth.paved = true;
  cells[8 * 16 + 9].paved = true;
  assert.ok(stress.noteSeep(sim) > 0);
});

test('a dry summer cracks a berm and a well can answer it', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  const berm = cells[6 * 16 + 8];
  berm.berm = true;
  berm.moisture = 0;
  const clay = cells[5 * 16 + 8];
  clay.berm = true;
  clay.clay = true;
  clay.moisture = 0;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    era: 'ring',
    year: 4,
    seasonIndex: 1,
    events: [],
    quiet: false,
    chronicle: { drought: false },
    snapshot: { sample: () => ({ depth: 0 }) }
  };
  stress.noteDrought(sim, 80);
  assert.equal(sim.drought, true);
  assert.equal(sim.chronicle.drought, true);
  assert.equal(berm.crack, true);
  assert.equal(clay.crack, undefined);
  assert.ok(sim.events.some(event => event.text === 'The ground is thirsty.'));
  sim.year = 5;
  sim.drought = true;
  stress.noteDrought(sim, 10);
  assert.equal(sim.drought, false);
});

test('frost lifts a bare wall and leaves clay', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  const ice = cells[7 * 16 + 8];
  ice.ice = true;
  const wall = cells[7 * 16 + 9];
  wall.cubes = 2;
  wall.block = [0.74, 0.74];
  wall.heave = 1.39;
  const lined = cells[6 * 16 + 8];
  lined.cubes = 2;
  lined.clay = true;
  lined.heave = 1.8;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    era: 'ring',
    seasonIndex: 3,
    time: 4,
    events: [],
    quiet: true,
    chronicle: {}
  };
  stress.noteFrost(sim, 2);
  assert.equal(wall.cubes, 1);
  assert.equal(wall.crack, true);
  assert.equal(sim.chronicle.heave, true);
  assert.equal(lined.cubes, 2);
});

test('damp rot drops a lintel and a sconce holds it back', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  const door = cells[4 * 16 + 8];
  door.lintel = true;
  door.hurdle = true;
  door.moisture = 0.7;
  door.rot = 0.99;
  const lit = cells[12 * 16 + 12];
  lit.lintel = true;
  lit.moisture = 0.7;
  lit.rot = 0.99;
  const sconce = cells[12 * 16 + 13];
  sconce.pyre = 2;
  sconce.sconce = true;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    era: 'keep',
    events: [],
    quiet: false,
    chronicle: {},
    snapshot: { sample: () => ({ depth: 0 }) }
  };
  stress.noteRot(sim, 8);
  assert.equal(door.lintel, false);
  assert.equal(door.hurdle, false);
  assert.equal(sim.chronicle.rot, true);
  assert.equal(lit.lintel, true);
  assert.ok(sim.events.some(event => event.text === 'The door falls.'));
});

test('fire spreads through litter and stops at water and a moat', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  const start = cells[4 * 16 + 4];
  start.fire = 0.8;
  start.litter = 0.4;
  const litter = cells[4 * 16 + 5];
  litter.litter = 0.4;
  const wet = cells[5 * 16 + 4];
  wet.litter = 0.8;
  const moat = cells[4 * 16 + 3];
  moat.litter = 0.8;
  moat.moat = true;
  moat.moatDeep = true;
  moat.sill = -0.5;
  const stone = cells[3 * 16 + 4];
  stone.litter = 0.8;
  stone.cubes = 2;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    events: [],
    quiet: true,
    loose: [],
    snapshot: {
      sample: (x, z) => ({ depth: Math.hypot(x - wet.x, z - wet.z) < 0.2 ? 0.2 : 0 })
    }
  };
  stress.spreadFire(sim, 1);
  assert.ok(litter.fire > 0);
  assert.equal(wet.fire || 0, 0);
  assert.equal(moat.fire || 0, 0);
  assert.equal(stone.fire || 0, 0);
  const oak = cells[2 * 16 + 2];
  oak.litter = 0.4;
  sim.trees = [{ i: 2, k: 2, kind: 'oak', growth: 3, fallen: false, drop: 2 }];
  sim.chronicle = {};
  assert.equal(stress.strikeTree(sim), true);
  assert.ok(oak.fire > 0);
  assert.equal(sim.chronicle.fire, true);
  assert.ok(sim.bolt);
});

test('old berms become stone and the river gives a stone', async () => {
  const growth = await import('../hugelkultur/growth.js');
  const cells = board();
  const berm = cells[2 * 16 + 2];
  berm.berm = true;
  berm.layers = 3;
  berm.coat = 1;
  berm.stood = 240 * 12;
  const river = cells[1 * 16 + 4];
  river.river = true;
  const sim = { cells, hearth: cells[8 * 16 + 8], year: 9, loose: [], events: [], quiet: true };
  const made = growth.stoneTheOld(sim);
  assert.equal(made, 1);
  assert.equal(berm.rock, true);
  assert.equal(sim.loose.filter(stick => stick.kind === 'stone').length, 1);
});

test('a weir is set when she lays the stick', async () => {
  const world = await import('../hugelkultur/world.js');
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');
  world.useGrid(16);
  const cells = board();
  const cell = cells[7 * 16 + 8];
  const stand = cells[6 * 16 + 8];
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    held: false,
    carrying: true,
    carryKind: 'willow',
    loose: [],
    trees: [],
    plots: [],
    live: [],
    events: [],
    time: 3,
    year: 2,
    seasonIndex: 0,
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    character: { st: { x: stand.x, z: stand.z, vx: 0, vz: 0 } },
    guide: {
      goal: { kind: 'place', method: 'weir', i: cell.i, k: cell.k },
      method: 'weir',
      stuck: 0,
      skip: new Map(),
      bestDist: Infinity,
      pauseUntil: 0,
      nextLook: 1e9
    }
  };
  guide.steer(sim, 0.2, false);
  assert.equal(cell.weir, true);
  assert.equal(sim.carrying, false);
});

test('a plan and a clay wall survive a save', async () => {
  const world = await import('../hugelkultur/world.js');
  const memory = await import('../hugelkultur/memory.js');
  world.useGrid(16);
  const cells = board();
  const wall = cells[4 * 16 + 4];
  wall.clay = true;
  wall.planned = 'store-0';
  wall.grate = true;
  const sim = {
    cells,
    loose: [],
    trees: [],
    live: [],
    plots: [],
    year: 4,
    seasonIndex: 0,
    seasonTime: 1,
    spiritId: 'cloud',
    plan: {
      v: 1,
      rooms: [{ id: 'store-0', name: 'store', i0: 6, k0: 11, i1: 10, k1: 15, door: [8, 11], closed: false, dir: 'S' }]
    },
    cistern: 0.4
  };
  const saved = memory.snapshotForest(sim, 1);
  const row = saved.cells.find(item => item.i === 4 && item.k === 4);
  assert.equal(row.clay, true);
  assert.equal(row.grate, true);
  assert.equal(saved.plan.rooms[0].name, 'store');
  assert.equal(saved.cistern, 0.4);
  wall.clay = false;
  wall.grate = false;
  wall.planned = null;
  sim.plan = null;
  sim.cistern = 0;
  memory.applyForest(sim, saved);
  assert.equal(wall.clay, true);
  assert.equal(wall.planned, 'store-0');
  assert.equal(sim.plan.rooms[0].id, 'store-0');
  assert.equal(sim.cistern, 0.4);
});
