// Interfaz del multijugador: panel para crear una partida o unirse con un
// código (se abre desde la pantalla de inicio o desde la pausa), lista de
// jugadores en el HUD y datos de la partida en el menú de pausa.

import { formatCode, parseCode, sanitizeName } from '../net/protocol.js';
import { VARIANTS } from '../player/colors.js';
import { loadPreference, savePreference } from '../save/Preferences.js';

/** Copia un texto al portapapeles (con alternativa si no hay permiso). */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export class MultiplayerMenu {
  /**
   * @param {import('../net/Multiplayer.js').Multiplayer} mp
   * @param {object} o
   * @param {() => void} o.onPlay entrar al juego (captura el mouse)
   * @param {HTMLElement} o.hudRoot contenedor del HUD (lista de jugadores)
   * @param {(text: string) => void} o.onPauseMessage aviso en el menú de pausa
   */
  constructor(mp, { onPlay, hudRoot, onPauseMessage }) {
    this.mp = mp;
    this.onPauseMessage = onPauseMessage;
    /** Antes de unirse: () => boolean (false cancela). */
    this.onBeforeJoin = null;
    const $ = (id) => document.getElementById(id);
    this.panel = $('mp-panel');
    this.nameInput = $('mp-name');
    this.hostBtn = $('mp-host');
    this.joinBtn = $('mp-join');
    this.codeInput = $('mp-join-code');
    this.codeBox = $('mp-code-box');
    this.codeEl = $('mp-code');
    this.status = $('mp-status');
    this.playBtn = $('mp-play');
    this.leaveBtn = $('mp-leave');
    this.backBtn = $('mp-back');
    this.pauseInfo = $('mp-pause');
    this.pauseCode = $('mp-pause-code');
    this.pauseCount = $('mp-pause-count');

    this.nameInput.value = loadPreference('name', '') || `Jugador${Math.floor(10 + Math.random() * 90)}`;
    this.nameInput.addEventListener('change', () => {
      this.nameInput.value = sanitizeName(this.nameInput.value);
      savePreference('name', this.nameInput.value);
    });

    $('btn-multiplayer').addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });
    // En la pausa, un clic en el fondo vuelve al juego: este botón no.
    $('btn-pause-mp').addEventListener('click', (e) => {
      e.stopPropagation();
      this.open();
    });
    this.backBtn.addEventListener('click', () => this.close());
    // Esc cierra el panel (aunque el foco haya quedado fuera de él).
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.panel.hidden) this.close();
    });
    this.hostBtn.addEventListener('click', () => this.host());
    this.joinBtn.addEventListener('click', () => this.join());
    this.codeInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); // que el Enter no apriete también otro botón
      this.join();
    });
    this.playBtn.addEventListener('click', () => {
      this.close();
      onPlay();
    });
    this.leaveBtn.addEventListener('click', () => this.leave());
    $('mp-copy').addEventListener('click', () => this.copyCode(false));
    // En la pausa, los clics en los datos de la partida (por ejemplo, para
    // seleccionar el código) no vuelven al juego.
    this.pauseInfo.addEventListener('click', (e) => e.stopPropagation());
    $('mp-pause-copy').addEventListener('click', () => this.copyCode(true));

    // Lista de jugadores en el HUD (arriba a la derecha).
    this.hudList = document.createElement('div');
    this.hudList.className = 'hud-players';
    this.hudList.hidden = true;
    hudRoot.appendChild(this.hudList);

    mp.onChange = () => this.render();
    this.render();
  }

  /** Mientras el panel está abierto, lo de atrás no se alcanza con Tab. */
  _setBackgroundInert(inert) {
    for (const id of ['title-screen', 'pause-screen']) document.getElementById(id).inert = inert;
  }

  open() {
    this._opener = document.activeElement;
    this._setBackgroundInert(true);
    this.panel.hidden = false;
    this.render();
    (this.mp.active ? this.playBtn : this.nameInput).focus();
  }

  /** Cierra el panel. Si había una conexión a medio hacer, se cancela. */
  close() {
    if (this.mp.connecting) {
      this.mp.cancel();
      this.setStatus('');
    }
    this.panel.hidden = true;
    this._setBackgroundInert(false);
    // El foco vuelve al botón que lo abrió (con el teclado o el joystick).
    if (this._opener?.isConnected && !this._opener.disabled) this._opener.focus();
    this._opener = null;
  }

  setStatus(text, isError = false) {
    this.status.textContent = text;
    this.status.classList.toggle('ok', !isError);
  }

  /** Avisos de la partida (alguien entró o salió, se cortó la conexión). */
  notice(text, isWarning = false) {
    if (!this.mp.connecting) this.setStatus(text, isWarning);
  }

  _name() {
    const name = sanitizeName(this.nameInput.value);
    this.nameInput.value = name;
    savePreference('name', name);
    return name;
  }

  async host() {
    if (this.mp.active || this.mp.connecting) return;
    const name = this._name();
    try {
      const done = this.mp.host(name);
      this.setStatus('Creando la partida…');
      await done;
      this.setStatus('¡Listo! Pasale el código a quien quieras invitar y entrá a jugar.');
      this.playBtn.focus();
    } catch (err) {
      if (!err.cancelled) this.setStatus(err.message, true);
    }
  }

  async join() {
    if (this.mp.active || this.mp.connecting) return;
    const code = parseCode(this.codeInput.value);
    if (!code) {
      this.setStatus('El código tiene 6 letras y números, por ejemplo K7Q-X2M.', true);
      this.codeInput.focus();
      return;
    }
    // Al unirse se juega en el mundo de quien creó la partida (el juego
    // puede preguntar antes, si el mundo propio no se puede guardar).
    if (this.onBeforeJoin && !this.onBeforeJoin()) return;
    const name = this._name();
    try {
      const done = this.mp.join(code, name);
      this.setStatus('Conectando…');
      await done;
      const host = [...this.mp.players.values()][0];
      this.setStatus(`¡Conectado${host ? ` a la partida de ${host.name}` : ''}! Entrá a jugar.`);
      this.playBtn.focus();
    } catch (err) {
      if (!err.cancelled) this.setStatus(err.message, true);
    }
  }

  /** Sale de la partida y sigue jugando solo en el mismo mundo. */
  leave() {
    if (!this.mp.active) return;
    const wasHost = this.mp.role === 'host';
    this.mp.leave();
    this.setStatus(
      wasHost
        ? 'Cerraste la partida. Seguís en este mundo, solo.'
        : 'Saliste de la partida. Seguís en este mundo, solo.',
    );
    this.hostBtn.focus();
  }

  async copyCode(inPause) {
    if (!this.mp.code) return;
    const code = formatCode(this.mp.code);
    const text = (await copyText(code)) ? 'Código copiado.' : `Copiá el código: ${code}`;
    if (inPause) this.onPauseMessage?.(text);
    else this.setStatus(text);
  }

  /** Actualiza todo lo que depende del estado de la partida. */
  render() {
    const mp = this.mp;
    const active = mp.active;
    const locked = active || mp.connecting; // no se puede crear ni unirse
    this.hostBtn.disabled = locked;
    this.joinBtn.disabled = locked;
    this.nameInput.disabled = locked;
    this.codeInput.disabled = locked;
    this.playBtn.hidden = !active;
    this.leaveBtn.hidden = !active;
    this.codeBox.hidden = mp.role !== 'host';
    if (mp.code) this.codeEl.textContent = formatCode(mp.code);

    // Pausa: código y cantidad de jugadores.
    this.pauseInfo.hidden = !active;
    if (active) {
      this.pauseCode.textContent = formatCode(mp.code);
      const n = mp.players.size + 1;
      this.pauseCount.textContent = n === 1 ? 'Solo vos por ahora' : `${n} jugadores`;
    }

    // HUD: lista de jugadores con el color de cada uno.
    this.hudList.hidden = !active;
    this.hudList.textContent = '';
    if (active) {
      const title = document.createElement('div');
      title.className = 'hud-players-title';
      title.textContent = `Partida ${formatCode(mp.code)}`;
      this.hudList.appendChild(title);
      for (const p of mp.roster) {
        const row = document.createElement('div');
        row.className = 'hud-player';
        const dot = document.createElement('span');
        dot.className = 'hud-player-dot';
        dot.style.background = VARIANTS[p.color]?.swatch ?? '#888';
        const name = document.createElement('span');
        name.textContent = p.me ? `${p.name} (vos)` : p.name;
        row.append(dot, name);
        this.hudList.appendChild(row);
      }
    }
  }
}
