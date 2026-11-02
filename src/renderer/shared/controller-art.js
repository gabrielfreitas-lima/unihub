// Desenho de controle (próprio do UniHub), usado no editor de luzes e na tela
// "Conecte seu controle".

const NS = 'http://www.w3.org/2000/svg';

export const PAD_PATH =
  'M120 85 Q200 70 280 85 Q330 92 345 140 L370 225 Q378 258 345 262 Q318 264 300 238 L282 212 ' +
  'Q200 200 118 212 L100 238 Q82 264 55 262 Q22 258 30 225 L55 140 Q70 92 120 85 Z';

/** Cria um <svg> 400×300 com o corpo do controle. Devolve { svg, add }. */
export function controllerSvg(className) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 300');
  svg.setAttribute('class', className);
  const add = (tag, attrs) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
    return node;
  };
  add('path', { d: PAD_PATH, class: 'pad-body' });
  add('circle', { cx: 150, cy: 135, r: 20, class: 'pad-part' });
  add('circle', { cx: 245, cy: 175, r: 20, class: 'pad-part' });
  add('circle', { cx: 200, cy: 112, r: 10, class: 'pad-part' });
  return { svg, add };
}

/** Controle "desconectado": cabo solto e um sinal sem fio piscando. */
export function disconnectedController() {
  const { svg, add } = controllerSvg('connect-art');
  svg.setAttribute('viewBox', '0 -60 400 330');
  add('path', { d: 'M200 78 C200 40 230 30 250 10 L262 -2', class: 'pad-cable' });
  add('rect', { x: 255, y: -22, width: 22, height: 26, rx: 4, class: 'pad-plug', transform: 'rotate(40 266 -9)' });
  for (const [i, r] of [14, 26, 38].entries()) {
    add('path', {
      d: `M${110 - r} ${40 - r * 0.2} A${r} ${r} 0 0 1 ${110 + r} ${40 - r * 0.2}`,
      class: `pad-signal pad-signal-${i}`,
    });
  }
  return svg;
}
