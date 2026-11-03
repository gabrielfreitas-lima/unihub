import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORT, LONG, request, isReplyTo, payload, root, decodeName, parseUnifiedBattery, HidppError,
} from '../src/renderer/plugins/headsets/logitech/hidpp.js';

test('requisição curta e longa têm o tamanho certo', () => {
  const s = root.ping(SHORT, 0xff);
  assert.equal(s.length, 7);
  assert.deepEqual([...s], [0x10, 0xff, 0x00, 0x1b, 0, 0, 0x5a]);
  const l = root.getFeature(LONG, 1, 0x1004);
  assert.equal(l.length, 20);
  assert.deepEqual([...l.subarray(0, 6)], [0x11, 1, 0x00, 0x0b, 0x10, 0x04]);
});

test('reconhece resposta e erros 2.0/1.0 da mesma requisição', () => {
  const req = request(LONG, 2, 0x05, 1, [0]);
  const ok = Uint8Array.from([0x11, 2, 0x05, req[3], 0x4d, 0x58]);
  assert.ok(isReplyTo(req, ok));
  assert.deepEqual([...payload(ok).subarray(0, 2)], [0x4d, 0x58]);

  const err2 = Uint8Array.from([0x11, 2, 0xff, 0x05, req[3], 0x07]);
  assert.ok(isReplyTo(req, err2));
  assert.throws(() => payload(err2), HidppError);

  const err1 = Uint8Array.from([0x10, 2, 0x8f, 0x05, req[3], 0x09, 0]);
  assert.ok(isReplyTo(req, err1));
  assert.throws(() => payload(err1), /não suportado/);

  assert.ok(!isReplyTo(req, Uint8Array.from([0x11, 3, 0x05, req[3]])));
});

test('decodifica nome em pedaços e bateria unificada', () => {
  const enc = new TextEncoder();
  assert.equal(decodeName([enc.encode('G502 X '), enc.encode('PLUS\0\0')]), 'G502 X PLUS');
  assert.deepEqual(parseUnifiedBattery([80, 4, 1]), { percent: 80, level: 'boa', status: 'carregando' });
});
