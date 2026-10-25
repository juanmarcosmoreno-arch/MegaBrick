// Megabrick — punto de entrada: arma el juego y corre el loop principal.

import './style.css';
import * as THREE from 'three';
import { createAtlasTexture } from './render/textures.js';
import { createBlockMaterials } from './render/materials.js';
import { START_TIME, Sky } from './render/Sky.js';
import { World, toChunkCoord } from './world/World.js';
import { createChunkWorkers } from './world/ChunkWorkers.js';
import { BLOCK, getBlock } from './world/blocks.js';
import { TerrainGenerator, parseSeed } from './world/TerrainGen.js';
import { Player } from './player/Player.js';
import { Controls } from './player/Controls.js';
import { PAD } from './player/Gamepad.js';
import { Avatar } from './player/Avatar.js';
import { VIEW, ViewCamera } from './player/ViewCamera.js';
import { CharacterPreview } from './render/CharacterPreview.js';
import { DEFAULT_VARIANT, VARIANTS, isVariant } from './player/colors.js';
import { loadPreference, savePreference } from './save/Preferences.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Hud } from './ui/Hud.js';
import { Menu } from './ui/Menu.js';
import { DEFAULT_HOTBAR, Hotbar, HOTBAR_SIZE } from './ui/Hotbar.js';
import { Inventory } from './ui/Inventory.js';
import { BlockOutline } from './render/BlockOutline.js';
import { HeldItem } from './render/HeldItem.js';
import { getBlockGeometry } from './render/blockGeometry.js';
import { BlockInteraction } from './player/Interaction.js';
import { Multiplayer } from './net/Multiplayer.js';
import { MultiplayerMenu } from './ui/MultiplayerMenu.js';
import { PadMenu } from './ui/PadMenu.js';
import { WorldSaves } from './save/WorldSaves.js';
import { WorldsMenu } from './ui/WorldsMenu.js';
import { OptionsMenu, loadOptions } from './ui/OptionsMenu.js';
import { Footsteps, HEARING_DISTANCE, Sounds } from './audio/Sounds.js';
import { Animals } from './animals/Animals.js';

// Paso de tiempo máximo por frame: si el navegador se traba, el juego no
// "salta" de golpe.
const MAX_DT = 0.1;
// Color de fondo de la pantalla de inicio (el mismo negro del logo).
const TITLE_BG = 0x0a0a0a;
// Cuánto se abre el campo de visión al correr.
const SPRINT_FOV_FACTOR = 1.12;
// Aviso de la pausa si se desconecta el joystick (se borra al reconectarlo).
const PAD_DISCONNECTED = 'Se desconectó el joystick.';

/**
 * Opciones que se pueden elegir en la URL (el resto, en Opciones):
 *   ?semilla=texto-o-número   abre un mundo nuevo con esa semilla (en vez
 *                             del último mundo guardado)
 *   ?distancia=6              distancia de render en chunks (2 a 16) para
 *                             esta vez (manda sobre la de Opciones)
 */
function readUrlOptions() {
  const params = new URLSearchParams(window.location.search);
  const seedText = params.get('semilla')?.trim() || 'megabrick';
  const distance = Number.parseInt(params.get('distancia') ?? '', 10);
  return {
    seedText,
    seedGiven: Boolean(params.get('semilla')?.trim()),
    seed: parseSeed(seedText),
    distanceGiven: Number.isFinite(distance),
    renderDistance: Number.isFinite(distance) ? Math.max(2, Math.min(16, distance)) : 6,
  };
}

/** Estados posibles del juego. */
const STATE = Object.freeze({
  TITLE: 'title', // pantalla de inicio
  PLAYING: 'playing', // jugando (mouse capturado o con el joystick)
  PAUSED: 'paused', // menú de pausa
  INVENTORY: 'inventory', // menú de materiales (el juego sigue de fondo)
});

class Game {
  constructor(container) {
    this.container = container;

    // --- Render ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    container.appendChild(this.renderer.domElement);

    // --- Opciones (las de la pausa; ?distancia= en la URL manda esta vez) ---
    this.prefs = loadOptions();
    this.options = readUrlOptions();
    if (this.options.distanceGiven) this.prefs.renderDistance = this.options.renderDistance;
    else this.options.renderDistance = this.prefs.renderDistance;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.prefs.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

    // --- Texturas y materiales ---
    this.atlas = createAtlasTexture();
    this.materials = createBlockMaterials(this.atlas.texture);

    // --- Mundo ---
    // Los workers generan y mallan los chunks (los comparten todos los mundos).
    this.chunkWorkers = createChunkWorkers();
    this.generator = new TerrainGenerator(this.options.seed);
    this.world = new World(this.materials, this.generator, {
      renderDistance: this.options.renderDistance,
      workers: this.chunkWorkers,
    });
    this.scene.add(this.world.group);

    this.sky = new Sky(this.scene);
    this.applyRenderDistance();

    // --- Jugador ---
    this.player = new Player();
    // Aparece en tierra firme cerca del origen, mirando al horizonte.
    const spawn = this.generator.findSpawn();
    this.player.spawn(spawn.x, spawn.y, spawn.z, 0, -0.1);
    // Los chunks de alrededor se cargan ya; el resto, en los workers
    // (mientras se ve la pantalla de inicio ya se va cargando).
    this.world.preload(spawn.x, spawn.z, 1);
    this.view = new ViewCamera(this.camera);

    // --- Personaje (se ve en tercera persona y en la pantalla de inicio) ---
    let color = loadPreference('color', DEFAULT_VARIANT);
    if (!isVariant(color)) color = DEFAULT_VARIANT;
    this.avatar = new Avatar(color);
    this.avatar.root.visible = false;
    this.scene.add(this.avatar.root);
    this.preview = new CharacterPreview(color);
    // Reflejos suaves para el plástico del personaje: un ambiente de
    // "habitación" generado por código (solo afecta materiales estándar).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    for (const scene of [this.scene, this.preview.scene]) {
      scene.environment = env;
      scene.environmentIntensity = 0.55;
    }
    // En el juego, el reflejo depende de la hora (lo maneja el cielo).
    this.sky.setTime(START_TIME);
    // Armar ya los shaders de Coco (con las luces y el reflejo del juego):
    // si no, el juego se traba la primera vez que se ve uno (al apretar V o
    // cuando entra alguien a la partida). Como el Coco propio sigue vivo,
    // tampoco se pierden cuando se va el último jugador.
    this.renderer.compile(this.avatar.root, this.camera, this.scene);
    this.stageEl = document.getElementById('character-stage');
    // La cámara va en la escena para poder colgarle el bloque en la mano.
    this.scene.add(this.camera);
    this.heldItem = new HeldItem(this.camera, this.materials);
    this.controls = new Controls(this.renderer.domElement);
    this.controls.onLockChange = (locked) => this.onLockChange(locked);
    this.controls.onLockError = () => {
      // Si fallaba al volver del menú de materiales, se pasa a la pausa.
      if (this.state === STATE.INVENTORY) this.pause();
      this.menu.setMessage('No se pudo capturar el mouse. Esperá un segundo y probá de nuevo.');
    };
    this.baseSensitivity = this.controls.sensitivity;
    this.controls.sensitivity = (this.baseSensitivity * this.prefs.sensitivity) / 100;

    // --- Sonido ---
    this.sounds = new Sounds();
    this.sounds.setVolume(this.prefs.volume / 100);
    this.footsteps = new Footsteps(this.sounds);
    // El navegador deja sonar recién después de un clic o una tecla.
    const unlockAudio = () => this.sounds.unlock();
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    // Lo que rompen o ponen los demás jugadores, si está cerca.
    this._onWorldEdit = (e) => this.playRemoteEdit(e);
    this.world.editListeners.add(this._onWorldEdit);

    // --- Interfaz ---
    this.hud = new Hud(document.getElementById('hud'));
    this.hotbar = new Hotbar(this.hud.root, this.atlas.canvas);
    this.hotbar.onChange = (id) => this.onHeldBlockChange(id);
    this.onHeldBlockChange(this.hotbar.selectedBlock);
    this.inventory = new Inventory({
      hotbar: this.hotbar,
      atlas: this.atlas.canvas,
      onClose: (resume) => this.closeInventory(resume),
    });

    // --- Animales ---
    this.animals = new Animals({ scene: this.scene, sounds: this.sounds });

    // --- Romper y poner bloques (y acariciar o empujar animales) ---
    this.outline = new BlockOutline(this.scene);
    this.interaction = new BlockInteraction({
      world: this.world,
      player: this.player,
      hotbar: this.hotbar,
      outline: this.outline,
      onAction: (action, id) => {
        this.heldItem.swing();
        this.avatar.swing();
        this.multiplayer.countAction();
        this.sounds.play(action, id);
      },
      animals: this.animals,
      onAnimal: (act, animal) => this.actOnAnimal(act, animal),
    });
    this.menu = new Menu({
      onPlay: () => this.controls.lock(),
      onResume: () => this.controls.lock(),
      colors: VARIANTS,
      color,
      onColor: (key) => this.setAvatarColor(key),
    });

    // --- Multijugador ---
    this.multiplayer = new Multiplayer(this);
    this.multiplayerMenu = new MultiplayerMenu(this.multiplayer, {
      onPlay: () => this.controls.lock(),
      hudRoot: this.hud.root,
      onPauseMessage: (text) => this.menu.setMessage(text, true),
    });
    this.multiplayerMenu.onBeforeJoin = () => this.beforeJoin();

    // --- Opciones ---
    this.optionsMenu = new OptionsMenu(this.prefs, (key, value) => this.applyOption(key, value));

    // --- Menús con el joystick ---
    this.padMenu = new PadMenu(this.controls.pad, {
      onBack: () => this.padBack(),
      onStart: () => this.padStart(),
    });
    this._soundHintShown = false;
    this._materialsHintShown = false;
    this.padHelp = document.getElementById('pad-help');
    this.keysHelp = document.getElementById('keys-help');

    // --- Mundos guardados ---
    this.saves = new WorldSaves(this);
    this.worldsMenu = new WorldsMenu(this.saves, {
      canChangeWorld: () => !this.multiplayer.active && !this.multiplayer.connecting,
      onPlayWorld: (id) => this.openWorld(id, { play: true }),
      onNewWorld: (o) => this.newWorld(o),
      onDeleteWorld: (id) => this.deleteWorld(id),
    });
    this.saves.onChange = () => this.worldsMenu.render();
    this.saves.onNotice = (text) => this.hud.toast(text, 4);
    // La lista de mundos depende de si hay partida (no se cambia de mundo
    // mientras se comparte).
    const renderMultiplayer = this.multiplayer.onChange;
    this.multiplayer.onChange = () => {
      renderMultiplayer();
      this.worldsMenu.render();
    };
    document.getElementById('btn-save-exit').addEventListener('click', (e) => {
      e.stopPropagation(); // en la pausa, un clic en el fondo vuelve al juego
      this.saveAndExit();
    });
    this.multiplayer.onNotice = (text, isWarning) => {
      this.hud.toast(text, 3);
      this.multiplayerMenu.notice(text, isWarning);
      // En el inicio no se ve el HUD y en la pausa queda tapado: los avisos
      // importantes van también al menú.
      if (isWarning && this.state !== STATE.PLAYING) this.menu.setMessage(text);
    };

    this.state = STATE.TITLE;
    this.menu.showTitle();
    this.hud.setVisible(false);

    this.clock = new THREE.Clock();
    this.frameTimes = { ms: 0, worst: 0, frames: 0, time: 0, slowest: 0 };
    window.addEventListener('resize', () => this.onResize());
    // Ctrl+W cierra la pestaña y ninguna página puede impedirlo; como Ctrl
    // es correr y W avanzar, se pide confirmación antes de salir del juego.
    // También si quedaron cambios sin guardar (porque falló el guardado).
    window.addEventListener('beforeunload', (e) => {
      if (this.state === STATE.TITLE && !this.multiplayer.active && this.world.unsaved.size === 0) return;
      e.preventDefault();
      e.returnValue = '';
    });
    // Al ocultar la pestaña o cerrarla se guarda lo que haya.
    const saveNow = () => {
      if (this.worldInUse || this.world.unsaved.size > 0) this.saves.save();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
    // Autoguardado con su propio reloj: sigue aunque la pestaña esté oculta
    // (ahí no se dibujan frames, pero pueden llegar cambios de invitados).
    let lastTick = performance.now();
    setInterval(() => {
      const now = performance.now();
      this.saves.update((now - lastTick) / 1000, this.worldInUse);
      lastTick = now;
    }, 1000);
    // Hasta leer los mundos guardados no se puede empezar (si no, "Jugar"
    // crearía un mundo nuevo en vez de continuar el último).
    this.worldsMenu.setBusy(true);
    this.saves
      .init()
      .then(() => this.openLastWorld())
      .finally(() => this.worldsMenu.setBusy(false));
    this.watchPixelRatio();
    this.onResize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** ¿Se está en un mundo (jugando o en pausa)? */
  get inGame() {
    return this.state !== STATE.TITLE;
  }

  /** ¿Se está usando el mundo (en juego o compartiéndolo)? Entonces se autoguarda. */
  get worldInUse() {
    return this.inGame || this.multiplayer.role === 'host';
  }

  /**
   * Cambia el mundo: otra semilla y, opcionalmente, cambios de bloques ya
   * hechos (al cargar un mundo guardado o al unirse a una partida). Antes se
   * guarda el mundo que se deja.
   * @param {object} o
   * @param {number} o.seed
   * @param {string} [o.seedText]
   * @param {unknown} [o.edits] cambios (formato de World.exportEdits)
   * @param {{x: number, y: number, z: number}} [o.spawn] dónde aparece (si no, se busca)
   * @param {{yaw: number, pitch: number, flying?: boolean}} [o.look] hacia dónde mira y si vuela
   * @param {{slots: number[], selected: number}} [o.hotbar]
   * @param {number} [o.time] hora del día (0 a 1; si no se indica, sigue la actual)
   * @param {object} [o.save] datos del guardado de este mundo (ver WorldSaves.setCurrent)
   */
  loadWorld({ seed, seedText, edits, spawn, look, hotbar, time, save }) {
    this.saves.saveIfWorthIt();
    this.world.dispose();
    this.scene.remove(this.world.group);
    this.options.seed = seed;
    this.options.seedText = seedText ?? String(seed);
    this.generator = new TerrainGenerator(seed);
    this.world = new World(this.materials, this.generator, {
      renderDistance: this.options.renderDistance,
      workers: this.chunkWorkers,
    });
    this.world.importEdits(edits);
    this.world.editListeners.add(this._onWorldEdit);
    this.scene.add(this.world.group);
    if (time !== undefined) this.sky.setTime(time);
    this.interaction.world = this.world;
    this.applyRenderDistance();
    const s = spawn ?? this.generator.findSpawn();
    this.player.spawn(s.x, s.y, s.z, look?.yaw ?? this.player.yaw, look?.pitch ?? this.player.pitch);
    this.player.setFlying(Boolean(look?.flying));
    if (hotbar) this.hotbar.setSlots(hotbar.slots, hotbar.selected);
    this.saves.setCurrent(save);
    this.world.preload(s.x, s.z, 1);
    this.animals.reset();
  }

  /** Un mundo leído del guardado (WorldSaves.load) pasa a ser el actual. */
  applySavedWorld(data) {
    this.loadWorld({
      seed: data.seed,
      seedText: data.seedText,
      edits: data.edits,
      spawn: data.player,
      look: data.player ?? { yaw: 0, pitch: -0.1 },
      hotbar: data.hotbar ?? { slots: DEFAULT_HOTBAR, selected: 0 },
      time: data.time,
      save: data.save,
    });
  }

  /**
   * Al abrir el juego se prepara el último mundo jugado, para "Continuar".
   * No si la URL pide una semilla, ni si el jugador ya eligió otra cosa.
   */
  async openLastWorld() {
    const last = this.saves.worlds[0];
    if (!last || this.options.seedGiven) return;
    const idle = () =>
      this.state === STATE.TITLE &&
      !this.multiplayer.active &&
      !this.multiplayer.connecting &&
      this.saves.current.id === null &&
      this.world.edits.size === 0;
    if (!idle()) return;
    try {
      const data = await this.saves.load(last.id);
      if (data && idle()) this.applySavedWorld(data);
    } catch {
      // Si no se pudo leer, se queda el mundo nuevo.
    }
  }

  /**
   * Antes de dejar el mundo actual: si tiene cambios que no se pueden
   * guardar (el navegador no deja, o falló el guardado), se pregunta.
   * @returns {boolean} si se puede seguir
   */
  confirmLeaveWorld() {
    const s = this.saves;
    if (s.available === false && this.world.edits.size > 0) {
      return window.confirm('Este navegador no deja guardar: lo que construiste en este mundo se pierde. ¿Seguir?');
    }
    if (s.status === 'error' && this.world.unsaved.size > 0) {
      return window.confirm('No se pudo guardar este mundo: si seguís, se pierden los últimos cambios. ¿Seguir?');
    }
    return true;
  }

  /** Abre un mundo guardado (y, con `play`, entra a jugarlo). */
  async openWorld(id, { play = false } = {}) {
    if (this.saves.current.id !== id) {
      if (play && !this.confirmLeaveWorld()) return;
      this.worldsMenu.setBusy(true);
      try {
        const data = await this.saves.load(id);
        if (!data) throw new Error('No se encontró ese mundo.');
        this.applySavedWorld(data);
      } finally {
        this.worldsMenu.setBusy(false);
      }
    }
    if (play) this.controls.lock();
  }

  /** Crea un mundo nuevo (semilla al azar si no se elige) y entra a jugarlo. */
  newWorld({ name, seedText }) {
    if (!this.confirmLeaveWorld()) return;
    const seed = seedText ? parseSeed(seedText) : crypto.getRandomValues(new Uint32Array(1))[0];
    this.loadWorld({
      seed,
      seedText: seedText || String(seed),
      look: { yaw: 0, pitch: -0.1 },
      hotbar: { slots: DEFAULT_HOTBAR, selected: 0 },
      time: START_TIME,
      save: { name },
    });
    this.controls.lock();
  }

  /** Borra un mundo guardado. Si era el abierto, se abre otro (o uno nuevo). */
  async deleteWorld(id) {
    const wasCurrent = this.saves.current.id === id;
    await this.saves.delete(id);
    if (!wasCurrent) return;
    const next = this.saves.worlds.find((w) => w.id !== id);
    try {
      if (next) {
        await this.openWorld(next.id);
        return;
      }
    } catch {
      // Si no se pudo abrir el siguiente, queda uno nuevo.
    }
    this.freshWorld();
  }

  /**
   * Pausa → "Guardar y salir": guarda, deja la partida (si hay) y vuelve al
   * inicio. Un invitado no guarda el mundo de la partida: vuelve a su último
   * mundo propio.
   */
  async saveAndExit() {
    const mp = this.multiplayer;
    if (
      mp.role === 'host' &&
      mp.players.size > 0 &&
      !window.confirm('Se cierra la partida para todos los que están jugando. ¿Salir igual?')
    ) {
      return;
    }
    const wasGuest = mp.role === 'guest';
    if (mp.active) mp.leave({ adopt: false });
    this.state = STATE.TITLE;
    this.interaction.release();
    this.hud.setVisible(false);
    this.menu.showTitle();
    this.worldsMenu.render();
    if (wasGuest) {
      await this.openOwnWorld();
      return;
    }
    const ok = await this.saves.save();
    if (!ok && this.saves.status === 'error') {
      this.menu.setMessage('No se pudo guardar el mundo. Entrá de nuevo y probá otra vez.');
    }
  }

  /** Abre el último mundo propio guardado o, si no hay, uno nuevo. */
  async openOwnWorld() {
    const last = this.saves.worlds[0];
    try {
      if (last) {
        await this.openWorld(last.id);
        return;
      }
    } catch {
      // Si no se pudo abrir, queda uno nuevo.
    }
    this.freshWorld();
  }

  /** Un mundo nuevo al azar, sin guardar todavía (se guarda al jugarlo). */
  freshWorld() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.loadWorld({
      seed,
      seedText: String(seed),
      look: { yaw: 0, pitch: -0.1 },
      hotbar: { slots: DEFAULT_HOTBAR, selected: 0 },
      time: START_TIME,
    });
  }

  /**
   * Antes de unirse a una partida: se va a jugar en el mundo de quien la
   * creó. El propio se guarda solo; si no se puede guardar y tiene cambios,
   * se pregunta.
   */
  beforeJoin() {
    return this.confirmLeaveWorld();
  }

  /**
   * Ajusta niebla y plano lejano de la cámara a la distancia de render: la
   * niebla tapa el borde del área cargada.
   */
  applyRenderDistance() {
    this.sky.setViewDistance(this.world.edgeDistance);
    this.camera.far = this.world.renderDistance * 16 + 64;
    this.camera.updateProjectionMatrix();
  }

  /** El bloque elegido en la hotbar va a la mano (primera y tercera persona). */
  onHeldBlockChange(id) {
    this.heldItem.setBlock(id);
    this.avatar.setHeldBlock(getBlockGeometry(id), this.materials);
  }

  /** Teclas 1-9, rueda del mouse y LB/RB del joystick: elegir casilla de la hotbar. */
  updateHotbarInput() {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      if (this.controls.wasPressed(`Digit${i + 1}`)) this.hotbar.select(i);
    }
    const pad = this.controls.pad;
    const padSteps = (pad.wasPressed(PAD.RB) ? 1 : 0) - (pad.wasPressed(PAD.LB) ? 1 : 0);
    this.hotbar.scroll(this.controls.consumeWheel() + padSteps);
  }

  /**
   * Acariciar o empujar un animal. Un invitado se lo pide al anfitrión (que
   * es quien mueve los animales de la partida).
   */
  actOnAnimal(act, animal) {
    this.heldItem.swing();
    this.avatar.swing();
    this.multiplayer.countAction();
    if (this.multiplayer.role === 'guest') {
      this.multiplayer.sendAnimalAct(animal.id, act);
      return;
    }
    const p = this.player.position;
    this.animals.act(animal.id, act, { id: this.multiplayer.selfId, x: p.x, y: p.y, z: p.z }, p);
  }

  /**
   * Jugadores alrededor de los que hay animales (el primero, este): para que
   * aparezcan cerca, miren y sigan a quien los acarició. El anfitrión también
   * los hace aparecer cerca de los invitados.
   */
  animalPlayers() {
    const p = this.player.position;
    const list = [{ id: this.multiplayer.selfId, x: p.x, y: p.y, z: p.z, yaw: this.player.yaw }];
    if (this.multiplayer.role === 'host') {
      for (const [id, remote] of this.multiplayer.players) {
        const s = remote.lastState;
        if (s) list.push({ id, x: s.x, y: s.y, z: s.z });
      }
    }
    return list;
  }

  /** Abre el menú de materiales (tecla E o Vista del joystick). */
  openInventory() {
    this.state = STATE.INVENTORY;
    this.interaction.release();
    this.inventory.open();
    // Se suelta el mouse para poder elegir (no es una pausa: ver onLockChange).
    this.controls.unlock();
  }

  /**
   * Cierra el menú de materiales: vuelve a jugar (E, Listo, joystick) o, con
   * Esc, a la pausa (el navegador no deja capturar el mouse con Esc).
   */
  closeInventory(resume) {
    if (this.state !== STATE.INVENTORY) return;
    this.inventory.close();
    if (resume) this.controls.lock();
    else this.pause();
  }

  /** Pausa: menú de pausa y se guarda. */
  pause() {
    this.state = STATE.PAUSED;
    this.inventory.close();
    this.interaction.release();
    this.menu.showPause();
    // Si la palanca sigue inclinada, que no mueva el foco de la pausa.
    this.padMenu.ignoreHeld();
    this.saves.save();
  }

  /** Joystick B en un menú: cierra el panel abierto o, en la pausa, sigue jugando. */
  padBack() {
    if (this.inventory.isOpen) this.closeInventory(true);
    else if (!this.optionsMenu.panel.hidden) this.optionsMenu.close();
    else if (!this.multiplayerMenu.panel.hidden) this.multiplayerMenu.close();
    else if (!this.worldsMenu.newPanel.hidden || !this.worldsMenu.listPanel.hidden) this.worldsMenu.closeAll();
    else if (this.state === STATE.PAUSED) this.controls.lock();
  }

  /** Joystick Start en un menú: jugar (en el inicio) o seguir jugando (en la pausa). */
  padStart() {
    const panelOpen =
      this.inventory.isOpen ||
      !this.optionsMenu.panel.hidden ||
      !this.multiplayerMenu.panel.hidden ||
      !this.worldsMenu.newPanel.hidden ||
      !this.worldsMenu.listPanel.hidden;
    if (panelOpen) this.padBack();
    else if (this.state === STATE.TITLE) document.getElementById('btn-play').click();
    else this.controls.lock();
  }

  /** Se conectó o desconectó el joystick: avisos y ayuda de la pantalla de inicio. */
  updatePadConnection() {
    const pad = this.controls.pad;
    if (!pad.justConnected && !pad.justDisconnected && !pad.switched) return;
    if (pad.justConnected || pad.switched) {
      // Los nombres de los botones (también si se pasó a otro joystick).
      const labels = pad.labels;
      for (const kbd of this.padHelp.querySelectorAll('[data-pad]')) kbd.textContent = labels[kbd.dataset.pad];
    }
    if (pad.justConnected) {
      if (this.state === STATE.PLAYING) this.hud.toast('Joystick conectado', 2);
      else if (this.menu.pauseMsg.textContent === PAD_DISCONNECTED) this.menu.setMessage('');
    } else if (pad.justDisconnected && this.state === STATE.PAUSED) {
      this.menu.setMessage(PAD_DISCONNECTED);
    }
    this.padHelp.hidden = !pad.connected;
    this.keysHelp.hidden = pad.connected;
  }

  /** Cambia el color del personaje y lo recuerda para la próxima vez. */
  setAvatarColor(key) {
    this.avatar.setVariant(key);
    this.preview.setVariant(key);
    savePreference('color', key);
    this.multiplayerMenu?.render(); // el color propio en la lista de jugadores
  }

  /** Cambio de captura del mouse (o del juego con el joystick): entra o sale del modo de juego. */
  onLockChange(locked) {
    // Con el joystick el mouse queda suelto: se oculta la flecha.
    document.body.classList.toggle('pad-playing', locked && this.controls.padPlaying);
    if (locked) {
      if (this.controls.padPlaying && !this._soundHintShown && this.sounds.ctx?.state !== 'running') {
        // El navegador deja sonar recién después de un clic o una tecla (un
        // botón del joystick no cuenta).
        this._soundHintShown = true;
        this.hud.toast('Para escuchar los sonidos, hacé un clic o tocá una tecla', 4);
      } else if (!this._materialsHintShown) {
        this._materialsHintShown = true;
        const key = this.controls.padPlaying ? this.controls.pad.labels.BACK : 'E';
        this.hud.toast(`${key}: todos los materiales para construir`, 3);
      }
      this.state = STATE.PLAYING;
      this.inventory.close();
      this.menu.hideAll();
      this.worldsMenu.closeAll();
      this.multiplayerMenu.close();
      this.hud.setVisible(true);
      // Un mundo nuevo se guarda al empezar a jugarlo.
      if (this.saves.current.id === null) this.saves.save();
    } else if (this.state === STATE.PLAYING) {
      // Esc (o perder el foco) suelta el mouse: pausa (y se guarda).
      this.pause();
    }
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // El zoom del navegador o pasar a otro monitor cambia la densidad de
    // píxeles: se vuelve a leer siempre (con tope 2 por rendimiento).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Mover la ventana entre una pantalla Retina y un monitor común cambia
   * devicePixelRatio sin disparar "resize": se escucha con matchMedia y se
   * vuelve a registrar con el valor nuevo cada vez que cambia.
   */
  watchPixelRatio() {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        this.onResize();
        this.watchPixelRatio();
      },
      { once: true },
    );
  }

  /** Ubica y anima el personaje según el estado del jugador. */
  updateAvatar(dt) {
    const p = this.player;
    const a = this.avatar;
    a.root.visible = this.view.showsAvatar;
    a.root.position.copy(p.position);
    // Decidido mientras rompe bloques; contento al subir rápido volando.
    let expression = 'normal';
    if (this.interaction.breaking && this.interaction.target) expression = 'determinado';
    else if (p.flying && p.velocity.y > 3) expression = 'feliz';
    a.setExpression(expression);
    a.update(this.state === STATE.PLAYING ? dt : 0, {
      yaw: p.yaw,
      pitch: p.pitch,
      speed: p.horizontalSpeed,
      flying: p.flying && !p.onGround,
    });
  }

  /** Aplica una opción cambiada en el menú de Opciones. */
  applyOption(key, value) {
    if (key === 'renderDistance') {
      this.options.renderDistance = value;
      this.world.setRenderDistance(value);
      this.applyRenderDistance();
    } else if (key === 'sensitivity') {
      this.controls.sensitivity = (this.baseSensitivity * value) / 100;
    } else if (key === 'fov') {
      this.camera.fov = value;
      this.camera.updateProjectionMatrix();
    } else if (key === 'volume') {
      this.sounds.setVolume(value / 100);
      this.sounds.play('step', BLOCK.GRASS); // para escuchar cómo queda
    }
  }

  /** Lo que rompe o pone otro jugador suena si está cerca (más bajo cuanto más lejos). */
  playRemoteEdit({ x, y, z, id, prev, source }) {
    if (source !== 'remote' || prev === null || prev === id || this.state !== STATE.PLAYING) return;
    const p = this.player.position;
    const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - (p.y + 1.6), z + 0.5 - p.z);
    if (d > HEARING_DISTANCE) return;
    const loudness = 1 - d / HEARING_DISTANCE;
    if (id === BLOCK.AIR || getBlock(id).liquid) this.sounds.play('break', prev, loudness);
    else this.sounds.play('place', id, loudness);
  }

  /** Datos de F3: dónde está el jugador, hacia dónde mira, la hora y el mundo. */
  updateDebug() {
    const p = this.player.position;
    const bx = Math.floor(p.x);
    const by = Math.floor(p.y);
    const bz = Math.floor(p.z);
    // Adelante es -Z (norte) con yaw 0; girar a la izquierda sube el yaw.
    const directions = ['norte (-Z)', 'oeste (-X)', 'sur (+Z)', 'este (+X)'];
    const facing = directions[((Math.round(this.player.yaw / (Math.PI / 2)) % 4) + 4) % 4];
    const { loaded, meshed, working, waiting } = this.world.stats;
    this.hud.setDebug([
      `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Bloque: ${bx} ${by} ${bz}  ·  Chunk: ${toChunkCoord(bx)} ${toChunkCoord(bz)}`,
      `Mirando al ${facing}`,
      `Debajo: ${getBlock(this.world.getBlock(bx, by - 1, bz)).name}`,
      `Hora: ${this.sky.clock} (${this.sky.isNight ? 'noche' : 'día'})`,
      `Semilla: ${this.options.seedText}`,
      `Chunks: ${meshed} visibles, ${loaded} en memoria  ·  distancia ${this.world.renderDistance}`,
      this.chunkWorkers && !this.chunkWorkers.broken
        ? `Workers: ${this.chunkWorkers.workers.length}  ·  ${working} trabajando, ${waiting} mallas por sumar`
        : 'Workers: no (el mundo se arma en el hilo principal)',
      `Frame: ${this.frameTimes.ms.toFixed(1)} ms promedio, el más lento ${this.frameTimes.worst.toFixed(1)} ms`,
      `Animales: ${this.animals.count}${this.multiplayer.role === 'guest' ? ' (los mueve el anfitrión)' : ''}`,
    ]);
  }

  /**
   * Duración de los frames (para F3): el promedio y el más lento de cada
   * medio segundo (un frame lento es un tirón aunque los FPS den bien).
   */
  measureFrameTimes(realDt) {
    const f = this.frameTimes;
    f.frames++;
    f.time += realDt;
    f.slowest = Math.max(f.slowest, realDt);
    if (f.time < 0.5) return;
    f.ms = (f.time / f.frames) * 1000;
    f.worst = f.slowest * 1000;
    f.frames = 0;
    f.time = 0;
    f.slowest = 0;
  }

  /** Abre un poco el campo de visión al correr (con transición suave). */
  updateFov(dt) {
    const target = this.prefs.fov * (this.player.sprinting ? SPRINT_FOV_FACTOR : 1);
    const fov = this.camera.fov + (target - this.camera.fov) * (1 - Math.exp(-8 * dt));
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Un frame del loop principal. */
  frame() {
    const realDt = this.clock.getDelta();
    const dt = Math.min(realDt, MAX_DT);
    this.measureFrameTimes(realDt);
    this.controls.poll();
    this.updatePadConnection();
    if (this.state === STATE.INVENTORY) {
      // Vista (como E) cierra el menú de materiales y vuelve a jugar.
      if (this.controls.pad.wasPressed(PAD.BACK)) this.closeInventory(true);
      else this.inventory.update(this.controls.pad);
    }
    if (this.state !== STATE.PLAYING) this.padMenu.update(dt);

    // El mundo se genera alrededor del jugador en todos los estados (así,
    // mientras se ve la pantalla de inicio, ya se va cargando). Primero lo
    // que tiene adelante.
    this.world.update(this.player.position.x, this.player.position.z, { yaw: this.player.yaw });
    // La hora corre mientras se juega. Con una partida corre siempre y con el
    // reloj real (también en el inicio y al volver de una pestaña oculta),
    // para que todos tengan la misma hora.
    if (this.multiplayer.active) this.sky.advance(realDt);
    else if (this.state === STATE.PLAYING) this.sky.advance(dt);
    this.multiplayer.update(dt);
    // Los animales se mueven jugando (o siempre, con una partida).
    if (this.inGame || this.multiplayer.active) {
      this.animals.update(dt, {
        world: this.world,
        players: this.animalPlayers(),
        simulate: this.state === STATE.PLAYING || this.multiplayer.active,
        camera: this.camera,
      });
    }

    if (this.state === STATE.TITLE) {
      // Fondo negro como el del logo y el personaje en su recuadro.
      this.renderer.setClearColor(TITLE_BG, 1);
      this.renderer.clear();
      this.preview.update(dt);
      this.preview.render(this.renderer, this.stageEl.getBoundingClientRect());
    } else {
      if (this.state === STATE.PLAYING) {
        const pad = this.controls.pad;
        if (this.controls.wasPressed('KeyV') || pad.wasPressed(PAD.X)) this.hud.toast(this.view.cycle());
        if (this.controls.wasPressed('KeyF') || pad.wasPressed(PAD.Y)) {
          this.player.setFlying(!this.player.flying);
          const { A, B } = pad.labels;
          const how = this.controls.lastDevice === 'pad' ? `${A} sube, ${B} baja` : 'Espacio sube, Shift baja';
          this.hud.toast(this.player.flying ? `Vuelo activado: ${how}` : 'Vuelo desactivado');
        }
        if (this.controls.wasPressed('F3')) this.hud.toggleDebug();
        this.player.update(dt, this.controls, this.world);
        this.footsteps.update(dt, this.player, this.world);
        this.updateHotbarInput();
        this.interaction.update(dt, this.controls);
        this.updateFov(dt);
        // Start pausa (con el mouse capturado, también lo suelta).
        if (pad.wasPressed(PAD.START)) this.controls.unlock();
        else if (this.controls.wasPressed('KeyE') || pad.wasPressed(PAD.BACK)) this.openInventory();
      }
      // Primero la cámara: decide si hay lugar para mostrar al personaje.
      this.view.update(this.player, this.world);
      this.updateAvatar(dt);
      // De frente la mira no marcaría el bloque apuntado: se oculta.
      this.hud.crosshair.hidden = this.view.mode === VIEW.FRONT && this.view.showsAvatar;
      // El bloque en la mano se ve solo cuando no se ve al personaje.
      this.heldItem.setVisible(!this.view.showsAvatar);
      this.heldItem.update(this.state === STATE.PLAYING ? dt : 0, this.player.horizontalSpeed);
      this.hotbar.update(dt);
      // Con la cámara bajo el agua todo se ve azul y cerca (en cualquier vista).
      const cam = this.camera.position;
      this.sky.setUnderwater(this.world.isWaterAt(cam.x, cam.y, cam.z));
      this.sky.update(this.camera, this.renderer.getPixelRatio());
      // De noche el contorno del bloque apuntado se aclara (si no, no se ve).
      this.outline.setDaylight(this.sky.daylight);
      if (this.hud.debugVisible) this.updateDebug();
      this.renderer.render(this.scene, this.camera);
    }

    this.hud.update(realDt);
    this.controls.endFrame();
  }
}

/** Mensaje de error visible si el navegador no soporta WebGL. */
function showFatalError(message) {
  const el = document.createElement('div');
  el.className = 'fatal-error';
  el.textContent = message;
  document.body.appendChild(el);
}

try {
  const game = new Game(document.getElementById('game'));
  // Acceso desde la consola del navegador para depurar: window.megabrick
  // (y la tabla de bloques en window.megabrick.bloques).
  window.megabrick = game;
  game.bloques = { BLOCK, getBlock };
} catch (err) {
  console.error(err);
  // Sin juego, el botón "Jugar" no haría nada: se desactiva y se avisa.
  document.getElementById('btn-play').disabled = true;
  document.querySelector('.title-actions')?.setAttribute('hidden', '');
  showFatalError(
    'Megabrick no pudo iniciar. Verificá que tu navegador tenga WebGL activado. Detalle: ' +
      (err?.message ?? err),
  );
}
