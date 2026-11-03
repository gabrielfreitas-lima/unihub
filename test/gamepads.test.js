import test from 'node:test';
import assert from 'node:assert/strict';
import { isGamepadInterface, brandOf, genericName, isProControllerDevice, isXboxDevice } from '../src/renderer/plugins/gamepads/brands.js';
import { isSonyGamepad, isProController, isXboxGamepad } from '../src/renderer/shared/gamepad-visual.js';
import { extraButtonsPressed } from '../src/renderer/plugins/gamepads/gamesir/protocol.js';
import { padMatchesDevice } from '../src/renderer/plugins/gamepads/pad-binding.js';

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

test('desenho da Sony: reconhece pelo vendor no id da Gamepad API', () => {
  assert.equal(isSonyGamepad({ id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)' }), true);
  assert.equal(isSonyGamepad({ id: 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 3537 Product: 100b)' }), false);
});

test('057E:2009 é Pro Controller em qualquer conexão', () => {
  assert.equal(genericName({ vendorId: 0x057e, productId: 0x2009, productName: 'Wireless Gamepad' }), 'Pro Controller');
  assert.equal(genericName({ vendorId: 0x057e, productId: 0x2009, productName: 'Pro Controller' }), 'Pro Controller');
  assert.equal(genericName({ vendorId: 0x054c, productId: 0x09cc, productName: 'Wireless Controller' }), 'Wireless Controller');
});

test('desenho do Pro Controller: só para 057E:2009', () => {
  assert.equal(isProController({ id: 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)' }), true);
  assert.equal(isProController({ id: 'Joy-Con (L) (Vendor: 057e Product: 2006)' }), false);
  assert.equal(isProControllerDevice({ vendorId: 0x057e, productId: 0x2009 }), true);
  assert.equal(isProControllerDevice({ vendorId: 0x057e, productId: 0x2006 }), false);
});

test('teste de botões: cada aparelho genérico só com o seu gamepad', () => {
  const sony = { vendorId: 0x054c, productId: 0x09cc };
  const pro = { vendorId: 0x057e, productId: 0x2009 };
  const sonyPad = { id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)' };
  assert.equal(padMatchesDevice(sonyPad, sony), true);
  assert.equal(padMatchesDevice(sonyPad, pro), false);
  assert.equal(padMatchesDevice({ id: 'Gamepad sem ids' }, pro), true);
});

test('desenho do Xbox: só para quem é ou se apresenta como Xbox', () => {
  assert.equal(isXboxGamepad({ id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)' }), true);
  assert.equal(isXboxGamepad({ id: 'Controller (STANDARD GAMEPAD Vendor: 045e Product: 02ea)' }), true);
  assert.equal(isXboxGamepad({ id: 'Gamepad (STANDARD GAMEPAD Vendor: 2dc8 Product: 6001)' }), false);
  assert.equal(isXboxDevice({ vendorId: 0x045e, productName: 'Controller' }), true);
  assert.equal(isXboxDevice({ vendorId: 0x3537, productName: 'Xbox 360 Controller for Windows' }), true);
  assert.equal(isXboxDevice({ vendorId: 0x3537, productName: 'GameSir-Cyclone 2' }), false);
  assert.equal(isXboxDevice({ vendorId: 0x2dc8, productName: 'Gamepad' }), false);
});

test('botões extras no relatório de estado do Cyclone 2', () => {
  const report = new Array(63).fill(0);
  assert.deepEqual(extraButtonsPressed(report), []);
  report[7] = 0x02;
  report[60] = 0x08 | 0x20;
  assert.deepEqual(extraButtonsPressed(report), ['capture', 'l4', 'm']);
  report[7] = 0;
  report[60] = 0x10;
  assert.deepEqual(extraButtonsPressed(report), ['r4']);
  assert.deepEqual(extraButtonsPressed(null), []);
});
