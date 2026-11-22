// Luz del mundo (etapa 15), de 0 a 15 en cada celda, de dos clases:
//
// - Del cielo: baja derecho por las columnas abiertas (15 a cielo abierto,
//   de día o de noche: cuánto ilumina eso lo decide la hora en el shader) y
//   se desparrama perdiendo 1 por bloque, así entra un poco en las cuevas y
//   bajo los techos.
// - De los bloques: antorchas, lámparas y faroles; se desparrama igual.
//
// Se calcula al armar la malla de cada chunk, con los 9 chunks de alrededor
// (la "región" de 48 x 48): una luz de 15 llega a lo sumo a 15 bloques, así
// que lo que está fuera de la región no alcanza al chunk del medio ni a su
// borde. Corre en los workers y en el hilo principal (sin DOM ni Three.js).

import { BLOCKS, MAX_BLOCK_IDS, LAYER } from './blocks.js';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk.js';

/** Lado de la región (3 chunks) y tamaños. */
export const REGION_W = CHUNK_SIZE * 3;
const REGION_AREA = REGION_W * REGION_W;
export const REGION_SIZE = REGION_AREA * CHUNK_HEIGHT;

/** Copia con borde de un bloque del chunk del medio (como la del mallado). */
const PAD_W = CHUNK_SIZE + 2;
const PAD_AREA = PAD_W * PAD_W;
const PAD_H = CHUNK_HEIGHT + 2;
export const PAD_LIGHT_SIZE = PAD_AREA * PAD_H;

/** Luz máxima. */
export const MAX_LIGHT = 15;

/** Bloques que no dejan pasar la luz (los cubos opacos). */
export const BLOCKS_LIGHT = new Uint8Array(MAX_BLOCK_IDS);
/**
 * Cuánto más pierde la luz al pasar: el follaje la apaga un poco (sombra
 * en el bosque). El agua no: si no, el fondo del mar se vería negro.
 */
const FILTER = new Uint8Array(MAX_BLOCK_IDS);
/** Luz que da cada bloque (0: ninguna). */
export const EMIT = new Uint8Array(MAX_BLOCK_IDS);
for (const block of BLOCKS) {
  if (!block) continue;
  BLOCKS_LIGHT[block.id] = block.opaque ? 1 : 0;
  FILTER[block.id] = block.leaves || block.sound === 'leaves' ? 1 : 0;
  // Lo que brilla solo (faroles, lámparas prendidas) da luz plena.
  EMIT[block.id] = block.light ?? (block.layer === LAYER.GLOW ? MAX_LIGHT : 0);
}

/** ¿Cambiar el bloque `a` por `b` cambia la luz de alrededor? */
export function changesLight(a, b) {
  return BLOCKS_LIGHT[a] !== BLOCKS_LIGHT[b] || EMIT[a] !== EMIT[b] || FILTER[a] !== FILTER[b];
}

/**
 * Copia los 9 chunks de alrededor de (cx, cz) en `out` (de REGION_SIZE),
 * hasta la altura `top` (lo de arriba no se usa). Los que faltan, aire.
 * @param {(dx: number, dz: number) => Uint16Array | undefined} chunkData
 * @param {number} top altura del bloque más alto de los 9 chunks
 * @param {Uint16Array} out
 */
export function fillRegion(chunkData, top, out) {
  const h = Math.min(CHUNK_HEIGHT, top + 1);
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const data = chunkData(dx, dz);
      const ox = (dx + 1) * CHUNK_SIZE;
      const oz = (dz + 1) * CHUNK_SIZE;
      for (let y = 0; y < h; y++) {
        const base = y * REGION_AREA + ox;
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const o = base + (oz + z) * REGION_W;
          if (!data) {
            out.fill(0, o, o + CHUNK_SIZE);
            continue;
          }
          const src = (y << 8) + (z << 4);
          for (let x = 0; x < CHUNK_SIZE; x++) out[o + x] = data[src + x];
        }
      }
    }
  }
  return out;
}

// Arrays de trabajo (cada hilo calcula de a una región).
const sky = new Uint8Array(REGION_SIZE);
const blk = new Uint8Array(REGION_SIZE);
const QUEUE_SIZE = 1 << 20;
const QUEUE_MASK = QUEUE_SIZE - 1;
const queue = new Int32Array(QUEUE_SIZE);

/**
 * Desparrama la luz de `light` desde lo que está en la cola, perdiendo 1
 * por bloque (y lo que filtre cada uno). Hasta la altura `h` (sin incluir).
 */
function spread(region, light, head, tail, h) {
  const maxIndex = REGION_AREA * h;
  while (head !== tail) {
    const i = queue[head];
    head = (head + 1) & QUEUE_MASK;
    const v = light[i] - 1;
    if (v <= 0) continue;
    const y = (i / REGION_AREA) | 0;
    const rem = i - y * REGION_AREA;
    const z = (rem / REGION_W) | 0;
    const x = rem - z * REGION_W;
    for (let k = 0; k < 6; k++) {
      let n;
      if (k === 0) {
        if (x === 0) continue;
        n = i - 1;
      } else if (k === 1) {
        if (x === REGION_W - 1) continue;
        n = i + 1;
      } else if (k === 2) {
        if (z === 0) continue;
        n = i - REGION_W;
      } else if (k === 3) {
        if (z === REGION_W - 1) continue;
        n = i + REGION_W;
      } else if (k === 4) {
        if (y === 0) continue;
        n = i - REGION_AREA;
      } else {
        n = i + REGION_AREA;
        if (n >= maxIndex) continue;
      }
      const id = region[n];
      if (BLOCKS_LIGHT[id]) continue;
      const nv = v - FILTER[id];
      if (nv > light[n]) {
        light[n] = nv;
        queue[tail] = n;
        tail = (tail + 1) & QUEUE_MASK;
      }
    }
  }
}

/**
 * Calcula la luz de la región y la deja para el chunk del medio y su borde
 * (con el mismo orden que la copia con borde del mallado).
 * @param {Uint16Array} region bloques (ver fillRegion)
 * @param {number} top altura del bloque más alto de los 9 chunks
 * @param {Uint8Array} padSky luz del cielo (de PAD_LIGHT_SIZE)
 * @param {Uint8Array} padBlock luz de los bloques (de PAD_LIGHT_SIZE)
 */
export function computeLight(region, top, padSky, padBlock) {
  // Una capa de aire por encima de todo, para que la luz se meta de costado.
  const h = Math.min(CHUNK_HEIGHT, top + 2);
  const size = REGION_AREA * h;
  sky.fill(0, 0, size);
  blk.fill(0, 0, size);

  // Cielo: baja por cada columna hasta el primer bloque que la tapa.
  for (let c = 0; c < REGION_AREA; c++) {
    let l = MAX_LIGHT;
    for (let i = c + REGION_AREA * (h - 1); i >= 0; i -= REGION_AREA) {
      const id = region[i];
      if (BLOCKS_LIGHT[id]) break;
      l -= FILTER[id];
      if (l <= 0) break;
      sky[i] = l;
    }
  }
  // Se desparrama desde las celdas con luz que tienen al lado una más oscura.
  let tail = 0;
  for (let i = 0; i < size; i++) {
    const v = sky[i];
    if (v <= 1) continue;
    const y = (i / REGION_AREA) | 0;
    const rem = i - y * REGION_AREA;
    const z = (rem / REGION_W) | 0;
    const x = rem - z * REGION_W;
    const darker = (n) => sky[n] < v - 1 && !BLOCKS_LIGHT[region[n]];
    if (
      (x > 0 && darker(i - 1)) ||
      (x < REGION_W - 1 && darker(i + 1)) ||
      (z > 0 && darker(i - REGION_W)) ||
      (z < REGION_W - 1 && darker(i + REGION_W)) ||
      (y > 0 && darker(i - REGION_AREA))
    ) {
      queue[tail] = i;
      tail = (tail + 1) & QUEUE_MASK;
    }
  }
  spread(region, sky, 0, tail, h);

  // Bloques que brillan.
  tail = 0;
  for (let i = 0; i < size; i++) {
    const e = EMIT[region[i]];
    if (!e) continue;
    blk[i] = e;
    queue[tail] = i;
    tail = (tail + 1) & QUEUE_MASK;
  }
  if (tail) spread(region, blk, 0, tail, h);

  // Copia para el chunk del medio y su borde (y de -1 a 128).
  const off = CHUNK_SIZE - 1; // x = -1 del chunk del medio en la región
  for (let py = 0; py < PAD_H; py++) {
    const y = py - 1;
    const o = py * PAD_AREA;
    if (y < 0) {
      padSky.fill(0, o, o + PAD_AREA);
      padBlock.fill(0, o, o + PAD_AREA);
      continue;
    }
    if (y >= h) {
      padSky.fill(MAX_LIGHT, o, o + PAD_AREA);
      padBlock.fill(0, o, o + PAD_AREA);
      continue;
    }
    for (let pz = 0; pz < PAD_W; pz++) {
      const src = y * REGION_AREA + (off + pz) * REGION_W + off;
      const dst = o + pz * PAD_W;
      for (let px = 0; px < PAD_W; px++) {
        padSky[dst + px] = sky[src + px];
        padBlock[dst + px] = blk[src + px];
      }
    }
  }
}

/**
 * Copia con borde de los bloques del chunk del medio (la que usa el
 * mallado), sacada de la región.
 * @param {Uint16Array} region
 * @param {number} top altura del bloque más alto de los 9 chunks
 * @param {Uint16Array} out de PAD_LIGHT_SIZE
 * @param {number} solidBelow bloque debajo del mundo (y = -1)
 */
export function padFromRegion(region, top, out, solidBelow) {
  out.fill(solidBelow, 0, PAD_AREA);
  out.fill(0, PAD_AREA);
  const h = Math.min(CHUNK_HEIGHT, top + 1);
  const off = CHUNK_SIZE - 1;
  for (let y = 0; y < h; y++) {
    const o = (y + 1) * PAD_AREA;
    for (let pz = 0; pz < PAD_W; pz++) {
      const src = y * REGION_AREA + (off + pz) * REGION_W + off;
      const dst = o + pz * PAD_W;
      for (let px = 0; px < PAD_W; px++) out[dst + px] = region[src + px];
    }
  }
  return out;
}

/**
 * Luz de las celdas del chunk del medio, para preguntarla después (los
 * personajes, la mano): cielo en los 4 bits de arriba y bloques en los de
 * abajo, con el orden de los datos del chunk.
 * @param {Uint8Array} padSky
 * @param {Uint8Array} padBlock
 * @param {Uint8Array} out de CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
 */
export function packChunkLight(padSky, padBlock, out) {
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const src = (y + 1) * PAD_AREA + (z + 1) * PAD_W + 1;
      const dst = (y << 8) + (z << 4);
      for (let x = 0; x < CHUNK_SIZE; x++) out[dst + x] = (padSky[src + x] << 4) | padBlock[src + x];
    }
  }
  return out;
}
