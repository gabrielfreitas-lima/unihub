import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLedBlock, readLedState, effectSettings, withEffect, effectColors, withColor,
  receiverReadRequest, receiverWritePackets, parseReceiverPacket, assembleReceiverPackets,
  wiredPacket, parseWiredResponse, EFFECTS, parseBattery,
} from '../src/renderer/plugins/aula/protocol.js';

const hex = (s) => s.trim().split(/\s+/).map((x) => parseInt(x, 16));

// Bloco de luz real de um AULA F75 (efeito 15, lido pelo receptor).
const BLOCK = [0, 3, 3, 1, 0, 0, 4, 4, 7, 0, 15, 32, 1, 0, 1, 0, 0, 0, 0, 0, 2, 1, 0, 255, 10, 0, 1, 0, 1, 0, 3, 1,
  ...new Array(24).fill(0), 255, 255, 9, 65, 9, 71, 0, 71, 9, 71, 9, 71, 0, 71, 8, 71, 9, 71, 9, 71, 9, 64, 0, 71, 9, 71,
  7, 71, 9, 71, 9, 71, 9, 71, 9, 71, 9, 71, 9, 71, 9, 55, 7, 71, 7, 71, 7, 68, 7, 68, 7, 68, 7, 68, 7, 68, 7, 68, 7, 68,
  4, 9, 4, 4, 4, 4, 4, 4, 4, 4, 90, 165];

test('bloco de luz: confere tamanho e a marca 5A A5', () => {
  assert.equal(BLOCK.length, 128);
  assert.ok(isLedBlock(BLOCK));
  assert.ok(!isLedBlock(BLOCK.slice(0, 126)));
  assert.equal(readLedState(BLOCK).effect, 15);
});

test('dois bytes por efeito: brilho; velocidade e cor', () => {
  // Sempre ligado (1): 0x3A = 09, 0x3B = 41.
  assert.deepEqual(effectSettings(BLOCK, 1), { brightness: 9, speed: 4, colorMode: 1 });
  // Respirar (2): 0x3C = 09, 0x3D = 47 (confirmado: brilho 0 no app oficial zera o 0x3C).
  assert.deepEqual(effectSettings(BLOCK, 2), { brightness: 9, speed: 4, colorMode: 7 });
});

test('mudar um ajuste mexe só nos 4 bits dele', () => {
  const speedOnly = withEffect(BLOCK, 2, { speed: 0 });
  assert.equal(speedOnly[0x3d], 0x07); // velocidade 0; a cor (4 bits de baixo) continua
  const out = withEffect(BLOCK, 2, { speed: 1, colorMode: 0, brightness: 3 });
  assert.equal(out[10], 2);
  assert.equal(out[0x3c], 3);
  assert.equal(out[0x3d], 0x10);
  assert.equal(out.filter((b, i) => b !== BLOCK[i]).length, 3);
  // Valores fora da faixa são limitados.
  assert.deepEqual(effectSettings(withEffect(BLOCK, 1, { brightness: 20, speed: 9, colorMode: 12 }), 1), { brightness: 9, speed: 4, colorMode: 7 });
});

test('tabela de cores: 7 cores RGB por efeito, gravada com a marca em 0x1FA', () => {
  const table = new Array(490).fill(0);
  table.splice(21, 6, 0xff, 0, 0, 0, 0xff, 0);
  assert.deepEqual(effectColors(table, 1).slice(0, 2), ['#ff0000', '#00ff00']);
  const out = withColor(table, 2, 0, '#0000ff');
  assert.equal(out.length, 512);
  assert.deepEqual(out.slice(42, 45), [0, 0, 0xff]);
  assert.deepEqual(out.slice(0x1fa, 0x1fc), [0x5a, 0xa5]);
  assert.deepEqual(effectColors(out, 1)[0], '#ff0000');
});

test('receptor: pedido de leitura e soma de conferência', () => {
  assert.deepEqual([...receiverReadRequest(0x44)], [0x44, 1, 0, 0, ...new Array(14).fill(0), 0x58]);
  // Pacote real de resposta: 44 0a 00 0e …
  const p = parseReceiverPacket(hex('44 0a 00 0e 00 03 03 01 00 00 04 04 07 00 0f 20 01 00 b5'));
  assert.deepEqual([p.cmd, p.total, p.index, p.data.length], [0x44, 10, 0, 14]);
  assert.deepEqual(p.data.slice(0, 4), [0, 3, 3, 1]);
});

test('receptor: gravação em pacotes de 14 bytes, que remontam o bloco', () => {
  const packets = receiverWritePackets(0x04, BLOCK);
  assert.equal(packets.length, 10);
  assert.deepEqual([...packets[9].slice(0, 6)], [0x04, 10, 9, 2, 0x5a, 0xa5]);
  for (const p of packets) {
    const sum = [0x13, ...p.slice(0, 18)].reduce((a, b) => a + b, 0) & 0xff;
    assert.equal(p[18], sum);
  }
  const parsed = packets.map(parseReceiverPacket).reverse(); // fora de ordem
  assert.deepEqual(assembleReceiverPackets(parsed), BLOCK);
  assert.equal(assembleReceiverPackets(parsed.slice(1)), null); // faltou um
});

test('cabo: relatório 6 com cabeçalho de 7 bytes (sem o ID) e dados a partir do 8º', () => {
  const req = wiredPacket(0x84, [], 128);
  assert.equal(req.length, 519);
  assert.deepEqual([...req.slice(0, 8)], [0x84, 0, 0, 1, 0, 128, 0, 0]);
  const write = wiredPacket(0x04, BLOCK);
  assert.deepEqual([...write.slice(7, 11)], [0, 3, 3, 1]);
  // Resposta real: 6 84 0 0 1 0 80 0 | bloco
  const resp = [6, 0x84, 0, 0, 1, 0, 128, 0, ...BLOCK];
  assert.deepEqual(parseWiredResponse(resp, 128), BLOCK);
  assert.deepEqual(parseWiredResponse(resp.slice(1), 128), BLOCK);
});

test('bateria pelo receptor: porcentagem e carregando', () => {
  // Resposta real do F75 no dongle: 4a 01 00 02 | 64 01 (100%, sem carregar).
  const p = parseReceiverPacket(hex('4a 01 00 02 64 01 00 00 00 00 00 00 00 00 00 00 00 00 00'));
  assert.deepEqual(parseBattery(p.data), { percent: 100, charging: false });
  assert.deepEqual(parseBattery([57, 0x10]), { percent: 57, charging: true });
  assert.deepEqual(parseBattery([57, 0x11]), { percent: 57, charging: false });
  assert.equal(parseBattery([200, 0]), null);
  assert.equal(parseBattery([]), null);
});

test('lista de efeitos: códigos de 1 a 17, sem repetição', () => {
  // O 18 (tempestade giratória) existe no teclado, mas fica fora da lista.
  assert.deepEqual(EFFECTS.map((e) => e.code), Array.from({ length: 17 }, (_, i) => i + 1));
  // Roda arco-íris só funciona no colorido; Sempre ligado não tem velocidade.
  assert.equal(EFFECTS.find((e) => e.code === 6).colors, false);
  assert.equal(EFFECTS.find((e) => e.code === 1).speed, false);
  assert.equal(EFFECTS.find((e) => e.code === 2).colors, true);
});
