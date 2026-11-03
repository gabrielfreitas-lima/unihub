import test from 'node:test';
import assert from 'node:assert/strict';
import { logitechHeadsets, batteryView, isLogitechHidpp } from '../src/renderer/plugins/headsets/logitech/headsets.js';

// Resultados no formato que LogitechSession.discover() devolve (exemplos,
// ainda sem headset Logitech real para conferir).
const results = [
  { index: 1, name: 'G502 LIGHTSPEED', type: 'Mouse', protocol: '4.2', battery: { percent: 80, level: null, status: 'descarregando' } },
  { index: 2, name: 'G733', type: 'Headset', protocol: '4.2', battery: { percent: 35, level: 'boa', status: 'descarregando' } },
  { index: 0xff, name: null, type: 'Headset', protocol: '4.2', battery: null },
];

test('só os aparelhos do tipo Headset entram na aba Headsets', () => {
  const hs = logitechHeadsets(results);
  assert.deepEqual(hs.map((h) => [h.index, h.name, h.connection]), [
    [2, 'G733', 'via dongle'],
    [0xff, 'Headset Logitech', 'via USB'],
  ]);
});

test('bateria: porcentagem quando existe, senão o nível; carregando vira etiqueta', () => {
  assert.deepEqual(batteryView({ percent: 35, level: 'boa', status: 'descarregando' }), { percent: 35, charging: false, text: '' });
  assert.deepEqual(batteryView({ percent: null, level: 'baixa', status: 'descarregando' }), { percent: null, charging: false, text: 'Bateria baixa' });
  assert.equal(batteryView({ percent: 60, level: null, status: 'carregando' }).text, 'Carregando');
  assert.deepEqual(batteryView(null), { percent: null, text: '' });
});

test('interface HID++ da Logitech: VID 046D, página do fabricante e relatório 0x10/0x11', () => {
  const dev = (vendorId, usagePage, outputs) => ({
    vendorId, collections: [{ usagePage, outputReports: outputs.map((reportId) => ({ reportId })) }],
  });
  assert.equal(isLogitechHidpp(dev(0x046d, 0xff00, [0x10, 0x11])), true);
  assert.equal(isLogitechHidpp(dev(0x046d, 0x000c, [0x03])), false);
  assert.equal(isLogitechHidpp(dev(0x291d, 0xff00, [0x11])), false);
});
