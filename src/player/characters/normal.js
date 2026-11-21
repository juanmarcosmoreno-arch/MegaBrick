// Personaje "Normal": una persona común. Pelo negro con jopo, campera del
// color elegido abierta sobre una remera rayada, pantalón caqui y
// zapatillas naranjas. Es el de entrada y el ejemplo de cómo se hace un
// personaje (ver humanoid.js): un pintor por parte, la cara y los
// accesorios (acá, el jopo).

import { brush, mix, noisy, tone } from './humanoid.js';

const SKIN = [226, 172, 132];
const HAIR = [34, 30, 36];
const HAIR_SHINE = [74, 72, 92];
const TEE = [238, 236, 228];
const STRIPE = [46, 58, 96];
const KHAKI = [184, 160, 114];
const SHOE = [232, 108, 62];
const SOLE = [240, 238, 232];

const ALL = ['front', 'back', 'left', 'right', 'top', 'bottom'];
const SIDES = ['front', 'back', 'left', 'right'];

export const id = 'normal';
export const name = 'Normal';

/**
 * La cara: ojos grandes y oscuros con un brillito, cachetes rosados y una
 * sonrisa chiquita (no la boca recta de siempre).
 */
export function face(b, expr, blink) {
  const eye = [44, 30, 26];
  const white = [248, 246, 240];
  const brow = HAIR;
  const mouth = [140, 62, 56];
  const cheek = mix(SKIN, [236, 120, 110], 0.45);
  const ey = 4;
  for (const x of [2, 6]) {
    const inner = x < 5 ? x + 1 : x; // la columna del ojo que da a la nariz
    const outer = x < 5 ? x : x + 1;
    if (blink) {
      b.rect(x, ey + 1, 2, 1, eye);
    } else if (expr === 'feliz') {
      // Ojitos cerrados de risa (arquitos para arriba).
      b.px(x, ey + 1, eye);
      b.px(x + 1, ey + 1, eye);
      b.px(outer, ey, eye);
    } else if (expr === 'sorprendido') {
      b.rect(x, ey - 1, 2, 3, white);
      b.rect(x, ey, 2, 2, eye);
      b.px(outer, ey, white);
    } else {
      b.rect(x, ey, 2, 2, eye);
      b.px(outer, ey, white); // brillito
    }
    // Cejas.
    if (expr === 'determinado') {
      b.px(outer, ey - 2, brow);
      b.px(inner, ey - 1, brow);
    } else if (expr === 'sorprendido') {
      b.rect(x, ey - 3, 2, 1, brow);
    } else {
      b.rect(x, ey - 2, 2, 1, brow);
    }
  }
  // Cachetes.
  if (expr !== 'determinado') {
    b.px(1, 7, cheek);
    b.px(8, 7, cheek);
  }
  // Nariz: una sombrita.
  b.px(4, 6, tone(SKIN, 0.86));
  // Boca.
  if (expr === 'feliz') {
    b.rect(3, 7, 4, 1, [250, 246, 240]); // dientes
    b.rect(3, 8, 4, 1, mouth);
    b.px(2, 7, mouth);
    b.px(7, 7, mouth);
  } else if (expr === 'sorprendido') {
    b.rect(4, 7, 2, 2, mouth);
    b.px(4, 7, tone(mouth, 0.7));
  } else if (expr === 'determinado') {
    b.rect(3, 8, 4, 1, mouth);
  } else {
    b.rect(4, 8, 2, 1, mouth);
    b.px(3, 7, mouth);
    b.px(6, 7, mouth);
  }
}

/** Mechones de pelo: un tono con rayitas más claras. */
function hairPx(b, x, y, rnd) {
  const k = (x + y * 2) % 4 === 0 ? 0.25 : 0;
  b.px(x, y, tone(mix(HAIR, HAIR_SHINE, k), 0.9 + rnd() * 0.2));
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of ALL) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    const top = brush(ctx, r.top);
    for (let y = 0; y < top.h; y++) for (let x = 0; x < top.w; x++) hairPx(top, x, y, rnd);
    // Nuca: pelo hasta abajo, rebajado (más claro) en la última fila.
    const back = brush(ctx, r.back);
    for (let x = 0; x < back.w; x++) {
      for (let y = 0; y < 6; y++) hairPx(back, x, y, rnd);
      back.px(x, 6, mix(HAIR, SKIN, 0.45));
    }
    // Costados: arriba con pelo, rapado más abajo y una patilla.
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let i = 0; i < b.w; i++) {
        const x = k === 'right' ? i : b.w - 1 - i; // i: de atrás para adelante
        for (let y = 0; y < 3; y++) hairPx(b, x, y, rnd);
        if (i < 7) b.px(x, 3, mix(HAIR, SKIN, 0.35 + rnd() * 0.1));
        if (i < 6) b.px(x, 4, mix(HAIR, SKIN, 0.6));
        if (i < 4) b.px(x, 5, mix(HAIR, SKIN, 0.6));
      }
      const fx = k === 'right' ? 7 : 2; // patilla, adelante de la oreja
      b.px(fx, 3, HAIR);
      b.px(fx, 4, HAIR);
      const ex = k === 'right' ? 5 : 4; // oreja
      b.px(ex, 5, tone(SKIN, 0.82));
      b.px(ex, 6, tone(SKIN, 0.88));
    }
    // Adelante: la raíz del jopo y las entradas.
    const f = brush(ctx, r.front);
    for (let x = 0; x < f.w; x++) hairPx(f, x, 0, rnd);
    for (const x of [0, 1, 8, 9]) hairPx(f, x, 1, rnd);
    f.px(0, 2, HAIR);
    f.px(9, 2, HAIR);
  },
  body(ctx, r, pal, rnd) {
    // Campera del color elegido, abierta, con la remera rayada abajo.
    for (const k of ALL) noisy(brush(ctx, r[k]), pal.color, 0.04, rnd);
    const f = brush(ctx, r.front);
    for (let y = 0; y < f.h; y++) {
      const c = y >= 2 && y % 2 === 0 ? STRIPE : TEE;
      f.px(3, y, tone(c, 0.96 + rnd() * 0.06));
      f.px(4, y, tone(c, 0.92 + rnd() * 0.06));
    }
    f.rect(3, 0, 2, 1, tone(SKIN, 0.9)); // cuello
    f.px(3, 1, TEE);
    f.px(4, 1, tone(TEE, 0.9));
    // Solapas y cierre.
    f.px(2, 0, pal.colorLight);
    f.px(5, 0, pal.colorLight);
    f.px(2, 1, pal.colorLight);
    f.px(5, 1, pal.colorLight);
    for (let y = 2; y < 8; y++) {
      f.px(2, y, mix(pal.colorDark, [200, 200, 205], y % 2 ? 0.35 : 0.15));
      f.px(5, y, mix(pal.colorDark, [200, 200, 205], y % 2 ? 0.15 : 0.35));
    }
    // Bolsillos.
    f.rect(0, 5, 2, 1, tone(pal.colorDark, 0.9));
    f.rect(6, 5, 2, 1, tone(pal.colorDark, 0.9));
    f.rect(0, 6, 2, 1, tone(pal.color, 1.08));
    f.rect(6, 6, 2, 1, tone(pal.color, 1.08));
    // Puño de abajo (elastizado) en todo el contorno, menos en la remera.
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < b.w; x++) b.px(x, 8, x % 2 ? pal.colorDark : tone(pal.colorDark, 0.88));
    }
    f.px(3, 8, tone(TEE, 0.85));
    f.px(4, 8, tone(TEE, 0.8));
    // Espalda: el canesú y un cuello.
    const bk = brush(ctx, r.back);
    bk.rect(0, 0, 8, 1, pal.colorLight);
    for (let x = 0; x < 8; x++) bk.px(x, 2, tone(pal.color, 0.84));
    // Costuras de los costados.
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let y = 1; y < 8; y++) b.px(2, y, tone(pal.color, 0.86));
    }
    brush(ctx, r.top).rect(3, 1, 2, 3, tone(SKIN, 0.9));
  },
  arm(ctx, r, pal, rnd) {
    // Manga larga, con puño elastizado y la mano.
    for (const k of ALL) noisy(brush(ctx, r[k]), pal.color, 0.04, rnd);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      b.rect(0, 0, b.w, 1, tone(pal.color, 1.06));
      for (let x = 0; x < b.w; x++) b.px(x, 4, tone(pal.color, 0.88 + rnd() * 0.05)); // pliegue del codo
      b.rect(0, 7, b.w, 1, pal.colorDark);
      noisy(brush(ctx, { x: r[k].x, y: r[k].y + 8, w: b.w, h: 1 }), SKIN, 0.03, rnd);
    }
    noisy(brush(ctx, r.bottom), tone(SKIN, 0.92), 0.03, rnd);
  },
  leg(ctx, r, pal, rnd) {
    // Pantalón caqui con la botamanga doblada y zapatillas naranjas.
    for (const k of ALL) noisy(brush(ctx, r[k]), KHAKI, 0.05, rnd);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      b.rect(0, 4, b.w, 1, tone(KHAKI, 1.12));
      for (let x = 0; x < b.w; x++) {
        b.px(x, 5, tone(SHOE, 1.02 + rnd() * 0.06));
        b.px(x, 6, tone(SHOE, 0.88 + rnd() * 0.06));
        b.px(x, 7, x % 2 ? SOLE : tone(SOLE, 0.9));
      }
    }
    // Costura del pantalón y detalles de la zapatilla.
    const f = brush(ctx, r.front);
    f.px(1, 5, SOLE); // cordones
    f.px(2, 5, tone(SOLE, 0.9));
    f.px(1, 6, tone(SHOE, 0.75));
    f.px(2, 6, tone(SHOE, 0.75));
    for (let y = 0; y < 4; y++) f.px(3, y, tone(KHAKI, 0.88));
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < 4; y++) b.px(2, y, tone(KHAKI, 0.9));
      // La tira del costado: una curva blanca.
      const fx = (i) => (k === 'right' ? i : 3 - i); // i: de atrás para adelante
      b.px(fx(1), 6, SOLE);
      b.px(fx(2), 5, SOLE);
      b.px(fx(3), 5, SOLE);
    }
    const bk = brush(ctx, r.back);
    bk.rect(1, 5, 2, 1, tone(SHOE, 0.7)); // talón
    const bt = brush(ctx, r.bottom);
    for (let y = 0; y < bt.h; y++) for (let x = 0; x < bt.w; x++) bt.px(x, y, (x + y) % 2 ? tone(SOLE, 0.8) : tone(SOLE, 0.7));
  },
};

/** El jopo: un mechón alto que sale de la frente. */
export function accessories(kit, parts) {
  const { PX } = kit;
  const paintHair = (ctx, r, pal, rnd) => {
    for (const k of ALL) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) hairPx(b, x, y, rnd);
    }
    // Brillo arriba, adelante.
    const t = brush(ctx, r.top);
    for (let x = 1; x < t.w - 1; x++) t.px(x, t.h - 1, mix(HAIR, HAIR_SHINE, 0.7));
  };
  const base = kit.box(8, 2, 6, paintHair, [0.5, 0, 1]);
  base.position.set(0, 10 * PX, 5 * PX);
  parts.head.add(base);
  const tip = kit.box(6, 1, 4, paintHair, [0.5, 0, 1]);
  tip.position.set(0, 12 * PX, 6 * PX);
  parts.head.add(tip);
}
