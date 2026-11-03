// Bateria no cabeçalho de um aparelho (ícone de pilha + %) e aviso de
// bateria baixa. Usado pelas abas de qualquer marca.

import { h } from '../core/dom.js';
import { translate } from '../core/i18n.js';
import { formatAge, batteryLevel } from './battery.js';

const STALE_AFTER_MS = 60_000; // depois disso, mostra "há X min" ao lado da bateria

/** Ícone de pilha: nível preenchido e, carregando, um raio dentro. */
function batteryIcon(percent, charging) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 28 14');
  svg.setAttribute('class', 'battery-icon ' + (charging ? 'charging' : batteryLevel(percent)));
  const add = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  add('rect', { x: 0.75, y: 0.75, width: 23.5, height: 12.5, rx: 2.5, class: 'battery-outline' });
  add('rect', { x: 25, y: 4.5, width: 2.25, height: 5, rx: 1, class: 'battery-nub' });
  add('rect', { x: 2.5, y: 2.5, width: Math.max(1, 20 * (percent / 100)), height: 9, rx: 1.2, class: 'battery-level' });
  // Raio pequeno, centralizado dentro da pilha, na cor do contorno (como no iPhone).
  if (charging) add('path', { d: 'M13.7 2.4 L9.4 7.7 H12.2 L11.1 11.6 L15.6 6.3 H12.8 Z', class: 'battery-bolt' });
  return svg;
}

/**
 * Pinta a bateria: ícone + porcentagem e, se a leitura for antiga, há quanto
 * tempo foi feita. Sem leitura, fica escondida.
 * @param {HTMLElement} el
 * @param {{percent: number}|null} battery
 * @param {boolean} charging  quem chama decide (cada marca avisa de um jeito)
 * @param {number} [readAt]
 */
export function paintBattery(el, battery, charging, readAt = Date.now()) {
  if (!el) return;
  if (!battery) {
    el.replaceChildren();
    el.hidden = true;
    return;
  }
  const age = Date.now() - readAt;
  el.hidden = false;
  el.replaceChildren(batteryIcon(battery.percent, charging), `${battery.percent}%`,
    ...(age >= STALE_AFTER_MS ? [h('span', { class: 'battery-age' }, formatAge(age))] : []));
}

/** Aviso no app e, se a janela não estiver em foco, notificação do Windows. */
export function warnLowBattery(ctx, text) {
  ctx.toast(text, 'error');
  if (!document.hasFocus() && 'Notification' in window && Notification.permission !== 'denied') {
    // Fica na tela até ser fechada: durante um jogo, um aviso rápido passaria despercebido.
    try { new Notification(translate('Bateria baixa'), { body: translate(text), silent: false, requireInteraction: true }); } catch { /* sem notificação */ }
  }
}
