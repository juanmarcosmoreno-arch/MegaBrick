// Gestión del mundo: chunks cargados alrededor del jugador, lectura y
// escritura de bloques en coordenadas globales y mallas de cada chunk.
//
// El mundo es "infinito": cada frame se encargan a los Web Workers los
// chunks que faltan generar o mallar cerca del jugador, por prioridad (lo
// más cercano primero, y antes lo que tiene adelante que lo que tiene a la
// espalda), y se liberan los que quedaron lejos. Las mallas listas se suman
// a la escena con un tope por frame, para no trabar el dibujo.
//
// Sin workers (o si fallan), todo se hace en el hilo principal con un tope
// de tiempo por frame. El chunk que cambia un jugador se rearma siempre al
// instante en el hilo principal, para que se vea en el mismo frame.

import * as THREE from 'three';
import { BLOCK, BLOCKS, getBlock } from './blocks.js';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk.js';
import { WATER_SURFACE, buildChunkMesh, padChunk } from './Mesher.js';

/** Clave de un chunk en el Map: "cx,cz". */
export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

/** Convierte una coordenada de bloque a coordenada de chunk. */
export function toChunkCoord(v) {
  return Math.floor(v / CHUNK_SIZE);
}

/** Coordenada local (0..15) dentro del chunk, también para negativos. */
export function toLocalCoord(v) {
  return ((v % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

/** Un chunk y sus 8 vecinos (desplazamientos en chunks). */
const NEIGHBORHOOD = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
];

/** ¿Es un ID de bloque que existe? */
const isKnownBlock = (id) => Boolean(BLOCKS[id]);

/** Tiempo máximo por frame (ms) para generar y mallar chunks sin workers. */
const DEFAULT_BUDGET_MS = 6;

/**
 * Mallas nuevas que se suman a la escena por frame (cada una se sube a la
 * placa de video al dibujarla) y tiempo máximo (ms) para armarlas.
 */
const MAX_NEW_MESHES_PER_FRAME = 6;
const NEW_MESHES_BUDGET_MS = 3;

/** Hacia dónde mira el jugador en el plano (x, z); [0, 0] si no se sabe. */
function forward(yaw) {
  return yaw === undefined ? [0, 0] : [-Math.sin(yaw), -Math.cos(yaw)];
}

/**
 * Prioridad de un chunk (menor = antes): la distancia del jugador a su
 * centro, multiplicada por hasta 2 si queda a la espalda. Así se completa
 * primero lo que se ve.
 */
function priority(cx, cz, x, z, fx, fz) {
  const vx = cx * CHUNK_SIZE + CHUNK_SIZE / 2 - x;
  const vz = cz * CHUNK_SIZE + CHUNK_SIZE / 2 - z;
  const dist = Math.hypot(vx, vz);
  const ahead = dist > 0 ? (vx * fx + vz * fz) / dist : 1;
  return dist * (1.5 - 0.5 * ahead);
}

export class World {
  /**
   * @param {THREE.Material[]} materials materiales indexados por LAYER
   * @param {import('./TerrainGen.js').TerrainGenerator} generator
   * @param {{renderDistance?: number,
   *   workers?: import('./ChunkWorkers.js').ChunkWorkers | null}} [options]
   */
  constructor(materials, generator, { renderDistance = 6, workers = null } = {}) {
    this.materials = materials;
    this.generator = generator;
    /** Workers para generar y mallar (compartidos entre mundos) o null. */
    this.workers = workers;
    /** Claves de los chunks que se están generando en un worker. */
    this._generating = new Set();
    /** Mallas armadas en un worker que esperan su turno para sumarse a la escena. */
    this._readyMeshes = [];
    /**
     * Cola de prioridad: lo que falta generar o mallar, de lo más urgente a
     * lo menos. Se rearma en cada frame y, entre frame y frame, cada worker
     * que termina toma el siguiente trabajo (así no esperan al próximo frame).
     */
    this._queue = [];
    this._disposed = false;
    /** @type {Map<string, Chunk>} */
    this.chunks = new Map();
    // Grupo que contiene todas las mallas de chunks (se agrega a la escena).
    this.group = new THREE.Group();
    this.group.name = 'mundo';
    this._center = null; // chunk donde está el jugador
    /**
     * Cambios hechos por los jugadores, como diferencias respecto del
     * terreno generado: "cx,cz" → Map(índice del bloque → ID). Se vuelven a
     * aplicar si el chunk se descarga y se genera de nuevo, y son lo que se
     * guarda en el navegador y lo que se comparte en el multijugador.
     * @type {Map<string, Map<number, number>>}
     */
    this.edits = new Map();
    /** Claves de los chunks con cambios que todavía no se guardaron. */
    this.unsaved = new Set();
    /**
     * Funciones que se llaman con cada cambio: ({x, y, z, id, prev, source}) => void
     * (prev: el bloque que había, o null si el chunk no estaba cargado).
     */
    this.editListeners = new Set();
    this.setRenderDistance(renderDistance);
  }

  /**
   * Distancia de render en chunks. Se mallan los chunks hasta esa distancia;
   * se generan datos un anillo más allá (para saber qué caras de los bordes
   * se ven) y se liberan los que quedan bastante más lejos.
   */
  setRenderDistance(chunks) {
    this.renderDistance = Math.max(2, Math.min(16, Math.round(chunks)));
    // Un chunk se malla cuando están sus 8 vecinos (también en diagonal, por
    // la oclusión de las esquinas): se cargan datos hasta 1,5 chunks más allá.
    const load = this.renderDistance + 1.5;
    // Más allá de esto se liberan mallas y datos (ver _unloadFar).
    this.meshLimit = this.renderDistance + 1.5;
    // Los datos duran más que las mallas (+ √2): un chunk con malla siempre
    // tiene cargados sus 8 vecinos (de ellos depende la oclusión de sus bordes).
    this.dataLimit = this.renderDistance + 3;
    // Desplazamientos (en chunks) dentro del radio de carga, del más cercano
    // al más lejano: ese es el orden de prioridad.
    this._offsets = [];
    const span = Math.ceil(load);
    for (let dz = -span; dz <= span; dz++) {
      for (let dx = -span; dx <= span; dx++) {
        const d = Math.hypot(dx, dz);
        if (d <= load) this._offsets.push({ dx, dz, d });
      }
    }
    this._offsets.sort((a, b) => a.d - b.d);
    this._center = null; // recalcular descargas en el próximo update

    // Distancia mínima (en bloques) entre el jugador y el borde del área
    // mallada, en el peor caso (jugador en una esquina de su chunk): es el
    // hueco entre su chunk y el chunk no mallado más cercano. La niebla tiene
    // que terminar antes de eso para que nunca se vea el borde.
    let edge = Infinity;
    const r = this.renderDistance;
    for (let dz = -r - 2; dz <= r + 2; dz++) {
      for (let dx = -r - 2; dx <= r + 2; dx++) {
        if (Math.hypot(dx, dz) <= r) continue;
        const gapX = Math.max(0, Math.abs(dx) - 1) * CHUNK_SIZE;
        const gapZ = Math.max(0, Math.abs(dz) - 1) * CHUNK_SIZE;
        edge = Math.min(edge, Math.hypot(gapX, gapZ));
      }
    }
    this.edgeDistance = edge;
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  /** ID del bloque en coordenadas globales (aire si el chunk no está cargado). */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const chunk = this.getChunk(toChunkCoord(x), toChunkCoord(z));
    if (!chunk) return BLOCK.AIR;
    return chunk.data[Chunk.index(toLocalCoord(x), y, toLocalCoord(z))];
  }

  /**
   * ¿El bloque en coordenadas globales es sólido (colisiona)?
   * Debajo del mundo (y < 0) se considera sólido: nadie puede caer al vacío
   * ni ver el piso desde abajo (el mesher no genera esas caras).
   */
  isSolid(x, y, z) {
    if (y < 0) return true;
    return getBlock(this.getBlock(x, y, z)).solid;
  }

  /** ¿Está cargado el chunk que contiene la columna (x, z)? */
  isLoadedAt(x, z) {
    return this.chunks.has(chunkKey(toChunkCoord(Math.floor(x)), toChunkCoord(Math.floor(z))));
  }

  /**
   * ¿El punto (x, y, z) (coordenadas reales, no de bloque) está dentro del
   * agua? Tiene en cuenta que la superficie del agua sin agua arriba está
   * un poco más baja que el borde del bloque.
   */
  isWaterAt(x, y, z) {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (!getBlock(this.getBlock(bx, by, bz)).liquid) return false;
    if (getBlock(this.getBlock(bx, by + 1, bz)).liquid) return true;
    return y - by < WATER_SURFACE;
  }

  /**
   * Cambia un bloque en coordenadas globales (solo en chunks cargados).
   * Marca para rearmar el chunk y, si el bloque está en un borde, también el
   * chunk vecino (su cara expuesta puede cambiar).
   */
  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = toChunkCoord(x);
    const cz = toChunkCoord(z);
    const lx = toLocalCoord(x);
    const lz = toLocalCoord(z);
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.set(lx, y, lz, id)) return false;

    // Vecinos que tocan el bloque (sus caras y la oclusión de sus esquinas).
    const sx = lx === 0 ? -1 : lx === CHUNK_SIZE - 1 ? 1 : 0;
    const sz = lz === 0 ? -1 : lz === CHUNK_SIZE - 1 ? 1 : 0;
    if (sx) this.markDirty(cx + sx, cz);
    if (sz) this.markDirty(cx, cz + sz);
    if (sx && sz) this.markDirty(cx + sx, cz + sz);
    return true;
  }

  markDirty(cx, cz) {
    this.getChunk(cx, cz)?.touch();
  }

  /**
   * Cambio de un bloque hecho por un jugador (romper o poner). Es el ÚNICO
   * camino para modificar el mundo durante el juego: registra la diferencia,
   * rearma al instante la malla del chunk (y la del vecino si el bloque está
   * en un borde) y avisa a los interesados (guardado, multijugador).
   *
   * Si el chunk no está cargado (por ejemplo, un cambio que llega por la red
   * de un lugar lejano), solo se registra: se aplica cuando el chunk se genere.
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} id bloque nuevo
   * @param {'local' | 'remote'} [source] de dónde viene el cambio: los que
   *   llegan por la red no se vuelven a mandar
   * @returns {boolean} si el cambio se aplicó o registró
   */
  editBlock(x, y, z, id, source = 'local') {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = toChunkCoord(x);
    const cz = toChunkCoord(z);
    const loaded = this.getChunk(cx, cz);
    const prev = loaded ? this.getBlock(x, y, z) : null;
    if (loaded && !this.setBlock(x, y, z, id)) return false;
    if (!loaded && source === 'local') return false; // el jugador no edita lo que no ve

    const key = chunkKey(cx, cz);
    let chunkEdits = this.edits.get(key);
    if (!chunkEdits) {
      chunkEdits = new Map();
      this.edits.set(key, chunkEdits);
    }
    chunkEdits.set(Chunk.index(toLocalCoord(x), y, toLocalCoord(z)), id);
    this.unsaved.add(key);

    // Rearmar ya mismo lo afectado (el chunk y sus vecinos marcados).
    if (loaded) {
      for (const [dx, dz] of NEIGHBORHOOD) {
        const chunk = this.getChunk(cx + dx, cz + dz);
        if (chunk?.dirty && chunk.mesh && this._neighborsReady(chunk.cx, chunk.cz)) this.rebuildChunk(chunk);
      }
    }
    for (const listener of this.editListeners) listener({ x, y, z, id, prev, source });
    return true;
  }

  /**
   * Bloque que se sabe que hay en (x, y, z): el del chunk si está cargado y,
   * si no, el último cambio registrado ahí. null si no se sabe (habría que
   * generar el terreno).
   */
  knownBlockAt(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return null;
    const cx = toChunkCoord(x);
    const cz = toChunkCoord(z);
    if (this.getChunk(cx, cz)) return this.getBlock(x, y, z);
    const id = this.edits.get(chunkKey(cx, cz))?.get(Chunk.index(toLocalCoord(x), y, toLocalCoord(z)));
    return id ?? null;
  }

  /** ¿Hay cambios registrados en el chunk de la columna (x, z)? */
  hasEditsAt(x, z) {
    return this.edits.has(chunkKey(toChunkCoord(x), toChunkCoord(z)));
  }

  /** ¿El bloque (x, y, z) lo puso o lo cambió un jugador? */
  isEditedAt(x, y, z) {
    const chunkEdits = this.edits.get(chunkKey(toChunkCoord(x), toChunkCoord(z)));
    return chunkEdits?.has(Chunk.index(toLocalCoord(x), y, toLocalCoord(z))) ?? false;
  }

  /**
   * Cambios de los jugadores en un formato simple para mandar o guardar:
   * [[clave del chunk, [índice, id, índice, id, ...]], ...].
   */
  exportEdits() {
    const out = [];
    for (const [key, chunkEdits] of this.edits) {
      const flat = [];
      for (const [index, id] of chunkEdits) flat.push(index, id);
      out.push([key, flat]);
    }
    return out;
  }

  /**
   * Cambios de algunos chunks para guardar: [[clave, Uint16Array], ...] con
   * [índice, id, índice, id, ...] (índice < 32768 e id < 256: entran en 16 bits).
   * @param {Iterable<string>} keys claves de los chunks
   */
  exportChunkEdits(keys) {
    const out = [];
    for (const key of keys) {
      const chunkEdits = this.edits.get(key);
      if (!chunkEdits) continue;
      const flat = new Uint16Array(chunkEdits.size * 2);
      let i = 0;
      for (const [index, id] of chunkEdits) {
        flat[i++] = index;
        flat[i++] = id;
      }
      out.push([key, flat]);
    }
    return out;
  }

  /**
   * Reemplaza los cambios de los jugadores (formato de exportEdits, con
   * listas comunes o Uint16Array). Se usa antes de cargar chunks: al unirse
   * a una partida o al cargar un mundo guardado. Lo cargado cuenta como ya
   * guardado. Los valores inválidos se ignoran.
   */
  importEdits(data) {
    this.edits.clear();
    this.unsaved.clear();
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      if (!Array.isArray(entry[1]) && !(entry[1] instanceof Uint16Array)) continue;
      if (!/^-?\d+,-?\d+$/.test(entry[0])) continue;
      const chunkEdits = new Map();
      const flat = entry[1];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const index = flat[i];
        const id = flat[i + 1];
        if (!Number.isInteger(index) || index < 0 || index >= CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT) continue;
        if (!Number.isInteger(id) || !isKnownBlock(id)) continue;
        chunkEdits.set(index, id);
      }
      if (chunkEdits.size) this.edits.set(entry[0], chunkEdits);
    }
  }

  /** Genera (en este hilo) los datos de un chunk. */
  _generate(cx, cz) {
    const { data, maxY } = this.generator.generateChunk(cx, cz);
    return this._addChunk(cx, cz, data, maxY);
  }

  /** Suma un chunk recién generado, con los cambios de los jugadores aplicados. */
  _addChunk(cx, cz, data, generatedMaxY) {
    let maxY = generatedMaxY;
    const chunkEdits = this.edits.get(chunkKey(cx, cz));
    if (chunkEdits) {
      for (const [index, id] of chunkEdits) {
        data[index] = id;
        if (id !== BLOCK.AIR) maxY = Math.max(maxY, index >> 8); // y = índice / 256
      }
    }
    const chunk = new Chunk(cx, cz, data, maxY);
    this.chunks.set(chunkKey(cx, cz), chunk);
    // Una malla de un vecino que esté en camino se armó sin este chunk (o con
    // una copia vieja): que se rehaga. Jugando normal no cuesta nada, porque
    // esos vecinos todavía no tienen malla.
    for (const [dx, dz] of NEIGHBORHOOD) {
      if (dx || dz) this.markDirty(cx + dx, cz + dz);
    }
    return chunk;
  }

  /** ¿Están cargados los 4 vecinos? (hace falta para mallar los bordes) */
  _neighborsReady(cx, cz) {
    for (const [dx, dz] of NEIGHBORHOOD) {
      if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
    }
    return true;
  }

  /** Datos de los 8 vecinos de un chunk, como los pide el mesher. */
  _neighborData(cx, cz) {
    const data = (dx, dz) => this.getChunk(cx + dx, cz + dz)?.data;
    return {
      nx: data(-1, 0),
      px: data(1, 0),
      nz: data(0, -1),
      pz: data(0, 1),
      nxnz: data(-1, -1),
      pxnz: data(1, -1),
      nxpz: data(-1, 1),
      pxpz: data(1, 1),
    };
  }

  /** Rearma ya mismo (en este hilo) la malla de un chunk. */
  rebuildChunk(chunk) {
    const d = buildChunkMesh(chunk.data, this._neighborData(chunk.cx, chunk.cz), chunk.maxY);
    chunk.dirty = false;
    this._setMesh(chunk, d, chunk.version);
  }

  /**
   * Le pone a un chunk la malla armada con `d` (reemplaza y libera la
   * anterior). `version`: la del chunk con la que se armó.
   * @param {Chunk} chunk
   * @param {import('./Mesher.js').ChunkMeshData | null} d
   * @param {number} version
   */
  _setMesh(chunk, d, version) {
    this.disposeChunkMesh(chunk);
    chunk.meshVersion = version;
    if (!d) return;
    const { cx, cz } = chunk;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(d.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(d.indices, 1));
    for (const g of d.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
    // La caja del chunk (de la cara más baja a la más alta), sin recorrer
    // los vértices: con ella Three.js saltea los chunks que no están a la vista.
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(0, d.minY, 0),
      new THREE.Vector3(CHUNK_SIZE, d.maxY, CHUNK_SIZE),
    );
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());

    // Una sola malla por chunk; cada grupo usa el material de su capa
    // (Three.js dibuja lo translúcido después de lo opaco).
    const mesh = new THREE.Mesh(geometry, this.materials);
    mesh.position.set(chunk.worldX, 0, chunk.worldZ);
    mesh.matrixAutoUpdate = false; // el chunk no se mueve
    mesh.updateMatrix();
    mesh.name = `chunk ${cx},${cz}`;
    chunk.mesh = mesh;
    this.group.add(mesh);
  }

  /**
   * Genera y malla lo que falta alrededor de una posición. Con workers,
   * encarga los trabajos por prioridad y suma a la escena las mallas listas;
   * sin workers, lo hace acá, de lo más cercano a lo más lejano, sin pasarse
   * del tiempo disponible en este frame.
   * @param {number} x posición del jugador (bloques)
   * @param {number} z
   * @param {{yaw?: number, budgetMs?: number}} [o] hacia dónde mira el
   *   jugador (prioriza lo de adelante) y tiempo máximo sin workers
   * @returns {number} cantidad de chunks generados, mallados o encargados
   */
  update(x, z, { yaw, budgetMs = DEFAULT_BUDGET_MS } = {}) {
    const cx = toChunkCoord(Math.floor(x));
    const cz = toChunkCoord(Math.floor(z));
    if (!this._center || this._center.cx !== cx || this._center.cz !== cz) {
      this._center = { cx, cz };
      this._unloadFar();
    }

    if (this.workers && !this.workers.broken) {
      this._addReadyMeshes(x, z, yaw);
      this._buildQueue(x, z, yaw);
      return this._pump();
    }

    const start = performance.now();
    let done = 0;
    for (const o of this._offsets) {
      if (done > 0 && performance.now() - start > budgetMs) break;
      const ccx = cx + o.dx;
      const ccz = cz + o.dz;
      const chunk = this.getChunk(ccx, ccz);
      if (!chunk) {
        this._generate(ccx, ccz);
        done++;
      } else if (chunk.dirty && o.d <= this.renderDistance && this._neighborsReady(ccx, ccz)) {
        this.rebuildChunk(chunk);
        done++;
      }
    }
    // Lo que quedó armado en los workers antes de que fallaran.
    this._addReadyMeshes();
    return done;
  }

  /**
   * Arma la cola de prioridad (ver priority) con lo que falta generar o
   * mallar: se completa primero lo que se ve.
   */
  _buildQueue(x, z, yaw) {
    const { cx, cz } = this._center;
    const [fx, fz] = forward(yaw);
    const queue = this._queue;
    queue.length = 0;
    for (const o of this._offsets) {
      const ccx = cx + o.dx;
      const ccz = cz + o.dz;
      const chunk = this.getChunk(ccx, ccz);
      if (chunk) {
        if (!chunk.dirty || chunk.meshing || o.d > this.renderDistance) continue;
        if (!this._neighborsReady(ccx, ccz)) continue;
      } else if (this._generating.has(chunkKey(ccx, ccz))) {
        continue;
      }
      queue.push({ cx: ccx, cz: ccz, mesh: Boolean(chunk), score: priority(ccx, ccz, x, z, fx, fz) });
    }
    // De mayor a menor: se toma desde el final (pop).
    queue.sort((a, b) => b.score - a.score);
  }

  /**
   * Encarga trabajos de la cola mientras los workers tengan lugar. Cada uno
   * se revisa antes, porque la cola puede haber quedado vieja.
   * @returns {number} trabajos encargados
   */
  _pump() {
    if (this._disposed || !this.workers || this.workers.broken) return 0;
    let started = 0;
    while (this.workers.free > 0 && this._queue.length) {
      const { cx, cz, mesh } = this._queue.pop();
      const chunk = this.getChunk(cx, cz);
      if (mesh) {
        if (!chunk?.dirty || chunk.meshing || !this._neighborsReady(cx, cz)) continue;
        this._meshInWorker(chunk);
      } else {
        if (chunk || this._generating.has(chunkKey(cx, cz))) continue;
        this._generateInWorker(cx, cz);
      }
      started++;
    }
    return started;
  }

  /** Encarga a un worker generar un chunk. */
  _generateInWorker(cx, cz) {
    const key = chunkKey(cx, cz);
    this._generating.add(key);
    this.workers.run({ type: 'generate', seed: this.generator.seed, cx, cz }, [], (result) => {
      this._generating.delete(key);
      if (!result || this._disposed) return;
      this._pump(); // el worker quedó libre: el siguiente de la cola
      if (this.chunks.has(key)) return; // ya se generó en este hilo
      // Si el jugador ya se alejó, no hace falta.
      const c = this._center;
      if (c && Math.hypot(cx - c.cx, cz - c.cz) > this.dataLimit) return;
      this._addChunk(cx, cz, result.data, result.maxY);
    });
  }

  /** Encarga a un worker la malla de un chunk (el hilo principal arma la copia con borde). */
  _meshInWorker(chunk) {
    const padded = padChunk(chunk.data, this._neighborData(chunk.cx, chunk.cz), this.workers.takeBuffer());
    const version = chunk.version;
    chunk.dirty = false;
    chunk.meshing = true;
    this.workers.run({ type: 'mesh', padded, maxY: chunk.maxY }, [padded.buffer], (result) => {
      chunk.meshing = false;
      if (!result) {
        chunk.dirty = true; // se rearma de otra forma
        return;
      }
      this.workers.giveBuffer(result.padded);
      if (this._disposed) return;
      this._pump();
      if (this.getChunk(chunk.cx, chunk.cz) !== chunk) return; // se descargó
      this._readyMeshes.push({ chunk, version, mesh: result.mesh });
    });
  }

  /**
   * Suma a la escena las mallas armadas en los workers, con un tope por
   * frame. Con la posición, van primero las de adelante (si el jugador se
   * dio vuelta mientras esperaban, se reordenan). Descarta las que llegaron
   * tarde: el chunk se descargó, ya tiene una malla más nueva (se rearmó en
   * este hilo por un cambio) o el jugador se alejó.
   */
  _addReadyMeshes(x, z, yaw) {
    const ready = this._readyMeshes;
    if (x !== undefined && ready.length > 1) {
      const [fx, fz] = forward(yaw);
      for (const r of ready) r.score = priority(r.chunk.cx, r.chunk.cz, x, z, fx, fz);
      ready.sort((a, b) => a.score - b.score);
    }
    const start = performance.now();
    let added = 0;
    while (this._readyMeshes.length && added < MAX_NEW_MESHES_PER_FRAME) {
      if (added > 0 && performance.now() - start > NEW_MESHES_BUDGET_MS) break;
      const { chunk, version, mesh } = this._readyMeshes.shift();
      if (this.getChunk(chunk.cx, chunk.cz) !== chunk || version <= chunk.meshVersion) continue;
      const c = this._center;
      if (c && Math.hypot(chunk.cx - c.cx, chunk.cz - c.cz) > this.meshLimit) {
        chunk.dirty = true; // se malla de nuevo si vuelve a acercarse
        continue;
      }
      this._setMesh(chunk, mesh, version);
      added++;
    }
  }

  /**
   * Carga de una vez (sin tope de tiempo) los chunks alrededor de un punto.
   * Se usa al empezar, para no aparecer en el vacío.
   */
  preload(x, z, radius = 2) {
    const cx = toChunkCoord(Math.floor(x));
    const cz = toChunkCoord(Math.floor(z));
    for (let dz = -radius - 1; dz <= radius + 1; dz++) {
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        if (!this.getChunk(cx + dx, cz + dz)) this._generate(cx + dx, cz + dz);
      }
    }
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getChunk(cx + dx, cz + dz);
        if (chunk.dirty) this.rebuildChunk(chunk);
      }
    }
  }

  /**
   * Libera lo que quedó lejos: primero la malla (a más de render + 1.5
   * chunks) y después los datos (a más de render + 3). El margen evita
   * cargar y descargar el mismo chunk al ir y venir por un borde.
   */
  _unloadFar() {
    const { cx, cz } = this._center;
    for (const chunk of [...this.chunks.values()]) {
      const d = Math.hypot(chunk.cx - cx, chunk.cz - cz);
      if (d > this.dataLimit) {
        this.removeChunk(chunk.cx, chunk.cz);
      } else if (d > this.meshLimit && chunk.mesh) {
        this.disposeChunkMesh(chunk);
        chunk.dirty = true; // al volver a acercarse se malla de nuevo
      }
    }
  }

  /** Saca de la escena y libera la memoria de la malla de un chunk. */
  disposeChunkMesh(chunk) {
    chunk.meshVersion = -1;
    if (!chunk.mesh) return;
    this.group.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    chunk.mesh = null;
  }

  /** Quita un chunk del mundo liberando su malla. */
  removeChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    this.disposeChunkMesh(chunk);
    this.chunks.delete(key);
  }

  /**
   * Para depurar: chunks con datos y con malla, trabajos en los workers y
   * mallas esperando para sumarse a la escena.
   */
  get stats() {
    let meshed = 0;
    let meshing = 0;
    for (const c of this.chunks.values()) {
      if (c.mesh) meshed++;
      if (c.meshing) meshing++;
    }
    return {
      loaded: this.chunks.size,
      meshed,
      working: this._generating.size + meshing,
      waiting: this._readyMeshes.length,
    };
  }

  /** Libera todo el mundo (lo que vuelva de los workers se descarta). */
  dispose() {
    this._disposed = true;
    for (const chunk of this.chunks.values()) this.disposeChunkMesh(chunk);
    this.chunks.clear();
    this._readyMeshes.length = 0;
    this._queue.length = 0;
  }
}
