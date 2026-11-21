// Los personajes para elegir. El orden es el de la pantalla de inicio; el
// id viaja por la red y se guarda en las preferencias.

import * as normal from './normal.js';
import * as soldado from './soldado.js';
import * as vikingo from './vikingo.js';
import * as deportista from './deportista.js';
import * as skater from './skater.js';
import * as gaucho from './gaucho.js';
import * as astronauta from './astronauta.js';
import * as bombero from './bombero.js';

export const CHARACTERS = [normal, soldado, vikingo, deportista, skater, gaucho, astronauta, bombero];

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
