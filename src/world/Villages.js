// Aldeas (etapa 16): cada tanto, en terreno llano, una aldea con una plaza y
// su pozo, caminos de grava con faroles y casas de distintos materiales
// (con techo a dos aguas, puerta, ventanas y luz adentro). Ahí viven los
// aldeanos (ver villages/Villagers.js).
//
// Todo sale de la semilla y de la altura del terreno (TerrainGen.heightAt),
// sin mirar chunks: cada chunk estampa su pedazo de cada aldea que lo toca,
// solo, y el plano de cada aldea se arma una vez y se guarda (también en
// cada worker). Módulo puro: sin DOM ni Three.js.

import { BLOCK, getBlock } from './blocks.js';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk.js';

/** El mundo se divide en celdas de este lado; cada una puede tener una aldea. */
export const VILLAGE_CELL = 320;
/** Probabilidad de que una celda tenga aldea (si el terreno sirve). */
const VILLAGE_CHANCE = 0.6;
/** Radio de lo que ocupa una aldea (caminos y casas), con margen. */
export const VILLAGE_RADIUS = 40;
/** Alturas donde puede haber aldea: sobre el agua y debajo de los pinos. */
const MIN_GROUND = 42;
const MAX_GROUND = 62;
/** Desnivel máximo del terreno donde va la aldea. */
const MAX_SLOPE = 12;
/** Cuántos lugares de la zona pueden ser agua (de 81 que se miran). */
const MAX_WET = 8;
/** Planos guardados (los que se usan seguido). */
const CACHE_SIZE = 64;

/** Hacia dónde: norte (-Z), este (+X), sur (+Z), oeste (-X) (como FACING). */
const DIR = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Nombres de los aldeanos (uno por casa) y sus oficios (ver villages/trades.js). */
const NAMES = ['Rosa', 'Tito', 'Chela', 'Beto', 'Nilda', 'Pocho', 'Marta', 'Lalo', 'Mirta', 'Tano', 'Cacho', 'Norma', 'Rubén', 'Elsa', 'Quique', 'Tota'];

/** Materiales de las casas: paredes, columnas de las esquinas, techo (con escalones) y piso. */
const STYLES = [
  { wall: 'PLANKS', post: 'LOG', roof: 'ROOF_RED', floor: 'PLANKS_DARK' },
  { wall: 'COBBLE', post: 'STONE_BRICK', roof: 'ROOF_GRAY', floor: 'PLANKS' },
  { wall: 'PLASTER_WHITE', post: 'PLANKS_DARK', roof: 'ROOF_RED', floor: 'PLANKS' },
  { wall: 'BRICKS', post: 'STONE_BRICK', roof: 'ROOF_GRAY', floor: 'PLANKS_DARK' },
  { wall: 'PLASTER_CREAM', post: 'LOG', roof: 'PLANKS', floor: 'PLANKS_DARK' },
];
/** Tamaños de las casas: ancho (frente) y fondo. */
const SIZES = [
  [5, 5],
  [7, 5],
  [7, 6],
];

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

function hash3(seed, a, b, c = 0) {
  let h = seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const chunkKey = (cx, cz) => `${cx},${cz}`;

/**
 * Las aldeas de un mundo: dónde están y sus planos.
 */
export class VillagePlanner {
  /**
   * @param {number} seed semilla del mundo
   * @param {(x: number, z: number) => number} heightAt altura del terreno
   */
  constructor(seed, heightAt) {
    this.seed = seed >>> 0;
    this.heightAt = heightAt;
    /** @type {Map<string, object | null>} */
    this._cache = new Map();
  }

  /** El plano de la aldea de la celda (gx, gz), o null si no tiene. */
  villageAt(gx, gz) {
    const key = `${gx},${gz}`;
    if (this._cache.has(key)) {
      // Al final: es de los usados hace poco.
      const plan = this._cache.get(key);
      this._cache.delete(key);
      this._cache.set(key, plan);
      return plan;
    }
    const plan = this._plan(gx, gz);
    this._cache.set(key, plan);
    if (this._cache.size > CACHE_SIZE) this._cache.delete(this._cache.keys().next().value);
    return plan;
  }

  /** Aldeas cuya zona toca el rectángulo [x0, x1] × [z0, z1] (con un margen). */
  villagesTouching(x0, z0, x1, z1, margin = 0) {
    const r = VILLAGE_RADIUS + margin;
    const out = [];
    const g0x = Math.floor((x0 - r) / VILLAGE_CELL);
    const g1x = Math.floor((x1 + r) / VILLAGE_CELL);
    const g0z = Math.floor((z0 - r) / VILLAGE_CELL);
    const g1z = Math.floor((z1 + r) / VILLAGE_CELL);
    for (let gz = g0z; gz <= g1z; gz++) {
      for (let gx = g0x; gx <= g1x; gx++) {
        const v = this.villageAt(gx, gz);
        if (v && v.maxX + margin >= x0 && v.minX - margin <= x1 && v.maxZ + margin >= z0 && v.minZ - margin <= z1) out.push(v);
      }
    }
    return out;
  }

  /** ¿La columna (x, z) es parte de una aldea (con un margen)? */
  inVillage(x, z, margin = 0) {
    return this.villagesTouching(x, z, x, z, margin).length > 0;
  }

  /**
   * Estampa en un chunk los bloques de las aldeas que lo tocan. Devuelve la
   * altura del bloque más alto que puso (0 si ninguno).
   */
  stamp(data, cx, cz) {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    let maxY = 0;
    for (const v of this.villagesTouching(x0, z0, x0 + CHUNK_SIZE - 1, z0 + CHUNK_SIZE - 1)) {
      const list = v.blocks.get(chunkKey(cx, cz));
      if (!list) continue;
      for (let i = 0; i < list.length; i += 2) {
        data[list[i]] = list[i + 1];
        const y = list[i] >> 8;
        if (list[i + 1] !== BLOCK.AIR && y > maxY) maxY = y;
      }
    }
    return maxY;
  }

  // ---------------------------------------------------------------------------
  // Plano de una aldea
  // ---------------------------------------------------------------------------

  _plan(gx, gz) {
    const rnd = mulberry32(hash3(this.seed, gx, gz, 7717));
    if (rnd() >= VILLAGE_CHANCE) return null;
    // Se prueban varios lugares de la celda: el primero con terreno llano,
    // casi sin agua y sin montaña.
    const margin = VILLAGE_RADIUS + 8;
    let vx = 0;
    let vz = 0;
    let ok = false;
    for (let attempt = 0; attempt < 10 && !ok; attempt++) {
      vx = gx * VILLAGE_CELL + margin + Math.floor(rnd() * (VILLAGE_CELL - 2 * margin));
      vz = gz * VILLAGE_CELL + margin + Math.floor(rnd() * (VILLAGE_CELL - 2 * margin));
      ok = this._suitable(vx, vz);
    }
    if (!ok) return null;

    const plan = {
      id: hash3(this.seed, gx, gz, 4242) & 0x3ffffff,
      gx,
      gz,
      x: vx,
      z: vz,
      y: this.heightAt(vx, vz),
      houses: [],
      blocks: new Map(),
      minX: vx,
      maxX: vx,
      minZ: vz,
      maxZ: vz,
    };
    const cells = new Map(); // chunk → Map(índice → id)
    const set = (x, y, z, id) => {
      if (y < 1 || y >= CHUNK_HEIGHT) return;
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const key = chunkKey(cx, cz);
      let m = cells.get(key);
      if (!m) cells.set(key, (m = new Map()));
      m.set(Chunk.index(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE), id);
      plan.minX = Math.min(plan.minX, x);
      plan.maxX = Math.max(plan.maxX, x);
      plan.minZ = Math.min(plan.minZ, z);
      plan.maxZ = Math.max(plan.maxZ, z);
    };
    const used = []; // rectángulos ocupados (plaza, caminos y casas) [x0, z0, x1, z1]
    const homes = []; // solo las casas
    const apart = (list, x0, z0, x1, z1) => list.every(([a, b, c, d]) => x1 < a - 1 || x0 > c + 1 || z1 < b - 1 || z0 > d + 1);
    const free = (...r) => apart(used, ...r);

    // Caminos: 2 a 4, desde la plaza hacia los costados (primero, así las
    // casas no los pisan).
    const dirs = [0, 1, 2, 3].sort(() => rnd() - 0.5).slice(0, 2 + Math.floor(rnd() * 3));
    const roads = dirs.map((d) => ({ d, len: 16 + Math.floor(rnd() * 12) }));
    used.push([vx - 4, vz - 4, vx + 4, vz + 4]); // la plaza
    const lamps = [];
    for (const road of roads) lamps.push(...this._road(set, vx, vz, road, used));
    this._plaza(set, plan.y, vx, vz);

    // Casas a los costados de los caminos, mirando al camino.
    let n = 0;
    for (const road of roads) {
      const [dx, dz] = DIR[road.d];
      for (let along = 7; along + 4 <= road.len + 2 && n < 7; along += 8) {
        for (const side of [1, -1]) {
          if (n >= 7 || rnd() < 0.2) continue;
          const [w, depth] = SIZES[Math.floor(rnd() * SIZES.length)];
          const style = STYLES[Math.floor(rnd() * STYLES.length)];
          // Lado: a la derecha o a la izquierda del camino; el frente da al camino.
          const sx = -dz * side;
          const sz = dx * side;
          const fx = vx + dx * along + sx * 3; // centro del frente
          const fz = vz + dz * along + sz * 3;
          const house = this._fitHouse(fx, fz, sx, sz, w, depth);
          if (!free(...house.rect)) continue;
          used.push(house.rect);
          homes.push(house.rect);
          house.name = NAMES[(plan.id + n * 7) % NAMES.length];
          house.index = n;
          this._house(set, house, style, rnd);
          plan.houses.push(house);
          n++;
        }
      }
    }
    if (n < 3) return null; // muy pocas casas: no es una aldea
    // Faroles donde no hay una casa al lado.
    for (const [x, z, h] of lamps) {
      if (!apart(homes, x, z, x, z)) continue;
      set(x, h + 1, z, BLOCK.FENCE_WOOD);
      set(x, h + 2, z, BLOCK.FENCE_WOOD);
      set(x, h + 3, z, BLOCK.LAMP);
    }
    plan.minX -= 2;
    plan.maxX += 2;
    plan.minZ -= 2;
    plan.maxZ += 2;
    // A arrays planos [índice, id, ...] por chunk.
    for (const [key, m] of cells) {
      const arr = new Int32Array(m.size * 2);
      let i = 0;
      for (const [index, id] of m) {
        arr[i++] = index;
        arr[i++] = id;
      }
      plan.blocks.set(key, arr);
    }
    return plan;
  }

  /** ¿Sirve el terreno alrededor de (x, z) para una aldea? */
  _suitable(x, z) {
    const center = this.heightAt(x, z);
    if (center < MIN_GROUND || center > MAX_GROUND) return false;
    let lo = Infinity;
    let hi = -Infinity;
    let wet = 0;
    for (let dz = -28; dz <= 28; dz += 7) {
      for (let dx = -28; dx <= 28; dx += 7) {
        const h = this.heightAt(x + dx, z + dz);
        if (h <= 40) wet++;
        else {
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      }
    }
    return wet <= MAX_WET && hi <= MAX_GROUND + 4 && hi - lo <= MAX_SLOPE;
  }

  /** Plaza de 7 x 7 al nivel del centro, con el pozo en el medio. */
  _plaza(set, y, vx, vz) {
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = vx + dx;
        const z = vz + dz;
        const h = this.heightAt(x, z);
        for (let k = h; k < y; k++) set(x, k, z, BLOCK.DIRT);
        const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
        set(x, y, z, edge ? BLOCK.GRAVEL : BLOCK.COBBLE);
        for (let k = y + 1; k <= Math.max(y + 5, h + 2); k++) set(x, k, z, BLOCK.AIR);
      }
    }
    // Pozo: borde de piedra, agua adentro, cuatro postes y techito.
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = vx + dx;
        const z = vz + dz;
        if (dx === 0 && dz === 0) {
          for (let k = y - 3; k <= y; k++) set(x, k, z, BLOCK.WATER);
          continue;
        }
        set(x, y, z, BLOCK.COBBLE);
        set(x, y + 1, z, BLOCK.COBBLE);
        if (dx !== 0 && dz !== 0) {
          set(x, y + 2, z, BLOCK.FENCE_WOOD);
          set(x, y + 3, z, BLOCK.FENCE_WOOD);
        }
        set(x, y + 4, z, BLOCK.PLANKS_SLAB);
      }
    }
    set(vx, y + 4, vz, BLOCK.PLANKS_SLAB);
  }

  /**
   * Un camino de grava de 3 de ancho, siguiendo el terreno. Lo ocupa en
   * `used` (las casas no lo pisan) y devuelve dónde van sus faroles [x, z, altura].
   */
  _road(set, vx, vz, { d, len }, used) {
    const [dx, dz] = DIR[d];
    const px = -dz;
    const pz = dx;
    const lamps = [];
    const ends = [
      [vx + dx * 3 - px, vz + dz * 3 - pz],
      [vx + dx * len + px, vz + dz * len + pz],
    ];
    used.push([
      Math.min(ends[0][0], ends[1][0]),
      Math.min(ends[0][1], ends[1][1]),
      Math.max(ends[0][0], ends[1][0]),
      Math.max(ends[0][1], ends[1][1]),
    ]);
    for (let along = 3; along <= len; along++) {
      for (let w = -1; w <= 1; w++) {
        const x = vx + dx * along + px * w;
        const z = vz + dz * along + pz * w;
        const h = this.heightAt(x, z);
        // Sobre el agua, un puentecito de tablones.
        if (h < 40) set(x, 40, z, BLOCK.PLANKS);
        else set(x, h, z, BLOCK.GRAVEL);
        for (let k = Math.max(h, 40) + 1; k <= Math.max(h, 40) + 3; k++) set(x, k, z, BLOCK.AIR);
      }
      // Faroles a los costados, alternados (entre las casas).
      if (along % 8 === 3) {
        const side = along % 16 === 3 ? 2 : -2;
        const x = vx + dx * along + px * side;
        const z = vz + dz * along + pz * side;
        const h = this.heightAt(x, z);
        if (h >= 40) lamps.push([x, z, h]);
      }
    }
    return lamps;
  }

  /**
   * Ubica una casa: (fx, fz) es el medio de su frente y (sx, sz) hacia
   * dónde va el fondo (alejándose del camino). Devuelve su base: el
   * rectángulo que ocupa, a qué altura está el piso y dónde está la puerta.
   */
  _fitHouse(fx, fz, sx, sz, w, depth) {
    // Ejes de la casa: u a lo ancho del frente, v hacia el fondo.
    const ux = -sz;
    const uz = sx;
    const half = Math.floor(w / 2);
    const at = (u, v) => [fx + ux * (u - half) + sx * v, fz + uz * (u - half) + sz * v];
    const corners = [at(0, 0), at(w - 1, 0), at(0, depth - 1), at(w - 1, depth - 1)];
    const xs = corners.map((c) => c[0]);
    const zs = corners.map((c) => c[1]);
    const rect = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
    const [cx, cz] = at(half, Math.floor(depth / 2));
    const floor = this.heightAt(cx, cz);
    // Hacia dónde mira la puerta desde afuera (de frente a la casa).
    const facing = DIR.findIndex(([a, b]) => a === sx && b === sz);
    const [doorX, doorZ] = at(half, 0);
    return {
      w,
      depth,
      at,
      rect,
      floor,
      facing,
      sx,
      sz,
      door: { x: doorX, y: floor + 1, z: doorZ },
      // Donde espera el aldeano: delante de la puerta.
      spot: { x: doorX - sx * 2 + 0.5, y: floor + 1, z: doorZ - sz * 2 + 0.5 },
      center: { x: cx + 0.5, z: cz + 0.5 },
    };
  }

  /** Arma una casa (ver _fitHouse) con su estilo. */
  _house(set, house, style, rnd) {
    const { w, depth, at, floor: g, facing } = house;
    const wall = BLOCK[style.wall];
    const post = BLOCK[style.post];
    const floorId = BLOCK[style.floor];
    const roofHeight = Math.ceil(depth / 2) + 1;
    const top = g + 4 + roofHeight;
    // Base: cimiento hasta el terreno, piso y aire adentro.
    for (let v = -1; v <= depth; v++) {
      for (let u = -1; u <= w; u++) {
        const [x, z] = at(u, v);
        const inside = u >= 0 && u < w && v >= 0 && v < depth;
        const h = this.heightAt(x, z);
        if (inside) {
          for (let k = Math.min(h, g - 1); k < g; k++) set(x, k, z, BLOCK.COBBLE);
          set(x, g, z, floorId);
        } else if (h < g) {
          // Alrededor, la tierra rellena hasta el nivel del piso.
          for (let k = h + 1; k < g; k++) set(x, k, z, BLOCK.DIRT);
          set(x, g, z, BLOCK.GRASS);
        }
        for (let k = g + 1; k <= Math.max(top, h + 1); k++) set(x, k, z, BLOCK.AIR);
      }
    }
    // Paredes (3 de alto) con columnas en las esquinas.
    for (let v = 0; v < depth; v++) {
      for (let u = 0; u < w; u++) {
        const edgeU = u === 0 || u === w - 1;
        const edgeV = v === 0 || v === depth - 1;
        if (!edgeU && !edgeV) continue;
        const [x, z] = at(u, v);
        for (let k = g + 1; k <= g + 3; k++) set(x, k, z, edgeU && edgeV ? post : wall);
      }
    }
    // Ventanas a los costados y en el fondo, y a los lados de la puerta.
    const half = Math.floor(w / 2);
    const window = (u, v) => {
      const [x, z] = at(u, v);
      set(x, g + 2, z, BLOCK.GLASS_PANE);
    };
    for (let v = 1; v < depth - 1; v += 2) {
      window(0, v);
      window(w - 1, v);
    }
    for (let u = 1; u < w - 1; u += 2) if (u !== half) window(u, depth - 1);
    if (w >= 7) {
      window(half - 2, 0);
      window(half + 2, 0);
    }
    // Puerta en el medio del frente.
    const doors = getBlock(BLOCK.DOOR_WOOD_0_CLOSED_BOTTOM).doorIds;
    const [dx0, dz0] = at(half, 0);
    set(dx0, g + 1, dz0, doors[`${facing}00`]);
    set(dx0, g + 2, dz0, doors[`${facing}01`]);
    // Antorchas afuera, a los costados de la puerta (contra el frente).
    const out = (facing + 2) % 4; // mirando al camino
    for (const du of [-1, 1]) {
      const [tx, tz] = at(half + du, -1);
      set(tx, g + 2, tz, BLOCK[`TORCH_${out + 1}`]);
    }
    // Adentro: un farol en un rincón del fondo y una biblioteca o una alfombra.
    const [lx, lz] = at(1, depth - 2);
    set(lx, g + 1, lz, BLOCK.LAMP);
    const [bx, bz] = at(w - 2, depth - 2);
    set(bx, g + 1, bz, rnd() < 0.5 ? BLOCK.BOOKSHELF : BLOCK.CARPET_RED);
    // Techo a dos aguas: escalones bajando hacia el frente y el fondo, con
    // la cumbrera arriba; los costados (u = 0 y w - 1) cierran el triángulo.
    const roofStairs = (dir) => BLOCK[`${style.roof}_STAIRS_${dir}`];
    const inDir = DIR.findIndex(([a, b]) => a === house.sx && b === house.sz); // hacia el fondo
    const outDir = (inDir + 2) % 4;
    for (let k = 0; ; k++) {
      const front = k - 1;
      const back = depth - k;
      // El alero (k = 0) a la altura de lo alto de las paredes.
      const y = g + 3 + k;
      if (front > back) break;
      for (let u = -1; u <= w; u++) {
        const edge = u === -1 || u === w;
        if (front === back) {
          const [x, z] = at(u, front);
          set(x, y, z, BLOCK[`${style.roof}_SLAB`] ?? wall);
          continue;
        }
        const [ax, az] = at(u, front);
        const [bx2, bz2] = at(u, back);
        // Frente: la parte alta hacia el fondo; fondo: hacia el frente.
        set(ax, y, az, roofStairs(inDir));
        set(bx2, y, bz2, roofStairs(outDir));
        // El triángulo de los costados, entre las dos aguas.
        if (!edge && (u === 0 || u === w - 1)) {
          for (let v = front + 1; v < back; v++) {
            const [x, z] = at(u, v);
            set(x, y, z, wall);
          }
        }
      }
    }
  }
}
