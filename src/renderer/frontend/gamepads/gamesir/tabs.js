// Sub-abas específicas dos controles GameSir (além de Luzes e Vibração).

import { h, card, button } from '../../../core/dom.js';
import { toHex } from '../../../core/bytes.js';
import { PROFILE_SLOTS, REPORT_RATES } from '../../../plugins/gamepads/gamesir/protocol.js';
import { BUTTONS, PADDLES, TARGETS, parseMapping, parsePaddle, buildMapping, buildPaddle, countRemapped, targetName } from '../../../plugins/gamepads/gamesir/mapping.js';
import { infoCard, vidPidRow } from '../../../shared/info-card.js';

export function deviceTab(session, label, vidPid, model, ctx) {
  const firmware = h('strong', {}, '…');
  const dongle = h('strong', {}, '…');

  // Sem aviso de erro: se o controle desligar, a lista já some sozinha.
  // Sem fio, a resposta traz a versão do controle e a do dongle; com cabo, só a do controle.
  async function refreshInfo() {
    try {
      const fw = (await session.readFirmwareVersion()).value;
      firmware.textContent = fw?.controller || '—';
      dongle.textContent = fw?.dongle || 'Não usado';
      dongle.classList.toggle('muted', !fw?.dongle);
    } catch {
      firmware.textContent = dongle.textContent = '—';
    }
  }
  refreshInfo();

  return h('div', { class: 'device-cards' },
    infoCard({
      rows: [
        ['Firmware', firmware],
        ['Dongle', dongle],
        ['VID:PID', vidPidRow(vidPid)],
      ],
      note: 'Para atualizar consulte as normas do fabricante.',
      label,
    }),
    REPORT_RATES[model] ? reportRateCard(session, REPORT_RATES[model], ctx) : null);
}

/** Taxa de relatório: quantas vezes por segundo o controle manda o estado ao PC. */
function reportRateCard(session, rates, ctx) {
  let current = null; // marcha atual, ou 'mixed' se os perfis divergirem
  let busy = false;
  const buttons = h('div', { class: 'rate-options' });
  const status = h('p', { class: 'muted small' });

  function render() {
    buttons.replaceChildren(...rates.map((r) => h('button', {
      class: 'rate-btn' + (current === r.gear ? ' selected' : ''),
      disabled: busy || current === null,
      onclick: () => choose(r.gear),
    }, h('strong', {}, String(r.hz)), h('small', {}, 'Hz'))));
  }

  async function load() {
    try {
      const gears = Object.values(await session.readReportRates());
      current = gears.every((g) => g === gears[0]) ? gears[0] : 'mixed';
      status.textContent = current === 'mixed' ? 'Os perfis estão com taxas diferentes. Escolha uma para todos.' : '';
    } catch {
      status.textContent = 'Não foi possível ler a taxa de relatório.';
    }
    render();
  }

  async function choose(gear) {
    if (gear === current) return;
    busy = true;
    status.textContent = 'Gravando…';
    render();
    try {
      await session.writeReportRate(gear);
      await load();
      status.textContent = 'Salvo em todos os perfis.';
    } catch (err) {
      status.textContent = '';
      ctx?.toast(`Taxa de relatório: ${err.message}`, 'error');
    }
    busy = false;
    render();
  }

  render();
  load();
  return card('Taxa de relatório',
    h('p', { class: 'muted small' }, 'Quantas vezes por segundo o controle envia o estado dos botões ao PC. Valores maiores respondem mais rápido; se um jogo travar ou falhar, tente um valor menor.'),
    buttons,
    status);
}

export function profilesTab(session, ctx, model) {
  const status = h('p', { class: 'muted' });
  async function backup(slot) {
    status.textContent = `Lendo perfil ${slot}…`;
    try {
      const data = await session.backupProfile(slot);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `gamesir-perfil-${slot}.json` });
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = `Perfil ${slot} exportado.`;
    } catch (err) {
      status.textContent = '';
      ctx.toast(`Exportar perfil ${slot}: ${err.message}`, 'error');
    }
  }
  const exportCard = card('Exportar perfis',
    h('p', { class: 'muted small' }, 'Guarda uma cópia de um perfil do controle num arquivo no computador. Isto não muda nada no controle: o mapeamento já é salvo sozinho.'),
    h('div', { class: 'row' }, PROFILE_SLOTS.map((n) => button(`Exportar perfil ${n}`, () => backup(n)))),
    status);
  exportCard.classList.add('export-card');
  return h('div', { class: 'device-cards mapping-page' },
    MAPPING_MODELS.includes(model)
      ? mappingEditor(session, ctx)
      : card('Mapeamento de botões', h('p', { class: 'muted' }, 'Ainda não disponível para este modelo.')),
    exportCard,
  );
}

/** Modelos com o mapeamento confirmado com hardware. */
const MAPPING_MODELS = ['cyclone2'];

// Grupos da tela de mapeamento, por onde o botão fica no controle.
const MAPPING_GROUPS = [
  { title: 'Botões de ação', ids: ['a', 'b', 'x', 'y'] },
  { title: 'Direcional', ids: ['up', 'down', 'left', 'right'] },
  { title: 'Ombros e sticks', ids: ['lb', 'rb', 'l3', 'r3'] },
  { title: 'Botões centrais', ids: ['home', 'view', 'menu', 'capture'] },
  { title: 'Paddles traseiros', ids: ['l4', 'r4'] },
];

/** Editor: escolhe o perfil e, para cada botão, o que ele faz. Grava na hora. */
function mappingEditor(session, ctx) {
  let slot = null; // perfil em edição
  let active = null; // perfil que o controle está usando
  let bytes = null; // trecho atual no controle
  let paddleBytes = null; // 7 bytes de cada paddle no controle
  let entries = null; // os 16 botões e, depois deles, os paddles
  let busy = false;
  const body = h('div', { class: 'mapping' }, h('p', { class: 'muted' }, 'Lendo o perfil…'));
  const status = h('span', { class: 'muted small' });
  const profileRow = h('div', { class: 'row profile-pick' });
  const activeNote = h('div', { class: 'active-note' });

  function renderProfiles() {
    profileRow.replaceChildren(
      h('span', { class: 'muted small' }, 'Editando o perfil:'),
      ...PROFILE_SLOTS.map((n) => h('button', {
        class: 'round-btn' + (slot === n ? ' selected' : '') + (active === n ? ' in-use' : ''),
        disabled: busy,
        onclick: () => load(n),
      }, String(n))),
      h('span', { class: 'in-use-legend muted small' }, h('i'), 'em uso no controle'),
      h('span', { class: 'spacer' }),
      button('Restaurar padrão', () => save(entries.map((e) => ({ ...e, target: null })), 'Perfil restaurado.'),
        { disabled: busy || !entries || countRemapped(entries) === 0 }));

    // Deixa claro se o perfil editado é o que vale no controle.
    if (slot === null || active === null) {
      activeNote.replaceChildren();
    } else if (slot === active) {
      activeNote.className = 'active-note ok';
      activeNote.replaceChildren(`✓ O controle está usando este perfil (${slot}). As mudanças valem na hora.`);
    } else {
      activeNote.className = 'active-note warn';
      activeNote.replaceChildren(
        h('span', {}, `Você está editando o perfil ${slot}, mas o controle está usando o perfil ${active}.`),
        button('Usar este perfil', useThisProfile, { kind: 'primary', disabled: busy }));
    }
  }

  async function refreshActive() {
    try {
      const value = (await session.readCurrentProfile()).value;
      if (PROFILE_SLOTS.includes(value) && value !== active) {
        active = value;
        renderProfiles();
      }
    } catch { /* controle ocupado ou desligado: tenta de novo depois */ }
  }

  async function useThisProfile() {
    busy = true;
    renderProfiles();
    try {
      await session.switchProfile(slot);
      await refreshActive();
      status.textContent = `Perfil ${slot} em uso no controle.`;
    } catch (err) {
      ctx.toast(`Trocar perfil: ${err.message}`, 'error');
    }
    busy = false;
    render();
  }

  function render() {
    renderProfiles();
    if (!entries) return;
    const keys = [...BUTTONS, ...PADDLES];
    const row = (id) => {
      const i = keys.findIndex((k) => k.id === id);
      const b = keys[i];
      const entry = entries[i];
      const select = h('select', {
        class: 'map-select' + (entry.target !== null ? ' changed' : ''),
        disabled: busy,
        onchange: (e) => {
          const value = e.target.value === 'self' ? null : Number(e.target.value);
          const next = entries.map((x, j) => (j === i ? { ...x, target: value } : x));
          save(next, `${b.name} → ${value === null ? b.name : targetName(value)}`);
        },
      },
      h('option', { value: 'self' }, `${b.name} (padrão)`),
      ...TARGETS.filter((t) => t.code !== b.code).map((t) => h('option', { value: String(t.code) }, t.name)));
      select.value = entry.target === null ? 'self' : String(entry.target);
      return h('label', { class: 'map-row' },
        h('span', { class: 'map-key' }, b.label),
        h('span', { class: 'map-arrow' }, '→'),
        select);
    };
    body.replaceChildren(...MAPPING_GROUPS.map((g) => h('section', { class: 'map-group' },
      h('h4', {}, g.title),
      g.ids.map(row))));
  }

  async function readEntries(n) {
    bytes = await session.readMapping(n);
    paddleBytes = await session.readPaddles(n);
    entries = [...parseMapping(bytes), ...PADDLES.map((p, i) => parsePaddle(p, paddleBytes[i]))];
  }

  async function load(n) {
    busy = true;
    slot = n;
    status.textContent = '';
    render();
    try {
      await readEntries(n);
    } catch (err) {
      entries = null;
      body.replaceChildren(h('p', { class: 'error' }, `Não foi possível ler o perfil ${n}: ${err.message}`));
    }
    busy = false;
    render();
  }

  async function save(next, message) {
    busy = true;
    status.textContent = 'Gravando…';
    render();
    try {
      await session.writeMapping(slot, bytes, buildMapping(next.slice(0, BUTTONS.length)));
      for (const [i, paddle] of PADDLES.entries()) {
        await session.writePaddle(slot, paddle, paddleBytes[i], buildPaddle(paddle, next[BUTTONS.length + i]));
      }
      await readEntries(slot); // confirma lendo de volta
      status.textContent = `${message} · salvo no perfil ${slot}`;
    } catch (err) {
      status.textContent = '';
      ctx.toast(`Mapeamento: ${err.message}`, 'error');
    }
    busy = false;
    render();
  }

  // Começa no perfil em uso no controle.
  session.readCurrentProfile()
    .then((r) => {
      active = PROFILE_SLOTS.includes(r.value) ? r.value : null;
      return load(active || 1);
    })
    .catch(() => load(1));
  renderProfiles();

  // O perfil também pode ser trocado pelo próprio controle: confere de tempos em tempos.
  const root = card('Mapeamento de botões',
    h('p', { class: 'muted small' }, 'Escolha o que cada botão faz. A mudança é gravada no controle na hora, no perfil que você está editando.'),
    profileRow, activeNote, body, h('div', { class: 'row' }, status));
  const timer = setInterval(() => {
    if (!root.isConnected) {
      if (root.dataset.mounted) clearInterval(timer);
      return;
    }
    root.dataset.mounted = '1';
    if (!busy) refreshActive();
  }, ACTIVE_POLL_MS);
  return root;
}

const ACTIVE_POLL_MS = 3000;

export function firmwareTab() {
  return card('Atualização de firmware',
    h('p', {}, 'Ainda não disponível no UniHub.'),
    h('ul', {},
      h('li', {}, 'Os arquivos de firmware são da GameSir e não podem ser redistribuídos por um projeto open source.'),
      h('li', {}, 'O processo de gravação precisa ser documentado e implementado com validação de modelo e CRC antes de ir para usuários.')),
    h('p', { class: 'muted' }, 'Por enquanto, consulte as normas do fabricante para atualizar.'));
}

export function logTab(session) {
  const pre = h('pre', { class: 'output log' });
  const stats = h('p', { class: 'muted small' });
  function render() {
    if (!pre.isConnected && pre.dataset.mounted) {
      session.removeEventListener('log', render);
      return;
    }
    pre.dataset.mounted = '1';
    pre.textContent = session.log.slice(-120).map((e) =>
      `${new Date(e.time).toLocaleTimeString()} ${e.direction === 'out' ? '→' : '←'} ${toHex(e.bytes)}`).join('\n') || '(vazio)';
    stats.textContent = `Relatórios de estado recebidos: ${session.stateReports} (ocultos no log)`;
  }
  session.addEventListener('log', render);
  queueMicrotask(render);
  return h('div', {}, stats, pre);
}
