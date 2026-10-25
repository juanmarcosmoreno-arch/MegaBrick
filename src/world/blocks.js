// Definición de los tipos de bloque de Megabrick.
//
// Cada bloque es una entrada de una tabla indexada por su ID numérico (lo que
// se guarda en el Uint8Array de cada chunk). Las propiedades describen cómo se
// dibuja y cómo se comporta, así que sumar bloques nuevos (biomas, crafteo,
// etc.) es agregar una fila acá y, si hace falta, una textura en textures.js.
//
// Los IDs se guardan en los mundos: los bloques nuevos se agregan siempre al
// final (nunca se cambia el ID de uno que ya existe). Como hay 256 IDs, las
// formas que giran (escalones y puertas) usan un ID por orientación: el
// jugador ve uno solo ("item") y al ponerlo se elige el que corresponde.

/** IDs numéricos de los bloques. 0 siempre es aire (se completa más abajo). */
export const BLOCK = {
  AIR: 0,
  GRASS: 1, // Césped
  DIRT: 2, // Tierra
  STONE: 3, // Piedra
  BEDROCK: 4, // Lecho primordial (indestructible)
  SAND: 5, // Arena
  WATER: 6, // Agua
  LOG: 7, // Tronco
  LEAVES: 8, // Follaje
  ORE_COPPER: 9, // Mineral de cobrizo
  ORE_AZURITE: 10, // Mineral de azurita
  ORE_SOLARITE: 11, // Mineral de solarita
  PLANKS: 12, // Tablones
  STONE_BRICK: 13, // Ladrillo de piedra
  GLASS: 14, // Vidrio
};

/**
 * Capas de render. Cada chunk arma una sola malla con un grupo (y un
 * material) por capa:
 *  - OPAQUE: bloques sólidos comunes.
 *  - CUTOUT: con huecos totalmente transparentes (hojas, vidrio), usan alphaTest.
 *  - TRANSLUCENT: semitransparentes (agua), se dibujan con mezcla alfa.
 */
export const LAYER = Object.freeze({
  OPAQUE: 0,
  CUTOUT: 1,
  TRANSLUCENT: 2,
  GLOW: 3, // brillan solos, sin luz ni sombra (faroles)
});

/** Formas de bloque: cubo entero o armadas con cajas más chicas. */
export const SHAPE = Object.freeze({
  CUBE: 'cube',
  SLAB: 'slab', // losa: medio bloque (abajo o arriba)
  STAIRS: 'stairs', // escalón: medio bloque abajo y un cuarto atrás arriba
  DOOR: 'door', // puerta: una tabla fina (dos bloques de alto)
});

/** Hacia dónde mira algo que gira, como el jugador al ponerlo. */
export const FACING = Object.freeze({ NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 });

/** Grupos del menú de materiales, en orden. */
export const CATEGORIES = Object.freeze([
  { key: 'natural', name: 'Naturaleza' },
  { key: 'wood', name: 'Madera' },
  { key: 'stone', name: 'Piedra y ladrillo' },
  { key: 'color', name: 'Revoque de colores' },
  { key: 'roof', name: 'Techos' },
  { key: 'shapes', name: 'Escalones y losas' },
  { key: 'details', name: 'Puertas, ventanas y detalles' },
]);

/**
 * Valores por defecto de cada bloque.
 * - tiles: nombre de la textura del atlas para {top, side, bottom}.
 * - solid: el jugador choca contra él.
 * - opaque: tapa por completo las caras vecinas (permite ocultarlas).
 * - layer: capa de render (ver LAYER).
 * - cullSame: si dos bloques iguales vecinos ocultan la cara compartida
 *   (el vidrio y el agua sí; el follaje no, para que se vea frondoso).
 * - breakable: se puede romper.
 * - liquid: es un líquido (para nadar en la etapa 3).
 * - sound: cómo suena al pisarlo, romperlo o ponerlo (ver audio/Sounds.js).
 * - shape y boxes: forma (ver SHAPE) y, si no es un cubo, sus cajas
 *   [x0, y0, z0, x1, y1, z1] dentro del bloque (de 0 a 1): con ellas se
 *   dibuja, se choca y se apunta.
 * - item: el bloque que lo representa en la hotbar y el menú (las otras
 *   orientaciones de un escalón o una puerta muestran el mismo).
 * - category: grupo del menú de materiales (null: no aparece).
 */
const DEFAULTS = {
  solid: true,
  opaque: true,
  layer: LAYER.OPAQUE,
  cullSame: true,
  breakable: true,
  liquid: false,
  sound: 'stone',
  shape: SHAPE.CUBE,
  boxes: null,
  category: null,
};

function def(id, name, tiles, props = {}) {
  const t = typeof tiles === 'string' ? { top: tiles, side: tiles, bottom: tiles } : tiles;
  return Object.freeze({ id, name, tiles: Object.freeze(t), item: id, ...DEFAULTS, ...props });
}

/** Tabla de bloques indexada por ID. */
export const BLOCKS = [];

function register(block) {
  BLOCKS[block.id] = block;
}

register(
  Object.freeze({
    id: BLOCK.AIR,
    name: 'Aire',
    tiles: null,
    solid: false,
    opaque: false,
    layer: null,
    cullSame: true,
    breakable: false,
    liquid: false,
    sound: null,
  }),
);
register(
  def(BLOCK.GRASS, 'Césped', { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, { sound: 'grass', category: 'natural' }),
);
register(def(BLOCK.DIRT, 'Tierra', 'dirt', { sound: 'dirt', category: 'natural' }));
register(def(BLOCK.STONE, 'Piedra', 'stone', { category: 'natural' }));
register(def(BLOCK.BEDROCK, 'Lecho primordial', 'bedrock', { breakable: false }));
register(def(BLOCK.SAND, 'Arena', 'sand', { sound: 'sand', category: 'natural' }));
register(
  def(BLOCK.WATER, 'Agua', 'water', {
    solid: false,
    opaque: false,
    layer: LAYER.TRANSLUCENT,
    breakable: false,
    liquid: true,
    sound: 'water',
  }),
);
register(
  def(BLOCK.LOG, 'Tronco', { top: 'log_top', side: 'log_side', bottom: 'log_top' }, { sound: 'wood', category: 'wood' }),
);
register(
  def(BLOCK.LEAVES, 'Follaje', 'leaves', {
    opaque: false,
    layer: LAYER.CUTOUT,
    cullSame: false,
    sound: 'leaves',
    category: 'natural',
  }),
);
register(def(BLOCK.ORE_COPPER, 'Mineral de cobrizo', 'ore_copper', { category: 'natural' }));
register(def(BLOCK.ORE_AZURITE, 'Mineral de azurita', 'ore_azurite', { category: 'natural' }));
register(def(BLOCK.ORE_SOLARITE, 'Mineral de solarita', 'ore_solarite', { category: 'natural' }));
register(def(BLOCK.PLANKS, 'Tablones', 'planks', { sound: 'wood', category: 'wood' }));
register(def(BLOCK.STONE_BRICK, 'Ladrillo de piedra', 'stone_brick', { category: 'stone' }));
register(
  def(BLOCK.GLASS, 'Vidrio', 'glass', {
    opaque: false,
    layer: LAYER.CUTOUT,
    sound: 'glass',
    category: 'details',
  }),
);

// ---------------------------------------------------------------------------
// Materiales de construcción (etapa 9). Los IDs se asignan en este orden:
// agregar siempre al final.
// ---------------------------------------------------------------------------

let nextId = BLOCK.GLASS + 1;

/** Registra un bloque nuevo con el próximo ID libre y lo agrega a BLOCK. */
function add(key, name, tiles, props = {}) {
  const id = nextId++;
  if (id > 255) throw new Error('No quedan IDs de bloque libres');
  BLOCK[key] = id;
  register(def(id, name, tiles, props));
  return id;
}

/** Medias cajas (de abajo y de arriba). */
const LOWER_HALF = [0, 0, 0, 1, 0.5, 1];
const UPPER_HALF = [0, 0.5, 0, 1, 1, 1];
/** Grosor de una puerta (3 de 16 píxeles). */
const DOOR_THICKNESS = 3 / 16;

/**
 * Gira una caja un cuarto de vuelta por cada paso de `facing` alrededor del
 * centro del bloque (de norte a este, a sur, a oeste).
 */
function rotateBox([x0, y0, z0, x1, y1, z1], facing) {
  let ax = x0 - 0.5;
  let az = z0 - 0.5;
  let bx = x1 - 0.5;
  let bz = z1 - 0.5;
  for (let i = 0; i < facing; i++) {
    // (x, z) → (-z, x): el norte (-Z) pasa a ser el este (+X).
    [ax, az, bx, bz] = [-az, ax, -bz, bx];
  }
  return Object.freeze([
    Math.min(ax, bx) + 0.5,
    y0,
    Math.min(az, bz) + 0.5,
    Math.max(ax, bx) + 0.5,
    y1,
    Math.max(az, bz) + 0.5,
  ]);
}

/**
 * Escalones y losas de un material: 4 escalones (uno por orientación; el
 * medio bloque de arriba queda del lado opuesto al jugador que lo puso) y 2
 * losas (abajo y arriba). En el menú aparecen el escalón al norte y la losa
 * de abajo.
 */
function addShapes(key, name, tiles, sound) {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const props = { sound, opaque: false };
  const stairs = [];
  for (let facing = 0; facing < 4; facing++) {
    // Mirando al norte (-Z): el medio bloque de arriba va del lado norte.
    const back = rotateBox([0, 0.5, 0, 1, 1, 0.5], facing);
    stairs.push(
      add(`${key}_STAIRS_${facing}`, `Escalón de ${lower}`, tiles, {
        ...props,
        shape: SHAPE.STAIRS,
        boxes: Object.freeze([Object.freeze(LOWER_HALF), back]),
        facing,
      }),
    );
  }
  for (const id of stairs) {
    BLOCKS[id] = Object.freeze({
      ...BLOCKS[id],
      item: stairs[0],
      variants: Object.freeze(stairs),
      category: id === stairs[0] ? 'shapes' : null,
    });
  }
  const slabBottom = add(`${key}_SLAB`, `Losa de ${lower}`, tiles, {
    ...props,
    shape: SHAPE.SLAB,
    boxes: Object.freeze([Object.freeze(LOWER_HALF)]),
    upper: false,
    category: 'shapes',
  });
  const slabTop = add(`${key}_SLAB_TOP`, `Losa de ${lower}`, tiles, {
    ...props,
    shape: SHAPE.SLAB,
    boxes: Object.freeze([Object.freeze(UPPER_HALF)]),
    upper: true,
    item: slabBottom,
  });
  BLOCKS[slabBottom] = Object.freeze({ ...BLOCKS[slabBottom], slabTop });
}

/** Un material nuevo (cubo) con sus escalones y losas. */
function addMaterial(key, name, tiles, props) {
  const cube = add(key, name, tiles, props);
  addShapes(key, name, tiles, BLOCKS[cube].sound);
  return cube;
}

/**
 * Puerta: 16 IDs (4 orientaciones × cerrada/abierta × mitad de abajo/de
 * arriba). Cerrada, la tabla queda del lado opuesto al jugador que la puso;
 * abierta, gira sobre la bisagra (a la izquierda de quien la puso) hacia
 * adentro.
 */
function addDoor(key, name, tileTop, tileBottom, props) {
  const ids = {};
  const closedBox = [0, 0, 0, 1, 1, DOOR_THICKNESS];
  const openBox = [0, 0, 0, DOOR_THICKNESS, 1, 1];
  for (let facing = 0; facing < 4; facing++) {
    for (const open of [false, true]) {
      for (const upper of [false, true]) {
        const tile = upper ? tileTop : tileBottom;
        const id = add(`${key}_${facing}_${open ? 'OPEN' : 'CLOSED'}_${upper ? 'TOP' : 'BOTTOM'}`, name, {
          top: props.edge,
          side: tile,
          bottom: props.edge,
        }, {
          opaque: false,
          layer: LAYER.CUTOUT,
          sound: 'wood',
          shape: SHAPE.DOOR,
          boxes: Object.freeze([rotateBox(open ? openBox : closedBox, facing)]),
          facing,
          open,
          upper,
        });
        ids[`${facing}${open ? 1 : 0}${upper ? 1 : 0}`] = id;
      }
    }
  }
  const item = ids['000'];
  for (const [code, id] of Object.entries(ids)) {
    BLOCKS[id] = Object.freeze({
      ...BLOCKS[id],
      item,
      doorIds: ids,
      category: code === '000' ? 'details' : null,
    });
  }
  return item;
}

// Madera.
addMaterial('PLANKS_DARK', 'Tablones oscuros', 'planks_dark', { sound: 'wood', category: 'wood' });
add('PLANKS_LIGHT', 'Tablones claros', 'planks_light', { sound: 'wood', category: 'wood' });
add('PLANKS_RED', 'Tablones rojizos', 'planks_red', { sound: 'wood', category: 'wood' });
add('PARQUET', 'Parqué', 'parquet', { sound: 'wood', category: 'wood' });
// Piedra y ladrillo.
addMaterial('COBBLE', 'Empedrado', 'cobble', { category: 'stone' });
add('SMOOTH_STONE', 'Piedra lisa', 'smooth_stone', { category: 'stone' });
addMaterial('BRICKS', 'Ladrillos', 'bricks', { category: 'stone' });
addMaterial('MARBLE', 'Mármol', 'marble', { category: 'stone' });
addMaterial(
  'SANDSTONE',
  'Arenisca',
  { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' },
  { sound: 'sand', category: 'stone' },
);
add('FLOOR_TILES', 'Baldosas', 'floor_tiles', { category: 'stone' });
// Revoque de colores.
for (const [key, name] of [
  ['WHITE', 'blanco'],
  ['CREAM', 'crema'],
  ['GRAY', 'gris'],
  ['BLACK', 'negro'],
  ['RED', 'rojo'],
  ['ORANGE', 'naranja'],
  ['YELLOW', 'amarillo'],
  ['GREEN', 'verde'],
  ['LIGHTBLUE', 'celeste'],
  ['BLUE', 'azul'],
  ['PURPLE', 'violeta'],
  ['PINK', 'rosa'],
]) {
  add(`PLASTER_${key}`, `Revoque ${name}`, `plaster_${key.toLowerCase()}`, { category: 'color' });
}
// Techos.
addMaterial('ROOF_RED', 'Tejas rojas', 'roof_red', { category: 'roof' });
addMaterial('ROOF_GRAY', 'Tejas grises', 'roof_gray', { category: 'roof' });
add('THATCH', 'Paja', { top: 'thatch_top', side: 'thatch_side', bottom: 'thatch_top' }, { sound: 'grass', category: 'roof' });
// Puertas, ventanas y detalles.
addDoor('DOOR_WOOD', 'Puerta de madera', 'door_wood_top', 'door_wood_bottom', { edge: 'planks' });
addDoor('DOOR_DARK', 'Puerta oscura', 'door_dark_top', 'door_dark_bottom', { edge: 'planks_dark' });
add('WINDOW', 'Ventana', 'window', { opaque: false, layer: LAYER.CUTOUT, sound: 'glass', category: 'details' });
add('LAMP', 'Farol', 'lamp', { layer: LAYER.GLOW, sound: 'glass', category: 'details' });
add('BOOKSHELF', 'Biblioteca', { top: 'planks', side: 'bookshelf', bottom: 'planks' }, { sound: 'wood', category: 'details' });
// Los escalones y losas de los materiales de siempre.
for (const key of ['PLANKS', 'STONE_BRICK']) {
  const b = BLOCKS[BLOCK[key]];
  addShapes(key, b.name, b.tiles, b.sound);
}

Object.freeze(BLOCK);

/** Devuelve la definición de un bloque (aire si el ID no existe). */
export function getBlock(id) {
  return BLOCKS[id] ?? BLOCKS[BLOCK.AIR];
}

/** Lista de nombres de textura que usan los bloques (para validar el atlas). */
export function usedTileNames() {
  const names = new Set();
  for (const b of BLOCKS) {
    if (!b?.tiles) continue;
    names.add(b.tiles.top);
    names.add(b.tiles.side);
    names.add(b.tiles.bottom);
  }
  return [...names];
}

/** Cajas con las que se choca, por ID (null: no se choca, como el aire o el agua). */
export const COLLISION_BOXES = Object.freeze(
  BLOCKS.map((b) => (b?.solid ? (b.boxes ?? Object.freeze([Object.freeze([0, 0, 0, 1, 1, 1])])) : null)),
);
