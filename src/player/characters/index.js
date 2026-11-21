// Los personajes para elegir. El orden es el de la pantalla de inicio; el
// id viaja por la red y se guarda en las preferencias.

import * as normal from './normal.js';

export const CHARACTERS = [normal];

/** El de entrada. */
export const DEFAULT_CHARACTER = 'normal';

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));

/** ¿Es un id de personaje válido? */
export function isCharacter(id) {
  return typeof id === 'string' && byId.has(id);
}

/** El personaje de ese id (o el de entrada). */
export function getCharacter(id) {
  return byId.get(id) ?? byId.get(DEFAULT_CHARACTER);
}
