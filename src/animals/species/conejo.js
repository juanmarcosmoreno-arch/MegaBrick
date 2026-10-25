// =============================================================================
// Conejo — un conejito redondo y orejudo para el mundo de Megabrick.
//
// El cuerpo es UNA superficie: la unión suave de varios elipsoides (tronco,
// grupa, pecho, cogote y las dos ancas), así que se lee como un solo bollo de
// pelo y no como esferas sueltas. La cabeza es otra superficie suave (cráneo,
// cachetes, puente de la nariz y las almohadillas del hocico) que se hunde en
// el cogote. Orejas largas en forma de cuchara (rosadas por dentro, con dos
// huesos cada una: se doblan y se mueven por separado), colita de algodón,
// patitas de adelante cortas y pies de atrás largos.
//
// Todo el conejo es UNA malla con esqueleto (SkinnedMesh) y un solo material
// Lambert con colores por vértice: una llamada de dibujo por conejo. La
// geometría (con los pesos de cada hueso) se arma una vez por variante y la
// comparten todas las instancias; cada conejo tiene solo sus huesos. Los ojos
// felices (^ ^) y lo blanco del ojo del susto son piezas de la misma malla que
// aparecen o se esconden escalando su hueso.
//
// El paso es a saltos: las patas de atrás empujan, el cuerpo se estira en el
// aire, las de adelante aterrizan primero y las de atrás caen al lado (todo
// con los huesos: la raíz no se toca). Mientras una pata apoya queda quieta
// contra el piso (se corre para atrás a la velocidad del conejo): no patina.
//
// No importa nada: THREE llega por parámetro.
// Ejes: mira hacia -Z, los pies apoyan en y = 0. 1 unidad = 1 bloque.
// Su izquierda es -X (sufijo I) y su derecha +X (sufijo D).
//
// Organización:
//   1. Utilidades             5. Piezas del conejo
//   2. Variantes (colores)    6. Recursos compartidos (caché por variante)
//   3. Medidas y huesos       7. createModel (armado y animación)
//   4. Armado de geometría
// =============================================================================

export const info = {
  id: 'conejo',
  name: 'Conejo',
  variants: ['gris', 'blanco', 'marrón', 'manchado'],
  size: { width: 0.35, length: 0.5, height: 0.55 }, // orejas incluidas
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
// Campana periódica (ciclo de 0 a 1) centrada en c, de ancho w.
const campana = (x, c, w) => {
  let d = x - c;
  d -= Math.round(d);
  return Math.exp(-(d * d) / (w * w));
};
// Arco 0 → 1 → 0 entre a y b (parábola), 0 afuera.
const arco = (x, a, b) => {
  if (x <= a || x >= b) return 0;
  const s = (x - a) / (b - a);
  return 4 * s * (1 - s);
};

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

// Ruido de valor 3D (manchas del conejo manchado, bultos de la cola).
function hash3(i, j, k) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function ruido3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const c = (a, b, d) => hash3(xi + a, yi + b, zi + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

// Colores: '#rrggbb' → [r, g, b] 0..1 (sRGB, para mezclar a ojo).
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mezcla = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// sRGB → lineal (los colores por vértice van lineales al shader).
const lineal = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

const largo = (x, y, z) => Math.sqrt(x * x + y * y + z * z) || 1;

// =============================================================================
// 2. Variantes: pelo, lomo (un poco más oscuro), claro (panza, hocico),
// algodón de la cola, adentro y borde de las orejas, nariz, anillo alrededor
// de los ojos y, en el manchado, el color de las manchas.
// =============================================================================
const VARIANTES = [
  // gris: gris tibio agutí, panza crema, puntas de las orejas más oscuras
  { pelo: '#8f8780', lomo: '#756d67', claro: '#e2d9cc', cola: '#f4efe7', orejaDentro: '#d9a6a2', orejaBorde: '#5e5651', nariz: '#cf8890', anillo: '#d6ccbe', boca: '#4e3a36', pata: '#b3aaa1' },
  // blanco: nube de crema con orejas rosaditas
  { pelo: '#efe9df', lomo: '#e2dace', claro: '#fbf8f2', cola: '#ffffff', orejaDentro: '#efb3b0', orejaBorde: '#ddd3c6', nariz: '#e8959c', anillo: '#f7f3ec', boca: '#9a6a68', pata: '#f4efe7' },
  // marrón: canela con panza de dulce de leche clarito
  { pelo: '#a5734d', lomo: '#8a5c3b', claro: '#e9d6b9', cola: '#f5ede0', orejaDentro: '#dca291', orejaBorde: '#6c4730', nariz: '#c9806f', anillo: '#dcc29f', boca: '#4a3024', pata: '#c4996f' },
  // manchado: blanco con orejas, antifaz y manchas chocolate
  { pelo: '#f1ece3', lomo: '#ebe4d9', claro: '#fbf8f3', cola: '#ffffff', orejaDentro: '#dba5a2', orejaBorde: '#4f403a', nariz: '#df98a0', anillo: '#55453e', boca: '#5a423b', pata: '#f4efe7', mancha: '#5a4942' },
].map((v) => Object.fromEntries(Object.entries(v).map(([k, c]) => [k, hex(c)])));
const OJO = { iris: hex('#24170f'), fondo: hex('#6a4431'), brillo: hex('#ffffff'), blanco: hex('#f6f1e8'), feliz: hex('#2a1c16'), rubor: hex('#ec9a98') };

// =============================================================================
// 3. Medidas (espacio de la raíz, en la pose de reposo) y huesos
// =============================================================================
// Cuerpo: unión suave de elipsoides { c: centro, r: semiejes, k: suavidad }.
const CUERPO_C = [0, 0.135, 0.06]; // desde acá se arma la superficie (adentro de todo)
const BULTOS_CUERPO = [
  { c: [0, 0.128, 0.035], r: [0.106, 0.106, 0.155], k: 0 }, // tronco
  { c: [0, 0.146, 0.105], r: [0.114, 0.12, 0.114], k: 0.05 }, // grupa (lo más alto)
  { c: [0, 0.112, -0.068], r: [0.08, 0.086, 0.072], k: 0.045 }, // pecho
  { c: [0, 0.193, -0.084], r: [0.066, 0.062, 0.058], k: 0.05 }, // cogote (se une con la cabeza)
  { c: [-0.088, 0.094, 0.112], r: [0.062, 0.088, 0.1], k: 0.014 }, // anca izquierda
  { c: [0.088, 0.094, 0.112], r: [0.062, 0.088, 0.1], k: 0.014 }, // anca derecha
];
const PISO_CUERPO = 0.018; // la panza se aplana un poco contra el piso

// Cabeza (relativa a su centro CABEZA_C).
const CABEZA_C = [0, 0.255, -0.135];
const BULTOS_CABEZA = [
  { c: [0, 0.012, 0.008], r: [0.088, 0.082, 0.094], k: 0 }, // cráneo
  { c: [-0.042, -0.028, -0.03], r: [0.054, 0.047, 0.055], k: 0.03 }, // cachete izquierdo
  { c: [0.042, -0.028, -0.03], r: [0.054, 0.047, 0.055], k: 0.03 }, // cachete derecho
  { c: [0, -0.004, -0.058], r: [0.044, 0.048, 0.05], k: 0.03 }, // puente de la nariz
  { c: [-0.017, -0.032, -0.086], r: [0.025, 0.021, 0.022], k: 0.02 }, // almohadilla izquierda
  { c: [0.017, -0.032, -0.086], r: [0.025, 0.021, 0.022], k: 0.02 }, // almohadilla derecha
  { c: [0, -0.054, -0.066], r: [0.02, 0.015, 0.018], k: 0.015 }, // mentón
];
// Rasgos de la cara: dirección desde el centro de la cabeza (la izquierda en -X).
const DIR_OJO = [0.57, 0.2, -0.8]; // el derecho; el izquierdo, espejado
const OJO_A = 0.024, OJO_B = 0.028, OJO_H = 0.0085; // semiancho, semialto y cuánto abomba
const NARIZ_P = [0, -0.012, -0.107]; // relativa a la cabeza (se proyecta a la superficie)
const RUBOR_P = [0.058, -0.04, -0.062];

// Orejas: base (relativa a la cabeza), largo y ángulos de reposo.
const OREJA_BASE = [0.034, 0.072, 0.022];
const OREJA_L = 0.215;
const OREJA_REPOSO = { atras: 0.22, gira: 0.3, abre: 0.2 }; // x, y, z (orden ZXY)
const OREJA_PUNTA = 0.095; // dónde dobla (a lo largo de la oreja)

// Cola de algodón.
const COLA_C = [0, 0.168, 0.222], COLA_R = 0.042;
// Patas de adelante: hombro (adentro del pecho) y mano (centro de la manito).
const HOMBRO = [0.042, 0.1, -0.088];
const MANO = [0.045, 0.016, -0.118];
// Patas de atrás: rodilla (adentro del anca), talón (pivote del pie) y pie.
const RODILLA = [0.08, 0.08, 0.125];
const TALON = [0.086, 0.03, 0.165];
const PIE_X = 0.086;
const PIE_LARGO = 0.165; // del talón a la punta (la parte que apoya)

// Huesos: nombre, padre y posición de reposo (espacio de la raíz).
const HUESOS = [
  ['raiz', -1, [0, 0, 0]],
  ['cuerpo', 0, [0, 0.12, 0.05]],
  ['pecho', 1, [0, 0.14, -0.045]],
  ['cadera', 1, [0, 0.14, 0.12]],
  ['cabeza', 2, [0, 0.215, -0.09]],
  ['orejaI', 4, null], // posiciones de orejas y ojos: se calculan
  ['puntaI', 5, null],
  ['orejaD', 4, null],
  ['puntaD', 7, null],
  ['ojoI', 4, null],
  ['ojoD', 4, null],
  ['felizI', 4, null],
  ['felizD', 4, null],
  ['sustoI', 9, null],
  ['sustoD', 10, null],
  ['nariz', 4, null],
  ['cola', 3, COLA_C],
  ['manoI', 0, [-MANO[0], MANO[1], MANO[2]]],
  ['manoD', 0, MANO],
  ['pieI', 0, [-TALON[0], TALON[1], TALON[2]]],
  ['pieD', 0, TALON],
];
const H = Object.fromEntries(HUESOS.map((h, i) => [h[0], i]));

// --- superficies implícitas (distancia con signo aproximada) ---
function elipsoide(x, y, z, c, r) {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / r[0], qy = py / r[1], qz = pz / r[2];
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1e-9;
  return (k0 * (k0 - 1)) / k1;
}
// Unión suave (polinómica).
function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
function smax(a, b, k) {
  return -smin(-a, -b, k);
}
function sdfBultos(bultos, x, y, z, ox = 0, oy = 0, oz = 0) {
  let d = 1e9;
  for (const b of bultos) {
    const e = elipsoide(x - ox, y - oy, z - oz, b.c, b.r);
    d = d > 1e8 ? e : smin(d, e, b.k);
  }
  return d;
}
const sdfCuerpo = (x, y, z) => smax(sdfBultos(BULTOS_CUERPO, x, y, z), PISO_CUERPO - y, 0.03);
const sdfCabeza = (x, y, z) => sdfBultos(BULTOS_CABEZA, x, y, z, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);

// Distancia desde el centro c hasta la superficie en la dirección d (sale
// por pasos y afina por bisección).
function radio(sdf, c, dx, dy, dz, rmax = 0.4) {
  const paso = 0.003;
  let a = 0, t = paso;
  while (t < rmax && sdf(c[0] + dx * t, c[1] + dy * t, c[2] + dz * t) <= 0) {
    a = t;
    t += paso;
  }
  let b = Math.min(t, rmax);
  for (let i = 0; i < 18; i++) {
    const m = (a + b) * 0.5;
    if (sdf(c[0] + dx * m, c[1] + dy * m, c[2] + dz * m) > 0) b = m;
    else a = m;
  }
  return (a + b) * 0.5;
}
function gradiente(sdf, x, y, z, out, e = 0.0012) {
  out[0] = sdf(x + e, y, z) - sdf(x - e, y, z);
  out[1] = sdf(x, y + e, z) - sdf(x, y - e, z);
  out[2] = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = largo(out[0], out[1], out[2]);
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
}
// Punto de la superficie de la cabeza en la dirección de p (desde su centro),
// separado «afuera» metros, y su normal.
const _g = [0, 0, 0];
function sobreCabeza(px, py, pz, afuera, outP, outN) {
  let dx = px - CABEZA_C[0], dy = py - CABEZA_C[1], dz = pz - CABEZA_C[2];
  const l = largo(dx, dy, dz);
  dx /= l;
  dy /= l;
  dz /= l;
  const r = radio(sdfCabeza, CABEZA_C, dx, dy, dz, 0.2);
  const x = CABEZA_C[0] + dx * r, y = CABEZA_C[1] + dy * r, z = CABEZA_C[2] + dz * r;
  gradiente(sdfCabeza, x, y, z, _g);
  outN[0] = _g[0];
  outN[1] = _g[1];
  outN[2] = _g[2];
  outP[0] = x + _g[0] * afuera;
  outP[1] = y + _g[1] * afuera;
  outP[2] = z + _g[2] * afuera;
  return outP;
}
// Marco de un rasgo de la cara: centro sobre la piel, normal (N), arriba (U) y costado (X).
function marcoCara(dir) {
  const l = largo(dir[0], dir[1], dir[2]);
  const P = [0, 0, 0], N = [0, 0, 0];
  sobreCabeza(CABEZA_C[0] + dir[0] / l, CABEZA_C[1] + dir[1] / l, CABEZA_C[2] + dir[2] / l, 0, P, N);
  // U = arriba proyectado sobre el plano tangente; X = U × N
  let ux = -N[1] * N[0], uy = 1 - N[1] * N[1], uz = -N[1] * N[2];
  const lu = largo(ux, uy, uz);
  ux /= lu;
  uy /= lu;
  uz /= lu;
  const X = [uy * N[2] - uz * N[1], uz * N[0] - ux * N[2], ux * N[1] - uy * N[0]];
  return { P, N, U: [ux, uy, uz], X };
}

// Posiciones calculadas (orejas, ojos, nariz) y reposo de cada hueso.
let MEDIDAS = null;
function medidas() {
  if (MEDIDAS) return MEDIDAS;
  const ojos = [-1, 1].map((s) => marcoCara([s * DIR_OJO[0], DIR_OJO[1], DIR_OJO[2]]));
  const nP = [0, 0, 0], nN = [0, 0, 0];
  sobreCabeza(CABEZA_C[0] + NARIZ_P[0], CABEZA_C[1] + NARIZ_P[1], CABEZA_C[2] + NARIZ_P[2], 0, nP, nN);
  const orejas = [-1, 1].map((s) => ({
    s,
    base: [CABEZA_C[0] + s * OREJA_BASE[0], CABEZA_C[1] + OREJA_BASE[1], CABEZA_C[2] + OREJA_BASE[2]],
    rot: [OREJA_REPOSO.atras, -s * OREJA_REPOSO.gira, -s * OREJA_REPOSO.abre],
  }));
  MEDIDAS = { ojos, nariz: { P: nP, N: nN }, orejas };
  return MEDIDAS;
}

// =============================================================================
// 4. Armado de geometría: posiciones, normales, colores y pesos de huesos
// =============================================================================
function crearArmado() {
  return { p: [], n: [], c: [], si: [], sw: [], i: [], nv: 0 };
}
// piel: [hueso, peso, hueso, peso, …] (hasta 4; se normaliza)
function vertice(A, x, y, z, nx, ny, nz, col, piel) {
  A.p.push(x, y, z);
  const l = largo(nx, ny, nz);
  A.n.push(nx / l, ny / l, nz / l);
  A.c.push(lineal(col[0]), lineal(col[1]), lineal(col[2]));
  let suma = 0;
  for (let k = 1; k < piel.length; k += 2) suma += piel[k];
  for (let k = 0; k < 4; k++) {
    A.si.push(k * 2 < piel.length ? piel[k * 2] : 0);
    A.sw.push(k * 2 < piel.length ? piel[k * 2 + 1] / (suma || 1) : 0);
  }
  return A.nv++;
}
// Normales promediando las caras (para las piezas que no son implícitas).
function normalesPorCaras(A, desde, hasta, i0) {
  const acc = new Float64Array((hasta - desde) * 3);
  for (let t = i0; t < A.i.length; t += 3) {
    const a = A.i[t], b = A.i[t + 1], c = A.i[t + 2];
    if (a < desde || b < desde || c < desde) continue;
    const ax = A.p[a * 3], ay = A.p[a * 3 + 1], az = A.p[a * 3 + 2];
    const e1x = A.p[b * 3] - ax, e1y = A.p[b * 3 + 1] - ay, e1z = A.p[b * 3 + 2] - az;
    const e2x = A.p[c * 3] - ax, e2y = A.p[c * 3 + 1] - ay, e2z = A.p[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      acc[(v - desde) * 3] += nx;
      acc[(v - desde) * 3 + 1] += ny;
      acc[(v - desde) * 3 + 2] += nz;
    }
  }
  for (let v = desde; v < hasta; v++) {
    const k = (v - desde) * 3;
    const l = largo(acc[k], acc[k + 1], acc[k + 2]);
    if (l < 1e-12) continue;
    A.n[v * 3] = acc[k] / l;
    A.n[v * 3 + 1] = acc[k + 1] / l;
    A.n[v * 3 + 2] = acc[k + 2] / l;
  }
}
// Triángulo con la cara hacia afuera (según un punto de adentro).
function triAfuera(A, a, b, c, cx, cy, cz) {
  const ax = A.p[a * 3], ay = A.p[a * 3 + 1], az = A.p[a * 3 + 2];
  const e1x = A.p[b * 3] - ax, e1y = A.p[b * 3 + 1] - ay, e1z = A.p[b * 3 + 2] - az;
  const e2x = A.p[c * 3] - ax, e2y = A.p[c * 3 + 1] - ay, e2z = A.p[c * 3 + 2] - az;
  const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
  if (nx * (ax - cx) + ny * (ay - cy) + nz * (az - cz) >= 0) A.i.push(a, b, c);
  else A.i.push(a, c, b);
}

// Direcciones de una esfera hecha de un cubo (6 caras de n×n, ángulos parejos).
const CUBOS = new Map();
function cuboEsfera(n) {
  if (CUBOS.has(n)) return CUBOS.get(n);
  const dirs = [], tris = [];
  const caras = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [N, U, V] of caras) {
    const base = dirs.length;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const a = Math.tan((i / n - 0.5) * (Math.PI / 2)), b = Math.tan((j / n - 0.5) * (Math.PI / 2));
        const x = N[0] + U[0] * a + V[0] * b, y = N[1] + U[1] * a + V[1] * b, z = N[2] + U[2] * a + V[2] * b;
        const l = largo(x, y, z);
        dirs.push([x / l, y / l, z / l]);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        tris.push([a, b, d], [a, d, c]);
      }
    }
  }
  const r = { dirs, tris };
  CUBOS.set(n, r);
  return r;
}

// Superficie implícita armada «en estrella» desde un centro (con normales del gradiente).
function piezaImplicita(A, sdf, C, n, colorDe, pielDe, rmax = 0.4) {
  const { dirs, tris } = cuboEsfera(n);
  const base = A.nv;
  const g = [0, 0, 0];
  for (const d of dirs) {
    const r = radio(sdf, C, d[0], d[1], d[2], rmax);
    const x = C[0] + d[0] * r, y = C[1] + d[1] * r, z = C[2] + d[2] * r;
    gradiente(sdf, x, y, z, g);
    vertice(A, x, y, z, g[0], g[1], g[2], colorDe(x, y, z, g), pielDe(x, y, z));
  }
  for (const t of tris) triAfuera(A, base + t[0], base + t[1], base + t[2], C[0], C[1], C[2]);
}

// Tubo por una lista de puntos [x, y, z, radio]; color y piel según la
// fracción del largo (0..1). Con tapas redondeadas si se pide.
function tubo(A, pts, nSeg, colorDe, pielDe, tapas = false) {
  const n = pts.length;
  const base = A.nv, i0 = A.i.length;
  let rx = 0, ry = 1, rz = 0; // referencia para armar los anillos
  const anillos = [];
  for (let k = 0; k < n; k++) {
    const p = pts[k];
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const lt = largo(tx, ty, tz);
    tx /= lt;
    ty /= lt;
    tz /= lt;
    if (Math.abs(tx * rx + ty * ry + tz * rz) > 0.9) [rx, ry, rz] = Math.abs(tx) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    // e1 = ref × t, e2 = t × e1
    let e1x = ry * tz - rz * ty, e1y = rz * tx - rx * tz, e1z = rx * ty - ry * tx;
    const l1 = largo(e1x, e1y, e1z);
    e1x /= l1;
    e1y /= l1;
    e1z /= l1;
    const e2x = ty * e1z - tz * e1y, e2y = tz * e1x - tx * e1z, e2z = tx * e1y - ty * e1x;
    [rx, ry, rz] = [e2x, e2y, e2z];
    const s = k / (n - 1);
    const anillo = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * TAU;
      const cx = Math.cos(ang), cy = Math.sin(ang);
      const nx = e1x * cx + e2x * cy, ny = e1y * cx + e2y * cy, nz = e1z * cx + e2z * cy;
      const x = p[0] + nx * p[3], y = p[1] + ny * p[3], z = p[2] + nz * p[3];
      anillo.push(vertice(A, x, y, z, nx, ny, nz, colorDe(s, x, y, z), pielDe(s, x, y, z)));
    }
    anillos.push({ anillo, tx, ty, tz });
  }
  for (let k = 0; k < n - 1; k++) {
    const r0 = anillos[k].anillo, r1 = anillos[k + 1].anillo;
    for (let j = 0; j < nSeg; j++) {
      const a = r0[j], b = r0[(j + 1) % nSeg], c = r1[j], d = r1[(j + 1) % nSeg];
      A.i.push(a, d, c, a, b, d);
    }
  }
  if (tapas) {
    for (const [k, sg] of [[0, -1], [n - 1, 1]]) {
      const { anillo, tx, ty, tz } = anillos[k];
      const p = pts[k];
      const x = p[0] + tx * sg * p[3] * 0.6, y = p[1] + ty * sg * p[3] * 0.6, z = p[2] + tz * sg * p[3] * 0.6;
      const s = k / (n - 1);
      const c = vertice(A, x, y, z, tx * sg, ty * sg, tz * sg, colorDe(s, x, y, z), pielDe(s, x, y, z));
      for (let j = 0; j < nSeg; j++) {
        const a = anillo[j], b = anillo[(j + 1) % nSeg];
        if (sg > 0) A.i.push(a, b, c);
        else A.i.push(b, a, c);
      }
    }
  }
  // normales suaves de verdad (los extremos de los anillos quedan bien)
  if (tapas) normalesPorCaras(A, base, A.nv, i0);
}

// Cápsula a lo largo de un eje: puntos [x, y, z, rx, ry] con sección elíptica
// (rx de costado, ry para arriba; abajo un poco más chata). Un punto con radio
// 0 en las puntas la cierra. Normales promediando caras.
function capsula(A, pts, nSeg, colorDe, pielDe) {
  const base = A.nv, i0 = A.i.length;
  const filas = [];
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const lt = largo(tx, ty, tz);
    tx /= lt;
    ty /= lt;
    tz /= lt;
    // costado = t × arriba; arriba' = costado × t
    let sx = -tz, sy = 0, sz = tx;
    const ls = largo(sx, sy, sz);
    sx /= ls;
    sz /= ls;
    const ux = sy * tz - sz * ty, uy = sz * tx - sx * tz, uz = sx * ty - sy * tx;
    if (p[3] === 0) {
      filas.push([vertice(A, p[0], p[1], p[2], tx, ty, tz, colorDe(p[0], p[1], p[2]), pielDe(p[0], p[1], p[2]))]);
      continue;
    }
    const fila = [];
    for (let j = 0; j < nSeg; j++) {
      const ang = (j / nSeg) * TAU;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const ry = p[4] * (sn < 0 ? 0.85 : 1);
      const x = p[0] + sx * p[3] * c + ux * ry * sn, y = p[1] + sy * p[3] * c + uy * ry * sn, z = p[2] + sz * p[3] * c + uz * ry * sn;
      fila.push(vertice(A, x, y, z, 0, 1, 0, colorDe(x, y, z), pielDe(x, y, z)));
    }
    filas.push(fila);
  }
  for (let k = 0; k < filas.length - 1; k++) {
    const f0 = filas[k], f1 = filas[k + 1];
    const cx = (pts[k][0] + pts[k + 1][0]) / 2, cy = (pts[k][1] + pts[k + 1][1]) / 2, cz = (pts[k][2] + pts[k + 1][2]) / 2;
    for (let j = 0; j < nSeg; j++) {
      const a = f0[f0.length === 1 ? 0 : j], b = f0[f0.length === 1 ? 0 : (j + 1) % nSeg];
      const c = f1[f1.length === 1 ? 0 : j], d = f1[f1.length === 1 ? 0 : (j + 1) % nSeg];
      if (f0.length > 1) triAfuera(A, a, b, d, cx, cy, cz);
      if (f1.length > 1) triAfuera(A, a, d, c, cx, cy, cz);
    }
  }
  normalesPorCaras(A, base, A.nv, i0);
}

// «Calcomanía» abombada sobre la cabeza (ojo, nariz): una cúpula elíptica
// que sigue la curva de la piel. forma(x, y) deforma el contorno (−1..1).
function cupula(A, F, a, b, h, anillos, segs, colorDe, piel, forma = null, sobre = 0.0006) {
  const base = A.nv, i0 = A.i.length;
  const P = [0, 0, 0], N = [0, 0, 0];
  const ptos = [];
  for (let r = 0; r <= anillos; r++) {
    const rho = r / anillos;
    const cuenta = r === 0 ? 1 : segs;
    const fila = [];
    for (let s = 0; s < cuenta; s++) {
      const ang = (s / segs) * TAU;
      let lx = rho * Math.cos(ang), ly = rho * Math.sin(ang);
      if (forma) [lx, ly] = forma(lx, ly);
      const qx = F.P[0] + F.X[0] * a * lx + F.U[0] * b * ly;
      const qy = F.P[1] + F.X[1] * a * lx + F.U[1] * b * ly;
      const qz = F.P[2] + F.X[2] * a * lx + F.U[2] * b * ly;
      sobreCabeza(qx, qy, qz, 0, P, N);
      const alto = h * Math.sqrt(Math.max(0, 1 - rho * rho)) + sobre;
      const x = P[0] + N[0] * alto, y = P[1] + N[1] * alto, z = P[2] + N[2] * alto;
      fila.push(vertice(A, x, y, z, N[0], N[1], N[2], colorDe(lx, ly, rho), piel));
    }
    ptos.push(fila);
  }
  for (let r = 0; r < anillos; r++) {
    const f0 = ptos[r], f1 = ptos[r + 1];
    for (let s = 0; s < segs; s++) {
      const a0 = f0[r === 0 ? 0 : s], a1 = f0[r === 0 ? 0 : (s + 1) % segs];
      const b0 = f1[s], b1 = f1[(s + 1) % segs];
      if (r === 0) triAfuera(A, a0, b0, b1, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
      else {
        triAfuera(A, a0, b0, b1, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
        triAfuera(A, a0, b1, a1, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
      }
    }
  }
  normalesPorCaras(A, base, A.nv, i0);
}

// Anillo plano pegado a la piel de la cabeza (de rIn a rOut, en unidades del ojo).
function anilloCara(A, F, a, b, rIn, rOut, segs, colIn, colOut, piel, sobre, deforma = null) {
  const P = [0, 0, 0], N = [0, 0, 0];
  const base = A.nv;
  for (let s = 0; s < segs; s++) {
    const ang = (s / segs) * TAU;
    const k = deforma ? deforma(ang) : 1;
    for (const [rr, col] of [[rIn, colIn], [rOut * k, colOut]]) {
      const lx = rr * Math.cos(ang), ly = rr * Math.sin(ang);
      const qx = F.P[0] + F.X[0] * a * lx + F.U[0] * b * ly;
      const qy = F.P[1] + F.X[1] * a * lx + F.U[1] * b * ly;
      const qz = F.P[2] + F.X[2] * a * lx + F.U[2] * b * ly;
      sobreCabeza(qx, qy, qz, sobre, P, N);
      const c = typeof col === 'function' ? col(P[0], P[1], P[2]) : col;
      vertice(A, P[0], P[1], P[2], N[0], N[1], N[2], c, piel);
    }
  }
  for (let s = 0; s < segs; s++) {
    const a0 = base + s * 2, a1 = a0 + 1, b0 = base + ((s + 1) % segs) * 2, b1 = b0 + 1;
    triAfuera(A, a0, a1, b1, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
    triAfuera(A, a0, b1, b0, CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
  }
}

// Trazo (tubito) pegado a la piel de la cabeza: puntos en el marco F (x, y en
// unidades a/b del rasgo) o en el espacio de la cabeza.
function trazoCara(A, ptsLocales, radioT, sobre, colorT, piel, lados = 4) {
  const P = [0, 0, 0], N = [0, 0, 0];
  const pts = ptsLocales.map(([x, y, z], k) => {
    sobreCabeza(x, y, z, sobre, P, N);
    const s = k / (ptsLocales.length - 1);
    const afinar = 0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.7 * s));
    return [P[0], P[1], P[2], radioT * afinar];
  });
  tubo(A, pts, lados, () => colorT, () => piel, true);
}

function aGeometria(THREE, A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.c, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.sw, 4));
  g.setIndex(A.nv > 65535 ? new THREE.Uint32BufferAttribute(A.i, 1) : new THREE.Uint16BufferAttribute(A.i, 1));
  g.computeBoundingSphere();
  return g;
}

// =============================================================================
// 5. Piezas del conejo
// =============================================================================
// Manchas del conejo manchado (0 = blanco, 1 = mancha): pocas, grandes y
// redondas (con el borde apenas irregular), para que se lean de lejos.
const MANCHAS = [
  { c: [0.0, 0.26, 0.11], r: [0.085, 0.06, 0.085] }, // montura en la grupa
  { c: [0.12, 0.15, 0.07], r: [0.04, 0.045, 0.05] },
  { c: [0.1, 0.11, 0.175], r: [0.035, 0.04, 0.035] },
  { c: [-0.12, 0.17, 0.125], r: [0.045, 0.05, 0.05] },
  { c: [-0.105, 0.13, -0.01], r: [0.03, 0.035, 0.035] },
  { c: [0.05, 0.215, -0.045], r: [0.035, 0.03, 0.035] },
];
function manchas(x, y, z) {
  let m = 0;
  const borde = 0.12 * (ruido3(x * 60, y * 60, z * 60) - 0.5);
  for (const M of MANCHAS) {
    const d = Math.hypot((x - M.c[0]) / M.r[0], (y - M.c[1]) / M.r[1], (z - M.c[2]) / M.r[2]) + borde;
    m = Math.max(m, suave(1, 0.8, d));
  }
  return m;
}

function colorCuerpo(V, x, y, z, n) {
  let c = mezcla(V.pelo, V.lomo, suave(0.17, 0.27, y) * 0.8);
  // panza y pechera clara
  const panza = Math.max(suave(0.075, 0.035, y) * suave(-0.2, 0.1, -n[1]), suave(-0.08, -0.13, z) * suave(0.2, 0.12, y));
  c = mezcla(c, V.claro, clamp(panza) * 0.85);
  if (V.mancha) c = mezcla(c, V.mancha, manchas(x, y, z) * (1 - panza));
  return c;
}
function colorCabeza(V, x, y, z) {
  const lx = x - CABEZA_C[0], ly = y - CABEZA_C[1], lz = z - CABEZA_C[2];
  let c = mezcla(V.pelo, V.lomo, suave(0.03, 0.09, ly) * suave(-0.04, 0.06, lz) * 0.7);
  // hocico y mentón claros
  const hocico = suave(0.05, 0.025, Math.hypot(lx * 0.8, (ly + 0.034) * 1.1, lz + 0.085)) + suave(-0.035, -0.06, ly) * suave(-0.02, -0.06, lz);
  c = mezcla(c, V.claro, clamp(hocico) * 0.9);
  // rubor en los cachetes
  const r = Math.min(Math.hypot(lx - RUBOR_P[0], ly - RUBOR_P[1], lz - RUBOR_P[2]), Math.hypot(lx + RUBOR_P[0], ly - RUBOR_P[1], lz - RUBOR_P[2]));
  c = mezcla(c, OJO.rubor, suave(0.028, 0.008, r) * 0.38);
  if (V.mancha) {
    // «mariposa» sobre la nariz
    const mar = suave(0.034, 0.024, Math.hypot(Math.abs(lx) * 0.9 - 0.012, ly + 0.002, (lz + 0.08) * 0.8)) * suave(-0.03, -0.012, ly);
    c = mezcla(c, V.mancha, mar);
  }
  return c;
}

function armarConejo(THREE, vi) {
  const V = VARIANTES[vi];
  const M = medidas();
  const A = crearArmado();
  const _n = [0, 0, 0];

  // --- cuerpo: adelante sigue al pecho, atrás a la cadera; el cogote a la cabeza ---
  piezaImplicita(
    A, sdfCuerpo, CUERPO_C, 7,
    (x, y, z, n) => colorCuerpo(V, x, y, z, n),
    (x, y, z) => {
      const cab = 0.85 * suave(0.17, 0.235, y) * suave(-0.03, -0.1, z);
      const fr = suave(0.09, -0.05, z);
      return [H.pecho, fr * (1 - cab), H.cadera, (1 - fr) * (1 - cab), H.cabeza, cab];
    },
  );

  // --- cabeza (las almohadillas del hocico se mueven con la nariz) ---
  const NZ = M.nariz.P;
  piezaImplicita(
    A, sdfCabeza, CABEZA_C, 7,
    (x, y, z) => colorCabeza(V, x, y, z),
    (x, y, z) => {
      const wn = 0.8 * suave(0.05, 0.018, Math.hypot(x - NZ[0], (y - NZ[1]) * 1.2, z - NZ[2]));
      return [H.cabeza, 1 - wn, H.nariz, wn];
    },
    0.2,
  );

  // --- ojos: anillo de pelo, cúpula oscura brillosa, brillitos, blanco del susto y ^ ^ ---
  M.ojos.forEach((F, i) => {
    const hOjo = i === 0 ? H.ojoI : H.ojoD;
    const hFel = i === 0 ? H.felizI : H.felizD;
    const hSus = i === 0 ? H.sustoI : H.sustoD;
    const s = i === 0 ? -1 : 1; // lado
    // anillo claro (o antifaz oscuro en el manchado), fundido con el pelo
    anilloCara(
      A, F, OJO_A, OJO_B, 0.85, V.mancha ? 1.75 : 1.45, 12,
      V.anillo, (x, y, z) => (V.mancha ? mezcla(V.anillo, colorCabeza(V, x, y, z), 0.35) : colorCabeza(V, x, y, z)),
      [H.cabeza, 1], 0.0016,
      V.mancha ? (ang) => 1 + 0.18 * Math.cos(ang * 2 + 0.6 * s) + 0.1 * Math.sin(ang * 3) : null,
    );
    // blanco del ojo (asustado): se esconde escalando su hueso
    anilloCara(A, F, OJO_A, OJO_B, 0.8, 1.32, 12, OJO.blanco, OJO.blanco, [hSus, 1], 0.0032);
    // el ojo: oscuro con un reflejo tibio abajo
    cupula(
      A, F, OJO_A, OJO_B, OJO_H, 3, 12,
      (lx, ly, rho) => mezcla(OJO.iris, OJO.fondo, suave(-0.15, -0.95, ly) * 0.75 * suave(1.0, 0.55, rho * 0.7)),
      [hOjo, 1], null, 0.0032,
    );
    // brillitos: uno grande arriba (hacia +X de la cabeza en los dos ojos) y uno chiquito abajo
    const brillo = (cx, cy, r, h) => {
      const Fb = { P: [0, 0, 0], N: F.N, U: F.U, X: F.X };
      const qx = F.P[0] + F.X[0] * OJO_A * cx + F.U[0] * OJO_B * cy;
      const qy = F.P[1] + F.X[1] * OJO_A * cx + F.U[1] * OJO_B * cy;
      const qz = F.P[2] + F.X[2] * OJO_A * cx + F.U[2] * OJO_B * cy;
      const rho2 = cx * cx + cy * cy;
      const alto = OJO_H * Math.sqrt(Math.max(0, 1 - rho2)) + 0.0032 + h;
      sobreCabeza(qx, qy, qz, alto, Fb.P, _n);
      const b0 = A.nv;
      const segs = 7;
      vertice(A, Fb.P[0], Fb.P[1], Fb.P[2], F.N[0], F.N[1], F.N[2], OJO.brillo, [hOjo, 1]);
      for (let k = 0; k < segs; k++) {
        const ang = (k / segs) * TAU;
        const ox = Math.cos(ang) * r, oy = Math.sin(ang) * r;
        vertice(
          A,
          Fb.P[0] + F.X[0] * ox + F.U[0] * oy, Fb.P[1] + F.X[1] * ox + F.U[1] * oy, Fb.P[2] + F.X[2] * ox + F.U[2] * oy,
          F.N[0], F.N[1], F.N[2], OJO.brillo, [hOjo, 1],
        );
      }
      for (let k = 0; k < segs; k++) triAfuera(A, b0, b0 + 1 + k, b0 + 1 + ((k + 1) % segs), CABEZA_C[0], CABEZA_C[1], CABEZA_C[2]);
    };
    // +X de la cabeza: en el ojo derecho es hacia afuera; en el izquierdo, hacia la nariz
    const hx = (F.X[0] >= 0 ? 1 : -1) * 0.34;
    brillo(hx, 0.4, 0.0085, 0.0012);
    brillo(-hx * 1.1, -0.42, 0.0042, 0.0008);
    // ojo feliz: un arquito ∩
    const arcoPts = [];
    for (let k = 0; k <= 5; k++) {
      const ang = lerp(0.12, Math.PI - 0.12, k / 5);
      const lx = Math.cos(ang) * 1.0, ly = Math.sin(ang) * 0.62 - 0.2;
      arcoPts.push([
        F.P[0] + F.X[0] * OJO_A * lx + F.U[0] * OJO_B * ly,
        F.P[1] + F.X[1] * OJO_A * lx + F.U[1] * OJO_B * ly,
        F.P[2] + F.X[2] * OJO_A * lx + F.U[2] * OJO_B * ly,
      ]);
    }
    trazoCara(A, arcoPts, 0.0052, 0.003, OJO.feliz, [hFel, 1]);
  });

  // --- nariz (triangulito redondeado) y boquita en «Y» ---
  const nF = (() => {
    const N = M.nariz.N;
    let ux = -N[1] * N[0], uy = 1 - N[1] * N[1], uz = -N[1] * N[2];
    const lu = largo(ux, uy, uz);
    ux /= lu;
    uy /= lu;
    uz /= lu;
    return { P: M.nariz.P, N, U: [ux, uy, uz], X: [uy * N[2] - uz * N[1], uz * N[0] - ux * N[2], ux * N[1] - uy * N[0]] };
  })();
  cupula(
    A, nF, 0.0135, 0.0095, 0.0065, 2, 10,
    (lx, ly) => mezcla(V.nariz, [1, 0.9, 0.9], suave(0.1, 0.7, ly) * 0.25),
    [H.nariz, 1],
    (lx, ly) => [lx * (0.75 + 0.3 * ly), ly - 0.12 * (1 - lx * lx)],
  );
  {
    const P = nF.P, U = nF.U, X = nF.X;
    const en = (ox, oy) => [P[0] + X[0] * ox + U[0] * oy, P[1] + X[1] * ox + U[1] * oy, P[2] + X[2] * ox + U[2] * oy];
    const piel = [H.nariz, 0.6, H.cabeza, 0.4];
    trazoCara(A, [en(0, -0.007), en(0, -0.013), en(0, -0.019)], 0.0026, 0.0012, V.boca, piel);
    for (const s of [-1, 1]) trazoCara(A, [en(0, -0.019), en(s * 0.006, -0.023), en(s * 0.013, -0.022)], 0.0024, 0.0012, V.boca, piel);
  }

  // --- orejas: cuchara larga, rosada por dentro, con dos huesos ---
  const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'ZXY'), v3 = new THREE.Vector3();
  for (const O of M.orejas) {
    const hO = O.s < 0 ? H.orejaI : H.orejaD;
    const hP = O.s < 0 ? H.puntaI : H.puntaD;
    e.set(O.rot[0], O.rot[1], O.rot[2], 'ZXY');
    q.setFromEuler(e);
    const nu = 10, nv = 8;
    const base = A.nv, i0 = A.i.length;
    for (let iu = 0; iu < nu; iu++) {
      const u = iu / (nu - 1);
      // ancho: angosta en la base, ancha a 40%, punta redondeada
      const w = u < 0.42 ? lerp(0.018, 0.034, suave(0, 0.42, u)) : 0.034 * Math.sqrt(Math.max(0, 1 - ((u - 0.42) / 0.58) ** 2));
      const t = 0.0125 * (1 - 0.3 * u) * Math.sqrt(w / 0.034);
      const ly = -0.016 + u * OREJA_L;
      const curva = 0.022 * u * u; // la punta se va un poco para atrás
      for (let iv = 0; iv < nv; iv++) {
        const ang = (iv / nv) * TAU;
        const c = Math.cos(ang), s = Math.sin(ang);
        // atrás (s > 0) redondeada; adelante, cóncava (cuchara)
        const lz = s >= 0 ? t * s : t * s + 1.45 * t * (1 - c * c);
        const lx = w * c;
        v3.set(lx, ly, lz + curva).applyQuaternion(q);
        const x = O.base[0] + v3.x, y = O.base[1] + v3.y, z = O.base[2] + v3.z;
        // color: adentro rosado (con borde de pelo), puntas más oscuras
        const dentro = s < 0 ? suave(0.85, 0.6, Math.abs(c)) * suave(0.05, 0.16, u) * suave(0.97, 0.86, u) : 0;
        let col = V.mancha ? V.orejaBorde : mezcla(V.pelo, V.orejaBorde, suave(0.78, 1, u) * 0.85);
        col = mezcla(col, V.orejaDentro, dentro);
        const wp = suave(0.15, 0.8, u);
        vertice(A, x, y, z, 0, 1, 0, col, [hO, 1 - wp, hP, wp]);
      }
    }
    for (let iu = 0; iu < nu - 1; iu++) {
      for (let iv = 0; iv < nv; iv++) {
        const a = base + iu * nv + iv, b = base + iu * nv + ((iv + 1) % nv);
        const c = a + nv, d = b + nv;
        A.i.push(a, d, b, a, c, d); // caras hacia afuera
      }
    }
    normalesPorCaras(A, base, A.nv, i0);
  }

  // --- cola de algodón (con bultitos) ---
  {
    const sdfCola = (x, y, z) => {
      const dx = x - COLA_C[0], dy = y - COLA_C[1], dz = z - COLA_C[2];
      const l = largo(dx, dy, dz);
      const b = ruido3(dx / l * 2.2 + 5, dy / l * 2.2 + 1, dz / l * 2.2 + 9) * 0.6 + ruido3(dx / l * 4.5, dy / l * 4.5 + 4, dz / l * 4.5) * 0.4;
      return l - COLA_R * (0.88 + 0.28 * b);
    };
    piezaImplicita(A, sdfCola, COLA_C, 3, (x, y, z) => mezcla(V.cola, V.claro, suave(0.2, 0.15, y) * 0.3), () => [H.cola, 1], 0.1);
  }

  // --- patas de adelante: tubo del hombro a la mano (se estira) y manito ---
  for (const s of [-1, 1]) {
    const hM = s < 0 ? H.manoI : H.manoD;
    const mx = s * MANO[0];
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      const f = k / 3;
      pts.push([lerp(s * HOMBRO[0], mx, f), lerp(HOMBRO[1], MANO[1] + 0.012, f), lerp(HOMBRO[2], MANO[2] + 0.012, f), lerp(0.026, 0.02, f)]);
    }
    const colPata = (y) => mezcla(colorCuerpo(V, mx, Math.max(0.05, y), -0.12, [0, -0.3, -1]), V.pata, suave(0.05, 0.015, y));
    tubo(
      A, pts, 8,
      (f, x, y) => colPata(y),
      (f) => [H.pecho, 1 - suave(0.15, 0.85, f), hM, suave(0.15, 0.85, f)],
    );
    // manito: un bollito chato que mira para adelante
    const [y0, z0] = [MANO[1], MANO[2]];
    capsula(
      A,
      [[mx, y0 + 0.004, z0 + 0.026, 0, 0], [mx, y0 + 0.002, z0 + 0.016, 0.018, 0.015], [mx, y0, z0 - 0.002, 0.021, 0.016], [mx, y0 - 0.002, z0 - 0.018, 0.016, 0.012], [mx, y0 - 0.004, z0 - 0.026, 0, 0]],
      8, (x, y) => colPata(y), () => [hM, 1],
    );
  }

  // --- patas de atrás: canilla (de la rodilla al talón, se estira) y pie largo ---
  for (const s of [-1, 1]) {
    const hP = s < 0 ? H.pieI : H.pieD;
    const pts = [];
    for (let k = 0; k <= 2; k++) {
      const f = k / 2;
      pts.push([s * lerp(RODILLA[0], TALON[0], f), lerp(RODILLA[1], TALON[1] + 0.006, f), lerp(RODILLA[2], TALON[2] - 0.004, f), lerp(0.034, 0.022, f)]);
    }
    tubo(
      A, pts, 8,
      (f, x, y, z) => colorCuerpo(V, x, Math.max(0.06, y), z, [s, 0, 0]),
      (f) => [H.cadera, 1 - suave(0.1, 0.9, f), hP, suave(0.1, 0.9, f)],
    );
    // pie: talón redondo atrás, se ensancha y termina en los dedos (planta chata)
    const px = s * PIE_X;
    capsula(
      A,
      [
        [px, 0.03, 0.183, 0, 0], [px, 0.028, 0.172, 0.019, 0.019], [px, 0.025, 0.14, 0.027, 0.024], [px, 0.022, 0.08, 0.028, 0.021],
        [px, 0.019, 0.02, 0.027, 0.019], [px, 0.016, -0.004, 0.019, 0.014], [px, 0.014, -0.014, 0, 0],
      ],
      8,
      (x, y, z) => mezcla(mezcla(colorCuerpo(V, x, 0.07, z, [s, 0, 0]), V.pata, suave(0.03, -0.01, z) * 0.7), V.claro, suave(0.012, 0.004, y) * 0.4),
      () => [hP, 1],
    );
  }

  return aGeometria(THREE, A);
}

// =============================================================================
// 6. Recursos compartidos: un material para todos y una geometría por
// variante (nunca se liberan desde una instancia).
// =============================================================================
const CACHE = { mat: null, geo: [], reposo: null };
let instancias = 0;

function recursos(THREE, vi) {
  if (!CACHE.mat) CACHE.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!CACHE.geo[vi]) CACHE.geo[vi] = armarConejo(THREE, vi);
  if (!CACHE.reposo) CACHE.reposo = reposoHuesos(THREE);
  return { geo: CACHE.geo[vi], mat: CACHE.mat, reposo: CACHE.reposo };
}

// Pose de reposo de cada hueso: posición y giro en el espacio de la raíz y,
// relativos al padre, lo que se le asigna al hueso.
function reposoHuesos(THREE) {
  const M = medidas();
  const P = [], Q = [];
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  HUESOS.forEach(([n, , p], i) => {
    let pos = p, quat = [0, 0, 0, 1], euler = null;
    if (n.startsWith('oreja') || n.startsWith('punta')) {
      const O = M.orejas[n.endsWith('I') ? 0 : 1];
      q.setFromEuler(new THREE.Euler(O.rot[0], O.rot[1], O.rot[2], 'ZXY'));
      quat = [q.x, q.y, q.z, q.w];
      if (n.startsWith('oreja')) {
        pos = O.base;
        euler = O.rot;
      } else {
        const v = new THREE.Vector3(0, OREJA_PUNTA, 0).applyQuaternion(q);
        pos = [O.base[0] + v.x, O.base[1] + v.y, O.base[2] + v.z];
      }
    } else if (n.startsWith('ojo') || n.startsWith('feliz') || n.startsWith('susto')) {
      const F = M.ojos[n.endsWith('I') ? 0 : 1];
      m.makeBasis(new THREE.Vector3(...F.X), new THREE.Vector3(...F.U), new THREE.Vector3(...F.N));
      q.setFromRotationMatrix(m);
      quat = [q.x, q.y, q.z, q.w];
      pos = F.P;
    } else if (n === 'nariz') {
      pos = M.nariz.P;
    }
    P[i] = pos;
    Q[i] = { quat, euler };
  });
  // relativo al padre
  const local = HUESOS.map(([n, padre], i) => {
    const qi = new THREE.Quaternion(...Q[i].quat);
    if (padre < 0) return { p: new THREE.Vector3(...P[i]), q: qi, euler: null };
    const qp = new THREE.Quaternion(...Q[padre].quat);
    const qpInv = qp.clone().invert();
    const p = new THREE.Vector3(P[i][0] - P[padre][0], P[i][1] - P[padre][1], P[i][2] - P[padre][2]).applyQuaternion(qpInv);
    return { p, q: qpInv.multiply(qi), euler: Q[i].euler };
  });
  return { local, mundo: P };
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
// 7. createModel
// =============================================================================
const ACCIONES = ['idle', 'walk', 'eat', 'happy', 'scared', 'swim'];
// Canales de la pose: cada acción arma su pose y se mezclan con pesos.
const CANALES = [
  'y', 'z', 'pitch', 'roll', 'yaw', 'estira', 'pechoY', 'caderaY', 'caderaYaw',
  'cPitch', 'cYaw', 'cRoll', 'cY', 'cZ',
  'oIx', 'oDx', 'oIy', 'oDy', 'oIz', 'oDz', 'pIx', 'pDx', 'pIz', 'pDz',
  'ojo', 'ojoG', 'feliz', 'susto', 'nariz', 'mastica', 'cola', 'colaY',
  'mIy', 'mIz', 'mIa', 'mDy', 'mDz', 'mDa', 'tIy', 'tIz', 'tIa', 'tDy', 'tDz', 'tDa',
  'pegaM', 'pegaT', // 0: patas en el piso (espacio de la raíz) · 1: van con el cuerpo
];
const K = Object.fromEntries(CANALES.map((n, i) => [n, i]));
// Frecuencia de los saltos (por segundo) y su alto según la velocidad.
const frecSalto = (v) => 2.2 + 0.4 * Math.min(v, 7);
const altoSalto = (v) => Math.min(0.13, 0.075 + 0.012 * v) * suave(0, 0.8, v);

export function createModel(THREE, { variant = 0 } = {}) {
  const vi = indiceVariante(variant);
  const { geo, mat, reposo } = recursos(THREE, vi);

  const root = new THREE.Group();
  root.name = 'conejo';
  const B = HUESOS.map(([n], i) => {
    const b = new THREE.Bone();
    b.name = n;
    const r = reposo.local[i];
    b.position.copy(r.p);
    if (r.euler) {
      b.rotation.order = 'ZXY';
      b.rotation.set(r.euler[0], r.euler[1], r.euler[2], 'ZXY');
    } else b.quaternion.copy(r.q);
    return b;
  });
  HUESOS.forEach(([, padre], i) => {
    if (padre >= 0) B[padre].add(B[i]);
  });
  const malla = new THREE.SkinnedMesh(geo, mat);
  malla.name = 'conejoMalla';
  malla.add(B[0]);
  root.add(malla);
  root.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(B);
  malla.bind(esqueleto);
  // esfera fija generosa (saltos, binky): evita recalcular la piel en la CPU
  malla.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.3, 0), 0.62);
  malla.boundingBox = new THREE.Box3(new THREE.Vector3(-0.4, -0.02, -0.5), new THREE.Vector3(0.4, 0.95, 0.5));

  const rest = reposo.local.map((r) => r.p.clone());
  const restEuler = reposo.local.map((r) => r.euler);
  const b = (n) => B[H[n]];
  const cuerpo = b('cuerpo'), pecho = b('pecho'), cadera = b('cadera'), cabeza = b('cabeza');
  const orejas = [b('orejaI'), b('orejaD')], puntas = [b('puntaI'), b('puntaD')];
  const ojos = [b('ojoI'), b('ojoD')], felices = [b('felizI'), b('felizD')], sustos = [b('sustoI'), b('sustoD')];
  const nariz = b('nariz'), cola = b('cola');
  const manos = [b('manoI'), b('manoD')], pies = [b('pieI'), b('pieD')];
  cuerpo.rotation.order = 'YXZ';
  cabeza.rotation.order = 'YXZ';

  // puntos de la cabeza que no pueden atravesar el piso (relativos al hueso de la cabeza)
  const cb = reposo.mundo[H.cabeza];
  const puntosCabeza = [
    [0, -0.06, -0.07], [0, -0.04, -0.11], [0.05, -0.065, -0.04], [-0.05, -0.065, -0.04], [0, -0.012, -0.118],
  ].map(([x, y, z]) => new THREE.Vector3(x + CABEZA_C[0] - cb[0], y + CABEZA_C[1] - cb[1], z + CABEZA_C[2] - cb[2]));

  // --- estado ---
  const sem = instancias++;
  const rnd = azar(4711 + sem * 7919);
  const fase0 = rnd() * TAU; // cada conejo respira a su ritmo
  const w = new Float32Array(ACCIONES.length);
  w[0] = 1;
  let accion = 'idle', reloj = rnd() * 100;
  let tFeliz = 9, tSusto = 9, tCome = 0;
  let vel = 0, fase = rnd(), faseNado = rnd();
  let proxParpadeo = 0.5 + rnd() * 2.5, parpadeoT = -1, doble = false;
  // orejas: cada una escucha por su lado (giro lento) y a veces da un sacudón
  const oreja = [0, 1].map(() => ({ gira: 0, giraObj: 0, prox: 0.5 + rnd() * 3, sac: -1, proxSac: 1 + rnd() * 4, dir: 1 }));
  let proxMirada = rnd() * 2, mirY = 0, mirP = 0, mirR = 0, objY = 0, objP = 0, objR = 0;
  let narizT = 0, narizRacha = 0.6 + rnd(), narizPausa = 0;
  let proxCola = 2 + rnd() * 4, colaT = -1;
  let lookY = 0, lookP = 0;
  const pose = new Float32Array(CANALES.length);
  const fin = new Float32Array(CANALES.length);
  const _m = new THREE.Matrix4(), _mP = new THREE.Matrix4(), _mC = new THREE.Matrix4();
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qP = new THREE.Quaternion(), _qC = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const pechoR = reposo.mundo[H.pecho], caderaR = reposo.mundo[H.cadera];

  // --- poses de cada acción (escriben en «P») ---
  function base(P) {
    P.fill(0);
    P[K.ojo] = 1;
    P[K.nariz] = 1;
  }

  function quieto(P) {
    base(P);
    const res = Math.sin(reloj * TAU * 0.85 + fase0);
    P[K.estira] = -0.014 + 0.003 * res; // redondito, respirando
    P[K.pechoY] = 0.0025 * res;
    P[K.cYaw] = mirY;
    P[K.cPitch] = mirP;
    P[K.cRoll] = mirR;
    P[K.oIx] = P[K.oDx] = 0.02 * Math.sin(reloj * 0.9 + fase0);
  }

  // Salto (φ = 0 cuando caen las patas de atrás):
  //   [0, SH)      apoyan las de atrás (al final empujan levantando el talón)
  //   [SH, FL)     en el aire: el cuerpo se estira, los pies van para atrás
  //   [FL, FL+SF)  apoyan las de adelante (el cuerpo se recoge y las de atrás
  //                pasan por el costado y caen adelante)
  // Una pata apoyada queda quieta contra el piso: en el espacio de la raíz se
  // corre para atrás a la velocidad del conejo. El cuerpo se adelanta en el
  // aire y se atrasa apoyado (como un conejo de verdad), así las patas
  // apoyadas se corren menos respecto del cuerpo.
  function camina(P) {
    base(P);
    const v = vel;
    const r = suave(2.2, 5, v);
    const T = 1 / frecSalto(v);
    const SH = lerp(0.32, 0.26, r);
    const FL = lerp(0.8, 0.78, r);
    const SF = lerp(0.24, 0.2, r);
    const Hs = altoSalto(v);
    const E = Math.min(0.07, 0.02 + 0.012 * v) * suave(0, 0.6, v);
    const ph = fase;
    const vuelo = arco(ph, SH - 0.03, FL + 0.03);
    const recoge = campana(ph, 0.1, 0.1);
    const yC = Hs * vuelo - 0.012 * recoge * suave(0, 0.5, v);
    const bz = Math.min(0.06, 0.025 * v) * Math.sin(TAU * (ph - 0.06));
    P[K.y] = yC;
    P[K.z] = bz;
    const amp = (0.75 + 0.25 * r) * suave(0, 0.6, v);
    const pitch = amp * (0.22 * campana(ph, SH - 0.02, 0.08) - 0.24 * campana(ph, FL + 0.03, 0.07));
    P[K.pitch] = pitch;
    P[K.estira] = E * campana(ph, (SH + FL) / 2 - 0.04, 0.15) - 0.6 * E * recoge - 0.006;
    P[K.cPitch] = -0.55 * pitch + 0.04 * r;
    // orejas: para atrás con la velocidad y en el aire; rebotan al caer
    const atras = 0.12 + 0.4 * r + 0.25 * vuelo;
    P[K.oIx] = atras;
    P[K.oDx] = atras * 0.92;
    P[K.pIx] = 0.2 * campana(ph, FL + 0.08, 0.07) + 0.12 * r;
    P[K.pDx] = 0.2 * campana(ph, FL + 0.11, 0.07) + 0.12 * r;
    P[K.cola] = 0.35 * campana(ph, SH, 0.1);
    P[K.nariz] = 0.4;
    const recT = v * T * SH; // lo que se corre el pie de atrás apoyado
    const recM = v * T * SF; // y la mano
    for (let s = 0; s < 2; s++) {
      const off = s * 0.02; // la derecha, un poquito atrasada
      // --- de atrás ---
      const q = frac(ph - off);
      let ty, tz, ta;
      if (q < SH) {
        const u = q / SH;
        const zp = recT * (u - 0.5);
        // empuje: se levanta el talón girando sobre los dedos (que no se mueven)
        ta = -1.0 * suave(0.55, 1, u) * suave(0, 0.5, v);
        tz = zp - PIE_LARGO * (1 - Math.cos(ta));
        ty = PIE_LARGO * Math.sin(-ta);
      } else {
        const u = (q - SH) / (1 - SH);
        const k1 = suave(0, 0.3, u), k2 = suave(0.55, 0.95, u);
        // despegue → atrás del cuerpo (suela para atrás) → cae adelante
        const zLo = recT * 0.5 - PIE_LARGO * (1 - Math.cos(1.0)), yLo = PIE_LARGO * Math.sin(1.0);
        const zTr = bz + 0.03, yTr = yC + 0.03;
        const zTd = -recT * 0.5;
        tz = lerp(lerp(zLo, zTr, k1), zTd, k2);
        ty = lerp(lerp(yLo, yTr, k1), 0, k2);
        ta = lerp(lerp(-1.0, -2.3, k1), 0, k2) * suave(0, 0.5, v);
      }
      P[s ? K.tDy : K.tIy] = ty;
      P[s ? K.tDz : K.tIz] = tz;
      P[s ? K.tDa : K.tIa] = ta;
      // --- de adelante ---
      const qf = frac(ph - FL - off);
      let my, mz, ma;
      if (qf < SF) {
        const u = qf / SF;
        mz = recM * (u - 0.5);
        my = 0;
        ma = 0;
      } else {
        const u = (qf - SF) / (1 - SF);
        const k1 = suave(0, 0.35, u), k2 = suave(0.6, 1, u);
        // despega → recogida bajo el pecho → se estira para aterrizar
        const zTk = bz + 0.01, yTk = Math.max(0, yC) + 0.035;
        mz = lerp(lerp(recM * 0.5, zTk, k1), -recM * 0.5, k2);
        my = lerp(lerp(0, yTk, k1), 0, k2);
        ma = lerp(lerp(0, -1.0, k1), 0.15, k2) * (1 - suave(0.97, 1, u));
      }
      P[s ? K.mDy : K.mIy] = my;
      P[s ? K.mDz : K.mIz] = mz;
      P[s ? K.mDa : K.mIa] = ma;
    }
  }

  function come(P) {
    base(P);
    // ciclo: mordisquea abajo un rato, levanta la cabeza a masticar
    const ciclo = 4.2 + (sem % 3) * 0.6;
    const k = (tCome % ciclo) / ciclo;
    const abajo = tCome < ciclo ? 1 - suave(0.72, 0.8, k) + suave(0.94, 1, k) : suave(0, 0.06, k) - suave(0.72, 0.8, k) + suave(0.94, 1, k);
    const mord = Math.sin(reloj * TAU * 4.5);
    P[K.pechoY] = -0.012 * abajo;
    P[K.pitch] = -0.06 * abajo;
    P[K.estira] = -0.008;
    P[K.cPitch] = lerp(0.05, -0.92, abajo) + 0.05 * mord * abajo;
    P[K.cZ] = -0.012 * abajo;
    P[K.cY] = -0.006 * abajo;
    P[K.mastica] = 1;
    P[K.nariz] = 0.2;
    P[K.oIx] = 0.25;
    P[K.oDx] = 0.3;
    P[K.oIz] = 0.1;
    P[K.oDz] = 0.14;
    P[K.ojo] = lerp(1, 0.75, abajo);
  }

  function contento(P) {
    base(P);
    P[K.feliz] = 1;
    // «binky»: agacha, salta girando el cuerpo y la cabeza, patea, cae y se menea
    const tb = tFeliz % 1.6;
    const ag = suave(0, 0.1, tb) * (1 - suave(0.1, 0.16, tb));
    const s = clamp((tb - 0.12) / 0.5);
    const aire = tb > 0.12 && tb < 0.62 ? 4 * s * (1 - s) : 0;
    const cae = tb > 0.62 && tb < 0.82 ? Math.sin((Math.PI * (tb - 0.62)) / 0.2) : 0;
    const menea = suave(0.75, 0.9, tb) * (1 - suave(1.4, 1.6, tb));
    const giro = Math.sin(Math.PI * s) * (aire > 0 ? 1 : 0);
    P[K.y] = 0.2 * aire - 0.018 * ag - 0.014 * cae + 0.012 * menea * Math.abs(Math.sin(reloj * TAU * 2.5));
    P[K.estira] = -0.02 * ag + 0.03 * giro - 0.018 * cae;
    P[K.yaw] = 0.5 * Math.sin(TAU * s) * (aire > 0 ? 1 : 0);
    P[K.roll] = 0.32 * giro;
    P[K.pitch] = 0.18 * Math.cos(Math.PI * s) * (aire > 0 ? 1 : 0) - 0.06 * ag;
    P[K.caderaYaw] = -0.5 * giro;
    P[K.cYaw] = -0.55 * Math.sin(TAU * s) * (aire > 0 ? 1 : 0) + 0.2 * menea * Math.sin(reloj * TAU * 2.2);
    P[K.cRoll] = 0.25 * giro + 0.12 * menea * Math.sin(reloj * TAU * 2.2 + 1);
    P[K.cPitch] = 0.12 * aire;
    // orejas al viento: se abren y aletean
    const aleteo = Math.sin(reloj * TAU * 3.3);
    P[K.oIz] = 0.35 * giro + 0.12 * menea * aleteo;
    P[K.oDz] = 0.25 * giro - 0.12 * menea * aleteo;
    P[K.oIx] = 0.25 * aire - 0.05;
    P[K.oDx] = 0.3 * aire - 0.05;
    P[K.pIx] = 0.35 * cae + 0.15 * aire;
    P[K.pDx] = 0.45 * cae + 0.1 * aire;
    P[K.pIz] = 0.4 * giro;
    P[K.pDz] = 0.3 * giro;
    P[K.cola] = 0.4 * aire;
    P[K.colaY] = 0.3 * menea * Math.sin(reloj * TAU * 5);
    P[K.nariz] = 1;
    // patas: van con el cuerpo en el aire; las manos se recogen y las de atrás patean
    const pega = suave(0.08, 0.16, tb) * (1 - suave(0.56, 0.66, tb));
    P[K.pegaM] = pega;
    P[K.pegaT] = pega;
    for (let k = 0; k < 2; k++) {
      P[k ? K.mDy : K.mIy] = 0.02 * aire;
      P[k ? K.mDz : K.mIz] = 0.01 * aire;
      P[k ? K.mDa : K.mIa] = -0.8 * aire;
      P[k ? K.tDy : K.tIy] = 0.03 * giro;
      P[k ? K.tDz : K.tIz] = 0.03 * giro;
      P[k ? K.tDa : K.tIa] = -1.9 * giro;
    }
  }

  function asustado(P) {
    base(P);
    // respingo (salto chiquito) y después duro, agachado, con las orejas atrás
    const ts = tSusto;
    const resp = ts < 0.2 ? Math.sin((Math.PI * ts) / 0.2) : 0;
    P[K.y] = 0.035 * resp - 0.012 * suave(0.15, 0.3, ts);
    P[K.estira] = -0.03;
    P[K.pitch] = 0.06;
    P[K.pechoY] = -0.006;
    P[K.cPitch] = 0.1;
    P[K.cY] = -0.008;
    P[K.oIx] = 1.15;
    P[K.oDx] = 1.1;
    P[K.oIz] = -0.12;
    P[K.oDz] = -0.08;
    P[K.oIy] = 0.55;
    P[K.oDy] = 0.5;
    P[K.pIx] = 0.25;
    P[K.pDx] = 0.25;
    P[K.ojoG] = 0.32;
    P[K.susto] = 1;
    P[K.nariz] = 0;
    P[K.cola] = 0.5;
    // pisotón de alarma con la pata derecha
    const pis = ts < 0.22 ? Math.sin((Math.PI * ts) / 0.22) : 0;
    P[K.tDy] = 0.03 * pis;
    P[K.tDa] = 0.25 * pis;
    for (let k = 0; k < 2; k++) {
      P[k ? K.mDy : K.mIy] = Math.max(0, P[K.y]) * 0.8;
      if (!k) P[K.tIy] = Math.max(0, P[K.y]) * 0.8;
    }
  }

  function nada(P) {
    base(P);
    const v = vel;
    const th = faseNado * TAU;
    // flota alto con la cabeza afuera y rema
    P[K.y] = 0.135 + 0.008 * Math.sin(th * 2);
    P[K.pitch] = 0.14;
    P[K.roll] = 0.04 * Math.sin(th);
    P[K.estira] = 0.012;
    P[K.cPitch] = 0.12;
    P[K.oIx] = 0.5;
    P[K.oDx] = 0.55;
    P[K.oIz] = 0.12;
    P[K.oDz] = 0.12;
    P[K.pIx] = 0.2;
    P[K.pDx] = 0.25;
    P[K.nariz] = 1;
    P[K.colaY] = 0.15 * Math.sin(th * 2);
    P[K.pegaM] = 1;
    P[K.pegaT] = 1;
    for (let k = 0; k < 2; k++) {
      // remando: las manos dan vueltitas alternadas, las de atrás patean
      const a = th + k * Math.PI;
      P[k ? K.mDy : K.mIy] = 0.012 + 0.022 * Math.sin(a);
      P[k ? K.mDz : K.mIz] = -0.02 + 0.035 * Math.cos(a);
      P[k ? K.mDa : K.mIa] = -0.5 + 0.4 * Math.sin(a);
      const c = a + Math.PI * 0.5;
      P[k ? K.tDy : K.tIy] = 0.02 + 0.015 * Math.sin(c);
      P[k ? K.tDz : K.tIz] = 0.03 + 0.04 * Math.cos(c);
      P[k ? K.tDa : K.tIa] = -0.8 + 0.45 * Math.sin(c) - 0.1 * v;
    }
  }

  const POSES = [quieto, camina, come, contento, asustado, nada];

  function update(dt, state = {}) {
    dt = clamp(numero(dt), 0, 0.1);
    reloj += dt;
    const nueva = ACCIONES.includes(state.action) ? state.action : 'idle';
    if (nueva !== accion) {
      if (nueva === 'happy') tFeliz = 0;
      if (nueva === 'scared') tSusto = 0;
      if (nueva === 'eat') tCome = 0;
      if (nueva === 'walk' && w[1] < 0.05) fase = 0.3; // arranca empujando
      accion = nueva;
    }
    tFeliz += dt;
    tSusto += dt;
    tCome += dt;
    // pesos de cada acción (transiciones de ~0,2 s)
    let suma = 0;
    for (let i = 0; i < ACCIONES.length; i++) {
      w[i] = amort(w[i], ACCIONES[i] === accion ? 1 : 0, 14, dt);
      suma += w[i];
    }
    for (let i = 0; i < ACCIONES.length; i++) w[i] /= suma || 1;
    const [wI, wW, wE, wH, wS, wN] = w;
    vel = amort(vel, clamp(numero(state.speed), 0, 9), 10, dt);
    fase = frac(fase + frecSalto(vel) * dt * (wW > 0.001 ? 1 : 0));
    faseNado = frac(faseNado + (1.5 + 0.5 * vel) * dt);

    // --- mirada propia cuando está tranquilo (gira, mira arriba, ladea) ---
    proxMirada -= dt;
    if (proxMirada < 0) {
      proxMirada = 1.2 + rnd() * 3;
      const quieta = rnd() < 0.35;
      objY = quieta ? 0 : (rnd() - 0.5) * 0.8;
      objP = quieta ? 0 : (rnd() - 0.4) * 0.3;
      objR = rnd() < 0.3 ? (rnd() - 0.5) * 0.4 : 0;
    }
    mirY = amort(mirY, objY, 4, dt);
    mirP = amort(mirP, objP, 4, dt);
    mirR = amort(mirR, objR, 3, dt);

    // --- mezcla de poses ---
    fin.fill(0);
    for (let i = 0; i < ACCIONES.length; i++) {
      if (w[i] < 1e-4) continue;
      POSES[i](pose);
      for (let k = 0; k < pose.length; k++) fin[k] += pose[k] * w[i];
    }
    const F = fin;

    // --- parpadeo ---
    proxParpadeo -= dt;
    if (proxParpadeo < 0 && parpadeoT < 0) {
      parpadeoT = 0;
      if (doble) {
        doble = false;
        proxParpadeo = 1.8 + rnd() * 3.5;
      } else {
        doble = rnd() < 0.25;
        proxParpadeo = doble ? 0.22 : 1.8 + rnd() * 3.5;
      }
    }
    let cierre = 0;
    if (parpadeoT >= 0) {
      parpadeoT += dt;
      cierre = Math.sin(clamp(parpadeoT / 0.14) * Math.PI);
      if (parpadeoT > 0.14) parpadeoT = -1;
    }
    cierre *= 1 - wS * 0.9;

    // --- orejas: cada una escucha por su lado y a veces se sacude ---
    const tranquilo = wI + wE + wW * 0.3;
    for (let i = 0; i < 2; i++) {
      const o = oreja[i];
      o.prox -= dt;
      if (o.prox < 0) {
        o.prox = 1.2 + rnd() * 4;
        o.giraObj = rnd() < 0.45 ? 0 : (rnd() - 0.3) * 1.1;
      }
      o.gira = amort(o.gira, o.giraObj, 5, dt);
      o.proxSac -= dt;
      if (o.proxSac < 0 && o.sac < 0) {
        o.sac = 0;
        o.dir = rnd() < 0.5 ? -1 : 1;
        o.proxSac = 2 + rnd() * 6;
      }
    }
    let sacudon = [0, 0];
    for (let i = 0; i < 2; i++) {
      const o = oreja[i];
      if (o.sac >= 0) {
        o.sac += dt;
        sacudon[i] = Math.sin(clamp(o.sac / 0.35) * Math.PI) * Math.sin(o.sac * 40);
        if (o.sac > 0.35) o.sac = -1;
      }
    }

    // --- nariz: rachas de olfateo rápido ---
    narizT += dt;
    if (narizPausa > 0) {
      narizPausa -= dt;
      if (narizPausa <= 0) narizRacha = 0.5 + rnd() * 1.6;
    } else {
      narizRacha -= dt;
      if (narizRacha <= 0) narizPausa = 0.4 + rnd() * 2.2;
    }
    const olfa = narizPausa > 0 ? 0 : Math.max(0, Math.sin(narizT * TAU * 7));

    // --- cola: meneíto de vez en cuando ---
    proxCola -= dt;
    if (proxCola < 0 && colaT < 0) {
      colaT = 0;
      proxCola = 3 + rnd() * 6;
    }
    let colaMenea = 0;
    if (colaT >= 0) {
      colaT += dt;
      colaMenea = Math.sin(colaT * 28) * Math.sin(clamp(colaT / 0.6) * Math.PI);
      if (colaT > 0.6) colaT = -1;
    }

    // --- mirar al jugador ---
    const lY = clamp(numero(state.lookYaw), -1.0, 1.0);
    const lP = clamp(numero(state.lookPitch), -0.5, 0.5);
    lookY = amort(lookY, lY, 8, dt);
    lookP = amort(lookP, lP, 8, dt);
    const kMira = 1 - 0.75 * wE - 0.5 * wH - 0.6 * wS;
    // si mira a alguien, deja de mirar por su cuenta
    const mirando = Math.min(1, Math.abs(lookY) * 4 + Math.abs(lookP) * 4);

    // --- aplicar a los huesos ---
    const rp = (i) => rest[i];
    let r = rp(H.cuerpo);
    cuerpo.position.set(r.x, r.y + F[K.y], r.z + F[K.z]);
    cuerpo.rotation.set(F[K.pitch], F[K.yaw], F[K.roll], 'YXZ');
    r = rp(H.pecho);
    pecho.position.set(r.x, r.y + F[K.pechoY], r.z - F[K.estira] * 0.5);
    r = rp(H.cadera);
    cadera.position.set(r.x, r.y + F[K.caderaY], r.z + F[K.estira] * 0.5);
    cadera.rotation.set(0, F[K.caderaYaw], 0);
    r = rp(H.cabeza);
    const cYaw = F[K.cYaw] - wI * mirY * mirando + lookY * kMira;
    const cPitch = F[K.cPitch] - wI * mirP * mirando + lookP * kMira;
    cabeza.position.set(r.x, r.y + F[K.cY], r.z + F[K.cZ]);
    cabeza.rotation.set(cPitch, cYaw, F[K.cRoll], 'YXZ');

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const o = oreja[i];
      const re = restEuler[i === 0 ? H.orejaI : H.orejaD];
      const ox = F[i ? K.oDx : K.oIx] + 0.2 * Math.abs(sacudon[i]) * tranquilo;
      const oy = F[i ? K.oDy : K.oIy] + (o.gira + 0.35 * sacudon[i] * o.dir) * tranquilo * (1 - wS);
      const oz = F[i ? K.oDz : K.oIz];
      // + gira la abertura hacia afuera; + abre la oreja hacia su lado
      orejas[i].rotation.set(re[0] + ox, re[1] - s * oy, re[2] - s * oz, 'ZXY');
      puntas[i].rotation.set(F[i ? K.pDx : K.pIx] + 0.15 * sacudon[i] * tranquilo, 0, -s * F[i ? K.pDz : K.pIz]);
    }

    // ojos: parpadeo, felices (^ ^) y grandes del susto
    const abre = clamp(F[K.ojo]) * lerp(1, 0.08, cierre);
    const ve = Math.max(0.001, 1 - suave(0.1, 0.8, F[K.feliz]));
    const g = 1 + F[K.ojoG];
    for (let i = 0; i < 2; i++) {
      ojos[i].scale.set(g * ve, Math.max(0.001, g * ve * abre), g * ve);
      felices[i].scale.setScalar(Math.max(0.001, suave(0.2, 0.9, F[K.feliz])));
      sustos[i].scale.setScalar(Math.max(0.001, F[K.susto]));
    }

    // nariz que olfatea y boca que mastica
    const mast = F[K.mastica] * Math.sin(reloj * TAU * 5.2);
    r = rp(H.nariz);
    nariz.position.set(r.x, r.y + 0.0028 * olfa * F[K.nariz] + 0.0018 * mast, r.z - 0.0012 * olfa * F[K.nariz]);
    nariz.rotation.set(-0.12 * olfa * F[K.nariz] + 0.1 * mast, 0, 0);

    cola.rotation.set(-F[K.cola] - 0.15 * Math.abs(colaMenea) * tranquilo, F[K.colaY] + 0.5 * colaMenea * tranquilo, 0);

    // patas (los huesos cuelgan de la raíz): en el piso o llevadas por el cuerpo
    cuerpo.updateMatrix();
    pecho.updateMatrix();
    cadera.updateMatrix();
    cabeza.updateMatrix();
    _mP.multiplyMatrices(cuerpo.matrix, pecho.matrix);
    _mC.multiplyMatrices(cuerpo.matrix, cadera.matrix);
    _qP.setFromRotationMatrix(_mP);
    _qC.setFromRotationMatrix(_mC);
    const pegaM = clamp(F[K.pegaM]), pegaT = clamp(F[K.pegaT]);
    for (let i = 0; i < 2; i++) {
      // manos
      const rm = rp(i ? H.manoD : H.manoI);
      const my = F[i ? K.mDy : K.mIy], mz = F[i ? K.mDz : K.mIz];
      _a.set(rm.x, rm.y + Math.max(0, my), rm.z + mz);
      _b.set(rm.x - pechoR[0], rm.y - pechoR[1] + my, rm.z - pechoR[2] + mz).applyMatrix4(_mP);
      manos[i].position.lerpVectors(_a, _b, pegaM);
      manos[i].position.y = Math.max(manos[i].position.y, rm.y);
      _q1.setFromEuler(_e.set(F[i ? K.mDa : K.mIa], 0, 0));
      _q2.copy(_qP).multiply(_q1);
      manos[i].quaternion.slerpQuaternions(_q1, _q2, pegaM);
      // pies (el hueso está en el talón)
      const rt = rp(i ? H.pieD : H.pieI);
      const ta = F[i ? K.tDa : K.tIa], ty = F[i ? K.tDy : K.tIy], tz = F[i ? K.tDz : K.tIz];
      _a.set(rt.x, rt.y + ty, rt.z + tz);
      _b.set(rt.x - caderaR[0], rt.y - caderaR[1] + ty, rt.z - caderaR[2] + tz).applyMatrix4(_mC);
      pies[i].position.lerpVectors(_a, _b, pegaT);
      _q1.setFromEuler(_e.set(ta, 0, 0));
      _q2.copy(_qC).multiply(_q1);
      pies[i].quaternion.slerpQuaternions(_q1, _q2, pegaT);
      // ni el talón ni los dedos bajo el piso
      const aPie = ta + pegaT * cuerpo.rotation.x;
      pies[i].position.y = Math.max(pies[i].position.y, rt.y - Math.sin(aPie) * PIE_LARGO, rt.y);
    }

    // la cabeza nunca atraviesa el piso (comiendo, por ejemplo)
    _m.multiplyMatrices(_mP, cabeza.matrix);
    let bajo = 1;
    for (const p of puntosCabeza) bajo = Math.min(bajo, _v.copy(p).applyMatrix4(_m).y);
    if (bajo < 0.008) cabeza.position.y += 0.008 - bajo;
  }

  function dispose() {
    root.removeFromParent();
    esqueleto.dispose();
  }

  update(0, { action: 'idle', speed: 0, t: 0 });
  return { root, update, dispose };
}
