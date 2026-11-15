// Definición de los tipos de bloque de Megabrick.
//
// Cada bloque es una entrada de una tabla indexada por su ID numérico (lo que
// se guarda en el Uint16Array de cada chunk). Las propiedades describen cómo se
// dibuja y cómo se comporta, así que sumar bloques nuevos (biomas, crafteo,
// etc.) es agregar una fila acá y, si hace falta, una textura en textures.js.
//
// Los IDs se guardan en los mundos: los bloques nuevos se agregan siempre al
// final (nunca se cambia el ID de uno que ya existe). Las formas que giran
// o cambian (escalones, puertas) usan un ID por orientación y estado: el
// jugador ve uno solo ("item") y al ponerlo se elige el que corresponde.

/** Tope de IDs de bloque (las tablas por ID del mallado tienen este tamaño). */
export const MAX_BLOCK_IDS = 1024;

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
  PLANT: 'plant', // planta: dos planos cruzados en X, se atraviesa
  FENCE: 'fence', // cerco: poste y travesaños hacia los vecinos (ver shapes.js)
  PANE: 'pane', // panel fino (vidrio, rejas) que se une con los vecinos
  GATE: 'gate', // tranquera: se abre y se cierra
  LADDER: 'ladder', // escalera de mano: una tabla contra la pared, se trepa
  TRAPDOOR: 'trapdoor', // trampilla: tapa en el piso que se levanta
  CARPET: 'carpet', // alfombra: una capa finita sobre el piso
});

/** Hacia dónde mira algo que gira, como el jugador al ponerlo. */
export const FACING = Object.freeze({ NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 });

/** Grupos del menú de materiales, en orden. */
export const CATEGORIES = Object.freeze([
  { key: 'natural', name: 'Naturaleza' },
  { key: 'plants', name: 'Plantas y flores' },
  { key: 'wood', name: 'Madera' },
  { key: 'stone', name: 'Piedra y ladrillo' },
  { key: 'metal', name: 'Metal y vidrio' },
  { key: 'color', name: 'Revoque de colores' },
  { key: 'carpet', name: 'Alfombras' },
  { key: 'roof', name: 'Techos' },
  { key: 'shapes', name: 'Escalones y losas' },
  { key: 'fences', name: 'Cercos, rejas y escaleras' },
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
 * - hardness: resistencia, en segundos que hay que mantener el clic para
 *   romperlo (si no se indica, según el material: ver HARDNESS_BY_SOUND).
 * - collision: cajas con las que se choca, si no son las de la forma
 *   (null: se atraviesa, como una tranquera abierta o una escalera de mano).
 * - connect: los cercos ('fence') y paneles ('pane') se unen con sus
 *   vecinos (ver shapes.js).
 * - climbable: se trepa (escalera de mano). climbableOverLadder: se trepa
 *   si tiene una escalera de mano abajo (la trampilla abierta).
 * - toggle: el bloque en que se convierte al usarlo (clic derecho): la
 *   tranquera o la trampilla abierta o cerrada.
 * - soil: una planta, que va sobre estos bloques y se rompe si le sacan el
 *   de abajo.
 * - icon: 'flat' para dibujar su ícono como la textura plana (plantas, rejas).
 * - leaves: es follaje (los animales no lo pisan).
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

/**
 * Resistencia según el material (segundos para romperlo): lo blando sale
 * enseguida y la piedra tarda. Cada bloque puede tener la suya.
 */
const HARDNESS_BY_SOUND = { leaves: 0.15, glass: 0.25, grass: 0.35, sand: 0.35, dirt: 0.4, wood: 0.6, stone: 1 };

function def(id, name, tiles, props = {}) {
  const t = typeof tiles === 'string' ? { top: tiles, side: tiles, bottom: tiles } : tiles;
  const block = { id, name, tiles: Object.freeze(t), item: id, ...DEFAULTS, ...props };
  block.hardness ??= HARDNESS_BY_SOUND[block.sound] ?? 1;
  return Object.freeze(block);
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
  def(BLOCK.LOG, 'Tronco', { top: 'log_top', side: 'log_side', bottom: 'log_top' }, { sound: 'wood', category: 'wood', hardness: 0.8 }),
);
register(
  def(BLOCK.LEAVES, 'Follaje', 'leaves', {
    opaque: false,
    layer: LAYER.CUTOUT,
    cullSame: false,
    sound: 'leaves',
    leaves: true,
    category: 'natural',
  }),
);
register(def(BLOCK.ORE_COPPER, 'Mineral de cobrizo', 'ore_copper', { category: 'natural', hardness: 1.3 }));
register(def(BLOCK.ORE_AZURITE, 'Mineral de azurita', 'ore_azurite', { category: 'natural', hardness: 1.5 }));
register(def(BLOCK.ORE_SOLARITE, 'Mineral de solarita', 'ore_solarite', { category: 'natural', hardness: 1.8 }));
register(def(BLOCK.PLANKS, 'Tablones', 'planks', { sound: 'wood', category: 'wood' }));
register(def(BLOCK.STONE_BRICK, 'Ladrillo de piedra', 'stone_brick', { category: 'stone', hardness: 1.2 }));
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
  if (id >= MAX_BLOCK_IDS) throw new Error('No quedan IDs de bloque libres');
  BLOCK[key] = id;
  register(def(id, name, tiles, props));
  return id;
}

/** Cubo entero. */
const FULL_BOX = Object.freeze([0, 0, 0, 1, 1, 1]);
/** Medias cajas (de abajo y de arriba). */
const LOWER_HALF = [0, 0, 0, 1, 0.5, 1];
const UPPER_HALF = [0, 0.5, 0, 1, 1, 1];
/** Grosor de una puerta (3 de 16 píxeles). */
const DOOR_THICKNESS = 3 / 16;

/**
 * Gira una caja un cuarto de vuelta por cada paso de `facing` alrededor del
 * centro del bloque (de norte a este, a sur, a oeste).
 */
export function rotateBox([x0, y0, z0, x1, y1, z1], facing) {
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
function addShapes(key, name, tiles, { sound, hardness }) {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const props = { sound, hardness, opaque: false };
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
  addShapes(key, name, tiles, BLOCKS[cube]);
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
          hardness: 0.5,
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
addMaterial('PLANKS_DARK', 'Tablones oscuros', 'planks_dark', { sound: 'wood', category: 'wood', hardness: 0.7 });
add('PLANKS_LIGHT', 'Tablones claros', 'planks_light', { sound: 'wood', category: 'wood', hardness: 0.55 });
add('PLANKS_RED', 'Tablones rojizos', 'planks_red', { sound: 'wood', category: 'wood' });
add('PARQUET', 'Parqué', 'parquet', { sound: 'wood', category: 'wood' });
// Piedra y ladrillo.
addMaterial('COBBLE', 'Empedrado', 'cobble', { category: 'stone' });
add('SMOOTH_STONE', 'Piedra lisa', 'smooth_stone', { category: 'stone', hardness: 1.1 });
addMaterial('BRICKS', 'Ladrillos', 'bricks', { category: 'stone' });
addMaterial('MARBLE', 'Mármol', 'marble', { category: 'stone', hardness: 1.4 });
addMaterial(
  'SANDSTONE',
  'Arenisca',
  { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_top' },
  { sound: 'sand', category: 'stone', hardness: 0.8 },
);
add('FLOOR_TILES', 'Baldosas', 'floor_tiles', { category: 'stone', hardness: 0.9 });
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
  add(`PLASTER_${key}`, `Revoque ${name}`, `plaster_${key.toLowerCase()}`, { category: 'color', hardness: 0.7 });
}
// Techos.
addMaterial('ROOF_RED', 'Tejas rojas', 'roof_red', { category: 'roof', hardness: 0.8 });
addMaterial('ROOF_GRAY', 'Tejas grises', 'roof_gray', { category: 'roof', hardness: 0.9 });
add('THATCH', 'Paja', { top: 'thatch_top', side: 'thatch_side', bottom: 'thatch_top' }, { sound: 'grass', category: 'roof', hardness: 0.3 });
// Puertas, ventanas y detalles.
addDoor('DOOR_WOOD', 'Puerta de madera', 'door_wood_top', 'door_wood_bottom', { edge: 'planks' });
addDoor('DOOR_DARK', 'Puerta oscura', 'door_dark_top', 'door_dark_bottom', { edge: 'planks_dark' });
add('WINDOW', 'Ventana', 'window', { opaque: false, layer: LAYER.CUTOUT, sound: 'glass', category: 'details' });
add('LAMP', 'Farol', 'lamp', { layer: LAYER.GLOW, sound: 'glass', category: 'details', hardness: 0.35 });
add('BOOKSHELF', 'Biblioteca', { top: 'planks', side: 'bookshelf', bottom: 'planks' }, { sound: 'wood', category: 'details', hardness: 0.5 });
// Los escalones y losas de los materiales de siempre.
for (const key of ['PLANKS', 'STONE_BRICK']) {
  const b = BLOCKS[BLOCK[key]];
  addShapes(key, b.name, b.tiles, b);
}

// ---------------------------------------------------------------------------
// Más bloques (etapa 12): naturaleza, otras maderas, plantas, metal y vidrio,
// cercos, rejas, tranqueras, escaleras de mano, trampillas y alfombras.
// ---------------------------------------------------------------------------

/** Tierra donde crecen las plantas. */
const SOIL = Object.freeze([BLOCK.GRASS, BLOCK.DIRT]);

/** Una planta: dos planos cruzados, se atraviesa y sale con un toque. */
function addPlant(key, name, tile, props = {}) {
  return add(key, name, tile, {
    solid: false,
    opaque: false,
    layer: LAYER.CUTOUT,
    sound: 'grass',
    hardness: 0.05,
    shape: SHAPE.PLANT,
    boxes: Object.freeze([Object.freeze([0.2, 0, 0.2, 0.8, 0.8, 0.8])]),
    soil: SOIL,
    icon: 'flat',
    category: 'plants',
    ...props,
  });
}

/** Un árbol nuevo: tronco, follaje y tablones (con escalones y losas). */
function addTree(key, name, { logTop, logSide, leaves, planks }) {
  add(`${key}_LOG`, `Tronco de ${name}`, { top: logTop, side: logSide, bottom: logTop }, { sound: 'wood', category: 'wood', hardness: 0.8 });
  add(`${key}_LEAVES`, `Follaje de ${name}`, leaves, {
    opaque: false,
    layer: LAYER.CUTOUT,
    cullSame: false,
    sound: 'leaves',
    leaves: true,
    category: 'natural',
  });
  addMaterial(`${key}_PLANKS`, `Tablones de ${name}`, planks, { sound: 'wood', category: 'wood' });
}

/**
 * Cerco o panel que se une con sus vecinos: un ID solo (las uniones se
 * calculan al dibujarlo y al chocar, ver shapes.js).
 */
function addConnected(key, name, tiles, connect, props) {
  return add(key, name, tiles, {
    opaque: false,
    shape: connect === 'fence' ? SHAPE.FENCE : SHAPE.PANE,
    connect,
    ...props,
  });
}

/**
 * Bloques que se abren y se cierran (tranquera, trampilla): 8 IDs (4
 * orientaciones × cerrada/abierta). `closed`/`open`: cajas mirando al norte.
 */
function addToggle(key, name, tiles, shape, { closed, open, closedCollision, openCollision = null, openProps = {}, ...props }) {
  const ids = [];
  for (let facing = 0; facing < 4; facing++) {
    for (const isOpen of [false, true]) {
      const boxes = (isOpen ? open : closed).map((b) => rotateBox(b, facing));
      const coll = isOpen ? openCollision : closedCollision ?? null;
      ids.push(
        add(`${key}_${facing}_${isOpen ? 'OPEN' : 'CLOSED'}`, name, tiles, {
          opaque: false,
          shape,
          boxes: Object.freeze(boxes),
          collision: coll && Object.freeze(coll.map((b) => rotateBox(b, facing))),
          facing,
          open: isOpen,
          ...props,
          ...(isOpen ? openProps : {}),
        }),
      );
    }
  }
  const variants = Object.freeze(ids.filter((_, i) => i % 2 === 0)); // cerradas, por orientación
  ids.forEach((id, i) => {
    BLOCKS[id] = Object.freeze({
      ...BLOCKS[id],
      item: ids[0],
      variants,
      toggle: ids[i ^ 1],
      category: i === 0 ? props.category : null,
    });
  });
  return ids[0];
}

// Naturaleza.
add('GRAVEL', 'Grava', 'gravel', { sound: 'sand', category: 'natural', hardness: 0.45 });
add('CLAY', 'Arcilla', 'clay', { sound: 'dirt', category: 'natural', hardness: 0.45 });
add('SNOW', 'Nieve', 'snow', { sound: 'sand', category: 'natural', hardness: 0.25 });
add('ICE', 'Hielo', 'ice', { sound: 'glass', category: 'natural', hardness: 0.4 });
addMaterial('MOSSY_COBBLE', 'Empedrado con musgo', 'mossy_cobble', { category: 'stone' });
addMaterial('GRANITE', 'Granito', 'granite', { category: 'stone', hardness: 1.3 });
addMaterial('BASALT', 'Basalto', { top: 'basalt_top', side: 'basalt_side', bottom: 'basalt_top' }, { category: 'stone', hardness: 1.3 });
add('CACTUS', 'Cactus', { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_top' }, {
  opaque: false,
  sound: 'leaves',
  hardness: 0.3,
  shape: SHAPE.CUBE,
  boxes: Object.freeze([Object.freeze([1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16])]),
  category: 'plants',
});
// Otras maderas.
addTree('PINE', 'pino', { logTop: 'pine_log_top', logSide: 'pine_log_side', leaves: 'pine_leaves', planks: 'pine_planks' });
addTree('JACARANDA', 'jacarandá', {
  logTop: 'jacaranda_log_top',
  logSide: 'jacaranda_log_side',
  leaves: 'jacaranda_leaves',
  planks: 'jacaranda_planks',
});
// Plantas y flores.
addPlant('TALL_GRASS', 'Pasto alto', 'tall_grass');
addPlant('FERN', 'Helecho', 'fern');
addPlant('FLOWER_DAISY', 'Margarita', 'flower_daisy');
addPlant('FLOWER_CEIBO', 'Flor de ceibo', 'flower_ceibo');
addPlant('FLOWER_BLUE', 'Flor celeste', 'flower_blue');
addPlant('MUSHROOM', 'Hongo', 'mushroom', {
  boxes: Object.freeze([Object.freeze([0.3, 0, 0.3, 0.7, 0.5, 0.7])]),
  soil: Object.freeze([BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE]),
});
// Piedra, hormigón y baldosas.
addMaterial('CONCRETE', 'Hormigón', 'concrete', { category: 'stone', hardness: 1.1 });
add('CALCAREO', 'Baldosa calcárea', 'calcareo', { category: 'stone', hardness: 0.9 });
add('MOSAIC', 'Venecitas', 'mosaic', { category: 'stone', hardness: 0.9 });
// Metal y vidrio.
add('METAL_BLOCK', 'Bloque de hierro', 'metal_block', { category: 'metal', hardness: 1.6 });
add('COPPER_BLOCK', 'Bloque de cobrizo', 'copper_block', { category: 'metal', hardness: 1.5 });
add('AZURITE_BLOCK', 'Bloque de azurita', 'azurite_block', { category: 'metal', hardness: 1.6 });
add('SOLARITE_BLOCK', 'Bloque de solarita', 'solarite_block', { category: 'metal', hardness: 1.8 });
addMaterial('SHEET_METAL', 'Chapa', 'sheet_metal', { category: 'roof', hardness: 0.8 });
addMaterial('SHEET_RUSTY', 'Chapa oxidada', 'sheet_rusty', { category: 'roof', hardness: 0.8 });
for (const [key, name] of [
  ['RED', 'rojo'],
  ['YELLOW', 'amarillo'],
  ['GREEN', 'verde'],
  ['LIGHTBLUE', 'celeste'],
  ['BLUE', 'azul'],
  ['PURPLE', 'violeta'],
]) {
  add(`GLASS_${key}`, `Vidrio ${name}`, `glass_${key.toLowerCase()}`, {
    opaque: false,
    layer: LAYER.TRANSLUCENT,
    sound: 'glass',
    category: 'metal',
  });
}
// Cercos, rejas, paneles, tranqueras, escaleras de mano y trampillas.
addConnected('FENCE_WOOD', 'Cerco de madera', 'planks', 'fence', { sound: 'wood', category: 'fences', hardness: 0.6 });
addConnected('FENCE_DARK', 'Cerco oscuro', 'planks_dark', 'fence', { sound: 'wood', category: 'fences', hardness: 0.6 });
addConnected('IRON_BARS', 'Rejas', 'iron_bars', 'pane', { layer: LAYER.CUTOUT, category: 'fences', hardness: 1.2, icon: 'flat' });
addConnected('GLASS_PANE', 'Panel de vidrio', 'glass', 'pane', {
  layer: LAYER.CUTOUT,
  sound: 'glass',
  category: 'fences',
  hardness: 0.25,
  icon: 'flat',
});
{
  // Tranquera: dos postes en los extremos y dos travesaños; abierta, las
  // hojas giran hacia adelante (hacia donde miraba quien la puso).
  const post = (x0) => [x0, 0, 7 / 16, x0 + 2 / 16, 1, 9 / 16];
  const rails = [
    [0, 6 / 16, 7 / 16, 1, 9 / 16, 9 / 16],
    [0, 12 / 16, 7 / 16, 1, 15 / 16, 9 / 16],
  ];
  const leaf = (x0) => [
    [x0, 6 / 16, 1 / 16, x0 + 2 / 16, 9 / 16, 7 / 16],
    [x0, 12 / 16, 1 / 16, x0 + 2 / 16, 15 / 16, 7 / 16],
  ];
  addToggle('GATE_WOOD', 'Tranquera', 'planks', SHAPE.GATE, {
    closed: [post(0), post(14 / 16), ...rails],
    open: [post(0), post(14 / 16), ...leaf(0), ...leaf(14 / 16)],
    closedCollision: [[0, 0, 6 / 16, 1, 1.5, 10 / 16]],
    sound: 'wood',
    hardness: 0.6,
    category: 'fences',
  });
}
{
  // Escalera de mano: una tabla contra la pared del lado contrario a donde
  // mira (mirando al norte, contra la pared del sur).
  const ids = [];
  for (let facing = 0; facing < 4; facing++) {
    ids.push(
      add(`LADDER_${facing}`, 'Escalera de mano', 'ladder', {
        solid: false,
        opaque: false,
        layer: LAYER.CUTOUT,
        sound: 'wood',
        hardness: 0.4,
        shape: SHAPE.LADDER,
        boxes: Object.freeze([rotateBox([0, 0, 15 / 16, 1, 1, 1], facing)]),
        climbable: true,
        facing,
        icon: 'flat',
      }),
    );
  }
  for (const id of ids) {
    BLOCKS[id] = Object.freeze({ ...BLOCKS[id], item: ids[0], variants: Object.freeze(ids), category: id === ids[0] ? 'fences' : null });
  }
}
{
  // Trampilla: abajo en su celda, o arriba (tapa de un hueco del piso) si
  // se apunta a un techo o a la mitad de arriba de una cara, como la losa.
  // Abierta queda parada contra un costado y, con una escalera de mano
  // abajo, se trepa (para salir de un pozo).
  const trapdoor = (key, y0) => {
    const closed = [[0, y0, 0, 1, y0 + 3 / 16, 1]];
    const open = [[0, 0, 0, 1, 1, 3 / 16]];
    return addToggle(key, 'Trampilla', 'trapdoor', SHAPE.TRAPDOOR, {
      closed,
      open,
      closedCollision: closed,
      openCollision: open,
      openProps: { climbableOverLadder: true },
      layer: LAYER.CUTOUT,
      sound: 'wood',
      hardness: 0.5,
      upper: y0 > 0,
      category: y0 > 0 ? null : 'fences',
    });
  };
  const bottom = trapdoor('TRAPDOOR_WOOD', 0);
  const top = trapdoor('TRAPDOOR_WOOD_TOP', 13 / 16);
  // Las de arriba se ven en la hotbar como la de abajo; la de abajo sabe cuáles son.
  for (let id = top; id < top + 8; id++) BLOCKS[id] = Object.freeze({ ...BLOCKS[id], item: bottom });
  for (let id = bottom; id < bottom + 8; id++) BLOCKS[id] = Object.freeze({ ...BLOCKS[id], upperVariants: BLOCKS[top].variants });
}
// Alfombras de los colores del revoque.
for (const [key, name] of [
  ['WHITE', 'blanca'],
  ['CREAM', 'crema'],
  ['GRAY', 'gris'],
  ['BLACK', 'negra'],
  ['RED', 'roja'],
  ['ORANGE', 'naranja'],
  ['YELLOW', 'amarilla'],
  ['GREEN', 'verde'],
  ['LIGHTBLUE', 'celeste'],
  ['BLUE', 'azul'],
  ['PURPLE', 'violeta'],
  ['PINK', 'rosa'],
]) {
  add(`CARPET_${key}`, `Alfombra ${name}`, `plaster_${key.toLowerCase()}`, {
    opaque: false,
    sound: 'grass',
    hardness: 0.15,
    shape: SHAPE.CARPET,
    boxes: Object.freeze([Object.freeze([0, 0, 0, 1, 1 / 16, 1])]),
    category: 'carpet',
  });
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

/**
 * Cajas con las que se choca, por ID (null: no se choca, como el aire o el
 * agua). Para los cercos y paneles es solo el poste: sus uniones dependen de
 * los vecinos (ver shapes.js, que es lo que usan la física y el apuntado).
 */
export const COLLISION_BOXES = Object.freeze(
  BLOCKS.map((b) => {
    if (!b) return null;
    if (b.collision !== undefined) return b.collision;
    return b.solid ? (b.boxes ?? Object.freeze([FULL_BOX])) : null;
  }),
);
