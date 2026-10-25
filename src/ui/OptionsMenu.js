// Opciones (desde la pausa): distancia de render, sensibilidad (del mouse y
// de la palanca del joystick), campo de visión y volumen. Se aplican al momento y se recuerdan en el
// navegador (preferencias).

import { loadPreference, savePreference } from '../save/Preferences.js';

/** Cada opción: rango, paso, valor por defecto y cómo se muestra. */
export const OPTION_SPECS = {
  renderDistance: { min: 2, max: 16, step: 1, def: 6, format: (v) => `${v} chunks` },
  sensitivity: { min: 20, max: 300, step: 5, def: 100, format: (v) => `${v}%` },
  fov: { min: 60, max: 100, step: 1, def: 75, format: (v) => `${v}°` },
  volume: { min: 0, max: 100, step: 5, def: 70, format: (v) => (v === 0 ? 'Sin sonido' : `${v}%`) },
};

/** Valor válido para una opción (dentro del rango y en su paso). */
function clean(key, value) {
  const spec = OPTION_SPECS[key];
  const n = Number(value);
  if (!Number.isFinite(n)) return spec.def;
  const stepped = Math.round((n - spec.min) / spec.step) * spec.step + spec.min;
  return Math.max(spec.min, Math.min(spec.max, stepped));
}

/** Opciones guardadas (con los valores por defecto para lo que falte). */
export function loadOptions() {
  const saved = loadPreference('options', {}) ?? {};
  const options = {};
  for (const key of Object.keys(OPTION_SPECS)) options[key] = clean(key, saved[key] ?? OPTION_SPECS[key].def);
  return options;
}

export class OptionsMenu {
  /**
   * @param {object} options valores actuales (se modifican en el lugar)
   * @param {(key: string, value: number) => void} onChange se llama al cambiar una opción
   */
  constructor(options, onChange) {
    this.options = options;
    this.onChange = onChange;
    this.panel = document.getElementById('options-panel');
    this.inputs = {};
    for (const key of Object.keys(OPTION_SPECS)) {
      const spec = OPTION_SPECS[key];
      const input = document.getElementById(`opt-${key}`);
      const output = document.getElementById(`opt-${key}-value`);
      Object.assign(input, { min: spec.min, max: spec.max, step: spec.step });
      // La distancia se aplica al soltar (rearma el mundo cercano); el
      // resto, mientras se mueve.
      const live = key !== 'renderDistance';
      input.addEventListener('input', () => {
        output.textContent = spec.format(clean(key, input.value));
        if (live) this._set(key, input.value);
      });
      input.addEventListener('change', () => this._set(key, input.value));
      this.inputs[key] = { input, output };
    }
    document.getElementById('btn-options').addEventListener('click', (e) => {
      e.stopPropagation(); // en la pausa, un clic en el fondo vuelve al juego
      this.open();
    });
    document.getElementById('opt-done').addEventListener('click', () => this.close());
    document.getElementById('opt-reset').addEventListener('click', () => {
      for (const key of Object.keys(OPTION_SPECS)) this._set(key, OPTION_SPECS[key].def);
      this.render();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panel.hidden) this.close();
    });
    this.render();
  }

  open() {
    this._opener = document.activeElement;
    for (const id of ['title-screen', 'pause-screen']) document.getElementById(id).inert = true;
    this.render();
    this.panel.hidden = false;
    this.inputs.renderDistance.input.focus();
  }

  close() {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    for (const id of ['title-screen', 'pause-screen']) document.getElementById(id).inert = false;
    if (this._opener?.isConnected) this._opener.focus();
  }

  _set(key, value) {
    const v = clean(key, value);
    // Se guarda solo lo que cambió (por ejemplo, una ?distancia= de la
    // dirección vale para esta vez y no queda guardada).
    const saved = loadOptions();
    if (saved[key] !== v) savePreference('options', { ...saved, [key]: v });
    if (this.options[key] === v) return;
    this.options[key] = v;
    this.onChange(key, v);
  }

  /** Muestra los valores actuales en los controles. */
  render() {
    for (const [key, { input, output }] of Object.entries(this.inputs)) {
      input.value = this.options[key];
      output.textContent = OPTION_SPECS[key].format(this.options[key]);
    }
  }
}
