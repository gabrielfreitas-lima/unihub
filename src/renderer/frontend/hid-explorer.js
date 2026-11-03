// Aba "Dispositivos HID": lista tudo o que o sistema expõe. É a ferramenta
// para descobrir VID/PID, páginas de uso e relatórios ao começar um novo hub.

import { h, clear, card, button } from '../core/dom.js';
import { describe } from '../core/hid-manager.js';
import { hex } from '../core/bytes.js';

export default {
  id: 'hid',
  name: 'Dispositivos HID',
  tagline: 'Lista técnica de todos os aparelhos USB/HID, para quem vai criar um plugin',
  status: 'tool',
  filters: [],
  matches: () => true,

  mount(container, ctx) {
    return {
      update(devices) {
        const rows = devices.map((d) => ({ d, info: describe(d) }))
          .sort((a, b) => a.info.vidPid.localeCompare(b.info.vidPid));
        clear(container,
          h('div', { class: 'row' },
            button('Procurar outro dispositivo…', () => ctx.hid.request([]).catch((e) => ctx.toast(e.message, 'error'))),
            h('span', { class: 'muted small' }, `${rows.length} interface(s)`)),
          rows.length === 0 ? h('div', { class: 'empty' }, 'Nenhum dispositivo HID visível.') : null,
          h('div', { class: 'grid' }, rows.map(({ d, info }) => card(info.name,
            h('p', {}, h('code', {}, info.vidPid), ' ', info.opened ? h('span', { class: 'pill' }, 'aberto') : null),
            h('table', { class: 'table small' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Página'), h('th', {}, 'Uso'), h('th', {}, 'Entrada'), h('th', {}, 'Saída'), h('th', {}, 'Feature'))),
              h('tbody', {}, d.collections.map((c) => h('tr', {},
                h('td', {}, '0x' + hex(c.usagePage, 4)),
                h('td', {}, '0x' + hex(c.usage, 4)),
                h('td', {}, ids(c.inputReports)),
                h('td', {}, ids(c.outputReports)),
                h('td', {}, ids(c.featureReports)))))))),
          ),
        );
      },
      unmount() {},
    };
  },
};

function ids(reports = []) {
  return reports.length ? reports.map((r) => '0x' + hex(r.reportId)).join(' ') : '—';
}
