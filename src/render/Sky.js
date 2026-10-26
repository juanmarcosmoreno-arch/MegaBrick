// Cielo, sol, luna, estrellas, luces y niebla, con el ciclo de día y noche.
//
// Un día dura 10 minutos. La hora es una fracción del día: 0 = medianoche,
// 0,25 = amanece, 0,5 = mediodía, 0,75 = atardece. Con la altura del sol
// cambian los colores del cielo (degradé del horizonte al cénit), las luces
// (sol, luna y ambiente) y la niebla, que es del color del horizonte para
// que lo lejano se funda con el cielo.

import * as THREE from 'three';
import { SKY_COLOR_GLSL, skyUniforms } from './skyUniforms.js';

/** Duración de un día completo (segundos). */
export const DAY_LENGTH = 600;
/** Hora con la que empiezan los mundos nuevos (a media mañana). */
export const START_TIME = 0.3;

/** Color del agua vista desde adentro (de día). */
const UNDERWATER_COLOR = new THREE.Color(0x2c5f94);
/** Inclinación del recorrido del sol (no pasa justo por arriba). */
const TILT = 0.38;

/**
 * Colores del cielo según la altura del sol (seno del ángulo): cénit,
 * horizonte y resplandor alrededor del sol.
 */
const SKY_KEYS = [
  { e: -1, top: 0x04060d, horizon: 0x0a1022, glow: 0x000000 },
  { e: -0.3, top: 0x04060d, horizon: 0x0a1022, glow: 0x000000 },
  { e: -0.1, top: 0x0f1735, horizon: 0x283764, glow: 0x3a2440 },
  { e: 0.02, top: 0x34508f, horizon: 0xf0985a, glow: 0xff8a3d },
  { e: 0.2, top: 0x5a9be0, horizon: 0xbcdaf0, glow: 0xffd9a0 },
  { e: 0.45, top: 0x4a95e3, horizon: 0x8ccdf2, glow: 0xfff1d0 },
  { e: 1, top: 0x4a95e3, horizon: 0x8ccdf2, glow: 0xfff1d0 },
].map((k) => ({ e: k.e, top: new THREE.Color(k.top), horizon: new THREE.Color(k.horizon), glow: new THREE.Color(k.glow) }));

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const SUN_LOW = new THREE.Color(0xffc58a);
const SUN_HIGH = new THREE.Color(0xfff3dc);
const AMBIENT_NIGHT = new THREE.Color(0x8796c8);
const AMBIENT_DAY = new THREE.Color(0xffffff);

/** Textura de pixel art dibujada en un canvas chico (se ve pixelada a propósito). */
function pixelTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Disco de píxeles: llama a `color(dx, dy, r)` por cada píxel dentro del radio. */
function disc(ctx, size, radius, color) {
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c);
      if (r > radius) continue;
      ctx.fillStyle = color(x - c, y - c, r);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** Sol: disco cálido con anillos más oscuros hacia el borde. */
const sunTexture = () =>
  pixelTexture(16, (ctx, size) =>
    disc(ctx, size, 7.2, (dx, dy, r) => (r > 6.4 ? '#ffb347' : r > 5 ? '#ffd45e' : r > 2.6 ? '#ffec9a' : '#fffbe6')),
  );

/** Luna: disco pálido con algunos cráteres. */
const moonTexture = () =>
  pixelTexture(16, (ctx, size) => {
    const craters = [
      [-2, -2, 1.6],
      [2.5, 1, 1.2],
      [-1, 3, 1],
      [3, -3, 0.8],
    ];
    disc(ctx, size, 6.4, (dx, dy, r) => {
      if (r > 5.6) return '#b9c2d6';
      for (const [cx, cy, cr] of craters) if (Math.hypot(dx - cx, dy - cy) <= cr) return '#c6cddd';
      return '#e8ecf5';
    });
  });

/** Resplandor suave alrededor del sol y la luna (degradé radial). */
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Un cuadrado que siempre mira a la cámara (sol, luna o resplandor). */
function billboard(map, { additive = false } = {}) {
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  return mesh;
}

export class Sky {
  /**
   * @param {THREE.Scene} scene escena del juego
   */
  constructor(scene) {
    this.scene = scene;
    /** Hora del día (0 a 1). */
    this.time = START_TIME;
    /** Altura del sol: seno de su ángulo sobre el horizonte (-1 a 1). */
    this.sunElevation = 0;
    // Colores y dirección del sol compartidos con la niebla de los bloques.
    this.sunDirection = skyUniforms.skySunDir.value;
    this.horizonColor = skyUniforms.skyHorizon.value;
    this.topColor = skyUniforms.skyTop.value;
    this.glowColor = skyUniforms.skyGlow.value;
    this.fogColor = new THREE.Color();
    scene.background = this.fogColor;

    // Luz ambiente: ilumina todo por igual para que las caras en sombra no
    // queden negras (de noche, más baja y azulada).
    this.ambient = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(this.ambient);
    // Sol y luna: luces direccionales que dan volumen a los bloques.
    this.sun = new THREE.DirectionalLight(0xfff3dc, 1.9);
    this.moon = new THREE.DirectionalLight(0x9fb4ff, 0);
    for (const light of [this.sun, this.moon]) {
      scene.add(light);
      scene.add(light.target);
    }

    // Cúpula del cielo: una esfera que sigue a la cámara, dibujada antes que
    // todo y sin profundidad (hace de fondo).
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: {
          skyTop: skyUniforms.skyTop,
          skyHorizon: skyUniforms.skyHorizon,
          skyGlow: skyUniforms.skyGlow,
          skySunDir: skyUniforms.skySunDir,
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          ${SKY_COLOR_GLSL}
          varying vec3 vDir;
          void main() {
            gl_FragColor = vec4(skyColorAt(normalize(vDir)), 1.0);
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dome.renderOrder = -30;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Estrellas: puntos al azar que giran con el cielo y se ven de noche.
    const count = 700;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    let seed = 1234567;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      // Dirección uniforme en la esfera.
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions.set([r * Math.cos(a), u, r * Math.sin(a)], i * 3);
      sizes[i] = rand() < 0.12 ? 2.6 : rand() < 0.5 ? 1.8 : 1.3;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 }, pixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        uniform float pixelRatio;
        varying float vHeight;
        void main() {
          // Altura de la estrella en el cielo (para apagar las de abajo del horizonte).
          vHeight = normalize((modelMatrix * vec4(position, 0.0)).xyz).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * pixelRatio;
        }`,
      fragmentShader: /* glsl */ `
        uniform float opacity;
        varying float vHeight;
        void main() {
          float visible = opacity * smoothstep(-0.03, 0.06, vHeight);
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * visible, 1.0);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Sol y luna con su resplandor.
    this.sunDisc = billboard(sunTexture());
    this.moonDisc = billboard(moonTexture());
    this.sunGlow = billboard(glowTexture(), { additive: true });
    this.moonGlow = billboard(glowTexture(), { additive: true });
    for (const m of [this.sunGlow, this.moonGlow, this.sunDisc, this.moonDisc]) scene.add(m);

    // Niebla lineal (los materiales la miden en distancia real a la cámara):
    // tapa todo justo antes del borde del área cargada.
    this.fog = new THREE.Fog(this.fogColor.clone(), 20, 100);
    scene.fog = this.fog;
    this.underwater = false;
    this._fogRange = { near: 20, far: 100 };
    this._apply();
  }

  /** Pone la hora del día (0 a 1). */
  setTime(time) {
    this.time = ((Number(time) % 1) + 1) % 1 || 0;
    this._apply();
  }

  /** Avanza la hora `seconds` segundos de juego (un día dura DAY_LENGTH). */
  advance(seconds) {
    if (seconds > 0) this.setTime(this.time + seconds / DAY_LENGTH);
  }

  /** Hora en formato reloj ("14:35"). */
  get clock() {
    const minutes = Math.floor(this.time * 24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  /** ¿Es de noche? (el sol bajo el horizonte) */
  get isNight() {
    return this.sunElevation < -0.05;
  }

  /**
   * Ajusta la niebla para que tape todo justo antes del borde del área
   * cargada.
   * @param {number} edgeDistance distancia (bloques) al borde más cercano
   */
  setViewDistance(edgeDistance) {
    this._fogRange.far = Math.max(8, edgeDistance - 2);
    this._fogRange.near = this._fogRange.far * 0.45;
    this._applyFog();
  }

  /** Hasta dónde se ve (donde la niebla ya tapa todo), en bloques. */
  get viewDistance() {
    return this._fogRange.far;
  }

  /** Cambia entre la niebla normal y la de "bajo el agua" (azul y cercana). */
  setUnderwater(on) {
    if (on === this.underwater) return;
    this.underwater = on;
    for (const m of [this.dome, this.stars, this.sunDisc, this.moonDisc, this.sunGlow, this.moonGlow]) m.visible = !on;
    this._applyFog();
  }

  /** Colores, luces y posición del sol según la hora. */
  _apply() {
    const angle = (this.time - 0.25) * Math.PI * 2; // 0 al amanecer, PI/2 al mediodía
    this.sunDirection.set(Math.cos(angle), Math.sin(angle) * Math.cos(TILT), Math.sin(angle) * Math.sin(TILT));
    const e = this.sunDirection.y;
    this.sunElevation = e;

    // Colores del cielo: entre las dos claves que rodean la altura del sol.
    let i = 0;
    while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].e < e) i++;
    const a = SKY_KEYS[i];
    const b = SKY_KEYS[i + 1];
    const k = smoothstep(a.e, b.e, e);
    this.topColor.lerpColors(a.top, b.top, k);
    this.horizonColor.lerpColors(a.horizon, b.horizon, k);
    this.glowColor.lerpColors(a.glow, b.glow, k);

    // Luces: el sol se apaga al ponerse; de noche queda la luna y un
    // ambiente bajo y azulado (oscuro, pero se ve dónde se camina).
    const day = smoothstep(-0.18, 0.22, e);
    this.daylight = day;
    this.sun.intensity = 1.9 * smoothstep(-0.04, 0.2, e);
    this.sun.color.lerpColors(SUN_LOW, SUN_HIGH, smoothstep(0.05, 0.35, e));
    this.moon.intensity = 0.45 * smoothstep(0.02, -0.2, e);
    this.ambient.intensity = 0.42 + 0.93 * day;
    this.ambient.color.lerpColors(AMBIENT_NIGHT, AMBIENT_DAY, day);
    // El reflejo del ambiente en el personaje también baja de noche.
    this.scene.environmentIntensity = 0.12 + 0.43 * day;

    this.starMaterial.uniforms.opacity.value = smoothstep(-0.02, -0.22, e);
    this.stars.rotation.set(0, 0, 0);
    this.stars.rotateX(TILT);
    this.stars.rotateZ(angle);
    this._applyFog();
  }

  _applyFog() {
    skyUniforms.skyFog.value = this.underwater ? 0 : 1;
    if (this.underwater) {
      this.fogColor.copy(UNDERWATER_COLOR).multiplyScalar(0.25 + 0.75 * (this.daylight ?? 1));
      this.fog.near = 1;
      this.fog.far = Math.min(20, this._fogRange.far);
    } else {
      this.fogColor.copy(this.horizonColor);
      this.fog.near = this._fogRange.near;
      this.fog.far = this._fogRange.far;
    }
    this.fog.color.copy(this.fogColor);
  }

  /**
   * Acomoda el cielo alrededor de la cámara (la hora avanza con advance).
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} pixelRatio densidad de píxeles (tamaño de las estrellas)
   */
  update(camera, pixelRatio = 1) {
    const center = camera.getWorldPosition(this._center ?? (this._center = new THREE.Vector3()));
    // Las luces siguen al jugador (apuntan siempre a la zona visible).
    this.sun.position.copy(center).addScaledVector(this.sunDirection, 100);
    this.sun.target.position.copy(center);
    this.moon.position.copy(center).addScaledVector(this.sunDirection, -100);
    this.moon.target.position.copy(center);

    // Cúpula, estrellas, sol y luna: lejos, pero dentro del plano lejano
    // (y más allá de la niebla, así el terreno siempre queda adelante).
    const far = camera.far;
    this.dome.position.copy(center);
    this.dome.scale.setScalar(far * 0.98);
    this.stars.position.copy(center);
    this.stars.scale.setScalar(far * 0.96);
    this.starMaterial.uniforms.pixelRatio.value = pixelRatio;
    const place = (mesh, dir, size) => {
      mesh.position.copy(center).addScaledVector(dir, far * 0.94);
      mesh.scale.setScalar(far * 0.94 * size);
      mesh.lookAt(center);
    };
    const moonDir = this._moonDir ?? (this._moonDir = new THREE.Vector3());
    moonDir.copy(this.sunDirection).negate();
    place(this.sunDisc, this.sunDirection, 0.11);
    place(this.sunGlow, this.sunDirection, 0.5);
    place(this.moonDisc, moonDir, 0.085);
    place(this.moonGlow, moonDir, 0.3);
    // Debajo del horizonte no se ven (aunque no haya terreno delante, por
    // ejemplo mirando desde una montaña hacia el borde del área cargada).
    const e = this.sunElevation;
    this.sunDisc.material.opacity = smoothstep(-0.12, -0.02, e);
    this.moonDisc.material.opacity = smoothstep(-0.12, -0.02, -e);
    this.sunGlow.material.opacity = 0.9 * smoothstep(-0.1, 0.04, e);
    this.moonGlow.material.opacity = 0.35 * smoothstep(-0.1, 0.04, -e) * smoothstep(0.1, -0.1, e);
  }
}
