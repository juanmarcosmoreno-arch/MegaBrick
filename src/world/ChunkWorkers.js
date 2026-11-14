// Grupo de Web Workers para generar y mallar chunks (ver chunkWorker.js).
//
// Cada worker tiene hasta 2 trabajos encargados (mientras hace uno, el otro
// ya está esperando: no queda parado entre mensaje y mensaje). Quién decide
// qué se encarga y en qué orden es World: acá solo se reparte y se avisa.
//
// Si un worker falla, el grupo queda "roto" y World vuelve a generar y
// mallar en el hilo principal (más lento, pero el juego sigue andando).

import { PADDED_SIZE } from './Mesher.js';

/** Trabajos encargados a la vez por worker. */
const JOBS_PER_WORKER = 2;

/** Copias con borde guardadas para reusar (cada una, 84 KB). */
const MAX_SPARE_BUFFERS = 12;

export class ChunkWorkers {
  /** @param {number} [count] cantidad de workers */
  constructor(count = defaultWorkerCount()) {
    this.workers = [];
    /** @type {Map<number, {worker: Worker, callback: (result: object | null) => void}>} */
    this.jobs = new Map();
    this._nextId = 1;
    this._spare = [];
    this.broken = false;
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL('./chunkWorker.js', import.meta.url), {
        type: 'module',
        name: `chunks-${i + 1}`,
      });
      worker.pending = 0;
      worker.onmessage = (event) => this._done(worker, event.data);
      worker.onerror = (event) => this._fail(event.message ?? 'error en el worker');
      worker.onmessageerror = () => this._fail('mensaje ilegible del worker');
      this.workers.push(worker);
    }
    this.capacity = count * JOBS_PER_WORKER;
  }

  /** Cuántos trabajos más se pueden encargar ahora. */
  get free() {
    return this.broken ? 0 : this.capacity - this.jobs.size;
  }

  /**
   * Encarga un trabajo al worker menos ocupado.
   * @param {object} message trabajo (ver chunkWorker.js)
   * @param {Transferable[]} transfer lo que se transfiere sin copiar
   * @param {(result: object | null) => void} callback recibe la respuesta, o
   *   null si el trabajo no se pudo hacer
   */
  run(message, transfer, callback) {
    if (this.broken) {
      callback(null);
      return;
    }
    let worker = this.workers[0];
    for (const w of this.workers) if (w.pending < worker.pending) worker = w;
    const id = this._nextId++;
    this.jobs.set(id, { worker, callback });
    worker.pending++;
    worker.postMessage({ ...message, id }, transfer);
  }

  /** Una copia con borde para mallar (reusada si hay). */
  takeBuffer() {
    return this._spare.pop() ?? new Uint16Array(PADDED_SIZE);
  }

  /** Devuelve una copia con borde para reusar. */
  giveBuffer(buffer) {
    if (buffer?.length === PADDED_SIZE && this._spare.length < MAX_SPARE_BUFFERS) this._spare.push(buffer);
  }

  _done(worker, result) {
    const job = this.jobs.get(result?.id);
    if (!job) return;
    this.jobs.delete(result.id);
    worker.pending--;
    if (result.error) {
      // Un trabajo que falla va a fallar siempre: mejor seguir sin workers.
      this._fail(result.error);
      job.callback(null);
      return;
    }
    job.callback(result);
  }

  /** Algo salió mal: se apagan los workers y se avisa a cada trabajo pendiente. */
  _fail(reason) {
    if (this.broken) return;
    console.warn('Los workers de chunks fallaron; se sigue en el hilo principal:', reason);
    this.broken = true;
    for (const w of this.workers) w.terminate();
    const pending = [...this.jobs.values()];
    this.jobs.clear();
    for (const job of pending) job.callback(null);
  }

  /** Apaga los workers. */
  dispose() {
    this.broken = true;
    for (const w of this.workers) w.terminate();
    this.jobs.clear();
  }
}

/** Workers según los núcleos del procesador (dejando uno para el juego). */
function defaultWorkerCount() {
  const cores = navigator.hardwareConcurrency || 4;
  return Math.max(1, Math.min(3, cores - 1));
}

/**
 * Crea los workers, o null si el navegador no los permite (el mundo se arma
 * entonces en el hilo principal).
 */
export function createChunkWorkers() {
  if (typeof Worker === 'undefined') return null;
  try {
    return new ChunkWorkers();
  } catch (err) {
    console.warn('Sin workers para los chunks:', err);
    return null;
  }
}
