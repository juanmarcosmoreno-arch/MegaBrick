// Choques de una caja (el jugador, un animal) contra el mundo: contra los
// bloques sólidos y las cajas de las losas, escalones y puertas.

import { COLLISION_BOXES } from './blocks.js';

/** Margen para que tocarse justo en una cara no cuente como choque. */
const EPS = 1e-6;

const lo = [0, 0, 0];
const hi = [0, 0, 0];
const cell = [0, 0, 0];

/** Arma la caja de alguien con los pies en `p` (centro de la base). */
function setBox(p, halfWidth, height) {
  lo[0] = p.x - halfWidth;
  lo[1] = p.y;
  lo[2] = p.z - halfWidth;
  hi[0] = p.x + halfWidth;
  hi[1] = p.y + height;
  hi[2] = p.z + halfWidth;
}

/** ¿La caja `b` del bloque en `cell` se superpone con la caja armada? */
function overlaps(b) {
  for (let a = 0; a < 3; a++) {
    if (cell[a] + b[a] >= hi[a] - EPS || cell[a] + b[a + 3] <= lo[a] + EPS) return false;
  }
  return true;
}

/**
 * Mueve `p` (los pies) sobre un eje (0 = X, 1 = Y, 2 = Z). Si la caja queda
 * dentro de algo sólido, la pega a la cara más cercana de todo lo que se
 * superpone y devuelve true. Cada paso tiene que ser de menos de un bloque:
 * así lo que se pisa está en la capa del frente del movimiento.
 * @param {{getBlock: (x: number, y: number, z: number) => number}} world
 * @param {{x: number, y: number, z: number, getComponent: Function, setComponent: Function}} p
 */
export function moveAxis(world, p, halfWidth, height, axis, d) {
  p.setComponent(axis, p.getComponent(axis) + d);
  setBox(p, halfWidth, height);
  let hit = false;
  let limit = d > 0 ? Infinity : -Infinity;
  for (let by = Math.floor(lo[1] + EPS); by <= Math.floor(hi[1] - EPS); by++) {
    for (let bz = Math.floor(lo[2] + EPS); bz <= Math.floor(hi[2] - EPS); bz++) {
      for (let bx = Math.floor(lo[0] + EPS); bx <= Math.floor(hi[0] - EPS); bx++) {
        const boxes = COLLISION_BOXES[world.getBlock(bx, by, bz)];
        if (!boxes) continue;
        cell[0] = bx;
        cell[1] = by;
        cell[2] = bz;
        for (const b of boxes) {
          if (!overlaps(b)) continue;
          hit = true;
          limit = d > 0 ? Math.min(limit, cell[axis] + b[axis]) : Math.max(limit, cell[axis] + b[axis + 3]);
        }
      }
    }
  }
  if (!hit) return false;
  if (axis === 0) p.x = d > 0 ? limit - halfWidth : limit + halfWidth;
  else if (axis === 1) p.y = d > 0 ? limit - height : limit;
  else p.z = d > 0 ? limit - halfWidth : limit + halfWidth;
  return true;
}

/** ¿La caja con los pies en `p` se superpone con algo sólido? */
export function overlapsSolid(world, p, halfWidth, height) {
  setBox(p, halfWidth, height);
  for (let by = Math.floor(lo[1] + EPS); by <= Math.floor(hi[1] - EPS); by++) {
    for (let bz = Math.floor(lo[2] + EPS); bz <= Math.floor(hi[2] - EPS); bz++) {
      for (let bx = Math.floor(lo[0] + EPS); bx <= Math.floor(hi[0] - EPS); bx++) {
        const boxes = COLLISION_BOXES[world.getBlock(bx, by, bz)];
        if (!boxes) continue;
        cell[0] = bx;
        cell[1] = by;
        cell[2] = bz;
        if (boxes.some(overlaps)) return true;
      }
    }
  }
  return false;
}
