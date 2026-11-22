// Romper y poner bloques: bloque apuntado (raycast DDA desde los ojos),
// contorno, clic izquierdo para romper y clic derecho para poner (con
// joystick, gatillo derecho y gatillo izquierdo).
//
// Romper pide mantener el botón: cada material tiene su resistencia (los
// segundos que tarda, ver `hardness` en blocks.js). Mientras tanto el
// bloque se agrieta y suena un golpecito; si se suelta o se apunta a otro,
// se empieza de nuevo.
//
// Los escalones, puertas, tranqueras y trampillas se ponen mirando hacia
// donde mira el jugador; la escalera de mano, contra la cara apuntada;
// una losa va arriba si se apunta a la mitad de arriba de una cara (o a un
// techo). Clic derecho sobre una puerta, tranquera o trampilla la abre o la
// cierra. Las plantas se reemplazan con lo que se pone sobre ellas.
//
// Si se apunta a un animal (más cerca que el bloque de atrás), clic derecho
// lo acaricia y clic izquierdo lo empuja.

import * as THREE from 'three';
import { BLOCK, SHAPE, getBlock } from '../world/blocks.js';
import { collisionBoxesAt, supportedBy } from '../world/shapes.js';
import { CHUNK_HEIGHT } from '../world/Chunk.js';
import { PAD } from './Gamepad.js';
import { raycast } from './Raycast.js';

/** Alcance en bloques. */
export const REACH = 6;
/** Tiempo entre bloques puestos al mantener apretado el botón (segundos). */
const REPEAT = 0.25;
/** Cada cuánto suena un golpe mientras se rompe (segundos). */
const HIT_EVERY = 0.25;

/** Se puede apuntar a todo lo que no sea aire ni líquido (el agua se atraviesa). */
const isTarget = (id) => id !== BLOCK.AIR && !getBlock(id).liquid;

/** Vecinos desde los que el agua llena un hueco: arriba y los 4 costados. */
const WATER_SOURCES = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
];
/** Mismo margen que usa la física del jugador (Player.js). */
const EPS = 1e-6;

export class BlockInteraction {
  /**
   * @param {object} o
   * @param {import('../world/World.js').World} o.world
   * @param {import('./Player.js').Player} o.player
   * @param {import('../ui/Hotbar.js').Hotbar} o.hotbar
   * @param {import('../render/BlockOutline.js').BlockOutline} o.outline
   * @param {(action: 'break' | 'place', id: number) => void} [o.onAction]
   * @param {import('../animals/Animals.js').Animals} [o.animals]
   * @param {(act: 'pet' | 'poke', animal: object) => void} [o.onAnimal]
   */
  constructor({ world, player, hotbar, outline, onAction, animals, onAnimal }) {
    this.world = world;
    this.player = player;
    this.hotbar = hotbar;
    this.outline = outline;
    this.onAction = onAction;
    this.animals = animals;
    this.onAnimal = onAnimal;
    this.target = null; // bloque apuntado (o null)
    this.animalTarget = null; // animal apuntado (o null)
    this._placeTimer = 0;
    this._placeHeld = false; // se abrió o cerró una puerta: no repetir hasta soltar
    this._breaking = false;
    this._mining = null; // bloque que se está rompiendo: "x,y,z,id"
    this._mineTime = 0; // segundos que lleva
    this._hitTimer = 0;
    // Después de acariciar o empujar un animal no se rompe ni se pone nada
    // hasta soltar los botones (si no, al irse el animal, se rompería el
    // bloque de atrás).
    this._afterAnimal = false;
    /** Cuánto falta para romperlo, de 0 a 1 (para las grietas). */
    this.breakProgress = 0;
    /**
     * Modo aventura (etapa 15): segundos que tarda en romperse un bloque
     * (según la herramienta en la mano) y aviso de lo que se rompió (para
     * juntarlo). Sin esto, la resistencia de siempre.
     * @type {((block: object) => number) | null}
     */
    this.breakTime = null;
    /** @type {((ids: number[]) => void) | null} */
    this.onBroken = null;
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  /** ¿Se está rompiendo (botón izquierdo apretado)? */
  get breaking() {
    return this._breaking;
  }

  /**
   * @param {number} dt segundos
   * @param {import('./Controls.js').Controls} controls
   */
  update(dt, controls) {
    const p = this.player;
    p.getEyePosition(this._eye);
    this._dir.set(
      -Math.sin(p.yaw) * Math.cos(p.pitch),
      Math.sin(p.pitch),
      -Math.cos(p.yaw) * Math.cos(p.pitch),
    );
    this.target = raycast(this.world, this._eye, this._dir, REACH, isTarget);
    this._placeTimer -= dt;
    const pad = controls.pad;

    // Un animal más cerca que el bloque: se lo acaricia o se lo empuja (un
    // toque por clic, sin repetir manteniendo el botón).
    const hit = this.animals?.raycast(this._eye, this._dir, REACH);
    this.animalTarget = hit && (!this.target || hit.distance < this.target.distance) ? hit.animal : null;
    if (this.animalTarget) {
      this._breaking = false;
      this._stopMining();
      this.outline.show(null);
      let act = null;
      if (controls.wasClicked(2) || pad.wasPressed(PAD.LT)) act = 'pet';
      else if (controls.wasClicked(0) || pad.wasPressed(PAD.RT)) act = 'poke';
      if (act) {
        this._afterAnimal = true;
        this.onAnimal?.(act, this.animalTarget);
      }
      return;
    }
    if (this._afterAnimal) {
      const held = controls.isMouseDown(0) || controls.isMouseDown(2) || pad.isDown(PAD.RT) || pad.isDown(PAD.LT);
      if (held) {
        this._breaking = false;
        this.outline.show(this.target);
        return;
      }
      this._afterAnimal = false;
    }

    // Romper: mantener el botón el tiempo que resiste el bloque.
    this._breaking = controls.isMouseDown(0) || pad.isDown(PAD.RT) || controls.wasClicked(0) || pad.wasPressed(PAD.RT);
    let changed = this._mine(dt);
    // Poner: al apretar actúa enseguida; si se mantiene, repite cada REPEAT
    // segundos. Una puerta se abre o se cierra solo al apretar: manteniendo
    // el botón no aletea ni pone bloques del otro lado (hasta soltarlo).
    const placing = controls.isMouseDown(2) || pad.isDown(PAD.LT);
    if (!placing) this._placeHeld = false;
    const pressed = controls.wasClicked(2) || pad.wasPressed(PAD.LT);
    if (pressed || (placing && !this._placeHeld && this._placeTimer <= 0)) {
      this._placeTimer = REPEAT;
      const onDoor = this.target && usable(this.target.id);
      if (onDoor) this._placeHeld = true;
      if (pressed || !onDoor) changed = this.placeAtTarget() || changed;
    }
    // Si el mundo cambió, el contorno va sobre el bloque que quedó apuntado.
    if (changed) this.target = raycast(this.world, this._eye, this._dir, REACH, isTarget);
    this.outline.show(this.target, this.breakProgress);
  }

  /**
   * Avanza la rotura del bloque apuntado mientras se mantiene el botón.
   * Devuelve true si se rompió.
   */
  _mine(dt) {
    const t = this.target;
    const block = t && getBlock(t.id);
    // Los golpes siguen su ritmo mientras se mantiene el botón, aunque cambie
    // el bloque apuntado (si no, moviendo la mira sonarían seguidos); al
    // apretar, el primero suena enseguida.
    if (this._breaking) this._hitTimer -= dt;
    else this._hitTimer = 0;
    if (!this._breaking || !block?.breakable) {
      this._stopMining();
      return false;
    }
    const key = `${t.x},${t.y},${t.z},${t.id}`;
    if (key !== this._mining) {
      // Otro bloque (o recién se aprieta): se empieza de cero.
      this._mining = key;
      this._mineTime = 0;
    }
    this._mineTime += dt;
    if (this._hitTimer <= 0) {
      this._hitTimer = HIT_EVERY;
      this.onAction?.('hit', t.id);
    }
    const seconds = this.breakTime ? this.breakTime(block) : block.hardness;
    this.breakProgress = Math.min(1, this._mineTime / seconds);
    if (this._mineTime < seconds) return false;
    this._stopMining();
    // El ruido de romper hace de golpe: el siguiente, un rato después.
    this._hitTimer = HIT_EVERY;
    return this.breakTarget();
  }

  _stopMining() {
    this._mining = null;
    this._mineTime = 0;
    this.breakProgress = 0;
  }

  /** Deja de "romper" (por ejemplo, al pausar con el botón apretado). */
  release() {
    this._breaking = false;
    this._hitTimer = 0;
    this._stopMining();
  }

  /**
   * Rompe el bloque apuntado (salvo los indestructibles). Una puerta se
   * rompe entera (sus dos mitades).
   */
  breakTarget() {
    const t = this.target;
    if (!t || !getBlock(t.id).breakable) return false;
    // La otra mitad de una puerta (se va con esta; se junta una sola puerta).
    const partner = doorPartner(this.world, t.x, t.y, t.z, t.id);
    if (!this._clear(t.x, t.y, t.z)) return false;
    if (partner) this._clear(t.x, partner.y, t.z);
    // Lo que se apoyaba en este bloque se cae con él: una planta arriba, un
    // cable o una palanca, la cabeza de un pistón.
    const broken = [t.id, ...this._dropAttached(t.x, t.y, t.z)];
    this.onAction?.('break', t.id);
    this.onBroken?.(broken);
    return true;
  }

  /**
   * Rompe lo que estaba sostenido por el bloque (x, y, z), que ya no está.
   * Devuelve los IDs que se rompieron.
   */
  _dropAttached(x, y, z) {
    const ids = [];
    for (const [nx, ny, nz] of supportedBy(this.world, x, y, z)) {
      const id = this.world.getBlock(nx, ny, nz);
      if (this._clear(nx, ny, nz)) ids.push(id);
    }
    return ids;
  }

  /**
   * Saca un bloque. Si tiene agua arriba o a un costado, el hueco se llena
   * de agua: no hay agua que fluya, pero así no quedan burbujas de aire ni
   * paredes de agua en el aire.
   */
  _clear(x, y, z) {
    const w = this.world;
    const wet = WATER_SOURCES.some(([dx, dy, dz]) => getBlock(w.getBlock(x + dx, y + dy, z + dz)).liquid);
    return w.editBlock(x, y, z, wet ? BLOCK.WATER : BLOCK.AIR);
  }

  /**
   * Pone el bloque elegido en la hotbar contra la cara apuntada (o, si se
   * apunta a una puerta, la abre o la cierra).
   */
  placeAtTarget() {
    const t = this.target;
    if (!t) return false;
    if (getBlock(t.id).shape === SHAPE.DOOR) return this._toggleDoor(t);
    if (getBlock(t.id).toggle !== undefined) return this._toggleBlock(t);
    // Sobre una planta (pasto alto, flores), va en su lugar.
    const [x, y, z] = getBlock(t.id).shape === SHAPE.PLANT ? [t.x, t.y, t.z] : t.place;
    // Origen dentro de un bloque (sin cara) o fuera del alto del mundo: nada.
    if (t.normal.every((n) => n === 0) || y < 1 || y >= CHUNK_HEIGHT) return false;
    if (!this._isFree(x, y, z)) return false;
    const item = this.hotbar.selectedBlock;
    if (item === null) return false; // en la mano no hay un bloque (modo aventura)
    const block = getBlock(item);
    if (block.shape === SHAPE.DOOR) return this._placeDoor(x, y, z, block);
    // Las plantas van sobre tierra (y no adentro del agua).
    if (block.soil && (!block.soil.includes(this.world.getBlock(x, y - 1, z)) || getBlock(this.world.getBlock(x, y, z)).liquid)) return false;
    const id = this._variantFor(block, t);
    if (id === null) return false;
    // Lo que se apoya en otro bloque (cable, palanca, compuerta) necesita uno entero ahí.
    const a = getBlock(id).attach;
    if (a && !holds(getBlock(this.world.getBlock(x + a[0], y + a[1], z + a[2])))) return false;
    if (this._intersectsPlayer(x, y, z, id)) return false;
    if (!this.world.editBlock(x, y, z, id)) return false;
    this.hotbar.useSelected?.();
    this.onAction?.('place', id);
    return true;
  }

  /** ¿Se puede poner algo en (x, y, z)? En aire, agua o una planta (se reemplazan). */
  _isFree(x, y, z) {
    const current = getBlock(this.world.getBlock(x, y, z));
    return current.id === BLOCK.AIR || current.liquid || current.shape === SHAPE.PLANT;
  }

  /** Hacia dónde mira el jugador, redondeado a norte, este, sur u oeste (ver FACING). */
  get facing() {
    // yaw 0 mira al norte (-Z) y crece girando a la izquierda (al oeste).
    const quarter = ((Math.round(this.player.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    return (4 - quarter) % 4;
  }

  /**
   * El bloque a poner según la forma: el escalón mirando como el jugador, la
   * losa arriba si se apunta a un techo o a la mitad de arriba de una cara.
   */
  _variantFor(block, t) {
    // Palanca y botón: en el piso o en la pared apuntada (en el techo, no).
    if (block.places) {
      const [nx, ny, nz] = t.normal;
      if (ny === 1) return block.places[0];
      if (ny === -1) return null;
      const f = nz === -1 ? 0 : nx === 1 ? 1 : nz === 1 ? 2 : 3;
      return block.places[1 + f];
    }
    // Pistón: empuja hacia donde mira el jugador (también arriba o abajo).
    if (block.circuit === 'piston') {
      const pitch = this.player.pitch;
      return block.variants[pitch > 0.75 ? 4 : pitch < -0.75 ? 5 : this.facing];
    }
    if (block.circuit === 'inverter' || block.circuit === 'repeater') return block.variants[this.facing];
    if (block.shape === SHAPE.TRAPDOOR && block.upperVariants && upperHalf(t)) return block.upperVariants[this.facing];
    if (block.shape === SHAPE.STAIRS || block.shape === SHAPE.GATE || block.shape === SHAPE.TRAPDOOR) {
      return block.variants[this.facing];
    }
    if (block.shape === SHAPE.LADDER) {
      // Contra la cara apuntada (de espaldas a ella); apuntando al piso o al
      // techo, contra la pared de enfrente.
      const [nx, , nz] = t.normal;
      const f = nz === -1 ? 0 : nx === 1 ? 1 : nz === 1 ? 2 : nx === -1 ? 3 : (this.facing + 2) % 4;
      return block.variants[f];
    }
    if (block.shape === SHAPE.SLAB && block.slabTop) return upperHalf(t) ? block.slabTop : block.id;
    return block.id;
  }

  /** Pone una puerta: necesita dos lugares libres, uno arriba del otro. */
  _placeDoor(x, y, z, block) {
    if (y + 1 >= CHUNK_HEIGHT || !this._isFree(x, y + 1, z)) return false;
    const f = this.facing;
    const bottom = block.doorIds[`${f}00`];
    const top = block.doorIds[`${f}01`];
    if (this._intersectsPlayer(x, y, z, bottom) || this._intersectsPlayer(x, y + 1, z, top)) return false;
    if (!this.world.editBlock(x, y, z, bottom)) return false;
    this.world.editBlock(x, y + 1, z, top);
    this.hotbar.useSelected?.();
    this.onAction?.('place', bottom);
    return true;
  }

  /** Abre o cierra la tranquera o la trampilla apuntada. */
  _toggleBlock(t) {
    const next = getBlock(t.id).toggle;
    // Al cerrarla no puede quedar adentro del jugador.
    if (this._intersectsPlayer(t.x, t.y, t.z, next)) return false;
    if (!this.world.editBlock(t.x, t.y, t.z, next)) return false;
    this.onAction?.('place', t.id);
    return true;
  }

  /** Abre o cierra la puerta apuntada (las dos mitades). */
  _toggleDoor(t) {
    const door = getBlock(t.id);
    // Las dos mitades quedan en el mismo estado: el contrario de la apuntada.
    const idFor = (upper) => door.doorIds[`${door.facing}${door.open ? 0 : 1}${upper ? 1 : 0}`];
    const next = idFor(door.upper);
    const partner = doorPartner(this.world, t.x, t.y, t.z, t.id);
    const partnerNext = idFor(!door.upper);
    // Al cerrarla, ninguna de las dos mitades puede quedar adentro del jugador.
    if (this._intersectsPlayer(t.x, t.y, t.z, next)) return false;
    if (partner && this._intersectsPlayer(t.x, partner.y, t.z, partnerNext)) return false;
    if (!this.world.editBlock(t.x, t.y, t.z, next)) return false;
    if (partner) this.world.editBlock(t.x, partner.y, t.z, partnerNext);
    this.onAction?.('place', t.id);
    return true;
  }

  /**
   * ¿El bloque `id` en (x, y, z) se superpondría con la caja del jugador?
   * Usa las cajas de choque, igual que la física: nunca se pone algo que la
   * física considere "adentro" del jugador (pero una losa de arriba sí se
   * puede poner sobre la cabeza si queda lugar).
   */
  _intersectsPlayer(x, y, z, id) {
    const boxes = collisionBoxesAt(this.world, x, y, z, id);
    if (!boxes) return false;
    const p = this.player.position;
    const half = this.player.width / 2;
    const lo = [p.x - half, p.y, p.z - half];
    const hi = [p.x + half, p.y + this.player.height, p.z + half];
    const cell = [x, y, z];
    return boxes.some((b) => [0, 1, 2].every((a) => cell[a] + b[a] < hi[a] - EPS && cell[a] + b[a + 3] > lo[a] + EPS));
  }
}

/** ¿El bloque sostiene a otro apoyado (un cubo sólido entero)? */
function holds(b) {
  return b.solid && !b.boxes;
}

/** ¿Va arriba en su celda? Si se apunta a un techo o a la mitad de arriba de una cara. */
function upperHalf(t) {
  const [, ny] = t.normal;
  return ny === -1 || (ny === 0 && t.point[1] - Math.floor(t.point[1]) > 0.5);
}

/** ¿Se usa con clic derecho (puerta, tranquera, trampilla) en vez de poner algo contra él? */
function usable(id) {
  const b = getBlock(id);
  return b.shape === SHAPE.DOOR || b.toggle !== undefined;
}

/**
 * La otra mitad de una puerta: la de arriba o la de abajo, si es la misma
 * puerta (misma orientación y estado). null si no es una puerta o no está.
 */
function doorPartner(world, x, y, z, id) {
  const door = getBlock(id);
  if (door.shape !== SHAPE.DOOR) return null;
  const py = door.upper ? y - 1 : y + 1;
  const other = getBlock(world.getBlock(x, py, z));
  if (other.doorIds !== door.doorIds || other.facing !== door.facing || other.upper === door.upper) return null;
  return { y: py, id: other.id };
}
