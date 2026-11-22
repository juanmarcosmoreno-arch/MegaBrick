// Mochila del modo aventura (tecla E, etapa 15): lo que se juntó y lo que
// se puede fabricar.
//
// - Casillas: 3 filas de mochila y abajo la hotbar. Un clic en una casilla
//   la elige y un clic en otra mueve ahí lo elegido (si tienen lo mismo, se
//   junta; si no, se intercambian). Con el mouse sobre una casilla, las
//   teclas 1-9 la cambian por esa casilla de la hotbar.
// - Fabricar: las recetas para las que hay algo en la mochila, primero las
//   que alcanzan. Un clic fabrica una vez.
//
// Con el joystick: la cruz recorre (ver PadMenu.js), A elige o fabrica y B
// (o Vista) vuelve al juego.

import { getItemIcon } from '../items/itemIcons.js';
import { itemName } from '../items/items.js';
import { BACKPACK_SIZE, HOTBAR_SLOTS } from '../items/Backpack.js';
import { RECIPES, canCraft, craft, haveFor, hasSomeOf } from '../items/recipes.js';

export class BackpackMenu {
  /**
   * @param {object} o
   * @param {import('../items/Backpack.js').Backpack} o.backpack
   * @param {import('./Hotbar.js').Hotbar} o.hotbar
   * @param {HTMLCanvasElement} o.atlas canvas del atlas (para los íconos)
   * @param {(resume: boolean) => void} o.onClose al cerrar: `resume` si se
   *   vuelve a jugar (E, Listo) o no (Esc: a la pausa)
   * @param {(recipe: object) => void} [o.onCraft] al fabricar algo
   */
  constructor({ backpack, hotbar, atlas, onClose, onCraft }) {
    this.backpack = backpack;
    this.hotbar = hotbar;
    this.atlas = atlas;
    this.onClose = onClose;
    this.onCraft = onCraft;
    this.panel = document.getElementById('backpack-panel');
    this.slotsEl = document.getElementById('bp-slots');
    this.nameEl = document.getElementById('bp-name');
    this.recipesEl = document.getElementById('bp-recipes');
    /** Casilla elegida para mover (o null). */
    this.picked = null;
    this._hovered = null;
    this._buildSlots();
    document.getElementById('bp-done').addEventListener('click', () => this.onClose(true));
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.onClose(true);
      } else if (e.key === 'Escape') {
        this.onClose(false);
      } else if (/^Digit[1-9]$/.test(e.code)) {
        // La casilla de abajo del mouse (o con foco) va a la hotbar.
        const i = this._hovered ?? this.slotButtons.indexOf(document.activeElement);
        if (i >= 0) {
          this.backpack.move(i, Number(e.code.slice(5)) - 1);
          this.picked = null;
        }
      }
    });
  }

  get isOpen() {
    return !this.panel.hidden;
  }

  open() {
    this.picked = null;
    this.render();
    this.panel.hidden = false;
    this.slotButtons[HOTBAR_SLOTS * 3 + this.hotbar.selected]?.focus();
  }

  close() {
    this.panel.hidden = true;
    this.picked = null;
  }

  /** Nada por frame: la cruz del joystick la maneja PadMenu. */
  update() {}

  /** Orden en pantalla: las 3 filas de la mochila y abajo la hotbar. */
  _slotAt(pos) {
    return pos < BACKPACK_SIZE - HOTBAR_SLOTS ? pos + HOTBAR_SLOTS : pos - (BACKPACK_SIZE - HOTBAR_SLOTS);
  }

  _buildSlots() {
    this.slotButtons = new Array(BACKPACK_SIZE);
    for (let pos = 0; pos < BACKPACK_SIZE; pos++) {
      const i = this._slotAt(pos);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-slot bp-slot';
      if (i < HOTBAR_SLOTS) b.classList.add('bp-hotbar');
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      const count = document.createElement('span');
      count.className = 'hotbar-count';
      b.append(img, count);
      if (i < HOTBAR_SLOTS) {
        const key = document.createElement('span');
        key.className = 'hotbar-key';
        key.textContent = String(i + 1);
        b.appendChild(key);
      }
      b.addEventListener('click', () => this._clickSlot(i));
      b.addEventListener('focus', () => this._showSlot(i));
      b.addEventListener('mouseenter', () => {
        this._hovered = i;
        this._showSlot(i);
      });
      b.addEventListener('mouseleave', () => {
        if (this._hovered === i) this._hovered = null;
      });
      this.slotsEl.appendChild(b);
      this.slotButtons[i] = b;
    }
  }

  _clickSlot(i) {
    if (this.picked === null) {
      if (this.backpack.slots[i]) this.picked = i;
    } else {
      this.backpack.move(this.picked, i);
      this.picked = null;
    }
    this.render();
  }

  _showSlot(i) {
    const s = this.backpack.slots[i];
    this.nameEl.textContent = s ? `${itemName(s.id)}${s.count > 1 ? ` (${s.count})` : ''}` : '';
  }

  /** Vuelve a dibujar todo (se llama también cuando cambia la mochila). */
  render() {
    if (!this.slotButtons) return;
    this.slotButtons.forEach((b, i) => {
      const s = this.backpack.slots[i];
      const img = b.querySelector('img');
      img.hidden = !s;
      if (s) img.src = getItemIcon(this.atlas, s.id);
      b.querySelector('.hotbar-count').textContent = s && s.count > 1 ? String(s.count) : '';
      b.setAttribute('aria-label', s ? `${itemName(s.id)}, ${s.count}` : `Casilla vacía`);
      b.classList.toggle('picked', this.picked === i);
      b.classList.toggle('selected', i === this.hotbar.selected);
    });
    this._renderRecipes();
  }

  _renderRecipes() {
    // Para no perder el foco del joystick al rearmar la lista.
    const focused = document.activeElement?.dataset?.recipe;
    this.recipesEl.textContent = '';
    const shown = RECIPES.map((r, index) => ({ r, index, ok: canCraft(this.backpack, r) }))
      .filter(({ r }) => hasSomeOf(this.backpack, r))
      .sort((a, b) => Number(b.ok) - Number(a.ok));
    if (!shown.length) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Juntá cosas para fabricar: rompé troncos con la mano para empezar.';
      this.recipesEl.appendChild(p);
      return;
    }
    for (const { r, index, ok } of shown) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bp-recipe';
      b.dataset.recipe = String(index);
      b.disabled = !ok;
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = getItemIcon(this.atlas, r.out);
      const text = document.createElement('span');
      text.className = 'bp-recipe-text';
      const title = document.createElement('strong');
      title.textContent = `${r.count > 1 ? `${r.count} × ` : ''}${itemName(r.out)}`;
      const needs = document.createElement('small');
      needs.textContent = r.in.map((i) => `${i.count} ${i.name} (${haveFor(this.backpack, i)})`).join(' + ');
      text.append(title, needs);
      b.append(img, text);
      b.addEventListener('click', () => {
        if (!craft(this.backpack, r)) return;
        this.onCraft?.(r);
        this.render();
        this.recipesEl.querySelector(`[data-recipe="${index}"]:not(:disabled)`)?.focus();
      });
      this.recipesEl.appendChild(b);
    }
    if (focused) this.recipesEl.querySelector(`[data-recipe="${focused}"]`)?.focus();
  }
}
