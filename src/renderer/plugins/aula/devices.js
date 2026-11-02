// Teclados AULA série F (F75, F87, F99): como reconhecer pelo USB.
//
// Os três modelos usam os mesmos códigos, no cabo e no receptor 2.4G. O
// teclado não diz o modelo pelos códigos USB, então o usuário escolhe o seu
// uma vez (fica salvo neste computador).
//
// Atenção: 258A é o fabricante do chip (SINO WEALTH) e 3554 também aparece em
// receptores de mouse de outras marcas. Por isso o nome "AULA" vem com o
// modelo escolhido, ou "série F", e o protocolo de configuração (luzes,
// macros) ainda não é usado.

export const WIRED = { vendorId: 0x258a, productId: 0x010c };
export const RECEIVER = { vendorId: 0x3554, productId: 0xfa09 };

export const MODELS = {
  f75: 'AULA F75',
  f87: 'AULA F87',
  f99: 'AULA F99',
};

const MODEL_KEY = 'unihub.aulaModel';

const same = (device, ids) => device.vendorId === ids.vendorId && device.productId === ids.productId;

export const isAulaWired = (device) => same(device, WIRED);
export const isAulaReceiver = (device) => same(device, RECEIVER);
export const isAulaDevice = (device) => isAulaWired(device) || isAulaReceiver(device);

/** Modelo escolhido pelo usuário ('f75' | 'f87' | 'f99'), ou null. */
export function savedModel(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(MODEL_KEY);
    return v in MODELS ? v : null;
  } catch {
    return null;
  }
}

export function saveModel(model, storage = globalThis.localStorage) {
  try { storage?.setItem(MODEL_KEY, model); } catch { /* vale só até fechar */ }
}

/**
 * Níveis de brilho do modelo: o F75 vai de 0 a 9; o F87 e o F99, de 0 a 4.
 * Sem modelo escolhido, o menor (não grava um valor que o teclado não tem).
 */
export function aulaMaxBrightness(model) {
  return model === 'f75' ? 9 : 4;
}

/** Nome para mostrar: o modelo escolhido, ou a série. */
export function aulaName(model) {
  return MODELS[model] || 'AULA série F';
}

/**
 * Desenho do modelo no teste de teclas (ABNT2, com as teclas \ e /?). Sem
 * modelo escolhido, o teclado padrão.
 */
export function aulaTester(model) {
  return model in MODELS ? { shape: model, kind: 'abnt2' } : {};
}
