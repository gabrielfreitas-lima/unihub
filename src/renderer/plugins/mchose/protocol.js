// Protocolo HID dos headsets MCHOSE (ex.: V9 PRO): funções puras que montam
// e interpretam bytes. Especificação em docs/protocolos/mchose.md.

export const VENDOR_ID = 0x291d;
/**
 * No cabo USB o fone aparece com o VID do chip de áudio (C-Media), que outras
 * marcas também usam: por isso só conta se o nome do produto for MCHOSE.
 * Ex.: V9 PRO no cabo = 0D8C:0343 "MCHOSE V9 PRO HEADSET".
 */
export const WIRED_VENDOR_ID = 0x0d8c;

export function isMchoseDevice(device) {
  if (device.vendorId === VENDOR_ID) return true;
  return device.vendorId === WIRED_VENDOR_ID && /^MCHOSE\b/i.test(device.productName || '');
}

/** Conectado pelo cabo (o fone direto no USB) ou pelo dongle sem fio. */
export function isWired(device) {
  return device.vendorId === WIRED_VENDOR_ID;
}

/** Nome do modelo, igual nos dois modos: "MCHOSE V9 PRO HEADSET" → "MCHOSE V9 PRO". */
export function modelName(device) {
  return (device.productName || 'Headset MCHOSE').replace(/\s+HEADSET$/i, '');
}

/** Coleção de estado: o app pede, o fone responde no mesmo report. */
export const STATUS_USAGE_PAGE = 0xff90;
export const STATUS_REPORT = 0x55;
/** Coleção de versão: feature report. */
export const VERSION_USAGE_PAGE = 0xff22;
export const VERSION_REPORT = 0xaa;

export const PACKET_SIZE = 63;
export const CMD_BATTERY = 0x65;
/** Aviso espontâneo do dongle: [0x11, 0x01] quando o fone liga e conecta. */
export const EVT_LINK = 0x11;

/** Estado de carga no 3º byte da resposta de bateria. */
const CHARGE_STATES = {
  // 0x00: sem estado. Visto no cabo com 100% (antes e depois de 0x03); a % vale.
  0x02: 'discharging',
  0x03: 'charging',
  0x04: 'full',
  0x1a: 'asleep', // dongle conectado, fone desligado ou dormindo
};

function packet(...bytes) {
  const out = new Uint8Array(PACKET_SIZE);
  out.set(bytes);
  return out;
}

export const commands = {
  battery: () => packet(CMD_BATTERY, 0x01),
  version: () => packet(0x01, 0x00),
};

/** Tira o report ID do começo, se o sistema o incluiu. */
function payload(bytes, reportId) {
  return bytes[0] === reportId ? bytes.subarray(1) : bytes;
}

/** O fone acabou de ligar e conectar ao dongle. */
export function isLinkUpReport(reportId, data) {
  return reportId === STATUS_REPORT && data[0] === EVT_LINK && data[1] === 0x01;
}

export function isBatteryReport(reportId, data) {
  return reportId === STATUS_REPORT && data[0] === CMD_BATTERY;
}

/**
 * Bateria: [0x65, %, estado].
 * @returns {{percent: number|null, state: string, charging: boolean, asleep: boolean}|null}
 */
export function parseBattery(data) {
  if (data[0] !== CMD_BATTERY) return null;
  const state = CHARGE_STATES[data[2]] || 'unknown';
  const asleep = state === 'asleep';
  return {
    percent: asleep ? null : Math.min(100, data[1]),
    state,
    charging: state === 'charging',
    asleep,
  };
}

/** Versão do fone: [0xAA,] 0x01, d1, d2, d3, d4 → "0036". */
export function parseVersion(bytes) {
  const data = payload(bytes, VERSION_REPORT);
  if (data[0] !== 0x01) return null;
  return Array.from(data.subarray(1, 5), (d) => String(d)).join('');
}

export function hasPage(device, page) {
  return device.collections.some((c) => c.usagePage === page);
}
