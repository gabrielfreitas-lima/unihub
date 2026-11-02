// Nome amigável dos controles GameSir.
//
// Em modo Xbox o Windows chama todo controle de "Xbox 360 Controller for
// Windows". Para mostrar o nome real, usamos, nesta ordem:
//   1. o nome que o próprio dispositivo informa, se não for genérico;
//   2. o nome do dongle GameSir conectado ao mesmo tempo (ex.: "GameSir-Cyclone 2");
//   3. um nome já aprendido antes para esse PID (guardado no computador);
//   4. a tabela de PIDs confirmados com hardware;
//   5. "Controle GameSir".

const GENERIC = /xbox 360 controller|^controller\b|^gamepad$|^usb (input|gamepad)|^hid[- ]compliant/i;

/** PIDs confirmados com hardware real. Acrescente aqui ao testar outros modelos. */
const KNOWN_PIDS = {
  // connection: como o controle chega ao PC (via cabo, via dongle ou via Bluetooth).
  0x1053: { name: 'GameSir Cyclone 2', model: 'cyclone2', connection: 'via cabo' },
  0x100b: { name: 'GameSir Cyclone 2', model: 'cyclone2', connection: 'via dongle' },
  0x0575: { name: 'GameSir Cyclone 2', model: 'cyclone2', connection: 'dongle' },
};

/** Identificador do modelo (para layouts de luz etc.), ou null se desconhecido. */
export function modelFor(device) {
  return KNOWN_PIDS[device.productId]?.model || null;
}

const STORAGE_KEY = 'unihub.gamesir.learnedNames';

export function isGenericName(name) {
  return !name || GENERIC.test(name.trim());
}

/** "GameSir-Cyclone 2" → "GameSir Cyclone 2" */
export function cleanName(name) {
  return name.trim().replace(/^GameSir[-_ ]+/i, 'GameSir ');
}

function loadLearned(storage) {
  try {
    return JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveLearned(storage, learned) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(learned));
  } catch { /* sem armazenamento: só não lembra */ }
}

export function isDongle(device) {
  return KNOWN_PIDS[device.productId]?.connection === 'dongle';
}

/**
 * Separa as interfaces de configuração em "controles" e "dongles redundantes".
 * Um controle sem fio aparece duas vezes: pela interface do próprio dongle e
 * pela interface do controle. Enquanto houver pelo menos um controle para cada
 * dongle, os dongles ficam escondidos. Um dongle sem controle visível
 * continua na lista, porque é o único caminho até o controle.
 */
export function splitDongles(configDevices) {
  const dongles = configDevices.filter(isDongle);
  const controllers = configDevices.filter((d) => !isDongle(d));
  if (dongles.length && controllers.length >= dongles.length) return { visible: controllers, hidden: dongles };
  return { visible: configDevices, hidden: [] };
}

/**
 * Resolve o nome de cada interface GameSir.
 * @param {HIDDevice[]} devices  todas as interfaces GameSir conectadas
 * @param {Storage} [storage]    onde guardar nomes aprendidos (localStorage)
 * @returns {Map<HIDDevice, {name: string, connection: string|null, systemName: string}>}
 */
export function resolveNames(devices, storage = globalThis.localStorage) {
  const learned = loadLearned(storage);
  const realNames = [...new Set(devices.filter((d) => !isGenericName(d.productName)).map((d) => cleanName(d.productName)))];
  const dongleName = realNames.length === 1 ? realNames[0] : null;
  let changed = false;

  const result = new Map();
  for (const d of devices) {
    const known = KNOWN_PIDS[d.productId];
    let name;
    if (!isGenericName(d.productName)) {
      name = cleanName(d.productName);
    } else if (dongleName) {
      name = dongleName;
      if (learned[d.productId] !== name) {
        learned[d.productId] = name;
        changed = true;
      }
    } else {
      name = learned[d.productId] || known?.name || 'Controle GameSir';
    }
    result.set(d, { name, connection: known?.connection || null, systemName: d.productName || '' });
  }
  if (changed) saveLearned(storage, learned);
  return result;
}
