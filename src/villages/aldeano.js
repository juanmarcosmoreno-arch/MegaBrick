// Modelo de un aldeano (etapa 16): uno de los personajes (ver
// player/characters/) con su color de ropa y su nombre arriba de la cabeza,
// como un jugador más, pero lo maneja la máquina (ver animals/Animal.js).
// Se usa como una especie de animal más (ver animals/species/index.js).

import { createHumanoid } from '../player/characters/humanoid.js';
import { getCharacter } from '../player/characters/index.js';
import { VARIANTS } from '../player/colors.js';
import { nameTag } from '../player/RemotePlayer.js';
import { lightColor } from '../render/itemMesh.js';
import { PROFESSIONS, villagerInfo } from './people.js';

export const info = {
  id: 'aldeano',
  name: 'Aldeano',
  // La variante es el oficio.
  variants: PROFESSIONS.map((p) => p.name),
  size: { width: 0.6, length: 0.6, height: 1.75 },
  bounds: { side: 0.32, front: 0.25, back: 0.25, top: 1.8 },
};

/** Cuánto gira la cabeza para mirar (con tope). */
const MAX_HEAD_YAW = 1.0;

export function createModel(THREE, { id }) {
  const who = villagerInfo(id);
  const root = new THREE.Group();
  const body = createHumanoid(THREE, getCharacter(who.character), { color: VARIANTS[who.color].color });
  body.root.rotation.y = Math.PI; // el modelo mira a +Z; los animales, a -Z
  root.add(body.root);
  const tag = nameTag(`${who.name} · ${who.job}`);
  tag.position.y = 2.25;
  // A diferencia del de los jugadores, no se ve a través de las paredes
  // (en una aldea hay muchos).
  tag.material.depthTest = true;
  tag.renderOrder = 0;
  root.add(tag);
  const materials = new Set();
  body.root.traverse((o) => o.material && materials.add(o.material));

  return {
    root,
    update(dt, s) {
      body.update(dt, { speed: s.speed, t: s.t, pitch: s.lookPitch });
      body.parts.head.rotation.y = Math.max(-MAX_HEAD_YAW, Math.min(MAX_HEAD_YAW, s.lookYaw));
      body.setExpression(s.action === 'happy' ? 'feliz' : s.action === 'scared' ? 'sorprendido' : 'normal');
    },
    /** Luz del lugar (como la de los jugadores): ver Avatar.setLight. */
    setLight(sky, block) {
      for (const m of materials) lightColor(m.color, sky, block);
    },
    dispose() {
      body.dispose();
      tag.material.map.dispose();
      tag.material.dispose();
    },
  };
}
