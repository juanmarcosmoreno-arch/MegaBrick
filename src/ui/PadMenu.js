// Menús con el joystick: la cruz (o la palanca izquierda) mueve el foco al
// botón más cercano en esa dirección, A lo aprieta, B vuelve y Start juega
// (o sigue jugando). En un deslizador de Opciones, izquierda y derecha
// cambian el valor.
//
// Los campos de texto (nombres, semilla, código de partida) se escriben con
// el teclado.

import { PAD } from '../player/Gamepad.js';

/** Pantallas y paneles, del que queda más arriba al de más abajo. */
const LAYERS = ['options-panel', 'mp-panel', 'new-world-panel', 'worlds-panel', 'pause-screen', 'title-screen'];
const FOCUSABLE = 'button, input, [tabindex]:not([tabindex="-1"])';
/** La palanca cuenta como una dirección de la cruz desde acá. */
const STICK_THRESHOLD = 0.5;
/** Manteniendo una dirección: primera repetición y las siguientes (segundos). */
const REPEAT_DELAY = 0.4;
const REPEAT_EVERY = 0.12;

const DIRECTIONS = [
  { button: PAD.UP, x: 0, y: -1 },
  { button: PAD.DOWN, x: 0, y: 1 },
  { button: PAD.LEFT, x: -1, y: 0 },
  { button: PAD.RIGHT, x: 1, y: 0 },
];

export class PadMenu {
  /**
   * @param {import('../player/Gamepad.js').GamepadInput} pad
   * @param {object} o
   * @param {() => void} o.onBack B: cerrar el panel abierto (o seguir jugando en la pausa)
   * @param {() => void} o.onStart Start: jugar o seguir jugando
   */
  constructor(pad, { onBack, onStart }) {
    this.pad = pad;
    this.onBack = onBack;
    this.onStart = onStart;
    this._held = null; // dirección mantenida
    this._repeat = 0;
    // Con el joystick el foco se marca siempre; con el mouse o el teclado,
    // como siempre (el navegador decide).
    const off = (e) => e.isTrusted && document.body.classList.remove('pad-nav');
    document.addEventListener('mousedown', off, true);
    document.addEventListener('keydown', off, true);
  }

  /** Se llama en cada frame mientras se ve un menú. */
  update(dt) {
    const layer = this._layer();
    if (!layer) return;
    const pad = this.pad;
    const dir = this._direction(dt);
    if (pad.wasPressed(PAD.START)) {
      this.onStart();
      return;
    }
    if (pad.wasPressed(PAD.B)) {
      this.onBack();
      return;
    }
    if (!dir && !pad.wasPressed(PAD.A)) return;
    document.body.classList.add('pad-nav');
    // Si el foco no está en este menú, lo primero es mostrar dónde está.
    const current = layer.contains(document.activeElement) ? document.activeElement : null;
    if (!current || !isVisible(current)) {
      this._focus(this._primary(layer));
      return;
    }
    if (pad.wasPressed(PAD.A)) {
      if (current.tagName !== 'INPUT') current.click();
      return;
    }
    if (current.type === 'range' && dir.x) {
      stepRange(current, dir.x);
      return;
    }
    const next = this._nearest(layer, current, dir);
    if (next) this._focus(next);
  }

  /** El menú de más arriba que se ve ahora (o null). */
  _layer() {
    for (const id of LAYERS) {
      const el = document.getElementById(id);
      if (el && !el.hidden && !el.inert) return el;
    }
    return null;
  }

  /**
   * La dirección elegida en este frame, con la cruz o la palanca izquierda.
   * Manteniéndola, se repite (primero espera un poco).
   */
  _direction(dt) {
    const pad = this.pad;
    let held = null;
    for (const d of DIRECTIONS) {
      const stick = d.x ? pad.move.x * d.x : -pad.move.y * d.y;
      if (pad.isDown(d.button) || stick > STICK_THRESHOLD) {
        held = d;
        break;
      }
    }
    if (held !== this._held) {
      this._held = held;
      this._repeat = REPEAT_DELAY;
      return held;
    }
    if (!held) return null;
    this._repeat -= dt;
    if (this._repeat > 0) return null;
    this._repeat = REPEAT_EVERY;
    return held;
  }

  /** Lo que se puede elegir en el menú. */
  _candidates(layer) {
    return [...layer.querySelectorAll(`${FOCUSABLE}, .swatch`)].filter(
      (el) => !el.disabled && isVisible(el),
    );
  }

  /** El botón principal del menú (Jugar, Continuar...) o el primero que haya. */
  _primary(layer) {
    const candidates = this._candidates(layer);
    return candidates.find((el) => el.classList.contains('btn-primary')) ?? candidates[0] ?? null;
  }

  /**
   * El elemento más cercano en una dirección: se mide desde el centro y se
   * castiga lo que queda corrido hacia el costado.
   */
  _nearest(layer, from, dir) {
    const a = center(from);
    let best = null;
    let bestScore = Infinity;
    for (const el of this._candidates(layer)) {
      if (el === from) continue;
      const b = center(el);
      const along = (b.x - a.x) * dir.x + (b.y - a.y) * dir.y;
      if (along <= 1) continue;
      const aside = Math.abs((b.x - a.x) * dir.y - (b.y - a.y) * dir.x);
      const score = along + aside * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  _focus(el) {
    el?.focus({ focusVisible: true });
  }
}

/** ¿Se ve? (sin `hidden` en el camino y con tamaño en pantalla) */
function isVisible(el) {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Mueve un deslizador un paso y avisa como si se hubiera movido con el mouse. */
function stepRange(input, direction) {
  const before = input.value;
  if (direction > 0) input.stepUp();
  else input.stepDown();
  if (input.value === before) return;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
