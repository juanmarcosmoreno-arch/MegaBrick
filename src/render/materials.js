// Materiales compartidos por todas las mallas de bloques (uno por capa).

import * as THREE from 'three';
import { LAYER } from '../world/blocks.js';
import { SKY_COLOR_GLSL, skyUniforms } from './skyUniforms.js';

/**
 * Luz de los bloques (etapa 15). El color de cada vértice trae la oclusión
 * (rojo), la luz del cielo (verde) y la de antorchas y lámparas (azul), de
 * 0 a 1 (ver world/Mesher.js). Lo que ilumina el sol o la luna (las luces
 * de la escena) se multiplica por la luz del cielo, y la de las antorchas
 * se suma con un tono cálido, igual de día y de noche. Cada nivel de luz
 * menos es un 20 % más oscuro; con todo apagado queda un resto mínimo.
 */
const LIGHT_GLSL = /* glsl */ `
  float lightCurve(float l) {
    return l <= 0.0 ? 0.0 : pow(0.8, (1.0 - l) * 15.0);
  }
  vec3 blockLighting(vec3 outgoing, vec3 albedo, vec2 lv) {
    vec3 torch = vec3(1.0, 0.72, 0.42) * 1.2 * lightCurve(lv.y);
    return outgoing * lightCurve(lv.x) + albedo * (torch + vec3(0.018));
  }
`;

/** Solo la oclusión multiplica el color (verde y azul son luz). */
const COLOR_AO = /* glsl */ `
  #if defined( USE_COLOR )
    diffuseColor.rgb *= vColor.r;
  #endif
`;

/** Lo que brilla solo (faroles): solo la oclusión, sin luz. */
export function aoOnlyShader(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', COLOR_AO);
}

/** Bloques del mundo: la luz viene en el color de cada vértice. */
function worldLight(shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${LIGHT_GLSL}`)
    .replace('#include <color_fragment>', COLOR_AO)
    .replace(
      '#include <opaque_fragment>',
      `#if defined( USE_COLOR )
        outgoingLight = blockLighting( outgoingLight, diffuseColor.rgb, vColor.gb );
      #endif
      #include <opaque_fragment>`,
    );
}

/**
 * Bloque en la mano (y los sueltos): una sola luz para todo el bloque, la
 * del lugar donde está el jugador (uniform itemLight: cielo y bloques, de 0 a 1).
 * @param {{value: THREE.Vector2}} uniform
 */
export function itemLightShader(uniform) {
  return function itemLight(shader) {
    shader.uniforms.itemLight = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec2 itemLight;\n${LIGHT_GLSL}`)
      .replace('#include <color_fragment>', COLOR_AO)
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight = blockLighting( outgoingLight, diffuseColor.rgb, itemLight );
        #include <opaque_fragment>`,
      );
  };
}

/**
 * Niebla a medida: se mide con la distancia real a la cámara (no con la
 * profundidad) y su color es el del cielo en esa dirección (como la cúpula),
 * así lo lejano se funde con el cielo que tiene detrás. Bajo el agua se usa
 * el color de niebla común.
 */
function skyFog(shader) {
  Object.assign(shader.uniforms, skyUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vSkyDir;')
    .replace(
      '#include <fog_vertex>',
      `#ifdef USE_FOG
        vFogDepth = length( mvPosition.xyz );
        vSkyDir = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz - cameraPosition;
      #endif`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <fog_pars_fragment>',
      `#include <fog_pars_fragment>
      varying vec3 vSkyDir;
      uniform float skyFog;
      ${SKY_COLOR_GLSL}`,
    )
    .replace(
      '#include <fog_fragment>',
      `#ifdef USE_FOG
        float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        // La niebla se aplica ya en el espacio de color de salida: el color
        // del cielo (lineal) se convierte igual que el de la cúpula.
        vec3 fogTarget = skyFog > 0.5 ? linearToOutputTexel( vec4( skyColorAt( normalize( vSkyDir ) ), 1.0 ) ).rgb : fogColor;
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTarget, fogFactor );
      #endif`,
    );
}

/**
 * Crea los materiales de las capas de render a partir del atlas.
 * Se devuelven en un array indexado por LAYER.
 */
export function createBlockMaterials(atlasTexture) {
  const opaque = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
  });

  // Hojas y vidrio: píxeles totalmente transparentes se descartan (alphaTest),
  // así no hace falta ordenar por profundidad.
  const cutout = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    alphaTest: 0.5,
  });

  // Agua: semitransparente, visible también desde abajo, sin escribir
  // profundidad para que se vea lo que hay detrás.
  const translucent = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Faroles: brillan solos, igual de día y de noche (sin luces ni sombras).
  const glow = new THREE.MeshBasicMaterial({
    map: atlasTexture,
    vertexColors: true,
  });

  // Niebla radial y del color del cielo: Three.js calcula la niebla con la
  // profundidad (distancia al plano de la cámara), así que en los costados de
  // la pantalla lo lejano queda con menos niebla y se ve el borde del mundo.
  // Con la distancia real la niebla es pareja en todas las direcciones.
  // Y la luz (etapa 15): los faroles brillan solos, sin la luz de alrededor.
  for (const m of [opaque, cutout, translucent]) {
    m.onBeforeCompile = (shader) => {
      skyFog(shader);
      worldLight(shader);
    };
  }
  glow.onBeforeCompile = (shader) => {
    skyFog(shader);
    aoOnlyShader(shader);
  };

  const materials = [];
  materials[LAYER.OPAQUE] = opaque;
  materials[LAYER.CUTOUT] = cutout;
  materials[LAYER.TRANSLUCENT] = translucent;
  materials[LAYER.GLOW] = glow;
  return materials;
}
