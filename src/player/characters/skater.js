// Personaje "Skater": gorra puesta al revés, buzo con capucha holgado del
// color elegido con un rayo estampado, bermuda ancha de jean, zapatillas
// chatas de suela gruesa y la tabla colgada en la espalda. Pelo rubio largo
// que asoma por debajo de la gorra; piel clara con pecas.
//
// El buzo, la bermuda y las zapatillas son cajas un poco más grandes que el
// cuerpo y las piernas (para que se vean holgados): las partes de abajo se
// dejan transparentes donde quedan tapadas.

import { brush, mix, noisy, seeded, tone } from './humanoid.js';

const SKIN = [246, 212, 184];
const FRECKLE = [208, 140, 100];
const HAIR = [214, 168, 92];
const HAIR_SHINE = [244, 214, 150];
const CAP = [48, 50, 60];
const DENIM = [120, 150, 186];
const SOCK = [240, 240, 234];
const SHOE = [58, 56, 64];
const SOLE = [238, 232, 214];
const WOOD = [206, 160, 100];

const ALL = ['front', 'back', 'left', 'right', 'top', 'bottom'];
const SIDES = ['front', 'back', 'left', 'right'];

export const id = 'skater';
export const name = 'Skater';

/** El estampado: crema, o del tono oscuro si el buzo es muy claro. */
function print(pal) {
  const [r, g, b] = pal.color;
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? pal.colorDeep : [252, 236, 168];
}

/** Pelo lacio: mechones verticales. */
function hairPx(b, x, y, rnd) {
  const k = x % 3 === 0 ? 0.45 : x % 3 === 2 ? -0.12 : 0;
  const c = k > 0 ? mix(HAIR, HAIR_SHINE, k) : tone(HAIR, 1 + k);
  b.px(x, y, tone(c, 0.95 + rnd() * 0.1));
}

/** La cara: la gorra tapa las dos filas de arriba; pecas en los cachetes. */
export function face(b, expr, blink) {
  const eye = [52, 112, 104];
  const white = [250, 248, 244];
  const brow = tone(HAIR, 0.72);
  const mouth = [176, 82, 80];
  const ey = 4;
  // Pelo a los costados de la cara.
  const rnd = seeded(5);
  for (let y = 2; y < 8; y++) {
    hairPx(b, 0, y, rnd);
    hairPx(b, 9, y, rnd);
  }
  for (let x = 1; x < 9; x++) if (x < 3 || x > 6) hairPx(b, x, 2, rnd); // flequillo
  for (const x of [2, 6]) {
    const inner = x < 5 ? x + 1 : x;
    const outer = x < 5 ? x : x + 1;
    if (blink) {
      b.rect(x, ey + 1, 2, 1, tone(eye, 0.5));
    } else if (expr === 'feliz') {
      b.px(x, ey + 1, tone(eye, 0.5));
      b.px(x + 1, ey + 1, tone(eye, 0.5));
      b.px(inner, ey, tone(eye, 0.5));
    } else if (expr === 'sorprendido') {
      b.rect(x, ey - 1, 2, 3, white);
      b.rect(x, ey, 2, 2, eye);
      b.px(outer, ey, white);
    } else {
      b.rect(x, ey, 2, 2, eye);
      b.px(outer, ey, white);
      b.px(inner, ey + 1, tone(eye, 0.6));
      if (expr === 'determinado') b.rect(x, ey, 2, 1, tone(SKIN, 0.84)); // ojos entrecerrados
    }
    // Cejas (finitas, del color del pelo).
    if (expr === 'determinado') {
      b.px(inner, ey - 1, brow);
      b.px(outer, ey - 1, tone(SKIN, 0.9));
    } else if (expr === 'sorprendido') {
      b.px(inner, ey - 2, brow);
      b.px(outer, ey - 2, brow);
    } else {
      b.px(x + (x < 5 ? 0 : 1), ey - 1, brow);
    }
  }
  // Pecas.
  for (const [x, y] of [
    [1, 6],
    [2, 7],
    [3, 6],
    [6, 6],
    [7, 7],
    [8, 6],
  ])
    b.px(x, y, mix(SKIN, FRECKLE, 0.7));
  b.px(4, 6, tone(SKIN, 0.9));
  if (expr === 'feliz') {
    b.rect(3, 7, 4, 1, white);
    b.rect(4, 8, 2, 1, mouth);
    b.px(3, 8, tone(mouth, 0.8));
    b.px(6, 8, tone(mouth, 0.8));
  } else if (expr === 'sorprendido') {
    b.rect(4, 7, 2, 2, tone(mouth, 0.7));
  } else if (expr === 'determinado') {
    b.rect(4, 8, 3, 1, mouth);
    b.px(3, 7, tone(SKIN, 0.85));
  } else {
    // Media sonrisa canchera.
    b.rect(4, 8, 2, 1, mouth);
    b.px(6, 7, mouth);
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of ALL) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    for (const k of ['top', 'back']) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) hairPx(b, x, y, rnd);
    }
    // Costados: el pelo largo tapa las orejas.
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let i = 0; i < b.w; i++) {
        const x = k === 'right' ? i : b.w - 1 - i; // i: de atrás para adelante
        const depth = i < 7 ? 10 : i < 9 ? 8 : 6;
        for (let y = 0; y < depth; y++) hairPx(b, x, y, rnd);
      }
    }
    const bt = brush(ctx, r.bottom);
    for (let y = 6; y < bt.h; y++) for (let x = 0; x < bt.w; x++) hairPx(bt, x, y, rnd);
  },
  body() {
    // El cuerpo queda tapado por el buzo (ver accessories).
  },
  arm(ctx, r, pal, rnd) {
    // Manga larga y holgada, con puño y la mano.
    for (const k of ALL) noisy(brush(ctx, r[k]), pal.color, 0.05, rnd);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < b.w; x++) {
        b.px(x, (x + 2) % 3 === 0 ? 3 : 4, tone(pal.color, 0.84)); // arrugas
        b.px(x, x % 2 ? 5 : 6, tone(pal.color, 1.08));
      }
      b.rect(0, 7, b.w, 1, pal.colorDark);
      noisy(brush(ctx, { x: r[k].x, y: r[k].y + 8, w: b.w, h: 1 }), SKIN, 0.03, rnd);
    }
    noisy(brush(ctx, r.bottom), tone(SKIN, 0.92), 0.03, rnd);
  },
  leg(ctx, r) {
    // Solo se ven las medias: lo demás lo tapan la bermuda y las zapatillas.
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < b.w; x++) b.px(x, 5, x % 2 ? SOCK : tone(SOCK, 0.9));
    }
  },
};

/** El buzo, la gorra, la tabla, la bermuda y las zapatillas. */
export function accessories(kit, parts) {
  const { PX } = kit;

  // ---- Buzo con capucha (8 x 10 x 6, cuelga un poco por debajo de la cadera).
  const hoodie = kit.box(
    8,
    10,
    6,
    (ctx, r, pal, rnd) => {
      for (const k of ALL) noisy(brush(ctx, r[k]), pal.color, 0.05, rnd);
      const ink = print(pal);
      const f = brush(ctx, r.front);
      // Capucha alrededor del cuello y los cordones.
      f.rect(1, 0, 6, 1, pal.colorDark);
      f.rect(3, 0, 2, 1, tone(SKIN, 0.85));
      f.px(2, 1, SOCK);
      f.px(2, 2, tone(SOCK, 0.85));
      f.px(5, 1, SOCK);
      f.px(5, 2, tone(SOCK, 0.85));
      f.px(5, 3, SOCK);
      // El rayo.
      for (const [x, y] of [
        [5, 3],
        [4, 4],
        [3, 5],
        [4, 5],
        [5, 5],
        [4, 6],
        [3, 7],
      ])
        f.px(x, y, ink);
      f.px(6, 4, tone(pal.color, 0.8)); // sombrita del rayo
      // Bolsillo canguro.
      f.px(0, 7, pal.colorDark);
      f.px(1, 8, pal.colorDark);
      f.px(7, 7, pal.colorDark);
      f.px(6, 8, pal.colorDark);
      for (const k of SIDES) {
        const b = brush(ctx, r[k]);
        for (let x = 0; x < b.w; x++) b.px(x, 9, x % 2 ? pal.colorDark : tone(pal.colorDark, 0.85));
      }
      // Espalda: la capucha caída.
      const bk = brush(ctx, r.back);
      for (let x = 1; x < 7; x++) bk.px(x, 0, pal.colorLight);
      for (let y = 1; y < 4; y++) {
        bk.px(1, y, pal.colorDark);
        bk.px(6, y, pal.colorDark);
        for (let x = 2; x < 6; x++) bk.px(x, y, tone(pal.color, 0.9));
      }
      bk.rect(2, 4, 4, 1, pal.colorDark);
      // Costados: arrugas.
      for (const k of ['left', 'right']) {
        const b = brush(ctx, r[k]);
        for (let y = 2; y < 9; y += 3) b.px(2 + (y % 2), y, tone(pal.color, 0.84));
      }
      const t = brush(ctx, r.top);
      t.rect(2, 1, 4, 4, tone(SKIN, 0.85));
    },
    [0.5, 0, 0.5],
  );
  hoodie.position.set(0, -PX, 0);
  parts.body.add(hoodie);

  // ---- La tabla, cruzada en la espalda.
  const board = kit.box(
    4,
    14,
    1,
    (ctx, r, pal, rnd) => {
      for (const k of ALL) noisy(brush(ctx, r[k]), WOOD, 0.06, rnd);
      // Arriba (contra la espalda): la lija negra.
      noisy(brush(ctx, r.front), [40, 40, 44], 0.1, rnd);
      // Abajo (para afuera): el dibujo, con franjas del color elegido.
      const b = brush(ctx, r.back);
      noisy(b, [240, 232, 210], 0.03, rnd);
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          if ((x + y) % 5 === 0 || (x + y) % 5 === 1) b.px(x, y, pal.color);
        }
      }
      b.rect(0, 0, b.w, 1, [40, 40, 44]);
      b.rect(0, b.h - 1, b.w, 1, [40, 40, 44]);
      b.rect(1, 6, 2, 2, [230, 70, 60]); // la calcomanía
    },
    [0.5, 0.5, 0.5],
  );
  board.position.set(0, 4.5 * PX, -3.5 * PX);
  board.rotation.z = 0.42;
  parts.body.add(board);
  for (const y of [-4.5, 4.5]) {
    const truck = kit.box(
      4,
      1,
      1,
      (ctx, r) => {
        for (const k of ALL) {
          const b = brush(ctx, r[k]);
          b.rect(0, 0, b.w, b.h, [150, 154, 162]);
          if (k !== 'left' && k !== 'right') {
            b.px(0, 0, [250, 226, 120]);
            b.px(b.w - 1, 0, [250, 226, 120]);
          }
        }
        brush(ctx, r.left).px(0, 0, [250, 226, 120]);
        brush(ctx, r.right).px(0, 0, [250, 226, 120]);
      },
      [0.5, 0.5, 0.5],
    );
    truck.position.set(0, y * PX, -PX);
    truck.scale.set(1.25, 1, 1);
    board.add(truck);
  }

  // ---- Gorra al revés: la copa y la visera atrás.
  const crown = kit.box(
    11,
    3,
    11,
    (ctx, r, pal, rnd) => {
      for (const k of ALL) noisy(brush(ctx, r[k]), CAP, 0.06, rnd);
      // Adelante se ve la parte de atrás de la gorra: la abertura con el pelo y la tira.
      const f = brush(ctx, r.front);
      f.rect(4, 1, 3, 2, HAIR);
      f.px(5, 1, HAIR_SHINE);
      f.rect(3, 1, 1, 1, tone(CAP, 1.5));
      f.rect(7, 1, 1, 1, tone(CAP, 1.5));
      f.px(3, 2, tone(CAP, 1.3));
      f.px(7, 2, tone(CAP, 1.3));
      // Atrás, el frente de la gorra con un logo del color elegido.
      const bk = brush(ctx, r.back);
      bk.rect(4, 0, 3, 2, pal.color);
      bk.px(5, 0, pal.colorLight);
      // Costuras y el botón de arriba.
      const t = brush(ctx, r.top);
      for (let i = 0; i < 11; i++) {
        t.px(5, i, tone(CAP, 0.8));
        t.px(i, 5, tone(CAP, 0.8));
      }
      t.px(5, 5, pal.color);
      for (const k of SIDES) brush(ctx, r[k]).rect(0, 2, r[k].w, 1, tone(CAP, 0.8));
      const bt = brush(ctx, r.bottom); // solo el borde (el medio está adentro de la cabeza)
      bt.clear(1, 1, 9, 9);
    },
    [0.5, 0, 0.5],
  );
  crown.position.set(0, 8 * PX, 0);
  parts.head.add(crown);
  const brim = kit.box(
    6,
    1,
    5,
    (ctx, r, pal, rnd) => {
      for (const k of ALL) noisy(brush(ctx, r[k]), CAP, 0.06, rnd);
      noisy(brush(ctx, r.bottom), pal.colorDark, 0.05, rnd);
      const t = brush(ctx, r.top);
      for (let x = 0; x < t.w; x++) t.px(x, 0, tone(CAP, 0.75)); // costura de la punta
    },
    [0.5, 0, 1],
  );
  brim.position.set(0, 8 * PX, -5.5 * PX);
  brim.rotation.x = -0.12;
  parts.head.add(brim);

  // ---- Pelo largo que cae sobre la nuca.
  const tail = kit.box(
    10,
    3,
    2,
    (ctx, r, pal, rnd) => {
      for (const k of ALL) {
        const b = brush(ctx, r[k]);
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) hairPx(b, x, y, rnd);
      }
      // Puntas desparejas.
      for (const k of ['back', 'front']) {
        const b = brush(ctx, r[k]);
        for (let x = 0; x < b.w; x++) if (x % 3 !== 1) b.clear(x, 2, 1, 1);
      }
    },
    [0.5, 1, 0],
  );
  tail.position.set(0, 0, -5 * PX);
  parts.head.add(tail);

  // ---- Bermuda ancha y zapatillas de suela gruesa, en cada pierna.
  for (const [leg, s] of [
    [parts.legR, -1],
    [parts.legL, 1],
  ]) {
    const shorts = kit.box(
      5,
      4,
      5,
      (ctx, r, pal, rnd) => {
        for (const k of ALL) noisy(brush(ctx, r[k]), DENIM, 0.07, rnd);
        for (const k of SIDES) {
          const b = brush(ctx, r[k]);
          b.rect(0, 3, b.w, 1, tone(DENIM, 1.15)); // ruedo deshilachado
          for (let x = 0; x < b.w; x += 2) b.px(x, 3, tone(DENIM, 1.3));
        }
        // Bolsillo del costado de afuera y la costura.
        const out = brush(ctx, r[s < 0 ? 'right' : 'left']);
        out.rect(1, 1, 3, 2, tone(DENIM, 0.86));
        out.rect(1, 1, 3, 1, tone(DENIM, 0.72));
        const f = brush(ctx, r.front);
        f.px(s < 0 ? 4 : 0, 0, tone(DENIM, 0.8));
        f.px(s < 0 ? 3 : 1, 1, tone(DENIM, 0.8));
      },
      [0.5, 1, 0.5],
    );
    shorts.position.set(s * 0.5 * PX, -PX, 0);
    leg.add(shorts);

    const shoe = kit.box(
      5,
      2,
      6,
      (ctx, r, pal, rnd) => {
        for (const k of ALL) noisy(brush(ctx, r[k]), SHOE, 0.08, rnd);
        for (const k of SIDES) {
          const b = brush(ctx, r[k]);
          for (let x = 0; x < b.w; x++) b.px(x, 1, x % 2 ? SOLE : tone(SOLE, 0.92));
        }
        // Cordones arriba y una franja del color elegido al costado.
        const t = brush(ctx, r.top);
        for (let y = 2; y < 6; y++) t.px(2, y, y % 2 ? SOCK : tone(SOCK, 0.8));
        t.rect(1, 0, 3, 2, tone(SOCK, 0.9)); // el cuello acolchado
        for (const k of ['left', 'right']) {
          const b = brush(ctx, r[k]);
          const fx = (i) => (k === 'right' ? i : 5 - i); // i: de atrás para adelante
          b.px(fx(1), 0, pal.color);
          b.px(fx(2), 0, pal.color);
          b.px(fx(3), 0, pal.colorLight);
        }
        brush(ctx, r.front).px(2, 0, tone(SHOE, 1.4));
        noisy(brush(ctx, r.bottom), tone(SOLE, 0.75), 0.06, rnd);
      },
      [0.5, 0, 0.5],
    );
    shoe.position.set(s * 0.5 * PX, -8 * PX, 0.5 * PX);
    leg.add(shoe);
  }
}
