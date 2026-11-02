import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '../src/renderer/shared/color-picker.js';

test('normaliza códigos hex', () => {
  assert.equal(normalize('#FFAA00'), '#ffaa00');
  assert.equal(normalize('ffaa00'), '#ffaa00');
  assert.equal(normalize('xyz'), '#000000');
  assert.equal(normalize('#12', null), null);
});

test('ida e volta hex → RGB → HSV → RGB → hex', () => {
  for (const hex of ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ff8000', '#00b4ff', '#7f3a91']) {
    assert.deepEqual(rgbToHex(hexToRgb(hex)), hex);
    assert.equal(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb(hex)))), hex, hex);
  }
});

test('HSV de cores conhecidas', () => {
  assert.deepEqual(rgbToHsv([255, 0, 0]), { h: 0, s: 1, v: 1 });
  assert.equal(rgbToHsv([0, 0, 255]).h, 240);
  assert.deepEqual(hsvToRgb({ h: 120, s: 1, v: 1 }), [0, 255, 0]);
});
