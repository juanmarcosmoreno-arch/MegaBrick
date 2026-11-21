// Texturas de los mecanismos (etapa 13): cable de cobrizo, palanca, botón,
// placa de presión, lámpara, inversor, retardador, timbre y pistón.
//
// Cada pintor recibe un TilePainter (ver textures.js) y dibuja una textura de
// 16x16; `t` son las herramientas y la paleta compartidas de textures.js.
//
// Ojo con los recortes: las piezas chicas (cable, palanca, botón, compuertas,
// vástago) se dibujan con cajas más chicas que el bloque y la textura se
// RECORTA en el lugar de la caja (no se estira). En las caras de costado la
// fila de la imagen sigue la altura: una caja de y = a hasta y = b muestra las
// filas 16·(1 − b) a 16·(1 − a), o sea que una caja apoyada en el piso muestra
// las filas de ABAJO. En las caras de arriba, la columna y la fila siguen x y z.

/** @param {object} t herramientas de textures.js (ver TOOLS) */
export default function painters(t) {
  const { S, C, wrap, tone, lift, mix, tileNoise } = t;
  const WHITE = [255, 255, 255];

  // Cobre del cable: apagado (oscuro, sin brillo) y con energía (naranja
  // dorado, casi encandila). Cada uno de oscuro a claro: surco, sombra, base, brillo.
  const COPPER_OFF = [[90, 50, 32], [112, 63, 40], [134, 78, 48], [166, 102, 64]];
  const COPPER_ON = [[204, 102, 36], [234, 136, 48], [252, 170, 66], [255, 222, 132]];

  // Piedra lisa de las placas y compuertas (la misma de 'smooth_stone').
  const STONE = [166, 167, 171];
  // Hierro de los marcos (más claro que C.iron, que es casi negro).
  const IRON = [92, 90, 96];

  /** Piedra lisa: gris parejo con grano muy suave. */
  function paintSmooth(p, base = STONE) {
    p.noiseFill(base, 3);
    p.speckle(tone(base, 0.95), 0.1, 2);
  }

  /**
   * Bisel de un rectángulo (incluidos los bordes): luz arriba/izquierda y
   * sombra abajo/derecha, como una plancha apenas levantada.
   */
  function bevel(p, x0, y0, x1, y1, hi = 1.1, lo = 0.82) {
    for (let x = x0; x <= x1; x++) {
      p.shade(x, y0, hi);
      p.shade(x, y1, lo);
    }
    for (let y = y0 + 1; y < y1; y++) {
      p.shade(x0, y, hi);
      p.shade(x1, y, lo);
    }
  }

  /**
   * Incrustación: pinta los píxeles de `mask` (lista de [x, y]) con el color
   * que devuelve `color(x, y)` y marca la piedra de alrededor como una ranura
   * tallada (sombra arriba/izquierda, canto claro abajo/derecha).
   */
  function inlay(p, mask, color) {
    const inMask = new Set(mask.map(([x, y]) => y * S + x));
    const has = (x, y) => x >= 0 && y >= 0 && x < S && y < S && inMask.has(y * S + x);
    for (const [x, y] of mask) {
      for (const [dx, dy, f] of [[0, 1, 1.08], [1, 0, 1.06], [0, -1, 0.74], [-1, 0, 0.8]]) {
        const nx = x + dx;
        const ny = y + dy;
        // Cada vecino se sombrea una sola vez (el primero que lo toca).
        if (nx < 0 || ny < 0 || nx >= S || ny >= S || has(nx, ny) || inMask.has(-(ny * S + nx) - 1)) continue;
        inMask.add(-(ny * S + nx) - 1);
        p.shade(nx, ny, f);
      }
    }
    for (const [x, y] of mask) p.set(x, y, color(x, y));
  }

  /**
   * Trenza de cobre: hilos en diagonal (cada 4 px) con un surco entre uno y
   * otro, que se lee como un cable retorcido en cualquier recorte.
   */
  function paintBraid(p, [groove, dark, base, hi], grain) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const k = (x + y) % 4;
        const c = k === 0 ? hi : k === 1 ? base : k === 2 ? dark : groove;
        p.set(x, y, p.vary(c, grain));
      }
    }
    // Alambritos más claros sueltos en los hilos (no en los surcos).
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(p.rnd() * S);
      const y = Math.floor(p.rnd() * S);
      if ((x + y) % 4 === 1) p.set(x, y, p.vary(mix(base, hi, 0.6), grain));
    }
  }

  /**
   * Cara de arriba de una compuerta (piedra lisa) mirando hacia arriba de la
   * imagen: `shapes` devuelve los píxeles de cobre y se incrustan.
   */
  function paintGate(p, mask, on) {
    paintSmooth(p);
    // Bisel de la losa (claro arriba/izquierda, oscuro abajo/derecha).
    for (let i = 0; i < S; i++) {
      p.shade(i, 0, 1.06);
      p.shade(0, i, 1.04);
      p.shade(i, S - 1, 0.86);
      p.shade(S - 1, i, 0.88);
    }
    const [, dark, base, hi] = on ? COPPER_ON : COPPER_OFF;
    inlay(p, mask, (x, y) => {
      // Brillo en el borde izquierdo de cada trazo, sombra a la derecha.
      const lit = !mask.some(([mx, my]) => mx === x - 1 && my === y);
      const shaded = !mask.some(([mx, my]) => mx === x + 1 && my === y);
      return p.vary(lit ? hi : shaded ? dark : base, 3);
    });
  }

  /** Cable vertical de 2 px de ancho por el medio (columnas 7 y 8) entre dos filas. */
  function wireMask(y0, y1) {
    const m = [];
    for (let y = y0; y <= y1; y++) m.push([7, y], [8, y]);
    return m;
  }

  /** Madera con veta vertical; las columnas impares, más claras (palo redondo). */
  function paintStick(p, base) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) p.set(x, y, p.vary(tone(base, x % 2 ? 1.1 : 0.84), 4));
    }
    // Vetas: trazos verticales más oscuros.
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(p.rnd() * S);
      const y0 = Math.floor(p.rnd() * S);
      for (let k = 0; k < 3 + Math.floor(p.rnd() * 3); k++) p.shade(x, wrap(y0 + k), 0.86);
    }
  }

  /** Marco de madera de 3 px con sombreado parejo (sirve igual al revés). */
  function woodFrame(p, base, width = 3) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.min(x, y, S - 1 - x, S - 1 - y); // distancia al borde
        if (d >= width) continue;
        // Tablas: el canto de afuera y el de adentro más oscuros, el medio claro.
        const f = d === 0 ? 0.78 : d === width - 1 ? 0.88 : 1.06;
        // La veta corre a lo largo de cada tabla.
        const along = d === x || d === S - 1 - x ? y : x;
        const grain = (along * 7 + d * 3) % 9 === 0 ? 0.9 : 1;
        p.set(x, y, p.vary(tone(base, f * grain), 4));
      }
    }
    // Uniones en inglete en las cuatro esquinas.
    for (let k = 0; k < width; k++) {
      for (const [x, y] of [[k, k], [S - 1 - k, k], [k, S - 1 - k], [S - 1 - k, S - 1 - k]]) p.shade(x, y, 0.84);
    }
  }

  /** Piedra rústica (como 'stone', más compacta) en un rectángulo. */
  function stoneFill(p, x0, y0, x1, y1) {
    const cloud = tileNoise(p, 4);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let c = tone(C.stone, 1 + cloud(x + 0.5, y + 0.5) * 0.06);
        const r = p.rnd();
        if (r < 0.12) c = C.stoneDark;
        else if (r < 0.2) c = C.stoneLight;
        p.set(x, y, p.vary(c, 5));
      }
    }
  }

  /** Perno de hierro de 2x2 con brillo y sombra. */
  function bolt(p, x, y, base = IRON) {
    p.set(x, y, lift(base, 70));
    p.set(x + 1, y, tone(base, 1.15));
    p.set(x, y + 1, tone(base, 0.9));
    p.set(x + 1, y + 1, tone(base, 0.55));
  }

  /** Marco de hierro de 2 px con bisel y remaches en las esquinas. */
  function ironFrame(p, base = IRON) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.min(x, y, S - 1 - x, S - 1 - y);
        if (d > 1) continue;
        let f = d === 0 ? 1 : 0.92;
        if (x === 0 || y === 0) f = 1.35;
        else if (x === S - 1 || y === S - 1) f = 0.7;
        else if (d === 1 && (x === 1 || y === 1)) f = 1.12;
        else if (d === 1) f = 0.8;
        p.set(x, y, p.vary(tone(base, f), 3));
      }
    }
    for (const [x, y] of [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]]) p.set(x, y, lift(base, 80));
  }

  /** Lámpara: marco de hierro, vidrio grueso y un filamento de cobre en espiral. */
  function paintLamp(p, on) {
    const c = (S - 1) / 2;
    // Vidrio: apagado, gris humo; prendido, ámbar que quema más al centro.
    for (let y = 2; y < S - 2; y++) {
      for (let x = 2; x < S - 2; x++) {
        const d = Math.hypot(x - c, y - c) / 6;
        let col;
        if (on) col = mix([255, 212, 116], [216, 122, 40], Math.min(1, d * d * 1.3));
        else col = tone([74, 76, 82], 1.08 - d * 0.22 + (x + y < 12 ? 0.06 : 0));
        p.set(x, y, p.vary(col, on ? 3 : 2));
      }
    }
    // Vidrio grueso: el canto de adentro del marco se ve más denso.
    for (let i = 2; i < S - 2; i++) {
      for (const [x, y] of [[i, 2], [2, i]]) p.shade(x, y, on ? 0.86 : 0.8);
      for (const [x, y] of [[i, S - 3], [S - 3, i]]) p.shade(x, y, on ? 0.92 : 0.9);
    }
    ironFrame(p, on ? mix(IRON, [150, 110, 70], 0.25) : IRON);

    // Filamento: una espiral vista de costado (tres rulos encadenados) y
    // dos patitas que bajan hasta el zócalo.
    const [, dark, base, hi] = on ? [0, [255, 204, 104], [255, 238, 168], [255, 254, 232]] : COPPER_OFF;
    const fil = [];
    for (let y = 10; y <= 12; y++) fil.push([3, y, dark], [12, y, dark]);
    for (const x0 of [3, 6, 9]) {
      // Arriba, la vuelta de atrás (más oscura); abajo, la de adelante (clara).
      fil.push([x0 + 1, 5, dark], [x0 + 2, 5, dark], [x0 + 1, 9, hi], [x0 + 2, 9, hi]);
      for (const y of [6, 7, 8]) fil.push([x0, y, y === 8 ? hi : base], [x0 + 3, y, y === 8 ? hi : base]);
    }
    if (on) {
      // Resplandor alrededor de la espiral.
      for (const [x, y] of fil) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          p.set(x + dx, y + dy, mix(p.get(x + dx, y + dy), [255, 236, 170], 0.2));
        }
      }
    }
    for (const [x, y, col] of fil) p.set(x, y, p.vary(col, 3));
    // Base de la lámpara: zócalo de cobre donde entran las patitas.
    for (let x = 3; x <= 12; x++) p.set(x, 13, p.vary(tone(on ? [214, 136, 70] : COPPER_OFF[2], x === 3 ? 1.15 : 0.9), 3));
    // Reflejos del vidrio arriba a la izquierda.
    const glint = on ? [255, 252, 236] : mix([74, 76, 82], WHITE, 0.45);
    for (const [x, y] of [[3, 5], [4, 4], [5, 3], [3, 6]]) p.set(x, y, glint);
  }

  /** Cara de un pistón: plancha gruesa de tablas con borde de hierro. */
  function paintPistonFace(p) {
    const wood = C.plank;
    for (let y = 2; y < S - 2; y++) {
      for (let x = 2; x < S - 2; x++) {
        const board = Math.floor((y - 2) / 4);
        const tint = [4, -6, 6][board] ?? 0;
        let c = lift(wood, tint);
        if ((y - 2) % 4 === 3 && y < S - 3) c = tone(wood, 0.68); // junta entre tablas
        p.set(x, y, p.vary(c, 5));
      }
      // Veta.
      if ((y - 2) % 4 === 1) {
        const off = Math.floor(p.rnd() * 6);
        for (let k = 0; k < 5; k++) p.shade(3 + off + k, y, 0.88);
      }
    }
    ironFrame(p);
    // Sombra del marco sobre la madera.
    for (let i = 2; i < S - 2; i++) {
      p.shade(i, 2, 0.84);
      p.shade(2, i, 0.88);
    }
    // Clavos de cabeza ancha a los costados de cada tabla.
    for (const y of [4, 8, 12]) {
      p.set(3, y, tone(IRON, 1.4));
      p.set(S - 4, y, tone(IRON, 1.1));
    }
  }

  const out = {
    wire_off(p) {
      // Cable de cobrizo apagado: trenza de cobre oscuro, opaca.
      paintBraid(p, COPPER_OFF, 3);
    },

    wire_on(p) {
      // Con energía: la misma trenza en naranja dorado, con chispitas casi blancas.
      paintBraid(p, COPPER_ON, 4);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        if ((x + y) % 4 === 0) p.set(x, y, [255, 248, 214]);
      }
    },

    lever_base(p) {
      // Placa de piedra lisa con una ranura en el medio por donde se mueve
      // el palo. En el piso se ve el recorte de las columnas 4..11 y filas
      // 5..10 (en la pared, columnas 5..10 y filas 4..11); los costados de
      // la placa (2 px de alto) son las filas 14 y 15.
      paintSmooth(p, [156, 157, 162]);
      bevel(p, 4, 5, 11, 10, 1.1, 0.82);
      // En la pared el recorte es más alto: el bisel sigue en las filas 4 y 11.
      for (let x = 5; x <= 10; x++) {
        p.shade(x, 4, 1.1);
        p.shade(x, 11, 0.82);
      }
      // Ranura: hundida, con sombra arriba/izquierda y el fondo oscuro.
      for (let y = 6; y <= 9; y++) {
        p.set(7, y, p.vary([70, 70, 76], 2));
        p.set(8, y, p.vary([92, 92, 98], 2));
      }
      p.set(7, 6, [56, 56, 62]);
      p.set(8, 6, [64, 64, 70]);
      for (let y = 6; y <= 9; y++) p.shade(9, y, 1.08);
      for (const x of [7, 8]) p.shade(x, 10, 1.1);
      // Costado de la placa: canto claro arriba, sombra abajo.
      for (let x = 0; x < S; x++) {
        p.shade(x, 14, 1.08);
        p.shade(x, 15, 0.8);
      }
      // Dos tornillitos en la placa.
      for (const [x, y] of [[5, 7], [10, 8]]) {
        p.set(x, y, [118, 118, 124]);
        p.shade(x + 1, y + 1, 1.05);
      }
    },

    lever_handle(p) {
      // Palo de madera con veta vertical. Se ve en una caja de 2 px de ancho
      // y de las filas 6 a 13 (palo de y = 2/16 a 10/16): la perilla clara
      // va en las filas 6 y 7, la punta de arriba del recorte.
      paintStick(p, [150, 104, 60]);
      for (let x = 0; x < S; x++) {
        const lit = x % 2 === 1;
        p.set(x, 5, p.vary(lit ? [236, 214, 170] : [206, 180, 134], 3));
        p.set(x, 6, p.vary(lit ? [232, 206, 158] : [198, 168, 120], 3));
        p.set(x, 7, p.vary(lit ? [214, 184, 134] : [178, 148, 102], 3));
        // Cuello de la perilla: un anillo más oscuro.
        p.set(x, 8, p.vary(lit ? [116, 78, 44] : [94, 62, 36], 3));
      }
      // Punta de abajo un poco gastada y más oscura (donde entra en la base).
      for (let x = 0; x < S; x++) for (const y of [12, 13]) p.shade(x, y, y === 13 ? 0.82 : 0.92);
    },

    button(p) {
      // Botón de piedra. La cara que se ve es el recorte de las columnas
      // 5..10 y filas 6..9 (6x4 px): un botoncito con bisel. Los costados del
      // botón (2 px de alto) son las filas 14 y 15, y en la pared también las
      // columnas 0..1 y 14..15.
      paintSmooth(p, [146, 147, 152]);
      for (let y = 6; y <= 9; y++) {
        for (let x = 5; x <= 10; x++) {
          let f = 1.04;
          if (y === 6) f = 1.2;
          else if (y === 9) f = 0.78;
          else if (x === 5) f = 1.12;
          else if (x === 10) f = 0.84;
          p.set(x, y, p.vary(tone([150, 151, 156], f), 2));
        }
      }
      // Hundido suave al medio (donde se aprieta) y un brillito.
      p.shade(7, 7, 0.94);
      p.shade(8, 7, 0.94);
      p.shade(7, 8, 0.97);
      p.shade(8, 8, 0.97);
      p.set(6, 7, lift([150, 151, 156], 36));
      // Costados: canto claro arriba y sombra abajo.
      for (let x = 0; x < S; x++) {
        p.shade(x, 14, 1.1);
        p.shade(x, 15, 0.8);
      }
      for (let y = 0; y < 14; y++) {
        for (const x of [0, 15]) p.shade(x, y, 0.86);
        for (const x of [1, 14]) p.shade(x, y, 1.06);
      }
    },

    plate(p) {
      // Placa de presión: plancha de piedra lisa. Se ve recortada en las
      // columnas y filas 1..14 (arriba) con el borde biselado; el costado
      // (1 px de alto) es la fila 15.
      paintSmooth(p, [162, 163, 167]);
      bevel(p, 1, 1, 14, 14, 1.14, 0.78);
      bevel(p, 2, 2, 13, 13, 1.05, 0.9);
      // Una ranura fina adentro, como el filete de una baldosa.
      for (let i = 4; i <= 11; i++) {
        for (const [x, y] of [[i, 4], [4, i]]) p.shade(x, y, 0.9);
        for (const [x, y] of [[i, 11], [11, i]]) p.shade(x, y, 1.05);
      }
      for (let x = 0; x < S; x++) p.shade(x, 15, 0.82);
    },

    lamp_off(p) {
      paintLamp(p, false);
    },

    lamp_on(p) {
      paintLamp(p, true);
    },

    gate_side(p) {
      // Costado de las compuertas: losas de 2/16 de alto, apoyadas en el
      // piso, así que solo se ven las filas 14 (el canto claro de arriba) y
      // 15 (una línea de cobre a lo largo). El resto, piedra lisa.
      paintSmooth(p);
      for (let x = 0; x < S; x++) {
        p.set(x, 14, p.vary(tone(STONE, 1.12), 2));
        const k = x % 4;
        p.set(x, 15, p.vary(k === 0 ? COPPER_OFF[3] : k === 3 ? COPPER_OFF[1] : COPPER_OFF[2], 3));
      }
      // Arriba de la imagen, por las dudas, lo mismo (no se ve en el juego).
      for (let x = 0; x < S; x++) {
        p.set(x, 0, p.vary(tone(STONE, 1.12), 2));
        p.shade(x, 1, 0.94);
      }
    },

    timbre_top(p) {
      // Timbre (arriba): marco de madera y una campana de bronce vista desde
      // arriba, con su brillo y el perno del medio.
      const wood = [160, 112, 66];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) p.set(x, y, p.vary(lift(wood, x < 8 ? 4 : -4), 5));
      }
      woodFrame(p, tone(wood, 0.82), 2);
      // Tablas del medio separadas por una junta.
      for (let y = 2; y < S - 2; y++) p.set(8, y, p.vary(tone(wood, 0.68), 3));
      const c = (S - 1) / 2;
      const brass = C.brass;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x - c;
          const dy = y - c;
          const r = Math.hypot(dx, dy);
          if (r > 5.3) continue;
          if (r > 4.6) {
            p.set(x, y, p.vary(tone(brass, 0.56), 3)); // borde de la campana
            continue;
          }
          // Cúpula: luz arriba a la izquierda, sombra abajo a la derecha.
          const f = 1 - (dx + dy) / 12 - (r / 4.6) ** 2 * 0.12;
          p.set(x, y, p.vary(tone(brass, f), 3));
        }
      }
      // Anillo del medio y perno.
      for (const [x, y] of [[6, 5], [5, 6], [9, 5], [10, 6], [5, 9], [6, 10], [9, 10], [10, 9]]) p.shade(x, y, 0.86);
      bolt(p, 7, 7, tone(brass, 0.7));
      // Reflejo.
      p.set(5, 4, mix(brass, WHITE, 0.7));
      p.set(4, 5, mix(brass, WHITE, 0.5));
      p.set(6, 4, mix(brass, WHITE, 0.4));
    },

    timbre_side(p) {
      // Timbre (costados): caja de tablas verticales con marco y una rejilla
      // de parlante en el medio (ranuras horizontales con su canto claro).
      const wood = [160, 112, 66];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const joint = x === 5 || x === 10;
          p.set(x, y, p.vary(joint ? tone(wood, 0.7) : lift(wood, [3, -5, 5][Math.floor(x / 5.4)]), 5));
        }
      }
      for (let i = 0; i < 6; i++) {
        const x = [3, 7, 8, 12][Math.floor(p.rnd() * 4)];
        const y0 = Math.floor(p.rnd() * S);
        for (let k = 0; k < 3; k++) p.shade(x, wrap(y0 + k), 0.88);
      }
      woodFrame(p, tone(wood, 0.82), 2);
      // Rejilla: tapa de bronce con cuatro ranuras.
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          let f = 1;
          if (y === 4 || x === 4) f = 1.18;
          else if (y === 11 || x === 11) f = 0.66;
          p.set(x, y, p.vary(tone(C.brass, f * 0.9), 3));
        }
      }
      for (const y of [5, 7, 9]) {
        for (let x = 5; x <= 10; x++) {
          p.set(x, y, p.vary([58, 40, 28], 3));
          p.set(x, y + 1, p.vary(tone(C.brass, 1.08), 3));
        }
      }
      // Tornillos de la tapa.
      for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) p.set(x, y, tone(C.brass, 0.5));
    },

    piston_side(p) {
      // Costado del pistón: caja de piedra con un marco de madera de 3 px y
      // pernos de hierro. Simétrico arriba-abajo y a los costados: se ve
      // bien mire para donde mire el pistón (y la cabeza estirada muestra
      // las filas de arriba, que son madera).
      stoneFill(p, 3, 3, S - 4, S - 4);
      // Sombra pareja del marco sobre la piedra.
      for (let i = 3; i < S - 3; i++) {
        for (const [x, y] of [[i, 3], [3, i], [i, S - 4], [S - 4, i]]) p.shade(x, y, 0.84);
      }
      woodFrame(p, C.plank, 3);
      // Pernos donde se cruzan las tablas del marco.
      for (const [x, y] of [[1, 1], [S - 3, 1], [1, S - 3], [S - 3, S - 3]]) bolt(p, x, y);
      for (const [x, y] of [[7, 1], [7, S - 3]]) bolt(p, x, y);
    },

    piston_face(p) {
      // Cara que empuja: plancha gruesa de tablas con borde de hierro.
      paintPistonFace(p);
    },

    piston_face_sticky(p) {
      // La misma plancha con una capa de resina ámbar pegajosa al medio:
      // borde irregular, brillo húmedo y una gota que chorrea.
      paintPistonFace(p);
      const amber = [214, 140, 40];
      const blob = tileNoise(p, 4);
      const c = (S - 1) / 2;
      for (let y = 3; y < S - 3; y++) {
        for (let x = 3; x < S - 3; x++) {
          const r = Math.hypot(x - c, y - c) + blob(x + 0.5, y + 0.5) * 1.3;
          if (r > 5) continue;
          // Más espesa (más oscura) en el medio; el borde fino deja ver la madera.
          const under = p.get(x, y);
          const thin = r > 4.2;
          const col = thin ? mix(under, amber, 0.55) : tone(amber, 0.96 - (r < 2 ? 0.1 : 0) + (x + y < 13 ? 0.08 : 0));
          p.set(x, y, p.vary(col, 3));
        }
      }
      // Brillos húmedos.
      for (const [x, y, k] of [[5, 5, 0.75], [6, 5, 0.55], [5, 6, 0.55], [9, 9, 0.35]]) p.set(x, y, mix(amber, WHITE, k));
      // Gota que chorrea hacia abajo.
      for (const [x, y, f] of [[9, 12, 0.9], [9, 13, 0.8], [10, 12, 0.75]]) p.set(x, y, tone(amber, f));
    },

    piston_back(p) {
      // Espalda del pistón: el mismo marco de madera y piedra, con una tapa
      // de hierro al medio y un perno grande en el centro.
      stoneFill(p, 3, 3, S - 4, S - 4);
      woodFrame(p, C.plank, 3);
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          let f = 1;
          if (y === 4 || x === 4) f = 1.3;
          else if (y === 11 || x === 11) f = 0.66;
          else if (y === 5 || x === 5) f = 1.08;
          p.set(x, y, p.vary(tone(IRON, f), 3));
        }
      }
      // Esquinas de la tapa recortadas (se ve la piedra).
      for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) p.set(x, y, p.vary(C.stoneDark, 4));
      // Perno del centro: cabeza hexagonal con su brillo.
      for (const [x, y, f] of [
        [7, 6, 1.6], [8, 6, 1.3], [6, 7, 1.5], [7, 7, 1.4], [8, 7, 1.05], [9, 7, 0.8],
        [6, 8, 1.1], [7, 8, 1], [8, 8, 0.8], [9, 8, 0.6], [7, 9, 0.7], [8, 9, 0.55],
      ]) p.set(x, y, tone(IRON, f));
      p.set(7, 7, lift(IRON, 90));
    },

    piston_rod(p) {
      // Vástago: barra de hierro. Se ve en una caja de 4 px de ancho: si va
      // a lo largo de la imagen, en las columnas 6..9; si va a lo ancho, en
      // las filas 6..9. Las dos bandas llevan el brillo a lo largo y el cruce
      // del medio queda como un anillo (también es la punta de la barra).
      const metal = [150, 150, 158];
      p.noiseFill(tone(metal, 0.8), 3);
      const across = [1.32, 1.12, 0.9, 0.66]; // de un canto al otro de la barra
      for (let i = 0; i < S; i++) {
        for (let k = 0; k < 4; k++) {
          p.set(6 + k, i, p.vary(tone(metal, across[k]), 3));
          p.set(i, 6 + k, p.vary(tone(metal, across[k]), 3));
        }
      }
      // Anillo del medio: canto claro y sombra en las dos direcciones.
      for (let k = 0; k < 4; k++) {
        p.set(6 + k, 6, p.vary(tone(metal, 1.4), 2));
        p.set(6, 6 + k, p.vary(tone(metal, 1.4), 2));
        p.set(6 + k, 9, p.vary(tone(metal, 0.6), 2));
        p.set(9, 6 + k, p.vary(tone(metal, 0.6), 2));
      }
      p.set(7, 7, lift(metal, 80));
      // Rayas finas del torneado a lo largo, apenas marcadas.
      for (let i = 0; i < S; i += 3) {
        if (i >= 6 && i <= 9) continue;
        p.shade(7, i, 1.06);
        p.shade(i, 7, 1.06);
      }
    },
  };

  // Compuertas, dibujadas apuntando hacia arriba de la imagen (salida
  // arriba, entrada abajo).
  const GATE_MASKS = {
    // Inversor: cable de entrada, flecha llena y un aro en la punta (el "no").
    inverter: (() => {
      const m = wireMask(11, 15);
      const half = [1, 2, 2, 3, 4, 5]; // media flecha por fila, de la punta a la base
      half.forEach((h, i) => {
        for (let x = 8 - h; x <= 7 + h; x++) m.push([x, 5 + i]);
      });
      m.push([7, 1], [8, 1], [6, 2], [9, 2], [6, 3], [9, 3], [7, 4], [8, 4]);
      m.push([7, 0], [8, 0]);
      return m;
    })(),
    // Retardador: cable de punta a punta, una flecha abierta arriba y dos
    // rayitas de "espera" atravesadas en el medio.
    repeater: (() => {
      const m = wireMask(0, 15);
      for (let k = 1; k <= 4; k++) {
        for (const y of [1 + k, 2 + k]) m.push([7 - k, y], [8 + k, y]);
      }
      for (const y of [9, 12]) for (let x = 4; x <= 11; x++) if (x !== 7 && x !== 8) m.push([x, y]);
      return m;
    })(),
  };
  // La flecha de arriba apunta hacia la salida (ver t.rotateTile).
  for (const g of ['inverter', 'repeater']) {
    for (let f = 0; f < 4; f++) {
      for (const on of [false, true]) {
        out[`${g}_${f}_${on ? 'on' : 'off'}`] = (p) => {
          paintGate(p, GATE_MASKS[g], on);
          t.rotateTile(p, [2, 3, 0, 1][f]);
        };
      }
    }
  }
  return out;
}
