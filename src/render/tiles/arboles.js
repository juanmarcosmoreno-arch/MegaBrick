// Texturas de árboles y plantas (etapa 12): pino, jacarandá, pasto alto, helecho, flores y hongo.
//
// Cada pintor recibe un TilePainter (ver textures.js) y dibuja una textura de
// 16x16; `t` son las herramientas y la paleta compartidas de textures.js.
//
// Las plantas se ven como dos planos cruzados en X con la textura entera: el
// fondo queda transparente y la planta se apoya en la fila de abajo (y = 15),
// centrada. Como esas capas descartan los píxeles con alfa < 0.5, todo se
// pinta con alfa 0 o 255.

/** @param {object} t herramientas de textures.js (ver TOOLS) */
export default function painters(t) {
  const { S, TRANSPARENT, wrap, tone, lift, mix } = t;

  /** Deja toda la textura transparente (fondo de las plantas). */
  const clear = (p) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.set(x, y, TRANSPARENT);
  };

  /** Distancia en un toro de 16x16 (para manchas que cruzan el borde sin costura). */
  const torus = (d) => d - Math.round(d / S) * S;

  /**
   * Corte de un tronco: anillos de crecimiento alrededor del centro (un poco
   * cuadrados, como el corte de 'log_top'), médula oscura y borde de corteza.
   */
  const paintLogTop = (p, { bark, wood, ring, heart, pith, step }) => {
    const c = (S - 1) / 2;
    const warp = t.tileNoise(p, 4);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (x === 0 || y === 0 || x === S - 1 || y === S - 1) {
          p.set(x, y, p.vary(bark, 7));
          continue;
        }
        const dx = Math.abs(x - c);
        const dy = Math.abs(y - c);
        const d = Math.max(dx, dy) * 0.6 + Math.hypot(dx, dy) * 0.42 + warp(x + 0.5, y + 0.5) * 0.45;
        let col = d < 3.2 ? mix(heart, wood, d / 3.2) : wood; // duramen más oscuro al medio
        if (d > 1.2 && (d + 0.4) % step < 0.95) col = ring;
        if (x === 1 || y === 1 || x === S - 2 || y === S - 2) col = tone(col, 0.9); // albura junto a la corteza
        p.set(x, y, p.vary(col, 5));
      }
    }
    // Médula: 2x2 al centro, con un píxel más claro.
    for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) p.set(x, y, p.vary(pith, 4));
    p.set(7, 7, lift(pith, 14));
  };

  /** Recorre una curva de Bézier cuadrática y devuelve sus píxeles en orden, sin repetir. */
  const bezierPixels = ([x0, y0], [x1, y1], [x2, y2]) => {
    const out = [];
    for (let i = 0; i <= 200; i++) {
      const u = i / 200;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      const x = Math.round(a * x0 + b * x1 + c * x2 - 0.5);
      const y = Math.round(a * y0 + b * y1 + c * y2 - 0.5);
      const last = out[out.length - 1];
      if (!last || last[0] !== x || last[1] !== y) {
        // Tangente (para las hojitas del helecho).
        const tx = 2 * (1 - u) * (x1 - x0) + 2 * u * (x2 - x1);
        const ty = 2 * (1 - u) * (y1 - y0) + 2 * u * (y2 - y1);
        const len = Math.hypot(tx, ty) || 1;
        out.push([x, y, tx / len, ty / len]);
      }
    }
    return out;
  };

  /** Florcita en cruz (3x3 sin esquinas) con el centro claro. */
  const floret = (p, x, y, { light, mid, dark, eye }) => {
    p.set(x, y - 1, p.vary(light, 4));
    p.set(x - 1, y, p.vary(light, 4));
    p.set(x + 1, y, p.vary(mid, 4));
    p.set(x, y + 1, p.vary(dark, 4));
    p.set(x, y, eye);
  };

  return {
    // --- Pino -----------------------------------------------------------------

    // Tronco de pino (costado): corteza marrón rojiza en placas verticales,
    // separadas por fisuras oscuras y cortadas por grietas horizontales.
    pine_log_side(p) {
      const bark = [104, 62, 44];
      const crack = [50, 28, 20];
      // Anchos de las placas (suman 16 para que repita sin costura).
      const widths = [];
      let sum = 0;
      while (sum < S) {
        let w = 3 + Math.floor(p.rnd() * 3);
        if (S - sum - w < 3) w = S - sum;
        widths.push(w);
        sum += w;
      }
      const cuts = [[0, 8], [0, 5, 10], [0, 7], [0, 9]];
      let x0 = Math.floor(p.rnd() * S);
      for (const w of widths) {
        const pattern = cuts[Math.floor(p.rnd() * cuts.length)];
        const off = Math.floor(p.rnd() * S);
        const breaks = pattern.map((b) => wrap(b + off));
        for (let y = 0; y < S; y++) {
          // Tramo de placa al que pertenece la fila (cada uno con su tono).
          let seg = 0;
          for (let k = 0; k < breaks.length; k++) if (wrap(y - off) >= pattern[k]) seg = k;
          const tint = ((seg * 7 + w * 3 + off) % 5) * 4 - 8;
          for (let i = 0; i < w; i++) {
            const x = wrap(x0 + i);
            let col = p.vary(lift(bark, tint), 6);
            if (i === 0) col = p.vary(crack, 5); // fisura entre placas
            else if (breaks.includes(y)) col = i === w - 1 ? tone(col, 0.8) : p.vary(lift(crack, 14), 5); // grieta horizontal, abierta de un lado
            else if (breaks.includes(wrap(y - 1))) col = tone(col, 1.14); // canto de arriba, iluminado
            else if (breaks.includes(wrap(y + 1))) col = tone(col, 0.86);
            else if (i === 1) col = tone(col, 1.1);
            else if (i === w - 1) col = tone(col, 0.88);
            p.set(x, y, col);
          }
        }
        x0 += w;
      }
      // Escamas sueltas más claras, rojizas.
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        if (p.get(x, y)[0] > 70) p.set(x, y, p.vary([138, 84, 58], 6));
      }
    },

    // Tronco de pino (corte): madera clara amarillenta con anillos y médula.
    pine_log_top(p) {
      paintLogTop(p, {
        bark: [92, 54, 38],
        wood: [214, 180, 122],
        ring: [182, 140, 88],
        heart: [196, 150, 96],
        pith: [140, 96, 58],
        step: 2.4,
      });
    },

    // Follaje de pino: verde azulado oscuro con agujas en trazos diagonales
    // cortos y algunos huecos transparentes.
    pine_leaves(p) {
      const base = [34, 76, 60];
      const needles = [
        [46, 98, 74],
        [58, 112, 84],
        [40, 88, 68],
        [74, 128, 96],
      ];
      p.noiseFill(base, 5);
      p.speckle([24, 58, 46], 0.2, 4);
      const covered = new Uint8Array(S * S);
      for (let i = 0; i < 30; i++) {
        const x0 = Math.floor(p.rnd() * S);
        const y0 = Math.floor(p.rnd() * S);
        const dir = p.rnd() < 0.5 ? 1 : -1;
        const len = 2 + Math.floor(p.rnd() * 2);
        const col = needles[Math.floor(p.rnd() * needles.length)];
        for (let k = 0; k < len; k++) {
          const x = wrap(x0 + k * dir);
          const y = wrap(y0 + k);
          // La punta de la aguja (abajo) un poco más clara.
          p.set(x, y, p.vary(k === len - 1 ? tone(col, 1.1) : col, 4));
          covered[y * S + x] = 1;
        }
      }
      // Huecos solo donde no hay agujas.
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) if (!covered[y * S + x] && p.rnd() < 0.2) p.set(x, y, TRANSPARENT);
      }
    },

    // Tablones de pino: madera clara amarillenta, con algún nudo.
    pine_planks(p) {
      t.paintBoards(p, [214, 182, 118], {
        joint: [150, 114, 64],
        seam: [168, 130, 76],
        tints: [0, 6, -5, 3],
        seams: [6, 14],
      });
      // Nudos: un par de píxeles más oscuros en dos tablas.
      for (const board of [0, 2]) {
        const x = Math.floor(p.rnd() * S);
        const y = board * 4 + 1 + Math.floor(p.rnd() * 2);
        p.set(x, y, p.vary([150, 104, 58], 3));
        p.shade(wrap(x + 1), y, 0.86);
      }
    },

    // --- Jacarandá ------------------------------------------------------------

    // Tronco de jacarandá (costado): corteza gris parduzca con fisuras
    // verticales que serpentean, unidas por grietas cortas.
    jacaranda_log_side(p) {
      const bark = [120, 108, 96];
      const fissure = [66, 58, 52];
      const TAU = Math.PI * 2;
      p.noiseFill(bark, 6);
      p.speckle([104, 94, 84], 0.18, 4);
      p.speckle([138, 126, 112], 0.08, 4);
      // Columna de cada fisura en cada fila (periódica en y: no deja costura).
      const lines = [];
      for (let i = 0; i < 4; i++) {
        const x0 = i * 4 + Math.floor(p.rnd() * 2);
        const k = p.rnd() < 0.5 ? 1 : 2;
        const phase = p.rnd() * TAU;
        const xs = [];
        for (let y = 0; y < S; y++) xs.push(wrap(x0 + Math.round(1.1 * Math.sin((TAU * k * y) / S + phase))));
        lines.push(xs);
      }
      for (const xs of lines) {
        for (let y = 0; y < S; y++) {
          const x = xs[y];
          p.set(x, y, p.vary(fissure, 4));
          // Si la fisura salta de columna, se une con la fila de arriba.
          const prev = xs[wrap(y - 1)];
          if (prev !== x) p.set(prev, y, p.vary(fissure, 4));
          p.shade(wrap(x + 1), y, 1.12); // canto iluminado
          p.shade(wrap(x - 1), y, 0.86);
        }
      }
      // Grietas cortas que cruzan entre fisuras vecinas.
      for (let i = 0; i < lines.length; i++) {
        const a = lines[i];
        const b = lines[(i + 1) % lines.length];
        for (let n = 0; n < 2; n++) {
          const y = Math.floor(p.rnd() * S);
          let x = wrap(a[y] + 1);
          for (let guard = 0; x !== b[y] && guard < 6; guard++) {
            p.set(x, y, p.vary(tone(fissure, 1.15), 4));
            p.shade(x, wrap(y + 1), 1.08);
            x = wrap(x + 1);
          }
        }
      }
      // Manchitas de liquen, muy tenues.
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        if (p.get(x, y)[0] > 90) p.set(x, y, p.vary([140, 142, 116], 5));
      }
    },

    // Tronco de jacarandá (corte): madera clara con anillos suaves.
    jacaranda_log_top(p) {
      paintLogTop(p, {
        bark: [104, 94, 84],
        wood: [218, 196, 160],
        ring: [190, 164, 128],
        heart: [190, 152, 120],
        pith: [150, 116, 88],
        step: 2.8,
      });
    },

    // Follaje de jacarandá en flor: racimos violeta-lila con sombra propia,
    // entre hojitas verdes finas y huecos transparentes.
    jacaranda_leaves(p) {
      const greens = [
        [70, 108, 56],
        [54, 88, 48],
        [92, 128, 66],
      ];
      const lilacs = [
        [142, 114, 190],
        [126, 100, 178],
        [154, 128, 200],
        [132, 108, 186],
      ];
      // Fondo: hojas verdes con huecos.
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const r = p.rnd();
          if (r < 0.3) p.set(x, y, TRANSPARENT);
          else p.set(x, y, p.vary(greens[r < 0.55 ? 1 : r < 0.85 ? 0 : 2], 6));
        }
      }
      // Centros de los racimos, repartidos sobre el toro sin quedar muy juntos.
      const clusters = [];
      for (let tries = 0; tries < 400 && clusters.length < 7; tries++) {
        const x = p.rnd() * S;
        const y = p.rnd() * S;
        if (clusters.every((c) => Math.hypot(torus(x - c.x), torus(y - c.y)) >= 5)) {
          clusters.push({ x, y, r: 2.3 + p.rnd() * 0.9, col: lilacs[Math.floor(p.rnd() * lilacs.length)] });
        }
      }
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          let best = null;
          let bd = Infinity;
          let bdx = 0;
          let bdy = 0;
          for (const c of clusters) {
            const dx = torus(x + 0.5 - c.x);
            const dy = torus(y + 0.5 - c.y);
            const d = Math.hypot(dx, dy) / c.r;
            if (d < bd) {
              bd = d;
              best = c;
              bdx = dx / c.r;
              bdy = dy / c.r;
            }
          }
          if (bd > 1) continue;
          const r = p.rnd();
          if (bd > 0.78 && r < 0.4) continue; // borde del racimo desflecado
          // Luz desde arriba a la izquierda: cada racimo parece una bolita.
          let f = 1.06 - (bdx + bdy) * 0.16 - bd * bd * 0.1;
          if (r < 0.22) f *= 0.82; // sombra entre florcitas
          else if (r > 0.9) f *= 1.12;
          p.set(x, y, p.vary(tone(best.col, f), 5));
        }
      }
      // Brillos de pétalos claros arriba de cada racimo.
      for (const c of clusters) {
        const x = wrap(Math.floor(c.x - c.r * 0.4));
        const y = wrap(Math.floor(c.y - c.r * 0.4));
        p.set(x, y, p.vary([196, 172, 232], 4));
      }
      // Alguna flor suelta entre las hojas.
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(p.rnd() * S);
        const y = Math.floor(p.rnd() * S);
        if (p.get(x, y)[3] === 255) p.set(x, y, p.vary([170, 140, 216], 5));
      }
    },

    // Tablones de jacarandá: madera rojiza-rosada.
    jacaranda_planks(p) {
      t.paintBoards(p, [190, 128, 112], {
        joint: [120, 72, 62],
        seam: [138, 86, 74],
        tints: [0, 6, -5, 3],
        seams: [3, 11],
      });
    },

    // --- Plantas --------------------------------------------------------------

    // Pasto alto: matas de hojas finas de distintos verdes, más oscuras abajo.
    tall_grass(p) {
      clear(p);
      const greens = [
        [88, 160, 58],
        [70, 138, 46],
        [110, 182, 72],
        [80, 150, 54],
        [122, 190, 80],
      ];
      const starts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      for (let i = starts.length - 1; i > 0; i--) {
        const j = Math.floor(p.rnd() * (i + 1));
        [starts[i], starts[j]] = [starts[j], starts[i]];
      }
      // Las más cortas y oscuras primero: las altas quedan adelante.
      const blades = starts.slice(0, 9).map((x0) => ({
        x0,
        h: 10 + Math.floor(p.rnd() * 5),
        lean: (x0 - 7.5) * 0.45 + (p.rnd() - 0.5) * 2.4,
        col: greens[Math.floor(p.rnd() * greens.length)],
      }));
      blades.sort((a, b) => a.h - b.h);
      for (const { x0, h, lean, col } of blades) {
        for (let k = 0; k < h; k++) {
          const u = k / (h - 1);
          const x = Math.round(x0 + lean * u * u);
          const y = S - 1 - k;
          p.set(x, y, p.vary(tone(col, 0.72 + u * 0.4), 4));
          // Hoja un poco más ancha en la base.
          if (k < 3 && p.rnd() < 0.5) p.set(x + (lean < 0 ? -1 : 1), y, p.vary(tone(col, 0.7), 4));
        }
      }
    },

    // Helecho: frondas arqueadas con hojitas a los costados del nervio.
    fern(p) {
      clear(p);
      const rachis = [58, 104, 44];
      const leaf = [72, 136, 58];
      const leafLight = [100, 160, 74];
      const fronds = [
        [[7, 16], [4, 10], [0, 11]],
        [[9, 16], [12, 10], [16, 11]],
        [[7, 16], [4, 2], [1, 5]],
        [[9, 16], [12, 2], [15, 5]],
        [[8, 16], [7.5, 6], [8.5, 1]],
      ];
      for (const [a, b, c] of fronds) {
        const path = bezierPixels(a, b, c);
        const n = path.length;
        path.forEach(([x, y, tx, ty], i) => {
          const u = i / (n - 1);
          // Hojitas cada dos píxeles, más largas a mitad de la fronda.
          if (u > 0.2 && i % 2 === 0) {
            const L = u < 0.8 ? 2 : 1;
            for (const side of [-1, 1]) {
              for (let j = 1; j <= L; j++) {
                const lx = Math.round(x + 0.5 - ty * side * j + tx * j * 0.6 - 0.5);
                const ly = Math.round(y + 0.5 + tx * side * j + ty * j * 0.6 - 0.5);
                if (ly < S) p.set(lx, ly, p.vary(j === L ? leafLight : leaf, 5));
              }
            }
          }
        });
        // Nervio encima de las hojitas, más claro hacia la punta.
        path.forEach(([x, y], i) => {
          if (y < S) p.set(x, y, p.vary(mix(rachis, leaf, i / (n - 1)), 4));
        });
      }
    },

    // Margarita: tallo con dos hojas y flor blanca de centro amarillo arriba.
    flower_daisy(p) {
      clear(p);
      const stem = [74, 132, 52];
      const leaf = [88, 152, 60];
      for (let y = 7; y < S; y++) p.set(y < 11 ? 8 : 7, y, p.vary(stem, 4));
      p.set(7, 10, p.vary(tone(stem, 0.9), 3)); // codo del tallo
      // Hojas: una a cada lado, apuntando hacia arriba.
      for (const [x, y, f] of [[6, 13, 0.9], [5, 12, 1], [4, 12, 1.12], [5, 13, 0.85], [9, 10, 0.9], [10, 9, 1], [11, 8, 1.12], [10, 10, 0.85]]) {
        p.set(x, y, p.vary(tone(leaf, f), 4));
      }
      // Pétalos alrededor del centro (8, 4): sombra gris abajo a la derecha.
      const cx = 8;
      const cy = 4;
      for (let y = 0; y < 9; y++) {
        for (let x = 4; x < 13; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d < 1.2 || d > 3.2) continue;
          let f = 1 - (dx + dy) * 0.025;
          if ((Math.abs(dx) > 1.2 && Math.abs(dy) > 1.2) || d > 2.9) f *= 0.93; // separación entre pétalos
          p.set(x, y, p.vary(tone([240, 238, 228], f), 3));
        }
      }
      // Centro amarillo con volumen.
      p.set(7, 3, [244, 210, 86]);
      p.set(8, 3, [228, 182, 56]);
      p.set(7, 4, [222, 174, 52]);
      p.set(8, 4, [196, 142, 42]);
    },

    // Flor de ceibo: tallo con hojas y un racimo de flores rojo carmín, que
    // se abren hacia afuera y se achican hacia la punta.
    flower_ceibo(p) {
      clear(p);
      const stem = [86, 110, 54];
      const leaf = [62, 108, 50];
      const red = [184, 30, 50];
      for (let y = 2; y < S; y++) p.set(y < 9 ? 8 : 7, y, p.vary(stem, 4));
      p.set(8, 9, p.vary(tone(stem, 0.9), 3));
      // Hojas (de a tres folíolos) abajo.
      for (const [x, y, f] of [[6, 13, 0.85], [5, 13, 1], [4, 12, 1.1], [5, 12, 0.95], [8, 12, 0.85], [9, 12, 1], [10, 11, 1.1], [9, 11, 0.95], [6, 11, 0.9]]) {
        p.set(x, y, p.vary(tone(leaf, f), 4));
      }
      // Flores: [fila de arranque, lado, largo].
      const flowers = [
        [9, -1, 4],
        [8, 1, 4],
        [6, -1, 3],
        [5, 1, 3],
        [3, -1, 2],
        [2, 1, 2],
      ];
      for (const [sy, side, len] of flowers) {
        const sx = sy < 9 ? 8 : 7;
        for (let k = 1; k <= len; k++) {
          const x = sx + side * k;
          const y = sy - Math.floor((k * k) / 4); // se curva hacia arriba
          const f = k === len ? 1.2 : k === 1 ? 0.72 : 1;
          p.set(x, y, p.vary(tone(red, f), 5));
          // Panza de la flor, en sombra.
          if (k > 1 && k < len) p.set(x, y + 1, p.vary(tone(red, 0.7), 4));
        }
      }
      // Pimpollo en la punta.
      p.set(8, 1, p.vary(tone(red, 1.1), 4));
      p.set(8, 0, p.vary(tone(red, 1.25), 4));
    },

    // Flor celeste: tallo que se ramifica con varias florcitas celestes.
    flower_blue(p) {
      clear(p);
      const stem = [78, 134, 56];
      const petals = { light: [156, 204, 242], mid: [116, 172, 230], dark: [88, 140, 206], eye: [244, 230, 160] };
      const branches = [
        [[7, 15], [7, 9], [7, 4]],
        [[7, 11], [6, 9], [4, 8]],
        [[7, 10], [9, 8], [11, 6]],
        [[7, 13], [9, 12], [10, 11]],
      ];
      for (const [a, b, c] of branches) {
        for (const [x, y] of bezierPixels([a[0] + 0.5, a[1] + 0.5], [b[0] + 0.5, b[1] + 0.5], [c[0] + 0.5, c[1] + 0.5])) {
          p.set(x, y, p.vary(stem, 4));
        }
      }
      // Hojitas abajo.
      for (const [x, y, f] of [[6, 14, 0.9], [5, 13, 1.1], [8, 14, 0.9], [6, 12, 1]]) p.set(x, y, p.vary(tone(stem, f * 1.08), 4));
      floret(p, 7, 3, petals);
      floret(p, 3, 7, petals);
      floret(p, 11, 5, petals);
      floret(p, 11, 10, petals);
    },

    // Hongo: sombrero rojo con puntos claros sobre un pie blanco, y uno chiquito al lado.
    mushroom(p) {
      clear(p);
      const cap = [184, 50, 42];
      const dots = [236, 226, 208];
      const stalk = [226, 220, 204];
      // Pie: más claro a la izquierda.
      for (let y = 12; y < S; y++) {
        p.set(7, y, p.vary(stalk, 3));
        p.set(8, y, p.vary(tone(stalk, 0.86), 3));
      }
      p.set(6, 15, p.vary(tone(stalk, 0.92), 3));
      p.set(9, 15, p.vary(tone(stalk, 0.8), 3));
      // Sombrero en cúpula: filas 8 a 11.
      const rows = [
        [8, 6, 9],
        [9, 5, 10],
        [10, 4, 11],
        [11, 4, 11],
      ];
      for (const [y, x0, x1] of rows) {
        for (let x = x0; x <= x1; x++) {
          let f = 1.08 - (x - x0) / (x1 - x0) * 0.24;
          if (y === 8) f *= 1.1;
          if (y === 11) f *= 0.72; // borde de abajo, en sombra
          p.set(x, y, p.vary(tone(cap, f), 4));
        }
      }
      for (const [x, y] of [[6, 9], [9, 9], [5, 10], [8, 10]]) p.set(x, y, p.vary(dots, 3));
      // Laminillas bajo el sombrero.
      p.set(7, 12, p.vary(tone(stalk, 0.7), 3));
      p.set(8, 12, p.vary(tone(stalk, 0.6), 3));
      // Hongo bebé, separado del grande para que no parezca una gota.
      p.set(13, 15, p.vary(stalk, 3));
      p.set(13, 14, p.vary(tone(stalk, 0.75), 3));
      p.set(12, 13, p.vary(tone(cap, 1.05), 4));
      p.set(13, 13, p.vary(cap, 4));
      p.set(14, 13, p.vary(tone(cap, 0.8), 4));
      p.set(13, 12, p.vary(tone(cap, 1.12), 4));
    },
  };
}
