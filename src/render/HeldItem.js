// Bloque en la mano en primera persona: un cubito abajo a la derecha de la
// pantalla que se mueve al caminar y se balancea al romper o poner.

import * as THREE from 'three';
import { getBlockGeometry } from './blockGeometry.js';
import { aoOnlyShader, itemLightShader } from './materials.js';
import { getItemTexture, itemMaterial, itemPlane, lightColor } from './itemMesh.js';
import { isBlockItem } from '../items/items.js';

const REST = new THREE.Vector3(0.56, -0.5, -0.95); // posición respecto de la cámara
const SWING_TIME = 0.25;
/** Sin bloque en la mano. */
const EMPTY = new THREE.BufferGeometry();

export class HeldItem {
  /**
   * @param {THREE.Camera} camera la cámara (tiene que estar en la escena)
   * @param {THREE.Material[]} blockMaterials materiales de bloques por capa
   */
  constructor(camera, blockMaterials) {
    // Copias de los materiales que se dibujan siempre por encima del mundo
    // (sin prueba de profundidad ni niebla) y después del agua, con la luz
    // del lugar donde está el jugador (en una cueva oscura, oscuro).
    /** Luz del lugar (cielo y bloques, de 0 a 1): ver setLight. */
    this.light = new THREE.Vector2(1, 0);
    const itemLight = itemLightShader({ value: this.light });
    this.materials = blockMaterials.map((m) => {
      const c = m.clone();
      c.depthTest = false;
      c.depthWrite = false;
      c.fog = false;
      c.transparent = true;
      c.onBeforeCompile = c.isMeshBasicMaterial ? aoOnlyShader : itemLight;
      return c;
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.materials);
    this.mesh.renderOrder = 1000;
    this.mesh.scale.setScalar(0.38);
    this.mesh.position.copy(REST);
    this.mesh.frustumCulled = false;
    camera.add(this.mesh);
    // Objetos que no son bloques (herramientas, minerales): un dibujo plano,
    // inclinado como si se lo agarrara del mango.
    const flatMaterial = itemMaterial();
    flatMaterial.depthTest = false;
    flatMaterial.depthWrite = false;
    flatMaterial.transparent = true;
    this.flat = new THREE.Mesh(itemPlane(), flatMaterial);
    this.flat.renderOrder = 1000;
    this.flat.scale.setScalar(1.4);
    this.flat.rotation.set(0, Math.PI / 2 - 0.35, 0);
    this.flat.position.set(0, 0.55, 0);
    this.flat.visible = false;
    this.mesh.add(this.flat);
    this.camera = camera;
    this._swing = 0;
    this._queued = false;
    this._bob = 0;
  }

  /** Lo que se tiene en la mano: un bloque, un objeto o nada (null). */
  setItem(id) {
    const block = isBlockItem(id);
    this.mesh.geometry = block ? getBlockGeometry(id) : EMPTY;
    const tex = !block && id !== null ? getItemTexture(id) : null;
    this.flat.visible = Boolean(tex);
    if (tex) {
      this.flat.material.map = tex;
      this.flat.material.needsUpdate = true;
    }
  }

  /**
   * Luz del lugar donde está el jugador.
   * @param {number} sky luz del cielo, de 0 a 1
   * @param {number} block luz de antorchas y lámparas, de 0 a 1
   */
  setLight(sky, block) {
    this.light.set(sky, block);
    lightColor(this.flat.material.color, sky, block);
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  /**
   * Dispara la animación de usar el bloque (romper o poner). Si ya se está
   * balanceando, el siguiente espera a que termine (como el brazo del personaje):
   * así no salta a mitad de camino.
   */
  swing() {
    if (this._swing > 0) this._queued = true;
    else this._swing = SWING_TIME;
  }

  /**
   * @param {number} dt segundos
   * @param {number} speed velocidad horizontal del jugador (para el vaivén)
   */
  update(dt, speed) {
    this._bob += dt * speed * 1.8;
    const bobAmount = Math.min(speed / 4.3, 1.3) * 0.025;
    this._swing = Math.max(0, this._swing - dt);
    if (this._swing === 0 && this._queued) {
      this._queued = false;
      this._swing = SWING_TIME;
    }
    const s = this._swing > 0 ? Math.sin((1 - this._swing / SWING_TIME) * Math.PI) : 0;
    // En ventanas angostas o verticales, acercarlo al centro para que entre.
    const halfWidth =
      -REST.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    const restX = Math.min(REST.x, halfWidth - 0.2);
    this.mesh.position.set(
      restX + Math.sin(this._bob) * bobAmount - s * 0.15,
      REST.y + Math.abs(Math.cos(this._bob)) * bobAmount + s * 0.08,
      REST.z - s * 0.2,
    );
    this.mesh.rotation.set(-0.15 - s * 0.9, -0.75 + s * 0.4, 0.08);
  }
}
