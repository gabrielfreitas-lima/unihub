// Quais extensões de hub o usuário instalou. Só elas viram abas no cabeçalho.
// Fica salvo neste computador (localStorage); sem armazenamento, nada é lembrado.

const STORAGE_KEY = 'unihub.installedHubs';

// Extensões que mudaram de id: a antiga continua valendo como a nova.
const RENAMED = { gamesir: 'gamepads', mchose: 'headsets' };

export class Extensions extends EventTarget {
  constructor(storage = globalThis.localStorage) {
    super();
    this.storage = storage;
    this.installed = new Set(this.#load());
  }

  has(id) {
    return this.installed.has(id);
  }

  install(id) {
    if (this.installed.has(id)) return;
    this.installed.add(id);
    this.#save();
    this.dispatchEvent(new CustomEvent('change', { detail: { id, installed: true } }));
  }

  uninstall(id) {
    if (!this.installed.delete(id)) return;
    this.#save();
    this.dispatchEvent(new CustomEvent('change', { detail: { id, installed: false } }));
  }

  #load() {
    try {
      const list = JSON.parse(this.storage?.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter((x) => typeof x === 'string').map((id) => RENAMED[id] || id);
    } catch {
      return [];
    }
  }

  #save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify([...this.installed]));
    } catch { /* sem armazenamento: vale só até fechar o app */ }
  }
}
