import test from 'node:test';
import assert from 'node:assert/strict';
import { BatteryAlerts, formatAge, batteryLevel } from '../src/renderer/shared/battery.js';

const b = (percent, charging = false) => ({ percent, charging });

test('avisa uma vez em 20% e uma vez em 10%', () => {
  const a = new BatteryAlerts();
  assert.equal(a.check('c1', b(50)), null);
  assert.equal(a.check('c1', b(20)), 20);
  assert.equal(a.check('c1', b(19)), null); // não repete
  assert.equal(a.check('c1', b(10)), 10);
  assert.equal(a.check('c1', b(5)), null);
});

test('abrindo já com bateria muito baixa, avisa só o limite mais baixo', () => {
  const a = new BatteryAlerts();
  assert.equal(a.check('c1', b(8)), 10);
  assert.equal(a.check('c1', b(7)), null);
});

test('carregando não avisa e rearma os avisos; subir 5 pontos também rearma', () => {
  const a = new BatteryAlerts();
  assert.equal(a.check('c1', b(18)), 20);
  assert.equal(a.check('c1', b(18, true)), null);
  assert.equal(a.check('c1', b(18)), 20); // tirou do cabo de novo
  assert.equal(a.check('c1', b(26)), null); // subiu acima de 25%
  assert.equal(a.check('c1', b(20)), 20);
});

test('cada controle tem seus próprios avisos', () => {
  const a = new BatteryAlerts();
  assert.equal(a.check('c1', b(15)), 20);
  assert.equal(a.check('c2', b(15)), 20);
});

test('idade da leitura e nível de cor', () => {
  assert.equal(formatAge(10_000), 'agora');
  assert.equal(formatAge(60_000), 'há 1 min');
  assert.equal(formatAge(12 * 60_000), 'há 12 min');
  assert.equal(formatAge(125 * 60_000), 'há 2 h');
  assert.equal(batteryLevel(15), 'low');
  assert.equal(batteryLevel(40), 'mid');
  assert.equal(batteryLevel(41), 'ok');
});
