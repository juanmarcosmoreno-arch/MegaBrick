// Personaje "Bombero": traje del color elegido con bandas reflectivas
// (amarillo flúor y plateado) en el pecho, los brazos y las piernas, casco
// de ala larga atrás con escudo adelante, guantes y botas de goma. Bigote
// colorado y cachetes rosados.

import { brush, mix, noisy, paintFace, PX, tone } from './humanoid.js';

const SKIN = [246, 200, 178];
const CHEEK = [236, 150, 140];
const HAIR = [176, 92, 46];
const LIME = [222, 236, 64];
const SILVER = [206, 212, 216];
const GLOVE = [58, 50, 46];
const RUBBER = [30, 30, 34];
const LEATHER = [96, 58, 34];
const BRASS = [214, 172, 74];
const SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const id = 'bombero';
export const name = 'Bombero';

/** Banda reflectiva de 3 filas (flúor, plateado, flúor) a lo ancho de una cara. */
function band(b, y, rnd) {
  for (let x = 0; x < b.w; x++) {
    b.px(x, y, tone(LIME, 0.95 + rnd() * 0.08));
    b.px(x, y + 1, tone(SILVER, 0.92 + rnd() * 0.14));
    b.px(x, y + 2, tone(LIME, 0.88 + rnd() * 0.08));
  }
}

/** La tela del traje: el color elegido con un poco de trama. */
function cloth(b, pal, rnd) {
  noisy(b, pal.color, 0.05, rnd);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((x + y * 3) % 7 === 0) b.px(x, y, tone(pal.color, 0.9));
}

/** La cara: ojos celestes, cejas coloradas, cachetes rosados y bigote. */
export function face(b, expr, blink) {
  const brow = tone(HAIR, 0.85);
  // Boca rosada (no un agujero) para que no compita con el bigote; abierta sí, oscura.
  const mouth = expr === 'sorprendido' ? [110, 44, 44] : [198, 112, 100];
  paintFace(b, expr, blink, { eye: [58, 104, 150], mouth, brow: expr === 'sorprendido' ? null : brow });
  if (expr === 'sorprendido') {
    // Las cejas no pueden subir más: arriba está el casco.
    b.rect(2, 2, 2, 1, brow);
    b.rect(6, 2, 2, 1, brow);
  }
  // Bigote espeso con las puntas caídas.
  const m = tone(HAIR, 0.82);
  b.rect(2, 7, 6, 1, m);
  b.px(3, 7, tone(HAIR, 1.05));
  b.px(6, 7, tone(HAIR, 0.95));
  b.px(2, 8, tone(HAIR, 0.7));
  b.px(7, 8, tone(HAIR, 0.7));
  if (expr === 'feliz') {
    b.px(1, 6, tone(CHEEK, 0.95));
    b.px(8, 6, tone(CHEEK, 0.95));
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    const f = brush(ctx, r.front);
    f.rect(0, 2, 10, 1, tone(SKIN, 0.86)); // sombra del ala
    f.px(1, 6, CHEEK);
    f.px(8, 6, CHEEK);
    f.px(1, 7, tone(CHEEK, 1.05));
    f.px(8, 7, tone(CHEEK, 1.05));
    f.px(5, 6, tone(SKIN, 0.88)); // nariz
    // Pelo colorado en la nuca y los costados (lo de arriba lo tapa el casco).
    const back = brush(ctx, r.back);
    for (let y = 2; y < 7; y++) for (let x = 0; x < 10; x++) back.px(x, y, tone(HAIR, 0.85 + rnd() * 0.25));
    for (let x = 0; x < 10; x += 2) back.px(x, 7, tone(HAIR, 0.8));
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < 10; x++) {
        const t = k === 'right' ? x : 9 - x; // 0 = nuca
        // Patillas.
        const depth = t < 4 ? 7 : t < 6 ? 4 : t === 7 ? 7 : 0;
        for (let y = 2; y < depth; y++) b.px(x, y, tone(HAIR, 0.85 + rnd() * 0.25));
      }
      const ear = k === 'right' ? 5 : 4;
      b.px(ear, 5, tone(CHEEK, 0.95));
      b.px(ear, 6, tone(SKIN, 0.85));
    }
  },
  body(ctx, r, pal, rnd) {
    for (const k of SIDES) cloth(brush(ctx, r[k]), pal, rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, 0, b.w, 1, pal.colorDark); // cuello alto
      band(b, 3, rnd);
      b.rect(0, 8, b.w, 1, pal.colorDark); // ruedo
    }
    const f = brush(ctx, r.front);
    // Cierre al medio con los ganchos de metal.
    for (let y = 0; y < 9; y++) f.px(4, y, y === 4 ? tone(SILVER, 0.8) : pal.colorDeep);
    for (const y of [1, 6]) f.px(3, y, BRASS);
    f.px(3, 0, tone(SKIN, 0.9));
    // Bolsillos con tapa abajo.
    for (const x of [0, 6]) {
      f.rect(x, 6, 2, 1, pal.colorDark);
      f.px(x + (x ? 1 : 0), 7, tone(pal.color, 0.85));
    }
    // La radio colgada en el pecho, del lado izquierdo.
    f.rect(6, 1, 1, 2, [40, 40, 44]);
    f.px(6, 0, [70, 70, 74]);
    f.px(6, 1, [120, 220, 120]);
    // Atrás: un rótulo plateado en la espalda.
    const bk = brush(ctx, r.back);
    bk.rect(1, 1, 6, 1, tone(SILVER, 0.95));
    for (const x of [2, 4, 5]) bk.px(x, 1, pal.colorDeep);
  },
  arm(ctx, r, pal, rnd) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      cloth(b, pal, rnd);
      if (k === 'bottom') noisy(b, GLOVE, 0.08, rnd);
      else if (k !== 'top') {
        b.rect(0, 0, b.w, 1, tone(pal.color, 1.08)); // hombro
        band(b, 4, rnd);
        // Guante con puño ancho.
        noisy({ ...b, h: 2, px: (x, y, c) => b.px(x, y + 7, c) }, GLOVE, 0.08, rnd);
        b.rect(0, 7, b.w, 1, tone(GLOVE, 1.5));
        b.px(1, 8, tone(GLOVE, 1.3));
      }
    }
  },
  leg(ctx, r, pal, rnd) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      cloth(b, pal, rnd);
      if (k === 'bottom') noisy(b, tone(RUBBER, 0.7), 0.1, rnd);
      else if (k !== 'top') {
        band(b, 1, rnd);
        // Botas de goma brillosas, con la suela y la puntera.
        noisy({ ...b, h: 3, px: (x, y, c) => b.px(x, y + 5, c) }, RUBBER, 0.08, rnd);
        b.rect(0, 4, b.w, 1, pal.colorDark);
        b.rect(0, 5, b.w, 1, tone(RUBBER, 1.6));
        b.rect(0, 7, b.w, 1, [16, 16, 18]);
        b.px(1, 5, tone(RUBBER, 2.6));
        b.px(1, 6, tone(RUBBER, 2));
      }
    }
    const f = brush(ctx, r.front);
    f.rect(0, 6, 4, 1, mix(RUBBER, BRASS, 0.35));
  },
};

/** Casco de bombero: copa con cresta, ala que cae atrás y escudo adelante. */
export function accessories(kit, parts) {
  const head = parts.head;
  const add = (mesh, x, y, z, parent = head) => {
    mesh.position.set(x * PX, y * PX, z * PX);
    parent.add(mesh);
    return mesh;
  };
  /** Pintura del casco: el color elegido, brilloso. */
  const shell = (ctx, r, pal, rnd) => {
    for (const k of SIDES) noisy(brush(ctx, r[k]), pal.color, 0.03, rnd);
    return pal;
  };

  // Ala: angosta adelante y en los costados.
  add(
    kit.box(
      16,
      1,
      14,
      (ctx, r, pal, rnd) => {
        shell(ctx, r, pal, rnd);
        for (const k of ['front', 'back', 'left', 'right']) brush(ctx, r[k]).rect(0, 0, 99, 1, pal.colorDark);
        noisy(brush(ctx, r.bottom), pal.colorDeep, 0.05, rnd);
        const top = brush(ctx, r.top);
        for (let i = 0; i < 16; i++) {
          top.px(i, 0, pal.colorLight);
          top.px(i, 13, pal.colorDark);
        }
      },
      [0.5, 0, 0.5],
    ),
    0,
    8,
    1,
  );
  // La parte de atrás del ala, larga y caída (protege la nuca).
  const flapPivot = new kit.THREE.Group();
  flapPivot.position.set(0, 8.5 * PX, -6 * PX);
  flapPivot.rotation.x = -0.42;
  head.add(flapPivot);
  add(
    kit.box(
      14,
      1,
      5,
      (ctx, r, pal, rnd) => {
        shell(ctx, r, pal, rnd);
        for (const k of ['front', 'back', 'left', 'right']) brush(ctx, r[k]).rect(0, 0, 99, 1, pal.colorDark);
        noisy(brush(ctx, r.bottom), pal.colorDeep, 0.05, rnd);
        const top = brush(ctx, r.top);
        for (let i = 0; i < 14; i++) top.px(i, 0, pal.colorDark);
        for (let i = 0; i < 5; i++) top.px(3, i, tone(pal.color, 0.85));
        for (let i = 0; i < 5; i++) top.px(10, i, tone(pal.color, 0.85));
      },
      [0.5, 0.5, 1],
    ),
    0,
    0,
    0.2,
    flapPivot,
  );

  // Copa: dos escalones para que se vea redonda.
  add(
    kit.box(
      12,
      2,
      12,
      (ctx, r, pal, rnd) => {
        shell(ctx, r, pal, rnd);
        for (const k of ['front', 'back', 'left', 'right']) {
          const b = brush(ctx, r[k]);
          b.rect(0, 1, b.w, 1, tone(pal.color, 0.88));
          b.px(2, 0, pal.colorLight);
        }
        const top = brush(ctx, r.top);
        for (let i = 0; i < 12; i++) top.px(i, 11, pal.colorDark);
      },
      [0.5, 0, 0.5],
    ),
    0,
    9,
    0,
  );
  add(
    kit.box(
      10,
      2,
      10,
      (ctx, r, pal, rnd) => {
        shell(ctx, r, pal, rnd);
        const top = brush(ctx, r.top);
        top.px(2, 2, pal.colorLight);
        top.px(3, 2, pal.colorLight);
        top.px(2, 3, pal.colorLight);
        for (const k of ['front', 'left', 'right', 'back']) brush(ctx, r[k]).px(1, 0, pal.colorLight);
      },
      [0.5, 0, 0.5],
    ),
    0,
    11,
    0,
  );
  // Cresta de adelante hacia atrás.
  add(
    kit.box(
      2,
      1,
      10,
      (ctx, r, pal, rnd) => {
        shell(ctx, r, pal, rnd);
        noisy(brush(ctx, r.top), pal.colorLight, 0.04, rnd);
        for (const k of ['left', 'right']) brush(ctx, r[k]).rect(0, 0, 10, 1, tone(pal.color, 1.05));
      },
      [0.5, 0, 0.5],
    ),
    0,
    13,
    -0.5,
  );

  // Escudo de cuero adelante, con el número.
  const shield = kit.box(
    6,
    5,
    1,
    (ctx, r, pal, rnd) => {
      for (const k of SIDES) noisy(brush(ctx, r[k]), LEATHER, 0.08, rnd);
      const f = brush(ctx, r.front);
      // Borde de cuero, centro claro y el número del cuartel.
      f.rect(1, 1, 4, 3, [236, 228, 206]);
      f.rect(2, 1, 1, 3, pal.colorDeep);
      f.px(1, 1, pal.colorDeep);
      f.rect(1, 3, 1, 1, pal.colorDeep);
      f.rect(3, 3, 1, 1, pal.colorDeep);
      f.px(4, 1, tone(BRASS, 1.1));
      f.px(4, 2, BRASS);
      // Arriba redondeado: las esquinas no van.
      f.clear(0, 0, 1, 1);
      f.clear(5, 0, 1, 1);
      f.px(1, 0, tone(LEATHER, 1.3));
      f.px(2, 0, tone(LEATHER, 1.3));
      f.px(2, 4, tone(LEATHER, 0.7));
      f.px(3, 4, tone(LEATHER, 0.7));
      const bk = brush(ctx, r.back);
      bk.clear(0, 0, 1, 1);
      bk.clear(5, 0, 1, 1);
    },
    [0.5, 0, 0],
  );
  add(shield, 0, 9, 6);
}
