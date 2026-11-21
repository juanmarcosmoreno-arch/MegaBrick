// Personaje "Astronauta": traje espacial blanco con hombros, cinturón y
// parches del color elegido, casco de vidrio que deja ver la cara, mochila
// de soporte vital con antena y botas grandes.

import { brush, noisy, paintFace, PX, tone } from './humanoid.js';

const SKIN = [106, 68, 46];
const HAIR = [30, 24, 22];
const SUIT = [234, 236, 238];
const SEAM = [192, 198, 208];
const GREY = [150, 156, 166];
const PANEL = [52, 58, 70];
const SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export const id = 'astronauta';
export const name = 'Astronauta';

/** Tela del traje: blanca, con pliegues suaves. */
function suit(b, rnd) {
  noisy(b, SUIT, 0.025, rnd);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (rnd() < 0.08) b.px(x, y, tone(SEAM, 1.04));
}

/** La cara: ojos oscuros con mucho blanco, cejas negras. */
export function face(b, expr, blink) {
  paintFace(b, expr, blink, { eye: [34, 22, 16], white: [250, 248, 242], mouth: [44, 16, 18], brow: HAIR });
  if (expr === 'feliz') {
    // Sonrisa con dientes.
    b.rect(4, 9, 2, 1, [240, 236, 226]);
    b.px(3, 8, [44, 16, 18]);
    b.px(6, 8, [44, 16, 18]);
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), SKIN, 0.04, rnd);
    // Pelo corto y enrulado: arriba, la nuca y los costados.
    const curl = () => tone(HAIR, rnd() < 0.3 ? 1.6 : 0.85 + rnd() * 0.3);
    const top = brush(ctx, r.top);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) top.px(x, y, curl());
    const back = brush(ctx, r.back);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) back.px(x, y, curl());
    for (let x = 1; x < 10; x += 2) back.px(x, 6, curl());
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < 10; x++) {
        const t = k === 'right' ? x : 9 - x; // 0 = nuca
        const depth = t < 5 ? 5 : t < 8 ? 3 : 2;
        for (let y = 0; y < depth; y++) b.px(x, y, curl());
      }
      const ear = k === 'right' ? 4 : 5;
      b.px(ear, 4, tone(SKIN, 0.8));
      b.px(ear, 5, tone(SKIN, 0.86));
    }
    // Línea del pelo adelante, con entradas.
    const f = brush(ctx, r.front);
    for (let x = 0; x < 10; x++) {
      const depth = x < 2 || x > 7 ? 2 : 1;
      for (let y = 0; y < depth; y++) f.px(x, y, curl());
    }
    f.px(5, 6, tone(SKIN, 0.82)); // nariz
    f.px(4, 6, tone(SKIN, 1.12));
    f.px(1, 7, tone(SKIN, 1.06)); // brillo en los cachetes
    f.px(8, 7, tone(SKIN, 1.06));
  },
  body(ctx, r, pal, rnd) {
    for (const k of SIDES) suit(brush(ctx, r[k]), rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      // Cinturón del color elegido.
      for (let x = 0; x < b.w; x++) b.px(x, 6, tone(pal.color, 0.96 + rnd() * 0.08));
      b.rect(0, 7, b.w, 1, pal.colorDark);
      b.rect(0, 5, b.w, 1, tone(SEAM, 0.96));
    }
    const f = brush(ctx, r.front);
    // Panel de control en el pecho, con lucecitas.
    f.rect(1, 1, 6, 4, GREY);
    f.rect(2, 2, 4, 2, PANEL);
    f.px(2, 2, pal.colorLight);
    f.px(3, 2, [250, 90, 80]);
    f.px(4, 2, [110, 230, 130]);
    f.rect(2, 3, 3, 1, [90, 160, 220]);
    f.px(5, 3, [236, 236, 236]);
    f.rect(1, 4, 6, 1, tone(GREY, 0.8));
    f.px(1, 1, tone(GREY, 1.2));
    // Hebilla y las mangueras que salen del panel.
    f.rect(3, 6, 2, 2, [200, 206, 214]);
    f.px(3, 6, [244, 246, 248]);
    f.px(0, 2, tone(GREY, 0.9));
    f.px(7, 2, tone(GREY, 0.9));
    f.px(0, 3, tone(GREY, 0.75));
    f.px(7, 3, tone(GREY, 0.75));
  },
  arm(ctx, r, pal, rnd, side) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      suit(b, rnd);
      if (k === 'top') noisy(b, pal.color, 0.04, rnd);
      else if (k === 'bottom') noisy(b, SEAM, 0.04, rnd);
      else {
        // Hombro del color elegido, codo con fuelle, puño y guante.
        noisy({ ...b, h: 3, px: (x, y, c) => b.px(x, y, c) }, pal.color, 0.04, rnd);
        b.rect(0, 0, b.w, 1, pal.colorLight);
        b.rect(0, 3, b.w, 1, SEAM);
        b.rect(0, 5, b.w, 1, tone(SEAM, 1.02));
        b.rect(0, 6, b.w, 1, pal.colorDark);
        noisy({ ...b, h: 2, px: (x, y, c) => b.px(x, y + 7, c) }, [208, 212, 218], 0.04, rnd);
        b.rect(0, 8, b.w, 1, tone(SEAM, 0.88));
      }
    }
    // Parche de la misión en el brazo de afuera: una estrella en un círculo.
    const out = brush(ctx, r[side]);
    out.px(1, 3, pal.colorDeep);
    out.rect(0, 4, 3, 1, pal.colorDeep);
    out.px(1, 5, pal.colorDeep);
    out.px(1, 4, [250, 240, 160]);
  },
  leg(ctx, r, pal, rnd, side) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      suit(b, rnd);
      if (k !== 'top' && k !== 'bottom') {
        b.rect(0, 1, b.w, 1, tone(SEAM, 1.02));
        b.rect(0, 4, b.w, 1, SEAM);
      }
    }
    // Rodilleras del color elegido y un bolsillo al costado.
    const f = brush(ctx, r.front);
    f.rect(0, 3, 4, 2, pal.color);
    f.rect(0, 4, 4, 1, pal.colorDark);
    f.px(1, 3, pal.colorLight);
    const out = brush(ctx, r[side]);
    out.rect(1, 2, 2, 2, tone(SEAM, 0.95));
    out.rect(1, 2, 2, 1, GREY);
  },
};

/** Casco de vidrio, cuello, mochila con antena y botas grandes. */
export function accessories(kit, parts) {
  const at = (mesh, parent, x, y, z) => {
    mesh.position.set(x * PX, y * PX, z * PX);
    parent.add(mesh);
    return mesh;
  };

  // Aro del cuello: une el casco con el traje.
  at(
    kit.box(
      12,
      1,
      12,
      (ctx, r, pal, rnd) => {
        for (const k of SIDES) noisy(brush(ctx, r[k]), pal.color, 0.04, rnd);
        for (const k of ['front', 'back', 'left', 'right']) {
          const b = brush(ctx, r[k]);
          for (let x = 0; x < b.w; x += 3) b.px(x, 0, [210, 214, 222]);
        }
        const top = brush(ctx, r.top);
        top.rect(1, 1, 10, 10, [70, 74, 84]);
      },
      [0.5, 1, 0.5],
    ),
    parts.head,
    0,
    0,
    0,
  );

  // Casco de vidrio: casi transparente, con los bordes y un par de reflejos.
  const glass = kit.box(
    12,
    12,
    12,
    (ctx, r) => {
      for (const k of SIDES) {
        const b = brush(ctx, r[k]);
        b.rect(0, 0, b.w, b.h, [190, 226, 255], 0.16);
        // Bordes: así se lee la forma del casco.
        b.rect(0, 0, b.w, 1, [230, 244, 255], 0.45);
        b.rect(0, b.h - 1, b.w, 1, [230, 244, 255], 0.3);
        b.rect(0, 1, 1, b.h - 2, [230, 244, 255], 0.35);
        b.rect(b.w - 1, 1, 1, b.h - 2, [230, 244, 255], 0.35);
      }
      // Un reflejo en diagonal arriba a la izquierda (en el borde, sin tapar la cara).
      const f = brush(ctx, r.front);
      for (let i = 0; i < 4; i++) {
        f.px(1 + i, 4 - i, [255, 255, 255], 0.55);
        if (i < 3) f.px(1 + i, 3 - i, [255, 255, 255], 0.3);
      }
      f.px(10, 9, [255, 255, 255], 0.4);
      f.px(10, 10, [255, 255, 255], 0.4);
      for (const k of ['left', 'right']) {
        const b = brush(ctx, r[k]);
        b.px(3, 2, [255, 255, 255], 0.55);
        b.px(2, 3, [255, 255, 255], 0.55);
      }
      const t = brush(ctx, r.top);
      t.rect(2, 2, 3, 1, [255, 255, 255], 0.5);
      t.rect(2, 3, 1, 2, [255, 255, 255], 0.5);
    },
    [0.5, 0, 0.5],
  );
  // Material transparente de verdad (los demás cortan con alphaTest).
  glass.material.transparent = true;
  glass.material.alphaTest = 0;
  glass.material.depthWrite = false;
  glass.material.needsUpdate = true;
  glass.renderOrder = 1;
  at(glass, parts.head, 0, 0, 0);

  // Mochila de soporte vital.
  at(
    kit.box(
      10,
      7,
      4,
      (ctx, r, pal, rnd) => {
        for (const k of SIDES) suit(brush(ctx, r[k]), rnd);
        for (const k of ['front', 'back', 'left', 'right']) {
          const b = brush(ctx, r[k]);
          b.rect(0, 0, b.w, 1, tone(SEAM, 1.02));
          b.rect(0, b.h - 1, b.w, 1, tone(SEAM, 0.85));
        }
        const bk = brush(ctx, r.back);
        // Franja del color elegido, rejilla de ventilación y dos perillas.
        bk.rect(0, 1, 10, 1, pal.color);
        bk.rect(0, 2, 10, 1, pal.colorDark);
        for (let x = 1; x < 9; x += 2) {
          bk.px(x, 4, GREY);
          bk.px(x, 5, tone(GREY, 0.8));
        }
        bk.px(8, 4, [250, 90, 80]);
        bk.px(8, 5, [110, 230, 130]);
        for (const k of ['left', 'right']) {
          const b = brush(ctx, r[k]);
          b.rect(1, 2, 2, 3, GREY);
          b.px(1, 2, tone(GREY, 1.25));
        }
      },
      [0.5, 0, 1],
    ),
    parts.body,
    0,
    1,
    -2.5,
  );
  // Antena con la lucecita en la punta.
  at(
    kit.box(
      1,
      5,
      1,
      (ctx, r, pal, rnd) => {
        for (const k of SIDES) noisy(brush(ctx, r[k]), GREY, 0.06, rnd);
        for (const k of ['front', 'back', 'left', 'right']) brush(ctx, r[k]).px(0, 0, pal.colorLight);
        brush(ctx, r.top).px(0, 0, pal.colorLight);
      },
      [0.5, 0, 0.5],
    ),
    parts.body,
    3.5,
    8,
    -6.5,
  );

  // Botas grandes, con la franja del color elegido y suela gruesa.
  const boot = (ctx, r, pal, rnd) => {
    for (const k of SIDES) noisy(brush(ctx, r[k]), [214, 218, 224], 0.04, rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, 0, b.w, 1, pal.color);
      b.rect(0, 2, b.w, 1, [74, 78, 88]);
      for (let x = 0; x < b.w; x += 2) b.px(x, 2, [96, 100, 110]);
    }
    noisy(brush(ctx, r.bottom), [60, 64, 72], 0.08, rnd);
    const top = brush(ctx, r.top);
    top.rect(0, 0, 5, 6, pal.color);
    top.rect(1, 3, 3, 3, [214, 218, 224]);
  };
  at(kit.box(5, 3, 6, boot, [0.5, 0, 0.5]), parts.legR, 0, -8, 0.5);
  at(kit.box(5, 3, 6, boot, [0.5, 0, 0.5]), parts.legL, 0, -8, 0.5);
}
