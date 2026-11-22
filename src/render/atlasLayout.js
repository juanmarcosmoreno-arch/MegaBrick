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
  // Más bloques (etapa 12): ver render/tiles/.
  'gravel',
  'clay',
  'snow',
  'ice',
  'mossy_cobble',
  'granite',
  'basalt_side',
  'basalt_top',
  'cactus_side',
  'cactus_top',
  'pine_log_side',
  'pine_log_top',
  'pine_leaves',
  'pine_planks',
  'jacaranda_log_side',
  'jacaranda_log_top',
  'jacaranda_leaves',
  'jacaranda_planks',
  'tall_grass',
  'fern',
  'flower_daisy',
  'flower_ceibo',
  'flower_blue',
  'mushroom',
  'concrete',
  'calcareo',
  'mosaic',
  'metal_block',
  'copper_block',
  'azurite_block',
  'solarite_block',
  'sheet_metal',
  'sheet_rusty',
  'glass_red',
  'glass_yellow',
  'glass_green',
  'glass_lightblue',
  'glass_blue',
  'glass_purple',
  'iron_bars',
  'ladder',
  'trapdoor',
  // Mecanismos (etapa 13): ver render/tiles/mecanismos.js.
  'wire_off',
  'wire_on',
  'lever_base',
  'lever_handle',
  'button',
  'plate',
  'lamp_off',
  'lamp_on',
  'gate_side',
  'inverter_0_off',
  'inverter_0_on',
  'inverter_1_off',
  'inverter_1_on',
  'inverter_2_off',
  'inverter_2_on',
  'inverter_3_off',
  'inverter_3_on',
  'repeater_0_off',
  'repeater_0_on',
  'repeater_1_off',
  'repeater_1_on',
  'repeater_2_off',
  'repeater_2_on',
  'repeater_3_off',
  'repeater_3_on',
  'timbre_top',
  'timbre_side',
  'piston_side',
  'piston_face',
  'piston_face_sticky',
  'piston_back',
  'piston_rod',
  // Cuevas y minerales (etapa 15).
  'ore_coal',
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
