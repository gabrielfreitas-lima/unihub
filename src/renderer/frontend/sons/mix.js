// Preparo do som para o efeito no microfone, sem nada de tela (dá para testar).
//
// O efeito recebe sempre mono, float de 32 bits, 48000 Hz. A taxa já vem certa
// da decodificação (feita num contexto de 48000 Hz); aqui só junta os canais e
// aplica o volume.

export const EFFECT_RATE = 48000;

/** Junta os canais (média) num só e aplica o volume (0 a 1), sem passar de ±1. */
export function mixToMono(channels, volume = 1) {
  const length = channels.length ? channels[0].length : 0;
  const out = new Float32Array(length);
  if (!length) return out;
  const scale = volume / channels.length;
  for (const data of channels) {
    for (let i = 0; i < length; i++) out[i] += data[i] * scale;
  }
  for (let i = 0; i < length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

/** Canais de um AudioBuffer como lista de Float32Array. */
export function channelsOf(buffer) {
  return Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
}
