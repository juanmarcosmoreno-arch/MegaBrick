// Cámara del jugador: primera persona o tercera persona (atrás / de frente).
//
// La tecla V cambia de vista. En tercera persona la cámara se acerca si
// detrás hay un bloque sólido, para no quedar "adentro" de una pared.

import * as THREE from 'three';
import { COLLISION_BOXES } from '../world/blocks.js';

export const VIEW = Object.freeze({
  FIRST: 0, // primera persona
  BACK: 1, // tercera persona, desde atrás
  FRONT: 2, // tercera persona, de frente
});

const VIEW_NAMES = ['Primera persona', 'Tercera persona', 'Vista de frente'];

/** Distancia de la cámara al personaje en tercera persona (bloques). */
const THIRD_PERSON_DISTANCE = 4;
/** Separación mínima con las paredes. */
const WALL_MARGIN = 0.25;
/**
 * Distancia mínima (en bloques) para que la cámara no quede dentro de la
 * cabeza o la gorra. Mirando muy arriba o muy abajo hace falta más lugar.
 */
const minAvatarDistance = (pitch) => 0.75 + 0.8 * Math.abs(pitch);
/** Puntos que se revisan alrededor de la cámara (centro y 6 direcciones). */
const PROBE_OFFSETS = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class ViewCamera {
  /**
   * @param {THREE.PerspectiveCamera} camera
   */
  constructor(camera) {
    this.camera = camera;
    this.camera.rotation.order = 'YXZ';
    this.mode = VIEW.FIRST;
    // true si en tercera persona no hay lugar para alejar la cámara: se usa
    // la vista de primera persona hasta que haya espacio.
    this.tooClose = false;
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._probe = new THREE.Vector3();
  }

  /** Pasa a la vista siguiente y devuelve su nombre. */
  cycle() {
    this.mode = (this.mode + 1) % VIEW_NAMES.length;
    return VIEW_NAMES[this.mode];
  }

  /** ¿Se ve el personaje? (en primera persona, o sin lugar, se oculta). */
  get showsAvatar() {
    return this.mode !== VIEW.FIRST && !this.tooClose;
  }

  /**
   * Ubica la cámara según la vista actual.
   * @param {import('./Player.js').Player} player
   * @param {import('../world/World.js').World} world
   */
  update(player, world) {
    player.getEyePosition(this._eye);
    const { yaw, pitch } = player;

    this.tooClose = false;
    if (this.mode === VIEW.FIRST) {
      this.camera.position.copy(this._eye);
      this.camera.rotation.set(pitch, yaw, 0);
      return;
    }

    // Dirección hacia donde mira el jugador.
    this._dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    // Atrás: la cámara se aleja en sentido contrario a la mirada; de frente,
    // se pone delante y mira hacia el personaje.
    const sign = this.mode === VIEW.BACK ? -1 : 1;
    const dist = this._clearDistance(world, sign);
    if (dist < minAvatarDistance(pitch)) {
      // Sin lugar (pared o árbol pegado): vista de primera persona.
      this.tooClose = true;
      this.camera.position.copy(this._eye);
      this.camera.rotation.set(pitch, yaw, 0);
      return;
    }
    this.camera.position.copy(this._eye).addScaledVector(this._dir, sign * dist);
    if (this.mode === VIEW.BACK) {
      this.camera.rotation.set(pitch, yaw, 0);
    } else {
      // De frente: la misma mirada pero dada vuelta (equivale a mirar a los ojos).
      this.camera.rotation.set(-pitch, yaw + Math.PI, 0);
    }
  }

  /**
   * Avanza desde los ojos hacia la posición deseada de la cámara y devuelve
   * la distancia libre. Se revisa un pequeño margen alrededor de cada punto
   * (no solo el punto) para que la cámara tampoco quede pegada a un bloque
   * que tiene al costado, arriba o abajo.
   */
  _clearDistance(world, sign) {
    const step = 0.1;
    const steps = Math.round(THIRD_PERSON_DISTANCE / step);
    for (let i = 1; i <= steps; i++) {
      const t = i * step;
      this._probe.copy(this._eye).addScaledVector(this._dir, sign * t);
      if (this._blockedNear(world, this._probe)) return t - step;
    }
    return THIRD_PERSON_DISTANCE;
  }

  /** ¿Hay un bloque sólido a menos de WALL_MARGIN del punto? */
  _blockedNear(world, p) {
    const m = WALL_MARGIN;
    for (const [dx, dy, dz] of PROBE_OFFSETS) {
      const x = p.x + dx * m;
      const y = p.y + dy * m;
      const z = p.z + dz * m;
      if (y < 0) return true;
      const bx = Math.floor(x);
      const by = Math.floor(y);
      const bz = Math.floor(z);
      // Con las cajas de choque: una puerta abierta o una losa no tapan la celda entera.
      const boxes = COLLISION_BOXES[world.getBlock(bx, by, bz)];
      if (!boxes) continue;
      const lx = x - bx;
      const ly = y - by;
      const lz = z - bz;
      if (boxes.some((b) => lx >= b[0] && lx <= b[3] && ly >= b[1] && ly <= b[4] && lz >= b[2] && lz <= b[5])) return true;
    }
    return false;
  }
}
