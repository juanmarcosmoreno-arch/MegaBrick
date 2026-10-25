// Construcción de la malla de un chunk.
//
// Recorre todos los bloques y agrega SOLO las caras que dan a un bloque que
// no las tapa (aire, agua, vidrio, etc.). Las caras ocultas entre dos bloques
// sólidos nunca se generan, lo que reduce muchísimo la cantidad de triángulos.
//
// El resultado es UNA geometría por chunk (arrays tipados) con un grupo por
// capa de render (opaca, recortada y translúcida), sin dependencias de
// Three.js ni del DOM: así este módulo corre en los Web Workers
// (chunkWorker.js) y también en el hilo principal, para rearmar al instante
// el chunk que el jugador acaba de cambiar.
//
// Oclusión ambiental por vértice: cada esquina de cada cara se oscurece según
// cuántos bloques sólidos la rodean (los rincones y la base de las paredes
// quedan en penumbra), y eso se guarda en el color del vértice.
//
// Los bloques con forma (losas, escalones, puertas) se dibujan con sus cajas:
// cada caja con sus 6 caras y la textura recortada a su tamaño (no estirada).

import { BLOCK, BLOCKS, LAYER } from './blocks.js';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './Chunk.js';
import { tileUV } from '../render/atlasLayout.js';

// Altura de la superficie del agua cuando no tiene agua arriba (un poco más
// baja que un bloque entero, para que se note el nivel).
export const WATER_SURFACE = 0.875;

/**
 * Las 6 caras de un cubo. Para cada una: dirección del vecino, normal, la
 * textura que usa (top/side/bottom) y sus 4 esquinas con su UV.
 * El orden de las esquinas da triángulos en sentido antihorario vistos desde
 * afuera (cara frontal en Three.js).
 */
const FACES = [
  {
    // -X (izquierda)
    dir: [-1, 0, 0],
    tile: 'side',
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  {
    // +X (derecha)
    dir: [1, 0, 0],
    tile: 'side',
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  {
    // -Y (abajo)
    dir: [0, -1, 0],
    tile: 'bottom',
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  {
    // +Y (arriba)
    dir: [0, 1, 0],
    tile: 'top',
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  {
    // -Z (atrás)
    dir: [0, 0, -1],
    tile: 'side',
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  {
    // +Z (adelante)
    dir: [0, 0, 1],
    tile: 'side',
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tablas precalculadas (todo en arrays tipados para que el bucle sea rápido)
// ---------------------------------------------------------------------------

const MAX_ID = 256;
/** Propiedades de cada ID de bloque. */
const OPAQUE = new Uint8Array(MAX_ID);
const LAYER_OF = new Int8Array(MAX_ID).fill(-1); // -1 = no se dibuja (aire)
const CULL_SAME = new Uint8Array(MAX_ID);
const LIQUID = new Uint8Array(MAX_ID);
/** Sin oclusión: el agua (se vería manchada) y lo que brilla solo. */
const NO_SHADE = new Uint8Array(MAX_ID);
/** UV de cada cara de cada bloque: [id * 24 + cara * 4 + (u0, v0, u1, v1)]. */
const FACE_UVS = new Float32Array(MAX_ID * 24);
/** Cajas de los bloques con forma (null para los cubos). */
const SHAPE_BOXES = new Array(MAX_ID).fill(null);
for (const block of BLOCKS) {
  if (!block) continue;
  OPAQUE[block.id] = block.opaque ? 1 : 0;
  LAYER_OF[block.id] = block.layer ?? -1;
  CULL_SAME[block.id] = block.cullSame ? 1 : 0;
  LIQUID[block.id] = block.liquid ? 1 : 0;
  NO_SHADE[block.id] = block.liquid || block.layer === LAYER.GLOW ? 1 : 0;
  if (block.boxes) SHAPE_BOXES[block.id] = block.boxes.map((b) => Float32Array.from(b));
  if (!block.tiles) continue;
  FACES.forEach((face, f) => FACE_UVS.set(tileUV(block.tiles[face.tile]), block.id * 24 + f * 4));
}

/** Esquinas de cada cara (0 o 1 en cada eje): [cara * 12 + esquina * 3 + (x, y, z)]. */
const CORNERS = new Uint8Array(6 * 12);
const NORMALS = new Float32Array(6 * 3);
/**
 * Qué eje del bloque va en cada coordenada de la textura de cada cara, y si
 * va al revés: [cara * 4 + (eje de u, u invertida, eje de v, v invertida)].
 * Así la textura de una caja más chica que el bloque se recorta en vez de
 * estirarse (y en las caras de costado del agua baja, también).
 */
const UV_AXES = new Uint8Array(6 * 4);
FACES.forEach((face, f) => {
  NORMALS.set(face.dir, f * 3);
  face.corners.forEach(({ pos }, c) => CORNERS.set(pos, f * 12 + c * 3));
  for (const k of [0, 1]) {
    for (let axis = 0; axis < 3; axis++) {
      if (face.dir[axis] !== 0) continue;
      const same = face.corners.every(({ pos, uv }) => uv[k] === pos[axis]);
      const flipped = face.corners.every(({ pos, uv }) => uv[k] === 1 - pos[axis]);
      if (same || flipped) UV_AXES.set([axis, flipped ? 1 : 0], f * 4 + k * 2);
    }
  }
});

/** Caja de un bloque entero y la del agua sin agua arriba (más baja). */
const FULL_BOX = new Float32Array([0, 0, 0, 1, 1, 1]);

// ---------------------------------------------------------------------------
// Copia del chunk con un borde de un bloque (de los 8 chunks vecinos): así
// los vecinos de cualquier bloque, también para la oclusión, se leen con un
// desplazamiento fijo, sin preguntar de qué chunk son.
// ---------------------------------------------------------------------------

const PAD_W = CHUNK_SIZE + 2; // 18
const PAD_AREA = PAD_W * PAD_W; // 324
const PAD_H = CHUNK_HEIGHT + 2; // y de -1 a 128
/** Tamaño de la copia con borde (bytes). */
export const PADDED_SIZE = PAD_AREA * PAD_H;
/** Copia que usa el mallado en este hilo (buildChunkMesh). */
const padded = new Uint8Array(PADDED_SIZE);
/** Índice en la copia con borde de (x, y, z) locales (de -1 a 16 / 128). */
const padIndex = (x, y, z) => x + 1 + (z + 1) * PAD_W + (y + 1) * PAD_AREA;
/** Desplazamiento en la copia para moverse (dx, dy, dz). */
const padOffset = (dx, dy, dz) => dx + dz * PAD_W + dy * PAD_AREA;

/** Vecino de cada cara, en el orden de FACES. */
const FACE_OFFSET = new Int32Array(FACES.map((f) => padOffset(...f.dir)));

/**
 * Para la oclusión de cada esquina de cada cara: los 3 bloques que la rodean
 * del lado de afuera de la cara (dos de costado y el de la diagonal).
 * [cara * 12 + esquina * 3 + (costado 1, costado 2, diagonal)]
 */
const AO_OFFSETS = new Int32Array(6 * 12);
FACES.forEach((face, f) => {
  const normalAxis = face.dir.findIndex((v) => v !== 0);
  const [a1, a2] = [0, 1, 2].filter((a) => a !== normalAxis);
  face.corners.forEach(({ pos }, c) => {
    const s1 = [0, 0, 0];
    const s2 = [0, 0, 0];
    s1[a1] = pos[a1] === 1 ? 1 : -1;
    s2[a2] = pos[a2] === 1 ? 1 : -1;
    const n = face.dir;
    const side1 = padOffset(n[0] + s1[0], n[1] + s1[1], n[2] + s1[2]);
    const side2 = padOffset(n[0] + s2[0], n[1] + s2[1], n[2] + s2[2]);
    const diag = padOffset(n[0] + s1[0] + s2[0], n[1] + s1[1] + s2[1], n[2] + s1[2] + s2[2]);
    AO_OFFSETS.set([side1, side2, diag], f * 12 + c * 3);
  });
});

/** Brillo según cuántos lados de la esquina están libres (0 = rincón cerrado). */
const AO_LIGHT = new Float32Array([0.5, 0.67, 0.84, 1]);

/**
 * Copia el chunk y el borde de sus vecinos en `out` (lo que falta cuenta
 * como aire). Es lo único que necesita el mallado: el hilo principal arma la
 * copia (es rápido) y se la pasa al worker sin copiar los 9 chunks enteros.
 * @param {Uint8Array} data bloques del chunk
 * @param {object} n vecinos (ver buildChunkMesh)
 * @param {Uint8Array} out de PADDED_SIZE bytes
 */
export function padChunk(data, n, out) {
  out.fill(BLOCK.AIR);
  // Debajo del mundo: sólido (no se ve la cara de abajo de y = 0).
  out.fill(BLOCK.BEDROCK, 0, PAD_AREA);
  const last = CHUNK_SIZE - 1;
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    const yi = y << 8;
    // Fila por fila, a mano: más rápido que crear 16 subarrays por capa.
    let o = padIndex(0, y, 0);
    for (let src = yi; src < yi + 256; src += CHUNK_SIZE, o += PAD_W) {
      for (let x = 0; x < CHUNK_SIZE; x++) out[o + x] = data[src + x];
    }
    for (let i = 0; i < CHUNK_SIZE; i++) {
      if (n.nx) out[padIndex(-1, y, i)] = n.nx[yi + (i << 4) + last];
      if (n.px) out[padIndex(CHUNK_SIZE, y, i)] = n.px[yi + (i << 4)];
      if (n.nz) out[padIndex(i, y, -1)] = n.nz[yi + (last << 4) + i];
      if (n.pz) out[padIndex(i, y, CHUNK_SIZE)] = n.pz[yi + i];
    }
    if (n.nxnz) out[padIndex(-1, y, -1)] = n.nxnz[yi + (last << 4) + last];
    if (n.pxnz) out[padIndex(CHUNK_SIZE, y, -1)] = n.pxnz[yi + (last << 4)];
    if (n.nxpz) out[padIndex(-1, y, CHUNK_SIZE)] = n.nxpz[yi + last];
    if (n.pxpz) out[padIndex(CHUNK_SIZE, y, CHUNK_SIZE)] = n.pxpz[yi];
  }
  return out;
}

/**
 * Buffers que crecen solos y se reutilizan entre chunks (cada hilo tiene los
 * suyos y malla de a un chunk, así que no hay dos chunks usándolos a la vez).
 */
class LayerBuffer {
  constructor() {
    this.positions = new Float32Array(4096 * 3);
    this.normals = new Float32Array(4096 * 3);
    this.uvs = new Float32Array(4096 * 2);
    this.light = new Float32Array(4096); // oclusión de cada vértice
    this.flip = new Uint8Array(1024); // por cara: dividir por la otra diagonal
    this.vertexCount = 0;
  }

  /** Asegura lugar para 4 vértices más (duplica el tamaño si hace falta). */
  reserveQuad() {
    const needed = (this.vertexCount + 4) * 3;
    if (needed <= this.positions.length) return;
    const grow = (a, perVertex) => {
      const b = new a.constructor(Math.max(a.length * 2, (needed / 3) * perVertex));
      b.set(a);
      return b;
    };
    this.positions = grow(this.positions, 3);
    this.normals = grow(this.normals, 3);
    this.uvs = grow(this.uvs, 2);
    this.light = grow(this.light, 1);
    this.flip = grow(this.flip, 0.25);
  }
}

const LAYERS = [new LayerBuffer(), new LayerBuffer(), new LayerBuffer(), new LayerBuffer()];

/** Esquina de una caja en el eje `axis`: el mínimo (0) o el máximo (1). */
const corner = (box, axis, bit) => box[bit ? axis + 3 : axis];

/**
 * Agrega una cara (4 vértices) de una caja del bloque `id` en (x, y, z);
 * `pi`: su índice en la copia con borde `pad`. `box`: [x0, y0, z0, x1, y1,
 * z1] dentro del bloque. La oclusión se calcula solo si la cara está en el
 * borde del bloque (las de adentro de una losa o un escalón van sin sombra).
 */
function emitFace(buf, pad, f, id, x, y, z, pi, box) {
  buf.reserveQuad();
  const P = buf.positions;
  const N = buf.normals;
  const T = buf.uvs;
  const L = buf.light;
  const quad = buf.vertexCount >> 2;
  const axis = f >> 1; // 0 x, 1 y, 2 z (FACES va de a pares por eje)
  const onEdge = f & 1 ? box[axis + 3] === 1 : box[axis] === 0;
  const shade = !NO_SHADE[id] && onEdge;
  const aoBase = f * 12;
  const uvBase = id * 24 + f * 4;
  const u0 = FACE_UVS[uvBase];
  const v0 = FACE_UVS[uvBase + 1];
  const du = FACE_UVS[uvBase + 2] - u0;
  const dv = FACE_UVS[uvBase + 3] - v0;
  const nx = NORMALS[f * 3];
  const ny = NORMALS[f * 3 + 1];
  const nz = NORMALS[f * 3 + 2];
  const ua = UV_AXES[f * 4];
  const uFlip = UV_AXES[f * 4 + 1];
  const va = UV_AXES[f * 4 + 2];
  const vFlip = UV_AXES[f * 4 + 3];
  for (let c = 0; c < 4; c++) {
    const k = f * 12 + c * 3;
    const v = buf.vertexCount++;
    const px = corner(box, 0, CORNERS[k]);
    const py = corner(box, 1, CORNERS[k + 1]);
    const pz = corner(box, 2, CORNERS[k + 2]);
    P[v * 3] = x + px;
    P[v * 3 + 1] = y + py;
    P[v * 3 + 2] = z + pz;
    N[v * 3] = nx;
    N[v * 3 + 1] = ny;
    N[v * 3 + 2] = nz;
    // La textura va recortada como la caja (no se estira).
    const pu = ua === 0 ? px : ua === 1 ? py : pz;
    const pv = va === 0 ? px : va === 1 ? py : pz;
    T[v * 2] = u0 + du * (uFlip ? 1 - pu : pu);
    T[v * 2 + 1] = v0 + dv * (vFlip ? 1 - pv : pv);
    let ao = 3;
    if (shade) {
      const o = aoBase + c * 3;
      // Los desplazamientos ya incluyen el paso hacia afuera de la cara.
      const s1 = OPAQUE[pad[pi + AO_OFFSETS[o]]];
      const s2 = OPAQUE[pad[pi + AO_OFFSETS[o + 1]]];
      ao = s1 && s2 ? 0 : 3 - s1 - s2 - OPAQUE[pad[pi + AO_OFFSETS[o + 2]]];
    }
    L[v] = ao;
  }
  // El cuadrado se divide en dos triángulos por la diagonal 1-2. Si la otra
  // (0-3) une las esquinas más claras, se usa esa: así la sombra queda en su
  // rincón y no se estira en una raya.
  const b = quad * 4;
  buf.flip[quad] = L[b] + L[b + 3] > L[b + 1] + L[b + 2] ? 1 : 0;
  for (let c = 0; c < 4; c++) L[b + c] = AO_LIGHT[L[b + c]];
}

/**
 * ¿Hay que dibujar la cara de `id` que da hacia el bloque `n`?
 * - Contra aire o un bloque no opaco (agua, vidrio, hojas): sí, salvo que
 *   sean del mismo tipo y ese tipo oculte caras entre iguales (cullSame).
 * - Contra un bloque opaco: nunca (queda tapada).
 * - El agua, solo contra aire.
 */
function faceVisible(id, n) {
  if (OPAQUE[n]) return false;
  // El agua solo muestra su superficie hacia el aire: contra vidrio u hojas
  // dibujan esos bloques (si no, las dos caras se pisan y parpadean).
  if (LIQUID[id] && n !== BLOCK.AIR) return false;
  return !(n === id && CULL_SAME[id]);
}

/**
 * @typedef {{positions: Float32Array, normals: Float32Array, uvs: Float32Array,
 *   colors: Float32Array, indices: Uint16Array | Uint32Array,
 *   groups: {start: number, count: number, materialIndex: number}[],
 *   minY: number, maxY: number}} ChunkMeshData
 * minY/maxY: alturas entre las que hay caras (para la caja que usa Three.js
 * al decidir qué chunks están a la vista).
 */

/**
 * Arma los datos de malla de un chunk.
 *
 * @param {Uint8Array} data bloques del chunk
 * @param {{nx?: Uint8Array, px?: Uint8Array, nz?: Uint8Array, pz?: Uint8Array,
 *   nxnz?: Uint8Array, pxnz?: Uint8Array, nxpz?: Uint8Array, pxpz?: Uint8Array}} neighbors
 *   datos de los 8 chunks vecinos (-X, +X, -Z, +Z y las diagonales) para las
 *   caras y la oclusión de los bordes. Si falta uno, se lo trata como aire.
 * @param {number} [maxY] bloque no-aire más alto del chunk (optimización)
 * @returns {ChunkMeshData | null} null si el chunk no tiene ninguna cara visible.
 */
export function buildChunkMesh(data, neighbors = {}, maxY = CHUNK_HEIGHT - 1) {
  return meshPadded(padChunk(data, neighbors, padded), maxY);
}

/**
 * Arma los datos de malla desde la copia con borde (ver padChunk).
 * @param {Uint8Array} pad
 * @param {number} [maxY] bloque no-aire más alto del chunk (optimización)
 * @returns {ChunkMeshData | null}
 */
export function meshPadded(pad, maxY = CHUNK_HEIGHT - 1) {
  for (const l of LAYERS) l.vertexCount = 0;
  const waterBox = new Float32Array([0, 0, 0, 1, WATER_SURFACE, 1]);
  const neighbor = new Uint8Array(6); // -X, +X, -Y, +Y, -Z, +Z (orden de FACES)
  const lastY = CHUNK_HEIGHT - 1;
  const top = Math.min(lastY, maxY);
  let lowY = CHUNK_HEIGHT;
  let highY = 0;

  for (let y = 0; y <= top; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const pi = padIndex(x, y, z);
        const id = pad[pi];
        if (id === 0) continue;
        const layer = LAYER_OF[id];
        if (layer < 0) continue;

        // Vecinos (en los bordes, del chunk de al lado; debajo del mundo,
        // sólido: la cara de abajo de y = 0 no se ve).
        for (let f = 0; f < 6; f++) neighbor[f] = pad[pi + FACE_OFFSET[f]];

        // Descarte rápido: bloque totalmente rodeado de bloques opacos.
        if (
          OPAQUE[neighbor[0]] &&
          OPAQUE[neighbor[1]] &&
          OPAQUE[neighbor[2]] &&
          OPAQUE[neighbor[3]] &&
          OPAQUE[neighbor[4]] &&
          OPAQUE[neighbor[5]]
        ) {
          continue;
        }

        const buf = LAYERS[layer];
        const before = buf.vertexCount;
        const boxes = SHAPE_BOXES[id];
        if (boxes) {
          // Con forma: cada caja entera, salvo las caras pegadas a un bloque
          // opaco del costado.
          for (const box of boxes) {
            for (let f = 0; f < 6; f++) {
              const axis = f >> 1;
              const onEdge = f & 1 ? box[axis + 3] === 1 : box[axis] === 0;
              if (onEdge && OPAQUE[neighbor[f]]) continue;
              emitFace(buf, pad, f, id, x, y, z, pi, box);
            }
          }
        } else {
          // El agua sin agua arriba se dibuja un poco más baja; en ese caso
          // la tapa se dibuja siempre, aunque arriba haya algo (si no, queda
          // un hueco).
          const lowered = LIQUID[id] && neighbor[3] !== id;
          const box = lowered ? waterBox : FULL_BOX;
          for (let f = 0; f < 6; f++) {
            if ((f === 3 && lowered) || faceVisible(id, neighbor[f])) {
              emitFace(buf, pad, f, id, x, y, z, pi, box);
            }
          }
        }
        if (buf.vertexCount !== before) {
          if (y < lowY) lowY = y;
          highY = y + 1;
        }
      }
    }
  }

  // Unir las capas en una sola geometría, con un grupo (rango de índices y
  // material) por capa. Los índices siguen siempre el mismo patrón por cara.
  let vertexCount = 0;
  for (const l of LAYERS) vertexCount += l.vertexCount;
  if (vertexCount === 0) return null;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const indexCount = (vertexCount / 4) * 6;
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const groups = [];
  let v = 0;
  let i = 0;
  for (let layer = 0; layer < LAYERS.length; layer++) {
    const l = LAYERS[layer];
    if (l.vertexCount === 0) continue;
    positions.set(l.positions.subarray(0, l.vertexCount * 3), v * 3);
    normals.set(l.normals.subarray(0, l.vertexCount * 3), v * 3);
    uvs.set(l.uvs.subarray(0, l.vertexCount * 2), v * 2);
    for (let k = 0; k < l.vertexCount; k++) {
      const light = l.light[k];
      colors[(v + k) * 3] = light;
      colors[(v + k) * 3 + 1] = light;
      colors[(v + k) * 3 + 2] = light;
    }
    const start = i;
    for (let q = 0; q < l.vertexCount; q += 4) {
      const b = v + q;
      if (l.flip[q >> 2]) {
        indices[i++] = b;
        indices[i++] = b + 1;
        indices[i++] = b + 3;
        indices[i++] = b;
        indices[i++] = b + 3;
        indices[i++] = b + 2;
      } else {
        indices[i++] = b;
        indices[i++] = b + 1;
        indices[i++] = b + 2;
        indices[i++] = b + 2;
        indices[i++] = b + 1;
        indices[i++] = b + 3;
      }
    }
    groups.push({ start, count: i - start, materialIndex: layer });
    v += l.vertexCount;
  }
  return { positions, normals, uvs, colors, indices, groups, minY: lowY, maxY: highY };
}
