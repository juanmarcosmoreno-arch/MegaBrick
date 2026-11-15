// Web Worker que genera y malla chunks fuera del hilo principal (así el juego
// no se traba mientras carga terreno). Recibe trabajos de ChunkWorkers:
//
// - { type: 'generate', id, seed, generation, cx, cz } → { id, data, maxY }
// - { type: 'mesh', id, padded, maxY } → { id, mesh, padded }
//
// Los arrays viajan transferidos (sin copiarse); la copia con borde vuelve
// para reusarla. Si algo falla, responde { id, error }.

import { TerrainGenerator } from './TerrainGen.js';
import { meshPadded } from './Mesher.js';

/** Generador de la semilla actual (se rehace si cambia el mundo). */
let generator = null;

self.onmessage = (event) => {
  const job = event.data;
  try {
    if (job.type === 'generate') {
      if (generator?.seed !== job.seed || generator.generation !== job.generation) {
        generator = new TerrainGenerator(job.seed, job.generation);
      }
      const { data, maxY } = generator.generateChunk(job.cx, job.cz);
      self.postMessage({ id: job.id, data, maxY }, [data.buffer]);
    } else if (job.type === 'mesh') {
      const mesh = meshPadded(job.padded, job.maxY);
      const transfer = [job.padded.buffer];
      if (mesh) {
        for (const key of ['positions', 'normals', 'uvs', 'colors', 'indices']) {
          transfer.push(mesh[key].buffer);
        }
      }
      self.postMessage({ id: job.id, mesh, padded: job.padded }, transfer);
    } else {
      throw new Error(`Trabajo desconocido: ${job.type}`);
    }
  } catch (err) {
    self.postMessage({ id: job.id, error: String(err?.stack ?? err) });
  }
};
