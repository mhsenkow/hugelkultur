const test = require('node:test');
const assert = require('node:assert/strict');

test('clearing rules', async () => {
  const rules = await import('../hugelkultur/clearing.js');
  assert.equal(rules.pressureOf(1, 0.22), 1);
  assert.equal(Number(rules.pressureOf(4, 0.22).toFixed(2)), 1.66);
  assert.equal(rules.liftCap(1), 2);
  assert.equal(rules.liftCap(4), 5);
  assert.equal(rules.storyLine([]), 'A mound. It is good.');
  assert.equal(rules.storyLine(['rain', 'tend', 'leaf']), 'Rain. Then you. Then leaves.');
  assert.equal(rules.stickPhrase('oak'), 'an oak stick');
  assert.equal(rules.stickPhrase('birch'), 'a birch stick');
  assert.equal(rules.phrase('White oak'), 'a white oak');
  assert.equal(rules.woodOf('oak').sticks, 2);
  assert.equal(rules.woodOf('birch').slide > 0.5, true);
  assert.equal(rules.woodOf('willow').bridge, 1);
  assert.equal(rules.woodOf('alder').root, 1);
  assert.equal(rules.seasonFit('SPR', 'SPR') > 1, true);
  assert.equal(rules.seasonFit('SPR', 'WIN') < 1, true);
  assert.equal(rules.fitLine({ obj: 'him' }, 'SPR', 'SPR'), 'Spring fits him.');
  assert.equal(rules.fitLine({ obj: 'her' }, 'WIN', 'SUM'), 'Winter asks more of her.');
  assert.equal(rules.idolLabel(rules.idolStage(0)), 'idol dry');
  assert.equal(rules.idolLabel(rules.idolStage(0.012)), 'at the hem');
  assert.equal(rules.idolLabel(rules.idolStage(0.03)), 'idol drinks');
  assert.equal(rules.idolStage(Number.NaN), 'dry');
  assert.equal(rules.idolStage(Infinity), 'dry');
  assert.equal(rules.yearTitle({ circle: true }), 'The year the circle held.');
  assert.equal(rules.yearTitle({ wood: 'willow', edge: 'N' }), 'The year the willow took the north gate.');
  assert.equal(rules.yearTitle({ berms: 3 }), 'The year the mounds kept the figure.');
  assert.equal(rules.yearTitle({ breach: true, drank: true }), 'The year the wall broke.');
  assert.equal(rules.yearTitle({ room: true }), 'The year the wall made a room.');
  assert.equal(rules.stops({ cubes: 2 }, 'people'), true);
  assert.equal(rules.stops({ hurdle: true }, 'water'), false);
  assert.equal(rules.eraOf({ cells: [], year: 1 }), 'glade');
  assert.equal(rules.landCap('keep'), 1);
  assert.equal(rules.awayLine(1, false), 'A season passed.');
  assert.equal(rules.awayLine(6, true), 'A year kept going.');
  assert.equal(rules.YEAR_SPAN, 240);
  assert.equal(rules.stoneReady(0, 0), false);
  assert.equal(rules.stoneReady(rules.YEAR_SPAN * 11, 0.99), true);
  assert.equal(rules.fallReady(0, 1, 0, false), false);
  assert.equal(rules.fallReady(rules.YEAR_SPAN * 15, 1, 0, 'birch'), false);
  assert.equal(rules.fallReady(rules.YEAR_SPAN * 80, 1, 0, 'birch'), true);
  assert.equal(rules.fallReady(rules.YEAR_SPAN * 80, 1, 0, 'oak'), false);
  assert.equal(rules.fallReady(rules.YEAR_SPAN * 200, 1, 0.2, 'oak'), true);
  assert.equal(rules.fallReady(rules.YEAR_SPAN * 200, 0.2, 0, 'oak'), false);
  assert.ok(rules.statureOf(4) > rules.statureOf(1));
  assert.ok(rules.statureOf(8) < 3.5);
  assert.ok(rules.lifeSpan('birch', 0) < rules.lifeSpan('oak', 0));
  assert.equal(rules.blightStrike('chestnut', 0.01), true);
  assert.equal(rules.blightStrike('oak', 0.5), false);
  assert.equal(rules.beaverWood('willow'), true);
  assert.equal(rules.beaverWood('oak'), false);
  assert.equal(rules.treeScale(0), 0.52);
  assert.equal(rules.treeScale(0.99), 1.68);
  assert.equal(rules.gladeBeams(1, 16), 4);
  assert.equal(rules.gladeBeams(3, 16), 6);
  assert.equal(rules.gladeBeams(20, 16), 16);
  assert.equal(rules.gladeBeams(8, 5), 5);
  assert.equal(rules.sparkleSets(4), 0);
  assert.equal(rules.sparkleSets(5), 1);
  assert.equal(rules.sparkleSets(10), 2);
  assert.equal(rules.fernCount(1), 0);
  assert.equal(rules.fernCount(3), 1);
  assert.equal(rules.fernCount(20), 6);

  const specimens = await import('../hugelkultur/specimens.js');
  const oakLooks = specimens.studiesFor('oak').map(item => item.id);
  assert.deepEqual(oakLooks, ['simple', 'open', 'broad', 'low']);
  assert.deepEqual(specimens.studiesFor('carrot').map(item => item.id), ['plain', 'bed', 'young']);
  assert.deepEqual(specimens.studiesFor('leaf').map(item => item.id), ['drift', 'settle']);
  assert.deepEqual(specimens.studiesFor('snow').map(item => item.id), ['spike', 'quilt']);
  assert.equal(specimens.cubeTake('carrot'), 'bed');
  assert.equal(specimens.cubeTake('leaf'), 'settle');
  assert.equal(specimens.cubeTake('snow'), 'quilt');
  assert.equal(specimens.cubeTake('oak'), 'simple');
  assert.deepEqual(specimens.studiesFor('fern').map(item => item.id), ['simple', 'full']);
  assert.deepEqual(specimens.studiesFor('pick'), []);
  const kept = specimens.studyOf('oak', 'simple');
  assert.equal(specimens.studyOf('oak'), kept);
  assert.equal(kept.h, 3.4);
  assert.equal(kept.clumps, 8);
  const open = specimens.studyOf('oak', 'open');
  assert.ok(open.clumps < kept.clumps);
  assert.ok(open.leaf.a < kept.leaf.a);
  assert.equal(kept.leaf.a, 0.74);
  assert.ok(specimens.studyOf('oak', 'broad').spread > kept.spread);
  assert.ok(specimens.studyOf('oak', 'low').h < kept.h);

  const growth = await import('../hugelkultur/growth.js');
  const bed = { land: 0.4 };
  const sim = { bedDirty: false };
  growth.raiseLand(sim, bed, 0.05);
  assert.equal(bed.land, 0.42);
  assert.equal(sim.bedDirty, true);
  const idol = { hearth: true, land: 0 };
  growth.raiseLand(sim, idol, 0.2);
  assert.equal(idol.land, 0);
  const mound = { berm: true, hearth: false, layers: 3, coat: 2, lift: 1, rock: true, fruit: 'carrot' };
  const figure = { berm: false, hearth: true };
  const forest = { cells: [mound, figure], bedDirty: false, holding: true, quiet: true, events: [] };
  assert.equal(growth.settleMounds(forest), 1);
  assert.equal(mound.berm, false);
  assert.equal(mound.rock, false);
  assert.equal(mound.layers, 0);
  assert.equal(mound.fruit, 'carrot');
  assert.equal(mound.cubes, 1);
  assert.equal(mound.block[0], 0.74);
  assert.equal(figure.cubes, undefined);
  assert.equal(forest.bedDirty, true);
  assert.equal(forest.holding, true);
  mound.berm = true;
  growth.settleMounds(forest);
  growth.settleMounds({ ...forest, cells: [mound] });
  mound.berm = true;
  mound.cubes = 4;
  mound.block = null;
  mound.sunk = 0;
  growth.settleMounds(forest);
  assert.equal(mound.cubes, 5);
  assert.equal(mound.berm, false);
  assert.ok(mound.block.length <= 4);
  assert.ok((mound.sunk || 0) + mound.block.reduce((sum, height) => sum + height, 0) > 4 * 0.74);
  const tall = { berm: true, hearth: false, coat: 6, lift: 2, rock: false, land: 0, marks: { tend: true, leaf: true, snow: true, rain: true }, story: ['tend', 'leaf', 'snow', 'rain'], fruit: 'turnip' };
  growth.settleMounds({ cells: [tall], bedDirty: false, quiet: true, events: [] });
  assert.ok(tall.block[0] >= 1.06);
  assert.equal(tall.fruit, 'turnip');
  assert.equal(tall.marks.rain, true);
  assert.equal(tall.berm, false);

  const cells = [];
  for (let k = 0; k < 16; k++) {
    for (let i = 0; i < 16; i++) cells.push({ i, k, berm: false, layers: 0, hearth: i === 8 && k === 8 });
  }
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), false);
  for (const cell of cells) {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    if (dist > 1.85 && dist < 3.35) cell.berm = true;
  }
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), true);
  for (const cell of cells) cell.berm = false;
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), false);
  for (const cell of cells) {
    const dist = Math.hypot(cell.i - 8, cell.k - 8);
    if (dist > 1.85 && dist < 3.35) cell.cubes = 1;
  }
  assert.equal(rules.circleClosed(cells, 8, 8, 1.85), true);
  for (const cell of cells) cell.cubes = 0;
  cells[6 * 16 + 8].cubes = 1;
  const gap = rules.circleState(cells, 8, 8, 1.85);
  assert.equal(gap.closed, false);
  assert.equal(gap.missing, 'west');
  assert.equal(rules.compassName(8, 6), 'north');
  assert.equal(rules.stillWants({ tend: true }), ' It still wants leaves, snow, rain.');
  assert.equal(rules.holdsWater({ cubes: 1 }), true);
  assert.equal(rules.holdsWater({ dam: true }), true);
  assert.equal(rules.holdsWater({ layers: 1 }), false);
  assert.equal(rules.groundLine(1), 'A year is in this ground.');
  assert.equal(rules.groundLine(3), 'Three years are in this ground.');
  assert.equal(rules.groundLine(12), 'Many years are in this ground.');
  assert.equal(rules.idolVoice('dry'), 'Nothing came. It is good.');
  assert.equal(rules.idolVoice('hem'), 'The water came to the hem. It passed.');
  assert.equal(rules.idolVoice('drinks'), '');
  assert.equal(rules.buried({ berm: false, layers: 2, snow: 0.6 }), true);
  assert.equal(rules.buried({ berm: true, layers: 2, snow: 0.8 }), false);

  const measures = rules.blankMeasures();
  measures.snow.home = 'SPR';
  assert.equal(rules.fittingId(measures, 'AUT'), 'tree');
  assert.equal(rules.fittingId(measures, 'WIN'), null);
  assert.equal(rules.SEASON_LOOK.WIN.pattern, 'blue-noise');
  assert.equal(rules.MOUTH_YAW.N, 0);
});

test('guide and memory modules load', async () => {
  const guide = await import('../hugelkultur/guide.js');
  const memory = await import('../hugelkultur/memory.js');
  const water = await import('../hugelkultur/water.js');
  assert.equal(typeof guide.steer, 'function');
  assert.equal(typeof memory.passSeason, 'function');
  assert.equal(water.seasonLength({ seasonIndex: 1 }), 84);
  assert.equal(water.seasonLength({ seasonIndex: 0 }), 52);
  const mouth = {
    seasonIndex: 2,
    live: [{ bit: water.SEASONS[2].bit, edge: 'S', gate: [7, 10], mouth: [5, 15] }],
    cells: [{ i: 7, k: 10, berm: false, layers: 0, cubes: 0, hearth: false }]
  };
  assert.match(water.waterLine(mouth, 'hem'), /south/);
  assert.match(water.waterLine(mouth, 'hem'), /open/);
  mouth.cells[0].cubes = 1;
  assert.match(water.waterLine(mouth, 'drinks'), /held/);
});

test('a larger grid keeps the idol in the middle', async () => {
  const world = await import('../hugelkultur/world.js');
  try {
    assert.equal(world.useGrid(32), 32);
    assert.equal(world.GRID, 32);
    assert.equal(world.HEARTH_I, 16);
    assert.equal(world.HEARTH_K, 16);
    assert.equal(world.ORIGIN, -16);
    assert.equal(world.cellCenter(16, 16).x, 0.5);
    assert.equal(world.useGrid(64), 64);
    assert.equal(world.HEARTH_I, 32);
    assert.equal(world.cellAt([], 80, 80), null);
  } finally {
    world.useGrid(16);
  }
  assert.equal(world.GRID, 16);
  assert.equal(world.ORIGIN, -8);
});
