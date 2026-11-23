import { createRenderer } from '../webgl.mjs';
import { buildWorld, setScene, useGrid, GRID, HEARTH_I, HEARTH_K, PEDESTAL, cellAt, revealGlade, walkHeight } from './world.js?v=hold';
import { createAvatar, movement, wearSpirit } from './avatar.js?v=hold';
import { SPIRITS, spiritById, buildSpirit } from './avatars.js?v=hold';
import { createStickSystem, updateSticks, plantAt } from './sticks.js?v=hold';
import { updateGrowth, drawGrowth, moundLine, seedSquirrels, shooSquirrel } from './growth.js?v=hold';
import { updateGardens } from './gardens.js?v=hold';
import { updateMotions, MOTIONS } from './motions.js?v=hold';
import { updateSigns } from './signs.js?v=hold';
import { updateWeather } from './weather.js?v=hold';
import { updateDay, nightAmount, dayPart } from './day.js?v=hold';
import { createWater, updateWater, seasonOf, clearingDepth, idolDepth, markMouth } from './water.js?v=hold';
import { steer } from './guide.js?v=hold';
import { updateVisitors, shoo } from './visitors.js?v=hold';
import { updateStress } from './stress.js?v=hold';
import {
  wornMeasures, fitLine, pressureOf, SEASON_LOOK, MOUTH_YAW, MEASURE_KEYS, GOD_TIPS,
  loadMeasures, saveMeasures, blankMeasures, idolLabel, idolStage, SEASON_NAME, woodOf,
  EDGE_NAME, compassName, liftCap, buried, groundLine, eraOf, roomsOf, wallHeight, endBrow
} from './clearing.js?v=hold';
import { readForest, writeForest, clearForest, applyForest, catchUp } from './memory.js?v=hold';
import { FLORA, floraById } from './species.js?v=hold';
import { buildSpecimen, buildMotion, studiesFor, cubeTake } from './specimens.js?v=hold';
import {
  FEATURES, loadScores, saveScores, scoreOf, setScore, scoreSummary
} from './features.js?v=hold';

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
function homeDist() {
  return 26 * (GRID / 16);
}
const ISO_FOV = 0.66;
const GOAL = { x: 0.2, y: 0.9, z: 0.2 };

let yaw = ISO_YAW;
let pitch = ISO_PITCH;
let dist = 26;
let distTo = 26;
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
let specimenTake = 'simple';
let specimenBroken = '';
const specimenTakes = new Map();
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
const SCENE_KEY = 'hugelkultur-scene';
const HINT_KEY = 'hugelkultur-hint';
const LOOK = { pixels: 3, dots: 0.62, ink: 0.05, grain: 0.45, pattern: 'bayer', fidelity: 1, hand: false };
let forestSeed = 1;
let god = false;
let bakedFidelity = 1;

function clampLook(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function loadLook() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return;
    if (Number.isFinite(raw.pixels)) LOOK.pixels = clampLook(Math.round(raw.pixels), 1, 12);
    if (Number.isFinite(raw.dots)) LOOK.dots = clampLook(raw.dots, 0, 1);
    if (Number.isFinite(raw.ink)) LOOK.ink = clampLook(raw.ink, 0, 0.4);
    if (Number.isFinite(raw.grain)) LOOK.grain = clampLook(raw.grain, 0, 1);
    if (raw.pattern === 'bayer' || raw.pattern === 'blue-noise') LOOK.pattern = raw.pattern;
    if (Number.isFinite(raw.fidelity)) LOOK.fidelity = clampLook(Math.round(raw.fidelity), 1, 4);
    LOOK.hand = true;
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

function shownLook() {
  if (LOOK.hand || !sim) return LOOK;
  const want = SEASON_LOOK[seasonOf(sim).id];
  if (!want) return LOOK;
  const era = eraOf(sim);
  const bump = era === 'undercroft' ? 0.18 : era === 'keep' ? 0.12 : era === 'ring' ? 0.06 : 0;
  return {
    ...LOOK,
    dots: want.dots,
    ink: Math.min(0.4, want.ink + bump * 0.6),
    grain: Math.min(1, want.grain + bump),
    pattern: era === 'undercroft' ? 'blue-noise' : want.pattern
  };
}

function applyLook() {
  const look = shownLook();
  const tone = sim?.world?.look?.tone;
  if (tone) {
    tone.amount = look.dots;
    tone.cutoff = look.ink;
    tone.pattern = look.pattern;
  }
  const worlds = [sim?.world, specimenView?.world, spiritView?.world];
  for (const view of spiritViews.values()) worlds.push(view?.world);
  for (const world of worlds) if (world) world.dither = look.grain;
  if (sim?.shafts) {
    const id = seasonOf(sim).id;
    const base = id === 'SUM' ? 0.48 : id === 'SPR' ? 0.16 : id === 'AUT' ? 0.08 : 0.07;
    const beams = Math.max(1, sim.glade?.gaps?.length || 4);
    sim.shafts.k = GRID >= 32 ? 0 : base * Math.sqrt(4 / beams);
  }
}

function paintLook() {
  const look = shownLook();
  document.querySelector('#look-pixels').value = String(LOOK.pixels);
  document.querySelector('#look-dots').value = String(Math.round(look.dots * 100));
  document.querySelector('#look-ink').value = String(Math.round(look.ink * 100));
  document.querySelector('#look-grain').value = String(Math.round(look.grain * 100));
  document.querySelector('#look-pixels-out').textContent = `${LOOK.pixels}×`;
  document.querySelector('#look-dots-out').textContent = String(Math.round(look.dots * 100));
  document.querySelector('#look-ink-out').textContent = String(Math.round(look.ink * 100));
  document.querySelector('#look-grain-out').textContent = String(Math.round(look.grain * 100));
  document.querySelector('#look-fidelity').value = String(LOOK.fidelity);
  document.querySelector('#look-fidelity-out').textContent = `${LOOK.fidelity}×`;
  for (const button of document.querySelectorAll('#look-panel [data-pattern]')) {
    button.setAttribute('aria-pressed', String(button.dataset.pattern === look.pattern));
  }
}

function readLook() {
  LOOK.hand = true;
  LOOK.pixels = clampLook(Number(document.querySelector('#look-pixels').value), 1, 12);
  LOOK.dots = clampLook(Number(document.querySelector('#look-dots').value) / 100, 0, 1);
  LOOK.ink = clampLook(Number(document.querySelector('#look-ink').value) / 100, 0, 0.4);
  LOOK.grain = clampLook(Number(document.querySelector('#look-grain').value) / 100, 0, 1);
  applyLook();
  saveLook();
  document.querySelector('#look-pixels-out').textContent = `${LOOK.pixels}×`;
  document.querySelector('#look-dots-out').textContent = String(Math.round(LOOK.dots * 100));
  document.querySelector('#look-ink-out').textContent = String(Math.round(LOOK.ink * 100));
  document.querySelector('#look-grain-out').textContent = String(Math.round(LOOK.grain * 100));
  document.querySelector('#look-fidelity-out').textContent = `${document.querySelector('#look-fidelity').value}×`;
}

function resetLook() {
  const rebake = LOOK.fidelity !== 1;
  LOOK.pixels = 3;
  LOOK.dots = 0.62;
  LOOK.ink = 0.05;
  LOOK.grain = 0.45;
  LOOK.pattern = 'bayer';
  LOOK.fidelity = 1;
  LOOK.hand = false;
  if (rebake) {
    saveLook();
    location.reload();
    return;
  }
  applyLook();
  try { localStorage.removeItem(LOOK_KEY); } catch { /* the original is already on screen */ }
  paintLook();
}

function sceneSeed() {
  try {
    if (sessionStorage.getItem('hugelkultur-fresh') !== '1') {
      const kept = readForest();
      if (kept?.seed) {
        sessionStorage.setItem(SCENE_KEY, String(kept.seed));
        return kept.seed >>> 0;
      }
    }
    const saved = Number(sessionStorage.getItem(SCENE_KEY));
    if (Number.isFinite(saved) && saved > 0) return saved >>> 0;
  } catch { /* a fresh forest is fine */ }
  const seed = (Math.random() * 0xffffffff) >>> 0 || 1;
  try { sessionStorage.setItem(SCENE_KEY, String(seed)); } catch { /* this visit still keeps the seed in memory */ }
  return seed;
}

function beginAgain() {
  try {
    sessionStorage.setItem('hugelkultur-fresh', '1');
    sessionStorage.removeItem(SCENE_KEY);
  } catch { /* reload still starts something */ }
  clearForest();
  location.reload();
}

function sameWood() {
  try { sessionStorage.setItem('hugelkultur-fresh', '1'); } catch { /* the seed can stay */ }
  clearForest();
  location.reload();
}

function artSize() {
  const scale = LOOK.pixels;
  let width = Math.max(120, Math.round(window.innerWidth / scale));
  let height = Math.max(90, Math.round(window.innerHeight / scale));
  const over = Math.max(width / 1600, height / 1000, 1);
  return { width: Math.round(width / over), height: Math.round(height / over) };
}

let floodDrone = null;
let riverDrone = null;
let dronePitch = 0;
let toneBurst = 0;

function ensureAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  audioCtx ??= new Context();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playPhrase(freqs, dur, kind, volume) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const step = dur / Math.max(1, freqs.length);
  freqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = kind;
    const start = now + index * step * 0.72;
    osc.frequency.setValueAtTime(freq, start);
    const next = freqs[index + 1] || freq * 0.92;
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, next), start + step);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.linearRampToValueAtTime(0.001, start + step + 0.04);
    osc.start(start);
    osc.stop(start + step + 0.06);
  });
}

function tone(type) {
  if (!audioEnabled || toneBurst > 6) return;
  if (!ensureAudio()) return;
  toneBurst += 1;
  const notes = {
    place: { freqs: [220, 146], dur: 0.08, kind: 'triangle', volume: 0.06 },
    maple: { freqs: [146, 196], dur: 0.09, kind: 'triangle', volume: 0.06 },
    oak: { freqs: [98, 130], dur: 0.14, kind: 'triangle', volume: 0.07 },
    birch: { freqs: [220, 294], dur: 0.08, kind: 'sine', volume: 0.055 },
    willow: { freqs: [164, 220], dur: 0.12, kind: 'triangle', volume: 0.06 },
    alder: { freqs: [130, 164], dur: 0.12, kind: 'sine', volume: 0.06 },
    take: { freqs: [330, 220], dur: 0.07, kind: 'sine', volume: 0.05 },
    shake: { freqs: [180, 320], dur: 0.1, kind: 'triangle', volume: 0.055 },
    berm: { freqs: [196, 247, 294], dur: 0.42, kind: 'sine', volume: 0.05 },
    flood: { freqs: [166, 117], dur: 0.36, kind: 'sawtooth', volume: 0.07 },
    eat: { freqs: [440, 660], dur: 0.12, kind: 'sine', volume: 0.05 },
    plant: { freqs: [392, 523], dur: 0.16, kind: 'sine', volume: 0.05 },
    year: { freqs: [262, 392], dur: 0.28, kind: 'sine', volume: 0.055 },
    circle: { freqs: [262, 330, 392], dur: 0.7, kind: 'sine', volume: 0.045 },
    open: { freqs: [392, 330, 262], dur: 0.55, kind: 'sine', volume: 0.03 }
  };
  const row = notes[type] || notes.place;
  try {
    playPhrase(row.freqs, row.dur, row.kind, row.volume);
  } catch {
    /* a missed note is not a freeze */
  }
}

function stopDrone() {
  if (!floodDrone) {
    dronePitch = 0;
    return;
  }
  try {
    if (audioCtx) {
      const now = audioCtx.currentTime;
      floodDrone.gain.gain.cancelScheduledValues(now);
      floodDrone.gain.gain.setValueAtTime(0.0001, now);
      floodDrone.osc.stop(now + 0.05);
    }
  } catch {
    /* already stopped */
  }
  floodDrone = null;
  dronePitch = 0;
}

function stopRiverVoice() {
  if (!riverDrone) return;
  try {
    riverDrone.source.stop();
  } catch {
    /* already stopped */
  }
  riverDrone = null;
}

function riverVoice(sim) {
  if (!audioEnabled || !sim?.cells) {
    stopRiverVoice();
    return;
  }
  const ctx = ensureAudio();
  if (!ctx) return;
  let depth = 0;
  let iced = false;
  for (const cell of sim.cells) {
    if (!cell.outlet) continue;
    if (cell.ice) {
      iced = true;
      break;
    }
    depth += sim.snapshot?.sample?.(cell.x, cell.z)?.depth || 0;
  }
  const target = iced ? 0 : Math.min(0.015, depth * 0.012);
  const now = ctx.currentTime;
  if (!riverDrone && target > 0.0005) {
    const size = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    riverDrone = { source, gain };
    gain.gain.setTargetAtTime(target, now, 0.12);
    return;
  }
  if (riverDrone) {
    riverDrone.gain.gain.setTargetAtTime(target, now, 0.15);
    if (target < 0.0001) stopRiverVoice();
  }
}

function keepDrone(stage) {
  if (!audioEnabled) {
    stopDrone();
    return;
  }
  const pitch = { hem: 46, drinks: 58, under: 72 }[stage] || 0;
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  try {
    if (!pitch) {
      if (!floodDrone || dronePitch === 0) return;
      floodDrone.gain.gain.cancelScheduledValues(now);
      floodDrone.gain.gain.setTargetAtTime(0.0001, now, 0.08);
      dronePitch = 0;
      return;
    }
    if (!floodDrone) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = pitch;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      floodDrone = { osc, gain };
      gain.gain.setTargetAtTime(0.018, now, 0.05);
      dronePitch = pitch;
      return;
    }
    if (dronePitch === pitch) return;
    floodDrone.osc.frequency.cancelScheduledValues(now);
    floodDrone.osc.frequency.setTargetAtTime(pitch, now, 0.28);
    floodDrone.gain.gain.cancelScheduledValues(now);
    floodDrone.gain.gain.setTargetAtTime(0.018, now, 0.08);
    dronePitch = pitch;
  } catch {
    stopDrone();
  }
}

function say(text) {
  ticker.textContent = text;
}

function drainEvents() {
  if (!sim?.events) return;
  if (sim.events.length > 48) sim.events.splice(0, sim.events.length - 48);
  let line = null;
  let answer = null;
  const voiced = new Set(['year', 'season', 'flood', 'stone', 'fall', 'rot', 'plant', 'sow', 'fern', 'glade', 'nut', 'squirrel', 'ground', 'circle', 'eat', 'idol']);
  for (const event of sim.events) {
    const kept = !sim.fast || voiced.has(event.type);
    if (event.text && kept) {
      if (event.type === 'plant' || event.type === 'sow') answer = event.text;
      else if (!sim.sow) line = event.text;
    }
    if (event.type === 'circle') {
      if (String(event.text).includes('holds')) tone('circle');
      else if (String(event.text).includes('opens')) tone('open');
    }
    const musical = ['place', 'take', 'shake', 'berm', 'flood', 'eat', 'plant', 'year', 'oak', 'birch', 'willow', 'alder', 'maple'].includes(event.type);
    if (musical && (!sim.fast || event.type === 'year' || event.type === 'flood')) tone(event.type);
    if (event.type === 'season' && !LOOK.hand) paintLook();
  }
  const linger = 2.2 * Math.max(1, sim.speed || 1);
  if (answer) {
    say(answer);
    sim.holdLine = sim.time + linger;
  } else if (line && !(sim.holdLine > sim.time)) {
    say(line);
    if (sim.fast) sim.holdLine = sim.time + linger;
  }
  sim.events.length = 0;
}

function paintHud() {
  const season = seasonOf(sim);
  seasonPip.style.background = season.pip;
  seasonLabel.textContent = `${season.id} · Y${sim.year} · ${season.edge} · ${dayPart(sim.time)}`;
  const veil = document.querySelector('#night');
  const dark = nightAmount(sim.time);
  const era = eraOf(sim);
  const lookCell = sim.lookFocus ? cellAt(sim.cells, sim.lookFocus.x, sim.lookFocus.z) : null;
  const roofDark = lookCell?.roofed ? 0.08 : 0;
  const veilCap = (era === 'undercroft' || era === 'keep' ? 0.92 : 0.85) + roofDark;
  if (veil) veil.style.opacity = (Math.min(0.94, dark * veilCap + roofDark)).toFixed(3);
  document.body.classList.toggle('night', dark > 0.45);
  const carry = sim.carrying ? 'stick' : sim.held || 'empty';
  const carryNames = { empty: 'nothing', stick: 'a stick', carrot: 'a carrot', turnip: 'a turnip', mushroom: 'a mushroom' };
  const carryKey = carryNames[carry] ? carry : 'empty';
  for (const icon of carryLabel.querySelectorAll('svg')) {
    const on = icon.dataset.carry === carryKey;
    icon.classList.toggle('on', on);
    icon.style.display = on ? 'block' : 'none';
  }
  carryLabel.setAttribute('aria-label', carryNames[carryKey]);
  const paceLabel = document.querySelector('#pace-label');
  const paceRule = document.querySelector('#pace-rule');
  const quick = sim.haste > 0;
  paceLabel.classList.toggle('on', quick);
  paceRule.classList.toggle('on', quick);
  document.querySelector('#spirit-label').textContent = spiritById(sim.spiritId).name;
  paintFlora(false);
  paintSpirits(false);
  const stage = sim.over ? 'under' : idolStage(idolDepth(sim));
  keepDrone(sim.over ? 'under' : stage);
  riverVoice(sim);
  const damp = stage === 'dry' && clearingDepth(sim) > 0.045;
  hearthLabel.textContent = idolLabel(stage);
  hearthLabel.title = damp ? 'Water is in the ring.' : '';
  hearthLabel.classList.toggle('wet', stage === 'drinks' || stage === 'under');
  hearthLabel.classList.toggle('damp', stage === 'hem' || damp);
  if (sim.carrying) {
    const label = woodOf(sim.carryKind).label;
    carryLabel.title = label;
    carryLabel.setAttribute('aria-label', `a ${label} stick`);
  } else carryLabel.title = '';
  paintMeasures();
  paintKeep(false);
  if (!sim.over) return;
  const breach = sim.endCause === 'breach';
  const eyebrow = document.querySelector('#end-eyebrow');
  const title = document.querySelector('#end-title');
  if (eyebrow) eyebrow.textContent = endBrow(sim.chronicle, sim.endCause);
  if (title) title.textContent = sim.chronicle?.fire ? 'Fire opened the way' : (breach ? 'Water found a hole' : 'Water climbed the pedestal');
  const endLine = document.querySelector('#end-line');
  if (endLine) endLine.textContent = breach
    ? 'The keep held high. The wall did not.'
    : 'The land stays. Keep the idol dry.';
  const lines = sim.years?.length ? sim.years : (sim.yearLine ? [sim.yearLine] : []);
  document.querySelector('#end-years').textContent = String(sim.year);
  const cubes = sim.cells.reduce((sum, cell) => sum + (cell.cubes || 0), 0);
  const cubeNode = document.querySelector('#end-cubes');
  const gateNode = document.querySelector('#end-gates');
  if (cubeNode) cubeNode.textContent = String(cubes);
  const gates = Number.isFinite(sim.gates) ? sim.gates : lines.filter(line => line.includes('gate')).length;
  if (gateNode) gateNode.textContent = String(gates);
  const rooms = roomsOf(sim.cells, HEARTH_I, HEARTH_K).length;
  const rivers = Number.isFinite(sim.outletsEver)
    ? sim.outletsEver
    : sim.cells.filter(cell => cell.outlet).length;
  const visitors = Object.values(sim.visited || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const roomNode = document.querySelector('#end-rooms');
  const riverNode = document.querySelector('#end-rivers');
  const visitNode = document.querySelector('#end-visitors');
  if (roomNode) roomNode.textContent = String(rooms);
  if (riverNode) riverNode.textContent = String(rivers);
  if (visitNode) visitNode.textContent = String(visitors);
  const list = document.querySelector('#end-lines');
  if (list && list.childElementCount !== Math.min(8, lines.length)) {
    list.replaceChildren(...lines.slice(-8).map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }
  const read = document.querySelector('#end-read');
  if (read) {
    const last = lines.slice(-3);
    if (read.childElementCount !== last.length || [...read.children].some((item, i) => item.textContent !== last[i])) {
      read.replaceChildren(...last.map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
    }
  }
  end.hidden = false;
}

function keepBand(cell) {
  const h = wallHeight(cell) + (cell.land || 0) * 0.4;
  if (h >= 2.2) return '#3a342c';
  if (h >= 1.4) return '#5c5346';
  if (h >= 0.7) return '#7a6e5c';
  if ((cell.sill || 0) <= -0.3 || cell.race || cell.river || cell.outlet) return '#6a9bb0';
  if (cell.worn > 0.6 || cell.paved) return '#cbb99a';
  return '#d9d0bf';
}

function paintKeep(force) {
  const panel = document.querySelector('#keep');
  if (!panel || panel.hidden || !sim) return;
  const map = document.querySelector('#keep-map');
  if (!map) return;
  const size = Math.max(160, Math.min(map.clientWidth || 320, map.clientHeight || 320));
  const px = Math.max(2, Math.floor(size / GRID));
  const dim = px * GRID;
  if (map.width !== dim || map.height !== dim) {
    map.width = dim;
    map.height = dim;
  }
  const ctx = map.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, dim, dim);
  for (const cell of sim.cells) {
    ctx.fillStyle = keepBand(cell);
    ctx.fillRect(cell.i * px, cell.k * px, px, px);
    if (cell.outlet || cell.race) {
      ctx.fillStyle = 'rgba(70, 130, 160, 0.7)';
      ctx.fillRect(cell.i * px, cell.k * px, px, px);
    }
    if (cell.store) {
      ctx.fillStyle = '#8a5a28';
      ctx.fillRect(cell.i * px + px * 0.2, cell.k * px + px * 0.2, px * 0.6, px * 0.6);
    }
    if (cell.hearth) {
      ctx.fillStyle = '#c45c3e';
      ctx.fillRect(cell.i * px + px * 0.15, cell.k * px + px * 0.15, px * 0.7, px * 0.7);
    }
  }
  const rooms = roomsOf(sim.cells, HEARTH_I, HEARTH_K);
  ctx.strokeStyle = 'rgba(37, 38, 41, 0.45)';
  ctx.lineWidth = Math.max(1, px * 0.12);
  ctx.font = `${Math.max(8, Math.floor(px * 0.7))}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(37, 38, 41, 0.72)';
  for (const room of rooms) {
    let minI = GRID;
    let minK = GRID;
    let maxI = 0;
    let maxK = 0;
    for (const cell of room.cells) {
      minI = Math.min(minI, cell.i);
      minK = Math.min(minK, cell.k);
      maxI = Math.max(maxI, cell.i);
      maxK = Math.max(maxK, cell.k);
    }
    ctx.strokeRect(minI * px + 0.5, minK * px + 0.5, (maxI - minI + 1) * px - 1, (maxK - minK + 1) * px - 1);
    if (px >= 8) {
      ctx.fillText(room.name, minI * px + 2, minK * px + Math.max(9, px));
    }
  }
  ctx.setLineDash([Math.max(2, px * 0.35), Math.max(2, px * 0.28)]);
  ctx.strokeStyle = 'rgba(90, 62, 46, 0.7)';
  for (const room of sim.plan?.rooms || []) {
    if (room.closed) continue;
    ctx.strokeRect(room.i0 * px + 0.5, room.k0 * px + 0.5, (room.i1 - room.i0 + 1) * px - 1, (room.k1 - room.k0 + 1) * px - 1);
  }
  ctx.setLineDash([]);
  const era = eraOf(sim);
  const eraNode = document.querySelector('#keep-era');
  if (eraNode) eraNode.textContent = era.charAt(0).toUpperCase() + era.slice(1);
  const roomLine = document.querySelector('#keep-rooms');
  if (roomLine) {
    roomLine.textContent = rooms.length
      ? rooms.map(room => room.name).join(' · ')
      : 'No rooms yet.';
  }
  const storeLine = document.querySelector('#keep-store');
  if (storeLine) {
    const n = sim.store?.sticks?.length || 0;
    const seeds = Object.values(sim.seeds || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
    const pyres = sim.cells.filter(cell => (cell.pyre || 0) > 0).length;
    const pyreBit = pyres ? ` · ${pyres} pyre${pyres === 1 ? '' : 's'}` : '';
    storeLine.textContent = n || seeds || pyres
      ? `Chest ${n} · ${seeds} seed${seeds === 1 ? '' : 's'}${pyreBit}`
      : 'The chest is empty.';
  }
  const visitLine = document.querySelector('#keep-visitors');
  if (visitLine) {
    const kinds = Object.entries(sim.visited || {}).filter(([, n]) => n > 0);
    const live = (sim.visitors || []).map(item => item.kind);
    visitLine.textContent = live.length
      ? `Now: ${live.join(', ')}`
      : kinds.length
        ? kinds.map(([kind, n]) => `${kind} ${n}`).join(' · ')
        : 'No visitors this year.';
  }
  const nicheList = document.querySelector('#keep-niches');
  if (nicheList && (force || nicheList.dataset.count !== String((sim.niches || []).length))) {
    const rows = (sim.niches || []).slice(-8).reverse();
    nicheList.dataset.count = String((sim.niches || []).length);
    nicheList.replaceChildren(...rows.map(niche => {
      const item = document.createElement('li');
      item.textContent = `Y${niche.year} · ${niche.title || niche.kind || 'kept'}`;
      return item;
    }));
  }
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
  for (const cell of sim.cells) {
    if (!cell.berm && !cell.cubes) continue;
    consider('mound', `${cell.i},${cell.k}`, [cell.x, walkHeight(cell), cell.z], 0.46);
  }
  sim.loose.forEach((stick, index) => {
    if (stick.fall) return;
    const cell = cellAt(sim.cells, stick.x, stick.z);
    const y = (cell ? walkHeight(cell) : 0.4) + 0.1;
    consider('stick', String(index), [stick.x, y, stick.z], 0.32);
  });
  (sim.niches || []).forEach((niche, index) => {
    const cell = sim.cells[niche.k * GRID + niche.i];
    if (!cell) return;
    consider('niche', String(index), [cell.x, walkHeight(cell) + 0.14, cell.z], 0.34);
  });
  return best;
}

function pickGround(clientX, clientY) {
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
  if (Math.abs(dir[1]) < 1e-4) return null;
  const t = (0.9 - origin[1]) / dir[1];
  if (t < 0) return null;
  return cellAt(sim.cells, origin[0] + dir[0] * t, origin[2] + dir[2] * t);
}

function gazeOf(subject) {
  if (!subject) return null;
  if (subject.kind === 'her') return cellAt(sim.cells, sim.character.st.x, sim.character.st.z);
  if (subject.kind === 'idol') return sim.hearth;
  if (subject.kind === 'mound') return sim.cells.find(cell => `${cell.i},${cell.k}` === subject.id) || null;
  if (subject.kind === 'crop') return sim.plots.find(item => item.id === subject.id)?.cell || null;
  return null;
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
  if (kind === 'mound') {
    const cell = sim.cells.find(item => `${item.i},${item.k}` === id);
    if (!cell) return null;
    return [cell.x, cell.elevation + 0.55, cell.z];
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
  if (kind === 'mound') return 5.4;
  return 4.8;
}

function clampDist(value) {
  const far = Math.max(40, homeDist() * 1.15);
  return Math.min(far, Math.max(0.36, value));
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

function cannotWork(cell) {
  if (!cell) return 'The cube ends.';
  if (cell.hearth) return 'The idol is there.';
  if (cell.plot) return 'That is a bed.';
  if (cell.log) return 'A trunk lies there.';
  if (cell.rock) return 'The stone is set.';
  if (cell.tree && !cell.berm) return 'A tree stands there.';
  if (buried(cell)) return 'Snow covers the stick.';
  if (cell.berm && (cell.lift || 0) >= liftCap(sim.year)) return 'The mound is tall.';
  if (!cell.berm && (cell.layers || 0) >= 5) return 'The stack is full.';
  return '';
}

function sendHer(cell) {
  if (!cell || !sim) return;
  shooSquirrel(sim, cell);
  shoo(sim, cell);
  const why = cannotWork(cell);
  if (why) {
    say(why);
    sim.errand = null;
    return;
  }
  sim.errand = { i: cell.i, k: cell.k, until: sim.time + 24 };
  sim.wantStick = null;
  const watch = `You watch the ${compassName(cell.i, cell.k, sim.hearth?.i ?? 8, sim.hearth?.k ?? 8)}.`;
  const story = cell.story?.length ? moundLine(cell) : '';
  const ground = groundLine(cell.cubes || 0);
  const extra = [story, ground].filter(Boolean).join(' ');
  say(extra ? `${watch} ${extra}` : watch);
}

function focusSubject(hit, frame) {
  if (hit.kind === 'stick') {
    const index = Number(hit.id);
    const stick = sim.loose[index];
    if (!stick) return;
    sim.wantStick = index;
    sim.errand = null;
    say(`You want the ${woodOf(stick.kind || 'maple').label} stick.`);
    return;
  }
  const same = focus && focus.kind === hit.kind && focus.id === hit.id;
  if (same && !frame) return;
  focus = { kind: hit.kind, id: hit.id };
  if (hit.kind === 'mound') {
    const cell = sim.cells.find(item => `${item.i},${item.k}` === hit.id);
    if (cell) sendHer(cell);
  } else if (hit.kind === 'crop') {
    const plot = sim.plots.find(item => item.id === hit.id);
    if (plot?.growth >= 1) {
      say('You watch the bed.');
      sim.guide.goal = { kind: 'eat', id: plot.id, x: plot.x, z: plot.z };
    } else say('The bed is not ready.');
  } else if (hit.kind === 'niche') {
    const niche = (sim.niches || [])[Number(hit.id)];
    say(niche?.title || 'A year is in the wall.');
  } else if (hit.kind === 'idol') say('You watch the idol.');
  else if (hit.kind === 'her') say('You watch her.');
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
  distTo = homeDist();
  settle = { yaw: MOUTH_YAW[seasonOf(sim).edge] ?? ISO_YAW, pitch: ISO_PITCH };
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
  canvas.classList.toggle('hot', !orbit && !pinch && hovering && !sim?.sow);
  canvas.classList.toggle('sowing', Boolean(sim?.sow) && !orbit && !pinch);
}

function aim(dt) {
  let goal = subjectPoint();
  if (!goal) {
    focus = null;
    gaze.x = GOAL.x;
    gaze.y = GOAL.y;
    gaze.z = GOAL.z;
    distTo = homeDist();
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
  const zoomingOut = distTo > dist + 0.04 || dist > homeDist() + 2;
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
  toneBurst = 0;
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  try {
    applyLook();
    if (sim) sim.viewYaw = yaw;
    aim(dt);
    if (sim) sim.lookFocus = { x: look.x, z: look.z };
    let step = dt;
    if (focus) {
      sim.attention = (sim.attention || 0) + dt;
      sim.gazeCell = gazeOf(focus);
      if (sim.attention > 0.55) {
        if (!sim.watched) {
          sim.watched = true;
          sim.events.push({ type: 'note', text: 'You watched.' });
        }
        step *= 0.64;
      }
    } else {
      sim.attention = 0;
      sim.watched = false;
      sim.gazeCell = null;
    }
    const rate = Math.min(1000, Math.max(1, sim.speed || 1));
    sim.fast = rate >= 8;
    const driving = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].some(code => keys.has(code));
    if (driving && !sim.walking) {
      sim.walking = true;
      sim.events.push({ type: 'note', text: 'You walk.' });
    } else if (!driving && sim.walking) {
      sim.walking = false;
      sim.events.push({ type: 'note', text: 'She goes on.' });
    }
    if (!sim.over) {
      let budget = step * rate;
      let hops = 0;
      const hopCap = Math.min(128, Math.max(16, Math.ceil(budget / 0.4) + 2));
      while (budget > 0.0001 && hops < hopCap && !sim.over) {
        const bit = Math.min(0.4, budget);
        updateDay(sim, bit, driving);
        const auto = steer(sim, bit, driving);
        const input = driving ? movement(keys, yaw) : (auto || { move: 0, mz: 0 });
        let paced = sim.haste > 0 ? { ...input, move: (input.move || 0) * sim.pace, mz: (input.mz || 0) * sim.pace } : { ...input };
        if (sim.carrying && sim.carryKind === 'oak') {
          paced.move = (paced.move || 0) * 0.92;
          paced.mz = (paced.mz || 0) * 0.92;
        }
        sim.character.update(bit, paced, sim.time);
        updateSticks(sim, bit);
        updateGrowth(sim, bit);
        updateGardens(sim, bit, driving);
        updateWeather(sim, bit);
        updateMotions(sim, bit);
        updateSigns(sim, bit);
        updateVisitors(sim, bit);
        updateStress(sim, bit);
        updateWater(sim, bit);
        const stand = cellAt(sim.cells, sim.character.st.x, sim.character.st.z);
        if (stand && !stand.hearth) stand.worn = Math.min(2, (stand.worn || 0) + bit * 0.08);
        sim.stage.update(bit, sim.time);
        sim.time += bit;
        budget -= bit;
        hops += 1;
      }
      if (sim.time - (sim.savedAt || 0) > Math.max(5, rate * 2)) {
        sim.savedAt = sim.time;
        writeForest(sim, forestSeed);
      }
    } else {
      sim.stage.update(dt, sim.time);
      if (driving) {
        const input = movement(keys, yaw);
        sim.character.update(dt, input, sim.time);
        sim.time += dt;
      }
    }
  } catch (error) {
    if (sim?.events) sim.events.length = 0;
    say(error instanceof Error ? error.message : String(error));
  }
  try {
    drainEvents();
    paintHud();
  } catch (error) {
    say(error instanceof Error ? error.message : String(error));
  }
  try {
    const size = artSize();
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
  }
  try {
    renderSpecimen(dt);
    renderSpirit(dt);
  } catch {
    /* the library can wait */
  }
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
  const order = { tree: 0, crop: 1, weather: 2, shrub: 3, plant: 4, motion: -1 };
  const plants = FLORA.map(item => {
    const planted = trees.get(item.id) || 0;
    const crop = crops.get(item.id);
    let state = item.group === 'weather' ? 'On the cube' : 'Not sown';
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
  paintStudies();
}
paintFlora.at = -1;

function paintStudies() {
  const tabs = document.querySelector('#specimen-tabs');
  const line = document.querySelector('#specimen-study');
  if (!tabs || !line) return;
  const studies = studiesFor(specimenId);
  if (studies.length < 2) {
    tabs.replaceChildren();
    tabs.hidden = true;
    line.textContent = specimenBroken || '';
    line.classList.toggle('broken', Boolean(specimenBroken));
    return;
  }
  tabs.hidden = false;
  const same = tabs.childElementCount === studies.length
    && [...tabs.children].every((button, index) => button.dataset.take === studies[index].id);
  if (!same) {
    tabs.replaceChildren(...studies.map(study => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'study-tab';
      button.role = 'tab';
      button.dataset.take = study.id;
      button.textContent = study.name;
      button.addEventListener('click', () => showStudy(study.id));
      return button;
    }));
  }
  for (const button of tabs.children) {
    const on = button.dataset.take === specimenTake;
    button.setAttribute('aria-selected', String(on));
    button.tabIndex = on ? 0 : -1;
  }
  if (specimenBroken) {
    line.textContent = specimenBroken;
    line.classList.add('broken');
    return;
  }
  line.classList.remove('broken');
  const study = studies.find(item => item.id === specimenTake) || studies[0];
  line.textContent = study.line;
}

function showStudy(take) {
  specimenTakes.set(specimenId, take);
  showSpecimen(specimenId, take);
}

function showSpecimen(id, take) {
  if (id !== specimenId) specimenYaw = Math.PI / 4;
  specimenId = id;
  const studies = studiesFor(id);
  const wanted = take || specimenTakes.get(id) || cubeTake(id);
  specimenTake = studies.some(item => item.id === wanted) ? wanted : (studies[0]?.id || cubeTake(id));
  const kit = { makeBuilder, makeSculpt, KIT, PixelLook };
  const motion = MOTIONS.some(item => item.id === id);
  try {
    specimenView = motion ? buildMotion(kit, id) : buildSpecimen(kit, id, specimenTake);
    const view = document.querySelector('#specimen');
    specimenRenderer ??= createRenderer(view, { toolkit: { KIT, PixelLook } });
    specimenBroken = '';
  } catch (error) {
    specimenView = null;
    specimenBroken = error instanceof Error ? error.message : String(error);
  }
  paintFlora(true);
  const sow = document.querySelector('#sow');
  const flora = floraById(id);
  if (sow) {
    sow.hidden = !flora || flora.group === 'weather';
    const bank = flora?.group === 'crop' ? (sim?.seeds?.[id] || 0) : null;
    if (flora?.group === 'crop' && !bank) sow.textContent = 'No seed kept.';
    else sow.textContent = flora && sim?.sow?.id === id ? 'Click the ground' : 'Plant this';
  }
  document.querySelector(`#flora-list button[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function stepStudy(dir) {
  const studies = studiesFor(specimenId);
  if (studies.length < 2) return;
  const at = Math.max(0, studies.findIndex(item => item.id === specimenTake));
  const next = studies[(at + dir + studies.length) % studies.length];
  showStudy(next.id);
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
    const home = sim.measures?.[item.id]?.home;
    const fits = home === seasonOf(sim).id;
    const word = { SPR: 'spring', SUM: 'summer', AUT: 'autumn', WIN: 'winter' }[home] || '';
    button.querySelector('.state').textContent = wearing ? (fits ? 'wearing · fits' : 'wearing') : (fits ? 'fits' : word);
    button.setAttribute('aria-current', wearing ? 'true' : 'false');
    button.closest('li').classList.toggle('living', wearing);
  }
  const current = spiritById(sim.spiritId);
  document.querySelector('#spirit-group').textContent = current.group;
  document.querySelector('#spirit-name').textContent = current.name;
  document.querySelector('#spirit-note').textContent = current.note;
  const home = sim.measures?.[current.id]?.home;
  document.querySelector('#spirit-state').textContent = fitLine(current.voice, seasonOf(sim).id, home);
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
  const row = sim.measures?.[id];
  if (changed && row) say(fitLine(spiritById(id).voice, seasonOf(sim).id, row.home));
  if (god) syncGod();
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

function paintMeasures() {
  const panel = document.querySelector('#measures');
  if (!panel || !sim?.measures) return;
  const libraryOpen = !document.querySelector('#flora').hidden
    || !document.querySelector('#spirits').hidden
    || !document.querySelector('#keep')?.hidden;
  panel.hidden = libraryOpen;
  const row = wornMeasures(sim);
  const season = seasonOf(sim);
  const JOB = {
    cloud: 'keeps the gate',
    water: 'wades the mouth',
    tree: 'shakes the wood',
    mushroom: 'eats what is ripe',
    moss: 'knits the mound',
    fire: 'dries the stack',
    snow: 'finds what winter buried'
  };
  const name = spiritById(sim.spiritId).name;
  const seasonWord = { SPR: 'spring', SUM: 'summer', AUT: 'autumn', WIN: 'winter' }[season.id] || 'the year';
  const edge = EDGE_NAME[season.edge] || 'north';
  document.querySelector('#fit-line').textContent = row.home === season.id
    ? `${name} ${JOB[sim.spiritId] || 'keeps the idol'}.`
    : `${name} looks ${edge}. ${seasonWord[0].toUpperCase()}${seasonWord.slice(1)} asks more.`;
  const line = document.querySelector('#measure-line');
  line.hidden = true;
  const era = eraOf(sim);
  const press = pressureOf(sim.year, sim.measures.climb, era);
  const ring = sim.holding ? 'the circle holds' : 'the circle is open';
  const fitsNow = Object.entries(sim.measures)
    .filter(([, value]) => value && value.home === season.id)
    .map(([id]) => id);
  const wearingFits = fitsNow.includes(sim.spiritId);
  const otherName = !wearingFits && fitsNow[0] ? spiritById(fitsNow[0]).name : '';
  const hint = sim.yearLine || (otherName ? `${otherName} fits ${seasonWord}.` : 'Keep the idol dry.');
  const planted = sim.trees.filter(tree => tree.planted && !tree.fallen).length;
  const sown = planted ? `  ·  ${planted}\u00a0planted` : '';
  const rate = Math.round(sim.speed || 1);
  const clock = rate > 1 ? `×${rate}  ·  ` : '';
  const eraWord = era === 'glade' ? '' : `  ·  ${era}`;
  const storeN = sim.store?.sticks?.length || 0;
  const store = storeN ? `  ·  store ${storeN}` : '';
  document.querySelector('#run-line').textContent = `${clock}water ×${press.toFixed(2)}  ·  ${ring}${eraWord}${store}${sown}  ·  ${hint}`;
  if (!document.querySelector('#god-panel').hidden) syncGod();
}

const SPEED_MIN = 1;
const SPEED_MAX = 1000;
const SPEED_LOG_MIN = Math.log(SPEED_MIN);
const SPEED_LOG_MAX = Math.log(SPEED_MAX);
const SPEED_SLIDER_MAX = 1000;

function clampSpeed(value) {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(Number(value) || SPEED_MIN)));
}

function speedFromSlider(pos) {
  const t = Math.min(1, Math.max(0, Number(pos) / SPEED_SLIDER_MAX));
  return clampSpeed(Math.exp(SPEED_LOG_MIN + t * (SPEED_LOG_MAX - SPEED_LOG_MIN)));
}

function sliderFromSpeed(speed) {
  const value = clampSpeed(speed);
  const t = (Math.log(value) - SPEED_LOG_MIN) / (SPEED_LOG_MAX - SPEED_LOG_MIN);
  return Math.round(Math.min(1, Math.max(0, t)) * SPEED_SLIDER_MAX);
}

function applySpeed(next, { from } = {}) {
  const value = clampSpeed(next);
  sim.speed = value;
  sim.fast = value >= 8;
  try { sessionStorage.setItem('hugelkultur-speed', String(value)); } catch { /* this run still hurries */ }
  const slider = document.querySelector('#god-panel input[data-speed="slider"]');
  const number = document.querySelector('#god-panel input[data-speed="number"]');
  if (slider && document.activeElement !== slider && from !== 'slider') slider.value = String(sliderFromSpeed(value));
  if (number && document.activeElement !== number && from !== 'number') number.value = String(value);
  paintMeasures();
  return value;
}

function syncGod() {
  if (!sim?.measures) return;
  const row = wornMeasures(sim);
  const speed = clampSpeed(sim.speed || 1);
  const speedSlider = document.querySelector('#god-panel input[data-speed="slider"]');
  const speedNumber = document.querySelector('#god-panel input[data-speed="number"]');
  if (speedSlider && document.activeElement !== speedSlider) speedSlider.value = String(sliderFromSpeed(speed));
  if (speedNumber && document.activeElement !== speedNumber) speedNumber.value = String(speed);
  for (const input of document.querySelectorAll('#god-panel input[data-key][type="range"]')) {
    if (document.activeElement === input) continue;
    const value = input.dataset.key === 'climb'
      ? Math.round(sim.measures.climb * 100)
      : Math.round((row[input.dataset.key] || 0) * 100);
    input.value = String(value);
    const number = input.parentElement.querySelector('input[type="number"]');
    if (number && document.activeElement !== number) {
      number.value = input.dataset.key === 'climb' ? sim.measures.climb.toFixed(2) : String(value);
    }
  }
  for (const button of document.querySelectorAll('#god-homes button')) {
    button.setAttribute('aria-pressed', String(button.dataset.home === row.home));
  }
}

function tipName(text, tip) {
  const name = document.createElement('span');
  name.className = 'tip';
  name.tabIndex = 0;
  name.textContent = text;
  name.dataset.tip = tip;
  name.setAttribute('aria-label', `${text}. ${tip}`);
  return name;
}

function measureNumber(key, value) {
  const number = document.createElement('input');
  number.type = 'number';
  number.dataset.key = key;
  number.dataset.role = 'value';
  if (key === 'climb') {
    number.min = '0';
    number.max = '0.8';
    number.step = '0.01';
    number.value = Number(value).toFixed(2);
  } else {
    number.min = '0';
    number.max = '100';
    number.step = '1';
    number.value = String(Math.round(Number(value) || 0));
  }
  return number;
}

function buildGod() {
  const root = document.querySelector('#god-panel');
  if (!root || root.childElementCount) return;
  const speed = document.createElement('label');
  speed.className = 'god-speed';
  const speedNumber = document.createElement('input');
  speedNumber.type = 'number';
  speedNumber.min = String(SPEED_MIN);
  speedNumber.max = String(SPEED_MAX);
  speedNumber.step = '1';
  speedNumber.dataset.speed = 'number';
  speedNumber.setAttribute('aria-label', 'Speed multiplier');
  const speedInput = document.createElement('input');
  speedInput.type = 'range';
  speedInput.min = '0';
  speedInput.max = String(SPEED_SLIDER_MAX);
  speedInput.step = '1';
  speedInput.dataset.speed = 'slider';
  speedInput.setAttribute('aria-label', 'Speed, logarithmic');
  const startSpeed = clampSpeed(sim?.speed || 1);
  speedNumber.value = String(startSpeed);
  speedInput.value = String(sliderFromSpeed(startSpeed));
  speedInput.addEventListener('input', () => {
    applySpeed(speedFromSlider(speedInput.value), { from: 'slider' });
    speedNumber.value = String(sim.speed);
  });
  const commitSpeedNumber = () => {
    applySpeed(speedNumber.value, { from: 'number' });
    speedNumber.value = String(sim.speed);
    speedInput.value = String(sliderFromSpeed(sim.speed));
  };
  speedNumber.addEventListener('change', commitSpeedNumber);
  speedNumber.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitSpeedNumber();
      speedNumber.blur();
    }
  });
  speed.append(tipName('Speed', GOD_TIPS.speed), speedNumber, speedInput);
  root.append(speed);
  for (const [key, label, tip] of MEASURE_KEYS) {
    const wrap = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.dataset.key = key;
    const number = measureNumber(key, Math.round((wornMeasures(sim)?.[key] || 0) * 100));
    const setMeasure = value => {
      const next = Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
      sim.measures[sim.spiritId][key] = next / 100;
      input.value = String(next);
      number.value = String(next);
      saveMeasures(sim.measures);
      paintMeasures();
    };
    input.addEventListener('input', () => setMeasure(input.value));
    number.addEventListener('change', () => setMeasure(number.value));
    number.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        setMeasure(number.value);
        number.blur();
      }
    });
    wrap.append(tipName(label, tip), number, input);
    root.append(wrap);
  }
  const homes = document.createElement('div');
  homes.className = 'look-patterns';
  homes.id = 'god-homes';
  homes.title = GOD_TIPS.home;
  for (const id of ['SPR', 'SUM', 'AUT', 'WIN']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.home = id;
    button.textContent = SEASON_NAME[id];
    button.title = GOD_TIPS.home;
    button.addEventListener('click', () => {
      sim.measures[sim.spiritId].home = id;
      saveMeasures(sim.measures);
      syncGod();
      paintMeasures();
      paintSpirits(true);
      say(fitLine(sim.voice, seasonOf(sim).id, id));
    });
    homes.append(button);
  }
  const climb = document.createElement('label');
  const climbInput = document.createElement('input');
  climbInput.type = 'range';
  climbInput.min = '0';
  climbInput.max = '80';
  climbInput.step = '1';
  climbInput.dataset.key = 'climb';
  const climbNumber = measureNumber('climb', sim?.measures?.climb || 0);
  const setClimb = value => {
    const raw = Number(value);
    const next = Math.min(0.8, Math.max(0, Number.isFinite(raw) ? raw : 0));
    const asPercent = Number(value) > 1 ? Math.min(80, Math.max(0, Math.round(Number(value)))) / 100 : next;
    sim.measures.climb = Math.min(0.8, Math.max(0, asPercent));
    climbInput.value = String(Math.round(sim.measures.climb * 100));
    climbNumber.value = sim.measures.climb.toFixed(2);
    saveMeasures(sim.measures);
    paintMeasures();
  };
  climbInput.addEventListener('input', () => {
    sim.measures.climb = Number(climbInput.value) / 100;
    climbNumber.value = sim.measures.climb.toFixed(2);
    saveMeasures(sim.measures);
    paintMeasures();
  });
  climbNumber.addEventListener('change', () => setClimb(climbNumber.value));
  climbNumber.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setClimb(climbNumber.value);
      climbNumber.blur();
    }
  });
  climb.append(tipName('Climb', GOD_TIPS.climb), climbNumber, climbInput);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.id = 'god-reset';
  reset.textContent = 'Original measures';
  reset.title = GOD_TIPS.reset;
  reset.addEventListener('click', () => {
    sim.measures = blankMeasures();
    saveMeasures(sim.measures);
    syncGod();
    paintMeasures();
  });
  const same = document.createElement('button');
  same.type = 'button';
  same.id = 'god-same';
  same.textContent = 'Same wood';
  same.title = GOD_TIPS.same;
  same.addEventListener('click', sameWood);
  root.append(homes, climb, reset, same);
}

function setGod(open) {
  god = open;
  const panel = document.querySelector('#god-panel');
  const button = document.querySelector('#god-toggle');
  if (!panel || !button) return;
  panel.hidden = !open;
  button.setAttribute('aria-pressed', String(open));
  button.textContent = open ? 'Done' : 'Bend';
  document.querySelector('#measures')?.classList.toggle('bending', open);
  if (open) syncGod();
}

const GRID_KEY = 'hugelkultur-grid';

function savedGrid() {
  try {
    const grid = Number(sessionStorage.getItem(GRID_KEY));
    if (grid === 32 || grid === 64) return grid;
  } catch { /* the small clearing remains */ }
  return 16;
}

function boot() {
  useGrid(savedGrid());
  dist = homeDist();
  distTo = dist;
  forestSeed = sceneSeed();
  const fresh = sessionStorage.getItem('hugelkultur-fresh') === '1';
  if (fresh) sessionStorage.removeItem('hugelkultur-fresh');
  bakedFidelity = LOOK.fidelity;
  setScene({ seed: forestSeed, fidelity: LOOK.fidelity, grid: GRID });
  const kit = { makeBuilder, makeSculpt, KIT, PixelLook };
  sim = buildWorld(kit, { createFrame: createStickSystem, createAvatar, drawGrowth, createWater });
  sim.measures = loadMeasures();
  try {
    const savedSpeed = Number(sessionStorage.getItem('hugelkultur-speed'));
    if (savedSpeed >= 1 && savedSpeed <= 1000) sim.speed = savedSpeed;
  } catch { /* the year keeps its own pace */ }
  const saved = fresh ? null : readForest();
  if (saved && saved.seed === forestSeed) {
    applyForest(sim, saved);
    if (sim.pendingSpirit && sim.pendingSpirit !== sim.spiritId) wearSpirit(sim, sim.pendingSpirit);
    catchUp(sim, Date.now() - (saved.at || Date.now()));
  }
  seedSquirrels(sim);
  revealGlade(sim);
  markMouth(sim);
  renderer = createRenderer(canvas, { toolkit: { KIT, PixelLook } });
  buildGod();
  applyLook();
  paintLook();
  for (const button of document.querySelectorAll('.sizes button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.grid) === GRID));
  }
  say('Keep the idol dry.');
  if (!sim.taught && (sim.year || 1) === 1 && (sim.seasonIndex || 0) === 0) {
    sim.taught = true;
    const edge = EDGE_NAME[seasonOf(sim).edge] || 'north';
    sim.events.push({ type: 'season', text: `Spring comes from the ${edge}. The mouth is marked.` });
  }
  paintHud();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', event => {
  if (event.target.closest?.('input, textarea, select')) return;
  if (event.repeat || !sim) return;
  if (event.code === 'KeyG') {
    event.preventDefault();
    setGod(!god);
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (sim.held) sim.eatQueued = true;
    else sim.placeQueued = true;
  } else if (!floraPanel.hidden && (event.code === 'BracketLeft' || event.code === 'BracketRight')) {
    event.preventDefault();
    stepStudy(event.code === 'BracketRight' ? 1 : -1);
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
    ox: event.clientX,
    oy: event.clientY,
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
  const travel = Math.hypot(x - orbit.ox, y - orbit.oy);
  const sowing = Boolean(sim?.sow) && mode === 'orbit' && travel < 28;
  orbit = null;
  if (moved && (pitch < 0.08 || pitch > 1.45)) {
    settle = { yaw, pitch: Math.min(1.45, Math.max(0.08, pitch)) };
  }
  paintCursor();
  if (sowing) {
    const ground = pickGround(x, y);
    if (ground) plantAt(sim, ground);
    else sim.events.push({ type: 'sow', text: 'That is not ground.' });
    paintCursor();
    return;
  }
  if (moved || mode !== 'orbit' || !sim) return;
  const hit = pick(x, y);
  if (hit) focusSubject(hit, false);
  else {
    const ground = pickGround(x, y);
    if (ground) sendHer(ground);
  }
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
document.querySelector('#restart').addEventListener('click', beginAgain);
for (const button of document.querySelectorAll('.sizes button')) {
  button.addEventListener('click', () => {
    const next = Number(button.dataset.grid);
    if (next === GRID) return;
    try { sessionStorage.setItem(GRID_KEY, String(next)); } catch { /* this clearing stays */ }
    location.reload();
  });
}
document.querySelector('#end-restart').addEventListener('click', beginAgain);
document.querySelector('#end-same')?.addEventListener('click', sameWood);
document.querySelector('#god-toggle')?.addEventListener('click', () => setGod(!god));
document.querySelector('#sow')?.addEventListener('click', () => {
  const item = floraById(specimenId);
  if (!item || !sim) return;
  sim.sow = { id: item.id };
  say(item.group === 'crop' ? 'Click a finished mound.' : 'Click the ground.');
  setLibrary(null);
  paintCursor();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sim) writeForest(sim, forestSeed);
});
window.addEventListener('pagehide', () => {
  if (sim) writeForest(sim, forestSeed);
});
document.querySelector('#sound').addEventListener('click', event => {
  audioEnabled = !audioEnabled;
  event.currentTarget.setAttribute('aria-pressed', String(audioEnabled));
  if (!audioEnabled) stopDrone();
});

const floraToggle = document.querySelector('#flora-toggle');
const floraPanel = document.querySelector('#flora');
const spiritToggle = document.querySelector('#spirit-toggle');
const spiritPanel = document.querySelector('#spirits');
const keepToggle = document.querySelector('#keep-toggle');
const keepPanel = document.querySelector('#keep');

function setLibrary(which) {
  const floraOpen = which === 'flora';
  const spiritOpen = which === 'spirit';
  const keepOpen = which === 'keep';
  floraPanel.hidden = !floraOpen;
  spiritPanel.hidden = !spiritOpen;
  if (keepPanel) keepPanel.hidden = !keepOpen;
  floraToggle.setAttribute('aria-expanded', String(floraOpen));
  spiritToggle.setAttribute('aria-expanded', String(spiritOpen));
  keepToggle?.setAttribute('aria-expanded', String(keepOpen));
  if (floraOpen) {
    paintFlora(true);
    if (!specimenView) showSpecimen(specimenId);
  }
  if (spiritOpen) {
    ensureSpirit(sim.spiritId);
    paintSpirits(true);
  }
  if (keepOpen) paintKeep(true);
  paintMeasures();
}

const lookToggle = document.querySelector('#look-toggle');
const lookPanel = document.querySelector('#look-panel');
const logToggle = document.querySelector('#log-toggle');
const logPanel = document.querySelector('#log-panel');
let featureScores = loadScores();
let logFilter = 'all';

function dotsRow(id, kind, value) {
  const track = document.createElement('div');
  track.className = 'log-track';
  const label = document.createElement('span');
  label.textContent = kind === 'feel' ? 'Feel' : 'Look';
  const dots = document.createElement('div');
  dots.className = 'log-dots';
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', `${kind} score`);
  for (let n = 1; n <= 5; n++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'log-dot' + (n <= value ? ' on' : '');
    dot.dataset.id = id;
    dot.dataset.kind = kind;
    dot.dataset.value = String(n);
    dot.title = `${kind} ${n} of 5`;
    dot.setAttribute('aria-pressed', String(n <= value));
    dots.append(dot);
  }
  track.append(label, dots);
  return track;
}

function paintLog() {
  if (!logPanel) return;
  const summary = scoreSummary(featureScores, logFilter === 'soft' ? 'all' : logFilter);
  const summaryNode = document.querySelector('#log-summary');
  if (summaryNode) {
    const feel = summary.rated ? summary.feel.toFixed(1) : '—';
    const look = summary.rated ? summary.look.toFixed(1) : '—';
    summaryNode.textContent = summary.rated
      ? `Feel ${feel} · Look ${look} · ${summary.rated}/${summary.total} scored · ${summary.soft} soft`
      : `${summary.total} features. Nothing scored yet.`;
  }
  for (const button of logPanel.querySelectorAll('[data-log]')) {
    button.setAttribute('aria-pressed', String(button.dataset.log === logFilter));
  }
  const list = document.querySelector('#log-list');
  if (!list) return;
  const rows = FEATURES.filter(item => {
    if (logFilter === 'fifty' || logFilter === 'keep') return item.list === logFilter;
    if (logFilter === 'soft') {
      const s = scoreOf(featureScores, item.id);
      return !s.feel || !s.look || s.feel < 4 || s.look < 4;
    }
    return true;
  });
  const frag = document.createDocumentFragment();
  let section = '';
  for (const item of rows) {
    const headKey = `${item.list}:${item.section}`;
    if (headKey !== section) {
      section = headKey;
      const h = document.createElement('p');
      h.className = 'log-section';
      h.textContent = `${item.list === 'keep' ? 'Keep' : 'Fifty'} · ${item.section}`;
      frag.append(h);
    }
    const score = scoreOf(featureScores, item.id);
    const soft = !score.feel || !score.look || score.feel < 4 || score.look < 4;
    const row = document.createElement('article');
    row.className = 'log-item' + (soft ? ' soft' : '');
    row.dataset.id = item.id;
    const head = document.createElement('div');
    head.className = 'log-item-head';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(item.n).padStart(2, '0');
    const title = document.createElement('span');
    title.className = 'tip log-tip';
    title.tabIndex = 0;
    title.textContent = item.title;
    title.dataset.tip = item.tip || item.title;
    title.setAttribute('aria-label', `${item.title}. ${item.tip || ''}`);
    head.append(num, title);
    row.append(head, dotsRow(item.id, 'feel', score.feel), dotsRow(item.id, 'look', score.look));
    frag.append(row);
  }
  list.replaceChildren(frag);
}

loadLook();
paintLook();
paintLog();
lookToggle.addEventListener('click', () => {
  const open = lookPanel.hidden;
  lookPanel.hidden = !open;
  lookToggle.setAttribute('aria-expanded', String(open));
  if (open && logPanel && !logPanel.hidden) {
    logPanel.hidden = true;
    logToggle?.setAttribute('aria-expanded', 'false');
  }
});
logToggle?.addEventListener('click', () => {
  if (!logPanel) return;
  const open = logPanel.hidden;
  logPanel.hidden = !open;
  logToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    if (!lookPanel.hidden) {
      lookPanel.hidden = true;
      lookToggle.setAttribute('aria-expanded', 'false');
    }
    paintLog();
  }
});
logPanel?.addEventListener('click', event => {
  const filter = event.target.closest?.('[data-log]');
  if (filter) {
    logFilter = filter.dataset.log;
    paintLog();
    return;
  }
  const dot = event.target.closest?.('.log-dot');
  if (!dot) return;
  const id = dot.dataset.id;
  const kind = dot.dataset.kind;
  const value = Number(dot.dataset.value);
  const current = scoreOf(featureScores, id)[kind];
  featureScores = setScore(featureScores, id, kind, current === value ? 0 : value);
  saveScores(featureScores);
  paintLog();
});
for (const input of lookPanel.querySelectorAll('input')) input.addEventListener('input', readLook);
document.querySelector('#look-fidelity').addEventListener('change', () => {
  const next = clampLook(Math.round(Number(document.querySelector('#look-fidelity').value)), 1, 4);
  LOOK.fidelity = next;
  saveLook();
  if (next !== bakedFidelity) location.reload();
});
const hintBar = document.querySelector('#hint-bar');
try {
  if (localStorage.getItem(HINT_KEY) === 'closed') hintBar.hidden = true;
} catch { /* the bar can still be closed this visit */ }
document.querySelector('#hint-close').addEventListener('click', () => {
  hintBar.hidden = true;
  try { localStorage.setItem(HINT_KEY, 'closed'); } catch { /* it is already gone */ }
});
for (const button of lookPanel.querySelectorAll('[data-pattern]')) {
  button.addEventListener('click', () => {
    LOOK.hand = true;
    LOOK.pattern = button.dataset.pattern;
    applyLook();
    saveLook();
    paintLook();
  });
}
document.querySelector('#look-reset').addEventListener('click', resetLook);

floraToggle.addEventListener('click', () => setLibrary(floraPanel.hidden ? 'flora' : null));
spiritToggle.addEventListener('click', () => setLibrary(spiritPanel.hidden ? 'spirit' : null));
keepToggle?.addEventListener('click', () => setLibrary(keepPanel?.hidden ? 'keep' : null));
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
  if (sim?.sow) {
    sim.sow = null;
    say('You put the seed back.');
    paintCursor();
    return;
  }
  if (god) {
    setGod(false);
    return;
  }
  if (!lookPanel.hidden) {
    lookPanel.hidden = true;
    lookToggle.setAttribute('aria-expanded', 'false');
    return;
  }
  if (logPanel && !logPanel.hidden) {
    logPanel.hidden = true;
    logToggle?.setAttribute('aria-expanded', 'false');
    return;
  }
  if (!floraPanel.hidden || !spiritPanel.hidden || (keepPanel && !keepPanel.hidden)) setLibrary(null);
});

requestAnimationFrame(() => requestAnimationFrame(() => {
  try {
    boot();
  } catch (error) {
    say(error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}));
