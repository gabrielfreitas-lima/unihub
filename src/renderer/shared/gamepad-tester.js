// Teste de botões genérico usando a Gamepad API do navegador.
// No Windows o Chromium lê controles XInput e DirectInput sozinho.

import { h, clear } from '../core/dom.js';

const STANDARD_BUTTONS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu',
  'L3', 'R3', '↑', '↓', '←', '→', 'Home',
];

export function gamepadTester({ filter = null, title = 'Teste de botões' } = {}) {
  const root = h('div', { class: 'gamepad-tester' });

  // ~30 quadros por segundo bastam para ver os botões e poupam CPU.
  const timer = setInterval(() => {
    if (!root.isConnected) {
      if (root.dataset.mounted) clearInterval(timer);
      return;
    }
    root.dataset.mounted = '1';
    const pads = [...navigator.getGamepads()].filter(Boolean).filter((p) => !filter || filter(p));
    clear(root,
      h('p', { class: 'muted' }, title, ' — pressione qualquer botão para o controle aparecer.'),
      pads.length === 0 ? h('div', { class: 'empty' }, 'Nenhum controle detectado pela Gamepad API.') : null,
      pads.map(renderPad),
    );
  }, 33);

  return root;
}

function renderPad(pad) {
  return h('div', { class: 'pad' },
    h('div', { class: 'pad-head' },
      h('strong', {}, `#${pad.index}`), ' ', pad.id,
      h('span', { class: 'pill' }, pad.mapping || 'não padrão')),
    h('div', { class: 'pad-buttons' },
      pad.buttons.map((b, i) =>
        h('span', {
          class: 'pad-btn' + (b.pressed ? ' on' : ''),
          style: `--v:${b.value.toFixed(2)}`,
        }, (pad.mapping === 'standard' && STANDARD_BUTTONS[i]) || `B${i}`))),
    h('div', { class: 'pad-axes' },
      pad.axes.map((v, i) =>
        h('div', { class: 'axis' },
          h('span', {}, `Eixo ${i}`),
          h('div', { class: 'bar' }, h('div', { class: 'fill', style: `--x:${((v + 1) / 2).toFixed(3)}` })),
          h('code', {}, v.toFixed(2))))),
  );
}
