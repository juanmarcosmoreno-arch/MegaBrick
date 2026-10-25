// Contorno (wireframe) del bloque apuntado. En una losa, un escalón o una
// puerta, rodea lo que ocupa (no el bloque entero).

import * as THREE from 'three';
import { getBlock } from '../world/blocks.js';

const DARK = new THREE.Color(0x101010);
const LIGHT = new THREE.Color(0xd8e0f0);

export class BlockOutline {
  constructor(scene) {
    // Un poco más grande que el bloque, para que no se pise con sus caras.
    const box = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.mesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.7 }),
    );
    box.dispose();
    // Las aristas se acercan un poquito a la cámara (solo en profundidad, sin
    // moverse en pantalla) para que no las tapen las caras de al lado, por
    // ejemplo en el fondo de un pozo o en una esquina interior.
    this.mesh.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        '#include <project_vertex>\n\tmvPosition.xyz *= 0.98;\n\tgl_Position = projectionMatrix * mvPosition;',
      );
    };
    this.mesh.visible = false;
    this.mesh.renderOrder = 2; // después del agua
    scene.add(this.mesh);
  }

  /**
   * Color según la luz del día (0 noche, 1 día): oscuro de día y claro de
   * noche, con un cambio rápido al atardecer para que nunca se pierda.
   */
  setDaylight(daylight) {
    const k = THREE.MathUtils.smoothstep(daylight, 0.35, 0.65);
    this.mesh.material.color.lerpColors(LIGHT, DARK, k);
  }

  /** Muestra el contorno en el bloque apuntado ({x, y, z, id}), o lo oculta con null. */
  show(block) {
    if (!block) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    // Lo que ocupan todas sus cajas juntas (un cubo entero si no tiene forma).
    const lo = [0, 0, 0];
    const hi = [1, 1, 1];
    const boxes = getBlock(block.id).boxes;
    if (boxes) {
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(...boxes.map((b) => b[a]));
        hi[a] = Math.max(...boxes.map((b) => b[a + 3]));
      }
    }
    this.mesh.scale.set(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
    this.mesh.position.set(block.x + (lo[0] + hi[0]) / 2, block.y + (lo[1] + hi[1]) / 2, block.z + (lo[2] + hi[2]) / 2);
  }
}
