// Mochila del modo aventura (etapa 15): 36 casillas con lo que se juntó.
// Las primeras 9 son la hotbar (lo que se tiene a mano); el resto, la
// mochila. Cada casilla está vacía (null) o tiene {id, count}.

import { isItem, stackSize } from './items.js';

export const BACKPACK_SIZE = 36;
export const HOTBAR_SLOTS = 9;

export class Backpack {
  constructor() {
    /** @type {({id: number, count: number} | null)[]} */
    this.slots = new Array(BACKPACK_SIZE).fill(null);
    /** Se llama cuando cambia algo. */
    this.onChange = null;
  }

  _changed() {
    this.onChange?.();
  }

  /** Vacía todo. */
  clear() {
    this.slots.fill(null);
    this._changed();
  }

  /** Cuántos hay de `id` en total. */
  count(id) {
    let n = 0;
    for (const s of this.slots) if (s?.id === id) n += s.count;
    return n;
  }

  /**
   * Guarda `count` de `id`: primero completa las casillas que ya lo tienen
   * y después usa las vacías (las de la hotbar primero). Devuelve cuántos no
   * entraron.
   */
  add(id, count = 1) {
    if (!isItem(id) || count <= 0) return count;
    const max = stackSize(id);
    let left = count;
    for (const s of this.slots) {
      if (left === 0) break;
      if (s?.id !== id || s.count >= max) continue;
      const n = Math.min(left, max - s.count);
      s.count += n;
      left -= n;
    }
    for (let i = 0; i < BACKPACK_SIZE && left > 0; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(left, max);
      this.slots[i] = { id, count: n };
      left -= n;
    }
    if (left !== count) this._changed();
    return left;
  }

  /** ¿Entran `count` de `id`? */
  fits(id, count = 1) {
    const max = stackSize(id);
    let room = 0;
    for (const s of this.slots) room += s === null ? max : s.id === id ? max - s.count : 0;
    return room >= count;
  }

  /** Saca `count` de `id` (de donde haya, empezando por la mochila). Devuelve si había. */
  remove(id, count = 1) {
    if (this.count(id) < count) return false;
    let left = count;
    for (let i = BACKPACK_SIZE - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s?.id !== id) continue;
      const n = Math.min(left, s.count);
      s.count -= n;
      left -= n;
      if (s.count === 0) this.slots[i] = null;
    }
    this._changed();
    return true;
  }

  /** Saca uno de la casilla `i` (al poner un bloque). */
  takeOne(i) {
    const s = this.slots[i];
    if (!s) return false;
    s.count--;
    if (s.count === 0) this.slots[i] = null;
    this._changed();
    return true;
  }

  /**
   * Mueve lo de la casilla `from` a `to`: si tienen lo mismo, junta lo que
   * entre; si no, las intercambia.
   */
  move(from, to) {
    if (from === to) return;
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a) return;
    if (b && b.id === a.id) {
      const n = Math.min(a.count, stackSize(a.id) - b.count);
      b.count += n;
      a.count -= n;
      if (a.count === 0) this.slots[from] = null;
    } else {
      this.slots[from] = b;
      this.slots[to] = a;
    }
    this._changed();
  }

  /** Para guardar: [[id, count] o null, ...]. */
  toJSON() {
    return this.slots.map((s) => (s ? [s.id, s.count] : null));
  }

  /** Carga lo guardado (lo que no se entiende se descarta). */
  load(data) {
    this.slots.fill(null);
    if (Array.isArray(data)) {
      data.slice(0, BACKPACK_SIZE).forEach((s, i) => {
        if (!Array.isArray(s)) return;
        const [id, count] = s;
        if (isItem(id) && Number.isInteger(count) && count > 0) this.slots[i] = { id, count: Math.min(count, stackSize(id)) };
      });
    }
    this._changed();
  }
}
