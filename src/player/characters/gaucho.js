// Personaje "Gaucho": sombrero de ala ancha, poncho del color elegido con
// guarda y flecos, pañuelo al cuello, bigote grande, faja y rastra con
// monedas, bombachas de campo claras y botas de cuero con espuelas.

import { brush, noisy, paintFace, tone } from './humanoid.js';

const SKIN = [178, 118, 80];
const SKIN_DARK = [146, 92, 62];
const HAIR = [44, 34, 30];
const MUSTACHE = [36, 28, 24];
const EYE = [58, 38, 26];
const MOUTH = [112, 50, 40];
const SHIRT = [236, 232, 222];
const CREAM = [238, 226, 196];
const BOMBACHA = [214, 200, 172];
const FAJA = [40, 38, 50];
const LEATHER = [92, 58, 36];
const BOOT = [98, 62, 38];
const SILVER = [206, 210, 216];
const SILVER_DARK = [138, 142, 150];
const FELT = [70, 54, 44];
const FELT_DARK = [46, 36, 30];

const SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Distancia (en px) de una columna de un costado a la cara de adelante. */
const fromFront = (k, b, x) => (k === 'right' ? b.w - 1 - x : x);

/** Pinta todas las caras de una caja con un color con ruido. */
function fill(ctx, r, color, rnd, amount = 0.05) {
  for (const k of SIDES) noisy(brush(ctx, r[k]), color, amount, rnd);
}

export const id = 'gaucho';
export const name = 'Gaucho';

/** La cara: ojos oscuros, cejas gruesas y la boca bajo el bigote. */
export function face(b, expr, blink) {
  paintFace(b, expr, blink, { eye: EYE, mouth: MOUTH, brow: HAIR, eyeY: 4 });
  // El bigote se vuelve a pintar encima de la boca cuando está serio o normal.
  if (expr === 'normal') b.rect(4, 8, 2, 1, tone(MOUTH, 0.9));
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), SKIN, 0.035, rnd);
    noisy(brush(ctx, r.top), HAIR, 0.08, rnd);
    // Pelo corto atrás y a los costados (lo de arriba queda bajo el sombrero).
    const back = brush(ctx, r.back);
    for (let x = 0; x < back.w; x++) {
      const depth = 6 + (x % 3 === 1 ? 1 : 0);
      for (let y = 0; y < depth; y++) back.px(x, y, tone(HAIR, 0.85 + rnd() * 0.3));
    }
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < b.w; x++) {
        const f = fromFront(k, b, x);
        const depth = f < 2 ? 3 : f < 4 ? 6 : 5 + (x % 2);
        for (let y = 0; y < depth; y++) b.px(x, y, tone(HAIR, 0.85 + rnd() * 0.3));
      }
      // Oreja.
      const ex = k === 'right' ? b.w - 6 : 5;
      b.px(ex, 4, tone(SKIN, 0.86));
      b.px(ex, 5, tone(SKIN, 0.78));
      // Barba de unos días en la quijada.
      for (let x = 0; x < b.w; x++) if (fromFront(k, b, x) < 4) b.px(x, 9, tone(SKIN_DARK, 0.92 + rnd() * 0.1));
    }
    // Adelante: sombra del ala, nariz, bigote grande y barba de unos días.
    const f = brush(ctx, r.front);
    f.rect(0, 0, 10, 2, HAIR);
    for (let x = 0; x < 10; x++) f.px(x, 2, tone(SKIN, 0.86));
    f.rect(0, 2, 1, 3, tone(HAIR, 1.2)); // patillas
    f.rect(9, 2, 1, 3, tone(HAIR, 1.2));
    f.rect(4, 5, 2, 1, tone(SKIN, 1.06)); // nariz
    f.px(4, 6, SKIN_DARK);
    f.px(5, 6, SKIN_DARK);
    f.px(1, 5, tone(SKIN, 0.94)); // pómulos curtidos
    f.px(8, 5, tone(SKIN, 0.94));
    for (let x = 1; x < 9; x++) for (let y = 8; y < 10; y++) if (rnd() < 0.5) f.px(x, y, SKIN_DARK);
    // Bigote: grueso, con las puntas caídas.
    f.rect(3, 6, 1, 1, MUSTACHE);
    f.rect(6, 6, 1, 1, MUSTACHE);
    f.rect(1, 7, 8, 1, MUSTACHE);
    f.px(1, 8, MUSTACHE);
    f.px(8, 8, MUSTACHE);
    f.px(0, 8, tone(MUSTACHE, 1.3));
    f.px(9, 8, tone(MUSTACHE, 1.3));
    f.px(3, 7, tone(MUSTACHE, 1.6)); // brillo
    f.px(6, 7, tone(MUSTACHE, 1.6));
  },
  body(ctx, r, pal, rnd) {
    // Camisa blanca (casi toda bajo el poncho), rastra y faja.
    fill(ctx, r, SHIRT, rnd, 0.03);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      // Faja oscura con rayitas.
      for (let y = 5; y < 9; y++) for (let x = 0; x < b.w; x++) b.px(x, y, tone(FAJA, 0.9 + rnd() * 0.2));
      b.rect(0, 7, b.w, 1, tone(FAJA, 1.5));
      // Rastra: tira de cuero con monedas de plata.
      b.rect(0, 6, b.w, 1, LEATHER);
      for (let x = 0; x < b.w; x += 2) b.px(x, 6, SILVER);
    }
    // La pieza grande de la rastra, al frente.
    const f = brush(ctx, r.front);
    f.rect(2, 6, 4, 2, SILVER);
    f.rect(3, 6, 2, 1, [236, 238, 242]);
    f.px(2, 7, SILVER_DARK);
    f.px(5, 7, SILVER_DARK);
    f.rect(3, 7, 2, 1, tone(SILVER, 0.85));
    f.px(1, 7, SILVER_DARK); // cadenitas
    f.px(6, 7, SILVER_DARK);
    // Botonera de la camisa.
    for (let y = 1; y < 5; y += 2) f.px(4, y, tone(SHIRT, 0.82));
  },
  arm(ctx, r, pal, rnd) {
    // Manga larga de camisa, con el puño, y la mano.
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      noisy(b, SHIRT, 0.04, rnd);
      if (k === 'top') noisy(b, pal.color, 0.05, rnd);
      if (k === 'bottom') noisy(b, SKIN, 0.03, rnd);
      if (k === 'top' || k === 'bottom') continue;
      // Arriba, el poncho sobre el hombro (se ve al levantar el brazo).
      for (let y = 0; y < 3; y++) for (let x = 0; x < b.w; x++) b.px(x, y, tone(pal.color, 0.92 + rnd() * 0.12));
      b.px(1, 4, tone(SHIRT, 0.85)); // arruga
      b.px(0, 6, tone(SHIRT, 0.86));
      b.rect(0, 7, b.w, 1, tone(SHIRT, 0.8)); // puño
      b.rect(0, 8, b.w, 1, SKIN);
      b.px(1, 8, tone(SKIN, 0.9));
    }
  },
  leg(ctx, r, pal, rnd, side) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      noisy(b, BOMBACHA, 0.04, rnd);
      if (k === 'top') continue;
      if (k === 'bottom') {
        noisy(b, tone(BOOT, 0.6), 0.05, rnd);
        continue;
      }
      // Bombachas anchas: pliegues verticales y el bollo sobre la bota.
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < b.w; x++) {
          const fold = (x + (side === 'right' ? 1 : 0)) % 3 === 0;
          if (fold) b.px(x, y, tone(BOMBACHA, 0.84 + rnd() * 0.05));
        }
      }
      b.rect(0, 4, b.w, 1, tone(BOMBACHA, 0.78));
      b.px(1, 3, tone(BOMBACHA, 1.08));
      // Botas de cuero, con el doblez arriba y la suela.
      for (let y = 5; y < 8; y++) for (let x = 0; x < b.w; x++) b.px(x, y, tone(BOOT, 0.9 + rnd() * 0.2));
      b.rect(0, 5, b.w, 1, tone(BOOT, 1.28));
      b.rect(0, 7, b.w, 1, tone(BOOT, 0.6));
      if (k === 'back') {
        // Espuela de plata en el talón.
        b.rect(1, 6, 2, 1, SILVER);
        b.px(1, 6, [240, 242, 246]);
      }
    }
  },
};

/** Recorta en escalera las esquinas de una cara (para cosas redondas). */
function roundCorners(b, steps) {
  for (let i = 0; i < steps.length; i++) {
    const n = steps[i];
    b.clear(0, i, n, 1);
    b.clear(b.w - n, i, n, 1);
    b.clear(0, b.h - 1 - i, n, 1);
    b.clear(b.w - n, b.h - 1 - i, n, 1);
  }
}

export function accessories(kit, parts) {
  const { PX } = kit;

  // ---- Sombrero: ala ancha redondeada y copa con cinta ----
  const brim = kit.box(16, 1, 16, (ctx, r, p, rnd) => {
    fill(ctx, r, FELT, rnd, 0.06);
    const t = brush(ctx, r.top);
    const u = brush(ctx, r.bottom);
    noisy(u, FELT_DARK, 0.06, rnd);
    for (const b of [t, u]) {
      // Ribete del ala.
      for (let i = 0; i < 16; i++) {
        b.px(i, 0, FELT_DARK);
        b.px(i, 15, FELT_DARK);
        b.px(0, i, FELT_DARK);
        b.px(15, i, FELT_DARK);
      }
      roundCorners(b, [3, 2, 1]);
    }
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      noisy(b, FELT_DARK, 0.05, rnd);
      b.clear(0, 0, 3, 1);
      b.clear(13, 0, 3, 1);
    }
  });
  brim.position.y = 8.5 * PX;
  parts.head.add(brim);

  const crown = kit.box(12, 3, 12, (ctx, r, p, rnd) => {
    fill(ctx, r, FELT, rnd, 0.06);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      // Cinta de cuero con una hebillita de plata.
      b.rect(0, 2, b.w, 1, LEATHER);
      b.px(0, 0, tone(FELT, 1.25));
      b.px(1, 0, tone(FELT, 1.15));
    }
    brush(ctx, r.left).px(3, 2, SILVER);
    // Arriba, la copa hundida al medio.
    const t = brush(ctx, r.top);
    t.rect(2, 5, 8, 2, FELT_DARK);
    t.rect(2, 4, 8, 1, tone(FELT, 1.15));
  });
  crown.position.y = 10.5 * PX;
  parts.head.add(crown);

  // ---- Poncho: cae de los hombros, con guarda de rombos y flecos ----
  const poncho = kit.box(
    16,
    6,
    8,
    (ctx, r, p, rnd) => {
      fill(ctx, r, p.color, rnd, 0.05);
      noisy(brush(ctx, r.bottom), p.colorDeep, 0.05, rnd);
      for (const k of ['front', 'back', 'left', 'right']) {
        const b = brush(ctx, r[k]);
        // Tejido: rayitas verticales finas.
        for (let y = 0; y < 3; y++) for (let x = 1; x < b.w; x += 3) b.px(x, y, p.colorDark, 0.5);
        // Guarda: franja oscura con rombos claros.
        b.rect(0, 3, b.w, 2, p.colorDeep);
        for (let x = 0; x < b.w; x++) {
          if (x % 4 === 1 || x % 4 === 2) b.px(x, 3, CREAM);
          if (x % 4 === 0 || x % 4 === 3) b.px(x, 4, tone(CREAM, 0.9));
        }
        // Flecos: uno sí y uno no.
        for (let x = 0; x < b.w; x++) {
          if (x % 2 === 0) b.px(x, 5, tone(p.colorLight, 0.95 + rnd() * 0.1));
          else b.clear(x, 5, 1, 1);
        }
      }
    },
    [0.5, 1, 0.5],
  );
  poncho.position.y = 9 * PX;
  parts.body.add(poncho);

  // ---- Pañuelo anudado bajo el mentón ----
  const scarf = kit.box(
    4,
    3,
    1,
    (ctx, r, p, rnd) => {
      fill(ctx, r, SHIRT, rnd, 0.03);
      for (const k of ['front', 'back']) {
        const b = brush(ctx, r[k]);
        b.px(0, 0, p.colorDeep);
        b.px(3, 0, p.colorDeep);
        b.rect(1, 0, 2, 1, tone(SHIRT, 0.82)); // el nudo
        b.px(2, 1, p.colorDeep);
        b.clear(0, 1, 1, 2);
        b.clear(3, 1, 1, 2);
        b.clear(2, 2, 1, 1);
      }
    },
    [0.5, 1, 0],
  );
  scarf.position.set(0, 9 * PX, 4 * PX);
  parts.body.add(scarf);
}
