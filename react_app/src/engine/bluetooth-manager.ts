/**
 * PoloBridge Pro — Web Bluetooth API GATT Driver
 * Interfaces directly with the ESP32-S3 firmware (polobridge_firmware.ino)
 */

export const POLOBRIDGE_SERVICE_UUID = '4fa10001-b5a3-f393-e0a9-e50e24dcca9e';
export const POLOBRIDGE_COMMAND_CHAR_UUID = '4fa10002-b5a3-f393-e0a9-e50e24dcca9e';
export const POLOBRIDGE_STATUS_CHAR_UUID = '4fa10003-b5a3-f393-e0a9-e50e24dcca9e';

export enum BleCommandCode {
  CMD_STOP           = 0x01,
  CMD_START          = 0x02,
  CMD_RESET_30       = 0x03,
  CMD_RESET_20       = 0x04,
  CMD_SET_SHOT_CLOCK = 0x05,
  CMD_SET_GAME_CLOCK = 0x06,
  CMD_TRIGGER_HORN   = 0x07,
  CMD_SET_SCORES     = 0x08,
  CMD_PULSE_PICKLE   = 0x09,
  CMD_SET_PROTOCOL   = 0x0B,
}

export type BleConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unsupported' | 'error';

export interface DongleStatusPacket {
  isRunning: boolean;
  hornActive: boolean;
  isBlanked: boolean;
  gameTimeMs: number;
  shotTimeMs: number;
  scoreWhite: number;
  scoreDark: number;
  period: number;
  protocol: 'cts' | 'daktronics';
}

// Minimal TypeScript declarations for Web Bluetooth API to ensure strict compilation without external @types
interface WebBluetoothCharacteristic extends EventTarget {
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
  writeValue: (value: BufferSource) => Promise<void>;
  startNotifications: () => Promise<WebBluetoothCharacteristic>;
  value?: DataView;
}

interface WebBluetoothService {
  getCharacteristic: (uuid: string) => Promise<WebBluetoothCharacteristic>;
}

interface WebBluetoothGATTServer {
  connected: boolean;
  connect: () => Promise<WebBluetoothGATTServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<WebBluetoothService>;
}

interface WebBluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: WebBluetoothGATTServer;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice: (options: {
      filters?: Array<{ namePrefix?: string; services?: string[] }>;
      optionalServices?: string[];
      acceptAllDevices?: boolean;
    }) => Promise<WebBluetoothDevice>;
  };
}

export class PoloBridgeBleManager {
  private device: WebBluetoothDevice | null = null;
  private server: WebBluetoothGATTServer | null = null;
  private commandChar: WebBluetoothCharacteristic | null = null;
  private statusChar: WebBluetoothCharacteristic | null = null;

  private statusCallback: ((packet: DongleStatusPacket) => void) | null = null;
  private connectionCallback: ((status: BleConnectionStatus, deviceName?: string, errorMsg?: string) => void) | null = null;

  public isSupported(): boolean {
    const nav = navigator as NavigatorWithBluetooth;
    return typeof nav !== 'undefined' && Boolean(nav.bluetooth);
  }

  public onStatusUpdate(cb: (packet: DongleStatusPacket) => void) {
    this.statusCallback = cb;
  }

  public onConnectionChange(cb: (status: BleConnectionStatus, deviceName?: string, errorMsg?: string) => void) {
    this.connectionCallback = cb;
  }

  public async connect(): Promise<boolean> {
    const nav = navigator as NavigatorWithBluetooth;
    if (!nav.bluetooth) {
      this.connectionCallback?.('unsupported', undefined, 'Web Bluetooth API is not available in this browser (use Chrome/Edge on Desktop or Android, or Bluefy on iPad).');
      return false;
    }

    try {
      this.connectionCallback?.('connecting');

      const device = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'PoloBridge' },
          { services: [POLOBRIDGE_SERVICE_UUID] }
        ],
        optionalServices: [POLOBRIDGE_SERVICE_UUID]
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', this.handleDisconnect);

      if (!device.gatt) {
        throw new Error('GATT server not available on selected device.');
      }

      const server = await device.gatt.connect();
      this.server = server;

      const service = await server.getPrimaryService(POLOBRIDGE_SERVICE_UUID);
      this.commandChar = await service.getCharacteristic(POLOBRIDGE_COMMAND_CHAR_UUID);
      this.statusChar = await service.getCharacteristic(POLOBRIDGE_STATUS_CHAR_UUID);

      await this.statusChar.startNotifications();
      this.statusChar.addEventListener('characteristicvaluechanged', this.handleNotification);

      this.connectionCallback?.('connected', device.name || 'PoloBridge-Pro');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // User cancelled picker vs actual hardware error
      if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('canceled') || msg.toLowerCase().includes('user')) {
        this.connectionCallback?.('disconnected');
      } else {
        this.connectionCallback?.('error', undefined, msg);
      }
      return false;
    }
  }

  public disconnect() {
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }
    if (this.server && this.server.connected) {
      this.server.disconnect();
    }
    this.device = null;
    this.server = null;
    this.commandChar = null;
    this.statusChar = null;
    this.connectionCallback?.('disconnected');
  }

  private handleDisconnect = () => {
    this.server = null;
    this.commandChar = null;
    this.statusChar = null;
    this.connectionCallback?.('disconnected');
  };

  private handleNotification = (event: Event) => {
    const target = event.target as WebBluetoothCharacteristic;
    const view = target.value;
    if (!view || view.byteLength < 13) return;

    const flags = view.getUint8(0);
    const isRunning = Boolean(flags & 0x01);
    const hornActive = Boolean(flags & 0x02);
    const isBlanked = Boolean(flags & 0x04);

    const gameTimeMs =
      (view.getUint8(1) << 24) |
      (view.getUint8(2) << 16) |
      (view.getUint8(3) << 8) |
      view.getUint8(4);

    const shotTimeMs =
      (view.getUint8(5) << 24) |
      (view.getUint8(6) << 16) |
      (view.getUint8(7) << 8) |
      view.getUint8(8);

    const scoreWhite = view.getUint8(9);
    const scoreDark = view.getUint8(10);
    const period = view.getUint8(11);
    const protoByte = view.getUint8(12);

    this.statusCallback?.({
      isRunning,
      hornActive,
      isBlanked,
      gameTimeMs: gameTimeMs >>> 0,
      shotTimeMs: shotTimeMs >>> 0,
      scoreWhite,
      scoreDark,
      period,
      protocol: protoByte === 1 ? 'daktronics' : 'cts',
    });
  };

  // --- Low-Latency Command Dispatchers ---
  private async sendBytes(bytes: number[]): Promise<boolean> {
    if (!this.commandChar || !this.server?.connected) return false;
    try {
      const payload = new Uint8Array(bytes);
      if (this.commandChar.writeValueWithoutResponse) {
        await this.commandChar.writeValueWithoutResponse(payload);
      } else {
        await this.commandChar.writeValue(payload);
      }
      return true;
    } catch {
      return false;
    }
  }

  public sendStart() {
    return this.sendBytes([BleCommandCode.CMD_START]);
  }

  public sendStop() {
    return this.sendBytes([BleCommandCode.CMD_STOP]);
  }

  public sendReset30() {
    return this.sendBytes([BleCommandCode.CMD_RESET_30]);
  }

  public sendReset20() {
    return this.sendBytes([BleCommandCode.CMD_RESET_20]);
  }

  public sendShotClock(shotTimeMs: number) {
    const sec = Math.floor(shotTimeMs / 1000) & 0xff;
    const tenths = Math.floor((shotTimeMs % 1000) / 100) & 0xff;
    return this.sendBytes([BleCommandCode.CMD_SET_SHOT_CLOCK, sec, tenths]);
  }

  public sendGameClock(gameTimeMs: number) {
    const min = Math.floor(gameTimeMs / 60000) & 0xff;
    const sec = Math.floor((gameTimeMs % 60000) / 1000) & 0xff;
    const tenths = Math.floor((gameTimeMs % 1000) / 100) & 0xff;
    return this.sendBytes([BleCommandCode.CMD_SET_GAME_CLOCK, min, sec, tenths]);
  }

  public sendHorn(durationMs = 1200) {
    const hi = (durationMs >> 8) & 0xff;
    const lo = durationMs & 0xff;
    return this.sendBytes([BleCommandCode.CMD_TRIGGER_HORN, hi, lo]);
  }

  public sendScores(scoreWhite: number, scoreDark: number, period: number) {
    return this.sendBytes([
      BleCommandCode.CMD_SET_SCORES,
      scoreWhite & 0xff,
      scoreDark & 0xff,
      period & 0xff
    ]);
  }

  public sendPulsePickle(durationMs = 150) {
    return this.sendBytes([BleCommandCode.CMD_PULSE_PICKLE, durationMs & 0xff]);
  }

  public sendProtocol(protocol: 'cts' | 'daktronics') {
    return this.sendBytes([BleCommandCode.CMD_SET_PROTOCOL, protocol === 'daktronics' ? 1 : 0]);
  }
}

export const bleManager = new PoloBridgeBleManager();
