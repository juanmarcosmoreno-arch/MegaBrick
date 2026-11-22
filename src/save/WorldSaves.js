// Guardado de mundos: cuál es el mundo actual, autoguardado, cargar y borrar.
//
// - El mundo actual es un registro de la base (con id) o uno que todavía no
//   se guardó (id null): un mundo nuevo se guarda al empezar a jugarlo.
// - Se guarda cada 30 s, al pausar, al cambiar de mundo, al salir al inicio
//   y al ocultar la pestaña. Cada vez van solo los chunks que cambiaron.
// - El mundo de una partida en la que se entró como invitado no se guarda:
//   es de quien la creó. Si después se sigue jugando solo en ese mundo, se
//   guarda como un mundo propio ("Mundo de Ana").

import { SaveStore } from './SaveStore.js';
import { START_TIME } from '../render/Sky.js';
import { validGeneration } from '../world/TerrainGen.js';

/** Segundos entre autoguardados. */
const AUTOSAVE_INTERVAL = 30;
/** Versión del formato guardado (por si cambia más adelante). */
const SAVE_VERSION = 1;
/** Largo máximo del nombre de un mundo. */
export const MAX_WORLD_NAME = 24;

/** Nombre de mundo limpio (sin caracteres invisibles, con largo máximo) o null. */
export function cleanWorldName(text) {
  const clean = String(text ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(clean).slice(0, MAX_WORLD_NAME).join('').trim() || null;
}

/** Datos del mundo actual (cada mundo cargado tiene su propio objeto). */
function newCurrent({ id = null, name = null, foreign = false, createdAt = null } = {}) {
  return { id, name: cleanWorldName(name), foreign, createdAt, deleted: false };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export class WorldSaves {
  /** @param {object} game el juego (main.js): world, player, hotbar, options, inGame */
  constructor(game) {
    this.game = game;
    this.store = new SaveStore();
    /** ¿Se puede guardar en este navegador? (null: todavía no se sabe) */
    this.available = null;
    /** Registros de los mundos guardados, del jugado más recientemente al más viejo. */
    this.worlds = [];
    /** El mundo que se está jugando. */
    this.current = newCurrent();
    /** Cómo salió el último guardado: 'idle' | 'saving' | 'saved' | 'error'. */
    this.status = 'idle';
    /** Algo para mostrar cambió (lista, estado del guardado). */
    this.onChange = null;
    /** Avisos para el jugador: (texto) => void. */
    this.onNotice = null;
    this._timer = AUTOSAVE_INTERVAL;
    this._queue = Promise.resolve(); // los guardados van de a uno, en orden
  }

  /** Abre la base y lee la lista de mundos. */
  async init() {
    try {
      // Si la base no responde (pasa en algunos navegadores), se juega sin guardar.
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB no responde.')), 5000));
      await Promise.race([this.store.open(), timeout]);
      this.available = true;
      await this.refresh();
    } catch {
      this.available = false;
      this.onChange?.();
    }
  }

  /** Vuelve a leer la lista de mundos guardados. */
  async refresh() {
    if (!this.available) return;
    try {
      this.worlds = await this.store.list();
    } catch {
      // Se sigue con la lista anterior.
    }
    this.onChange?.();
  }

  /** ¿Se guarda el mundo actual? (no si es de otro o si el navegador no deja) */
  get canSave() {
    return this.available !== false && !this.current.foreign;
  }

  /**
   * Cambia el mundo actual (lo llama el juego al cargar otro mundo).
   * @param {{id?: number|null, name?: string|null, foreign?: boolean, createdAt?: number|null}} [info]
   */
  setCurrent(info) {
    this.current = newCurrent(info);
    this.status = 'idle';
    this._timer = AUTOSAVE_INTERVAL;
    this.onChange?.();
  }

  /**
   * El mundo de otro (multijugador) pasa a ser propio: se dejó de jugar como
   * invitado y se sigue en ese mundo. Se guarda como un mundo nuevo.
   */
  adopt() {
    if (!this.current.foreign) return;
    this.setCurrent({ name: this._uniqueName(this.current.name) });
    if (this.game.inGame) this.save();
  }

  /** "Mundo de Ana", o "Mundo de Ana 2" si ya hay uno con ese nombre. */
  _uniqueName(name) {
    const taken = new Set(this.worlds.map((w) => w.name));
    if (!taken.has(name)) return name;
    let n = 2;
    while (taken.has(`${name} ${n}`)) n++;
    return `${name} ${n}`;
  }

  /** Autoguardado: `active` si se está en un mundo (jugando, en pausa o compartiéndolo). */
  update(dt, active) {
    if (!active) return;
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = AUTOSAVE_INTERVAL;
    this.save();
  }

  /** Guarda si vale la pena: el mundo ya está guardado o tiene cambios. */
  saveIfWorthIt() {
    const cur = this.current;
    if (cur.id !== null || this.game.world.edits.size > 0) return this.save();
    return Promise.resolve(false);
  }

  /**
   * Guarda el mundo actual. Lo que se guarda se toma en este momento (por
   * eso se puede cambiar de mundo enseguida); la escritura va en fila.
   * Un mundo que todavía no está en la base se guarda entero.
   * @returns {Promise<boolean>} si se guardó
   */
  save() {
    const cur = this.current;
    if (!this.canSave || cur.deleted) return Promise.resolve(false);
    const g = this.game;
    const world = g.world;
    const keys = cur.id === null ? [...world.edits.keys()] : [...world.unsaved];
    world.unsaved.clear();
    const chunks = world.exportChunkEdits(keys);
    cur.name ??= this.defaultName();
    cur.createdAt ??= Date.now();
    const p = g.player;
    const meta = {
      version: SAVE_VERSION,
      name: cur.name,
      seed: g.options.seed,
      seedText: g.options.seedText,
      // Versión del generador del terreno (ver TerrainGen.GENERATION).
      generation: g.generator.generation,
      createdAt: cur.createdAt,
      playedAt: Date.now(),
      player: {
        x: p.position.x,
        y: p.position.y,
        z: p.position.z,
        yaw: p.yaw,
        pitch: p.pitch,
        flying: p.flying,
      },
      hotbar: { slots: [...g.hotbar.slots], selected: g.hotbar.selected },
      time: g.sky.time,
    };
    this.status = 'saving';
    this.onChange?.();
    const job = this._queue.then(async () => {
      if (cur.deleted) return false; // se borró mientras esperaba
      try {
        // Si un guardado anterior de este mismo mundo ya lo creó, se actualiza.
        cur.id = await this.store.save({ ...meta, id: cur.id }, chunks);
        if (cur === this.current) this.status = 'saved';
        return true;
      } catch (err) {
        console.error('No se pudo guardar el mundo:', err);
        // Lo que no se guardó queda pendiente para la próxima vez.
        if (world === this.game.world) for (const key of keys) world.unsaved.add(key);
        if (cur === this.current) {
          if (this.status !== 'error') this.onNotice?.('No se pudo guardar el mundo.');
          this.status = 'error';
        }
        return false;
      }
    });
    this._queue = job.then(() => this.refresh());
    return job;
  }

  /**
   * Lee un mundo guardado y revisa sus datos (pueden venir de una versión
   * vieja o estar dañados). Devuelve lo necesario para cargarlo, o null.
   */
  async load(id) {
    await this._queue; // que termine de guardarse lo pendiente
    const data = await this.store.load(id);
    if (!data) return null;
    const { meta, edits } = data;
    const pl = meta.player;
    const player = pl && [pl.x, pl.y, pl.z, pl.yaw, pl.pitch].every(isNum) ? pl : null;
    return {
      seed: Number.isInteger(meta.seed) ? meta.seed >>> 0 : 0,
      seedText: typeof meta.seedText === 'string' ? meta.seedText : String(meta.seed),
      // Los guardados de antes de la etapa 12 no la tienen: terreno de antes.
      generation: validGeneration(meta.generation),
      edits,
      player,
      hotbar: Array.isArray(meta.hotbar?.slots) ? meta.hotbar : null,
      time: isNum(meta.time) ? meta.time : START_TIME,
      save: { id: meta.id, name: cleanWorldName(meta.name) ?? 'Mundo', createdAt: meta.createdAt ?? null },
    };
  }

  /**
   * Borra un mundo guardado. Si es el abierto, deja de guardarse solo cuando
   * el borrado salió bien (los guardados que ya estaban en fila se escriben
   * antes y el borrado se los lleva).
   */
  delete(id) {
    const cur = this.current.id === id ? this.current : null;
    const job = this._queue.then(async () => {
      await this.store.delete(id);
      if (cur) cur.deleted = true;
    });
    this._queue = job.catch(() => {}).then(() => this.refresh());
    return job;
  }

  /** "Mundo 1", "Mundo 2"... (el siguiente número libre). */
  defaultName() {
    let max = 0;
    for (const w of this.worlds) {
      const m = /^Mundo (\d+)$/.exec(w.name ?? '');
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `Mundo ${max + 1}`;
  }
}
