// Sessão HID++ sobre uma interface Logitech (receptor ou dispositivo USB).

import { CommandQueue } from '../../../core/command-queue.js';
import { withReportId } from '../../../core/bytes.js';
import {
  SHORT, LONG, DIRECT_DEVICE, RECEIVER_SLOTS, Feature, DEVICE_TYPES, HidppError,
  request, isReplyTo, payload, root, parsePing, parseFeatureIndex, decodeName,
  parseBatteryStatus, parseUnifiedBattery,
} from './hidpp.js';

function outputIds(device) {
  return new Set(device.collections.flatMap((c) => (c.outputReports || []).map((r) => r.reportId)));
}

/** Interfaces HID++ têm relatório de saída 0x10 e/ou 0x11 numa página do fabricante. */
export function isHidppEndpoint(device) {
  const ids = outputIds(device);
  return ids.has(SHORT.id) || ids.has(LONG.id);
}

export class LogitechSession {
  constructor(device) {
    this.device = device;
    const ids = outputIds(device);
    this.kind = ids.has(LONG.id) ? LONG : SHORT;
    this.features = new Map(); // `${dev}:${featureId}` -> índice
    this.queue = new CommandQueue({
      send: (bytes) => device.sendReport(bytes[0], bytes.subarray(1)),
      timeoutMs: 400,
      maxAttempts: 2,
    });
    this.onInput = (event) => this.queue.onReport(withReportId(event.reportId, event.data));
  }

  async open() {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener('inputreport', this.onInput);
  }

  async close() {
    this.queue.close();
    this.device.removeEventListener('inputreport', this.onInput);
    if (this.device.opened) await this.device.close().catch(() => {});
  }

  async call(req) {
    const report = await this.queue.enqueue(req, { expect: (r) => isReplyTo(req, r) });
    return payload(report);
  }

  async featureIndex(dev, featureId) {
    const key = `${dev}:${featureId}`;
    if (!this.features.has(key)) {
      const index = parseFeatureIndex(await this.call(root.getFeature(this.kind, dev, featureId)));
      this.features.set(key, index);
    }
    return this.features.get(key);
  }

  /** Responde com a versão do protocolo, ou null se não houver dispositivo nesse índice. */
  async ping(dev) {
    try {
      return parsePing(await this.call(root.ping(this.kind, dev)));
    } catch (err) {
      if (err instanceof HidppError || /Sem resposta/.test(err.message)) return null;
      throw err;
    }
  }

  /** Procura o dispositivo direto (0xFF) e os pareados em um receptor (1–6). */
  async discover() {
    const found = [];
    const direct = await this.ping(DIRECT_DEVICE);
    if (direct && direct.major >= 2) {
      found.push(await this.describe(DIRECT_DEVICE, direct));
      return found;
    }
    for (const slot of RECEIVER_SLOTS) {
      const info = await this.ping(slot);
      if (info && info.major >= 2) found.push(await this.describe(slot, info));
    }
    return found;
  }

  async describe(dev, protocol) {
    const entry = { index: dev, protocol: `${protocol.major}.${protocol.minor}`, name: null, type: null, battery: null };
    try {
      const nameIdx = await this.featureIndex(dev, Feature.DEVICE_NAME);
      if (nameIdx) {
        const [count] = await this.call(request(this.kind, dev, nameIdx, 0));
        const chunks = [];
        while (chunks.reduce((n, c) => n + c.length, 0) < count) {
          const read = chunks.reduce((n, c) => n + c.length, 0);
          const part = await this.call(request(this.kind, dev, nameIdx, 1, [read]));
          const slice = part.subarray(0, Math.min(part.length, count - read));
          if (!slice.length) break;
          chunks.push(slice);
        }
        entry.name = decodeName(chunks);
        const [type] = await this.call(request(this.kind, dev, nameIdx, 2));
        entry.type = DEVICE_TYPES[type] || `tipo ${type}`;
      }
    } catch { /* o nome é opcional */ }
    entry.battery = await this.battery(dev).catch(() => null);
    return entry;
  }

  async battery(dev) {
    const unified = await this.featureIndex(dev, Feature.UNIFIED_BATTERY);
    if (unified) return parseUnifiedBattery(await this.call(request(this.kind, dev, unified, 1)));
    const legacy = await this.featureIndex(dev, Feature.BATTERY_STATUS);
    if (legacy) return parseBatteryStatus(await this.call(request(this.kind, dev, legacy, 0)));
    return null;
  }
}
