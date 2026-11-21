// Personaje del jugador (etapa 14): uno de los personajes de characters/
// (normal, soldado, vikingo...), con el color de ropa elegido, adaptado a
// lo que necesita el juego.
//
// Los personajes se arman mirando hacia +Z; el juego mira hacia -Z con
// yaw = 0, así que se los gira media vuelta dentro de la raíz. La raíz va
// en los pies del jugador y gira con el cuerpo, que sigue a la mirada con
// suavidad (la cabeza mira arriba y abajo).

import * as THREE from 'three';
import { createHumanoid } from './characters/humanoid.js';
import { DEFAULT_CHARACTER, getCharacter, isCharacter } from './characters/index.js';
import { DEFAULT_VARIANT, EXPRESSIONS, VARIANTS, isVariant } from './colors.js';

/** Tamaño del bloque en la mano (en bloques). */
const HELD_BLOCK_SIZE = 0.25;
/** Cuánto puede quedar el cuerpo girado respecto de la mirada (radianes). */
const MAX_BODY_TWIST = 0.5;

/** Diferencia de ángulos en (-PI, PI]. */
function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export class Avatar {
  /**
   * @param {string} [variant] color de la ropa: clave de VARIANTS (violeta, verde, azul, ...)
   * @param {string} [character] personaje: id de characters/index.js
   */
  constructor(variant = DEFAULT_VARIANT, character = DEFAULT_CHARACTER) {
    this.variant = isVariant(variant) ? variant : DEFAULT_VARIANT;
    this.character = isCharacter(character) ? character : DEFAULT_CHARACTER;
    // Raíz en los pies.
    this.root = new THREE.Group();
    this.root.name = 'personaje';
    this.bodyYaw = 0;
    this.time = 0;
    this.baseExpression = 'normal';
    this.heldBlock = null; // malla del bloque en la mano
    this.model = null;
    this._build();
  }

  /** Arma el modelo del personaje actual (y le pasa el bloque de la mano). */
  _build() {
    this.model?.dispose();
    this.model = createHumanoid(THREE, getCharacter(this.character), { color: VARIANTS[this.variant].color });
    this.model.root.rotation.y = Math.PI; // de +Z (el modelo) a -Z (el juego)
    this.root.add(this.model.root);
    if (this.heldBlock) this.model.hand.add(this.heldBlock);
    this.model.setExpression(this.baseExpression);
  }

  /**
   * Pone un bloque en la mano derecha (o lo saca con geometry = null).
   * @param {THREE.BufferGeometry | null} geometry geometría del bloque (1x1x1)
   * @param {THREE.Material[]} [materials] materiales de bloques por capa
   */
  setHeldBlock(geometry, materials) {
    if (!geometry) {
      if (this.heldBlock) this.heldBlock.visible = false;
      return;
    }
    if (!this.heldBlock) {
      this.heldBlock = new THREE.Mesh(geometry, materials);
      this.heldBlock.scale.setScalar(HELD_BLOCK_SIZE);
      this.heldBlock.rotation.y = Math.PI / 4;
      this.model.hand.add(this.heldBlock);
    }
    this.heldBlock.geometry = geometry;
    this.heldBlock.visible = true;
  }

  /** Golpe con el brazo al romper o poner un bloque. */
  swing() {
    this.model.swing();
  }

  /** Cambia el color de la ropa. */
  setVariant(variant) {
    if (!isVariant(variant) || variant === this.variant) return;
    this.variant = variant;
    this.model.setColor(VARIANTS[variant].color);
  }

  /** Cambia de personaje (se arma de nuevo). */
  setCharacter(character) {
    if (!isCharacter(character) || character === this.character) return;
    this.character = character;
    this._build();
  }

  /** Cambia la expresión (normal, feliz, sorprendido, determinado). */
  setExpression(name) {
    if (!EXPRESSIONS.includes(name) || name === this.baseExpression) return;
    this.baseExpression = name;
    this.model.setExpression(name);
  }

  /**
   * Avanza la animación.
   * @param {number} dt segundos (0 en pausa: queda quieto)
   * @param {object} s estado del jugador
   * @param {number} s.yaw hacia dónde mira (radianes)
   * @param {number} [s.pitch] inclinación de la mirada (la cabeza la sigue)
   * @param {number} s.speed velocidad horizontal (bloques/s)
   * @param {boolean} [s.flying] si está volando (en el aire)
   */
  update(dt, { yaw, pitch = 0, speed, flying = false }) {
    this.time += dt;
    // El cuerpo sigue a la mirada enseguida al moverse y con calma estando
    // quieto, sin quedar nunca muy torcido.
    const follow = speed > 0.3 ? 12 : 5;
    this.bodyYaw += angleDiff(yaw, this.bodyYaw) * (1 - Math.exp(-follow * dt));
    const twist = angleDiff(yaw, this.bodyYaw);
    if (Math.abs(twist) > MAX_BODY_TWIST) this.bodyYaw = yaw - Math.sign(twist) * MAX_BODY_TWIST;
    this.root.rotation.y = this.bodyYaw;
    this.model.update(dt, { speed, flying, t: this.time, pitch });
  }

  /** Libera geometrías, materiales y texturas (el bloque en la mano es compartido). */
  dispose() {
    if (this.heldBlock) this.heldBlock.removeFromParent();
    this.model.dispose();
  }
}
