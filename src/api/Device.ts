import AsyncLock from 'async-lock';
import Crypto from 'crypto';
import EventEmitter from 'events';
import Net from 'net';

import DebugMode from '../debugMode';
import { AccessoryType } from '../types/Accessory';
import {
  InputPacket,
  ResponsePacket,
  PACKET_TYPE,
  DeviceContext,
  InfoPacket
} from '../types/Device';

export default class Device {
  private static readonly LOCK_NAME = 'device-operation';
  private static readonly PORT = 8098;
  private static readonly TYPES = {
    1: AccessoryType.Thermostat
  };

  public readonly eventHandler = new EventEmitter();
  private readonly client = new Net.Socket();
  private readonly lock = new AsyncLock();

  private pingInterval: NodeJS.Timer | null = null;
  private pingResponded = false;
  private isFirstLoad = true;
  private isOpened = false;

  private readonly errorDebug: (...message: any[]) => void;
  private readonly debug: (...message: any[]) => void;

  constructor(
    debug: DebugMode,
    private readonly loadDevice: (
      context: DeviceContext,
      device: Device
    ) => void,
    private readonly ip: string,
    private readonly uuid: string,
    private readonly encryptionKey?: string
  ) {
    this.errorDebug = debug.errorDebug.bind(debug, `[Device][${ip}][Error]`);
    this.debug = debug.debug.bind(debug, `[Device][${ip}]`);

    this.client.setTimeout(10 * 1000);
    this.client.on('timeout', this.onTimeout.bind(this));
    this.client.on('error', this.onError.bind(this));
    this.client.on('close', this.onClose.bind(this));
    this.client.on('data', this.onData.bind(this));
    this.client.on('end', this.onEnd.bind(this));

    this.connect();
  }

  public async sendData(
    type: PACKET_TYPE.GET | PACKET_TYPE.SET,
    data: Record<string, any>,
    id?: string
  ): Promise<void> {
    await this.lock.acquire(Device.LOCK_NAME, () => {
      if (type !== PACKET_TYPE.GET && type !== PACKET_TYPE.SET) {
        this.errorDebug('Invalid packet type.');
        return;
      }

      this.sendPacket({ type, body: data, id });
    });
  }

  private sendPacket(input: InputPacket): void {
    if (!this.isOpened) {
      this.errorDebug('TCP connection is not opened.');
      return;
    }

    const raw = JSON.stringify(input);
    this.debug(`Sending data to the server: (${raw}).`);
    const data = this.encryptAES256CTR(raw);
    this.client.write(`${data.length};${data}`);
  }

  private connect() {
    this.debug('Connecting to the device.');
    this.client.connect(
      { port: Device.PORT, host: this.ip },
      this.connectCallback.bind(this)
    );
  }

  private handlePacket(packet: ResponsePacket<InfoPacket>): void {
    switch (packet.type) {
      case PACKET_TYPE.INFO:
        break;
      case PACKET_TYPE.ERROR:
        this.errorDebug(packet.message || 'Unknown error.');
        return;
      case PACKET_TYPE.GET:
      case PACKET_TYPE.SET:
        this.eventHandler.emit(
          `data${packet.id ? `-${packet.id}` : ''}`,
          packet.data
        );
        return;
      default:
        return;
    }

    if (!this.isFirstLoad) {
      return;
    }

    this.isFirstLoad = false;

    const context = {
      info: packet.data as InfoPacket,
      ip: this.ip,
      uuid: this.uuid,
      type: Device.TYPES[packet.data?.type as number]
    };

    this.loadDevice(context, this);
  }

  private connectCallback(): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      this.isOpened = true;
      this.debug('TCP connection established with the server.');
      this.sendPacket({ type: PACKET_TYPE.INFO });

      if (!this.pingInterval) {
        this.debug('Starting ping interval.');
        this.pingInterval = setInterval(this.sendPing.bind(this), 5 * 1000);
      }
    });
  }

  private firstChunk = true;
  private dataBuilder = '';
  private dataSize = 0;
  private dataRead = 0;

  private onData(chunk: Buffer): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      try {
        if (this.firstChunk) {
          const [size, partial] = chunk.toString('utf8').split(';');
          this.dataSize = parseInt(size);
          this.dataRead = partial.length;
          this.dataBuilder = partial;
          this.firstChunk = false;
        } else {
          const partial = chunk.toString('utf8');
          this.dataRead += partial.length;
          this.dataBuilder += partial;
        }

        if (this.dataRead >= this.dataSize) {
          const rawData = this.decryptAES256CTR(this.dataBuilder.toString());
          const data = JSON.parse(rawData);
          this.debug(
            `Data received from the server: (${JSON.stringify(data)}).`
          );

          this.pingResponded = true;
          this.firstChunk = true;
          this.dataBuilder = '';
          this.dataSize = 0;
          this.dataRead = 0;

          this.handlePacket(data);
        } else {
          this.debug(
            `Data chunk received from the server: (${this.dataRead} / ${this.dataSize}).`
          );
        }
      } catch (error: any) {
        this.errorDebug(error.message);
      }
    });
  }

  private onClose(): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      this.isOpened = false;
      this.debug('Requested a CLOSE to the TCP connection');
      this.connect();
    });
  }

  private onError(error: Error): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      this.errorDebug(error.message);
    });
  }

  private onTimeout(): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      this.debug('TCP connection timed out');

      this.client.end();
      this.client.destroy();
    });
  }

  private onEnd(): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      this.isOpened = false;
      this.debug('Requested an end to the TCP connection');
    });
  }

  private sendPing(): void {
    this.lock.acquire(Device.LOCK_NAME, () => {
      if (!this.isOpened || !this.pingResponded) {
        return;
      }

      this.pingResponded = false;
      this.sendPacket({ type: PACKET_TYPE.PING });
    });
  }

  private encryptAES256CTR(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }

    const iv = Crypto.randomBytes(16);

    const cipher = Crypto.createCipheriv(
      'aes-256-ctr',
      Buffer.from(this.encryptionKey, 'base64'),
      iv
    );

    return Buffer.concat([iv, cipher.update(data), cipher.final()]).toString(
      'base64'
    );
  }

  private decryptAES256CTR(data: string): string {
    if (!this.encryptionKey) {
      return data;
    }

    const cipherText = Buffer.from(data, 'base64');

    const decipher = Crypto.createDecipheriv(
      'aes-256-ctr',
      Buffer.from(this.encryptionKey, 'base64'),
      cipherText.subarray(0, 16)
    );

    return Buffer.concat([
      decipher.update(cipherText.subarray(16, cipherText.length)),
      decipher.final()
    ]).toString('utf8');
  }
}
