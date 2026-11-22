// Objetos del modo aventura (etapa 15): lo que se junta y se fabrica.
//
// Un objeto se identifica con un número: los bloques usan su ID de bloque
// (el del menú, ver blocks.js) y lo que no es un bloque (minerales, palo,
// herramientas) usa IDs desde ITEM_BASE. Los IDs se guardan en la mochila
// de los mundos: los nuevos van siempre al final.

import { BLOCK, MAX_BLOCK_IDS, getBlock } from '../world/blocks.js';

/** Primer ID de los objetos que no son bloques. */
export const ITEM_BASE = MAX_BLOCK_IDS;

/** Cuántos entran en una casilla. */
export const STACK = 64;

/**
 * Herramientas: de qué son (madera, piedra, cobrizo, azurita), su nivel y
 * cuánto más rápido rompen lo suyo.
 */
export const TOOL_MATERIALS = Object.freeze([
  { key: 'WOOD', name: 'madera', tier: 1, speed: 2, color: [176, 132, 80] },
  { key: 'STONE', name: 'piedra', tier: 2, speed: 3, color: [140, 140, 146] },
  { key: 'COPPER', name: 'cobrizo', tier: 3, speed: 4.5, color: [222, 128, 66] },
  { key: 'AZURITE', name: 'azurita', tier: 4, speed: 6, color: [70, 134, 238] },
]);

/** Clases de herramienta: qué rompe cada una. */
export const TOOL_KINDS = Object.freeze([
  { key: 'PICK', name: 'Pico', kind: 'pico' },
  { key: 'AXE', name: 'Hacha', kind: 'hacha' },
  { key: 'SHOVEL', name: 'Pala', kind: 'pala' },
]);

/** IDs de los objetos que no son bloques (se completa abajo). */
export const ITEM = {};

/** Definiciones por ID (solo los que no son bloques). */
const ITEMS = new Map();

let nextId = ITEM_BASE;
function addItem(key, name, props = {}) {
  const id = nextId++;
  ITEM[key] = id;
  ITEMS.set(id, Object.freeze({ id, key, name, stack: STACK, ...props }));
  return id;
}

// Minerales y materiales (el orden no se cambia: se guarda).
addItem('COAL', 'Carbón', { icon: 'lump', color: [44, 42, 48] });
addItem('COPPER', 'Cobrizo', { icon: 'nugget', color: [222, 128, 66] });
addItem('AZURITE', 'Azurita', { icon: 'gem', color: [70, 134, 238] });
addItem('SOLARITE', 'Solarita', { icon: 'gem', color: [250, 210, 70] });
addItem('STICK', 'Palo', { icon: 'stick' });
// Herramientas: picos, hachas y palas de cada material.
for (const k of TOOL_KINDS) {
  for (const m of TOOL_MATERIALS) {
    addItem(`${k.key}_${m.key}`, `${k.name} de ${m.name}`, {
      icon: k.kind,
      color: m.color,
      stack: 1,
      tool: Object.freeze({ kind: k.kind, tier: m.tier, speed: m.speed }),
    });
  }
}
Object.freeze(ITEM);

/** ¿Es un bloque (se pone en el mundo)? */
export function isBlockItem(id) {
  return Number.isInteger(id) && id > 0 && id < ITEM_BASE;
}

/** ¿Es un objeto que existe (bloque del menú u objeto)? */
export function isItem(id) {
  if (isBlockItem(id)) {
    const b = getBlock(id);
    return b.id === id && b.item === id && Boolean(b.category);
  }
  return ITEMS.has(id);
}

/** Definición de un objeto que no es bloque (o undefined). */
export function getItem(id) {
  return ITEMS.get(id);
}

/** Nombre para mostrar. */
export function itemName(id) {
  return isBlockItem(id) ? getBlock(id).name : (ITEMS.get(id)?.name ?? '');
}

/** Cuántos entran en una casilla. */
export function stackSize(id) {
  return isBlockItem(id) ? STACK : (ITEMS.get(id)?.stack ?? STACK);
}

/** La herramienta, si lo es ({kind, tier, speed}), o null. */
export function toolOf(id) {
  return ITEMS.get(id)?.tool ?? null;
}

/** Todos los objetos que no son bloques. */
export function allItems() {
  return [...ITEMS.values()];
}

// ---------------------------------------------------------------------------
// Romper en el modo aventura: qué herramienta va, cuánto tarda y qué da.
// ---------------------------------------------------------------------------

/** Qué herramienta rompe mejor cada material (por su sonido). */
const KIND_BY_SOUND = { stone: 'pico', glass: 'pico', wood: 'hacha', dirt: 'pala', sand: 'pala', grass: 'pala' };

/** Minerales: lo que dan y el nivel de pico que piden (1 madera, 2 piedra, 3 cobrizo). */
const ORES = new Map([
  [BLOCK.ORE_COAL, { drop: ITEM.COAL, tier: 1 }],
  [BLOCK.ORE_COPPER, { drop: ITEM.COPPER, tier: 2 }],
  [BLOCK.ORE_AZURITE, { drop: ITEM.AZURITE, tier: 3 }],
  [BLOCK.ORE_SOLARITE, { drop: ITEM.SOLARITE, tier: 3 }],
]);

/** Lo que se rompe y no da nada (o casi): pasto, helechos y follaje. */
const LEAVES = new Set([BLOCK.LEAVES, BLOCK.PINE_LEAVES, BLOCK.JACARANDA_LEAVES]);
const NOTHING = new Set([BLOCK.TALL_GRASS, BLOCK.FERN]);

/**
 * Nivel de pico que hace falta para que un bloque dé algo (0: ninguno). La
 * piedra y lo hecho de piedra piden al menos uno de madera.
 */
export function pickTierFor(block) {
  const ore = ORES.get(block.id);
  if (ore) return ore.tier;
  return block.sound === 'stone' && block.hardness >= 0.5 ? 1 : 0;
}

/**
 * Segundos que tarda en romperse `block` en el modo aventura con `toolId`
 * en la mano: más que en el creativo, menos con la herramienta que va, y
 * mucho más la piedra sin pico.
 */
export function breakSeconds(block, toolId) {
  const tool = toolOf(toolId);
  let speed = 1;
  if (tool && tool.kind === KIND_BY_SOUND[block.sound]) speed = tool.speed;
  else if (pickTierFor(block) > 0) speed = 0.3;
  return (block.hardness * 1.5) / speed;
}

/**
 * Lo que da un bloque al romperlo con `toolId` en la mano: {id, count} o
 * null (si no da nada, o hace falta un pico mejor). `rnd` en [0, 1).
 */
export function dropFor(blockId, toolId, rnd = Math.random()) {
  const block = getBlock(blockId);
  const tool = toolOf(toolId);
  const need = pickTierFor(block);
  if (need > 0 && !(tool?.kind === 'pico' && tool.tier >= need)) return null;
  const ore = ORES.get(blockId);
  if (ore) return { id: ore.drop, count: 1 };
  if (blockId === BLOCK.GRASS) return { id: BLOCK.DIRT, count: 1 };
  if (blockId === BLOCK.STONE) return { id: BLOCK.COBBLE, count: 1 };
  // El follaje a veces suelta un palo.
  if (LEAVES.has(blockId)) return rnd < 0.15 ? { id: ITEM.STICK, count: 1 } : null;
  // La cabeza de un pistón es parte del pistón (que da él solo).
  if (NOTHING.has(blockId) || block.circuit === 'head') return null;
  const item = block.item ?? blockId;
  return isItem(item) ? { id: item, count: 1 } : null;
}
