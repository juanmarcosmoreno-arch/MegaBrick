// Los animales del mundo: aparecen en grupos sobre el pasto cerca de los
// jugadores, se van cuando quedan lejos y se dibujan con el modelo de su
// especie. Acariciarlos (clic derecho) los pone contentos y te siguen un
// rato; empujarlos (clic izquierdo) los hace escapar. No se guardan: cada
// vez que se abre un mundo aparecen otros.
//
// Multijugador: los simula el anfitrión (también alrededor de los invitados,
// dentro de la zona que él tiene cargada) y manda cada NET_INTERVAL
// segundos dónde está cada uno; los invitados los mueven parejo hacia ahí
// y le piden al anfitrión acariciarlos o empujarlos.

import * as THREE from 'three';
import { ACTIONS, Animal, groundBelow } from './Animal.js';
import { SPECIES_IDS, getKind, randomSpecies } from './species/index.js';
import { BLOCK } from '../world/blocks.js';
import { CHUNK_HEIGHT } from '../world/Chunk.js';
import { moveAxis } from '../world/collision.js';

/** Cada cuánto se prueba hacer aparecer un grupo (segundos). */
const SPAWN_EVERY = 1.2;
/** Animales cerca de cada jugador (en ese radio) y en total. */
const NEAR_RADIUS = 48;
const MAX_NEAR = 10;
const MAX_TOTAL = 30;
/** Aparecen entre estas distancias del jugador, y no adelante de él (donde se vería). */
const SPAWN_MIN = 20;
const SPAWN_MAX = 44;
/**
 * Se van más lejos que esto de todos los jugadores, salvo que alguno los
 * esté viendo (adelante de él y más cerca que la niebla).
 */
const DESPAWN = 72;
/** Hacia dónde mira un jugador: lo que está a menos de ~60° de adelante. */
const IN_VIEW = 0.5;
/** Hasta dónde se escuchan. */
const HEARING = 20;
/** Lejos de la cámara, el modelo se anima menos seguido. */
const FAR_ANIMATION = 36;
/** Qué tan rápido se separan dos animales encimados (por segundo). */
const SEPARATE_RATE = 6;
/** Cada cuánto manda el anfitrión los animales (segundos). */
export const NET_INTERVAL = 0.2;

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

export class Animals {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {import('../audio/Sounds.js').Sounds} o.sounds
   */
  constructor({ scene, sounds }) {
    this.sounds = sounds;
    this.group = new THREE.Group();
    this.group.name = 'animales';
    scene.add(this.group);
    /** @type {Map<number, Animal>} */
    this.list = new Map();
    /** true: los manda el anfitrión (este juego es un invitado). */
    this.remote = false;
    this._nextId = 1;
    this._spawnTimer = 0;
    this._time = 0;
    this._frame = 0;
    this.hearts = new Hearts(this.group);
  }

  get count() {
    return this.list.size;
  }

  /** Saca todos los animales (al cambiar de mundo, o al entrar o salir de una partida). */
  reset({ remote = this.remote } = {}) {
    for (const a of [...this.list.values()]) this._remove(a);
    this.remote = remote;
    this._spawnTimer = 0;
  }

  /**
   * Un frame.
   * @param {number} dt
   * @param {object} o
   * @param {object} o.world
   * @param {{id: string, x: number, y: number, z: number, yaw?: number}[]} o.players
   *   jugadores alrededor de los que hay animales (el primero es el local)
   * @param {boolean} o.simulate si se mueven (no en la pausa jugando solo)
   * @param {THREE.Camera} o.camera
   * @param {number} [o.viewDistance] hasta dónde se ve (la niebla)
   */
  update(dt, { world, players, simulate, camera, viewDistance = DESPAWN * 2 }) {
    this._frame++;
    if (simulate) this._time += dt;
    if (!this.remote && simulate) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        this._spawnTimer = SPAWN_EVERY;
        this._despawn(world, players, viewDistance);
        this._spawn(world, players, viewDistance);
      }
      for (const a of this.list.values()) a.update(dt, world, players);
      this._separate(world, dt);
    } else if (this.remote) {
      for (const a of this.list.values()) followNet(a, dt);
    }
    const me = players[0];
    for (const a of this.list.values()) {
      if (simulate) this._calls(a, dt, me);
      this._draw(a, simulate ? dt : 0, camera);
    }
    this.hearts.update(simulate ? dt : 0);
  }

  /**
   * Que no se encimen: dos animales que se tocan se separan de a poco (sin
   * meterse en los bloques). Son pocos, así que se prueban todos los pares.
   */
  _separate(world, dt) {
    const list = [...this.list.values()];
    const k = Math.min(1, dt * SEPARATE_RATE);
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const pa = a.position;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const pb = b.position;
        const reach = a.radius + b.radius;
        let dx = pb.x - pa.x;
        let dz = pb.z - pa.z;
        if (Math.abs(dx) >= reach || Math.abs(dz) >= reach || Math.abs(pb.y - pa.y) >= Math.min(a.height, b.height)) continue;
        let d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        if (d < 1e-4) {
          // Justo en el mismo lugar: para un lado cualquiera (fijo para el par).
          const angle = a.id * 2.4 + b.id;
          dx = Math.sin(angle);
          dz = Math.cos(angle);
          d = 1;
        }
        const push = ((reach - Math.min(d, reach)) / 2) * k;
        const ux = (dx / d) * push;
        const uz = (dz / d) * push;
        moveAxis(world, pa, a.halfWidth, a.height, 0, -ux);
        moveAxis(world, pa, a.halfWidth, a.height, 2, -uz);
        moveAxis(world, pb, b.halfWidth, b.height, 0, ux);
        moveAxis(world, pb, b.halfWidth, b.height, 2, uz);
      }
    }
  }

  /** Ubica y anima el modelo de un animal (lejos, menos seguido). */
  _draw(a, dt, camera) {
    const m = a.model;
    const p = a.position;
    m.root.position.set(p.x, p.y, p.z);
    m.root.rotation.y = a.yaw;
    a._animDt = (a._animDt ?? 0) + dt;
    const far = Math.hypot(p.x - camera.position.x, p.z - camera.position.z) > FAR_ANIMATION;
    if (far && (this._frame + a.id) % 3 !== 0) return;
    const state = a.modelState;
    state.t = this._time;
    m.update(Math.min(0.1, a._animDt), state);
    a._animDt = 0;
  }

  /** Cada tanto hace su sonido (si se lo escucha). */
  _calls(a, dt, me) {
    a.callTimer -= dt;
    if (a.callTimer > 0) return;
    a.callTimer = rand(...a.kind.callEvery);
    this._sound(a, me, 'call');
  }

  _sound(a, me, mood) {
    if (!me) return;
    const d = Math.hypot(a.position.x - me.x, a.position.y - me.y, a.position.z - me.z);
    if (d > HEARING) return;
    this.sounds.call(a.species, mood, 1 - d / HEARING);
  }

  /**
   * Acariciar o empujar un animal.
   * @param {number} id
   * @param {'pet' | 'poke'} act
   * @param {{id: string, x: number, y: number, z: number}} player quien lo hace
   * @param {{x: number, y: number, z: number}} [listener] el jugador local (para el sonido)
   */
  act(id, act, player, listener = player) {
    const a = this.list.get(id);
    if (!a || this.remote) return false;
    if (act === 'pet') {
      a.pet(player);
      a.pets = (a.pets + 1) & 255;
      this._petEffects(a, listener);
    } else {
      a.poke(player);
      this._sound(a, listener, 'scared');
    }
    return true;
  }

  _petEffects(a, listener) {
    this.hearts.burst(a.position.x, a.position.y + a.height + 0.1, a.position.z);
    this._sound(a, listener, 'happy');
  }

  /** El animal al que apunta un rayo (el más cercano), o null. */
  raycast(origin, dir, maxDistance) {
    let best = null;
    for (const a of this.list.values()) {
      const t = rayBox(origin, dir, a);
      if (t !== null && t <= maxDistance && (!best || t < best.distance)) best = { animal: a, distance: t };
    }
    return best;
  }

  /** Hace aparecer un grupo cerca de algún jugador que tenga pocos animales. */
  _spawn(world, players, viewDistance) {
    if (this.list.size >= MAX_TOTAL) return;
    for (const pl of players) {
      let near = 0;
      for (const a of this.list.values()) if (Math.hypot(a.position.x - pl.x, a.position.z - pl.z) < NEAR_RADIUS) near++;
      if (near >= MAX_NEAR) continue;
      const angle = rand(0, Math.PI * 2);
      const d = rand(SPAWN_MIN, SPAWN_MAX);
      const x = pl.x + Math.sin(angle) * d;
      const z = pl.z + Math.cos(angle) * d;
      // Donde no se los vea aparecer: no adelante de ningún jugador que
      // llegue a verlo (más cerca que la niebla).
      if (players.some((other) => Math.hypot(x - other.x, z - other.z) < viewDistance && inView(other, x, z))) continue;
      const species = randomSpecies();
      const kind = getKind(species);
      const variants = kind.info.variants?.length ?? 1;
      // Casi todo el grupo de la misma variante, a veces alguna distinta.
      const base = Math.floor(Math.random() * variants);
      const n = randInt(kind.group);
      let made = 0;
      for (let i = 0; i < n * 3 && made < n && this.list.size < MAX_TOTAL; i++) {
        const gx = Math.floor(x + rand(-3, 3)) + 0.5;
        const gz = Math.floor(z + rand(-3, 3)) + 0.5;
        const spot = grassAt(world, gx, gz);
        if (!spot || this._occupied(gx, spot, gz)) continue;
        const variant = Math.random() < 0.8 ? base : Math.floor(Math.random() * variants);
        this._add(new Animal(this._nextId++, species, kind, variant, gx, spot, gz));
        made++;
      }
      if (made) return;
    }
  }

  /** ¿Ya hay un animal en ese bloque? */
  _occupied(x, y, z) {
    for (const a of this.list.values()) {
      const p = a.position;
      if (Math.floor(p.x) === Math.floor(x) && Math.floor(p.z) === Math.floor(z) && Math.abs(p.y - y) < 1) return true;
    }
    return false;
  }

  /**
   * Saca los que quedaron lejos de todos los jugadores (y nadie los ve irse)
   * y los que quedaron fuera de lo cargado (en el multijugador, cerca de un
   * invitado que se alejó del anfitrión: ahí no se pueden mover).
   */
  _despawn(world, players, viewDistance) {
    for (const a of [...this.list.values()]) {
      const p = a.position;
      const keep = players.some((pl) => {
        const d = Math.hypot(p.x - pl.x, p.z - pl.z);
        return d < DESPAWN || (d < viewDistance && inView(pl, p.x, p.z));
      });
      if (!keep || !world.isLoadedAt(p.x, p.z)) this._remove(a);
    }
  }

  _add(a) {
    a.model = a.kind.module.createModel(THREE, { variant: a.variant });
    a.model.root.name = a.species;
    this.group.add(a.model.root);
    this.list.set(a.id, a);
    return a;
  }

  _remove(a) {
    this.group.remove(a.model.root);
    a.model.dispose();
    this.list.delete(a.id);
  }

  /**
   * Para mandar a los invitados: un array por animal
   * [id, especie, variante, x, y, z, yaw, acción, mirada yaw, mirada pitch, velocidad, caricias]
   * con los números redondeados (centímetros y centésimas).
   */
  snapshot() {
    const out = [];
    for (const a of this.list.values()) {
      const p = a.position;
      out.push([
        a.id,
        SPECIES_IDS.indexOf(a.species),
        a.variant,
        Math.round(p.x * 100),
        Math.round(p.y * 100),
        Math.round(p.z * 100),
        Math.round(a.yaw * 100),
        ACTIONS.indexOf(a.action),
        Math.round(a.lookYaw * 100),
        Math.round(a.lookPitch * 100),
        Math.round(a.speed * 10),
        a.pets,
      ]);
    }
    return out;
  }

  /**
   * Lo que mandó el anfitrión (ya validado, ver protocol.js): crea, mueve y
   * saca animales. Los corazones salen cuando cambia la cuenta de caricias
   * (aunque ya estuviera contento) y el susto cuando cambia la acción.
   * @param {Array<number[]>} list
   * @param {{x: number, y: number, z: number}} listener el jugador local
   */
  applySnapshot(list, listener) {
    if (!this.remote) return;
    const seen = new Set();
    for (const [id, sp, variant, x, y, z, yaw, action, lookYaw, lookPitch, speed, pets] of list) {
      const species = SPECIES_IDS[sp];
      const kind = getKind(species);
      if (!kind) continue;
      seen.add(id);
      let a = this.list.get(id);
      const net = { x: x / 100, y: y / 100, z: z / 100, yaw: yaw / 100 };
      if (!a || a.species !== species || a.variant !== variant) {
        if (a) this._remove(a);
        const v = Math.min(variant, (kind.info.variants?.length ?? 1) - 1);
        a = this._add(new Animal(id, species, kind, v, net.x, net.y, net.z));
        a.yaw = net.yaw;
        a.pets = pets;
      }
      // Se mueve parejo desde donde está hasta el dato nuevo (ver followNet).
      a.from = { x: a.position.x, y: a.position.y, z: a.position.z, yaw: a.yaw };
      a.netAge = 0;
      a.net = net;
      if (pets !== a.pets) this._petEffects(a, listener);
      a.pets = pets;
      const act = ACTIONS[action] ?? 'idle';
      if (act !== a.action && act === 'scared') this._sound(a, listener, 'scared');
      a.action = act;
      a.lookYaw = lookYaw / 100;
      a.lookPitch = lookPitch / 100;
      a.speed = speed / 10;
    }
    for (const a of [...this.list.values()]) if (!seen.has(a.id)) this._remove(a);
  }

  dispose() {
    this.reset();
    this.hearts.dispose();
    this.group.removeFromParent();
  }
}

/**
 * Invitado: el animal va de donde estaba cuando llegó el último dato hasta
 * ese dato en NET_INTERVAL segundos, a velocidad pareja (con un suavizado
 * exponencial avanzaría a tirones, rápido apenas llega cada dato).
 */
function followNet(a, dt) {
  const n = a.net;
  if (!n) return;
  const p = a.position;
  const f = a.from;
  // Si quedó muy lejos (recién llegado o un salto), directamente ahí.
  if (Math.hypot(n.x - f.x, n.y - f.y, n.z - f.z) > 4) {
    p.x = f.x = n.x;
    p.y = f.y = n.y;
    p.z = f.z = n.z;
    a.yaw = f.yaw = n.yaw;
    return;
  }
  a.netAge += dt;
  // Un poco más que NET_INTERVAL: si el dato siguiente se demora un poco, no se frena.
  const k = Math.min(1, a.netAge / (NET_INTERVAL * 1.25));
  p.x = f.x + (n.x - f.x) * k;
  p.y = f.y + (n.y - f.y) * k;
  p.z = f.z + (n.z - f.z) * k;
  const d = Math.atan2(Math.sin(n.yaw - f.yaw), Math.cos(n.yaw - f.yaw));
  a.yaw = f.yaw + d * k;
}

/** ¿(x, z) está adelante del jugador `pl` (a donde mira)? Sin `yaw`, no se sabe: no. */
function inView(pl, x, z) {
  if (pl.yaw === undefined) return false;
  const dx = x - pl.x;
  const dz = z - pl.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return (dx * -Math.sin(pl.yaw) + dz * -Math.cos(pl.yaw)) / d > IN_VIEW;
}

/**
 * Altura donde apoyaría las patas un animal en (x, z): el primer bloque de
 * arriba hacia abajo tiene que ser césped natural (no uno puesto por un
 * jugador: nada de techos ni torres de pasto) con lugar libre encima. Si no, null.
 */
function grassAt(world, x, z) {
  if (!world.isLoadedAt(x, z)) return null;
  const bx = Math.floor(x);
  const bz = Math.floor(z);
  for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
    const id = world.getBlock(bx, y, bz);
    if (id === BLOCK.AIR) continue;
    if (id !== BLOCK.GRASS || world.isEditedAt(bx, y, bz)) return null;
    return groundBelow(world, x, y + 0.5, z, 1)?.y ?? null;
  }
  return null;
}

/**
 * Distancia por el rayo hasta el animal, o null si no lo toca: contra la
 * caja de lo que ocupa su modelo (info.bounds), girada como él.
 */
function rayBox(o, d, a) {
  const p = a.position;
  const b = a.kind.bounds;
  const side = Math.max(a.halfWidth, b?.side ?? 0);
  const min = [-side, 0, -(b?.front ?? a.halfWidth)];
  const max = [side, Math.max(a.height, b?.top ?? 0), b?.back ?? a.halfWidth];
  // El rayo, en el espacio del animal (sin su giro: adelante es -Z).
  const c = Math.cos(a.yaw);
  const s = Math.sin(a.yaw);
  const ox = o.x - p.x;
  const oz = o.z - p.z;
  const org = [ox * c - oz * s, o.y - p.y, ox * s + oz * c];
  const dir = [d.x * c - d.z * s, d.y, d.x * s + d.z * c];
  let tNear = 0;
  let tFar = Infinity;
  for (let i = 0; i < 3; i++) {
    if (dir[i] === 0) {
      if (org[i] < min[i] || org[i] > max[i]) return null;
      continue;
    }
    let t0 = (min[i] - org[i]) / dir[i];
    let t1 = (max[i] - org[i]) / dir[i];
    if (t0 > t1) [t0, t1] = [t1, t0];
    tNear = Math.max(tNear, t0);
    tFar = Math.min(tFar, t1);
    if (tNear > tFar) return null;
  }
  return tNear;
}

/** Corazoncitos que suben y se desvanecen al acariciar un animal. */
class Hearts {
  constructor(parent) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    // Corazón de pixel art (8×8 escalado ×4), rojo con brillo.
    const shape = ['.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........', '........'];
    shape.forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c !== '#') return;
        ctx.fillStyle = (x === 1 && y === 1) || (x === 2 && y === 1) ? '#ffb3c1' : '#e8435a';
        ctx.fillRect(x * 4, y * 4, 4, 4);
      });
    });
    this.texture = new THREE.CanvasTexture(canvas);
    // Pixelado también de lejos (sin mipmaps, que lo dejan borroso).
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, fog: false });
    this.parent = parent;
    this.items = [];
  }

  burst(x, y, z) {
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(this.material.clone());
      s.scale.setScalar(0.32);
      s.position.set(x + rand(-0.3, 0.3), y + rand(0, 0.2), z + rand(-0.3, 0.3));
      s.userData.life = 1.3 + i * 0.12;
      s.userData.age = -i * 0.12;
      s.visible = false;
      this.parent.add(s);
      this.items.push(s);
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const s = this.items[i];
      s.userData.age += dt;
      const { age, life } = s.userData;
      s.visible = age >= 0;
      if (age < 0) continue;
      s.position.y += dt * 0.8;
      s.material.opacity = Math.max(0, 1 - age / life);
      if (age >= life) {
        s.removeFromParent();
        s.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const s of this.items) {
      s.removeFromParent();
      s.material.dispose();
    }
    this.items.length = 0;
    this.material.dispose();
    this.texture.dispose();
  }
}
