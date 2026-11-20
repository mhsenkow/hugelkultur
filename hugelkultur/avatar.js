import { cellCenter, cellAt } from './world.js';
import { SPIRITS, spiritById } from './avatars.js';

export function createAvatar(B, KIT, sim) {
  const lane = cellCenter(8, 9).z;
  sim.spirits = SPIRITS.map(form => ({
    id: form.id,
    character: KIT.character(B, form.spec(sim), lane)
  }));
  sim.spiritId = 'cloud';
  sim.voice = spiritById('cloud').voice;
  sim.bindSpirits = bindAvatars;
  return sim.spirits[0].character;
}

export function bindAvatars(sim) {
  let at = sim.world.count;
  for (let i = sim.spirits.length - 1; i >= 0; i--) {
    const spirit = sim.spirits[i];
    at -= spirit.character.total;
    spirit.at = at;
    spirit.character.bind(sim.world, at);
  }
  const used = sim.spirits.reduce((sum, spirit) => sum + spirit.character.total, 0);
  if (at < 0 || sim.spirits[0].at + used !== sim.world.count) {
    throw new Error('Spirit roster is not a contiguous tail of the world');
  }
  const worn = sim.spirits.find(spirit => spirit.id === sim.spiritId) || sim.spirits[0];
  sim.spiritId = worn.id;
  sim.voice = spiritById(worn.id).voice;
  sim.character = worn.character;
  sim.avatarAt = worn.at;
  worn.character.st.born = 2;
  worn.character.update(1 / 60, { move: 0, mz: 0 }, 0);
}

function parkSpirit(sim, id) {
  const spirit = sim.spirits.find(item => item.id === id);
  if (!spirit || spirit.at === undefined) return;
  const data = sim.world.data;
  const count = spirit.character.total;
  for (let i = 0; i < count; i++) data[(spirit.at + i) * 16 + 1] = -50;
}

export function wearSpirit(sim, id) {
  const next = sim.spirits.find(item => item.id === id);
  if (!next || next.id === sim.spiritId) return null;
  const from = sim.character.st;
  const to = next.character.st;
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.vx = from.vx;
  to.vy = from.vy;
  to.vz = from.vz;
  to.face = from.face;
  to.dir = from.dir;
  to.yaw = from.yaw;
  to.gh = from.gh;
  to.ground = from.ground;
  to.dfx = from.dfx;
  to.dfz = from.dfz;
  to.ph = 0;
  to.dead = -1;
  to.born = 0;
  parkSpirit(sim, sim.spiritId);
  sim.spiritId = next.id;
  sim.voice = spiritById(next.id).voice;
  sim.character = next.character;
  sim.avatarAt = next.at;
  next.character.update(1 / 60, { move: 0, mz: 0 }, sim.time || 0);
  return next;
}

export function movement(keys, yaw) {
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const right = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  return {
    move: right * rx + forward * fx,
    mz: right * rz + forward * fz,
    run: keys.has('ShiftLeft') || keys.has('ShiftRight')
  };
}

export function facedCell(sim) {
  const st = sim.character.st;
  const x = st.x + Math.cos(st.face) * 0.72;
  const z = st.z + Math.sin(st.face) * 0.72;
  return cellAt(sim.cells, x, z);
}
