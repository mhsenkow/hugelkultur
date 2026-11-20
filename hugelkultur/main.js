import { createRenderer } from '../webgl.mjs';
import { buildWorld, PEDESTAL } from './world.js';
import { createAvatar, movement, wearSpirit } from './avatar.js';
import { SPIRITS, spiritById, buildSpirit } from './avatars.js';
import { createStickSystem, updateSticks, stackCount } from './sticks.js';
import { updateGrowth, drawGrowth } from './growth.js';
import { updateGardens } from './gardens.js';
import { updateMotions, MOTIONS } from './motions.js';
import { updateWeather } from './weather.js';
import { createWater, updateWater, seasonOf, SEASON_LENGTH, clearingDepth } from './water.js';
import { steer } from './guide.js';
import { FLORA, floraById } from './species.js';
import { buildSpecimen, buildMotion } from './specimens.js';

const canvas = document.querySelector('#view');
const seasonLabel = document.querySelector('#season-label');
const seasonPip = document.querySelector('#season-pip');
const carryLabel = document.querySelector('#carry-label');
const hearthLabel = document.querySelector('#hearth-label');
const ticker = document.querySelector('#ticker');
const end = document.querySelector('#end');
const keys = new Set();

let audioEnabled = true;
let audioCtx = null;
let sim = null;
let renderer = null;
const ISO_YAW = Math.PI / 4;
const ISO_PITCH = 0.72;
const ISO_DIST = 26;
const ISO_FOV = 0.66;
const GOAL = { x: 0.2, y: 0.9, z: 0.2 };

let yaw = ISO_YAW;
let pitch = ISO_PITCH;
let dist = ISO_DIST;
let distTo = ISO_DIST;
const look = { x: GOAL.x, y: GOAL.y, z: GOAL.z };
const gaze = { x: GOAL.x, y: GOAL.y, z: GOAL.z };
let focus = null;
let anchor = null;
let settle = null;
let orbit = null;
let pinch = null;
let hovering = false;
const fingers = new Map();
let first = true;
let last = 0;
let specimenId = 'oak';
let specimenYaw = Math.PI / 4;
let specimenDrag = null;
let specimenView = null;
let specimenRenderer = null;
let floraOrder = [];
let spiritYaw = Math.PI / 4;
let spiritDrag = null;
let spiritView = null;
let spiritRenderer = null;
const spiritViews = new Map();

const LOOK_KEY = 'hugelkultur-look';
const LOOK = { pixels: 3, dots: 0.62, ink: 0.05, grain: 0.45, pattern: 'bayer' };

function clampLook(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function loadLook() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return;
    if (Number.isFinite(raw.pixels)) LOOK.pixels = clampLook(Math.round(raw.pixels), 1, 6);
    if (Number.isFinite(raw.dots)) LOOK.dots = clampLook(raw.dots, 0, 1);
    if (Number.isFinite(raw.ink)) LOOK.ink = clampLook(raw.ink, 0, 0.4);
    if (Number.isFinite(raw.grain)) LOOK.grain = clampLook(raw.grain, 0, 1);
    if (raw.pattern === 'bayer' || raw.pattern === 'blue-noise') LOOK.pattern = raw.pattern;
  } catch {
    /* keep the original look */
  }
}

function saveLook() {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(LOOK));
  } catch {
    /* the picture still changes for this visit */
  }
}

function applyLook() {
  const tone = sim?.world?.look?.tone;
  if (tone) {
    tone.amount = LOOK.dots;
    tone.cutoff = LOOK.ink;
    tone.pattern = LOOK.pattern;
  }
  const worlds = [sim?.world, specimenView?.world, spiritView?.world];
  for (const view of spiritViews.values()) worlds.push(view?.world);
  for (const world of worlds) if (world) world.dither = LOOK.grain;
}

function paintLook() {
  document.querySelector('#look-pixels').value = String(LOOK.pixels);
  document.querySelector('#look-dots').value = String(Math.round(LOOK.dots * 100));
  document.querySelector('#look-ink').value = String(Math.round(LOOK.ink * 100));
  document.querySelector('#look-grain').value = String(Math.round(LOOK.grain * 100));
  document.querySelector('#look-pixels-out').textContent = `${LOOK.pixels}×`;
  document.querySelector('#look-dots-out').textContent = String(Math.round(LOOK.dots * 100));
  document.querySelector('#look-ink-out').textContent = String(Math.round(LOOK.ink * 100));
  document.querySelector('#look-grain-out').textContent = String(Math.round(LOOK.grain * 100));
  for (const button of document.querySelectorAll('#look-panel [data-pattern]')) {
    button.setAttribute('aria-pressed', String(button.dataset.pattern === LOOK.pattern));
  }
}

function readLook() {
  LOOK.pixels = clampLook(Number(document.querySelector('#look-pixels').value), 1, 6);
  LOOK.dots = clampLook(Number(document.querySelector('#look-dots').value) / 100, 0, 1);
  LOOK.ink = clampLook(Number(document.querySelector('#look-ink').value) / 100, 0, 0.4);
  LOOK.grain = clampLook(Number(document.querySelector('#look-grain').value) / 100, 0, 1);
  applyLook();
  saveLook();
  document.querySelector('#look-pixels-out').textContent = `${LOOK.pixels}×`;
  document.querySelector('#look-dots-out').textContent = String(Math.round(LOOK.dots * 100));
  document.querySelector('#look-ink-out').textContent = String(Math.round(LOOK.ink * 100));
  document.querySelector('#look-grain-out').textContent = String(Math.round(LOOK.grain * 100));
}

function resetLook() {
  LOOK.pixels = 3;
  LOOK.dots = 0.62;
  LOOK.ink = 0.05;
  LOOK.grain = 0.45;
  LOOK.pattern = 'bayer';
  applyLook();
  try { localStorage.removeItem(LOOK_KEY); } catch { /* the original is already on screen */ }
  paintLook();
}

function artSize() {
  const scale = LOOK.pixels;
  let width = Math.max(120, Math.round(window.innerWidth / scale));
  let height = Math.max(90, Math.round(window.innerHeight / scale));
  const over = Math.max(width / 1600, height / 1000, 1);
  return { width: Math.round(width / over), height: Math.round(height / over) };
}

function tone(type) {
  if (!audioEnabled) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  audioCtx ??= new Context();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  const notes = {
    place: [220, 140, 0.07, 'triangle'],
    take: [330, 220, 0.06, 'sine'],
    shake: [180, 320, 0.09, 'triangle'],
    berm: [523, 659, 0.28, 'sine'],
    flood: [180, 90, 0.22, 'sawtooth'],
    eat: [440, 660, 0.12, 'sine']
  };
  const [a, b, dur, kind] = notes[type] || notes.place;
  osc.type = kind;
  osc.frequency.setValueAtTime(a, now);
  osc.frequency.exponentialRampToValueAtTime(b, now + dur);
  gain.gain.setValueAtTime(type === 'flood' ? 0.08 : 0.06, now);
  gain.gain.linearRampToValueAtTime(0.001, now + dur);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function say(text) {
  ticker.textContent = text;
}

function drainEvents() {
  for (const event of sim.events) {
    if (event.text) say(event.text);
    if (event.type === 'place' || event.type === 'take' || event.type === 'shake' || event.type === 'berm' || event.type === 'flood' || event.type === 'eat') {
      tone(event.type);
    }
  }
  sim.events.length = 0;
}

function paintHud() {
  const season = seasonOf(sim);
  seasonPip.style.background = season.pip;
  seasonLabel.textContent = `${season.id} · Y${sim.year} · ${season.edge}`;
  carryLabel.textContent = sim.carrying ? 'a stick' : sim.held ? floraById(sim.held)?.name || sim.held : 'empty';
  carryLabel.classList.toggle('holding', sim.carrying);
  const paceLabel = document.querySelector('#pace-label');
  const quick = sim.haste > 0;
  paceLabel.hidden = !quick;
  document.querySelector('#pace-rule').hidden = !quick;
  document.querySelector('#spirit-label').textContent = spiritById(sim.spiritId).name;
  paintFlora(false);
  paintSpirits(false);
  const wet = sim.flood > 0.35;
  const damp = !wet && clearingDepth(sim) > 0.045;
  hearthLabel.textContent = wet ? 'idol wet' : damp ? 'clearing wet' : 'idol dry';
  hearthLabel.classList.toggle('wet', wet);
  hearthLabel.classList.toggle('damp', damp);
  if (!sim.over) return;
  document.querySelector('#end-years').textContent = String(sim.year);
  document.querySelector('#end-stacks').textContent = String(stackCount(sim));
  document.querySelector('#end-berms').textContent = String(sim.berms);
  end.hidden = false;
}

function changedRows() {
  const out = [];
  const flags = sim.stage.rows;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) out.push(i);
    flags[i] = 0;
  }
  for (const spirit of sim.spirits || []) {
    if (spirit.at === undefined) continue;
    const firstRow = spirit.at >> 9;
    const lastRow = (spirit.at + spirit.character.total - 1) >> 9;
    for (let row = firstRow; row <= lastRow; row++) if (!out.includes(row)) out.push(row);
  }
  return out;
}

function angDiff(target, current) {
  return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

function cameraRays() {
  const xs = Math.sin(yaw);
  const cs = Math.cos(yaw);
  const cy = Math.cos(pitch);
  const zx = cy * xs;
  const zy = Math.sin(pitch);
  const zz = cy * cs;
  const xl = Math.hypot(zz, zx);
  const xx = xl ? zz / xl : cs;
  const xz = xl ? -zx / xl : -xs;
  const yx = zy * xz;
  const yy = zz * xx - zx * xz;
  const yz = -zy * xx;
  const rect = canvas.getBoundingClientRect();
  const viewHeight = dist * Math.tan(ISO_FOV / 2);
  const viewWidth = viewHeight * (rect.width / Math.max(1, rect.height));
  return { right: [xx, 0, xz], up: [yx, yy, yz], back: [zx, zy, zz], viewWidth, viewHeight, rect };
}

function raySphere(origin, dir, center, radius) {
  const ox = origin[0] - center[0];
  const oy = origin[1] - center[1];
  const oz = origin[2] - center[2];
  const b = ox * dir[0] + oy * dir[1] + oz * dir[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const near = -b - s;
  if (near >= 0) return near;
  const far = -b + s;
  return far >= 0 ? far : null;
}

function pick(clientX, clientY) {
  const rays = cameraRays();
  const { rect, right, up, back, viewWidth, viewHeight } = rays;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
  const setback = 80;
  const origin = [
    look.x + back[0] * setback + right[0] * ndcX * viewWidth + up[0] * ndcY * viewHeight,
    look.y + back[1] * setback + right[1] * ndcX * viewWidth + up[1] * ndcY * viewHeight,
    look.z + back[2] * setback + right[2] * ndcX * viewWidth + up[2] * ndcY * viewHeight
  ];
  const dir = [-back[0], -back[1], -back[2]];
  let best = null;
  const consider = (kind, id, center, radius) => {
    const t = raySphere(origin, dir, center, radius);
    if (t === null || (best && t >= best.t)) return;
    best = {
      kind,
      id,
      t,
      point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t]
    };
  };
  const st = sim.character.st;
  consider('her', 'her', [st.x, st.y + 0.62, st.z], 0.78);
  const hearth = sim.hearth;
  consider('idol', 'idol', [hearth.x, hearth.elevation + PEDESTAL + 0.42, hearth.z], 0.62);
  for (const plot of sim.plots) {
    consider('crop', plot.id, [plot.x, plot.cell.elevation + 0.36, plot.z], 0.48);
  }
  return best;
}

function anchorOf(kind, id) {
  if (kind === 'her') {
    const st = sim.character.st;
    return [st.x, st.y + 0.9, st.z];
  }
  if (kind === 'idol') {
    const hearth = sim.hearth;
    return [hearth.x, hearth.elevation + PEDESTAL + 0.55, hearth.z];
  }
  const plot = sim.plots.find(item => item.id === id);
  if (!plot) return null;
  return [plot.x, plot.cell.elevation + 0.42, plot.z];
}

function subjectPoint() {
  if (!focus) return [GOAL.x, GOAL.y, GOAL.z];
  return anchorOf(focus.kind, focus.id);
}

function frameDist(kind) {
  if (kind === 'her') return 6.4;
  if (kind === 'idol') return 8;
  return 4.8;
}

function clampDist(value) {
  return Math.min(40, Math.max(0.36, value));
}

function rememberAnchor() {
  const subject = subjectPoint();
  anchor = subject ? subject.slice() : null;
}

function placeGaze(hit) {
  const center = anchorOf(hit.kind, hit.id);
  if (!center) return;
  const point = hit.point || center;
  gaze.x = center[0] * 0.4 + point[0] * 0.6;
  gaze.y = center[1] * 0.35 + point[1] * 0.65;
  gaze.z = center[2] * 0.4 + point[2] * 0.6;
  rememberAnchor();
}

function focusSubject(hit, frame) {
  const same = focus && focus.kind === hit.kind && focus.id === hit.id;
  if (same && !frame) return;
  focus = { kind: hit.kind, id: hit.id };
  placeGaze(hit);
  const readable = frameDist(hit.kind);
  if (frame || dist > 12 || dist < readable * 0.48) distTo = readable;
  if (frame) settle = { yaw, pitch: ISO_PITCH };
}

function releaseFocus() {
  focus = null;
  gaze.x = GOAL.x;
  gaze.y = GOAL.y;
  gaze.z = GOAL.z;
  distTo = ISO_DIST;
  const step = Math.PI / 2;
  const n = Math.round((yaw - ISO_YAW) / step);
  settle = { yaw: ISO_YAW + n * step, pitch: ISO_PITCH };
  rememberAnchor();
}

function stepIso(dir) {
  const step = Math.PI / 2;
  const n = Math.round((yaw - ISO_YAW) / step) + dir;
  settle = { yaw: ISO_YAW + n * step, pitch: ISO_PITCH };
}

function zoomAt(clientX, clientY, nextDist) {
  const next = clampDist(nextDist);
  const rays = cameraRays();
  const { rect, right, up, viewWidth, viewHeight } = rays;
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
  const shift = dist - next;
  const ox = right[0] * ndcX * (viewWidth / dist) + up[0] * ndcY * (viewHeight / dist);
  const oy = right[1] * ndcX * (viewWidth / dist) + up[1] * ndcY * (viewHeight / dist);
  const oz = right[2] * ndcX * (viewWidth / dist) + up[2] * ndcY * (viewHeight / dist);
  look.x += ox * shift;
  look.y += oy * shift;
  look.z += oz * shift;
  gaze.x = look.x;
  gaze.y = look.y;
  gaze.z = look.z;
  dist = next;
  distTo = next;
  settle = null;
  rememberAnchor();
}

function panBy(dx, dy) {
  const { rect, right, up, viewWidth, viewHeight } = cameraRays();
  const wx = -(dx / rect.width) * 2 * viewWidth;
  const wy = (dy / rect.height) * 2 * viewHeight;
  gaze.x += right[0] * wx + up[0] * wy;
  gaze.y += right[1] * wx + up[1] * wy;
  gaze.z += right[2] * wx + up[2] * wy;
  look.x = gaze.x;
  look.y = gaze.y;
  look.z = gaze.z;
  rememberAnchor();
}

function softenPitch(next) {
  const min = 0.08;
  const max = 1.45;
  if (next < min) return min + (next - min) * 0.22;
  if (next > max) return max + (next - max) * 0.22;
  return next;
}

function paintCursor() {
  canvas.classList.toggle('looking', Boolean(orbit && orbit.mode === 'orbit' && orbit.moved));
  canvas.classList.toggle('sliding', Boolean(orbit && orbit.mode === 'pan' && orbit.moved));
  canvas.classList.toggle('hot', !orbit && !pinch && hovering);
}

function aim(dt) {
  let goal = subjectPoint();
  if (!goal) {
    focus = null;
    gaze.x = GOAL.x;
    gaze.y = GOAL.y;
    gaze.z = GOAL.z;
    distTo = ISO_DIST;
    goal = [GOAL.x, GOAL.y, GOAL.z];
  }
  if (anchor) {
    const dx = goal[0] - anchor[0];
    const dy = goal[1] - anchor[1];
    const dz = goal[2] - anchor[2];
    gaze.x += dx;
    gaze.y += dy;
    gaze.z += dz;
    look.x += dx;
    look.y += dy;
    look.z += dz;
  }
  anchor = goal.slice();
  const zoomingOut = distTo > dist + 0.04 || dist > ISO_DIST + 2;
  if (!orbit && !pinch && !focus && zoomingOut) {
    const pull = (1 - Math.exp(-dt * 2.2)) * Math.min(1, Math.max(0, dist - 16) / 12);
    gaze.x += (GOAL.x - gaze.x) * pull;
    gaze.y += (GOAL.y - gaze.y) * pull;
    gaze.z += (GOAL.z - gaze.z) * pull;
  }
  const follow = 1 - Math.exp(-dt * 9);
  look.x += (gaze.x - look.x) * follow;
  look.y += (gaze.y - look.y) * follow;
  look.z += (gaze.z - look.z) * follow;
  if (Math.abs(distTo - dist) > 0.01) {
    dist += (distTo - dist) * (1 - Math.exp(-dt * 8));
    if (Math.abs(distTo - dist) < 0.02) dist = distTo;
  }
  if (!settle) return;
  const pose = 1 - Math.exp(-dt * 5.5);
  yaw += angDiff(settle.yaw, yaw) * pose;
  pitch += (settle.pitch - pitch) * pose;
  if (Math.abs(angDiff(settle.yaw, yaw)) < 0.004 && Math.abs(pitch - settle.pitch) < 0.004) {
    yaw = settle.yaw;
    pitch = settle.pitch;
    settle = null;
  }
}

function frame(now) {
  applyLook();
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  aim(dt);
  if (!sim.over) {
    const driving = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].some(code => keys.has(code));
    const auto = steer(sim, dt, driving);
    const input = driving ? movement(keys, yaw) : (auto || { move: 0, mz: 0 });
    const paced = sim.haste > 0 ? { ...input, move: (input.move || 0) * sim.pace, mz: (input.mz || 0) * sim.pace } : input;
    sim.character.update(dt, paced, sim.time);
    updateSticks(sim, dt);
    updateGrowth(sim, dt);
    updateGardens(sim, dt, driving);
    updateWeather(sim, dt);
    updateMotions(sim, dt);
    updateWater(sim, dt);
    sim.stage.update(dt, sim.time);
    sim.time += dt;
  }
  drainEvents();
  paintHud();
  const size = artSize();
  try {
    renderer.render(sim.world, {
      width: size.width,
      height: size.height,
      time: sim.time,
      changedRows: first ? undefined : changedRows(),
      camera: {
        target: [look.x, look.y, look.z],
        dist,
        yaw,
        pitch,
        fov: ISO_FOV,
        ortho: true
      }
    });
    first = false;
  } catch (error) {
    say(error instanceof Error ? error.message : String(error));
    return;
  }
  if (sim.seasonTime > SEASON_LENGTH) sim.seasonTime = SEASON_LENGTH;
  renderSpecimen(dt);
  renderSpirit(dt);
  requestAnimationFrame(frame);
}

function floraRows() {
  const motions = MOTIONS.map(item => ({
    ...item,
    state: sim.seen.has(item.id) ? 'seen' : 'clip',
    living: sim.seen.has(item.id) ? 1 : 0
  }));
  const trees = new Map();
  for (const tree of sim.trees) trees.set(tree.kind, (trees.get(tree.kind) || 0) + 1);
  const crops = new Map();
  for (const plot of sim.plots) {
    const row = crops.get(plot.crop) || { n: 0, ripe: 0 };
    row.n += 1;
    if (plot.growth >= 1) row.ripe += 1;
    crops.set(plot.crop, row);
  }
  const order = { tree: 0, crop: 1, shrub: 2, plant: 3, motion: -1 };
  const plants = FLORA.map(item => {
    const planted = trees.get(item.id) || 0;
    const crop = crops.get(item.id);
    let state = 'Not sown';
    if (planted) state = `${planted} on the cube`;
    else if (crop) state = crop.ripe ? `${crop.n} · ${crop.ripe} ripe` : `${crop.n} growing`;
    return { ...item, state, living: planted || crop?.n || 0 };
  }).sort((a, b) => (b.living > 0) - (a.living > 0) || order[a.group] - order[b.group] || a.name.localeCompare(b.name));
  return [...motions, ...plants];
}

function paintFlora(force) {
  const panel = document.querySelector('#flora');
  if (panel.hidden) return;
  if (!force && sim.time - paintFlora.at < 0.35) return;
  paintFlora.at = sim.time;
  floraOrder = floraRows();
  const list = document.querySelector('#flora-list');
  if (list.childElementCount !== floraOrder.length) {
    list.replaceChildren(...floraOrder.map(item => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flora-item';
      button.dataset.id = item.id;
      button.addEventListener('click', () => showSpecimen(item.id));
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = item.swatch;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      const note = document.createElement('small');
      note.textContent = item.note;
      name.append(note);
      const state = document.createElement('span');
      state.className = 'state';
      button.append(swatch, name, state);
      li.append(button);
      return li;
    }));
  }
  for (const item of floraOrder) {
    const button = list.querySelector(`button[data-id="${item.id}"]`);
    if (!button) continue;
    button.querySelector('.state').textContent = item.state;
    if (item.id === specimenId) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
    button.closest('li').classList.toggle('living', item.living > 0);
  }
  const current = floraOrder.find(item => item.id === specimenId);
  if (!current) return;
  document.querySelector('#specimen-group').textContent = current.group;
  document.querySelector('#specimen-name').textContent = current.name;
  document.querySelector('#specimen-note').textContent = current.note;
  document.querySelector('#specimen-state').textContent = current.state;
}
paintFlora.at = -1;

function showSpecimen(id) {
  specimenId = id;
  specimenYaw = Math.PI / 4;
  const kit = { makeBuilder, makeSculpt, KIT, PixelLook };
  const motion = MOTIONS.some(item => item.id === id);
  try {
    specimenView = motion ? buildMotion(kit, id) : buildSpecimen(kit, id);
    const view = document.querySelector('#specimen');
    specimenRenderer ??= createRenderer(view, { toolkit: { KIT, PixelLook } });
    document.querySelector('#specimen-note').textContent = '';
  } catch (error) {
    specimenView = null;
    document.querySelector('#specimen-note').textContent = error instanceof Error ? error.message : String(error);
  }
  paintFlora(true);
  document.querySelector(`#flora-list button[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function stepSpecimen(dir) {
  if (!floraOrder.length) floraOrder = floraRows();
  const at = Math.max(0, floraOrder.findIndex(item => item.id === specimenId));
  const next = floraOrder[(at + dir + floraOrder.length) % floraOrder.length];
  if (next) showSpecimen(next.id);
}

function renderSpecimen(dt) {
  const panel = document.querySelector('#flora');
  if (panel.hidden || !specimenView || !specimenRenderer) return;
  if (!specimenDrag) specimenYaw += dt * 0.35;
  const canvas = document.querySelector('#specimen');
  const width = Math.max(160, Math.round(canvas.clientWidth / 2));
  const height = Math.max(120, Math.round(canvas.clientHeight / 2));
  specimenView.stage.update(dt, sim.time);
  specimenRenderer.render(specimenView.world, {
    width,
    height,
    time: sim.time,
    camera: { ...specimenView.cam, yaw: specimenYaw, ortho: true }
  });
}

function paintSpirits(force) {
  const panel = document.querySelector('#spirits');
  if (panel.hidden) return;
  if (!force && sim.time - paintSpirits.at < 0.35) return;
  paintSpirits.at = sim.time;
  const list = document.querySelector('#spirit-list');
  if (!list.childElementCount) {
    list.replaceChildren(...SPIRITS.map(item => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'flora-item';
      button.dataset.id = item.id;
      button.addEventListener('click', () => chooseSpirit(item.id));
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = item.swatch;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      const note = document.createElement('small');
      note.textContent = item.group;
      name.append(note);
      const state = document.createElement('span');
      state.className = 'state';
      button.append(swatch, name, state);
      li.append(button);
      return li;
    }));
  }
  for (const item of SPIRITS) {
    const button = list.querySelector(`button[data-id="${item.id}"]`);
    const wearing = item.id === sim.spiritId;
    button.querySelector('.state').textContent = wearing ? 'wearing' : 'waiting';
    button.setAttribute('aria-current', wearing ? 'true' : 'false');
    button.closest('li').classList.toggle('living', wearing);
  }
  const current = spiritById(sim.spiritId);
  document.querySelector('#spirit-group').textContent = current.group;
  document.querySelector('#spirit-name').textContent = current.name;
  document.querySelector('#spirit-note').textContent = current.note;
  document.querySelector('#spirit-state').textContent = 'Wearing this body';
}
paintSpirits.at = -1;

function ensureSpirit(id) {
  if (!spiritViews.has(id)) {
    const kit = { makeBuilder, makeSculpt, KIT, PixelLook };
    try {
      spiritViews.set(id, buildSpirit(kit, id));
      spiritRenderer ??= createRenderer(document.querySelector('#spirit-view'), { toolkit: { KIT, PixelLook } });
    } catch (error) {
      spiritView = null;
      document.querySelector('#spirit-note').textContent = error instanceof Error ? error.message : String(error);
      return;
    }
  }
  spiritView = spiritViews.get(id) || null;
  spiritYaw = Math.PI / 4;
}

function chooseSpirit(id) {
  const changed = wearSpirit(sim, id);
  if (changed) say(`The spirit gathers into ${spiritById(id).name}.`);
  if (!document.querySelector('#spirits').hidden) {
    ensureSpirit(id);
    paintSpirits(true);
    document.querySelector(`#spirit-list button[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }
}

function stepSpirit(dir) {
  const at = Math.max(0, SPIRITS.findIndex(item => item.id === sim.spiritId));
  const next = SPIRITS[(at + dir + SPIRITS.length) % SPIRITS.length];
  chooseSpirit(next.id);
}

function renderSpirit(dt) {
  const panel = document.querySelector('#spirits');
  if (panel.hidden || !spiritView || !spiritRenderer) return;
  if (!spiritDrag) spiritYaw += dt * 0.28;
  const st = spiritView.character.st;
  st.x = 0;
  st.z = 0;
  st.vx = 0;
  st.vz = 0;
  const walking = Math.sin(sim.time * 0.45) > 0.15;
  spiritView.character.update(dt, walking ? { move: 0.9, mz: 0 } : { move: 0, mz: 0 }, sim.time);
  st.x = 0;
  st.z = 0;
  spiritView.stage.update(dt, sim.time);
  const view = document.querySelector('#spirit-view');
  const width = Math.max(160, Math.round(view.clientWidth / 2));
  const height = Math.max(120, Math.round(view.clientHeight / 2));
  spiritRenderer.render(spiritView.world, {
    width,
    height,
    time: sim.time,
    camera: { ...spiritView.cam, yaw: spiritYaw, ortho: true }
  });
}

function boot() {
  const kit = { makeBuilder, makeSculpt, KIT, PixelLook };
  sim = buildWorld(kit, { createFrame: createStickSystem, createAvatar, drawGrowth, createWater });
  renderer = createRenderer(canvas, { toolkit: { KIT, PixelLook } });
  applyLook();
  say('Keep the idol dry. The circle can take water. Finish a stack, or leave it for the weather.');
  paintHud();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', event => {
  if (event.target.closest?.('#look-panel')) return;
  if (event.repeat || !sim) return;
  if (event.code === 'Space') {
    event.preventDefault();
    if (sim.held) sim.eatQueued = true;
    else sim.placeQueued = true;
  } else if (!floraPanel.hidden && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
    event.preventDefault();
    stepSpecimen(event.code === 'ArrowRight' ? 1 : -1);
  } else if (!spiritPanel.hidden && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
    event.preventDefault();
    stepSpirit(event.code === 'ArrowRight' ? 1 : -1);
  } else if (!floraPanel.hidden && event.code === 'KeyQ') {
    specimenYaw -= 0.4;
  } else if (!floraPanel.hidden && event.code === 'KeyE') {
    specimenYaw += 0.4;
  } else if (!spiritPanel.hidden && event.code === 'KeyQ') {
    spiritYaw -= 0.4;
  } else if (!spiritPanel.hidden && event.code === 'KeyE') {
    spiritYaw += 0.4;
  } else if (/^Digit[1-9]$/.test(event.code)) {
    const index = Number(event.code.slice(5)) - 1;
    if (!SPIRITS[index]) return;
    event.preventDefault();
    chooseSpirit(SPIRITS[index].id);
  } else if (event.code === 'KeyQ') {
    stepIso(-1);
  } else if (event.code === 'KeyE') {
    stepIso(1);
  } else if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
    event.preventDefault();
    zoomAt(window.innerWidth / 2, window.innerHeight / 2, dist * 1.12);
  } else if (event.code === 'Equal' || event.code === 'NumpadAdd') {
    event.preventDefault();
    zoomAt(window.innerWidth / 2, window.innerHeight / 2, dist / 1.12);
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
  } else keys.add(event.code);
});

window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

document.querySelector('#turn-left').addEventListener('click', () => stepIso(-1));
document.querySelector('#turn-right').addEventListener('click', () => stepIso(1));

function fingerGap() {
  const pts = [...fingers.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

function fingerMid() {
  const pts = [...fingers.values()];
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

canvas.addEventListener('pointerdown', event => {
  if (!sim) return;
  fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  try { canvas.setPointerCapture(event.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
  if (fingers.size >= 2) {
    orbit = null;
    pinch = { gap: Math.max(12, fingerGap()) };
    paintCursor();
    return;
  }
  const mode = event.button === 1 || event.button === 2 || event.shiftKey ? 'pan' : event.button === 0 ? 'orbit' : null;
  if (!mode) return;
  const close = Math.min(1, dist / 14);
  orbit = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    yaw,
    pitch,
    mode,
    moved: false,
    speed: 0.0026 + 0.0046 * close
  };
  paintCursor();
});
canvas.addEventListener('pointermove', event => {
  if (fingers.has(event.pointerId)) {
    fingers.get(event.pointerId).x = event.clientX;
    fingers.get(event.pointerId).y = event.clientY;
  }
  if (pinch && fingers.size >= 2) {
    const gap = Math.max(12, fingerGap());
    const mid = fingerMid();
    zoomAt(mid.x, mid.y, dist * (pinch.gap / gap));
    pinch.gap = gap;
    return;
  }
  if (orbit && event.pointerId === orbit.id) {
    const dx = event.clientX - orbit.x;
    const dy = event.clientY - orbit.y;
    if (!orbit.moved && dx * dx + dy * dy < 36) return;
    if (!orbit.moved) {
      orbit.moved = true;
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      orbit.yaw = yaw;
      orbit.pitch = pitch;
      settle = null;
      paintCursor();
      return;
    }
    if (orbit.mode === 'pan') {
      panBy(event.clientX - orbit.x, event.clientY - orbit.y);
      orbit.x = event.clientX;
      orbit.y = event.clientY;
      return;
    }
    yaw = orbit.yaw - (event.clientX - orbit.x) * orbit.speed;
    pitch = softenPitch(orbit.pitch + (event.clientY - orbit.y) * orbit.speed * 0.75);
    return;
  }
  if (!sim || orbit || pinch) return;
  hovering = Boolean(pick(event.clientX, event.clientY));
  paintCursor();
});
function endOrbit(event) {
  fingers.delete(event.pointerId);
  if (fingers.size < 2) pinch = null;
  if (!orbit || event.pointerId !== orbit.id) {
    paintCursor();
    return;
  }
  const moved = orbit.moved;
  const mode = orbit.mode;
  const x = event.clientX;
  const y = event.clientY;
  orbit = null;
  if (moved && (pitch < 0.08 || pitch > 1.45)) {
    settle = { yaw, pitch: Math.min(1.45, Math.max(0.08, pitch)) };
  }
  paintCursor();
  if (moved || mode !== 'orbit' || !sim) return;
  const hit = pick(x, y);
  if (hit) focusSubject(hit, false);
}
canvas.addEventListener('pointerup', endOrbit);
canvas.addEventListener('pointercancel', endOrbit);
canvas.addEventListener('pointerleave', () => {
  if (orbit || pinch) return;
  hovering = false;
  paintCursor();
});
canvas.addEventListener('dblclick', event => {
  if (!sim) return;
  const hit = pick(event.clientX, event.clientY);
  if (hit) focusSubject(hit, true);
  else releaseFocus();
});
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('wheel', event => {
  if (!sim) return;
  event.preventDefault();
  let dy = event.deltaY;
  if (event.deltaMode === 1) dy *= 32;
  else if (event.deltaMode === 2) dy *= canvas.getBoundingClientRect().height;
  if (Math.abs(dy) < 0.4) return;
  const step = Math.max(-180, Math.min(180, dy));
  zoomAt(event.clientX, event.clientY, dist * Math.exp(step * 0.0016));
}, { passive: false });
document.querySelector('#restart').addEventListener('click', () => location.reload());
document.querySelector('#end-restart').addEventListener('click', () => location.reload());
document.querySelector('#sound').addEventListener('click', event => {
  audioEnabled = !audioEnabled;
  event.currentTarget.setAttribute('aria-pressed', String(audioEnabled));
});

const floraToggle = document.querySelector('#flora-toggle');
const floraPanel = document.querySelector('#flora');
const spiritToggle = document.querySelector('#spirit-toggle');
const spiritPanel = document.querySelector('#spirits');

function setLibrary(which) {
  const floraOpen = which === 'flora';
  const spiritOpen = which === 'spirit';
  floraPanel.hidden = !floraOpen;
  spiritPanel.hidden = !spiritOpen;
  floraToggle.setAttribute('aria-expanded', String(floraOpen));
  spiritToggle.setAttribute('aria-expanded', String(spiritOpen));
  if (floraOpen) {
    paintFlora(true);
    if (!specimenView) showSpecimen(specimenId);
  }
  if (spiritOpen) {
    ensureSpirit(sim.spiritId);
    paintSpirits(true);
  }
}

const lookToggle = document.querySelector('#look-toggle');
const lookPanel = document.querySelector('#look-panel');
loadLook();
paintLook();
lookToggle.addEventListener('click', () => {
  const open = lookPanel.hidden;
  lookPanel.hidden = !open;
  lookToggle.setAttribute('aria-expanded', String(open));
});
for (const input of lookPanel.querySelectorAll('input')) input.addEventListener('input', readLook);
for (const button of lookPanel.querySelectorAll('[data-pattern]')) {
  button.addEventListener('click', () => {
    LOOK.pattern = button.dataset.pattern;
    applyLook();
    saveLook();
    paintLook();
  });
}
document.querySelector('#look-reset').addEventListener('click', resetLook);

floraToggle.addEventListener('click', () => setLibrary(floraPanel.hidden ? 'flora' : null));
spiritToggle.addEventListener('click', () => setLibrary(spiritPanel.hidden ? 'spirit' : null));
document.querySelector('#specimen-prev').addEventListener('click', () => stepSpecimen(-1));
document.querySelector('#specimen-next').addEventListener('click', () => stepSpecimen(1));
const specimenCanvas = document.querySelector('#specimen');
specimenCanvas.addEventListener('pointerdown', event => {
  specimenDrag = { x: event.clientX, yaw: specimenYaw };
  specimenCanvas.setPointerCapture(event.pointerId);
});
specimenCanvas.addEventListener('pointermove', event => {
  if (!specimenDrag) return;
  specimenYaw = specimenDrag.yaw + (event.clientX - specimenDrag.x) * 0.01;
});
specimenCanvas.addEventListener('pointerup', () => { specimenDrag = null; });
specimenCanvas.addEventListener('pointercancel', () => { specimenDrag = null; });
document.querySelector('#spirit-prev').addEventListener('click', () => stepSpirit(-1));
document.querySelector('#spirit-next').addEventListener('click', () => stepSpirit(1));
const spiritCanvas = document.querySelector('#spirit-view');
spiritCanvas.addEventListener('pointerdown', event => {
  spiritDrag = { x: event.clientX, yaw: spiritYaw };
  spiritCanvas.setPointerCapture(event.pointerId);
});
spiritCanvas.addEventListener('pointermove', event => {
  if (!spiritDrag) return;
  spiritYaw = spiritDrag.yaw + (event.clientX - spiritDrag.x) * 0.01;
});
spiritCanvas.addEventListener('pointerup', () => { spiritDrag = null; });
spiritCanvas.addEventListener('pointercancel', () => { spiritDrag = null; });
window.addEventListener('keydown', event => {
  if (event.code !== 'Escape') return;
  if (!lookPanel.hidden) {
    lookPanel.hidden = true;
    lookToggle.setAttribute('aria-expanded', 'false');
    return;
  }
  if (!floraPanel.hidden || !spiritPanel.hidden) setLibrary(null);
});

requestAnimationFrame(() => requestAnimationFrame(() => {
  try {
    boot();
  } catch (error) {
    say(error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}));
