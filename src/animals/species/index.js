// Las especies de animales: su modelo (cada archivo de esta carpeta) y cómo
// se comportan. El orden de SPECIES_IDS es el número de especie en la red:
// agregar al final.

import * as carpincho from './carpincho.js';
import * as oveja from './oveja.js';
import * as gallina from './gallina.js';
import * as conejo from './conejo.js';

/**
 * Comportamiento de cada especie:
 * - walk / run: velocidades al pasear y al escaparse (bloques por segundo).
 * - group: cuántos aparecen juntos [mínimo, máximo].
 * - idleTime: cuánto se queda quieto [mínimo, máximo] (segundos).
 * - callEvery: cada cuánto hace su sonido [mínimo, máximo] (segundos).
 * - likesWater: elige pasear por el agua (los demás nadan solo si caen).
 * - weight: qué tan común es.
 */
const KINDS = {
  carpincho: { module: carpincho, walk: 1.1, run: 3.6, group: [2, 4], idleTime: [3, 9], callEvery: [14, 40], likesWater: true, weight: 1 },
  oveja: { module: oveja, walk: 1.2, run: 4, group: [2, 4], idleTime: [2, 6], callEvery: [10, 30], likesWater: false, weight: 1.2 },
  gallina: { module: gallina, walk: 1.3, run: 4.2, group: [2, 4], idleTime: [1, 4], callEvery: [6, 18], likesWater: false, weight: 1 },
  conejo: { module: conejo, walk: 2, run: 5.5, group: [1, 3], idleTime: [1, 5], callEvery: [20, 50], likesWater: false, weight: 0.8 },
};

/** Ids de las especies, en orden (el índice es el número en la red). */
export const SPECIES_IDS = Object.freeze(Object.keys(KINDS));

const kinds = new Map();

/** Datos de una especie: comportamiento, tamaño (de info.size y info.bounds) y modelo. */
export function getKind(id) {
  if (!KINDS[id]) return null;
  if (!kinds.has(id)) {
    const k = KINDS[id];
    kinds.set(id, Object.freeze({ ...k, size: k.module.info.size, bounds: k.module.info.bounds, info: k.module.info }));
  }
  return kinds.get(id);
}

/** Una especie al azar según qué tan comunes son. */
export function randomSpecies() {
  const total = SPECIES_IDS.reduce((sum, id) => sum + KINDS[id].weight, 0);
  let r = Math.random() * total;
  for (const id of SPECIES_IDS) {
    r -= KINDS[id].weight;
    if (r <= 0) return id;
  }
  return SPECIES_IDS[0];
}
