// Íconos de los objetos que no son bloques (etapa 15): pixel art de 16 x 16
// dibujado por código. Las herramientas comparten la forma (pico, hacha,
// pala) y cambian el color del material. Los bloques usan sus íconos de
// siempre (render/blockIcons.js).

import { getBlockIcon } from '../render/blockIcons.js';
import { getItem, isBlockItem } from './items.js';

const S = 16;
const SCALE = 3; // el ícono se ve de 48 px

const canvases = new Map();
const urls = new Map();

const shade = ([r, g, b], f) => [Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f)];
const WOOD = [150, 104, 58];
const WOOD_DARK = [104, 70, 38];

/** Pinta un píxel. */
function px(ctx, x, y, [r, g, b], a = 1) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  ctx.fillRect(x, y, 1, 1);
}

/** El palo en diagonal (de abajo a la izquierda hacia arriba a la derecha), hasta `to`. */
function handle(ctx, to = 12) {
  for (let i = 2; i <= to; i++) {
    const x = i;
    const y = S - 1 - i;
    px(ctx, x, y, WOOD);
    px(ctx, x - 1, y, WOOD_DARK);
  }
}

/** Dibuja una figura de texto: cada letra es un color de `pal` ('.' vacío). */
function shape(ctx, rows, pal) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c) px(ctx, x, y, c);
    }
  });
}

const PAINT = {
  stick(ctx) {
    handle(ctx, 13);
  },
  lump(ctx, color) {
    // Un terrón irregular con brillos.
    shape(
      ctx,
      [
        '................',
        '................',
        '................',
        '.....ddmm.......',
        '....dmmhmmd.....',
        '...dmmmmmmmd....',
        '..dmmhmmmmmmd...',
        '..dmmmmmmhmmmd..',
        '..dmmmmmmmmmmd..',
        '...dmmmhmmmmd...',
        '...dmmmmmmmmd...',
        '....ddmmmmdd....',
        '......dddd......',
      ],
      { d: shade(color, 0.6), m: color, h: [120, 118, 128] },
    );
  },
  nugget(ctx, color) {
    shape(
      ctx,
      [
        '................',
        '................',
        '................',
        '................',
        '......dmmd......',
        '....dmmhhmmd....',
        '...dmmhhmmmmd...',
        '..dmmmmmmmmmmd..',
        '..dmmmmmmmhmmd..',
        '...dmmmmmmmmd...',
        '....ddmmmmdd....',
        '......dddd......',
      ],
      { d: shade(color, 0.62), m: color, h: shade(color, 1.35) },
    );
  },
  gem(ctx, color) {
    shape(
      ctx,
      [
        '................',
        '................',
        '................',
        '.....hhhhhh.....',
        '....hlllmmmd....',
        '...hllmmmmmmd...',
        '..hlmmmmmmmmmd..',
        '...dmmmmmmmdd...',
        '....dmmmmmdd....',
        '.....dmmmdd.....',
        '......dmdd......',
        '.......dd.......',
      ],
      { d: shade(color, 0.6), m: color, l: shade(color, 1.25), h: shade(color, 1.5) },
    );
  },
  pico(ctx, color) {
    handle(ctx, 11);
    // Cabeza curva, cruzada al palo cerca de la punta.
    shape(
      ctx,
      [
        '................',
        '.....dmmmm......',
        '....dmhhhmmm....',
        '...dm....dmmm...',
        '...d......dmmd..',
        '.............m..',
        '.............m..',
        '.............d..',
      ],
      { d: shade(color, 0.6), m: color, h: shade(color, 1.35) },
    );
  },
  hacha(ctx, color) {
    handle(ctx, 12);
    shape(
      ctx,
      [
        '................',
        '........dmm.....',
        '.......dmhhm....',
        '......dmhmmmd...',
        '......dmmm.dd...',
        '.......dmd......',
        '........d.......',
      ],
      { d: shade(color, 0.6), m: color, h: shade(color, 1.35) },
    );
  },
  pala(ctx, color) {
    handle(ctx, 10);
    shape(
      ctx,
      [
        '................',
        '...........dmd..',
        '..........dmhmd.',
        '.........dmhmmd.',
        '.........dmmmd..',
        '..........ddd...',
      ],
      { d: shade(color, 0.6), m: color, h: shade(color, 1.35) },
    );
  },
};

/** Canvas de 16 x 16 con el dibujo de un objeto (no bloque), o null. */
export function getItemCanvas(id) {
  if (canvases.has(id)) return canvases.get(id);
  const item = getItem(id);
  let canvas = null;
  if (item && PAINT[item.icon]) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    PAINT[item.icon](canvas.getContext('2d'), item.color);
  }
  canvases.set(id, canvas);
  return canvas;
}

/**
 * Ícono de cualquier objeto (bloque o no) como URL de imagen, para la
 * hotbar y los menús.
 * @param {HTMLCanvasElement} atlas el atlas de texturas (para los bloques)
 */
export function getItemIcon(atlas, id) {
  if (isBlockItem(id)) return getBlockIcon(atlas, id);
  if (urls.has(id)) return urls.get(id);
  const src = getItemCanvas(id);
  let url = '';
  if (src) {
    const c = document.createElement('canvas');
    c.width = c.height = S * SCALE;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, S * SCALE, S * SCALE);
    url = c.toDataURL();
  }
  urls.set(id, url);
  return url;
}
