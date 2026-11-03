// Mapeamento de botões no perfil GameSir. Funções puras: bytes <-> modelo.
// Formato documentado em docs/protocolos/gamesir.md ("Mapeamento de botões").

export const KEYS_OFFSET = 64; // primeiro botão dentro do perfil de 680 bytes
export const KEY_SIZE = 7; // turbo, velocidade do turbo, mapeado?, destino 1, 2, 3, alternar
export const DISABLED = 255;

/** Botões configuráveis, na ordem em que aparecem no perfil. `code` = código do próprio botão. */
export const BUTTONS = [
  { id: 'up', label: '↑', name: 'Direcional ↑', code: 1 },
  { id: 'down', label: '↓', name: 'Direcional ↓', code: 2 },
  { id: 'left', label: '←', name: 'Direcional ←', code: 3 },
  { id: 'right', label: '→', name: 'Direcional →', code: 4 },
  { id: 'lb', label: 'LB', name: 'LB', code: 5 },
  { id: 'rb', label: 'RB', name: 'RB', code: 6 },
  { id: 'l3', label: 'L3', name: 'L3', code: 7 },
  { id: 'r3', label: 'R3', name: 'R3', code: 8 },
  { id: 'a', label: 'A', name: 'A', code: 9 },
  { id: 'b', label: 'B', name: 'B', code: 10 },
  { id: 'x', label: 'X', name: 'X', code: 11 },
  { id: 'y', label: 'Y', name: 'Y', code: 12 },
  { id: 'home', label: 'Home', name: 'Home', code: 13 },
  { id: 'view', label: 'View', name: 'View', code: 14 },
  { id: 'menu', label: 'Menu', name: 'Menu', code: 15 },
  { id: 'capture', label: 'Captura', name: 'Captura', code: 16 },
];

/**
 * Paddles traseiros do Cyclone 2. Ficam fora do trecho dos 16 botões, cada um no
 * seu offset do perfil, e o padrão de fábrica é "mapeado para o próprio código".
 */
export const PADDLES = [
  { id: 'l4', label: 'L4', name: 'L4', code: 17, offset: 176 },
  { id: 'r4', label: 'R4', name: 'R4', code: 18, offset: 335 },
];

/** Para onde um botão pode ser mapeado. */
export const TARGETS = [
  ...BUTTONS.map((b) => ({ code: b.code, name: b.name })),
  { code: 19, name: 'LT' },
  { code: 20, name: 'RT' },
  { code: 21, name: 'Stick esquerdo ↑' },
  { code: 22, name: 'Stick esquerdo ↓' },
  { code: 23, name: 'Stick esquerdo ←' },
  { code: 24, name: 'Stick esquerdo →' },
  { code: 25, name: 'Stick direito ↑' },
  { code: 26, name: 'Stick direito ↓' },
  { code: 27, name: 'Stick direito ←' },
  { code: 28, name: 'Stick direito →' },
  { code: DISABLED, name: 'Desativado' },
];

export function targetName(code) {
  return TARGETS.find((t) => t.code === code)?.name || `código ${code}`;
}

/**
 * Lê os 16 botões a partir de `bytes` (o trecho que começa em KEYS_OFFSET).
 * `target` é o código para onde o botão foi mapeado, ou null se ele faz a
 * própria função. Os outros campos são guardados para regravar sem perder nada.
 */
export function parseMapping(bytes) {
  if (bytes.length < BUTTONS.length * KEY_SIZE) throw new Error('Trecho de mapeamento incompleto');
  return BUTTONS.map((button, i) => {
    const raw = Array.from(bytes.slice(i * KEY_SIZE, (i + 1) * KEY_SIZE));
    const mapped = raw[2] === 1 && raw[3] !== 0;
    return { id: button.id, target: mapped && raw[3] !== button.code ? raw[3] : null, raw };
  });
}

/** Monta o trecho de bytes a partir do modelo (preserva turbo e "alternar"). */
export function buildMapping(entries) {
  const out = new Uint8Array(BUTTONS.length * KEY_SIZE);
  entries.forEach((entry, i) => {
    const bytes = [...entry.raw];
    if (entry.target === null) {
      bytes[2] = 0; // faz a própria função
      bytes[3] = bytes[4] = bytes[5] = 0;
    } else {
      bytes[2] = 1;
      bytes[3] = entry.target;
      bytes[4] = bytes[5] = 0;
    }
    out.set(bytes, i * KEY_SIZE);
  });
  return out;
}

/** Lê um paddle a partir dos seus 7 bytes. Mesmo modelo de `parseMapping`. */
export function parsePaddle(paddle, bytes) {
  if (bytes.length < KEY_SIZE) throw new Error('Trecho de mapeamento incompleto');
  const raw = Array.from(bytes.slice(0, KEY_SIZE));
  const mapped = raw[2] === 1 && raw[3] !== 0;
  return { id: paddle.id, target: mapped && raw[3] !== paddle.code ? raw[3] : null, raw };
}

/** Monta os 7 bytes de um paddle (preserva turbo e "alternar"). */
export function buildPaddle(paddle, entry) {
  const bytes = [...entry.raw];
  bytes[2] = 1;
  bytes[3] = entry.target === null ? paddle.code : entry.target;
  bytes[4] = bytes[5] = 0;
  return Uint8Array.from(bytes);
}

/** Quantos botões estão remapeados. */
export function countRemapped(entries) {
  return entries.filter((e) => e.target !== null).length;
}
