// Generación procedural del atlas de texturas (pixel art 16x16).
//
// Todas las texturas se dibujan por código en un canvas 2D, píxel por píxel,
// con un generador pseudoaleatorio con semilla: el resultado es siempre el
// mismo y no hace falta ningún archivo de imagen externo.

import * as THREE from 'three';
import {
  ATLAS_SIZE,
  TILE_NAMES,
  TILE_PADDING,
  TILE_SIZE,
  tilePixelOrigin,
} from './atlasLayout.js';

const S = TILE_SIZE;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Generador pseudoaleatorio mulberry32: rápido y determinista. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash simple de un texto a entero de 32 bits (semilla por textura). */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * Lienzo de una textura de 16x16 sobre un ImageData. Ofrece helpers para
 * pintar píxeles con colores [r, g, b] o [r, g, b, a].
 */
class TilePainter {
  constructor(imageData, ox, oy, rnd) {
    this.img = imageData;
    this.ox = ox;
    this.oy = oy;
    this.rnd = rnd;
  }

  /** Pinta el píxel (x, y) de la textura. Ignora coordenadas fuera de rango. */
  set(x, y, [r, g, b, a = 255]) {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = ((this.oy + y) * this.img.width + (this.ox + x)) * 4;
    const d = this.img.data;
    d[i] = clamp255(r);
    d[i + 1] = clamp255(g);
    d[i + 2] = clamp255(b);
    d[i + 3] = clamp255(a);
  }

  /** Lee el color actual del píxel (x, y). */
  get(x, y) {
    const i = ((this.oy + y) * this.img.width + (this.ox + x)) * 4;
    const d = this.img.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  /** Color base con variación aleatoria de brillo (±amount). */
  vary([r, g, b, a = 255], amount) {
    const k = (this.rnd() * 2 - 1) * amount;
    return [r + k, g + k, b + k, a];
  }

  /** Rellena toda la textura con un color base y ruido de brillo. */
  noiseFill(color, amount) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) this.set(x, y, this.vary(color, amount));
  }

  /** Salpica píxeles sueltos de un color con cierta probabilidad. */
  speckle(color, chance, amount = 8) {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) if (this.rnd() < chance) this.set(x, y, this.vary(color, amount));
  }

  /** Multiplica el brillo del píxel (para sombrear). */
  shade(x, y, factor) {
    const [r, g, b, a] = this.get(x, y);
    this.set(x, y, [r * factor, g * factor, b * factor, a]);
  }
}

// ---------------------------------------------------------------------------
// Paletas (colores originales de Megabrick)
// ---------------------------------------------------------------------------

const C = {
  grass: [96, 172, 64],
  grassDark: [70, 138, 46],
  grassLight: [128, 198, 84],
  dirt: [124, 90, 60],
  dirtDark: [94, 66, 42],
  dirtLight: [148, 110, 74],
  stone: [128, 129, 134],
  stoneDark: [98, 99, 106],
  stoneLight: [152, 153, 158],
  bedrock: [52, 50, 58],
  sand: [220, 204, 150],
  water: [52, 112, 204],
  bark: [104, 76, 46],
  barkDark: [76, 54, 32],
  wood: [184, 146, 94],
  leaves: [60, 134, 50],
  plank: [178, 134, 84],
  copper: [218, 122, 60],
  azurite: [64, 128, 234],
  solarite: [244, 204, 64],
  // Materiales de construcción (etapa 9).
  walnut: [108, 72, 44],
  birch: [220, 194, 148],
  cedar: [178, 108, 74],
  doorWood: [170, 120, 72],
  mortar: [184, 178, 168],
  marble: [232, 230, 226],
  sandstone: [224, 208, 158],
  straw: [204, 168, 80],
  iron: [54, 50, 54],
  metal: [182, 178, 168],
  brass: [214, 172, 76],
  glint: [236, 248, 255],
  // Revoques pintados: colores apagados, bien distintos entre sí.
  plasterWhite: [232, 229, 220],
  plasterCream: [232, 214, 170],
  plasterGray: [146, 147, 148],
  plasterBlack: [52, 51, 56],
  plasterRed: [168, 62, 54],
  plasterOrange: [212, 124, 62],
  plasterYellow: [226, 190, 82],
  plasterGreen: [110, 150, 88],
  plasterLightblue: [136, 180, 208],
  plasterBlue: [62, 94, 158],
  plasterPurple: [118, 82, 148],
  plasterPink: [220, 148, 160],
};

/** Envuelve una coordenada dentro de la textura (para dibujar sin costuras). */
const wrap = (v) => ((v % S) + S) % S;

/** Color con el brillo multiplicado por un factor. */
const tone = ([r, g, b], f) => [r * f, g * f, b * f];

/** Color con un desplazamiento de brillo (positivo aclara). */
const lift = ([r, g, b], k) => [r + k, g + k, b + k];

/** Mezcla de dos colores (t = 0 da el primero, t = 1 el segundo). */
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const TRANSPARENT = [0, 0, 0, 0];

// ---------------------------------------------------------------------------
// Pintores de cada textura
// ---------------------------------------------------------------------------

/** Racimos de mineral sobre piedra. */
function paintOre(p, color, highlight, clusters) {
  PAINTERS.stone(p);
  for (let c = 0; c < clusters; c++) {
    const cx = 2 + Math.floor(p.rnd() * (S - 4));
    const cy = 2 + Math.floor(p.rnd() * (S - 4));
    const n = 3 + Math.floor(p.rnd() * 3);
    for (let i = 0; i < n; i++) {
      const x = cx + Math.floor(p.rnd() * 3) - 1;
      const y = cy + Math.floor(p.rnd() * 3) - 1;
      p.set(x, y, p.vary(color, 14));
      // Sombra abajo a la derecha para dar volumen.
      if (p.rnd() < 0.5) p.set(x + 1, y + 1, p.vary(C.stoneDark, 6));
    }
    p.set(cx, cy, highlight);
  }
}

/**
 * Ruido suave que se repite cada 16 px: valores al azar en una grilla de n x n
 * que envuelve, interpolados. Devuelve una función (x, y) → [-1, 1].
 */
function tileNoise(p, n) {
  const grid = [];
  for (let i = 0; i < n * n; i++) grid.push(p.rnd() * 2 - 1);
  const cell = S / n;
  const at = (i, j) => grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const sx = smooth(fx - i);
    const sy = smooth(fy - j);
    const top = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return top + (bottom - top) * sy;
  };
}

/**
 * Cuatro tablas horizontales de 4 px como en 'planks' (veta, juntas oscuras y
 * uniones desfasadas), con otra madera.
 */
function paintBoards(p, base, { joint, seam, tints, seams }) {
  for (let y = 0; y < S; y++) {
    const tint = tints[Math.floor(y / 4)];
    for (let x = 0; x < S; x++) {
      p.set(x, y, y % 4 === 3 ? p.vary(joint, 3) : p.vary(lift(base, tint), 5));
    }
    // Veta: un trazo un poco más oscuro.
    if (y % 4 === 1) {
      const off = Math.floor(p.rnd() * 8);
      for (let k = 0; k < 5; k++) p.shade((off + k) % S, y, 0.88);
    }
  }
  // Uniones de tablas (desfasadas por fila).
  for (let b = 0; b < 4; b++) {
    const x = seams[b % 2];
    for (let y = b * 4; y < b * 4 + 3; y++) p.set(x, y, p.vary(seam, 3));
  }
}

/** Revoque pintado: color parejo con grano muy suave y algunos poros. */
function paintPlaster(p, color) {
  p.noiseFill(color, 3);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const r = p.rnd();
      if (r < 0.08) p.shade(x, y, 0.94);
      else if (r < 0.13) p.shade(x, y, 1.04);
    }
  }
  // Poros: píxeles sueltos un poco más oscuros.
  for (let i = 0; i < 4; i++) p.shade(Math.floor(p.rnd() * S), Math.floor(p.rnd() * S), 0.86);
}

/** Vidrio de puerta o ventana: transparente salvo algún brillo opaco. */
function paintPane(p, x0, y0, x1, y1, glints = []) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) p.set(x, y, TRANSPARENT);
  for (const [x, y] of glints) p.set(x, y, C.glint);
}

/** Picaporte metálico chico (2x2 con brillo y sombra) y el ojo de la cerradura debajo. */
function paintHandle(p, x, y, metal, keyholeDy) {
  p.set(x, y, lift(metal, 40));
  p.set(x + 1, y, metal);
  p.set(x, y + 1, tone(metal, 0.82));
  p.set(x + 1, y + 1, tone(metal, 0.55));
  p.set(x + 1, y + keyholeDy, [36, 30, 28]);
}

/**
 * Mitad de una puerta de tablas verticales (16x32 entre las dos mitades):
 * canto liso a los costados, ventanita arriba y moldura con picaporte abajo.
 */
function paintPlankDoor(p, bottom) {
  const base = C.doorWood;
  const frame = tone(base, 0.84);
  const tints = [5, -4, 2];
  for (let y = 0; y < S; y++) {
    const Y = y + (bottom ? S : 0); // fila dentro de la puerta entera
    for (let x = 0; x < S; x++) {
      let c;
      if (x === 0 || x === S - 1 || Y === 0 || Y === 2 * S - 1) {
        // Canto del marco, con bisel claro arriba/izquierda.
        c = tone(p.vary(frame, 3), x === 0 || Y === 0 ? 1.12 : 0.8);
      } else if (x === 5 || x === 10) {
        c = p.vary(tone(base, 0.62), 3); // junta entre tablas
      } else {
        c = p.vary(lift(base, tints[x < 5 ? 0 : x < 10 ? 1 : 2]), 5);
        if (x === 1 || x === 6 || x === 11) c = tone(c, 1.06);
        else if (x === 4 || x === 9 || x === 14) c = tone(c, 0.92);
      }
      p.set(x, y, c);
    }
  }
  // Veta vertical: trazos cortos más oscuros dentro de las tablas.
  const grainCols = [2, 3, 7, 8, 12, 13];
  for (let i = 0; i < 8; i++) {
    const x = grainCols[Math.floor(p.rnd() * grainCols.length)];
    const y0 = 1 + Math.floor(p.rnd() * 11);
    const len = 3 + Math.floor(p.rnd() * 3);
    for (let k = 0; k < len; k++) p.shade(x, y0 + k, 0.9);
  }
  if (!bottom) {
    // Ventanita de dos vidrios con su moldura.
    for (let y = 2; y <= 8; y++) {
      for (let x = 3; x <= 12; x++) {
        const f = y === 2 || x === 3 || x === 7 ? 1.2 : y === 8 || x === 12 || x === 8 ? 0.62 : 0;
        if (f) p.set(x, y, tone(p.vary(base, 3), f));
      }
    }
    paintPane(p, 4, 3, 6, 7, [[5, 4]]);
    paintPane(p, 9, 3, 11, 7, [[10, 4]]);
  } else {
    // Moldura rectangular (panel) y picaporte a la altura de la mitad.
    for (let y = 5; y <= 13; y++) {
      for (let x = 3; x <= 12; x++) {
        if (y === 5 || x === 3) p.set(x, y, tone(p.vary(base, 3), 1.2));
        else if (y === 13 || x === 12) p.set(x, y, tone(p.vary(base, 3), 0.62));
      }
    }
    paintHandle(p, 12, 1, C.metal, 3);
  }
}

/**
 * Mitad de una puerta de paneles de madera oscura: dos ventanitas arriba,
 * dos paneles hundidos abajo y picaporte de bronce en el travesaño del medio.
 */
function paintPanelDoor(p, bottom) {
  const base = C.walnut;
  for (let y = 0; y < S; y++) {
    const Y = y + (bottom ? S : 0);
    for (let x = 0; x < S; x++) {
      let c = p.vary(base, 4);
      if (x === 0 || Y === 0) c = tone(c, 1.16);
      else if (x === S - 1 || Y === 2 * S - 1) c = tone(c, 0.76);
      p.set(x, y, c);
    }
  }
  // Paneles hundidos: sombra arriba/izquierda, luz abajo/derecha.
  const panels = bottom ? [3, 13] : [2, 13];
  for (const x0 of [2, 9]) {
    const x1 = x0 + 4;
    const [y0, y1] = panels;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let f = 0.9;
        if (y === y0 || x === x0) f = 0.66;
        else if (y === y1 || x === x1) f = 1.18;
        p.shade(x, y, f);
      }
    }
    if (!bottom) {
      // Ventanita arriba del panel, con moldura debajo.
      paintPane(p, x0 + 1, 3, x0 + 3, 7, [[x0 + 2, 4]]);
      for (let x = x0 + 1; x <= x0 + 3; x++) p.shade(x, 8, 1.2);
    }
  }
  // Veta vertical suave en los largueros.
  for (let i = 0; i < 6; i++) {
    const x = [1, 7, 8, 14][Math.floor(p.rnd() * 4)];
    const y0 = Math.floor(p.rnd() * 12);
    for (let k = 0; k < 4; k++) p.shade(x, y0 + k, 0.9);
  }
  if (bottom) paintHandle(p, 11, 0, C.brass, 2);
}

/** Lomos de libros parados sobre un estante (de la fila 'top' a la 'bottom'). */
function paintBooks(p, top, bottom) {
  const colors = [
    [150, 54, 48],
    [60, 88, 140],
    [64, 116, 74],
    [176, 136, 62],
    [108, 64, 118],
    [52, 118, 124],
    [158, 96, 58],
    [118, 42, 46],
    [196, 180, 146],
  ];
  const room = bottom - top + 1;
  let x = 1;
  while (x <= S - 2) {
    if (p.rnd() < 0.08) {
      x++; // hueco entre libros
      continue;
    }
    const w = x < S - 2 && p.rnd() < 0.6 ? 2 : 1;
    const h = room - Math.floor(p.rnd() * 3);
    const col = colors[Math.floor(p.rnd() * colors.length)];
    const band = p.rnd() < 0.6 ? bottom - h + 2 : -1; // franja del título
    for (let i = 0; i < w; i++) {
      for (let k = 0; k < h; k++) {
        const y = bottom - k;
        let c = p.vary(col, 5);
        if (w === 2) c = tone(c, i === 0 ? 1.1 : 0.86);
        if (y === band) c = mix(c, [224, 198, 120], 0.55);
        p.set(x + i, y, c);
      }
    }
    x += w;
  }
}

const PAINTERS = {
  grass_top(p) {
    p.noiseFill(C.grass, 10);
    p.speckle(C.grassDark, 0.18, 6);
    p.speckle(C.grassLight, 0.1, 6);
  },

  dirt(p) {
    p.noiseFill(C.dirt, 10);
    p.speckle(C.dirtDark, 0.16, 6);
    p.speckle(C.dirtLight, 0.08, 6);
    // Algunas piedritas.
    for (let i = 0; i < 3; i++) {
      p.set(Math.floor(p.rnd() * S), Math.floor(p.rnd() * S), p.vary(C.stoneLight, 10));
    }
  },

  grass_side(p) {
    PAINTERS.dirt(p);
    // Borde de pasto que "chorrea" de forma irregular por cada columna.
    for (let x = 0; x < S; x++) {
      const depth = 3 + Math.floor(p.rnd() * 3) + (p.rnd() < 0.15 ? 2 : 0);
      for (let y = 0; y < depth; y++) {
        const base = y === depth - 1 ? C.grassDark : C.grass;
        p.set(x, y, p.vary(base, 10));
      }
    }
  },

  stone(p) {
    p.noiseFill(C.stone, 9);
    p.speckle(C.stoneDark, 0.12, 5);
    p.speckle(C.stoneLight, 0.08, 5);
    // Grietas: trazos cortos y oscuros.
    for (let i = 0; i < 4; i++) {
      let x = Math.floor(p.rnd() * S);
      let y = Math.floor(p.rnd() * S);
      const len = 2 + Math.floor(p.rnd() * 3);
      for (let k = 0; k < len; k++) {
        p.set(x, y, p.vary(C.stoneDark, 4));
        x += p.rnd() < 0.5 ? 1 : 0;
        y += p.rnd() < 0.5 ? 1 : -1;
      }
    }
  },

  bedrock(p) {
    p.noiseFill(C.bedrock, 12);
    // Manchas de alto contraste: negras y grises.
    for (let i = 0; i < 9; i++) {
      const cx = Math.floor(p.rnd() * S);
      const cy = Math.floor(p.rnd() * S);
      const col = p.rnd() < 0.5 ? [22, 21, 26] : [96, 94, 104];
      for (let k = 0; k < 5; k++) {
        p.set(cx + Math.floor(p.rnd() * 3) - 1, cy + Math.floor(p.rnd() * 3) - 1, p.vary(col, 8));
      }
    }
  },

  sand(p) {
    p.noiseFill(C.sand, 7);
    p.speckle([196, 178, 124], 0.12, 5);
    p.speckle([236, 224, 178], 0.08, 4);
  },

  water(p) {
    p.noiseFill(C.water, 6);
    // Ondas: trazos horizontales más claros.
    for (let y = 1; y < S; y += 4) {
      const off = Math.floor(p.rnd() * S);
      const len = 4 + Math.floor(p.rnd() * 5);
      for (let k = 0; k < len; k++) p.set((off + k) % S, y + (k > len / 2 ? 1 : 0), p.vary([96, 158, 234], 6));
    }
  },

  log_side(p) {
    // Corteza con vetas verticales.
    for (let x = 0; x < S; x++) {
      const colBase = p.rnd() < 0.3 ? C.barkDark : C.bark;
      for (let y = 0; y < S; y++) p.set(x, y, p.vary(colBase, 8));
    }
    // Nudos y grietas horizontales cortas.
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(p.rnd() * S);
      const y = Math.floor(p.rnd() * S);
      p.set(x, y, p.vary([60, 42, 24], 5));
      p.set(x, y + 1, p.vary([60, 42, 24], 5));
    }
  },

  log_top(p) {
    // Anillos concéntricos con borde de corteza.
    const c = (S - 1) / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.max(Math.abs(x - c), Math.abs(y - c)) + Math.hypot(x - c, y - c) * 0.25;
        if (x === 0 || y === 0 || x === S - 1 || y === S - 1) {
          p.set(x, y, p.vary(C.bark, 8));
        } else {
          const ring = Math.floor(d) % 3 === 0;
          p.set(x, y, p.vary(ring ? [150, 112, 66] : C.wood, 6));
        }
      }
    }
  },

  leaves(p) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const r = p.rnd();
        if (r < 0.16) {
          p.set(x, y, [0, 0, 0, 0]); // hueco transparente
        } else if (r < 0.4) {
          p.set(x, y, p.vary([40, 100, 36], 8));
        } else if (r < 0.52) {
          p.set(x, y, p.vary([92, 168, 70], 8));
        } else {
          p.set(x, y, p.vary(C.leaves, 8));
        }
      }
    }
  },

  ore_copper(p) {
    paintOre(p, C.copper, [255, 182, 120], 4);
  },

  ore_azurite(p) {
    paintOre(p, C.azurite, [170, 210, 255], 4);
  },

  ore_solarite(p) {
    paintOre(p, C.solarite, [255, 250, 210], 3);
  },

  planks(p) {
    // Cuatro tablas horizontales con vetas, separadas por líneas oscuras.
    for (let y = 0; y < S; y++) {
      const board = Math.floor(y / 4);
      const tint = [0, 8, -6, 4][board];
      for (let x = 0; x < S; x++) {
        if (y % 4 === 3) {
          p.set(x, y, p.vary([112, 80, 46], 4));
        } else {
          const base = [C.plank[0] + tint, C.plank[1] + tint, C.plank[2] + tint];
          p.set(x, y, p.vary(base, 6));
        }
      }
      // Veta: un trazo un poco más oscuro.
      if (y % 4 === 1) {
        const off = Math.floor(p.rnd() * 8);
        for (let k = 0; k < 5; k++) p.shade((off + k) % S, y, 0.88);
      }
    }
    // Uniones de tablas (desfasadas por fila).
    for (let b = 0; b < 4; b++) {
      const x = b % 2 === 0 ? 3 : 11;
      for (let y = b * 4; y < b * 4 + 3; y++) p.set(x, y, p.vary([120, 86, 50], 4));
    }
  },

  stone_brick(p) {
    p.noiseFill([142, 143, 148], 7);
    // Juntas (mortero) cada 8 píxeles en filas alternadas.
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / 8);
      for (let x = 0; x < S; x++) {
        const isHJoint = y % 8 === 7;
        const isVJoint = (x + (row % 2 === 0 ? 0 : 8)) % 16 === 15;
        if (isHJoint || isVJoint) {
          p.set(x, y, p.vary([84, 85, 92], 4));
        } else if (y % 8 === 0 || (x + (row % 2 === 0 ? 0 : 8)) % 16 === 0) {
          // Bisel claro arriba/izquierda de cada ladrillo.
          p.set(x, y, p.vary([168, 169, 174], 4));
        }
      }
    }
  },

  glass(p) {
    // Interior totalmente transparente, marco claro y un par de brillos.
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1;
        p.set(x, y, edge ? p.vary([214, 232, 240], 6) : [0, 0, 0, 0]);
      }
    }
    for (let k = 0; k < 4; k++) p.set(3 + k, 6 - k, [240, 250, 255, 255]);
    p.set(10, 11, [240, 250, 255, 255]);
    p.set(11, 10, [240, 250, 255, 255]);
  },

  // --- Materiales de construcción (etapa 9) --------------------------------

  planks_dark(p) {
    paintBoards(p, C.walnut, {
      joint: [60, 38, 22],
      seam: [72, 48, 28],
      tints: [0, 5, -4, 3],
      seams: [5, 13],
    });
  },

  planks_light(p) {
    paintBoards(p, C.birch, {
      joint: [160, 128, 88],
      seam: [176, 142, 98],
      tints: [0, 6, -5, 3],
      seams: [2, 10],
    });
  },

  planks_red(p) {
    paintBoards(p, C.cedar, {
      joint: [112, 62, 40],
      seam: [128, 74, 48],
      tints: [0, 7, -5, 4],
      seams: [4, 12],
    });
  },

  cobble(p) {
    // Piedras: celdas de Voronoi sobre un toro (sin costuras). Los centros se
    // tiran al azar sin dejarlos muy juntos, así no se nota una grilla. La
    // junta aparece donde dos piedras están casi a la par.
    const grays = [
      [140, 140, 144],
      [122, 122, 128],
      [152, 150, 146],
      [110, 112, 118],
      [132, 130, 126],
    ];
    const torus = (dx, dy) => Math.hypot(dx - Math.round(dx / S) * S, dy - Math.round(dy / S) * S);
    const cell = 5; // tamaño típico de una piedra
    const stones = [];
    for (let tries = 0; tries < 400 && stones.length < 11; tries++) {
      const x = p.rnd() * S;
      const y = p.rnd() * S;
      if (stones.every((s) => torus(x - s.x, y - s.y) >= 4.4)) {
        stones.push({ x, y, col: grays[Math.floor(p.rnd() * grays.length)] });
      }
    }
    const owner = new Int8Array(S * S); // -1 = junta
    const off = new Float32Array(S * S); // posición respecto del centro de la piedra
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let d1 = Infinity;
        let d2 = Infinity;
        let best = 0;
        let bdx = 0;
        let bdy = 0;
        stones.forEach((s, k) => {
          let dx = x + 0.5 - s.x;
          let dy = y + 0.5 - s.y;
          dx -= Math.round(dx / S) * S;
          dy -= Math.round(dy / S) * S;
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
            bdx = dx;
            bdy = dy;
          } else if (d < d2) d2 = d;
        });
        // Junta entre piedras y también lejos del centro (redondea las grandes).
        owner[y * S + x] = d1 / d2 > 0.8 || d1 > 4.4 ? -1 : best;
        off[y * S + x] = (bdx + bdy) / cell;
      }
    }
    const at = (x, y) => owner[wrap(y) * S + wrap(x)];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const k = at(x, y);
        if (k < 0) {
          p.set(x, y, p.vary([70, 70, 76], 4));
          continue;
        }
        // Bisel: claro si arriba/izquierda hay junta, oscuro si está abajo/derecha.
        let f = 1 - off[y * S + x] * 0.08;
        if (at(x - 1, y) !== k || at(x, y - 1) !== k) f *= 1.12;
        else if (at(x + 1, y) !== k || at(x, y + 1) !== k) f *= 0.8;
        p.set(x, y, p.vary(tone(stones[k].col, f), 5));
      }
    }
  },

  smooth_stone(p) {
    p.noiseFill([166, 167, 171], 3);
    p.speckle([158, 159, 163], 0.1, 2);
    // Borde de 1 px apenas más oscuro, un poco más abajo/derecha (bisel).
    for (let i = 0; i < S; i++) {
      p.shade(i, 0, 0.95);
      p.shade(0, i, 0.95);
      p.shade(i, S - 1, 0.88);
      p.shade(S - 1, i, 0.88);
    }
  },

  bricks(p) {
    // Ladrillos de 8x4 (con la junta) en hileras desfasadas media pieza.
    const reds = [
      [166, 78, 56],
      [150, 66, 48],
      [178, 92, 64],
      [142, 62, 46],
      [170, 84, 58],
    ];
    const tints = [];
    for (let k = 0; k < 8; k++) tints.push(reds[Math.floor(p.rnd() * reds.length)]);
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / 4);
      const v = y % 4;
      for (let x = 0; x < S; x++) {
        const u = (x + (row % 2) * 4) % S;
        if (v === 3 || u % 8 === 7) {
          p.set(x, y, p.vary(C.mortar, 4));
          continue;
        }
        let f = 1;
        if (v === 0) f = 1.08;
        else if (v === 2 || u % 8 === 6) f = 0.9;
        if (p.rnd() < 0.08) f *= 0.9; // granos del barro
        p.set(x, y, p.vary(tone(tints[row * 2 + Math.floor(u / 8)], f), 5));
      }
    }
  },

  marble(p) {
    // Vetas en diagonal (x + y) que serpentean con ruido periódico: no dejan
    // costuras. Una veta principal y otra más fina y tenue.
    const vein = [168, 168, 178];
    const warp1 = tileNoise(p, 4);
    const warp2 = tileNoise(p, 2);
    const cloud = tileNoise(p, 4);
    const dist = (u, at) => {
      const t = wrap(u - at);
      return Math.min(t, S - t);
    };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        const w = 3.2 * warp1(cx, cy) + 2.4 * warp2(cx, cy);
        const s1 = Math.max(0, 1 - dist(x + y + w, 4) / 1.4);
        const s2 = Math.max(0, 1 - dist(x + y - w * 0.8, 12) / 0.9);
        const t = Math.min(1, s1 * 0.75 + s2 * 0.32 + Math.max(0, cloud(cx, cy)) * 0.08);
        p.set(x, y, p.vary(mix(C.marble, vein, t), 2));
      }
    }
    p.speckle([244, 243, 240], 0.04, 2);
  },

  sandstone_top(p) {
    p.noiseFill(C.sandstone, 4);
    p.speckle([208, 190, 140], 0.1, 3);
    p.speckle([236, 222, 178], 0.06, 3);
    // Marco suave: borde un poco más oscuro y una vuelta apenas más clara.
    for (let i = 0; i < S; i++) {
      for (const [x, y] of [[i, 0], [0, i], [i, S - 1], [S - 1, i]]) p.shade(x, y, 0.92);
      if (i > 0 && i < S - 1) {
        for (const [x, y] of [[i, 1], [1, i], [i, S - 2], [S - 2, i]]) p.shade(x, y, 1.03);
      }
    }
  },

  sandstone_side(p) {
    // Franjas horizontales de arena, con bordes apenas ondulados.
    const bands = [
      [0, [232, 218, 170]],
      [1, [224, 208, 158]],
      [4, [206, 188, 140]],
      [5, [218, 200, 150]],
      [9, [204, 186, 138]],
      [10, [228, 212, 164]],
      [13, [212, 194, 144]],
      [15, [198, 180, 132]],
    ];
    const TAU = Math.PI * 2;
    const phase = p.rnd() * TAU;
    for (let x = 0; x < S; x++) {
      const wave = Math.round(0.7 * Math.sin((TAU * x) / 8 + phase));
      for (let y = 0; y < S; y++) {
        // Las filas de los bordes quedan fijas; las del medio ondulan.
        const yy = y === 0 || y === S - 1 ? y : Math.min(S - 2, Math.max(1, y + wave));
        let col = bands[0][1];
        for (const [from, c] of bands) if (yy >= from) col = c;
        p.set(x, y, p.vary(col, 4));
      }
    }
    p.speckle([196, 176, 126], 0.06, 3);
  },

  roof_red(p) {
    // Tejas redondeadas en filas de 4 px: cada fila tapa el borde de la de abajo.
    const reds = [
      [176, 82, 56],
      [164, 72, 50],
      [186, 94, 62],
      [156, 68, 48],
    ];
    const tints = [];
    for (let k = 0; k < 8; k++) tints.push(reds[Math.floor(p.rnd() * reds.length)]);
    const R = 4.2;
    // Borde inferior (curvo) de la teja de la fila j que pasa por la columna px.
    const edge = (j, px) => {
      const shift = (j & 1) * 4;
      const i = Math.floor((px - shift) / 8);
      const t = (px - (i * 8 + 4 + shift)) / R;
      return { y: 4 * j + 1 + 4 * Math.sqrt(Math.max(0, 1 - t * t)), i, t };
    };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let j = Math.floor(py / 4) - 2;
        while (py >= edge(j, px).y) j++;
        const own = edge(j, px);
        const below = py - edge(j - 1, px).y; // distancia a la teja de arriba
        let f = 1 - own.t * 0.08;
        if (below < 1) f *= 0.58;
        else if (below < 2) f *= 0.84;
        else if (own.y - py < 1) f *= 1.1; // canto de la teja
        if (Math.abs(own.t) > 0.86) f *= 0.8; // separación con la vecina
        const base = tints[(own.i & 1) + 2 * (j & 3)];
        p.set(x, y, p.vary(tone(base, f), 5));
      }
    }
  },

  roof_gray(p) {
    // Pizarras rectangulares de distintos anchos en filas de 4 px superpuestas.
    const slates = [
      [98, 108, 124],
      [106, 116, 132],
      [90, 100, 116],
      [112, 120, 134],
    ];
    const joints = [
      [0, 5, 11],
      [2, 8, 13],
      [0, 6, 11],
      [3, 8, 14],
    ];
    const rowF = [0.6, 0.9, 1, 1.1];
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / 4);
      const v = y % 4;
      const js = joints[row];
      const tints = js.map(() => slates[Math.floor(p.rnd() * slates.length)]);
      const chip = Math.floor(p.rnd() * 3); // pizarra con la punta gastada
      for (let x = 0; x < S; x++) {
        let k = js.length - 1;
        for (let n = 0; n < js.length; n++) if (x >= js[n]) k = n;
        const start = js[k];
        const end = wrap(js[(k + 1) % js.length] - 1);
        let f = rowF[v];
        if (x === start && v > 0) f = 0.5; // ranura entre pizarras
        else if (x === wrap(start + 1)) f *= 1.06;
        else if (x === end) f *= 0.9;
        if (v === 3 && k === chip && x === end) f = 0.6;
        p.set(x, y, p.vary(tone(tints[k], f), 4));
      }
    }
  },

  thatch_top(p) {
    // Capas de hebras largas que se cruzan en diagonal (bajan o suben un
    // píxel cada dos) sobre un fondo en sombra. Las capas de arriba tienen
    // menos hebras y más claras; al final cada hebra le hace sombra al píxel
    // de abajo si ese píxel es de una capa más baja.
    p.noiseFill(tone(C.straw, 0.66), 4);
    const golds = [C.straw, lift(C.straw, 20), lift(C.straw, -10), [228, 198, 110]];
    const layers = [
      [1, 18, 0.84],
      [-1, 10, 0.98],
      [1, 5, 1.1],
    ];
    const layerAt = new Int8Array(S * S).fill(-1);
    layers.forEach(([dir, count, bright], layer) => {
      for (let i = 0; i < count; i++) {
        const x0 = Math.floor(p.rnd() * S);
        const y0 = Math.floor(p.rnd() * S);
        const len = 7 + Math.floor(p.rnd() * 7);
        const col = tone(golds[Math.floor(p.rnd() * golds.length)], bright);
        for (let k = 0; k < len; k++) {
          const x = wrap(x0 + k);
          const y = wrap(y0 + dir * Math.floor(k / 2));
          const tip = k === 0 || k === len - 1; // puntas un poco más oscuras
          p.set(x, y, p.vary(tip ? tone(col, 0.9) : col, 5));
          layerAt[y * S + x] = layer;
        }
      }
    });
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (layerAt[wrap(y - 1) * S + x] > layerAt[y * S + x]) p.shade(x, y, 0.8);
      }
    }
  },

  thatch_side(p) {
    // Hebras verticales de distintos tonos.
    const golds = [C.straw, lift(C.straw, 16), lift(C.straw, -14), lift(C.straw, -28)];
    for (let x = 0; x < S; x++) {
      const base = golds[Math.floor(p.rnd() * golds.length)];
      for (let y = 0; y < S; y++) p.set(x, y, p.vary(base, 7));
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(p.rnd() * S);
      const y0 = Math.floor(p.rnd() * S);
      const len = 3 + Math.floor(p.rnd() * 6);
      const f = p.rnd() < 0.5 ? 0.8 : 1.14;
      for (let k = 0; k < len; k++) p.shade(x, wrap(y0 + k), f);
    }
    // Atadura: cuerda retorcida en las filas 5 y 6, con sombra debajo.
    const rope = [[150, 112, 50], [126, 92, 40], [104, 76, 32], [116, 84, 36]];
    for (let x = 0; x < S; x++) {
      for (const y of [5, 6]) p.set(x, y, p.vary(tone(rope[(x + y) % 4], y === 5 ? 1.05 : 0.9), 4));
      p.shade(x, 7, 0.76);
      p.shade(x, 4, 0.92);
    }
  },

  plaster_white(p) {
    paintPlaster(p, C.plasterWhite);
  },
  plaster_cream(p) {
    paintPlaster(p, C.plasterCream);
  },
  plaster_gray(p) {
    paintPlaster(p, C.plasterGray);
  },
  plaster_black(p) {
    paintPlaster(p, C.plasterBlack);
  },
  plaster_red(p) {
    paintPlaster(p, C.plasterRed);
  },
  plaster_orange(p) {
    paintPlaster(p, C.plasterOrange);
  },
  plaster_yellow(p) {
    paintPlaster(p, C.plasterYellow);
  },
  plaster_green(p) {
    paintPlaster(p, C.plasterGreen);
  },
  plaster_lightblue(p) {
    paintPlaster(p, C.plasterLightblue);
  },
  plaster_blue(p) {
    paintPlaster(p, C.plasterBlue);
  },
  plaster_purple(p) {
    paintPlaster(p, C.plasterPurple);
  },
  plaster_pink(p) {
    paintPlaster(p, C.plasterPink);
  },

  window(p) {
    // Marco de madera de 2 px y cruz al medio: cuatro vidrios transparentes.
    const wood = [156, 108, 64];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const frame = x < 2 || y < 2 || x > S - 3 || y > S - 3;
        const cross = x === 7 || x === 8 || y === 7 || y === 8;
        if (!frame && !cross) {
          p.set(x, y, TRANSPARENT);
          continue;
        }
        let f = 1;
        if (x === 0 || y === 0) f = 1.16;
        else if (x === S - 1 || y === S - 1) f = 0.72;
        else if (!frame) f = x === 7 || y === 7 ? 1.08 : 0.84;
        p.set(x, y, p.vary(tone(wood, f), 4));
      }
    }
    // Brillo en diagonal.
    p.set(5, 3, C.glint);
    p.set(4, 4, C.glint);
    p.set(11, 10, C.glint);
  },

  lamp(p) {
    // Vidrio cálido que brilla más al centro, con tapas de hierro y dos barrotes.
    const hot = [255, 228, 146];
    const warm = [238, 152, 58];
    const c = (S - 1) / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - c, (y - c) * 1.15) / 8;
        p.set(x, y, p.vary(mix(hot, warm, Math.min(1, d * d * 1.4)), 4));
      }
    }
    for (let i = 0; i < S; i++) {
      for (const y of [0, 1, S - 2, S - 1]) {
        p.set(i, y, p.vary(tone(C.iron, y === 0 ? 1.5 : y === S - 1 ? 0.8 : 1), 3));
      }
      if (i > 1 && i < S - 2) {
        p.set(0, i, p.vary(tone(C.iron, 1.3), 3));
        p.set(S - 1, i, p.vary(tone(C.iron, 0.85), 3));
        p.set(5, i, p.vary(C.iron, 3));
        p.set(10, i, p.vary(C.iron, 3));
      }
    }
    // Remaches en las tapas.
    for (const x of [2, 5, 10, 13]) p.set(x, 1, tone(C.iron, 1.9));
    for (const x of [2, 5, 10, 13]) p.set(x, S - 2, tone(C.iron, 1.6));
  },

  door_wood_top(p) {
    paintPlankDoor(p, false);
  },

  door_wood_bottom(p) {
    paintPlankDoor(p, true);
  },

  door_dark_top(p) {
    paintPanelDoor(p, false);
  },

  door_dark_bottom(p) {
    paintPanelDoor(p, true);
  },

  floor_tiles(p) {
    // Damero de baldosas de 8x8 (con la junta) crema y terracota.
    const cream = [226, 212, 178];
    const terra = [176, 94, 64];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x % 8;
        const v = y % 8;
        if (u === 7 || v === 7) {
          p.set(x, y, p.vary([150, 142, 130], 3));
          continue;
        }
        const base = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? terra : cream;
        let f = 1;
        if (u === 0 || v === 0) f = 1.06;
        else if (u === 6 || v === 6) f = 0.92;
        p.set(x, y, p.vary(tone(base, f), 4));
      }
    }
  },

  parquet(p) {
    // Espiga: tablas de 8x4 alternando horizontales y verticales. La red se
    // repite cada 16 px en los dos ejes, así que no deja costuras.
    const A = 8;
    const B = 4;
    const light = [194, 144, 88];
    const dark = [152, 106, 62];
    // Un tono por tabla según dónde empieza (módulo 16): sus copias del otro
    // lado del borde salen iguales.
    const tints = [];
    for (let i = 0; i < S * S; i++) tints.push((p.rnd() * 2 - 1) * 8);
    const owner = [];
    for (let n = -3; n <= 3; n++) {
      for (let k = -8; k <= 8; k++) {
        const ox = k * B - n * A;
        const oy = k * B + n * A;
        for (const [h, rx, ry, w, hh] of [
          [true, ox, oy, A, B],
          [false, ox + A, oy + B - A, B, A],
        ]) {
          for (let y = ry; y < ry + hh; y++) {
            for (let x = rx; x < rx + w; x++) {
              if (x < 0 || y < 0 || x >= S || y >= S) continue;
              // a: posición a lo largo de la tabla; b: a lo ancho.
              const tint = tints[wrap(ry) * S + wrap(rx)];
              owner[y * S + x] = { h, tint, a: h ? x - rx : y - ry, b: h ? y - ry : x - rx };
            }
          }
        }
      }
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const o = owner[y * S + x];
        let f = 1;
        if (o.a === A - 1 || o.b === B - 1) f = 0.7; // junta en la punta y el costado
        else if (o.a === 0 || o.b === 0) f = 1.08; // bisel claro
        else if ((o.a + o.b * 3) % 5 === 0) f = 0.92; // veta
        p.set(x, y, p.vary(tone(lift(o.h ? light : dark, o.tint), f), 4));
      }
    }
  },

  bookshelf(p) {
    // Fondo oscuro, estantes arriba, al medio y abajo, y costados de madera.
    p.noiseFill([46, 32, 22], 3);
    paintBooks(p, 1, 6);
    paintBooks(p, 9, 14);
    for (let i = 0; i < S; i++) {
      p.set(i, 0, p.vary(tone(C.plank, 1.08), 5));
      p.set(i, 7, p.vary(C.plank, 5));
      p.set(i, 8, p.vary(tone(C.plank, 0.8), 5));
      p.set(i, S - 1, p.vary(tone(C.plank, 0.74), 5));
      // Sombra del estante sobre los libros.
      p.shade(i, 1, 0.78);
      p.shade(i, 9, 0.78);
    }
    for (let y = 1; y < S - 1; y++) {
      if (y === 7 || y === 8) continue;
      p.set(0, y, p.vary(tone(C.plank, 1.04), 5));
      p.set(S - 1, y, p.vary(tone(C.plank, 0.76), 5));
    }
  },
};

// ---------------------------------------------------------------------------
// Atlas
// ---------------------------------------------------------------------------

/**
 * Copia los píxeles del borde de una textura hacia su margen (TILE_PADDING),
 * incluidas las esquinas, para evitar que se mezclen colores de texturas
 * vecinas en los bordes de las caras.
 */
function extrudeEdges(img, ox, oy) {
  const d = img.data;
  const w = img.width;
  const P = TILE_PADDING;
  for (let y = -P; y < S + P; y++) {
    for (let x = -P; x < S + P; x++) {
      if (x >= 0 && x < S && y >= 0 && y < S) continue; // interior
      const sx = Math.min(S - 1, Math.max(0, x));
      const sy = Math.min(S - 1, Math.max(0, y));
      const src = ((oy + sy) * w + (ox + sx)) * 4;
      const dst = ((oy + y) * w + (ox + x)) * 4;
      d[dst] = d[src];
      d[dst + 1] = d[src + 1];
      d[dst + 2] = d[src + 2];
      d[dst + 3] = d[src + 3];
    }
  }
}

/** Dibuja todas las texturas en un canvas y lo devuelve. */
export function paintAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);

  for (const name of TILE_NAMES) {
    const painter = PAINTERS[name];
    if (!painter) throw new Error(`Falta el pintor de la textura: ${name}`);
    const { x, y } = tilePixelOrigin(name);
    painter(new TilePainter(img, x, y, mulberry32(hashString(name))));
    extrudeEdges(img, x, y);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Crea el atlas como textura de Three.js con filtrado "nearest" para que se
 * vea pixelado y nítido. No se generan mipmaps para evitar que los colores de
 * texturas vecinas se mezclen a la distancia.
 */
export function createAtlasTexture() {
  const canvas = paintAtlasCanvas();
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return { canvas, texture };
}
