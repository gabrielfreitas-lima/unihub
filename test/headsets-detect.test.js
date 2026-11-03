import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSoundLabel, soundHeadsets, genericHeadsets, isHeadsetInterface, bluetoothBatteryFor, soundMatcherFor } from '../src/renderer/plugins/headsets/detect.js';
import { isMchoseSound } from '../src/renderer/plugins/headsets/mchose/devices.js';

const out = (deviceId, label) => ({ kind: 'audiooutput', deviceId, label });

test('lê o nome da saída de som: aparelho, conexão e VID:PID', () => {
  assert.deepEqual(parseSoundLabel('Headphone (MCHOSE V9 PRO) (291d:385d)'),
    { endpoint: 'Headphone', name: 'MCHOSE V9 PRO', transport: 'usb', vidPid: '291d:385d' });
  assert.deepEqual(parseSoundLabel('Default - Alexa (Echo Dot-5AH) (Bluetooth)'),
    { endpoint: 'Alexa', name: 'Echo Dot-5AH', transport: 'bluetooth', vidPid: null });
  assert.equal(parseSoundLabel('Fones de ouvido (WH-1000XM4 Hands-Free AG Audio) (Bluetooth)').name, 'WH-1000XM4');
  // Nome real do V9 PRO por Bluetooth, com o contador do Windows.
  assert.deepEqual(parseSoundLabel('Default - Fones de ouvido (2- MCHOSE V9 PRO) (Bluetooth)'),
    { endpoint: 'Fones de ouvido', name: 'MCHOSE V9 PRO', transport: 'bluetooth', vidPid: null });
});

test('acha fones na lista de som e ignora caixas, streaming e entradas repetidas', () => {
  // Lista real (com um fone Bluetooth a mais).
  const list = [
    out('default', 'Default - Alexa (Echo Dot-5AH) (Bluetooth)'),
    out('communications', 'Communications - Headphone (MCHOSE V9 PRO) (291d:385d)'),
    out('a', 'Alto-falantes (Steam Streaming Speakers)'),
    out('b', 'Alexa (Echo Dot-5AH) (Bluetooth)'),
    out('c', 'Headphone (MCHOSE V9 PRO) (291d:385d)'),
    out('d', 'Fones de ouvido (WH-1000XM4) (Bluetooth)'),
    out('e', 'Headset (WH-1000XM4 Hands-Free) (Bluetooth)'),
    { kind: 'audioinput', deviceId: 'f', label: 'Mic (MCHOSE V9 PRO) (291d:385d)' },
  ];
  assert.deepEqual(soundHeadsets(list).map((s) => [s.name, s.transport]), [
    ['MCHOSE V9 PRO', 'usb'],
    ['WH-1000XM4', 'bluetooth'],
  ]);
});

test('headset HID: interface de telefonia (0x0B)', () => {
  assert.equal(isHeadsetInterface({ collections: [{ usagePage: 0x0b }, { usagePage: 0x0c }] }), true);
  assert.equal(isHeadsetInterface({ collections: [{ usagePage: 0x0c }, { usagePage: 0xfff0 }] }), false);
});

test('fones de outras marcas: HID e som juntos, sem repetir nem pegar os MCHOSE', () => {
  const hid = [{ vendorId: 0x046d, productId: 0x0a87, productName: 'G435 Wireless', collections: [] }];
  const sound = soundHeadsets([
    out('a', 'Headphone (MCHOSE V9 PRO) (291d:385d)'),
    out('b', 'Fones de ouvido (G435 Wireless) (046d:0a87)'),
    out('c', 'Fones de ouvido (WH-1000XM4) (Bluetooth)'),
    out('d', 'Fones de ouvido (MCHOSE V9 PRO) (Bluetooth)'),
  ]);
  const generic = genericHeadsets({ hid, sound, claimed: (s) => isMchoseSound(s, ['MCHOSE V9 PRO']) });
  assert.deepEqual(generic.map((g) => [g.name, g.transport]), [
    ['G435 Wireless', 'usb'],
    ['WH-1000XM4', 'bluetooth'],
  ]);
});

test('MCHOSE por Bluetooth sem dongle nem cabo aparece como fone comum', () => {
  const s = { name: 'MCHOSE V9 PRO', transport: 'bluetooth', vidPid: null };
  assert.equal(isMchoseSound(s, []), false);
  assert.equal(isMchoseSound(s, ['MCHOSE V9 PRO']), true);
  assert.equal(isMchoseSound({ name: 'MCHOSE V9 PRO HEADSET', transport: 'usb', vidPid: '0d8c:0343' }, []), true);
});

test('bateria Bluetooth do Windows casa com o fone pelo nome', () => {
  // Resposta real da consulta ao Windows.
  const batteries = [
    { name: 'JBL TUNE520BT Hands-Free AG', percent: 20 },
    { name: 'MCHOSE V9 PRO Hands-Free AG', percent: 100 },
  ];
  assert.equal(bluetoothBatteryFor(batteries, 'MCHOSE V9 PRO'), 100);
  assert.equal(bluetoothBatteryFor(batteries, 'JBL TUNE520BT'), 20);
  assert.equal(bluetoothBatteryFor(batteries, 'WH-1000XM4'), null);
});

test('som de qualquer fone: USB pelo VID:PID, Bluetooth pelo nome', async () => {
  const { pickHeadsetDevices } = await import('../src/renderer/shared/headset-audio.js');
  const bt = soundMatcherFor({ name: 'MCHOSE V9 PRO', transport: 'bluetooth', vidPid: null });
  // Nomes reais do V9 PRO por Bluetooth.
  const list = [
    { kind: 'audiooutput', deviceId: 'default', label: 'Default - Fones de ouvido (2- MCHOSE V9 PRO) (Bluetooth)' },
    { kind: 'audiooutput', deviceId: 'call', label: 'Headset (2- MCHOSE V9 PRO Hands-Free) (Bluetooth)' },
    { kind: 'audiooutput', deviceId: 'music', label: 'Fones de ouvido (2- MCHOSE V9 PRO) (Bluetooth)' },
    { kind: 'audiooutput', deviceId: 'usb', label: 'Headphone (MCHOSE V9 PRO) (291d:385d)' },
    { kind: 'audioinput', deviceId: 'mic', label: 'Headset (2- MCHOSE V9 PRO) (Bluetooth)' },
  ];
  const picked = pickHeadsetDevices(list, bt);
  assert.equal(picked.output.deviceId, 'music'); // a de música, não a de chamada
  assert.equal(picked.input.deviceId, 'mic');

  const usb = soundMatcherFor({ name: 'G435 Wireless', transport: 'usb', vidPid: '046d:0a87' });
  assert.equal(usb('Fones de ouvido (G435 Wireless) (046d:0a87)'), true);
  assert.equal(usb('Headphone (MCHOSE V9 PRO) (291d:385d)'), false);
});

test('saída padrão do Windows: compara com a entrada "Default/Padrão - …"', async () => {
  const { isDefaultOutput } = await import('../src/renderer/shared/headset-audio.js');
  const jbl = { kind: 'audiooutput', deviceId: 'be0b', label: 'Fones de ouvido (JBL TUNE520BT) (Bluetooth)' };
  const list = (label) => [{ kind: 'audiooutput', deviceId: 'default', label }, jbl];
  assert.equal(isDefaultOutput(list('Default - Headphone (MCHOSE V9 PRO) (291d:385d)'), jbl), false);
  assert.equal(isDefaultOutput(list('Default - Fones de ouvido (JBL TUNE520BT) (Bluetooth)'), jbl), true);
  assert.equal(isDefaultOutput(list('Padrão - Fones de ouvido (JBL TUNE520BT) (Bluetooth)'), jbl), true);
});
