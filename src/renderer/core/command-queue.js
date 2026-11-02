// Fila de comandos por dispositivo, com confirmação e reenvio.
//
// HID perde pacotes de vez em quando. Cada dispositivo ganha a sua própria
// fila: um comando por vez, e se a resposta esperada não chegar dentro do
// prazo o comando é reenviado até o limite de tentativas.

export class CommandQueue {
  /**
   * @param {object} options
   * @param {(bytes: Uint8Array) => Promise<void>} options.send  escreve um pacote no dispositivo
   * @param {number} [options.timeoutMs]   espera por resposta antes de reenviar
   * @param {number} [options.maxAttempts] envios no total antes de desistir
   */
  constructor({ send, timeoutMs = 200, maxAttempts = 10 }) {
    this.send = send;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;
    this.items = [];
    this.current = null;
    this.closed = false;
  }

  /**
   * Coloca um comando na fila.
   * Sem `expect`, a promessa resolve assim que o pacote é escrito.
   * Com `expect(report)`, resolve com o primeiro relatório que satisfizer o teste.
   */
  enqueue(bytes, { expect = null, maxAttempts = this.maxAttempts } = {}) {
    if (this.closed) return Promise.reject(new Error('Dispositivo desconectado'));
    return new Promise((resolve, reject) => {
      this.items.push({ bytes, expect, resolve, reject, attempts: 0, maxAttempts, timer: null });
      this.#pump();
    });
  }

  /** Entregue aqui todo relatório de entrada recebido do dispositivo. */
  onReport(report) {
    const item = this.current;
    if (!item || !item.expect) return false;
    if (!item.expect(report)) return false;
    clearTimeout(item.timer);
    this.current = null;
    item.resolve(report);
    this.#pump();
    return true;
  }

  close() {
    this.closed = true;
    const pending = this.current ? [this.current, ...this.items] : this.items;
    for (const item of pending) {
      clearTimeout(item.timer);
      item.reject(new Error('Dispositivo desconectado'));
    }
    this.items = [];
    this.current = null;
  }

  async #pump() {
    if (this.current || this.closed) return;
    const item = this.items.shift();
    if (!item) return;
    this.current = item;
    await this.#attempt(item);
  }

  async #attempt(item) {
    if (this.current !== item) return;
    if (item.attempts >= item.maxAttempts) {
      this.current = null;
      item.reject(new Error(`Sem resposta após ${item.attempts} tentativas`));
      this.#pump();
      return;
    }
    item.attempts++;
    try {
      await this.send(item.bytes);
    } catch (err) {
      this.current = null;
      item.reject(err);
      this.#pump();
      return;
    }
    if (!item.expect) {
      this.current = null;
      item.resolve(null);
      this.#pump();
      return;
    }
    item.timer = setTimeout(() => this.#attempt(item), this.timeoutMs);
  }
}
