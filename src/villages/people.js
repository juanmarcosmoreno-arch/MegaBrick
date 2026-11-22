// Los aldeanos (etapa 16): quiénes son y qué comercian. Todo sale de su
// número (id), que es el mismo en todas las computadoras de una partida:
// así cada una sabe su nombre, su oficio y cómo se ve sin mandarlo por la red.
//
// Comercian a cambio de minerales (carbón, cobrizo, azurita, solarita):
// sobre todo cosas que no se fabrican (vidrios de colores, revoques,
// alfombras, flores, metales), y algunos compran lo que sobra.

import { BLOCK } from '../world/blocks.js';
import { ITEM } from '../items/items.js';
import { CHARACTERS } from '../player/characters/index.js';
import { VARIANTS } from '../player/colors.js';

/** Primer id de los aldeanos (los animales usan números chicos). */
const VILLAGER_BASE = 0x40000000;

const NAMES = ['Rosa', 'Tito', 'Chela', 'Beto', 'Nilda', 'Pocho', 'Marta', 'Lalo', 'Mirta', 'Tano', 'Cacho', 'Norma', 'Rubén', 'Elsa', 'Quique', 'Tota'];

/** Un trueque: lo que da el jugador y lo que recibe. */
const t = (giveId, giveCount, getId, getCount) => Object.freeze({ give: Object.freeze([giveId, giveCount]), get: Object.freeze([getId, getCount]) });

/** Oficios: nombre (y en femenino) y sus trueques. */
export const PROFESSIONS = Object.freeze([
  {
    name: 'Herrero',
    nameF: 'Herrera',
    greeting: '¿Necesitás algo de metal?',
    trades: [
      t(ITEM.COPPER, 2, BLOCK.METAL_BLOCK, 1),
      t(ITEM.COAL, 4, BLOCK.IRON_BARS, 8),
      t(ITEM.COPPER, 1, BLOCK.SHEET_METAL, 4),
      t(ITEM.COPPER, 1, BLOCK.SHEET_RUSTY, 4),
      t(ITEM.AZURITE, 2, ITEM.PICK_AZURITE, 1),
      t(BLOCK.COBBLE, 16, ITEM.COAL, 1),
    ],
  },
  {
    name: 'Albañil',
    nameF: 'Albañila',
    greeting: 'Con esto te hacés una casa linda.',
    trades: [
      t(ITEM.COAL, 2, BLOCK.PLASTER_WHITE, 8),
      t(ITEM.COAL, 2, BLOCK.PLASTER_CREAM, 8),
      t(ITEM.COAL, 2, BLOCK.PLASTER_RED, 8),
      t(ITEM.COAL, 2, BLOCK.PLASTER_YELLOW, 8),
      t(ITEM.COAL, 2, BLOCK.PLASTER_LIGHTBLUE, 8),
      t(ITEM.COAL, 2, BLOCK.PLASTER_GREEN, 8),
      t(ITEM.COPPER, 1, BLOCK.CONCRETE, 8),
      t(ITEM.COAL, 2, BLOCK.CALCAREO, 6),
      t(ITEM.COPPER, 1, BLOCK.MOSAIC, 6),
      t(ITEM.COAL, 3, BLOCK.ROOF_RED, 8),
    ],
  },
  {
    name: 'Vidriero',
    nameF: 'Vidriera',
    greeting: '¡Mirá los colores que tengo!',
    trades: [
      t(ITEM.COPPER, 1, BLOCK.GLASS_RED, 6),
      t(ITEM.COPPER, 1, BLOCK.GLASS_YELLOW, 6),
      t(ITEM.COPPER, 1, BLOCK.GLASS_GREEN, 6),
      t(ITEM.COPPER, 1, BLOCK.GLASS_LIGHTBLUE, 6),
      t(ITEM.COPPER, 1, BLOCK.GLASS_BLUE, 6),
      t(ITEM.COPPER, 1, BLOCK.GLASS_PURPLE, 6),
      t(ITEM.COAL, 2, BLOCK.WINDOW, 4),
    ],
  },
  {
    name: 'Tejedor',
    nameF: 'Tejedora',
    greeting: 'Alfombras tejidas a mano.',
    trades: [
      t(ITEM.COAL, 2, BLOCK.CARPET_RED, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_YELLOW, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_GREEN, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_BLUE, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_PURPLE, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_PINK, 4),
      t(ITEM.COAL, 2, BLOCK.CARPET_WHITE, 4),
      t(ITEM.COAL, 2, BLOCK.THATCH, 8),
    ],
  },
  {
    name: 'Jardinero',
    nameF: 'Jardinera',
    greeting: 'Llevate unas flores para tu casa.',
    trades: [
      t(ITEM.COAL, 1, BLOCK.FLOWER_DAISY, 4),
      t(ITEM.COAL, 1, BLOCK.FLOWER_CEIBO, 4),
      t(ITEM.COAL, 1, BLOCK.FLOWER_BLUE, 4),
      t(ITEM.COAL, 1, BLOCK.FERN, 4),
      t(ITEM.COAL, 1, BLOCK.MUSHROOM, 2),
      t(ITEM.COPPER, 1, BLOCK.CACTUS, 2),
      t(BLOCK.LOG, 8, ITEM.COPPER, 1),
    ],
  },
  {
    name: 'Farolero',
    nameF: 'Farolera',
    greeting: 'Que no te agarre la noche a oscuras.',
    trades: [
      t(ITEM.COAL, 2, BLOCK.TORCH_0, 8),
      t(ITEM.SOLARITE, 1, BLOCK.LAMP, 2),
      t(ITEM.SOLARITE, 2, BLOCK.LAMP_OFF, 2),
      t(ITEM.AZURITE, 1, ITEM.SOLARITE, 1),
      t(BLOCK.GLASS, 8, ITEM.COPPER, 1),
    ],
  },
]);

/** Nombres de mujer (para el oficio en femenino). */
const FEMALE = new Set(['Rosa', 'Chela', 'Nilda', 'Marta', 'Mirta', 'Norma', 'Elsa', 'Tota']);

/** Número del aldeano `i` (0 a 15) de la aldea `villageId` (de 26 bits). */
export function villagerId(villageId, i) {
  return VILLAGER_BASE + ((villageId & 0x3ffffff) << 4) + (i & 15);
}

/** ¿Es el número de un aldeano? */
export function isVillagerId(id) {
  return id >= VILLAGER_BASE;
}

const infos = new Map();

/**
 * Quién es el aldeano de ese número: nombre, oficio (índice en
 * PROFESSIONS y su nombre), personaje y color de ropa.
 */
export function villagerInfo(id) {
  if (infos.has(id)) return infos.get(id);
  const n = id - VILLAGER_BASE;
  const village = n >>> 4;
  const i = n & 15;
  const name = NAMES[(village + i * 7) % NAMES.length];
  const profession = (village + i) % PROFESSIONS.length;
  const p = PROFESSIONS[profession];
  const colors = Object.keys(VARIANTS);
  const info = Object.freeze({
    name,
    profession,
    job: FEMALE.has(name) ? p.nameF : p.name,
    character: CHARACTERS[(village * 3 + i * 5) % CHARACTERS.length].id,
    color: colors[(village + i * 3) % colors.length],
  });
  infos.set(id, info);
  return info;
}
