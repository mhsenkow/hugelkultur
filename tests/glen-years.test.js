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
        litter: 0,
        moisture: 0.2,
        channel: false,
        clearing: false
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  return cells[k * 16 + i];
}

test('seasons are apparent', async () => {
  const water = await import('../hugelkultur/water.js');
  const weather = await import('../hugelkultur/weather.js');
  const rules = await import('../hugelkultur/clearing.js');

  const ids = water.SEASONS.map(season => season.id);
  assert.deepEqual(ids, ['SPR', 'SUM', 'AUT', 'WIN']);
  assert.equal(new Set(water.SEASONS.map(season => season.edge)).size, 4);
  assert.equal(new Set(water.SEASONS.map(season => season.line)).size, 4);
  assert.equal(new Set(water.SEASONS.map(season => season.pip)).size, 4);
  assert.equal(new Set(water.SEASONS.map(season => JSON.stringify(water.seasonOptics(season).tint))).size, 4);

  const spring = water.seasonOptics('SPR');
  const summer = water.seasonOptics('SUM');
  const autumn = water.seasonOptics('AUT');
  const winter = water.seasonOptics('WIN');
  assert.ok(spring.tint[2] > spring.tint[0], 'spring water reads blue');
  assert.ok(autumn.tint[0] > autumn.tint[2], 'autumn water reads brown');
  assert.ok(autumn.sediment.strength > spring.sediment.strength);
  assert.ok(winter.tint[0] > summer.tint[0], 'winter water is paler than summer');
  assert.equal(rules.SEASON_LOOK.WIN.pattern, 'blue-noise');
  assert.ok(rules.SEASON_LOOK.AUT.grain > rules.SEASON_LOOK.SUM.grain);
  assert.notEqual(rules.SEASON_LOOK.SPR.dots, rules.SEASON_LOOK.SUM.dots);

  const fallOf = { SPR: 'rain', SUM: null, AUT: 'leaf', WIN: 'snow' };
  for (const [index, season] of water.SEASONS.entries()) {
    const cells = board();
    const sim = {
      seasonIndex: index,
      seasonTime: 0,
      weatherSeason: index,
      time: 3,
      fall: [],
      fallAcc: 0,
      cells,
      live: [],
      trees: [{ x: at(cells, 2, 2).x, z: at(cells, 2, 2).z, i: 2, k: 2, kind: 'birch' }],
      hearth: at(cells, 8, 8),
      over: false
    };
    weather.updateWeather(sim, 0.25);
    const want = fallOf[season.id];
    if (want) {
      assert.ok(sim.fall.length > 0, `${season.id} sheds ${want}`);
      assert.ok(sim.fall.every(bit => bit.kind === want));
    } else {
      assert.equal(sim.fall.length, 0, 'summer does not rain, leaf, or snow');
    }
    const streaks = [];
    weather.drawWeather({ streak: (a, b, style) => streaks.push(style) }, sim);
    const snow = streaks.some(style => style.color === 6 && style.width === 0.06 && !style.emissive);
    const shafts = streaks.some(style => style.emissive && style.width === 0.035);
    const rain = streaks.some(style => style.color === 12 && style.width === 0.018);
    const leaves = streaks.some(style => style.color === 13);
    assert.equal(snow, season.id === 'WIN', `${season.id} snow field`);
    assert.equal(shafts, season.id === 'SUM', `${season.id} summer shafts`);
    assert.equal(rain, season.id === 'SPR', `${season.id} rain`);
    assert.equal(leaves, season.id === 'AUT', `${season.id} leaves`);
  }

  const spoken = {
    seasonIndex: 0,
    seasonTime: 52,
    flood: 0,
    quiet: false,
    events: [],
    year: 1,
    cells: [],
    live: [],
    chronicle: rules.freshChronicle(),
    berms: 0,
    years: []
  };
  const heard = [];
  for (let n = 0; n < 4; n++) {
    water.closeSeason(spoken);
    heard.push(spoken.events.at(-1).text);
  }
  assert.deepEqual(heard, [
    'Summer. It is clear.',
    'Autumn. Leaves fall.',
    'Winter. Snow.',
    'Spring. Rain from the north.'
  ]);
});

test('the avatar keeps working, circle held or not', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const rules = await import('../hugelkultur/clearing.js');

  function shift(holding) {
    const cells = board();
    const hearth = at(cells, 8, 8);
    const home = at(cells, 8, 9);
    const sim = {
      cells,
      hearth,
      held: false,
      holding,
      carrying: false,
      carryKind: null,
      plots: [],
      trees: [],
      loose: [{ x: home.x, z: home.z, fall: false, kind: 'oak' }],
      live: [],
      measures: rules.blankMeasures(),
      spiritId: 'cloud',
      seasonIndex: 0,
      year: 1,
      time: 0,
      events: [],
      placeQueued: false,
      character: { st: { x: home.x, z: home.z, vx: 0, vz: 0 } },
      guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 0 }
    };
    let placed = 0;
    let idle = 0;
    const kinds = new Set();
    const dt = 0.25;
    for (let step = 0; step < 160; step++) {
      sim.time += dt;
      const input = guide.steer(sim, dt, false) || { move: 0, mz: 0 };
      const goal = sim.guide.goal;
      kinds.add(goal?.kind || 'none');
      if (!goal || goal.kind === 'rest' || goal.kind === 'look' || goal.kind === 'none') idle += 1;
      const st = sim.character.st;
      st.x += (input.move || 0) * 2.15 * dt;
      st.z += (input.mz || 0) * 2.15 * dt;
      if (sim.placeQueued && sim.carrying && goal?.kind === 'place') {
        const cell = cells[goal.k * 16 + goal.i];
        cell.layers += 1;
        cell.mass += 0.5;
        sim.carrying = false;
        sim.placeQueued = false;
        placed += 1;
        sim.loose.push({ x: st.x, z: st.z, fall: false, kind: 'oak' });
      } else if (goal?.kind === 'fetch' && !sim.carrying) {
        const stick = sim.loose.find(item => !item.fall && Math.hypot(item.x - st.x, item.z - st.z) < 0.62);
        if (stick) {
          sim.loose = sim.loose.filter(item => item !== stick);
          sim.carrying = true;
          sim.carryKind = 'oak';
        }
      }
    }
    const raised = cells.reduce((sum, cell) => sum + cell.layers, 0);
    assert.equal(idle, 0, `holding ${holding} idle ${idle} kinds ${[...kinds]}`);
    assert.ok(kinds.has('fetch') && kinds.has('place'), `holding ${holding} kinds ${[...kinds]}`);
    assert.ok(placed >= 3 && raised >= 3, `holding ${holding} placed ${placed}`);
  }

  shift(false);
  shift(true);
});

test('built structures block the water', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const water = await import('../hugelkultur/water.js');

  const bare = { elevation: 0.9, land: 0, layers: 0, cubes: 0, berm: false };
  const stick = { ...bare, layers: 1, mass: 0.5 };
  const stack = { ...bare, layers: 3, mass: 1.4 };
  const berm = { ...bare, berm: true, layers: 3, coat: 1, lift: 0 };
  const brick = { ...bare, cubes: 1, block: [world.DIRT_CUBE] };
  const floor = world.bedHeight(bare);

  assert.equal(rules.holdsWater(stick), false);
  assert.ok(world.bedHeight(stick) - floor < world.PEDESTAL);
  assert.equal(rules.holdsWater(stack), true);
  assert.ok(world.bedHeight(stack) - floor > world.PEDESTAL);
  assert.equal(rules.holdsWater(berm), true);
  assert.ok(world.bedHeight(berm) - floor > world.PEDESTAL);
  assert.equal(rules.holdsWater(brick), true);
  assert.ok(Math.abs(world.bedHeight(brick) - floor - world.DIRT_CUBE) < 1e-6);

  const cells = board();
  const gate = at(cells, 8, 6);
  gate.berm = true;
  gate.layers = 3;
  gate.coat = 1;
  const finger = { bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] };
  const sim = {
    cells,
    live: [finger],
    seasonIndex: 0,
    quiet: false,
    events: [],
    chronicle: rules.freshChronicle(),
    bedDirty: false
  };
  assert.equal(water.sidleGate(sim, water.SEASONS[0]), true);
  assert.notDeepEqual(finger.gate, [8, 6]);
  assert.ok(Math.hypot(finger.gate[0] - 8, finger.gate[1] - 8) >= 2.1);
  assert.equal(rules.holdsWater(at(cells, finger.gate[0], finger.gate[1])), false);
  assert.equal(sim.events.at(-1).text, 'The water looks for another way.');
  assert.equal(sim.bedDirty, true);
  assert.ok(gate.stain > 0);
});

test('mounds become bricks and the ring around the glen rises', async () => {
  const world = await import('../hugelkultur/world.js');
  const growth = await import('../hugelkultur/growth.js');

  const cells = board();
  const glen = cells.filter(cell => Math.hypot(cell.i - 8, cell.k - 8) <= 1.85);
  const ring = cells.filter(cell => {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    return dist > 1.85 && dist < 3.35;
  });
  const woods = at(cells, 1, 1);
  woods.layers = 2;
  const sim = { cells, events: [], quiet: false, bedDirty: false, berms: ring.length };
  assert.ok(ring.length >= 8);
  assert.ok(glen.some(cell => cell.hearth));

  const beforeGlen = glen.map(cell => world.bedHeight(cell));
  const beforeWoods = world.bedHeight(woods);

  function mound(cell) {
    cell.berm = true;
    cell.layers = 3;
    cell.coat = 1;
    cell.lift = 0;
    cell.rock = false;
  }

  for (let year = 1; year <= 4; year++) {
    for (const cell of ring) mound(cell);
    const count = growth.settleMounds(sim);
    assert.equal(count, ring.length);
    assert.equal(sim.bedDirty, true);
    for (const cell of ring) {
      assert.equal(cell.berm, false);
      assert.equal(cell.cubes, year);
      assert.ok(Math.abs(world.bedHeight(cell) - cell.elevation - year * world.DIRT_CUBE) < 1e-6);
      assert.ok(world.walkHeight(cell) - cell.elevation >= year * world.DIRT_CUBE);
    }
    for (const [index, cell] of glen.entries()) assert.equal(world.bedHeight(cell), beforeGlen[index]);
    assert.equal(world.bedHeight(woods), beforeWoods);
    assert.equal(woods.cubes || 0, 0);
  }

  assert.ok(sim.events.some(event => event.text === 'The mounds become the ground.'));
  for (const cell of ring) mound(cell);
  growth.settleMounds(sim);
  for (const cell of ring) {
    assert.equal(cell.cubes, 5);
    assert.ok(cell.block.length <= world.DIRT_CAP);
    assert.ok(Math.abs(world.bedHeight(cell) - cell.elevation - 5 * world.DIRT_CUBE) < 1e-6);
    assert.equal(cell.berm, false);
  }
  for (const [index, cell] of glen.entries()) assert.equal(world.bedHeight(cell), beforeGlen[index]);
  assert.ok(world.bedHeight(ring[0]) - glen[0].elevation >= 5 * world.DIRT_CUBE);
});

test('the near crown thins and a close mound leaves the figure its court', async () => {
  const world = await import('../hugelkultur/world.js');
  const growth = await import('../hugelkultur/growth.js');
  const facing = world.crownFade(6, 6, Math.PI / 4);
  const behind = world.crownFade(-6, -6, Math.PI / 4);
  const aside = world.crownFade(8, -1, Math.PI / 4);
  assert.ok(facing < 0.4, facing);
  assert.equal(behind, 1);
  assert.ok(aside > facing);

  const cell = { i: 7, k: 6, layers: 2, elevation: 0.9, hearth: false, marks: {} };
  const gate = { i: 8, k: 6, layers: 2, elevation: 0.9, hearth: false, marks: {} };
  const sim = {
    live: [{ bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    quiet: false,
    seen: new Set(),
    motions: [],
    seasonIndex: 0,
    year: 2
  };
  assert.equal(growth.beginMound(sim, cell, 'tend'), true);
  assert.equal(cell.berm, true);
  assert.ok(sim.events.some(event => event.text === 'The figure keeps its court.'));
  const before = sim.events.length;
  assert.equal(growth.beginMound(sim, gate, 'tend'), true);
  assert.ok(!sim.events.slice(before).some(event => event.text === 'The figure keeps its court.'));
});
