// Sonidos del juego, generados con Web Audio (sin archivos de audio): pasos,
// romper y poner bloques, caer y meterse al agua, y las voces de los
// animales. Cada material suena distinto (pasto, tierra, piedra, madera,
// arena, hojas, vidrio y agua) y cada vez con una pequeña variación, para
// que no suene repetido.
//
// Los navegadores no dejan sonar nada hasta que el jugador toca algo: el
// audio arranca con el primer clic o tecla (unlock).

import { getBlock } from '../world/blocks.js';

/**
 * Receta de cada material: ruido filtrado (y, en algunos, un tono corto).
 * - filter: tipo y frecuencia del filtro del ruido; q: qué tan "afinado".
 * - decay: segundos que dura; gain: volumen relativo.
 * - tone: frecuencia de un golpe tonal (madera, vidrio) o null.
 */
const MATERIALS = {
  grass: { filter: 'bandpass', freq: 2200, q: 0.7, decay: 0.09, gain: 0.55, tone: null },
  leaves: { filter: 'bandpass', freq: 3600, q: 0.9, decay: 0.11, gain: 0.45, tone: null },
  dirt: { filter: 'lowpass', freq: 900, q: 0.8, decay: 0.08, gain: 0.8, tone: null },
  sand: { filter: 'highpass', freq: 2800, q: 0.6, decay: 0.12, gain: 0.45, tone: null },
  stone: { filter: 'bandpass', freq: 1700, q: 1.6, decay: 0.06, gain: 0.8, tone: 140 },
  wood: { filter: 'bandpass', freq: 1100, q: 1.2, decay: 0.07, gain: 0.6, tone: 230 },
  glass: { filter: 'highpass', freq: 3500, q: 1, decay: 0.08, gain: 0.35, tone: 2100 },
  water: { filter: 'lowpass', freq: 700, q: 0.7, decay: 0.22, gain: 0.7, tone: null },
};

/** Cómo cambia cada acción el sonido del material. */
const ACTIONS = {
  step: { gain: 0.32, decay: 1, pitch: 1 },
  land: { gain: 0.6, decay: 1.4, pitch: 0.8 },
  break: { gain: 0.9, decay: 1.8, pitch: 1 },
  hit: { gain: 0.4, decay: 0.7, pitch: 1.25 }, // golpecito mientras se rompe
  place: { gain: 0.75, decay: 1.1, pitch: 0.75 },
  splash: { gain: 0.8, decay: 2.2, pitch: 1 },
};

/** Distancia (bloques) hasta la que se oyen las acciones de otros jugadores. */
export const HEARING_DISTANCE = 24;

export class Sounds {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._noise = null;
    this.volume = 0.7;
  }

  /**
   * Arranca el audio (tiene que ser durante un clic o una tecla del
   * jugador). Se puede llamar muchas veces.
   */
  unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      // Un segundo de ruido blanco: la materia prima de casi todos los sonidos.
      const length = this.ctx.sampleRate;
      this._noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this._noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Volumen general, de 0 a 1. */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  /**
   * Hace sonar una acción sobre un bloque.
   * @param {'step' | 'land' | 'break' | 'hit' | 'place' | 'splash'} action
   * @param {number} blockId bloque (define el material)
   * @param {number} [loudness] 0 a 1 (por ejemplo, según la distancia)
   */
  play(action, blockId, loudness = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.volume <= 0 || loudness <= 0) return;
    const material = MATERIALS[getBlock(blockId).sound];
    const how = ACTIONS[action];
    if (!material || !how) return;
    const t = ctx.currentTime;
    // Un poco distinto cada vez.
    const vary = 0.88 + Math.random() * 0.24;
    const decay = material.decay * how.decay * (0.9 + Math.random() * 0.2);
    const peak = material.gain * how.gain * loudness;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    out.connect(this.master);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noise;
    noise.playbackRate.value = vary;
    const filter = ctx.createBiquadFilter();
    filter.type = material.filter;
    filter.frequency.value = material.freq * how.pitch * vary;
    filter.Q.value = material.q;
    // El agua "se cierra": el filtro baja durante el chapuzón.
    if (blockId && getBlock(blockId).sound === 'water') {
      filter.frequency.exponentialRampToValueAtTime(material.freq * 0.35, t + decay);
    }
    noise.connect(filter).connect(out);
    // Arranca en un punto al azar del ruido (si no, siempre suena igual).
    noise.start(t, Math.random() * 0.7, decay + 0.05);

    if (material.tone) {
      const osc = ctx.createOscillator();
      osc.type = material.filter === 'highpass' ? 'sine' : 'triangle';
      const f = material.tone * how.pitch * vary;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + decay);
      const toneGain = ctx.createGain();
      toneGain.gain.setValueAtTime(0.0001, t);
      toneGain.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.003);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.8);
      osc.connect(toneGain).connect(this.master);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  }

  /**
   * La voz de un animal.
   * @param {string} species id de la especie
   * @param {'call' | 'happy' | 'scared'} mood
   * @param {number} [loudness] 0 a 1 (según la distancia)
   */
  call(species, mood, loudness = 1) {
    const ctx = this.ctx;
    const notes = VOICES[species]?.[mood];
    if (!ctx || ctx.state !== 'running' || this.volume <= 0 || loudness <= 0 || !notes) return;
    const start = ctx.currentTime;
    // Cada animal un poco más agudo o más grave.
    const pitch = 0.9 + Math.random() * 0.2;
    for (const n of notes) {
      const t = start + n.at;
      const osc = ctx.createOscillator();
      osc.type = n.type;
      osc.frequency.setValueAtTime(n.f0 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(n.f1 * pitch, t + n.dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(n.gain * loudness, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
      let last = osc;
      if (n.vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = n.vibrato;
        const depth = ctx.createGain();
        depth.gain.value = n.f0 * pitch * 0.04;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + n.dur + 0.02);
      }
      if (n.lowpass) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = n.lowpass;
        last = last.connect(filter);
      }
      last.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  }
}

/**
 * Voces de los animales: notas cortas con forma de onda, frecuencia de
 * inicio y fin, momento (at) y duración en segundos, volumen y vibrato (Hz).
 * Hay una receta por especie para su llamado de siempre, contento y asustado.
 */
const VOICES = {
  carpincho: {
    // Silbiditos y chasquidos suaves.
    call: [{ type: 'sine', f0: 820, f1: 1100, at: 0, dur: 0.09, gain: 0.25 }, { type: 'sine', f0: 860, f1: 1150, at: 0.16, dur: 0.08, gain: 0.2 }],
    happy: [{ type: 'triangle', f0: 130, f1: 120, at: 0, dur: 0.6, gain: 0.35, vibrato: 18 }],
    scared: [{ type: 'square', f0: 420, f1: 260, at: 0, dur: 0.1, gain: 0.25 }],
  },
  oveja: {
    // "Beee" con vibrato.
    call: [{ type: 'sawtooth', f0: 300, f1: 280, at: 0, dur: 0.55, gain: 0.18, vibrato: 7, lowpass: 1400 }],
    happy: [{ type: 'sawtooth', f0: 380, f1: 420, at: 0, dur: 0.3, gain: 0.16, vibrato: 8, lowpass: 1600 }],
    scared: [{ type: 'sawtooth', f0: 420, f1: 330, at: 0, dur: 0.22, gain: 0.2, vibrato: 11, lowpass: 1800 }],
  },
  gallina: {
    // Cacareo: golpecitos cortos.
    call: [0, 0.13, 0.24].map((at, i) => ({ type: 'square', f0: 520 + i * 40, f1: 420, at, dur: 0.06, gain: 0.12, lowpass: 2200 })),
    happy: [0, 0.1, 0.2, 0.34].map((at, i) => ({ type: 'square', f0: 480 + i * 70, f1: 560 + i * 70, at, dur: 0.07, gain: 0.12, lowpass: 2400 })),
    scared: [0, 0.06, 0.12, 0.18, 0.24].map((at) => ({ type: 'sawtooth', f0: 900, f1: 600, at, dur: 0.05, gain: 0.12, lowpass: 3000 })),
  },
  conejo: {
    // Muy callado: chillidito y golpe con la pata.
    call: [{ type: 'sine', f0: 1700, f1: 2100, at: 0, dur: 0.06, gain: 0.12 }],
    happy: [{ type: 'sine', f0: 1500, f1: 2300, at: 0, dur: 0.08, gain: 0.12 }, { type: 'sine', f0: 1600, f1: 2400, at: 0.12, dur: 0.08, gain: 0.1 }],
    scared: [{ type: 'sine', f0: 140, f1: 60, at: 0, dur: 0.12, gain: 0.5 }],
  },
};

/** Bloques caminados entre paso y paso. */
const STRIDE = 1.9;
/** Velocidad de caída (bloques/s) desde la que suena el golpe al aterrizar. */
const LAND_SPEED = 7;

/**
 * Pasos del jugador: suenan cada tantos bloques caminados, según lo que hay
 * bajo los pies. También el golpe al caer de alto y el chapuzón al meterse
 * al agua.
 */
export class Footsteps {
  /** @param {Sounds} sounds */
  constructor(sounds) {
    this.sounds = sounds;
    this._distance = 0;
    this._wasOnGround = true;
    this._wasInWater = false;
    this._lastVy = 0;
  }

  /**
   * @param {number} dt segundos
   * @param {import('../player/Player.js').Player} player
   * @param {import('../world/World.js').World} world
   */
  update(dt, player, world) {
    const p = player.position;
    const below = world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.05), Math.floor(p.z));
    const water = world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z));
    const fall = -this._lastVy;
    if (player.inWater && !this._wasInWater && fall > 3) {
      // El agua que tocaron los pies (más arriba puede seguir siendo aire).
      const feet = world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
      this.sounds.play('splash', feet, Math.min(1, fall / 12));
    } else if (player.onGround && !this._wasOnGround && fall > LAND_SPEED) {
      this.sounds.play('land', below, Math.min(1, fall / 16));
      this._distance = 0;
    }
    const speed = player.horizontalSpeed;
    if (player.onGround && speed > 0.5) {
      this._distance += speed * dt;
      if (this._distance >= STRIDE) {
        this._distance -= STRIDE;
        this.sounds.play('step', below);
      }
    } else if (player.inWater && !player.onGround && speed > 0.8) {
      // Brazadas al nadar.
      this._distance += speed * dt;
      if (this._distance >= STRIDE * 1.5) {
        this._distance = 0;
        this.sounds.play('step', water, 0.6);
      }
    } else {
      // El primer paso después de quedarse quieto o de aterrizar llega enseguida.
      this._distance = STRIDE * 0.7;
    }
    this._wasOnGround = player.onGround;
    this._wasInWater = player.inWater;
    this._lastVy = player.velocity.y;
  }
}
