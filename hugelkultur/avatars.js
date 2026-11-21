import { cellCenter, walkHeight, cellAt, PALETTE, STIPPLE } from './world.js?v=square24';

// One druid, seven bodies. A body is fat gaussian puffs, plus a few loose kernels that never quite join.

const CREAM = { r: [6, 0, 4] };
const WARM = { r: [4, 6, 0] };
const SHADE = { r: [4, 3, 6] };
const INK = { r: [1] };
const HEART = { r: [14, 13, 4] };
const WATER = { r: [12, 6, 0] };
const DEEP = { r: [1, 12, 6] };
const FOAM = { r: [0, 6, 12] };
const BARK = { r: [11, 5, 1] };
const BARK2 = { r: [5, 11, 1] };
const LEAF = { r: [15, 7, 8] };
const LEAF2 = { r: [9, 8, 15] };
const CAP = { r: [6, 4, 0] };
const GILL = { r: [11, 5, 4] };
const SPOT = { r: [14, 10, 13] };
const MOSS = { r: [7, 15, 8] };
const LUSH = { r: [8, 9, 7] };
const DAMP = { r: [15, 7, 1] };
const FLAME = { r: [14, 10, 13] };
const CORE = { r: [6, 14, 10] };
const CHAR = { r: [5, 11, 10] };
const SNOW = { r: [0, 6, 4] };
const COLD = { r: [12, 6, 0] };

const PACE = { walk: 2.15, run: 3.5, jump: 5.5 };
const HE = { sub: 'he', obj: 'him', pos: 'his' };
const SHE = { sub: 'she', obj: 'her', pos: 'her' };
const IT = { sub: 'it', obj: 'it', pos: 'its' };

function field(sim) {
  if (!sim?.cells) return { height() { return 0; }, water() { return -99; } };
  return {
    height(x, z) {
      return walkHeight(cellAt(sim.cells, x, z));
    },
    water(x, z) {
      const hit = sim.snapshot?.sample?.(x, z);
      return hit && hit.depth > 0.02 ? hit.level : -99;
    }
  };
}

function stand(sim) {
  return sim?.cells ? cellCenter(8, 9).x : 0;
}

function puff(S, T, bone, c, r, mat, density = 1) {
  const rad = Array.isArray(r) ? r : [r, r * 0.78, r * 0.88];
  const span = Math.max(rad[0], rad[1], rad[2]);
  S.ball(c, rad, mat, Object.assign(T(bone), { res: Math.max(0.055, (span * 1.08) / density) }));
}

function kernel(S, T, bone, c, r, mat) {
  S.ball(c, [r, r * 0.7, r * 0.86], mat, Object.assign(T(bone), { res: Math.max(0.05, r * 2.35) }));
}

function eyes(S, T, y, z, gap, r = 0.032) {
  S.ball([gap, y, z], r, INK, Object.assign(T.eye('head'), { res: r * 1.35 }));
  S.ball([-gap, y, z], r, INK, Object.assign(T.eye('head'), { res: r * 1.35 }));
}

function heart(S, T, c) {
  kernel(S, T, 'chest', c, 0.045, HEART);
}

function cloudSpec(sim) {
  return {
    height: 1.22,
    res: 0.12,
    x0: stand(sim),
    gait: 'float',
    speed: PACE,
    dust: 6,
    fx: 0,
    anim: { breath: 0.055, bf: 1.45, sway: 0.16, sf: 0.75, wob: 0.1 },
    pts: {
      hip: [0, 0.4, 0],
      chest: [0, 0.62, 0],
      hem: [0, 0.24, 0],
      neck: [0, 0.84, 0],
      sock: [0.05, 0.2, 0.08],
      ank: [0.05, 0.04, 0.1]
    },
    legs: { mat: [6, 0, 4], r0: 0.05, r1: 0.036, foot: [0.09, 0.04, 0.08], footMat: [4, 6, 0] },
    tails: [
      { at: [-0.06, 1.02, -0.08], dir: [-0.25, -0.35, -1], seg: 0.12, n: 3, r0: 0.055, r1: 0.02, mat: [6, 0, 4], bone: 'head', g: 1.4 },
      { at: [0.1, 0.96, -0.06], dir: [0.4, -0.15, -1], seg: 0.11, n: 3, r0: 0.045, r1: 0.016, mat: [4, 6, 0], bone: 'head', g: 1.1 }
    ],
    sculpt(S, T) {
      puff(S, T, 'head', [0, 1.08, 0.02], [0.2, 0.15, 0.17], CREAM, 0.82);
      puff(S, T, 'head', [-0.18, 1.0, 0.0], [0.13, 0.11, 0.12], WARM, 0.75);
      puff(S, T, 'head', [0.18, 1.02, -0.04], [0.12, 0.1, 0.11], CREAM, 0.75);
      puff(S, T, 'head', [0.02, 1.28, -0.02], [0.12, 0.09, 0.1], WARM, 0.72);
      puff(S, T, 'head', [0.04, 0.96, 0.1], [0.09, 0.07, 0.08], SHADE, 0.75);
      puff(S, T, 'chest', [0, 0.66, 0.01], [0.16, 0.12, 0.13], CREAM, 0.85);
      puff(S, T, 'chest', [-0.16, 0.74, -0.02], [0.09, 0.07, 0.08], WARM, 0.72);
      puff(S, T, 'chest', [0.17, 0.64, 0.0], [0.08, 0.07, 0.08], CREAM, 0.72);
      puff(S, T, 'root', [0, 0.44, 0], [0.13, 0.09, 0.11], SHADE, 0.8);
      puff(S, T, 'hem', [0, 0.28, 0.02], [0.11, 0.045, 0.09], CREAM, 0.75);
      kernel(S, T, 'head', [0.32, 1.2, 0.06], 0.075, WARM);
      kernel(S, T, 'head', [-0.3, 1.14, -0.02], 0.065, CREAM);
      kernel(S, T, 'head', [0.02, 1.44, 0.04], 0.055, { r: [0, 6] });
      kernel(S, T, 'head', [-0.1, 1.36, 0.1], 0.045, CREAM);
      kernel(S, T, 'chest', [0.26, 0.78, 0.04], 0.05, WARM);
      kernel(S, T, 'chest', [-0.24, 0.56, 0.02], 0.048, SHADE);
      heart(S, T, [0, 0.68, 0.08]);
      eyes(S, T, 1.02, 0.2, 0.055, 0.03);
    },
    world: field(sim)
  };
}

function waterSpec(sim) {
  return {
    height: 1.18,
    res: 0.1,
    x0: stand(sim),
    gait: 'float',
    speed: PACE,
    dust: 12,
    fx: 6,
    anim: { breath: 0.02, sway: 0.2, sf: 1.15, nod: 0.06, nf: 1.3 },
    pts: {
      hip: [0, 0.42, 0],
      chest: [0, 0.68, 0],
      hem: [0, 0.22, 0],
      neck: [0, 0.9, 0],
      sock: [0.045, 0.22, 0.05],
      ank: [0.04, 0.04, 0.06]
    },
    legs: { mat: [1, 12], r0: 0.028, r1: 0.018, foot: [0.045, 0.02, 0.07], footMat: [12, 6, 0] },
    tails: [
      { at: [0.0, 1.02, -0.08], dir: [0.05, -1, -0.35], seg: 0.15, n: 6, r0: 0.04, r1: 0.01, mat: [1, 12, 6], bone: 'head', g: 9 },
      { at: [-0.12, 0.96, -0.02], dir: [-0.7, -0.75, 0.1], seg: 0.14, n: 5, r0: 0.032, r1: 0.008, mat: [12, 6, 0], bone: 'head', g: 8 },
      { at: [0.13, 0.94, 0.0], dir: [0.72, -0.7, 0.2], seg: 0.13, n: 5, r0: 0.03, r1: 0.008, mat: [0, 12, 6], bone: 'head', g: 7 }
    ],
    sculpt(S, T) {
      puff(S, T, 'head', [0, 1.02, 0.04], [0.11, 0.13, 0.1], DEEP, 1.05);
      puff(S, T, 'chest', [0, 0.74, 0.02], [0.1, 0.12, 0.09], WATER, 1);
      puff(S, T, 'root', [0, 0.5, 0], [0.09, 0.11, 0.08], DEEP, 1);
      puff(S, T, 'hem', [0, 0.28, 0.02], [0.13, 0.05, 0.1], FOAM, 1);
      kernel(S, T, 'head', [-0.12, 1.12, 0.02], 0.04, FOAM);
      kernel(S, T, 'chest', [0.12, 0.66, 0.06], 0.038, WATER);
      kernel(S, T, 'chest', [-0.1, 0.58, 0.04], 0.032, DEEP);
      kernel(S, T, 'hem', [0.12, 0.22, 0.04], 0.03, FOAM);
      kernel(S, T, 'root', [-0.14, 0.4, 0.06], 0.028, WATER);
      heart(S, T, [0, 0.74, 0.06]);
      eyes(S, T, 1.0, 0.15, 0.042, 0.026);
    },
    world: field(sim)
  };
}

function treeSpec(sim) {
  return {
    height: 1.4,
    res: 0.11,
    x0: stand(sim),
    gait: 'walk',
    speed: PACE,
    dust: 15,
    fx: 9,
    anim: { breath: 0.012, sway: 0.07, sf: 0.4, rock: 0.04, bounce: 0.5 },
    pts: {
      hip: [0, 0.42, 0],
      chest: [0, 0.7, 0],
      hem: [0, 0.24, 0],
      neck: [0, 0.92, 0],
      sock: [0.06, 0.22, 0.07],
      ank: [0.06, 0.04, 0.08]
    },
    legs: { mat: [11, 5, 1], r0: 0.055, r1: 0.04, foot: [0.08, 0.04, 0.1], footMat: [5, 11, 1] },
    sculpt(S, T) {
      puff(S, T, 'root', [0, 0.42, 0], [0.07, 0.22, 0.06], BARK, 1.5);
      puff(S, T, 'chest', [0, 0.7, 0.01], [0.06, 0.16, 0.055], BARK2, 1.45);
      puff(S, T, 'chest', [0.16, 0.78, 0.0], [0.12, 0.028, 0.035], BARK, 1.2);
      puff(S, T, 'head', [0, 0.92, 0.06], [0.08, 0.07, 0.07], BARK, 1.25);
      puff(S, T, 'head', [0, 1.22, -0.02], [0.2, 0.14, 0.18], LEAF, 1.05);
      puff(S, T, 'head', [-0.24, 1.12, 0.0], [0.14, 0.1, 0.12], LEAF2, 0.95);
      puff(S, T, 'head', [0.24, 1.14, -0.04], [0.13, 0.1, 0.12], LEAF, 0.95);
      puff(S, T, 'head', [0.02, 1.38, -0.06], [0.12, 0.08, 0.1], { r: [9, 8, 7] }, 0.9);
      puff(S, T, 'chest', [-0.14, 0.98, -0.08], [0.11, 0.08, 0.1], LEAF2, 0.9);
      kernel(S, T, 'head', [0.3, 1.28, 0.02], 0.055, LEAF);
      kernel(S, T, 'head', [-0.28, 1.26, -0.02], 0.05, LEAF2);
      kernel(S, T, 'head', [0.0, 1.48, 0.0], 0.045, LEAF);
      heart(S, T, [0, 0.72, 0.06]);
      eyes(S, T, 0.92, 0.14, 0.035, 0.022);
    },
    world: field(sim)
  };
}

function mushroomSpec(sim) {
  return {
    height: 1.08,
    res: 0.1,
    x0: stand(sim),
    gait: 'hop',
    speed: PACE,
    dust: 4,
    fx: 14,
    anim: { breath: 0.025, wob: 0.05, bounce: 0.15 },
    pts: {
      hip: [0, 0.36, 0],
      chest: [0, 0.58, 0],
      hem: [0, 0.2, 0],
      neck: [0, 0.78, 0],
      sock: [0.05, 0.18, 0.05],
      ank: [0.05, 0.04, 0.06]
    },
    legs: { mat: [6, 4], r0: 0.04, r1: 0.03, foot: [0.06, 0.028, 0.08], footMat: [4, 6, 3] },
    sculpt(S, T) {
      puff(S, T, 'root', [0, 0.42, 0], [0.1, 0.2, 0.08], CAP, 1.35);
      puff(S, T, 'chest', [0, 0.64, 0.01], [0.08, 0.14, 0.07], { r: [4, 6, 3] }, 1.3);
      puff(S, T, 'head', [0, 1.02, 0], [0.36, 0.11, 0.32], CAP, 1.7);
      puff(S, T, 'head', [0, 0.92, 0.02], [0.28, 0.045, 0.24], GILL, 1.5);
      kernel(S, T, 'head', [0.1, 1.12, 0.08], 0.07, { r: [11, 1] });
      kernel(S, T, 'head', [-0.12, 1.1, 0.02], 0.06, { r: [5, 11] });
      kernel(S, T, 'head', [0.02, 1.14, -0.08], 0.05, SPOT);
      kernel(S, T, 'head', [0.18, 1.06, -0.04], 0.045, { r: [11, 1] });
      kernel(S, T, 'head', [-0.2, 0.92, 0.08], 0.028, GILL);
      kernel(S, T, 'head', [0.16, 0.9, 0.1], 0.026, GILL);
      heart(S, T, [0, 0.64, 0.06]);
      eyes(S, T, 0.82, 0.18, 0.045, 0.024);
    },
    world: field(sim)
  };
}

function mossSpec(sim) {
  return {
    height: 0.78,
    res: 0.1,
    x0: stand(sim),
    gait: 'walk',
    speed: { walk: 1.65, run: 2.55, jump: 4.2 },
    dust: 7,
    fx: 8,
    anim: { breath: 0.035, waddle: 0.4, bounce: 0.9, rock: 0.06, sf: 1.2 },
    pts: {
      hip: [0, 0.28, 0],
      chest: [0, 0.4, 0],
      hem: [0, 0.16, 0],
      neck: [0, 0.48, 0],
      sock: [0.1, 0.16, 0.06],
      ank: [0.11, 0.04, 0.08]
    },
    legs: { mat: [7, 15, 8], r0: 0.06, r1: 0.045, foot: [0.1, 0.04, 0.09], footMat: [15, 7, 8] },
    sculpt(S, T) {
      puff(S, T, 'root', [0, 0.3, 0], [0.32, 0.16, 0.24], MOSS, 1.35);
      puff(S, T, 'chest', [-0.12, 0.38, 0.02], [0.16, 0.1, 0.14], LUSH, 1.2);
      puff(S, T, 'chest', [0.14, 0.34, -0.02], [0.14, 0.09, 0.12], DAMP, 1.15);
      puff(S, T, 'head', [0, 0.46, 0.04], [0.14, 0.1, 0.12], LUSH, 1.2);
      puff(S, T, 'hem', [0, 0.18, 0.04], [0.22, 0.06, 0.16], MOSS, 1.2);
      kernel(S, T, 'head', [-0.1, 0.62, 0.0], 0.055, LUSH);
      kernel(S, T, 'head', [0.12, 0.58, 0.02], 0.05, { r: [9, 8, 15] });
      kernel(S, T, 'head', [0.0, 0.7, -0.02], 0.04, DAMP);
      kernel(S, T, 'chest', [0.24, 0.4, 0.06], 0.04, MOSS);
      kernel(S, T, 'root', [-0.26, 0.34, 0.04], 0.042, LUSH);
      kernel(S, T, 'head', [0.06, 0.66, 0.06], 0.028, { r: [10, 5, 11] });
      heart(S, T, [0, 0.34, 0.1]);
      eyes(S, T, 0.4, 0.24, 0.06, 0.034);
    },
    world: field(sim)
  };
}

function fireSpec(sim) {
  return {
    height: 1.28,
    res: 0.1,
    x0: stand(sim),
    gait: 'float',
    speed: PACE,
    dust: 14,
    fx: 10,
    anim: { breath: 0.06, bf: 3.2, sway: 0.14, sf: 1.8, wob: 0.12 },
    pts: {
      hip: [0, 0.4, 0],
      chest: [0, 0.66, 0],
      hem: [0, 0.2, 0],
      neck: [0, 0.9, 0],
      sock: [0.045, 0.18, 0.05],
      ank: [0.04, 0.04, 0.06]
    },
    legs: { mat: [5, 11, 10], r0: 0.03, r1: 0.02, foot: [0.05, 0.02, 0.07], footMat: [10, 14, 5] },
    tails: [
      { at: [0, 1.08, -0.02], dir: [0.08, 1, -0.2], seg: 0.12, n: 5, r0: 0.045, r1: 0.012, mat: [14, 10, 5], bone: 'head', g: -12 },
      { at: [-0.1, 0.92, 0], dir: [-0.4, 0.95, 0.05], seg: 0.11, n: 4, r0: 0.036, r1: 0.01, mat: [10, 14, 13], bone: 'head', g: -9 },
      { at: [0.12, 0.88, 0.02], dir: [0.45, 0.9, 0.1], seg: 0.1, n: 4, r0: 0.032, r1: 0.01, mat: [6, 14, 10], bone: 'chest', g: -8 }
    ],
    sculpt(S, T, U) {
      puff(S, T, 'hem', [0, 0.26, 0.02], [0.14, 0.05, 0.11], CHAR, 1.05);
      puff(S, T, 'root', [0, 0.46, 0], [0.1, 0.12, 0.08], { r: [10, 5, 14] }, 1.05);
      puff(S, T, 'chest', [0, 0.7, 0.02], [0.12, 0.14, 0.1], FLAME, 1);
      puff(S, T, 'head', [0, 1.02, 0.04], [0.11, 0.14, 0.1], CORE, 1);
      puff(S, T, 'head', [0, 1.22, 0], [0.07, 0.1, 0.06], { r: [6, 14, 0] }, 0.9);
      kernel(S, T, 'head', [-0.1, 1.16, 0.02], 0.04, FLAME);
      kernel(S, T, 'head', [0.1, 1.18, -0.02], 0.038, CORE);
      kernel(S, T, 'head', [0.02, 1.38, 0.02], 0.035, U.em(14));
      kernel(S, T, 'chest', [-0.14, 0.78, 0.04], 0.032, U.em(10));
      kernel(S, T, 'chest', [0.14, 0.64, 0.05], 0.03, FLAME);
      heart(S, T, [0, 0.72, 0.08]);
      eyes(S, T, 1.0, 0.15, 0.04, 0.024);
    },
    world: field(sim)
  };
}

function snowSpec(sim) {
  return {
    height: 1.12,
    res: 0.1,
    x0: stand(sim),
    gait: 'walk',
    speed: { walk: 1.45, run: 2.2, jump: 3.4 },
    dust: 6,
    fx: 0,
    anim: { breath: 0.018, nod: 0.1, nf: 0.7, sway: 0.04, sf: 0.45, bounce: 0.3 },
    pts: {
      hip: [0, 0.38, 0],
      chest: [0, 0.58, 0.02],
      hem: [0, 0.2, 0],
      neck: [0, 0.76, 0.06],
      sock: [0.06, 0.2, 0.05],
      ank: [0.07, 0.04, 0.07],
      sho: [0.18, 0.62, 0.02],
      hand: [0.22, 0.22, 0.1]
    },
    legs: { mat: [6, 4, 0], r0: 0.05, r1: 0.04, foot: [0.08, 0.035, 0.1], footMat: [0, 6, 12] },
    tails: [
      { at: [-0.14, 0.7, 0], dir: [-0.15, -1, 0.15], seg: 0.1, n: 3, r0: 0.028, r1: 0.01, mat: [0, 6], bone: 'chest', g: 6 },
      { at: [0.06, 0.9, -0.02], dir: [0.1, -1, -0.25], seg: 0.09, n: 3, r0: 0.024, r1: 0.01, mat: [6, 0, 12], bone: 'head', g: 5 }
    ],
    sculpt(S, T) {
      puff(S, T, 'root', [0, 0.4, 0.02], [0.14, 0.12, 0.11], SNOW, 1.15);
      puff(S, T, 'chest', [0, 0.6, 0.04], [0.18, 0.12, 0.13], COLD, 1.15);
      puff(S, T, 'chest', [-0.16, 0.66, 0.02], [0.08, 0.06, 0.07], SNOW, 0.9);
      puff(S, T, 'head', [0, 0.9, 0.08], [0.12, 0.1, 0.11], SNOW, 1.1);
      puff(S, T, 'head', [0, 1.02, 0.04], [0.1, 0.06, 0.09], { r: [6, 0, 12] }, 1);
      puff(S, T, 'head', [0, 0.8, 0.14], [0.09, 0.07, 0.05], SNOW, 0.95);
      kernel(S, T, 'head', [-0.06, 0.74, 0.16], 0.035, COLD);
      kernel(S, T, 'head', [0.05, 0.7, 0.15], 0.03, SNOW);
      kernel(S, T, 'head', [0, 0.66, 0.14], 0.028, { r: [0, 6] });
      puff(S, T, 'arm', [0.2, 0.48, 0.06], [0.035, 0.08, 0.035], { r: [6, 4, 11] }, 1.2);
      puff(S, T, 'arm', [0.22, 0.3, 0.1], [0.03, 0.08, 0.03], { r: [4, 6, 0] }, 1.2);
      kernel(S, T, 'item', [0.22, 0.16, 0.12], 0.04, SNOW);
      kernel(S, T, 'head', [-0.14, 0.98, 0], 0.04, SNOW);
      kernel(S, T, 'chest', [0.16, 0.78, -0.02], 0.035, COLD);
      heart(S, T, [0, 0.6, 0.1]);
      eyes(S, T, 0.9, 0.18, 0.04, 0.022);
    },
    world: field(sim)
  };
}

export const SPIRITS = [
  {
    id: 'cloud',
    name: 'Cloud boy',
    group: 'Cloud',
    swatch: '#f7efe2',
    note: 'Weather, gathered into a boy. The loose puffs are still him.',
    voice: HE,
    focus: 0.78,
    dist: 3.5,
    spec: cloudSpec
  },
  {
    id: 'water',
    name: 'Water girl',
    group: 'Water',
    swatch: '#7ec8c2',
    note: 'A braid of water with somewhere to be.',
    voice: SHE,
    focus: 0.68,
    dist: 3.4,
    spec: waterSpec
  },
  {
    id: 'tree',
    name: 'Tree guy',
    group: 'Wood',
    swatch: '#1c6b40',
    note: 'Bark for a body. The crown is his hair.',
    voice: HE,
    focus: 0.86,
    dist: 3.8,
    spec: treeSpec
  },
  {
    id: 'mushroom',
    name: 'Mushroom gal',
    group: 'Cap',
    swatch: '#f3d7a6',
    note: 'A cap, a stem, and a hop.',
    voice: SHE,
    focus: 0.66,
    dist: 3.3,
    spec: mushroomSpec
  },
  {
    id: 'moss',
    name: 'Moss it',
    group: 'Moss',
    swatch: '#2f8f55',
    note: 'Low and damp. It does not hurry.',
    voice: IT,
    focus: 0.38,
    dist: 2.8,
    spec: mossSpec
  },
  {
    id: 'fire',
    name: 'Fire lesbian',
    group: 'Fire',
    swatch: '#d97736',
    note: 'She goes up. The dark part is what already burned.',
    voice: SHE,
    focus: 0.78,
    dist: 3.6,
    spec: fireSpec
  },
  {
    id: 'snow',
    name: 'Snow old gay guy',
    group: 'Snow',
    swatch: '#f0eee9',
    note: 'An old man. The snow keeps leaving him.',
    voice: HE,
    focus: 0.62,
    dist: 3.4,
    spec: snowSpec
  }
];

export function spiritById(id) {
  return SPIRITS.find(item => item.id === id) || SPIRITS[0];
}

function ground(S, radius) {
  S.box([0, -0.08, 0], [radius, 0.08, radius], { r: [11, 2, 5] }, { res: 0.2, rd: 0.04 });
  S.box([0, 0.012, 0], [radius * 0.55, 0.025, radius * 0.55], { r: [4, 6, 3] }, { res: 0.12, rd: 0.02 });
}

export function buildSpirit(kit, id) {
  const form = spiritById(id);
  const { makeBuilder, makeSculpt, KIT } = kit;
  const B = makeBuilder(11, PALETTE, { initialCapacity: 1 << 14 });
  const S = KIT.sculpt(makeSculpt(B));
  ground(S, 1.2);
  S.bake();
  const character = KIT.character(B, form.spec({ cells: null }), 0);
  const world = B.finish({
    cam: { target: [0, form.focus, 0], dist: form.dist, yaw: Math.PI / 4, pitch: 0.58, fov: 0.72 },
    detail: 9,
    dither: 0.45,
    radius: 4,
    look: STIPPLE
  });
  const at = world.count - character.total;
  character.bind(world, at);
  character.st.born = 2;
  character.update(1 / 60, { move: 0, mz: 0 }, 0);
  return {
    world,
    stage: KIT.stage(world),
    character,
    cam: { target: [0, form.focus, 0], dist: form.dist, pitch: 0.58, fov: 0.72 }
  };
}
