// Entrada del jugador: teclado, mouse y pointer lock, y joystick.
//
// Se usan los códigos físicos de tecla (event.code: "KeyW", "Space", etc.)
// para que WASD funcione igual en cualquier distribución de teclado.
//
// Con el mouse se juega con el mouse capturado (pointer lock). Con el
// joystick no hace falta capturarlo (y el navegador no lo deja pedir desde
// un botón del joystick): se juega "suelto" hasta pausar con Start o hasta
// hacer clic, que vuelve al mouse.

import { GamepadInput } from './Gamepad.js';

/** Sensibilidad del mouse al 100% (radianes por píxel). */
const BASE_SENSITIVITY = 0.0022;
/** Giro con la palanca derecha a fondo y sensibilidad al 100% (radianes por segundo). */
const PAD_LOOK_SPEED = 3.4;
/** Mirar arriba y abajo con la palanca es un poco más lento que girar. */
const PAD_PITCH_FACTOR = 0.75;

export class Controls {
  /**
   * @param {HTMLElement} element elemento que captura el mouse (el canvas)
   */
  constructor(element) {
    this.element = element;
    this.keys = new Set(); // teclas apretadas ahora
    this.justPressed = new Set(); // teclas que se apretaron en este frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this._wheelAcc = 0; // píxeles acumulados dentro de un gesto de la rueda
    this._wheelTime = -Infinity;
    this._lockedAt = -Infinity; // momento en que se capturó el mouse
    this.buttons = new Set(); // botones del mouse apretados (0 izq., 2 der.)
    this.clicked = new Set(); // botones apretados en este frame
    this.locked = false;
    this.sensitivity = BASE_SENSITIVITY; // radianes por píxel de movimiento del mouse
    this.pad = new GamepadInput();
    /** Jugando con el joystick, sin el mouse capturado. */
    this.padPlaying = false;
    /** Con qué se usó el juego por última vez: 'mouse' (o teclado) o 'pad'. */
    this.lastDevice = 'mouse';

    /**
     * Callback cuando se empieza o se deja de jugar: (active) => void. Con
     * el mouse, al capturarlo o soltarlo; con el joystick, al entrar a jugar
     * o pausar.
     */
    this.onLockChange = null;
    /** Callback cuando falla capturar el mouse (por ejemplo, demasiado rápido tras Esc). */
    this.onLockError = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onLockChange = this._onLockChange.bind(this);
    this._onLockError = this._onLockError.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onContextMenu = (e) => {
      // Jugando con el joystick también: el clic derecho que pasa al mouse
      // llega antes de que el mouse quede capturado.
      if (this.active) e.preventDefault();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    element.addEventListener('wheel', this._onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('pointerlockerror', this._onLockError);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('contextmenu', this._onContextMenu);
  }

  /** ¿Se está jugando (mouse capturado o con el joystick)? */
  get active() {
    return this.locked || this.padPlaying;
  }

  /**
   * Empieza a jugar. Si lo último que se usó fue el joystick, sin capturar
   * el mouse; si no, lo captura (debe llamarse desde un clic o una tecla).
   */
  lock() {
    if (this.locked) return;
    if (this.lastDevice === 'pad' && this.pad.connected) {
      this._setPadPlaying(true);
      return;
    }
    try {
      // En navegadores nuevos devuelve una promesa que puede rechazarse
      // (por ejemplo, si se pide de nuevo justo después de apretar Esc).
      const result = this.element.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        result.catch((err) => this._onLockError(err));
      }
    } catch (err) {
      this._onLockError(err);
    }
  }

  /** Suelta el mouse (o deja de jugar con el joystick): pausa. */
  unlock() {
    if (document.pointerLockElement === this.element) document.exitPointerLock();
    this._setPadPlaying(false);
  }

  /** Lee el joystick. Se llama al principio de cada frame. */
  poll() {
    this.pad.poll();
    if (this.pad.anyPressed) this.lastDevice = 'pad';
    // Sin joystick no se puede seguir jugando con él: pausa.
    if (this.pad.justDisconnected) this._setPadPlaying(false);
  }

  /**
   * Cuánto girar en este frame (radianes): el movimiento del mouse y la
   * palanca derecha del joystick (con curva: inclinándola poco se apunta
   * con precisión).
   * @param {number} dt segundos
   */
  consumeLook(dt) {
    const { dx, dy } = this.consumeMouse();
    const { x, y } = this.pad.look;
    const tilt = Math.hypot(x, y);
    const speed = PAD_LOOK_SPEED * (this.sensitivity / BASE_SENSITIVITY) * tilt * dt;
    return {
      yaw: dx * this.sensitivity + x * speed,
      pitch: dy * this.sensitivity - y * speed * PAD_PITCH_FACTOR,
    };
  }

  /** ¿La tecla (event.code) está apretada? */
  isDown(code) {
    return this.keys.has(code);
  }

  /** ¿Se apretó la tecla en este frame? (para acciones de un solo toque) */
  wasPressed(code) {
    return this.justPressed.has(code);
  }

  /** ¿El botón del mouse (0 izquierdo, 2 derecho) está apretado? */
  isMouseDown(button) {
    return this.buttons.has(button);
  }

  /** ¿Se apretó el botón del mouse en este frame? */
  wasClicked(button) {
    return this.clicked.has(button);
  }

  /** Devuelve y reinicia el movimiento del mouse acumulado desde el último frame. */
  consumeMouse() {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** Devuelve y reinicia el giro de la rueda acumulado (en "pasos"). */
  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Se llama al final de cada frame para limpiar las teclas "recién apretadas". */
  endFrame() {
    this.justPressed.clear();
    this.clicked.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.element.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    document.removeEventListener('pointerlockerror', this._onLockError);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('contextmenu', this._onContextMenu);
  }

  // --- Manejadores de eventos ---------------------------------------------

  _onKeyDown(e) {
    // F3 (datos del mundo) abre la búsqueda en algunos navegadores, también en la pausa.
    if (e.code === 'F3') e.preventDefault();
    this.lastDevice = 'mouse';
    // Con el joystick el mouse no está capturado: Esc pausa desde acá.
    if (e.code === 'Escape' && this.padPlaying) {
      this._setPadPlaying(false);
      return;
    }
    if (!this.active) return;
    // Evitar que Espacio o las flechas desplacen la página mientras se juega,
    // y que Ctrl (correr) + una tecla dispare atajos del navegador (Ctrl+D
    // marcadores, Ctrl+S guardar, etc.). Ctrl+W no se puede bloquear: el
    // juego pide confirmación antes de cerrar (ver main.js).
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.ctrlKey) e.preventDefault();
    if (!e.repeat) this.justPressed.add(e.code);
    this.keys.add(e.code);
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onMouseMove(e) {
    if (!this.locked) return;
    this.mouseDX += e.movementX || 0;
    this.mouseDY += e.movementY || 0;
  }

  _onMouseDown(e) {
    this.lastDevice = 'mouse';
    // Jugando con el joystick, un clic pasa al mouse: lo captura.
    if (this.padPlaying && !this.locked) {
      e.preventDefault();
      this.lock();
      return;
    }
    // Solo cuenta con el mouse capturado: el clic que captura el mouse (en
    // "Jugar" o en la pausa) no rompe ni pone bloques.
    if (!this.locked) return;
    e.preventDefault();
    // El segundo clic de un doble clic en "Jugar" o en la pausa llega ya con
    // el mouse capturado: se ignora para no romper un bloque sin querer.
    if (performance.now() - this._lockedAt < 300) return;
    this.buttons.add(e.button);
    this.clicked.add(e.button);
  }

  _onMouseUp(e) {
    this.buttons.delete(e.button);
  }

  /**
   * Rueda del mouse: cada muesca avanza una casilla. Un trackpad (o la
   * rueda suave de Mac) manda muchos eventos chicos por gesto: el primero
   * avanza una casilla y después se acumulan píxeles hasta otro paso.
   */
  _onWheel(e) {
    if (!this.active) return;
    e.preventDefault();
    if (!e.deltaY) return;
    // En píxeles, aunque el navegador informe líneas o páginas.
    const px = e.deltaMode === 0 ? e.deltaY : e.deltaY * (e.deltaMode === 1 ? 100 / 3 : 300);
    const newGesture =
      e.timeStamp - this._wheelTime > 150 || Math.sign(px) !== Math.sign(this._wheelAcc || px);
    this._wheelTime = e.timeStamp;
    if (newGesture) {
      this._wheelAcc = 0;
      this.wheel += Math.sign(px);
      return;
    }
    this._wheelAcc += px;
    if (Math.abs(this._wheelAcc) >= 75) {
      this.wheel += Math.sign(this._wheelAcc);
      this._wheelAcc = 0;
    }
  }

  _onLockChange() {
    this.locked = document.pointerLockElement === this.element;
    if (this.locked) {
      this._lockedAt = performance.now();
      this.padPlaying = false; // se pasó al mouse
    } else {
      this._releaseAll();
    }
    this.pad.ignoreHeld();
    this.onLockChange?.(this.active);
  }

  /** Empieza o deja de jugar con el joystick (sin capturar el mouse). */
  _setPadPlaying(on) {
    if (this.padPlaying === on || (on && this.locked)) return;
    this.padPlaying = on;
    if (!on) this._releaseAll();
    // El botón que se usó para entrar o pausar no cuenta en el juego.
    this.pad.ignoreHeld();
    this.onLockChange?.(this.active);
  }

  _onLockError(err) {
    this.onLockError?.(err);
  }

  _onBlur() {
    // Si la ventana pierde el foco, soltar todas las teclas para que el
    // jugador no siga caminando solo. Con el joystick, además, pausa (con el
    // mouse pasa solo: el navegador lo suelta).
    this._releaseAll();
    this._setPadPlaying(false);
  }

  _releaseAll() {
    this.keys.clear();
    this.justPressed.clear();
    this.buttons.clear();
    this.clicked.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this._wheelAcc = 0;
  }
}
