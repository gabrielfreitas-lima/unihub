// Desenho dos teclados AULA série F no teste de teclas, em ABNT2: as teclas \ e
// /? existem, e a tecla Fn só é desenhada (não chega ao Windows).

import { letters, digits, fKeys, row, FUNCTION_ROW, NUMBER_ROW } from '../layout-rows.js';

const withFn = (keys) => keys.map((k) => (k.code === 'Fn' ? { ...k, fixed: true } : k));

// 75%: coluna da direita com Delete, PgUp, PgDn e End; botão de volume no
// canto de cima (girar = volume, apertar = mudo).
function f75Keys(abnt2) {
  return withFn([
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
      ['Fn', 1.25], 0.5, 'ArrowLeft', 'ArrowDown', 'ArrowRight']),
  ]);
}

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

/** Formatos da AULA: nome -> (abnt2) => { width, height, keys }. */
export const AULA_LAYOUTS = {
  f75: (abnt2) => ({ width: 16, height: 6.25, keys: f75Keys(abnt2) }),
  f87: () => ({ width: 18.25, height: 6.25, keys: f87Keys() }),
  f99: () => ({ width: 19.5, height: 6.25, keys: f99Keys() }),
};
