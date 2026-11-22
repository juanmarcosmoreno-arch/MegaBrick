// Objetos que no son bloques en la mano (etapa 15): un cuadrado con el
// dibujo del objeto (herramientas, minerales, palo), visto de los dos lados.

import * as THREE from 'three';
import { getItemCanvas } from '../items/itemIcons.js';

const textures = new Map();
let plane = null;

/** Textura del dibujo de un objeto (se guarda en caché), o null. */
export function getItemTexture(id) {
  if (textures.has(id)) return textures.get(id);
  const canvas = getItemCanvas(id);
  let tex = null;
  if (canvas) {
    tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  textures.set(id, tex);
  return tex;
}

/** Cuadrado de 1 x 1 centrado (compartido). */
export function itemPlane() {
  plane ??= new THREE.PlaneGeometry(1, 1);
  return plane;
}

/** Material para un objeto plano (cada uno el suyo: cambia de dibujo y de luz). */
export function itemMaterial() {
  return new THREE.MeshLambertMaterial({ alphaTest: 0.5, side: THREE.DoubleSide });
}

/** Brillo de la luz del lugar, como el de los bloques (ver render/materials.js). */
export function lightColor(color, sky, block) {
  const curve = (l) => (l <= 0 ? 0 : 0.8 ** ((1 - l) * 15));
  const s = curve(sky) + 0.02;
  const t = 1.2 * curve(block);
  const clamp = (v) => Math.min(1.3, v);
  return color.setRGB(clamp(s + t), clamp(s + 0.72 * t), clamp(s + 0.42 * t));
}
