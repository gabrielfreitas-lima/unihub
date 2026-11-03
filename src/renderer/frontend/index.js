// Lista de abas do app (uma por tipo de aparelho). Para adicionar uma, importe
// aqui. O que cada marca sabe fazer fica em plugins/<tipo>/<marca>/.
// Ordem = ordem das abas.

import gamepads from './gamepads/tab.js';
import headsets from './headsets/tab.js';
import keyboards from './teclados/tab.js';
import mouses from './mouses/tab.js';
import hidExplorer from './hid-explorer.js';

export const plugins = [gamepads, headsets, keyboards, mouses, hidExplorer];
