// Bloque en la mano en primera persona: un cubito abajo a la derecha de la
// pantalla que se mueve al caminar y se balancea al romper o poner.

import * as THREE from 'three';
import { getBlockGeometry } from './blockGeometry.js';

const REST = new THREE.Vector3(0.56, -0.5, -0.95); // posición respecto de la cámara
const SWING_TIME = 0.25;

export class HeldItem {
  /**
   * @param {THREE.Camera} camera la cámara (tiene que estar en la escena)
   * @param {THREE.Material[]} blockMaterials materiales de bloques por capa
   */
  constructor(camera, blockMaterials) {
    // Copias de los materiales que se dibujan siempre por encima del mundo
    // (sin prueba de profundidad ni niebla) y después del agua.
    this.materials = blockMaterials.map((m) => {
      const c = m.clone();
      c.depthTest = false;
      c.depthWrite = false;
      c.fog = false;
      c.transparent = true;
      return c;
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.materials);
    this.mesh.renderOrder = 1000;
    this.mesh.scale.setScalar(0.38);
    this.mesh.position.copy(REST);
    this.mesh.frustumCulled = false;
    camera.add(this.mesh);
    this.camera = camera;
    this._swing = 0;
    this._queued = false;
    this._bob = 0;
  }

  setBlock(id) {
    this.mesh.geometry = getBlockGeometry(id);
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  /**
   * Dispara la animación de usar el bloque (romper o poner). Si ya se está
   * balanceando, el siguiente espera a que termine (como la pinza de coco):
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
