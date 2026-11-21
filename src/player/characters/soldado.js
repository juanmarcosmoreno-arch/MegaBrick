// Personaje "Soldado": uniforme camuflado (manchas del color elegido
// mezcladas con verde oliva y caqui), casco redondo con funda, cinturón
// con hebilla, cantimplora atrás y borcegos negros con cordones.

import { brush, mix, noisy, paintFace, PX, tone } from './humanoid.js';

const SKIN = [196, 144, 102];
const HAIR = [44, 32, 24];
const OLIVE = [96, 104, 58];
const KHAKI = [160, 146, 98];
const BROWN = [70, 56, 38];
const BOOT = [34, 32, 32];
const BELT = [46, 40, 32];
const METAL = [190, 176, 120];
const SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const id = 'soldado';
export const name = 'Soldado';

/** Los tonos del camuflado: base y manchas, con el color elegido metido. */
function camoColors(pal) {
  return [
    mix(pal.color, OLIVE, 0.38),
    mix(pal.colorDeep, BROWN, 0.35),
    mix(pal.colorLight, KHAKI, 0.55),
    mix(pal.colorDark, OLIVE, 0.25),
  ];
}

/** Camuflado: una base con ruido y manchas irregulares encima. */
function camo(b, cols, rnd) {
  noisy(b, cols[0], 0.05, rnd);
  const count = Math.max(2, Math.round((b.w * b.h) / 7));
  for (let i = 0; i < count; i++) {
    const c = cols[1 + Math.floor(rnd() * (cols.length - 1))];
    const x0 = Math.floor(rnd() * b.w);
    const y0 = Math.floor(rnd() * b.h);
    const w = 1 + Math.floor(rnd() * 3);
    const h = 1 + Math.floor(rnd() * 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Bordes mordidos para que no queden rectángulos perfectos.
        const edge = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
        if (!edge || rnd() < 0.5) b.px(x0 + x, y0 + y, tone(c, 0.95 + rnd() * 0.1));
      }
    }
  }
}

/** La cara: ojos marrones oscuros, cejas gruesas, mandíbula con barba de un día. */
export function face(b, expr, blink) {
  const brow = tone(HAIR, 0.9);
  const mouth = [118, 62, 48];
  // Las cejas van siempre en la fila 2: más arriba las tapa el casco.
  paintFace(b, expr, blink, { eye: [52, 34, 22], mouth, brow: expr === 'sorprendido' ? null : brow });
  if (expr === 'sorprendido') {
    b.rect(2, 2, 2, 1, brow);
    b.rect(6, 2, 2, 1, brow);
  }
  if (expr === 'normal' && !blink) {
    // Serio pero amable: una comisura apenas levantada.
    b.px(6, 7, tone(SKIN, 0.82));
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), SKIN, 0.035, rnd);
    const f = brush(ctx, r.front);
    // Barba de un día en la mandíbula y sombra bajo el casco.
    for (let x = 1; x < 9; x++) {
      f.px(x, 9, tone(SKIN, 0.84 + rnd() * 0.06));
      if (x < 3 || x > 6) f.px(x, 8, tone(SKIN, 0.88 + rnd() * 0.05));
    }
    f.rect(0, 2, 10, 1, tone(SKIN, 0.86));
    f.px(5, 6, tone(SKIN, 0.9)); // nariz
    f.px(4, 7, tone(SKIN, 0.92));
    // Pelo rapado: nuca y patillas (lo de arriba lo tapa el casco).
    const back = brush(ctx, r.back);
    for (let y = 2; y < 7; y++) for (let x = 0; x < 10; x++) back.px(x, y, tone(HAIR, 0.9 + rnd() * 0.25));
    for (let x = 0; x < 10; x++) if (rnd() < 0.6) back.px(x, 7, mix(HAIR, SKIN, 0.5));
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      const toBack = (x) => (k === 'right' ? x : 9 - x); // 0 = nuca
      for (let x = 0; x < 10; x++) {
        const t = toBack(x);
        const depth = t < 4 ? 6 : t < 6 ? 4 : 0;
        for (let y = 2; y < depth; y++) b.px(x, y, tone(HAIR, 0.9 + rnd() * 0.25));
      }
      // Oreja y la correa del casco que baja hasta el mentón.
      const ear = k === 'right' ? 4 : 5;
      b.px(ear, 5, tone(SKIN, 0.82));
      b.px(ear, 6, tone(SKIN, 0.88));
      const strap = k === 'right' ? 6 : 3;
      for (let y = 2; y < 10; y++) b.px(strap, y, y % 3 === 0 ? tone(OLIVE, 0.7) : tone(OLIVE, 0.55));
    }
    const under = brush(ctx, r.bottom);
    under.rect(3, 0, 1, 10, tone(OLIVE, 0.55));
    under.rect(6, 0, 1, 10, tone(OLIVE, 0.55));
  },
  body(ctx, r, pal, rnd) {
    const cols = camoColors(pal);
    for (const k of SIDES) camo(brush(ctx, r[k]), cols, rnd);
    const f = brush(ctx, r.front);
    const seam = tone(cols[0], 0.7);
    // Cuello en V con la remera oliva abajo.
    f.rect(3, 0, 2, 1, tone(OLIVE, 0.8));
    f.px(3, 1, tone(OLIVE, 0.75));
    f.px(4, 1, tone(OLIVE, 0.75));
    f.rect(1, 0, 2, 1, tone(cols[0], 0.82));
    f.rect(5, 0, 2, 1, tone(cols[0], 0.82));
    f.px(2, 1, tone(cols[0], 0.78));
    f.px(5, 1, tone(cols[0], 0.78));
    // Botonera al medio.
    for (let y = 2; y < 6; y++) f.px(4, y, seam);
    f.px(3, 3, METAL, 0.7);
    f.px(3, 5, METAL, 0.7);
    // Bolsillos del pecho con su tapa.
    for (const x of [1, 5]) {
      f.rect(x, 2, 2, 1, tone(cols[0], 0.78));
      f.px(x, 3, tone(cols[0], 0.9));
      f.px(x + 1, 3, tone(cols[0], 0.9));
      f.px(x + (x < 4 ? 1 : 0), 2, tone(METAL, 0.8));
    }
    // Cinturón con hebilla.
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, 6, b.w, 2, BELT);
      for (let x = 0; x < b.w; x++) b.px(x, 6, tone(BELT, 1.25 + rnd() * 0.1));
      b.rect(0, 8, b.w, 1, tone(cols[0], 0.8));
    }
    f.rect(3, 6, 2, 2, METAL);
    f.px(3, 6, tone(METAL, 1.2));
    f.px(4, 7, tone(METAL, 0.7));
    // Atrás: costura del canesú.
    const bk = brush(ctx, r.back);
    bk.rect(0, 2, 8, 1, seam);
  },
  arm(ctx, r, pal, rnd, side) {
    const cols = camoColors(pal);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      camo(b, cols, rnd);
      if (k === 'bottom') noisy(b, SKIN, 0.03, rnd);
      else if (k !== 'top') {
        // Manga arremangada y la mano.
        b.rect(0, 6, b.w, 1, tone(cols[0], 0.72));
        for (let x = 0; x < b.w; x++) b.px(x, 5, tone(cols[2], 0.95 + rnd() * 0.1));
        noisy({ ...b, h: 2, px: (x, y, c) => b.px(x, y + 7, c) }, SKIN, 0.03, rnd);
        b.rect(0, 8, b.w, 1, tone(SKIN, 0.88));
      }
    }
    // Parche de la unidad en el hombro de afuera, bien del color elegido.
    const out = brush(ctx, r[side === 'right' ? 'right' : 'left']);
    out.rect(0, 1, 3, 3, pal.colorDeep);
    out.px(1, 2, pal.colorLight);
    out.px(1, 1, tone(pal.colorLight, 0.9));
    out.px(0, 2, pal.color);
    out.px(2, 2, pal.color);
  },
  leg(ctx, r, pal, rnd, side) {
    const cols = camoColors(pal);
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      camo(b, cols, rnd);
      if (k === 'bottom') noisy(b, tone(BOOT, 0.6), 0.1, rnd);
      else if (k !== 'top') {
        // Pantalón metido en el borcego y el borcego negro con suela.
        b.rect(0, 4, b.w, 1, tone(cols[0], 0.72));
        noisy({ ...b, h: 3, px: (x, y, c) => b.px(x, y + 5, c) }, BOOT, 0.12, rnd);
        b.rect(0, 7, b.w, 1, [18, 18, 18]);
        b.px(k === 'front' ? 3 : 1, 5, tone(BOOT, 2.2));
      }
    }
    // Cordones cruzados adelante.
    const f = brush(ctx, r.front);
    const lace = [150, 140, 118];
    f.px(1, 5, lace);
    f.px(2, 6, lace);
    f.px(2, 5, tone(lace, 0.7));
    f.px(1, 6, tone(lace, 0.7));
    // Bolsillo del costado (de afuera).
    const out = brush(ctx, r[side === 'right' ? 'right' : 'left']);
    out.rect(1, 1, 2, 2, tone(cols[0], 0.85));
    out.rect(1, 1, 2, 1, tone(cols[0], 0.7));
  },
};

/** La funda camuflada del casco (para todas sus piezas). */
function helmetCamo(ctx, r, pal, rnd) {
  const cols = camoColors(pal);
  for (const k of SIDES) camo(brush(ctx, r[k]), [tone(cols[0], 0.92), cols[1], cols[2], cols[3]], rnd);
  return cols;
}

/** Casco redondo con funda camuflada, banda elástica y cantimplora. */
export function accessories(kit, parts) {
  const head = parts.head;
  const add = (mesh, x, y, z) => {
    mesh.position.set(x * PX, y * PX, z * PX);
    head.add(mesh);
  };

  // El ala que baja por los costados y la nuca (adelante queda más alto).
  const skirt = (ctx, r, pal, rnd) => {
    const cols = helmetCamo(ctx, r, pal, rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, b.h - 1, b.w, 1, tone(cols[0], 0.6));
    }
    noisy(brush(ctx, r.bottom), [36, 36, 28], 0.1, rnd);
  };
  add(kit.box(12, 2, 1, skirt, [0.5, 0, 0.5]), 0, 6, -5.5);
  add(kit.box(1, 2, 8, skirt, [0.5, 0, 0.5]), -5.5, 6, -1);
  add(kit.box(1, 2, 8, skirt, [0.5, 0, 0.5]), 5.5, 6, -1);

  add(
    kit.box(
      12,
      3,
      12,
      (ctx, r, pal, rnd) => {
        const cols = helmetCamo(ctx, r, pal, rnd);
        for (const k of ['front', 'back', 'left', 'right']) {
          const b = brush(ctx, r[k]);
          // Banda elástica negra al medio y el borde de abajo más oscuro.
          for (let x = 0; x < b.w; x++) b.px(x, 1, x % 4 === 1 ? [74, 70, 54] : [32, 30, 26]);
          if (k === 'front') b.rect(0, 2, b.w, 1, tone(cols[0], 0.6));
        }
        // Ramitas metidas en la banda.
        const f = brush(ctx, r.front);
        f.px(2, 0, tone(KHAKI, 1.1));
        f.px(2, 1, KHAKI);
        f.px(9, 1, tone(KHAKI, 0.85));
        const bk = brush(ctx, r.back);
        bk.px(5, 1, [150, 150, 140]); // la plaquita de atrás
        bk.px(6, 1, [120, 120, 112]);
        // El borde de arriba redondea hacia la cúpula.
        const top = brush(ctx, r.top);
        for (let i = 0; i < 12; i++) {
          top.px(i, 0, tone(cols[0], 0.84));
          top.px(i, 11, tone(cols[0], 0.78));
          top.px(0, i, tone(cols[0], 0.8));
          top.px(11, i, tone(cols[0], 0.8));
        }
        noisy(brush(ctx, r.bottom), [36, 36, 28], 0.1, rnd);
      },
      [0.5, 0, 0.5],
    ),
    0,
    8,
    0,
  );

  add(
    kit.box(
      10,
      2,
      10,
      (ctx, r, pal, rnd) => {
        const cols = helmetCamo(ctx, r, pal, rnd);
        // Brillo arriba y sombra en el borde: se ve redondo.
        const top = brush(ctx, r.top);
        for (let i = 0; i < 10; i++) {
          top.px(i, 9, tone(cols[0], 0.82));
          top.px(9, i, tone(cols[0], 0.86));
        }
        top.px(3, 3, tone(cols[2], 1.15));
        top.px(4, 3, tone(cols[2], 1.1));
        top.px(3, 4, tone(cols[2], 1.05));
      },
      [0.5, 0, 0.5],
    ),
    0,
    11,
    0,
  );

  // Cantimplora colgada del cinturón, atrás a la izquierda.
  const canteen = kit.box(
    3,
    4,
    2,
    (ctx, r, pal, rnd) => {
      for (const k of SIDES) noisy(brush(ctx, r[k]), tone(OLIVE, 0.85), 0.06, rnd);
      for (const k of ['front', 'back', 'left', 'right']) {
        const b = brush(ctx, r[k]);
        b.rect(0, 0, b.w, 1, tone(OLIVE, 0.65)); // tapa de la funda
        b.rect(0, 3, b.w, 1, tone(OLIVE, 0.7));
      }
      const bk = brush(ctx, r.back);
      bk.px(1, 1, tone(OLIVE, 0.6));
      bk.px(1, 2, KHAKI);
      const top = brush(ctx, r.top);
      top.px(1, 0, [28, 28, 28]);
      top.px(1, 1, [28, 28, 28]);
    },
    [0.5, 1, 0.5],
  );
  canteen.position.set(2 * PX, 4 * PX, -3.5 * PX);
  parts.body.add(canteen);
}
