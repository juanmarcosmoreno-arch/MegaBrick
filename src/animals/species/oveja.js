// =============================================================================
// Oveja — una ovejita de lana como una nube, para el mundo de Megabrick.
//
// La lana es UNA masa esponjosa: la unión suave de muchos bultos redondos
// alrededor de un elipsoide, en una sola superficie (con los pliegues entre
// bultos sombreados), así se lee como una nube y no como esferas sueltas.
// Adelante asoma una carita chiquita y redondeada con un copete de lana,
// orejitas caídas, patitas finas oscuras con pezuñas y una colita de lana.
//
// Toda la oveja es UNA malla con esqueleto (SkinnedMesh) y un solo material
// Lambert con colores por vértice: una llamada de dibujo por oveja. La
// geometría (con los pesos de cada hueso) se arma una vez por variante y la
// comparten todas las instancias; cada oveja tiene solo sus huesos. Los ojos
// felices (^ ^), los cachetes y los ojos normales son piezas de la misma malla
// que se muestran o se esconden escalando su hueso.
//
// No importa nada: THREE llega por parámetro.
// Ejes: mira hacia -Z, los pies apoyan en y = 0. 1 unidad = 1 bloque.
//
// Organización:
//   1. Utilidades             5. Piezas de la oveja
//   2. Variantes (colores)    6. Recursos compartidos (caché por variante)
//   3. Medidas y huesos       7. createModel (armado y animación)
//   4. Armado de geometría
// =============================================================================

export const info = {
  id: 'oveja',
  name: 'Oveja',
  variants: ['blanca', 'crema', 'gris', 'negra'],
  size: { width: 0.7, length: 0.95, height: 0.85 }, // medida: 0,68 × 0,98 × 0,84 en reposo
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

// Vector mínimo para las funciones puras (no necesitan THREE).
const vec = (x = 0, y = 0, z = 0) => ({
  x, y, z,
  set(a, b, c) {
    this.x = a;
    this.y = b;
    this.z = c;
    return this;
  },
});
const largo = (x, y, z) => Math.sqrt(x * x + y * y + z * z) || 1;

// =============================================================================
// 2. Variantes: lana, pliegues de la lana, cara (contrasta con la lana),
// adentro de las orejas, patas, pezuñas, nariz y boca.
// =============================================================================
const VARIANTES = [
  // blanca: lana de nube y carita color cacao
  { lana: '#f3eee4', pliegue: '#c4b8aa', cara: '#5c4841', orejaDentro: '#a87c76', pata: '#4a3b36', pezuna: '#2a2220', nariz: '#2e2320', boca: '#2a1f1c' },
  // crema: lana de vainilla y carita caramelo oscuro
  { lana: '#eddcb8', pliegue: '#c8b18c', cara: '#74503d', orejaDentro: '#b9877a', pata: '#523729', pezuna: '#2d1f18', nariz: '#36231a', boca: '#2c1c15' },
  // gris: lana de nube de tormenta y carita clarita
  { lana: '#aaa6a2', pliegue: '#78736f', cara: '#eee3d6', orejaDentro: '#e2b2a8', pata: '#4a4442', pezuna: '#282423', nariz: '#c08a80', boca: '#7a524b' },
  // negra: lana carbón (no negro puro) y carita beige
  { lana: '#4a4140', pliegue: '#2b2524', cara: '#e0cdbb', orejaDentro: '#d9a89e', pata: '#2e2726', pezuna: '#1b1716', nariz: '#b2756b', boca: '#6a443d' },
];
const OJO = { blanco: '#f7f2e6', iris: '#2b1d16', brillo: '#ffffff', feliz: '#2a1d18', rubor: '#e8928c' };

// =============================================================================
// 3. Medidas (espacio de la raíz, en la pose de reposo) y huesos
// =============================================================================
const LANA_C = [0, 0.475, 0.055]; // centro de la masa de lana
const LANA_EJES = [0.288, 0.2, 0.328]; // elipsoide de base (los bultos sobresalen)
const CUERPO_P = [0, 0.47, 0.055]; // hueso del cuerpo
const LANA_P = [0, 0.36, 0.055]; // pivote de la lana (respira y se aplasta desde abajo)
const CUELLO_P = [0, 0.44, -0.11]; // base del cuello (adentro de la lana)
const CABEZA_P = [0, 0.635, -0.305]; // fin del cuello y pivote de la cabeza
const CARA = { c: [0, 0.635, -0.358], a: 0.108, b: 0.126, p: 0.106, incl: 0.3 };
const COPETE_C = [0, 0.751, -0.335];
const OREJA_P = [0.09, 0.707, -0.322]; // la derecha (+X); la izquierda, espejada
const FELIZ_P = [0, 0.635, -0.345]; // adentro de la cabeza: ahí se esconden los ojos felices
const COLA_P = [0, 0.56, 0.39];
const COLA_C = [0, 0.535, 0.45];
const CADERA_Y = 0.31, MUSLO = 0.155, CANILLA = 0.155;
// patas: DI = delantera izquierda (su izquierda es -X), TD = trasera derecha…
const PATAS = [
  { n: 'DI', x: -0.145, z: -0.115, frente: true },
  { n: 'DD', x: 0.145, z: -0.115, frente: true },
  { n: 'TI', x: -0.145, z: 0.235, frente: false },
  { n: 'TD', x: 0.145, z: 0.235, frente: false },
];
// dónde van los rasgos en la cara (dirección en la esfera de la cara)
const RASGOS = { ojo: [0.47, 0.17], rubor: [0.66, -0.26], nariz: [0, -0.47] };

// Cara: elipsoide más angosto abajo, con el hocico un poco adelantado e inclinado.
const _cI = Math.cos(CARA.incl), _sI = Math.sin(CARA.incl);
function mapaCara(dx, dy, dz, out) {
  const k = 1 - 0.16 * suave(0.3, -1, dy);
  const x = dx * CARA.a * k, y = dy * CARA.b;
  let z = dz * CARA.p;
  if (dz < 0) z *= 1 + 0.18 * suave(0.1, -0.7, dy) * suave(0, -0.6, dz); // hocico
  return out.set(CARA.c[0] + x, CARA.c[1] + y * _cI - z * _sI, CARA.c[2] + y * _sI + z * _cI);
}
// ¿Está el punto adentro de la cara? (aproximado y conservador)
function dentroCara(x, y, z, margen) {
  x -= CARA.c[0];
  y -= CARA.c[1];
  z -= CARA.c[2];
  const yl = y * _cI + z * _sI, zl = -y * _sI + z * _cI;
  const dy = yl / CARA.b;
  const k = 1 - 0.16 * suave(0.3, -1, dy);
  return (x / (CARA.a * k)) ** 2 + dy * dy + (zl / CARA.p) ** 2 < 1 - margen;
}

// Normal de una superficie dada como mapa de la esfera unitaria (diferencias finitas).
const _n1 = vec(), _n2 = vec(), _n3 = vec(), _n4 = vec(), _n0 = vec();
function normalMapa(mapa, dx, dy, dz, cx, cy, cz, out, e = 0.004) {
  const usaX = Math.abs(dy) > 0.9;
  // u = a × d (a = Y, o X cerca de los polos), v = d × u
  let ux = usaX ? 0 : dz, uy = usaX ? -dz : 0, uz = usaX ? dy : -dx;
  let l = largo(ux, uy, uz);
  ux /= l; uy /= l; uz /= l;
  const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
  const P = (sx, sy, sz, o) => {
    const k = 1 / largo(sx, sy, sz);
    return mapa(sx * k, sy * k, sz * k, o);
  };
  P(dx + ux * e, dy + uy * e, dz + uz * e, _n1);
  P(dx - ux * e, dy - uy * e, dz - uz * e, _n2);
  P(dx + vx * e, dy + vy * e, dz + vz * e, _n3);
  P(dx - vx * e, dy - vy * e, dz - vz * e, _n4);
  const ax = _n1.x - _n2.x, ay = _n1.y - _n2.y, az = _n1.z - _n2.z;
  const bx = _n3.x - _n4.x, by = _n3.y - _n4.y, bz = _n3.z - _n4.z;
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  l = largo(nx, ny, nz);
  mapa(dx, dy, dz, _n0);
  if (nx * (_n0.x - cx) + ny * (_n0.y - cy) + nz * (_n0.z - cz) < 0) l = -l;
  return out.set(nx / l, ny / l, nz / l);
}

// Puntos de la cara para los rasgos: posición, normal, «arriba» y «costado» en
// el plano de la cara (costado = arriba × normal: hacia -X si mira a -Z).
function rasgoCara(dx, dy) {
  const dz = -Math.sqrt(Math.max(0.0001, 1 - dx * dx - dy * dy));
  const P = mapaCara(dx, dy, dz, vec());
  const N = normalMapa(mapaCara, dx, dy, dz, CARA.c[0], CARA.c[1], CARA.c[2], vec());
  // arriba proyectado en el plano tangente
  let ux = -N.y * N.x, uy = 1 - N.y * N.y, uz = -N.y * N.z;
  let l = largo(ux, uy, uz);
  const U = vec(ux / l, uy / l, uz / l);
  const X = vec(U.y * N.z - U.z * N.y, U.z * N.x - U.x * N.z, U.x * N.y - U.y * N.x);
  return { P, N, U, X };
}
// Lleva un punto cercano a la cara a su superficie (+ «alto» por la normal).
const _sp = vec(), _sn = vec();
function aSuperficie(px, py, pz, alto, out) {
  let x = px - CARA.c[0], y = py - CARA.c[1], z = pz - CARA.c[2];
  const yl = y * _cI + z * _sI, zl = -y * _sI + z * _cI;
  let dx = x / CARA.a, dy = yl / CARA.b, dz = zl / CARA.p;
  const l = largo(dx, dy, dz);
  dx /= l; dy /= l; dz /= l;
  mapaCara(dx, dy, dz, _sp);
  normalMapa(mapaCara, dx, dy, dz, CARA.c[0], CARA.c[1], CARA.c[2], _sn);
  return out.set(_sp.x + _sn.x * alto, _sp.y + _sn.y * alto, _sp.z + _sn.z * alto);
}

// Huesos: nombre, padre y posición de reposo (espacio de la raíz). Los ojos
// se ubican sobre la cara.
let HUESOS = null;
function huesos() {
  if (HUESOS) return HUESOS;
  const ojo = (s) => {
    const r = rasgoCara(s * RASGOS.ojo[0], RASGOS.ojo[1]);
    return [r.P.x, r.P.y, r.P.z];
  };
  const lista = [
    ['raiz', null, [0, 0, 0]],
    ['cuerpo', 'raiz', CUERPO_P],
    ['lana', 'cuerpo', LANA_P],
    ['cuelloBase', 'cuerpo', CUELLO_P],
    ['cuelloFin', 'cuelloBase', CABEZA_P],
    ['cabeza', 'cuelloFin', CABEZA_P],
    ['orejaI', 'cabeza', [-OREJA_P[0], OREJA_P[1], OREJA_P[2]]],
    ['orejaD', 'cabeza', OREJA_P],
    ['ojoI', 'cabeza', ojo(-1)],
    ['ojoD', 'cabeza', ojo(1)],
    ['pupilaI', 'ojoI', ojo(-1)],
    ['pupilaD', 'ojoD', ojo(1)],
    ['feliz', 'cabeza', FELIZ_P],
    ['cola', 'cuerpo', COLA_P],
  ];
  for (const p of PATAS) {
    lista.push(['muslo' + p.n, 'cuerpo', [p.x, CADERA_Y, p.z]]);
    lista.push(['canilla' + p.n, 'muslo' + p.n, [p.x, CADERA_Y - MUSLO, p.z]]);
  }
  const indice = {};
  lista.forEach(([n], i) => (indice[n] = i));
  HUESOS = { lista: lista.map(([n, padre, p]) => ({ n, padre: padre === null ? -1 : indice[padre], p })), i: indice };
  return HUESOS;
}

// =============================================================================
// 4. Armado de geometría: todo va a un acumulador (posición, normal, color y
// hasta dos huesos por vértice) que al final se vuelve una sola BufferGeometry.
// =============================================================================
const solo = (b) => [b, 1, 0, 0];
const entre = (a, b, t) => [a, 1 - t, b, t];

function crearArmado() {
  return { pos: [], nor: [], col: [], hue: [], pes: [], idx: [] };
}
function vertice(A, p, n, c, piel) {
  A.pos.push(p.x, p.y, p.z);
  A.nor.push(n.x, n.y, n.z);
  A.col.push(c.r, c.g, c.b);
  A.hue.push(piel[0], piel[2], 0, 0);
  A.pes.push(piel[1], piel[3], 0, 0);
  return A.pos.length / 3 - 1;
}

// Icosfera (indexada, vértices compartidos): 20·n² triángulos.
const ICO = new Map();
function icosfera(n) {
  if (ICO.has(n)) return ICO.get(n);
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const dirs = [], tris = [], mapa = new Map();
  const punto = (x, y, z) => {
    const l = largo(x, y, z);
    x /= l; y /= l; z /= l;
    const k = `${Math.round(x * 2e4)},${Math.round(y * 2e4)},${Math.round(z * 2e4)}`;
    let i = mapa.get(k);
    if (i === undefined) {
      i = dirs.length / 3;
      dirs.push(x, y, z);
      mapa.set(k, i);
    }
    return i;
  };
  for (const [ia, ib, ic] of F) {
    const A = V[ia], B = V[ib], C = V[ic];
    const g = [];
    for (let i = 0; i <= n; i++) {
      g[i] = [];
      for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n;
        g[i][j] = punto(A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * v, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * v, A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * v);
      }
    }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - i; j++) {
        tris.push(g[i][j], g[i + 1][j], g[i][j + 1]);
        if (j < n - i - 1) tris.push(g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]);
      }
  }
  // que todos los triángulos miren para afuera
  for (let k = 0; k < tris.length; k += 3) {
    const a = tris[k] * 3, b = tris[k + 1] * 3, c = tris[k + 2] * 3;
    const ux = dirs[b] - dirs[a], uy = dirs[b + 1] - dirs[a + 1], uz = dirs[b + 2] - dirs[a + 2];
    const vx = dirs[c] - dirs[a], vy = dirs[c + 1] - dirs[a + 1], vz = dirs[c + 2] - dirs[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * dirs[a] + ny * dirs[a + 1] + nz * dirs[a + 2] < 0) [tris[k + 1], tris[k + 2]] = [tris[k + 2], tris[k + 1]];
  }
  const r = { dirs, tris };
  ICO.set(n, r);
  return r;
}

// Superficie dada como mapa de la esfera unitaria → malla (icosfera deformada).
// colorDe(d, p) se llama justo después de mapear d (puede leer el estado del mapa).
// descartar(p): los triángulos con los tres vértices «descartados» no van.
function formaMapa(A, n, mapa, centro, colorDe, pielDe, descartar = null) {
  const { dirs, tris } = icosfera(n);
  const nv = dirs.length / 3;
  const ps = new Float64Array(nv * 3);
  const p = vec(), nn = vec();
  for (let i = 0; i < nv; i++) {
    mapa(dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2], p);
    ps[i * 3] = p.x;
    ps[i * 3 + 1] = p.y;
    ps[i * 3 + 2] = p.z;
  }
  const quedan = [];
  for (let k = 0; k < tris.length; k += 3) {
    if (descartar && [0, 1, 2].every((o) => descartar(ps[tris[k + o] * 3], ps[tris[k + o] * 3 + 1], ps[tris[k + o] * 3 + 2]))) continue;
    quedan.push(tris[k], tris[k + 1], tris[k + 2]);
  }
  // orientación: si el mapa espeja, se dan vuelta los triángulos
  let o = 0;
  for (let k = 0; k < quedan.length; k += 3) {
    const a = quedan[k] * 3, b = quedan[k + 1] * 3, c = quedan[k + 2] * 3;
    const ux = ps[b] - ps[a], uy = ps[b + 1] - ps[a + 1], uz = ps[b + 2] - ps[a + 2];
    const vx = ps[c] - ps[a], vy = ps[c + 1] - ps[a + 1], vz = ps[c + 2] - ps[a + 2];
    o += (uy * vz - uz * vy) * (ps[a] - centro[0]) + (uz * vx - ux * vz) * (ps[a + 1] - centro[1]) + (ux * vy - uy * vx) * (ps[a + 2] - centro[2]);
  }
  const nuevo = new Int32Array(nv).fill(-1);
  for (let k = 0; k < quedan.length; k++) {
    const i = quedan[k];
    if (nuevo[i] < 0) {
      const dx = dirs[i * 3], dy = dirs[i * 3 + 1], dz = dirs[i * 3 + 2];
      mapa(dx, dy, dz, p);
      const c = colorDe(dx, dy, dz, p);
      normalMapa(mapa, dx, dy, dz, centro[0], centro[1], centro[2], nn);
      nuevo[i] = vertice(A, p, nn, c, pielDe(p, dx, dy, dz));
    }
  }
  for (let k = 0; k < quedan.length; k += 3) {
    const a = nuevo[quedan[k]], b = nuevo[quedan[k + 1]], c = nuevo[quedan[k + 2]];
    if (o >= 0) A.idx.push(a, b, c);
    else A.idx.push(a, c, b);
  }
}

// Lana: unión suave (softmax) de un elipsoide y bultos esféricos, vista desde
// el centro (cada dirección → distancia a la superficie). Deja en «estado» el
// pliegue (1 = entre dos bultos) y el bulto dominante, para pintar.
function crearLana(C, ejes, bultos, kappa = 70) {
  const nb = bultos.length;
  const vals = new Float64Array(nb + 1);
  for (const b of bultos) b.q2 = b.x * b.x + b.y * b.y + b.z * b.z;
  const estado = { pliegue: 0, dom: -1 };
  const mapa = (dx, dy, dz, out) => {
    const tE = 1 / Math.sqrt((dx / ejes[0]) ** 2 + (dy / ejes[1]) ** 2 + (dz / ejes[2]) ** 2);
    vals[0] = tE;
    let m1 = tE, m2 = 0, i1 = -1;
    for (let k = 0; k < nb; k++) {
      const b = bultos[k];
      const bb = dx * b.x + dy * b.y + dz * b.z;
      const disc = bb * bb - (b.q2 - b.r * b.r);
      const tk = disc > 0 ? bb + Math.sqrt(disc) : 0;
      vals[k + 1] = tk;
      if (tk > m1) {
        m2 = m1;
        m1 = tk;
        i1 = k;
      } else if (tk > m2) m2 = tk;
    }
    let s = 0;
    for (let k = 0; k <= nb; k++) if (vals[k] > 0) s += Math.exp(kappa * (vals[k] - m1));
    const t = m1 + Math.log(s) / kappa;
    estado.pliegue = Math.exp(-(m1 - m2) / 0.011);
    estado.dom = i1;
    return out.set(C[0] + dx * t, C[1] + dy * t, C[2] + dz * t);
  };
  return { mapa, estado };
}
// Bultos repartidos sobre un elipsoide (espiral de Fibonacci con un poco de
// azar); cada uno sobresale «sale» por arriba del elipsoide.
function bultosSobre(r, ejes, n, rMin, rMax, saleMin, saleMax) {
  const lista = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y0 = clamp(1 - (2 * (i + 0.5)) / n + (r() - 0.5) * 0.1, -1, 1);
    const rad = Math.sqrt(1 - y0 * y0);
    const ph = i * ga + (r() - 0.5) * 0.6;
    let dx = Math.cos(ph) * rad, dy = y0, dz = Math.sin(ph) * rad;
    const tE = 1 / Math.sqrt((dx / ejes[0]) ** 2 + (dy / ejes[1]) ** 2 + (dz / ejes[2]) ** 2);
    const rr = lerp(rMin, rMax, r()) * lerp(0.85, 1.08, (dy + 1) / 2);
    const q = tE + lerp(saleMin, saleMax, r()) - rr;
    lista.push({ x: dx * q, y: dy * q, z: dz * q, r: rr, tinte: (r() - 0.5) * 0.07 });
  }
  return lista;
}

// Tubo por una lista de puntos. radio(i, ang), colorDe(i, ang), pielDe(i).
// ref: vector de referencia para orientar los anillos.
function tubo(A, pts, nRad, radio, colorDe, pielDe, ref, tapaIni = false, tapaFin = false, tapaK = 0.9) {
  const n = pts.length, anillo = nRad + 1, base = A.pos.length / 3;
  const T = vec(), N = vec(), B = vec(), p = vec(), q = vec();
  const marco = (i) => {
    const a = pts[Math.min(n - 1, i + 1)], b = pts[Math.max(0, i - 1)];
    let l = largo(a.x - b.x, a.y - b.y, a.z - b.z);
    T.set((a.x - b.x) / l, (a.y - b.y) / l, (a.z - b.z) / l);
    const d = ref.x * T.x + ref.y * T.y + ref.z * T.z;
    N.set(ref.x - T.x * d, ref.y - T.y * d, ref.z - T.z * d);
    l = largo(N.x, N.y, N.z);
    N.set(N.x / l, N.y / l, N.z / l);
    B.set(T.y * N.z - T.z * N.y, T.z * N.x - T.x * N.z, T.x * N.y - T.y * N.x);
  };
  for (let i = 0; i < n; i++) {
    marco(i);
    for (let j = 0; j <= nRad; j++) {
      const a = (j / nRad) * TAU, co = Math.cos(a), si = Math.sin(a), rr = radio(i, a);
      q.set(N.x * co + B.x * si, N.y * co + B.y * si, N.z * co + B.z * si);
      p.set(pts[i].x + q.x * rr, pts[i].y + q.y * rr, pts[i].z + q.z * rr);
      vertice(A, p, q, colorDe(i, a), pielDe(i));
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < nRad; j++) {
      const a = base + i * anillo + j, b = a + anillo, c = b + 1, d = a + 1;
      A.idx.push(a, d, b, d, c, b);
    }
  if (tapaIni) {
    marco(0);
    const r0 = radio(0, 0) * tapaK;
    p.set(pts[0].x - T.x * r0, pts[0].y - T.y * r0, pts[0].z - T.z * r0);
    q.set(-T.x, -T.y, -T.z);
    const polo = vertice(A, p, q, colorDe(0, 0), pielDe(0));
    for (let j = 0; j < nRad; j++) A.idx.push(base + j + 1, base + j, polo);
  }
  if (tapaFin) {
    marco(n - 1);
    const r0 = radio(n - 1, 0) * tapaK, u = pts[n - 1];
    p.set(u.x + T.x * r0, u.y + T.y * r0, u.z + T.z * r0);
    q.set(T.x, T.y, T.z);
    const polo = vertice(A, p, q, colorDe(n - 1, 0), pielDe(n - 1));
    const b0 = base + (n - 1) * anillo;
    for (let j = 0; j < nRad; j++) A.idx.push(b0 + j, b0 + j + 1, polo);
  }
}

// Domo (casquete de elipsoide) apoyado en P, mirando hacia N; U = arriba en el
// plano, X = U × N. anillos: radios relativos (el último = 1, el borde).
function domo(A, P, N, U, X, rx, ry, h, segs, anillos, color, piel, hundir = 0) {
  const p = vec(), q = vec();
  const pone = (lx, ly, lz, nx, ny, nz) => {
    p.set(P.x + X.x * lx + U.x * ly + N.x * lz, P.y + X.y * lx + U.y * ly + N.y * lz, P.z + X.z * lx + U.z * ly + N.z * lz);
    const l = largo(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    q.set(X.x * nx + U.x * ny + N.x * nz, X.y * nx + U.y * ny + N.y * nz, X.z * nx + U.z * ny + N.z * nz);
    return vertice(A, p, q, color, piel);
  };
  const centro = pone(0, 0, h - hundir, 0, 0, 1);
  const filas = anillos.map((rho) => {
    const z = h * Math.sqrt(Math.max(0, 1 - rho * rho)) - hundir;
    const fila = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU, co = Math.cos(a), si = Math.sin(a);
      fila.push(pone(rho * co * rx, rho * si * ry, z, (rho * co) / rx, (rho * si) / ry, Math.sqrt(Math.max(0.02, 1 - rho * rho)) / h));
    }
    return fila;
  });
  for (let j = 0; j < segs; j++) A.idx.push(centro, filas[0][j], filas[0][(j + 1) % segs]);
  for (let f = 0; f + 1 < filas.length; f++)
    for (let j = 0; j < segs; j++) {
      const a0 = filas[f][j], a1 = filas[f][(j + 1) % segs], b0 = filas[f + 1][j], b1 = filas[f + 1][(j + 1) % segs];
      A.idx.push(a0, b0, b1, a0, b1, a1);
    }
}

function aGeometria(THREE, A) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(A.hue, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(A.pes, 4));
  geo.setIndex(A.idx);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// =============================================================================
// 5. Piezas de la oveja
// =============================================================================
function armarOveja(THREE, vi) {
  const V = VARIANTES[vi];
  const H = huesos().i;
  const col = (hex) => new THREE.Color(hex);
  const K = {};
  for (const k in V) K[k] = col(V[k]);
  for (const k in OJO) K[k] = col(OJO[k]);
  const A = crearArmado();
  const r = azar(4242 + vi * 977);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

  // --- Lana del cuerpo: una nube ---
  const bultos = bultosSobre(r, LANA_EJES, 30, 0.115, 0.15, 0.042, 0.062);
  const lana = crearLana(LANA_C, LANA_EJES, bultos);
  const pintaLana = (pl, dom, dy, base = K.lana, sombra = K.pliegue) => {
    c.copy(base);
    if (dom >= 0) c.multiplyScalar(1 + bultos[dom].tinte * (1 - pl));
    c.lerp(sombra, Math.min(0.85, pl * 0.8 + 0.4 * suave(-0.15, -0.95, dy)));
    return c;
  };
  formaMapa(A, 8, lana.mapa, LANA_C, (dx, dy) => pintaLana(lana.estado.pliegue, lana.estado.dom, dy), () => solo(H.lana));

  // --- Cuello de lana con bultos (adentro de la lana; se estira al pastar):
  // anillos gruesos y finos alternados, con el pliegue más oscuro ---
  {
    const pts = [], n = 7;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts.push(vec(lerp(CUELLO_P[0], CABEZA_P[0], t), lerp(CUELLO_P[1], CABEZA_P[1], t), lerp(CUELLO_P[2], CABEZA_P[2], t)));
    }
    const fino = (i) => (i % 2 === 1 && i < n - 1 ? 1 : 0);
    const bulto = (i, a) => Math.sin(a * 3 + i * 2.1) * 0.6 + Math.sin(a * 5 + i * 1.3 + 1) * 0.4;
    tubo(A, pts, 8, (i, a) => lerp(0.104, 0.08, i / (n - 1)) * (1 - 0.16 * fino(i)) * (1 + 0.07 * bulto(i, a) * (1 - fino(i))),
      (i, a) => pintaLana(fino(i) * 0.75 + 0.15 * clamp(0.3 - bulto(i, a)), -1, 0.15),
      (i) => entre(H.cuelloBase, H.cuelloFin, i / (n - 1)), vec(0, 1, 0));
  }

  // --- Colita de lana que cuelga ---
  {
    const bc = [
      { x: 0, y: 0.022, z: -0.008, r: 0.036 },
      { x: 0, y: -0.004, z: 0.008, r: 0.034 },
      { x: 0, y: -0.03, z: 0.01, r: 0.028 },
      { x: 0.017, y: 0.008, z: 0.002, r: 0.027 },
      { x: -0.017, y: 0.008, z: 0.002, r: 0.027 },
    ];
    const cola = crearLana(COLA_C, [0.026, 0.042, 0.024], bc, 110);
    formaMapa(A, 2, cola.mapa, COLA_C, (dx, dy) => pintaLana(cola.estado.pliegue, -1, dy * 0.5), () => solo(H.cola));
  }

  // --- Cara ---
  formaMapa(A, 3, mapaCara, CARA.c, (dx, dy, dz) => {
    c.copy(K.cara);
    // hocico apenas más claro
    c.lerp(tmp.copy(K.cara).multiplyScalar(1.12), suave(-0.1, -0.8, dy) * suave(0, -0.7, dz) * 0.6);
    return c;
  }, () => solo(H.cabeza));

  // --- Copete de lana (sin lo que queda adentro de la cara) ---
  {
    const bc = [
      [0, 0.04, -0.005, 0.052], [-0.05, 0.022, -0.03, 0.044], [0.05, 0.022, -0.03, 0.044],
      [0, 0.012, -0.06, 0.042], [-0.03, -0.004, -0.064, 0.035], [0.03, -0.004, -0.064, 0.035],
      [-0.072, 0.004, 0.012, 0.04], [0.072, 0.004, 0.012, 0.04], [0, 0.018, 0.052, 0.048],
      [-0.042, 0.03, 0.038, 0.042], [0.042, 0.03, 0.038, 0.042],
    ].map(([x, y, z, rr]) => ({ x, y, z, r: rr }));
    const cop = crearLana(COPETE_C, [0.078, 0.036, 0.068], bc, 110);
    formaMapa(A, 3, cop.mapa, COPETE_C, (dx, dy) => pintaLana(cop.estado.pliegue, -1, dy * 0.25), () => solo(H.cabeza),
      (x, y, z) => dentroCara(x, y, z, 0.1));
  }

  // --- Orejas caídas (hoja ovalada, con el adentro rosado mirando adelante) ---
  for (const s of [-1, 1]) {
    const B = vec(s * OREJA_P[0], OREJA_P[1], OREJA_P[2]);
    let lx = s * 0.86, ly = -0.5, lz = 0.12;
    let l = largo(lx, ly, lz);
    const L = vec(lx / l, ly / l, lz / l);
    // grosor: hacia adelante (ortogonal a L); ancho: L × T
    let tx = 0, ty = 0, tz = -1;
    const d = tz * L.z;
    tx -= L.x * d; ty -= L.y * d; tz -= L.z * d;
    l = largo(tx, ty, tz);
    const T = vec(tx / l, ty / l, tz / l);
    const W = vec(L.y * T.z - L.z * T.y, L.z * T.x - L.x * T.z, L.x * T.y - L.y * T.x);
    const mapa = (dx, dy, dz, out) => {
      const a = 0.05 + 0.066 * dy; // a lo largo (la base queda adentro de la cabeza)
      const w = 0.032 * dx * (0.72 + 0.3 * dy);
      const g = 0.0105 * dz - 0.006 * (1 - dx * dx) * suave(-0.6, 0.4, dy); // ahuecada adelante
      return out.set(B.x + L.x * a + W.x * w + T.x * g, B.y + L.y * a + W.y * w + T.y * g, B.z + L.z * a + W.z * w + T.z * g);
    };
    const centro = [B.x + L.x * 0.05, B.y + L.y * 0.05, B.z + L.z * 0.05];
    formaMapa(A, 2, mapa, centro, (dx, dy, dz) => c.copy(K.cara).lerp(K.orejaDentro, suave(0.1, 0.7, dz) * suave(-0.7, -0.1, dy) * suave(0.98, 0.5, dy) * 0.85),
      () => solo(s < 0 ? H.orejaI : H.orejaD));
  }

  // --- Ojos: blanco, iris grande y brillito (el iris y el brillo, en la pupila) ---
  for (const s of [-1, 1]) {
    const { P, N, U, X } = rasgoCara(s * RASGOS.ojo[0], RASGOS.ojo[1]);
    const ojo = s < 0 ? H.ojoI : H.ojoD, pup = s < 0 ? H.pupilaI : H.pupilaD;
    domo(A, P, N, U, X, 0.029, 0.034, 0.012, 10, [0.6, 1], K.blanco, solo(ojo), 0.005);
    const Pi = vec(P.x + N.x * 0.0035 - U.x * 0.002, P.y + N.y * 0.0035 - U.y * 0.002, P.z + N.z * 0.0035 - U.z * 0.002);
    domo(A, Pi, N, U, X, 0.022, 0.027, 0.01, 10, [0.6, 1], K.iris, solo(pup), 0.004);
    // brillitos arriba, hacia el mismo lado en los dos ojos
    const Pb = vec(Pi.x + N.x * 0.0075 + U.x * 0.0095 + X.x * 0.007, Pi.y + N.y * 0.0075 + U.y * 0.0095 + X.y * 0.007, Pi.z + N.z * 0.0075 + U.z * 0.0095 + X.z * 0.007);
    domo(A, Pb, N, U, X, 0.008, 0.009, 0.003, 6, [1], K.brillo, solo(pup), 0);
  }

  // --- Ojos felices (^ ^) y cachetes: en el hueso «feliz» (escondidos adentro de la cabeza) ---
  for (const s of [-1, 1]) {
    const { P, U, X } = rasgoCara(s * RASGOS.ojo[0], RASGOS.ojo[1]);
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const a = lerp(0.3, Math.PI - 0.3, i / 4);
      const R = 0.022;
      const qx = P.x - U.x * 0.007 + (X.x * Math.cos(a) + U.x * Math.sin(a)) * R;
      const qy = P.y - U.y * 0.007 + (X.y * Math.cos(a) + U.y * Math.sin(a)) * R;
      const qz = P.z - U.z * 0.007 + (X.z * Math.cos(a) + U.z * Math.sin(a)) * R;
      pts.push(aSuperficie(qx, qy, qz, 0.003, vec()));
    }
    tubo(A, pts, 4, () => 0.006, () => K.feliz, () => solo(H.feliz), vec(0, 0, -1), true, true);
    const rb = rasgoCara(s * RASGOS.rubor[0], RASGOS.rubor[1]);
    domo(A, rb.P, rb.N, rb.U, rb.X, 0.024, 0.015, 0.004, 9, [1], K.rubor, solo(H.feliz), 0.0015);
  }

  // --- Nariz y boquita en «w» ---
  {
    const { P, N, U, X } = rasgoCara(0, RASGOS.nariz[1]);
    domo(A, P, N, U, X, 0.027, 0.017, 0.008, 10, [0.6, 1], K.nariz, solo(H.cabeza), 0.002);
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const x = lerp(-0.022, 0.022, i / 5);
      const y = -0.024 - 0.008 * Math.sin((Math.PI * Math.abs(x)) / 0.022);
      pts.push(aSuperficie(P.x + X.x * x + U.x * y, P.y + X.y * x + U.y * y, P.z + X.z * x + U.z * y, 0.0012, vec()));
    }
    tubo(A, pts, 3, () => 0.0034, () => K.boca, () => solo(H.cabeza), vec(0, 0, -1), true, true);
  }

  // --- Patas finitas con pezuña ---
  for (const pt of PATAS) {
    const mus = H['muslo' + pt.n], can = H['canilla' + pt.n];
    const rod = CADERA_Y - MUSLO;
    const anillos = [
      [CADERA_Y, 0.032, 'pata', solo(mus)],
      [rod + 0.045, 0.031, 'pata', solo(mus)],
      [rod, 0.0295, 'pata', entre(mus, can, 0.5)],
      [0.052, 0.0275, 'pata', solo(can)],
      [0.045, 0.032, 'pezuna', solo(can)],
      [0.009, 0.0335, 'pezuna', solo(can)],
    ];
    tubo(A, anillos.map(([y]) => vec(pt.x, y, pt.z)), 6, (i) => anillos[i][1], (i) => K[anillos[i][2]], (i) => anillos[i][3], vec(0, 0, -1), false, true, 0.22);
  }

  return aGeometria(THREE, A);
}

// =============================================================================
// 6. Recursos compartidos: geometría por variante y un solo material para todas
// (nunca se liberan desde una instancia).
// =============================================================================
const CACHE = { mat: null, geo: [] };
let instancias = 0;

function recursos(THREE, vi) {
  if (!CACHE.mat) CACHE.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (!CACHE.geo[vi]) CACHE.geo[vi] = armarOveja(THREE, vi);
  return { geo: CACHE.geo[vi], mat: CACHE.mat };
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
// desfase de cada pata en el ciclo [DI, DD, TI, TD]: paso (lateral) y galope
const DESF_PASO = [0.25, 0.75, 0, 0.5];
const DESF_CORRE = [0, 0.1, 0.5, 0.6];
const DESF_NADO = [0, 0.5, 0.5, 0];
// pose de pastar
const COME = { cuello: -1.2, estira: 1.25, cabeza: 0.06 };

export function createModel(THREE, { variant = 0 } = {}) {
  const vi = indiceVariante(variant);
  const { geo, mat } = recursos(THREE, vi);
  const HB = huesos();

  const root = new THREE.Group();
  root.name = 'oveja';
  const B = HB.lista.map((def) => {
    const b = new THREE.Bone();
    b.name = def.n;
    return b;
  });
  HB.lista.forEach((def, i) => {
    const pp = def.padre >= 0 ? HB.lista[def.padre].p : [0, 0, 0];
    B[i].position.set(def.p[0] - pp[0], def.p[1] - pp[1], def.p[2] - pp[2]);
    if (def.padre >= 0) B[def.padre].add(B[i]);
  });
  const malla = new THREE.SkinnedMesh(geo, mat);
  malla.name = 'ovejaMalla';
  malla.add(B[0]);
  root.add(malla);
  root.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(B);
  malla.bind(esqueleto);
  // esfera fija generosa (saltos, cuello estirado): evita recalcular la piel en la CPU
  malla.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.48, -0.04), 0.82);
  malla.boundingBox = new THREE.Box3(new THREE.Vector3(-0.42, -0.02, -0.75), new THREE.Vector3(0.42, 1.1, 0.55));

  const h = (n) => B[HB.i[n]];
  const cuerpo = h('cuerpo'), lana = h('lana'), cuelloBase = h('cuelloBase'), cuelloFin = h('cuelloFin'), cabeza = h('cabeza');
  const orejas = [h('orejaI'), h('orejaD')], ojos = [h('ojoI'), h('ojoD')], pupilas = [h('pupilaI'), h('pupilaD')];
  const feliz = h('feliz'), cola = h('cola');
  const finCuello = cuelloFin.position.clone(); // largo del cuello en reposo
  const patas = PATAS.map((p, i) => ({
    ...p, i,
    muslo: h('muslo' + p.n), canilla: h('canilla' + p.n),
    cadera: new THREE.Vector3(p.x - CUERPO_P[0], CADERA_Y - CUERPO_P[1], p.z - CUERPO_P[2]),
  }));
  // puntos de la cabeza que no pueden atravesar el piso (relativos al hueso de la cabeza)
  const puntosCabeza = [
    [0, -0.62, -0.78], [0, -1, 0], [0.5, -0.75, -0.43], [-0.5, -0.75, -0.43],
  ].map(([dx, dy, dz]) => {
    const l = largo(dx, dy, dz);
    const p = mapaCara(dx / l, dy / l, dz / l, vec());
    return new THREE.Vector3(p.x - CABEZA_P[0], p.y - CABEZA_P[1], p.z - CABEZA_P[2]);
  });
  // punta de las orejas, relativas a la cabeza
  const puntasOreja = [-1, 1].map((s) => {
    const L = new THREE.Vector3(s * 0.86, -0.5, 0.12).normalize();
    return new THREE.Vector3(s * OREJA_P[0], OREJA_P[1], OREJA_P[2]).addScaledVector(L, 0.1).sub(new THREE.Vector3(...CABEZA_P));
  });

  // --- estado ---
  const sem = instancias++;
  const rnd = azar(9137 + sem * 7919);
  const fase0 = rnd() * TAU; // cada oveja respira a su ritmo
  const w = { idle: 1, walk: 0, eat: 0, happy: 0, scared: 0, swim: 0 };
  const wn = { idle: 1, walk: 0, eat: 0, happy: 0, scared: 0, swim: 0 };
  let accion = 'idle', tAccion = 0, tFeliz = 9, tSusto = 9, reloj = 0;
  let vel = 0, fase = rnd(), faseNado = rnd();
  let proxParpadeo = 0.6 + rnd() * 2.5, parpadeoT = -1, doble = false;
  let proxOreja = 1 + rnd() * 3, orejaT = -1, orejaCual = 0;
  let proxCola = 2 + rnd() * 4, colaT = -1;
  let proxMirada = rnd() * 2, mirY = 0, mirP = 0, mirR = 0, objY = 0, objP = 0, objR = 0;
  let lookY = 0, lookP = 0;
  let prevY = null, prevV = 0, aplasta = 0, aplastaV = 0;
  const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
  const _v = new THREE.Vector3(), _obj = new THREE.Vector3();

  // Cinemática inversa de dos huesos: lleva la pezuña al punto «obj» (espacio de
  // la raíz). Si la canilla queda inclinada, el borde de la pezuña bajaría: se
  // sube el objetivo lo justo y se resuelve otra vez.
  function resolver(pata, obj) {
    _v.copy(obj).applyMatrix4(_inv).sub(pata.cadera);
    const lat = Math.hypot(_v.x, _v.y);
    let D = _v.length();
    const ax0 = Math.atan2(-_v.z, lat);
    const az = Math.atan2(_v.x, -_v.y);
    const Lmax = (MUSLO + CANILLA) * 0.995;
    let k = 1;
    if (D > Lmax) {
      k = D / Lmax; // estira apenas la canilla (no se nota en una pata finita)
      D = Lmax;
    }
    D = Math.max(D, 0.06);
    const al = Math.acos(clamp((MUSLO * MUSLO + D * D - CANILLA * CANILLA) / (2 * MUSLO * D), -1, 1));
    const be = Math.acos(clamp((MUSLO * MUSLO + CANILLA * CANILLA - D * D) / (2 * MUSLO * CANILLA), -1, 1));
    const dobla = Math.PI - be;
    // las de adelante doblan la rodilla hacia adelante; las de atrás, el garrón hacia atrás
    const s = pata.frente ? 1 : -1;
    pata.muslo.rotation.set(ax0 + s * al, 0, az, 'ZXY');
    pata.canilla.rotation.set(-s * dobla, 0, 0);
    pata.canilla.position.y = -MUSLO * k;
    pata.canilla.scale.y = k;
    return ax0 + s * al - s * dobla; // inclinación de la canilla (respecto del cuerpo)
  }
  function apoyar(pata, obj, inclCuerpo) {
    const incl = resolver(pata, obj) + inclCuerpo;
    const baja = 0.03 * Math.abs(Math.sin(incl)) - 0.002;
    if (baja > 0.0005) {
      obj.y += baja;
      resolver(pata, obj);
    }
  }

  // Punto más bajo de la cabeza (orejas incluidas) con la pose actual.
  function bajoCabeza() {
    cuelloBase.updateMatrix();
    cuelloFin.updateMatrix();
    cabeza.updateMatrix();
    _m.multiplyMatrices(cuerpo.matrix, cuelloBase.matrix).multiply(cuelloFin.matrix).multiply(cabeza.matrix);
    let min = Infinity;
    for (const p of puntosCabeza) min = Math.min(min, _v.copy(p).applyMatrix4(_m).y);
    for (let i = 0; i < 2; i++) {
      orejas[i].updateMatrix();
      _m2.multiplyMatrices(_m, orejas[i].matrix);
      _v.copy(puntasOreja[i]).sub(orejas[i].position).applyMatrix4(_m2);
      min = Math.min(min, _v.y);
    }
    return min;
  }

  function update(dt, estado) {
    estado = estado || {};
    dt = clamp(numero(dt), 0, 0.1);
    const pedida = ACCIONES.includes(estado.action) ? estado.action : 'idle';
    const speed = clamp(numero(estado.speed), 0, 12);
    reloj += dt;
    const t = numero(estado.t, reloj) + fase0;
    if (pedida !== accion) {
      accion = pedida;
      tAccion = 0;
    } else tAccion += dt;
    // relojes del saltito y del susto: siguen corriendo mientras se desvanecen
    tFeliz = accion === 'happy' ? tAccion : Math.min(tFeliz + dt, 60);
    tSusto = accion === 'scared' ? tAccion : Math.min(tSusto + dt, 60);

    // --- pesos de cada acción (transiciones de ~0,2 s; el susto, más rápido) ---
    let tot = 0;
    for (const a of ACCIONES) {
      const rap = a === accion && a === 'scared' ? 30 : 14;
      w[a] = amort(w[a], a === accion ? 1 : 0, rap, dt);
      tot += w[a];
    }
    for (const a of ACCIONES) wn[a] = w[a] / (tot || 1);
    const wI = wn.idle, wE = wn.eat, wH = wn.happy, wS = wn.scared, wN = wn.swim;
    const suelo = 1 - wN;

    // --- marcha: la pezuña apoyada va para atrás exactamente a la velocidad ---
    vel = amort(vel, speed, 8, dt);
    const corre = suave(2.6, 4.6, vel);
    const apoyo = lerp(0.62, 0.4, corre); // fracción del ciclo con la pata en el piso
    const pasoMax = lerp(0.24, 0.36, corre);
    const frec = Math.max(1.2 + 0.5 * vel, (vel * apoyo) / pasoMax);
    const paso = (vel * apoyo) / frec; // recorrido de la pezuña apoyada
    const alza = Math.min(0.07, 0.025 + vel * 0.01) * suave(0.03, 0.4, vel);
    const mov = suave(0.03, 0.5, vel) * suelo;
    fase = frac(fase + frec * dt);
    const c4 = Math.cos(2 * TAU * fase), s2 = Math.sin(TAU * fase);

    // --- saltito feliz (agacharse, saltar con las cuatro patas, aterrizar) ---
    let salto = 0, enAire = 0;
    {
      const u = tFeliz % 0.9;
      if (u < 0.15) salto = -0.028 * Math.sin((Math.PI * u) / 0.15);
      else if (u < 0.7) {
        enAire = Math.sin((Math.PI * (u - 0.15)) / 0.55);
        salto = 0.12 * enAire;
      } else salto = -0.032 * Math.sin((Math.PI * (u - 0.7)) / 0.2);
    }
    // --- respingo del susto ---
    let brinco = 0, enAireS = 0;
    if (tSusto < 0.42) {
      enAireS = Math.sin((Math.PI * tSusto) / 0.42);
      brinco = 0.15 * enAireS;
    } else if (tSusto < 0.62) brinco = -0.035 * Math.sin((Math.PI * (tSusto - 0.42)) / 0.2);
    else brinco = -0.008;
    const sacude = Math.exp(-Math.max(0, tSusto - 0.08) * 2.4) + 0.12; // la lana se sacude y queda temblando

    // --- cuerpo ---
    let cy = 0, cp = 0, cr = 0, cyaw = 0;
    cy += 0.003 * Math.sin(t * 1.9) * wI;
    cy += mov * lerp(0.008 * c4 - 0.004, 0.026 * (0.5 + 0.5 * c4) - 0.008, corre);
    cp += mov * corre * 0.06 * Math.sin(TAU * fase + 0.6);
    cr += mov * (1 - corre) * 0.03 * s2;
    cy += wE * -0.04;
    cp += wE * -0.15;
    cy += wH * salto;
    cyaw += wH * 0.09 * Math.sin(t * 9);
    cr += wH * 0.05 * Math.sin(t * 9 + 1);
    cy += wS * brinco;
    cp += wS * (0.14 * enAireS - 0.03);
    cr += wS * 0.03 * sacude * Math.sin(t * 41);
    cy += wN * 0.012 * Math.sin(t * 3.4);
    cp += wN * (0.06 + 0.02 * Math.sin(t * 3.4 + 1));
    cuerpo.position.set(CUERPO_P[0], CUERPO_P[1] + cy, CUERPO_P[2]);
    cuerpo.rotation.set(cp, cyaw, cr, 'YXZ');
    cuerpo.updateMatrix();
    _inv.copy(cuerpo.matrix).invert();

    // --- lana: respira, rebota al aterrizar (resorte) y se sacude con el susto ---
    const yc = cy;
    if (dt > 0) {
      if (prevY === null) prevY = yc;
      const vY = (yc - prevY) / dt;
      const aY = clamp((vY - prevV) / dt, -40, 40);
      prevY = yc;
      prevV = vY;
      const pasos = Math.ceil(dt / 0.017);
      const h2 = dt / pasos;
      for (let k = 0; k < pasos; k++) {
        aplastaV += (-260 * aplasta - 13 * aplastaV - aY * 0.55) * h2;
        aplasta = clamp(aplasta + aplastaV * h2, -0.12, 0.12);
      }
    }
    const resp = Math.sin(t * 2.1) * (0.5 + 0.5 * wI);
    const tiembla = wS * sacude;
    const sy = 1 + 0.009 * resp + aplasta - 0.07 * tiembla * Math.sin(t * 58);
    const sxz = 1 + 0.013 * resp - aplasta * 0.5 + 0.05 * tiembla * Math.sin(t * 58);
    lana.scale.set(sxz, sy, sxz);
    lana.rotation.set(0.05 * tiembla * Math.sin(t * 47 + 1), 0.05 * tiembla * Math.sin(t * 39), 0.09 * tiembla * Math.sin(t * 53));

    // --- patas ---
    for (const pata of patas) {
      const i = pata.i;
      // en el piso: la marcha (con saltitos)
      const u = frac(fase + lerp(DESF_PASO[i], DESF_CORRE[i], corre));
      let z, y;
      if (u < apoyo) {
        z = paso * (u / apoyo - 0.5);
        y = 0;
      } else {
        const k = (u - apoyo) / (1 - apoyo);
        z = paso * (0.5 - (k - Math.sin(TAU * k) / TAU));
        y = alza * Math.sin(Math.PI * k);
      }
      let x = pata.x;
      y += wH * Math.max(0, salto) * 0.85 + wS * Math.max(0, brinco) * 0.72;
      x += Math.sign(pata.x) * wS * (0.02 + 0.02 * enAireS); // patas abiertas del susto
      z += (pata.frente ? -1 : 1) * wS * 0.03 * enAireS;
      z -= wE * (pata.frente ? 0.02 : 0);
      // en el agua: remando
      const fn = TAU * (faseNado + DESF_NADO[i]);
      const zn = 0.075 * Math.sin(fn), yn = 0.12 - 0.055 * Math.cos(fn);
      _obj.set(lerp(x, pata.x * 0.95, wN), lerp(y + 0.003, yn, wN), pata.z + lerp(z, zn, wN));
      apoyar(pata, _obj, cp);
    }
    faseNado = frac(faseNado + dt * (1.5 + 0.35 * vel) * (0.2 + 0.8 * wN));

    // --- mirada (con tope) y paseo de la cabeza en reposo ---
    proxMirada -= dt;
    if (proxMirada < 0) {
      proxMirada = 1.8 + rnd() * 3.2;
      objY = (rnd() - 0.5) * 0.6;
      objP = (rnd() - 0.5) * 0.22;
      objR = (rnd() - 0.5) * 0.24;
    }
    mirY = amort(mirY, objY, 2.5, dt);
    mirP = amort(mirP, objP, 2.5, dt);
    mirR = amort(mirR, objR, 2.5, dt);
    lookY = amort(lookY, clamp(numero(estado.lookYaw), -1.0, 1.0), 10, dt);
    lookP = amort(lookP, clamp(numero(estado.lookPitch), -0.5, 0.6), 10, dt);
    const pesoMira = 1 - 0.85 * wE - 0.4 * wS;
    const paseo = wI * (1 - mov) * 0.8;

    // --- cuello y cabeza ---
    const pica = Math.max(0, Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 1.3)); // mordisquitos al pasto
    let np = mov * 0.035 * c4 + wE * (COME.cuello + 0.05 * pica) + wN * 0.3 + wS * 0.12 + wH * 0.06;
    const ne = 1 + wE * (COME.estira - 1 + 0.04 * pica) + wN * 0.1 - wS * 0.07;
    const hp = lookP * pesoMira + mirP * paseo + wE * (COME.cabeza - 0.09 * pica) - wN * 0.18 + wS * (0.2 * enAireS + 0.08) - mov * corre * 0.05 * Math.sin(TAU * fase + 0.6);
    const hy = lookY * pesoMira + mirY * paseo + wE * 0.16 * Math.sin(t * 0.7);
    const hr = mirR * paseo * 0.5 + wH * 0.17 * Math.sin(t * 6.5);
    cuelloBase.rotation.set(np, hy * 0.25, 0);
    cuelloFin.position.copy(finCuello).multiplyScalar(ne);
    cabeza.rotation.set(hp, hy * 0.75, hr, 'YXZ');

    // --- orejas ---
    proxOreja -= dt;
    if (proxOreja < 0 && orejaT < 0) {
      orejaT = 0;
      orejaCual = rnd() < 0.4 ? 2 : rnd() < 0.5 ? 0 : 1;
      proxOreja = 2.2 + rnd() * 4.5;
    }
    let sacudon = 0;
    if (orejaT >= 0) {
      orejaT += dt;
      sacudon = Math.sin(clamp(orejaT / 0.32) * Math.PI) * (0.7 + 0.3 * Math.sin(orejaT * 50));
      if (orejaT > 0.32) orejaT = -1;
    }
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const mia = orejaCual === 2 || orejaCual === i ? sacudon : 0;
      const alzar = wH * 0.45 + wS * 0.3 + wN * 0.25 - wE * 0.2 + mia * 0.45 - mov * (0.05 + 0.1 * Math.sin(2 * TAU * fase + i)) + 0.03 * Math.sin(t * 1.7 + i);
      const atras = wS * 1.05 + mia * 0.25 + wN * 0.3 + mov * corre * 0.4;
      orejas[i].rotation.set(0, -s * atras, s * alzar);
    }

    // el hocico y las orejas nunca atraviesan el piso
    for (let it = 0; it < 3; it++) {
      const bajo = bajoCabeza();
      if (bajo >= 0.012) break;
      np += Math.min(0.5, (0.012 - bajo) / 0.32);
      cuelloBase.rotation.x = np;
    }

    // --- cola ---
    proxCola -= dt;
    if (proxCola < 0 && colaT < 0) {
      colaT = 0;
      proxCola = 2.5 + rnd() * 5;
    }
    let menea = 0;
    if (colaT >= 0) {
      colaT += dt;
      menea = Math.sin(colaT * 30) * Math.sin(clamp(colaT / 0.8) * Math.PI);
      if (colaT > 0.8) colaT = -1;
    }
    const colaY = menea * 0.4 * (wI + wE) + wH * 0.55 * Math.sin(t * 24) + mov * 0.12 * s2 + wS * 0.15 * Math.sin(t * 40);
    const colaX = -wS * 0.55 - wN * 0.35 - wH * 0.25 + mov * 0.1 * c4;
    cola.rotation.set(colaX, colaY, 0);

    // --- ojos: parpadeo, felices (^ ^) y grandes del susto ---
    proxParpadeo -= dt;
    if (proxParpadeo < 0 && parpadeoT < 0) {
      parpadeoT = 0;
      if (doble) {
        doble = false;
        proxParpadeo = 1.6 + rnd() * 3.4;
      } else {
        doble = rnd() < 0.2;
        proxParpadeo = doble ? 0.24 : 1.6 + rnd() * 3.4;
      }
    }
    let cierre = 0;
    if (parpadeoT >= 0) {
      parpadeoT += dt;
      cierre = Math.sin(clamp(parpadeoT / 0.15) * Math.PI);
      if (parpadeoT > 0.15) parpadeoT = -1;
    }
    cierre *= 1 - wS * 0.8;
    cierre = Math.max(cierre, wE * 0.55); // pastando, entrecierra los ojos
    const ve = Math.max(0.001, 1 - wH);
    const grande = 1 + 0.24 * wS;
    for (let i = 0; i < 2; i++) {
      ojos[i].scale.set(grande * ve, grande * ve * lerp(1, 0.1, cierre), grande * ve);
      const pc = 1 - 0.22 * wS;
      pupilas[i].scale.set(pc * (1 + 0.3 * cierre), pc, pc);
    }
    feliz.scale.setScalar(Math.max(0.001, wH));
  }

  function dispose() {
    root.removeFromParent();
    esqueleto.dispose();
  }

  update(0, { action: 'idle', speed: 0, t: 0 });
  return { root, update, dispose };
}
