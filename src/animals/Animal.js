// Un animal del mundo: su cuerpo (una caja que choca, con gravedad, salto y
// nado), lo que hace (pasear, pastar, mirar al jugador, escaparse, seguir a
// quien lo acarició) y la acción que muestra su modelo.
//
// En el multijugador lo simula el anfitrión; en los invitados solo se mueve
// hacia lo último que llegó por la red (ver Animals.js).

import { BLOCK, getBlock } from '../world/blocks.js';
import { moveAxis } from '../world/collision.js';

const GRAVITY = 32;
const JUMP_SPEED = 8.9; // sube un bloque, como el jugador
const MAX_FALL_SPEED = 40;
/** Paso máximo por sub-paso (menos de un bloque: no atraviesa nada). */
const MAX_STEP = 0.4;
/** Qué tan rápido gira el cuerpo (radianes por segundo). */
const TURN_SPEED = 4.5;
/** Qué tan rápido alcanza la velocidad que quiere (mayor = más reactivo). */
const ACCEL = 8;
/** En el agua: flota con ~60% del cuerpo abajo y nada más despacio. */
const FLOAT_LINE = 0.6;
const SWIM_FACTOR = 0.6;
const CLIMB_OUT_SPEED = 5.5;
/** Segundos después de salir del agua en que todavía puede trepar a la orilla. */
const CLIMB_GRACE = 0.5;
/** Hasta dónde mira al jugador y desde dónde lo sigue con la cabeza. */
const LOOK_DISTANCE = 6;
const LOOK_LIMIT_YAW = 1.1;
const LOOK_LIMIT_PITCH = 0.6;
/** Siguiendo a alguien: se queda a esta distancia y lo deja de seguir lejos. */
const FOLLOW_NEAR = 2.2;
const FOLLOW_FAR = 20;
const FOLLOW_TIME = 25;

/** Acciones que entiende el modelo (y su número para la red). */
export const ACTIONS = Object.freeze(['idle', 'walk', 'eat', 'happy', 'scared', 'swim']);

const rand = (a, b) => a + Math.random() * (b - a);

export class Animal {
  /**
   * @param {number} id número único (también en la red)
   * @param {string} species id de la especie (ver species/index.js)
   * @param {object} kind comportamiento de la especie (velocidades, grupo...)
   * @param {number} variant
   */
  constructor(id, species, kind, variant, x, y, z) {
    this.id = id;
    this.species = species;
    this.kind = kind;
    this.variant = variant;
    this.position = { x, y, z, getComponent: getC, setComponent: setC };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = rand(-Math.PI, Math.PI);
    this.halfWidth = kind.size.width / 2;
    this.height = kind.size.height;
    this.onGround = false;
    this.inWater = false;
    /** Qué está haciendo: idle, wander, eat, happy, flee, follow. */
    this.mode = 'idle';
    this.modeTime = rand(0.5, 3);
    this.modeAge = 0;
    this.target = null; // a dónde va {x, z}
    this.from = null; // de quién escapa {x, z}
    this.followId = null; // a quién sigue
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.speed = 0; // velocidad horizontal (para la animación)
    this.action = 'idle';
    this._stuck = 0;
    this._collidedH = false;
    this._waterGrace = 0;
    /** El modelo (lo arma y lo dibuja Animals.js). */
    this.model = null;
    this.callTimer = rand(...kind.callEvery);
  }

  /** Lo que necesita el modelo para animarse (el mismo objeto cada vez). */
  get modelState() {
    const s = (this._state ??= { action: 'idle', speed: 0, lookYaw: 0, lookPitch: 0, t: 0 });
    s.action = this.action;
    s.speed = this.speed;
    s.lookYaw = this.lookYaw;
    s.lookPitch = this.lookPitch;
    return s;
  }

  /**
   * Un paso de la simulación.
   * @param {number} dt segundos
   * @param {object} world
   * @param {{id: string, x: number, y: number, z: number}[]} players
   */
  update(dt, world, players) {
    const p = this.position;
    // Si su chunk no está cargado, quieto (no cae al vacío).
    if (!world.isLoadedAt(p.x, p.z)) return;
    this.modeAge += dt;
    this.modeTime -= dt;
    this._think(world, players);
    const want = this._steer(dt, world, players);
    this._physics(dt, world, want);
    this._look(dt, players);
    this._pickAction();
  }

  /** Que lo acarició un jugador: contento y después lo sigue un rato. */
  pet(player) {
    this._setMode('happy', 1.4);
    this.followId = player.id;
    this.velocity.x = this.velocity.z = 0;
  }

  /** Que lo empujó un jugador: respingo, se da vuelta y sale corriendo para el otro lado. */
  poke(player) {
    const p = this.position;
    this.from = { x: player.x, z: player.z };
    this.followId = null;
    this._setMode('flee', rand(2, 3));
    // Mirando para el otro lado (adelante es -Z con yaw 0) y sin el envión que traía.
    this.yaw = Math.atan2(-(p.x - player.x), -(p.z - player.z));
    this.velocity.x = this.velocity.z = 0;
    if (this.onGround || this.inWater) this.velocity.y = 4.5;
  }

  _setMode(mode, time) {
    this.mode = mode;
    this.modeTime = time;
    this.modeAge = 0;
    this._stuck = 0;
  }

  /** Decide qué hacer cuando termina lo que estaba haciendo. */
  _think(world, players) {
    if (this.mode === 'follow') {
      const who = players.find((pl) => pl.id === this.followId);
      if (!who || this.modeTime <= 0 || dist(who, this.position) > FOLLOW_FAR) {
        this.followId = null;
        this._setMode('idle', rand(1, 3));
      }
      return;
    }
    if (this.modeTime > 0) return;
    if (this.mode === 'happy' && this.followId) {
      this._setMode('follow', FOLLOW_TIME);
      return;
    }
    const roll = Math.random();
    const p = this.position;
    const onGrass = world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.05), Math.floor(p.z)) === BLOCK.GRASS;
    if (roll < 0.55) {
      this.target = this._findSpot(world);
      if (this.target) {
        this._setMode('wander', 14);
        return;
      }
    } else if (roll < 0.85 && onGrass && !this.inWater) {
      this._setMode('eat', rand(2, 5));
      return;
    }
    this._setMode('idle', rand(...this.kind.idleTime));
  }

  /**
   * Un lugar a donde pasear: a unos pasos, en el piso, sin precipicios (y
   * en el agua solo si a la especie le gusta).
   */
  _findSpot(world) {
    const p = this.position;
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(3, 9);
      const x = p.x + Math.sin(a) * d;
      const z = p.z + Math.cos(a) * d;
      if (!world.isLoadedAt(x, z)) continue;
      const ground = groundBelow(world, x, p.y + 3, z, 7);
      if (!ground) continue;
      if (ground.water && !this.kind.likesWater) continue;
      if (Math.abs(ground.y - p.y) > 3) continue;
      return { x, z };
    }
    return null;
  }

  /** Hacia dónde quiere ir y a qué velocidad, según lo que hace. Devuelve la velocidad. */
  _steer(dt, world, players) {
    const p = this.position;
    let tx = null;
    let tz = null;
    let speed = 0;
    if (this.mode === 'wander' && this.target) {
      tx = this.target.x;
      tz = this.target.z;
      speed = this.kind.walk;
      if (Math.hypot(tx - p.x, tz - p.z) < 0.6) this._setMode('idle', rand(...this.kind.idleTime));
    } else if (this.mode === 'flee' && this.from && this.modeAge > 0.35) {
      tx = p.x + (p.x - this.from.x);
      tz = p.z + (p.z - this.from.z);
      speed = this.kind.run;
    } else if (this.mode === 'follow') {
      const who = players.find((pl) => pl.id === this.followId);
      if (who && Math.hypot(who.x - p.x, who.z - p.z) > FOLLOW_NEAR) {
        tx = who.x;
        tz = who.z;
        speed = this.kind.walk * 1.4;
      }
    }
    if (tx === null) return 0;
    // Girar hacia allá (adelante es -Z con yaw 0, como el jugador).
    const want = Math.atan2(-(tx - p.x), -(tz - p.z));
    let diff = want - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const step = TURN_SPEED * dt;
    this.yaw += Math.max(-step, Math.min(step, diff));
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)); // entre -π y π
    // Más despacio mientras gira mucho.
    speed *= Math.max(0.15, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
    // No tirarse de un precipicio (ni meterse al agua si no le gusta).
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const ahead = groundBelow(world, p.x + fx * 0.8, p.y + 1.5, p.z + fz * 0.8, 4.5);
    if (!this.inWater && (!ahead || (ahead.water && !this.kind.likesWater && this.mode !== 'flee'))) {
      // Escapando o siguiendo a alguien, se frena en el borde; paseando, cambia de idea.
      if (this.mode === 'wander') this._setMode('idle', rand(0.5, 1.5));
      return 0;
    }
    if (this.inWater) speed *= SWIM_FACTOR;
    return speed;
  }

  /** Gravedad, salto (para subir un bloque), nado y choques. */
  _physics(dt, world, speed) {
    const p = this.position;
    const v = this.velocity;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const k = 1 - Math.exp(-ACCEL * dt);
    v.x += (fx * speed - v.x) * k;
    v.z += (fz * speed - v.z) * k;

    const h = this.height;
    this.inWater = world.isWaterAt(p.x, p.y + h * 0.3, p.z);
    this._waterGrace = this.inWater ? CLIMB_GRACE : Math.max(0, this._waterGrace - dt);
    if (this.inWater || (this._waterGrace > 0 && this._collidedH && speed > 0)) {
      // Flota: sube si está muy hundido, baja despacio si sobresale.
      const deep = world.isWaterAt(p.x, p.y + h * FLOAT_LINE, p.z);
      v.y += (deep ? 14 : -8) * dt;
      v.y = Math.max(-2, Math.min(2.2, v.y));
      // Contra la orilla, trepa para salir (también apenas asoma del agua).
      if (this._collidedH && speed > 0) v.y = CLIMB_OUT_SPEED;
    } else {
      // Choca contra un escalón de un bloque: salta.
      if (this._collidedH && this.onGround && speed > 0) v.y = JUMP_SPEED;
      v.y = Math.max(v.y - GRAVITY * dt, -MAX_FALL_SPEED);
    }

    const dx = v.x * dt;
    const dy = v.y * dt;
    const dz = v.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_STEP));
    this.onGround = false;
    this._collidedH = false;
    const hw = this.halfWidth;
    for (let i = 0; i < steps; i++) {
      if (moveAxis(world, p, hw, h, 1, dy / steps)) {
        if (dy < 0) this.onGround = true;
        v.y = 0;
      }
      if (moveAxis(world, p, hw, h, 0, dx / steps)) this._collidedH = true;
      if (moveAxis(world, p, hw, h, 2, dz / steps)) this._collidedH = true;
    }
    if (dy === 0) {
      const y = p.y;
      this.onGround = moveAxis(world, p, hw, h, 1, -1e-3);
      p.y = y;
    }
    this.speed = Math.hypot(v.x, v.z);
    // Atascado contra algo: busca otro lugar.
    if (speed > 0 && this.speed < 0.15) {
      this._stuck += dt;
      if (this._stuck > 1.5 && this.mode === 'wander') this._setMode('idle', rand(0.5, 2));
    } else {
      this._stuck = 0;
    }
  }

  /** La cabeza sigue al jugador más cercano (con tope). */
  _look(dt, players) {
    const p = this.position;
    let wantYaw = 0;
    let wantPitch = 0;
    if (this.mode !== 'eat' && this.mode !== 'flee') {
      let best = null;
      let bestD = LOOK_DISTANCE;
      for (const pl of players) {
        const d = dist(pl, p);
        if (d < bestD) {
          bestD = d;
          best = pl;
        }
      }
      if (best) {
        const head = p.y + this.height * 0.8;
        let rel = Math.atan2(-(best.x - p.x), -(best.z - p.z)) - this.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        if (Math.abs(rel) < LOOK_LIMIT_YAW * 1.6) {
          wantYaw = Math.max(-LOOK_LIMIT_YAW, Math.min(LOOK_LIMIT_YAW, rel));
          wantPitch = Math.max(-LOOK_LIMIT_PITCH, Math.min(LOOK_LIMIT_PITCH, Math.atan2(best.y + 1.5 - head, Math.max(0.5, bestD))));
        }
      }
    }
    const k = 1 - Math.exp(-5 * dt);
    this.lookYaw += (wantYaw - this.lookYaw) * k;
    this.lookPitch += (wantPitch - this.lookPitch) * k;
  }

  /** La acción del modelo según lo que hace. */
  _pickAction() {
    if (this.inWater) this.action = 'swim';
    else if (this.mode === 'happy') this.action = 'happy';
    else if (this.mode === 'flee' && this.modeAge < 0.35) this.action = 'scared';
    else if (this.mode === 'eat') this.action = 'eat';
    else if (this.speed > 0.2) this.action = 'walk';
    else this.action = 'idle';
  }
}

function getC(axis) {
  return axis === 0 ? this.x : axis === 1 ? this.y : this.z;
}

function setC(axis, value) {
  if (axis === 0) this.x = value;
  else if (axis === 1) this.y = value;
  else this.z = value;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * El piso debajo de (x, z) bajando desde `fromY` hasta `depth` bloques:
 * {y (donde apoyan los pies), water} o null si no hay (precipicio).
 */
export function groundBelow(world, x, fromY, z, depth) {
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  const top = Math.floor(fromY);
  for (let y = top; y > top - depth; y--) {
    const b = getBlock(world.getBlock(bx, y, bz));
    if (b.liquid) return { y: y + 1, water: true };
    if (b.solid) {
      // Tiene que haber lugar arriba (dos bloques libres).
      const up1 = getBlock(world.getBlock(bx, y + 1, bz));
      const up2 = getBlock(world.getBlock(bx, y + 2, bz));
      if (up1.solid || up2.solid) return null;
      return { y: y + 1, water: false };
    }
  }
  return null;
}
