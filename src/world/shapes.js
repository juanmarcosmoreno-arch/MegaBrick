// Formas que dependen de los vecinos: los cercos, las rejas y los paneles de
// vidrio se unen con lo que tienen al lado (otro cerco, una tranquera o un
// bloque entero). Un solo ID por cerco: las uniones se calculan al dibujarlo
// (Mesher.js) y al chocar o apuntar (con el mundo, acá).
//
// Las cajas de cada combinación de vecinos (16, una por máscara) se arman
// una sola vez al cargar.

import { BLOCKS, COLLISION_BOXES, MAX_BLOCK_IDS, SHAPE, getBlock, rotateBox } from './blocks.js';

/**
 * Lados en el orden de los bits de la máscara: norte (-Z), este (+X), sur
 * (+Z) y oeste (-X), como FACING.
 */
export const SIDES = Object.freeze([
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]);

/** Grupo con el que se une cada ID: 0 ninguno, 1 cercos (y tranqueras), 2 paneles. */
const GROUP = new Uint8Array(MAX_BLOCK_IDS);
/** Bloques enteros (opacos y sin forma): todo cerco o panel se une con ellos. */
const FULL = new Uint8Array(MAX_BLOCK_IDS);
/** Cajas por ID y máscara (solo los que se unen). */
const SHAPE_BY_MASK = new Array(MAX_BLOCK_IDS).fill(null);
const COLLISION_BY_MASK = new Array(MAX_BLOCK_IDS).fill(null);

/** Cajas de un cerco o panel mirando al norte: el poste y el brazo hacia el norte. */
const PARTS = {
  fence: {
    post: [6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16],
    arm: [
      [7 / 16, 6 / 16, 0, 9 / 16, 9 / 16, 6 / 16],
      [7 / 16, 12 / 16, 0, 9 / 16, 15 / 16, 6 / 16],
    ],
    // Se choca más alto que lo que se ve: no se salta (ni lo saltan los animales).
    collisionPost: [6 / 16, 0, 6 / 16, 10 / 16, 1.5, 10 / 16],
    collisionArm: [[6 / 16, 0, 0, 10 / 16, 1.5, 6 / 16]],
  },
  pane: {
    post: [7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16],
    arm: [[7 / 16, 0, 0, 9 / 16, 1, 7 / 16]],
    collisionPost: [7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16],
    collisionArm: [[7 / 16, 0, 0, 9 / 16, 1, 7 / 16]],
  },
};

function build(parts, mask, collision) {
  const boxes = [Object.freeze(collision ? parts.collisionPost : parts.post)];
  for (let side = 0; side < 4; side++) {
    if (!(mask & (1 << side))) continue;
    for (const b of collision ? parts.collisionArm : parts.arm) boxes.push(rotateBox(b, side));
  }
  return Object.freeze(boxes);
}

for (const block of BLOCKS) {
  if (!block) continue;
  FULL[block.id] = block.opaque && !block.boxes ? 1 : 0;
  if (block.shape === SHAPE.GATE) GROUP[block.id] = 1;
  if (!block.connect) continue;
  GROUP[block.id] = block.connect === 'fence' ? 1 : 2;
  const parts = PARTS[block.connect];
  SHAPE_BY_MASK[block.id] = [];
  COLLISION_BY_MASK[block.id] = [];
  for (let mask = 0; mask < 16; mask++) {
    // Un panel suelto se ve en cruz (si no, sería un palito).
    const shown = block.connect === 'pane' && mask === 0 ? 15 : mask;
    SHAPE_BY_MASK[block.id].push(build(parts, shown, false));
    COLLISION_BY_MASK[block.id].push(build(parts, shown, true));
  }
}

/** ¿El bloque `id` se une con su vecino `n`? (solo para los que se unen) */
export function joins(id, n) {
  return FULL[n] === 1 || (GROUP[n] !== 0 && GROUP[n] === GROUP[id]);
}

/** ¿El bloque se une con sus vecinos? */
export function isConnected(id) {
  return SHAPE_BY_MASK[id] !== null;
}

/** Máscara de uniones a partir de los IDs de los 4 vecinos (norte, este, sur, oeste). */
export function maskOf(id, north, east, south, west) {
  return (joins(id, north) ? 1 : 0) | (joins(id, east) ? 2 : 0) | (joins(id, south) ? 4 : 0) | (joins(id, west) ? 8 : 0);
}

/** Cajas que se ven de un cerco o panel con esa máscara. */
export function connectedBoxes(id, mask) {
  return SHAPE_BY_MASK[id][mask];
}

function maskAt(world, x, y, z, id) {
  let mask = 0;
  for (let side = 0; side < 4; side++) {
    const [dx, dz] = SIDES[side];
    if (joins(id, world.getBlock(x + dx, y, z + dz))) mask |= 1 << side;
  }
  return mask;
}

/**
 * Cajas que se ven y se apuntan del bloque `id` en (x, y, z), o null si es
 * un cubo entero.
 */
export function shapeBoxesAt(world, x, y, z, id) {
  if (SHAPE_BY_MASK[id]) return SHAPE_BY_MASK[id][maskAt(world, x, y, z, id)];
  return getBlock(id).boxes;
}

/** Cajas con las que se choca del bloque `id` en (x, y, z), o null si se atraviesa. */
export function collisionBoxesAt(world, x, y, z, id) {
  if (COLLISION_BY_MASK[id]) return COLLISION_BY_MASK[id][maskAt(world, x, y, z, id)];
  return COLLISION_BOXES[id];
}
