// Teclados AULA série F: montagem e leitura dos pacotes de configuração.
// Vale só para a AULA; outras marcas de teclado usam outros comandos.
// Só funções puras (bytes entram, bytes saem); quem fala com o aparelho é a
// sessão (session.js). Formato descrito em docs/protocolos/aula.md.

// --- Comandos (o bit 0x80 pede leitura) ---------------------------------------

export const CMD = {
  led: 0x04,        // bloco de luz (128 bytes)
  colorsWired: 0x0a, // tabela de cores, pelo cabo
  colorsReceiver: 0x09, // tabela de cores, pelo receptor
  battery: 0x0a,     // bateria, só pelo receptor (lida com 0x4A)
};
export const READ = 0x80;

/** Leitura pelo receptor usa 0x40 (ex.: 0x44 lê o bloco de luz). */
export const RECEIVER_READ = 0x40;

export const LED_BLOCK_SIZE = 128;
export const COLOR_TABLE_READ_SIZE = 490;
export const COLOR_TABLE_WRITE_SIZE = 512;
const COLOR_TABLE_MARK_AT = 0x1fa;
const MARK = [0x5a, 0xa5];

// --- Efeitos --------------------------------------------------------------------
// Código gravado no teclado = posição na lista. Conferidos: 1, 2 e 6.
// colors: false = o efeito só tem as próprias cores (só "Colorido");
// speed: false = o efeito não tem velocidade (luz parada).

export const EFFECTS = [
  { code: 1, name: 'Sempre ligado', speed: false },
  { code: 2, name: 'Respirar' },
  { code: 3, name: 'Arco-íris', colors: false },
  { code: 4, name: 'Desaparecer rapidamente' },
  { code: 5, name: 'Gotas de chuva' },
  { code: 6, name: 'Roda arco-íris', colors: false },
  { code: 7, name: 'Ondulações brilhantes' },
  { code: 8, name: 'Brilhos de estrela' },
  { code: 9, name: 'Desaparecimento em sombra', colors: false },
  { code: 10, name: 'Cobra retrô' },
  { code: 11, name: 'Fluxo de neon' },
  { code: 12, name: 'Reação' },
  { code: 13, name: 'Onda senoidal' },
  { code: 14, name: 'Digitalização contínua', colors: false },
  { code: 15, name: 'Moinho de vento giratório', colors: false },
  { code: 16, name: 'Cachoeira colorida', colors: false },
  { code: 17, name: 'Florescendo', colors: false },
].map((e) => ({ colors: true, speed: true, ...e }));

/** Brilho máximo que o bloco aceita (F75); F87 e F99 vão só até 4 (devices.js). */
export const MAX_BRIGHTNESS = 9;
export const MAX_SPEED = 4;
/** Modo de cor: 0 a 6 = uma das 7 cores do efeito; 7 = colorido. */
export const COLORFUL = 7;
export const COLORS_PER_EFFECT = 7;

// --- Bloco de luz ---------------------------------------------------------------

// Dois bytes por efeito, a partir de 0x3A (efeito 1): brilho; velocidade
// (4 bits de cima) e modo de cor (4 bits de baixo).
const EFFECT_AT = 10;
const brightnessAt = (code) => 0x3a + 2 * (code - 1);
const speedAt = (code) => 0x3b + 2 * (code - 1); // 4 bits de cima
const colorModeAt = speedAt; // 4 bits de baixo

const hasMark = (bytes, at) => bytes[at] === MARK[0] && bytes[at + 1] === MARK[1];

/** O bloco veio inteiro? (128 bytes terminando em 5A A5) */
export function isLedBlock(block) {
  return !!block && block.length === LED_BLOCK_SIZE && hasMark(block, LED_BLOCK_SIZE - 2);
}

/** Efeito atual e os ajustes dele. */
export function readLedState(block) {
  const effect = block[EFFECT_AT];
  return { effect, ...effectSettings(block, effect) };
}

export function effectSettings(block, code) {
  return {
    brightness: block[brightnessAt(code)],
    speed: block[speedAt(code)] >> 4,
    colorMode: block[colorModeAt(code)] & 0x0f,
  };
}

/**
 * Novo bloco com o efeito e os ajustes dele trocados; o resto continua igual.
 * Velocidade e modo de cor dividem o mesmo byte: só os 4 bits certos mudam.
 */
export function withEffect(block, code, { brightness, speed, colorMode } = {}) {
  const out = Array.from(block);
  out[EFFECT_AT] = code;
  if (brightness !== undefined) out[brightnessAt(code)] = clamp(brightness, 0, MAX_BRIGHTNESS);
  if (speed !== undefined) out[speedAt(code)] = (clamp(speed, 0, MAX_SPEED) << 4) | (out[speedAt(code)] & 0x0f);
  if (colorMode !== undefined) out[colorModeAt(code)] = (out[colorModeAt(code)] & 0xf0) | clamp(colorMode, 0, COLORFUL);
  return out;
}

// --- Bateria (pelo receptor) ----------------------------------------------------

export const BATTERY_SIZE = 2;

/**
 * Resposta de 2 bytes: porcentagem; carregando quando os 4 bits de cima do
 * segundo byte estão ligados e os de baixo não.
 */
export function parseBattery(bytes) {
  if (!bytes || bytes.length < BATTERY_SIZE || bytes[0] > 100) return null;
  const flags = bytes[1];
  return { percent: bytes[0], charging: (flags & 0xf0) !== 0 && (flags & 0x0f) === 0 };
}

// --- Tabela de cores ------------------------------------------------------------

const hex2 = (n) => n.toString(16).padStart(2, '0');

/** As 7 cores do efeito, em "#rrggbb". */
export function effectColors(table, code) {
  const base = code * COLORS_PER_EFFECT * 3;
  return Array.from({ length: COLORS_PER_EFFECT }, (_, i) => {
    const [r, g, b] = [0, 1, 2].map((k) => table[base + i * 3 + k] ?? 0);
    return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  });
}

/** Tabela pronta para gravar (512 bytes com a marca), com a cor `index` do efeito trocada. */
export function withColor(table, code, index, hex) {
  const out = new Array(COLOR_TABLE_WRITE_SIZE).fill(0);
  for (let i = 0; i < Math.min(table.length, COLOR_TABLE_MARK_AT); i++) out[i] = table[i];
  const at = (code * COLORS_PER_EFFECT + index) * 3;
  const value = parseInt(hex.slice(1), 16);
  out[at] = (value >> 16) & 0xff;
  out[at + 1] = (value >> 8) & 0xff;
  out[at + 2] = value & 0xff;
  out[COLOR_TABLE_MARK_AT] = MARK[0];
  out[COLOR_TABLE_MARK_AT + 1] = MARK[1];
  return out;
}

// --- Pacotes pelo receptor (relatório 0x13, 19 bytes sem o ID) -----------------

export const RECEIVER_REPORT = 0x13;
const RECEIVER_CHUNK = 14;

function receiverPacket(cmd, total, index, data = []) {
  const p = new Uint8Array(19);
  p[0] = cmd;
  p[1] = total;
  p[2] = index;
  p[3] = data.length;
  p.set(data, 4);
  // Soma de conferência: todos os bytes do pacote, contando o ID 0x13.
  let sum = RECEIVER_REPORT;
  for (let i = 0; i < 18; i++) sum += p[i];
  p[18] = sum & 0xff;
  return p;
}

/** Pedido de leitura (ex.: 0x44). */
export const receiverReadRequest = (cmd) => receiverPacket(cmd, 1, 0);

/** Pacotes de gravação, 14 bytes de dados cada. */
export function receiverWritePackets(cmd, data) {
  const total = Math.ceil(data.length / RECEIVER_CHUNK);
  return Array.from({ length: total }, (_, i) =>
    receiverPacket(cmd, total, i, data.slice(i * RECEIVER_CHUNK, (i + 1) * RECEIVER_CHUNK)));
}

/** Lê um pacote recebido (sem o ID). */
export function parseReceiverPacket(bytes) {
  const len = bytes[3] & 0x0f;
  return { cmd: bytes[0], total: bytes[1] & 0x7f, index: bytes[2], data: Array.from(bytes.slice(4, 4 + len)) };
}

/** Junta os pacotes de uma leitura, na ordem; null se faltar algum. */
export function assembleReceiverPackets(packets) {
  if (!packets.length) return null;
  const total = packets[0].total;
  const byIndex = new Map(packets.map((p) => [p.index, p]));
  const out = [];
  for (let i = 0; i < total; i++) {
    if (!byIndex.has(i)) return null;
    out.push(...byIndex.get(i).data);
  }
  return out;
}

// --- Pacotes pelo cabo (relatório de configuração 0x06, 519 bytes sem o ID) ----

export const WIRED_REPORT = 0x06;
const WIRED_SIZE = 519;

/** Gravação (ou pedido de leitura, sem dados e com o tamanho esperado). */
export function wiredPacket(cmd, data = [], size = data.length) {
  const p = new Uint8Array(WIRED_SIZE);
  p[0] = cmd;
  p[3] = 1; // total de pacotes
  p[4] = 0; // número do pacote
  p[5] = size & 0xff;
  p[6] = size >> 8;
  p.set(data, 7);
  return p;
}

/** Dados da resposta de leitura (com ou sem o ID no começo). */
export function parseWiredResponse(bytes, size) {
  const at = bytes[0] === WIRED_REPORT ? 8 : 7;
  return Array.from(bytes.slice(at, at + size));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
