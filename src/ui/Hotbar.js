// Hotbar: 9 casillas con bloques para construir, abajo en la pantalla.
// Se elige con las teclas 1-9 o con la rueda del mouse; qué bloque va en
// cada casilla se cambia en el menú de materiales (tecla E).
//
// En el modo aventura (etapa 15) muestra las primeras 9 casillas de la
// mochila, con cuántos hay de cada cosa (y puede haber herramientas o
// minerales, que no se ponen).

import { BLOCK, getBlock } from '../world/blocks.js';
import { getItemIcon } from '../items/itemIcons.js';
import { isBlockItem, itemName } from '../items/items.js';

export const HOTBAR_SIZE = 9;

/** Bloques con los que empieza la hotbar. */
export const DEFAULT_HOTBAR = Object.freeze([
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.PLANKS,
  BLOCK.STONE_BRICK,
  BLOCK.GLASS,
  BLOCK.LOG,
  BLOCK.LEAVES,
  BLOCK.SAND,
]);

/** ¿Se puede tener en la hotbar? (los del menú de materiales y sus variantes) */
function isPlaceable(id) {
  return Number.isInteger(id) && Boolean(getBlock(getBlock(id).item ?? id).category);
}

export class Hotbar {
  /**
   * @param {HTMLElement} root contenedor del HUD
   * @param {HTMLCanvasElement} atlasCanvas atlas (para dibujar los íconos)
   */
  constructor(root, atlasCanvas) {
    this.atlas = atlasCanvas;
    this.slots = [...DEFAULT_HOTBAR];
    this.selected = 0;
    /** Mochila del modo aventura (null: creativo). */
    this.backpack = null;
    /** Se llama al cambiar de casilla o de lo que hay en ella: (itemId | null) => void. */
    this.onChange = null;

    this.el = document.createElement('div');
    this.el.className = 'hotbar';
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'hotbar-name';
    this.slotEls = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot';
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      const num = document.createElement('span');
      num.className = 'hotbar-key';
      num.textContent = String(i + 1);
      const count = document.createElement('span');
      count.className = 'hotbar-count';
      slot.append(img, num, count);
      this.el.appendChild(slot);
      this.slotEls.push(slot);
    }
    root.append(this.nameEl, this.el);
    this._nameTimer = 0;
    this.render();
  }

  /** Lo que hay en la casilla elegida (bloque u objeto), o null si está vacía. */
  get selectedItem() {
    if (this.backpack) return this.backpack.slots[this.selected]?.id ?? null;
    return this.slots[this.selected];
  }

  /** ID del bloque de la casilla elegida, o null si no hay un bloque para poner. */
  get selectedBlock() {
    const id = this.selectedItem;
    return isBlockItem(id) ? id : null;
  }

  /** Pasa al modo aventura (con la mochila) o al creativo (null). */
  setBackpack(backpack) {
    this.backpack = backpack;
    this.render();
    this.onChange?.(this.selectedItem);
  }

  /** Se gastó uno de la casilla elegida (al poner un bloque en el modo aventura). */
  useSelected() {
    if (this.backpack) this.backpack.takeOne(this.selected);
  }

  /** Muestra un texto un momento arriba de la hotbar (lo que se juntó). */
  showText(text) {
    this.nameEl.textContent = text;
    this.nameEl.classList.add('visible');
    this._nameTimer = 1.6;
  }

  /** Elige una casilla (0 a 8). */
  select(index) {
    const i = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    if (i === this.selected) return;
    this.selected = i;
    this.render();
    this._showName();
    this.onChange?.(this.selectedItem);
  }

  /** Avanza o retrocede casillas (rueda del mouse). */
  scroll(steps) {
    if (steps) this.select(this.selected + steps);
  }

  /** Pone un bloque en una casilla (y la elige). */
  setSlot(index, id) {
    const i = ((index % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
    this.slots[i] = isPlaceable(id) ? getBlock(id).item : this.slots[i];
    this.selected = i;
    this.render();
    this._showName();
    this.onChange?.(this.selectedItem);
  }

  /** Cambia el contenido de la hotbar (por ejemplo, al cargar una partida). */
  setSlots(slots, selected = 0) {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const id = slots[i];
      this.slots[i] = isPlaceable(id) ? getBlock(id).item : DEFAULT_HOTBAR[i];
    }
    this.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, selected | 0));
    this.render();
    this.onChange?.(this.selectedItem);
  }

  render() {
    this.slotEls.forEach((slot, i) => {
      const s = this.backpack ? this.backpack.slots[i] : { id: this.slots[i], count: 0 };
      const img = slot.querySelector('img');
      img.hidden = !s;
      if (s) img.src = getItemIcon(this.atlas, s.id);
      slot.title = s ? itemName(s.id) : '';
      slot.querySelector('.hotbar-count').textContent = s && s.count > 1 ? String(s.count) : '';
      slot.classList.toggle('selected', i === this.selected);
    });
  }

  _showName() {
    const id = this.selectedItem;
    if (id === null) return;
    this.showText(itemName(id));
  }

  /** Se llama una vez por frame (oculta el nombre después de un rato). */
  update(dt) {
    if (this._nameTimer > 0) {
      this._nameTimer -= dt;
      if (this._nameTimer <= 0) this.nameEl.classList.remove('visible');
    }
  }
}
