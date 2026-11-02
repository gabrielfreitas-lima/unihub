import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandQueue } from '../src/renderer/core/command-queue.js';

test('envia em ordem e resolve sem esperar quando não há expect', async () => {
  const sent = [];
  const q = new CommandQueue({ send: async (b) => { sent.push(b[0]); } });
  await Promise.all([q.enqueue([1]), q.enqueue([2]), q.enqueue([3])]);
  assert.deepEqual(sent, [1, 2, 3]);
});

test('espera a resposta antes de mandar o próximo comando', async () => {
  const sent = [];
  const q = new CommandQueue({ send: async (b) => { sent.push(b[0]); }, timeoutMs: 1000 });
  const first = q.enqueue([1], { expect: (r) => r[0] === 0xa1 });
  const second = q.enqueue([2]);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(sent, [1]);
  assert.equal(q.onReport([0x99]), false);
  assert.equal(q.onReport([0xa1, 7]), true);
  assert.deepEqual(await first, [0xa1, 7]);
  await second;
  assert.deepEqual(sent, [1, 2]);
});

test('reenvia até o limite e depois rejeita', async () => {
  let count = 0;
  const q = new CommandQueue({ send: async () => { count++; }, timeoutMs: 5, maxAttempts: 3 });
  await assert.rejects(q.enqueue([1], { expect: () => false }), /3 tentativas/);
  assert.equal(count, 3);
});

test('limite de tentativas pode ser menor só para um comando', async () => {
  let count = 0;
  const q = new CommandQueue({ send: async () => { count++; }, timeoutMs: 5, maxAttempts: 10 });
  await assert.rejects(q.enqueue([1], { expect: () => false, maxAttempts: 2 }), /2 tentativas/);
  assert.equal(count, 2);
});

test('close rejeita o que estava pendente', async () => {
  const q = new CommandQueue({ send: async () => {}, timeoutMs: 1000 });
  const p = q.enqueue([1], { expect: () => false });
  q.close();
  await assert.rejects(p, /desconectado/);
  await assert.rejects(q.enqueue([2]), /desconectado/);
});
