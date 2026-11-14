// Geometría de un bloque suelto (para el bloque en la mano), armada con el
// mismo mesher que el mundo: mismas texturas y caras.

import * as THREE from 'three';
import { CHUNK_VOLUME, Chunk } from '../world/Chunk.js';
import { buildChunkMesh } from '../world/Mesher.js';

const cache = new Map();

/**
 * Geometría de 1 x 1 x 1 centrada en el origen, con un grupo por capa de
 * render (se usa con el array de materiales de bloques). Se guarda en caché.
 */
export function getBlockGeometry(id) {
  let geometry = cache.get(id);
  if (geometry) return geometry;
  // El bloque va en y = 1: en y = 0 el mesher no genera la cara de abajo.
  const data = new Uint16Array(CHUNK_VOLUME);
  data[Chunk.index(0, 1, 0)] = id;
  const d = buildChunkMesh(data, {}, 1);
  geometry = new THREE.BufferGeometry();
  if (d) {
    geometry.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(d.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(d.indices, 1));
    for (const g of d.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
    geometry.translate(-0.5, -1.5, -0.5);
    geometry.computeBoundingSphere();
  }
  cache.set(id, geometry);
  return geometry;
}
