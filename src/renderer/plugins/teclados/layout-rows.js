// Peças para desenhar teclados no teste de teclas: cada tecla é identificada
// pelo `KeyboardEvent.code` e medida em "u" (largura de uma tecla comum).

export const letters = (s) => [...s].map((c) => `Key${c}`);
export const digits = [...'1234567890'].map((c) => `Digit${c}`);
export const fKeys = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => `F${from + i}`);

/**
 * Uma linha: cada item é um código (1 u), [código, largura, altura] ou um
 * número (espaço vazio, em u).
 */
export function row(y, items) {
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

export const FUNCTION_ROW = ['Escape', 1, ...fKeys(1, 4), 0.5, ...fKeys(5, 8), 0.5, ...fKeys(9, 12), 0.25, 'PrintScreen', 'ScrollLock', 'Pause'];
export const NUMBER_ROW = ['Backquote', ...digits, 'Minus', 'Equal', ['Backspace', 2], 0.25, 'Insert', 'Home', 'PageUp', 0.25,
  'NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'];
