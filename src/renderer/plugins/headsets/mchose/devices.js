// Regras dos headsets MCHOSE que não são bytes: como juntar as interfaces de
// um fone, como achar o som dele e como ele está conectado.

import { STATUS_USAGE_PAGE, VERSION_USAGE_PAGE, VENDOR_ID, hasPage, isMchoseDevice, isWired, modelName } from './protocol.js';

/**
 * Um headset = a interface de estado + a de versão. No Windows elas podem vir
 * no mesmo HIDDevice ou separadas; separadas, só junta quando não há dúvida.
 */
export function groupHeadsets(devices) {
  const mine = devices.filter(isMchoseDevice);
  // Fone no cabo: o dongle do mesmo modelo fica sem fone e sai da lista. Só
  // depois que o fone no cabo aparece completo (ao conectar, ele vem primeiro
  // com uma interface só); assim a aba não pisca "Conecte seu headset".
  const wiredModels = new Set(mine.filter((d) => isWired(d) && hasPage(d, STATUS_USAGE_PAGE)).map(modelName));
  const status = mine.filter((d) => hasPage(d, STATUS_USAGE_PAGE))
    .filter((d) => isWired(d) || !wiredModels.has(modelName(d)));
  return status.map((s) => {
    if (hasPage(s, VERSION_USAGE_PAGE)) return [s];
    const same = (d) => d.productId === s.productId && d.productName === s.productName;
    const versions = mine.filter((d) => d !== s && same(d) && hasPage(d, VERSION_USAGE_PAGE));
    return status.filter(same).length === 1 && versions.length === 1 ? [s, versions[0]] : [s];
  });
}

/**
 * O Chromium termina o nome de cada aparelho de som USB com o VID:PID, ex.:
 * "Headphone (MCHOSE V9 PRO) (291d:385d)". Comparar por ele acha o som do
 * mesmo aparelho, sem confundir o dongle com o fone no cabo.
 */
export function soundDeviceMatcher(device) {
  const hex = (n) => n.toString(16).padStart(4, '0');
  const suffix = `(${hex(device.vendorId)}:${hex(device.productId)})`;
  return (label) => (label || '').trim().toLowerCase().endsWith(suffix);
}

export const connectionOf = (device) => (isWired(device) ? 'via cabo' : 'via dongle');

/**
 * Som de um fone MCHOSE (para não aparecer de novo como fone genérico): pelo
 * dongle (VID 291D), no cabo (VID 0D8C com nome MCHOSE) ou, por Bluetooth,
 * quando o mesmo modelo já está na lista pelo dongle ou pelo cabo.
 * @param {string[]} shownModels  modelos MCHOSE na lista (ex.: "MCHOSE V9 PRO")
 */
export function isMchoseSound(sound, shownModels) {
  if (sound.vidPid?.startsWith(VENDOR_ID.toString(16).padStart(4, '0') + ':')) return true;
  const name = sound.name.replace(/\s+HEADSET$/i, '').toLowerCase();
  if (sound.transport === 'usb' && /^mchose\b/.test(name)) return true;
  return sound.transport === 'bluetooth' && shownModels.some((m) => m.toLowerCase() === name);
}
