import { PALETTE, STIPPLE, hash } from './world.js';
import { paintClip } from './motions.js';
import { paintCrop } from './gardens.js';

const OAK_BARK = { r: [11, 5, 1] };
const MAPLE_BARK = { r: [5, 11, 10] };
const BIRCH_BARK = { r: [6, 4, 1] };
const OAK_LEAF = { r: [15, 7, 8], a: 0.74 };
const MAPLE_LEAF = { r: [9, 8, 13], a: 0.46 };
const BIRCH_LEAF = { r: [9, 6, 8], a: 0.28 };

// One canonical form per species. The grove and the library both sculpt from this.
const FORMS = {
  oak: { h: 3.4, r: 0.28, bark: OAK_BARK, leaf: OAK_LEAF, spread: 2.6, rise: 1.5, clumps: 8, lift: 0.2, focus: 2.2, dist: 15, ground: 1.8 },
  maple: { h: 5.4, r: 0.16, bark: MAPLE_BARK, leaf: MAPLE_LEAF, spread: 2.1, rise: 2.2, clumps: 7, lift: 0.45, focus: 3.4, dist: 18, ground: 1.6 },
  birch: { h: 8.6, r: 0.08, bark: BIRCH_BARK, leaf: BIRCH_LEAF, spread: 1.15, rise: 2.4, clumps: 5, lift: 0.7, focus: 4.6, dist: 22, ground: 1.2 },
  beech: { h: 4.2, r: 0.22, bark: { r: [6, 4, 1] }, leaf: { r: [15, 7, 8], a: 0.82 }, spread: 2.2, rise: 1.1, clumps: 9, lift: 0.15, focus: 2.6, dist: 16, ground: 1.6 },
  ash: { h: 6.2, r: 0.14, bark: { r: [5, 11, 1] }, leaf: { r: [9, 8, 7], a: 0.38 }, spread: 1.7, rise: 2.6, clumps: 6, lift: 0.55, focus: 3.8, dist: 19, ground: 1.4 },
  linden: { h: 3.8, r: 0.2, bark: { r: [11, 5, 2] }, leaf: { r: [9, 8, 13], a: 0.7 }, spread: 2.4, rise: 1.2, clumps: 8, lift: 0.1, focus: 2.4, dist: 16, ground: 1.7 },
  hornbeam: { h: 3.2, r: 0.18, bark: { r: [1, 5, 11] }, leaf: { r: [15, 8, 7], a: 0.78 }, spread: 1.5, rise: 0.8, clumps: 7, lift: 0.05, focus: 2, dist: 13, ground: 1.3 },
  alder: { h: 3.6, r: 0.1, bark: { r: [11, 1, 5] }, leaf: { r: [8, 7, 15], a: 0.55 }, spread: 1.4, rise: 1.4, clumps: 6, lift: 0.3, stems: 3, focus: 2.2, dist: 14, ground: 1.3 },
  willow: { h: 4.4, r: 0.16, bark: { r: [5, 11, 2] }, leaf: { r: [9, 8, 6], a: 0.42 }, spread: 2.3, rise: -1.35, clumps: 8, lift: 0.1, focus: 2.4, dist: 16, ground: 1.7 },
  pine: { h: 6.8, r: 0.12, bark: { r: [11, 5, 1] }, leaf: { r: [15, 7, 1], a: 0.86 }, spread: 1.35, rise: 2.8, clumps: 7, lift: 0.2, focus: 3.8, dist: 18, ground: 1.3 },
  hemlock: { h: 5.8, r: 0.1, bark: { r: [1, 11, 5] }, leaf: { r: [15, 7, 8], a: 0.32 }, spread: 1.7, rise: 1.8, clumps: 9, lift: 0.35, focus: 3.4, dist: 18, ground: 1.4 },
  cherry: { h: 3.6, r: 0.14, bark: { r: [1, 11, 5] }, leaf: { r: [6, 14, 9], a: 0.58 }, spread: 1.8, rise: 1.3, clumps: 7, lift: 0.25, focus: 2.2, dist: 14, ground: 1.4 },
  chestnut: { h: 4.6, r: 0.26, bark: { r: [11, 5, 2] }, leaf: { r: [8, 9, 15], a: 0.7 }, spread: 3, rise: 1.4, clumps: 9, lift: 0.15, focus: 2.8, dist: 18, ground: 2 },
  serviceberry: { h: 2.4, r: 0.08, bark: { r: [5, 11, 6] }, leaf: { r: [6, 14, 4], a: 0.5 }, spread: 1.1, rise: 0.9, clumps: 5, lift: 0.2, focus: 1.5, dist: 11, ground: 1.1 },
  hazel: { h: 1.7, r: 0.05, bark: { r: [11, 5, 10] }, leaf: { r: [9, 8, 7], a: 0.62 }, spread: 0.9, rise: 0.6, clumps: 6, lift: 0.1, stems: 5, focus: 1.1, dist: 8, ground: 1.1 },
  elder: { h: 1.5, r: 0.035, bark: { r: [6, 4, 11] }, leaf: { r: [6, 14, 4], a: 0.55 }, spread: 0.7, rise: 0.35, clumps: 4, lift: 0.05, stems: 6, focus: 1, dist: 7.5, ground: 1 },
  fern: { focus: 0.7, dist: 6.5, ground: 0.9 },
  ginger: { focus: 0.4, dist: 5.2, ground: 0.8 },
  carrot: { crop: true, focus: 0.45, dist: 5.4, ground: 0.7 },
  turnip: { crop: true, focus: 0.4, dist: 5.4, ground: 0.7 },
  mushroom: { crop: true, focus: 0.4, dist: 5.2, ground: 0.7 }
};

function clump(S, x, y, z, r, mat) {
  S.ball([x, y, z], [r, r * 0.62, r * 0.84], mat, { res: Math.max(0.14, r * 0.2) });
}

function crown(S, x, y, z, spread, rise, mat, count, seed, alpha) {
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
      { r: mat.r, a: Math.min(0.9, Math.max(0.24, alpha * rim)) }
    );
  }
}

function trunk(S, x, y0, z, kind) {
  S.box([x, y0 + kind.h * 0.5, z], [kind.r, kind.h * 0.5, kind.r * 0.82], kind.bark, { res: 0.16, rd: kind.r * 0.35 });
}

export function sculptTree(S, id, x, y0, z, options = {}) {
  const kind = FORMS[id];
  const front = options.front || 0;
  const armIndex = options.arm || 0;
  const seed = options.seed || 7;
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
  crown(S, x, y0 + kind.h * (0.72 + kind.lift * 0.2), z, spread, kind.rise, kind.leaf, kind.clumps, seed, alpha);
  return { drop: y0 + kind.h * 0.72 };
}

function sculptFern(S) {
  for (let n = 0; n < 6; n++) {
    const angle = (n / 6) * Math.PI * 2 + 0.4;
    for (let s = 1; s <= 4; s++) {
      const reach = s * 0.13;
      S.ball(
        [Math.cos(angle) * reach, 0.06 + s * 0.035, Math.sin(angle) * reach],
        [0.07, 0.018, 0.1],
        { r: [15, 8, 7] },
        { res: 0.05 }
      );
    }
  }
}

function sculptGinger(S) {
  S.box([-0.16, 0.06, 0], [0.2, 0.02, 0.14], { r: [15, 11, 8] }, { res: 0.07, rd: 0.03 });
  S.box([0.14, 0.07, 0.06], [0.18, 0.02, 0.13], { r: [7, 15, 11] }, { res: 0.07, rd: 0.03 });
}

function ground(S, radius) {
  S.box([0, -0.08, 0], [radius, 0.08, radius], { r: [11, 2, 5] }, { res: 0.22, rd: 0.05 });
  S.box([0, 0.015, 0], [radius * 0.62, 0.03, radius * 0.62], { r: [4, 6, 3] }, { res: 0.14, rd: 0.03 });
}

export function buildSpecimen(kit, id) {
  const form = FORMS[id];
  if (!form) throw new Error(`No specimen for ${id}`);
  const { makeBuilder, makeSculpt, KIT } = kit;
  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 15 });
  const S = KIT.sculpt(makeSculpt(B));
  ground(S, form.ground);
  if (form.crop) {
    // The ripe plant is drawn with the same strokes as the garden beds.
  } else if (id === 'fern') sculptFern(S);
  else if (id === 'ginger') sculptGinger(S);
  else sculptTree(S, id, 0, 0, 0, { seed: 11, arm: 2, front: 0 });
  S.bake();
  let frame = null;
  if (form.crop) frame = KIT.frameSplats(B, 24, draw => paintCrop(draw, id, 0, 0.24, 0, 1));
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
  const S = KIT.sculpt(makeSculpt(B));
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
