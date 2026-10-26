// Menú de materiales (tecla E): todos los bloques para construir, por
// grupos. Arriba están las 9 casillas de la hotbar: se elige una y después
// el material que va en ella.
//
// Con el joystick: la cruz recorre (ver PadMenu.js), A pone el material,
// LB/RB cambian de casilla y B (o Vista) vuelve al juego.

import { BLOCKS, CATEGORIES } from '../world/blocks.js';
import { getBlockIcon } from '../render/blockIcons.js';
import { HOTBAR_SIZE } from './Hotbar.js';
import { PAD } from '../player/Gamepad.js';

export class Inventory {
  /**
   * @param {object} o
   * @param {import('./Hotbar.js').Hotbar} o.hotbar
   * @param {HTMLCanvasElement} o.atlas canvas del atlas (para los íconos)
   * @param {(resume: boolean) => void} o.onClose al cerrar: `resume` si
   *   se vuelve a jugar (E, Listo) o no (Esc: a la pausa)
   */
  constructor({ hotbar, atlas, onClose }) {
    this.hotbar = hotbar;
    this.atlas = atlas;
    this.onClose = onClose;
    this.panel = document.getElementById('inventory-panel');
    this.slotsEl = document.getElementById('inv-hotbar');
    this.nameEl = document.getElementById('inv-name');
    this.groupsEl = document.getElementById('inv-groups');
    this._buildSlots();
    this._buildGroups();
    // Si hay más grupos abajo (ventana chica), el borde de abajo se esfuma:
    // así se nota que sigue (en Mac la barra de desplazamiento está oculta).
    const more = () => this._updateMore();
    this.groupsEl.addEventListener('scroll', more, { passive: true });
    window.addEventListener('resize', () => this.isOpen && more());
    document.getElementById('inv-done').addEventListener('click', () => this.onClose(true));
    document.addEventListener('keydown', (e) => {
      // Manteniendo E apretada (la que lo abrió), no se cierra solo.
      if (!this.isOpen || e.repeat) return;
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.onClose(true);
      } else if (e.key === 'Escape') {
        this.onClose(false);
      } else if (/^Digit[1-9]$/.test(e.code)) {
        this.hotbar.select(Number(e.code.slice(5)) - 1);
        this._renderSlots();
      }
    });
  }

  get isOpen() {
    return !this.panel.hidden;
  }

  open() {
    this._renderSlots();
    this._showName(this.hotbar.selectedBlock);
    this.panel.hidden = false;
    // El foco en el material que está en la casilla elegida (o el primero).
    const current = this.groupsEl.querySelector(`[data-id="${this.hotbar.selectedBlock}"]`);
    (current ?? this.groupsEl.querySelector('button'))?.focus({ preventScroll: false });
    this._updateMore();
  }

  _updateMore() {
    const el = this.groupsEl;
    // Con margen para el relleno de abajo (6 px): al final del todo no queda esfumado.
    el.classList.toggle('more-below', el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }

  close() {
    this.panel.hidden = true;
  }

  /** Con el joystick, LB/RB cambian de casilla (el resto lo hace PadMenu). */
  update(pad) {
    const steps = (pad.wasPressed(PAD.RB) ? 1 : 0) - (pad.wasPressed(PAD.LB) ? 1 : 0);
    if (!steps) return;
    this.hotbar.scroll(steps);
    this._renderSlots();
  }

  /** Las 9 casillas de la hotbar: elegir en cuál va el material. */
  _buildSlots() {
    this.slotButtons = [];
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-slot';
      b.setAttribute('role', 'radio');
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      const key = document.createElement('span');
      key.className = 'hotbar-key';
      key.textContent = String(i + 1);
      b.append(img, key);
      b.addEventListener('click', () => {
        this.hotbar.select(i);
        this._renderSlots();
      });
      b.addEventListener('focus', () => this._showName(this.hotbar.slots[i]));
      this.slotsEl.appendChild(b);
      this.slotButtons.push(b);
    }
  }

  _renderSlots() {
    this.slotButtons.forEach((b, i) => {
      const id = this.hotbar.slots[i];
      b.querySelector('img').src = getBlockIcon(this.atlas, id);
      b.setAttribute('aria-label', `Casilla ${i + 1}: ${BLOCKS[id].name}`);
      b.setAttribute('aria-checked', String(i === this.hotbar.selected));
    });
  }

  /** Un grupo por categoría, con un botón por material. */
  _buildGroups() {
    this.groupsEl.textContent = '';
    for (const category of CATEGORIES) {
      const blocks = BLOCKS.filter((b) => b?.category === category.key);
      if (!blocks.length) continue;
      const section = document.createElement('section');
      section.className = 'inv-group';
      const title = document.createElement('h3');
      title.textContent = category.name;
      const grid = document.createElement('div');
      grid.className = 'inv-grid';
      for (const block of blocks) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'inv-item';
        b.dataset.id = String(block.id);
        b.title = block.name;
        b.setAttribute('aria-label', block.name);
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = getBlockIcon(this.atlas, block.id);
        b.appendChild(img);
        b.addEventListener('click', () => {
          this.hotbar.setSlot(this.hotbar.selected, block.id);
          this._renderSlots();
        });
        b.addEventListener('focus', () => this._showName(block.id));
        b.addEventListener('mouseenter', () => this._showName(block.id));
        grid.appendChild(b);
      }
      section.append(title, grid);
      this.groupsEl.appendChild(section);
    }
  }

  _showName(id) {
    this.nameEl.textContent = BLOCKS[id]?.name ?? '';
  }
}
