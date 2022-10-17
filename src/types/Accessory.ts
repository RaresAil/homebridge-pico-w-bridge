import { randomBytes } from 'crypto';
import { Service } from 'homebridge';
import AsyncLock from 'async-lock';

import Platform, { DevicePlatformAccessory } from '../platform';
import { PACKET_TYPE } from './Device';
import Device from '../api/Device';

export enum AccessoryType {
  Thermostat = 'Thermostat',
  Desk = 'Desk'
}

abstract class Accessory<T> {
  protected readonly lock = new AsyncLock();
  protected service?: Service;

  protected abstract handleData(data: T): void;
  protected abstract _cachedData: T;
  abstract get UUID(): string;

  public get cachedData(): T {
    return { ...this._cachedData };
  }

  constructor(
    protected readonly device: Device,
    protected readonly platform: Platform,
    protected readonly accessory: DevicePlatformAccessory
  ) {
    this.device.eventHandler.on('data', this.handleData.bind(this));

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Raspberry Pi'
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.accessory.context.type
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.info.serial_number
      )
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        this.accessory.context.info.firmware_version
      );
  }

  protected update(data: Partial<T>): Promise<void> {
    return this.lock.acquire(
      'update',
      () =>
        new Promise<void>((resolve) => {
          const cmd_id = randomBytes(12).toString('hex');
          const eventName = `data-${cmd_id}`;
          let responded = false;

          const eventCallback = (data: T) => {
            if (responded) {
              return;
            }

            this.handleData(data);
            responded = true;
            clearTimeout(timeout);
            resolve();
          };

          const timeout = setTimeout(() => {
            if (!responded) {
              responded = true;
              this.device.eventHandler.removeListener(eventName, eventCallback);
              resolve();
            }
          }, 2000);

          this.device.eventHandler.once(eventName, eventCallback);
          this.device.sendData(
            PACKET_TYPE.SET,
            {
              ...data
            },
            cmd_id
          );
        })
    );
  }

  private receivingData = false;
  protected requestUpdateData(): Promise<void> {
    return this.lock.acquire('update', async () => {
      if (!this.receivingData) {
        this.receivingData = true;
        setTimeout(() => {
          this.device.sendData(PACKET_TYPE.GET, {});
          this.receivingData = false;
        }, 750);
      }
    });
  }
}

export interface AccessoryConstructor {
  new (
    device: Device,
    platform: Platform,
    accessory: DevicePlatformAccessory
  ): Accessory<any>;
}

export default Accessory;
