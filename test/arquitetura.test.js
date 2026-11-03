import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RENDERER = resolve(dirname(fileURLToPath(import.meta.url)), '../src/renderer');
const PLUGINS = join(RENDERER, 'plugins');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : e.name.endsWith('.js') ? [p] : [];
  });
}

function imports(file) {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/\bfrom\s+['"](\.[^'"]+)['"]/g)]
    .map((m) => relative(RENDERER, resolve(dirname(file), m[1])).replaceAll('\\', '/'));
}

const name = (file) => relative(RENDERER, file).replaceAll('\\', '/');

test('plugins não dependem da tela: nada de frontend, shared ou desenho de página', () => {
  const offenders = sourceFiles(PLUGINS).flatMap((file) => imports(file)
    .filter((i) => i.startsWith('frontend/') || i.startsWith('shared/') || i === 'core/dom.js')
    .map((i) => `${name(file)} -> ${i}`));
  assert.deepEqual(offenders, []);
});

test('cada plugin de marca fica em plugins/<tipo>/<marca>/', () => {
  const tipos = readdirSync(PLUGINS, { withFileTypes: true });
  assert.ok(tipos.every((e) => e.isDirectory()), 'plugins/ só tem pastas de tipo de aparelho');
  assert.deepEqual(tipos.map((e) => e.name).sort(), ['gamepads', 'headsets', 'teclados']);
  const marcas = (tipo) => readdirSync(join(PLUGINS, tipo), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(marcas('gamepads'), ['gamesir']);
  assert.deepEqual(marcas('headsets'), ['logitech', 'mchose']);
  assert.deepEqual(marcas('teclados'), ['aula']);
});

test('um plugin de marca não usa o plugin de outra marca', () => {
  const offenders = sourceFiles(PLUGINS).flatMap((file) => {
    const [, tipo, marca] = name(file).split('/');
    if (marca.endsWith('.js')) return [];
    return imports(file)
      .filter((i) => {
        const [raiz, t, m, resto] = i.split('/');
        return raiz === 'plugins' && resto && !(t === tipo && m === marca);
      })
      .map((i) => `${name(file)} -> ${i}`);
  });
  assert.deepEqual(offenders, []);
});
