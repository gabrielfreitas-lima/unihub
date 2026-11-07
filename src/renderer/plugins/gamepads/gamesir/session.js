// Uma sessão por controle GameSir conectado: abre o HID, mantém o
// heartbeat, encaminha relatórios e serializa comandos pela fila.

import { CommandQueue } from '../../../core/command-queue.js';
import { withReportId } from '../../../core/bytes.js';
import {
  commands, classify, readBlockPackets, writeBlockPackets, parseFirmwareVersion, parseCurrentProfile,
  hasPhysicalInput, parseBattery, isBlockReply, blockReplyData, isWriteAck, PROFILE_SIZE, PROFILE_SLOTS, REPORT_RATE_OFFSET, Cmd,
} from './protocol.js';
import { BUTTONS, EXTRA_KEYS, KEYS_OFFSET, KEY_SIZE } from './mapping.js';

const HEARTBEAT_MS = 1000;
const LOG_LIMIT = 300;

export class GameSirSession extends EventTarget {
  constructor(device) {
    super();
    this.device = device;
    this.log = [];
    this.stateReports = 0;
    this.lastState = null;
    this.battery = null; // { percent, charging } do último relatório de estado
    this.batteryAt = 0; // quando a bateria foi lida pela última vez (ms)
    this.queue = new CommandQueue({ send: (bytes) => this.#write(bytes) });
    this.onInput = (event) => this.#onInput(event);
  }

  async open() {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener('inputreport', this.onInput);
    this.heartbeatTimer = setInterval(() => this.#heartbeat(), HEARTBEAT_MS);
    this.#heartbeat();
  }

  /**
   * Leitura rápida com a janela fora de foco: um heartbeat faz o controle
   * mandar o relatório de estado por um instante, o bastante para ler a bateria.
   * Resolve com a bateria lida, ou null se nada chegar a tempo.
   */
  pulse(timeoutMs = 1500) {
    if (!this.device.opened) return Promise.resolve(null);
    return new Promise((resolve) => {
      const before = this.batteryAt;
      const timer = setTimeout(done, timeoutMs);
      const onState = () => { if (this.batteryAt !== before) done(); };
      function done() {
        clearTimeout(timer);
        session.removeEventListener('state', onState);
        resolve(session.batteryAt !== before ? session.battery : null);
      }
      const session = this;
      this.addEventListener('state', onState);
      this.device.sendReport(0x0f, commands.heartbeat().subarray(1)).catch(done);
    });
  }

  async close() {
    clearInterval(this.heartbeatTimer);
    this.queue.close();
    this.device.removeEventListener('inputreport', this.onInput);
    if (this.device.opened) await this.device.close().catch(() => {});
  }

  /** Envia sem esperar resposta. */
  send(bytes) {
    this.#push('out', bytes);
    return this.queue.enqueue(bytes);
  }

  /** Envia e espera a resposta do mesmo comando (com reenvio). */
  request(bytes, { maxAttempts } = {}) {
    this.#push('out', bytes);
    const cmd = bytes[1];
    return this.queue.enqueue(bytes, {
      maxAttempts,
      expect: (report) => {
        const info = classify(report);
        return info.kind === 'response' && info.cmd === cmd;
      },
    });
  }

  /**
   * Diz se há um controle respondendo nesta interface. Um dongle com o
   * controle desligado continua aparecendo no sistema, mas não responde.
   */
  async probe() {
    try {
      await this.request(commands.readFirmwareVersion(), { maxAttempts: 3 });
      return true;
    } catch {
      return false;
    }
  }

  async readFirmwareVersion() {
    const report = await this.request(commands.readFirmwareVersion());
    return { value: parseFirmwareVersion(report), report };
  }

  async readCurrentProfile() {
    const report = await this.request(commands.readCurrentProfile());
    return { value: parseCurrentProfile(report), report };
  }

  switchProfile(slot) {
    return this.send(commands.switchProfile(slot));
  }

  async vibrate(left, right, ms = 400) {
    await this.send(commands.vibrate(left, right));
    await new Promise((r) => setTimeout(r, ms));
    await this.send(commands.vibrate(0, 0));
  }

  lightPreview(playing, frame) {
    return this.send(commands.lightPreview(playing, frame));
  }

  /** Lê `length` bytes de um slot a partir de `start`, em pacotes de 58, e devolve os dados juntos. */
  async readBlock(slot, length, start = 0) {
    const out = new Uint8Array(length);
    for (const pkt of readBlockPackets(slot, start, length)) {
      const offset = pkt[3] << 8 | pkt[4];
      this.#push('out', pkt);
      const report = await this.queue.enqueue(pkt, { expect: (r) => isBlockReply(r, slot, offset) });
      const data = blockReplyData(report);
      if (data.length !== pkt[5]) throw new Error(`Bloco incompleto no offset ${offset}`);
      out.set(data, offset - start);
    }
    return out;
  }

  /** Trecho de mapeamento dos 16 botões de um perfil (slot 1–4). */
  readMapping(slot) {
    return this.readBlock(slot, BUTTONS.length * KEY_SIZE, KEYS_OFFSET);
  }

  /** Grava `bytes` (trecho completo de mapeamento) só onde mudou em relação a `before`. */
  async writeMapping(slot, before, bytes) {
    let start = -1;
    let end = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (before[i] !== bytes[i]) {
        if (start === -1) start = i;
        end = i;
      }
    }
    if (start === -1) return;
    await this.writeBlock(slot, bytes.subarray(start, end + 1), KEYS_OFFSET + start);
  }

  /** Os 7 bytes de cada paddle e gatilho de um perfil, na ordem de EXTRA_KEYS. */
  async readPaddles(slot) {
    const out = [];
    for (const paddle of EXTRA_KEYS) out.push(await this.readBlock(slot, KEY_SIZE, paddle.offset));
    return out;
  }

  /** Grava os 7 bytes de um paddle, se mudaram em relação a `before`. */
  async writePaddle(slot, paddle, before, bytes) {
    if (bytes.some((v, i) => v !== before[i])) await this.writeBlock(slot, bytes, paddle.offset);
  }

  /** Marcha da taxa de relatório em cada perfil: { 1: gear, 2: gear, … }. */
  async readReportRates() {
    const out = {};
    for (const slot of PROFILE_SLOTS) {
      const [gear] = await this.readBlock(slot, 1, REPORT_RATE_OFFSET);
      out[slot] = gear;
    }
    return out;
  }

  /**
   * Grava a mesma marcha em todos os perfis, para a taxa não mudar ao trocar
   * de perfil.
   */
  async writeReportRate(gear) {
    for (const slot of PROFILE_SLOTS) {
      await this.writeBlock(slot, Uint8Array.of(gear), REPORT_RATE_OFFSET);
    }
  }

  /** Grava `data` no slot a partir de `offset`, esperando a confirmação de cada pacote. */
  async writeBlock(slot, data, offset = 0) {
    for (const pkt of writeBlockPackets(slot, data, offset)) {
      this.#push('out', pkt);
      await this.queue.enqueue(pkt, { expect: isWriteAck });
    }
  }

  /**
   * Lê os blocos de um perfil e devolve as respostas brutas. O formato das
   * respostas varia por modelo, então o backup guarda tudo como veio.
   * onProgress recebe a fração já lida (0 a 1) a cada bloco.
   */
  async backupProfile(slot, length = PROFILE_SIZE, onProgress = null) {
    const responses = [];
    const packets = readBlockPackets(slot, 0, length);
    for (const pkt of packets) {
      const report = await this.request(pkt);
      responses.push(Array.from(report));
      onProgress?.(responses.length / packets.length);
    }
    return {
      format: 'unihub.gamesir.raw-profile.v1',
      device: { name: this.device.productName, vendorId: this.device.vendorId, productId: this.device.productId },
      slot,
      length,
      readCommand: Cmd.READ_BLOCK,
      responses,
      createdAt: new Date().toISOString(),
    };
  }

  #write(bytes) {
    return this.device.sendReport(bytes[0], bytes.subarray(1));
  }

  #heartbeat() {
    if (!this.device.opened || !document.hasFocus()) return;
    this.device.sendReport(0x0f, commands.heartbeat().subarray(1)).catch(() => {});
  }

  #onInput(event) {
    const report = withReportId(event.reportId, event.data);
    const info = classify(report);
    if (info.kind === 'state') {
      this.stateReports++;
      const touched = hasPhysicalInput(this.lastState, report);
      this.lastState = report;
      this.dispatchEvent(new CustomEvent('state', { detail: report }));
      if (touched) this.dispatchEvent(new CustomEvent('activity'));
      // Avisa só quando a bateria muda (o relatório chega centenas de vezes por segundo).
      const battery = parseBattery(report);
      if (battery) this.batteryAt = Date.now();
      if (battery && (battery.percent !== this.battery?.percent || battery.charging !== this.battery?.charging)) {
        this.battery = battery;
        this.dispatchEvent(new CustomEvent('battery', { detail: battery }));
      }
    } else {
      this.#push('in', report);
    }
    this.queue.onReport(report);
  }

  #push(direction, bytes) {
    this.log.push({ direction, bytes: Array.from(bytes), time: Date.now() });
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
    this.dispatchEvent(new CustomEvent('log'));
  }
}
