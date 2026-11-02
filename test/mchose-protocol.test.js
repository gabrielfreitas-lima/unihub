import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commands, parseBattery, parseVersion, isBatteryReport, isLinkUpReport, isMchoseDevice, modelName, PACKET_SIZE, STATUS_REPORT,
} from '../src/renderer/plugins/mchose/protocol.js';
import { groupHeadsets, soundDeviceMatcher, isMchoseSound } from '../src/renderer/plugins/mchose/devices.js';
import { pickHeadsetDevices } from '../src/renderer/shared/headset-audio.js';

const bytes = (...b) => new Uint8Array([...b, ...new Array(PACKET_SIZE - b.length).fill(0)]);

test('pedido de bateria: 0x65, 0x01 e zeros até 63 bytes', () => {
  const p = commands.battery();
  assert.equal(p.length, PACKET_SIZE);
  assert.deepEqual([...p.subarray(0, 3)], [0x65, 0x01, 0x00]);
});

test('bateria lida de um V9 PRO: 100%, em uso', () => {
  // Resposta real no report 0x55.
  const data = bytes(0x65, 100, 0x02);
  assert.ok(isBatteryReport(STATUS_REPORT, data));
  assert.deepEqual(parseBattery(data), { percent: 100, state: 'discharging', charging: false, asleep: false });
});

test('bateria no cabo: carregando a 100% e, depois, sem estado', () => {
  // Respostas reais do V9 PRO no cabo.
  assert.deepEqual(parseBattery(bytes(0x65, 100, 0x00)), { percent: 100, state: 'unknown', charging: false, asleep: false });
  assert.deepEqual(parseBattery(bytes(0x65, 100, 0x03)), { percent: 100, state: 'charging', charging: true, asleep: false });
});

test('bateria: cheia e fone desligado', () => {
  assert.equal(parseBattery(bytes(0x65, 100, 0x04)).state, 'full');
  const off = parseBattery(bytes(0x65, 0, 0x1a));
  assert.equal(off.asleep, true);
  assert.equal(off.percent, null);
});

test('fone desligado pelo botão: o dongle avisa 0x1A; ao ligar, avisa 0x11 0x01', () => {
  // Avisos reais do dongle do V9 PRO.
  assert.equal(parseBattery(bytes(0x65, 0, 0x1a)).asleep, true);
  assert.ok(isLinkUpReport(STATUS_REPORT, bytes(0x11, 0x01)));
  assert.equal(isLinkUpReport(STATUS_REPORT, bytes(0x11, 0x00)), false);
});

test('outros relatórios não são bateria', () => {
  assert.equal(parseBattery(bytes(0x22, 1)), null);
  assert.equal(isBatteryReport(0x41, bytes(0x65, 1, 2)), false);
});

test('versão do fone, com e sem o report ID no começo', () => {
  // Resposta real do feature report 0xAA de um V9 PRO.
  assert.equal(parseVersion(new Uint8Array([0xaa, 0x01, 0, 0, 3, 6, 255, 37])), '0036');
  assert.equal(parseVersion(new Uint8Array([0x01, 0, 0, 2, 9])), '0029');
  assert.equal(parseVersion(new Uint8Array([0xaa, 0x00, 0, 0, 0, 0])), null);
});

const dev = (pages, extra = {}) => ({
  vendorId: 0x291d, productId: 0x385d, productName: 'MCHOSE V9 PRO',
  collections: pages.map((usagePage) => ({ usagePage })), ...extra,
});

test('agrupa as interfaces de um headset', () => {
  const one = dev([0x0b, 0xff90, 0xff22, 0x0c]);
  assert.deepEqual(groupHeadsets([one]), [[one]]);

  const status = dev([0xff90]);
  const version = dev([0xff22]);
  assert.deepEqual(groupHeadsets([status, version]), [[status, version]]);
});

test('dois headsets iguais com interfaces separadas não são misturados', () => {
  const a = dev([0xff90]);
  const b = dev([0xff90]);
  const groups = groupHeadsets([a, b, dev([0xff22]), dev([0xff22])]);
  assert.deepEqual(groups, [[a], [b]]);
});

const wired = (pages) => dev(pages, { vendorId: 0x0d8c, productId: 0x0343, productName: 'MCHOSE V9 PRO HEADSET' });

test('fone no cabo: VID do chip de áudio, só com nome MCHOSE', () => {
  assert.equal(isMchoseDevice(wired([0xff90])), true);
  assert.equal(isMchoseDevice({ vendorId: 0x0d8c, productId: 0x0012, productName: 'USB Audio Device', collections: [] }), false);
  assert.equal(modelName(wired([])), 'MCHOSE V9 PRO');
});

test('fone no cabo esconde o dongle do mesmo modelo', () => {
  const dongle = dev([0xff90, 0xff22]);
  const cable = wired([0xff22, 0xff90]);
  assert.deepEqual(groupHeadsets([dongle, cable]), [[cable]]);
});

test('fone no cabo ainda incompleto (logo ao conectar) mantém o dongle', () => {
  const dongle = dev([0xff90, 0xff22]);
  assert.deepEqual(groupHeadsets([dongle, wired([0xff22])]), [[dongle]]);
});

test('ignora aparelhos de outras marcas', () => {
  assert.deepEqual(groupHeadsets([dev([0xff90], { vendorId: 0x3537 })]), []);
});

test('acha o som do fone pelo dongle e ignora o do cabo e o "Padrão"', () => {
  const matches = soundDeviceMatcher(dev([0xff90]));
  // Nomes reais no Chromium: terminam com o VID:PID do aparelho USB.
  assert.equal(matches('Headphone (MCHOSE V9 PRO) (291d:385d)'), true);
  assert.equal(matches('Mic (2- MCHOSE V9 PRO) (291d:385d)'), true);
  assert.equal(matches('Alto-falantes (MCHOSE V9 PRO HEADSET) (0d8c:0343)'), false);

  const list = [
    { kind: 'audiooutput', deviceId: 'default', label: 'Default - Headphone (MCHOSE V9 PRO) (291d:385d)' },
    { kind: 'audiooutput', deviceId: 'a1', label: 'Alto-falantes (MCHOSE V9 PRO HEADSET) (0d8c:0343)' },
    { kind: 'audiooutput', deviceId: 'a2', label: 'Headphone (MCHOSE V9 PRO) (291d:385d)' },
    { kind: 'audioinput', deviceId: 'communications', label: 'Communications - Mic (MCHOSE V9 PRO) (291d:385d)' },
    { kind: 'audioinput', deviceId: 'm1', label: 'Mic (MCHOSE V9 PRO) (291d:385d)' },
  ];
  const { output, input } = pickHeadsetDevices(list, matches);
  assert.equal(output.deviceId, 'a2');
  assert.equal(input.deviceId, 'm1');
});
