// Protocolo del multijugador: códigos de partida, tipos de mensaje y
// validación de lo que llega por la red.
//
// Todo mensaje que viene de otra computadora se trata como dato no confiable:
// se revisan tipos y rangos antes de usarlo, y lo que no cumple se descarta.

import { BLOCK, BLOCKS } from '../world/blocks.js';
import { CHUNK_HEIGHT } from '../world/Chunk.js';
import { DEFAULT_VARIANT, EXPRESSIONS, isVariant } from '../player/colors.js';
import { ACTIONS } from '../animals/Animal.js';
import { SPECIES_IDS } from '../animals/species/index.js';

/** Versión del protocolo: invitado y anfitrión tienen que coincidir. */
export const PROTOCOL_VERSION = 3;

/** Prefijo de los IDs en el servidor de PeerJS (evita choques con otras apps). */
const PEER_PREFIX = 'megabrick-v1-';

/** Máximo de jugadores en una partida (anfitrión incluido). */
export const MAX_PLAYERS = 6;

/** Largo máximo de un nombre de jugador. */
export const MAX_NAME = 16;

// Letras y números sin los que se confunden (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/** Tipos de mensaje. */
export const MSG = Object.freeze({
  HELLO: 'hello', // invitado → anfitrión: quiero entrar (nombre, color, versión)
  WELCOME: 'welcome', // anfitrión → invitado: semilla, cambios y jugadores
  REJECT: 'reject', // anfitrión → invitado: no se puede entrar (motivo)
  STATE: 'state', // posición y animación de un jugador
  EDIT: 'edit', // cambio de un bloque
  JOIN: 'join', // anfitrión → todos: entró alguien
  LEAVE: 'leave', // anfitrión → todos: se fue alguien
  TIME: 'time', // anfitrión → todos: hora del día (todos ven el mismo cielo)
  ANIMALS: 'animals', // anfitrión → todos: dónde está y qué hace cada animal
  ANIMAL: 'animal', // invitado → anfitrión: acaricia o empuja un animal
});

/** Máximo de animales en un mensaje. */
const MAX_ANIMALS = 64;

/** Código nuevo al azar, por ejemplo "K7QX2M". */
export function newRoomCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Código para mostrar, en dos grupos: "K7Q-X2M". */
export function formatCode(code) {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/**
 * Normaliza lo que escribe el jugador ("k7q x2m", "K7Q-X2M") a "K7QX2M".
 * Devuelve null si no es un código válido.
 */
export function parseCode(text) {
  const code = String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const ch of code) if (!CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** ID de PeerJS del anfitrión de una partida. */
export function peerIdForCode(code) {
  return PEER_PREFIX + code;
}

/**
 * Nombre limpio: sin caracteres de control ni de formato (los invisibles y
 * los que dan vuelta el texto), con los espacios juntos y largo máximo.
 */
export function sanitizeName(name) {
  const clean = String(name ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Se corta por caracteres (no por unidades UTF-16, que parten los emojis).
  return Array.from(clean).slice(0, MAX_NAME).join('').trim() || 'Jugador';
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const LIMIT = 1e7; // coordenadas razonables (más lejos, el terreno se rompe)

/** Valida una posición {x, y, z}. Devuelve una copia o null. */
export function cleanPosition(m) {
  if (!m || typeof m !== 'object') return null;
  const { x, y, z } = m;
  if (![x, y, z].every(isNum)) return null;
  if (Math.abs(x) > LIMIT || Math.abs(y) > LIMIT || Math.abs(z) > LIMIT) return null;
  return { x, y, z };
}

/**
 * Valida el estado de un jugador. Devuelve una copia limpia o null.
 * Campos: x, y, z, yaw, pitch, speed, flying, expr (expresión), held
 * (bloque en la mano), swing (contador de acciones, para animar el brazo),
 * color (del personaje, por si lo cambia durante la partida) y ts (la hora
 * de quien lo mandó, en segundos, para moverlo suave aunque los mensajes
 * lleguen a destiempo).
 */
export function cleanState(m) {
  const pos = cleanPosition(m);
  if (!pos) return null;
  const { yaw, pitch, speed } = m;
  if (![yaw, pitch, speed].every(isNum)) return null;
  return {
    ...pos,
    yaw,
    pitch: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)),
    speed: Math.max(0, Math.min(50, speed)),
    flying: Boolean(m.flying),
    expr: EXPRESSIONS.includes(m.expr) ? m.expr : 'normal',
    held: Number.isInteger(m.held) && BLOCKS[m.held]?.tiles ? m.held : BLOCK.GRASS,
    swing: Number.isInteger(m.swing) ? m.swing : 0,
    color: isVariant(m.color) ? m.color : null,
    ts: isNum(m.ts) ? m.ts : null,
  };
}

/** Valida un cambio de bloque. Devuelve {x, y, z, id} o null. */
export function cleanEdit(m) {
  if (!m || typeof m !== 'object') return null;
  const { x, y, z, id } = m;
  if (![x, y, z, id].every(Number.isInteger)) return null;
  if (Math.abs(x) > LIMIT || Math.abs(z) > LIMIT || y < 1 || y >= CHUNK_HEIGHT) return null;
  // Bloques que existen; el lecho primordial no se puede poner.
  if (!BLOCKS[id] || id === BLOCK.BEDROCK) return null;
  return { x, y, z, id };
}

/**
 * Valida la lista de animales del anfitrión (ver Animals.snapshot): un
 * array por animal con 11 enteros en rango. Los que no cumplen se descartan.
 * Devuelve la lista limpia o null.
 */
export function cleanAnimals(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  const ints = (a) => a.every(Number.isInteger);
  for (const a of list.slice(0, MAX_ANIMALS)) {
    if (!Array.isArray(a) || a.length !== 11 || !ints(a)) continue;
    const [id, sp, variant, x, y, z, yaw, action, lookYaw, lookPitch, speed] = a;
    if (id < 1 || id > 2 ** 31 || sp < 0 || sp >= SPECIES_IDS.length || variant < 0 || variant > 15) continue;
    if (Math.abs(x) > LIMIT * 100 || Math.abs(z) > LIMIT * 100 || y < 0 || y > CHUNK_HEIGHT * 100) continue;
    if (Math.abs(yaw) > 700 || action < 0 || action >= ACTIONS.length) continue;
    if (Math.abs(lookYaw) > 300 || Math.abs(lookPitch) > 300 || speed < 0 || speed > 300) continue;
    out.push(a);
  }
  return out;
}

/** Valida un pedido de acariciar o empujar un animal. Devuelve {id, act} o null. */
export function cleanAnimalAct(m) {
  if (!m || typeof m !== 'object' || !Number.isInteger(m.id) || (m.act !== 'pet' && m.act !== 'poke')) return null;
  return { id: m.id, act: m.act };
}

/** Valida la ficha de un jugador (id, nombre y color). */
export function cleanPlayerInfo(m) {
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id || m.id.length > 16) return null;
  return {
    id: m.id,
    name: sanitizeName(m.name),
    color: isVariant(m.color) ? m.color : DEFAULT_VARIANT,
  };
}
