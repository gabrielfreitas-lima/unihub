// Desenho das teclas para o teste de teclas: posição física de cada tecla,
// identificada pelo `KeyboardEvent.code` (que é o mesmo em qualquer idioma).
// Medidas em "u" (largura de uma tecla comum).
//
// Formatos: 'full' (completo, 22,5 × 6,25 u, variantes ABNT2 e ANSI) e os
// desenhos de modelos AULA, em ABNT2: 'f75' (75%, botão giratório de volume,
// Fn no lugar do Ctrl direito), 'f87' (sem teclado numérico) e 'f99' (96%).

const letters = (s) => [...s].map((c) => `Key${c}`);
const digits = [...'1234567890'].map((c) => `Digit${c}`);
const fKeys = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `F${from + i}`);

/**
 * Uma linha: cada item é um código (1 u), [código, largura, altura] ou um
 * número (espaço vazio, em u).
 */
function row(y, items) {
  const keys = [];
  let x = 0;
  for (const item of items) {
    if (typeof item === 'number') { x += item; continue; }
    const [code, w = 1, h = 1] = Array.isArray(item) ? item : [item];
    keys.push({ code, x, y, w, h });
    x += w;
  }
  return keys;
}

const FUNCTION_ROW = ['Escape', 1, ...fKeys(1, 4), 0.5, ...fKeys(5, 8), 0.5, ...fKeys(9, 12), 0.25, 'PrintScreen', 'ScrollLock', 'Pause'];
const NUMBER_ROW = ['Backquote', ...digits, 'Minus', 'Equal', ['Backspace', 2], 0.25, 'Insert', 'Home', 'PageUp', 0.25,
  'NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'];
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
  if (shape === 'f75') return { width: 16, height: 6.25, keys: f75Keys(abnt2) };
  if (shape === 'f87') return { width: 18.25, height: 6.25, keys: f87Keys() };
  if (shape === 'f99') return { width: 19.5, height: 6.25, keys: f99Keys() };
  return { width: 22.5, height: 6.25, keys: fullKeys(abnt2) };
}

const withFn = (keys) => keys.map((k) => (k.code === 'Fn' ? { ...k, fixed: true } : k));

// AULA F87 (ABNT2): completo sem teclado numérico; Fn no lugar do Win direito.
// A tecla antes do Shift direito é a /? do ABNT2 (sem a ; separada).
function f87Keys() {
  return withFn([
    ...row(0, FUNCTION_ROW),
    ...row(1.25, NUMBER_ROW.slice(0, NUMBER_ROW.indexOf('NumLock') - 1)),
    ...row(2.25, [['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', 0.25, ['Enter', 1.25, 2],
      0.25, 'Delete', 'End', 'PageDown']),
    ...row(3.25, [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', 'Backslash']),
    ...row(4.25, [['ShiftLeft', 1.25], 'IntlBackslash', ...letters('ZXCVBNM'), 'Comma', 'Period', 'IntlRo',
      ['ShiftRight', 2.75], 1.25, 'ArrowUp']),
    ...row(5.25, [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], ['AltRight', 1.25],
      ['Fn', 1.25], ['ContextMenu', 1.25], ['ControlRight', 1.25], 0.25, 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
  ]);
}

// AULA F99 (ABNT2), 96%: Delete, Home, End, PgUp e PgDn na fileira de cima;
// setas encaixadas ao lado do teclado numérico; Alt Gr, Fn e Ctrl estreitos.
function f99Keys() {
  return withFn([
    ...row(0, ['Escape', 0.25, ...fKeys(1, 4), 0.25, ...fKeys(5, 8), 0.25, ...fKeys(9, 12), 0.25, 'Delete', 0.5,
      'Home', 'End', 'PageUp', 'PageDown']),
    ...row(1.25, ['Backquote', ...digits, 'Minus', 'Equal', ['Backspace', 2], 0.5,
      'NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract']),
    ...row(2.25, [['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', 0.25, ['Enter', 1.25, 2],
      0.5, 'Numpad7', 'Numpad8', 'Numpad9', ['NumpadAdd', 1, 2]]),
    ...row(3.25, [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', 'Backslash', 1.75,
      'Numpad4', 'Numpad5', 'Numpad6']),
    ...row(4.25, [['ShiftLeft', 1.25], 'IntlBackslash', ...letters('ZXCVBNM'), 'Comma', 'Period', 'IntlRo',
      ['ShiftRight', 1.75], 0.25, 'ArrowUp', 0.25, 'Numpad1', 'Numpad2', 'Numpad3', ['NumpadEnter', 1, 2]]),
    ...row(5.25, [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], 'AltRight', 'Fn',
      'ControlRight', 0.25, 'ArrowLeft', 'ArrowDown', 'ArrowRight', 0.25, 'Numpad0', 'NumpadDecimal']),
  ]);
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

// 75%: coluna da direita com Delete, PgUp, PgDn e End; botão de volume no
// canto de cima (girar = volume, apertar = mudo).
function f75Keys(abnt2) {
  return [
    ...row(0, ['Escape', 1, ...fKeys(1, 4), 0.25, ...fKeys(5, 8), 0.5, ...fKeys(9, 12), 0.25]),
    { code: 'Knob', codes: ['AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute'], x: 15, y: 0, w: 1, h: 1, round: true },
    ...row(1.25, ['Backquote', ...digits, 'Minus', 'Equal', ['Backspace', 2], 'Delete']),
    ...row(2.25, abnt2
      ? [['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', 0.25, ['Enter', 1.25, 2], 'PageUp']
      : [['Tab', 1.5], ...letters('QWERTYUIOP'), 'BracketLeft', 'BracketRight', ['Backslash', 1.5], 'PageUp']),
    ...row(3.25, abnt2
      ? [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', 'Backslash', 1.25, 'PageDown']
      : [['CapsLock', 1.75], ...letters('ASDFGHJKL'), 'Semicolon', 'Quote', ['Enter', 2.25], 'PageDown']),
    ...row(4.25, abnt2
      ? [['ShiftLeft', 1.25], 'IntlBackslash', ...letters('ZXCVBNM'), 'Comma', 'Period', 'IntlRo', ['ShiftRight', 1.75], 'ArrowUp', 'End']
      : [['ShiftLeft', 2.25], ...letters('ZXCVBNM'), 'Comma', 'Period', 'Slash', ['ShiftRight', 1.75], 'ArrowUp', 'End']),
    ...row(5.25, [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], ['AltRight', 1.25],
      ['Fn', 1.25], 0.5, 'ArrowLeft', 'ArrowDown', 'ArrowRight']).map((k) => (k.code === 'Fn' ? { ...k, fixed: true } : k)),
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
