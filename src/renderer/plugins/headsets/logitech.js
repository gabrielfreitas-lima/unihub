// Headsets Logitech na aba Headsets, pelo que o plugin Logitech já sabe do
// HID++ 2.0: nome, tipo, versão do protocolo e bateria. Um aparelho entra
// aqui quando o próprio HID++ diz que ele é do tipo "Headset".
// Ainda não testado com headsets Logitech.

import { VENDOR_ID, USAGE_PAGES, DIRECT_DEVICE } from '../logitech/hidpp.js';
import { isHidppEndpoint } from '../logitech/session.js';

export const HEADSET_TYPE = 'Headset';

/** Interface HID++ da Logitech (receptor ou aparelho por cabo). */
export function isLogitechHidpp(device) {
  return device.vendorId === VENDOR_ID
    && device.collections.some((c) => USAGE_PAGES.includes(c.usagePage))
    && isHidppEndpoint(device);
}

/**
 * Do resultado da busca HID++ de uma interface, só os headsets.
 * @param {{index: number, name: string|null, type: string|null, protocol: string, battery: object|null}[]} results
 */
export function logitechHeadsets(results) {
  return results.filter((r) => r.type === HEADSET_TYPE).map((r) => ({
    index: r.index,
    name: r.name || 'Headset Logitech',
    protocol: r.protocol,
    battery: r.battery,
    // 0xFF = falou direto com o aparelho USB; 1–6 = pareado num receptor.
    connection: r.index === DIRECT_DEVICE ? 'via USB' : 'via dongle',
  }));
}

/** Bateria para o cabeçalho: % quando o fone informa; senão, só o nível. */
export function batteryView(battery) {
  if (!battery) return { percent: null, text: '' };
  const charging = /^carregando|carga lenta/.test(battery.status || '');
  return {
    percent: Number.isFinite(battery.percent) ? battery.percent : null,
    charging,
    text: charging ? 'Carregando' : battery.percent == null && battery.level ? `Bateria ${battery.level}` : '',
  };
}
