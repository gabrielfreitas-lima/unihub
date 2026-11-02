// HID++ 2.0 (Logitech), escrito a partir da documentação pública do
// protocolo. Só monta e interpreta bytes; veja docs/protocolos/logitech-hidpp.md.

export const VENDOR_ID = 0x046d;
export const USAGE_PAGES = [0xff00, 0xff43];

export const SHORT = { id: 0x10, length: 7 };
export const LONG = { id: 0x11, length: 20 };

export const DIRECT_DEVICE = 0xff; // dispositivo ligado direto por USB
export const RECEIVER_SLOTS = [1, 2, 3, 4, 5, 6];

const SOFTWARE_ID = 0x0b; // qualquer valor 1–15; identifica nossas respostas
const ERROR_V1 = 0x8f;
const ERROR_V2 = 0xff;

export const Feature = Object.freeze({
  ROOT: 0x0000,
  DEVICE_NAME: 0x0005,
  BATTERY_STATUS: 0x1000,
  UNIFIED_BATTERY: 0x1004,
});

export const DEVICE_TYPES = [
  'Teclado', 'Controle remoto', 'Teclado numérico', 'Mouse', 'Touchpad', 'Trackball',
  'Apresentador', 'Receptor', 'Headset', 'Webcam', 'Volante', 'Joystick', 'Gamepad',
  'Dock', 'Caixa de som', 'Microfone', 'Iluminação', 'Teclado programável', 'Pedais', 'Volante de simulação',
];

const ERRORS = {
  0x01: 'desconhecido', 0x02: 'argumento inválido', 0x03: 'fora de faixa', 0x04: 'falha de hardware',
  0x05: 'erro Logitech interno', 0x06: 'índice de feature inválido', 0x07: 'função inválida',
  0x08: 'ocupado', 0x09: 'não suportado / dispositivo ausente',
};

export class HidppError extends Error {
  constructor(code, version) {
    super(`HID++ ${version}: ${ERRORS[code] || 'erro 0x' + code.toString(16)}`);
    this.code = code;
  }
}

/** Monta uma requisição. Devolve [reportId, ...bytes] com o tamanho do relatório escolhido. */
export function request(kind, deviceIndex, featureIndex, fn, params = []) {
  const out = new Uint8Array(kind.length);
  out[0] = kind.id;
  out[1] = deviceIndex;
  out[2] = featureIndex;
  out[3] = ((fn & 0x0f) << 4) | SOFTWARE_ID;
  out.set(params.slice(0, kind.length - 4), 4);
  return out;
}

/** Diz se `report` é a resposta (ou o erro) de `req`. */
export function isReplyTo(req, report) {
  if (report[0] !== SHORT.id && report[0] !== LONG.id) return false;
  if (report[1] !== req[1]) return false;
  if (report[2] === req[2] && report[3] === req[3]) return true;
  return (report[2] === ERROR_V2 || report[2] === ERROR_V1) && report[3] === req[2] && report[4] === req[3];
}

/** Lança HidppError se a resposta for um erro; senão devolve os parâmetros. */
export function payload(report) {
  if (report[2] === ERROR_V2) throw new HidppError(report[5], '2.0');
  if (report[2] === ERROR_V1) throw new HidppError(report[5], '1.0');
  return report.subarray(4);
}

export const root = {
  getFeature: (kind, dev, featureId) => request(kind, dev, 0x00, 0, [featureId >> 8, featureId & 0xff]),
  ping: (kind, dev, marker = 0x5a) => request(kind, dev, 0x00, 1, [0, 0, marker]),
};

export function parsePing(params) {
  return { major: params[0], minor: params[1], marker: params[2] };
}

export function parseFeatureIndex(params) {
  return params[0]; // 0 = feature ausente
}

export function decodeName(chunks) {
  const bytes = chunks.flatMap((c) => Array.from(c));
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(new Uint8Array(end === -1 ? bytes : bytes.slice(0, end)));
}

const CHARGING_V1 = ['descarregando', 'carregando', 'quase carregado', 'carregado', 'carga lenta', 'bateria inválida', 'erro térmico'];
const CHARGING_V4 = ['descarregando', 'carregando', 'carga lenta', 'carregado', 'erro'];

export function parseBatteryStatus(params) {
  return { percent: params[0] || null, status: CHARGING_V1[params[2]] || `estado ${params[2]}` };
}

export function parseUnifiedBattery(params) {
  const levels = { 1: 'crítica', 2: 'baixa', 4: 'boa', 8: 'cheia' };
  return {
    percent: params[0] || null,
    level: levels[params[1]] || null,
    status: CHARGING_V4[params[2]] || `estado ${params[2]}`,
  };
}
