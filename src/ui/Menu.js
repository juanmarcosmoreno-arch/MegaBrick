// Menús en HTML: pantalla de inicio y menú de pausa.
//
// El HTML de cada pantalla está en index.html; esta clase solo las muestra u
// oculta y conecta los botones con el juego.

export class Menu {
  /**
   * @param {object} options
   * @param {() => void} options.onPlay "Jugar" en la pantalla de inicio
   * @param {() => void} options.onResume "Continuar" (o clic) en la pausa
   * @param {Record<string, {name: string, swatch: string}>} options.colors
   *   colores de la ropa para elegir
   * @param {string} options.color color elegido al empezar
   * @param {(key: string) => void} options.onColor al elegir otro color
   * @param {{id: string, name: string}[]} options.characters personajes para elegir
   * @param {string} options.character personaje elegido al empezar
   * @param {(id: string) => void} options.onCharacter al elegir otro personaje
   */
  constructor({ onPlay, onResume, colors, color, onColor, characters, character, onCharacter }) {
    this.title = document.getElementById('title-screen');
    this.pause = document.getElementById('pause-screen');
    this.titleMsg = document.getElementById('title-msg');
    this.pauseMsg = document.getElementById('pause-msg');

    document.getElementById('btn-play').addEventListener('click', (e) => {
      e.stopPropagation();
      onPlay();
    });
    document.getElementById('btn-resume').addEventListener('click', (e) => {
      e.stopPropagation();
      onResume();
    });
    // En la pausa, un clic en cualquier parte también vuelve al juego.
    this.pause.addEventListener('click', () => onResume());

    this.characterButtons = this._buildRadioGroup(
      document.getElementById('character-picker'),
      characters.map((c) => ({ key: c.id, label: c.name, className: 'character-option', text: c.name })),
      character,
      onCharacter,
    );
    this.swatches = this._buildRadioGroup(
      document.getElementById('color-swatches'),
      Object.entries(colors).map(([key, c]) => ({ key, label: c.name, className: 'swatch', background: c.swatch })),
      color,
      onColor,
    );

    // Megabrick es para computadora: en pantallas táctiles sin mouse se avisa.
    const touchOnly =
      window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
    document.getElementById('device-note').hidden = !touchOnly;
  }

  /**
   * Un grupo de opciones tipo radio (personajes o colores). Con el teclado,
   * Tab entra al grupo y las flechas cambian de opción.
   * @param {HTMLElement} box
   * @param {{key: string, label: string, className: string, text?: string, background?: string}[]} options
   * @param {string} selected
   * @param {(key: string) => void} onSelect
   * @returns {HTMLButtonElement[]}
   */
  _buildRadioGroup(box, options, selected, onSelect) {
    box.textContent = '';
    const buttons = [];
    const select = (index, focus) => {
      buttons.forEach((b, j) => {
        b.setAttribute('aria-checked', String(index === j));
        b.tabIndex = index === j ? 0 : -1;
      });
      if (focus) buttons[index].focus();
      onSelect(options[index].key);
    };
    options.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = o.className;
      if (o.background) b.style.background = o.background;
      if (o.text) b.textContent = o.text;
      b.title = o.label;
      b.dataset.key = o.key;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', o.label);
      b.setAttribute('aria-checked', String(o.key === selected));
      b.tabIndex = o.key === selected ? 0 : -1;
      b.addEventListener('click', () => select(i, false));
      buttons.push(b);
      box.appendChild(b);
    });
    box.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const i = buttons.indexOf(document.activeElement);
      if (!step || i < 0) return;
      e.preventDefault();
      select((i + step + options.length) % options.length, true);
    });
    return buttons;
  }

  showTitle() {
    this.title.hidden = false;
    this.pause.hidden = true;
    this.setMessage('');
  }

  showPause() {
    this.title.hidden = true;
    this.pause.hidden = false;
    this.setMessage('');
  }

  hideAll() {
    this.title.hidden = true;
    this.pause.hidden = true;
  }

  /** Muestra un aviso corto en la pantalla visible (`ok`: en verde, no es un error). */
  setMessage(text, ok = false) {
    for (const el of [this.titleMsg, this.pauseMsg]) {
      el.textContent = text;
      el.classList.toggle('ok', ok);
    }
  }
}
