import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, LANGUAGES } from '../src/renderer/core/i18n.js';
import { MESSAGES, PATTERNS } from '../src/renderer/core/i18n-messages.js';

test('três idiomas, cada um com o nome no próprio idioma', () => {
  assert.deepEqual(LANGUAGES.map((l) => l.name), ['Português', 'English', 'Español']);
});

test('toda tradução tem inglês e espanhol', () => {
  for (const [source, row] of Object.entries(MESSAGES)) {
    assert.equal(row.length, 2, source);
    assert.ok(row.every(Boolean), source);
  }
  for (const pattern of PATTERNS) {
    assert.equal(pattern.length, 3, String(pattern[0]));
    const groups = new RegExp(`${pattern[0].source}|`).exec('').length - 1;
    for (const text of pattern.slice(1)) {
      for (let n = 1; n <= groups; n++) assert.ok(text.includes(`$${n}`), `${pattern[0]} sem $${n}: ${text}`);
    }
  }
});

test('traduz texto inteiro e mantém o português como padrão', () => {
  assert.equal(translate('Configurações', 'en'), 'Settings');
  assert.equal(translate('Configurações', 'es'), 'Configuración');
  assert.equal(translate('Configurações', 'pt'), 'Configurações');
});

test('mantém os espaços das pontas, usados ao juntar pedaços de frase', () => {
  assert.equal(translate('Algum aparelho não apareceu? ', 'en'), 'Is a device missing? ');
  assert.equal(translate('Brilho ', 'es'), 'Brillo ');
});

test('não mexe em nomes de aparelhos nem de teclas', () => {
  for (const text of ['GameSir Cyclone 2', 'AULA F75', 'A', 'Home', 'L4', '054C:09CC']) {
    assert.equal(translate(text, 'en'), text);
  }
});

test('traduz frases com partes variáveis, inclusive o que está dentro delas', () => {
  assert.equal(translate('Exportar perfil 2', 'en'), 'Export profile 2');
  assert.equal(translate('Ativar aba Teclados', 'en'), 'Enable Keyboards tab');
  assert.equal(translate('Ajustes de Respirar', 'es'), 'Ajustes de Respiración');
  assert.equal(translate('Direcional ↑ (padrão)', 'es'), 'Cruceta ↑ (predeterminado)');
  assert.equal(translate('A (padrão)', 'en'), 'A (default)');
});
