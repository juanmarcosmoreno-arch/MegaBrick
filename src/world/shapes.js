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

/** Grupo con el que se une cada ID: 0 ninguno, 1 cercos (y tranqueras), 2 paneles, 3 cables. */
const GROUP = new Uint8Array(MAX_BLOCK_IDS);
/**
 * Tranqueras: de qué lados se une (bits de la máscara): solo por sus
 * extremos, a lo largo de su eje (una mirando al norte, al este y al oeste).
 */
const GATE_SIDES = new Uint8Array(MAX_BLOCK_IDS);
/**
 * Bloques enteros (cubos sólidos sin forma, también el vidrio y el
 * follaje): todo cerco o panel se une con ellos.
 */
const FULL = new Uint8Array(MAX_BLOCK_IDS);
/** Mecanismos (palancas, lámparas, compuertas...): los cables se unen con ellos. */
const CIRCUIT = new Uint8Array(MAX_BLOCK_IDS);
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
  // Cable: chato sobre el piso; no se choca.
  wire: {
    post: [6 / 16, 0, 6 / 16, 10 / 16, 1 / 16, 10 / 16],
    arm: [[7 / 16, 0, 0, 9 / 16, 1 / 16, 6 / 16]],
    collisionPost: null,
    collisionArm: [],
  },
  pane: {
    post: [7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16],
    arm: [[7 / 16, 0, 0, 9 / 16, 1, 7 / 16]],
    collisionPost: [7 / 16, 0, 7 / 16, 9 / 16, 1, 9 / 16],
    collisionArm: [[7 / 16, 0, 0, 9 / 16, 1, 7 / 16]],
  },
};

function build(parts, mask, collision) {
  if (collision && !parts.collisionPost) return null;
  const boxes = [Object.freeze(collision ? parts.collisionPost : parts.post)];
  for (let side = 0; side < 4; side++) {
    if (!(mask & (1 << side))) continue;
    for (const b of collision ? parts.collisionArm : parts.arm) boxes.push(rotateBox(b, side));
  }
  return Object.freeze(boxes);
}

for (const block of BLOCKS) {
  if (!block) continue;
  FULL[block.id] = block.solid && !block.boxes && !block.connect && !block.liquid ? 1 : 0;
  CIRCUIT[block.id] = block.circuit && block.circuit !== 'wire' ? 1 : 0;
  if (block.shape === SHAPE.GATE) {
    GROUP[block.id] = 1;
    GATE_SIDES[block.id] = block.facing % 2 === 0 ? 2 | 8 : 1 | 4;
  }
  if (!block.connect) continue;
  GROUP[block.id] = { fence: 1, pane: 2, wire: 3 }[block.connect];
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

/**
 * ¿El bloque `id` se une con su vecino `n`, que está del lado `side` (0
 * norte, 1 este, 2 sur, 3 oeste)? (solo para los que se unen)
 */
export function joins(id, n, side) {
  // Un cable, con otros cables y con los mecanismos (no con las paredes).
  if (GROUP[id] === 3) return GROUP[n] === 3 || CIRCUIT[n] === 1;
  if (FULL[n] === 1) return true;
  if (GROUP[n] === 0 || GROUP[n] !== GROUP[id]) return false;
  // A una tranquera, solo por sus extremos: desde el lado opuesto al nuestro.
  return GATE_SIDES[n] === 0 || (GATE_SIDES[n] & (1 << ((side + 2) % 4))) !== 0;
}

/** ¿El bloque se une con sus vecinos? */
export function isConnected(id) {
  return SHAPE_BY_MASK[id] !== null;
}

/** Máscara de uniones a partir de los IDs de los 4 vecinos (norte, este, sur, oeste). */
export function maskOf(id, north, east, south, west) {
  return (joins(id, north, 0) ? 1 : 0) | (joins(id, east, 1) ? 2 : 0) | (joins(id, south, 2) ? 4 : 0) | (joins(id, west, 3) ? 8 : 0);
}

/** Cajas que se ven de un cerco o panel con esa máscara. */
export function connectedBoxes(id, mask) {
  return SHAPE_BY_MASK[id][mask];
}

function maskAt(world, x, y, z, id) {
  let mask = 0;
  for (let side = 0; side < 4; side++) {
    const [dx, dz] = SIDES[side];
    if (joins(id, world.getBlock(x + dx, y, z + dz), side)) mask |= 1 << side;
  }
  return mask;
}

/** Abajo: lo que sostiene a una planta (las plantas no tienen `attach`). */
const DOWN = Object.freeze([0, -1, 0]);

/**
 * Las celdas vecinas de (x, y, z) con algo apoyado en ese bloque (una
 * planta arriba, un cable, una palanca en la pared, la cabeza de un
 * pistón): si ese bloque se va, se caen.
 * @returns {[number, number, number][]}
 */
export function supportedBy(world, x, y, z) {
  const out = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    const n = getBlock(world.getBlock(nx, ny, nz));
    const a = n.attach ?? (n.soil ? DOWN : null);
    if (a && nx + a[0] === x && ny + a[1] === y && nz + a[2] === z) out.push([nx, ny, nz]);
  }
  return out;
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
