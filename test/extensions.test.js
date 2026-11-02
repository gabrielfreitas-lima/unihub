import test from 'node:test';
import assert from 'node:assert/strict';
import { Extensions } from '../src/renderer/core/extensions.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = String(v); } };
}

test('começa sem extensões e lembra o que foi instalado', () => {
  const storage = memoryStorage();
  const ext = new Extensions(storage);
  assert.equal(ext.has('logitech'), false);
  const events = [];
  ext.addEventListener('change', (e) => events.push(e.detail));
  ext.install('logitech');
  ext.install('logitech'); // repetido não dispara de novo
  assert.deepEqual(events, [{ id: 'logitech', installed: true }]);
  assert.equal(new Extensions(storage).has('logitech'), true);
  ext.uninstall('logitech');
  assert.equal(new Extensions(storage).has('logitech'), false);
});

test('a extensão antiga "gamesir" vira "gamepads"', () => {
  const ext = new Extensions(memoryStorage({ 'unihub.installedHubs': '["gamesir"]' }));
  assert.equal(ext.has('gamepads'), true);
  assert.equal(ext.has('gamesir'), false);
});

test('armazenamento corrompido ou ausente não quebra', () => {
  assert.equal(new Extensions(memoryStorage({ 'unihub.installedHubs': '{oops' })).has('x'), false);
  const ext = new Extensions(null);
  ext.install('logitech');
  assert.equal(ext.has('logitech'), true);
});
