// Circuitos de energía (etapa 13). La energía está prendida o apagada (sin
// niveles) y se propaga de a pasos, 10 veces por segundo:
//
// - Fuentes: la palanca (prendida o apagada), el botón (un segundo), la
//   placa de presión (mientras alguien la pisa) y el bloque de solarita
//   (siempre).
// - El cable de cobrizo lleva la energía: un tramo de cables unidos está
//   prendido si alguno toca una fuente (al instante, en todo el tramo).
// - Lo que se enciende con energía de cualquiera de sus 6 lados: la
//   lámpara, el timbre (suena al prenderse), el pistón (empuja hasta 12
//   bloques; el pegajoso además trae uno de vuelta) y las puertas,
//   trampillas y tranqueras (se abren al llegar la energía y se cierran al
//   irse; mientras tanto también se pueden usar a mano).
// - Compuertas, con entrada atrás y salida adelante (solo hacia adelante):
//   el inversor da energía cuando NO le llega (un paso después) y el
//   retardador la pasa igual, pero 0,3 s después. Un inversor que se
//   alimenta a sí mismo hace un reloj que titila.
//
// Los cambios son ediciones comunes del mundo (se guardan y viajan por la
// red). En el multijugador los calcula solo el anfitrión.

import { BLOCK, DIRS6, SHAPE, getBlock } from './blocks.js';
import { CHUNK_HEIGHT } from './Chunk.js';

/** Segundos por paso. */
const TICK = 0.1;
/** Pasos que tarda cada compuerta y cuánto dura apretado el botón. */
const INVERTER_TICKS = 1;
const REPEATER_TICKS = 3;
const BUTTON_TICKS = 10;
/** Topes: cables en un tramo y bloques que empuja un pistón. */
const MAX_WIRES = 1024;
const MAX_PUSH = 12;
/** Pasos que se ponen al día por frame (si el juego se trabó, no se acumulan). */
const MAX_TICKS_PER_FRAME = 4;
/** Alto de la placa de presión que cuenta para pisarla. */
const PLATE_HEIGHT = 0.25;

const key = (x, y, z) => `${x},${y},${z}`;

/** ¿El bloque `b` le da energía a su vecino en la dirección (dx, dy, dz)? */
function emitsTo(b, dx, dy, dz) {
  if (b.id === BLOCK.SOLARITE_BLOCK) return true;
  switch (b.circuit) {
    case 'lever':
    case 'button':
    case 'plate':
    case 'wire':
      return b.on;
    case 'inverter':
    case 'repeater': {
      // Solo hacia adelante.
      const [fx, , fz] = DIRS6[b.facing];
      return b.on && dx === fx && dy === 0 && dz === fz;
    }
    default:
      return false;
  }
}

/** ¿Se puede empujar con un pistón? */
function movable(b) {
  if (b.id === BLOCK.AIR || !b.breakable || b.liquid) return false;
  if (b.shape === SHAPE.DOOR) return false; // dos bloques: no
  if (b.circuit === 'head' || (b.circuit === 'piston' && b.extended)) return false;
  return true;
}

/** ¿Lo que hay en una celda se rompe si algo se mete ahí (planta, cable, palanca...)? */
const fragile = (b) => b.shape === SHAPE.PLANT || Boolean(b.attach) || b.shape === SHAPE.CARPET;

export class Circuits {
  constructor() {
    this.world = null;
    this.enabled = true;
    this._time = 0;
    this._tick = 0;
    /** Celdas a revisar en el próximo paso: clave → [x, y, z]. */
    this._dirty = new Map();
    /** Cambios programados: clave → {tick, x, y, z, from, to}. */
    this._timers = new Map();
    /** Placas de presión conocidas: clave → [x, y, z]. */
    this._plates = new Map();
    /** Si una puerta, trampilla o tranquera tenía energía la última vez que se miró. */
    this._wasPowered = new Map();
    this._listener = (e) => this._onEdit(e);
  }

  /** Empieza a mirar un mundo (al cargarlo): revisa todo lo que es de un circuito. */
  attach(world) {
    this.world?.editListeners.delete(this._listener);
    this.world = world;
    this._dirty.clear();
    this._timers.clear();
    this._plates.clear();
    this._wasPowered.clear();
    world.editListeners.add(this._listener);
    // Los mecanismos solo existen como cambios del jugador: con eso alcanza.
    for (const [chunkKey, edits] of world.edits) {
      const [cx, cz] = chunkKey.split(',').map(Number);
      for (const [index, id] of edits) {
        const b = getBlock(id);
        if (!b.circuit && id !== BLOCK.SOLARITE_BLOCK) continue;
        const x = cx * 16 + (index & 15);
        const z = cz * 16 + ((index >> 4) & 15);
        const y = index >> 8;
        this._mark(x, y, z);
        if (b.circuit === 'plate') this._plates.set(key(x, y, z), [x, y, z]);
      }
    }
  }

  _onEdit({ x, y, z, id, prev }) {
    this._markAround(x, y, z);
    const b = getBlock(id);
    const k = key(x, y, z);
    if (b.circuit === 'plate') this._plates.set(k, [x, y, z]);
    else this._plates.delete(k);
    // Un botón apretado se suelta solo.
    if (b.circuit === 'button' && b.on && getBlock(prev ?? 0).id !== id) {
      this._timers.set(k, { tick: this._tick + BUTTON_TICKS, x, y, z, from: id, to: b.other });
    }
  }

  _mark(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    this._dirty.set(key(x, y, z), [x, y, z]);
  }

  _markAround(x, y, z) {
    this._mark(x, y, z);
    for (const [dx, dy, dz] of DIRS6) this._mark(x + dx, y + dy, z + dz);
  }

  /**
   * Un frame.
   * @param {number} dt segundos
   * @param {{x: number, y: number, z: number, halfWidth: number, height: number}[]} bodies
   *   quiénes pueden pisar las placas (jugadores y animales)
   */
  update(dt, bodies) {
    if (!this.world) return;
    if (!this.enabled) {
      // En pausa o como invitado: nada se acumula (al volver se revisa lo que cambie).
      this._dirty.clear();
      return;
    }
    this._time += Math.min(dt, TICK * MAX_TICKS_PER_FRAME);
    let ticks = 0;
    while (this._time >= TICK && ticks < MAX_TICKS_PER_FRAME) {
      this._time -= TICK;
      ticks++;
      this._step(bodies);
    }
  }

  _step(bodies) {
    this._tick++;
    const world = this.world;
    world.batch(() => {
      this._checkPlates(bodies);
      // Cambios programados que llegaron (si el bloque sigue como estaba).
      for (const [k, t] of this._timers) {
        if (t.tick > this._tick) continue;
        this._timers.delete(k);
        if (world.getBlock(t.x, t.y, t.z) === t.from) world.editBlock(t.x, t.y, t.z, t.to);
      }
      // Lo que cambió en el paso anterior (lo de este paso, en el próximo).
      const cells = [...this._dirty.values()];
      this._dirty.clear();
      const seenWires = new Set();
      for (const [x, y, z] of cells) {
        if (!world.isLoadedAt(x, z)) continue;
        this._evaluate(x, y, z, seenWires);
      }
    });
  }

  /** Prende o apaga las placas según quién está arriba. */
  _checkPlates(bodies) {
    const world = this.world;
    for (const [k, [x, y, z]] of this._plates) {
      const id = world.getBlock(x, y, z);
      const b = getBlock(id);
      if (b.circuit !== 'plate') {
        this._plates.delete(k);
        continue;
      }
      const pressed = bodies.some(
        (e) =>
          e.x + e.halfWidth > x &&
          e.x - e.halfWidth < x + 1 &&
          e.z + e.halfWidth > z &&
          e.z - e.halfWidth < z + 1 &&
          e.y < y + PLATE_HEIGHT &&
          e.y + e.height > y,
      );
      if (pressed !== b.on) world.editBlock(x, y, z, b.other);
    }
  }

  /** ¿A la celda le llega energía de alguno de sus 6 lados? */
  _powered(x, y, z) {
    const world = this.world;
    for (const [dx, dy, dz] of DIRS6) {
      if (emitsTo(getBlock(world.getBlock(x + dx, y + dy, z + dz)), -dx, -dy, -dz)) return true;
    }
    return false;
  }

  /** ¿Le llega energía a la entrada (atrás) de una compuerta que mira a `facing`? */
  _inputPowered(x, y, z, facing) {
    const [fx, , fz] = DIRS6[facing];
    return emitsTo(getBlock(this.world.getBlock(x - fx, y, z - fz)), fx, 0, fz);
  }

  _evaluate(x, y, z, seenWires) {
    const world = this.world;
    const id = world.getBlock(x, y, z);
    const b = getBlock(id);
    switch (b.circuit) {
      case 'wire':
        if (!seenWires.has(key(x, y, z))) this._evaluateWires(x, y, z, seenWires);
        return;
      case 'lamp':
      case 'timbre': {
        const want = this._powered(x, y, z);
        if (want !== b.on) world.editBlock(x, y, z, b.other);
        return;
      }
      case 'inverter':
      case 'repeater': {
        const input = this._inputPowered(x, y, z, b.facing);
        const want = b.circuit === 'inverter' ? !input : input;
        const k = key(x, y, z);
        if (want === b.on) {
          this._timers.delete(k);
          return;
        }
        if (this._timers.get(k)?.to === b.other) return; // ya programado
        const delay = b.circuit === 'inverter' ? INVERTER_TICKS : REPEATER_TICKS;
        this._timers.set(k, { tick: this._tick + delay, x, y, z, from: id, to: b.other });
        return;
      }
      case 'piston': {
        const want = this._powered(x, y, z);
        if (want && !b.extended) this._extend(x, y, z, b);
        else if (!want && b.extended) this._retract(x, y, z, b);
        else if (b.extended) {
          // Si le sacaron la cabeza, queda recogido.
          const [dx, dy, dz] = DIRS6[b.dir];
          if (world.getBlock(x + dx, y + dy, z + dz) !== b.head) world.editBlock(x, y, z, b.other);
        }
        return;
      }
      case 'head': {
        // Una cabeza sin su pistón estirado atrás se va.
        const [dx, dy, dz] = DIRS6[b.dir];
        if (world.getBlock(x - dx, y - dy, z - dz) !== b.base) world.editBlock(x, y, z, BLOCK.AIR);
        return;
      }
      default:
        if (b.shape === SHAPE.DOOR || b.shape === SHAPE.GATE || b.shape === SHAPE.TRAPDOOR) this._evaluateOpenable(x, y, z, b);
    }
  }

  /**
   * Un tramo de cables unidos: prendido si alguno toca una fuente. Se
   * recorre entero (hasta MAX_WIRES) y se ponen todos iguales.
   */
  _evaluateWires(x0, y0, z0, seenWires) {
    const world = this.world;
    const wires = [];
    const stack = [[x0, y0, z0]];
    seenWires.add(key(x0, y0, z0));
    let powered = false;
    while (stack.length && wires.length < MAX_WIRES) {
      const [x, y, z] = stack.pop();
      wires.push([x, y, z]);
      for (const [dx, dy, dz] of DIRS6) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        const n = getBlock(world.getBlock(nx, ny, nz));
        if (n.circuit === 'wire') {
          const k = key(nx, ny, nz);
          if (!seenWires.has(k)) {
            seenWires.add(k);
            stack.push([nx, ny, nz]);
          }
        } else if (!powered && emitsTo(n, -dx, -dy, -dz)) {
          powered = true;
        }
      }
    }
    for (const [x, y, z] of wires) {
      const b = getBlock(world.getBlock(x, y, z));
      if (b.on !== powered) world.editBlock(x, y, z, b.other);
    }
  }

  /**
   * Puertas, trampillas y tranqueras: se abren cuando llega la energía y se
   * cierran cuando se va (solo en esos cambios: si no, se usan a mano).
   */
  _evaluateOpenable(x, y, z, b) {
    const world = this.world;
    let powered = this._powered(x, y, z);
    let partner = null;
    if (b.shape === SHAPE.DOOR) {
      const py = b.upper ? y - 1 : y + 1;
      const other = getBlock(world.getBlock(x, py, z));
      if (other.doorIds === b.doorIds && other.upper !== b.upper) partner = { y: py, b: other };
      if (partner && !powered) powered = this._powered(x, py, z);
    }
    const k = key(x, partner && b.upper ? y - 1 : y, z);
    const before = this._wasPowered.get(k) ?? false;
    if (powered === before) return;
    if (powered) this._wasPowered.set(k, true);
    else this._wasPowered.delete(k);
    if (b.open === powered) return;
    if (b.shape === SHAPE.DOOR) {
      const idFor = (upper) => b.doorIds[`${b.facing}${powered ? 1 : 0}${upper ? 1 : 0}`];
      world.editBlock(x, y, z, idFor(b.upper));
      if (partner) world.editBlock(x, partner.y, z, idFor(!b.upper));
    } else {
      world.editBlock(x, y, z, b.toggle);
    }
  }

  /** Estira el pistón: empuja la fila de bloques de adelante (si puede) y pone la cabeza. */
  _extend(x, y, z, b) {
    const world = this.world;
    const [dx, dy, dz] = DIRS6[b.dir];
    const line = [];
    for (let i = 1; ; i++) {
      const cx = x + dx * i;
      const cy = y + dy * i;
      const cz = z + dz * i;
      if (cy < 1 || cy >= CHUNK_HEIGHT || !world.isLoadedAt(cx, cz)) return;
      const n = getBlock(world.getBlock(cx, cy, cz));
      if (n.id === BLOCK.AIR || n.liquid || fragile(n)) break; // ahí entra lo empujado
      if (!movable(n) || line.length >= MAX_PUSH) return; // trabado o demasiado
      line.push(n.id);
    }
    // De adelante para atrás, cada uno un lugar más allá.
    for (let i = line.length; i >= 1; i--) {
      world.editBlock(x + dx * (i + 1), y + dy * (i + 1), z + dz * (i + 1), line[i - 1]);
    }
    world.editBlock(x + dx, y + dy, z + dz, b.head);
    world.editBlock(x, y, z, b.other);
  }

  /** Recoge el pistón; el pegajoso trae el bloque que tenía pegado. */
  _retract(x, y, z, b) {
    const world = this.world;
    const [dx, dy, dz] = DIRS6[b.dir];
    const hx = x + dx;
    const hy = y + dy;
    const hz = z + dz;
    world.editBlock(x, y, z, b.other);
    if (world.getBlock(hx, hy, hz) !== b.head) return;
    let next = BLOCK.AIR;
    if (b.sticky) {
      const stuck = getBlock(world.getBlock(hx + dx, hy + dy, hz + dz));
      if (movable(stuck) && !fragile(stuck)) {
        next = stuck.id;
        world.editBlock(hx + dx, hy + dy, hz + dz, BLOCK.AIR);
      }
    }
    world.editBlock(hx, hy, hz, next);
  }
}
