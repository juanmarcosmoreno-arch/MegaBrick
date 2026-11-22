// Web Worker que genera y malla chunks fuera del hilo principal (así el juego
// no se traba mientras carga terreno). Recibe trabajos de ChunkWorkers:
//
// - { type: 'generate', id, seed, generation, cx, cz } → { id, data, maxY }
// - { type: 'mesh', id, region, maxY, top } → { id, mesh, light, region }
//   (region: los 9 chunks de alrededor, ver Light.js; light: la luz del chunk)
//
// Los arrays viajan transferidos (sin copiarse); la región vuelve para
// reusarla. Si algo falla, responde { id, error }.

import { TerrainGenerator } from './TerrainGen.js';
import { meshRegion } from './Mesher.js';
import { CHUNK_VOLUME } from './Chunk.js';

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
      const light = new Uint8Array(CHUNK_VOLUME);
      const mesh = meshRegion(job.region, job.maxY, job.top, light);
      const transfer = [job.region.buffer, light.buffer];
      if (mesh) {
        for (const key of ['positions', 'normals', 'uvs', 'colors', 'indices']) {
          transfer.push(mesh[key].buffer);
        }
      }
      self.postMessage({ id: job.id, mesh, light, region: job.region }, transfer);
    } else {
      throw new Error(`Trabajo desconocido: ${job.type}`);
    }
  } catch (err) {
    self.postMessage({ id: job.id, error: String(err?.stack ?? err) });
  }
};
