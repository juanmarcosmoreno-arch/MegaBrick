// Detección del bloque apuntado: recorrido de vóxeles con el algoritmo DDA
// (Amanatides y Woo). Avanza de bloque en bloque a lo largo del rayo, sin
// saltearse ninguno, hasta encontrar uno que se pueda apuntar o pasarse del
// alcance. Los bloques con forma (losas, escalones, puertas) se apuntan por
// sus cajas: por el hueco de una losa se ve y se apunta lo de atrás.

import { getBlock } from '../world/blocks.js';

/**
 * @param {{getBlock: (x: number, y: number, z: number) => number}} world
 * @param {{x: number, y: number, z: number}} origin punto de partida (ojos)
 * @param {{x: number, y: number, z: number}} dir dirección (normalizada)
 * @param {number} maxDistance alcance en bloques
 * @param {(id: number) => boolean} isTarget qué bloques detienen el rayo
 * @returns {null | {x: number, y: number, z: number, id: number,
 *   normal: [number, number, number], place: [number, number, number],
 *   distance: number, point: [number, number, number]}} el bloque apuntado,
 *   la cara por la que entró el rayo (normal), dónde iría un bloque nuevo
 *   (place) y el punto exacto donde pega (point). normal es [0, 0, 0] si el
 *   origen ya está dentro de un bloque apuntable.
 */
export function raycast(world, origin, dir, maxDistance, isTarget) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(dir.x);
  const stepY = Math.sign(dir.y);
  const stepZ = Math.sign(dir.z);
  // Cuánto avanza t para cruzar un bloque entero en cada eje.
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
  // Valor de t en el que se cruza el próximo borde de bloque en cada eje.
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  while (t <= maxDistance) {
    const id = world.getBlock(x, y, z);
    if (isTarget(id)) {
      const boxes = getBlock(id).boxes;
      const hit = boxes ? hitBoxes(boxes, x, y, z, origin, dir) : { t, normal: [nx, ny, nz] };
      if (hit && hit.t <= maxDistance) {
        const [hx, hy, hz] = hit.normal;
        return {
          x,
          y,
          z,
          id,
          normal: hit.normal,
          place: [x + hx, y + hy, z + hz],
          distance: hit.t,
          point: [origin.x + dir.x * hit.t, origin.y + dir.y * hit.t, origin.z + dir.z * hit.t],
        };
      }
    }
    // Avanzar al bloque vecino por el borde más cercano.
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
  }
  return null;
}

/**
 * La primera caja del bloque (x, y, z) que toca el rayo: distancia y cara
 * por la que entra (método de las placas). null si pasa por un hueco.
 */
function hitBoxes(boxes, x, y, z, origin, dir) {
  const o = [origin.x - x, origin.y - y, origin.z - z];
  const d = [dir.x, dir.y, dir.z];
  let best = null;
  for (const b of boxes) {
    let tNear = -Infinity;
    let tFar = Infinity;
    let axis = -1;
    for (let a = 0; a < 3; a++) {
      if (d[a] === 0) {
        if (o[a] < b[a] || o[a] > b[a + 3]) {
          tNear = Infinity;
          break;
        }
        continue;
      }
      let t0 = (b[a] - o[a]) / d[a];
      let t1 = (b[a + 3] - o[a]) / d[a];
      if (t0 > t1) [t0, t1] = [t1, t0];
      if (t0 > tNear) {
        tNear = t0;
        axis = a;
      }
      tFar = Math.min(tFar, t1);
    }
    if (tNear > tFar || tFar < 0) continue;
    // Con el origen adentro de la caja, sin cara (como en un bloque entero).
    const t = Math.max(0, tNear);
    if (best && t >= best.t) continue;
    const normal = [0, 0, 0];
    if (tNear >= 0 && axis >= 0) normal[axis] = -Math.sign(d[axis]);
    best = { t, normal };
  }
  return best;
}
