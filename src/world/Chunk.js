// Datos de un chunk: una columna de 16 x 128 x 16 bloques.
//
// Los bloques se guardan como IDs en un Uint16Array (0 = aire). El índice
// lineal es x + z*16 + y*256: las capas horizontales quedan contiguas, lo
// que hace rápido recorrer el chunk de abajo hacia arriba.

import { BLOCK } from './blocks.js';

export const CHUNK_SIZE = 16; // ancho y largo (X y Z)
export const CHUNK_HEIGHT = 128; // alto (Y)
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

export class Chunk {
  /**
   * @param {number} cx coordenada X del chunk (en chunks, no en bloques)
   * @param {number} cz coordenada Z del chunk
   * @param {Uint16Array} [data] datos ya generados (opcional)
   * @param {number} [maxY] altura del bloque no-aire más alto (si se conoce)
   */
  constructor(cx, cz, data, maxY = CHUNK_HEIGHT - 1) {
    this.cx = cx;
    this.cz = cz;
    this.data = data ?? new Uint16Array(CHUNK_VOLUME);
    if (this.data.length !== CHUNK_VOLUME) {
      throw new Error(`Datos de chunk con tamaño inválido: ${this.data.length}`);
    }
    // Por encima de maxY todo es aire: el mesher no recorre esa parte.
    this.maxY = maxY;
    // true cuando los bloques cambiaron y hay que rearmar la malla.
    this.dirty = true;
    // Versión de lo que define la malla (sube con cada cambio del chunk o de
    // un vecino que lo toca) y versión de la malla que se ve (-1: ninguna).
    // Con eso se descartan las mallas armadas en un worker con datos viejos.
    this.version = 0;
    this.meshVersion = -1;
    // true mientras un worker le arma la malla.
    this.meshing = false;
    // Malla de Three.js del chunk (la administra World) o null.
    this.mesh = null;
    // true si la malla quedó vieja solo por la luz (un cambio en un chunk
    // vecino): se rearma en un worker, sin apuro.
    this.lightOnly = false;
    // Luz de cada celda (cielo << 4 | bloques), de la última malla, o null.
    this.light = null;
  }

  /** Marca que la malla quedó vieja (cambió el chunk o un vecino). */
  touch() {
    this.version++;
    this.dirty = true;
    this.lightOnly = false;
  }

  /** Marca que la luz cambió (por algo de un vecino): hay que rearmar la malla. */
  touchLight() {
    const pending = this.dirty && !this.lightOnly;
    this.version++;
    this.dirty = true;
    this.lightOnly = !pending;
  }

  /** Índice lineal dentro de `data` para coordenadas locales. */
  static index(x, y, z) {
    return x + (z << 4) + (y << 8);
  }

  /** ¿Las coordenadas locales están dentro del chunk? */
  static inBounds(x, y, z) {
    return (
      x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT
    );
  }

  /** ID del bloque en coordenadas locales (aire si está fuera de rango). */
  get(x, y, z) {
    if (!Chunk.inBounds(x, y, z)) return BLOCK.AIR;
    return this.data[Chunk.index(x, y, z)];
  }

  /** Cambia el bloque en coordenadas locales y marca el chunk como "sucio". */
  set(x, y, z, id) {
    if (!Chunk.inBounds(x, y, z)) return false;
    const i = Chunk.index(x, y, z);
    if (this.data[i] === id) return false;
    this.data[i] = id;
    if (id !== BLOCK.AIR && y > this.maxY) this.maxY = y;
    this.touch();
    return true;
  }

  /** Coordenada X (en bloques) de la esquina del chunk. */
  get worldX() {
    return this.cx * CHUNK_SIZE;
  }

  /** Coordenada Z (en bloques) de la esquina del chunk. */
  get worldZ() {
    return this.cz * CHUNK_SIZE;
  }
}
