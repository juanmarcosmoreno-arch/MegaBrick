// Personaje "Vikingo": barba pelirroja larga con dos trenzas, casco de
// metal con cuernos y protector de nariz, túnica del color elegido con un
// cinturón de cuero ancho, brazaletes, pantalón de lana con tiras cruzadas,
// botas de piel y un escudo redondo a la espalda (también del color).

import { brush, mix, noisy, paintFace, tone } from './humanoid.js';

const SKIN = [242, 200, 168];
const BLUSH = [226, 150, 128];
const FRECKLE = [200, 130, 92];
const HAIR = [190, 82, 34];
const HAIR_LIGHT = [226, 124, 58];
const HAIR_DARK = [132, 52, 22];
const EYE = [62, 112, 168];
const MOUTH = [120, 44, 36];
const LEATHER = [112, 70, 38];
const LEATHER_DARK = [74, 44, 24];
const STEEL = [168, 172, 178];
const STEEL_DARK = [104, 108, 116];
const BRONZE = [184, 136, 62];
const HORN = [232, 220, 188];
const HORN_DARK = [176, 156, 118];
const WOOL = [86, 60, 42];
const STRAP = [168, 128, 82];
const FUR = [112, 92, 74];
const FUR_LIGHT = [196, 178, 150];
const WOOD = [150, 104, 62];

const SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Distancia (en px) de una columna de un costado a la cara de adelante. */
const fromFront = (k, b, x) => (k === 'right' ? b.w - 1 - x : x);

/** Pelo o barba con mechones: vetas verticales más claras y más oscuras. */
function hairPx(b, x, y, rnd, base = HAIR) {
  const streak = (x * 7 + 3) % 5;
  const k = streak === 0 ? 1.12 : streak === 3 ? 0.86 : 1;
  b.px(x, y, tone(base, k * (0.94 + rnd() * 0.12)));
}

export const id = 'vikingo';
export const name = 'Vikingo';

/** La cara: ojos celestes, cejas pelirrojas y la boca entre la barba. */
export function face(b, expr, blink) {
  paintFace(b, expr, blink, { eye: EYE, mouth: MOUTH, eyeY: 4 });
  // Cejas tupidas (las de paintFace quedarían bajo el casco al sorprenderse).
  for (const x of [2, 6]) {
    const inner = x < 5 ? x + 1 : x;
    const outer = x < 5 ? x : x + 1;
    if (expr === 'determinado') {
      b.px(outer, 2, HAIR_DARK);
      b.px(inner, 3, HAIR_DARK);
      b.px(inner, 2, HAIR);
    } else if (expr === 'sorprendido') {
      b.rect(x, 2, 2, 1, HAIR_LIGHT);
    } else {
      b.rect(x, 2, 2, 1, HAIR);
      b.px(outer, 2, HAIR_DARK);
    }
  }
}

export const paint = {
  head(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), SKIN, 0.03, rnd);
    // Arriba y atrás: pelo largo (casi todo queda bajo el casco).
    const top = brush(ctx, r.top);
    for (let y = 0; y < top.h; y++) for (let x = 0; x < top.w; x++) hairPx(top, x, y, rnd);
    const back = brush(ctx, r.back);
    for (let y = 0; y < back.h; y++) for (let x = 0; x < back.w; x++) hairPx(back, x, y, rnd, y > 7 ? HAIR_DARK : HAIR);
    // Una trencita atrás, al medio.
    for (let y = 3; y < 10; y++) back.px(4 + (y % 2), y, HAIR_LIGHT);
    back.rect(4, 8, 2, 1, LEATHER);
    // Costados: pelo atrás, patillas que bajan a la barba adelante.
    for (const k of ['left', 'right']) {
      const b = brush(ctx, r[k]);
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const f = fromFront(k, b, x);
          if (f >= 4 || y < 3) hairPx(b, x, y, rnd);
          else if (y >= 5 && f <= 3 - (y < 7 ? 1 : 0)) hairPx(b, x, y, rnd);
          else if (y >= 5) hairPx(b, x, y, rnd, HAIR_DARK);
        }
      }
      // Oreja asomando entre el pelo.
      const ex = k === 'right' ? b.w - 5 : 4;
      b.px(ex, 4, tone(SKIN, 0.88));
      b.px(ex, 5, tone(SKIN, 0.8));
    }
    // Abajo: barba adelante.
    const bottom = brush(ctx, r.bottom);
    for (let y = 0; y < 4; y++) for (let x = 0; x < bottom.w; x++) hairPx(bottom, x, y, rnd, HAIR_DARK);
    // Adelante: frente con pecas, mejillas coloradas, nariz y barba.
    const f = brush(ctx, r.front);
    f.rect(0, 0, 10, 2, HAIR_DARK); // bajo el borde del casco
    for (const [x, y] of [[1, 5], [2, 6], [7, 6], [8, 5], [3, 3], [6, 3]]) f.px(x, y, FRECKLE);
    f.rect(1, 6, 1, 1, BLUSH);
    f.rect(8, 6, 1, 1, BLUSH);
    f.rect(4, 5, 2, 1, tone(SKIN, 1.04));
    f.rect(4, 6, 2, 1, tone(SKIN, 0.82)); // sombra bajo la nariz
    for (let y = 6; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (y === 6 && x > 1 && x < 8) continue;
        hairPx(f, x, y, rnd);
      }
    }
    // Bigote: más claro, con las puntas caídas.
    f.rect(2, 7, 6, 1, HAIR_LIGHT);
    f.px(1, 8, HAIR_LIGHT);
    f.px(8, 8, HAIR_LIGHT);
    f.px(4, 7, tone(HAIR_LIGHT, 1.1));
  },
  body(ctx, r, pal, rnd) {
    for (const k of SIDES) noisy(brush(ctx, r[k]), pal.color, 0.05, rnd);
    noisy(brush(ctx, r.top), pal.colorDark, 0.05, rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      // Tejido: líneas tenues cada dos filas.
      for (let y = 1; y < b.h; y += 2) for (let x = 0; x < b.w; x++) if ((x + y) % 3 === 0) b.px(x, y, pal.colorDark, 0.35);
      // Cinturón de cuero ancho.
      b.rect(0, 5, b.w, 2, LEATHER);
      b.rect(0, 6, b.w, 1, LEATHER_DARK);
      for (let x = 0; x < b.w; x += 3) b.px(x, 5, tone(LEATHER, 1.2));
      // Ruedo con guarda tejida.
      b.rect(0, 8, b.w, 1, pal.colorDeep);
      for (let x = 0; x < b.w; x += 2) b.px(x, 8, pal.colorLight);
    }
    const f = brush(ctx, r.front);
    // Escote con cordón y hebilla de bronce.
    f.rect(3, 0, 2, 2, SKIN);
    f.px(3, 1, tone(SKIN, 0.85));
    f.px(2, 0, pal.colorDeep);
    f.px(5, 0, pal.colorDeep);
    f.px(2, 1, pal.colorDark);
    f.px(5, 1, pal.colorDark);
    f.rect(3, 5, 2, 2, BRONZE);
    f.px(3, 5, tone(BRONZE, 1.3));
    f.px(4, 6, tone(BRONZE, 0.7));
    // Sombras al costado del cinturón y pliegues de la falda de la túnica.
    f.px(1, 7, pal.colorDark);
    f.px(6, 7, pal.colorDark);
    // Correa del escudo cruzando el pecho (de hombro a cadera).
    for (let y = 0; y < 5; y++) f.px(6 - y, y, LEATHER_DARK);
    f.px(7, 0, LEATHER_DARK);
  },
  arm(ctx, r, pal, rnd) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      noisy(b, SKIN, 0.03, rnd);
      if (k === 'bottom') continue;
      if (k === 'top') {
        noisy(b, pal.color, 0.05, rnd);
        continue;
      }
      // Manga hasta el codo con guarda.
      for (let y = 0; y < 4; y++) for (let x = 0; x < b.w; x++) b.px(x, y, tone(pal.color, 0.95 + rnd() * 0.1));
      b.rect(0, 0, b.w, 1, pal.colorLight, 0.35);
      b.rect(0, 4, b.w, 1, pal.colorDeep);
      b.px(1, 4, pal.colorLight);
      // Brazalete de cuero con remaches.
      b.rect(0, 5, b.w, 3, LEATHER);
      b.rect(0, 7, b.w, 1, LEATHER_DARK);
      b.px(1, 6, STEEL);
      b.px(1, 5, tone(LEATHER, 1.25));
      // Mano.
      b.rect(0, 8, b.w, 1, tone(SKIN, 0.95));
    }
  },
  leg(ctx, r, pal, rnd) {
    for (const k of SIDES) {
      const b = brush(ctx, r[k]);
      noisy(b, WOOL, 0.08, rnd);
      if (k === 'top') {
        noisy(b, pal.color, 0.05, rnd);
        continue;
      }
      if (k === 'bottom') {
        noisy(b, LEATHER_DARK, 0.06, rnd);
        continue;
      }
      // La falda de la túnica asoma arriba, con el ruedo tejido.
      for (let x = 0; x < b.w; x++) b.px(x, 0, tone(pal.color, 0.92 + rnd() * 0.1));
      b.rect(0, 1, b.w, 1, pal.colorDeep);
      for (let x = (k === 'front' ? 1 : 0); x < b.w; x += 2) b.px(x, 1, pal.colorLight);
      // Lana con vetas verticales y tiras de cuero cruzadas en X.
      for (let y = 2; y < 6; y++) for (let x = 1; x < b.w; x += 2) b.px(x, y, tone(WOOL, 0.86));
      for (const [x, y] of [[0, 2], [3, 2], [1, 3], [2, 3], [1, 4], [2, 4], [0, 5], [3, 5]]) {
        b.px(x, y, tone(STRAP, x === 1 || x === 3 ? 0.84 : 1));
      }
      // Botas de piel con el borde peludo.
      for (let y = 6; y < 8; y++) for (let x = 0; x < b.w; x++) b.px(x, y, tone(FUR, 0.85 + rnd() * 0.25));
      for (let x = 0; x < b.w; x++) b.px(x, 6, tone(FUR_LIGHT, 0.85 + rnd() * 0.2));
      b.rect(0, 7, b.w, 1, LEATHER_DARK);
    }
  },
};

/** Pinta todas las caras de una caja con un color con ruido. */
function fill(ctx, r, color, rnd, amount = 0.05) {
  for (const k of SIDES) noisy(brush(ctx, r[k]), color, amount, rnd);
}

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

  // ---- Casco: banda de bronce, casquete de acero y nasal ----
  const band = kit.box(12, 2, 12, (ctx, r, p, rnd) => {
    fill(ctx, r, STEEL_DARK, rnd);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      noisy(b, tone(STEEL, 0.9), 0.05, rnd);
      b.rect(0, 1, b.w, 1, STEEL_DARK);
      for (let x = 1; x < b.w; x += 3) b.px(x, 0, BRONZE); // remaches
      b.px(0, 0, [226, 230, 236]);
    }
    noisy(brush(ctx, r.top), STEEL, 0.05, rnd);
  });
  band.position.y = 9 * PX;
  parts.head.add(band);

  const cap = kit.box(10, 2, 10, (ctx, r, p, rnd) => {
    fill(ctx, r, STEEL, rnd, 0.06);
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, 1, b.w, 1, tone(STEEL, 0.86));
      b.px(2, 0, [226, 230, 236]); // brillo
      b.px(3, 0, [210, 214, 220]);
      b.rect(4, 0, 2, 2, STEEL_DARK); // costura al medio
      b.rect(4, 0, 1, 2, tone(STEEL_DARK, 1.2));
    }
    const t = brush(ctx, r.top);
    t.rect(4, 0, 2, 10, STEEL_DARK);
    t.rect(0, 4, 10, 2, STEEL_DARK);
  });
  cap.position.y = 11 * PX;
  parts.head.add(cap);

  const crown = kit.box(6, 1, 6, (ctx, r, p, rnd) => {
    fill(ctx, r, STEEL, rnd, 0.05);
    const t = brush(ctx, r.top);
    t.rect(2, 2, 2, 2, STEEL_DARK);
    t.px(2, 2, [230, 232, 238]);
    for (const k of ['front', 'back', 'left', 'right']) brush(ctx, r[k]).px(1, 0, [226, 230, 236]);
  });
  crown.position.y = 12.5 * PX;
  parts.head.add(crown);

  const nasal = kit.box(
    2,
    3,
    1,
    (ctx, r, p, rnd) => {
      fill(ctx, r, STEEL, rnd, 0.05);
      const f = brush(ctx, r.front);
      f.rect(1, 0, 1, 3, STEEL_DARK);
      f.px(0, 0, [226, 230, 236]);
      f.px(0, 2, tone(STEEL, 0.8));
    },
    [0.5, 1, 0],
  );
  nasal.position.set(0, 8 * PX, 5 * PX);
  parts.head.add(nasal);

  // ---- Cuernos: tres cajas que salen de costado y se curvan hacia arriba ----
  const hornPainter = (color, ring) => (ctx, r, p, rnd) => {
    fill(ctx, r, color, rnd, 0.05);
    if (!ring) return;
    for (const k of ['front', 'back', 'left', 'right']) {
      const b = brush(ctx, r[k]);
      b.rect(0, b.h - 1, b.w, 1, tone(color, 0.85));
    }
  };
  for (const s of [-1, 1]) {
    const cuff = kit.box(1, 3, 3, (ctx, r, p, rnd) => {
      fill(ctx, r, BRONZE, rnd, 0.07);
      for (const k of ['front', 'back', 'left', 'right']) brush(ctx, r[k]).px(0, 0, [244, 214, 150]);
    });
    cuff.position.set(s * 6.5 * PX, 9.5 * PX, 0);
    const base = kit.box(2, 2, 2, hornPainter(HORN, true), [0.5, 0, 0.5]);
    base.position.set(s * 8 * PX, 8 * PX, 0);
    const mid = kit.box(2, 2, 2, hornPainter(mix(HORN, HORN_DARK, 0.3), true), [0.5, 0, 0.5]);
    mid.position.set(s * 9 * PX, 10 * PX, 0);
    const tip = kit.box(1, 2, 1, hornPainter(HORN_DARK, false), [0.5, 0, 0.5]);
    tip.position.set(s * 9.5 * PX, 12 * PX, 0);
    parts.head.add(cuff, base, mid, tip);
  }

  // ---- Barba: cuelga de la cara sobre el pecho, con dos trenzas ----
  const beard = kit.box(
    6,
    5,
    2,
    (ctx, r, p, rnd) => {
      for (const k of SIDES) {
        const b = brush(ctx, r[k]);
        for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) hairPx(b, x, y, rnd, k === 'back' ? HAIR_DARK : HAIR);
      }
      const f = brush(ctx, r.front);
      const bk = brush(ctx, r.back);
      for (const b of [f, bk]) {
        // Abajo se abre en dos trenzas (columnas 0-1 y 4-5) con anillos.
        b.clear(2, 2, 2, 3);
        b.clear(0, 4, 1, 1);
        b.clear(5, 4, 1, 1);
        for (const x of [0, 4]) {
          b.px(x, 2, HAIR_LIGHT);
          b.px(x + 1, 2, HAIR_DARK);
          b.rect(x, 3, 2, 1, BRONZE);
          b.px(x, 3, [244, 214, 150]);
        }
        b.px(1, 4, HAIR_LIGHT);
        b.px(4, 4, HAIR_LIGHT);
      }
      for (const k of ['left', 'right']) {
        const b = brush(ctx, r[k]);
        b.rect(0, 3, 2, 1, BRONZE);
      }
      const bottom = brush(ctx, r.bottom);
      bottom.clear(2, 0, 2, 2);
    },
    [0.5, 1, 1],
  );
  beard.position.set(0, 0, 5 * PX);
  parts.head.add(beard);

  // ---- Escudo redondo a la espalda, pintado del color elegido ----
  const shield = kit.box(
    9,
    9,
    1,
    (ctx, r, p, rnd) => {
      fill(ctx, r, WOOD, rnd, 0.08);
      const b = brush(ctx, r.back);
      // Cuartos alternados: color elegido y madera clara.
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
          const q = (x < 4.5) === (y < 4.5);
          b.px(x, y, q ? tone(p.color, 0.92 + rnd() * 0.12) : tone([214, 196, 160], 0.92 + rnd() * 0.1));
        }
      }
      // Borde de hierro y vetas.
      for (let i = 0; i < 9; i++) {
        for (const [x, y] of [[i, 0], [i, 8], [0, i], [8, i]]) b.px(x, y, STEEL_DARK);
      }
      for (const [x, y] of [[1, 1], [7, 1], [1, 7], [7, 7]]) b.px(x, y, STEEL_DARK);
      b.px(2, 0, STEEL);
      b.px(0, 2, STEEL);
      // Ombligo de metal al centro.
      b.rect(3, 3, 3, 3, STEEL);
      b.px(3, 3, [230, 232, 238]);
      b.rect(4, 5, 2, 1, STEEL_DARK);
      b.px(5, 4, STEEL_DARK);
      roundCorners(b, [2, 1]);
      const f = brush(ctx, r.front);
      roundCorners(f, [2, 1]);
      for (const k of ['left', 'right']) {
        const s = brush(ctx, r[k]);
        s.rect(0, 0, 1, 9, STEEL_DARK);
        s.clear(0, 0, 1, 2);
        s.clear(0, 7, 1, 2);
      }
      for (const k of ['top', 'bottom']) {
        const s = brush(ctx, r[k]);
        s.rect(0, 0, 9, 1, STEEL_DARK);
        s.clear(0, 0, 2, 1);
        s.clear(7, 0, 2, 1);
      }
    },
    [0.5, 0.5, 1],
  );
  shield.position.set(0, 4.5 * PX, -2.5 * PX);
  parts.body.add(shield);
}
