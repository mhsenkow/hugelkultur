import { paintCrop } from './gardens.js?v=fifty';

// The motions the library keeps, and the game plays.
export const MOTIONS = [
  { id: 'pick', name: 'Pick up', group: 'motion', swatch: '#f7efe2', note: 'A ripe turnip lifts into the hands.' },
  { id: 'carry', name: 'Carry', group: 'motion', swatch: '#e6bc82', note: 'Held. Nothing is eaten yet.' },
  { id: 'eat', name: 'Eat', group: 'motion', swatch: '#d97736', note: 'Space. A bite, and the step quickens.' },
  { id: 'mound', name: 'Mound', group: 'motion', swatch: '#5a3e2e', note: 'A stack sinks. Weather keeps adding to it.' }
];

const LEAF = { width: 0.05, color: 8, density: 2.2, emissive: false, depth: true };
const ROOT = { width: 0.06, color: 10, density: 2.3, emissive: false, depth: true };
const SOIL = { width: 0.16, color: 11, density: 2.5, emissive: false, depth: true };
const STICK = { width: 0.05, color: 10, density: 2.2, emissive: false, depth: true };
const SNOW = { width: 0.06, color: 6, density: 2.2, emissive: false, depth: true };

export function updateMotions(sim, dt) {
  for (const motion of sim.motions) motion.t += dt;
  sim.motions = sim.motions.filter(motion => motion.t < motion.dur);
}

const RIPPLE = { width: 0.022, color: 12, density: 1.2, emissive: false, depth: true };
const DUST = { width: 0.05, color: 11, density: 1.6, emissive: false, depth: true };
const BIRD = { width: 0.028, color: 1, density: 1.4, emissive: false, depth: true };
const DREAM = { width: 0.03, color: 6, density: 0.9, emissive: true, depth: true };
const SEASON_INK = { SPR: 8, SUM: 13, AUT: 10, WIN: 6 };
const WAKE_INK = { cloud: 6, water: 12, tree: 5, mushroom: 10, moss: 7, fire: 14, snow: 6 };

export function drawMotions(draw, sim) {
  let carrying = Boolean(sim.held);
  for (const motion of sim.motions) {
    if (motion.t < 0) continue;
    if (motion.kind === 'pick' || motion.kind === 'eat') carrying = false;
    if (motion.kind === 'pick') drawPick(draw, sim, motion);
    else if (motion.kind === 'eat') drawEat(draw, sim, motion);
    else if (motion.kind === 'ripple') drawRipple(draw, motion);
    else if (motion.kind === 'puff') drawPuff(draw, motion);
    else if (motion.kind === 'slide') drawSlide(draw, motion);
    else if (motion.kind === 'dust') drawDust(draw, motion);
    else if (motion.kind === 'bird') drawBird(draw, motion);
    else if (motion.kind === 'dream') drawDream(draw, motion);
    else if (motion.kind === 'wake') drawWake(draw, motion);
    else if (motion.kind === 'dig') drawDig(draw, motion);
  }
  if (carrying) drawHeld(draw, sim, 1);
}

function hand(sim) {
  const st = sim.character.st;
  return [st.x + Math.cos(st.face) * 0.18, st.y + 0.96, st.z + Math.sin(st.face) * 0.18];
}

function drawPick(draw, sim, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const ease = k * k * (3 - 2 * k);
  const [hx, hy, hz] = hand(sim);
  const x = motion.x + (hx - motion.x) * ease;
  const y = motion.y + (hy - motion.y) * ease;
  const z = motion.z + (hz - motion.z) * ease;
  paintCrop(draw, motion.crop, x, y, z, 1);
}

function drawEat(draw, sim, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const [x, y, z] = hand(sim);
  paintCrop(draw, motion.crop, x, y + 0.08, z, Math.max(0.15, 1 - k));
  if (k > 0.35) {
    paintCrop(draw, motion.crop, x + 0.06, y + 0.02 - k * 0.08, z + 0.04, 0.28);
  }
}

function drawHeld(draw, sim, scale) {
  if (scale < 0.05) return;
  const [x, y, z] = hand(sim);
  const bob = Math.sin(sim.time * 6) * 0.02;
  paintCrop(draw, sim.held, x, y + bob, z, scale);
}

function drawRipple(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  for (const ring of [0.18, 0.34]) {
    const r = ring * (0.4 + k * 1.4);
    const fade = Math.max(0, 1 - k);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = ((i + 1) / 8) * Math.PI * 2;
      draw.streak(
        [motion.x + Math.cos(a0) * r, motion.y, motion.z + Math.sin(a0) * r],
        [motion.x + Math.cos(a1) * r, motion.y, motion.z + Math.sin(a1) * r],
        { ...RIPPLE, width: 0.018 * fade }
      );
    }
  }
}

function drawPuff(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const rise = motion.mode === 'inhale' ? (1 - k) * 0.4 : k * 0.55;
  const spread = motion.mode === 'inhale' ? (1 - k) * 0.18 : k * 0.28;
  const fade = motion.mode === 'inhale' ? k : 1 - k;
  const color = SEASON_INK[motion.ink] ?? 6;
  for (let n = 0; n < 5; n++) {
    const a = n * 1.256;
    draw.streak(
      [motion.x, motion.y + rise * 0.4, motion.z],
      [motion.x + Math.cos(a) * spread, motion.y + rise, motion.z + Math.sin(a) * spread],
      { width: 0.04 * Math.max(0.15, fade), color, density: 1.2, emissive: true, depth: true }
    );
  }
}

function drawSlide(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const ease = k * k * (3 - 2 * k);
  const x = motion.x + (motion.tx - motion.x) * ease;
  const z = motion.z + (motion.tz - motion.z) * ease;
  const y = motion.y + (motion.ty - motion.y) * ease;
  const dx = Math.cos(motion.yaw || 0) * 0.38;
  const dz = Math.sin(motion.yaw || 0) * 0.38;
  draw.streak([x - dx, y, z - dz], [x + dx, y + 0.02, z + dz], { ...STICK, color: 6, width: 0.05 });
  draw.streak([x - dx * 0.2, y, z - dz * 0.2], [x - dx * 0.55, y, z - dz * 0.55], { ...RIPPLE, width: 0.02 });
  draw.streak([x + 0.04, y, z], [x - 0.08, y, z + 0.06], { ...RIPPLE, width: 0.016 });
}

function drawDust(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const fade = 1 - k;
  for (let n = 0; n < 4; n++) {
    const a = n * 1.7;
    const r = 0.06 + k * 0.22;
    draw.streak(
      [motion.x, motion.y + k * 0.08, motion.z],
      [motion.x + Math.cos(a) * r, motion.y + k * 0.18, motion.z + Math.sin(a) * r],
      { ...DUST, width: 0.045 * fade }
    );
  }
}

function drawBird(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const x = motion.x0 + (motion.x1 - motion.x0) * k;
  const z = motion.z0 + (motion.z1 - motion.z0) * k;
  const y = motion.y + Math.sin(k * Math.PI) * 0.35;
  const flap = Math.sin(motion.t * 9) * 0.12;
  draw.streak([x - 0.14, y + flap, z], [x, y, z], BIRD);
  draw.streak([x, y, z], [x + 0.14, y + flap, z + 0.02], BIRD);
}

function drawDream(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const ease = k * k * (3 - 2 * k);
  const x = motion.x0 + (motion.x1 - motion.x0) * ease;
  const y = motion.y0 + (motion.y1 - motion.y0) * ease + Math.sin(k * Math.PI) * 0.18;
  const z = motion.z0 + (motion.z1 - motion.z0) * ease;
  const fade = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  draw.point([x, y, z], { ...DREAM, width: 0.032 * fade });
}

function drawWake(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const color = WAKE_INK[motion.id] ?? 6;
  for (let n = 0; n < 3; n++) {
    const a = n * (Math.PI * 2 / 3) + 0.4;
    const t = Math.max(0, 1 - k);
    const r = 0.28 * t;
    draw.streak(
      [motion.x + Math.cos(a) * r, motion.y + 0.1 + t * 0.2, motion.z + Math.sin(a) * r],
      [motion.x, motion.y + 0.5, motion.z],
      { width: 0.05 * t, color, density: 1.1, emissive: true, depth: true }
    );
  }
}

function drawDig(draw, motion) {
  const k = Math.min(1, motion.t / motion.dur);
  const y = motion.y - k * 0.06;
  draw.streak([motion.x - 0.08, y, motion.z], [motion.x + 0.08, y + 0.02, motion.z + 0.03], { ...SOIL, width: 0.05 });
}

function handMark(draw) {
  draw.streak([0.22, 0.78, 0.02], [0.46, 0.98, -0.02], { ...LEAF, width: 0.055 });
  draw.streak([0.3, 0.74, -0.06], [0.42, 0.92, 0.08], { ...LEAF, width: 0.04 });
}

export function paintClip(draw, id, phase) {
  if (id === 'pick') {
    const k = phase < 0.12 ? 0 : Math.min(1, (phase - 0.12) / 0.55);
    const ease = k * k * (3 - 2 * k);
    paintCrop(draw, 'turnip', ease * 0.28, 0.16 + ease * 0.62, 0, 1);
    if (ease > 0.35) handMark(draw);
    return;
  }
  if (id === 'carry') {
    const bob = Math.sin(phase * Math.PI * 2) * 0.045;
    paintCrop(draw, 'turnip', 0.28, 0.78 + bob, 0, 1);
    handMark(draw);
    return;
  }
  if (id === 'eat') {
    const k = Math.min(1, phase / 0.7);
    paintCrop(draw, 'turnip', 0.28, 0.82, 0, Math.max(0.12, 1 - k * 0.88));
    handMark(draw);
    return;
  }
  const sink = Math.min(1, phase / 0.4);
  const y = 0.22 - sink * 0.14;
  draw.streak([-0.32, y, 0.08], [0.32, y, -0.08], { ...STICK, width: 0.045 });
  draw.streak([-0.08, y + 0.06, -0.3], [0.08, y + 0.06, 0.3], { ...STICK, width: 0.045 });
  const hump = sink * 0.26;
  draw.streak([-0.38, 0.05, 0], [0.38, 0.05 + hump, 0], { ...SOIL, width: 0.13 });
  draw.streak([0, 0.05, -0.3], [0, 0.06 + hump * 0.75, 0.3], { ...SOIL, width: 0.11 });
  draw.streak([-0.2, 0.08 + hump * 0.5, 0], [0.2, 0.1 + hump, 0], { ...SOIL, width: 0.07, color: 8 });
  if (phase > 0.42) {
    const leaf = Math.min(1, (phase - 0.42) / 0.28);
    const fall = 1.05 - leaf * 0.7;
    const drift = Math.sin(leaf * 8) * 0.16;
    draw.streak([drift - 0.07, fall, 0.04], [drift + 0.07, fall - 0.03, -0.02], { ...ROOT, color: 13, width: 0.04 });
    draw.streak([-0.18 + leaf * 0.08, fall + 0.2, 0.1], [-0.06 + leaf * 0.08, fall + 0.1, 0.02], { ...ROOT, color: 10, width: 0.035 });
  }
  if (phase > 0.74) {
    const snow = Math.min(1, (phase - 0.74) / 0.2);
    draw.streak([-0.16 * snow, 0.12 + hump, 0], [0.16 * snow, 0.15 + hump, 0.02], { ...SNOW, width: 0.05 });
  }
}
