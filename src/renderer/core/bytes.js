// Utilitários de bytes compartilhados por todos os plugins.

export function hex(value, width = 2) {
  return Number(value).toString(16).toUpperCase().padStart(width, '0');
}

export function toHex(bytes) {
  return Array.from(bytes, (b) => hex(b)).join(' ');
}

export function hexToBytes(text) {
  const clean = text.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  if (clean.length % 2 !== 0) throw new Error('Quantidade ímpar de dígitos hexadecimais');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function vidPid(vendorId, productId) {
  return `${hex(vendorId, 4)}:${hex(productId, 4)}`;
}

/** Junta reportId + dados em um único array, no formato [id, ...dados]. */
export function withReportId(reportId, dataView) {
  const data = new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength);
  const out = new Uint8Array(data.length + 1);
  out[0] = reportId;
  out.set(data, 1);
  return out;
}
