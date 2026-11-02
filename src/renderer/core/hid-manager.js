// Registro central de dispositivos HID.
//
// Usa a WebHID do Chromium (embutida no Electron). Cada objeto HIDDevice
// recebe um id estável enquanto estiver conectado; assim dois controles do
// mesmo modelo continuam separados, mesmo com VID/PID iguais.

import { vidPid } from './bytes.js';

const RECHECK_MS = 2000;

let nextId = 1;
const ids = new WeakMap();

export function deviceId(device) {
  if (!ids.has(device)) ids.set(device, `hid-${nextId++}`);
  return ids.get(device);
}

export function usagePages(device) {
  return [...new Set(device.collections.map((c) => c.usagePage))];
}

export function describe(device) {
  return {
    id: deviceId(device),
    name: device.productName || '(sem nome)',
    vidPid: vidPid(device.vendorId, device.productId),
    vendorId: device.vendorId,
    productId: device.productId,
    usagePages: usagePages(device),
    opened: device.opened,
  };
}

export class HidManager extends EventTarget {
  constructor() {
    super();
    this.devices = [];
    this.available = typeof navigator !== 'undefined' && !!navigator.hid;
  }

  async start() {
    if (!this.available) return;
    navigator.hid.addEventListener('connect', () => this.refresh());
    navigator.hid.addEventListener('disconnect', (event) => {
      this.dispatchEvent(new CustomEvent('disconnect', { detail: event.device }));
      this.refresh();
    });
    // O aviso de "conectado" nem sempre chega (ex.: headset MCHOSE trocando do
    // dongle para o cabo vira outro aparelho USB). Conferir a lista de tempos
    // em tempos garante que nenhuma troca passe despercebida.
    setInterval(() => this.refresh({ onlyIfChanged: true }), RECHECK_MS);
    await this.refresh();
  }

  async refresh({ onlyIfChanged = false } = {}) {
    if (!this.available) return;
    // Interfaces com VID/PID/nome iguais podem ser aparelhos diferentes
    // (dois controles do mesmo modelo), então nada é deduplicado aqui.
    const next = await navigator.hid.getDevices();
    // Logo ao conectar, um aparelho pode vir sem nome ou com parte das
    // interfaces, e se completar depois no mesmo objeto: compara o conteúdo também.
    const signature = next.map((d) => `${deviceId(d)}|${d.productName}|${d.collections.length}`).join(';');
    if (onlyIfChanged && signature === this.signature) return;
    this.signature = signature;
    this.devices = next;
    this.dispatchEvent(new CustomEvent('change', { detail: this.devices }));
  }

  /** Abre o seletor do sistema. Útil se algum dispositivo não aparecer sozinho. */
  async request(filters = []) {
    if (!this.available) return;
    await navigator.hid.requestDevice({ filters });
    await this.refresh();
  }
}
