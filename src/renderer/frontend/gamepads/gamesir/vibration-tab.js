// Sub-aba "Vibração" do GameSir: testa os motores e mostra, no desenho do
// controle, qual lado está vibrando.

import { h, card, button } from '../../../core/dom.js';
import { controllerSvg, XBOX_PAD_PATH } from '../../../shared/controller-art.js';

const STRENGTH = 200; // 0–255
const DURATION_MS = 700;

const MODES = [
  { id: 'left', label: 'Motor esquerdo', motors: [STRENGTH, 0] },
  { id: 'right', label: 'Motor direito', motors: [0, STRENGTH] },
  { id: 'both', label: 'Ambos', motors: [STRENGTH, STRENGTH] },
];

export function vibrationTab(session, ctx) {
  const art = vibrationArt();
  let timer = 0;

  async function vibrate(mode) {
    clearTimeout(timer);
    art.classList.remove('vib-left', 'vib-right', 'vib-both');
    void art.getBoundingClientRect(); // reinicia a animação se clicar de novo
    art.classList.add(`vib-${mode.id}`);
    timer = setTimeout(() => art.classList.remove(`vib-${mode.id}`), DURATION_MS);
    try {
      await session.vibrate(mode.motors[0], mode.motors[1], DURATION_MS);
    } catch (err) {
      ctx.toast(`Vibração: ${err.message}`, 'error');
    }
  }

  return h('div', { class: 'vibration' },
    card('Testar vibração',
      h('p', { class: 'muted small' }, 'Cada botão liga o motor por menos de 1 segundo.'),
      h('div', { class: 'row' }, MODES.map((m) => button(m.label, () => vibrate(m))))),
    h('div', { class: 'vibration-stage' }, art));
}

/** Controle com as duas metades destacáveis e ondas de vibração nos punhos. */
function vibrationArt() {
  const { svg, add } = controllerSvg('vib-art', XBOX_PAD_PATH);
  const defs = add('defs', {});
  for (const [id, x] of [['vib-clip-left', 0], ['vib-clip-right', 200]]) {
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', id);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [k, v] of Object.entries({ x, y: 0, width: 200, height: 325 })) rect.setAttribute(k, v);
    clip.append(rect);
    defs.append(clip);
  }
  add('path', { d: XBOX_PAD_PATH, class: 'vib-half vib-half-left', 'clip-path': 'url(#vib-clip-left)' });
  add('path', { d: XBOX_PAD_PATH, class: 'vib-half vib-half-right', 'clip-path': 'url(#vib-clip-right)' });
  // Ondas ao lado de cada punho.
  const waveY = 265;
  for (const [side, x, dir] of [['left', 6, -1], ['right', 394, 1]]) {
    for (const [i, r] of [10, 20, 30].entries()) {
      add('path', {
        d: `M${x + dir * r * 0.2} ${waveY - r} Q${x + dir * r} ${waveY} ${x + dir * r * 0.2} ${waveY + r}`,
        class: `vib-wave vib-wave-${side} vib-wave-${i}`,
      });
    }
  }
  return svg;
}
