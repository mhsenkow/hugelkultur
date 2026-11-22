import { PALETTE, STIPPLE, SCENE, hash, sceneCount, dressSculpt } from './world.js?v=hold';
import { paintClip } from './motions.js?v=hold';
import { paintCrop, paintLeafStudy, paintSnowStudy } from './gardens.js?v=hold';

const OAK_BARK = { r: [11, 5, 1] };
const MAPLE_BARK = { r: [5, 11, 10] };
const BIRCH_BARK = { r: [6, 4, 1] };
const OAK_LEAF = { r: [15, 7, 8], a: 0.74 };
const MAPLE_LEAF = { r: [9, 8, 13], a: 0.46 };
const BIRCH_LEAF = { r: [9, 8, 15], a: 0.72 };

// One canonical form per species. The grove and the library both sculpt from this.
const FORMS = {
  oak: { h: 3.4, r: 0.28, bark: OAK_BARK, leaf: OAK_LEAF, spread: 2.6, rise: 1.5, clumps: 8, lift: 0.2, focus: 2.2, dist: 15, ground: 1.8 },
  maple: { h: 5.4, r: 0.16, bark: MAPLE_BARK, leaf: MAPLE_LEAF, spread: 2.1, rise: 2.2, clumps: 7, lift: 0.45, focus: 3.4, dist: 18, ground: 1.6 },
  birch: { h: 4.6, r: 0.13, bark: BIRCH_BARK, leaf: BIRCH_LEAF, spread: 2.15, rise: 0.65, clumps: 11, lift: 0.16, focus: 2.6, dist: 15, ground: 1.5 },
  beech: { h: 4.2, r: 0.22, bark: { r: [6, 4, 1] }, leaf: { r: [15, 7, 8], a: 0.82 }, spread: 2.2, rise: 1.1, clumps: 9, lift: 0.15, focus: 2.6, dist: 16, ground: 1.6 },
  ash: { h: 4.8, r: 0.15, bark: { r: [5, 11, 1] }, leaf: { r: [9, 8, 7], a: 0.58 }, spread: 2.05, rise: 0.95, clumps: 9, lift: 0.22, focus: 2.8, dist: 16, ground: 1.45 },
  linden: { h: 3.8, r: 0.2, bark: { r: [11, 5, 2] }, leaf: { r: [9, 8, 13], a: 0.7 }, spread: 2.4, rise: 1.2, clumps: 8, lift: 0.1, focus: 2.4, dist: 16, ground: 1.7 },
  hornbeam: { h: 3.2, r: 0.18, bark: { r: [1, 5, 11] }, leaf: { r: [15, 8, 7], a: 0.78 }, spread: 1.5, rise: 0.8, clumps: 7, lift: 0.05, focus: 2, dist: 13, ground: 1.3 },
  alder: { h: 3.6, r: 0.1, bark: { r: [11, 1, 5] }, leaf: { r: [8, 7, 15], a: 0.55 }, spread: 1.4, rise: 1.4, clumps: 6, lift: 0.3, stems: 3, focus: 2.2, dist: 14, ground: 1.3 },
  willow: { h: 4.4, r: 0.16, bark: { r: [5, 11, 2] }, leaf: { r: [9, 8, 6], a: 0.42 }, spread: 2.3, rise: -1.35, clumps: 8, lift: 0.1, focus: 2.4, dist: 16, ground: 1.7 },
  pine: { h: 5.2, r: 0.14, bark: { r: [11, 5, 1] }, leaf: { r: [15, 8, 7], a: 0.82 }, spread: 1.9, rise: 1.05, clumps: 11, lift: 0.12, focus: 3.2, dist: 16, ground: 1.4 },
  hemlock: { h: 4.8, r: 0.12, bark: { r: [1, 11, 5] }, leaf: { r: [15, 8, 7], a: 0.7 }, spread: 2, rise: 0.9, clumps: 11, lift: 0.18, focus: 2.8, dist: 16, ground: 1.45 },
  cherry: { h: 3.6, r: 0.14, bark: { r: [1, 11, 5] }, leaf: { r: [6, 14, 9], a: 0.58 }, spread: 1.8, rise: 1.3, clumps: 7, lift: 0.25, focus: 2.2, dist: 14, ground: 1.4 },
  chestnut: { h: 4.6, r: 0.26, bark: { r: [11, 5, 2] }, leaf: { r: [8, 9, 15], a: 0.7 }, spread: 3, rise: 1.4, clumps: 9, lift: 0.15, focus: 2.8, dist: 18, ground: 2 },
  serviceberry: { h: 2.4, r: 0.08, bark: { r: [5, 11, 6] }, leaf: { r: [6, 14, 4], a: 0.5 }, spread: 1.1, rise: 0.9, clumps: 5, lift: 0.2, focus: 1.5, dist: 11, ground: 1.1 },
  hazel: { h: 1.7, r: 0.05, bark: { r: [11, 5, 10] }, leaf: { r: [9, 8, 7], a: 0.62 }, spread: 0.9, rise: 0.6, clumps: 6, lift: 0.1, stems: 5, focus: 1.1, dist: 8, ground: 1.1 },
  elder: { h: 1.5, r: 0.035, bark: { r: [6, 4, 11] }, leaf: { r: [6, 14, 4], a: 0.55 }, spread: 0.7, rise: 0.35, clumps: 4, lift: 0.05, stems: 6, focus: 1, dist: 7.5, ground: 1 },
  fern: { focus: 0.7, dist: 6.5, ground: 0.9 },
  ginger: { focus: 0.4, dist: 5.2, ground: 0.8 },
  carrot: { crop: true, focus: 0.45, dist: 5.4, ground: 0.7 },
  turnip: { crop: true, focus: 0.4, dist: 5.4, ground: 0.7 },
  mushroom: { crop: true, focus: 0.4, dist: 5.2, ground: 0.7 },
  leaf: { focus: 0.5, dist: 6.2, ground: 1.15, weather: true },
  snow: { focus: 0.42, dist: 6.2, ground: 1.15, weather: true }
};

const STUDY = {
  simple: { id: 'simple', name: 'Simple', line: 'The one we started with.' },
  open: { id: 'open', name: 'Open', line: 'Air in the crown. The cube still plants Simple.' },
  broad: { id: 'broad', name: 'Broad', line: 'The crown goes wide. The cube still plants Simple.' },
  low: { id: 'low', name: 'Low', line: 'It stays near the ground. The cube still plants Simple.' },
  full: { id: 'full', name: 'Full', line: 'More fronds. The cube still plants Simple.' },
  wide: { id: 'wide', name: 'Wide', line: 'The leaves spread. The cube still plants Simple.' },
  young: { id: 'young', name: 'Young', line: 'Before it is ripe. The cube plants Bed.' },
  plain: { id: 'plain', name: 'Plain', line: 'The old strokes. The cube plants Bed.' },
  bed: { id: 'bed', name: 'Bed', line: 'It sits in the soil. The cube plants this.' },
  drift: { id: 'drift', name: 'Drift', line: 'They leave the cube. The cube plants Settle.' },
  settle: { id: 'settle', name: 'Settle', line: 'They lie on the ground. The cube plants this.' },
  spike: { id: 'spike', name: 'Spike', line: 'A white slash. The cube plants Quilt.' },
  quilt: { id: 'quilt', name: 'Quilt', line: 'Soft snow on the ground. The cube plants this.' }
};

export function cubeTake(id) {
  if (id === 'leaf') return 'settle';
  if (id === 'snow') return 'quilt';
  if (FORMS[id]?.crop) return 'bed';
  return 'simple';
}

export function studiesFor(id) {
  const form = FORMS[id];
  if (!form) return [];
  if (id === 'leaf') return [STUDY.drift, STUDY.settle];
  if (id === 'snow') return [STUDY.spike, STUDY.quilt];
  if (form.crop) return [STUDY.plain, STUDY.bed, STUDY.young];
  if (id === 'fern') return [STUDY.simple, STUDY.full];
  if (id === 'ginger') return [STUDY.simple, STUDY.wide];
  if (form.h) return [STUDY.simple, STUDY.open, STUDY.broad, STUDY.low];
  return [];
}

export function studyOf(id, take) {
  const base = FORMS[id];
  if (!base || !take || take === 'simple' || !base.h || !base.leaf) return base;
  if (take === 'open') {
    return {
      ...base,
      spread: base.spread * 0.92,
      clumps: Math.max(3, Math.round(base.clumps * 0.45)),
      lift: (base.lift || 0) + 0.08,
      leaf: { ...base.leaf, a: Math.max(0.22, (base.leaf.a || 0.5) * 0.62) }
    };
  }
  if (take === 'broad') {
    return {
      ...base,
      h: base.h * 0.9,
      spread: base.spread * 1.24,
      rise: base.rise * 0.8,
      clumps: base.clumps + 2,
      lift: Math.max(0, (base.lift || 0) - 0.05),
      dist: base.dist * 1.62,
      focus: base.focus * 1.02
    };
  }
  if (take === 'low') {
    return {
      ...base,
      h: base.h * 0.55,
      spread: base.spread * 1.02,
      rise: base.rise * 0.65,
      lift: 0.02,
      focus: base.focus * 0.62,
      dist: base.dist * 1.08
    };
  }
  return base;
}

function clump(S, x, y, z, r, mat, resMul = 1) {
  S.ball([x, y, z], [r, r * 0.62, r * 0.84], mat, { res: Math.max(0.16, r * 0.28) * resMul });
}

function crown(S, x, y, z, spread, rise, mat, count, seed, alpha, resMul = 1) {
  for (let n = 0; n < count; n++) {
    const angle = hash(seed + n * 19) * Math.PI * 2;
    const reach = 0.25 + hash(seed + n * 7) * 0.75;
    const lift = (hash(seed + n * 11) - 0.35) * rise;
    const radius = spread * (0.22 + hash(seed + n * 5) * 0.16);
    const rim = 1 - reach * 0.16;
    clump(
      S,
      x + Math.cos(angle) * spread * reach,
      y + lift,
      z + Math.sin(angle) * spread * reach,
      radius,
      { r: mat.r, a: Math.min(0.9, Math.max(0.24, alpha * rim)) },
      resMul
    );
  }
}

const LOOM = {
  birch: 0.68,
  pine: 0.96,
  ash: 0.88,
  hemlock: 0.84,
  maple: 0.76,
  chestnut: 0.72,
  oak: 0.7,
  beech: 0.64,
  willow: 0.58,
  linden: 0.56,
  hornbeam: 0.5,
  cherry: 0.46,
  alder: 0.44,
  serviceberry: 0.32,
  hazel: 0.22,
  elder: 0.18
};

function trunk(S, x, y0, z, kind) {
  const height = kind.h * 0.7;
  const res = Math.max(0.16, height * 0.025);
  S.box(
    [x, y0 + height * 0.5, z],
    [kind.r, height * 0.5, kind.r * 0.82],
    kind.bark,
    { res, rd: Math.min(0.08, kind.r * 0.35) }
  );
}

export function sculptTree(S, id, x, y0, z, options = {}) {
  const base = studyOf(id, options.take);
  const front = options.front || 0;
  const armIndex = options.arm || 0;
  const seed = options.seed || 7;
  const tall = base.h > 6;
  const kind = options.vary ? {
    ...base,
    h: base.h * (tall ? 0.58 + hash(seed + 1) * 0.55 : 0.46 + hash(seed + 1) * 1.12),
    r: base.r * (0.58 + hash(seed + 6) * 0.95),
    spread: base.spread * (0.48 + hash(seed + 2) * 1.1),
    rise: base.rise * (0.55 + hash(seed + 8) * 0.9),
    clumps: Math.max(3, Math.round(base.clumps * (0.65 + hash(seed + 4) * 0.9)))
  } : { ...base };
  if (options.loom && kind.h) {
    const reach = LOOM[id] ?? 0.55;
    const aim = options.loom * reach * (0.9 + hash(seed + 3) * 0.16);
    if (aim > kind.h) {
      const scale = aim / kind.h;
      const full = { birch: 0.46, pine: 0.4, ash: 0.42, hemlock: 0.42, maple: 0.38, oak: 0.4, beech: 0.38, chestnut: 0.42, willow: 0.4, linden: 0.36, alder: 0.34 };
      kind.h = aim;
      kind.spread = Math.max(kind.spread * Math.min(1.7, Math.sqrt(scale)), aim * (full[id] ?? 0.32));
      kind.rise *= Math.min(1.35, Math.sqrt(scale));
      kind.r *= Math.min(1.2, scale ** 0.2);
    }
  }
  const stems = kind.stems || 1;
  for (let s = 0; s < stems; s++) {
    const angle = stems === 1 ? 0 : (s / stems) * Math.PI * 2;
    const reach = stems === 1 ? 0 : 0.16 + kind.r;
    trunk(S, x + Math.cos(angle) * reach, y0, z + Math.sin(angle) * reach, kind);
  }
  if (stems === 1) {
    const arm = 0.6 + hash(armIndex + 4) * 0.5;
    const yaw = hash(armIndex * 9 + 2) * Math.PI * 2;
    S.box(
      [x + Math.cos(yaw) * arm * 0.5, y0 + kind.h * 0.72, z + Math.sin(yaw) * arm * 0.5],
      [arm * 0.5, kind.r * 0.55, kind.r * 0.7],
      kind.bark,
      { res: 0.14, rd: 0.04 }
    );
  }
  const alpha = kind.leaf.a * (1 - front) + 0.32 * front;
  const spread = kind.spread * (1 - front * 0.18);
  const coarse = Boolean(options.lean);
  const resMul = coarse ? 1.35 : 1;
  const clumps = Math.max(coarse ? 5 : 3, Math.round(sceneCount(kind.clumps) * (coarse ? 0.75 : 1)));
  const crownY = y0 + kind.h * (0.7 + kind.lift * 0.15);
  clump(S, x, crownY + kind.rise * 0.12, z, spread * 0.36, { r: kind.leaf.r, a: Math.min(0.9, alpha) }, resMul);
  crown(S, x, crownY, z, spread, kind.rise, kind.leaf, clumps, seed, alpha, resMul);
  if (SCENE.fidelity > 1 && !options.lean) {
    crown(S, x, crownY, z, spread * 0.62, kind.rise * 0.7, kind.leaf, Math.max(4, Math.round(clumps * 0.65)), seed + 101, alpha * 0.85);
  }
  return { drop: y0 + kind.h * 0.72 };
}

function sculptFern(S, take) {
  const full = take === 'full';
  const fronds = sceneCount(full ? 10 : 6);
  const steps = sceneCount(full ? 6 : 4);
  for (let n = 0; n < fronds; n++) {
    const angle = (n / fronds) * Math.PI * 2 + 0.4;
    for (let s = 1; s <= steps; s++) {
      const reach = s * (full ? 0.16 : 0.13);
      S.ball(
        [Math.cos(angle) * reach, 0.06 + s * 0.035, Math.sin(angle) * reach],
        [0.07, 0.018, 0.1],
        { r: [15, 8, 7] },
        { res: 0.05 }
      );
    }
  }
}

function sculptGinger(S, take) {
  const wide = take === 'wide' ? 1.45 : 1;
  S.box([-0.16 * wide, 0.06, 0], [0.2 * wide, 0.02, 0.14 * wide], { r: [15, 11, 8] }, { res: 0.07, rd: 0.03 });
  S.box([0.14 * wide, 0.07, 0.06], [0.18 * wide, 0.02, 0.13 * wide], { r: [7, 15, 11] }, { res: 0.07, rd: 0.03 });
}

function ground(S, radius) {
  S.box([0, -0.08, 0], [radius, 0.08, radius], { r: [11, 2, 5] }, { res: 0.22, rd: 0.05 });
  S.box([0, 0.015, 0], [radius * 0.62, 0.03, radius * 0.62], { r: [4, 6, 3] }, { res: 0.14, rd: 0.03 });
}

export function treeForm(id) {
  return FORMS[id] || null;
}

export function buildSpecimen(kit, id, take = 'simple') {
  const form = studyOf(id, take);
  if (!form) throw new Error(`No specimen for ${id}`);
  const { makeBuilder, makeSculpt, KIT } = kit;
  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 15 });
  const S = dressSculpt(KIT.sculpt(makeSculpt(B)));
  ground(S, form.ground);
  if (form.crop || form.weather) {
    // Strokes, added after the bake, match the cube.
  } else if (id === 'fern') sculptFern(S, take);
  else if (id === 'ginger') sculptGinger(S, take);
  else sculptTree(S, id, 0, 0, 0, { seed: 11, arm: 2, front: 0, take });
  S.bake();
  let frame = null;
  if (id === 'leaf') frame = KIT.frameSplats(B, 24, draw => paintLeafStudy(draw, take));
  else if (id === 'snow') frame = KIT.frameSplats(B, 24, draw => paintSnowStudy(draw, take));
  else if (form.crop) {
    const ripe = take === 'young' ? 0.34 : 1;
    const look = take === 'plain' ? 'plain' : 'bed';
    frame = KIT.frameSplats(B, 24, draw => paintCrop(draw, id, 0, 0.24, 0, ripe, look));
  }
  const world = B.finish({
    cam: { target: [0, form.focus, 0], dist: form.dist, yaw: Math.PI / 4, pitch: 0.62, fov: 0.66 },
    detail: 9,
    dither: 0.45,
    radius: Math.max(4, form.focus * 2),
    look: STIPPLE
  });
  const stage = KIT.stage(world);
  if (frame) stage.add(frame);
  return {
    world,
    stage,
    cam: { target: [0, form.focus, 0], dist: form.dist, pitch: 0.62, fov: 0.66 }
  };
}

export function buildMotion(kit, id) {
  const { makeBuilder, makeSculpt, KIT } = kit;
  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 12 });
  const S = dressSculpt(KIT.sculpt(makeSculpt(B)));
  ground(S, id === 'mound' ? 0.85 : 0.55);
  S.bake();
  const frame = KIT.frameSplats(B, 48, (draw, _dt, t) => paintClip(draw, id, (t % 2.6) / 2.6));
  const focus = id === 'mound' ? 0.38 : 0.55;
  const dist = id === 'mound' ? 5.2 : 4.1;
  const world = B.finish({
    cam: { target: [0, focus, 0], dist, yaw: Math.PI / 4, pitch: 0.7, fov: 0.7 },
    detail: 9,
    dither: 0.45,
    radius: 3,
    look: STIPPLE
  });
  const stage = KIT.stage(world);
  stage.add(frame);
  return {
    world,
    stage,
    cam: { target: [0, focus, 0], dist, pitch: 0.7, fov: 0.7 }
  };
}
