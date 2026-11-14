// Texturas de naturaleza (etapa 12): piedras, suelos, nieve, hielo y cactus.
//
// Cada pintor recibe un TilePainter (ver textures.js) y dibuja una textura de
// 16x16; `t` son las herramientas y la paleta compartidas de textures.js.

/** @param {object} t herramientas de textures.js (ver TOOLS) */
export default function painters(t) {
  const { S, wrap, tone, lift, mix, tileNoise } = t;
  const TAU = Math.PI * 2;

  /** Diferencia más corta sobre el toro de 16 px (para no dejar costuras). */
  const torusDelta = (d) => d - Math.round(d / S) * S;

  /**
   * Celdas de Voronoi sobre un toro: tira centros al azar sin dejarlos más
   * cerca que `minDist` y devuelve, para cada píxel, la celda más cercana, las
   * dos distancias (a la primera y a la segunda) y el desvío respecto del
   * centro. Con eso cada pintor decide dónde va la junta y cómo sombrear.
   */
  function torusCells(p, count, minDist) {
    const seeds = [];
    for (let tries = 0; tries < 600 && seeds.length < count; tries++) {
      const x = p.rnd() * S;
      const y = p.rnd() * S;
      if (seeds.every((s) => Math.hypot(torusDelta(x - s.x), torusDelta(y - s.y)) >= minDist)) {
        seeds.push({ x, y });
      }
    }
    const px = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let d1 = Infinity;
        let d2 = Infinity;
        let k = 0;
        let dx1 = 0;
        let dy1 = 0;
        seeds.forEach((s, i) => {
          const dx = torusDelta(x + 0.5 - s.x);
          const dy = torusDelta(y + 0.5 - s.y);
          const d = Math.hypot(dx, dy);
          if (d < d1) {
            d2 = d1;
            d1 = d;
            k = i;
            dx1 = dx;
            dy1 = dy;
          } else if (d < d2) d2 = d;
        });
        px.push({ k, d1, d2, dx: dx1, dy: dy1 });
      }
    }
    return { seeds, at: (x, y) => px[wrap(y) * S + wrap(x)] };
  }

  /** Brillo aproximado de un color (para reconocer juntas ya pintadas). */
  const luma = ([r, g, b]) => r * 0.3 + g * 0.59 + b * 0.11;

  return {
    // Grava: piedritas redondeadas y apretadas, grises con alguna marrón,
    // cada una con luz arriba a la izquierda y sombrita abajo a la derecha.
    gravel(p) {
      const colors = [
        [138, 136, 134],
        [118, 117, 118],
        [152, 148, 142],
        [104, 104, 108],
        [128, 124, 120],
        [140, 120, 98], // marrón
        [118, 100, 82], // marrón oscuro
      ];
      const { seeds, at } = torusCells(p, 22, 2.9);
      for (const s of seeds) {
        // Las marrones salen menos seguido que las grises.
        const r = p.rnd();
        s.col = r < 0.16 ? colors[5] : r < 0.24 ? colors[6] : colors[Math.floor(p.rnd() * 5)];
        s.r = 1.9 + p.rnd() * 0.6;
      }
      const gap = [84, 80, 76];
      const isGap = (c) => c.d1 / c.d2 > 0.78 || c.d1 > seeds[c.k].r + 0.6;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const c = at(x, y);
          if (isGap(c)) {
            // Hueco entre piedritas: más oscuro si queda a la sombra de una.
            const up = at(x, y - 1);
            const left = at(x - 1, y);
            const f = !isGap(up) || !isGap(left) ? 0.82 : 1;
            p.set(x, y, p.vary(tone(gap, f), 4));
            continue;
          }
          // Redondeo: más claro hacia arriba-izquierda del centro.
          let f = 1 - (c.dx + c.dy) * 0.06;
          if (c.dx + c.dy < -1.6) f *= 1.06;
          else if (c.dx + c.dy > 1.2) f *= 0.86;
          p.set(x, y, p.vary(tone(seeds[c.k].col, f), 4));
        }
      }
    },

    // Arcilla: gris azulado liso, vetas horizontales suaves y algún poro.
    clay(p) {
      const base = [152, 158, 172];
      const warp = tileNoise(p, 4);
      const cloud = tileNoise(p, 2);
      const phase = p.rnd() * TAU;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          // Capas: una onda en y que se tuerce apenas con el ruido.
          const band = Math.sin((TAU * 2 * (y + 0.5 + warp(x + 0.5, y + 0.5) * 1.2)) / S + phase);
          const k = band * 7 + cloud(x + 0.5, y + 0.5) * 5;
          p.set(x, y, p.vary(lift(base, k), 2));
        }
      }
      // Vetas: trazos horizontales cortos, apenas más claros u oscuros.
      for (let i = 0; i < 6; i++) {
        const x0 = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        const len = 4 + Math.floor(p.rnd() * 6);
        const f = i % 2 ? 0.95 : 1.04;
        for (let k = 0; k < len; k++) p.shade(wrap(x0 + k), y, f);
      }
      // Poros: un píxel hundido con su borde de luz abajo.
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        p.shade(x, y, 0.8);
        p.shade(x, wrap(y + 1), 1.06);
      }
    },

    // Nieve: blanco azulado muy suave, con sombras leves y brillos sueltos.
    snow(p) {
      const base = [238, 242, 250];
      const shadow = [214, 224, 240];
      const cloud = tileNoise(p, 4);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const t = Math.max(0, cloud(x + 0.5, y + 0.5)) * 0.55;
          p.set(x, y, p.vary(mix(base, shadow, t), 2));
        }
      }
      p.speckle([224, 232, 246], 0.07, 2);
      // Brillos: algún píxel blanco puro, con su sombrita al lado.
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        p.set(x, y, [255, 255, 255]);
        p.shade(wrap(x + 1), wrap(y + 1), 0.96);
      }
    },

    // Hielo: celeste claro con nubes más profundas, grietas blancas finas en
    // diagonal y algunos brillos.
    ice(p) {
      const light = [176, 214, 242];
      const deep = [138, 182, 226];
      const cloud = tileNoise(p, 4);
      const cloud2 = tileNoise(p, 2);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const v = cloud(x + 0.5, y + 0.5) * 0.6 + cloud2(x + 0.5, y + 0.5) * 0.4;
          p.set(x, y, p.vary(mix(light, deep, Math.min(1, Math.max(0, 0.45 + v * 0.7))), 2));
        }
      }
      // Grietas: suben en diagonal (x+1, y-1) con algún quiebre, y dejan una
      // línea más oscura abajo a la derecha que les da profundidad.
      // Tonos suaves: de lejos las grietas no tienen que verse como rayas.
      const crack = [212, 232, 248];
      for (let i = 0; i < 2; i++) {
        let x = Math.floor(p.rnd() * S);
        let y = Math.floor(p.rnd() * S);
        const len = 10 + Math.floor(p.rnd() * 5);
        for (let k = 0; k < len; k++) {
          p.set(wrap(x), wrap(y), p.vary(crack, 3));
          p.shade(wrap(x + 1), wrap(y + 1), 0.95);
          const r = p.rnd();
          if (r < 0.8) {
            x++;
            y--;
          } else if (r < 0.9) x++;
          else y--;
        }
      }
      // Brillos: un par de trazos cortos en diagonal y algún punto suelto.
      for (let i = 0; i < 2; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        p.set(x, y, lift(light, 34));
        p.set(wrap(x + 1), wrap(y - 1), lift(light, 20));
      }
      for (let i = 0; i < 3; i++) p.set(Math.floor(p.rnd() * S), Math.floor(p.rnd() * S), lift(light, 16));
    },

    // Empedrado con musgo: el empedrado de siempre, con musgo que crece en las
    // juntas y se trepa un poco a las piedras, en manchones.
    mossy_cobble(p) {
      t.PAINTERS.cobble(p);
      const joint = new Uint8Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) joint[y * S + x] = luma(p.get(x, y)) < 88 ? 1 : 0;
      const isJoint = (x, y) => joint[wrap(y) * S + wrap(x)] === 1;
      // Distancia (0, 1 o 2) a la junta más cercana.
      const near = (x, y) => {
        if (isJoint(x, y)) return 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isJoint(x + dx, y + dy)) return 1;
        for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [0, 2], [-2, 0], [0, -2]]) {
          if (isJoint(x + dx, y + dy)) return 2;
        }
        return 3;
      };
      const patch = tileNoise(p, 4);
      const mossDark = [62, 92, 46];
      const moss = [86, 120, 58];
      const mossLight = [112, 146, 72];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const d = near(x, y);
          const n = patch(x + 0.5, y + 0.5);
          // Más musgo en las juntas y donde el manchón es fuerte.
          const chance = 0.55 + n * 0.8 - d * 0.28;
          if (p.rnd() >= chance) continue;
          let col = d === 0 ? mossDark : moss;
          if (d > 0 && p.rnd() < 0.3) col = mossLight;
          // Luz arriba-izquierda: el musgo pegado a una junta de abajo/derecha
          // queda más oscuro.
          let f = 1;
          if (d > 0 && (isJoint(x + 1, y) || isJoint(x, y + 1))) f = 0.86;
          p.set(x, y, p.vary(tone(col, f), 5));
        }
      }
    },

    // Granito: rosado-marrón con motas negras, grises y blancas.
    granite(p) {
      const base = [178, 132, 114];
      const cloud = tileNoise(p, 4);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) p.set(x, y, p.vary(lift(base, cloud(x + 0.5, y + 0.5) * 8), 5));
      }
      p.speckle([160, 112, 98], 0.16, 4);
      p.speckle([196, 152, 132], 0.1, 4);
      // Motas: algunas de 2 px (cristales más grandes).
      const motes = [
        [[104, 88, 84], 6],
        [[138, 126, 122], 7],
        [[210, 194, 182], 5],
      ];
      for (const [col, count] of motes) {
        for (let i = 0; i < count; i++) {
          const x = Math.floor(p.rnd() * S);
          const y = Math.floor(p.rnd() * S);
          p.set(x, y, p.vary(col, 6));
          if (p.rnd() < 0.35) p.set(wrap(x + (p.rnd() < 0.5 ? 1 : 0)), wrap(y + 1), p.vary(col, 6));
        }
      }
    },

    // Basalto (costado): columnas verticales gris casi negro, separadas por
    // juntas finas, con un brillo leve en cada una y alguna fisura horizontal.
    basalt_side(p) {
      const base = [62, 62, 68];
      const joint = [34, 34, 39];
      const widths = [4, 3, 5, 4];
      let x0 = 0;
      for (const w of widths) {
        const tint = (p.rnd() * 2 - 1) * 4;
        const shine = x0 + 1 + Math.floor(p.rnd() * (w - 2));
        for (let x = x0; x < x0 + w; x++) {
          for (let y = 0; y < S; y++) {
            if (x === x0 + w - 1) {
              p.set(x, y, p.vary(joint, 2));
              continue;
            }
            let f = 1;
            if (x === x0) f = 1.12; // canto con luz
            else if (x === x0 + w - 2) f = 0.88; // canto en sombra
            if (x === shine && w > 3) f *= 1.1;
            p.set(x, y, p.vary(tone(lift(base, tint), f), 3));
          }
        }
        // Fisura horizontal en la columna: oscura, con luz en la fila de abajo.
        const fy = Math.floor(p.rnd() * S);
        for (let x = x0; x < x0 + w - 1; x++) {
          p.set(x, fy, p.vary(tone(joint, 1.1), 2));
          p.shade(x, wrap(fy + 1), 1.1);
        }
        x0 += w;
      }
    },

    // Basalto (arriba): las caras de las columnas vistas de arriba, polígonos
    // irregulares casi hexagonales con juntas oscuras.
    basalt_top(p) {
      const base = [70, 70, 76];
      const joint = [32, 32, 37];
      const { seeds, at } = torusCells(p, 9, 5);
      for (const s of seeds) s.tint = (p.rnd() * 2 - 1) * 6;
      const isJoint = (c) => c.d1 / c.d2 > 0.84;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const c = at(x, y);
          if (isJoint(c)) {
            p.set(x, y, p.vary(joint, 2));
            continue;
          }
          // Bisel: luz si la junta está arriba/izquierda, sombra abajo/derecha.
          let f = 1 - (c.dx + c.dy) * 0.012;
          if (isJoint(at(x - 1, y)) || isJoint(at(x, y - 1))) f *= 1.16;
          else if (isJoint(at(x + 1, y)) || isJoint(at(x, y + 1))) f *= 0.84;
          p.set(x, y, p.vary(tone(lift(base, seeds[c.k].tint), f), 3));
        }
      }
    },

    // Cactus (costado): costillas verticales claras y oscuras, espinitas de
    // 1 px y un borde más oscuro a los costados (la caja es más angosta).
    cactus_side(p) {
      const base = [74, 134, 64];
      // Perfil por columna: 0 borde, ranuras en 4, 8 y 12; cada costilla con
      // luz a la izquierda y sombra a la derecha.
      const profile = [0.68, 1.12, 1.02, 0.86, 0.7, 1.14, 1.04, 0.88, 0.7, 1.14, 1.02, 0.88, 0.7, 1.12, 0.96, 0.68];
      for (let x = 0; x < S; x++) {
        for (let y = 0; y < S; y++) p.set(x, y, p.vary(tone(base, profile[x]), 4));
      }
      // Algunas manchitas más claras a lo largo de las costillas.
      for (let i = 0; i < 6; i++) {
        const x = [1, 5, 9, 13][Math.floor(p.rnd() * 4)];
        const y = Math.floor(p.rnd() * S);
        for (let k = 0; k < 2; k++) p.shade(x + 1, wrap(y + k), 1.06);
      }
      // Espinitas: sobre cada costilla, desfasadas entre costillas vecinas.
      const spine = [206, 204, 158];
      [1, 5, 9, 13].forEach((x, i) => {
        for (let y = (i % 2) * 3 + Math.floor(p.rnd() * 2); y < S; y += 5 + (y % 2)) {
          p.set(x + 1, y, spine);
          p.shade(x + 2, y + 1, 0.88); // sombrita de la espina
        }
      });
    },

    // Cactus (arriba): costillas vistas desde arriba como estrella, con el
    // centro más claro y un borde más oscuro.
    cactus_top(p) {
      const base = [78, 138, 66];
      const center = [140, 182, 98];
      const c = (S - 1) / 2;
      const ribs = 8;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x - c;
          const dy = y - c;
          const r = Math.hypot(dx, dy);
          const a = Math.atan2(dy, dx);
          // Costilla: cresta clara, ranura oscura entre costillas.
          const rib = Math.cos(a * ribs);
          let f = 1 + rib * 0.2 * Math.min(1, r / 3);
          if (rib < -0.75 && r > 2.5) f *= 0.84; // ranura
          // Luz arriba-izquierda sobre la copa.
          f *= 1 - (dx + dy) * 0.008;
          let col = tone(base, f);
          if (r < 3.2) col = mix(col, center, 1 - r / 3.2);
          if (x === 0 || y === 0 || x === S - 1 || y === S - 1) col = tone(col, 0.74);
          p.set(x, y, p.vary(col, 3));
        }
      }
      // Espinitas en la punta de cada costilla, cerca del borde.
      for (let i = 0; i < ribs; i++) {
        const a = (i / ribs) * TAU;
        const r = i % 2 ? 5.2 : 6.2;
        p.set(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), [206, 204, 158]);
      }
    },
  };
}
