// Contorno (wireframe) del bloque apuntado. En una losa, un escalón o una
// puerta, rodea lo que ocupa (no el bloque entero). Mientras se rompe, el
// bloque se va agrietando.

import * as THREE from 'three';
import { getBlock } from '../world/blocks.js';

const DARK = new THREE.Color(0x101010);
const LIGHT = new THREE.Color(0xd8e0f0);

/** Etapas de las grietas (de recién empezado a por romperse). */
const CRACK_STAGES = 8;

/** Las 8 direcciones de un píxel al de al lado (empezando a la derecha, en sentido horario). */
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/**
 * Grietas de pixel art: una tira con las 8 etapas de 16×16, una al lado de
 * la otra. Las grietas son ramas en zigzag (siempre las mismas) que salen
 * del centro y a veces se abren en dos; cada etapa muestra un poco más.
 */
function crackTexture() {
  const S = 16;
  const canvas = document.createElement('canvas');
  canvas.width = S * CRACK_STAGES;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  let seed = 3;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pixels = []; // [x, y, paso desde el centro]
  const seen = new Set();
  const branches = [];
  for (let b = 0; b < 5; b++) {
    branches.push({ x: 7, y: 8, a: (b / 5) * Math.PI * 2 + rnd() * 0.9, step: 0, life: 7 + Math.floor(rnd() * 5) });
  }
  while (branches.length) {
    const br = branches.shift();
    let { x, y, a, step } = br;
    for (let i = 0; i < br.life && x >= 0 && y >= 0 && x < S && y < S; i++, step++) {
      if (!seen.has(x + y * S)) {
        seen.add(x + y * S);
        pixels.push([x, y, step]);
      }
      // Zigzag: de las dos direcciones a 45° más cercanas al ángulo, una al azar.
      a += (rnd() - 0.5) * 0.7;
      const f = (((a / (Math.PI / 4)) % 8) + 8) % 8;
      const [dx, dy] = DIRS[(rnd() < f - Math.floor(f) ? Math.ceil(f) : Math.floor(f)) % 8];
      x += dx;
      y += dy;
      // A veces se abre en dos.
      if (rnd() < 0.12 && branches.length < 12) {
        branches.push({ x, y, a: a + (rnd() < 0.5 ? 0.9 : -0.9), step: step + 1, life: 3 + Math.floor(rnd() * 4) });
      }
    }
  }
  // Del centro hacia afuera: así crecen todas las ramas a la vez.
  pixels.sort((a, b) => a[2] - b[2]);
  ctx.fillStyle = 'rgba(24, 18, 12, 0.85)';
  for (let k = 0; k < CRACK_STAGES; k++) {
    const n = Math.ceil((pixels.length * (k + 1)) / CRACK_STAGES);
    for (let i = 0; i < n; i++) ctx.fillRect(k * S + pixels[i][0], pixels[i][1], 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1 / CRACK_STAGES, 1);
  return texture;
}

/** Cuánto sobresalen las grietas de cada cara (para no pisarse con ella). */
const CRACK_GAP = 0.001;
const crackGeometries = new Map();

/**
 * Las grietas de un bloque: una caja apenas más grande por cada caja de su
 * forma (en un escalón no quedan grietas en el aire), con la textura según
 * el lugar en el bloque, como sus caras (en una losa no se aplasta).
 */
function crackGeometry(id) {
  let geometry = crackGeometries.get(id);
  if (geometry) return geometry;
  const position = [];
  const uv = [];
  const index = [];
  const clamp = (v) => Math.min(1, Math.max(0, v));
  for (const [x0, y0, z0, x1, y1, z1] of getBlock(id).boxes ?? [[0, 0, 0, 1, 1, 1]]) {
    const box = new THREE.BoxGeometry(x1 - x0 + 2 * CRACK_GAP, y1 - y0 + 2 * CRACK_GAP, z1 - z0 + 2 * CRACK_GAP);
    box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const pos = box.attributes.position;
    const nor = box.attributes.normal;
    const first = position.length / 3;
    for (let i = 0; i < pos.count; i++) {
      const x = clamp(pos.getX(i));
      const y = clamp(pos.getY(i));
      const z = clamp(pos.getZ(i));
      position.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      // Igual que BoxGeometry en un cubo entero.
      if (nor.getX(i) !== 0) uv.push(nor.getX(i) > 0 ? 1 - z : z, y);
      else if (nor.getY(i) !== 0) uv.push(x, nor.getY(i) > 0 ? 1 - z : z);
      else uv.push(nor.getZ(i) > 0 ? x : 1 - x, y);
    }
    for (let i = 0; i < box.index.count; i++) index.push(first + box.index.getX(i));
    box.dispose();
  }
  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  crackGeometries.set(id, geometry);
  return geometry;
}

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

    // Grietas: cajas apenas más grandes que las del bloque (ver
    // crackGeometry), con la etapa que corresponde (se corre la textura de a
    // una etapa).
    this.crack = new THREE.Mesh(
      crackGeometry(0),
      new THREE.MeshBasicMaterial({
        map: crackTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.crack.visible = false;
    this.crack.renderOrder = 1;
    scene.add(this.crack);
  }

  /**
   * Color según la luz del día (0 noche, 1 día): oscuro de día y claro de
   * noche, con un cambio rápido al atardecer para que nunca se pierda.
   */
  setDaylight(daylight) {
    const k = THREE.MathUtils.smoothstep(daylight, 0.35, 0.65);
    this.mesh.material.color.lerpColors(LIGHT, DARK, k);
  }

  /**
   * Muestra el contorno en el bloque apuntado ({x, y, z, id}), o lo oculta
   * con null. `progress` (0 a 1): cuánto se rompió (grietas).
   */
  show(block, progress = 0) {
    this.crack.visible = Boolean(block) && progress > 0;
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
    if (this.crack.visible) {
      this.crack.geometry = crackGeometry(block.id);
      this.crack.position.set(block.x, block.y, block.z);
      const stage = Math.min(CRACK_STAGES - 1, Math.floor(progress * CRACK_STAGES));
      this.crack.material.map.offset.x = stage / CRACK_STAGES;
    }
  }
}
