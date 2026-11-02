// Card "Informações" em largura total: dados à esquerda, controle à direita.

import { h } from '../core/dom.js';

/** VID:PID com uma explicação curta, útil para relatar problemas. */
export function vidPidRow(vidPid) {
  return h('span', { class: 'vidpid' },
    h('strong', {}, vidPid),
    h('small', { class: 'muted' }, 'fabricante : modelo/modo. Informe este código ao relatar um problema.'));
}

/**
 * @param {object} o
 * @param {[string, Node|string][]} o.rows  pares rótulo/valor
 * @param {string} [o.note]                 texto pequeno abaixo dos dados
 * @param {{name: string, connection?: string|null}} o.label  controle mostrado à direita
 */
export function infoCard({ rows, note, label }) {
  return h('section', { class: 'card info-card' },
    h('div', { class: 'info-main' },
      h('h3', {}, 'Informações'),
      h('dl', { class: 'facts' }, rows.flatMap(([dt, dd]) => [h('dt', {}, dt), h('dd', {}, dd)])),
      note ? h('p', { class: 'muted small' }, note) : null),
    h('div', { class: 'info-device' },
      h('strong', {}, label.name),
      label.connection ? h('span', { class: 'pill' }, label.connection) : null));
}
