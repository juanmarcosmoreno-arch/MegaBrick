// Jugador: posición, orientación, movimiento y física.
//
// El cuerpo es una caja (AABB) de 0,6 de ancho y 1,8 de alto que choca
// contra los bloques sólidos. Hay gravedad y salto; un escalón de un bloque
// solo se sube saltando. Ctrl (o doble toque de W) corre, F activa el vuelo
// y en el agua se nada: uno se hunde despacio y sube con Espacio.
//
// Con joystick: la palanca izquierda mueve (inclinándola poco, más despacio),
// A es Espacio, B baja volando y apretar la palanca izquierda corre.

import * as THREE from 'three';
import { PAD } from './Gamepad.js';

const HALF_PI = Math.PI / 2 - 0.001;

// Velocidades (bloques por segundo) y aceleraciones (bloques por segundo²).
const WALK_SPEED = 4.3;
const SPRINT_SPEED = 5.6;
const SWIM_SPEED = 2.2;
const SWIM_SPRINT_SPEED = 3.0;
const FLY_SPEED = 10.9;
const FLY_SPRINT_SPEED = 21.6;
const GRAVITY = 32;
const JUMP_SPEED = 8.9; // salto de ~1,25 bloques: sube uno, no dos
const MAX_FALL_SPEED = 60;
const WATER_GRAVITY = 5;
const WATER_MAX_SINK = 2.5;
const SWIM_UP_ACCEL = 22;
const SWIM_UP_SPEED = 3.2;
const WATER_CLIMB_SPEED = 5.5; // trepar para salir del agua contra una orilla
const WATER_CLIMB_GRACE = 0.4; // segundos después de salir del agua en que se puede seguir trepando
const SWIM_FLOAT = 1.0; // altura (desde los pies) del pecho: si está bajo el agua, se nada

// Qué tan rápido se alcanza la velocidad deseada (mayor = más reactivo).
const ACCEL_GROUND = 14;
const ACCEL_AIR = 5;
const ACCEL_WATER = 6;
const ACCEL_FLY = 10;

/** Ventana (segundos) para el doble toque de W que activa la carrera. */
const DOUBLE_TAP = 0.3;
/** Paso máximo de movimiento por sub-paso: evita atravesar bloques. */
const MAX_STEP = 0.4;
const EPS = 1e-6;

export class Player {
  constructor() {
    this.position = new THREE.Vector3(); // posición de los pies (centro de la base)
    this.velocity = new THREE.Vector3();
    this.yaw = 0; // giro horizontal (radianes)
    this.pitch = 0; // giro vertical (radianes)

    // Medidas del jugador (en bloques).
    this.height = 1.8;
    this.width = 0.6;
    this.eyeHeight = 1.62;

    this.flying = false;
    this.sprinting = false;
    this.onGround = false;
    this.inWater = false; // el cuerpo está en el agua (nada)
    this.headInWater = false; // los ojos están bajo el agua

    this._collidedH = false; // chocó de costado en el último movimiento
    this._waterGrace = 0;
    this._climbTop = 0; // altura máxima (pies) hasta la que se puede trepar desde el agua
    this._lastForwardTap = -1;
    this._doubleTapSprint = false;
    this._padSprint = false;
    this._time = 0;
    this._wish = new THREE.Vector3();
  }

  /** Coloca al jugador en una posición (pies) mirando hacia yaw/pitch. */
  spawn(x, y, z, yaw = 0, pitch = 0) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.onGround = false;
  }

  /** Activa o desactiva el vuelo. */
  setFlying(on) {
    this.flying = on;
    this.velocity.y = 0;
  }

  /**
   * Actualiza el jugador.
   * @param {number} dt segundos desde el último frame
   * @param {import('./Controls.js').Controls} controls
   * @param {import('../world/World.js').World} world
   */
  update(dt, controls, world) {
    this._time += dt;

    // --- Mirar con el mouse o la palanca derecha ---
    const look = controls.consumeLook(dt);
    this.yaw -= look.yaw;
    this.pitch -= look.pitch;
    this.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, this.pitch));

    // Si el chunk donde está todavía no se cargó, quieto (no caer al vacío).
    if (!world.isLoadedAt(this.position.x, this.position.z)) {
      this.velocity.set(0, 0, 0);
      return;
    }
    this._unstuck(world);

    // --- Entrada (teclado y joystick) ---
    const pad = controls.pad;
    const keyForward = (controls.isDown('KeyW') ? 1 : 0) - (controls.isDown('KeyS') ? 1 : 0);
    const keyStrafe = (controls.isDown('KeyD') ? 1 : 0) - (controls.isDown('KeyA') ? 1 : 0);
    const forward = Math.max(-1, Math.min(1, keyForward + pad.move.y));
    const strafe = Math.max(-1, Math.min(1, keyStrafe + pad.move.x));
    const jump = controls.isDown('Space') || pad.isDown(PAD.A);
    const down = controls.isDown('ShiftLeft') || controls.isDown('ShiftRight') || pad.isDown(PAD.B);
    const ctrl = controls.isDown('ControlLeft') || controls.isDown('ControlRight');

    // Carrera: Ctrl, doble toque de W o apretar la palanca izquierda (queda
    // corriendo hasta dejar de avanzar), solo mientras se avanza.
    if (controls.wasPressed('KeyW')) {
      this._doubleTapSprint = this._time - this._lastForwardTap < DOUBLE_TAP;
      this._lastForwardTap = this._time;
    }
    if (pad.wasPressed(PAD.L3)) this._padSprint = true;
    if (forward <= 0) this._doubleTapSprint = this._padSprint = false;
    this.sprinting = forward > 0 && (ctrl || this._doubleTapSprint || this._padSprint);

    // --- Agua ---
    const { x, y, z } = this.position;
    const waistIn = world.isWaterAt(x, y + 0.9, z);
    this.inWater = waistIn || world.isWaterAt(x, y + 0.1, z);
    this.headInWater = world.isWaterAt(x, y + this.eyeHeight, z);
    if (this.inWater) {
      this._waterGrace = WATER_CLIMB_GRACE;
      // Se puede trepar hasta 1 bloque por encima del agua (una orilla
      // normal), no paredes más altas.
      this._climbTop = Math.floor(waistIn ? y + 0.9 : y + 0.1) + 2;
    } else {
      this._waterGrace = Math.max(0, this._waterGrace - dt);
    }

    // --- Velocidad horizontal deseada (relativa a hacia dónde mira) ---
    let speed;
    if (this.flying) speed = this.sprinting ? FLY_SPRINT_SPEED : FLY_SPEED;
    else if (this.inWater) speed = this.sprinting ? SWIM_SPRINT_SPEED : SWIM_SPEED;
    else speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // Adelante = -Z rotado por yaw; derecha = +X rotado por yaw.
    this._wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe);
    if (this._wish.lengthSq() > 1) this._wish.normalize();
    this._wish.multiplyScalar(speed);

    let accel = ACCEL_AIR;
    if (this.flying) accel = ACCEL_FLY;
    else if (this.inWater) accel = ACCEL_WATER;
    else if (this.onGround) accel = ACCEL_GROUND;
    const k = 1 - Math.exp(-accel * dt); // independiente de los FPS
    this.velocity.x += (this._wish.x - this.velocity.x) * k;
    this.velocity.z += (this._wish.z - this.velocity.z) * k;

    // --- Velocidad vertical ---
    // `vyMove` es la velocidad con la que se mueve en este frame. Con gravedad
    // se usa el promedio entre la de antes y la de después (integración por
    // trapecio): así la altura del salto no depende de los FPS.
    const v = this.velocity;
    let vyMove;
    if (this.flying) {
      const target = ((jump ? 1 : 0) - (down ? 1 : 0)) * speed;
      v.y += (target - v.y) * (1 - Math.exp(-ACCEL_FLY * dt));
      vyMove = v.y;
    } else if (this.inWater && world.isWaterAt(x, y + SWIM_FLOAT, z)) {
      // Nadando (pecho bajo el agua): se hunde despacio; con Espacio sube.
      v.y -= WATER_GRAVITY * dt;
      if (jump) v.y = Math.min(v.y + SWIM_UP_ACCEL * dt, SWIM_UP_SPEED);
      v.y = Math.max(v.y, -WATER_MAX_SINK);
      vyMove = v.y;
    } else {
      // En tierra (o con el agua por debajo del pecho): gravedad y salto.
      // Mantener Espacio salta cada vez que se toca el piso.
      if (jump && this.onGround) v.y = JUMP_SPEED;
      const vy0 = v.y;
      v.y = Math.max(v.y - GRAVITY * dt, this.inWater ? -WATER_MAX_SINK : -MAX_FALL_SPEED);
      vyMove = (vy0 + v.y) / 2;
    }
    // Saliendo del agua contra una orilla: se trepa (si no, sería imposible
    // salir, porque la superficie del agua queda más baja que la orilla).
    const climbing =
      !this.flying &&
      jump &&
      this._collidedH &&
      this._waterGrace > 0 &&
      this.position.y < this._climbTop;
    if (climbing && v.y < WATER_CLIMB_SPEED) {
      v.y = WATER_CLIMB_SPEED;
      vyMove = WATER_CLIMB_SPEED;
    }

    this._move(world, v.x * dt, vyMove * dt, v.z * dt);

    // Correr contra una pared no cuenta como correr (vuelve el FOV normal).
    if (this._collidedH && this.horizontalSpeed < 1) this.sprinting = false;
  }

  /**
   * Mueve la caja del jugador resolviendo colisiones eje por eje (primero Y,
   * después X y Z), en sub-pasos cortos para no atravesar bloques aunque
   * vaya muy rápido.
   */
  _move(world, dx, dy, dz) {
    this.onGround = false;
    this._collidedH = false;
    const startDy = dy;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_STEP));
    for (let i = 0; i < steps; i++) {
      if (dy !== 0 && this._moveAxis(world, 1, dy / steps)) {
        if (dy < 0) this.onGround = true;
        this.velocity.y = 0;
        dy = 0;
      }
      if (dx !== 0 && this._moveAxis(world, 0, dx / steps)) {
        this._collidedH = true;
        this.velocity.x = 0;
        dx = 0;
      }
      if (dz !== 0 && this._moveAxis(world, 2, dz / steps)) {
        this._collidedH = true;
        this.velocity.z = 0;
        dz = 0;
      }
    }
    // Sin movimiento vertical (volando y apoyado) no hubo choque abajo:
    // se revisa a mano si hay piso justo debajo.
    if (startDy === 0) {
      const y = this.position.y;
      this.onGround = this._moveAxis(world, 1, -1e-3);
      this.position.y = y;
    }
  }

  /**
   * Mueve sobre un eje (0 = X, 1 = Y, 2 = Z). Si la caja queda dentro de un
   * bloque sólido, la pega a la cara de ese bloque y devuelve true.
   */
  _moveAxis(world, axis, d) {
    const p = this.position;
    p.setComponent(axis, p.getComponent(axis) + d);

    const half = this.width / 2;
    const minX = Math.floor(p.x - half + EPS);
    const maxX = Math.floor(p.x + half - EPS);
    const minY = Math.floor(p.y + EPS);
    const maxY = Math.floor(p.y + this.height - EPS);
    const minZ = Math.floor(p.z - half + EPS);
    const maxZ = Math.floor(p.z + half - EPS);

    // Como cada sub-paso avanza menos de un bloque, los bloques que ahora
    // se pisan están todos en la capa del frente del movimiento.
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (!world.isSolid(bx, by, bz)) continue;
          if (axis === 0) p.x = d > 0 ? bx - half : bx + 1 + half;
          else if (axis === 1) p.y = d > 0 ? by - this.height : by + 1;
          else p.z = d > 0 ? bz - half : bz + 1 + half;
          return true;
        }
      }
    }
    return false;
  }

  /** ¿La caja del jugador se superpone con algún bloque sólido? */
  _overlapsSolid(world) {
    const p = this.position;
    const half = this.width / 2;
    for (let by = Math.floor(p.y + EPS); by <= Math.floor(p.y + this.height - EPS); by++) {
      for (let bz = Math.floor(p.z - half + EPS); bz <= Math.floor(p.z + half - EPS); bz++) {
        for (let bx = Math.floor(p.x - half + EPS); bx <= Math.floor(p.x + half - EPS); bx++) {
          if (world.isSolid(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  /**
   * Seguridad: si el jugador quedó dentro de bloques (por ejemplo, al
   * aparecer), se lo sube hasta el primer lugar libre.
   */
  _unstuck(world) {
    for (let i = 0; i < 8 && this._overlapsSolid(world); i++) {
      this.position.y = Math.floor(this.position.y) + 1;
      this.velocity.y = 0;
    }
  }

  /** Velocidad horizontal actual (bloques/s), para animar al personaje. */
  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Copia en `out` la posición de los ojos (de donde sale la cámara). */
  getEyePosition(out) {
    return out.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }
}

