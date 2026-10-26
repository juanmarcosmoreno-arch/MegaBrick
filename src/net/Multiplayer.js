// Multijugador: jugar en el mismo mundo desde varias computadoras.
//
// - El anfitrión crea la partida y recibe un código. Los invitados se unen
//   con ese código.
// - Al entrar, el invitado recibe la semilla y los cambios de bloques del
//   anfitrión: el terreno lo genera cada uno (misma semilla = mismo mundo),
//   así que por la red viaja muy poco.
// - Cada jugador manda su estado (posición, mirada, animación) unas 15
//   veces por segundo. El anfitrión lo reenvía a los demás.
// - Los cambios de bloques los ordena el anfitrión: los aplica y los reenvía
//   a TODOS (también a quien lo hizo), así todos terminan con el mismo mundo
//   aunque dos jugadores cambien el mismo bloque a la vez.
// - El anfitrión le pone a cada invitado un id corto ('j1', 'j2'...): los
//   ids de la red de cada computadora no se pasan a los demás.
// - Los animales los simula el anfitrión y manda dónde están 5 veces por
//   segundo; los invitados le piden acariciarlos o empujarlos.

import { Session, describeError } from './Session.js';
import {
  MAX_PLAYERS,
  MSG,
  PROTOCOL_VERSION,
  cleanAnimalAct,
  cleanAnimals,
  cleanEdit,
  cleanPlayerInfo,
  cleanPosition,
  cleanState,
  newRoomCode,
  sanitizeName,
} from './protocol.js';
import { RemotePlayer } from '../player/RemotePlayer.js';
import { REACH } from '../player/Interaction.js';
import { NET_INTERVAL } from '../animals/Animals.js';
import { BLOCK } from '../world/blocks.js';

/** Envíos de estado por segundo. */
const STATE_RATE = 15;
/** Estados por segundo que se aceptan de un invitado (con margen). */
const STATE_LIMIT = STATE_RATE * 2;
/** Cambios de bloque por segundo que se aplican de un invitado... */
const EDIT_RATE = 30;
/** ...y cuántos seguidos. Los que pasan de eso esperan en fila, en orden. */
const EDIT_BURST = 60;
/** Máximo de cambios en fila por invitado (más que eso solo con trampa). */
const EDIT_QUEUE_MAX = 600;
/**
 * Distancia máxima (desde los ojos) a la que un invitado puede cambiar un
 * bloque: su alcance más un margen por la demora de la red.
 */
const EDIT_DISTANCE = REACH + 6;
const EYE_HEIGHT = 1.6;
/** Tope de chunks con cambios: más allá, un invitado no puede tocar chunks nuevos. */
const MAX_EDITED_CHUNKS = 20000;
/** Id del anfitrión en los mensajes. */
const HOST_ID = 'h';
/** Cada cuántos segundos el anfitrión manda la hora del día. */
const TIME_SYNC_INTERVAL = 5;
/** Acariciar o empujar animales: por segundo y de una vez, por invitado. */
const ANIMAL_ACT_RATE = 4;
const ANIMAL_ACT_BURST = 6;
/** Tiempo máximo de espera (ms) del "welcome" (invitado) y del "hello" (anfitrión). */
const WELCOME_TIMEOUT = 15000;
const HELLO_TIMEOUT = 10000;
/** Lugares para aparecer al lado del anfitrión (no adentro de su personaje). */
const SPAWN_OFFSETS = [
  [2, 0], [0, 2], [-2, 0], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2],
  [3, 0], [0, 3], [-3, 0], [0, -3],
];

/** Error de una conexión cancelada por el jugador (no hace falta mostrarlo). */
function cancelledError() {
  const err = new Error('Se canceló la conexión.');
  err.cancelled = true;
  return err;
}

export class Multiplayer {
  /**
   * @param {object} game el juego (main.js): world, player, avatar, scene,
   *   materials, hotbar, hud, options, state, loadWorld(), etc.
   */
  constructor(game) {
    this.game = game;
    this.session = null;
    this.role = null; // null (sin partida) | 'host' | 'guest'
    this.code = null;
    this.name = 'Jugador';
    /** @type {Map<string, RemotePlayer>} los demás jugadores, por id en la partida */
    this.players = new Map();
    /** Se llama cuando cambia algo para mostrar (jugadores, estado). */
    this.onChange = null;
    /** Avisos para el jugador: (texto, esAdvertencia) => void. */
    this.onNotice = null;
    this._sendTimer = 0;
    this._timeSync = 0;
    this._animalsTimer = 0;
    this._animalBudget = new Map(); // fichas por invitado (acariciar o empujar)
    this._swing = 0;
    this._pending = null; // conexión en curso (crear o unirse)
    this._pendingWelcome = null;
    // Solo anfitrión:
    this._byPeer = new Map(); // id de la red → id en la partida
    this._nextGuest = 0;
    this._stateBudget = new Map(); // fichas por invitado (límite de estados)
    this._editBudget = new Map(); // fichas por invitado (límite de cambios)
    this._editQueue = new Map(); // cambios en fila por invitado
    this._editListener = (e) => this._onLocalEdit(e);
    this._clock = () => performance.now() / 1000;
  }

  /** ¿Hay una partida en curso? */
  get active() {
    return this.role !== null;
  }

  /** ¿Se está creando una partida o uniéndose a una? */
  get connecting() {
    return this._pending !== null;
  }

  /** Lista para mostrar: [{name, color, me}] */
  get roster() {
    const me = { name: this.name, color: this.game.avatar.variant, me: true };
    return [me, ...[...this.players.values()].map((p) => ({ name: p.name, color: p.color, me: false }))];
  }

  /** Contar una acción (romper/poner) para animar el brazo en las otras computadoras. */
  countAction() {
    this._swing++;
  }

  /** Id de este jugador para los animales (a quién siguen): el anfitrión o el que juega solo. */
  get selfId() {
    return this.role === 'host' ? HOST_ID : 'yo';
  }

  /** Invitado: pedirle al anfitrión acariciar o empujar un animal. */
  sendAnimalAct(id, act) {
    if (this.role === 'guest') this._sendToHost({ t: MSG.ANIMAL, id, act });
  }

  // -------------------------------------------------------------------------
  // Crear partida, unirse, cancelar y salir
  // -------------------------------------------------------------------------

  /** Crea una partida (anfitrión) con el mundo actual. Devuelve el código. */
  async host(name) {
    const pending = this._begin();
    this.name = sanitizeName(name);
    try {
      let lastError;
      // Si el código ya existe (muy raro), se prueba con otro.
      for (let attempt = 0; attempt < 3; attempt++) {
        const code = newRoomCode();
        const session = new Session();
        pending.session = session;
        try {
          await this._unlessCancelled(pending, session.host(code));
        } catch (err) {
          session.close();
          if (pending.cancelled) throw cancelledError();
          lastError = err;
          if (err?.type === 'unavailable-id') continue;
          break;
        }
        this._startHosting(session, code);
        return code;
      }
      throw new Error(describeError(lastError));
    } finally {
      this._end(pending);
    }
  }

  /** Se une a la partida con ese código (invitado). */
  async join(code, name) {
    const pending = this._begin();
    this.name = sanitizeName(name);
    const session = new Session();
    pending.session = session;
    try {
      try {
        await this._unlessCancelled(pending, session.join(code));
      } catch (err) {
        throw pending.cancelled ? cancelledError() : new Error(describeError(err));
      }
      this.session = session;
      this._joinCode = code;
      const welcome = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('El anfitrión no respondió.')), WELCOME_TIMEOUT);
        this._pendingWelcome = { resolve, reject, timer };
      });
      session.onMessage = (msg) => this._guestOnMessage(msg);
      session.onDisconnect = () => this._hostLeft();
      this._sendToHost({ t: MSG.HELLO, v: PROTOCOL_VERSION, name: this.name, color: this.game.avatar.variant });
      await this._unlessCancelled(pending, welcome);
    } catch (err) {
      clearTimeout(this._pendingWelcome?.timer);
      this._pendingWelcome = null;
      session.close();
      if (this.session === session) this.session = null;
      throw pending.cancelled ? cancelledError() : err;
    } finally {
      this._end(pending);
    }
  }

  /** Corta la conexión en curso (por ejemplo, si se cierra el panel). */
  cancel() {
    const pending = this._pending;
    if (!pending || pending.cancelled) return;
    pending.cancelled = true;
    pending.abort(cancelledError());
    pending.session?.close();
  }

  /**
   * Sale de la partida (cierra conexiones y saca a los demás jugadores). Un
   * invitado sigue en el mismo mundo, que pasa a ser suyo y se guarda (salvo
   * con `adopt: false`, si se va a otro mundo). El anfitrión guarda lo último
   * que construyeron los invitados.
   * @param {{adopt?: boolean}} [o]
   */
  leave({ adopt = true } = {}) {
    const wasGuest = this.role === 'guest';
    const wasHost = this.role === 'host';
    this.cancel();
    this.game.world.editListeners.delete(this._editListener);
    for (const id of [...this.players.keys()]) this._removePlayer(id, false);
    this.session?.close();
    this.session = null;
    this.role = null;
    this.code = null;
    this._byPeer.clear();
    // Los animales del anfitrión se van: ahora aparecen los propios.
    if (wasGuest) this.game.animals.reset({ remote: false });
    if (wasGuest && adopt) this.game.saves.adopt();
    else if (wasHost) this.game.saves.saveIfWorthIt();
    this.onChange?.();
  }

  /** Escucha los cambios de bloques del mundo actual (para mandarlos). */
  attachWorld(world) {
    world.editListeners.add(this._editListener);
  }

  /** Empieza una conexión (solo una a la vez y sin partida en curso). */
  _begin() {
    if (this.active || this._pending) throw new Error('Ya estás en una partida o conectándote a una.');
    const pending = { session: null, cancelled: false, abort: null };
    pending.aborted = new Promise((_, reject) => {
      pending.abort = reject;
    });
    pending.aborted.catch(() => {}); // si nadie la espera, que no quede como error suelto
    this._pending = pending;
    this.onChange?.();
    return pending;
  }

  _end(pending) {
    if (this._pending === pending) this._pending = null;
    this.onChange?.();
  }

  /** Espera `promise`, salvo que antes se cancele la conexión. */
  _unlessCancelled(pending, promise) {
    return Promise.race([promise, pending.aborted]);
  }

  // -------------------------------------------------------------------------
  // Cada frame
  // -------------------------------------------------------------------------

  update(dt) {
    if (!this.active) return;
    const now = this._clock();
    for (const p of this.players.values()) p.update(dt, now);
    if (this.role === 'host') {
      this._drainEditQueues();
      this._timeSync -= dt;
      if (this._timeSync <= 0) {
        this._timeSync = TIME_SYNC_INTERVAL;
        this._broadcast({ t: MSG.TIME, time: this.game.sky.time });
      }
      this._animalsTimer -= dt;
      if (this._animalsTimer <= 0 && this.players.size > 0) {
        this._animalsTimer = NET_INTERVAL;
        this._broadcast({ t: MSG.ANIMALS, a: this.game.animals.snapshot() });
      }
    }

    this._sendTimer -= dt;
    if (this._sendTimer > 0) return;
    // Se acumula (no se reinicia) para mandar 15 por segundo aunque los
    // frames no caigan justo; sin juntar deuda si el juego va lento.
    this._sendTimer = Math.max(0, this._sendTimer + 1 / STATE_RATE);
    const state = this._localState();
    if (this.role === 'host') this._broadcast({ t: MSG.STATE, id: HOST_ID, ...state });
    else this._sendToHost({ t: MSG.STATE, ...state });
  }

  _localState() {
    const g = this.game;
    const p = g.player;
    return {
      x: p.position.x,
      y: p.position.y,
      z: p.position.z,
      yaw: p.yaw,
      pitch: p.pitch,
      // En pausa el jugador está quieto (aunque haya quedado con velocidad).
      speed: g.state === 'playing' ? p.horizontalSpeed : 0,
      flying: p.flying && !p.onGround,
      expr: g.avatar.baseExpression,
      held: g.hotbar.selectedBlock,
      swing: this._swing,
      color: g.avatar.variant,
      ts: this._clock(),
    };
  }

  _sendToHost(message) {
    const hostPeer = this.session?.connections.keys().next().value;
    if (hostPeer) this.session.send(hostPeer, message);
  }

  /** Un cambio de bloque del jugador local: se manda por la red. */
  _onLocalEdit({ x, y, z, id, source }) {
    if (source !== 'local' || !this.active) return;
    const message = { t: MSG.EDIT, x, y, z, id };
    if (this.role === 'host') this._broadcast(message);
    else this._sendToHost(message);
  }

  // -------------------------------------------------------------------------
  // Anfitrión
  // -------------------------------------------------------------------------

  _startHosting(session, code) {
    this.session = session;
    this.code = code;
    this.role = 'host';
    session.onConnection = (conn) => this._hostOnConnection(conn.peer);
    session.onMessage = (msg, from) => this._hostOnMessage(msg, from);
    session.onDisconnect = (peerId) => this._hostOnDisconnect(peerId);
    this.attachWorld(this.game.world);
  }

  /**
   * Manda un mensaje a todos los invitados que ya entraron (menos
   * `exceptPeer`). Las conexiones que todavía no mandaron "hello" no reciben nada.
   */
  _broadcast(message, exceptPeer = null) {
    for (const peerId of this._byPeer.keys()) {
      if (peerId !== exceptPeer) this.session.send(peerId, message);
    }
  }

  _hostOnConnection(peerId) {
    // Se espera el "hello" del invitado; si no llega, se corta.
    const session = this.session;
    setTimeout(() => {
      if (session.connections.has(peerId) && !this._byPeer.has(peerId)) session.drop(peerId);
    }, HELLO_TIMEOUT);
  }

  _hostOnDisconnect(peerId) {
    const id = this._byPeer.get(peerId);
    this._byPeer.delete(peerId);
    if (id) this._removePlayer(id, true);
  }

  _hostOnMessage(msg, from) {
    if (!msg || typeof msg !== 'object') return;
    const id = this._byPeer.get(from);
    if (msg.t === MSG.HELLO) {
      if (!id) this._hostWelcome(msg, from); // un solo "hello" por conexión
      return;
    }
    const player = id ? this.players.get(id) : null;
    if (!player) return; // sin "hello" no se acepta nada
    if (msg.t === MSG.STATE) {
      const state = cleanState(msg);
      if (!state || !this._takeToken(this._stateBudget, id, STATE_LIMIT, STATE_LIMIT)) return;
      if (player.push(state, this._clock())) this.onChange?.();
      this._broadcast({ t: MSG.STATE, id, ...state }, from);
    } else if (msg.t === MSG.EDIT) {
      const edit = cleanEdit(msg);
      if (!edit) return;
      const queue = this._editQueue.get(id);
      if (!this._validEdit(edit, player) || queue?.length >= EDIT_QUEUE_MAX) {
        this._sendCorrection(edit, from);
      } else if (queue || !this._takeToken(this._editBudget, id, EDIT_RATE, EDIT_BURST)) {
        // Muchos seguidos (por ejemplo, los que se juntan tras un corte de
        // red): esperan en fila y se aplican en orden (en update).
        if (queue) queue.push(edit);
        else this._editQueue.set(id, [edit]);
      } else {
        this._applyGuestEdit(edit);
      }
    } else if (msg.t === MSG.ANIMAL) {
      const act = cleanAnimalAct(msg);
      const s = player.lastState;
      if (!act || !s || !this._takeToken(this._animalBudget, id, ANIMAL_ACT_RATE, ANIMAL_ACT_BURST)) return;
      // Solo a un animal que tenga al alcance.
      const a = this.game.animals.list.get(act.id);
      if (!a || Math.hypot(a.position.x - s.x, a.position.y - s.y, a.position.z - s.z) > REACH + 3) return;
      this.game.animals.act(act.id, act.act, { id, x: s.x, y: s.y, z: s.z }, this.game.player.position);
    }
  }

  _applyGuestEdit(edit) {
    this.game.world.editBlock(edit.x, edit.y, edit.z, edit.id, 'remote');
    // A todos, también a quien lo hizo: el orden del anfitrión manda.
    this._broadcast({ t: MSG.EDIT, ...edit });
  }

  /** Aplica los cambios en fila de cada invitado, al ritmo permitido. */
  _drainEditQueues() {
    for (const [id, queue] of this._editQueue) {
      while (queue.length && this._takeToken(this._editBudget, id, EDIT_RATE, EDIT_BURST)) {
        this._applyGuestEdit(queue.shift());
      }
      if (!queue.length) this._editQueue.delete(id);
    }
  }

  /**
   * Un cambio rechazado: quien lo hizo ya lo ve aplicado en su pantalla, así
   * que se le devuelve el bloque que hay de verdad (si el anfitrión lo sabe).
   */
  _sendCorrection({ x, y, z, id }, peerId) {
    const actual = this.game.world.knownBlockAt(x, y, z);
    if (actual !== null && actual !== id && actual !== BLOCK.BEDROCK) {
      this.session.send(peerId, { t: MSG.EDIT, x, y, z, id: actual });
    }
  }

  /** ¿Es válido este cambio de un invitado? */
  _validEdit({ x, y, z }, player) {
    const world = this.game.world;
    // Cerca de donde está el invitado.
    const s = player.lastState;
    if (!s) return false;
    const dist = Math.hypot(x + 0.5 - s.x, y + 0.5 - (s.y + EYE_HEIGHT), z + 0.5 - s.z);
    if (dist > EDIT_DISTANCE) return false;
    // El lecho primordial no se rompe (aunque el mensaje lo pida).
    if (world.getBlock(x, y, z) === BLOCK.BEDROCK) return false;
    // Que nadie llene la memoria de todos con cambios en miles de chunks.
    return world.edits.size < MAX_EDITED_CHUNKS || world.hasEditsAt(x, z);
  }

  _hostWelcome(msg, from) {
    const reject = (reason) => {
      this.session.send(from, { t: MSG.REJECT, reason });
      this.session.drop(from); // lo que mande después ya no se escucha
    };
    if (msg.v !== PROTOCOL_VERSION) {
      reject('Esa partida usa otra versión de Megabrick. Recargá la página.');
      return;
    }
    if (this.players.size + 1 >= MAX_PLAYERS) {
      reject(`La partida está llena (máximo ${MAX_PLAYERS} jugadores).`);
      return;
    }
    const info = cleanPlayerInfo({ id: `j${++this._nextGuest}`, name: msg.name, color: msg.color });
    this._byPeer.set(from, info.id);
    const g = this.game;
    // Los demás, con su posición (para que el nuevo no aparezca encima de nadie).
    const others = [...this.players.values()].map((p) => {
      const s = p.lastState;
      return { id: p.id, name: p.name, color: p.color, ...(s && { x: s.x, y: s.y, z: s.z }) };
    });
    this.session.send(from, {
      t: MSG.WELCOME,
      v: PROTOCOL_VERSION,
      seed: g.generator.seed,
      seedText: g.options.seedText,
      edits: g.world.exportEdits(),
      host: { id: HOST_ID, name: this.name, color: g.avatar.variant },
      players: others,
      // Dónde está el anfitrión: el invitado aparece a su lado.
      spawn: { x: g.player.position.x, y: g.player.position.y, z: g.player.position.z },
      time: g.sky.time,
    });
    this._broadcast({ t: MSG.JOIN, ...info }, from);
    this._addPlayer(info);
    this.onNotice?.(`${info.name} entró a la partida`);
  }

  /**
   * Límite por invitado: fichas que se recargan a `rate` por segundo, hasta
   * `burst`. Cada mensaje gasta una; sin fichas, se descarta.
   */
  _takeToken(budget, id, rate, burst) {
    const now = this._clock();
    const bucket = budget.get(id) ?? { tokens: burst, t: now };
    bucket.tokens = Math.min(burst, bucket.tokens + (now - bucket.t) * rate);
    bucket.t = now;
    budget.set(id, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  // -------------------------------------------------------------------------
  // Invitado
  // -------------------------------------------------------------------------

  _guestOnMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case MSG.WELCOME:
        this._guestWelcome(msg);
        break;
      case MSG.REJECT:
        this._pendingWelcome?.reject(new Error(String(msg.reason ?? 'No se pudo entrar a la partida.').slice(0, 200)));
        break;
      case MSG.STATE: {
        const state = cleanState(msg);
        const player = typeof msg.id === 'string' ? this.players.get(msg.id) : null;
        if (state && player && player.push(state, this._clock())) this.onChange?.();
        break;
      }
      case MSG.EDIT: {
        const edit = cleanEdit(msg);
        // Puede ser un cambio propio que vuelve en el orden del anfitrión.
        if (edit && this.active) this.game.world.editBlock(edit.x, edit.y, edit.z, edit.id, 'remote');
        break;
      }
      case MSG.JOIN: {
        const info = cleanPlayerInfo(msg);
        if (info && !this.players.has(info.id) && this.players.size + 1 < MAX_PLAYERS) {
          this._addPlayer(info);
          this.onNotice?.(`${info.name} entró a la partida`);
        }
        break;
      }
      case MSG.LEAVE:
        if (typeof msg.id === 'string') this._removePlayer(msg.id, false, true);
        break;
      case MSG.TIME:
        if (this.active && Number.isFinite(msg.time)) this.game.sky.setTime(msg.time);
        break;
      case MSG.ANIMALS: {
        const list = this.active ? cleanAnimals(msg.a) : null;
        if (list) this.game.animals.applySnapshot(list, this.game.player.position);
        break;
      }
      default:
    }
  }

  _guestWelcome(msg) {
    const pending = this._pendingWelcome;
    if (!pending) return;
    this._pendingWelcome = null;
    clearTimeout(pending.timer);
    if (msg.v !== PROTOCOL_VERSION || !Number.isInteger(msg.seed)) {
      pending.reject(new Error('Esa partida usa otra versión de Megabrick.'));
      return;
    }
    // El mundo del anfitrión: misma semilla y sus cambios. Es suyo: acá no
    // se guarda (salvo que después se siga jugando solo en él).
    const host = cleanPlayerInfo(msg.host);
    const hostPos = cleanPosition(msg.spawn);
    const others = Array.isArray(msg.players) ? msg.players.slice(0, MAX_PLAYERS - 2) : [];
    this.game.loadWorld({
      seed: msg.seed >>> 0,
      seedText: typeof msg.seedText === 'string' ? msg.seedText.slice(0, 64) : String(msg.seed),
      edits: msg.edits,
      spawn: hostPos,
      time: Number.isFinite(msg.time) ? msg.time : undefined,
      save: { foreign: true, name: `Mundo de ${host?.name ?? 'otro'}` },
    });
    if (hostPos) this._placeBeside(hostPos, others.map(cleanPosition).filter(Boolean));
    this.role = 'guest';
    this.code = this._joinCode;
    this.attachWorld(this.game.world);
    // Los animales ahora son los del anfitrión.
    this.game.animals.reset({ remote: true });
    if (host) this._addPlayer(host);
    // Como mucho, los que entran en una partida (sin contar al anfitrión ni a uno mismo).
    for (const p of others) {
      const info = cleanPlayerInfo(p);
      if (info) this._addPlayer(info);
    }
    pending.resolve();
  }

  /**
   * Pone al jugador en un lugar libre al lado del anfitrión (si no, los dos
   * aparecerían uno adentro del otro), mirándolo. `taken`: dónde están los
   * demás jugadores, para no aparecer encima de ellos tampoco.
   */
  _placeBeside(host, taken = []) {
    const world = this.game.world;
    const bx = Math.floor(host.x);
    const by = Math.floor(host.y);
    const bz = Math.floor(host.z);
    const used = (x, z) => taken.some((p) => Math.hypot(p.x - x - 0.5, p.z - z - 0.5) < 1 && Math.abs(p.y - by) < 2);
    const free = (x, z) => !world.isSolid(x, by, z) && !world.isSolid(x, by + 1, z) && !used(x, z);
    let spot = null;
    for (const [dx, dz] of SPAWN_OFFSETS) {
      if (!free(bx + dx, bz + dz)) continue;
      const floor = world.isSolid(bx + dx, by - 1, bz + dz);
      if (floor || !spot) spot = { x: bx + dx + 0.5, z: bz + dz + 0.5, y: floor ? by : host.y };
      if (floor) break; // mejor con piso; si no hay, uno libre (cae un poco)
    }
    if (!spot) return; // todo ocupado: queda donde está el anfitrión
    // Adelante es -Z girado por yaw.
    const yaw = Math.atan2(-(host.x - spot.x), -(host.z - spot.z));
    this.game.player.spawn(spot.x, spot.y, spot.z, yaw, 0);
  }

  _hostLeft() {
    if (this._pendingWelcome) {
      this._pendingWelcome.reject(new Error('Se cortó la conexión con el anfitrión.'));
      return;
    }
    if (this.role !== 'guest') return;
    this.leave();
    this.onNotice?.('Se cortó la conexión con el anfitrión. Seguís jugando solo en este mundo.', true);
  }

  // -------------------------------------------------------------------------
  // Jugadores
  // -------------------------------------------------------------------------

  _addPlayer(info) {
    if (this.players.has(info.id)) return;
    const g = this.game;
    this.players.set(info.id, new RemotePlayer(info, g.scene, g.materials));
    this.onChange?.();
  }

  /**
   * Saca a un jugador. Si es el anfitrión, avisa a los demás (`announce`).
   * `notice` muestra el aviso en pantalla.
   */
  _removePlayer(id, announce, notice = announce) {
    const player = this.players.get(id);
    this._editBudget.delete(id);
    this._editQueue.delete(id);
    this._stateBudget.delete(id);
    this._animalBudget.delete(id);
    if (!player) return;
    this.players.delete(id);
    player.dispose();
    if (announce && this.role === 'host') this._broadcast({ t: MSG.LEAVE, id });
    if (notice) this.onNotice?.(`${player.name} salió de la partida`);
    this.onChange?.();
  }
}
