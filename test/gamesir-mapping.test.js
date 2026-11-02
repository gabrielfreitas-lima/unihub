import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUTTONS, KEY_SIZE, KEYS_OFFSET, DISABLED, parseMapping, buildMapping, countRemapped, targetName,
} from '../src/renderer/plugins/gamesir/mapping.js';

const blank = () => new Uint8Array(BUTTONS.length * KEY_SIZE); // perfil de fábrica: tudo zero

test('layout: 16 botões de 7 bytes a partir do byte 64', () => {
  assert.equal(KEYS_OFFSET, 64);
  assert.equal(BUTTONS.length, 16);
  assert.equal(BUTTONS.findIndex((b) => b.id === 'a'), 8); // A é o 9º botão
});

test('perfil de fábrica: nenhum botão remapeado', () => {
  const entries = parseMapping(blank());
  assert.equal(countRemapped(entries), 0);
  assert.deepEqual(buildMapping(entries), blank());
});

test('A → B grava exatamente os bytes confirmados no controle', () => {
  const entries = parseMapping(blank());
  const a = BUTTONS.findIndex((b) => b.id === 'a');
  entries[a] = { ...entries[a], target: 10 };
  const bytes = buildMapping(entries);
  assert.deepEqual([...bytes.slice(a * KEY_SIZE, (a + 1) * KEY_SIZE)], [0, 0, 1, 10, 0, 0, 0]);
  // só os bytes do A mudaram
  bytes.forEach((v, i) => { if (i < a * KEY_SIZE || i >= (a + 1) * KEY_SIZE) assert.equal(v, 0); });
  assert.equal(parseMapping(bytes)[a].target, 10);
});

test('desativar, voltar ao padrão e preservar turbo/alternar', () => {
  const raw = blank();
  raw.set([1, 5, 0, 0, 0, 0, 1], 0); // ↑ com turbo ligado e "alternar"
  const entries = parseMapping(raw);
  entries[0] = { ...entries[0], target: DISABLED };
  let bytes = buildMapping(entries);
  assert.deepEqual([...bytes.slice(0, 7)], [1, 5, 1, 255, 0, 0, 1]);
  const back = parseMapping(bytes);
  back[0] = { ...back[0], target: null };
  bytes = buildMapping(back);
  assert.deepEqual([...bytes.slice(0, 7)], [1, 5, 0, 0, 0, 0, 1]);
});

test('mapear para o próprio botão conta como padrão', () => {
  const raw = blank();
  raw.set([0, 0, 1, 9, 0, 0, 0], 8 * KEY_SIZE); // A → A
  assert.equal(parseMapping(raw)[8].target, null);
});

test('nomes dos destinos', () => {
  assert.equal(targetName(10), 'B');
  assert.equal(targetName(20), 'RT');
  assert.equal(targetName(255), 'Desativado');
});
