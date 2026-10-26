// =============================================================================
// Gallina — una gallinita redonda como un huevo, para el mundo de Megabrick.
//
// Cuerpo de huevo (la punta gorda es la pechuga), cabeza redonda unida por un
// cuello de plumas, pico de dos mitades (se abre para cacarear), cresta de tres
// lóbulos y barbilla rojas, alitas a los costados que se abren y aletean, cola
// de tres plumas para arriba y patitas amarillas finas con cuatro dedos.
//
// Toda la gallina es UNA malla con esqueleto (SkinnedMesh) y un material
// Lambert por variante: colores por vértice multiplicados por una textura
// chiquita de plumitas (canvas). Una sola llamada de dibujo por gallina. La
// geometría y el material se arman una vez por variante y los comparten todas
// las instancias; cada gallina tiene solo sus huesos. Los ojos felices (∩ ∩)
// y los cachetes son piezas de la misma malla que aparecen escalando su hueso.
//
// Las patas se resuelven con cinemática inversa de dos huesos: el pie apoyado
// va hacia atrás exactamente a la velocidad del cuerpo, así no patina.
//
// No importa nada: THREE llega por parámetro.
// Ejes: mira hacia -Z, los pies apoyan en y = 0. 1 unidad = 1 bloque.
//
// Organización:
//   1. Utilidades              5. Piezas de la gallina
//   2. Variantes (colores)     6. Recursos compartidos (caché por variante)
//   3. Medidas y huesos        7. createModel (armado y animación)
//   4. Armado de geometría
// =============================================================================

export const info = {
  id: 'gallina',
  name: 'Gallina',
  variants: ['blanca', 'colorada', 'pinta'],
  size: { width: 0.35, length: 0.45, height: 0.55 },
  // Lo que ocupa el modelo dibujado: ver carpincho.js.
  bounds: { side: 0.21, front: 0.36, back: 0.3, top: 0.59 },
};

// =============================================================================
// 1. Utilidades
// =============================================================================
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
// smoothstep que también acepta bordes invertidos (a > b).
const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Acercamiento exponencial independiente del framerate.
const amort = (actual, objetivo, rapidez, dt) => lerp(actual, objetivo, 1 - Math.exp(-rapidez * dt));
// Número finito o un valor por defecto (para que un NaN no rompa la animación).
const numero = (x, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def);
const frac = (x) => x - Math.floor(x);
// potencia que conserva el signo
const spow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

// Generador pseudoaleatorio con semilla (mulberry32).
function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (i, j) => {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Vectores como arreglos [x, y, z] (solo al armar la geometría).
const sum = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const res = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const por = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const uni = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mezcla = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// a + X*x + Y*y + Z*z
const marco = (a, X, x, Y, y, Z = null, z = 0) => [
  a[0] + X[0] * x + Y[0] * y + (Z ? Z[0] * z : 0),
  a[1] + X[1] * x + Y[1] * y + (Z ? Z[1] * z : 0),
  a[2] + X[2] * x + Y[2] * y + (Z ? Z[2] * z : 0),
];

// Canvas: en el navegador con document; si no hay, OffscreenCanvas; si no, nada.
function crearCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

// =============================================================================
// 2. Variantes: plumaje (general, panza, lomo, cuello, alas y su punta, cola y
// su punta, muslo) y el dibujo de las plumitas de la textura:
//   0 = apenas marcadas · 1 = con borde oscuro · 2 = moteadas (barradas)
// =============================================================================
const VARIANTES = [
  // blanca: blanco crema, la cola apenas más gris
  {
    pluma: '#efe9de', panza: '#f4f0e8', lomo: '#e3dccf', cuello: '#f2ede4', ala: '#f1ece2', punta: '#d6cdbe',
    cola: '#e8e1d4', colaPunta: '#cbc1b1', muslo: '#ebe5da', patron: 0,
  },
  // colorada: rojiza, cuello dorado y cola oscura
  {
    pluma: '#b3552f', panza: '#c26d42', lomo: '#9a4527', cuello: '#d28c42', ala: '#bd6036', punta: '#7a3519',
    cola: '#4b2d22', colaPunta: '#2e1d17', muslo: '#b8633b', patron: 1,
  },
  // pinta: moteada blanco y negro
  {
    pluma: '#ece9e3', panza: '#f0ede8', lomo: '#e2ded6', cuello: '#efece6', ala: '#efece6', punta: '#d6d1c8',
    cola: '#e2ded7', colaPunta: '#c8c3ba', muslo: '#e6e2db', patron: 2,
  },
];
// lo que comparten todas: cresta, pico, patas y ojos
const COMUN = {
  cresta: '#d7463b', crestaBase: '#b2352d', barbilla: '#cf3f36',
  pico: '#ebb650', picoPunta: '#d69a3b', picoBajo: '#d9a042',
  pata: '#e8b94a', dedo: '#d7a33b',
  blanco: '#f8f4ec', ojo: '#2a1d17', ojoBajo: '#5e3a24', rubor: '#ef9b93',
};
// coordenadas de textura de las piezas sin plumas (franja lisa) y del brillito
// de los ojos (ahí el mapa de emisión es blanco: brilla de día y de noche)
const UV_LISO = [0.25, 0.03];
const UV_BRILLO = [0.875, 0.03];
const T0 = 0.125; // donde empiezan las plumitas en la textura (abajo está la franja lisa)

// =============================================================================
// 3. Medidas (en reposo, espacio del modelo) y huesos
// =============================================================================
const HUEVO = { c: [0, 0.258, 0.025], ejes: [0.146, 0.136, 0.186], gordo: 0.12, incl: -0.3 };
const PIVOTE = [0, 0.17, 0.03]; // hueso del cuerpo: cerca de las caderas, se inclina sobre las patas
const CUELLO_P = [0, 0.3, -0.07];
const CABEZA_P = [0, 0.425, -0.118];
const CABEZA_EJES = [0.081, 0.085, 0.089];
const PICO = { base: [0, -0.006, -0.07], punta: [0, -0.02, -0.142], r0: 0.026, r1: 0.0035 };
const PICO_BAJO = { base: [0, -0.016, -0.066], punta: [0, -0.03, -0.122], r0: 0.019, r1: 0.003 };
const MANDIBULA_P = [0, CABEZA_P[1] - 0.018, CABEZA_P[2] - 0.066];
const CRESTA_P = [0, CABEZA_P[1] + 0.07, CABEZA_P[2] - 0.01];
const LOBULOS = [
  // [dy, dz, radio] relativos a la cabeza
  [0.078, -0.052, 0.021],
  [0.093, -0.014, 0.026],
  [0.085, 0.027, 0.021],
];
const BARBILLA_P = [0, CABEZA_P[1] - 0.05, CABEZA_P[2] - 0.072];
const OJO = { dir: [0.64, 0.2, -0.74], rS: 0.031, hS: 0.0075, rI: 0.0225, hI: 0.0045, rB: 0.0078, hB: 0.004 };
const ALA_P = [0.115, 0.318, -0.05]; // hombro derecho (+X); el izquierdo, espejado
const COLA_P = [0, 0.33, 0.15];
const CADERA = [0.055, 0.175, 0.035]; // la derecha
const MUSLO = 0.075, CANILLA = 0.092;
const TOBILLO_Y = 0.016; // altura del tobillo con el pie apoyado

// Punto de la cabeza sobre la superficie en la dirección d (relativo al centro) y su normal.
function sobreCabeza(d) {
  const [a, b, c] = CABEZA_EJES;
  const u = uni(d);
  const t = 1 / Math.sqrt((u[0] / a) ** 2 + (u[1] / b) ** 2 + (u[2] / c) ** 2);
  const p = por(u, t);
  const n = uni([p[0] / (a * a), p[1] / (b * b), p[2] / (c * c)]);
  return { p: sum(CABEZA_P, p), n };
}
// Marco del ojo de un lado (s = -1 izquierdo, +1 derecho): centro, normal, arriba y costado.
function marcoOjo(s) {
  const { p, n } = sobreCabeza([s * OJO.dir[0], OJO.dir[1], OJO.dir[2]]);
  const U = uni(res([0, 1, 0], por(n, n[1])));
  const T = uni(cruz(U, n)); // hacia adelante/atrás sobre la cara
  return { p, n, U, T };
}
const OJOS = [marcoOjo(-1), marcoOjo(1)];

// [nombre, padre, posición en reposo]
const HUESOS = [
  ['base', -1, [0, 0, 0]],
  ['cuerpo', 0, PIVOTE],
  ['cuello', 1, CUELLO_P],
  ['cabeza', 2, CABEZA_P],
  ['mandibula', 3, MANDIBULA_P],
  ['cresta', 3, CRESTA_P],
  ['barbilla', 3, BARBILLA_P],
  ['ojoI', 3, sum(OJOS[0].p, por(OJOS[0].n, -0.004))],
  ['ojoD', 3, sum(OJOS[1].p, por(OJOS[1].n, -0.004))],
  ['irisI', 7, sum(OJOS[0].p, por(OJOS[0].n, 0.004))],
  ['irisD', 8, sum(OJOS[1].p, por(OJOS[1].n, 0.004))],
  ['felizI', 3, sum(OJOS[0].p, por(OJOS[0].n, -0.006))],
  ['felizD', 3, sum(OJOS[1].p, por(OJOS[1].n, -0.006))],
  ['alaI', 1, [-ALA_P[0], ALA_P[1], ALA_P[2]]],
  ['alaD', 1, ALA_P],
  ['cola', 1, COLA_P],
  ['musloI', 0, [-CADERA[0], CADERA[1], CADERA[2]]],
  ['canillaI', 16, [-CADERA[0], CADERA[1] - MUSLO, CADERA[2]]],
  ['pieI', 17, [-CADERA[0], CADERA[1] - MUSLO - CANILLA, CADERA[2]]],
  ['musloD', 0, CADERA],
  ['canillaD', 19, [CADERA[0], CADERA[1] - MUSLO, CADERA[2]]],
  ['pieD', 20, [CADERA[0], CADERA[1] - MUSLO - CANILLA, CADERA[2]]],
];
const H = Object.fromEntries(HUESOS.map(([n], i) => [n, i]));

// =============================================================================
// 4. Armado de geometría: superficies paramétricas (u da la vuelta, v va de un
// extremo al otro) con normales por diferencias finitas.
// =============================================================================
function crearArmado() {
  return { pos: [], nor: [], col: [], uv: [], hi: [], hw: [], idx: [], n: 0 };
}
function vertice(A, p, n, c, uv, h) {
  A.pos.push(p[0], p[1], p[2]);
  A.nor.push(n[0], n[1], n[2]);
  A.col.push(c[0], c[1], c[2]);
  A.uv.push(uv[0], uv[1]);
  if (typeof h === 'number') {
    A.hi.push(h, 0, 0, 0);
    A.hw.push(1, 0, 0, 0);
  } else {
    A.hi.push(h[0], h[1], 0, 0);
    A.hw.push(1 - h[2], h[2], 0, 0);
  }
  return A.n++;
}
// Triángulo con la cara para afuera (según las normales de sus vértices).
function triangulo(A, a, b, c) {
  const P = A.pos, N = A.nor;
  const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
  const e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
  const f = cruz(e1, e2);
  const n = [0, 1, 2].map((k) => N[a * 3 + k] + N[b * 3 + k] + N[c * 3 + k]);
  if (pto(f, n) < 0) A.idx.push(a, c, b);
  else A.idx.push(a, b, c);
}

/**
 * Superficie paramétrica.
 * fn(u, v) → [x, y, z]; ref(u, v) → un punto de adentro (orienta las normales).
 * color(u, v, p, n) → [r, g, b] lineal; uv(u, v, p) → [s, t]; hueso(u, v, p) →
 * índice o [h0, h1, peso de h1]. polo0 / polo1: el borde v = 0 / v = 1 es un punto.
 */
function parche(A, { nU, nV, fn, ref, color, uv = () => UV_LISO, hueso, polo0 = true, polo1 = true }) {
  const e = 1e-3;
  const normal = (u, v) => {
    const va = Math.max(0, v - e), vb = Math.min(1, v + e);
    const n = cruz(res(fn(u + e, v), fn(u - e, v)), res(fn(u, vb), fn(u, va)));
    const p = fn(u, v);
    return uni(pto(n, res(p, ref(u, v))) < 0 ? por(n, -1) : n);
  };
  const base = A.n;
  for (let j = 0; j <= nV; j++) {
    const v = j / nV;
    const polo = (j === 0 && polo0) || (j === nV && polo1);
    let nPolo = null;
    if (polo) {
      const vv = j === 0 ? 0.25 / nV : 1 - 0.25 / nV;
      nPolo = [0, 0, 0];
      for (let k = 0; k < nU; k++) nPolo = sum(nPolo, normal(k / nU, vv));
      nPolo = uni(nPolo);
    }
    for (let i = 0; i <= nU; i++) {
      const u = i / nU;
      const p = fn(u, v);
      const n = nPolo ?? normal(u, v);
      vertice(A, p, n, color(u, v, p, n), uv(u, v, p), hueso(u, v, p));
    }
  }
  const id = (i, j) => base + j * (nU + 1) + i;
  for (let j = 0; j < nV; j++) {
    for (let i = 0; i < nU; i++) {
      const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
      if (j === 0 && polo0) triangulo(A, a, c, d);
      else if (j === nV - 1 && polo1) triangulo(A, a, b, c);
      else {
        triangulo(A, a, b, c);
        triangulo(A, a, c, d);
      }
    }
  }
}

/**
 * Pieza alargada entre a y b (cápsula o huso): radio de r0 a r1, sección
 * elíptica (ancho × alto) que se puede deformar con seccion(cx, cy) → [cx, cy].
 * expo < 1 la hace más cilíndrica; 1, un huso.
 */
function huso(A, o) {
  const { a, b, r0, r1, expo = 0.6, nU = 8, nV = 6, ancho = 1, alto = 1, arriba = [0, 1, 0], seccion = null } = o;
  const eje = uni(res(b, a));
  let X = cruz(arriba, eje);
  if (Math.hypot(...X) < 1e-4) X = [1, 0, 0];
  X = uni(X);
  const Y = cruz(eje, X);
  const E0 = res(a, por(eje, r0 * 0.85)), E1 = sum(b, por(eje, r1 * 0.85));
  const tDe = (v) => (1 - spow(Math.cos(v * Math.PI), expo)) / 2;
  const fn = (u, v) => {
    const t = tDe(v);
    const rad = Math.pow(Math.sin(v * Math.PI), expo) * lerp(r0, r1, t);
    let cx = Math.cos(u * TAU) * ancho, cy = Math.sin(u * TAU) * alto;
    if (seccion) [cx, cy] = seccion(cx, cy, t);
    return marco(mezcla(E0, E1, t), X, cx * rad, Y, cy * rad);
  };
  const centro = mezcla(E0, E1, 0.5);
  parche(A, {
    nU, nV, fn,
    ref: () => centro,
    uv: o.uv ? (u, v, p) => o.uv(u, tDe(v), p) : undefined,
    color: (u, v, p, n) => o.color(tDe(v), u, p, n),
    hueso: o.hueso ? (u, v, p) => o.hueso(tDe(v), u, p) : () => o.h,
  });
}

/**
 * Elipsoide (o forma) centrado en c con ejes X, Y, Z y semiejes (rx, ry, rz);
 * deforma(dx, dy, dz) → factor de radio para esa dirección (opcional).
 * Los polos van sobre Y.
 */
function bola(A, o) {
  const { c, rx, ry, rz, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], nU = 10, nV = 8, deforma = null } = o;
  const fn = (u, v) => {
    const th = u * TAU, ph = v * Math.PI;
    const rho = Math.sin(ph), dy = -Math.cos(ph);
    const dx = rho * Math.sin(th), dz = rho * Math.cos(th);
    const k = deforma ? deforma(dx, dy, dz) : 1;
    return marco(c, X, dx * rx * k, Y, dy * ry * k, Z, dz * rz * k);
  };
  parche(A, {
    nU, nV, fn, ref: () => c,
    color: (u, v, p, n) => o.color(u, v, p, n),
    uv: o.uv ?? (() => UV_LISO),
    hueso: o.hueso ?? (() => o.h),
  });
}

/**
 * Domo apoyado sobre una superficie curva (ojos, cachetes): centro p, normal n,
 * arriba U y costado T; altura(ρx, ρy) → cuánto sale en ese punto (en metros,
 * ya contando la curvatura de la base).
 */
function domo(A, { p, n, U, T, r, altura, nU = 10, nV = 2, color, uv = () => UV_LISO, h, cx = 0, cy = 0 }) {
  const fn = (u, v) => {
    const x = cx + Math.cos(u * TAU) * r * v, y = cy + Math.sin(u * TAU) * r * v;
    return marco(marco(p, T, x, U, y), n, altura(x, y), [0, 0, 0], 0);
  };
  parche(A, { nU, nV, fn, ref: () => sum(p, por(n, -0.05)), color, uv, hueso: () => h, polo0: true, polo1: false });
}

function aGeometria(THREE, A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.hi, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.hw, 4));
  g.setIndex(A.idx);
  g.computeBoundingSphere();
  return g;
}

// =============================================================================
// 5. Piezas de la gallina
// =============================================================================
// Punto del cuerpo de huevo para una dirección de la esfera unitaria.
function puntoHuevo(dx, dy, dz) {
  const g = 1 - HUEVO.gordo * dz; // la pechuga (adelante, -Z) más gorda
  const x = dx * HUEVO.ejes[0] * g;
  let y = dy * HUEVO.ejes[1] * g;
  const z = dz * HUEVO.ejes[2];
  y *= 1 - 0.1 * suave(0, -1, dy); // panza un poco más chata
  const c = Math.cos(HUEVO.incl), s = Math.sin(HUEVO.incl);
  return [HUEVO.c[0] + x, HUEVO.c[1] + c * y - s * z, HUEVO.c[2] + s * y + c * z];
}

function armarGallina(THREE, vi) {
  const V = VARIANTES[vi];
  const lin = (hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  const C = {};
  for (const k of Object.keys(V)) if (typeof V[k] === 'string') C[k] = lin(V[k]);
  for (const k of Object.keys(COMUN)) C[k] = lin(COMUN[k]);
  const A = crearArmado();
  const liso = (col) => () => col;

  // --- cuerpo (huevo) ---
  parche(A, {
    nU: 18, nV: 12,
    fn: (u, v) => {
      const th = u * TAU, ph = v * Math.PI;
      const rho = Math.sin(ph);
      return puntoHuevo(rho * Math.sin(th), -Math.cos(ph), rho * Math.cos(th));
    },
    ref: () => HUEVO.c,
    color: (u, v) => {
      const ph = v * Math.PI, th = u * TAU;
      const dy = -Math.cos(ph), dz = Math.sin(ph) * Math.cos(th);
      let col = mezcla(C.pluma, C.panza, suave(0.05, -0.6, dy) * suave(0.6, -0.2, dz));
      col = mezcla(col, C.lomo, suave(0.2, 0.9, dy) * suave(-0.4, 0.5, dz));
      const sombra = 0.8 + 0.2 * suave(-1, -0.45, dy); // un poco más oscuro abajo
      return por(col, sombra);
    },
    uv: (u, v) => [u * 4, T0 + (1 - T0) * v],
    hueso: () => H.cuerpo,
  });

  // --- cuello: un tubo de plumas del cuerpo a la cabeza (se estira y se dobla) ---
  huso(A, {
    a: CUELLO_P, b: CABEZA_P, r0: 0.085, r1: 0.074, expo: 0.5, nU: 10, nV: 6,
    arriba: [0, 0, 1],
    color: (t) => mezcla(C.pluma, C.cuello, suave(0.1, 0.7, t)),
    uv: (u, v) => [u * 2, 0.5 + 0.28 * v],
    hueso: (t) => [H.cuello, H.cabeza, suave(0.3, 0.8, t)],
  });

  // --- cabeza ---
  bola(A, {
    c: CABEZA_P, rx: CABEZA_EJES[0], ry: CABEZA_EJES[1], rz: CABEZA_EJES[2], nU: 14, nV: 10,
    color: (u, v) => por(C.cuello, 0.96 + 0.04 * v),
    uv: (u, v) => [u * 3, 0.3 + 0.68 * v],
    h: H.cabeza,
  });

  // --- pico: dos mitades (la de abajo es la mandíbula) ---
  const relCab = (q) => sum(CABEZA_P, q);
  huso(A, {
    a: relCab(PICO.base), b: relCab(PICO.punta), r0: PICO.r0, r1: PICO.r1, expo: 0.7, nU: 10, nV: 5,
    alto: 0.78,
    seccion: (cx, cy) => [cx, cy < 0 ? cy * 0.3 : cy],
    color: (t) => mezcla(C.pico, C.picoPunta, suave(0.5, 1, t)),
    h: H.cabeza,
  });
  huso(A, {
    a: relCab(PICO_BAJO.base), b: relCab(PICO_BAJO.punta), r0: PICO_BAJO.r0, r1: PICO_BAJO.r1, expo: 0.7, nU: 8, nV: 4,
    alto: 0.7,
    seccion: (cx, cy) => [cx * 0.92, cy > 0 ? cy * 0.25 : cy],
    color: (t) => mezcla(C.picoBajo, C.picoPunta, suave(0.5, 1, t)),
    h: H.mandibula,
  });

  // --- cresta: tres lóbulos achatados, un poco tirados para atrás ---
  for (const [dy, dz, r] of LOBULOS) {
    const c = relCab([0, dy, dz]);
    bola(A, {
      c, rx: r * 0.58, ry: r, rz: r * 0.9, nU: 7, nV: 5,
      Y: uni([0, 1, 0.3]), Z: uni([0, -0.3, 1]),
      color: (u, v) => mezcla(C.crestaBase, C.cresta, suave(0.1, 0.6, v)),
      h: H.cresta,
    });
  }

  // --- barbilla: dos gotitas colgando abajo del pico ---
  for (const s of [-1, 1]) {
    bola(A, {
      c: relCab([s * 0.0062, -0.068, -0.078]), rx: 0.0085, ry: 0.0175, rz: 0.0105, nU: 6, nV: 5,
      Y: uni([0, 1, -0.25]),
      deforma: (dx, dy) => 1 + 0.22 * -dy, // más gorda abajo
      color: (u, v) => mezcla(C.barbilla, C.crestaBase, suave(0.5, 1, v)),
      h: H.barbilla,
    });
  }

  // --- ojos: blanco, iris oscuro (más claro abajo) y brillito ---
  const RC = 0.083; // curvatura de la cabeza
  OJOS.forEach((O, i) => {
    const s = i === 0 ? -1 : 1;
    const hEsclera = (x, y) => {
      const q = (x * x + y * y) / (OJO.rS * OJO.rS);
      return OJO.hS * Math.pow(Math.max(0, 1 - q), 0.6) - (x * x + y * y) / (2 * RC) + 0.0012;
    };
    // el iris mira un poquito para adelante (hacia el pico)
    const adelante = pto(O.T, [0, 0, -1]) > 0 ? 1 : -1;
    const ix = adelante * 0.0035, iy = 0.001;
    const hIris = (x, y) => {
      const q = ((x - ix) ** 2 + (y - iy) ** 2) / (OJO.rI * OJO.rI);
      return hEsclera(x, y) + 0.0006 + OJO.hI * Math.max(0, 1 - q);
    };
    domo(A, { ...O, r: OJO.rS, altura: hEsclera, nU: 12, nV: 2, color: liso(C.blanco), h: H[s < 0 ? 'ojoI' : 'ojoD'] });
    domo(A, {
      ...O, r: OJO.rI, cx: ix, cy: iy, altura: hIris, nU: 11, nV: 2, h: H[s < 0 ? 'irisI' : 'irisD'],
      color: (u, v, p) => {
        const y = pto(res(p, O.p), O.U);
        return mezcla(C.ojo, C.ojoBajo, suave(-0.002, -0.02, y) * 0.8);
      },
    });
    const bx = ix + adelante * 0.0055, by = iy + 0.0085;
    domo(A, {
      ...O, r: OJO.rB, cx: bx, cy: by, nU: 6, nV: 1,
      altura: (x, y) => hIris(x, y) + 0.0007 + OJO.hB * Math.max(0, 1 - ((x - bx) ** 2 + (y - by) ** 2) / (OJO.rB * OJO.rB)),
      color: liso(C.blanco), uv: () => UV_BRILLO, h: H[s < 0 ? 'irisI' : 'irisD'],
    });

    // ojos felices (∩) y cachete: aparecen con el hueso «feliz»
    const hf = H[s < 0 ? 'felizI' : 'felizD'];
    const arco = (k) => {
      const ang = lerp(0.18, Math.PI - 0.18, k);
      const x = Math.cos(ang) * OJO.rS * 0.85, y = Math.sin(ang) * OJO.rS * 0.62 - OJO.rS * 0.25;
      return marco(marco(O.p, O.T, x, O.U, y), O.n, 0.0035 - (x * x + y * y) / (2 * RC), [0, 0, 0], 0);
    };
    parche(A, {
      nU: 5, nV: 6, polo0: true, polo1: true,
      fn: (u, v) => {
        const k = clamp(v);
        const c = arco(k);
        const tg = uni(res(arco(Math.min(1, k + 0.01)), arco(Math.max(0, k - 0.01))));
        const b = uni(cruz(tg, O.n));
        const rad = 0.0052 * Math.pow(Math.sin(v * Math.PI), 0.5);
        return marco(c, b, Math.cos(u * TAU) * rad, O.n, Math.sin(u * TAU) * rad * 0.8);
      },
      ref: (u, v) => arco(clamp(v)),
      color: liso(C.ojo),
      hueso: () => hf,
    });
    const atras = -adelante;
    const cxC = atras * 0.006, cyC = -OJO.rS * 1.15;
    domo(A, {
      ...O, r: 0.014, cx: cxC, cy: cyC, nU: 8, nV: 2,
      altura: (x, y) => 0.0018 * Math.max(0, 1 - ((x - cxC) ** 2 + (y - cyC) ** 2) / 0.000196) - (x * x + y * y) / (2 * RC) + 0.001,
      color: liso(mezcla(C.rubor, C.cuello, 0.15)), h: hf,
    });
  });

  // --- alas: una lente achatada pegada al costado (los polos van sobre el
  // grosor, así el contorno tiene resolución): punta para atrás y arriba y
  // tres plumas redondeadas en el borde de atrás ---
  for (const s of [-1, 1]) {
    const S = [s * ALA_P[0], ALA_P[1], ALA_P[2]];
    const L = uni([0, 0.22, 1]); // a lo largo (para atrás y un poco arriba)
    const Ya = uni(cruz(L, [1, 0, 0])); // alto
    const X = [s, 0, 0]; // grosor, hacia afuera
    const c = marco(S, X, 0.016, Ya, -0.04, L, 0.055);
    // contorno en el plano (L, Ya): radio según el ángulo (0 = atrás, π/2 = arriba)
    const contorno = (ang) => {
      const cl = Math.cos(ang), sl = Math.sin(ang);
      const rl = cl > 0 ? 0.1 : 0.068; // más larga para atrás
      const ry = sl > 0 ? 0.044 : 0.056;
      let x = cl * rl, y = sl * ry;
      y += 0.018 * Math.max(0, cl) * Math.max(0, cl); // la punta sube un poco
      // plumas largas: tres puntas entre «abajo» y «atrás»
      const k = (ang < 0 ? ang + TAU : ang) - 4.55; // de ~260° a ~355°
      if (k > 0 && k < 1.6) {
        const lob = 0.5 - 0.5 * Math.cos((k / 1.6) * TAU * 3);
        const f = 1 + 0.13 * lob * Math.sin((Math.PI * k) / 1.6);
        x *= f;
        y *= f;
      }
      return [x, y];
    };
    const fn = (u, v) => {
      const ang = u * TAU;
      const [x, y] = contorno(ang);
      const rho = Math.sin(v * Math.PI), h = Math.cos(v * Math.PI); // v = 0 afuera, 1 adentro
      // más finita atrás (en el polo no depende del ángulo: si no, quedan rajas)
      const grosor = (h > 0 ? 0.024 : 0.014) * (1 - 0.35 * Math.max(0, Math.cos(ang)) * rho);
      return marco(c, L, x * rho, Ya, y * rho, X, h * grosor);
    };
    parche(A, {
      nU: 22, nV: 4, fn, ref: () => c,
      color: (u, v) => {
        const ang = u * TAU, rho = Math.sin(v * Math.PI);
        const cl = Math.cos(ang) * rho, sl = Math.sin(ang) * rho;
        let col = mezcla(C.ala, C.punta, suave(0.25, 0.95, cl) * (0.6 + 0.4 * suave(0.3, -0.5, sl))); // plumas largas más oscuras
        col = mezcla(col, C.panza, 0.35 * suave(0.4, 0.95, sl) * suave(0.6, -0.2, cl)); // borde de arriba claro
        return mezcla(col, C.panza, 0.5 * suave(0.4, 0.8, v)); // por dentro, más clarita
      },
      uv: (u, v, p) => {
        const q = res(p, S);
        return [pto(q, L) * 5, clamp(0.62 + pto(q, Ya) * 2.3, T0, 1)];
      },
      hueso: () => H[s < 0 ? 'alaI' : 'alaD'],
    });
  }

  // --- cola: abanico de cuatro plumas redondeadas hacia arriba y atrás; las
  // plumas se alternan a cada lado y se abren un poco (de atrás se ve una V) ---
  const PLUMAS_COLA = [
    // [ángulo desde la vertical hacia atrás, lado, largo, ancho]
    [0.12, 1, 0.084, 0.033],
    [0.42, -1, 0.092, 0.036],
    [0.74, 1, 0.088, 0.036],
    [1.04, -1, 0.074, 0.032],
  ];
  for (const [ang, lado, largo, ancho] of PLUMAS_COLA) {
    const D = [0, Math.cos(ang), Math.sin(ang)];
    // grosor: hacia su lado y un poco para atrás
    const Tt = uni([lado * Math.cos(0.4), -Math.sin(ang) * Math.sin(0.4), Math.cos(ang) * Math.sin(0.4)]);
    const W = uni(cruz(Tt, D));
    const c = marco([lado * 0.011, COLA_P[1], COLA_P[2]], D, largo * 0.78, W, 0);
    const fn = (u, v) => {
      const th = u * TAU, ph = v * Math.PI;
      const rho = Math.sin(ph), dl = -Math.cos(ph);
      const dt = rho * Math.sin(th), dw = rho * Math.cos(th);
      const curva = 0.012 * (dl + 1) * (dl + 1) * 0.25; // la punta se curva para atrás
      const afina = 1 - 0.3 * suave(0.2, -1, dl); // la base más angosta
      return marco(c, D, dl * largo, W, dw * ancho * afina - curva, Tt, dt * 0.012);
    };
    parche(A, {
      nU: 8, nV: 5, fn, ref: () => c,
      color: (u, v) => mezcla(C.cola, C.colaPunta, suave(0.6, 1, v)),
      uv: (u, v, p) => {
        const q = res(p, c);
        return [0.5 + pto(q, W) * 5, clamp(0.6 + pto(q, D) * 2.3, T0, 1)];
      },
      hueso: () => H.cola,
    });
  }

  // --- patas: muslo de plumas, canilla amarilla y cuatro dedos ---
  for (const s of [-1, 1]) {
    const hip = [s * CADERA[0], CADERA[1], CADERA[2]];
    const garron = [hip[0], hip[1] - MUSLO, hip[2]];
    const tobillo = [hip[0], hip[1] - MUSLO - CANILLA, hip[2]];
    const lado = s < 0 ? 'I' : 'D';
    huso(A, {
      a: hip, b: garron, r0: 0.036, r1: 0.017, expo: 0.6, nU: 7, nV: 5, arriba: [0, 0, 1],
      color: () => C.muslo,
      uv: (u, v) => [u, 0.35 + 0.15 * v],
      h: H['muslo' + lado],
    });
    huso(A, {
      a: garron, b: tobillo, r0: 0.0115, r1: 0.0105, expo: 0.45, nU: 6, nV: 4, arriba: [0, 0, 1],
      color: () => C.pata,
      h: H['canilla' + lado],
    });
    const DEDOS = [
      [-0.5, 0.046], [0, 0.054], [0.5, 0.046], // adelante (ángulo, largo)
      [Math.PI, 0.024],
    ];
    for (const [ang, largo] of DEDOS) {
      const dir = [Math.sin(ang) * s, 0, -Math.cos(ang)];
      const punta = sum(tobillo, sum(por(dir, largo), [0, ang === Math.PI ? -0.004 : -0.009, 0]));
      huso(A, {
        a: sum(tobillo, por(dir, 0.004)), b: punta, r0: 0.0075, r1: 0.0045, expo: 0.55, nU: 4, nV: 3,
        color: (t) => mezcla(C.pata, C.dedo, t),
        h: H['pie' + lado],
      });
    }
  }

  return aGeometria(THREE, A);
}

// =============================================================================
// 6. Recursos compartidos: geometría y material por variante; la textura de
// emisión (el brillito de los ojos) es una sola para todas.
// =============================================================================
// Textura de plumitas (64×128): arriba, filas de plumas como escamas (la
// punta para abajo, la fila de arriba tapa la base de la de abajo); abajo, una
// franja blanca lisa para las piezas sin plumas.
function pintarPlumas(patron) {
  const W = 64, HT = 128, ALTO = 112;
  const cv = crearCanvas(W, HT);
  if (!cv) return null;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, HT);
  const filas = 14, porFila = 6, an = W / porFila, al = ALTO / filas;
  g.save();
  g.beginPath();
  g.rect(0, 0, W, ALTO);
  g.clip();
  for (let f = filas; f >= -1; f--) {
    const cy = f * al;
    const off = (f & 1) * an * 0.5;
    for (let k = -1; k <= porFila; k++) {
      const kk = ((k % porFila) + porFila) % porFila; // así la textura se repite sin costura
      pluma(g, k * an + off + an * 0.5, cy, an, al, patron, hash2(f + 3, kk + 11 * patron));
    }
  }
  g.restore();
  return cv;
}
function pluma(g, cx, cy, an, al, patron, rv) {
  const rx = an * 0.62, ry = al * 1.12;
  const elipse = (x, y, a, b) => {
    g.beginPath();
    g.ellipse(x, y, a, b, 0, 0, TAU);
  };
  // cada pluma: más oscura en la base (la tapa la de arriba) y clara en la punta
  const k = [0.07, 0.15, 0.08][patron] * (0.8 + 0.4 * rv);
  const grd = g.createLinearGradient(0, cy - ry * 0.2, 0, cy + ry);
  const osc = Math.round(255 * (1 - k));
  grd.addColorStop(0, `rgb(${osc},${osc},${osc})`);
  grd.addColorStop(0.75, '#ffffff');
  grd.addColorStop(1, `rgb(${Math.round(255 * (1 - k * 0.35))},${Math.round(255 * (1 - k * 0.35))},${Math.round(255 * (1 - k * 0.35))})`);
  elipse(cx, cy, rx, ry);
  g.fillStyle = grd;
  g.fill();
  if (patron === 2) {
    // moteada: una medialuna negra cerca de la punta (algunas plumas, casi negras)
    const negra = rv < 0.22;
    g.fillStyle = '#3b393e';
    elipse(cx, cy + al * 0.42, rx * 0.78, ry * (negra ? 0.58 : 0.4));
    g.fill();
    g.fillStyle = '#ffffff';
    elipse(cx, cy + al * (negra ? 0.02 : 0.2), rx * 0.82, ry * 0.42);
    g.fill();
  }
}
function pintarEmision() {
  const cv = crearCanvas(64, 128);
  if (!cv) return null;
  const g = cv.getContext('2d');
  g.fillStyle = '#000000';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#ffffff';
  g.fillRect(48, 112, 16, 16);
  return cv;
}

const CACHE = { geo: [], mat: [], emision: undefined };
let instancias = 0;

function textura(THREE, cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

function recursos(THREE, vi) {
  if (!CACHE.geo[vi]) CACHE.geo[vi] = armarGallina(THREE, vi);
  if (!CACHE.mat[vi]) {
    if (CACHE.emision === undefined) {
      const cv = pintarEmision();
      CACHE.emision = cv ? textura(THREE, cv) : null;
    }
    const cv = pintarPlumas(VARIANTES[vi].patron);
    const opciones = { vertexColors: true };
    if (cv) opciones.map = textura(THREE, cv);
    if (CACHE.emision) Object.assign(opciones, { emissive: 0xffffff, emissiveMap: CACHE.emision, emissiveIntensity: 0.9 });
    CACHE.mat[vi] = new THREE.MeshLambertMaterial(opciones);
  }
  return { geo: CACHE.geo[vi], mat: CACHE.mat[vi] };
}

function indiceVariante(v) {
  if (typeof v === 'string') {
    const i = info.variants.indexOf(v);
    return i < 0 ? 0 : i;
  }
  const n = Math.floor(numero(v));
  return ((n % VARIANTES.length) + VARIANTES.length) % VARIANTES.length;
}

// =============================================================================
// 7. createModel: armado de la instancia y animación
// =============================================================================
const ACCIONES = ['idle', 'walk', 'eat', 'happy', 'scared', 'swim'];
// parámetros de pose (se mezclan con los pesos de cada acción)
const PARAM = [
  'salto', 'cuerpoY', 'cuerpoZ', 'inclina', 'rolido', 'giro', 'esponja',
  'cuello', 'cabX', 'cabY', 'cabZ', 'cabPitch', 'cabYaw', 'cabRoll', 'pico', 'mirar',
  'alaAbre', 'alaAtras', 'colaPitch', 'colaAbre', 'colaGiro',
  'ojoGrande', 'feliz', 'marcha', 'remo', 'encoge', 'suelo', 'sueloAlto',
];
const K = Object.fromEntries(PARAM.map((n, i) => [n, i]));
const NP = PARAM.length;
// la punta del pico, relativa al centro de la cabeza (para picotear sin atravesar el piso)
const PUNTA_PICO = [PICO.punta[0], PICO.punta[1], PICO.punta[2] - PICO.r1 * 0.85];
const PITCH_COME = -1.1; // la cabeza mirando al piso al picotear

export function createModel(THREE, { variant = 0 } = {}) {
  const vi = indiceVariante(variant);
  const { geo, mat } = recursos(THREE, vi);
  const r = azar(0x9e3779b9 ^ Math.imul(++instancias, 2654435761) ^ (vi * 7919));

  const root = new THREE.Group();
  root.name = 'gallina';
  const B = HUESOS.map(([n]) => {
    const b = new THREE.Bone();
    b.name = n;
    return b;
  });
  HUESOS.forEach(([, padre, p], i) => {
    const pp = padre >= 0 ? HUESOS[padre][2] : [0, 0, 0];
    B[i].position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]);
    if (padre >= 0) B[padre].add(B[i]);
  });
  B[H.cuello].rotation.order = 'YXZ';
  B[H.cabeza].rotation.order = 'YXZ';
  B[H.cola].rotation.order = 'YXZ';
  B[H.alaI].rotation.order = 'ZYX';
  B[H.alaD].rotation.order = 'ZYX';
  const malla = new THREE.SkinnedMesh(geo, mat);
  malla.name = 'gallinaMalla';
  malla.add(B[0]);
  root.add(malla);
  const inversas = HUESOS.map(([, , p]) => new THREE.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
  const esqueleto = new THREE.Skeleton(B, inversas);
  malla.bind(esqueleto, new THREE.Matrix4());
  // esfera fija generosa (saltos, alas abiertas): evita recalcular la piel en la CPU
  malla.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 0.6);
  malla.boundingBox = new THREE.Box3(new THREE.Vector3(-0.35, -0.02, -0.4), new THREE.Vector3(0.35, 0.8, 0.4));

  const base = B[H.base], cuerpo = B[H.cuerpo], cuello = B[H.cuello], cabeza = B[H.cabeza];
  const mandibula = B[H.mandibula], cresta = B[H.cresta], barbilla = B[H.barbilla];
  const ojos = [B[H.ojoI], B[H.ojoD]], iris = [B[H.irisI], B[H.irisD]], felices = [B[H.felizI], B[H.felizD]];
  const alas = [B[H.alaI], B[H.alaD]], cola = B[H.cola];
  const pivote = cuerpo.position.clone();
  const cabezaRest = cabeza.position.clone();
  const patas = [-1, 1].map((s) => {
    const l = s < 0 ? 'I' : 'D';
    return {
      s,
      muslo: B[H['muslo' + l]], canilla: B[H['canilla' + l]], pie: B[H['pie' + l]],
      cadera: new THREE.Vector3(s * CADERA[0] - PIVOTE[0], CADERA[1] - PIVOTE[1], CADERA[2] - PIVOTE[2]),
      desf: s < 0 ? 0 : 0.5,
    };
  });

  // reusables (nada de objetos nuevos por cuadro)
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();
  const P = new Float32Array(NP), Q = new Float32Array(NP);

  // estado de la instancia
  const w = Object.fromEntries(ACCIONES.map((a) => [a, 0]));
  const edad = Object.fromEntries(ACCIONES.map((a) => [a, 0]));
  let actual = null;
  const st = {
    t: 0, fase: r(), remo: r(),
    // cabeceo a saltitos: hacia dónde mira ahora y cuándo cambia
    sal: { yaw: 0, pitch: 0, roll: 0, z: 0, tYaw: 0, tPitch: 0, tRoll: 0, tZ: 0, prox: 0.3 + r() * 0.6 },
    mira: { yaw: 0, pitch: 0 }, // mirada al jugador (también a saltitos)
    parpadeo: 1.5 + r() * 2.5, parpa: 0,
    sacude: 4 + r() * 8, sacudida: -1,
    colaFlick: 2 + r() * 5, flick: -1,
    ciclo: 2.1 + r() * 0.6, // del picoteo
    desfase: r() * 10,
    cr: { a: 0, v: 0, b: 0, vb: 0 }, // cresta y barbilla (resorte)
    prevYaw: 0, prevPitch: 0, prevY: 0,
    mYaw: 0, mPitch: 0,
  };

  // --- poses de cada acción (escriben en Q) ---
  function poseIdle(Q, sa) {
    const t = st.t + st.desfase;
    Q[K.esponja] = 0.012 * Math.sin(t * 3.4);
    Q[K.cuerpoY] = -0.002 * Math.sin(t * 3.4);
    Q[K.cabYaw] = sa.yaw;
    Q[K.cabPitch] = sa.pitch;
    Q[K.cabRoll] = sa.roll;
    Q[K.cabZ] = sa.z;
    Q[K.mirar] = 1;
    // sacudida de plumas de vez en cuando
    if (st.sacudida >= 0) {
      const k = st.sacudida / 0.55;
      const env = Math.sin(Math.PI * clamp(k));
      Q[K.esponja] += 0.09 * env;
      Q[K.rolido] = 0.09 * env * Math.sin(st.sacudida * 70);
      Q[K.alaAbre] = 0.3 * env;
      Q[K.alaAtras] = 0.25 * env;
      Q[K.cabRoll] += 0.25 * env * Math.sin(st.sacudida * 70 + 1);
    }
    if (st.flick >= 0) {
      const env = Math.sin(Math.PI * clamp(st.flick / 0.35));
      Q[K.colaGiro] = 0.3 * env * Math.sin(st.flick * 45);
      Q[K.colaAbre] = 0.25 * env;
    }
  }

  function poseWalk(Q, speed) {
    const run = suave(2.2, 4.6, speed);
    const f = st.fase;
    Q[K.marcha] = 1;
    Q[K.inclina] = -0.07 - 0.2 * run;
    Q[K.cuerpoY] = -0.004 - 0.012 * run + (0.006 + 0.008 * run) * Math.cos(f * TAU * 2);
    Q[K.rolido] = 0.07 * (1 - 0.6 * run) * Math.sin(f * TAU);
    // cabeceo: la cabeza queda atrás y después se adelanta de golpe (dos por ciclo)
    const q = frac(f * 2 + 0.15);
    const bob = q < 0.68 ? q / 0.68 : 1 - (q - 0.68) / 0.32;
    Q[K.cabZ] = (bob - 0.5) * 0.034 * (1 - 0.5 * run) - 0.03 * run;
    Q[K.cabY] = -0.004 * Math.sin(bob * Math.PI) - 0.018 * run;
    Q[K.cabPitch] = 0.06 * (bob - 0.5) + 0.2 * run;
    Q[K.cuello] = -0.15 * run;
    Q[K.mirar] = 0.6;
    // corriendo: alas medio abiertas que aletean y la cola más tendida
    Q[K.alaAbre] = run * (0.38 + 0.28 * Math.sin(f * TAU * 2));
    Q[K.alaAtras] = run * 0.4;
    Q[K.colaPitch] = 0.25 * run;
    Q[K.ojoGrande] = 0.25 * run;
    Q[K.pico] = 0.2 * run;
  }

  function poseEat(Q, sa) {
    const te = edad.eat % st.ciclo;
    Q[K.inclina] = -0.42;
    Q[K.cuello] = -0.5;
    Q[K.cuerpoY] = -0.012;
    Q[K.colaPitch] = -0.1;
    Q[K.mirar] = 0.2;
    // baja, picotea varias veces, sube un poco y mira alrededor
    let suelo, alto;
    if (te < 0.22) {
      suelo = suave(0, 0.22, te);
      alto = 0.03;
    } else if (te < 1.4) {
      const k = frac((te - 0.22) / 0.26);
      suelo = 1;
      alto = 0.035 * (k < 0.35 ? 1 - k / 0.35 : suave(0.35, 1, k)); // toca el piso y rebota
    } else if (te < 1.62) {
      suelo = 1 - 0.55 * suave(1.4, 1.62, te);
      alto = 0.03;
    } else {
      suelo = 0.45;
      alto = 0.03;
      Q[K.cabYaw] = sa.yaw * 0.8;
      Q[K.cabRoll] = sa.roll;
    }
    Q[K.suelo] = suelo;
    Q[K.sueloAlto] = alto;
    // inclinación de la cabeza en el mundo (pico al piso), pasada a relativa al cuello
    const pcMundo = lerp(-0.3, PITCH_COME + 0.12 * (alto / 0.035), suave(0.3, 1, suelo));
    Q[K.cabPitch] = pcMundo - (Q[K.inclina] + Q[K.cuello]);
  }

  function poseHappy(Q) {
    const te = edad.happy;
    const t = st.t;
    Q[K.salto] = te < 0.3 ? 0.045 * Math.sin((Math.PI * te) / 0.3) : 0;
    Q[K.esponja] = 0.1 * suave(0, 0.15, te) + 0.015 * Math.sin(t * 9);
    const aleteo = 1 - 0.6 * suave(1.1, 1.8, te);
    Q[K.alaAbre] = (0.45 + 0.42 * Math.sin(te * TAU * 6.5)) * aleteo + 0.12 * (1 - aleteo);
    Q[K.alaAtras] = 0.95 * aleteo + 0.1 * (1 - aleteo);
    Q[K.colaAbre] = 0.4;
    Q[K.colaGiro] = 0.28 * Math.sin(te * TAU * 4);
    Q[K.rolido] = 0.07 * Math.sin(te * TAU * 3);
    Q[K.cabY] = 0.012;
    Q[K.cabPitch] = 0.18;
    Q[K.cabRoll] = 0.12 * Math.sin(te * TAU * 1.5);
    Q[K.feliz] = 1;
    Q[K.pico] = 0.35 * (0.5 + 0.5 * Math.sin(te * TAU * 3.2));
    Q[K.mirar] = 0.8;
  }

  function poseScared(Q) {
    const te = edad.scared;
    const DUR = 0.42;
    const k = clamp(te / DUR);
    Q[K.salto] = te < DUR ? 0.16 * Math.sin(Math.PI * k) : 0;
    Q[K.encoge] = Math.sin(Math.PI * k) * (te < DUR ? 1 : 0);
    const aire = te < DUR ? 1 : 0.4;
    Q[K.alaAbre] = (0.7 + 0.5 * Math.sin(te * TAU * 9)) * aire + 0.2 * (1 - aire);
    Q[K.alaAtras] = 1.15 * aire + 0.3 * (1 - aire);
    Q[K.inclina] = 0.15;
    Q[K.esponja] = 0.12;
    Q[K.cabY] = 0.03;
    Q[K.cabZ] = 0.015;
    Q[K.cabPitch] = 0.12;
    Q[K.ojoGrande] = 1;
    Q[K.pico] = 0.5;
    Q[K.colaPitch] = -0.25;
    Q[K.colaAbre] = 0.35;
    Q[K.mirar] = 0.3;
  }

  function poseSwim(Q, speed, sa) {
    const t = st.t + st.desfase;
    Q[K.remo] = 1;
    Q[K.inclina] = 0.12;
    Q[K.rolido] = 0.05 * Math.sin(t * 2.8);
    Q[K.cuerpoY] = 0.006 * Math.sin(t * 4.4);
    Q[K.alaAbre] = 0.2 + 0.08 * Math.sin(t * 9);
    Q[K.alaAtras] = 0.3;
    Q[K.cabY] = 0.02;
    Q[K.cabPitch] = 0.05 + sa.pitch * 0.5;
    Q[K.cabYaw] = sa.yaw * 0.7;
    Q[K.cabRoll] = sa.roll * 0.6;
    Q[K.colaPitch] = -0.2;
    Q[K.ojoGrande] = 0.2;
    Q[K.mirar] = 0.8;
    Q[K.pico] = speed > 0.1 ? 0.05 : 0;
  }

  function avanzarTimers(dt, speed, accion) {
    st.t += dt;
    for (const a of ACCIONES) edad[a] += dt;
    // fase de la marcha: frecuencia según la velocidad (paso × frecuencia = velocidad)
    const { duty, alcance } = marcha(speed);
    if (speed > 0.01) st.fase = frac(st.fase + (speed * duty) / (2 * alcance) * dt);
    st.remo = frac(st.remo + (1.8 + speed * 1.2) * dt);
    // cabeza a saltitos: cada tanto elige otra posición y va de golpe
    const sa = st.sal;
    sa.prox -= dt;
    if (sa.prox <= 0) {
      sa.prox = 0.3 + r() * (accion === 'idle' ? 1.1 : 0.7);
      sa.tYaw = (r() - 0.5) * 1.3;
      sa.tPitch = (r() - 0.4) * 0.35;
      sa.tRoll = r() < 0.4 ? (r() - 0.5) * 0.7 : 0; // inclina para mirar con un ojo
      sa.tZ = (r() - 0.5) * 0.02;
    }
    const rap = 30;
    sa.yaw = amort(sa.yaw, sa.tYaw, rap, dt);
    sa.pitch = amort(sa.pitch, sa.tPitch, rap, dt);
    sa.roll = amort(sa.roll, sa.tRoll, rap, dt);
    sa.z = amort(sa.z, sa.tZ, rap, dt);
    // parpadeo
    st.parpadeo -= dt;
    if (st.parpadeo <= 0) {
      st.parpadeo = 1.5 + r() * 3.5;
      st.parpa = 0.16;
    }
    st.parpa = Math.max(0, st.parpa - dt);
    // sacudida de plumas y coletazo (solo quieta)
    if (st.sacudida >= 0) {
      st.sacudida += dt;
      if (st.sacudida > 0.55) st.sacudida = -1;
    } else if (accion === 'idle') {
      st.sacude -= dt;
      if (st.sacude <= 0) {
        st.sacude = 6 + r() * 10;
        st.sacudida = 0;
      }
    }
    if (st.flick >= 0) {
      st.flick += dt;
      if (st.flick > 0.35) st.flick = -1;
    } else {
      st.colaFlick -= dt;
      if (st.colaFlick <= 0) {
        st.colaFlick = 2.5 + r() * 5;
        st.flick = 0;
      }
    }
  }

  // largo de paso y fracción de apoyo según la velocidad
  const _marcha = { duty: 0.6, alcance: 0.06 };
  function marcha(speed) {
    const run = suave(2.2, 4.6, speed);
    _marcha.duty = lerp(0.6, 0.38, run);
    _marcha.alcance = clamp(0.035 + 0.02 * speed, 0.035, 0.085);
    return _marcha;
  }

  // Cinemática inversa de una pata en el plano YZ (en el espacio de «base»).
  function resolverPata(pata, fy, fz, anguloPie, cierre) {
    const { muslo, canilla, pie } = pata;
    _v.copy(pata.cadera).applyMatrix4(cuerpo.matrix);
    muslo.position.copy(_v);
    const hy = _v.y, hz = _v.z;
    let dy = fy - hy, dz = fz - hz;
    let d = Math.hypot(dy, dz) || 1e-6;
    const dMax = MUSLO + CANILLA - 1e-4, dMin = Math.abs(MUSLO - CANILLA) + 0.01;
    const dc = clamp(d, dMin, dMax);
    dy *= dc / d;
    dz *= dc / d;
    d = dc;
    const uy = dy / d, uz = dz / d;
    const alfa = Math.acos(clamp((MUSLO * MUSLO + d * d - CANILLA * CANILLA) / (2 * MUSLO * d), -1, 1));
    // la rodilla (garrón) dobla para atrás (+Z)
    const ca = Math.cos(alfa), sa = Math.sin(alfa);
    const ky = (uy * ca + uz * sa) * MUSLO, kz = (uz * ca - uy * sa) * MUSLO;
    const aMuslo = Math.atan2(-kz, -ky);
    const aCanilla = Math.atan2(-(dz - kz), -(dy - ky));
    muslo.rotation.x = aMuslo;
    canilla.rotation.x = aCanilla - aMuslo;
    pie.rotation.x = anguloPie - aCanilla;
    pie.scale.set(cierre, 1, 1);
  }

  function update(dt, state = {}) {
    dt = clamp(numero(dt), 0, 0.1);
    const accion = ACCIONES.includes(state.action) ? state.action : 'idle';
    const speed = Math.max(0, numero(state.speed));
    // --- pesos de las acciones (transición de ~0,2 s) ---
    if (accion !== actual) {
      if (actual === null) {
        for (const a of ACCIONES) w[a] = a === accion ? 1 : 0;
      }
      edad[accion] = 0;
      if (accion === 'eat') edad.eat = 0;
      actual = accion;
    }
    const rap = accion === 'scared' ? 22 : 11;
    let total = 0;
    for (const a of ACCIONES) {
      w[a] = amort(w[a], a === accion ? 1 : 0, rap, dt);
      total += w[a];
    }
    avanzarTimers(dt, speed, accion);

    // --- mezcla de poses ---
    P.fill(0);
    const sa = st.sal;
    for (const a of ACCIONES) {
      const peso = w[a] / (total || 1);
      if (peso < 0.002) continue;
      Q.fill(0);
      if (a === 'idle') poseIdle(Q, sa);
      else if (a === 'walk') poseWalk(Q, speed);
      else if (a === 'eat') poseEat(Q, sa);
      else if (a === 'happy') poseHappy(Q);
      else if (a === 'scared') poseScared(Q);
      else poseSwim(Q, speed, sa);
      for (let i = 0; i < NP; i++) P[i] += Q[i] * peso;
    }

    // --- mirada al jugador (con tope), también a saltitos ---
    const lyaw = clamp(numero(state.lookYaw), -1.2, 1.2), lpitch = clamp(numero(state.lookPitch), -0.6, 0.6);
    const mi = st.mira;
    if (Math.abs(lyaw - mi.yaw) > 0.12 || Math.abs(lpitch - mi.pitch) > 0.1) {
      mi.yaw = lyaw;
      mi.pitch = lpitch;
    }
    st.mYaw = amort(st.mYaw, mi.yaw * P[K.mirar], 28, dt);
    st.mPitch = amort(st.mPitch, mi.pitch * P[K.mirar], 28, dt);

    // --- cuerpo ---
    base.position.y = P[K.salto];
    cuerpo.position.set(pivote.x, pivote.y + P[K.cuerpoY], pivote.z + P[K.cuerpoZ]);
    cuerpo.rotation.set(P[K.inclina], P[K.giro], P[K.rolido]);
    const e = P[K.esponja];
    cuerpo.scale.set(1 + e, 1 + e * 0.8, 1 + e * 0.7);
    cuerpo.updateMatrix();

    // --- cuello y cabeza ---
    cuello.rotation.set(P[K.cuello] + st.mPitch * 0.3, st.mYaw * 0.3, 0);
    cabeza.position.set(cabezaRest.x + P[K.cabX], cabezaRest.y + P[K.cabY], cabezaRest.z + P[K.cabZ]);
    let pitchCab = P[K.cabPitch] + st.mPitch * 0.7;
    if (P[K.suelo] > 0.001) {
      // al picotear: la cabeza va a un punto del piso (en el espacio del modelo)
      const pc = PITCH_COME + 0.12 * (P[K.sueloAlto] / 0.035);
      const c = Math.cos(pc), s = Math.sin(pc);
      const ty = PUNTA_PICO[1] * c - PUNTA_PICO[2] * s, tz = PUNTA_PICO[1] * s + PUNTA_PICO[2] * c;
      const yObj = 0.007 + P[K.sueloAlto] - P[K.salto] - ty;
      const zObj = -0.25 - tz;
      cuello.updateMatrix();
      base.updateMatrix();
      _m.multiplyMatrices(base.matrix, cuerpo.matrix).multiply(cuello.matrix);
      _mi.copy(_m).invert();
      _v.set(0, yObj, zObj).applyMatrix4(_mi);
      cabeza.position.lerp(_v, P[K.suelo]);
    }
    cabeza.rotation.set(pitchCab, P[K.cabYaw] + st.mYaw * 0.7, P[K.cabRoll]);
    mandibula.rotation.x = -P[K.pico] * 0.55;

    // cresta y barbilla: resorte que sigue los movimientos bruscos de la cabeza
    const ddt = Math.max(dt, 1e-4);
    const vYaw = (cabeza.rotation.y - st.prevYaw) / ddt, vPitch = (cabeza.rotation.x - st.prevPitch) / ddt;
    const vY = (cabeza.position.y - st.prevY) / ddt;
    st.prevYaw = cabeza.rotation.y;
    st.prevPitch = cabeza.rotation.x;
    st.prevY = cabeza.position.y;
    const cr = st.cr;
    const pasos = Math.ceil(dt / (1 / 60));
    const h = dt / Math.max(1, pasos);
    for (let i = 0; i < pasos; i++) {
      cr.v += (-260 * cr.a - 12 * cr.v - clamp(vYaw * 6, -60, 60)) * h;
      cr.a += cr.v * h;
      cr.vb += (-220 * cr.b - 10 * cr.vb - clamp(vPitch * 5 + vY * 60, -60, 60)) * h;
      cr.b += cr.vb * h;
    }
    cresta.rotation.set(0, 0, clamp(cr.a, -0.4, 0.4));
    barbilla.rotation.set(clamp(cr.b, -0.5, 0.5), 0, clamp(cr.a, -0.4, 0.4) * 0.8);

    // --- ojos: parpadeo, susto (grandes, pupila chica) y felices (∩ ∩) ---
    const parp = st.parpa > 0 ? 1 - Math.sin((Math.PI * st.parpa) / 0.16) * 0.92 * (1 - P[K.ojoGrande]) : 1;
    const fel = clamp(P[K.feliz]);
    const g = (1 + 0.35 * P[K.ojoGrande]) * Math.max(0.001, 1 - fel * 1.15);
    const gi = 1 - 0.42 * P[K.ojoGrande];
    for (let i = 0; i < 2; i++) {
      ojos[i].scale.set(g, Math.max(0.001, g * parp), g);
      iris[i].scale.setScalar(gi);
      felices[i].scale.setScalar(Math.max(0.001, suave(0.2, 1, fel)));
    }

    // --- alas ---
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      // primero barre hacia afuera (la cara queda mirando adelante) y después levanta
      alas[i].rotation.set(0, s * P[K.alaAtras], s * P[K.alaAbre]);
      const abre = clamp(P[K.alaAtras] / 1.1);
      alas[i].scale.set(1, 1 + 0.3 * abre, 1 + 0.18 * abre);
    }
    // --- cola ---
    cola.rotation.set(P[K.colaPitch], P[K.colaGiro], P[K.colaGiro] * 0.4);
    cola.scale.set(1 + P[K.colaAbre], 1, 1);

    // --- patas ---
    const { duty, alcance } = marcha(speed);
    const pasoK = suave(0, 0.15, speed) * P[K.marcha];
    const run = suave(2.2, 4.6, speed);
    for (const pata of patas) {
      const zN = CADERA[2] - 0.006;
      let fy = TOBILLO_Y, fz = zN, aPie = 0, cierre = 1;
      if (pasoK > 0.001) {
        const p = frac(st.fase + pata.desf);
        let oz, oy, ap, ci;
        if (p < duty) {
          const k = p / duty;
          oz = alcance * (-1 + 2 * k);
          oy = 0;
          ap = 0;
          ci = 1;
        } else {
          const k = (p - duty) / (1 - duty);
          const kk = suave(0, 1, k);
          oz = alcance * (1 - 2 * kk);
          oy = (0.03 + 0.02 * run) * Math.sin(Math.PI * k);
          // los dedos se cierran en el aire, sin clavarse en el piso
          ap = -Math.min(0.9, Math.asin(Math.min(1, oy / 0.06)));
          ci = 1 - 0.45 * Math.sin(Math.PI * k);
        }
        fz += oz * pasoK;
        fy += oy * pasoK;
        aPie += ap * pasoK;
        cierre = lerp(cierre, ci, pasoK);
      }
      const rm = P[K.remo];
      if (rm > 0.001) {
        const a = (st.remo + pata.desf) * TAU;
        fz += Math.cos(a) * 0.045 * rm;
        fy += (0.035 + 0.025 * Math.sin(a)) * rm;
        aPie += (-0.25 + 0.35 * Math.sin(a)) * rm;
        cierre = lerp(cierre, Math.sin(a) > 0 ? 1.15 : 0.6, rm);
      }
      const en = P[K.encoge];
      if (en > 0.001) {
        fy += 0.04 * en;
        fz += 0.012 * en;
        aPie -= 0.7 * en;
        cierre = lerp(cierre, 0.6, en);
      }
      resolverPata(pata, fy, fz, aPie, cierre);
    }
  }

  function dispose() {
    root.remove(malla);
    esqueleto.dispose(); // la textura de huesos es de esta instancia
  }

  // pose inicial (patas dobladas, pies en el piso); la primera acción real entra sin transición
  update(0, { action: 'idle', speed: 0, t: 0 });
  actual = null;
  return { root, update, dispose };
}
