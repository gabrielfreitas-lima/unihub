import test from 'node:test';
import assert from 'node:assert/strict';
import { PadBinder, padChanged, snapshot } from '../src/renderer/plugins/gamepads/pad-binding.js';

const pad = (index, pressed = [], axes = [0, 0, 0, 0]) => ({
  index,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  axes,
});

test('detecta mudança de botão e de stick, ignora tremida pequena', () => {
  const a = snapshot(pad(0));
  assert.equal(padChanged(a, snapshot(pad(0, [0]))), true);
  assert.equal(padChanged(a, snapshot(pad(0, [], [0.9, 0, 0, 0]))), true);
  assert.equal(padChanged(a, snapshot(pad(0, [], [0.1, -0.1, 0, 0]))), false);
});

test('liga o controle tocado ao único gamepad que mudou junto', () => {
  const b = new PadBinder();
  b.observe([pad(0), pad(1)], 1000);
  b.observe([pad(0), pad(1, [0])], 1100); // gamepad 1 apertou A
  assert.equal(b.touched('hid-7', 1120), true);
  assert.equal(b.padFor('hid-7'), 1);
  assert.deepEqual(b.unboundIndexes([0, 1]), [0]);
});

test('não liga quando dois gamepads mudaram ao mesmo tempo ou nenhum mudou', () => {
  const b = new PadBinder();
  b.observe([pad(0), pad(1)], 1000);
  b.observe([pad(0, [1]), pad(1, [0])], 1100);
  assert.equal(b.touched('hid-7', 1120), false);
  assert.equal(b.touched('hid-7', 5000), false); // muito depois da mudança
  assert.equal(b.padFor('hid-7'), undefined);
});

test('gamepad desconectado desfaz a ligação; religar em outro controle troca o dono', () => {
  const b = new PadBinder();
  b.observe([pad(0)], 1000);
  b.observe([pad(0, [0])], 1100);
  b.touched('hid-1', 1110);
  b.observe([pad(0, [])], 2000);
  b.touched('hid-2', 2010);
  assert.equal(b.padFor('hid-2'), 0);
  assert.equal(b.padFor('hid-1'), undefined);
  b.observe([], 3000);
  assert.equal(b.padFor('hid-2'), undefined);
});
