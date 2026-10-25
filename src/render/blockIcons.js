// Íconos de bloques para la hotbar y el menú de materiales: un cubo en
// perspectiva isométrica dibujado en un canvas con las texturas del atlas
// (arriba, izquierda y derecha, con las caras de los costados un poco más
// oscuras). Las losas y los escalones se dibujan con sus cajas, y las
// puertas de frente (las dos mitades).

import { TILE_SIZE, tilePixelOrigin } from './atlasLayout.js';
import { SHAPE, getBlock } from '../world/blocks.js';

const SIZE = 48; // ancho del ícono en píxeles
const K = SIZE / 2 / TILE_SIZE; // escala de la textura

const cache = new Map();

/**
 * Dibuja una cara: la textura `tile` del atlas transformada con la matriz
 * (a, b, c, d, e, f) y oscurecida según `shade` (0 = sin sombra).
 */
function drawFace(ctx, atlas, tile, matrix, shade, [sx, sy, sw, sh] = [0, 0, TILE_SIZE, TILE_SIZE]) {
  const { x, y } = tilePixelOrigin(tile);
  // Cada cara en su propio lienzo: la sombra se aplica solo sobre sus
  // píxeles (respeta los huecos de hojas y vidrio) sin oscurecer lo de atrás.
  const face = document.createElement('canvas');
  face.width = sw;
  face.height = sh;
  const f = face.getContext('2d');
  f.drawImage(atlas, x + sx, y + sy, sw, sh, 0, 0, sw, sh);
  if (shade > 0) {
    f.globalCompositeOperation = 'source-atop';
    f.fillStyle = `rgba(0, 0, 0, ${shade})`;
    f.fillRect(0, 0, sw, sh);
  }
  ctx.save();
  ctx.setTransform(...matrix);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(face, 0, 0);
  ctx.restore();
}

/** Punto (x, y, z) del bloque (de 0 a 1) en el ícono. */
function project(x, y, z) {
  return [SIZE / 2 + TILE_SIZE * K * (x - z), 2 + (TILE_SIZE * K * (x + z)) / 2 + TILE_SIZE * K * (1 - y)];
}

/**
 * Una caja del bloque: arriba, el costado +Z (a la izquierda) y el +X (a la
 * derecha), con la textura recortada al tamaño de la caja.
 */
function drawBox(ctx, atlas, tiles, [x0, y0, z0, x1, y1, z1]) {
  const T = TILE_SIZE;
  const [tx, ty] = project(x0, y1, z0);
  drawFace(ctx, atlas, tiles.top, [K, K / 2, -K, K / 2, tx, ty], 0, [x0 * T, z0 * T, (x1 - x0) * T, (z1 - z0) * T]);
  const [lx, ly] = project(x0, y1, z1);
  drawFace(ctx, atlas, tiles.side, [K, K / 2, 0, K, lx, ly], 0.22, [x0 * T, (1 - y1) * T, (x1 - x0) * T, (y1 - y0) * T]);
  const [rx, ry] = project(x1, y1, z1);
  drawFace(ctx, atlas, tiles.side, [K, -K / 2, 0, K, rx, ry], 0.4, [(1 - z1) * T, (1 - y1) * T, (z1 - z0) * T, (y1 - y0) * T]);
}

/** Puerta de frente: la mitad de arriba sobre la de abajo, centradas. */
function drawDoor(ctx, atlas, block) {
  const top = getBlock(block.doorIds[`${block.facing}01`]).tiles.side;
  const w = SIZE * 0.42;
  const x = (SIZE - w) / 2;
  ctx.imageSmoothingEnabled = false;
  for (const [tile, row] of [[top, 0], [block.tiles.side, 1]]) {
    const o = tilePixelOrigin(tile);
    ctx.drawImage(atlas, o.x, o.y, TILE_SIZE, TILE_SIZE, x, 2 + row * w, w, w);
  }
}

/**
 * Devuelve la URL (data:) del ícono de un bloque.
 * @param {HTMLCanvasElement} atlas canvas del atlas de texturas
 * @param {number} id ID del bloque
 */
export function getBlockIcon(atlas, id) {
  let url = cache.get(id);
  if (url) return url;
  const block = getBlock(id);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE + 4;
  const ctx = canvas.getContext('2d');
  if (block.shape === SHAPE.DOOR) {
    drawDoor(ctx, atlas, block);
  } else if (block.boxes) {
    // De abajo hacia arriba y de atrás hacia adelante.
    const boxes = [...block.boxes].sort((a, b) => a[1] - b[1] || a[0] + a[2] - (b[0] + b[2]));
    for (const box of boxes) drawBox(ctx, atlas, block.tiles, box);
  } else if (block.tiles) {
    const h = SIZE / 4; // alto del rombo de arriba hasta su centro
    // Arriba: rombo. Izquierda y derecha: paralelogramos hacia abajo.
    drawFace(ctx, atlas, block.tiles.top, [K, K / 2, -K, K / 2, SIZE / 2, 2], 0);
    drawFace(ctx, atlas, block.tiles.side, [K, K / 2, 0, K, 0, 2 + h], 0.22);
    drawFace(ctx, atlas, block.tiles.side, [K, -K / 2, 0, K, SIZE / 2, 2 + 2 * h], 0.4);
  }
  url = canvas.toDataURL();
  cache.set(id, url);
  return url;
}
