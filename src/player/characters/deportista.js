// Personaje "Deportista": jugador de fútbol. Camiseta del color elegido con
// cuello en V, vivos y el número 10 en la espalda, short blanco, medias
// largas con franjas, botines con tapones y vincha. Pelo negro corto y
// rizado, piel morena.

import { brush, mix, noisy, tone } from './humanoid.js';

const SKIN = [164, 106, 70];
const HAIR = [26, 20, 20];
const HAIR_SHINE = [70, 56, 52];
const WHITE = [242, 242, 236];
const BOOT = [34, 34, 40];
const BOOT_DETAIL = [250, 120, 40];
const STUD = [196, 196, 204];

const ALL = ['front', 'back', 'left', 'right', 'top', 'bottom'];
const SIDES = ['front', 'back', 'left', 'right'];

export const id = 'deportista';
export const name = 'Deportista';

/** Detalles de la camiseta: blancos, o del tono oscuro si la camiseta es muy clara. */
function trim(pal) {
  const [r, g, b] = pal.color;
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? pal.colorDeep : WHITE;
}

/** Números de 3x5 para la espalda. */
const DIGITS = {
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
};

function digit(b, d, x0, y0, color) {
  DIGITS[d].forEach((row, y) => {
    for (let x = 0; x < 3; x++) if (row[x] === '#') b.px(x0 + x, y0 + y, color);
  });
}

/** Pelo rizado: rulitos chiquitos (un punto claro cada tanto). */
function curl(b, x, y, rnd) {
  const ring = (x * 3 + y * 5) % 4;
  const c = ring === 0 ? mix(HAIR, HAIR_SHINE, 0.8) : ring === 2 ? tone(HAIR, 0.7) : HAIR;
  b.px(x, y, tone(c, 0.92 + rnd() * 0.16));
}

/** La cara: la vincha tapa las dos filas de arriba. */
export function face(b, expr, blink) {
  const eye = [36, 22, 18];
  const white = [246, 244, 236];
  const brow = HAIR;
  const mouth = [96, 40, 34];
  const ey = 4;
  for (const x of [2, 6]) {
    const inner = x < 5 ? x + 1 : x;
    const outer = x < 5 ? x : x + 1;
    if (blink) {
      b.rect(x, ey + 1, 2, 1, eye);
    } else if (expr === 'feliz') {
      b.px(x, ey + 1, eye);
      b.px(x + 1, ey + 1, eye);
      b.px(outer, ey, eye);
    } else if (expr === 'sorprendido') {
      b.rect(x, ey - 1, 2, 3, white);
      b.rect(inner, ey, 1, 2, eye);
    } else {
      b.rect(x, ey, 2, 2, white);
      b.rect(inner, ey, 1, 2, eye);
      if (expr === 'determinado') b.px(outer, ey, tone(SKIN, 0.8));
    }
    // Cejas gruesas.
    if (expr === 'determinado') {
      b.px(outer, ey - 2, brow);
      b.rect(inner, ey - 1, 1, 1, brow);
      b.px(inner, ey - 2, brow);
    } else if (expr === 'sorprendido') {
      b.rect(x, ey - 2, 2, 1, tone(brow, 1.3));
    } else {
      b.rect(x, ey - 2, 2, 1, brow);
      b.px(outer, ey - 1, tone(SKIN, 0.85));
    }
  }
  b.px(4, 6, tone(SKIN, 0.82));
  b.px(5, 6, tone(SKIN, 0.9));
  if (expr === 'feliz') {
    b.rect(3, 7, 4, 1, white);
    b.rect(3, 8, 4, 1, mouth);
    b.px(2, 7, mouth);
    b.px(7, 7, mouth);
  } else if (expr === 'sorprendido') {
    b.rect(4, 7, 2, 2, mouth);
  } else if (expr === 'determinado') {
    // Dientes apretados.
    b.rect(3, 8, 4, 1, white);
    b.rect(3, 7, 4, 1, mouth);
  } else {
    b.rect(3, 8, 4, 1, mouth);
    b.px(2, 7, mouth);
    b.px(7, 7, mouth);
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of ALL) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    const top = brush(ctx, r.top);
    for (let y = 0; y < top.h; y++) for (let x = 0; x < top.w; x++) curl(top, x, y, rnd);
    // Pelo corto: debajo de la vincha, en la nuca y los costados.
    const back = brush(ctx, r.back);
    for (let x = 0; x < back.w; x++) for (let y = 0; y < 6; y++) curl(back, x, y, rnd);
    for (let x = 1; x < back.w - 1; x++) back.px(x, 6, mix(HAIR, SKIN, 0.5));
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let i = 0; i < b.w; i++) {
        const x = k === 'right' ? i : b.w - 1 - i; // i: de atrás para adelante
        const depth = i < 4 ? 6 : i < 8 ? 4 : 3;
        for (let y = 0; y < depth; y++) curl(b, x, y, rnd);
      }
      const ex = k === 'right' ? 5 : 4; // oreja
      b.px(ex, 4, tone(SKIN, 0.86));
      b.px(ex, 5, tone(SKIN, 0.78));
      b.px(ex, 6, tone(SKIN, 0.86));
    }
    const f = brush(ctx, r.front);
    for (let x = 0; x < f.w; x++) curl(f, x, 0, rnd);
    for (const x of [0, 9]) curl(f, x, 1, rnd);
    f.px(0, 2, HAIR);
    f.px(9, 2, HAIR);
  },
  body(ctx, r, pal, rnd) {
    // Camiseta: del color elegido con una trama de bandas finitas.
    const t = trim(pal);
    for (const k of ALL) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const band = x % 2 ? 1.04 : 0.97;
          b.px(x, y, tone(pal.color, band * (0.97 + rnd() * 0.06)));
        }
      }
    }
    const f = brush(ctx, r.front);
    // Cuello en V.
    f.rect(3, 0, 2, 1, tone(SKIN, 0.9));
    f.px(3, 1, tone(SKIN, 0.9));
    f.px(4, 1, tone(SKIN, 0.85));
    f.px(2, 0, t);
    f.px(5, 0, t);
    f.px(3, 2, t);
    f.px(4, 2, t);
    f.px(2, 1, t);
    f.px(5, 1, t);
    // Escudo (lado izquierdo del pecho).
    f.px(6, 3, [244, 206, 70]);
    f.px(6, 4, tone([244, 206, 70], 0.8));
    f.px(5, 3, tone(t, 0.9));
    // Ruedo.
    for (const k of SIDES) brush(ctx, r[k]).rect(0, 8, r[k].w, 1, pal.colorDark);
    // Vivos blancos a los costados.
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < 8; y++) b.px(2, y, t);
    }
    // Espalda: cuello y el número 10.
    const bk = brush(ctx, r.back);
    bk.rect(2, 0, 4, 1, t);
    digit(bk, 1, 0, 2, t);
    digit(bk, 0, 4, 2, t);
    brush(ctx, r.top).rect(3, 1, 2, 3, tone(SKIN, 0.9));
  },
  arm(ctx, r, pal, rnd, side) {
    const t = trim(pal);
    for (const k of ALL) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    noisy(brush(ctx, r.top), pal.color, 0.04, rnd);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      noisy(brush(ctx, { x: r[k].x, y: r[k].y, w: b.w, h: 3 }), pal.color, 0.04, rnd);
      b.rect(0, 3, b.w, 1, t);
      b.rect(0, 4, b.w, 1, tone(SKIN, 0.85)); // sombra de la manga
    }
    // Cinta de capitán en el brazo izquierdo.
    if (side === 'left') {
      const band = trim(pal) === WHITE ? [250, 206, 40] : WHITE;
      for (const k of SIDES) brush(ctx, r[k]).rect(0, 1, r[k].w, 1, band);
      brush(ctx, r.left).px(1, 1, tone(band, 0.6));
    }
  },
  leg(ctx, r, pal, rnd, side) {
    // Short blanco con la franja del color, medias largas y botines.
    for (const k of ALL) noisy(brush(ctx, r[k]), WHITE, 0.03, rnd);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      b.rect(0, 2, b.w, 1, tone(WHITE, 0.84)); // ruedo del short
      for (let x = 0; x < b.w; x++) {
        b.px(x, 3, tone(pal.color, 0.95 + rnd() * 0.08));
        b.px(x, 4, tone(WHITE, 0.95));
        b.px(x, 5, tone(pal.color, 0.9 + rnd() * 0.06));
        b.px(x, 6, tone(BOOT, 0.95 + rnd() * 0.15));
        b.px(x, 7, x === 0 || x === b.w - 1 ? STUD : tone(BOOT, 0.6)); // tapones
      }
    }
    // Franja del short del lado de afuera y el detalle de los botines.
    const out = brush(ctx, r[side]);
    for (let y = 0; y < 3; y++) out.px(1, y, pal.color), out.px(2, y, pal.colorDark);
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      const fx = (i) => (k === 'right' ? i : 3 - i);
      b.px(fx(1), 6, BOOT_DETAIL);
      b.px(fx(2), 6, BOOT_DETAIL);
    }
    brush(ctx, r.front).px(1, 6, tone(BOOT, 1.6)); // cordones
    brush(ctx, r.front).px(2, 6, tone(BOOT, 1.6));
    const bt = brush(ctx, r.bottom);
    noisy(bt, tone(BOOT, 0.8), 0.05, rnd);
    for (const [x, y] of [
      [0, 0],
      [3, 0],
      [1, 1],
      [2, 1],
      [0, 3],
      [3, 3],
    ])
      bt.px(x, y, STUD);
  },
};

/** La vincha y los rulos de arriba. */
export function accessories(kit, parts) {
  const { PX } = kit;
  const band = kit.box(
    11,
    2,
    11,
    (ctx, r) => {
      for (const k of SIDES) {
        const b = brush(ctx, r[k]);
        for (let x = 0; x < b.w; x++) {
          b.px(x, 0, tone(WHITE, 1));
          b.px(x, 1, x % 2 ? tone(WHITE, 0.9) : tone(WHITE, 0.94));
        }
      }
      // Arriba y abajo: solo el borde (el medio queda adentro de la cabeza).
      for (const k of ['top', 'bottom']) {
        const b = brush(ctx, r[k]);
        b.rect(0, 0, b.w, 1, WHITE);
        b.rect(0, b.h - 1, b.w, 1, WHITE);
        b.rect(0, 0, 1, b.h, WHITE);
        b.rect(b.w - 1, 0, 1, b.h, WHITE);
      }
    },
    [0.5, 0, 0.5],
  );
  band.position.set(0, 8 * PX, 0);
  parts.head.add(band);
  // Rulos que asoman arriba: una capa con el borde irregular.
  const curls = kit.box(
    10,
    3,
    10,
    (ctx, r, pal, rnd) => {
      for (const k of ['top', 'bottom']) {
        const b = brush(ctx, r[k]);
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) curl(b, x, y, rnd);
      }
      for (const k of SIDES) {
        const b = brush(ctx, r[k]);
        for (let x = 0; x < b.w; x++) {
          curl(b, x, 1, rnd);
          curl(b, x, 2, rnd);
          if ((x * 7 + (k === 'front' ? 1 : 3)) % 3 !== 0) curl(b, x, 0, rnd);
        }
      }
    },
    [0.5, 0, 0.5],
  );
  curls.scale.set(0.96, 1, 0.96);
  curls.position.set(0, 9 * PX, 0);
  parts.head.add(curls);
}
