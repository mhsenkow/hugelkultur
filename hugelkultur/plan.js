// The keep, staked before it is built. Rooms sit against the ring and close one at a time.
import { HEARTH_I, HEARTH_K, COURT, hash } from './world.js?v=hold';
import { eraOf, wallHeight } from './clearing.js?v=hold';

export const WALL_GOAL = 1.48;

const DIRS = [
  { id: 'S', di: 0, dk: 1 },
  { id: 'N', di: 0, dk: -1 },
  { id: 'E', di: 1, dk: 0 },
  { id: 'W', di: -1, dk: 0 }
];

const MARK = {
  store: 'You mark the store.',
  cistern: 'You mark the cistern.',
  hall: 'You mark a hall.',
  garden: 'You mark a garden.',
  corridor: 'You mark a way between rooms.'
};

function spanOf(sim) {
  return Math.max(1, Math.round(Math.sqrt(sim.cells?.length || 1)));
}

function hearthOf(sim) {
  const found = sim.hearth || sim.cells?.find(cell => cell.hearth);
  return {
    i: found?.i ?? HEARTH_I,
    k: found?.k ?? HEARTH_K,
    span: spanOf(sim)
  };
}

export function roomBudget(span) {
  if (span >= 64) return 9;
  if (span >= 32) return 5;
  return 2;
}

export function interiorOf(span) {
  if (span >= 64) return { w: 5, d: 4 };
  if (span >= 32) return { w: 4, d: 3 };
  // A 16-grid ring already fills the middle. Two rows still leave a moat.
  return { w: 3, d: 2 };
}

function at(sim, i, k, span) {
  if (i < 0 || k < 0 || i >= span || k >= span) return null;
  return sim.cells[k * span + i] || null;
}

function sequence(span) {
  if (span >= 32) return ['store', 'cistern', 'hall', 'garden', 'corridor', 'hall', 'garden', 'corridor', 'hall'];
  return ['store', 'cistern'];
}

function ensure(sim) {
  if (!sim.plan || !Array.isArray(sim.plan.rooms)) sim.plan = { v: 1, rooms: [] };
  return sim.plan;
}

function overlaps(room, box) {
  return !(room.i1 < box.i0 || room.i0 > box.i1 || room.k1 < box.k0 || room.k0 > box.k1);
}

function scoreDir(sim, dir, kind, hearth) {
  let score = kind === 'store' && dir.id === 'S' ? 0.6 : 0;
  const reach = 4;
  for (let t = -2; t <= 2; t++) {
    const i = hearth.i + dir.di * reach + (dir.dk !== 0 ? t : 0);
    const k = hearth.k + dir.dk * reach + (dir.di !== 0 ? t : 0);
    const cell = at(sim, i, k, hearth.span);
    if (!cell) continue;
    const depth = sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
    if (kind === 'store') score -= depth * 4 + (cell.stain || 0) + (cell.moisture || 0);
    else if (kind === 'cistern') score -= (cell.land || 0) + (cell.elevation || 0) * 0.1 + (cell.sill || 0);
    else score -= Math.abs(t) * 0.05;
  }
  if (kind === 'cistern') {
    for (const cell of sim.cells) {
      if (!cell.outlet) continue;
      const toward = (cell.i - hearth.i) * dir.di + (cell.k - hearth.k) * dir.dk;
      if (toward > 0) score += 2.5;
    }
  }
  score += (hash(dir.id.charCodeAt(0) + (sim.year || 1)) - 0.5) * 0.05;
  return score;
}

function footprint(dir, iw, id, offset, hearth) {
  const span = iw + 2;
  // The shared wall sits just outside the ring. The door is punched back to the court.
  const along0 = 3;
  const along1 = along0 + id + 1;
  const cross0 = -Math.floor((span - 1) / 2) + offset;
  const cross1 = cross0 + span - 1;
  let i0;
  let i1;
  let k0;
  let k1;
  let doorI;
  let doorK;
  if (dir.dk === 1) {
    k0 = hearth.k + along0;
    k1 = hearth.k + along1;
    i0 = hearth.i + cross0;
    i1 = hearth.i + cross1;
    doorI = Math.round((i0 + i1) / 2);
    doorK = k0;
  } else if (dir.dk === -1) {
    k1 = hearth.k - along0;
    k0 = hearth.k - along1;
    i0 = hearth.i + cross0;
    i1 = hearth.i + cross1;
    doorI = Math.round((i0 + i1) / 2);
    doorK = k1;
  } else if (dir.di === 1) {
    i0 = hearth.i + along0;
    i1 = hearth.i + along1;
    k0 = hearth.k + cross0;
    k1 = hearth.k + cross1;
    doorI = i0;
    doorK = Math.round((k0 + k1) / 2);
  } else {
    i1 = hearth.i - along0;
    i0 = hearth.i - along1;
    k0 = hearth.k + cross0;
    k1 = hearth.k + cross1;
    doorI = i1;
    doorK = Math.round((k0 + k1) / 2);
  }
  return { i0, k0, i1, k1, door: [doorI, doorK], dir: dir.id };
}

function boxFits(sim, box, hearth) {
  if (!box) return false;
  if (box.i0 < 1 || box.k0 < 1 || box.i1 > hearth.span - 2 || box.k1 > hearth.span - 2) return false;
  if (box.i1 <= box.i0 || box.k1 <= box.k0) return false;
  for (let k = box.k0; k <= box.k1; k++) {
    for (let i = box.i0; i <= box.i1; i++) {
      const cell = at(sim, i, k, hearth.span);
      if (!cell || cell.hearth) return false;
      if (Math.hypot(i - hearth.i, k - hearth.k) <= COURT && !(i === box.door[0] && k === box.door[1])) {
        if (i !== box.door[0] || k !== box.door[1]) {
          // The shared wall may graze the court. The interior may not.
          const edge = i === box.i0 || i === box.i1 || k === box.k0 || k === box.k1;
          if (!edge) return false;
        }
      }
    }
  }
  for (const room of sim.plan?.rooms || []) {
    if (overlaps(room, box)) return false;
  }
  return true;
}

function offsetsFor(span) {
  const step = span >= 32 ? 7 : 6;
  return [0, step, -step, step * 2, -step * 2];
}

function annexBox(sim, name, hearth) {
  const { w, d } = interiorOf(hearth.span);
  const dirs = DIRS.slice().sort((a, b) => scoreDir(sim, b, name, hearth) - scoreDir(sim, a, name, hearth));
  for (const dir of dirs) {
    for (const offset of offsetsFor(hearth.span)) {
      const box = footprint(dir, w, d, offset, hearth);
      if (boxFits(sim, box, hearth)) return box;
    }
  }
  return null;
}

function gapBetween(a, b) {
  const kOverlap = Math.min(a.k1, b.k1) - Math.max(a.k0, b.k0);
  const iOverlap = Math.min(a.i1, b.i1) - Math.max(a.i0, b.i0);
  if (kOverlap >= 2 && iOverlap < 0) {
    const i0 = Math.min(a.i1, b.i1) + 1;
    const i1 = Math.max(a.i0, b.i0) - 1;
    if (i1 < i0 || i1 - i0 > 2) return null;
    return {
      i0,
      i1,
      k0: Math.max(a.k0, b.k0),
      k1: Math.min(a.k1, b.k1),
      door: [i0, Math.round((Math.max(a.k0, b.k0) + Math.min(a.k1, b.k1)) / 2)],
      dir: 'gap'
    };
  }
  if (iOverlap >= 2 && kOverlap < 0) {
    const k0 = Math.min(a.k1, b.k1) + 1;
    const k1 = Math.max(a.k0, b.k0) - 1;
    if (k1 < k0 || k1 - k0 > 2) return null;
    return {
      i0: Math.max(a.i0, b.i0),
      i1: Math.min(a.i1, b.i1),
      k0,
      k1,
      door: [Math.round((Math.max(a.i0, b.i0) + Math.min(a.i1, b.i1)) / 2), k0],
      dir: 'gap'
    };
  }
  return null;
}

function corridorBox(sim, hearth) {
  const rooms = (sim.plan?.rooms || []).filter(room => room.name !== 'corridor');
  for (let n = 0; n < rooms.length; n++) {
    for (let m = n + 1; m < rooms.length; m++) {
      const box = gapBetween(rooms[n], rooms[m]);
      if (boxFits(sim, box, hearth)) return box;
    }
  }
  return null;
}

function clearWall(cell) {
  if (!cell || cell.lintel) return;
  cell.cubes = 0;
  cell.block = null;
  cell.berm = false;
  cell.layers = 0;
  cell.lift = 0;
}

// The ring is more than one cell thick. The door is the outer cell.
// The cells between it and the court have to open too, or the room has no way in.
function openPassage(sim, door, hearth) {
  let i = door.i;
  let k = door.k;
  for (let n = 0; n < 6; n++) {
    const cell = at(sim, i, k, hearth.span);
    if (!cell || cell.hearth) return;
    const dist = Math.hypot(i - hearth.i, k - hearth.k);
    if (n > 0 && dist <= 1.85) return;
    if ((cell.cubes || 0) > 0 || cell.berm || (cell.layers || 0) >= 3) clearWall(cell);
    cell.threshold = true;
    if (dist <= 1.85) return;
    const di = hearth.i - i;
    const dk = hearth.k - k;
    if (!di && !dk) return;
    if (Math.abs(di) >= Math.abs(dk)) i += Math.sign(di);
    else k += Math.sign(dk);
  }
}

function borderWalk(room, visit) {
  for (let i = room.i0; i <= room.i1; i++) {
    visit(i, room.k0);
    if (room.k1 !== room.k0) visit(i, room.k1);
  }
  for (let k = room.k0 + 1; k <= room.k1 - 1; k++) {
    visit(room.i0, k);
    if (room.i1 !== room.i0) visit(room.i1, k);
  }
}

function stake(sim, name, box, hearth) {
  const id = `${name}-${sim.plan.rooms.length}`;
  const room = {
    id,
    name,
    i0: box.i0,
    k0: box.k0,
    i1: box.i1,
    k1: box.k1,
    door: box.door.slice(),
    closed: false,
    dir: box.dir
  };
  borderWalk(room, (i, k) => {
    const cell = at(sim, i, k, hearth.span);
    if (!cell || cell.hearth) return;
    const door = i === room.door[0] && k === room.door[1];
    if (door) {
      cell.plannedDoor = id;
      cell.threshold = true;
      cell.sill = Math.max(cell.sill || 0, 0.18);
      openPassage(sim, cell, hearth);
      sim.bedDirty = true;
      return;
    }
    cell.planned = id;
    if (cell.race || cell.river) cell.gratePlan = id;
  });
  let pi = Math.round((room.i0 + room.i1) / 2);
  let pk = Math.round((room.k0 + room.k1) / 2);
  let heart = at(sim, pi, pk, hearth.span);
  if (!heart || heart.planned || heart.plannedDoor) {
    for (let k = room.k0 + 1; k <= room.k1 - 1 && (!heart || heart.planned); k++) {
      for (let i = room.i0 + 1; i <= room.i1 - 1; i++) {
        const next = at(sim, i, k, hearth.span);
        if (next && !next.planned && !next.plannedDoor) {
          heart = next;
          pi = i;
          pk = k;
        }
      }
    }
  }
  if (heart && !heart.hearth) {
    heart.keepRoom = name === 'corridor' ? 'hall' : name;
    if (name === 'store' && !sim.store) {
      heart.storePlan = id;
    }
  }
  sim.plan.rooms.push(room);
  if (!sim.quiet) sim.events.push({ type: 'note', text: MARK[name] || 'You mark a room.' });
  return room;
}

export function roomClosed(sim, room) {
  const hearth = hearthOf(sim);
  let walls = 0;
  let open = 0;
  borderWalk(room, (i, k) => {
    const cell = at(sim, i, k, hearth.span);
    if (!cell) {
      open += 1;
      return;
    }
    const door = i === room.door[0] && k === room.door[1];
    if (door) {
      if (!cell.lintel) open += 1;
      return;
    }
    if (cell.grate || wallHeight(cell) >= 0.9) walls += 1;
    else open += 1;
  });
  return open === 0 && walls > 0;
}

function closeFinished(sim) {
  for (const room of sim.plan.rooms) {
    if (room.closed) continue;
    if (!roomClosed(sim, room)) continue;
    room.closed = true;
    const hearth = hearthOf(sim);
    const heartI = Math.round((room.i0 + room.i1) / 2);
    const heartK = Math.round((room.k0 + room.k1) / 2);
    const heart = at(sim, heartI, heartK, hearth.span);
    if (room.name === 'store' && heart && !sim.store) {
      heart.store = true;
      sim.store = { i: heart.i, k: heart.k, sticks: [], chest: true };
    }
    if (room.name === 'cistern' && heart && !heart.sump && !heart.well) heart.sump = true;
    if (sim.chronicle) sim.chronicle.room = true;
  }
}

export function planKeep(sim) {
  if (!sim?.cells?.length) return null;
  const plan = ensure(sim);
  closeFinished(sim);
  const hearth = hearthOf(sim);
  if (eraOf(sim) === 'glade') return plan;
  if (plan.rooms.some(room => !room.closed)) return plan;
  const names = sequence(hearth.span);
  if (plan.rooms.length >= roomBudget(hearth.span) || plan.rooms.length >= names.length) return plan;
  const name = names[plan.rooms.length];
  let box = name === 'corridor' ? corridorBox(sim, hearth) : annexBox(sim, name, hearth);
  let used = name;
  if (!box && name === 'corridor') {
    box = annexBox(sim, 'hall', hearth);
    used = 'hall';
  }
  if (!box) return plan;
  stake(sim, used, box, hearth);
  return plan;
}

export function moatRadius(sim) {
  const hearth = hearthOf(sim);
  let outer = 5;
  for (const room of sim.plan?.rooms || []) {
    outer = Math.max(
      outer,
      Math.abs(room.i0 - hearth.i),
      Math.abs(room.i1 - hearth.i),
      Math.abs(room.k0 - hearth.k),
      Math.abs(room.k1 - hearth.k)
    );
  }
  return Math.min(hearth.span - 2, outer + 2);
}

export function moatCells(sim) {
  if (!sim?.cells) return [];
  const hearth = hearthOf(sim);
  let radius = moatRadius(sim);
  const out = [];
  const seen = new Set();
  const add = cell => {
    if (!cell || cell.hearth || seen.has(cell)) return;
    seen.add(cell);
    out.push(cell);
  };
  const takeRing = (band) => {
    for (const cell of sim.cells) {
      const cheb = Math.max(Math.abs(cell.i - hearth.i), Math.abs(cell.k - hearth.k));
      if (cheb !== band || cell.tree || cell.clearing) continue;
      if (cell.planned && !cell.moat) continue;
      add(cell);
    }
  };
  takeRing(radius);
  while (out.length < 8 && radius > 5) {
    radius -= 1;
    takeRing(radius);
  }
  const outlet = sim.cells.find(cell => cell.outlet && !cell.hearth);
  if (outlet && out.length) {
    let from = out[0];
    let best = Infinity;
    for (const cell of out) {
      const dist = Math.hypot(cell.i - outlet.i, cell.k - outlet.k);
      if (dist < best) {
        best = dist;
        from = cell;
      }
    }
    let i = from.i;
    let k = from.k;
    while (i !== outlet.i || k !== outlet.k) {
      if (i !== outlet.i) i += Math.sign(outlet.i - i);
      if (k !== outlet.k) k += Math.sign(outlet.k - k);
      const cell = at(sim, i, k, hearth.span);
      if (!cell) continue;
      const cheb = Math.max(Math.abs(cell.i - hearth.i), Math.abs(cell.k - hearth.k));
      if (cheb < radius && cell !== outlet) continue;
      if (cell.planned && !cell.moat) continue;
      add(cell);
    }
  }
  return out;
}
