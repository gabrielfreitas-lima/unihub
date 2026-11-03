import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySystemKeyboard, systemKeyboards } from '../src/renderer/plugins/teclados/detect.js';

// Formatos de ID do Windows para teclados.
const BT_CLASSIC = {
  id: 'HID\\{00001124-0000-1000-8000-00805F9B34FB}_VID&0002046D_PID&B342&COL01\\9&2A6E2E10&0&0000',
  name: 'Dispositivo de teclado HID',
  chain: [
    { id: 'BTHENUM\\{00001124-0000-1000-8000-00805f9b34fb}_VID&0002046d_PID&b342\\8&1C3A&0&C8A1B2C3D4E5_C00000000', name: 'Serviço HID Bluetooth' },
    { id: 'BTHENUM\\DEV_C8A1B2C3D4E5\\7&2B3D&0&BLUETOOTHDEVICE_C8A1B2C3D4E5', name: 'Keyboard K380' },
  ],
};
const BT_LE = {
  id: 'HID\\{00001812-0000-1000-8000-00805f9b34fb}_Dev_VID&02046d_PID&b35b_REV&0013_d4e5f6a1b2c3&Col01\\a&1',
  name: 'Dispositivo de teclado HID',
  chain: [
    { id: 'BTHLEDEVICE\\{00001812-0000-1000-8000-00805f9b34fb}_Dev_VID&02046d_PID&b35b\\9&1', name: 'Dispositivo HID Bluetooth LE' },
    { id: 'BTHLE\\DEV_D4E5F6A1B2C3\\8&1', name: 'MX Keys' },
  ],
};
const PS2 = { id: 'ACPI\\PNP0303\\4&1F2A3B4C&0', name: 'Teclado PS/2 padrão', chain: [] };
const I2C = { id: 'HID\\VEN_ELAN&DEV_0001&Col01\\5&1', name: 'Dispositivo de teclado HID', chain: [] };
// Reais deste PC (USB): AULA no dongle, controle em modo Xbox e receptor de mouse.
const USB = [
  { id: 'HID\\VID_3554&PID_FA09&MI_00\\8&35A699DE&0&0000', name: 'Dispositivo de teclado HID', chain: [] },
  { id: 'HID\\VID_3537&PID_100B&MI_01&COL01\\8&2E5CC6F2&0&0000', name: 'Dispositivo de teclado HID', chain: [] },
  { id: 'HID\\VID_248A&PID_FF30&MI_02&COL04\\8&3D37C01&0&0003', name: 'Dispositivo de teclado HID', chain: [] },
];

test('classifica pelo ID do Windows: Bluetooth, notebook e USB', () => {
  assert.deepEqual(classifySystemKeyboard(BT_CLASSIC), { id: BT_CLASSIC.id, bus: 'bluetooth', vidPid: '046d:b342', name: 'Keyboard K380' });
  assert.deepEqual(classifySystemKeyboard(BT_LE), { id: BT_LE.id, bus: 'bluetooth', vidPid: '046d:b35b', name: 'MX Keys' });
  assert.equal(classifySystemKeyboard(PS2).bus, 'internal');
  assert.equal(classifySystemKeyboard(PS2).name, 'Teclado do notebook');
  assert.equal(classifySystemKeyboard(I2C).bus, 'internal');
  assert.deepEqual(classifySystemKeyboard(USB[0]), { id: USB[0].id, bus: 'usb', vidPid: '3554:fa09', name: null });
});

test('teclado USB não vira teclado extra (controles e mouses têm "teclado" também)', () => {
  const { bluetooth, extra } = systemKeyboards(USB, new Set(['3554:fa09']));
  assert.equal(bluetooth.size, 0);
  assert.deepEqual(extra, []);
});

test('notebook entra como teclado extra, um só para as várias coleções', () => {
  const { extra } = systemKeyboards([PS2, { ...PS2, id: 'ACPI\\PNP0303\\4&1F2A3B4C&1' }, ...USB], new Set());
  assert.deepEqual(extra.map((k) => [k.id, k.name, k.connection, k.devices.length]), [['sys:internal:Teclado do notebook', 'Teclado do notebook', 'integrado', 0]]);
});

test('Bluetooth: marca o teclado do WebHID ou entra como extra se o WebHID não mostrar', () => {
  const seen = systemKeyboards([BT_CLASSIC], new Set(['046d:b342']));
  assert.equal(seen.bluetooth.get('046d:b342'), 'Keyboard K380');
  assert.deepEqual(seen.extra, []);
  const unseen = systemKeyboards([BT_LE], new Set());
  assert.deepEqual(unseen.extra.map((k) => [k.name, k.connection, k.vidPid]), [['MX Keys', 'via Bluetooth', '046d:b35b']]);
});
