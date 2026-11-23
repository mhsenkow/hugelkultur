const test = require('node:test');
const assert = require('node:assert/strict');

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
        litter: 0,
        sill: 0
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  if (i < 0 || k < 0 || i >= 16 || k >= 16) return null;
  return cells[k * 16 + i];
}

function ring(cells) {
  for (const cell of cells) {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    if (dist <= 1.85 || dist >= 3.35) continue;
    cell.cubes = 2;
    cell.block = [0.74, 0.74];
    cell.berm = false;
  }
}

function flatNeighbor(cells, cell) {
  for (const [di, dk] of STEP) {
    const next = at(cells, cell.i + di, cell.k + dk);
    if (!next || next.hearth || next.planned) continue;
    if ((next.cubes || 0) > 0 || next.berm) continue;
    return next;
  }
  return null;
}

function guideOf(method) {
  return {
    goal: null,
    method,
    stuck: 0,
    skip: new Map(),
    bestDist: Infinity,
    pauseUntil: 0,
    nextLook: 1e9
  };
}

function simOf(rules, cells, stand, extra = {}) {
  return {
    cells,
    hearth: cells[8 * 16 + 8],
    carrying: false,
    carryKind: null,
    loose: [],
    trees: [],
    plots: [],
    live: [],
    events: [],
    motions: [],
    time: 30,
    year: 3,
    seasonIndex: 0,
    seasonTime: 0,
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    chronicle: rules.freshChronicle(),
    character: { st: { x: stand.x, z: stand.z, vx: 0, vz: 0, face: 0 } },
    guide: guideOf('build'),
    snapshot: { sample: () => ({ depth: 0, velocity: [0, 0] }) },
    quiet: false,
    shed: 0,
    flood: 0,
    over: false,
    held: false,
    ...extra
  };
}

test('the store door opens on the court and the ring still holds', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const sim = simOf(rules, cells, cells[8 * 16 + 8], { quiet: true, circleSaid: true, holding: true });
  plan.planKeep(sim);
  const store = sim.plan.rooms.find(room => room.name === 'store');
  assert.ok(store && !store.closed);
  assert.equal(sim.plan.rooms.length, 1);
  const door = cells.find(cell => cell.plannedDoor);
  assert.ok(door);
  assert.equal(rules.holdsWater(door), true);
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), true);
  const toward = STEP
    .map(([di, dk]) => at(cells, door.i + di, door.k + dk))
    .find(cell => cell && Math.hypot(cell.i - 8, cell.k - 8) < Math.hypot(door.i - 8, door.k - 8));
  assert.ok(toward, 'the door has a court side');
  assert.ok(rules.wallHeight(toward) < 0.9, 'the court side of the door is open');
  plan.planKeep(sim);
  assert.equal(sim.plan.rooms.length, 1, 'she does not stake the next room while this one is open');
});

test('she lays a stick on the wall she means to raise', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  const guide = await import('../hugelkultur/guide.js');
  const sticks = await import('../hugelkultur/sticks.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const sim = simOf(rules, cells, cells[8 * 16 + 8], { circleSaid: true, holding: true, carrying: true, carryKind: 'oak' });
  sim.guide.method = 'build';
  plan.planKeep(sim);
  const step = guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.goal?.kind, 'place', sim.guide.method);
  assert.equal(sim.guide.goal?.method, 'build');
  const target = cells[sim.guide.goal.k * 16 + sim.guide.goal.i];
  assert.ok(target.planned);
  const stand = flatNeighbor(cells, target) || cells[8 * 16 + 8];
  sim.character.st.x = stand.x;
  sim.character.st.z = stand.z;
  const laid = guide.steer(sim, 0.2, false);
  assert.equal(sim.placeQueued, true);
  sim.character.st.face = laid.face;
  sticks.updateSticks(sim, 0.2);
  assert.equal(sim.carrying, false);
  assert.ok((target.layers || 0) >= 1 || target.berm, 'the stake took the stick');
  assert.equal(sim.plan.rooms[0].closed, false, 'one stick does not close a room');
});

test('a click sends her to that stake', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  const guide = await import('../hugelkultur/guide.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const sim = simOf(rules, cells, cells[8 * 16 + 8], { circleSaid: true, holding: true, carrying: true, carryKind: 'oak' });
  plan.planKeep(sim);
  const asked = cells.find(cell => cell.planned && !cell.plannedDoor && (cell.cubes || 0) === 0);
  assert.ok(asked);
  sim.errand = { i: asked.i, k: asked.k, until: sim.time + 24 };
  guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.goal?.i, asked.i);
  assert.equal(sim.guide.goal?.k, asked.k);
  assert.equal(sim.guide.goal?.kind, 'place');
});

test('a race through the stake becomes a grate and the room still closes', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  const guide = await import('../hugelkultur/guide.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  for (const i of [6, 7, 9, 10]) cells[11 * 16 + i].race = true;
  const sim = simOf(rules, cells, cells[8 * 16 + 8], {
    circleSaid: true,
    holding: true,
    carrying: true,
    carryKind: 'stone',
    quiet: true
  });
  plan.planKeep(sim);
  const crossing = cells.find(cell => cell.gratePlan);
  assert.ok(crossing, 'a race through the stake is marked for a grate');
  assert.equal(crossing.gratePlan, sim.plan.rooms[0].id);
  sim.character.st.x = crossing.x;
  sim.character.st.z = crossing.z;
  sim.guide.method = 'build';
  guide.steer(sim, 0.2, false);
  assert.equal(crossing.grate, true);
  assert.equal(crossing.lintel, true);
  assert.equal(rules.stops(crossing, 'water'), false);
  assert.equal(rules.stops(crossing, 'beast'), true);
  for (const cell of cells) {
    if (!cell.planned || cell.plannedDoor || cell.grate) continue;
    cell.cubes = 2;
    cell.block = [0.74, 0.74];
  }
  const door = cells.find(cell => cell.plannedDoor);
  door.lintel = true;
  plan.planKeep(sim);
  assert.equal(sim.plan.rooms[0].closed, true);
  assert.ok(rules.roomsOf(cells, 8, 8).some(room => room.name === 'store'));
  assert.equal(rules.eraOf(sim), 'keep');
  assert.equal(sim.plan.rooms.filter(room => !room.closed).length, 1);
  assert.equal(sim.plan.rooms.find(room => !room.closed).name, 'cistern');
});

test('the moat reaches an outlet and stays out of the court', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const sim = simOf(rules, cells, cells[8 * 16 + 8], { quiet: true, circleSaid: true, holding: true });
  plan.planKeep(sim);
  for (const cell of cells) {
    if (cell.planned && !cell.plannedDoor) {
      cell.cubes = 2;
      cell.block = [0.74, 0.74];
    }
  }
  cells.find(cell => cell.plannedDoor).lintel = true;
  plan.planKeep(sim);
  const mouth = cells[8];
  mouth.outlet = true;
  mouth.sill = -0.4;
  const moat = plan.moatCells(sim);
  const radius = plan.moatRadius(sim);
  assert.ok(moat.includes(mouth), 'the moat is joined to an outlet');
  assert.equal(moat.some(cell => cell.hearth), false);
  assert.equal(moat.some(cell => cell.planned), false);
  assert.ok(moat.every(cell => Math.max(Math.abs(cell.i - 8), Math.abs(cell.k - 8)) >= radius || cell === mouth));
  mouth.moat = true;
  mouth.moatDeep = true;
  mouth.sill = -0.5;
  assert.equal(rules.stops(mouth, 'beast'), true);
  assert.equal(rules.stops(mouth, 'water'), false);
});

test('clay keeps a wall that frost and roots would open', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const growth = await import('../hugelkultur/growth.js');
  const stress = await import('../hugelkultur/stress.js');
  const guide = await import('../hugelkultur/guide.js');
  world.useGrid(16);
  const cells = board();
  const ice = cells[9 * 16 + 8];
  ice.ice = true;
  const bare = cells[9 * 16 + 9];
  bare.cubes = 2;
  bare.block = [0.74, 0.74];
  bare.heave = 1.39;
  const lined = cells[9 * 16 + 7];
  lined.cubes = 2;
  lined.block = [0.74, 0.74];
  lined.clay = true;
  lined.heave = 1.8;
  lined.burrow = 0.95;
  const sim = simOf(rules, cells, cells[8 * 16 + 8], { era: 'ring', seasonIndex: 3, quiet: true });
  stress.noteFrost(sim, 2);
  assert.equal(bare.cubes, 1);
  assert.equal(bare.crack, true);
  assert.equal(lined.cubes, 2);
  const before = lined.sill;
  growth.updateGrowth(sim, 1);
  assert.equal(lined.sill, before, 'clay does not let a burrow lower the sill');
  const rooted = cells[6 * 16 + 6];
  rooted.cubes = 2;
  rooted.block = [0.74, 0.74];
  rooted.clay = true;
  const open = cells[6 * 16 + 5];
  open.cubes = 2;
  open.block = [0.74, 0.74];
  sim.trees = [
    { planted: true, fallen: false, group: 'tree', kind: 'oak', growth: 3, i: 6, k: 6, x: rooted.x, z: rooted.z },
    { planted: true, fallen: false, group: 'tree', kind: 'oak', growth: 3, i: 5, k: 6, x: open.x, z: open.z }
  ];
  growth.updateGrowth(sim, 0.2);
  assert.equal(rooted.cubes, 2);
  assert.equal(open.cubes, 1);
  const wet = cells[4 * 16 + 4];
  wet.cubes = 1;
  wet.burrow = 0.4;
  wet.moisture = 0.8;
  sim.character.st.x = wet.x;
  sim.character.st.z = wet.z;
  sim.carrying = true;
  sim.carryKind = 'clay';
  sim.guide = guideOf('clay');
  sim.guide.goal = { kind: 'clay', method: 'clay', i: wet.i, k: wet.k };
  sim.quiet = false;
  guide.steer(sim, 0.2, false);
  assert.equal(wet.clay, true);
  assert.equal(wet.burrow, 0);
  assert.ok(sim.events.some(event => event.text === 'You line the wall with clay.'));
});

test('a drought wilts the bed and the well answers it', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const gardens = await import('../hugelkultur/gardens.js');
  const stress = await import('../hugelkultur/stress.js');
  const guide = await import('../hugelkultur/guide.js');
  world.useGrid(16);
  const cells = board();
  const berm = cells[5 * 16 + 8];
  berm.berm = true;
  berm.moisture = 0;
  const bed = cells[8 * 16 + 10];
  const plot = { i: bed.i, k: bed.k, x: bed.x, z: bed.z, growth: 0.2, watered: 0, id: 'bed' };
  bed.plot = plot;
  const watered = { i: 9, k: 10, growth: 0.2, watered: 8, id: 'wet' };
  const sim = simOf(rules, cells, bed, {
    era: 'ring',
    year: 4,
    seasonIndex: 1,
    plots: [plot, watered],
    snapshot: { sample: () => ({ depth: 0 }) }
  });
  stress.updateStress(sim, 80);
  assert.equal(sim.drought, true);
  assert.equal(sim.chronicle.drought, true);
  assert.equal(berm.crack, true);
  assert.ok(sim.events.some(event => event.text === 'The ground is thirsty.'));
  const dryBefore = plot.growth;
  const wetBefore = watered.growth;
  gardens.updateGardens(sim, 4, false);
  assert.ok(watered.growth - wetBefore > plot.growth - dryBefore, 'a watered bed outgrows a dry one');
  assert.ok(watered.watered < 8);
  sim.cistern = 0.5;
  sim.carrying = false;
  cells[8 * 16 + 9].well = true;
  cells[8 * 16 + 9].lined = true;
  sim.guide = guideOf('well');
  guide.steer(sim, 0.2, false);
  if (plot.watered !== 12) guide.steer(sim, 0.2, false);
  assert.equal(plot.watered, 12);
  assert.ok(sim.cistern < 0.5);
  assert.ok(sim.events.some(event => event.text === 'You water the bed.'));
});

test('fire takes an open pile and stops at a roof, a moat, and a well', async () => {
  const stress = await import('../hugelkultur/stress.js');
  const cells = board();
  const pile = cells[4 * 16 + 4];
  pile.fire = 0.7;
  pile.litter = 0.3;
  const store = cells[4 * 16 + 5];
  store.fire = 0.7;
  store.litter = 0.2;
  const roofed = cells[5 * 16 + 4];
  roofed.litter = 0.2;
  roofed.roofed = true;
  const moat = cells[4 * 16 + 3];
  moat.litter = 0.8;
  moat.moat = true;
  moat.moatDeep = true;
  moat.sill = -0.5;
  const soaked = cells[3 * 16 + 4];
  soaked.litter = 0.8;
  soaked.well = true;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    events: [],
    quiet: false,
    loose: [{ x: pile.x, z: pile.z, fall: false, kind: 'oak' }],
    store: { i: store.i, k: store.k, sticks: ['oak', 'birch'], chest: true },
    cistern: 0.2,
    chronicle: {},
    snapshot: { sample: () => ({ depth: 0 }) }
  };
  store.i = 5;
  store.k = 4;
  stress.spreadFire(sim, 1);
  assert.equal(sim.store.sticks.length, 1);
  assert.ok(sim.events.some(event => event.text === 'The fire takes the woodpile.'));
  assert.equal(sim.loose.length, 0);
  assert.equal(moat.fire || 0, 0);
  assert.equal(soaked.fire || 0, 0);
  sim.store = { i: roofed.i, k: roofed.k, sticks: ['oak'], chest: true };
  roofed.fire = 0.8;
  const kept = sim.store.sticks.length;
  stress.spreadFire(sim, 1);
  assert.equal(sim.store.sticks.length, kept);
});

test('rot drops a door, a sconce holds the next, and she mends the wood', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const stress = await import('../hugelkultur/stress.js');
  const guide = await import('../hugelkultur/guide.js');
  world.useGrid(16);
  const cells = board();
  const door = cells[4 * 16 + 8];
  door.lintel = true;
  door.hurdle = true;
  door.plannedDoor = 'store-0';
  door.moisture = 0.8;
  door.rot = 0.99;
  const held = cells[12 * 16 + 12];
  held.lintel = true;
  held.moisture = 0.8;
  held.rot = 0.5;
  const sconce = cells[12 * 16 + 13];
  sconce.pyre = 3;
  sconce.sconce = true;
  sconce.cubes = 2;
  const sim = simOf(rules, cells, door, {
    era: 'keep',
    quiet: false,
    snapshot: { sample: () => ({ depth: 0 }) }
  });
  stress.noteRot(sim, 8);
  assert.equal(door.lintel, false);
  assert.equal(door.hurdle, false);
  assert.equal(sim.chronicle.breach, true);
  assert.equal(held.lintel, true);
  assert.ok(held.rot < 0.5);
  sim.carrying = true;
  sim.carryKind = 'oak';
  sim.guide = guideOf('mend');
  guide.steer(sim, 0.2, false);
  if (door.rot > 0) guide.steer(sim, 0.2, false);
  assert.equal(door.rot, 0);
  assert.equal(door.lintel, true);
  assert.equal(door.rotImmune, true);
  assert.ok(sim.events.some(event => event.text === 'You mend the wood.'));
  const wall = cells[7 * 16 + 8];
  wall.cubes = 2;
  sim.character.st.x = wall.x;
  sim.character.st.z = wall.z;
  sim.carrying = true;
  sim.carryKind = 'oak';
  sim.guide = guideOf('pyre');
  sim.guide.goal = { kind: 'pyre', method: 'pyre', i: wall.i, k: wall.k };
  guide.steer(sim, 0.2, false);
  assert.equal(wall.sconce, true);
  assert.ok(wall.pyre > 0);
  assert.ok(sim.events.some(event => event.text === 'You set a sconce.'));
});

test('a beam roofs the gap and the roof stays after the year grows', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const guide = await import('../hugelkultur/guide.js');
  const growth = await import('../hugelkultur/growth.js');
  world.useGrid(16);
  const cells = board();
  const left = cells[10 * 16 + 6];
  const gap = cells[10 * 16 + 7];
  const right = cells[10 * 16 + 8];
  left.cubes = 2;
  right.cubes = 2;
  left.block = [0.74, 0.74];
  right.block = [0.74, 0.74];
  const sim = simOf(rules, cells, gap, { era: 'ring', carrying: true, carryKind: 'oak' });
  sim.guide.method = 'beam';
  guide.steer(sim, 0.2, false);
  if (!gap.beam) guide.steer(sim, 0.2, false);
  assert.equal(gap.beam, true);
  assert.equal(gap.roofed, true);
  growth.updateGrowth(sim, 0.5);
  assert.equal(gap.roofed, true, 'a beam keeps its roof outside the court');
});

test('a wet chest loses a stick and a roofed chest does not', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const water = await import('../hugelkultur/water.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const heart = cells[12 * 16 + 8];
  heart.store = true;
  const sim = simOf(rules, cells, cells[8 * 16 + 8], {
    quiet: true,
    circleSaid: true,
    holding: true,
    seasonIndex: 1,
    store: { i: heart.i, k: heart.k, sticks: ['oak', 'birch'], chest: true },
    snapshot: { sample: () => ({ depth: 0.2 }) }
  });
  water.closeSeason(sim);
  assert.equal(sim.store.sticks.length, 1);
  heart.roofed = true;
  sim.seasonIndex = 1;
  sim.chronicle = rules.freshChronicle();
  water.closeSeason(sim);
  assert.equal(sim.store.sticks.length, 1);
});

test('the year she closes the ring also stakes the store', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const water = await import('../hugelkultur/water.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  const sim = simOf(rules, cells, cells[8 * 16 + 8], {
    quiet: true,
    circleSaid: true,
    holding: true,
    year: 2,
    seasonIndex: 3
  });
  water.closeSeason(sim);
  assert.equal(sim.year, 3);
  assert.equal(sim.seasonIndex, 0);
  assert.equal(sim.plan.rooms[0].name, 'store');
  assert.equal(sim.plan.rooms.length, 1);
  assert.equal(rules.eraOf(sim), 'ring');
});

test('a year of weather on the keep stays finite and does not end it', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const plan = await import('../hugelkultur/plan.js');
  const memory = await import('../hugelkultur/memory.js');
  const stress = await import('../hugelkultur/stress.js');
  world.useGrid(16);
  const cells = board();
  ring(cells);
  for (const cell of cells) {
    if (cell.hearth) continue;
    if (Math.hypot(cell.i - 8, cell.k - 8) > 1.85) cell.land = 0.7;
  }
  const sim = simOf(rules, cells, cells[8 * 16 + 8], {
    quiet: true,
    circleSaid: true,
    holding: true,
    year: 3,
    seasonIndex: 0,
    bedDirty: false,
    berms: 0,
    years: [],
    gates: 0,
    live: [
      { bit: 1, edge: 'N', mouth: [8, 0], gate: [8, 6] },
      { bit: 2, edge: 'E', mouth: [15, 8], gate: [10, 8] },
      { bit: 4, edge: 'S', mouth: [8, 15], gate: [8, 10] },
      { bit: 8, edge: 'W', mouth: [0, 8], gate: [6, 8] }
    ]
  });
  plan.planKeep(sim);
  for (const cell of cells) {
    if (cell.planned && !cell.plannedDoor) {
      cell.cubes = 2;
      cell.block = [0.74, 0.74];
    }
  }
  const door = cells.find(cell => cell.plannedDoor);
  door.lintel = true;
  door.moisture = 0.8;
  plan.planKeep(sim);
  assert.equal(rules.eraOf(sim), 'keep');
  const stained = cells[3 * 16 + 3];
  stained.cubes = 2;
  stained.block = [0.74, 0.74];
  stained.stain = 0.6;
  stained.channel = true;
  stained.heave = 1.2;
  const clayed = cells[3 * 16 + 4];
  clayed.cubes = 2;
  clayed.clay = true;
  clayed.stain = 0.8;
  clayed.channel = true;
  clayed.heave = 1.6;
  for (let n = 0; n < 6; n++) memory.passYear(sim);
  assert.equal(sim.over, false);
  assert.ok(sim.year > 3);
  for (const cell of cells) {
    assert.ok(Number.isFinite(cell.sill || 0));
    assert.ok(Number.isFinite(cell.land || 0));
    assert.ok((cell.sill || 0) >= -0.91);
    assert.ok((cell.land || 0) <= 1.31);
  }
  assert.equal(clayed.cubes, 2);
  assert.ok(stress.noteSeep(sim) <= 0.04);
  sim.hearth.land = 0.7;
  for (const cell of cells) cell.land = 0.7;
  assert.equal(stress.noteSeep(sim), 0);
});
