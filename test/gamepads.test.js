import test from 'node:test';
import assert from 'node:assert/strict';
import { isGamepadInterface, brandOf, genericName } from '../src/renderer/plugins/gamepads/brands.js';

const col = (usagePage, usage) => ({ usagePage, usage, inputReports: [], outputReports: [], featureReports: [] });

test('reconhece interfaces de jogo e ignora teclado, mouse e mídia', () => {
  assert.ok(isGamepadInterface({ collections: [col(0x01, 0x05)] })); // Game Pad
  assert.ok(isGamepadInterface({ collections: [col(0x0c, 0x01), col(0x01, 0x04)] })); // Joystick
  assert.ok(!isGamepadInterface({ collections: [col(0x01, 0x06)] })); // teclado
  assert.ok(!isGamepadInterface({ collections: [col(0x01, 0x02)] })); // mouse
  assert.ok(!isGamepadInterface({ collections: [col(0x0c, 0x01)] })); // mídia
});

test('nome e marca de gamepads genéricos', () => {
  assert.equal(brandOf({ vendorId: 0x054c }), 'Sony');
  assert.equal(brandOf({ vendorId: 0x1234 }), null);
  assert.equal(genericName({ vendorId: 0x054c, productName: 'DualSense Wireless Controller' }), 'DualSense Wireless Controller');
  assert.equal(genericName({ vendorId: 0x057e, productName: '' }), 'Gamepad Nintendo');
  assert.equal(genericName({ vendorId: 0x1234, productName: '  ' }), 'Gamepad');
});
