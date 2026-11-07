// Mini-helper para montar a interface sem framework.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    // Via CSSOM: a CSP da página bloqueia o atributo style vindo de setAttribute.
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

/** Sub-abas dentro da aba de um fabricante. Cada item: { id, label, render(): Node, disabled?, hint? } */
export function subTabs(items) {
  const nav = h('nav', { class: 'subtabs', role: 'tablist' });
  const body = h('div', { class: 'subtab-body' });
  let active = null;

  function select(item) {
    active = item;
    for (const btn of nav.children) btn.setAttribute('aria-selected', String(btn.dataset.id === item.id));
    clear(body, item.render());
  }

  for (const item of items) {
    nav.append(
      h('button', {
        class: 'subtab',
        role: 'tab',
        dataset: { id: item.id },
        // Clicar na sub-aba que já está aberta não recarrega a tela.
        onclick: () => { if (item !== active) select(item); },
      }, item.label, item.disabled ? h('span', { class: 'pill muted' }, 'em breve') : null),
    );
  }
  if (items.length) select(items[0]);
  return { element: h('div', { class: 'subtab-wrap' }, nav, body), rerender: () => active && select(active) };
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h3', {}, title) : null, ...children);
}

export function button(label, onclick, { kind = 'secondary', disabled = false } = {}) {
  return h('button', { class: `btn ${kind}`, onclick, disabled }, label);
}
