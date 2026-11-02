// Regras da bateria que não dependem da tela: avisos de bateria baixa e
// texto de "há quanto tempo" a leitura foi feita.

export const LOW_BATTERY_THRESHOLDS = [20, 10]; // %
const REARM_MARGIN = 5; // o aviso volta a valer depois de subir 5 pontos acima do limite

/**
 * Decide quando avisar de bateria baixa: uma vez por limite, por controle.
 * O aviso só se repete depois que a bateria sobe de novo (ou começa a carregar).
 */
export class BatteryAlerts {
  constructor(thresholds = LOW_BATTERY_THRESHOLDS) {
    this.thresholds = [...thresholds].sort((a, b) => b - a);
    this.fired = new Map(); // id -> Set(limites já avisados)
  }

  /** Recebe uma leitura e devolve o limite a avisar agora, ou null. */
  check(id, battery) {
    if (!battery) return null;
    const fired = this.fired.get(id) || new Set();
    this.fired.set(id, fired);
    for (const t of [...fired]) {
      if (battery.charging || battery.percent > t + REARM_MARGIN) fired.delete(t);
    }
    if (battery.charging) return null;
    // Avisa só o limite mais baixo alcançado (ex.: abriu já em 8% → só o de 10%).
    const reached = this.thresholds.filter((t) => battery.percent <= t);
    if (!reached.length) return null;
    const lowest = reached[reached.length - 1];
    if (fired.has(lowest)) return null;
    for (const t of reached) fired.add(t);
    return lowest;
  }
}

/** "agora", "há 1 min", "há 12 min", "há 2 h". */
export function formatAge(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}

/** Nível para cores: 'low' (≤15%), 'mid' (≤40%) ou 'ok'. */
export function batteryLevel(percent) {
  return percent <= 15 ? 'low' : percent <= 40 ? 'mid' : 'ok';
}
