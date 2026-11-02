import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseLightBlock, buildLightBlock, changedRange, applyPreset, moveFrame,
  PRESETS, LED_LAYOUTS, LIGHT_BLOCK_SIZE, MAX_KEYFRAMES,
} from '../src/renderer/plugins/gamesir/lights.js';

// Bloco lido de um Cyclone 2 real, configurado com: animação I ativa,
// 1 quadro, brilho 100, velocidade 1, luzes 2 e 4 brancas, áudio desligado,
// "segure para despertar" ligado e suspensão desativada.
const hex = readFileSync(new URL('./fixtures/cyclone2-light-block.hex', import.meta.url), 'utf8').replace(/\s/g, '');
const real = Uint8Array.from(hex.match(/../g), (b) => parseInt(b, 16));
const c2 = LED_LAYOUTS.cyclone2;
const lightColors = (anim, f) => c2.map((l) => anim.frames[f][l.led]);

test('interpreta o bloco real com a configuração conhecida do controle', () => {
  assert.equal(real.length, LIGHT_BLOCK_SIZE);
  const m = parseLightBlock(real);
  assert.equal(m.activeAnimation, 0);
  const a1 = m.animations[0];
  assert.equal(a1.keyFrames, 1);
  assert.equal(a1.brightness, 100);
  assert.equal(a1.speed, 1);
  assert.deepEqual(lightColors(a1, 0), ['#000000', '#ffffff', '#000000', '#ffffff']);
  assert.equal(m.audioReactive, false);
  assert.equal(m.holdToWake, true);
  assert.equal(m.standbyMinutes, 0);
});

test('mapa das luzes do Cyclone 2 confere com as animações II e IV', () => {
  const m = parseLightBlock(real);
  // Animação II: luz 1 verde, luz 3 amarela, luzes 2 e 4 vermelhas.
  assert.deepEqual(lightColors(m.animations[1], 0), ['#00ff00', '#ff0000', '#ffff00', '#ff0000']);
  // Animação IV: luz 2 branca.
  assert.equal(lightColors(m.animations[3], 0)[1], '#ffffff');
});

test('ler e montar de novo devolve exatamente os mesmos bytes', () => {
  assert.deepEqual(buildLightBlock(parseLightBlock(real)), real);
});

test('editar um campo muda só os bytes dele', () => {
  const m = parseLightBlock(real);
  m.animations[0].brightness = 40;
  const range = changedRange(real, buildLightBlock(m));
  assert.deepEqual(range, { start: 4, end: 4 });
  m.animations[0].brightness = 100;
  m.holdToWake = false;
  m.standbyMinutes = 10;
  assert.deepEqual(changedRange(real, buildLightBlock(m)), { start: 626, end: 627 });
  assert.equal(changedRange(real, real), null);
});

test('velocidade é gravada invertida (20 − velocidade)', () => {
  const m = parseLightBlock(real);
  m.animations[0].speed = 20;
  assert.equal(buildLightBlock(m)[3], 0);
  m.animations[0].speed = 0;
  assert.equal(buildLightBlock(m)[3], 20);
});

test('predefinições preenchem só os LEDs do layout e preservam o LED não usado', () => {
  const m = parseLightBlock(real);
  const anim = m.animations[1];
  const unused = anim.frames.map((f) => f[2]);
  for (const preset of PRESETS) {
    applyPreset(anim, preset, c2);
    assert.ok(anim.keyFrames >= 1 && anim.keyFrames <= MAX_KEYFRAMES, preset.id);
    assert.deepEqual(anim.frames.map((f) => f[2]), unused, preset.id);
  }
  applyPreset(anim, PRESETS.find((p) => p.id === 'off'), c2);
  assert.equal(anim.keyFrames, 1);
  assert.deepEqual(lightColors(anim, 0), Array(4).fill('#000000'));
});

test('arrastar quadro-chave reordena', () => {
  const m = parseLightBlock(real);
  const anim = m.animations[1]; // 5 quadros
  const first = anim.frames[0];
  moveFrame(anim, 0, 2);
  assert.equal(anim.frames[2], first);
  assert.equal(anim.frames.length, MAX_KEYFRAMES);
});
