// Protocolo de configuração GameSir, escrito a partir da especificação em
// docs/protocolos/gamesir.md. Este arquivo só monta e interpreta bytes; não
// toca em hardware, então pode ser testado com `npm test`.

export const VENDOR_ID = 0x3537;

/** Interface de configuração (página HID definida pelo fabricante). */
export const CONFIG_USAGE_PAGE = 0xfff0;
/** Alguns modelos/receptores usam outra página e outro protocolo. */
export const ALT_USAGE_PAGE = 0xffff;

export const REPORT_ID = 0x0f; // saída: comandos do app
export const RESPONSE_REPORT_ID = 0x10; // entrada: respostas, com o byte de comando + 1
export const PACKET_SIZE = 64; // incluindo o report ID
export const STATE_REPORT_ID = 0x12; // relatório periódico de estado do controle

export const Cmd = Object.freeze({
  ENTER_CONFIG: 0x01,
  EXIT_CONFIG: 0x02,
  WRITE_PROFILE: 0x03,
  READ_BLOCK: 0x04,
  SWITCH_PROFILE: 0x07,
  READ_FW_VERSION: 0x09,
  READ_CURRENT_PROFILE: 0x0b,
  LIGHT: 0x0d,
  READ_PROFILE_BY_OFFSET: 0x10,
  VIBRATION: 0x20,
  HEARTBEAT: 0xf2,
  CALIBRATION: 0xfd,
  ENTER_UPGRADE: 0xfc,
});

export const PROFILE_SLOTS = [1, 2, 3, 4];

/** Taxa de relatório: 1 byte (a "marcha") dentro de cada perfil de botões. */
export const REPORT_RATE_OFFSET = 46;
export const REPORT_RATES = {
  cyclone2: [
    { gear: 0, hz: 250 },
    { gear: 1, hz: 500 },
    { gear: 2, hz: 1000 },
  ],
};

/** Hz de uma marcha, ou null se o modelo não tiver essa marcha. */
export function reportRateHz(model, gear) {
  return REPORT_RATES[model]?.find((r) => r.gear === gear)?.hz ?? null;
}
export const SHIFT_PROFILE = 5;
export const PROFILE_SIZE = 680; // bytes de um perfil de botões (família padrão)
export const CHUNK_SIZE = 58; // dados por pacote: 64 - (id + cmd + slot + offset(2) + tamanho)

/** Monta um pacote completo de 64 bytes: [0x0F, cmd, ...params, 0...]. */
export function packet(cmd, params = []) {
  if (params.length > PACKET_SIZE - 2) throw new Error('Parâmetros grandes demais para um pacote');
  const out = new Uint8Array(PACKET_SIZE);
  out[0] = REPORT_ID;
  out[1] = cmd;
  out.set(params, 2);
  return out;
}

export const ACK = 0x06; // confirmação de gravação; [0x06, 0x01] = ocupado
export const BLOCK_REPLY = 0x05; // resposta de leitura de bloco

/** Resposta de leitura: [0x10, 0x05, slot, offHi, offLo, tamanho, dados…] */
export function isBlockReply(report, slot, offset) {
  return report[0] === RESPONSE_REPORT_ID && report[1] === BLOCK_REPLY &&
    report[2] === slot && (report[3] << 8 | report[4]) === offset;
}

export function blockReplyData(report) {
  return report.subarray(6, 6 + report[5]);
}

export function isWriteAck(report) {
  return report[0] === RESPONSE_REPORT_ID && report[1] === ACK && report[2] !== 1;
}

export const commands = {
  heartbeat: (testMode = false) => packet(Cmd.HEARTBEAT, [testMode ? 1 : 0]),
  readFirmwareVersion: () => packet(Cmd.READ_FW_VERSION),
  readCurrentProfile: () => packet(Cmd.READ_CURRENT_PROFILE),
  switchProfile: (slot) => {
    if (![...PROFILE_SLOTS, SHIFT_PROFILE].includes(slot)) throw new Error(`Perfil inválido: ${slot}`);
    return packet(Cmd.SWITCH_PROFILE, [slot]);
  },
  /** Intensidade 0–255 em cada motor; 0/0 para parar. */
  vibrate: (left, right) => packet(Cmd.VIBRATION, [0x66, 0x55, clampByte(left), clampByte(right)]),
  /** Toca a animação de luz, ou para no quadro-chave `frame` (1 = primeiro). */
  lightPreview: (playing, frame = 1) => packet(Cmd.LIGHT, [playing ? 1 : 0, clampByte(frame)]),
  enterConfig: () => packet(Cmd.ENTER_CONFIG),
  exitConfig: (save) => packet(Cmd.EXIT_CONFIG, [save ? 1 : 0]),
};

/**
 * Divide uma leitura de `length` bytes a partir de `offset` em pacotes.
 * Cada pacote pede até CHUNK_SIZE bytes: [cmd, slot, offHi, offLo, tamanho].
 */
export function readBlockPackets(slot, offset = 0, length = PROFILE_SIZE) {
  const out = [];
  for (let pos = 0; pos < length; pos += CHUNK_SIZE) {
    const at = offset + pos;
    const size = Math.min(CHUNK_SIZE, length - pos);
    out.push(packet(Cmd.READ_BLOCK, [slot, at >> 8, at & 0xff, size]));
  }
  return out;
}

/** Mesmo esquema da leitura, mas cada pacote carrega os dados a gravar. */
export function writeBlockPackets(slot, data, offset = 0) {
  const out = [];
  for (let pos = 0; pos < data.length; pos += CHUNK_SIZE) {
    const at = offset + pos;
    const chunk = data.subarray(pos, pos + CHUNK_SIZE);
    out.push(packet(Cmd.WRITE_PROFILE, [slot, at >> 8, at & 0xff, chunk.length, ...chunk]));
  }
  return out;
}

/**
 * Classifica um relatório de entrada no formato [reportId, ...dados].
 * Para respostas, `cmd` já é o comando original (byte recebido − 1).
 */
export function classify(report) {
  if (report[0] === STATE_REPORT_ID) return { kind: 'state' };
  if (report[0] === RESPONSE_REPORT_ID) return { kind: 'response', cmd: (report[1] - 1) & 0xff };
  return { kind: 'other' };
}

/**
 * Versão do firmware: dígitos ASCII em UTF-16LE, em grupos de 4.
 * Cabo: "0356" → { controller: "3.56" }.
 * Sem fio: "03560121" → { controller: "3.56", dongle: "1.21" }.
 */
export function parseFirmwareVersion(report) {
  let digits = '';
  for (let i = 2; i + 1 < report.length; i += 2) {
    const code = report[i] | (report[i + 1] << 8);
    if (!code) break;
    digits += String.fromCharCode(code);
  }
  if (!/^(\d{4})+$/.test(digits)) return digits ? { controller: digits } : null;
  const [controller, dongle] = digits.match(/\d{4}/g).map(formatVersion);
  return dongle ? { controller, dongle } : { controller };
}

function formatVersion(group) {
  const n = String(Number(group)).padStart(3, '0');
  return `${Number(n.slice(0, -2))}.${n.slice(-2)}`;
}

// Relatório de estado 0x12 (dados após o report ID):
//   0–3  sticks (0x80 = centro)   4  direcional (0x0F = solto)
//   5–6  botões                   7–8  gatilhos
//   9+   sensores de movimento (variam sozinhos, mesmo parado)
const STICK_BYTES = [1, 2, 3, 4]; // posições no array [reportId, ...dados]
const CONTROL_BYTES = [5, 6, 7, 8, 9];
const STICK_DEADZONE = 24;

/**
 * Diz se o usuário mexeu no controle entre dois relatórios de estado:
 * botão, direcional ou gatilho mudou, ou um stick andou além da zona morta.
 * Os sensores de movimento são ignorados.
 */
export function hasPhysicalInput(previous, current) {
  if (!previous || !current) return false;
  if (CONTROL_BYTES.some((i) => previous[i] !== current[i])) return true;
  return STICK_BYTES.some((i) => Math.abs(previous[i] - current[i]) > STICK_DEADZONE);
}

// Bateria no relatório de estado (posições no array [reportId, ...dados]).
const CHARGE_STATE_BYTE = 35; // 1 = carregando
const BATTERY_BYTE = 36; // 0–100 %

/** Bateria do controle, ou null se o relatório não trouxer um valor válido. */
export function parseBattery(report) {
  const percent = report?.[BATTERY_BYTE];
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return null;
  return { percent, charging: report[CHARGE_STATE_BYTE] === 1 };
}

/** Perfil atual: 1–4, ou 5 para o perfil Shift. */
export function parseCurrentProfile(report) {
  return report[2];
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
}
