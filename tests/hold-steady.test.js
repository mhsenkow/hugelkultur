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
        snow: 0,
        litter: 0,
        moisture: 0.2,
        channel: false
      });
    }
  }
  return cells;
}

test('NaN ground still has a height', async () => {
  const world = await import('../hugelkultur/world.js');
  const cell = {
    elevation: 0.9,
    land: Number.NaN,
    layers: Number.NaN,
    raft: Number.NaN,
    snow: Number.NaN,
    sill: Number.NaN,
    sunk: 0,
    cubes: 0
  };
  assert.equal(Number.isFinite(world.bedHeight(cell)), true);
  assert.equal(world.finite(Number.NaN), 0);
  assert.equal(world.finite(2, 0), 2);
});

test('motions drop the spent and keep a short list', async () => {
  const motions = await import('../hugelkultur/motions.js');
  const sim = { motions: [] };
  for (let n = 0; n < 40; n++) motions.pushMotion(sim, { kind: 'dig', t: 0, dur: 1, x: n, y: 1, z: 0 });
  assert.ok(sim.motions.length <= 24);
  sim.motions.push({ kind: 'dust', t: 0, dur: Number.NaN });
  sim.motions.push({ kind: 'wake', t: 2, dur: 1 });
  motions.updateMotions(sim, 0.2);
  assert.equal(sim.motions.every(item => Number.isFinite(item.dur) && item.t < item.dur), true);
  assert.ok(sim.motions.length <= 24);
});

test('weather does not spin when the fall acc is infinite', async () => {
  const weather = await import('../hugelkultur/weather.js');
  const cells = board();
  const sim = {
    over: false,
    seasonIndex: 0,
    seasonTime: 1,
    weatherSeason: 0,
    time: 3,
    fall: [],
    fallAcc: Infinity,
    cells,
    live: [],
    trees: [],
    hearth: cells[8 * 16 + 8]
  };
  const start = Date.now();
  weather.updateWeather(sim, 0.016);
  assert.ok(Date.now() - start < 400);
  assert.ok(sim.fall.length <= 64);
  assert.equal(Number.isFinite(sim.fallAcc), true);
});
