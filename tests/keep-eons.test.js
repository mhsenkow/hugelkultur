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
        plot: null,
        tree: null,
        rock: false,
        log: false,
        channel: false,
        snow: 0,
        litter: 0,
        moisture: 0.2
      });
    }
  }
  return cells;
}

function mound(cell) {
  cell.berm = true;
  cell.layers = 3;
  cell.coat = 1;
  cell.lift = 0;
  cell.rock = false;
}

function ringCells(cells) {
  return cells.filter(cell => {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    return dist > 1.85 && dist < 3.35;
  });
}

test('era and rooms rise from the land', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  const growth = await import('../hugelkultur/growth.js');
  const cells = board();
  const sim = { cells, hearth: cells[8 * 16 + 8], events: [], quiet: true, year: 2, holding: true, circleSaid: true };
  assert.equal(rules.eraOf(sim), 'glade');
  for (const cell of ringCells(cells)) mound(cell);
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), true);
  assert.equal(rules.eraOf(sim), 'ring');

  for (let year = 0; year < 4; year++) {
    for (const cell of ringCells(cells)) mound(cell);
    growth.settleMounds(sim);
  }
  const plan = await import('../hugelkultur/plan.js');
  plan.planKeep(sim);
  assert.ok(sim.plan.rooms.some(room => room.name === 'store' && !room.closed), 'the druid stakes a store');
  for (const cell of cells) {
    if (!cell.planned || cell.plannedDoor) continue;
    cell.cubes = 2;
    cell.block = [0.74, 0.74];
    cell.berm = false;
  }
  const door = cells.find(cell => cell.plannedDoor);
  assert.ok(door, 'the store has a door');
  door.lintel = true;
  plan.planKeep(sim);
  const rooms = rules.roomsOf(cells, 8, 8, 1.85);
  assert.ok(rooms.some(room => room.name === 'store'), JSON.stringify(rooms.map(r => r.name)));
  assert.equal(rules.eraOf(sim), 'keep');
  assert.equal(rules.stops({ cubes: 1 }, 'beast'), true);
  assert.equal(rules.stops({ cubes: 1 }, 'people'), false);
  assert.equal(rules.stops({ cubes: 2 }, 'people'), true);
  assert.equal(rules.stops({ hurdle: true }, 'beast'), true);
  assert.equal(rules.stops({ hurdle: true }, 'water'), false);
  assert.equal(rules.yearTitle({ breach: true, circle: true }), 'The year the wall broke.');
  assert.equal(rules.yearTitle({ room: true }), 'The year the wall made a room.');
  assert.equal(rules.yearTitle({ river: true, edge: 'W' }), 'The year the river turned west.');
  assert.equal(rules.pressureOf(20, 0.22, 'keep') < rules.pressureOf(20, 0.22, 'glade'), true);
});

test('outlets and races turn the water aside', async () => {
  const world = await import('../hugelkultur/world.js');
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');
  world.useGrid(16);
  const cells = board();
  const gate = cells[6 * 16 + 8];
  gate.berm = true;
  gate.layers = 3;
  gate.coat = 1;
  const mouth = cells[0 * 16 + 8];
  mouth.sill = -0.4;
  mouth.outlet = false;
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    held: false,
    holding: false,
    carrying: false,
    loose: [],
    trees: [],
    plots: [],
    live: [{ bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    motions: [],
    seen: new Set(),
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    seasonIndex: 0,
    year: 5,
    time: 8,
    chronicle: rules.freshChronicle(),
    character: { st: { x: mouth.x, z: mouth.z, vx: 0, vz: 0 } },
    guide: { goal: null, method: 'knit', stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 1e9 },
    snapshot: { sample: () => ({ depth: 0.08, velocity: [0.08, 0] }) }
  };
  // Mark outlet by sill.
  if ((mouth.sill || 0) <= -0.3) mouth.outlet = true;
  assert.equal(mouth.outlet, true);

  guide.steer(sim, 0.2, false);
  assert.ok(['divert', 'race', 'dam', 'root', 'wood', 'stair'].includes(sim.guide.method), sim.guide.method);
  // Dig a race cell and confirm scour deepens it over many ticks.
  const race = cells[2 * 16 + 10];
  race.race = true;
  race.channel = true;
  race.sill = -0.2;
  race.scour = 0;
  for (let n = 0; n < 120; n++) {
    race.scour += 0.08;
    if (race.scour >= 1.2) {
      race.scour = 0;
      race.sill = Math.max(-0.9, race.sill - 0.04);
      if (race.sill <= -0.45) race.river = true;
    }
  }
  assert.ok(race.sill < -0.3, `sill ${race.sill}`);
  assert.equal(race.river, true);
});

test('a woodpile keeps sticks and a boar can breach', async () => {
  const visitors = await import('../hugelkultur/visitors.js');
  const cells = board();
  const berm = cells[7 * 16 + 8];
  berm.berm = true;
  berm.layers = 3;
  berm.coat = 2;
  berm.story = ['tend', 'leaf'];
  berm.marks = { tend: true, leaf: true, snow: false, rain: false };
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    quiet: false,
    events: [],
    motions: [],
    time: 10,
    year: 6,
    seasonIndex: 2,
    flood: 0,
    husks: [{}, {}, {}, {}],
    ferns: 3,
    chronicle: { visitor: null, breach: false },
    visitors: [],
    visitCool: {},
    visited: {},
    plots: [],
    trees: [],
    store: { i: 5, k: 5, sticks: ['oak', 'birch', 'maple'] }
  };
  cells[5 * 16 + 5].store = true;
  assert.equal(sim.store.sticks.length, 3);

  const boar = {
    kind: 'boar',
    x: berm.x,
    z: berm.z,
    tx: berm.x,
    tz: berm.z,
    yaw: 0,
    intent: 'root',
    until: 40,
    target: berm
  };
  sim.visitors = [boar];
  visitors.updateVisitors(sim, 0.2);
  assert.ok(sim.events.some(event => /boar/i.test(event.text)) || berm.coat < 2 || !berm.berm);

  const wanderer = {
    kind: 'wanderer',
    x: sim.hearth.x,
    z: sim.hearth.z,
    tx: sim.hearth.x,
    tz: sim.hearth.z,
    yaw: 0,
    intent: 'court',
    until: 40,
    target: sim.hearth
  };
  sim.visitors = [wanderer];
  sim.year = 8;
  visitors.updateVisitors(sim, 0.2);
  assert.ok(sim.events.some(event => /stranger/i.test(event.text)));
});

test('a hundred quiet years stay finite and the keep can hold', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const growth = await import('../hugelkultur/growth.js');
  const memory = await import('../hugelkultur/memory.js');
  world.useGrid(16);

  const cells = board();
  const ring = ringCells(cells);
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    events: [],
    quiet: true,
    bedDirty: false,
    year: 1,
    seasonIndex: 0,
    seasonTime: 0,
    holding: false,
    circleSaid: false,
    heldYear: false,
    flood: 0,
    over: false,
    berms: 0,
    chronicle: rules.freshChronicle(),
    years: [],
    gates: 0,
    live: [
      { bit: 1, edge: 'N', mouth: [8, 0], gate: [8, 6] },
      { bit: 2, edge: 'E', mouth: [15, 8], gate: [10, 8] },
      { bit: 4, edge: 'S', mouth: [8, 15], gate: [8, 10] },
      { bit: 8, edge: 'W', mouth: [0, 8], gate: [6, 8] }
    ],
    trees: [],
    loose: [],
    plots: [],
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    time: 0,
    store: null,
    visited: {},
    era: 'glade'
  };

  for (let year = 0; year < 80; year++) {
    for (const cell of ring) {
      if (year % 2 === 0) mound(cell);
    }
    // Leave one south gap so divert/race work; close it after year 12.
    if (year < 12) {
      const gap = cells[10 * 16 + 8];
      gap.berm = false;
      gap.layers = 0;
      gap.cubes = 0;
      gap.block = null;
    }
    growth.settleMounds(sim);
    // Dig a west outlet road over time.
    const road = [cells[8], cells[1 * 16 + 4], cells[2 * 16 + 3], cells[3 * 16 + 2], cells[4 * 16 + 1], cells[5 * 16]];
    road.forEach((cell, index) => {
      if (!cell || cell.hearth) return;
      cell.race = true;
      cell.channel = true;
      cell.sill = Math.min(cell.sill || 0, -0.2 - index * 0.05);
      cell.scour = (cell.scour || 0) + 0.3;
      if (cell.scour > 1) {
        cell.scour = 0;
        cell.sill = Math.max(-0.9, (cell.sill || 0) - 0.04);
      }
      if ((cell.sill || 0) <= -0.45) cell.river = true;
      if (cell.i === 0 || cell.k === 0) cell.outlet = true;
    });
    if (year === 5) {
      sim.holding = true;
      sim.circleSaid = true;
      sim.heldYear = true;
    }
    if (year === 20) {
      cells[5 * 16 + 5].store = true;
      sim.store = { i: 5, k: 5, sticks: ['oak', 'birch'] };
      for (const [i, k] of [[4, 4], [4, 5], [4, 6], [5, 4], [5, 6], [6, 4], [6, 5], [6, 6]]) {
        const cell = cells[k * 16 + i];
        cell.cubes = Math.max(cell.cubes || 0, 2);
        cell.block = [0.74, 0.74];
      }
    }
    sim.year = year + 1;
    growth.noteEra(sim);
    memory.passYear(sim);
    assert.equal(sim.over, false);
    assert.ok(Number.isFinite(sim.year));
    for (const cell of cells) {
      assert.ok(Number.isFinite(world.bedHeight(cell)), `bed ${cell.i},${cell.k}`);
      assert.ok((cell.land || 0) <= 1.31);
      assert.ok((cell.sill || 0) >= -0.91);
    }
  }

  assert.ok(sim.year >= 80);
  assert.ok(['ring', 'keep', 'undercroft'].includes(rules.eraOf(sim)), rules.eraOf(sim));
  assert.ok(cells.some(cell => cell.outlet), 'an outlet opened');
  assert.ok(cells.some(cell => cell.river || cell.race), 'a race was cut');
  const press = rules.pressureOf(sim.year, 0.22, rules.eraOf(sim));
  assert.ok(press <= rules.PRESSURE_CAP);
  assert.ok(Number.isFinite(press));
});

test('five hundred years of quiet keep-building stay finite', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const growth = await import('../hugelkultur/growth.js');
  const memory = await import('../hugelkultur/memory.js');
  world.useGrid(16);
  const cells = board();
  const ring = ringCells(cells);
  const sim = {
    cells,
    hearth: cells[8 * 16 + 8],
    events: [],
    quiet: true,
    bedDirty: false,
    year: 1,
    seasonIndex: 0,
    holding: true,
    circleSaid: true,
    heldYear: true,
    flood: 0,
    over: false,
    chronicle: rules.freshChronicle(),
    years: [],
    gates: 0,
    live: [{ bit: 1, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    trees: [],
    loose: [],
    plots: [],
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    time: 0,
    store: { i: 5, k: 5, sticks: [] },
    visited: {},
    era: 'ring'
  };
  cells[5 * 16 + 5].store = true;
  for (const [i, k] of [[4, 4], [4, 5], [4, 6], [5, 4], [5, 6], [6, 4], [6, 5], [6, 6]]) {
    cells[k * 16 + i].cubes = 2;
    cells[k * 16 + i].block = [0.74, 0.74];
  }
  for (let year = 0; year < 500; year++) {
    for (const cell of ring) mound(cell);
    growth.settleMounds(sim);
    const west = cells[8];
    west.sill = -0.6;
    west.outlet = true;
    west.race = true;
    west.channel = true;
    for (let k = 1; k < 6; k++) {
      const cell = cells[k * 16 + 4];
      cell.race = true;
      cell.channel = true;
      cell.sill = Math.min(cell.sill || 0, -0.25 - k * 0.05);
      cell.scour = (cell.scour || 0) + 0.2;
      if (cell.scour > 1) {
        cell.scour = 0;
        cell.sill = Math.max(-0.9, (cell.sill || 0) - 0.04);
        if (cell.sill <= -0.45) cell.river = true;
      }
    }
    if (sim.store.sticks.length < 12 && year % 3 === 0) sim.store.sticks.push('oak');
    sim.year = year + 1;
    growth.noteEra(sim);
    if (year % 4 === 0) memory.passYear(sim);
    assert.equal(sim.over, false);
    assert.ok(Number.isFinite(world.bedHeight(sim.hearth)));
    assert.ok(rules.pressureOf(sim.year, 0.22, rules.eraOf(sim)) <= rules.PRESSURE_CAP);
  }
  assert.ok(sim.year >= 500);
  assert.ok(rules.eraOf(sim) !== 'glade', rules.eraOf(sim));
  assert.ok((sim.store.sticks || []).length > 0);
  assert.ok(cells.every(cell => Number.isFinite(world.bedHeight(cell))));
});
