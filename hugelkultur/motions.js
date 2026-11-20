import { paintCrop } from './gardens.js';

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

export function drawMotions(draw, sim) {
  let carrying = Boolean(sim.held);
  for (const motion of sim.motions) {
    if (motion.kind === 'pick' || motion.kind === 'eat') carrying = false;
    if (motion.kind === 'pick') drawPick(draw, sim, motion);
    else if (motion.kind === 'eat') drawEat(draw, sim, motion);
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
  paintCrop(draw, motion.crop, x, y + 0.04, z, Math.max(0.08, 1 - k));
}

function drawHeld(draw, sim, scale) {
  if (scale < 0.05) return;
  const [x, y, z] = hand(sim);
  const bob = Math.sin(sim.time * 6) * 0.02;
  paintCrop(draw, sim.held, x, y + bob, z, scale);
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
