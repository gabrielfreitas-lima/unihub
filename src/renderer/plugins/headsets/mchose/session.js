// Uma sessão por headset MCHOSE: abre o HID, pede a bateria e escuta os
// avisos que o fone manda sozinho (carregou, desligou…).

import { CommandQueue } from '../../../core/command-queue.js';
import {
  commands, isBatteryReport, isLinkUpReport, parseBattery, parseVersion, hasPage,
  STATUS_REPORT, STATUS_USAGE_PAGE, VERSION_REPORT, VERSION_USAGE_PAGE,
} from './protocol.js';

const REPLY_TIMEOUT_MS = 1000;
const BATTERY_ATTEMPTS = 3;
const VERSION_WAITS_MS = [300, 200, 400]; // a resposta da versão demora a ficar pronta

export class MchoseSession extends EventTarget {
  /** @param {HIDDevice[]} devices  interfaces do mesmo headset */
  constructor(devices) {
    super();
    this.statusDevice = devices.find((d) => hasPage(d, STATUS_USAGE_PAGE)) || null;
    this.versionDevice = devices.find((d) => hasPage(d, VERSION_USAGE_PAGE)) || null;
    this.battery = null; // última leitura: { percent, state, charging, asleep }
    this.batteryAt = 0;
    this.queue = new CommandQueue({
      send: (bytes) => this.statusDevice.sendReport(STATUS_REPORT, bytes),
      timeoutMs: REPLY_TIMEOUT_MS,
      maxAttempts: BATTERY_ATTEMPTS,
    });
    this.onInput = (event) => this.#onInput(event);
  }

  get devices() {
    return [...new Set([this.statusDevice, this.versionDevice].filter(Boolean))];
  }

  async open() {
    for (const d of this.devices) if (!d.opened) await d.open();
    this.statusDevice?.addEventListener('inputreport', this.onInput);
  }

  async close() {
    this.queue.close();
    this.statusDevice?.removeEventListener('inputreport', this.onInput);
    for (const d of this.devices) if (d.opened) await d.close().catch(() => {});
  }

  /** Pede a bateria. Sem resposta, o fone está desligado (só o dongle responde ao USB). */
  async readBattery() {
    if (!this.statusDevice) return null;
    try {
      const data = await this.queue.enqueue(commands.battery(), {
        expect: (report) => isBatteryReport(report.reportId, report.data),
      });
      this.#setBattery(parseBattery(data.data));
    } catch (err) {
      if (this.queue.closed) throw err;
      this.#setBattery({ percent: null, state: 'asleep', charging: false, asleep: true });
    }
    return this.battery;
  }

  /** Versão do firmware do fone (ex.: "0036"), ou null. */
  async readVersion() {
    const d = this.versionDevice;
    if (!d) return null;
    await d.sendFeatureReport(VERSION_REPORT, commands.version());
    for (const ms of VERSION_WAITS_MS) {
      await new Promise((r) => setTimeout(r, ms));
      try {
        const version = parseVersion(new Uint8Array((await d.receiveFeatureReport(VERSION_REPORT)).buffer));
        if (version) return version;
      } catch { /* ainda não está pronta: tenta de novo */ }
    }
    return null;
  }

  #onInput(event) {
    const data = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
    const report = { reportId: event.reportId, data };
    if (this.queue.onReport(report)) return;
    // Aviso espontâneo: o fone mudou de estado (começou a carregar, desligou…).
    if (isBatteryReport(event.reportId, data)) this.#setBattery(parseBattery(data));
    // O fone ligou: pede a bateria na hora, sem esperar a próxima leitura.
    else if (isLinkUpReport(event.reportId, data)) this.readBattery().catch(() => {});
  }

  #setBattery(battery) {
    if (!battery) return;
    this.batteryAt = Date.now();
    const old = this.battery;
    this.battery = battery;
    if (old?.percent !== battery.percent || old?.state !== battery.state) {
      this.dispatchEvent(new CustomEvent('battery', { detail: battery }));
    }
  }
}
