// Ponte mínima entre a página e o processo principal: só o que a web não faz
// sozinha. Nada de Node.js fica exposto para a página.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unihub', {
  /** Abre Configurações > Sistema > Som do Windows. */
  openSoundSettings: () => ipcRenderer.invoke('open-sound-settings'),
  /** Bateria que o Windows conhece de fones Bluetooth: [{ name, percent }]. */
  bluetoothBatteries: () => ipcRenderer.invoke('bluetooth-batteries'),
  /** Teclados que o Windows conhece (inclusive notebook e Bluetooth): [{ id, name, chain }]. */
  systemKeyboards: () => ipcRenderer.invoke('system-keyboards'),
  /** Versão (bcdDevice) de um aparelho USB, ex.: "0012", ou null. */
  usbRevision: (vendorId, productId) => ipcRenderer.invoke('usb-revision', vendorId, productId),
  /** Configurações do app guardadas no computador (bandeja, menu, tema...). */
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
});
