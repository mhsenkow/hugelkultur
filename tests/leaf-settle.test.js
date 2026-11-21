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
        litter: 0,
        snow: 0,
        moisture: 0.2,
        soak: 0,
        channel: false
      });
    }
  }
  return cells;
}

test('leaves and snow stay on the cube, and the wrong season does not keep them in the air', async () => {
  const weather = await import('../hugelkultur/weather.js');
  const world = await import('../hugelkultur/world.js');
  world.useGrid(16);
  const cells = board();
  const sim = {
    cells,
    seasonIndex: 2,
    weatherSeason: 2,
    seasonTime: 30,
    time: 12,
    fall: [
      { kind: 'leaf', x: 30, z: -20, y: 2, vy: 0.2, spin: 0, drift: 4, raft: true, age: 0 },
      { kind: 'snow', x: 1, z: 1, y: 3, vy: 0.2, spin: 0, drift: 0, age: 0 }
    ],
    fallAcc: 0,
    events: [],
    live: [],
    snapshot: { sample: () => ({ depth: 0.3, level: 1, velocity: [6, 2] }) }
  };
  weather.updateWeather(sim, 0.5);
  assert.ok(cells.some(cell => cell.snow > 0), 'snow left the air and sat down');
  for (const bit of sim.fall) {
    assert.equal(bit.kind, 'leaf');
    assert.ok(bit.x > -8 && bit.x < 8, `leaf x ${bit.x}`);
    assert.ok(bit.z > -8 && bit.z < 8, `leaf z ${bit.z}`);
  }
  sim.seasonIndex = 0;
  weather.updateWeather(sim, 0.2);
  assert.ok(sim.fall.every(bit => bit.kind === 'rain'));
  assert.ok(cells.some(cell => cell.litter > 0), 'the leaf became litter');
});
