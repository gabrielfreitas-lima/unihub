// Identificação de gamepads genéricos (qualquer marca) pela interface HID.

const GENERIC_DESKTOP = 0x01;
const JOYSTICK = 0x04;
const GAME_PAD = 0x05;
const MULTI_AXIS = 0x08;

/** Interface de jogo padrão: página Generic Desktop, uso Joystick/Game Pad/Multi-axis. */
export function isGamepadInterface(device) {
  return device.collections.some((c) =>
    c.usagePage === GENERIC_DESKTOP && [JOYSTICK, GAME_PAD, MULTI_AXIS].includes(c.usage));
}

export const GAMEPAD_FILTERS = [
  { usagePage: GENERIC_DESKTOP, usage: GAME_PAD },
  { usagePage: GENERIC_DESKTOP, usage: JOYSTICK },
];

/** Vendor IDs USB públicos dos fabricantes de controle mais comuns. */
const BRANDS = {
  0x045e: 'Microsoft',
  0x054c: 'Sony',
  0x057e: 'Nintendo',
  0x046d: 'Logitech',
  0x2dc8: '8BitDo',
  0x0f0d: 'Hori',
  0x0e6f: 'PDP',
  0x24c6: 'PowerA',
  0x3537: 'GameSir',
  0x1532: 'Razer',
  0x2563: 'ShanWan',
};

export function brandOf(device) {
  return BRANDS[device.vendorId] || null;
}

/** Nome para mostrar: o do sistema, ou "Gamepad <marca>" se vier vazio. */
export function genericName(device) {
  const name = (device.productName || '').trim();
  if (name) return name;
  const brand = brandOf(device);
  return brand ? `Gamepad ${brand}` : 'Gamepad';
}
