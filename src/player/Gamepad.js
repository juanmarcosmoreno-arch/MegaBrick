// Joystick (Gamepad API): se lee una vez por frame el primer joystick
// conectado. Se usa el mapeo "standard" del navegador, que tienen los
// joysticks de Xbox y PlayStation: cada botón y palanca está siempre en el
// mismo lugar, sin configurar nada.
//
// El navegador muestra el joystick recién cuando se aprieta un botón con la
// página abierta (por privacidad).

/** Botones del mapeo standard (nombres de Xbox). */
export const PAD = Object.freeze({
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  BACK: 8,
  START: 9,
  L3: 10, // apretar la palanca izquierda
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
});

/** Nombres de los botones en pantalla, según el joystick. */
const LABELS = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', START: 'Menú' },
  playstation: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', START: 'Options' },
};

/**
 * Zona muerta de las palancas: casi ningún joystick vuelve justo a 0 al
 * soltarlas, y sin esto el jugador caminaría o giraría solo.
 */
const DEAD_ZONE = 0.2;
/** Los gatillos son analógicos: cuentan como apretados desde la mitad. */
const TRIGGER_THRESHOLD = 0.5;

export class GamepadInput {
  constructor() {
    this.connected = false;
    /** Nombre del joystick que da el navegador (incluye el fabricante). */
    this.id = '';
    /** Palanca izquierda, sin la zona muerta (y positivo = adelante). */
    this.move = { x: 0, y: 0 };
    /** Palanca derecha, sin la zona muerta (y positivo = arriba). */
    this.look = { x: 0, y: 0 };
    /** Se conectó o desconectó en este frame. */
    this.justConnected = false;
    this.justDisconnected = false;
    this._down = new Set(); // botones apretados ahora
    this._pressed = new Set(); // botones que se apretaron en este frame
    this._ignored = new Set(); // botones que no cuentan hasta soltarlos
  }

  /** Lee el joystick. Se llama una vez por frame, antes de usarlo. */
  poll() {
    this._pressed.clear();
    const pad = findGamepad();
    const was = this.connected;
    this.connected = Boolean(pad);
    this.justConnected = this.connected && !was;
    this.justDisconnected = was && !this.connected;
    if (!pad) {
      this._release();
      return;
    }
    this.id = pad.id;
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      const down = i === PAD.LT || i === PAD.RT ? b.value > TRIGGER_THRESHOLD : b.pressed;
      if (!down) {
        this._down.delete(i);
        this._ignored.delete(i);
      } else if (!this._down.has(i)) {
        this._down.add(i);
        if (!this._ignored.has(i)) this._pressed.add(i);
      }
    }
    readStick(pad.axes[0], pad.axes[1], this.move);
    readStick(pad.axes[2], pad.axes[3], this.look);
  }

  /** ¿El botón está apretado? */
  isDown(button) {
    return this._down.has(button) && !this._ignored.has(button);
  }

  /** ¿Se apretó el botón en este frame? */
  wasPressed(button) {
    return this._pressed.has(button);
  }

  /** ¿Se apretó algún botón en este frame? */
  get anyPressed() {
    return this._pressed.size > 0;
  }

  /**
   * Los botones que están apretados no cuentan hasta que se suelten. Así, la
   * A que aprieta "Jugar" no hace saltar al jugador apenas empieza.
   */
  ignoreHeld() {
    for (const b of this._down) this._ignored.add(b);
    this._pressed.clear();
  }

  /** Nombres de los botones para mostrar (PlayStation o, si no, Xbox). */
  get labels() {
    return /054c|playstation|dualshock|dualsense/i.test(this.id) ? LABELS.playstation : LABELS.xbox;
  }

  _release() {
    this._down.clear();
    this._ignored.clear();
    this.move.x = this.move.y = 0;
    this.look.x = this.look.y = 0;
  }
}

/**
 * El primer joystick conectado, preferentemente uno con el mapeo standard.
 * Puede no haber Gamepad API (o estar bloqueada en la página): null.
 */
function findGamepad() {
  let pads;
  try {
    pads = navigator.getGamepads?.() ?? [];
  } catch {
    return null;
  }
  let any = null;
  for (const pad of pads) {
    if (!pad?.connected) continue;
    if (pad.mapping === 'standard') return pad;
    any ??= pad;
  }
  return any;
}

/**
 * Lee una palanca con zona muerta circular: adentro da 0 y afuera va de 0 a
 * 1 sin saltos (así se puede caminar despacio inclinándola un poco). El eje
 * vertical se invierte para que "arriba" sea positivo.
 */
function readStick(x = 0, y = 0, out) {
  const length = Math.hypot(x, y);
  if (length < DEAD_ZONE) {
    out.x = out.y = 0;
    return;
  }
  const scale = (Math.min(1, length) - DEAD_ZONE) / (1 - DEAD_ZONE) / length;
  out.x = x * scale;
  out.y = -y * scale;
}
