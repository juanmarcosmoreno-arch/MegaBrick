// Generación procedural del terreno.
//
// Todo sale de la semilla: la altura de cada columna se calcula con ruido
// simplex de varias octavas (llanuras, colinas y montañas), y árboles y
// vetas de mineral se ubican con un generador pseudoaleatorio que depende
// de la semilla y de la posición. Así, la misma semilla da siempre el mismo
// mundo, y un chunk se puede generar solo, sin necesitar a sus vecinos.
//
// Este módulo es puro (sin DOM ni Three.js) para poder correr en un Web
// Worker. Las cuevas (etapa 15) se tallan con ruido 3D: túneles largos que
// serpentean y algunas cavernas grandes en lo hondo.

import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BLOCK, getBlock } from './blocks.js';
import { CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_VOLUME, Chunk } from './Chunk.js';

/**
 * Versión del generador. Los mundos guardan diferencias contra el terreno
 * generado, así que uno guardado con una versión se sigue generando con
 * esa: 1 es el terreno de las etapas 2 a 11 (solo robles, sin plantas ni
 * nieve); 2 suma pinos, jacarandás, nieve y plantas (etapa 12); 3 suma
 * cuevas y carbón (etapa 15).
 */
export const GENERATION = 3;

/**
 * La versión del generador de un mundo guardado o recibido: una de las que
 * existen, o 1 si no la tiene (los guardados de antes de la etapa 12).
 */
export function validGeneration(g) {
  return Number.isInteger(g) && g >= 1 && g <= GENERATION ? g : 1;
}

/** Nivel del mar: el agua llena todo lo que quede por debajo. */
export const SEA_LEVEL = 40;

/** Altura máxima del terreno (deja lugar arriba para árboles). */
const MAX_TERRAIN = CHUNK_HEIGHT - 12;

/** Por encima de esta altura las montañas son de piedra pelada. */
const ROCK_LINE = 92;
/** Y más arriba todavía, con nieve en las cumbres. */
const SNOW_LINE = 104;
/** Desde esta altura los árboles son pinos. */
const PINE_LINE = 64;

// Árboles: el mundo se divide en celdas y cada celda puede tener uno.
const TREE_CELL = 5;
const TREE_RADIUS = 3; // radio máximo de la copa (las copas cruzan bordes de chunk)

// Plantas: flores por manchones (celdas de PATCH bloques con una flor cada una).
const PATCH = 8;
const FLOWERS = [BLOCK.FLOWER_DAISY, BLOCK.FLOWER_CEIBO, BLOCK.FLOWER_BLUE];

/** Generador pseudoaleatorio mulberry32 (rápido y determinista). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mezcla enteros en un hash de 32 bits (para decidir cosas por posición). */
function hash3(seed, a, b, c = 0) {
  let h = seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash a número en [0, 1). */
const hash01 = (seed, a, b, c) => hash3(seed, a, b, c) / 4294967296;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Vetas de mineral: cuántas por chunk, en qué alturas y de qué tamaño.
 * Los nombres y colores son propios de Megabrick.
 */
const ORES = [
  { id: BLOCK.ORE_COPPER, perChunk: 9, minY: 4, maxY: 70, size: [4, 9] },
  { id: BLOCK.ORE_AZURITE, perChunk: 4, minY: 4, maxY: 40, size: [3, 6] },
  { id: BLOCK.ORE_SOLARITE, perChunk: 2, minY: 2, maxY: 20, size: [2, 4] },
];

/** Carbón (desde la generación 3): el más común, de lo hondo hasta las montañas. */
const COAL = { id: BLOCK.ORE_COAL, perChunk: 14, minY: 6, maxY: 100, size: [5, 12] };

// Cuevas (generación 3).
/** Debajo de esta altura no se talla nada (el piso del mundo queda entero). */
const CAVE_FLOOR = 4;
/** Grosor de los túneles: cuanto más grande, más anchos. */
const TUNNEL_WIDTH = 0.014;
/** Cavernas: solo por debajo de esta altura, donde el ruido supera CAVERN_LEVEL. */
const CAVERN_TOP = 44;
const CAVERN_LEVEL = 0.6;

/**
 * Cada tipo de árbol: tronco, follaje y capas de la copa como [altura
 * relativa a la punta del tronco, radio].
 */
const TREE_KINDS = {
  // El de siempre: dos capas anchas, una más chica y la punta.
  oak: { log: BLOCK.LOG, leaves: BLOCK.LEAVES, layers: [[-2, 2], [-1, 2], [0, 1], [1, 1]] },
  // Pino: alto y en punta, con pisos que se angostan.
  pine: { log: BLOCK.PINE_LOG, leaves: BLOCK.PINE_LEAVES, layers: [[-4, 2], [-3, 1], [-2, 2], [-1, 1], [0, 1], [1, 0], [2, 0]] },
  // Jacarandá: copa ancha y chata.
  jacaranda: { log: BLOCK.JACARANDA_LOG, leaves: BLOCK.JACARANDA_LEAVES, layers: [[-1, 3], [0, 3], [1, 2]] },
};

export class TerrainGenerator {
  /**
   * @param {number} seed semilla del mundo (entero de 32 bits)
   * @param {number} [generation] versión del generador (ver GENERATION)
   */
  constructor(seed, generation = GENERATION) {
    this.seed = seed >>> 0;
    this.generation = validGeneration(generation);
    // Un ruido distinto para cada rasgo, todos derivados de la semilla.
    const noise = (salt) => createNoise2D(mulberry32(hash3(this.seed, salt, 7919)));
    this.nContinent = noise(1); // elevación general (llanuras / zonas bajas)
    this.nHills = noise(2); // colinas
    this.nMountainMask = noise(3); // dónde hay montañas
    this.nRidge = noise(4); // crestas de las montañas
    this.nDetail = noise(5); // variación chica de la superficie
    this.nForest = noise(6); // zonas de bosque
    this.nDirt = noise(7); // espesor de la capa de tierra
    const noise3 = (salt) => createNoise3D(mulberry32(hash3(this.seed, salt, 104729)));
    this.nTunnelA = noise3(1); // túneles: donde los dos ruidos valen casi 0
    this.nTunnelB = noise3(2);
    this.nCavern = noise3(3); // cavernas grandes
  }

  /** Ruido fractal (fBm): suma de octavas, resultado aproximado en [-1, 1]. */
  _fbm(noise, x, z, octaves) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, z * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  /**
   * Altura del terreno (y del bloque de la superficie) en la columna (x, z).
   * Biomas: acá se van a mezclar las alturas según el bioma de la zona.
   */
  heightAt(x, z) {
    const continent = this._fbm(this.nContinent, x / 220, z / 220, 4);
    const hills = this._fbm(this.nHills, x / 70, z / 70, 3);
    const detail = this.nDetail(x / 18, z / 18);
    // Máscara de montañas: casi siempre 0; en algunas zonas sube a 1.
    const mask = smoothstep(0.15, 0.6, this._fbm(this.nMountainMask, x / 420, z / 420, 2));
    // Crestas: 1 - |ruido| hace picos afilados.
    const ridge = 1 - Math.abs(this._fbm(this.nRidge, x / 110, z / 110, 3));

    let h = SEA_LEVEL + 3;
    h += continent * 12; // llanuras que a veces bajan del nivel del mar
    h += hills * (4 + 6 * smoothstep(-0.2, 0.5, continent)); // colinas
    h += detail * 1.2;
    h += mask * ridge * ridge * 55; // montañas
    return Math.max(2, Math.min(MAX_TERRAIN, Math.floor(h)));
  }

  /** ¿La columna (x, z) es costa o fondo de agua? (para poner arena) */
  _isBeach(height) {
    return height <= SEA_LEVEL + 1;
  }

  /**
   * Genera los bloques de un chunk.
   * @returns {{data: Uint16Array, maxY: number}}
   */
  generateChunk(cx, cz) {
    const data = new Uint16Array(CHUNK_VOLUME);
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    let maxY = SEA_LEVEL;

    // 1) Columnas: lecho primordial, piedra, tierra, superficie y agua.
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightAt(x, z);
        const dirtDepth = 3 + (this.nDirt(x / 14, z / 14) > 0 ? 1 : 0);
        const beach = this._isBeach(h);
        const rocky = h >= ROCK_LINE;

        let top;
        let under;
        if (rocky) {
          top = h >= SNOW_LINE && this.generation >= 2 ? BLOCK.SNOW : BLOCK.STONE;
          under = BLOCK.STONE;
        } else if (beach) {
          // Costas y fondo poco profundo de arena; más hondo, tierra.
          top = h >= SEA_LEVEL - 5 ? BLOCK.SAND : BLOCK.DIRT;
          under = top;
        } else {
          top = BLOCK.GRASS;
          under = BLOCK.DIRT;
        }

        data[Chunk.index(lx, 0, lz)] = BLOCK.BEDROCK;
        for (let y = 1; y <= h; y++) {
          let id = BLOCK.STONE;
          if (y === h) id = top;
          else if (y >= h - dirtDepth) id = under; // dirtDepth bloques debajo de la superficie
          data[Chunk.index(lx, y, lz)] = id;
        }
        for (let y = h + 1; y <= SEA_LEVEL; y++) data[Chunk.index(lx, y, lz)] = BLOCK.WATER;
        if (h > maxY) maxY = h;
      }
    }

    // 2) Cuevas, y después vetas de mineral (solo reemplazan piedra: las
    // que tocan una cueva se ven en sus paredes).
    if (this.generation >= 3) this._carveCaves(data, cx, cz);
    this._placeOres(data, cx, cz);

    // 3) Árboles: se miran también las celdas vecinas, porque la copa de un
    // árbol de otro chunk puede caer adentro de este.
    maxY = Math.max(maxY, this._placeTrees(data, cx, cz));

    // 4) Pasto alto, helechos, flores y hongos sobre el césped libre.
    if (this.generation >= 2) maxY = Math.max(maxY, this._placePlants(data, cx, cz));

    return { data, maxY: Math.min(CHUNK_HEIGHT - 1, maxY) };
  }

  /**
   * ¿Hay cueva en (x, y, z)? Túneles: donde dos ruidos 3D valen casi cero a
   * la vez (una "línea" que serpentea). Cavernas: donde un ruido más suave
   * es alto, solo en lo hondo.
   */
  isCave(x, y, z) {
    const a = this.nTunnelA(x / 42, y / 22, z / 42);
    const b = this.nTunnelB(x / 42, y / 22, z / 42);
    if (a * a + b * b < TUNNEL_WIDTH) return true;
    return y < CAVERN_TOP && this.nCavern(x / 64, y / 26, z / 64) > CAVERN_LEVEL + (y / CAVERN_TOP) * 0.12;
  }

  /**
   * Talla las cuevas. Bajo el agua (y en la costa) dejan un techo de 6
   * bloques, así el mar no queda colgando sobre un hueco; en tierra firme
   * pueden salir a la superficie (las entradas).
   */
  _carveCaves(data, cx, cz) {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightAt(x, z);
        const top = h <= SEA_LEVEL + 2 ? Math.min(h - 6, SEA_LEVEL - 6) : h;
        for (let y = CAVE_FLOOR; y <= top; y++) {
          if (this.isCave(x, y, z)) data[Chunk.index(lx, y, lz)] = BLOCK.AIR;
        }
      }
    }
  }

  _placeOres(data, cx, cz) {
    const rnd = mulberry32(hash3(this.seed, cx, cz, 31337));
    const ores = this.generation >= 3 ? [...ORES, COAL] : ORES;
    for (const ore of ores) {
      for (let v = 0; v < ore.perChunk; v++) {
        let x = Math.floor(rnd() * CHUNK_SIZE);
        let z = Math.floor(rnd() * CHUNK_SIZE);
        let y = ore.minY + Math.floor(rnd() * (ore.maxY - ore.minY));
        const size = ore.size[0] + Math.floor(rnd() * (ore.size[1] - ore.size[0] + 1));
        // Caminata al azar: la veta es un grupito de bloques pegados.
        for (let i = 0; i < size; i++) {
          if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y > 0 && y < CHUNK_HEIGHT) {
            const idx = Chunk.index(x, y, z);
            if (data[idx] === BLOCK.STONE) data[idx] = ore.id;
          }
          const dir = Math.floor(rnd() * 6);
          if (dir === 0) x++;
          else if (dir === 1) x--;
          else if (dir === 2) y++;
          else if (dir === 3) y--;
          else if (dir === 4) z++;
          else z--;
        }
      }
    }
  }

  /**
   * ¿Hay un árbol en la celda (gx, gz)? Devuelve su posición y forma, o null.
   * Es una función pura de la semilla y la celda.
   */
  treeInCell(gx, gz) {
    const x = gx * TREE_CELL + Math.floor(hash01(this.seed, gx, gz, 1) * TREE_CELL);
    const z = gz * TREE_CELL + Math.floor(hash01(this.seed, gx, gz, 2) * TREE_CELL);
    // Bosques donde el ruido es alto; árboles sueltos en el resto.
    const forest = this.nForest(x / 90, z / 90);
    const chance = forest > 0.25 ? 0.7 : forest > -0.1 ? 0.18 : 0.04;
    if (hash01(this.seed, gx, gz, 3) >= chance) return null;
    const ground = this.heightAt(x, z);
    // Solo sobre césped: ni playa, ni agua, ni piedra pelada.
    if (this._isBeach(ground) || ground >= ROCK_LINE - 4) return null;
    // En las alturas, pinos; en el llano y fuera del bosque, a veces un
    // jacarandá; si no, el árbol de siempre.
    let kind = 'oak';
    if (this.generation < 2) kind = 'oak';
    else if (ground >= PINE_LINE) kind = 'pine';
    else if (forest <= 0.25 && hash01(this.seed, gx, gz, 5) < 0.3) kind = 'jacaranda';
    const extra = kind === 'pine' ? 3 : 0;
    const trunk = 4 + extra + Math.floor(hash01(this.seed, gx, gz, 4) * 3);
    return { x, z, base: ground + 1, trunk, kind };
  }

  /** Coloca los árboles que tocan el chunk. Devuelve la altura máxima usada. */
  _placeTrees(data, cx, cz) {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    let maxY = 0;
    const set = (x, y, z, id, onlyAir) => {
      const lx = x - x0;
      const lz = z - z0;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      const idx = Chunk.index(lx, y, lz);
      if (onlyAir && data[idx] !== BLOCK.AIR) return;
      data[idx] = id;
      if (y > maxY) maxY = y;
    };

    const g0x = Math.floor((x0 - TREE_RADIUS) / TREE_CELL);
    const g1x = Math.floor((x0 + CHUNK_SIZE - 1 + TREE_RADIUS) / TREE_CELL);
    const g0z = Math.floor((z0 - TREE_RADIUS) / TREE_CELL);
    const g1z = Math.floor((z0 + CHUNK_SIZE - 1 + TREE_RADIUS) / TREE_CELL);
    for (let gz = g0z; gz <= g1z; gz++) {
      for (let gx = g0x; gx <= g1x; gx++) {
        const t = this.treeInCell(gx, gz);
        if (!t) continue;
        // Si una cueva se comió el suelo, no hay árbol.
        if (this.generation >= 3 && this.isCave(t.x, t.base - 1, t.z)) continue;
        const top = t.base + t.trunk; // primera altura por encima del tronco
        const { log, leaves, layers } = TREE_KINDS[t.kind];
        // Copa: capas de hojas (altura relativa a la punta del tronco y radio).
        for (const [dy, r] of layers) {
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
              // Esquinas recortadas (al azar en las capas anchas) para que
              // la copa no sea un cubo perfecto.
              const corner = Math.abs(dx) === r && Math.abs(dz) === r;
              if (corner && (r === 1 || hash01(this.seed, t.x + dx, t.z + dz, top + dy) < 0.6)) continue;
              set(t.x + dx, top + dy, t.z + dz, leaves, true);
            }
          }
        }
        // Tronco (pisa las hojas de la copa).
        for (let i = 0; i < t.trunk; i++) set(t.x, t.base + i, t.z, log, false);
        // Debajo del tronco, tierra en vez de césped.
        set(t.x, t.base - 1, t.z, BLOCK.DIRT, false);
      }
    }
    return maxY;
  }

  /**
   * Plantas sobre el césped que quedó libre (después de los árboles): pasto
   * alto suelto, flores por manchones, y en el bosque helechos y algún hongo.
   * Devuelve la altura máxima usada.
   */
  _placePlants(data, cx, cz) {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    let maxY = 0;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        const h = this.heightAt(x, z);
        if (h + 1 >= CHUNK_HEIGHT) continue;
        if (data[Chunk.index(lx, h, lz)] !== BLOCK.GRASS || data[Chunk.index(lx, h + 1, lz)] !== BLOCK.AIR) continue;
        const r = hash01(this.seed, x, z, 41);
        const forest = this.nForest(x / 90, z / 90) > 0.25;
        // Cada manchón tiene (o no) su flor; adentro, salpicada.
        const px = Math.floor(x / PATCH);
        const pz = Math.floor(z / PATCH);
        const patch = hash01(this.seed, px, pz, 43);
        let plant = BLOCK.AIR;
        if (forest && r < 0.05) plant = BLOCK.FERN;
        else if (forest && r < 0.056) plant = BLOCK.MUSHROOM;
        else if (patch < 0.35 && r > 0.88) plant = FLOWERS[Math.floor(hash01(this.seed, px, pz, 44) * FLOWERS.length)];
        else if (r > 0.12 && r < 0.22) plant = BLOCK.TALL_GRASS;
        if (plant === BLOCK.AIR) continue;
        data[Chunk.index(lx, h + 1, lz)] = plant;
        if (h + 1 > maxY) maxY = h + 1;
      }
    }
    return maxY;
  }

  /** ¿Están libres (aire) el bloque (x, y, z) y el de arriba? */
  _isClear(x, y, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const { data } = this.generateChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    // Las plantas se atraviesan: cuentan como libres.
    const free = (id) => !getBlock(id).solid && !getBlock(id).liquid;
    return free(data[Chunk.index(lx, y, lz)]) && free(data[Chunk.index(lx, y + 1, lz)]);
  }

  /**
   * Busca un buen lugar para aparecer: tierra firme cerca del origen (ni
   * agua ni la cima de una montaña). Recorre anillos cada vez más grandes.
   * @returns {{x: number, y: number, z: number}} posición de los pies
   */
  findSpawn() {
    for (let r = 0; r <= 512; r += 8) {
      const samples = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 8);
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r);
        const z = Math.round(Math.sin(a) * r);
        const h = this.heightAt(x, z);
        if (h <= SEA_LEVEL + 1 || h >= ROCK_LINE - 8) continue;
        // Que no haya un tronco ni hojas donde van los pies y la cabeza, ni
        // la boca de una cueva debajo.
        if (!this._isClear(x, h + 1, z)) continue;
        if (this.generation >= 3 && this.isCave(x, h, z)) continue;
        return { x: x + 0.5, y: h + 1, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: Math.max(SEA_LEVEL, this.heightAt(0, 0)) + 1, z: 0.5 };
  }
}

/**
 * Convierte un texto de semilla en un entero de 32 bits. Un número se usa
 * tal cual; cualquier otro texto se transforma con un hash.
 */
export function parseSeed(text) {
  const s = String(text ?? '').trim();
  if (/^-?\d+$/.test(s)) return Number(BigInt.asUintN(32, BigInt(s)));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
