// Texturas de construcción (etapa 12): hormigón, baldosas, metales, chapa, vidrios de colores, rejas, escalera de mano y trampilla.
//
// Cada pintor recibe un TilePainter (ver textures.js) y dibuja una textura de
// 16x16; `t` son las herramientas y la paleta compartidas de textures.js.

/** @param {object} t herramientas de textures.js (ver TOOLS) */
export default function painters(t) {
  const { S, C, TRANSPARENT, wrap, tone, lift, mix, tileNoise } = t;
  const WHITE = [255, 255, 255];

  /** Le baja la saturación a un color (k = 0 lo deja igual, 1 lo vuelve gris). */
  const mute = (c, k) => {
    const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    return mix(c, [g, g, g], k);
  };

  /**
   * Bloque de metal refinado: chapa con ruido suave, bisel de 2 px (luz
   * arriba/izquierda, sombra abajo/derecha) y una ranura que separa el canto
   * del panel del medio. Devuelve el color base para que cada bloque agregue
   * lo suyo encima.
   */
  function paintMetalPlate(p, base, grain = 4) {
    const cloud = tileNoise(p, 4);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let f = 1 + cloud(x + 0.5, y + 0.5) * 0.03;
        if (x === 0 || y === 0) f *= 1.2;
        else if (x === S - 1 || y === S - 1) f *= 0.7;
        else if (x === 1 || y === 1) f *= 1.08;
        else if (x === S - 2 || y === S - 2) f *= 0.84;
        else if (x === 2 || y === 2) f *= 0.8; // ranura entre canto y panel
        else if (x === S - 3 || y === S - 3) f *= 1.06;
        p.set(x, y, p.vary(tone(base, f), grain));
      }
    }
  }

  /** Remache de 2x2: brillo arriba a la izquierda y sombra abajo a la derecha. */
  function rivet(p, x, y, base) {
    p.set(x, y, lift(base, 56));
    p.set(x + 1, y, tone(base, 1.04));
    p.set(x, y + 1, tone(base, 0.92));
    p.set(x + 1, y + 1, tone(base, 0.62));
  }

  /** Vidrio de color: marco opaco del mismo tono, vidrio teñido traslúcido y dos brillos. */
  function paintTintedGlass(p, color) {
    const rim = mix(color, [214, 224, 228], 0.4);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (x === 0 || y === 0) p.set(x, y, p.vary(tone(rim, 1.1), 3));
        else if (x === S - 1 || y === S - 1) p.set(x, y, p.vary(tone(rim, 0.8), 3));
        else {
          // El vidrio es un poco más denso junto al marco.
          const inner = x === 1 || y === 1 || x === S - 2 || y === S - 2;
          p.set(x, y, [...p.vary(color, 3).slice(0, 3), inner ? 150 : 122]);
        }
      }
    }
    const glint = [...mix(color, WHITE, 0.72), 210];
    for (let k = 0; k < 4; k++) p.set(3 + k, 6 - k, glint);
    p.set(10, 11, glint);
    p.set(11, 10, glint);
  }

  /** Chapa acanalada galvanizada: ondas verticales cada 4 px. */
  function paintCorrugated(p) {
    const base = [160, 166, 170];
    // Perfil de la onda: luz en la cara que mira a la izquierda, sombra en la otra.
    const wave = [1.16, 1.04, 0.84, 0.92];
    const cloud = tileNoise(p, 4);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const f = wave[x % 4] * (1 + cloud(x + 0.5, y + 0.5) * 0.04);
        p.set(x, y, p.vary(tone(base, f), 3));
      }
    }
    // Flores del galvanizado: manchitas apenas más claras u oscuras.
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(p.rnd() * S);
      const y = Math.floor(p.rnd() * S);
      p.shade(x, y, p.rnd() < 0.5 ? 0.94 : 1.05);
      p.shade(x, wrap(y + 1), p.rnd() < 0.5 ? 0.96 : 1.03);
    }
  }

  return {
    concrete(p) {
      // Gris parejo con manchas muy suaves, poros y las marcas del encofrado:
      // dos juntas de tabla apenas marcadas y los agujeros de los pasadores.
      const cloud = tileNoise(p, 4);
      const base = [152, 152, 148];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          p.set(x, y, p.vary(tone(base, 1 + cloud(x + 0.5, y + 0.5) * 0.035), 3));
        }
      }
      for (let x = 0; x < S; x++) {
        // Junta de tabla: una fila un poco más oscura con su rebaba clara abajo.
        if (p.rnd() < 0.85) p.shade(x, 7, 0.94);
        if (p.rnd() < 0.6) p.shade(x, 8, 1.03);
        if (p.rnd() < 0.7) p.shade(x, 15, 0.95);
      }
      // Agujeros de los pasadores del encofrado.
      for (const [x, y] of [[3, 3], [11, 11]]) {
        p.set(x, y, p.vary([112, 112, 110], 2));
        p.shade(x + 1, y, 0.9);
        p.shade(x, y + 1, 0.9);
        p.shade(x - 1, y, 1.04);
        p.shade(x, y - 1, 1.04);
      }
      // Poros: píxeles sueltos más oscuros.
      for (let i = 0; i < 9; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        p.shade(x, y, 0.8 + p.rnd() * 0.08);
      }
      p.speckle([164, 164, 160], 0.05, 2);
    },

    calcareo(p) {
      // Baldosa calcárea de patio: dibujo con simetría de 8 (espejo en los dos
      // ejes y en las diagonales). En las esquinas hay un cuarto de flor:
      // cuatro baldosas juntas arman una flor entera en el cruce de las juntas.
      const cream = [222, 208, 174];
      const bordo = [140, 58, 52];
      const black = [76, 68, 66]; // negro gastado: de lejos no salta tanto
      const c = (S - 1) / 2;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const u = Math.abs(x - c); // 0.5 .. 7.5
          const v = Math.abs(y - c);
          const a = Math.max(u, v);
          const b = Math.min(u, v);
          const cu = c + 0.5 - u; // distancia a la esquina (0.5 en el borde)
          const cv = c + 0.5 - v;
          const dc = Math.hypot(cu, cv); // desde el cruce de juntas
          let col = cream;
          if (u + v <= 1) col = cream; // corazón de la flor del medio
          else if (u + v <= 4) col = bordo; // flor central (rombo)
          else if (b < 1 && a <= 5) col = black; // pétalos en cruz
          else if (u === v && a <= 5.5) col = black; // tallitos en diagonal
          if (dc <= 1.6) col = cream; // centro de la flor de las esquinas
          else if (dc <= 3.2) col = bordo; // flor de las esquinas
          else if (dc <= 4.2 && Math.min(cu, cv) >= 1 && Math.abs(cu - cv) <= 1) col = black;
          // Guarda: media línea fina en el borde que, con la vecina, hace un filete.
          if (a === 7.5 && b <= 3.5 && b > 1.5) col = black;
          p.set(x, y, p.vary(col, 3));
        }
      }
      // Desgaste: granitos más claros y la junta apenas marcada abajo/derecha.
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) if (p.rnd() < 0.06) p.shade(x, y, 1.06);
      }
      for (let i = 0; i < S; i++) {
        p.shade(i, S - 1, 0.92);
        p.shade(S - 1, i, 0.92);
      }
    },

    mosaic(p) {
      // Venecitas de 3x3 con junta clara de 1 px, en celestes y turquesas.
      const blues = [
        [92, 168, 186],
        [70, 150, 172],
        [118, 186, 200],
        [56, 132, 156],
        [84, 174, 170],
        [138, 198, 206],
        [64, 156, 158],
      ];
      const joint = [208, 214, 208];
      for (let cy = 0; cy < 4; cy++) {
        for (let cx = 0; cx < 4; cx++) {
          const col = blues[Math.floor(p.rnd() * blues.length)];
          for (let v = 0; v < 4; v++) {
            for (let u = 0; u < 4; u++) {
              const x = cx * 4 + u;
              const y = cy * 4 + v;
              if (u === 3 || v === 3) {
                p.set(x, y, p.vary(joint, 3));
                continue;
              }
              let f = 1;
              if (u === 0 && v === 0) f = 1.14; // brillo del vidrio
              else if (u === 2 && v === 2) f = 0.86;
              else if (u === 2 || v === 2) f = 0.94;
              p.set(x, y, p.vary(tone(col, f), 4));
            }
          }
        }
      }
    },

    metal_block(p) {
      // Hierro: chapa gris con remaches en las esquinas y vetas del cepillado.
      const base = [164, 166, 170];
      paintMetalPlate(p, base, 3);
      for (let y = 3; y < S - 3; y++) {
        const f = y % 3 === 0 ? 0.95 : y % 3 === 1 ? 1.03 : 1;
        for (let x = 3; x < S - 3; x++) p.shade(x, y, f);
      }
      for (const [x, y] of [[3, 3], [11, 3], [3, 11], [11, 11]]) rivet(p, x, y, base);
    },

    copper_block(p) {
      // Cobrizo: el panel del medio armado con cuatro planchitas (costura en
      // cruz, hundida) y un reflejo pulido en la esquina de cada una.
      const base = mute(tone(C.copper, 0.86), 0.2);
      paintMetalPlate(p, base, 4);
      for (let i = 3; i < S - 3; i++) {
        for (const [x, y] of [[i, 7], [7, i]]) p.set(x, y, p.vary(tone(base, 0.7), 2));
        for (const [x, y] of [[i, 8], [8, i]]) if (x !== 7 && y !== 7) p.set(x, y, p.vary(tone(base, 1.12), 2));
      }
      for (const x0 of [3, 9]) {
        for (const y0 of [3, 9]) {
          // Reflejo en diagonal y sombra en la esquina opuesta de la planchita.
          p.shade(x0 + 1, y0 + 2, 1.12);
          p.shade(x0 + 2, y0 + 1, 1.12);
          p.shade(x0 + 1, y0 + 1, 1.18);
          p.shade(x0 + 3, y0 + 3, 0.9);
        }
      }
    },

    azurite_block(p) {
      // Azurita: el panel del medio tallado en facetas, como una gema grande:
      // cada triángulo hacia el centro con su propia luz.
      const base = mute(tone(C.azurite, 0.82), 0.3);
      paintMetalPlate(p, base, 4);
      const c = (S - 1) / 2;
      for (let y = 3; y < S - 3; y++) {
        for (let x = 3; x < S - 3; x++) {
          const dx = x - c;
          const dy = y - c;
          let f;
          if (Math.abs(dx) + Math.abs(dy) <= 2) f = 1.26; // tabla de la gema
          else if (Math.abs(dy) >= Math.abs(dx)) f = dy < 0 ? 1.14 : 0.8;
          else f = dx < 0 ? 1.04 : 0.88;
          if (Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.6 && Math.abs(dx) > 1) f *= 0.9; // aristas
          p.shade(x, y, f);
        }
      }
      p.set(7, 6, mix(base, WHITE, 0.55));
      p.set(6, 7, mix(base, WHITE, 0.35));
    },

    solarite_block(p) {
      // Solarita: lingote pulido con franjas diagonales de brillo.
      const base = mute(tone(C.solarite, 0.86), 0.25);
      paintMetalPlate(p, base, 3);
      for (let y = 3; y < S - 3; y++) {
        for (let x = 3; x < S - 3; x++) {
          const d = (x + y) % 10;
          if (d === 2 || d === 3) p.shade(x, y, 1.14);
          else if (d === 4) p.shade(x, y, 1.05);
          else if (d === 8) p.shade(x, y, 0.92);
        }
      }
      // Sello en relieve al medio: un rombito con luz y sombra.
      for (const [x, y, f] of [
        [7, 6, 1.2], [6, 7, 1.2], [8, 7, 0.82], [7, 8, 0.82], [7, 7, 1.08],
      ]) p.set(x, y, tone(base, f));
    },

    sheet_metal(p) {
      paintCorrugated(p);
    },

    sheet_rusty(p) {
      // La misma chapa con manchas de óxido que chorrean hacia abajo.
      paintCorrugated(p);
      const big = tileNoise(p, 4);
      const small = tileNoise(p, 8);
      const rust = [150, 88, 54];
      const deep = [108, 64, 42];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const n = big(x + 0.5, y + 0.5) * 0.7 + small(x + 0.5, y + 0.5) * 0.45;
          if (n < 0.2) continue;
          const [r, g, b] = p.get(x, y);
          const lum = (r + g + b) / 3 / 166; // conserva el relieve de la onda
          const col = n > 0.5 ? deep : rust;
          p.set(x, y, p.vary(tone(mix(col, [r, g, b], n > 0.32 ? 0.12 : 0.45), lum), 4));
        }
      }
      // Chorreaduras: hilos de óxido que bajan por el fondo de las ondas.
      for (let i = 0; i < 4; i++) {
        const x = 2 + 4 * Math.floor(p.rnd() * 4);
        const y0 = Math.floor(p.rnd() * S);
        const len = 3 + Math.floor(p.rnd() * 4);
        for (let k = 0; k < len; k++) {
          const [r, g, b] = p.get(x, wrap(y0 + k));
          p.set(x, wrap(y0 + k), mix([r, g, b], tone(rust, 0.86), 0.6 - k * 0.06));
        }
      }
    },

    glass_red(p) {
      paintTintedGlass(p, [176, 58, 54]);
    },
    glass_yellow(p) {
      paintTintedGlass(p, [222, 184, 64]);
    },
    glass_green(p) {
      paintTintedGlass(p, [86, 154, 76]);
    },
    glass_lightblue(p) {
      paintTintedGlass(p, [116, 178, 214]);
    },
    glass_blue(p) {
      paintTintedGlass(p, [56, 84, 170]);
    },
    glass_purple(p) {
      paintTintedGlass(p, [124, 76, 162]);
    },

    iron_bars(p) {
      // Tres barrotes verticales de 2 px (luz a la izquierda) y dos
      // planchuelas que atraviesan todo el ancho para unirse con las vecinas.
      const iron = [74, 72, 78];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, TRANSPARENT);
      const flats = [2, 12]; // fila de arriba de cada planchuela (2 px de alto)
      for (const bx of [2, 7, 12]) {
        for (let y = 0; y < S; y++) {
          p.set(bx, y, p.vary(tone(iron, 1.5), 4));
          p.set(bx + 1, y, p.vary(tone(iron, 0.92), 3));
        }
        // Brillo cortito sobre el barrote.
        p.set(bx, 6 + (bx % 3), tone(iron, 2));
      }
      for (const fy of flats) {
        for (let x = 0; x < S; x++) {
          p.set(x, fy, p.vary(tone(iron, 1.3), 3));
          p.set(x, fy + 1, p.vary(tone(iron, 0.78), 3));
        }
        // Remache donde cada barrote cruza la planchuela.
        for (const bx of [2, 7, 12]) {
          p.set(bx, fy, tone(iron, 1.9));
          p.set(bx + 1, fy + 1, tone(iron, 0.62));
        }
      }
    },

    ladder(p) {
      // Dos largueros de madera y un travesaño cada 4 filas; el resto queda
      // transparente.
      const wood = [158, 114, 68];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, TRANSPARENT);
      for (let y = 0; y < S; y++) {
        for (const [x, f] of [[1, 1.12], [2, 0.82], [13, 1.12], [14, 0.82]]) p.set(x, y, p.vary(tone(wood, f), 4));
      }
      // Veta de los largueros.
      for (const x of [1, 2, 13, 14]) {
        const y0 = Math.floor(p.rnd() * S);
        for (let k = 0; k < 4; k++) p.shade(x, wrap(y0 + k), 0.9);
      }
      for (let r = 0; r < 4; r++) {
        const y = r * 4 + 2;
        for (let x = 3; x <= 12; x++) {
          let f = 1;
          if (x === 3) f = 0.8; // donde entra en el larguero
          else if ((x + r) % 4 === 0) f = 0.92; // veta
          p.set(x, y, p.vary(tone(wood, f), 4));
        }
        // Clavos y sombra del travesaño sobre los largueros.
        p.set(1, y, [124, 118, 112]);
        p.set(14, y, [96, 90, 86]);
        p.shade(13, y + 1, 0.84);
        p.shade(2, y + 1, 0.9);
      }
    },

    trapdoor(p) {
      // Tapa de tablas verticales con marco de 2 px y dos ventanitas
      // cuadradas en la mitad de arriba (transparentes).
      const base = C.doorWood;
      const tints = [4, -4, 2];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          let c;
          if (x < 2 || y < 2 || x > S - 3 || y > S - 3) {
            // Marco con bisel: claro arriba/izquierda, oscuro abajo/derecha.
            let f = 0.88;
            if (x === 0 || y === 0) f = 1.08;
            else if (x === S - 1 || y === S - 1) f = 0.66;
            else if (x === S - 2 || y === S - 2) f = 0.78;
            c = p.vary(tone(base, f), 3);
          } else if (x === 5 || x === 10) {
            c = p.vary(tone(base, 0.66), 3); // junta entre tablas
          } else {
            c = p.vary(lift(base, tints[x < 5 ? 0 : x < 10 ? 1 : 2]), 5);
            if (x === 2 || y === 2) c = tone(c, 0.84); // sombra del marco
          }
          p.set(x, y, c);
        }
      }
      // Veta vertical en las tablas.
      for (let i = 0; i < 6; i++) {
        const x = [3, 4, 7, 8, 11, 12][Math.floor(p.rnd() * 6)];
        const y0 = 9 + Math.floor(p.rnd() * 2);
        for (let k = 0; k < 3; k++) p.shade(x, y0 + k, 0.88);
      }
      // Ventanitas de 4x4 con moldura hundida (sombra arriba/izquierda).
      for (const x0 of [2, 8]) {
        for (let y = 2; y <= 7; y++) {
          for (let x = x0; x <= x0 + 5; x++) {
            if (y === 2 || x === x0) p.set(x, y, p.vary(tone(base, 0.64), 3));
            else if (y === 7 || x === x0 + 5) p.set(x, y, p.vary(tone(base, 1.16), 3));
          }
        }
        t.paintPane(p, x0 + 1, 3, x0 + 4, 6, [[x0 + 1, 4], [x0 + 2, 3]]);
      }
    },
  };
}
