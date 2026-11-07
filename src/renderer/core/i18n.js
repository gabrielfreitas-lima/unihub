// Idiomas do app. O código e as telas continuam escritos em português: este módulo
// observa a página e troca cada texto pela tradução, sem cada tela precisar saber
// disso. Texto sem tradução (nome de aparelho, tecla…) fica como está.

import { MESSAGES, PATTERNS } from './i18n-messages.js';

export const DEFAULT_LANGUAGE = 'pt';
export const LANGUAGES = [
  { id: 'pt', name: 'Português' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];
const COLUMN = { en: 0, es: 1 };
const ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'label'];

let language = DEFAULT_LANGUAGE;

export function getLanguage() {
  return language;
}

/** Traduz um texto inteiro, mantendo os espaços das pontas. */
export function translate(text, lang = language) {
  const column = COLUMN[lang];
  if (column === undefined || !text) return text;
  const core = text.trim();
  if (!core) return text;
  const translated = lookup(core, column);
  return translated === null ? text : text.replace(core, () => translated);
}

function lookup(text, column) {
  const message = MESSAGES[text];
  if (message) return message[column];
  for (const pattern of PATTERNS) {
    const match = pattern[0].exec(text);
    if (!match) continue;
    // O que muda dentro da frase (nome de efeito, de aba…) também pode ter tradução.
    return pattern[1 + column].replace(/\$(\d)/g, (_, n) => lookup(match[n], column) ?? match[n]);
  }
  return null;
}

// Guarda o original de cada texto traduzido, para poder trocar de idioma depois.
const originals = new WeakMap(); // nó de texto ou elemento -> { source, output } ou { atributo: … }

function translateText(node) {
  const known = originals.get(node);
  // O próprio texto que escrevemos não é novo: a tela só mudou se for diferente.
  const source = known && node.data === known.output ? known.source : node.data;
  const output = translate(source);
  originals.set(node, { source, output });
  if (node.data !== output) node.data = output;
}

function translateAttribute(el, name) {
  const value = el.getAttribute(name);
  if (value === null) return;
  const saved = originals.get(el) || {};
  const known = saved[name];
  const source = known && value === known.output ? known.source : value;
  const output = translate(source);
  saved[name] = { source, output };
  originals.set(el, saved);
  if (value !== output) el.setAttribute(name, output);
}

function translateTree(root) {
  if (root.nodeType === Node.TEXT_NODE) return translateText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return undefined;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) translateText(n);
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const name of ATTRIBUTES) if (el.hasAttribute(name)) translateAttribute(el, name);
  }
  return undefined;
}

let observer = null;

function apply(work) {
  observer?.disconnect();
  work();
  // O que acabamos de escrever não precisa voltar para cá.
  observer?.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES,
  });
}

/** Começa a traduzir a página. Chame uma vez, ao abrir o app. */
export function startTranslating() {
  observer = new MutationObserver((records) => apply(() => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(translateTree);
      else if (r.type === 'characterData') translateText(r.target);
      else translateAttribute(r.target, r.attributeName);
    }
  }));
  apply(() => translateTree(document.documentElement));
}

/** Troca o idioma e retraduz o que já está na tela. */
export function setLanguage(next) {
  language = LANGUAGES.some((l) => l.id === next) ? next : DEFAULT_LANGUAGE;
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
  apply(() => translateTree(document.documentElement));
}
