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
        lift: 0,
        hearth: i === 8 && k === 8,
        plot: null,
        tree: null,
        rock: false,
        log: false,
        snow: 0,
        litter: 0,
        moisture: 0.2,
        channel: false
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  return cells[k * 16 + i];
}

function simAt(cells, i, k) {
  const here = at(cells, i, k);
  return {
    cells,
    hearth: at(cells, 8, 8),
    trees: [],
    loose: [],
    spiritId: 'water',
    time: 10,
    events: [],
    carrying: false,
    carryKind: null,
    placeQueued: false,
    fast: false,
    over: false,
    character: {
      st: {
        x: here.x,
        z: here.z,
        y: 0.9,
        gh: 0.9,
        vx: 0,
        vy: 0,
        vz: 0,
        dead: -1,
        born: 2,
        ground: true,
        face: 0
      }
    },
    guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0 }
  };
}

test('day opens in daylight and night is the last part of it', async () => {
  const day = await import('../hugelkultur/day.js');
  assert.equal(day.dayPart(0), 'day');
  assert.equal(day.nightAmount(3), 0);
  assert.equal(day.dayPart(day.DAY * 0.75), 'dusk');
  assert.equal(day.dayPart(day.DAY * 0.86), 'night');
  assert.equal(day.nightAmount(day.DAY * 0.86), 1);
  assert.equal(day.dayPart(day.DAY * 0.97), 'dawn');
  assert.ok(day.nightAmount(day.DAY * 0.97) < 1);
});

test('night puts a stranded body on low ground, and dawn wakes her there', async () => {
  const day = await import('../hugelkultur/day.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const cells = board();
  const tower = at(cells, 12, 12);
  tower.cubes = 4;
  const sim = simAt(cells, 12, 12);
  sim.character.st.y = world.walkHeight(tower);
  sim.carrying = true;
  sim.carryKind = 'oak';
  sim.guide.goal = { kind: 'place', i: 3, k: 3 };
  sim.time = day.DAY * 0.86;

  day.updateDay(sim, 0.2, false);

  assert.equal(sim.resting, 'sleep');
  assert.equal(sim.carrying, false);
  assert.equal(sim.loose.length, 1);
  assert.equal(sim.guide.goal, null);
  assert.ok(sim.character.st.dead >= 1);
  const home = sim.bed;
  assert.ok(home);
  assert.ok(world.walkHeight(home) - home.elevation < 0.5);
  assert.ok(Math.hypot(sim.character.st.x - home.x, sim.character.st.z - home.z) < 0.01);
  assert.notEqual(home, tower);
  assert.ok(sim.events.some(event => event.text.includes('rests as water')));

  sim.time = day.DAY * 0.97;
  day.updateDay(sim, 0.2, false);
  assert.equal(sim.resting, 'wake');
  assert.equal(sim.character.st.dead, -1);
  assert.equal(sim.character.st.born, 0);
  assert.ok(Math.hypot(sim.character.st.x - home.x, sim.character.st.z - home.z) < 0.01);
  assert.ok(sim.events.some(event => event.text.includes('Morning')));
});

test('a closed corner or a high stand sends her home to sleep', async () => {
  const day = await import('../hugelkultur/day.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  const open = simAt(board(), 8, 10);
  for (let n = 0; n < 20; n++) {
    open.time += 0.5;
    day.updateDay(open, 0.5, false);
  }
  assert.equal(open.resting ?? null, null);

  const trying = simAt(board(), 8, 10);
  trying.guide.goal = { kind: 'fetch', x: 4, z: 4 };
  for (let n = 0; n < 13; n++) {
    trying.time += 0.5;
    day.updateDay(trying, 0.5, false);
  }
  assert.equal(trying.resting, 'sleep');
  assert.ok(trying.events.some(event => event.text.includes('way is closed')));
  trying.time += 8.2;
  day.updateDay(trying, 0.2, false);
  assert.equal(trying.resting ?? null, null);
  assert.equal(trying.character.st.dead, -1);
  assert.ok(trying.events.some(event => event.text.includes('is home')));

  const high = simAt(board(), 12, 12);
  const stand = at(high.cells, 12, 12);
  stand.cubes = 4;
  high.character.st.y = world.walkHeight(stand);
  for (let n = 0; n < 8; n++) {
    high.time += 0.5;
    day.updateDay(high, 0.5, false);
  }
  assert.equal(high.resting, 'sleep');
  assert.ok(world.walkHeight(high.bed) - high.bed.elevation < 0.5);

  const boxed = simAt(board(), 2, 2);
  for (const cell of boxed.cells) {
    if (cell.i === 2 && cell.k === 2) continue;
    cell.cubes = 4;
  }
  for (let n = 0; n < 13; n++) {
    boxed.time += 0.5;
    day.updateDay(boxed, 0.5, false);
  }
  assert.equal(boxed.resting, 'sleep');

  const hurried = simAt(board(), 12, 12);
  at(hurried.cells, 12, 12).cubes = 4;
  hurried.fast = true;
  hurried.guide.goal = { kind: 'place', i: 1, k: 1 };
  for (let n = 0; n < 20; n++) {
    hurried.time += 0.5;
    day.updateDay(hurried, 0.5, false);
  }
  assert.equal(hurried.resting ?? null, null);
});

test('a trapped body sleeps even when the water is up', async () => {
  const day = await import('../hugelkultur/day.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const cells = board();
  const stand = at(cells, 12, 12);
  stand.cubes = 4;
  const sim = simAt(cells, 12, 12);
  sim.character.st.y = world.walkHeight(stand);
  sim.time = day.DAY * 0.86;
  sim.snapshot = {
    sample: (x, z) => {
      const i = Math.round(x + 8 - 0.5);
      const k = Math.round(z + 8 - 0.5);
      return { depth: i === 6 && k === 11 ? 0.24 : 0, velocity: [0, 0] };
    }
  };
  day.updateDay(sim, 0.2, false);
  assert.equal(sim.resting, 'sleep');
  assert.ok(world.walkHeight(sim.bed) - sim.bed.elevation < 0.5);
  assert.notEqual(sim.bed, stand);
});

test('dusk walks her home, and a step at night lets her stay up', async () => {
  const day = await import('../hugelkultur/day.js');
  const guide = await import('../hugelkultur/guide.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const sim = simAt(board(), 2, 2);
  sim.time = day.DAY * 0.75;
  day.updateDay(sim, 0.2, false);
  assert.equal(sim.resting, 'home');
  const step = guide.steer(sim, 0.2, false);
  const towardBed = step.move * (sim.bed.x - sim.character.st.x) + step.mz * (sim.bed.z - sim.character.st.z);
  assert.ok(towardBed > 0);
  sim.character.st.x = sim.bed.x;
  sim.character.st.z = sim.bed.z;
  sim.character.st.y = world.walkHeight(sim.bed);
  day.updateDay(sim, 0.2, false);
  assert.equal(sim.resting, 'sleep');
  assert.equal(sim.character.st.dead, 0);
  assert.deepEqual(guide.steer(sim, 0.2, false), { move: 0, mz: 0 });

  const night = simAt(board(), 12, 12);
  at(night.cells, 12, 12).cubes = 4;
  night.time = day.DAY * 0.86;
  day.updateDay(night, 0.2, false);
  assert.equal(night.resting, 'sleep');
  day.updateDay(night, 0.2, true);
  assert.equal(night.resting ?? null, null);
  assert.equal(night.character.st.dead, -1);
  assert.equal(night.upLate, 0);
  assert.ok(world.walkHeight(night.bed) - night.bed.elevation < 0.5);
  day.updateDay(night, 0.2, false);
  assert.equal(night.resting ?? null, null);
});

test('each spirit rests as its own element, on ground it can leave', async () => {
  const day = await import('../hugelkultur/day.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const cells = board();
  at(cells, 8, 7).cubes = 4;
  const grove = at(cells, 4, 4);
  grove.tree = true;
  const sim = simAt(cells, 8, 9);
  sim.trees = [{ x: grove.x, z: grove.z, group: 'tree' }];
  sim.time = day.DAY * 0.86;
  day.layBeds(sim);
  assert.notEqual(sim.restBeds.fire, sim.restBeds.water);
  assert.equal(Math.hypot(sim.restBeds.fire.i - 8, sim.restBeds.fire.k - 8), 1);
  assert.notEqual(sim.restBeds.fire, at(cells, 8, 7));
  assert.ok(Math.hypot(sim.restBeds.tree.x - grove.x, sim.restBeds.tree.z - grove.z) < 1.8);
  assert.notEqual(sim.restBeds.tree, grove);
  for (const cell of Object.values(sim.restBeds)) {
    assert.ok(world.walkHeight(cell) - cell.elevation < 0.5);
  }

  const streaks = [];
  day.drawRest({ streak: (a, b, style) => streaks.push(style) }, sim);
  assert.ok(streaks.length > 8);
  assert.ok(streaks.some(style => style.emissive && style.color === 14));

  const noon = simAt(board(), 8, 9);
  noon.time = 10;
  const quiet = [];
  day.drawRest({ streak: () => quiet.push(1) }, noon);
  assert.equal(quiet.length, 0);
});
