// Casca do app: abas das extensões de hub instaladas, Início e roteamento de
// dispositivos.
//
// Cada plugin recebe só os dispositivos que `matches()` aceita e decide o que
// mostrar. Os plugins não se conhecem entre si. Só as extensões instaladas
// pelo usuário aparecem no menu.

import { h, clear, button } from './core/dom.js';
import { HidManager, describe } from './core/hid-manager.js';
import { Extensions } from './core/extensions.js';
import { plugins } from './frontend/index.js';
import { batteryLevel } from './shared/battery.js';
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, setLanguage, startTranslating } from './core/i18n.js';

const STATUS_LABEL = { beta: 'beta', planned: 'em breve', tool: 'ferramenta' };

const hid = new HidManager();
const extensions = new Extensions();
const tabsEl = document.getElementById('tabs');
const viewEl = document.getElementById('view');
const toastEl = document.getElementById('toast');
const dialogEl = document.getElementById('hub-dialog');

// `changed`: um plugin avisa que o que ele mostra fora da aba (cartões do
// Início) mudou.
const ctx = {
  hid,
  toast,
  changed: () => {
    renderTabs();
    if (active === 'overview') renderOverview(overviewEl);
  },
};
const mounted = new Map(); // plugin.id -> { container, handle }
let active = 'overview';

function toast(message, kind = 'info') {
  const item = h('div', { class: `toast-item ${kind}` }, message);
  toastEl.append(item);
  setTimeout(() => item.remove(), 5000);
}

function devicesFor(plugin) {
  return hid.devices.filter((d) => plugin.matches(d));
}

/**
 * Nomes dos aparelhos do plugin. Com `summary`, o plugin já devolve um por
 * aparelho (dois controles iguais contam como dois); sem ele, tira repetidos
 * (várias interfaces HID do mesmo aparelho).
 */
function deviceNames(plugin) {
  const matched = devicesFor(plugin);
  return plugin.summary ? plugin.summary(matched) : [...new Set(matched.map((d) => describe(d).name))];
}

function installedPlugins() {
  return plugins.filter((p) => extensions.has(p.id));
}

function canInstall(plugin) {
  return plugin.status !== 'planned';
}

/** Ícone do Início: 4 quadradinhos, como os cartões dos aparelhos. */
function overviewIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 18 18');
  svg.setAttribute('class', 'grid-icon');
  for (const [x, y] of [[1, 1], [10, 1], [1, 10], [10, 10]]) {
    const r = document.createElementNS(NS, 'rect');
    for (const [k, v] of Object.entries({ x, y, width: 7, height: 7, rx: 1.8 })) r.setAttribute(k, v);
    svg.append(r);
  }
  return svg;
}

function renderTabs() {
  // Abas só com o nome: os aparelhos conectados aparecem no Início.
  // Com o menu na barra lateral, cada aba tem um ícone: o desenho do plugin
  // (`icon()`) ou, sem ele, a primeira letra do nome.
  const tab = (id, label, icon = null) =>
    h('button', {
      class: 'tab',
      dataset: { plugin: id },
      role: 'tab',
      'aria-selected': String(active === id),
      onclick: () => show(id),
    },
    h('span', { class: 'tab-icon' + (icon ? ' drawn' : ''), 'aria-hidden': 'true' }, icon ? icon() : label.charAt(0).toUpperCase()),
    h('span', { class: 'tab-label' }, label));

  clear(tabsEl,
    tab('overview', 'Início', overviewIcon),
    installedPlugins().map((p) => tab(p.id, p.name, p.icon)));
  fitMenuWidth();
}

// Barra lateral aberta: só a largura do que ela mostra, a linha de botões de baixo
// (3 de 38 px e 2 espaços, mais as margens) ou a aba de nome mais longo.
const MENU_BUTTONS_WIDTH = 150;
const MENU_SIDE_PADDING = 8;
const measureCanvas = document.createElement('canvas').getContext('2d');

// A fonte do app carrega depois do primeiro desenho: mede de novo com ela.
document.fonts.ready.then(() => fitMenuWidth());

function fitMenuWidth() {
  const sample = tabsEl.querySelector('.tab');
  if (!document.body.classList.contains('menu-left') || !sample) return;
  const style = getComputedStyle(sample);
  const icon = sample.querySelector('.tab-icon').offsetWidth;
  // Sem medir a tela: com a barra recolhida, os nomes das abas estão escondidos.
  measureCanvas.font = style.font;
  const longest = Math.max(...[...tabsEl.querySelectorAll('.tab-label')].map((l) => measureCanvas.measureText(l.textContent).width));
  const tabWidth = parseFloat(style.paddingLeft) + icon + parseFloat(style.columnGap) + longest + parseFloat(style.paddingRight);
  const width = Math.ceil(Math.max(MENU_BUTTONS_WIDTH, tabWidth + 2 * MENU_SIDE_PADDING));
  document.body.style.setProperty('--menu-open-w', `${width}px`);
}

function scanButton() {
  return h('button', {
    class: 'link-btn',
    onclick: () => {
      const filters = plugins.flatMap((p) => p.filters || []);
      hid.request(filters).catch((err) => toast(err.message, 'error'));
    },
  }, 'Procurar dispositivos');
}

function renderOverview(container) {
  const installed = installedPlugins().filter((p) => p.status !== 'tool');
  // Marcas detectadas que ainda não têm suporte adicionado.
  const suggestions = plugins.filter((p) => !extensions.has(p.id) && p.status !== 'tool' && deviceNames(p).length);
  const firstRun = installed.length === 0;
  const nothingFound = suggestions.length === 0 && installed.every((p) => deviceNames(p).length === 0);

  const suggestionCards = suggestions.length ? h('section', { class: 'suggestions' },
    h('h3', {}, firstRun ? 'Encontramos estes aparelhos' : 'Detectados'),
    h('div', { class: 'grid' }, suggestions.map((p) => h('div', { class: 'card suggestion', dataset: { plugin: p.id } },
      h('h3', {}, p.name),
      h('ul', {}, deviceNames(p).map((n) => h('li', {}, n))),
      canInstall(p)
        ? button(`Ativar aba ${p.name}`, () => extensions.install(p.id))
        : h('p', { class: 'muted small' }, 'Aba em breve.'))))) : null;

  // Algum aparelho não apareceu sozinho? Só então o botão de procurar ganha destaque.
  const scanHint = h('p', { class: 'muted small scan-hint' },
    nothingFound ? 'Nenhum aparelho encontrado. Conecte um periférico ou ' : 'Algum aparelho não apareceu? ',
    scanButton(), '.');

  if (firstRun) {
    clear(container,
      h('section', { class: 'welcome' },
        h('h2', {}, 'Bem-vindo ao UniHub'),
        h('p', { class: 'muted' }, 'Um app só para configurar periféricos de várias marcas. Ative as abas dos aparelhos que você usa e cada uma aparece no menu.')),
      !hid.available ? h('div', { class: 'error' }, 'WebHID indisponível neste ambiente.') : null,
      suggestionCards,
      h('div', { class: 'welcome-actions' },
        button(suggestions.length ? 'Ver todas as abas' : 'Adicionar aba', openDialog, { kind: suggestions.length ? 'secondary' : 'primary' })),
      scanHint,
    );
    return;
  }

  const cards = installed.flatMap(deviceCards);
  clear(container,
    h('div', { class: 'overview-head' }, h('h2', {}, 'Seus periféricos')),
    !hid.available ? h('div', { class: 'error' }, 'WebHID indisponível neste ambiente.') : null,
    cards.length
      ? h('div', { class: 'home-grid' }, cards)
      : h('div', { class: 'empty' }, 'Nenhum aparelho conectado. Ligue um controle, fone ou teclado e ele aparece aqui.'),
    suggestionCards,
    scanHint,
  );
}

function extensionItem(p) {
  const names = deviceNames(p);
  const installed = extensions.has(p.id);
  return h('div', { class: 'ext-item' + (installed ? ' installed' : ''), dataset: { plugin: p.id } },
    h('div', { class: 'ext-info' },
      h('strong', {}, p.name, ' ', h('span', { class: `pill ${p.status}` }, STATUS_LABEL[p.status])),
      h('span', { class: 'muted small' }, p.tagline),
      p.status !== 'tool' && names.length
        ? h('span', { class: 'small detected' }, `Conectado agora: ${names.join(', ')}`) : null),
    !canInstall(p)
      ? button('Em breve', null, { disabled: true })
      : installed
        ? button('Remover', () => extensions.uninstall(p.id))
        : button('Adicionar', () => extensions.install(p.id)));
}

function renderDialog() {
  // Abas com aparelho conectado primeiro; ferramentas de desenvolvedor no fim, em "Avançado".
  const brands = plugins.filter((p) => p.status !== 'tool')
    .sort((a, b) => Number(deviceNames(b).length > 0) - Number(deviceNames(a).length > 0));
  const tools = plugins.filter((p) => p.status === 'tool');
  clear(dialogEl,
    h('div', { class: 'dialog-head' },
      h('h2', {}, 'Abas'),
      button('Fechar', () => dialogEl.close())),
    h('p', { class: 'muted' }, 'Cada aba funciona para os aparelhos daquele tipo, de qualquer marca, e aparece no menu. Adicione só as que você usa.'),
    h('div', { class: 'ext-list' }, brands.map(extensionItem)),
    tools.length ? h('details', { class: 'advanced' },
      h('summary', {}, 'Avançado (para desenvolvedores)'),
      h('div', { class: 'ext-list' }, tools.map(extensionItem))) : null,
  );
}

function openDialog() {
  renderDialog();
  dialogEl.showModal();
}

function unmount(id) {
  const entry = mounted.get(id);
  if (!entry) return;
  entry.handle.unmount();
  entry.container.remove();
  mounted.delete(id);
}

/**
 * Padrão para todos os plugins: no cabo, integrado (teclado do notebook) ou sem
 * conexão conhecida (ex.: teclado comum) e sem bateria lida, o cartão não fala
 * de bateria. Bateria lida aparece sempre, com a barra.
 */
const wiredOrUnknown = (connection) => !connection || /cabo|usb|integrado/i.test(connection);

/**
 * Cartões do Início: um por aparelho conectado, de todos os plugins. O plugin
 * informa os aparelhos em `cards()` (cada um pode ter um `icon` próprio) e abre
 * um deles em `focus(id)`; sem isso, vale o nome de cada aparelho e o clique abre
 * a aba do plugin.
 */
function deviceCards(plugin) {
  const handle = ensureMounted(plugin).handle;
  const list = handle.cards ? handle.cards() : deviceNames(plugin).map((name) => ({ id: null, name }));
  // Três faixas: plugin e conexão em cima; desenho e nome no meio; bateria
  // (com barra) embaixo.
  return list.map((c) => {
    const known = c.battery && Number.isFinite(c.battery.percent);
    // Só a porcentagem e a barra: o ícone de pilha fica nas abas dos plugins.
    const percent = known ? h('span', { class: 'home-card-pct' }, `${c.battery.percent}%`) : null;
    const bar = known ? h('span', {
      class: 'home-card-bar ' + (c.battery.charging ? 'charging' : batteryLevel(c.battery.percent)),
      style: `--level:${Math.max(0, Math.min(100, c.battery.percent))}%`,
    }) : null;
    return h('button', {
      class: 'card home-card',
      dataset: { plugin: plugin.id },
      onclick: () => {
        show(plugin.id);
        if (c.id !== null) handle.focus?.(c.id);
      },
    },
    h('span', { class: 'home-card-top' },
      h('span', { class: 'home-card-plugin' }, plugin.name),
      c.connection ? h('span', { class: 'pill' }, c.connection) : null),
    h('span', { class: 'home-card-main' },
      h('span', { class: 'home-card-art', 'aria-hidden': 'true' }, c.icon ? c.icon() : plugin.icon ? plugin.icon() : plugin.name.charAt(0)),
      h('strong', { class: 'home-card-name' }, c.name)),
    h('span', { class: 'home-card-bottom' },
      percent,
      bar,
      c.status ? h('span', { class: 'pill' }, c.status) : null,
      !known && !c.status && !wiredOrUnknown(c.connection) ? h('span', { class: 'muted small' }, 'Bateria não informada') : null));
  });
}

/**
 * Os plugins ativados carregam ao abrir o app, escondidos: o Início mostra
 * todos os aparelhos e os avisos de bateria valem sem abrir cada aba.
 */
function ensureMounted(plugin) {
  let entry = mounted.get(plugin.id);
  if (!entry) {
    const container = h('div', { class: 'plugin-view', dataset: { plugin: plugin.id }, hidden: true });
    viewEl.append(container);
    entry = { container, handle: plugin.mount(container, ctx) };
    mounted.set(plugin.id, entry);
    entry.handle.update(devicesFor(plugin));
  }
  return entry;
}

function show(id) {
  if (id !== 'overview' && !extensions.has(id)) id = 'overview';
  active = id;
  for (const { container } of mounted.values()) container.hidden = true;
  overviewEl.hidden = id !== 'overview';
  if (id === 'overview') {
    renderOverview(overviewEl);
  } else {
    const entry = ensureMounted(plugins.find((p) => p.id === id));
    entry.container.hidden = false;
  }
  renderTabs();
}

const overviewEl = h('div', { class: 'plugin-view home-view' });
viewEl.append(overviewEl);

// Início: em janela, cartões deitados; em tela cheia (a partir de 1501 px),
// quadrados. Ao trocar, cada parte do cartão desliza até o lugar novo.
const HOME_CARD_PARTS = ['.home-card-art', '.home-card-name', '.home-card-top', '.home-card-bottom'];
const wideScreen = window.matchMedia('(min-width: 1501px)');
const applyHomeWidth = () => document.body.classList.toggle('home-wide', wideScreen.matches);
applyHomeWidth();
wideScreen.addEventListener('change', () => {
  const cards = overviewEl.hidden ? [] : [...overviewEl.querySelectorAll('.home-card')];
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!cards.length || calm || !document.startViewTransition) return applyHomeWidth();
  const named = [];
  cards.forEach((card, i) => {
    for (const [part, el] of [['card', card], ...HOME_CARD_PARTS.map((sel) => [sel.slice(11), card.querySelector(sel)])]) {
      if (!el) continue;
      el.style.viewTransitionName = `home-${part}-${i}`;
      named.push(el);
    }
  });
  document.startViewTransition(applyHomeWidth).finished.finally(() => {
    for (const el of named) el.style.viewTransitionName = '';
  });
});

extensions.addEventListener('change', ({ detail }) => {
  if (!detail.installed) unmount(detail.id);
  if (dialogEl.open) renderDialog();
  if (detail.installed) toast(`Aba ${plugins.find((p) => p.id === detail.id).name} ativada.`);
  show(detail.installed && !dialogEl.open ? detail.id : active);
});

hid.addEventListener('change', () => {
  for (const [id, entry] of mounted) {
    const plugin = plugins.find((p) => p.id === id);
    entry.handle.update(devicesFor(plugin));
  }
  if (active === 'overview') renderOverview(overviewEl);
  if (dialogEl.open) renderDialog();
  renderTabs();
});

// --- Configurações do app (botão de engrenagem no cabeçalho) -----------------

const settingsDialog = document.getElementById('settings-dialog');

function settingToggle(key, settings, onSaved) {
  const api = window.unihub;
  return h('input', {
    type: 'checkbox', class: 'switch', checked: !!settings[key], disabled: !api?.setSetting,
    onchange: async (e) => {
      e.target.disabled = true;
      const saved = await api.setSetting(key, e.target.checked).catch(() => null);
      onSaved(saved || settings);
    },
  });
}

// Layout: cabeçalho, grupos em duas colunas e rodapé com o botão de fechar.
function settingsGroup(title, ...rows) {
  return h('section', { class: 'settings-group' }, h('small', { class: 'settings-group-title muted' }, title), ...rows);
}

function renderSettings(settings) {
  const redraw = (saved) => renderSettings(saved);
  clear(settingsDialog,
    h('div', { class: 'settings-head' },
      h('h2', {}, 'Configurações'),
      h('small', { class: 'muted' }, 'UniHub')),
    h('div', { class: 'settings-body' },
      h('div', { class: 'settings-col' },
        settingsGroup('Inicialização',
          h('label', { class: 'setting-row' },
            h('span', { class: 'setting-text' },
              h('span', {}, 'Iniciar com o Windows'),
              h('small', { class: 'muted' }, 'O UniHub abre sozinho quando você liga o computador.')),
            settingToggle('autoStart', settings, redraw)),
          // A bandeja é uma opção de quem inicia com o Windows.
          settings.autoStart ? h('label', { class: 'setting-row sub-setting' },
            h('span', { class: 'setting-text' },
              h('span', {}, 'Mostrar na bandeja do sistema'),
              h('small', { class: 'muted' }, 'Ao ligar o computador, o UniHub começa só com um ícone perto do relógio. Fechar a janela só a esconde: o app continua rodando e os avisos de bateria continuam chegando. Para sair, clique com o botão direito no ícone e escolha Sair.')),
            settingToggle('tray', settings, redraw)) : null),
        settingsGroup('Posição do menu',
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Posição do menu' },
            [['top', 'Cabeçalho'], ['left', 'Barra lateral']].map(([value, text]) => h('button', {
              class: 'btn' + (settings.menuPosition === value ? ' primary' : ' secondary'),
              'aria-pressed': String(settings.menuPosition === value),
              onclick: async () => redraw(applyMenuLayout(await saveSetting('menuPosition', value) || settings)),
            }, text))))),
      h('div', { class: 'settings-col' },
        // Abre a janela Abas.
        settingsGroup('Abas',
          h('div', { class: 'setting-row' },
            h('span', { class: 'setting-text' },
              h('span', {}, 'Abas do menu'),
              h('small', { class: 'muted' }, 'Escolha os tipos de aparelho que aparecem no menu, como Gamepads, Headsets e Teclados.')),
            button('Gerenciar abas', () => {
              settingsDialog.close();
              openDialog();
            }))),
        settingsGroup('Idiomas',
          h('div', { class: 'segmented', role: 'group', 'aria-label': 'Idiomas' },
            LANGUAGES.map(({ id, name }) => h('button', {
              class: 'btn' + (getLanguage() === id ? ' primary' : ' secondary'),
              'aria-pressed': String(getLanguage() === id),
              onclick: async () => {
                applyLanguage(await saveSetting('language', id) || { language: id });
                redraw(await window.unihub?.getSettings?.() || settings);
              },
            }, name)))))),
    h('div', { class: 'settings-foot' },
      button('Fechar', () => settingsDialog.close())));
}

// --- Posição do menu: em cima ou à esquerda (fixo ou recolhido) ---------------

const pinBtn = document.getElementById('pin-btn');
let layout = { menuPosition: 'top', menuPinned: true };

function applyLanguage(settings) {
  setLanguage(settings.language || DEFAULT_LANGUAGE);
  fitMenuWidth(); // os nomes das abas mudam de tamanho
  return settings;
}

async function saveSetting(key, value) {
  return window.unihub?.setSetting?.(key, value).catch(() => null);
}

function applyMenuLayout(settings) {
  layout = { menuPosition: settings.menuPosition || 'top', menuPinned: settings.menuPinned !== false };
  const left = layout.menuPosition === 'left';
  document.body.classList.toggle('menu-left', left);
  document.body.classList.toggle('menu-collapsed', left && !layout.menuPinned);
  pinBtn.hidden = !left;
  pinBtn.setAttribute('aria-pressed', String(layout.menuPinned));
  pinBtn.setAttribute('aria-label', layout.menuPinned ? 'Recolher o menu' : 'Fixar o menu aberto');
  fitMenuWidth();
  return settings;
}

// Menu recolhido: abre ao passar o mouse e só fecha um pouco depois de o mouse
// sair, para escorregões rápidos (ex.: a caminho do alfinete) não fecharem.
const MENU_CLOSE_DELAY_MS = 300;
const menuEl = document.querySelector('.topbar');
let menuCloseTimer = 0;
menuEl.addEventListener('mouseenter', () => {
  clearTimeout(menuCloseTimer);
  const { classList } = document.body;
  // Entrou direto em Temas: o botão espera o mouse sair dele para mudar de lugar.
  const first = !classList.contains('menu-peek') || classList.contains('theme-held');
  classList.toggle('theme-held', first && classList.contains('menu-collapsed') && themeBtn.matches(':hover'));
  classList.add('menu-peek');
});
menuEl.addEventListener('mouseleave', () => {
  clearTimeout(menuCloseTimer);
  menuCloseTimer = setTimeout(() => document.body.classList.remove('menu-peek'), MENU_CLOSE_DELAY_MS);
});

// Saiu de Temas e continuou na barra: agora o botão pode ir para o lugar dele.
document.getElementById('theme-btn').addEventListener('mouseleave', (e) => {
  if (menuEl.contains(e.relatedTarget)) document.body.classList.remove('theme-held');
});

// Marca o instante em que a barra abre ou fecha. As letras animam só nesse
// instante: as abas são recriadas quando um aparelho muda, e não podem piscar.
const MENU_MOTION_MS = 400;
let menuWasOpen = null;
let menuMotionTimer = 0;
new MutationObserver(() => {
  const { classList } = document.body;
  const open = classList.contains('menu-left') && (!classList.contains('menu-collapsed') || classList.contains('menu-peek'));
  if (open === menuWasOpen) return;
  const moved = menuWasOpen !== null && classList.contains('menu-ready');
  menuWasOpen = open;
  if (!moved) return;
  clearTimeout(menuMotionTimer);
  classList.remove('menu-opening', 'menu-closing');
  classList.add(open ? 'menu-opening' : 'menu-closing');
  menuMotionTimer = setTimeout(() => classList.remove('menu-opening', 'menu-closing'), MENU_MOTION_MS);
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

pinBtn.addEventListener('click', async () => {
  const saved = await saveSetting('menuPinned', !layout.menuPinned);
  applyMenuLayout(saved || { ...layout, menuPinned: !layout.menuPinned });
});

// --- Temas: botão ao lado das configurações, com um menu de opções ------------
// As cores ficam no styles.css (:root[data-theme]); o Grafite é o padrão.
// `swatch`: a parte mais clara e a mais escura do tema (--panel/--panel-2 e --well).
const THEMES = [
  { id: 'light', label: 'Claro', swatch: ['#e7e5e0', '#d0cdc6'] },
  { id: 'dark', label: 'Escuro', swatch: ['#141518', '#020203'] },
  { id: 'graphite', label: 'Grafite', swatch: ['#242830', '#0f1114'] },
];
const themeBtn = document.getElementById('theme-btn');
const themeMenu = document.getElementById('theme-menu');
let currentTheme = 'graphite';

function applyTheme(settings) {
  currentTheme = THEMES.some((t) => t.id === settings.theme) ? settings.theme : 'graphite';
  if (currentTheme === 'graphite') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = currentTheme;
  return settings;
}

function closeThemeMenu() {
  themeMenu.hidden = true;
  themeBtn.setAttribute('aria-expanded', 'false');
}

function openThemeMenu() {
  clear(themeMenu, THEMES.map((t) => h('button', {
    class: 'theme-option',
    role: 'menuitemradio',
    'aria-checked': String(t.id === currentTheme),
    style: `--sw-a:${t.swatch[0]};--sw-b:${t.swatch[1]}`,
    onclick: async () => {
      closeThemeMenu();
      applyTheme((await saveSetting('theme', t.id)) || { theme: t.id });
    },
  }, h('span', { class: 'theme-swatch', 'aria-hidden': 'true' }), t.label,
  h('span', { class: 'theme-check', 'aria-hidden': 'true' }, '✓'))));
  themeMenu.hidden = false;
  themeBtn.setAttribute('aria-expanded', 'true');
  // Abaixo do botão (menu em cima) ou à direita dele (menu à esquerda).
  const r = themeBtn.getBoundingClientRect();
  const w = themeMenu.offsetWidth;
  const left = document.body.classList.contains('menu-left');
  themeMenu.style.left = `${left ? r.right + 8 : Math.max(8, r.right - w)}px`;
  themeMenu.style.top = `${left ? Math.min(r.top, innerHeight - themeMenu.offsetHeight - 8) : r.bottom + 6}px`;
  themeMenu.querySelector('[aria-checked="true"]')?.focus();
}

themeBtn.addEventListener('click', () => (themeMenu.hidden ? openThemeMenu() : closeThemeMenu()));
document.addEventListener('pointerdown', (e) => {
  if (!themeMenu.hidden && !themeMenu.contains(e.target) && !themeBtn.contains(e.target)) closeThemeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !themeMenu.hidden) { closeThemeMenu(); themeBtn.focus(); }
});
window.addEventListener('resize', closeThemeMenu);

startTranslating();
window.unihub?.getSettings?.().then(applyLanguage).then(applyTheme).then(applyMenuLayout).catch(() => {})
  // A queda do botão Temas só anima depois de abrir o app, não ao carregar.
  .finally(() => setTimeout(() => document.body.classList.add('menu-ready'), 200));

async function openSettings() {
  renderSettings((await window.unihub?.getSettings?.()) || {});
  settingsDialog.showModal();
}

document.getElementById('settings-btn').addEventListener('click', openSettings);

show('overview');
hid.start().catch((err) => toast(`Erro ao listar dispositivos: ${err.message}`, 'error'));
