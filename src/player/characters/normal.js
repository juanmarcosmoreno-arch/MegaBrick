// Personaje "Normal": pelo castaño, remera del color elegido, jean y
// zapatillas. Es el de entrada y el ejemplo de cómo se hace un personaje
// (ver humanoid.js): un pintor por parte, la cara y los accesorios.

import { brush, noisy, paintFace, tone } from './humanoid.js';

const SKIN = [236, 188, 150];
const HAIR = [92, 58, 34];
const JEAN = [62, 86, 132];
const SHOE = [236, 236, 230];

export const id = 'normal';
export const name = 'Normal';

/** La cara: ojos marrones, cejas del color del pelo. */
export function face(b, expr, blink) {
  paintFace(b, expr, blink, { eye: [70, 46, 30], mouth: [150, 70, 60], brow: tone(HAIR, 0.9) });
}

export const paint = {
  head(ctx, r, pal, rnd) {
    // Piel en las 6 caras y pelo arriba, atrás y en los costados.
    for (const k of ['front', 'back', 'left', 'right', 'top', 'bottom']) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    noisy(brush(ctx, r.top), HAIR, 0.08, rnd);
    for (const k of ['back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let x = 0; x < b.w; x++) {
        const depth = k === 'back' ? 7 : 3 + (x % 3 === 0 ? 1 : 0);
        for (let y = 0; y < depth; y++) b.px(x, y, tone(HAIR, 0.9 + rnd() * 0.15));
      }
    }
    // Flequillo adelante.
    const f = brush(ctx, r.front);
    for (let x = 0; x < f.w; x++) {
      const depth = 1 + (x % 4 === 1 ? 1 : 0) + (x < 2 || x > 7 ? 1 : 0);
      for (let y = 0; y < depth; y++) f.px(x, y, tone(HAIR, 0.95 + rnd() * 0.1));
    }
    // Orejas.
    brush(ctx, r.left).px(4, 5, tone(SKIN, 0.85));
    brush(ctx, r.right).px(5, 5, tone(SKIN, 0.85));
  },
  body(ctx, r, pal, rnd) {
    // Remera del color elegido, con el cuello y una costura abajo.
    for (const k of ['front', 'back', 'left', 'right', 'top', 'bottom']) noisy(brush(ctx, r[k]), pal.color, 0.04, rnd);
    const f = brush(ctx, r.front);
    f.rect(3, 0, 2, 1, SKIN);
    f.rect(2, 0, 1, 1, pal.colorDark);
    f.rect(5, 0, 1, 1, pal.colorDark);
    for (const k of ['front', 'back']) brush(ctx, r[k]).rect(0, 8, 8, 1, pal.colorDark);
  },
  arm(ctx, r, pal, rnd) {
    // Manga corta y brazo de piel.
    for (const k of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      const b = brush(ctx, r[k]);
      noisy(b, SKIN, 0.03, rnd);
      if (k !== 'bottom') b.rect(0, 0, b.w, k === 'top' ? b.h : 3, pal.color);
      if (k !== 'top' && k !== 'bottom') b.rect(0, 3, b.w, 1, pal.colorDark);
    }
  },
  leg(ctx, r, pal, rnd) {
    // Jean y zapatillas blancas.
    for (const k of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
      const b = brush(ctx, r[k]);
      noisy(b, JEAN, 0.06, rnd);
      if (k === 'bottom') noisy(b, SHOE, 0.03, rnd);
      else if (k !== 'top') {
        b.rect(0, 6, b.w, 2, SHOE);
        b.rect(0, 7, b.w, 1, tone(SHOE, 0.8));
      }
    }
  },
};
