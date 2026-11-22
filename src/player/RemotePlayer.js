// Otro jugador de la partida: su personaje (con su color de ropa), su nombre arriba
// de la cabeza y un movimiento suave aunque los datos lleguen de a saltos.
//
// Los estados llegan unas 15 veces por segundo; se dibuja al jugador con un
// pequeño retraso (INTERP_DELAY) interpolando entre los dos estados que
// rodean ese momento. Cada estado trae la hora de quien lo mandó: así se
// interpola con los tiempos reales aunque la red los entregue a destiempo.

import * as THREE from 'three';
import { Avatar } from './Avatar.js';

const INTERP_DELAY = 0.15; // segundos
const MAX_BUFFER = 20;
/** Muestras para estimar la diferencia de reloj con quien manda. */
const OFFSET_SAMPLES = 30;
/** Sin estados nuevos por este tiempo (s), el jugador se dibuja quieto. */
const STALE_AFTER = 0.35;

/** Diferencia de ángulos normalizada a [-PI, PI]. */
function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Cartel con el nombre (un sprite que siempre mira a la cámara). */
export function nameTag(name) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = '600 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.font = font;
  const width = Math.ceil(ctx.measureText(name).width) + 36;
  canvas.width = width;
  canvas.height = 60;
  ctx.font = font;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 60, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, width / 2, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Se ve a través de las paredes, para encontrar a los amigos.
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true }),
  );
  const height = 0.32;
  sprite.scale.set((height * width) / 60, height, 1);
  sprite.renderOrder = 900;
  return sprite;
}

export class RemotePlayer {
  /**
   * @param {object} info
   * @param {string} info.id id en la red
   * @param {string} info.name nombre (ya validado)
   * @param {string} info.color color de la ropa
   * @param {string} [info.character] personaje (normal, soldado...)
   * @param {THREE.Scene} scene
   * @param {THREE.Material[]} blockMaterials para el bloque en la mano
   */
  constructor({ id, name, color, character }, scene, blockMaterials) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.character = character;
    this.scene = scene;
    this.blockMaterials = blockMaterials;
    this.avatar = new Avatar(color, character);
    this.avatar.root.visible = false; // hasta recibir la primera posición
    this.tag = nameTag(name);
    this.tag.position.y = 2.25; // sobre la cabeza (y el casco o el sombrero que lleve puesto)
    this.avatar.root.add(this.tag);
    scene.add(this.avatar.root);

    this.buffer = []; // [{t, state}], t en el reloj de quien manda
    this.lastState = null; // el último estado recibido
    this.held = null;
    this.swing = null;
    this._offsets = []; // hora local de llegada - hora de envío
    this._offset = 0;
    this._lastArrival = -Infinity;
    this._pos = new THREE.Vector3();
  }

  /**
   * Guarda un estado recibido.
   * @param {object} state estado ya validado (protocol.cleanState)
   * @param {number} now tiempo local en segundos
   * @returns {boolean} si cambió el color (para actualizar la lista)
   */
  push(state, now) {
    this.lastState = state;
    this._lastArrival = now;
    // La diferencia de reloj más chica de las últimas muestras es la del
    // mensaje que menos tardó: con esa se pasa la hora de envío a la local.
    const t = state.ts ?? now;
    this._offsets.push(now - t);
    if (this._offsets.length > OFFSET_SAMPLES) this._offsets.shift();
    this._offset = Math.min(...this._offsets);
    // Solo estados en orden (uno viejo o repetido no sirve para interpolar).
    const last = this.buffer[this.buffer.length - 1];
    if (!last || t > last.t) {
      this.buffer.push({ t, state });
      if (this.buffer.length > MAX_BUFFER) this.buffer.shift();
    }
    // Bloque en la mano y acciones (romper o poner).
    if (state.held !== this.held) {
      this.held = state.held;
      // 0: la mano vacía (modo aventura).
      this.avatar.setHeldItem(state.held || null, this.blockMaterials);
    }
    if (this.swing !== null && state.swing !== this.swing) this.avatar.swing();
    this.swing = state.swing;
    if (state.character && state.character !== this.character) {
      this.character = state.character;
      this.avatar.setCharacter(state.character);
    }
    if (state.color && state.color !== this.color) {
      this.color = state.color;
      this.avatar.setVariant(state.color);
      return true;
    }
    return false;
  }

  /** Posición actual (interpolada) de los pies. */
  get position() {
    return this._pos;
  }

  /**
   * @param {number} dt segundos
   * @param {number} now tiempo local en segundos
   */
  update(dt, now) {
    const b = this.buffer;
    if (!b.length) return;
    this.avatar.root.visible = true;
    // Momento a dibujar, en el reloj de quien manda.
    const t = now - this._offset - INTERP_DELAY;
    // Buscar los dos estados que rodean el momento t.
    let a = b[0];
    let c = b[0];
    for (let i = 0; i < b.length; i++) {
      if (b[i].t <= t) a = b[i];
      if (b[i].t >= t) {
        c = b[i];
        break;
      }
      c = b[i];
    }
    const span = c.t - a.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 1;
    const s0 = a.state;
    const s1 = c.state;
    this._pos.set(s0.x + (s1.x - s0.x) * k, s0.y + (s1.y - s0.y) * k, s0.z + (s1.z - s0.z) * k);
    const yaw = s0.yaw + angleDiff(s1.yaw, s0.yaw) * k;
    const pitch = s0.pitch + (s1.pitch - s0.pitch) * k;

    // Descartar estados viejos (dejando uno anterior a t para interpolar).
    while (b.length > 2 && b[1].t <= t) b.shift();

    this.avatar.root.position.copy(this._pos);
    this.avatar.setExpression(s1.expr);
    // Si dejaron de llegar estados (se le cortó la red, pestaña en segundo
    // plano), que no quede caminando en el lugar.
    const stale = now - this._lastArrival > STALE_AFTER;
    this.avatar.update(dt, { yaw, pitch, speed: stale ? 0 : s1.speed, flying: s1.flying });
  }

  dispose() {
    this.scene.remove(this.avatar.root);
    this.avatar.dispose();
    this.tag.material.map.dispose();
    this.tag.material.dispose();
  }
}
