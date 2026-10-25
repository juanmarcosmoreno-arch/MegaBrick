// Romper y poner bloques: bloque apuntado (raycast DDA desde los ojos),
// contorno, clic izquierdo para romper y clic derecho para poner (con
// joystick, gatillo derecho y gatillo izquierdo).

import * as THREE from 'three';
import { BLOCK, getBlock } from '../world/blocks.js';
import { CHUNK_HEIGHT } from '../world/Chunk.js';
import { PAD } from './Gamepad.js';
import { raycast } from './Raycast.js';

/** Alcance en bloques. */
export const REACH = 6;
/** Tiempo entre acciones al mantener apretado el botón (segundos). */
const REPEAT = 0.25;

/** Se puede apuntar a todo lo que no sea aire ni líquido (el agua se atraviesa). */
const isTarget = (id) => id !== BLOCK.AIR && !getBlock(id).liquid;

/** Vecinos desde los que el agua llena un hueco: arriba y los 4 costados. */
const WATER_SOURCES = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
/** Mismo margen que usa la física del jugador (Player.js). */
const EPS = 1e-6;

export class BlockInteraction {
  /**
   * @param {object} o
   * @param {import('../world/World.js').World} o.world
   * @param {import('./Player.js').Player} o.player
   * @param {import('../ui/Hotbar.js').Hotbar} o.hotbar
   * @param {import('../render/BlockOutline.js').BlockOutline} o.outline
   * @param {(action: 'break' | 'place', id: number) => void} [o.onAction]
   */
  constructor({ world, player, hotbar, outline, onAction }) {
    this.world = world;
    this.player = player;
    this.hotbar = hotbar;
    this.outline = outline;
    this.onAction = onAction;
    this.target = null; // bloque apuntado (o null)
    this._breakTimer = 0;
    this._placeTimer = 0;
    this._breaking = false;
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  /** ¿Se está rompiendo (botón izquierdo apretado)? */
  get breaking() {
    return this._breaking;
  }

  /**
   * @param {number} dt segundos
   * @param {import('./Controls.js').Controls} controls
   */
  update(dt, controls) {
    const p = this.player;
    p.getEyePosition(this._eye);
    this._dir.set(
      -Math.sin(p.yaw) * Math.cos(p.pitch),
      Math.sin(p.pitch),
      -Math.cos(p.yaw) * Math.cos(p.pitch),
    );
    this.target = raycast(this.world, this._eye, this._dir, REACH, isTarget);

    // Al apretar actúa enseguida; si se mantiene, repite cada REPEAT segundos.
    this._breakTimer -= dt;
    this._placeTimer -= dt;
    const pad = controls.pad;
    this._breaking = controls.isMouseDown(0) || pad.isDown(PAD.RT);
    const placing = controls.isMouseDown(2) || pad.isDown(PAD.LT);
    let changed = false;
    if (controls.wasClicked(0) || pad.wasPressed(PAD.RT) || (this._breaking && this._breakTimer <= 0)) {
      this._breakTimer = REPEAT;
      changed = this.breakTarget() || changed;
    }
    if (controls.wasClicked(2) || pad.wasPressed(PAD.LT) || (placing && this._placeTimer <= 0)) {
      this._placeTimer = REPEAT;
      changed = this.placeAtTarget() || changed;
    }
    // Si el mundo cambió, el contorno va sobre el bloque que quedó apuntado.
    if (changed) this.target = raycast(this.world, this._eye, this._dir, REACH, isTarget);
    this.outline.show(this.target);
  }

  /** Deja de "romper" (por ejemplo, al pausar con el botón apretado). */
  release() {
    this._breaking = false;
  }

  /**
   * Rompe el bloque apuntado (salvo los indestructibles). Si tiene agua
   * arriba o a un costado, el hueco se llena de agua: no hay agua que fluya,
   * pero así no quedan burbujas de aire ni paredes de agua en el aire.
   */
  breakTarget() {
    const t = this.target;
    if (!t || !getBlock(t.id).breakable) return false;
    const w = this.world;
    const wet = WATER_SOURCES.some(([dx, dy, dz]) => getBlock(w.getBlock(t.x + dx, t.y + dy, t.z + dz)).liquid);
    if (!w.editBlock(t.x, t.y, t.z, wet ? BLOCK.WATER : BLOCK.AIR)) return false;
    this.onAction?.('break', t.id);
    return true;
  }

  /** Pone el bloque elegido en la hotbar contra la cara apuntada. */
  placeAtTarget() {
    const t = this.target;
    if (!t) return false;
    const [x, y, z] = t.place;
    // Origen dentro de un bloque (sin cara) o fuera del alto del mundo: nada.
    if (t.normal.every((n) => n === 0) || y < 1 || y >= CHUNK_HEIGHT) return false;
    // Solo en aire o agua (el agua se reemplaza).
    const current = getBlock(this.world.getBlock(x, y, z));
    if (current.id !== BLOCK.AIR && !current.liquid) return false;
    const id = this.hotbar.selectedBlock;
    if (getBlock(id).solid && this._intersectsPlayer(x, y, z)) return false;
    if (!this.world.editBlock(x, y, z, id)) return false;
    this.onAction?.('place', id);
    return true;
  }

  /**
   * ¿El bloque (x, y, z) se superpondría con la caja del jugador? Usa la
   * misma cuenta que la física, así nunca se pone un bloque que la física
   * considere "adentro" del jugador.
   */
  _intersectsPlayer(x, y, z) {
    const p = this.player.position;
    const half = this.player.width / 2;
    return (
      x >= Math.floor(p.x - half + EPS) &&
      x <= Math.floor(p.x + half - EPS) &&
      y >= Math.floor(p.y + EPS) &&
      y <= Math.floor(p.y + this.player.height - EPS) &&
      z >= Math.floor(p.z - half + EPS) &&
      z <= Math.floor(p.z + half - EPS)
    );
  }
}
