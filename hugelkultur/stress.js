// What the keep has to answer, once water is no longer the only weather.
import { HEARTH_I, HEARTH_K, COURT, GRID, hash } from './world.js?v=hold';
import { eraOf } from './clearing.js?v=hold';
import { seasonOf } from './water.js?v=hold';
import { raiseLand } from './growth.js?v=hold';

const STEP = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function speak(sim, text) {
  if (!sim.quiet) sim.events.push({ type: 'note', text });
}

function spanOf(sim) {
  return Math.max(1, Math.round(Math.sqrt(sim.cells?.length || GRID)));
}

function cellAt(sim, i, k) {
  const span = spanOf(sim);
  if (i < 0 || k < 0 || i >= span || k >= span) return null;
  return sim.cells[k * span + i] || null;
}

function depthAt(sim, cell) {
  return sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
}

function nearSconce(sim, cell) {
  for (let dk = -2; dk <= 2; dk++) {
    for (let di = -2; di <= 2; di++) {
      const next = cellAt(sim, cell.i + di, cell.k + dk);
      if (next && ((next.sconce && (next.pyre || 0) > 0) || (next.pyre || 0) > 0)) return true;
    }
  }
  return false;
}

function nearWell(sim, cell) {
  if ((sim.cistern || 0) <= 0.04) return false;
  for (let dk = -1; dk <= 1; dk++) {
    for (let di = -1; di <= 1; di++) {
      const next = cellAt(sim, cell.i + di, cell.k + dk);
      if (next?.well) return true;
    }
  }
  return false;
}

export function noteSeep(sim) {
  const era = eraOf(sim);
  if (era !== 'keep' && era !== 'undercroft') {
    sim.seep = 0;
    return 0;
  }
  const hi = sim.hearth?.i ?? HEARTH_I;
  const hk = sim.hearth?.k ?? HEARTH_K;
  let sum = 0;
  let n = 0;
  for (const cell of sim.cells) {
    if (cell.hearth) continue;
    if (Math.hypot(cell.i - hi, cell.k - hk) <= COURT) continue;
    sum += cell.land || 0;
    n += 1;
  }
  const floor = sim.hearth?.land || 0;
  const rise = (n ? sum / n : 0) - floor;
  if (rise < 0.5) {
    sim.seep = 0;
    return 0;
  }
  sim.seep = Math.min(0.04, (rise - 0.5) * 0.05);
  if (!sim.saidSeep) {
    sim.saidSeep = true;
    if (sim.chronicle) sim.chronicle.seep = true;
    speak(sim, 'Water rises through the floor.');
  }
  return sim.seep;
}

export function noteDrought(sim, dt) {
  const era = eraOf(sim);
  const summer = seasonOf(sim).id === 'SUM';
  const due = ((sim.year || 1) % 4) === 0;
  if (!summer || era === 'glade' || !due) {
    sim.drought = false;
    return;
  }
  if (!sim.drought) {
    sim.drought = true;
    if (sim.chronicle) sim.chronicle.drought = true;
    speak(sim, 'The ground is thirsty.');
  }
  if (!(dt > 0)) return;
  for (const cell of sim.cells) {
    if (!cell.berm || cell.hearth || cell.crack || cell.clay) continue;
    const dry = depthAt(sim, cell) < 0.02 && (cell.moisture || 0) < 0.2;
    if (!dry) {
      cell.dryTime = 0;
      continue;
    }
    cell.dryTime = (cell.dryTime || 0) + dt;
    if (cell.dryTime > 70 && sim.saidCrack !== sim.year) {
      cell.crack = true;
      cell.dryTime = 0;
      sim.saidCrack = sim.year;
      sim.bedDirty = true;
      speak(sim, 'A dry mound cracks.');
    }
  }
}

function liftWall(sim, wall) {
  wall.heaved = true;
  if (Array.isArray(wall.block) && wall.block.length) wall.block.pop();
  wall.cubes = Math.max(0, (wall.cubes || 0) - 1);
  wall.crack = true;
  wall.burrow = Math.max(wall.burrow || 0, 0.35);
  sim.bedDirty = true;
  if (sim.chronicle) {
    sim.chronicle.heave = true;
    sim.chronicle.breach = true;
  }
  speak(sim, 'The frost lifts the wall.');
}

export function noteFrost(sim, dt, fold = false) {
  if (!(dt > 0)) return;
  const era = eraOf(sim);
  if (era === 'glade') return;
  if (!fold && seasonOf(sim).id !== 'WIN') return;
  if (fold) {
    for (const wall of sim.cells) {
      if (wall.hearth || wall.clay || wall.paved || wall.heaved) continue;
      if ((wall.cubes || 0) < 1) continue;
      if ((wall.stain || 0) < 0.35 && !wall.channel) continue;
      wall.heave = Math.min(2, (wall.heave || 0) + dt * 0.012);
      if (wall.heave < 1.4) continue;
      liftWall(sim, wall);
      return;
    }
    return;
  }
  for (const cell of sim.cells) {
    if (!cell.ice) continue;
    for (const [di, dk] of STEP) {
      if (Math.abs(di) + Math.abs(dk) !== 1) continue;
      const wall = cellAt(sim, cell.i + di, cell.k + dk);
      if (!wall || wall.hearth || wall.clay || wall.paved || wall.heaved) continue;
      if ((wall.cubes || 0) < 1 && !wall.berm) continue;
      if (wall._heaveAt === sim.time) continue;
      wall._heaveAt = sim.time;
      wall.heave = Math.min(2, (wall.heave || 0) + dt * 0.012);
      if (wall.heave < 1.4) continue;
      liftWall(sim, wall);
      return;
    }
  }
}

function woodHere(sim, cell) {
  if (cell.rotImmune || cell.paved && !cell.lintel && !cell.beam && !cell.hurdle) return false;
  if (cell.lintel || cell.hurdle || cell.beam || cell.weir) return true;
  if (sim.store && cell.i === sim.store.i && cell.k === sim.store.k) return true;
  return false;
}

export function noteRot(sim, dt) {
  if (!(dt > 0)) return;
  const era = eraOf(sim);
  if (era !== 'keep' && era !== 'undercroft') return;
  for (const cell of sim.cells) {
    if (nearSconce(sim, cell)) {
      cell.rot = Math.max(0, (cell.rot || 0) - dt * 0.02);
      cell.moisture = Math.max(0, (cell.moisture || 0) - dt * 0.05);
      continue;
    }
    const damp = (cell.moisture || 0) > 0.45 || (cell.roofed && (cell.moisture || 0) > 0.28) || depthAt(sim, cell) > 0.04;
    if (!damp || !woodHere(sim, cell)) continue;
    cell.rot = Math.min(1, (cell.rot || 0) + dt * 0.004);
    if (cell.rot < 1 || cell._rotted) continue;
    cell._rotted = true;
    if (sim.chronicle) {
      sim.chronicle.rot = true;
      sim.chronicle.breach = true;
    }
    if (cell.lintel || cell.hurdle) {
      cell.lintel = false;
      cell.hurdle = false;
      speak(sim, 'The lintel rots.');
      speak(sim, 'The door falls.');
    } else if (cell.beam) {
      cell.beam = false;
      if (!cell.roofed || cell.beam === false) cell.roofed = false;
      speak(sim, 'The beam gives way.');
    } else if (cell.cellar?.length) {
      cell.cellar.pop();
      speak(sim, 'Mildew takes the cellar.');
    }
  }
  for (const cell of sim.cells) {
    if ((cell.rot || 0) > 0.7 && cell.cellar?.length && !cell._mildew) {
      cell._mildew = true;
      cell.cellar.pop();
      speak(sim, 'Mildew takes the cellar.');
    }
  }
}

function fuel(sim, cell) {
  if (!cell || cell.hearth || cell.ice) return false;
  if (depthAt(sim, cell) > 0.04) return false;
  if (cell.moat && (cell.moatDeep || depthAt(sim, cell) > 0.02)) return false;
  if (nearWell(sim, cell)) return false;
  if ((cell.cubes || 0) > 0 && !cell.parched && !cell.lintel && !cell.beam && !cell.hurdle) return false;
  if ((cell.litter || 0) > 0.15) return true;
  if (cell.parched && (cell.berm || (cell.layers || 0) > 0)) return true;
  if (cell.lintel || cell.beam || cell.hurdle) return true;
  if (sim.store && cell.i === sim.store.i && cell.k === sim.store.k && (sim.store.sticks || []).length && !cell.roofed) return true;
  return (sim.loose || []).some(stick => !stick.fall && Math.hypot(stick.x - cell.x, stick.z - cell.z) < 0.55);
}

function boltLight(sim, x, y, z) {
  const compile = sim.kit?.KIT?.weather?.lightning;
  if (!compile) return 1;
  try {
    const track = compile({
      events: [{
        id: 'strike',
        type: 'lightning',
        time: 0,
        duration: 0.35,
        at: [x, y, z],
        color: '#d7e6ff',
        intensity: 3,
        radius: 8,
        attack: 0.05
      }]
    });
    const frame = track.frame(0.06);
    const light = frame?.light?.(x, y, z);
    return light ? Math.max(0.2, light[2] || 0) : 1;
  } catch {
    return 1;
  }
}

export function ignite(sim, cell) {
  if (!fuel(sim, cell) && (cell?.litter || 0) < 0.05 && !cell?.lintel && !cell?.beam) {
    if (!cell || depthAt(sim, cell) > 0.03 || cell.moat) return false;
  }
  if (!cell || cell.hearth) return false;
  if (depthAt(sim, cell) > 0.04 || (cell.moat && cell.moatDeep)) return false;
  if (nearWell(sim, cell)) return false;
  if ((cell.cubes || 0) > 0 && !cell.parched && !cell.lintel && !cell.beam) return false;
  cell.fire = Math.min(1, (cell.fire || 0) + 0.65);
  return true;
}

export function strikeTree(sim) {
  const trees = (sim.trees || []).filter(tree => !tree.fallen);
  trees.sort((a, b) => (b.growth || 0) - (a.growth || 0));
  const tree = trees[0];
  const cell = tree ? sim.cells[tree.k * spanOf(sim) + tree.i] : sim.cells.find(item => (item.litter || 0) > 0.2);
  if (!cell) return false;
  const y = (tree?.drop || cell.elevation || 1) + 2.2;
  const gain = boltLight(sim, cell.x, y, cell.z);
  sim.bolt = { t: 0, dur: 0.45, x: cell.x, z: cell.z, y, gain };
  ignite(sim, cell);
  cell.fire = Math.min(1, (cell.fire || 0) + 0.4);
  if (tree) tree.sick = true;
  if (sim.chronicle) sim.chronicle.fire = true;
  const name = tree?.kind || 'oak';
  speak(sim, name === 'oak' ? 'Lightning finds the oak.' : `Lightning finds the ${name}.`);
  return true;
}

export function spreadFire(sim, dt) {
  if (!(dt > 0)) return;
  let burnedStore = false;
  for (const cell of sim.cells) {
    if (!((cell.fire || 0) > 0.05)) continue;
    cell.fire = Math.max(0, cell.fire - dt * 0.12);
    cell.litter = Math.max(0, (cell.litter || 0) - dt * 0.25);
    cell.moisture = Math.max(0, (cell.moisture || 0) - dt * 0.3);
    cell.parched = true;
    cell.ash = (cell.ash || 0) + dt * 0.08;
    if (cell.ash > 0.45) {
      cell.ash = 0;
      raiseLand(sim, cell, 0.008);
    }
    if (cell.beam && cell.fire > 0.45) {
      cell.beam = false;
      cell.roofed = false;
      if (sim.chronicle) sim.chronicle.fire = true;
    }
    if (cell.lintel && cell.fire > 0.55) {
      cell.lintel = false;
      cell.hurdle = false;
      if (sim.chronicle) {
        sim.chronicle.fire = true;
        sim.chronicle.breach = true;
      }
      speak(sim, 'The fire takes the door.');
    }
    if (!burnedStore && sim.store && cell.i === sim.store.i && cell.k === sim.store.k && (sim.store.sticks || []).length && !cell.roofed) {
      sim.store.sticks.pop();
      burnedStore = true;
      if (sim.chronicle) sim.chronicle.fire = true;
      speak(sim, 'The fire takes the woodpile.');
    }
    if (sim.loose) {
      for (let n = sim.loose.length - 1; n >= 0; n--) {
        const stick = sim.loose[n];
        if (stick.fall) continue;
        if (Math.hypot(stick.x - cell.x, stick.z - cell.z) > 0.5) continue;
        sim.loose.splice(n, 1);
        break;
      }
    }
    for (const [di, dk] of STEP) {
      if (Math.abs(di) + Math.abs(dk) > 1) continue;
      const next = cellAt(sim, cell.i + di, cell.k + dk);
      if (!next || !fuel(sim, next)) continue;
      next.fire = Math.min(1, (next.fire || 0) + dt * 0.35);
    }
  }
}

function fillCistern(sim, dt) {
  const season = seasonOf(sim).id;
  if (season !== 'SPR' && season !== 'AUT') return;
  for (const cell of sim.cells) {
    if (!cell.well || depthAt(sim, cell) < 0.05) continue;
    sim.cistern = Math.min(1, (sim.cistern || 0) + dt * 0.012);
  }
}

function markMoat(sim) {
  for (const cell of sim.cells) {
    if (!cell.moat) continue;
    cell.moatDeep = depthAt(sim, cell) > 0.06 && (cell.sill || 0) <= -0.45;
  }
}

function considerStrike(sim, dt) {
  const season = seasonOf(sim).id;
  if (season !== 'SUM' && season !== 'AUT') return;
  if (eraOf(sim) === 'glade') return;
  sim.fireWait = (sim.fireWait || 0) + dt;
  if (sim.fireWait < 28) return;
  const odds = sim.drought ? 0.22 : 0.08;
  const roll = hash((sim.year || 1) * 19 + Math.floor((sim.time || 0) / 6));
  if (roll > odds) return;
  sim.fireWait = 0;
  strikeTree(sim);
}

export function updateStress(sim, dt) {
  if (!sim?.cells || sim.over || !(dt > 0)) return;
  noteSeep(sim);
  noteDrought(sim, dt);
  noteFrost(sim, dt);
  noteRot(sim, dt);
  considerStrike(sim, dt);
  spreadFire(sim, dt);
  fillCistern(sim, dt);
  markMoat(sim);
  if (sim.bolt) {
    sim.bolt.t += dt;
    if (sim.bolt.t > sim.bolt.dur) sim.bolt = null;
  }
}

export function passStressYear(sim) {
  if (!sim?.cells) return;
  const era = eraOf(sim);
  if (((sim.year || 1) % 4) === 0 && era !== 'glade' && sim.chronicle) sim.chronicle.drought = true;
  noteSeep(sim);
  noteRot(sim, 30);
  noteFrost(sim, 36, true);
  for (const cell of sim.cells) {
    if ((cell.fire || 0) > 0) cell.fire = Math.max(0, cell.fire - 0.5);
  }
}
