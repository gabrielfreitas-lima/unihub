import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNames, isGenericName, cleanName, splitDongles } from '../src/renderer/plugins/gamepads/gamesir/names.js';

function memoryStorage() {
  const data = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
}

const dongle = { productId: 0x0575, productName: 'GameSir-Cyclone 2' };
const wireless = { productId: 0x100b, productName: 'Xbox 360 Controller for Windows' };
const xinputOnly = { productId: 0x100b, productName: 'Controller (Xbox 360 Controller for Windows)' };

test('reconhece nomes genéricos do Windows', () => {
  assert.ok(isGenericName('Xbox 360 Controller for Windows'));
  assert.ok(isGenericName('Controller (Xbox 360 Controller for Windows)'));
  assert.ok(!isGenericName('GameSir-Cyclone 2'));
  assert.equal(cleanName('GameSir-Cyclone 2'), 'GameSir Cyclone 2');
});

test('controle genérico herda o nome do dongle conectado', () => {
  const names = resolveNames([dongle, wireless, xinputOnly], memoryStorage());
  assert.equal(names.get(wireless).name, 'GameSir Cyclone 2');
  assert.equal(names.get(wireless).connection, 'via dongle');
  assert.equal(names.get(wireless).systemName, 'Xbox 360 Controller for Windows');
  assert.equal(names.get(dongle).name, 'GameSir Cyclone 2');
});

test('lembra o nome aprendido quando o dongle não aparece mais', () => {
  const storage = memoryStorage();
  resolveNames([{ productId: 0x2222, productName: 'GameSir-Nova Lite' }, { productId: 0x1111, productName: 'Xbox 360 Controller for Windows' }], storage);
  const later = { productId: 0x1111, productName: 'Xbox 360 Controller for Windows' };
  assert.equal(resolveNames([later], storage).get(later).name, 'GameSir Nova Lite');
});

test('sem dongle nem histórico: usa a tabela de PIDs, senão um nome neutro', () => {
  const storage = memoryStorage();
  assert.equal(resolveNames([wireless], storage).get(wireless).name, 'GameSir Cyclone 2');
  const unknown = { productId: 0x9999, productName: 'Xbox 360 Controller for Windows' };
  assert.equal(resolveNames([unknown], storage).get(unknown).name, 'Controle GameSir');
});

test('esconde o dongle quando o controle ligado nele está na lista', () => {
  const c1 = { productId: 0x100b, productName: 'Xbox 360 Controller for Windows' };
  const c2 = { productId: 0x100b, productName: 'Xbox 360 Controller for Windows' };
  const d1 = { productId: 0x0575, productName: 'GameSir-Cyclone 2' };
  assert.deepEqual(splitDongles([d1, c1]), { visible: [c1], hidden: [d1] });
  // Dois controles idênticos continuam separados.
  assert.deepEqual(splitDongles([c1, c2]), { visible: [c1, c2], hidden: [] });
  // Dongle sozinho é o único caminho até o controle: fica visível.
  assert.deepEqual(splitDongles([d1]), { visible: [d1], hidden: [] });
});

test('dois dongles diferentes: não chuta, cai na tabela/nome neutro', () => {
  const unknown = { productId: 0x9999, productName: 'Xbox 360 Controller for Windows' };
  const names = resolveNames([
    { productId: 1, productName: 'GameSir-Cyclone 2' },
    { productId: 2, productName: 'GameSir-Nova Lite' },
    unknown,
  ], memoryStorage());
  assert.equal(names.get(unknown).name, 'Controle GameSir');
});
