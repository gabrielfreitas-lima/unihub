// Desenho das teclas para o teste de teclas: posição física de cada tecla,
// identificada pelo `KeyboardEvent.code` (que é o mesmo em qualquer idioma).
// Medidas em "u" (largura de uma tecla comum).
//
// Aqui fica o teclado padrão ('full', completo, 22,5 × 6,25 u, variantes ABNT2 e
// ANSI). Formatos de uma marca ficam no plugin dela (ex.: aula/layouts.js).

import { letters, row, FUNCTION_ROW, NUMBER_ROW } from './layout-rows.js';
import { AULA_LAYOUTS } from './aula/layouts.js';

const NAV_2 = [0.25, 'Delete', 'End', 'PageDown', 0.25, 'Numpad7', 'Numpad8', 'Numpad9', ['NumpadAdd', 1, 2]];
const NUMPAD_3 = [3.5, 'Numpad4', 'Numpad5', 'Numpad6'];
const NUMPAD_4 = [1.25, 'ArrowUp', 1.25, 'Numpad1', 'Numpad2', 'Numpad3', ['NumpadEnter', 1, 2]];
const BOTTOM_ROW = [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], ['AltRight', 1.25],
  ['MetaRight', 1.25], ['ContextMenu', 1.25], ['ControlRight', 1.25], 0.25, 'ArrowLeft', 'ArrowDown', 'ArrowRight', 0.25,
  ['Numpad0', 2], 'NumpadDecimal'];

const ROWS = {
  ansi: [
    ['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', ['Backslash', 1.5], ...NAV_2,
  ],
  abnt2: [
    // Enter alto (ocupa a linha de baixo também), como no ABNT2.
    ['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', 0.25, ['Enter', 1.25, 2], ...NAV_2,
  ],
};

/**
 * Desenho do teclado: { width, height, keys }, cada tecla com { code, x, y, w, h }
 * em u. Tecla com `codes` acende com qualquer um deles (ex.: o botão de volume);
 * com `fixed`, só é desenhada (o Fn não chega ao Windows).
 */
export function keyboardLayout(kind, shape = 'full') {
  const abnt2 = kind === 'abnt2';
  if (AULA_LAYOUTS[shape]) return AULA_LAYOUTS[shape](abnt2);
  return { width: 22.5, height: 6.25, keys: fullKeys(abnt2) };
}

function fullKeys(abnt2) {
  return [
    ...row(0, FUNCTION_ROW),
    ...row(1.25, NUMBER_ROW),
    ...row(2.25, ROWS[abnt2 ? 'abnt2' : 'ansi']),
    ...row(3.25, abnt2
      ? [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', 'Backslash', 1.25, ...NUMPAD_3]
      : [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', ['Enter', 2.25], ...NUMPAD_3]),
    ...row(4.25, abnt2
      ? [['ShiftLeft', 1.25], 'IntlBackslash', ...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash', 'IntlRo', ['ShiftRight', 1.75], ...NUMPAD_4]
      : [['ShiftLeft', 2.25], ...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash', ['ShiftRight', 2.75], ...NUMPAD_4]),
    ...row(5.25, BOTTOM_ROW),
  ];
}

/** Layout padrão pelo idioma do sistema: ABNT2 para português do Brasil. */
export function defaultLayout(language = '') {
  return /^pt-br/i.test(language) ? 'abnt2' : 'ansi';
}

// Nome das teclas que não escrevem nada (as que escrevem vêm do layout do Windows).
const NAMES = {
  Escape: 'Esc', Backspace: '⌫', Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Win', MetaRight: 'Win', AltLeft: 'Alt', AltRight: 'Alt Gr',
  ContextMenu: 'Menu', Space: '', PrintScreen: 'PrtSc', ScrollLock: 'ScrLk', Pause: 'Pause', Insert: 'Ins', Home: 'Home',
  PageUp: 'PgUp', Delete: 'Del', End: 'End', PageDown: 'PgDn', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←',
  ArrowRight: '→', NumLock: 'Num', NumpadDivide: '/', NumpadMultiply: '*', NumpadSubtract: '−', NumpadAdd: '+',
  NumpadEnter: 'Enter', NumpadDecimal: ',', Fn: 'Fn', Knob: '🔊',
};

// Teclas que escrevem, no layout US (usado se o Windows não informar o layout).
const US = {
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
  Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\', IntlRo: '/',
};

/**
 * Texto da tecla. `layoutMap` é o mapa do Windows (navigator.keyboard), com o
 * caractere de cada tecla no layout em uso; sem ele, vale o US.
 */
export function keyLabel(code, layoutMap = null) {
  if (code in NAMES) return NAMES[code];
  if (code.startsWith('F') && /^F\d+$/.test(code)) return code;
  if (code.startsWith('Numpad')) return code.slice(6);
  const fromSystem = layoutMap?.get?.(code);
  if (fromSystem) return fromSystem.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return US[code] ?? code;
}
