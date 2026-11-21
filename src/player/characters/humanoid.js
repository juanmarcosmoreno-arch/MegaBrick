// Base común de los personajes (etapa 14): un muñeco de bloques de cabeza
// grande, con texturas de pixel art pintadas por código y animado (camina,
// golpea al romper o poner, vuela, mira arriba y abajo, parpadea y cambia
// de cara). Cada personaje (normal, soldado, vikingo...) es un archivo de
// esta carpeta que dice cómo se pinta y qué accesorios lleva.
//
// Medidas en "píxeles" de la textura (PX bloques cada uno): la cabeza es
// un cubo de 10, el cuerpo 8 de ancho x 9 de alto x 5, los brazos 3 x 9 x 3
// y las piernas 4 x 8 x 4. En total, 27 px: unos 1,75 bloques.
//
// El personaje se arma mirando hacia +Z (como lo espera Avatar.js), con los
// pies en y = 0. Su mano derecha (donde va el bloque) está del lado -X.

/** Bloques por píxel de textura. */
export const PX = 0.065;

/** Medidas de cada parte (en píxeles): ancho, alto, fondo. */
export const SIZES = Object.freeze({
  head: [10, 10, 10],
  body: [8, 9, 5],
  arm: [3, 9, 3],
  leg: [4, 8, 4],
});

/** Expresiones (las mismas que tenía Coco: las usa el juego). */
export const FACES = Object.freeze(['normal', 'feliz', 'sorprendido', 'determinado']);

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------

/** '#rrggbb' → [r, g, b]. */
export function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** [r, g, b] → 'rgb(...)' para el canvas. */
export const css = ([r, g, b], a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Color con el brillo multiplicado. */
export const tone = ([r, g, b], f) => [Math.min(255, r * f), Math.min(255, g * f), Math.min(255, b * f)];

/** Mezcla de dos colores. */
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Generador pseudoaleatorio con semilla (para manchas, vetas, etc.). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Paleta que reciben los pintores: el color elegido (para la ropa) en
 * varios tonos, y colores fijos de piel y ojos.
 */
export function paletteFor(colorHex) {
  const c = rgb(colorHex);
  return {
    color: c,
    colorLight: mix(c, [255, 255, 255], 0.3),
    colorDark: tone(c, 0.62),
    colorDeep: tone(c, 0.42),
  };
}

// ---------------------------------------------------------------------------
// Pintar: cada parte es una caja con su textura desplegada como una cruz
// (arriba y abajo en la primera fila; derecha, frente, izquierda y espalda
// en la segunda). Los pintores reciben el contexto y los rectángulos de
// cada cara, y pintan píxel a píxel.
// ---------------------------------------------------------------------------

/**
 * Rectángulos de las caras de una caja de w x h x d px en su textura.
 * right/left son los costados del personaje (su derecha es -X).
 */
export function faceRects(w, h, d) {
  return {
    top: { x: d, y: 0, w, h: d },
    bottom: { x: d + w, y: 0, w, h: d },
    right: { x: 0, y: d, w: d, h }, // -X
    front: { x: d, y: d, w, h }, // +Z
    left: { x: d + w, y: d, w: d, h }, // +X
    back: { x: 2 * d + w, y: d, w, h }, // -Z
    size: { w: 2 * d + 2 * w, h: d + h },
  };
}

/**
 * Un pincel para pintar píxeles en una cara: p.px(x, y, color) y
 * p.rect(x, y, w, h, color), con coordenadas dentro de la cara.
 */
export function brush(ctx, rect) {
  return {
    w: rect.w,
    h: rect.h,
    px(x, y, color, a = 1) {
      if (x < 0 || y < 0 || x >= rect.w || y >= rect.h) return;
      ctx.fillStyle = css(color, a);
      ctx.fillRect(rect.x + x, rect.y + y, 1, 1);
    },
    rect(x, y, w, h, color, a = 1) {
      ctx.fillStyle = css(color, a);
      ctx.fillRect(rect.x + x, rect.y + y, w, h);
    },
    clear(x, y, w, h) {
      ctx.clearRect(rect.x + x, rect.y + y, w, h);
    },
  };
}

/** Rellena una cara con un color y un ruido suave de brillo (pixel art). */
export function noisy(b, color, amount, rnd) {
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const k = 1 + (rnd() * 2 - 1) * amount;
      b.px(x, y, tone(color, k));
    }
  }
}

/**
 * Cara por defecto (ojos y boca) para cada expresión, en una cara de 10x10.
 * Los personajes la pueden usar o hacer la suya.
 * @param {ReturnType<typeof brush>} b la cara de adelante de la cabeza
 * @param {string} expr una de FACES
 * @param {boolean} blink ojos cerrados (parpadeo)
 * @param {object} o colores: eye (iris), white (blanco del ojo), mouth, brow (cejas o null)
 */
export function paintFace(b, expr, blink, { eye, white = [245, 245, 240], mouth, brow = null, eyeY = 4 }) {
  const ex = [2, 6]; // columna izquierda de cada ojo (2 px de ancho)
  for (const x of ex) {
    if (blink) {
      b.rect(x, eyeY + 1, 2, 1, tone(eye, 0.7));
    } else if (expr === 'sorprendido') {
      b.rect(x, eyeY - 1, 2, 3, white);
      b.rect(x, eyeY, 2, 2, eye);
    } else if (expr === 'feliz') {
      // Ojos cerrados de alegría: arquitos.
      b.px(x, eyeY + 1, eye);
      b.px(x + 1, eyeY, eye);
    } else {
      b.rect(x, eyeY, 2, 2, white);
      b.px(x + (x < 5 ? 1 : 0), eyeY + 1, eye);
      b.px(x + (x < 5 ? 1 : 0), eyeY, eye);
    }
    if (brow) {
      const by = eyeY - 2;
      if (expr === 'determinado') {
        // Cejas fruncidas hacia el centro.
        b.px(x < 5 ? x : x + 1, by, brow);
        b.px(x < 5 ? x + 1 : x, by + 1, brow);
      } else if (expr === 'sorprendido') {
        b.rect(x, by - 1, 2, 1, brow);
      } else {
        b.rect(x, by, 2, 1, brow);
      }
    }
  }
  const my = eyeY + 4;
  if (expr === 'feliz') {
    b.px(3, my, mouth);
    b.rect(4, my + 1, 2, 1, mouth);
    b.px(6, my, mouth);
  } else if (expr === 'sorprendido') {
    b.rect(4, my, 2, 2, mouth);
  } else if (expr === 'determinado') {
    b.rect(3, my + 1, 4, 1, mouth);
  } else {
    b.rect(4, my, 2, 1, mouth);
  }
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/**
 * Caja de w x h x d px con la textura desplegada (ver faceRects). El origen
 * queda donde diga `anchor` ([x, y, z] de 0 a 1 dentro de la caja: 0.5,
 * 1, 0.5 es arriba al centro, para colgar un brazo del hombro).
 */
function boxGeometry(THREE, w, h, d, anchor = [0.5, 0.5, 0.5]) {
  const geo = new THREE.BoxGeometry(w * PX, h * PX, d * PX);
  geo.translate((0.5 - anchor[0]) * w * PX, (0.5 - anchor[1]) * h * PX, (0.5 - anchor[2]) * d * PX);
  const r = faceRects(w, h, d);
  const W = r.size.w;
  const H = r.size.h;
  // Orden de las caras en BoxGeometry: +X, -X, +Y, -Y, +Z, -Z.
  const order = [r.left, r.right, r.top, r.bottom, r.front, r.back];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const q = order[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      const u = uv.getX(k);
      const v = uv.getY(k);
      uv.setXY(k, (q.x + u * q.w) / W, 1 - (q.y + (1 - v) * q.h) / H);
    }
  }
  return geo;
}

/** Canvas de la textura de una caja, ya con el tamaño de su despliegue. */
function canvasFor(w, h, d) {
  const r = faceRects(w, h, d);
  const c = document.createElement('canvas');
  c.width = r.size.w;
  c.height = r.size.h;
  return c;
}

/**
 * Crea las piezas de un personaje. Los personajes (ver normal.js) dan:
 * - name, id
 * - paint: { head(ctx, rects, pal, rnd), body(...), arm(ctx, rects, pal, rnd, side),
 *   leg(ctx, rects, pal, rnd, side) } — side: 'right' o 'left'
 * - face(b, expr, blink, pal) — pinta los ojos y la boca en la cara de adelante
 * - accessories(kit, parts, pal) — opcional: cajas extra (sombrero, casco...)
 *   con kit.box(w, h, d, painter, anchor) que devuelve una malla ya pintada,
 *   para colgar de parts.head, parts.body, parts.armR, parts.armL, parts.legR, parts.legL.
 * @param {typeof import('three')} THREE
 * @param {object} look el personaje
 * @param {{color: string}} o color elegido (para la ropa)
 */
export function createHumanoid(THREE, look, { color }) {
  const trash = [];
  const own = (x) => (trash.push(x), x);
  let pal = paletteFor(color);
  const material = (canvas) => {
    const tex = own(new THREE.CanvasTexture(canvas));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return own(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
  };

  /** Una parte: caja pintada (vuelve a pintarse al cambiar de color o de cara). */
  const parts = {};
  const painters = [];
  function part(w, h, d, anchor, paintFn) {
    const canvas = canvasFor(w, h, d);
    const mat = material(canvas);
    const mesh = new THREE.Mesh(own(boxGeometry(THREE, w, h, d, anchor)), mat);
    const repaint = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      paintFn(ctx, faceRects(w, h, d), pal);
      mat.map.needsUpdate = true;
    };
    painters.push(repaint);
    repaint();
    return { mesh, repaint };
  }

  const [hw, hh, hd] = SIZES.head;
  const [bw, bh, bd] = SIZES.body;
  const [aw, ah, ad] = SIZES.arm;
  const [lw, lh, ld] = SIZES.leg;

  const root = new THREE.Group();
  root.name = look.id;

  // Piernas: cuelgan de la cadera.
  const hipY = lh * PX;
  for (const side of ['right', 'left']) {
    const s = side === 'right' ? -1 : 1;
    const rnd = seeded(side === 'right' ? 11 : 12);
    const { mesh } = part(lw, lh, ld, [0.5, 1, 0.5], (ctx, r, p) => look.paint.leg(ctx, r, p, rnd, side));
    const pivot = new THREE.Group();
    pivot.position.set((s * lw * PX) / 2, hipY, 0);
    pivot.add(mesh);
    root.add(pivot);
    parts[side === 'right' ? 'legR' : 'legL'] = pivot;
  }

  // Cuerpo (de la cadera al cuello): respira un poquito.
  const torso = new THREE.Group();
  torso.position.y = hipY;
  root.add(torso);
  {
    const rnd = seeded(21);
    const { mesh } = part(bw, bh, bd, [0.5, 0, 0.5], (ctx, r, p) => look.paint.body(ctx, r, p, rnd));
    torso.add(mesh);
    parts.body = mesh;
  }

  // Brazos: cuelgan de los hombros.
  const shoulderY = bh * PX - PX * 0.5;
  for (const side of ['right', 'left']) {
    const s = side === 'right' ? -1 : 1;
    const rnd = seeded(side === 'right' ? 31 : 32);
    const { mesh } = part(aw, ah, ad, [0.5, 1, 0.5], (ctx, r, p) => look.paint.arm(ctx, r, p, rnd, side));
    const pivot = new THREE.Group();
    pivot.position.set(s * ((bw + aw) * PX) / 2, shoulderY, 0);
    pivot.add(mesh);
    torso.add(pivot);
    parts[side === 'right' ? 'armR' : 'armL'] = pivot;
  }
  // La mano derecha: al final del brazo, un poco adelante (ahí va el bloque).
  const hand = new THREE.Group();
  hand.position.set(0, -ah * PX + PX, ad * PX * 0.5 + PX);
  parts.armR.add(hand);

  // Cabeza: gira arriba y abajo desde el cuello, con su cara.
  const neck = new THREE.Group();
  neck.position.y = bh * PX;
  torso.add(neck);
  let expr = 'normal';
  let blink = false;
  const head = part(hw, hh, hd, [0.5, 0, 0.5], (ctx, r, p) => {
    look.paint.head(ctx, r, p, seeded(41));
    look.face(brush(ctx, r.front), expr, blink, p);
  });
  neck.add(head.mesh);
  parts.head = head.mesh;

  // Accesorios.
  const kit = {
    THREE,
    PX,
    /** Una caja pintada como las partes, con su propia textura. */
    box(w, h, d, paintFn, anchor = [0.5, 0.5, 0.5]) {
      const rnd = seeded(w * 7 + h * 13 + d * 17);
      return part(w, h, d, anchor, (ctx, r, p) => paintFn(ctx, r, p, rnd)).mesh;
    },
    /** Una malla con un material propio (por ejemplo, el visor transparente de un casco). */
    mesh(geometry, materialParams) {
      return new THREE.Mesh(own(geometry), own(new THREE.MeshLambertMaterial(materialParams)));
    },
  };
  look.accessories?.(kit, parts, pal);

  // ---- Animación ----
  let walk = 0; // fase de la caminata
  let walkAmount = 0;
  let flyAmount = 0;
  let swingT = 0; // tiempo que queda del golpe
  let swingQueued = false;
  let blinkTimer = 2 + Math.random() * 3;
  const SWING_TIME = 0.28;

  function update(dt, { speed = 0, flying = false, t = 0, pitch = 0 } = {}) {
    const k = (rate) => 1 - Math.exp(-rate * dt);
    walkAmount += ((flying ? 0 : Math.min(1, speed / 4.3)) - walkAmount) * k(10);
    flyAmount += ((flying ? 1 : 0) - flyAmount) * k(6);
    walk += dt * (4 + speed * 1.6);
    const sw = Math.sin(walk);

    parts.legR.rotation.x = sw * 0.75 * walkAmount + flyAmount * 0.35;
    parts.legL.rotation.x = -sw * 0.75 * walkAmount + flyAmount * 0.2;

    // Brazos: balanceo al caminar, abiertos al volar, quietos con un vaivén.
    const idle = Math.sin(t * 1.7) * 0.04;
    parts.armR.rotation.set(-sw * 0.6 * walkAmount + idle, 0, -flyAmount * 0.9 - 0.04);
    parts.armL.rotation.set(sw * 0.6 * walkAmount - idle, 0, flyAmount * 0.9 + 0.04);

    // Golpe con el brazo derecho (al romper o poner).
    if (swingT > 0) {
      swingT = Math.max(0, swingT - dt);
      if (swingT === 0 && swingQueued) {
        swingQueued = false;
        swingT = SWING_TIME;
      }
    }
    if (swingT > 0) {
      const u = 1 - swingT / SWING_TIME;
      parts.armR.rotation.x = -Math.sin(u * Math.PI) * 1.6 - 0.3 * Math.sin(u * Math.PI * 2);
    }

    // Respiración y un saltito al caminar.
    torso.position.y = hipY + Math.abs(Math.cos(walk)) * PX * 0.6 * walkAmount + Math.sin(t * 2.2) * PX * 0.08;

    // La cabeza mira arriba y abajo (con tope).
    neck.rotation.x = Math.max(-0.6, Math.min(0.6, -pitch * 0.7));

    // Parpadeo.
    blinkTimer -= dt;
    const shouldBlink = blinkTimer < 0.12 && blinkTimer > 0;
    if (blinkTimer <= 0) blinkTimer = 2.5 + Math.random() * 3.5;
    if (shouldBlink !== blink && dt > 0) {
      blink = shouldBlink;
      head.repaint();
    }
  }

  function swing() {
    if (swingT > 0) swingQueued = true;
    else swingT = SWING_TIME;
  }

  function setColor(hex) {
    pal = paletteFor(hex);
    for (const repaint of painters) repaint();
  }

  function setExpression(name) {
    if (!FACES.includes(name) || name === expr) return;
    expr = name;
    head.repaint();
  }

  function dispose() {
    root.removeFromParent();
    for (const x of trash) x.dispose?.();
    trash.length = 0;
  }

  update(0);
  return { root, hand, parts, update, swing, setColor, setExpression, dispose };
}
