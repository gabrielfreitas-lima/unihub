// Conversa com um teclado AULA série F, pelo cabo ou pelo receptor 2.4G.
//
// - Um pedido por vez (os dois caminhos respondem no mesmo relatório).
// - Leitura conferida: o bloco de luz precisa vir inteiro (5A A5 no fim);
//   senão, repete. Sinal fraco, o cabo ligado com a chave no sem fio ou o app
//   oficial aberto fazem pacotes se perderem: pelo receptor, as tentativas se
//   somam (o pacote que faltou numa vem na outra; os dados não mudam).
// - Gravação pelo receptor: pacote sem confirmação é reenviado.
// - Gravação: sempre a partir do que foi lido, mudando só o necessário.

import {
  CMD, READ, RECEIVER_READ, RECEIVER_REPORT, WIRED_REPORT,
  LED_BLOCK_SIZE, COLOR_TABLE_READ_SIZE, BATTERY_SIZE, isLedBlock, parseBattery,
  receiverReadRequest, receiverWritePackets, parseReceiverPacket, assembleReceiverPackets,
  wiredPacket, parseWiredResponse,
} from './protocol.js';
import { isAulaWired, isAulaReceiver } from './devices.js';

const RECEIVER_PAGE = 0xff02;
const READ_ATTEMPTS = 6;
const WRITE_ATTEMPTS = 4;
const PACKET_TIMEOUT_MS = 1500;
const READ_TIMEOUT_MS = 3000;

const bytesOf = (dv) => new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A interface de configuração do grupo (cabo: relatório 0x06; receptor: página 0xFF02). */
export function configInterface(devices) {
  return devices.find((d) => isAulaWired(d) && d.collections.some((c) => c.featureReports.some((r) => r.reportId === WIRED_REPORT)))
    || devices.find((d) => isAulaReceiver(d) && d.collections.some((c) => c.usagePage === RECEIVER_PAGE))
    || null;
}

export class AulaSession {
  constructor(device) {
    this.device = device;
    this.wired = isAulaWired(device);
    this.chain = Promise.resolve();
    this.listeners = new Set();
    this.onInput = (e) => {
      if (e.reportId !== RECEIVER_REPORT) return;
      const packet = parseReceiverPacket(bytesOf(e.data));
      for (const fn of this.listeners) fn(packet);
    };
  }

  async open() {
    if (!this.device.opened) await this.device.open();
    if (!this.wired) this.device.addEventListener('inputreport', this.onInput);
  }

  close() {
    this.device.removeEventListener('inputreport', this.onInput);
    this.listeners.clear();
  }

  /** Bloco de luz (128 bytes), conferido. */
  readLed() {
    return this.#serial(() => this.#readChecked(CMD.led, LED_BLOCK_SIZE, isLedBlock));
  }

  writeLed(block) {
    if (!isLedBlock(block)) return Promise.reject(new Error('Bloco de luz inválido'));
    return this.#serial(() => this.#write(CMD.led, block));
  }

  /** Tabela de cores (7 cores por efeito). */
  readColors() {
    const cmd = this.wired ? CMD.colorsWired : CMD.colorsReceiver;
    return this.#serial(() => this.#readChecked(cmd, COLOR_TABLE_READ_SIZE, (t) => t?.length === COLOR_TABLE_READ_SIZE));
  }

  writeColors(table) {
    const cmd = this.wired ? CMD.colorsWired : CMD.colorsReceiver;
    return this.#serial(() => this.#write(cmd, table));
  }

  /** Bateria { percent, charging }, só pelo receptor; null no cabo ou sem resposta (teclado dormindo). */
  readBattery() {
    if (this.wired) return Promise.resolve(null);
    return this.#serial(() => this.#read(CMD.battery, BATTERY_SIZE).then(parseBattery, () => null));
  }

  // --- Por dentro -----------------------------------------------------------------

  #serial(task) {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => {});
    return run;
  }

  async #readChecked(cmd, size, valid) {
    const packets = []; // pelo receptor, somados entre as tentativas
    for (let i = 0; i < READ_ATTEMPTS; i++) {
      const data = await this.#read(cmd, size, packets).catch(() => null);
      if (valid(data)) return data;
      await sleep(200);
    }
    throw new Error('O teclado não respondeu por completo');
  }

  async #read(cmd, size, packets = []) {
    if (this.wired) {
      await this.device.sendFeatureReport(WIRED_REPORT, wiredPacket(cmd | READ, [], size));
      await sleep(20);
      return parseWiredResponse(bytesOf(await this.device.receiveFeatureReport(WIRED_REPORT)), size);
    }
    const readCmd = cmd | RECEIVER_READ;
    const done = this.#collect((p) => {
      if (p.cmd !== readCmd) return false;
      packets.push(p);
      return new Set(packets.map((x) => x.index)).size >= p.total;
    }, READ_TIMEOUT_MS);
    await this.device.sendReport(RECEIVER_REPORT, receiverReadRequest(readCmd));
    await done;
    return assembleReceiverPackets(packets);
  }

  async #write(cmd, data) {
    if (this.wired) {
      await this.device.sendFeatureReport(WIRED_REPORT, wiredPacket(cmd, data));
      return;
    }
    // Pelo receptor, o teclado confirma cada pacote.
    for (const [index, packet] of receiverWritePackets(cmd, data).entries()) {
      let confirmed = false;
      for (let attempt = 0; attempt < WRITE_ATTEMPTS && !confirmed; attempt++) {
        const ack = this.#collect((p) => p.cmd === cmd && p.index === index, PACKET_TIMEOUT_MS);
        await this.device.sendReport(RECEIVER_REPORT, packet);
        confirmed = await ack;
      }
      if (!confirmed) throw new Error('O teclado não confirmou a gravação');
    }
  }

  /** Escuta pacotes até `match` dizer que acabou (true) ou dar o tempo (false). */
  #collect(match, ms) {
    return new Promise((resolve) => {
      const fn = (p) => {
        if (match(p)) finish(true);
      };
      const finish = (ok) => {
        clearTimeout(timer);
        this.listeners.delete(fn);
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), ms);
      this.listeners.add(fn);
    });
  }
}
