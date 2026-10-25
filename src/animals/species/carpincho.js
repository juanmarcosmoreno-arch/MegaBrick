// =============================================================================
// Carpincho — el roedor más grande del mundo y el más tranquilo de Megabrick.
//
// Cuerpo de barril, cabezota cuadrada de hocico romo y ancho, ojitos altos con
// los párpados a media asta (cara de «todo bien»), orejitas redondas, patas
// cortas y nada de cola. La variante «con benteveo» lleva un pajarito
// amarillo y negro posado en la cabeza, que mira para todos lados.
//
// Todo por código: piezas suaves (superelipsoides deformados) pintadas por
// vértice y fusionadas en UNA geometría con piel (skinning). La geometría y el
// material se comparten entre todos los carpinchos de la misma variante; cada
// instancia tiene solo sus huesos: una llamada de dibujo por carpincho.
//
// Ejes: mira hacia -Z, los pies apoyan en y = 0 y su izquierda es -X.
// 1 unidad = 1 bloque.
// =============================================================================

export const info = {
  id: 'carpincho',
  name: 'Carpincho',
  variants: ['canela', 'marrón', 'con benteveo'],
  size: { width: 0.6, length: 1.15, height: 0.75 },
};

// =============================================================================
// Utilidades
// =============================================================================
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
// smoothstep que también acepta bordes invertidos (a > b).
const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Acercamiento exponencial independiente de los FPS.
const amort = (actual, objetivo, rapidez, dt) => lerp(actual, objetivo, 1 - Math.exp(-rapidez * dt));
const numero = (x, def = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : def);

// Generador con semilla (mulberry32): cada carpincho tiene su propio azar.
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
// Ruidito para el pelaje (sale siempre igual para la misma posición).
function ruido(x, y, z) {
  let h = (Math.imul(Math.round(x * 60), 374761393) + Math.imul(Math.round(y * 60), 668265263) + Math.imul(Math.round(z * 60), 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Vectores como [x, y, z] (solo al armar la geometría, nunca por cuadro).
const suma = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const escala = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// Gira v alrededor del eje unitario e (Rodrigues).
function girar(v, e, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), d = punto(e, v) * (1 - c), x = cruz(e, v);
  return [v[0] * c + x[0] * s + e[0] * d, v[1] * c + x[1] * s + e[1] * d, v[2] * c + x[2] * s + e[2] * d];
}

// =============================================================================
// Paletas (sRGB; se pasan a lineal al pintar los vértices)
// =============================================================================
const CANELA = {
  pelo: '#b27c50', lomo: '#93623d', panza: '#c99d70', hocico: '#9a6d4b', nariz: '#66503f',
  narina: '#1f1612', pata: '#76533b', una: '#4a372b', orejaIn: '#80594a', ojo: '#1e140f',
  parpado: '#3b2a20', brillo: '#ffffff', cachete: '#ec9a8c', boca: '#5a3c2c', diente: '#f2ead8',
};
const MARRON = {
  ...CANELA,
  pelo: '#8a5a3a', lomo: '#6e452c', panza: '#a77a54', hocico: '#75513a', pata: '#5e4030',
  una: '#3c2c22', orejaIn: '#6b4636', cachete: '#d98a7a',
};
// El benteveo (original: panza amarilla, antifaz negro con ceja blanca).
const PAJARO = {
  panza: '#ecc63e', lomo: '#7d6743', ala: '#6f5636', alaBorde: '#b67c40', negro: '#27231f',
  blanco: '#f3efe4', pico: '#1d1916', ojo: '#0e0c0b', brillo: '#ffffff',
};
const PALETAS = [CANELA, MARRON, CANELA];

// =============================================================================
// Huesos: nombre y padre. Las posiciones de reposo salen de la forma (abajo).
// Las patas cuelgan de la raíz (no del cuerpo) para que los pies no se
// despeguen del piso cuando el cuerpo se balancea. El pajarito cuelga del
// cuerpo: se para en la cabeza (se calcula cada cuadro) y, cuando el
// carpincho baja la cabeza a comer, salta al lomo.
// =============================================================================
const HUESOS = [
  ['raiz', -1], ['cuerpo', 0], ['cabeza', 1], ['mandibula', 2],
  ['ojoI', 2], ['ojoD', 2], ['parpadoI', 4], ['parpadoD', 5],
  ['orejaI', 2], ['orejaD', 2], ['cacheteI', 2], ['cacheteD', 2],
  ['pataDI', 0], ['pataDD', 0], ['pataTI', 0], ['pataTD', 0],
  ['rodDI', 12], ['rodDD', 13], ['rodTI', 14], ['rodTD', 15],
  ['pajaro', 1], ['pajaroCab', 20], ['alaI', 20], ['alaD', 20], ['colaP', 20],
  ['rayitaI', 4], ['rayitaD', 5],
];
const H = Object.fromEntries(HUESOS.map(([n], i) => [n, i]));

// =============================================================================
// Forma
// =============================================================================
// Superelipsoide «inflado» en la dirección unitaria d (radio hasta el borde).
const radioSuper = (dx, dy, dz, ax, ay, az, n) =>
  Math.pow(Math.abs(dx / ax) ** n + Math.abs(dy / ay) ** n + Math.abs(dz / az) ** n, -1 / n);
// Igual, con otro exponente a lo largo de z (más cuadrado de frente y de atrás).
function radioMixto(dx, dy, dz, ax, ay, az, n, m) {
  let lo = 0, hi = 2 * Math.max(ax, ay, az);
  for (let i = 0; i < 24; i++) {
    const k = (lo + hi) / 2;
    if (Math.abs((k * dx) / ax) ** n + Math.abs((k * dy) / ay) ** n + Math.abs((k * dz) / az) ** m < 1) lo = k;
    else hi = k;
  }
  return lo;
}

// Cuerpo: barril, la grupa alta y redonda (cae casi vertical, sin cola), el
// pecho un poco más bajo y angosto, la panza apenas colgada.
const CUE = { c: [0, 0.39, 0.065], a: [0.27, 0.235, 0.345], n: 2.35 };
function puntoCuerpo(dx, dy, dz, j, ph, out) {
  const k = radioSuper(dx, dy, dz, CUE.a[0], CUE.a[1], CUE.a[2], CUE.n);
  let x = dx * k, y = dy * k, z = dz * k;
  const s = z / CUE.a[2]; // -1 pecho … +1 grupa
  const yy = y / CUE.a[1];
  // grupa alta; adelante sube hacia la nuca (cuello grueso, sin escalón)
  if (y > 0) y *= 1 + 0.1 * suave(-0.4, 0.55, s) * (1 - 0.6 * suave(0.75, 1, s)) + 0.3 * suave(-0.45, -0.95, s) * clamp(yy);
  else y *= 1 + 0.07 * (1 - s * s);
  x *= lerp(0.86, 1, suave(-1, -0.15, s)) * (1 + 0.04 * (1 - yy * yy));
  out[0] = CUE.c[0] + x;
  out[1] = CUE.c[1] + y;
  out[2] = CUE.c[2] + z;
}

// Cabeza: caja redondeada, más angosta en el hocico, con cachetes hondos
// atrás, la frente que baja suave hacia la nariz y el mentón metido.
const CAB = { c: [0, 0.565, -0.5], a: [0.165, 0.155, 0.25], n: 2.45, nz: 3.4 };
function puntoCabeza(dx, dy, dz, j, ph, out) {
  const k = radioMixto(dx, dy, dz, CAB.a[0], CAB.a[1], CAB.a[2], CAB.n, CAB.nz);
  let x = dx * k, y = dy * k, z = dz * k;
  const atras = clamp((z / CAB.a[2] + 1) / 2); // 0 punta del hocico, 1 nuca
  const yy = y / CAB.a[1];
  x *= lerp(0.8, 1.05, atras) * (1 + 0.05 * (1 - yy * yy));
  if (y > 0) y *= lerp(0.84, 1, suave(0.05, 0.75, atras));
  else y *= lerp(0.86, 1.1, atras);
  if (z < 0 && y < 0) z *= 1 - 0.1 * clamp(-yy) * clamp(-z / CAB.a[2]);
  if (z > 0) z += 0.07 * suave(0.6, 1, atras) * clamp(yy + 0.4); // la nuca se estira hacia el lomo
  out[0] = CAB.c[0] + x;
  out[1] = CAB.c[1] + y;
  out[2] = CAB.c[2] + z;
}
// Punto y normal de la cabeza en la dirección d (desde su centro).
function sobreCabeza(d) {
  d = unit(d);
  const p = [0, 0, 0], p1 = [0, 0, 0], p2 = [0, 0, 0];
  puntoCabeza(d[0], d[1], d[2], 0, 0, p);
  const t1 = unit(cruz(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  const t2 = cruz(d, t1);
  const e = 0.01;
  const d1 = unit(suma(d, t1, e)), d2 = unit(suma(d, t2, e));
  puntoCabeza(d1[0], d1[1], d1[2], 0, 0, p1);
  puntoCabeza(d2[0], d2[1], d2[2], 0, 0, p2);
  let n = unit(cruz(suma(p1, p, -1), suma(p2, p, -1)));
  if (punto(n, d) < 0) n = escala(n, -1);
  return { p, n };
}
// Altura de la coronilla en una z dada (para posar al pajarito).
function coronilla(z) {
  let lo = 0, hi = Math.PI / 2;
  const p = [0, 0, 0];
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    puntoCabeza(0, Math.cos(m), Math.sin(m) * Math.sign(z - CAB.c[2]), 0, 0, p);
    if (Math.abs(p[2] - CAB.c[2]) < Math.abs(z - CAB.c[2])) lo = m;
    else hi = m;
  }
  return p;
}

// Medidas de las piezas chicas.
const RE = 0.036; // radio del ojo
const RL = RE * 1.15; // radio del párpado
const PATAS = [
  // [x, z, radio arriba, largo del pie] (DI, DD, TI, TD)
  [-0.148, -0.17, 0.08, 1.25],
  [0.148, -0.17, 0.08, 1.25],
  [-0.162, 0.255, 0.098, 1.45],
  [0.162, 0.255, 0.098, 1.45],
];
const CADERA_Y = 0.3; // altura de los pivotes de las patas
const RODILLA_Y = 0.13;

// Datos compartidos del esqueleto (posiciones de reposo y marcos de ojos,
// orejas y demás). Se calculan una sola vez.
let ESQ = null;
function esqueleto() {
  if (ESQ) return ESQ;
  const rep = HUESOS.map(() => [0, 0, 0]);
  rep[H.cuerpo] = [0, 0.42, 0.07];
  rep[H.cabeza] = [0, 0.5, -0.27];
  rep[H.mandibula] = [0, 0.475, -0.44];
  const ojos = [], orejas = [], cachetes = [];
  for (const lado of [-1, 1]) {
    // ojos: arriba, a los costados y un poco hacia adelante
    const so = sobreCabeza([0.56 * lado, 0.72, -0.5]);
    const f = unit(suma(so.n, [0, 0.08, -0.75]));
    const c = suma(so.p, so.n, -0.25 * RE);
    const u0 = unit(suma([0, 1, 0], f, -f[1]));
    // el borde del párpado cae un poco hacia afuera (cara relajada, no enojada)
    const h = girar(cruz(u0, f), f, 0.26 * lado);
    const u = cruz(f, h);
    ojos.push({ c, f, u, h, lado });
    // orejas: en las esquinas de atrás de la coronilla
    const sr = sobreCabeza([0.56 * lado, 0.8, 0.22]);
    const up = unit(suma(escala(sr.n, 0.55), [0, 0.45, 0.05]));
    let fe = [0.45 * lado, 0.05, -1];
    fe = unit(suma(fe, up, -punto(fe, up)));
    orejas.push({ base: suma(sr.p, sr.n, -0.006), up, f: fe, r: cruz(up, fe), lado });
    // cachetes (el rubor de cuando está contento)
    const sc = sobreCabeza([0.5 * lado, 0.1, -0.86]);
    cachetes.push({ p: sc.p, n: sc.n });
  }
  rep[H.ojoI] = ojos[0].c;
  rep[H.ojoD] = ojos[1].c;
  rep[H.parpadoI] = ojos[0].c;
  rep[H.parpadoD] = ojos[1].c;
  rep[H.rayitaI] = ojos[0].c;
  rep[H.rayitaD] = ojos[1].c;
  rep[H.orejaI] = orejas[0].base;
  rep[H.orejaD] = orejas[1].base;
  rep[H.cacheteI] = suma(cachetes[0].p, cachetes[0].n, -0.012);
  rep[H.cacheteD] = suma(cachetes[1].p, cachetes[1].n, -0.012);
  PATAS.forEach(([x, z], i) => {
    rep[H.pataDI + i] = [x, CADERA_Y, z];
    rep[H.rodDI + i] = [x, RODILLA_Y, z];
  });
  // pajarito: parado en la coronilla, entre los ojos y las orejas
  const pie = coronilla(-0.43);
  pie[1] -= 0.004;
  rep[H.pajaro] = pie;
  rep[H.pajaroCab] = suma(pie, [0, 0.068, -0.012]);
  rep[H.alaI] = suma(pie, [-0.028, 0.066, 0.0]);
  rep[H.alaD] = suma(pie, [0.028, 0.066, 0.0]);
  rep[H.colaP] = suma(pie, [0, 0.03, 0.045]);
  const nariz = sobreCabeza([0, 0.3, -1]);
  const lomo = [0, 0, 0];
  const dl = unit([0, 1, 0.12]);
  puntoCuerpo(dl[0], dl[1], dl[2], 0, 0, lomo);
  lomo[1] -= 0.004;
  ESQ = { rep, ojos, orejas, cachetes, pie, nariz, lomo };
  return ESQ;
}

// =============================================================================
// Armado de piezas (al construir la geometría compartida)
// =============================================================================
const EJES = {
  z: [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
  y: [[0, 1, 0], [1, 0, 0], [0, 0, 1]],
};
// Superficie cerrada tipo esfera: un polo en +A, anillos en las latitudes
// pedidas (fracción de 0 a 1 entre polos) y otro polo en -A. fn(dx, dy, dz,
// anillo, ángulo, out) da la posición para cada dirección unitaria.
function ovillo(nLon, lats, fn, eje = 'z') {
  const [A, B, C] = EJES[eje];
  const pos = [], dirs = [];
  const P = [0, 0, 0];
  const poner = (dx, dy, dz, j, ph) => {
    fn(dx, dy, dz, j, ph, P);
    pos.push(P[0], P[1], P[2]);
    dirs.push(dx, dy, dz);
  };
  poner(A[0], A[1], A[2], 0, 0);
  lats.forEach((v, j) => {
    const th = v * Math.PI, s = Math.sin(th), c = Math.cos(th);
    for (let i = 0; i < nLon; i++) {
      const ph = (i / nLon) * TAU, cp = Math.cos(ph), sp = Math.sin(ph);
      poner(A[0] * c + (B[0] * cp + C[0] * sp) * s, A[1] * c + (B[1] * cp + C[1] * sp) * s, A[2] * c + (B[2] * cp + C[2] * sp) * s, j + 1, ph);
    }
  });
  poner(-A[0], -A[1], -A[2], lats.length + 1, 0);
  const n = nLon, R = lats.length, idx = [];
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  for (let j = 0; j < R - 1; j++) {
    for (let i = 0; i < n; i++) {
      const a = 1 + j * n + i, b = 1 + j * n + ((i + 1) % n);
      idx.push(a, a + n, b, b, a + n, b + n);
    }
  }
  const sur = 1 + R * n;
  for (let i = 0; i < n; i++) idx.push(sur, 1 + (R - 1) * n + ((i + 1) % n), 1 + (R - 1) * n + i);
  return orientar({ pos, dirs, idx });
}
const anillos = (n) => Array.from({ length: n }, (_, j) => (j + 1) / (n + 1));

// Que los triángulos miren hacia afuera (volumen con signo positivo, o
// alejándose de «centro» para las piezas abiertas).
function orientar(pz, centro = null) {
  const { pos, idx } = pz;
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ax = pos[a] - (centro ? centro[0] : 0), ay = pos[a + 1] - (centro ? centro[1] : 0), az = pos[a + 2] - (centro ? centro[2] : 0);
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    vol += ax * (uy * vz - uz * vy) + ay * (uz * vx - ux * vz) + az * (ux * vy - uy * vx);
  }
  if (vol < 0) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
  return pz;
}
// Normales suaves (promedio por área de las caras).
function normales({ pos, idx }) {
  const nor = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      nor[k] += nx;
      nor[k + 1] += ny;
      nor[k + 2] += nz;
    }
  }
  for (let k = 0; k < nor.length; k += 3) {
    const l = Math.hypot(nor[k], nor[k + 1], nor[k + 2]) || 1;
    nor[k] /= l;
    nor[k + 1] /= l;
    nor[k + 2] /= l;
  }
  return nor;
}
// Elipsoide (o superelipsoide) orientado: centro, ejes locales [ex, ey, ez]
// (unitarios), semiejes y exponente.
function elipsoide(c, ejes, semi, nLon, lats, n = 2, eje = 'z', deformar = null) {
  const [ex, ey, ez] = ejes;
  return ovillo(nLon, lats, (dx, dy, dz, j, ph, out) => {
    const k = radioSuper(dx, dy, dz, semi[0], semi[1], semi[2], n);
    let x = dx * k, y = dy * k, z = dz * k;
    if (deformar) [x, y, z] = deformar(x, y, z);
    out[0] = c[0] + ex[0] * x + ey[0] * y + ez[0] * z;
    out[1] = c[1] + ex[1] * x + ey[1] * y + ez[1] * z;
    out[2] = c[2] + ex[2] * x + ey[2] * y + ez[2] * z;
  }, eje);
}
const EJES_MUNDO = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// Ejes girados alrededor de X (para inclinar piezas del pajarito).
const ejesX = (ang) => [[1, 0, 0], girar([0, 1, 0], [1, 0, 0], ang), girar([0, 0, 1], [1, 0, 0], ang)];
// Ejes de una pieza apoyada en una superficie: z = normal, x lo más
// parecido a «ref».
function ejesSobre(n, ref = [1, 0, 0]) {
  const ez = unit(n);
  const ex = unit(suma(ref, ez, -punto(ref, ez)));
  return [ex, cruz(ez, ex), ez];
}

class Armado {
  constructor(THREE) {
    this.THREE = THREE;
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.hue = [];
    this.pes = [];
    this.idx = [];
    this._c = new THREE.Color();
  }
  // color: '#hex', [r, g, b] lineal o fn(x, y, z, nx, ny, nz, dir) → lo mismo.
  // peso: índice de hueso, [hueso, peso, hueso, peso, …] o fn(x, y, z) → eso.
  agregar(pz, color, peso) {
    const base = this.pos.length / 3;
    const nor = normales(pz);
    const { pos, dirs } = pz;
    const fijo = typeof color === 'string' ? this.lineal(color) : Array.isArray(color) ? color : null;
    const dir = [0, 0, 0];
    for (let v = 0; v < pos.length / 3; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2];
      this.pos.push(x, y, z);
      this.nor.push(nx, ny, nz);
      if (dirs) {
        dir[0] = dirs[v * 3];
        dir[1] = dirs[v * 3 + 1];
        dir[2] = dirs[v * 3 + 2];
      }
      let c = fijo ?? color(x, y, z, nx, ny, nz, dir);
      if (typeof c === 'string') c = this.lineal(c);
      this.col.push(c[0], c[1], c[2]);
      const w = typeof peso === 'number' ? [peso, 1] : Array.isArray(peso) ? peso : peso(x, y, z);
      let tot = 0;
      for (let i = 1; i < w.length; i += 2) tot += w[i];
      for (let i = 0; i < 4; i++) {
        this.hue.push(i * 2 < w.length ? w[i * 2] : 0);
        this.pes.push(i * 2 < w.length ? w[i * 2 + 1] / (tot || 1) : 0);
      }
    }
    for (const i of pz.idx) this.idx.push(base + i);
  }
  lineal(hex) {
    this._c.set(hex);
    return [this._c.r, this._c.g, this._c.b];
  }
  geometria() {
    const THREE = this.THREE;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.hue, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.pes, 4));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Mezcla de colores lineales (sin crear arrays: escribe en out).
function mezclar(a, b, t, out) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

// =============================================================================
// Geometría de cada variante (se arma una vez y se comparte)
// =============================================================================
function construir(THREE, variante) {
  const E = esqueleto();
  const arm = new Armado(THREE);
  const L = (hex) => arm.lineal(hex);
  const pal = PALETAS[variante] ?? CANELA;
  const P = {};
  for (const k in pal) P[k] = L(pal[k]);
  const tmp = [0, 0, 0];
  // Pelaje: un poquito de variación para que no parezca plástico.
  const pelaje = (c, x, y, z, fuerza = 0.07) => {
    const k = 1 + (ruido(x, y, z) - 0.5) * fuerza;
    return [c[0] * k, c[1] * k, c[2] * k];
  };

  // --- cuerpo ---
  arm.agregar(
    ovillo(18, anillos(11), puntoCuerpo, 'z'),
    (x, y, z, nx, ny) => {
      mezclar(P.panza, P.pelo, suave(-0.75, -0.15, ny), tmp);
      mezclar(tmp, P.lomo, suave(0.35, 0.95, ny) * 0.75, tmp);
      return pelaje(tmp, x, y, z);
    },
    H.cuerpo,
  );

  // --- cabeza (la nuca se estira hacia el cuerpo: así se lee el cuello) ---
  arm.agregar(
    ovillo(20, anillos(13), puntoCabeza, 'z'),
    (x, y, z, nx, ny) => {
      mezclar(P.pelo, P.lomo, suave(0.4, 0.95, ny) * 0.55, tmp);
      mezclar(tmp, P.hocico, suave(-0.6, -0.72, z) * 0.85, tmp); // hocico
      mezclar(tmp, P.panza, suave(-0.2, -0.85, ny) * suave(-0.6, -0.4, z) * 0.5, tmp); // garganta
      return pelaje(tmp, x, y, z, 0.05);
    },
    (x, y, z) => {
      const wb = 0.8 * suave(-0.32, -0.2, z);
      const wj = suave(0.475, 0.44, y) * suave(-0.5, -0.6, z) * (1 - wb);
      return [H.cabeza, 1 - wb - wj, H.cuerpo, wb, H.mandibula, wj];
    },
  );

  // --- nariz: almohadilla oscura y ancha con dos narinas en coma ---
  {
    const { p, n } = E.nariz;
    const ej = ejesSobre(n);
    arm.agregar(elipsoide(suma(p, n, -0.011), ej, [0.074, 0.04, 0.02], 12, anillos(4), 2.6), (x, y, z) => pelaje(P.nariz, x, y, z, 0.04), H.cabeza);
    for (const lado of [-1, 1]) {
      const c = suma(suma(suma(p, ej[0], 0.033 * lado), ej[1], 0.004), n, 0.008);
      const e2 = [girar(ej[0], n, -0.3 * lado), girar(ej[1], n, -0.3 * lado), n];
      arm.agregar(elipsoide(c, e2, [0.019, 0.0062, 0.008], 6, anillos(2)), P.narina, H.cabeza);
    }
    // boquita: el labio partido de los roedores y una sonrisita («人»)
    const sb = sobreCabeza([0, -0.2, -1]);
    const eb = ejesSobre(sb.n);
    arm.agregar(
      elipsoide(suma(sb.p, sb.n, -0.002), eb, [0.042, 0.0075, 0.007], 8, anillos(2), 2, 'z', (x, y, z) => [x, y - 7 * x * x, z]),
      P.boca,
      [H.mandibula, 0.5, H.cabeza, 0.5],
    );
    const sl = sobreCabeza([0, -0.02, -1]);
    arm.agregar(elipsoide(suma(sl.p, sl.n, -0.002), ejesSobre(sl.n), [0.0065, 0.026, 0.006], 5, anillos(2)), P.boca, H.cabeza);
  }

  // --- ojos: bolita oscura con brillito y párpado grueso a media asta ---
  E.ojos.forEach((o, i) => {
    const hueso = i === 0 ? H.ojoI : H.ojoD;
    const parp = i === 0 ? H.parpadoI : H.parpadoD;
    arm.agregar(elipsoide(o.c, ejesSobre(o.f), [RE, RE, RE], 8, anillos(5)), P.ojo, hueso);
    // brillito: abajo del borde del párpado, hacia el mismo lado en los dos ojos
    const g = unit(suma(suma(o.f, o.u, -0.2), [0.3, 0, 0]));
    arm.agregar(elipsoide(suma(o.c, g, RE * 0.97), ejesSobre(g), [RE * 0.42, RE * 0.38, RE * 0.07], 6, anillos(2)), P.brillo, hueso);
    // párpado: gajo de esfera que gira alrededor de h (de la frente hacia la
    // nuca). Con giro 0 tapa la mitad de arriba; el borde es oscuro.
    const PSI = [0, 0.08, 0.5, 1.1, 1.8, 2.6, 3.5];
    const LAM = [-1.0, -0.66, -0.33, 0, 0.33, 0.66, 1.0];
    const pos = [], idx = [], cols = [];
    for (const psi of PSI) {
      for (const lam of LAM) {
        const la = (lam * Math.PI) / 2;
        const d = suma(escala(suma(escala(o.f, Math.cos(psi)), o.u, Math.sin(psi)), Math.cos(la)), o.h, Math.sin(la));
        const r = RL * (1 - 0.06 * Math.abs(lam) ** 4);
        pos.push(o.c[0] + d[0] * r, o.c[1] + d[1] * r, o.c[2] + d[2] * r);
        cols.push(psi < 0.1 ? 0.7 : 0);
      }
    }
    const nl = LAM.length;
    for (let a = 0; a < PSI.length - 1; a++) {
      for (let b = 0; b < nl - 1; b++) {
        const q = a * nl + b;
        idx.push(q, q + 1, q + nl, q + 1, q + nl + 1, q + nl);
      }
    }
    const pzP = orientar({ pos, idx }, o.c);
    let vi = 0;
    arm.agregar(pzP, (x, y, z) => mezclar(P.pelo, P.parpado, cols[vi++], [0, 0, 0]), parp);
    // canto del párpado (la tira entre el borde y el ojo, también oscura)
    const pos2 = [], idx2 = [];
    for (const lam of LAM) {
      const la = (lam * Math.PI) / 2;
      const d = suma(escala(o.f, Math.cos(la)), o.h, Math.sin(la));
      const r = RL * (1 - 0.06 * Math.abs(lam) ** 4);
      pos2.push(o.c[0] + d[0] * r, o.c[1] + d[1] * r, o.c[2] + d[2] * r);
      pos2.push(o.c[0] + d[0] * RE * 0.92, o.c[1] + d[1] * RE * 0.92, o.c[2] + d[2] * RE * 0.92);
    }
    for (let b = 0; b < nl - 1; b++) idx2.push(b * 2, b * 2 + 1, b * 2 + 2, b * 2 + 1, b * 2 + 3, b * 2 + 2);
    arm.agregar(orientar({ pos: pos2, idx: idx2 }, suma(o.c, o.u, RE)), mezclar(P.pelo, P.parpado, 0.8, [0, 0, 0]), parp);
    // rayita del ojo cerrado («︶»): por fuera del párpado; su hueso la achica
    // hasta el centro del ojo (escondida) y crece cuando el párpado cierra
    const pos3 = [], idx3 = [];
    const LAM3 = [-0.82, -0.55, -0.28, 0, 0.28, 0.55, 0.82];
    for (const lam of LAM3) {
      const la = (lam * Math.PI) / 2;
      const psi = -0.16 + 0.42 * Math.sin(Math.abs(la)) ** 2;
      const ancho = 0.11 * (1 - 0.5 * Math.abs(lam));
      for (const dp of [-ancho, ancho]) {
        const d = suma(escala(suma(escala(o.f, Math.cos(psi + dp)), o.u, Math.sin(psi + dp)), Math.cos(la)), o.h, Math.sin(la));
        const r = RL * 1.035;
        pos3.push(o.c[0] + d[0] * r, o.c[1] + d[1] * r, o.c[2] + d[2] * r);
      }
    }
    for (let b = 0; b < LAM3.length - 1; b++) idx3.push(b * 2, b * 2 + 1, b * 2 + 2, b * 2 + 1, b * 2 + 3, b * 2 + 2);
    arm.agregar(orientar({ pos: pos3, idx: idx3 }, o.c), P.parpado, i === 0 ? H.rayitaI : H.rayitaD);
  });

  // --- rubor (aparece escalando su hueso cuando está contento) ---
  E.cachetes.forEach((ca, i) => {
    arm.agregar(
      elipsoide(suma(ca.p, ca.n, -0.003), ejesSobre(ca.n, [0, 0, -1]), [0.058, 0.038, 0.009], 8, anillos(2)),
      (x, y, z, nx, ny, nz, d) => mezclar(P.pelo, P.cachete, suave(0.2, 0.75, Math.abs(d[2])), [0, 0, 0]),
      i === 0 ? H.cacheteI : H.cacheteD,
    );
  });

  // --- orejas: chiquitas y redondas, más oscuras por dentro ---
  E.orejas.forEach((o, i) => {
    const centro = suma(o.base, o.up, 0.026);
    arm.agregar(
      elipsoide(centro, [o.r, o.up, o.f], [0.043, 0.041, 0.02], 10, anillos(4), 2.2, 'z', (x, y, z) => [x, y, z - 0.3 * (x * x + y * y) / 0.043]),
      (x, y, z, nx, ny, nz, d) => {
        const dentro = suave(0.15, 0.6, -d[2]) * suave(-0.2, 0.3, -Math.abs(d[0]) + 0.75);
        return pelaje(mezclar(P.pelo, P.orejaIn, dentro, [0, 0, 0]), x, y, z, 0.05);
      },
      i === 0 ? H.orejaI : H.orejaD,
    );
  });

  // --- patas: cortas y gorditas, los dedos oscuros ---
  PATAS.forEach(([px, pz, r0, largo], i) => {
    const PERFIL = [
      [0.33, r0 * 1.3], [0.24, r0 * 1.12], [0.15, r0 * 0.84], [0.08, 0.06], [0.035, 0.061], [0.014, 0.066], [0.003, 0.054],
    ];
    const lats = PERFIL.map((_, j) => (j + 1) / (PERFIL.length + 1));
    arm.agregar(
      ovillo(8, lats, (dx, dy, dz, j, ph, out) => {
        if (j === 0) return (out[0] = px, out[1] = 0.43, out[2] = pz, out);
        if (j > PERFIL.length) return (out[0] = px, out[1] = 0, out[2] = pz - 0.012 * largo, out);
        const [y, r] = PERFIL[j - 1];
        const s = Math.sin(ph), cph = Math.cos(ph);
        const pie = suave(0.08, 0.02, y);
        const adelante = s < 0 ? lerp(1, largo, pie) : 1;
        out[0] = px + cph * r * lerp(1, 1.08, pie);
        out[1] = y;
        out[2] = pz + s * r * adelante - 0.01 * pie;
        return out;
      }, 'y'),
      (x, y, z) => {
        mezclar(P.pelo, P.pata, suave(0.17, 0.07, y), tmp);
        mezclar(tmp, P.una, suave(0.03, 0.008, y) * suave(-0.02, -0.05, z - pz), tmp);
        return pelaje(tmp, x, y, z, 0.06);
      },
      (x, y, z) => {
        const wr = suave(0.17, 0.1, y);
        return [H.pataDI + i, 1 - wr, H.rodDI + i, wr];
      },
    );
  });

  // --- el benteveo ---
  if (variante === 2) {
    const B = {};
    for (const k in PAJARO) B[k] = L(PAJARO[k]);
    const pie = E.pie;
    const en = (d) => suma(pie, d);
    // cuerpo: huevito inclinado, panza amarilla y lomo pardo
    arm.agregar(
      elipsoide(en([0, 0.04, 0.006]), ejesX(0.55), [0.032, 0.036, 0.047], 8, anillos(4)),
      (x, y, z, nx, ny, nz) => mezclar(B.panza, B.lomo, suave(-0.15, 0.35, ny + nz * 0.6), [0, 0, 0]),
      H.pajaro,
    );
    // cabeza: gorra negra, ceja blanca, antifaz negro y garganta blanca
    const cc = en([0, 0.084, -0.024]);
    arm.agregar(
      elipsoide(cc, EJES_MUNDO, [0.028, 0.027, 0.029], 7, [0.2, 0.29, 0.33, 0.42, 0.46, 0.56, 0.62], 2, 'y'),
      (x, y, z, nx, ny, nz, d) => {
        const dy = d[1], dz = d[2];
        if (dy > 0.55) return B.negro;
        if (dy > 0.2) return dz < -0.8 ? B.negro : B.blanco;
        if (dy > -0.25) return B.negro;
        return dz < 0.3 ? B.blanco : B.lomo;
      },
      H.pajaroCab,
    );
    // pico: corto y fuerte
    arm.agregar(elipsoide(suma(cc, [0, -0.004, -0.031]), ejesX(0.12), [0.008, 0.0068, 0.017], 5, anillos(2)), B.pico, H.pajaroCab);
    // ojitos con brillo
    for (const lado of [-1, 1]) {
      const d = unit([0.72 * lado, 0.02, -0.68]);
      const c = suma(cc, [d[0] * 0.026, d[1] * 0.026, d[2] * 0.026]);
      arm.agregar(elipsoide(c, ejesSobre(d), [0.0072, 0.0072, 0.0055], 5, anillos(2)), B.ojo, H.pajaroCab);
      const g = unit(suma(d, [0.3, 0.35, -0.2]));
      arm.agregar(elipsoide(suma(c, g, 0.0055), ejesSobre(g), [0.0027, 0.0027, 0.0012], 4, anillos(1)), B.brillo, H.pajaroCab);
    }
    // alas, con el borde rojizo
    for (const lado of [-1, 1]) {
      arm.agregar(
        elipsoide(en([0.029 * lado, 0.046, 0.016]), ejesX(0.62), [0.011, 0.027, 0.043], 6, anillos(2)),
        (x, y, z, nx, ny, nz, d) => mezclar(B.ala, B.alaBorde, suave(0.2, 0.75, d[2]) * 0.8, [0, 0, 0]),
        lado < 0 ? H.alaI : H.alaD,
      );
    }
    // colita
    arm.agregar(elipsoide(en([0, 0.024, 0.062]), ejesX(0.42), [0.017, 0.006, 0.032], 5, anillos(2)), B.ala, H.colaP);
  }

  return arm.geometria();
}

// Caché por THREE (por si hubiera dos copias): material y geometrías.
const CACHES = new WeakMap();
function cache(THREE) {
  let c = CACHES.get(THREE);
  if (!c) {
    c = { mat: new THREE.MeshLambertMaterial({ vertexColors: true }), geos: [] };
    CACHES.set(THREE, c);
  }
  return c;
}

// =============================================================================
// createModel
// =============================================================================
const ACCIONES = ['idle', 'walk', 'eat', 'happy', 'scared', 'swim'];
const [I_IDLE, I_WALK, I_EAT, I_HAPPY, I_SCARED, I_SWIM] = [0, 1, 2, 3, 4, 5];
const VACIO = {};
// Desfasajes de las patas (DI, DD, TI, TD): al paso van en diagonal; al
// galope, las de adelante juntas y las de atrás juntas.
const FASE_PASO = [0, 0.5, 0.5, 0];
const FASE_GALOPE = [0, 0.1, 0.52, 0.62];
const FASE_NADO = [0, 0.5, 0.25, 0.75];
const PIERNA = CADERA_Y; // de la cadera al piso
const L1 = CADERA_Y - RODILLA_Y, L2 = RODILLA_Y; // muslo y canilla
const CONTRA = 0.45; // cuánto se endereza la canilla en el apoyo
const PIE_R = 0.07; // medio largo del pie (su borde baja si se inclina)
// Avance del pie (respecto de la cadera) con el muslo girado th.
const avancePie = (th) => L1 * Math.sin(th) + L2 * Math.sin((1 - CONTRA) * th);
// Y al revés: el giro del muslo para un avance x (Newton, 3 pasos).
function anguloPie(x) {
  let th = x / (L1 + L2 * (1 - CONTRA));
  for (let i = 0; i < 3; i++) {
    const d = L1 * Math.cos(th) + L2 * (1 - CONTRA) * Math.cos((1 - CONTRA) * th);
    th -= (avancePie(th) - x) / d;
  }
  return th;
}
let instancias = 0;

export function createModel(THREE, { variant = 0 } = {}) {
  const v = clamp(Math.round(numero(variant)), 0, info.variants.length - 1);
  const C = cache(THREE);
  const geo = (C.geos[v] ??= construir(THREE, v));
  const E = esqueleto();
  const rnd = azar(0x9e3779b9 ^ (++instancias * 2654435761) ^ (v * 97));

  // --- huesos (lo único propio de cada carpincho) ---
  const huesos = HUESOS.map(([nombre]) => {
    const b = new THREE.Bone();
    b.name = nombre;
    return b;
  });
  HUESOS.forEach(([, padre], i) => {
    const p = E.rep[i];
    const q = padre >= 0 ? E.rep[padre] : [0, 0, 0];
    huesos[i].position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (padre >= 0) huesos[padre].add(huesos[i]);
  });
  const B = (n) => huesos[H[n]];
  const raiz = B('raiz'), cuerpo = B('cuerpo'), cabeza = B('cabeza'), mandibula = B('mandibula');
  const ojos = [B('ojoI'), B('ojoD')], parpados = [B('parpadoI'), B('parpadoD')], rayitas = [B('rayitaI'), B('rayitaD')];
  const orejas = [B('orejaI'), B('orejaD')], cachetes = [B('cacheteI'), B('cacheteD')];
  const patas = [B('pataDI'), B('pataDD'), B('pataTI'), B('pataTD')];
  const rodillas = [B('rodDI'), B('rodDD'), B('rodTI'), B('rodTD')];
  const pajaro = B('pajaro'), pajCab = B('pajaroCab'), alas = [B('alaI'), B('alaD')], cola = B('colaP');
  cabeza.rotation.order = 'YXZ';
  pajCab.rotation.order = 'YXZ';
  const reposo = huesos.map((b) => b.position.clone());
  const ejeParpado = E.ojos.map((o) => new THREE.Vector3(o.h[0], o.h[1], o.h[2]));

  const root = new THREE.Group();
  root.name = 'carpincho';
  const malla = new THREE.SkinnedMesh(geo, C.mat);
  malla.name = 'carpincho-malla';
  malla.add(raiz);
  root.add(malla);
  malla.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(huesos);
  malla.bind(skeleton);
  // Esfera y caja de sobra (cubren cualquier pose) para no recalcularlas.
  malla.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.42, -0.1), 0.95);
  malla.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.1, -1), new THREE.Vector3(0.5, 1.1, 0.7));

  // --- estado de la animación ---
  // peso de cada acción: dos etapas de suavizado (arranca y frena suave, ~0,25 s)
  const w = [1, 0, 0, 0, 0, 0], w1 = [1, 0, 0, 0, 0, 0];
  let ultima = 'idle', reloj = 0;
  // tiempo desde que empezó cada acción (sigue corriendo cuando termina, así
  // los movimientos se apagan con el peso de la acción y nunca saltan)
  const tA = [99, 99, 99, 99, 99, 99];
  let mov = 0, mov1 = 0, corre = 0, fase = rnd(), faseNado = rnd();
  let miraYaw = 0, miraPitch = 0, miraYaw1 = 0, miraPitch1 = 0;
  const desfase = rnd() * TAU; // respiración
  // eventos de reposo
  let proxParp = 0.8 + rnd() * 3, parpT = -1, dobleParp = false;
  let proxOreja = 1 + rnd() * 3, orejaT = -1, cualOreja = 0;
  let proxMirada = rnd() * 2, objYaw = 0, objPitch = 0, vagYaw = 0, vagPitch = 0;
  let proxRumia = 2 + rnd() * 5, rumiaT = -1;
  let proxLevanta = 3 + rnd() * 3, levantaT = -1; // al comer, levanta la cabeza a masticar
  // pajarito
  let proxPaj = rnd() * 1.5, pajYaw = 0, pajPitch = 0, objPajYaw = 0, objPajPitch = 0;
  let proxPico = 2 + rnd() * 4, picoT = -1, proxColita = 1 + rnd() * 3, colitaT = -1;
  let aleteo = 0, cabPitchAnt = 0, enLomo = 0;
  // dónde se para: en la cabeza (relativo a su pivote) o en el lomo (relativo al cuerpo)
  const offCab = new THREE.Vector3().fromArray(E.pie).sub(new THREE.Vector3().fromArray(E.rep[H.cabeza]));
  const posLomo = new THREE.Vector3().fromArray(E.lomo).sub(new THREE.Vector3().fromArray(E.rep[H.cuerpo]));
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
  pajaro.rotation.order = 'YXZ';
  const conPajaro = v === 2;

  function update(dt, estado) {
    const st = estado || VACIO;
    dt = clamp(numero(dt), 0, 0.1);
    reloj += dt;
    const t = reloj;
    const accion = ACCIONES.includes(st.action) ? st.action : 'idle';
    const speed = Math.max(0, numero(st.speed));
    if (accion !== ultima) {
      ultima = accion;
      tA[ACCIONES.indexOf(accion)] = 0;
    }
    for (let i = 0; i < 6; i++) tA[i] += dt;
    const tE = tA[I_EAT], tH = tA[I_HAPPY], tS = tA[I_SCARED];
    const rap = accion === 'scared' ? 28 : 15; // el respingo es instantáneo
    for (let i = 0; i < 6; i++) {
      w1[i] = amort(w1[i], ACCIONES[i] === accion ? 1 : 0, rap, dt);
      w[i] = amort(w[i], w1[i], rap, dt);
    }
    const wW = w[I_WALK], wE = w[I_EAT], wH = w[I_HAPPY], wS = w[I_SCARED], wN = w[I_SWIM];
    const enTierra = 1 - wN;
    const calma = (1 - wS) * (1 - wE * 0.5);

    // --- mirar al jugador (con tope) ---
    miraYaw1 = amort(miraYaw1, clamp(numero(st.lookYaw), -0.85, 0.85), 12, dt);
    miraPitch1 = amort(miraPitch1, clamp(numero(st.lookPitch), -0.35, 0.45), 12, dt);
    miraYaw = amort(miraYaw, miraYaw1, 12, dt);
    miraPitch = amort(miraPitch, miraPitch1, 12, dt);
    const atento = clamp(Math.abs(miraYaw) * 1.5 + Math.abs(miraPitch) * 2);

    // --- eventos de reposo ---
    proxParp -= dt;
    if (proxParp <= 0 && parpT < 0) {
      parpT = 0;
      dobleParp = rnd() < 0.2;
      proxParp = 2.5 + rnd() * 4.5;
    }
    let parp = 0;
    if (parpT >= 0) {
      parpT += dt;
      const dur = dobleParp ? 0.56 : 0.28;
      parp = Math.sin(Math.PI * clamp((parpT % 0.28) / 0.28));
      if (parpT > dur) parpT = -1;
    }
    proxOreja -= dt;
    if (proxOreja <= 0 && orejaT < 0) {
      orejaT = 0;
      const r = rnd();
      cualOreja = r < 0.4 ? 0 : r < 0.8 ? 1 : 2;
      proxOreja = 1.5 + rnd() * 5;
    }
    let sacude = 0;
    if (orejaT >= 0) {
      orejaT += dt;
      sacude = Math.sin(orejaT * TAU * 6) * (1 - suave(0.12, 0.36, orejaT));
      if (orejaT > 0.36) orejaT = -1;
    }
    proxMirada -= dt;
    if (proxMirada <= 0) {
      objYaw = (rnd() * 2 - 1) * 0.35;
      objPitch = (rnd() * 2 - 1) * 0.1;
      proxMirada = 2.5 + rnd() * 5;
    }
    vagYaw = amort(vagYaw, objYaw, 1.6, dt);
    vagPitch = amort(vagPitch, objPitch, 1.6, dt);
    proxRumia -= dt * w[I_IDLE];
    if (proxRumia <= 0 && rumiaT < 0) {
      rumiaT = 0;
      proxRumia = 5 + rnd() * 8;
    }
    let rumia = 0;
    if (rumiaT >= 0) {
      rumiaT += dt;
      rumia = Math.max(0, Math.sin(rumiaT * TAU * 1.8)) * (1 - suave(1.6, 2, rumiaT)) * suave(0, 0.2, rumiaT);
      if (rumiaT > 2) rumiaT = -1;
    }
    // comer: cada tanto levanta la cabeza a masticar mirando alrededor
    if (accion === 'eat') {
      proxLevanta -= dt;
      if (proxLevanta <= 0 && levantaT < 0) {
        levantaT = 0;
        proxLevanta = 4 + rnd() * 4;
      }
    } else proxLevanta = Math.max(proxLevanta, 3);
    let levanta = 0;
    if (levantaT >= 0) {
      levantaT += dt;
      levanta = suave(0, 0.4, levantaT) * (1 - suave(1.7, 2.2, levantaT));
      if (levantaT > 2.2) levantaT = -1;
    }

    // --- marcha: pasos sin patinar (el pie apoyado retrocede justo a «speed»;
    // en el apoyo la canilla se endereza a medias y el pie queda casi plano) ---
    const enMarcha = speed > 0.05;
    mov1 = amort(mov1, clamp(speed / 0.15) * enTierra, 16, dt);
    mov = amort(mov, mov1, 16, dt);
    corre = amort(corre, suave(2.6, 4.2, speed), 9, dt);
    const A = lerp(lerp(0.32, 0.7, clamp(speed / 1.6)), 0.85, corre); // amplitud (rad)
    const apoyo = lerp(0.56, 0.4, corre); // fracción del ciclo con el pie en el piso
    const XA = avancePie(A);
    const zancada = (2 * XA) / apoyo; // lo que avanza el cuerpo en un ciclo
    if (enMarcha) fase = (fase + (dt * speed) / zancada) % 1;
    faseNado = (faseNado + dt * (0.9 + 0.3 * Math.min(speed, 3)) * wN) % 1;
    let baja = 1, hayApoyo = false;
    for (let k = 0; k < 4; k++) {
      const p = (fase + lerp(FASE_PASO[k], FASE_GALOPE[k], corre)) % 1;
      let th, rod, alza = 0;
      if (p < apoyo) {
        th = anguloPie(XA * (1 - (2 * p) / apoyo));
        rod = -CONTRA * th;
        // cuánto hay que bajar la cadera para que el pie (su borde) toque el piso
        const tilt = (1 - CONTRA) * th;
        const falta = PIERNA - L1 * Math.cos(th) - L2 * Math.cos(tilt) - PIE_R * Math.abs(Math.sin(tilt));
        if (falta < baja) baja = falta;
        hayApoyo = true;
      } else {
        const q = (p - apoyo) / (1 - apoyo);
        th = -A + 2 * A * suave(0, 1, q);
        rod = -CONTRA * th - lerp(0.75, 1.2, corre) * Math.sin(Math.PI * q) * (1 - 0.3 * q);
        // la pata entera sube un poco (se mete en el cuerpo): así el pie no roza
        alza = lerp(0.085, 0.11, corre) * Math.pow(Math.sin(Math.PI * q), 0.8);
      }
      // nadando: brazada (patada atrás estirada, vuelve adelante doblada)
      const pn = (faseNado + FASE_NADO[k]) % 1;
      const thN = 0.55 * Math.sin(TAU * pn) + (k < 2 ? 0.25 : -0.1);
      const rodN = -0.9 * Math.max(0, Math.cos(TAU * pn));
      patas[k].rotation.x = th * mov + thN * wN;
      patas[k].position.y = reposo[H.pataDI + k].y + alza * mov;
      rodillas[k].rotation.x = rod * mov + rodN * wN;
    }
    if (!hayApoyo) baja = 0;

    // --- cuerpo ---
    const resp = Math.sin(t * TAU * 0.26 + desfase);
    const hop = Math.sin(Math.PI * clamp(tS / 0.32)); // respingo (chiquito: es imperturbable)
    const meceo = Math.sin(TAU * 0.55 * tH) * wH;
    const fGalope = Math.sin(TAU * fase);
    raiz.position.y = -baja * mov + hop * 0.055 + corre * mov * 0.025 * Math.max(0, Math.sin(TAU * fase + 1.2)) + wN * (0.035 + 0.008 * Math.sin(t * 2.1));
    const cPitch = mov * (corre * 0.07 * fGalope - 0.015) + wE * -0.07 + wN * 0.07 + hop * 0.1;
    const cRoll = meceo * 0.075 + mov * (1 - corre) * 0.02 * Math.sin(TAU * fase); // se bambolea al paso
    cuerpo.position.y = reposo[H.cuerpo].y + mov * (1 - corre) * 0.012 * Math.sin(TAU * fase * 2) + wE * -0.01;
    cuerpo.rotation.set(cPitch, 0, cRoll);
    const esc = 0.011 * resp * (1 - mov * 0.6);
    const aplasta = 0.05 * Math.sin(Math.PI * clamp((tS - 0.25) / 0.2));
    cuerpo.scale.set(1 + esc * 0.6 + aplasta * 0.5, 1 + esc - aplasta, 1 + esc * 0.3);

    // --- cabeza ---
    const mirar = (1 - wE * 0.8) * (1 - wS * 0.5);
    const vag = (1 - atento) * calma * (1 - mov * 0.7);
    const mordisco = wE * (1 - levanta) * 0.06 * Math.max(0, Math.sin(tE * TAU * 1.6)) * suave(0.4, 0.8, tE);
    let hPitch =
      vag * vagPitch + miraPitch * mirar +
      wW * mov * (-0.05 + (1 - corre) * 0.025 * Math.sin(TAU * fase * 2 + 0.6)) +
      wE * lerp(-0.98, -0.3, levanta) - mordisco +
      wH * 0.14 + hop * 0.12 + wN * 0.3 - cPitch * 0.4;
    const hYaw = vag * vagYaw + miraYaw * mirar + wE * levanta * 0.35 * Math.sin(levantaT * 1.3);
    const hRoll = -meceo * 0.11;
    cabeza.position.set(reposo[H.cabeza].x, reposo[H.cabeza].y + wE * -0.035 + wN * 0.02, reposo[H.cabeza].z + wE * -0.03 + hop * 0.015);
    cabeza.rotation.set(hPitch, hYaw, hRoll);
    const masca = Math.max(rumia * w[I_IDLE], wE * Math.max(0, Math.sin(tE * TAU * 2.4)) * suave(0.3, 0.6, tE));
    mandibula.rotation.x = -0.09 * masca;

    // --- ojos ---
    // abiertura del párpado: 0 = a media asta, + cierra, - abre
    const susto = 1 - 0.5 * suave(0.5, 1.2, tS);
    let aPar = (w[I_IDLE] + wW) * -0.18 + wE * 0.32 + wH * 1.22 + wN * 0.12 - wS * 0.95 * susto - atento * 0.12 * (1 - wH);
    aPar = lerp(aPar, 1.62, parp * (1 - wH));
    const ojoEsc = 1 + wS * 0.25 * susto;
    for (let i = 0; i < 2; i++) {
      parpados[i].quaternion.setFromAxisAngle(ejeParpado[i], aPar);
      rayitas[i].scale.setScalar(Math.max(suave(0.95, 1.2, aPar), 0.0001));
      ojos[i].scale.setScalar(ojoEsc);
      const rub = wH * (0.9 + 0.1 * Math.sin(t * 5));
      cachetes[i].scale.setScalar(Math.max(rub, 0.0001));
    }

    // --- orejas ---
    for (let i = 0; i < 2; i++) {
      const lado = i === 0 ? 1 : -1; // +z en la izquierda = hacia afuera
      const flick = cualOreja === 2 || cualOreja === i ? sacude : 0;
      const atras = wS * 0.95 + wN * -0.1 + mov * corre * 0.45 + wH * 0.2;
      const afuera = wH * 0.35 + wE * 0.12 + flick * 0.35;
      orejas[i].rotation.set(atras + flick * 0.15, 0, lado * afuera);
    }

    // --- pajarito ---
    if (conPajaro) {
      // parado en la cabeza; si baja la cabeza a comer, se pasa al lomo
      enLomo = amort(enLomo, accion === 'eat' && tE > 0.15 ? 1 : 0, 4, dt);
      const vuela = 4 * enLomo * (1 - enLomo); // 1 a mitad de camino
      _q.setFromEuler(cabeza.rotation);
      _v.copy(offCab).applyQuaternion(_q).add(cabeza.position).lerp(posLomo, enLomo);
      const enCab = 1 - enLomo;
      // se queda derecho aunque el carpincho se incline
      pajaro.rotation.set(-cPitch - hPitch * enCab * 0.9, hYaw * enCab * 0.8, -cRoll - hRoll * enCab);
      proxPaj -= dt;
      if (proxPaj <= 0) {
        objPajYaw = (rnd() * 2 - 1) * 1.25;
        objPajPitch = (rnd() * 2 - 1) * 0.25;
        proxPaj = 0.5 + rnd() * 2.2;
      }
      pajYaw = amort(pajYaw, objPajYaw, 24, dt);
      pajPitch = amort(pajPitch, objPajPitch, 24, dt);
      proxPico -= dt;
      if (proxPico <= 0 && picoT < 0) {
        picoT = 0;
        proxPico = 3 + rnd() * 6;
      }
      let pico = 0;
      if (picoT >= 0) {
        picoT += dt;
        pico = Math.abs(Math.sin(picoT * TAU * 3)) * (1 - suave(0.3, 0.5, picoT));
        if (picoT > 0.5) picoT = -1;
      }
      proxColita -= dt;
      if (proxColita <= 0 && colitaT < 0) {
        colitaT = 0;
        proxColita = 1.5 + rnd() * 4;
      }
      let colita = 0;
      if (colitaT >= 0) {
        colitaT += dt;
        colita = Math.sin(colitaT * TAU * 4) * (1 - suave(0.2, 0.4, colitaT));
        if (colitaT > 0.4) colitaT = -1;
      }
      pajCab.rotation.set(pajPitch * (1 - pico) - pico * 0.9, pajYaw * (1 - pico), 0); // picotea el pelo
      cola.rotation.x = -0.35 * colita;
      // aletea cuando el carpincho se asusta o cabecea fuerte
      const vel = Math.abs(hPitch - cabPitchAnt) / Math.max(dt, 1e-3);
      cabPitchAnt = hPitch;
      aleteo = amort(aleteo, Math.max(hop > 0.05 || vuela > 0.15 ? 1 : 0, clamp(vel * 0.5 - 0.3)), 14, dt);
      const salto = Math.sin(Math.PI * clamp(tS / 0.45));
      pajaro.position.set(_v.x, _v.y + vuela * 0.09 + salto * 0.06 + wH * 0.006 * Math.max(0, Math.sin(t * TAU * 2.2)), _v.z);
      const ala = aleteo * (0.6 + 0.6 * Math.sin(t * TAU * 11));
      alas[0].rotation.set(0, 0, -ala);
      alas[1].rotation.set(0, 0, ala);
    }
  }

  function dispose() {
    root.removeFromParent();
    root.remove(malla);
    skeleton.dispose(); // la textura de huesos es de esta instancia
  }

  update(0, { action: 'idle', speed: 0, t: 0 });
  return { root, update, dispose };
}
