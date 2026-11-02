// Lista de plugins (um por tipo de aparelho). Para adicionar um, importe aqui.
// Ordem = ordem das abas.

import gamepads from './gamepads/plugin.js';
import headsets from './headsets/plugin.js';
import keyboards from './keyboards/plugin.js';
import hidExplorer from './hid-explorer.js';

export const plugins = [gamepads, headsets, keyboards, hidExplorer];
