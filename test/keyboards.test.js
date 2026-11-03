import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardGroups, isKeyboardOrMouse, brandOf } from '../src/renderer/plugins/teclados/detect.js';
import { keyboardLayout, defaultLayout, keyLabel } from '../src/renderer/plugins/teclados/layouts.js';
import { aulaName, aulaTester, aulaMaxBrightness } from '../src/renderer/plugins/teclados/aula/devices.js';

const dev = (productName, vendorId, productId, usages) => ({
  productName, vendorId, productId,
  collections: usages.map(([usagePage, usage]) => ({ usagePage, usage })),
});

// Interfaces reais de um PC com um AULA F75 (cabo e receptor 2.4G ligados), um
// controle em modo Xbox e um headset.
const DEVICES = [
  dev('Gaming Keyboard', 0x258a, 0x010c, [[0x01, 0x80], [0x0c, 0x01], [0xff00, 0x01], [0x01, 0x02], [0x01, 0x06]]),
  dev('Gaming Keyboard', 0x258a, 0x010c, [[0x01, 0x06]]),
  dev('Controller (Xbox 360 Controller for Windows)', 0x3537, 0x100b, [[0x01, 0x05]]),
  dev('Xbox 360 Controller for Windows', 0x3537, 0x100b, [[0x0c, 0x01], [0x01, 0x02], [0xfff0, 0x40], [0x01, 0x06]]),
  dev('2.4G Wireless Receiver', 0x3554, 0xfa09, [[0x01, 0x06]]),
  dev('2.4G Wireless Receiver', 0x3554, 0xfa09, [[0x01, 0x06], [0xff02, 0x02], [0x0c, 0x01], [0x01, 0x80], [0x01, 0x02]]),
  dev('MCHOSE V9 PRO', 0x291d, 0x385d, [[0x0b, 0x01], [0xff90, 0x01], [0x0c, 0x01]]),
];

test('acha o teclado e ignora controle, headset e receptor de mouse', () => {
  const found = keyboardGroups(DEVICES.filter(isKeyboardOrMouse));
  // Receptor de mouse desconhecido (com interface de teclado) fica de fora.
  assert.deepEqual(keyboardGroups([dev('2.4G Receiver', 0x1111, 0x2222, [[0x01, 0x06], [0x01, 0x02]])]), []);
  assert.deepEqual(found.map((k) => [k.vidPid, k.name, k.devices.length]), [['258a:010c', 'Gaming Keyboard', 2]]);
});

test('receptor só de teclado conta como teclado, pelo receptor', () => {
  const [k] = keyboardGroups([dev('Wireless Receiver', 0x1234, 0x0001, [[0x01, 0x06], [0x0c, 0x01]])]);
  assert.equal(k.connection, 'via dongle');
  assert.equal(keyboardGroups([dev('', 0x1234, 0x0002, [[0x01, 0x06]])])[0].name, 'Teclado');
});

test('fabricante pelo VID, com aviso para fabricante de chip', () => {
  assert.equal(brandOf(0x1532), 'Razer');
  assert.match(brandOf(0x258a), /^SINO WEALTH \(fabricante do chip/);
  assert.equal(brandOf(0x9999), null);
});

for (const [kind, shape] of [['abnt2', 'full'], ['ansi', 'full'], ['abnt2', 'f75'], ['ansi', 'f75'], ['abnt2', 'f87'], ['abnt2', 'f99']]) {
  test(`layout ${shape} ${kind}: teclas sem sobreposição e dentro do desenho`, () => {
    const { width: BOARD_WIDTH, height: BOARD_HEIGHT, keys } = keyboardLayout(kind, shape);
    assert.equal(new Set(keys.map((k) => k.code)).size, keys.length);
    for (const k of keys) {
      assert.ok(k.x >= 0 && k.y >= 0 && k.x + k.w <= BOARD_WIDTH + 1e-9 && k.y + k.h <= BOARD_HEIGHT + 1e-9, k.code);
    }
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const a = keys[i];
        const b = keys[j];
        const overlap = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
        assert.ok(!overlap, `${a.code} × ${b.code}`);
      }
    }
  });
}

test('ABNT2 tem as duas teclas a mais (\\ e /), o ANSI não', () => {
  const codes = (kind) => keyboardLayout(kind).keys.map((k) => k.code);
  assert.ok(codes('abnt2').includes('IntlBackslash') && codes('abnt2').includes('IntlRo'));
  assert.ok(!codes('ansi').includes('IntlBackslash'));
  assert.equal(codes('abnt2').length, codes('ansi').length + 2);
});

test('layout padrão e nome das teclas', () => {
  assert.equal(defaultLayout('pt-BR'), 'abnt2');
  assert.equal(defaultLayout('en-US'), 'ansi');
  assert.equal(keyLabel('KeyA'), 'A');
  assert.equal(keyLabel('Semicolon', new Map([['Semicolon', 'ç']])), 'Ç');
  assert.equal(keyLabel('ControlLeft'), 'Ctrl');
  assert.equal(keyLabel('Numpad7'), '7');
  assert.equal(keyLabel('F11'), 'F11');
});

// Interfaces reais de um AULA F75: no cabo e pelo receptor 2.4G (que também tem interface de mouse).
const AULA_WIRED = DEVICES.slice(0, 2);
const AULA_RECEIVER = DEVICES.slice(4, 6);

test('AULA série F: reconhecido no cabo e pelo receptor, um de cada vez', () => {
  assert.deepEqual(keyboardGroups([...AULA_RECEIVER]).map((k) => [k.vidPid, k.brand, k.connection]),
    [['3554:fa09', 'aula', 'via dongle']]);
  // Com o cabo ligado, o teclado usa o cabo: o receptor fica de fora.
  assert.deepEqual(keyboardGroups([...AULA_WIRED, ...AULA_RECEIVER]).map((k) => [k.vidPid, k.connection]),
    [['258a:010c', 'via cabo']]);
});

test('AULA: nome e desenho pelo modelo escolhido', () => {
  assert.equal(aulaName('f75'), 'AULA F75');
  assert.equal(aulaName(null), 'AULA série F');
  assert.deepEqual(aulaTester('f75'), { shape: 'f75', kind: 'abnt2' });
  assert.deepEqual(aulaTester('f99'), { shape: 'f99', kind: 'abnt2' });
  assert.deepEqual(aulaTester(null), {}); // sem modelo: teclado padrão
  // Brilho: F75 de 0 a 9; F87, F99 e sem modelo, de 0 a 4.
  assert.deepEqual(['f75', 'f87', 'f99', null].map(aulaMaxBrightness), [9, 4, 4, 4]);
});

test('F75: 75% com botão de volume, Fn e sem teclado numérico', () => {
  const keys = keyboardLayout('abnt2', 'f75').keys;
  const knob = keys.find((k) => k.code === 'Knob');
  assert.deepEqual(knob.codes, ['AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute']);
  assert.ok(keys.find((k) => k.code === 'Fn').fixed);
  assert.ok(!keys.some((k) => k.code.startsWith('Numpad')));
  assert.equal(keys.length, 82);
});

test('F87 e F99: formatos da AULA, com Fn só desenhado', () => {
  const f87 = keyboardLayout('abnt2', 'f87').keys;
  assert.equal(f87.length, 88);
  assert.ok(!f87.some((k) => k.code.startsWith('Numpad')));
  assert.ok(f87.find((k) => k.code === 'Fn').fixed && !f87.some((k) => k.code === 'MetaRight'));
  const f99 = keyboardLayout('abnt2', 'f99').keys;
  assert.ok(f99.some((k) => k.code === 'NumpadEnter') && !f99.some((k) => k.code === 'Insert'));
  assert.ok(f99.find((k) => k.code === 'Fn').fixed);
});
