// Distribución de las texturas dentro del atlas.
//
// Este módulo es "puro" (no toca el DOM ni Three.js) para que el mesher pueda
// calcular coordenadas UV también dentro de un Web Worker (etapa 7).

/** Tamaño en píxeles de cada textura (estilo pixel art). */
export const TILE_SIZE = 16;

/**
 * Margen (en píxeles) alrededor de cada textura. Se rellena repitiendo el
 * borde de la textura para que el antialiasing (MSAA) y el filtrado nunca
 * tomen colores de la textura vecina (si no, aparecen líneas finas de otro
 * color en las uniones de los bloques, sobre todo a la distancia).
 */
export const TILE_PADDING = 2;

/** Lugar que ocupa cada textura en el atlas: textura + márgenes. */
export const CELL_SIZE = TILE_SIZE + TILE_PADDING * 2;

/** Cantidad de texturas por fila/columna del atlas (16x16 = 256 lugares). */
export const ATLAS_TILES = 16;

/** Tamaño total del atlas en píxeles. */
export const ATLAS_SIZE = CELL_SIZE * ATLAS_TILES;

/**
 * Orden de las texturas en el atlas. El índice de cada nombre es su lugar
 * (de izquierda a derecha y de arriba hacia abajo). Agregar al final para no
 * correr las existentes.
 */
export const TILE_NAMES = Object.freeze([
  'grass_top',
  'grass_side',
  'dirt',
  'stone',
  'bedrock',
  'sand',
  'water',
  'log_side',
  'log_top',
  'leaves',
  'ore_copper',
  'ore_azurite',
  'ore_solarite',
  'planks',
  'stone_brick',
  'glass',
  // Materiales de construcción (etapa 9).
  'planks_dark',
  'planks_light',
  'planks_red',
  'cobble',
  'smooth_stone',
  'bricks',
  'marble',
  'sandstone_top',
  'sandstone_side',
  'roof_red',
  'roof_gray',
  'thatch_top',
  'thatch_side',
  'plaster_white',
  'plaster_cream',
  'plaster_gray',
  'plaster_black',
  'plaster_red',
  'plaster_orange',
  'plaster_yellow',
  'plaster_green',
  'plaster_lightblue',
  'plaster_blue',
  'plaster_purple',
  'plaster_pink',
  'window',
  'lamp',
  'door_wood_top',
  'door_wood_bottom',
  'door_dark_top',
  'door_dark_bottom',
  'floor_tiles',
  'parquet',
  'bookshelf',
]);

const uvCache = new Map();

/**
 * Coordenadas UV de una textura: [u0, v0, u1, v1], donde (u0, v0) es la
 * esquina inferior izquierda y (u1, v1) la superior derecha (convención de
 * Three.js con flipY activado).
 */
export function tileUV(name) {
  let uv = uvCache.get(name);
  if (uv) return uv;
  const { x, y } = tilePixelOrigin(name);
  uv = Object.freeze([
    x / ATLAS_SIZE,
    1 - (y + TILE_SIZE) / ATLAS_SIZE,
    (x + TILE_SIZE) / ATLAS_SIZE,
    1 - y / ATLAS_SIZE,
  ]);
  uvCache.set(name, uv);
  return uv;
}

/**
 * Posición en píxeles (x, y) de la esquina superior izquierda de una textura
 * dentro del canvas del atlas (sin contar el margen).
 */
export function tilePixelOrigin(name) {
  const index = TILE_NAMES.indexOf(name);
  if (index < 0) throw new Error(`Textura desconocida en el atlas: ${name}`);
  return {
    x: (index % ATLAS_TILES) * CELL_SIZE + TILE_PADDING,
    y: Math.floor(index / ATLAS_TILES) * CELL_SIZE + TILE_PADDING,
  };
}
