const test = require('node:test');
const assert = require('node:assert/strict');

const YEAR = 100000000;

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
        channel: false
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

test('a hundred million years stays finite and the ring stays above the rain', async () => {
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const growth = await import('../hugelkultur/growth.js');

  const press = rules.pressureOf(YEAR, 0.22);
  assert.equal(press, rules.PRESSURE_CAP);
  assert.equal(rules.pressureOf(1, 0.22), 1);
  assert.equal(Number(rules.pressureOf(4, 0.22).toFixed(2)), 1.66);
  assert.ok(press > rules.pressureOf(4, 0.22));
  assert.ok(0.22 * press <= 8);
  assert.ok(Number.isFinite(press));
  assert.equal(Number.isSafeInteger(YEAR), true);
  assert.ok(world.RIDGE > press * 0.9);
  assert.ok(world.CREST < 1e6);
  assert.equal(world.brickGain(0, 0.2), world.DIRT_CUBE);
  assert.equal(world.brickGain(world.CREST, 3), 0);

  const cells = board();
  const ring = cells.filter(cell => {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    return dist > 1.85 && dist < 3.35;
  });
  const glen = cells.filter(cell => Math.hypot(cell.i - 8, cell.k - 8) <= 1.85);
  const before = glen.map(cell => world.bedHeight(cell));
  const sim = { cells, events: [], quiet: true, bedDirty: false };
  for (let year = 0; year < 220; year++) {
    for (const cell of ring) mound(cell);
    growth.settleMounds(sim);
  }
  for (const cell of ring) {
    const height = world.bedHeight(cell) - cell.elevation;
    assert.ok(Number.isFinite(height));
    assert.ok(height >= world.RIDGE);
    assert.ok(height <= world.CREST + 1e-6);
    assert.ok(cell.block.length <= world.DIRT_CAP);
    assert.equal(cell.berm, false);
  }
  glen.forEach((cell, index) => assert.equal(world.bedHeight(cell), before[index]));

  const plain = { berm: true, hearth: false, coat: 1, lift: 0, rock: false, land: 0, elevation: 0.9, layers: 3 };
  const rich = {
    berm: true, hearth: false, coat: 6, lift: 4, rock: false, land: 0, elevation: 0.9, layers: 3,
    rooted: true, raft: 2.2, marks: { tend: true, leaf: true, snow: true, rain: true }
  };
  growth.settleMounds({ cells: [plain], events: [], quiet: true });
  growth.settleMounds({ cells: [rich], events: [], quiet: true });
  assert.ok(world.bedHeight(rich) > world.bedHeight(plain) + world.DIRT_CUBE);

  const capped = { berm: true, hearth: false, coat: 1, sunk: world.CREST, block: [world.DIRT_CUBE], cubes: 80, elevation: 0.9, land: 0 };
  const beforeCap = world.bedHeight(capped);
  growth.settleMounds({ cells: [capped], events: [], quiet: true });
  assert.equal(world.bedHeight(capped), beforeCap);
  assert.equal(capped.berm, false);

  const chronicle = { yearLine: '', years: [], gates: 0 };
  for (let n = 0; n < 30; n++) {
    chronicle.yearLine = n % 2 ? 'The year the oak took the north gate.' : 'The year the idol stayed dry.';
    rules.noteYear(chronicle);
  }
  assert.equal(chronicle.years.length, 24);
  assert.equal(chronicle.gates, 15);
});

test('she tries more than one way to hold the water', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const sticks = await import('../hugelkultur/sticks.js');
  const rules = await import('../hugelkultur/clearing.js');
  const world = await import('../hugelkultur/world.js');
  const cells = board();
  const bank = cells[1 * 16 + 8];
  const berm = cells[6 * 16 + 8];
  berm.berm = true;
  berm.layers = 3;
  berm.coat = 1;
  const idol = cells[8 * 16 + 8];
  const sim = {
    cells,
    hearth: idol,
    held: false,
    holding: false,
    carrying: false,
    loose: [{ x: bank.x, z: bank.z, fall: false, kind: 'oak' }],
    trees: [{ x: cells[2].x, z: cells[2].z, i: 2, k: 0, kind: 'birch', group: 'tree', growth: 1, planted: false }],
    plots: [],
    live: [{ bit: world.FLOW.SPR, edge: 'N', mouth: [8, 0], gate: [8, 6] }],
    events: [],
    motions: [],
    seen: new Set(),
    sow: null,
    measures: rules.blankMeasures(),
    spiritId: 'cloud',
    seasonIndex: 0,
    year: 4,
    time: 4,
    character: { st: { x: bank.x, z: bank.z, vx: 0, vz: 0 } },
    guide: { goal: null, stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 0 }
  };
  assert.equal(sticks.sowWood(sim, idol), false);
  const methods = [];
  for (let n = 0; n < 6; n++) {
    sim.guide.goal = null;
    sim.carrying = false;
    if (!sim.loose.length) sim.loose.push({ x: bank.x, z: bank.z, fall: false, kind: 'oak' });
    guide.steer(sim, 0.2, false);
    methods.push(sim.guide.method);
    if (sim.guide.goal?.kind === 'plant') break;
  }
  assert.ok(methods.includes('dam'), methods.join(','));
  assert.ok(methods.includes('raise'), methods.join(','));
  assert.ok(methods.includes('root'), methods.join(','));
  assert.equal(sim.trees.filter(tree => tree.kind === 'alder').length, 1);
  assert.equal(bank.tree, true);
  assert.ok(sim.events.some(event => event.text === 'You root the mouth.'));
});

test('a closed ring blocks a saturated autumn and a gap does not', async () => {
  const world = await import('../hugelkultur/world.js');
  const growth = await import('../hugelkultur/growth.js');
  const core = require('..');
  const { motion } = core.load().KIT.procedural;
  const cells = board();
  const ring = cells.filter(cell => {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    return dist > 1.85 && dist < 3.35;
  });
  const sim = { cells, events: [], quiet: true };
  for (let year = 0; year < 70; year++) {
    for (const cell of ring) mound(cell);
    growth.settleMounds(sim);
  }
  const idolBed = world.bedHeight(cells[8 * 16 + 8]);
  assert.ok(ring.every(cell => world.bedHeight(cell) > idolBed + world.RIDGE * 0.5));

  function pour(openSouth) {
    const solver = motion.shallowWater({
      width: 16,
      height: 16,
      cell: [1, 1],
      origin: [-8, -8],
      terrain: (x, z) => {
        const i = Math.floor(x + 8);
        const k = Math.floor(z + 8);
        const cell = cells[k * 16 + i];
        if (!cell) return 1.4;
        if (openSouth && Math.abs(i - 8) <= 1 && k > 8 && k < 12) return cell.elevation;
        return world.bedHeight(cell);
      },
      initial: () => 0
    });
    const shot = solver.step(16, {
      friction: 0.14,
      rain: (x, z) => (Math.floor(z + 8) === 15 ? 0.22 * 16 : 0),
      drain: (x, z, _t, state) => {
        let rate = 0.002;
        if (Math.floor(z + 8) === 0) rate += 0.04;
        if (state.depth < 0.02) rate += 0.012;
        return rate;
      }
    });
    return shot.sample(0.5, 0.5).depth;
  }

  assert.equal(pour(false), 0);
  assert.ok(pour(true) > 0.05);
});

test('she turns the water aside along the incoming edge', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const world = await import('../hugelkultur/world.js');
  const rules = await import('../hugelkultur/clearing.js');
  const cells = board();
  const bank = cells[1 * 16 + 8];
  const idol = cells[8 * 16 + 8];
  const sim = {
    cells,
    hearth: idol,
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
    year: 4,
    time: 4,
    character: { st: { x: bank.x, z: bank.z, vx: 0, vz: 0 } },
    guide: { goal: null, method: 'knit', stuck: 0, skip: new Map(), bestDist: Infinity, pauseUntil: 0, nextLook: 1e9 }
  };
  guide.steer(sim, 0.2, false);
  assert.equal(sim.guide.method, 'divert');
  assert.equal(sim.guide.goal.kind, 'cut');
  assert.equal(sim.guide.goal.i, 8);
  assert.equal(sim.guide.goal.k, 0);
  const mouth = cells[8];
  const inward = cells[1 * 16 + 8];
  sim.character.st.x = mouth.x;
  sim.character.st.z = mouth.z;
  guide.steer(sim, 0.2, false);
  assert.ok(world.bedHeight(mouth) < world.bedHeight(inward) - 0.3);
  assert.ok(sim.events.some(event => event.text === 'You turn the water aside.'));
});
