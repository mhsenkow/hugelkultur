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
        hearth: i === 8 && k === 8,
        plot: null,
        tree: false,
        channel: i === 2,
        moisture: i === 2 ? 0.8 : 0.2,
        snow: 0
      });
    }
  }
  return cells;
}

function at(cells, i, k) {
  return cells[k * 16 + i];
}

test('a planted tree keeps growing, and age, sickness, and a beaver take different woods', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  const sticks = await import('../hugelkultur/sticks.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);

  const young = rules.growWood(0.2, rules.YEAR_SPAN, false, false);
  const older = rules.growWood(young, rules.YEAR_SPAN * 8, false, false);
  assert.ok(young > 0.8, `a year of growth reaches ${young}`);
  assert.ok(older > young + 1, `later years still add height, ${older}`);
  assert.ok(older < 8);
  assert.ok(rules.statureOf(older) > rules.statureOf(young));

  const cells = board();
  const birch = {
    i: 4,
    k: 4,
    x: at(cells, 4, 4).x,
    z: at(cells, 4, 4).z,
    kind: 'birch',
    planted: true,
    group: 'tree',
    growth: 2.4,
    age: rules.YEAR_SPAN * 80,
    seed: 3,
    cooldown: 0,
    fallen: false,
    size: 1
  };
  at(cells, 4, 4).tree = true;
  const willow = {
    i: 2,
    k: 6,
    x: at(cells, 2, 6).x,
    z: at(cells, 2, 6).z,
    kind: 'willow',
    planted: true,
    group: 'tree',
    growth: 1.4,
    age: rules.YEAR_SPAN * 4,
    seed: 9,
    cooldown: 0,
    fallen: false,
    size: 1
  };
  at(cells, 2, 6).tree = true;
  const sim = {
    cells,
    trees: [birch, willow],
    loose: [],
    shed: 0,
    away: true,
    over: false,
    seasonIndex: 1,
    year: 6,
    time: 20,
    events: [],
    beaverWait: rules.YEAR_SPAN * 40,
    snapshot: { sample: () => ({ depth: 0.08, velocity: [0, 0] }) }
  };
  sticks.updateSticks(sim, 0.2);
  assert.equal(birch.fallen, true);
  assert.ok(sim.events.some(event => event.text.includes('birch') && event.text.includes('old')));
  assert.equal(willow.fallen, false);
  assert.ok(sim.beaver, 'the beaver comes for the willow by the water');
  assert.equal(sim.beaver.tree, willow);

  for (let n = 0; n < 40; n++) sticks.updateSticks(sim, 0.5);
  assert.equal(willow.fallen, true);
  assert.ok(sim.events.some(event => event.text.includes('beaver') && event.text.includes('willow')));
});
