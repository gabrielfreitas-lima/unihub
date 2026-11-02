// Teste de botões visual: um controle desenhado que acende cada botão
// apertado, move os sticks e enche os gatilhos. Lê pela Gamepad API.
//
// Usa o "mapeamento padrão" da Gamepad API (o mesmo do controle Xbox):
//   0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT · 8 View · 9 Menu
//   10 L3 · 11 R3 · 12 ↑ · 13 ↓ · 14 ← · 15 → · 16 Home
//   eixos 0/1 = stick esquerdo, 2/3 = stick direito

import { h, clear } from '../core/dom.js';
import { controllerSvg } from './controller-art.js';

const TICK_MS = 33;
const STICK_TRAVEL = 11;

// Layout espelhado no eixo central do controle (x = 200): cada elemento da
// esquerda tem um par na mesma altura do lado direito.
const MID = 200;
const UPPER_Y = 130; // stick esquerdo  ↔ botões A/B/X/Y
const LOWER_Y = 185; // direcional      ↔ stick direito
const UPPER_DX = 85;
const LOWER_DX = 45;
const CENTER_Y = 112; // View · Home · Menu

const FACE_X = MID + UPPER_DX;
const FACE_GAP = 22;
const FACE = [
  { i: 0, label: 'A', x: FACE_X, y: UPPER_Y + FACE_GAP },
  { i: 1, label: 'B', x: FACE_X + FACE_GAP, y: UPPER_Y },
  { i: 2, label: 'X', x: FACE_X - FACE_GAP, y: UPPER_Y },
  { i: 3, label: 'Y', x: FACE_X, y: UPPER_Y - FACE_GAP },
];

const DPAD_X = MID - LOWER_DX;
const CELL = 14;
const cell = (dx, dy) => `M${DPAD_X + dx * CELL - CELL / 2} ${LOWER_Y + dy * CELL - CELL / 2} h${CELL} v${CELL} h-${CELL} Z`;
const DPAD = [
  { i: 12, d: cell(0, -1) },
  { i: 13, d: cell(0, 1) },
  { i: 14, d: cell(-1, 0) },
  { i: 15, d: cell(1, 0) },
];

const STICKS = [
  { press: 10, axes: [0, 1], x: MID - UPPER_DX, y: UPPER_Y },
  { press: 11, axes: [2, 3], x: MID + LOWER_DX, y: LOWER_Y },
];

const TRIGGER_W = 34;
const TRIGGER_H = 40;
const TRIGGERS = [
  { i: 6, label: 'LT', cx: MID - UPPER_DX, y: 22 },
  { i: 7, label: 'RT', cx: MID + UPPER_DX, y: 22 },
];
const BUMPERS = [
  { i: 4, label: 'LB', d: 'M88 86 Q110 70 150 72 L150 84 Q115 84 92 96 Z', lx: 122, ly: 81 },
  { i: 5, label: 'RB', d: 'M312 86 Q290 70 250 72 L250 84 Q285 84 308 96 Z', lx: 278, ly: 81 },
];
const SMALL = [
  { i: 8, x: MID - 24, y: CENTER_Y },
  { i: 9, x: MID + 24, y: CENTER_Y },
];
const HOME = 16;

const DEFAULT_HINT = 'Clique nesta janela e aperte qualquer botão do controle para ele aparecer aqui.';

/**
 * @param {object} [o]
 * @param {(pads: Gamepad[]) => Gamepad[]} [o.select]  quais gamepads mostrar (padrão: todos)
 * @param {(pads: Gamepad[]) => string} [o.hint]       texto quando nenhum é mostrado
 */
export function gamepadVisualTester({ select = (pads) => pads, hint: hintText = () => DEFAULT_HINT } = {}) {
  const root = h('div', { class: 'gp-tester' });
  const visuals = new Map(); // gamepad.index -> visual
  const hint = h('div', { class: 'empty' });

  const timer = setInterval(() => {
    if (!root.isConnected) {
      if (root.dataset.mounted) clearInterval(timer);
      return;
    }
    root.dataset.mounted = '1';
    const all = [...navigator.getGamepads()].filter(Boolean);
    const pads = select(all);
    for (const index of visuals.keys()) {
      if (!pads.some((p) => p.index === index)) {
        visuals.get(index).el.remove();
        visuals.delete(index);
      }
    }
    for (const pad of pads) {
      if (!visuals.has(pad.index)) {
        const v = pad.mapping === 'standard' ? buildVisual(pad) : buildRawVisual(pad);
        visuals.set(pad.index, v);
        root.append(v.el);
      }
      visuals.get(pad.index).update(pad);
    }
    hint.hidden = pads.length > 0;
    if (!hint.hidden) {
      const text = all.length ? hintText(all) : DEFAULT_HINT;
      if (hint.textContent !== text) hint.textContent = text;
    }
  }, TICK_MS);

  root.append(hint);
  return root;
}

function buildVisual(pad) {
  const { svg, add } = controllerSvg('gp-art');
  // Recorte justo em volta do desenho (gatilhos em cima, punhos embaixo),
  // para o controle ficar centralizado no quadro.
  svg.setAttribute('viewBox', '20 12 360 262');
  const parts = new Map(); // índice do botão -> elemento(s) que acendem

  // Texto centralizado no ponto (x, y), na horizontal e na vertical.
  const text = (x, y, label, cls = 'gp-label') => {
    const t = add('text', { x, y, class: cls, 'dominant-baseline': 'central' });
    t.textContent = label;
    return t;
  };
  const mark = (i, el) => parts.set(i, [...(parts.get(i) || []), el]);

  for (const t of TRIGGERS) {
    const x = t.cx - TRIGGER_W / 2;
    add('rect', { x, y: t.y, width: TRIGGER_W, height: TRIGGER_H, rx: 8, class: 'gp-trigger' });
    const fill = add('rect', { x, y: t.y + TRIGGER_H, width: TRIGGER_W, height: 0, rx: 8, class: 'gp-trigger-fill' });
    fill.dataset.base = String(t.y + TRIGGER_H);
    mark(t.i, fill);
    text(t.cx, t.y + TRIGGER_H / 2, t.label);
  }
  for (const b of BUMPERS) {
    mark(b.i, add('path', { d: b.d, class: 'gp-btn' }));
    text(b.lx, b.ly, b.label, 'gp-label small');
  }
  const sticks = STICKS.map((s) => {
    add('circle', { cx: s.x, cy: s.y, r: 24, class: 'gp-stick-well' });
    // Ondas que se espalham enquanto o stick está apertado (L3/R3).
    const ripples = [0, 1, 2].map((n) => add('circle', { cx: s.x, cy: s.y, r: 20, class: `gp-ripple gp-ripple-${n}` }));
    const cap = add('circle', { cx: s.x, cy: s.y, r: 15, class: 'gp-btn gp-stick' });
    mark(s.press, cap);
    return { ...s, cap, ripples };
  });
  add('path', { d: cell(0, 0), class: 'gp-dpad-center' });
  for (const d of DPAD) mark(d.i, add('path', { d: d.d, class: 'gp-btn' }));
  for (const f of FACE) {
    mark(f.i, add('circle', { cx: f.x, cy: f.y, r: 11, class: `gp-btn gp-face gp-face-${f.label}` }));
    text(f.x, f.y, f.label);
  }
  for (const s of SMALL) {
    mark(s.i, add('rect', { x: s.x - 8, y: s.y - 5, width: 16, height: 10, rx: 5, class: 'gp-btn' }));
  }
  mark(HOME, add('circle', { cx: MID, cy: CENTER_Y, r: 10, class: 'gp-btn gp-home' }));

  const pressedList = h('p', { class: 'muted small gp-pressed' });
  const el = h('div', { class: 'gp-pad' },
    h('div', { class: 'pad-head' }, h('strong', {}, `#${pad.index + 1}`), ' ', pad.id),
    h('div', { class: 'gp-stage' }, svg),
    pressedList);

  return {
    el,
    update(p) {
      p.buttons.forEach((b, i) => {
        for (const node of parts.get(i) || []) {
          node.classList.toggle('on', b.pressed);
          if (node.dataset.base) {
            const height = Math.round(40 * b.value);
            node.setAttribute('y', String(Number(node.dataset.base) - height));
            node.setAttribute('height', String(height));
          }
        }
      });
      for (const s of sticks) {
        const ax = p.axes[s.axes[0]] || 0;
        const ay = p.axes[s.axes[1]] || 0;
        const cx = String(s.x + ax * STICK_TRAVEL);
        const cy = String(s.y + ay * STICK_TRAVEL);
        s.cap.setAttribute('cx', cx);
        s.cap.setAttribute('cy', cy);
        // Só mexe nos anéis quando algo muda: regravar a posição reinicia a animação.
        const pressed = !!p.buttons[s.press]?.pressed;
        for (const r of s.ripples) {
          if (r.getAttribute('cx') !== cx) r.setAttribute('cx', cx);
          if (r.getAttribute('cy') !== cy) r.setAttribute('cy', cy);
          if (r.classList.contains('on') !== pressed) r.classList.toggle('on', pressed);
        }
      }
      const names = p.buttons.map((b, i) => (b.pressed ? NAMES[i] || `B${i}` : null)).filter(Boolean);
      pressedList.textContent = names.length ? `Apertado: ${names.join(' + ')}` : 'Nenhum botão apertado';
    },
  };
}

const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'L3', 'R3', '↑', '↓', '←', '→', 'Home'];

/** Controle sem mapeamento padrão: mostra só a lista de botões e eixos. */
function buildRawVisual(pad) {
  const buttons = h('div', { class: 'pad-buttons' });
  const el = h('div', { class: 'gp-pad' },
    h('div', { class: 'pad-head' }, h('strong', {}, `#${pad.index + 1}`), ' ', pad.id, h('span', { class: 'pill' }, 'não padrão')),
    buttons);
  return {
    el,
    update(p) {
      clear(buttons, p.buttons.map((b, i) => h('span', { class: 'pad-btn' + (b.pressed ? ' on' : '') }, `B${i}`)));
    },
  };
}
