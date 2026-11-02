import test from 'node:test';
import assert from 'node:assert/strict';
import {
  packet, commands, readBlockPackets, writeBlockPackets, classify, parseFirmwareVersion, parseCurrentProfile, hasPhysicalInput, REPORT_RATE_OFFSET, reportRateHz, parseBattery,
  Cmd, PACKET_SIZE, CHUNK_SIZE, PROFILE_SIZE,
} from '../src/renderer/plugins/gamesir/protocol.js';

test('todo pacote tem 64 bytes e começa com o report ID 0x0F', () => {
  const p = packet(Cmd.READ_FW_VERSION);
  assert.equal(p.length, PACKET_SIZE);
  assert.deepEqual([...p.subarray(0, 3)], [0x0f, 0x09, 0x00]);
});

test('comandos simples', () => {
  assert.deepEqual([...commands.heartbeat().subarray(0, 3)], [0x0f, 0xf2, 0]);
  assert.deepEqual([...commands.heartbeat(true).subarray(0, 3)], [0x0f, 0xf2, 1]);
  assert.deepEqual([...commands.switchProfile(3).subarray(0, 3)], [0x0f, 0x07, 3]);
  assert.deepEqual([...commands.vibrate(300, -5).subarray(0, 6)], [0x0f, 0x20, 0x66, 0x55, 255, 0]);
  assert.deepEqual([...commands.lightPreview(false, 3).subarray(0, 4)], [0x0f, 0x0d, 0, 3]);
  assert.deepEqual([...commands.lightPreview(true).subarray(0, 4)], [0x0f, 0x0d, 1, 1]);
  assert.throws(() => commands.switchProfile(9));
});

test('leitura de perfil é dividida em blocos de 58 bytes com offset big-endian', () => {
  const pkts = readBlockPackets(2);
  assert.equal(pkts.length, Math.ceil(PROFILE_SIZE / CHUNK_SIZE));
  assert.deepEqual([...pkts[0].subarray(0, 6)], [0x0f, 0x04, 2, 0, 0, 58]);
  assert.deepEqual([...pkts[5].subarray(0, 6)], [0x0f, 0x04, 2, 0x01, 0x22, 58]); // 290
  const last = pkts.at(-1);
  assert.equal(last[5], PROFILE_SIZE - CHUNK_SIZE * (pkts.length - 1));
});

test('escrita carrega os dados logo após o cabeçalho', () => {
  const data = Uint8Array.from({ length: 70 }, (_, i) => i + 1);
  const pkts = writeBlockPackets(1, data, 0x100);
  assert.equal(pkts.length, 2);
  assert.deepEqual([...pkts[0].subarray(0, 8)], [0x0f, 0x03, 1, 0x01, 0x00, 58, 1, 2]);
  assert.equal(pkts[0][6 + 57], 58);
  assert.deepEqual([...pkts[1].subarray(0, 8)], [0x0f, 0x03, 1, 0x01, 0x3a, 12, 59, 60]);
  assert.ok(pkts.every((p) => p.length === PACKET_SIZE));
});

test('bateria no relatório de estado (bytes 35 e 36)', () => {
  const report = new Array(64).fill(0);
  report[0] = 0x12;
  report[36] = 100; // lido de um Cyclone 2 via cabo
  assert.deepEqual(parseBattery(report), { percent: 100, charging: false });
  report[35] = 1;
  report[36] = 42;
  assert.deepEqual(parseBattery(report), { percent: 42, charging: true });
  report[36] = 0; // dongle sem controle: tudo zerado
  assert.equal(parseBattery(report), null);
  report[36] = 180;
  assert.equal(parseBattery(report), null);
});

test('taxa de relatório: 1 byte no offset 46 de cada perfil', () => {
  assert.equal(REPORT_RATE_OFFSET, 46);
  assert.equal(reportRateHz('cyclone2', 0), 250);
  assert.equal(reportRateHz('cyclone2', 2), 1000);
  assert.equal(reportRateHz('cyclone2', 5), null);
  assert.equal(reportRateHz('desconhecido', 2), null);
  // Leitura e gravação de 1 byte nesse offset.
  assert.deepEqual([...readBlockPackets(3, 46, 1)[0].subarray(0, 6)], [0x0f, 0x04, 3, 0, 46, 1]);
  assert.deepEqual([...writeBlockPackets(3, Uint8Array.of(1), 46)[0].subarray(0, 7)], [0x0f, 0x03, 3, 0, 46, 1, 1]);
});

test('classifica relatórios de entrada (resposta = report 0x10, comando + 1)', () => {
  assert.deepEqual(classify([0x12, 1, 2]), { kind: 'state' });
  assert.deepEqual(classify([0x10, 0x0a, 0x30]), { kind: 'response', cmd: 0x09 });
  assert.deepEqual(classify([0x0f, 0x09]), { kind: 'other' });
});

// Relatórios de estado reais (Cyclone 2 parado): só os sensores (byte 10+) mudam.
test('detecta toque físico e ignora sensores de movimento', () => {
  const rest = [0x12, 0x80, 0x80, 0x80, 0x80, 0x0f, 0, 0, 0, 0, 0xc9, 0xef, 0x00, 0x0c];
  const motion = [...rest]; motion[10] = 0x10; motion[13] = 0x0f;
  assert.equal(hasPhysicalInput(rest, motion), false);
  const stickNoise = [...rest]; stickNoise[1] = 0x88;
  assert.equal(hasPhysicalInput(rest, stickNoise), false);
  const stickMoved = [...rest]; stickMoved[3] = 0xff;
  assert.equal(hasPhysicalInput(rest, stickMoved), true);
  const button = [...rest]; button[6] = 0x01;
  assert.equal(hasPhysicalInput(rest, button), true);
  const dpad = [...rest]; dpad[5] = 0x00;
  assert.equal(hasPhysicalInput(rest, dpad), true);
  assert.equal(hasPhysicalInput(null, rest), false);
});

// Respostas capturadas de um GameSir Cyclone 2 (modo Xbox, PID 0x1053).
test('interpreta versão do firmware e perfil atual reais', () => {
  const fw = [0x10, 0x0a, 0x30, 0x00, 0x33, 0x00, 0x35, 0x00, 0x36, 0x00, 0x00, 0x00];
  assert.deepEqual(parseFirmwareVersion(fw), { controller: '3.56' });
  // Sem fio (PID 0x100B): versão do controle seguida da versão do dongle.
  const wireless = [0x10, 0x0a, ...[...'03560121'].flatMap((c) => [c.charCodeAt(0), 0]), 0, 0];
  assert.deepEqual(parseFirmwareVersion(wireless), { controller: '3.56', dongle: '1.21' });
  assert.equal(parseCurrentProfile([0x10, 0x0c, 0x01, 0x00]), 1);
});
