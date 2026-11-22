// Comerciar con un aldeano (clic derecho sobre él, en el modo aventura;
// etapa 16): lo que ofrece a cambio de minerales (y lo que compra). Cada
// clic en una oferta hace el trueque una vez, con lo de la mochila.
//
// Con el joystick: la cruz recorre (ver PadMenu.js), A cambia y B vuelve.

import { getItemIcon } from '../items/itemIcons.js';
import { itemName } from '../items/items.js';
import { PROFESSIONS, villagerInfo } from '../villages/people.js';

export class TradeMenu {
  /**
   * @param {object} o
   * @param {import('../items/Backpack.js').Backpack} o.backpack
   * @param {HTMLCanvasElement} o.atlas
   * @param {(resume: boolean) => void} o.onClose
   * @param {(trade: object) => void} [o.onTrade] al hacer un trueque
   */
  constructor({ backpack, atlas, onClose, onTrade }) {
    this.backpack = backpack;
    this.atlas = atlas;
    this.onClose = onClose;
    this.onTrade = onTrade;
    this.panel = document.getElementById('trade-panel');
    this.titleEl = document.getElementById('trade-title');
    this.greetingEl = document.getElementById('trade-greeting');
    this.offersEl = document.getElementById('trade-offers');
    /** El aldeano con el que se comercia (su id) o null. */
    this.villager = null;
    document.getElementById('trade-done').addEventListener('click', () => this.onClose(true));
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      if (e.code === 'KeyE') {
        e.preventDefault();
        this.onClose(true);
      } else if (e.key === 'Escape') {
        this.onClose(false);
      }
    });
  }

  get isOpen() {
    return !this.panel.hidden;
  }

  /** Abre el puesto del aldeano de ese id. */
  open(id) {
    this.villager = id;
    const who = villagerInfo(id);
    this.titleEl.textContent = `${who.name} · ${who.job}`;
    this.greetingEl.textContent = `«${PROFESSIONS[who.profession].greeting}»`;
    this.render();
    this.panel.hidden = false;
    this.offersEl.querySelector('button:not(:disabled)')?.focus();
  }

  close() {
    this.panel.hidden = true;
    this.villager = null;
  }

  update() {}

  render() {
    if (this.villager === null) return;
    const focused = document.activeElement?.dataset?.offer;
    this.offersEl.textContent = '';
    const { trades } = PROFESSIONS[villagerInfo(this.villager).profession];
    trades.forEach((t, index) => {
      const [giveId, giveCount] = t.give;
      const [getId, getCount] = t.get;
      const have = this.backpack.count(giveId);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bp-recipe trade-offer';
      b.dataset.offer = String(index);
      b.disabled = have < giveCount || !this.backpack.fits(getId, getCount);
      const give = document.createElement('img');
      give.alt = '';
      give.src = getItemIcon(this.atlas, giveId);
      const arrow = document.createElement('span');
      arrow.className = 'trade-arrow';
      arrow.textContent = '→';
      const get = document.createElement('img');
      get.alt = '';
      get.src = getItemIcon(this.atlas, getId);
      const text = document.createElement('span');
      text.className = 'bp-recipe-text';
      const title = document.createElement('strong');
      title.textContent = `${getCount > 1 ? `${getCount} × ` : ''}${itemName(getId)}`;
      const needs = document.createElement('small');
      needs.textContent = `Por ${giveCount} ${itemName(giveId)} (tenés ${have})`;
      text.append(title, needs);
      b.append(give, arrow, get, text);
      b.addEventListener('click', () => {
        if (this.backpack.count(giveId) < giveCount || !this.backpack.fits(getId, getCount)) return;
        this.backpack.remove(giveId, giveCount);
        this.backpack.add(getId, getCount);
        this.onTrade?.(t);
        this.render();
      });
      this.offersEl.appendChild(b);
    });
    const again = focused && this.offersEl.querySelector(`[data-offer="${focused}"]`);
    (again && !again.disabled ? again : this.offersEl.querySelector('button:not(:disabled)'))?.focus();
  }
}
