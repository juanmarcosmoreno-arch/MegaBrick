// Recetas del modo aventura (etapa 15): qué se puede fabricar con lo que
// hay en la mochila (sin mesa de trabajo: se fabrica desde la mochila).
//
// Cada receta da `count` de `out` y pide ingredientes; un ingrediente puede
// aceptar varios objetos ("tablones" de cualquier madera).

import { BLOCK } from '../world/blocks.js';
import { ITEM, TOOL_KINDS, TOOL_MATERIALS, itemName } from './items.js';

/** Grupos de ingredientes que se aceptan como uno (con su nombre). */
const PLANKS = Object.freeze({
  ids: [BLOCK.PLANKS, BLOCK.PINE_PLANKS, BLOCK.JACARANDA_PLANKS, BLOCK.PLANKS_DARK, BLOCK.PLANKS_LIGHT, BLOCK.PLANKS_RED],
  name: 'Tablones',
});
const STONE = Object.freeze({ ids: [BLOCK.COBBLE, BLOCK.MOSSY_COBBLE, BLOCK.STONE], name: 'Empedrado' });

/** Un ingrediente: un objeto, o un grupo. */
const ing = (what, count) =>
  typeof what === 'number'
    ? Object.freeze({ ids: Object.freeze([what]), name: itemName(what), count })
    : Object.freeze({ ids: Object.freeze(what.ids), name: what.name, count });

/** @type {{out: number, count: number, in: {ids: number[], name: string, count: number}[], group: string}[]} */
export const RECIPES = [];

function recipe(group, out, count, ...ins) {
  RECIPES.push(Object.freeze({ out, count, in: Object.freeze(ins.map(([w, n]) => ing(w, n))), group }));
}

// Madera.
recipe('Madera', BLOCK.PLANKS, 4, [BLOCK.LOG, 1]);
recipe('Madera', BLOCK.PINE_PLANKS, 4, [BLOCK.PINE_LOG, 1]);
recipe('Madera', BLOCK.JACARANDA_PLANKS, 4, [BLOCK.JACARANDA_LOG, 1]);
recipe('Madera', ITEM.STICK, 4, [PLANKS, 2]);
recipe('Madera', BLOCK.PLANKS_DARK, 4, [PLANKS, 4], [ITEM.COAL, 1]);
recipe('Madera', BLOCK.PARQUET, 4, [PLANKS, 4]);

// Herramientas: 3 del material y 2 palos (la pala, 1 y 2).
const TOOL_MATERIAL_IN = { WOOD: PLANKS, STONE, COPPER: ITEM.COPPER, AZURITE: ITEM.AZURITE };
for (const k of TOOL_KINDS) {
  for (const m of TOOL_MATERIALS) {
    recipe('Herramientas', ITEM[`${k.key}_${m.key}`], 1, [TOOL_MATERIAL_IN[m.key], k.key === 'SHOVEL' ? 1 : 3], [ITEM.STICK, 2]);
  }
}

// Luz.
recipe('Luz', BLOCK.TORCH_0, 4, [ITEM.COAL, 1], [ITEM.STICK, 1]);
recipe('Luz', BLOCK.LAMP, 1, [ITEM.SOLARITE, 1], [BLOCK.GLASS, 2]);

// Piedra, ladrillo y vidrio (el carbón hace de horno).
recipe('Piedra', BLOCK.STONE_BRICK, 4, [STONE, 4]);
recipe('Piedra', BLOCK.SMOOTH_STONE, 2, [STONE, 2], [ITEM.COAL, 1]);
recipe('Piedra', BLOCK.BRICKS, 4, [BLOCK.CLAY, 4], [ITEM.COAL, 1]);
recipe('Piedra', BLOCK.SANDSTONE, 4, [BLOCK.SAND, 4]);
recipe('Piedra', BLOCK.GLASS, 2, [BLOCK.SAND, 2], [ITEM.COAL, 1]);
recipe('Piedra', BLOCK.GLASS_PANE, 8, [BLOCK.GLASS, 3]);

// Bloques de mineral (y de vuelta).
for (const [block, item] of [
  [BLOCK.COPPER_BLOCK, ITEM.COPPER],
  [BLOCK.AZURITE_BLOCK, ITEM.AZURITE],
  [BLOCK.SOLARITE_BLOCK, ITEM.SOLARITE],
]) {
  recipe('Minerales', block, 1, [item, 9]);
  recipe('Minerales', item, 9, [block, 1]);
}

// Casa: puertas, cercos, escaleras.
recipe('Casa', BLOCK.DOOR_WOOD_0_CLOSED_BOTTOM, 1, [PLANKS, 6]);
recipe('Casa', BLOCK.TRAPDOOR_WOOD_0_CLOSED, 2, [PLANKS, 6]);
recipe('Casa', BLOCK.FENCE_WOOD, 3, [PLANKS, 4], [ITEM.STICK, 2]);
recipe('Casa', BLOCK.GATE_WOOD_0_CLOSED, 1, [PLANKS, 2], [ITEM.STICK, 4]);
recipe('Casa', BLOCK.LADDER_0, 3, [ITEM.STICK, 7]);
recipe('Casa', BLOCK.WINDOW, 2, [BLOCK.GLASS, 2], [PLANKS, 1]);
recipe('Casa', BLOCK.BOOKSHELF, 1, [PLANKS, 6], [ITEM.STICK, 3]);

// Mecanismos.
recipe('Mecanismos', BLOCK.WIRE, 8, [ITEM.COPPER, 1]);
recipe('Mecanismos', BLOCK.LEVER_0_OFF, 1, [ITEM.STICK, 1], [STONE, 1]);
recipe('Mecanismos', BLOCK.BUTTON_0_OFF, 1, [STONE, 1]);
recipe('Mecanismos', BLOCK.PLATE, 1, [STONE, 2]);
recipe('Mecanismos', BLOCK.LAMP_OFF, 1, [ITEM.SOLARITE, 2], [BLOCK.GLASS, 1]);
recipe('Mecanismos', BLOCK.INVERTER_0_OFF, 1, [BLOCK.WIRE, 2], [STONE, 1]);
recipe('Mecanismos', BLOCK.REPEATER_0_OFF, 1, [BLOCK.WIRE, 3], [STONE, 2]);
recipe('Mecanismos', BLOCK.TIMBRE, 1, [ITEM.COPPER, 2], [PLANKS, 1]);
recipe('Mecanismos', BLOCK.PISTON_4, 1, [PLANKS, 3], [STONE, 4], [ITEM.COPPER, 1]);
recipe('Mecanismos', BLOCK.PISTON_STICKY_4, 1, [BLOCK.PISTON_4, 1], [ITEM.SOLARITE, 1]);

// Escalones (4 con 6) y losas (6 con 3) de cada material que los tiene.
for (const key of Object.keys(BLOCK)) {
  if (!key.endsWith('_STAIRS_0')) continue;
  const base = BLOCK[key.slice(0, -'_STAIRS_0'.length)];
  const slab = BLOCK[`${key.slice(0, -'_STAIRS_0'.length)}_SLAB`];
  if (base === undefined) continue;
  recipe('Escalones y losas', BLOCK[key], 4, [base, 6]);
  if (slab !== undefined) recipe('Escalones y losas', slab, 6, [base, 3]);
}

Object.freeze(RECIPES);

/** Cuántos hay en la mochila para un ingrediente (de cualquiera de sus objetos). */
export function haveFor(backpack, ingredient) {
  let n = 0;
  for (const id of ingredient.ids) n += backpack.count(id);
  return n;
}

/** ¿Alcanza lo de la mochila para la receta (y entra lo que da)? */
export function canCraft(backpack, r) {
  return r.in.every((i) => haveFor(backpack, i) >= i.count) && backpack.fits(r.out, r.count);
}

/** ¿Tiene algo de alguno de los ingredientes? (para mostrar solo esas recetas) */
export function hasSomeOf(backpack, r) {
  return r.in.some((i) => haveFor(backpack, i) > 0);
}

/** Fabrica una vez. Devuelve si se pudo. */
export function craft(backpack, r) {
  if (!canCraft(backpack, r)) return false;
  for (const i of r.in) {
    let left = i.count;
    for (const id of i.ids) {
      const n = Math.min(left, backpack.count(id));
      if (n > 0) backpack.remove(id, n);
      left -= n;
      if (left === 0) break;
    }
  }
  backpack.add(r.out, r.count);
  return true;
}
