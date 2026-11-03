// Liga cada controle da lista ao seu gamepad da Gamepad API.
//
// A Gamepad API não diz qual aparelho USB é cada gamepad (dois controles
// iguais aparecem com o mesmo nome). Então cruzamos os sinais: quando um
// controle GameSir avisa que foi tocado (pela interface de configuração), o
// gamepad que mudou no mesmo instante é o dele.

const DEADZONE = 0.25;
const WINDOW_MS = 250; // toque e mudança no gamepad precisam estar próximos

/** Diz se o usuário mexeu no gamepad entre dois instantes (botões ou sticks). */
export function padChanged(before, after) {
  if (!before || !after) return false;
  if (before.buttons.length !== after.buttons.length) return true;
  for (let i = 0; i < after.buttons.length; i++) {
    if (before.buttons[i] !== after.buttons[i]) return true;
  }
  return after.axes.some((v, i) => Math.abs(v - (before.axes[i] || 0)) > DEADZONE);
}

/** Retrato leve de um gamepad, para comparar depois. */
export function snapshot(pad) {
  return {
    buttons: pad.buttons.map((b) => b.pressed),
    axes: pad.axes.map((v) => (Math.abs(v) < DEADZONE ? 0 : Math.round(v * 4) / 4)),
  };
}

/**
 * O gamepad pode ser deste aparelho? Compara o VID:PID que a Gamepad API põe no
 * id ("... Vendor: 054c Product: 09cc)"). Sem essa informação no id, não descarta.
 */
export function padMatchesDevice(pad, device) {
  const ids = /vendor:\s*([0-9a-f]{4})\s+product:\s*([0-9a-f]{4})/i.exec(pad.id);
  if (!ids) return true;
  return parseInt(ids[1], 16) === device.vendorId && parseInt(ids[2], 16) === device.productId;
}

export class PadBinder {
  constructor() {
    this.last = new Map(); // pad.index -> snapshot
    this.changedAt = new Map(); // pad.index -> último instante em que mudou
    this.bound = new Map(); // deviceId -> pad.index
  }

  /** Chame periodicamente com navigator.getGamepads() (só os não nulos). */
  observe(pads, now = Date.now()) {
    const present = new Set(pads.map((p) => p.index));
    for (const pad of pads) {
      const snap = snapshot(pad);
      if (padChanged(this.last.get(pad.index), snap)) this.changedAt.set(pad.index, now);
      this.last.set(pad.index, snap);
    }
    for (const index of [...this.last.keys()]) {
      if (!present.has(index)) {
        this.last.delete(index);
        this.changedAt.delete(index);
        for (const [id, bound] of this.bound) if (bound === index) this.bound.delete(id);
      }
    }
  }

  /**
   * O controle `deviceId` avisou um toque. Se exatamente um gamepad mudou
   * agora há pouco, ele é o desse controle.
   */
  touched(deviceId, now = Date.now()) {
    const recent = [...this.changedAt].filter(([, at]) => now - at <= WINDOW_MS).map(([index]) => index);
    if (recent.length !== 1) return false;
    const index = recent[0];
    for (const [id, bound] of this.bound) if (bound === index && id !== deviceId) this.bound.delete(id);
    this.bound.set(deviceId, index);
    return true;
  }

  padFor(deviceId) {
    return this.bound.get(deviceId);
  }

  /** Gamepads ainda não ligados a nenhum controle GameSir. */
  unboundIndexes(indexes) {
    const used = new Set(this.bound.values());
    return indexes.filter((i) => !used.has(i));
  }
}
